// 错题本联动
// - upsertMistake：答错时 wrongCount+1 / 刷新 lastWrongAt / 清 removedAt（重新入册）
// - removeMistake：用户手动移除或掌握后软删除（填 removedAt）
// - listActiveMistakes：未移除的记录，最近错误时间倒序
// - listActiveMistakesWithQuestions：同上 + join 每条的 Question（剥答案）· 供 /api/mistakes 路由直接回包
// - getMistakeDetail：单条错题详情（题目全量 + 最近一次作答），owner 访问
import type { Question, UserAnswer, UserMistakeBook } from '@prisma/client';
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { toPublicView, type PublicQuestion } from './publicView.js';

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

export interface MistakeListItem {
  id: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: Date;
  question: PublicQuestion | null;
}

/**
 * 列表页用：一次查本 + 批量 join Question 并剥答案。
 * UserMistakeBook 与 Question 没有 Prisma 关系，所以 N+1 规避靠 IN 查询。
 */
export async function listActiveMistakesWithQuestions(
  userId: string,
  limit = 50,
): Promise<MistakeListItem[]> {
  const items = await listActiveMistakes(userId, limit);
  if (items.length === 0) return [];
  const questions = await prisma.question.findMany({
    where: { id: { in: items.map((m) => m.questionId) } },
  });
  const qMap = new Map(questions.map((q) => [q.id, q]));
  return items.map((m) => {
    const q = qMap.get(m.questionId);
    return {
      id: m.id,
      questionId: m.questionId,
      wrongCount: m.wrongCount,
      lastWrongAt: m.lastWrongAt,
      question: q ? toPublicView(q) : null,
    };
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
