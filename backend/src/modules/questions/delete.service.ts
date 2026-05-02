// 题目删除
// 权限：
//   coach → 只能删自己创建的题，且仅限未审通过的（draft/pending/rejected/class_private）
//   admin → 任意题
// 级联：
//   UserAnswer / Sm2Card 外键 onDelete 未显式设为 Cascade，若题被删则 Prisma 会拒绝。
//   为避免误伤学习记录，这里采用「强制要求 admin 审核 + 确认无答题记录」的策略：
//     有 UserAnswer / Sm2Card 引用时 → 建议改走 reject 通道；本接口直接拒绝
// 写 AuditLog。
import type { Prisma } from '@prisma/client';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export async function deleteQuestion(
  userId: string,
  role: 'coach' | 'admin',
  questionId: string,
): Promise<{ id: string; deleted: true }> {
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) throw NotFound('题目不存在');

  if (role !== 'admin' && q.createdByUserId !== userId) {
    throw Forbidden('非本人创建的题目');
  }
  if (
    role !== 'admin' &&
    q.visibility === 'public' &&
    q.reviewStatus === 'approved'
  ) {
    throw Forbidden('已审核通过的公开题不可删除，请联系管理员');
  }

  const [answerCount, cardCount] = await Promise.all([
    prisma.userAnswer.count({ where: { questionId } }),
    prisma.sm2Card.count({ where: { questionId } }),
  ]);
  if (answerCount + cardCount > 0) {
    throw BadRequest(
      `题目已有 ${answerCount} 条答题记录 · ${cardCount} 张 SM-2 卡，不可物理删除；请联系管理员驳回`,
    );
  }

  await prisma.$transaction([
    prisma.question.delete({ where: { id: questionId } }),
    prisma.auditLog.create({
      data: {
        // adminId 列名沿用，但语义已是「执行者 userId」（admin / coach 自删均落实例 user id）
        // 强约束 NOT NULL 保证审计可追溯（没有匿名删除路径）
        adminId: userId,
        action: 'question.delete',
        targetType: 'question',
        targetId: questionId,
        before: {
          type: q.type,
          visibility: q.visibility,
          reviewStatus: q.reviewStatus,
          questionText: q.questionText,
          createdByUserId: q.createdByUserId,
          actorRole: role,
        } as Prisma.InputJsonValue,
        after: {} as Prisma.InputJsonValue,
      },
    }),
  ]);

  return { id: questionId, deleted: true };
}
