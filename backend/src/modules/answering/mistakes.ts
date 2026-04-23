// 错题本联动
// - upsertMistake：答错时 wrongCount+1 / 刷新 lastWrongAt / 清 removedAt（重新入册）
// - removeMistake：用户手动移除或掌握后软删除（填 removedAt）
// - listActiveMistakes：未移除的记录，最近错误时间倒序
// - getMistakeDetail：单条错题详情（题目全量 + 最近一次作答），owner 访问
import type { Question, UserAnswer, UserMistakeBook } from '@prisma/client';
import { NotFound } from '../../lib/errors.js';
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

export interface MistakeDetail {
  questionId: string;
  wrongCount: number;
  lastWrongAt: Date;
  /** 完整 Question（含 correct 字段）· 仅 owner 能看 */
  question: Question;
  /** 用户最近一次作答；若错题系答题外其他机制注入则可能为 null */
  lastAnswer: Pick<UserAnswer, 'answer' | 'isCorrect' | 'score' | 'answeredAt'> | null;
}

export async function getMistakeDetail(
  userId: string,
  questionId: string,
): Promise<MistakeDetail> {
  const book = await prisma.userMistakeBook.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });
  if (!book || book.removedAt) throw NotFound('错题不存在或已移除');

  const [question, lastAnswer] = await Promise.all([
    prisma.question.findUnique({ where: { id: questionId } }),
    prisma.userAnswer.findFirst({
      where: { userId, questionId },
      orderBy: { answeredAt: 'desc' },
      select: { answer: true, isCorrect: true, score: true, answeredAt: true },
    }),
  ]);
  if (!question) throw NotFound('题目已被删除');

  return {
    questionId: book.questionId,
    wrongCount: book.wrongCount,
    lastWrongAt: book.lastWrongAt,
    question,
    lastAnswer,
  };
}
