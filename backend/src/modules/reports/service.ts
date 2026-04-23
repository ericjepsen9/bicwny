// 题目举报
// createReport  任意用户举报同一题多次允许（可分不同 reason）
// listPending   Admin 拉待处理队列
// handleReport  Admin 通过 / 驳回 + AuditLog
import type {
  Prisma,
  QuestionReport,
  ReportReason,
} from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

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

export async function listPendingReports(opts: ListPendingOpts = {}) {
  return prisma.questionReport.findMany({
    where: {
      status: 'pending',
      ...(opts.reason ? { reason: opts.reason } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: opts.limit ?? 50,
  });
}

export type ReportDecision = 'accept' | 'reject';

export async function handleReport(
  reportId: string,
  adminId: string,
  decision: ReportDecision,
  note?: string,
): Promise<QuestionReport> {
  const r = await prisma.questionReport.findUnique({ where: { id: reportId } });
  if (!r) throw NotFound('举报记录不存在');
  if (r.status !== 'pending') {
    throw BadRequest(`举报当前状态 ${r.status}，无需处理`);
  }

  const newStatus = decision === 'accept' ? 'accepted' : 'rejected';
  const before = { status: r.status };
  const after: Record<string, unknown> = {
    status: newStatus,
    ...(note ? { note } : {}),
  };

  const [updated] = await prisma.$transaction([
    prisma.questionReport.update({
      where: { id: reportId },
      data: { status: newStatus },
    }),
    prisma.auditLog.create({
      data: {
        adminId,
        action: `report.${decision}`,
        targetType: 'questionReport',
        targetId: reportId,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
      },
    }),
  ]);
  return updated;
}
