// 题目删除
// 权限（用户决策 10：coach 完整编辑管理权限）：
//   coach → 只能删自己创建的题（任意状态 · 含 approved public）
//   admin → 任意题
// 级联（审计 D1）：
//   UserAnswer.question = onDelete:Restrict（显式）· 保护学员答题历史，题有答题时 Prisma 拒删。
//   Sm2Card / UserFavorite / UserMistakeBook = onDelete:Cascade · 物理删时自动清理。
//   策略：仅当「无答题历史」(answerCount=0) 才物理删；有历史的题应走 reject 软退役。
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

  // 审计 D1：只看答题历史（UserAnswer · Restrict 保护）· Sm2Card/收藏/错题本均 Cascade 自动清
  //   「无答题历史」= 可物理删；有历史的题应走 reject 软退役（保留 UserAnswer）
  const answerCount = await prisma.userAnswer.count({ where: { questionId } });
  if (answerCount > 0) {
    throw BadRequest(
      `题目已有 ${answerCount} 条答题记录，不可物理删除；请联系管理员驳回`,
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
