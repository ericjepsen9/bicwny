// Admin 题目审核
// - listPending(opts?)：reviewStatus=pending 的队列（FIFO）
// - reviewQuestion(id, adminId, decision, reason?)：通过 / 驳回 + 写 AuditLog
import type { Prisma, Question } from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export interface ListPendingOpts {
  courseId?: string;
  limit?: number;
}

export async function listPending(
  opts: ListPendingOpts = {},
): Promise<Question[]> {
  return prisma.question.findMany({
    where: {
      reviewStatus: 'pending',
      ...(opts.courseId ? { courseId: opts.courseId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: opts.limit ?? 50,
  });
}

export type ReviewDecision = 'approve' | 'reject';

export async function reviewQuestion(
  questionId: string,
  adminId: string,
  decision: ReviewDecision,
  reason?: string,
): Promise<Question> {
  if (decision === 'reject' && !reason) {
    throw BadRequest('驳回必须提供 reason');
  }

  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) throw NotFound('题目不存在');
  if (q.reviewStatus !== 'pending') {
    throw BadRequest(`题目当前状态为 ${q.reviewStatus}，无需审核`);
  }

  const newStatus = decision === 'approve' ? 'approved' : 'rejected';
  const before = { reviewStatus: q.reviewStatus, reviewed: q.reviewed };
  const after: Record<string, unknown> = {
    reviewStatus: newStatus,
    reviewed: true,
    ...(reason ? { reason } : {}),
  };

  // M4: reject 时联动清用户侧 · 不让低质题继续困扰用户
  // - mistakes 软删（保留 removedAt 痕迹便于审计 / 用户提问时能回溯）
  // - favorites 硬删（用户主动收藏的，反正已经看不到了）
  // - sm2 cards 硬删（避免每日复习推送）
  const cascadeOps =
    decision === 'reject'
      ? [
          prisma.userMistakeBook.updateMany({
            where: { questionId, removedAt: null },
            data: { removedAt: new Date() },
          }),
          prisma.userFavorite.deleteMany({ where: { questionId } }),
          prisma.sm2Card.deleteMany({ where: { questionId } }),
        ]
      : [];

  const txResults = await prisma.$transaction([
    prisma.question.update({
      where: { id: questionId },
      data: { reviewStatus: newStatus, reviewed: true },
    }),
    prisma.auditLog.create({
      data: {
        adminId,
        action: `question.${decision}`,
        targetType: 'question',
        targetId: questionId,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
      },
    }),
    ...cascadeOps,
  ]);

  return txResults[0] as Question;
}
