// 收藏：UserFavorite @@unique([userId, questionId])
// addFavorite 用 upsert 保证幂等；remove 走 deleteMany 避免不存在时报错。
import type { UserFavorite } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export async function addFavorite(
  userId: string,
  questionId: string,
): Promise<UserFavorite> {
  return prisma.userFavorite.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId },
    update: {},
  });
}

export async function removeFavorite(
  userId: string,
  questionId: string,
): Promise<void> {
  await prisma.userFavorite.deleteMany({ where: { userId, questionId } });
}

export async function listFavorites(
  userId: string,
  limit = 100,
) {
  const favs = await prisma.userFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
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
