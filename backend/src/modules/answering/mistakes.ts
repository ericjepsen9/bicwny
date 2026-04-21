// 错题本联动
// - upsertMistake：答错时 wrongCount+1 / 刷新 lastWrongAt / 清 removedAt（重新入册）
// - removeMistake：用户手动移除或掌握后软删除（填 removedAt）
// - listActiveMistakes：未移除的记录，最近错误时间倒序
import type { UserMistakeBook } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export async function upsertMistake(
  userId: string,
  questionId: string,
  at: Date = new Date(),
): Promise<void> {
  await prisma.userMistakeBook.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId, lastWrongAt: at, wrongCount: 1 },
    update: {
      lastWrongAt: at,
      wrongCount: { increment: 1 },
      removedAt: null,
    },
  });
}

export async function removeMistake(
  userId: string,
  questionId: string,
): Promise<void> {
  await prisma.userMistakeBook.updateMany({
    where: { userId, questionId, removedAt: null },
    data: { removedAt: new Date() },
  });
}

export async function listActiveMistakes(
  userId: string,
  limit = 50,
): Promise<UserMistakeBook[]> {
  return prisma.userMistakeBook.findMany({
    where: { userId, removedAt: null },
    orderBy: { lastWrongAt: 'desc' },
    take: limit,
  });
}
