// 题目举报工作流
//   createReport   任意用户举报 · 同一题多次允许（不同 reason）
//   listPending    Admin 群集同 question 的待处理 · 含 question stem + reporter 信息
//   handleReport   Admin 处理 · 三种 action：
//                    accept_hide  = 举报成立 · 同时把题目下架（reviewStatus=rejected）
//                    accept_keep  = 举报成立 · 但保留题目（轻微问题 · 已记录）
//                    reject       = 举报不成立
//                  accept_hide 时 · 群发 Notification 给所有该题的举报人
import type {
  Prisma,
  QuestionReport,
  ReportReason,
} from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { createNotification } from '../notifications/service.js';
import { sendPushToUsers } from '../push/service.js';

export interface CreateReportInput {
  questionId: string;
  reason: ReportReason;
  details?: string;
}

export async function createReport(
  userId: string,
  input: CreateReportInput,
): Promise<QuestionReport> {
  const q = await prisma.question.findUnique({
    where: { id: input.questionId },
    select: { id: true },
  });
  if (!q) throw NotFound('题目不存在');

  return prisma.questionReport.create({
    data: {
      userId,
      questionId: input.questionId,
      reason: input.reason,
      details: input.details,
    },
  });
}

export interface ListPendingOpts {
  limit?: number;
  reason?: ReportReason;
}

export interface PendingReportItem {
  id: string;
  reason: ReportReason;
  details: string | null;
  createdAt: Date;
  reporter: { id: string; dharmaName: string | null; email: string | null };
  question: {
    id: string;
    type: string;
    questionText: string;
    source: string;
    courseId: string;
    chapterId: string;
    lessonId: string;
    reviewStatus: string;
  } | null;
  // 同 question 的其他 pending 举报数（含本条）
  siblingPendingCount: number;
}

export async function listPendingReports(opts: ListPendingOpts = {}): Promise<PendingReportItem[]> {
  const items = await prisma.questionReport.findMany({
    where: {
      status: 'pending',
      ...(opts.reason ? { reason: opts.reason } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: opts.limit ?? 50,
    include: { user: true, question: true },
  });

  if (items.length === 0) return [];

  // 一次拉所有相关 question 的 pending 计数 · 避免 N+1
  const qIds = Array.from(new Set(items.map((i) => i.questionId)));
  const counts = await prisma.questionReport.groupBy({
    by: ['questionId'],
    where: { status: 'pending', questionId: { in: qIds } },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.questionId, c._count._all]));

  return items.map((i) => ({
    id: i.id,
    reason: i.reason,
    details: i.details,
    createdAt: i.createdAt,
    reporter: {
      id: i.user.id,
      dharmaName: i.user.dharmaName,
      email: i.user.email,
    },
    question: i.question
      ? {
          id: i.question.id,
          type: i.question.type,
          questionText: i.question.questionText,
          source: i.question.source,
          courseId: i.question.courseId,
          chapterId: i.question.chapterId,
          lessonId: i.question.lessonId,
          reviewStatus: i.question.reviewStatus,
        }
      : null,
    siblingPendingCount: countMap.get(i.questionId) || 1,
  }));
}

export type ReportDecision = 'accept_hide' | 'accept_keep' | 'reject';

export async function handleReport(
  reportId: string,
  adminId: string,
  decision: ReportDecision,
  note?: string,
): Promise<{ updated: QuestionReport; alsoUpdated: number; notified: number }> {
  const r = await prisma.questionReport.findUnique({ where: { id: reportId } });
  if (!r) throw NotFound('举报记录不存在');
  if (r.status !== 'pending') {
    throw BadRequest(`举报当前状态 ${r.status}，无需处理`);
  }

  const newStatus = decision === 'reject' ? 'rejected' : 'accepted';
  const acceptAction =
    decision === 'accept_hide' ? 'hide_question'
      : decision === 'accept_keep' ? 'keep_question'
      : null;

  // accept_hide：把同 question 所有 pending 举报一起标 accepted（同样的 acceptAction）
  // 防止 admin 一条条点 N 次 · 而且让 reporters 都能拿到通知
  const handlingNow = new Date();
  const operations: Prisma.PrismaPromise<unknown>[] = [];
  let alsoUpdated = 0;
  let reportersToNotify: string[] = [];

  if (decision === 'accept_hide' || decision === 'accept_keep') {
    // 找到同 question 所有 pending 举报
    const siblings = await prisma.questionReport.findMany({
      where: { questionId: r.questionId, status: 'pending' },
      select: { id: true, userId: true },
    });
    const siblingIds = siblings.map((s) => s.id);
    reportersToNotify = Array.from(new Set(siblings.map((s) => s.userId)));
    alsoUpdated = siblingIds.length - 1; // 不计当前这条

    operations.push(
      prisma.questionReport.updateMany({
        where: { id: { in: siblingIds } },
        data: {
          status: newStatus,
          handledByUserId: adminId,
          handledAt: handlingNow,
          note: note || null,
          acceptAction,
        },
      }),
    );
    if (decision === 'accept_hide') {
      // 题目下架（不再对学员可见 · 答题接口已查 reviewStatus）
      operations.push(
        prisma.question.update({
          where: { id: r.questionId },
          data: { reviewStatus: 'rejected' },
        }),
      );
    }
  } else {
    // reject · 仅当前这一条
    reportersToNotify = [r.userId];
    operations.push(
      prisma.questionReport.update({
        where: { id: reportId },
        data: {
          status: newStatus,
          handledByUserId: adminId,
          handledAt: handlingNow,
          note: note || null,
        },
      }),
    );
  }

  // AuditLog
  operations.push(
    prisma.auditLog.create({
      data: {
        adminId,
        action: `report.${decision}`,
        targetType: 'questionReport',
        targetId: reportId,
        before: { status: r.status } as Prisma.InputJsonValue,
        after: {
          status: newStatus,
          acceptAction,
          note: note || null,
          questionId: r.questionId,
          alsoUpdated,
        } as Prisma.InputJsonValue,
      },
    }),
  );

  await prisma.$transaction(operations);

  // 通知举报人 · accept_hide 显式说"已下架" · accept_keep 说"已记录"· reject 说"不成立"
  // 单条 reject 时只通知本人 · accept_* 通知所有同 question 举报人
  const titleMap = {
    accept_hide: '您的举报已采纳 · 题目已下架',
    accept_keep: '您的举报已记录 · 题目暂保留',
    reject: '您的举报已审核 · 不予采纳',
  } as const;
  const titleTcMap = {
    accept_hide: '您的舉報已採納 · 題目已下架',
    accept_keep: '您的舉報已記錄 · 題目暫保留',
    reject: '您的舉報已審核 · 不予採納',
  } as const;
  const title = titleMap[decision];
  // 给 reporter 创建站内通知（已有 Notification 表）+ 推送
  const notifiedCount = reportersToNotify.length;
  const defaultBody = decision === 'accept_hide'
    ? '感谢您帮助维护内容质量 · 相关题目已被下架'
    : decision === 'accept_keep'
      ? '问题虽存在但程度较轻 · 我们已记录'
      : '此举报经审核不构成下架理由 · 感谢您的关注';
  await Promise.all(
    reportersToNotify.map((uid) => createNotification({
      userId: uid,
      type: 'system',
      title,
      body: note || defaultBody,
    })),
  );
  // 推送（best-effort · VAPID 没配则 no-op）
  await sendPushToUsers(reportersToNotify, {
    title,
    body: titleTcMap[decision],
    link: 'notification.html',
    tag: 'report-' + r.questionId,
  });

  // 拿回当前这条最新状态返给 admin UI
  const updated = await prisma.questionReport.findUnique({ where: { id: reportId } });
  if (!updated) throw NotFound('举报记录消失');
  return { updated, alsoUpdated, notified: notifiedCount };
}
