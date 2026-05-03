// 收藏：UserFavorite @@unique([userId, questionId])
// addFavorite 用 upsert 保证幂等；remove 走 deleteMany 避免不存在时报错。
import type { Prisma, UserFavorite } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export async function addFavorite(
  userId: string,
  questionId: string,
): Promise<{ favorite: UserFavorite; created: boolean }> {
  const existing = await prisma.userFavorite.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });
  if (existing) return { favorite: existing, created: false };
  const favorite = await prisma.userFavorite.create({
    data: { userId, questionId },
  });
  return { favorite, created: true };
}

/** 返回是否真的删除了 · 让路由层据此决定 200 / 404 */
export async function removeFavorite(
  userId: string,
  questionId: string,
): Promise<{ removed: number }> {
  const r = await prisma.userFavorite.deleteMany({
    where: { userId, questionId },
  });
  return { removed: r.count };
}

export async function listFavorites(
  userId: string,
  limit = 100,
  cursor?: { createdAt: Date; id: string },
) {
  // cursor pagination · seek 模式（不用 OFFSET）
  // orderBy [createdAt desc, id desc] · id 兜底唯一序列
  const where: Prisma.UserFavoriteWhereInput = { userId };
  if (cursor) {
    where.OR = [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ];
  }
  const favs = await prisma.userFavorite.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  // UserFavorite 无 Question 关系，需单独 join 避免 N+1
  if (favs.length === 0) return [];
  const questions = await prisma.question.findMany({
    where: { id: { in: favs.map((f) => f.questionId) } },
  });
  const qMap = new Map(questions.map((q) => [q.id, q]));
  return favs.map((f) => ({
    id: f.id,
    createdAt: f.createdAt,
    questionId: f.questionId,
    question: qMap.get(f.questionId) ?? null,
  }));
}
