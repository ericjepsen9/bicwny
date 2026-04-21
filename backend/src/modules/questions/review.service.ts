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

  const [updated] = await prisma.$transaction([
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
  ]);

  return updated;
}
