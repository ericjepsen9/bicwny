// SM-2 数据访问层：把纯算法接到 Prisma
// - scheduleReview：首次答题或每次自评都走此入口（upsert）· 可传 tx 与答题主流程同事务
// - listDueCards：到期卡片（按 dueDate 升序），支持按课程过滤
// - getCardStats：面板用状态分布 + 到期数 + 总数
import type { Prisma, PrismaClient, Sm2Card, Sm2Status } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  INITIAL_STATE,
  nextReview,
  type Sm2Rating,
  type Sm2State,
} from './algorithm.js';

type Db = PrismaClient | Prisma.TransactionClient;

export async function scheduleReview(
  userId: string,
  courseId: string,
  questionId: string,
  rating: Sm2Rating,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<Sm2Card> {
  const existing = await db.sm2Card.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });
  const prev: Sm2State = existing
    ? {
        easeFactor: existing.easeFactor,
        interval: existing.interval,
        repetitions: existing.repetitions,
        status: existing.status,
      }
    : INITIAL_STATE;

  const upd = nextReview(prev, rating, now);

  return db.sm2Card.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: {
      userId,
      questionId,
      courseId,
      easeFactor: upd.easeFactor,
      interval: upd.interval,
      repetitions: upd.repetitions,
      dueDate: upd.dueDate,
      lastReviewed: now,
      lastRating: upd.lastRating,
      status: upd.status,
    },
    update: {
      easeFactor: upd.easeFactor,
      interval: upd.interval,
      repetitions: upd.repetitions,
      dueDate: upd.dueDate,
      lastReviewed: now,
      lastRating: upd.lastRating,
      status: upd.status,
    },
  });
}

export async function listDueCards(
  userId: string,
  courseId?: string,
  limit = 20,
  now: Date = new Date(),
) {
  return prisma.sm2Card.findMany({
    where: {
      userId,
      ...(courseId ? { courseId } : {}),
      dueDate: { lte: now },
    },
    orderBy: { dueDate: 'asc' },
    take: limit,
    include: { question: true },
  });
}

export interface CardStats {
  total: number;
  due: number;
  new: number;
  learning: number;
  review: number;
  mastered: number;
}

export async function getCardStats(
  userId: string,
  courseId?: string,
  now: Date = new Date(),
): Promise<CardStats> {
  const where = { userId, ...(courseId ? { courseId } : {}) };

  const [byStatus, due, total] = await Promise.all([
    prisma.sm2Card.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.sm2Card.count({ where: { ...where, dueDate: { lte: now } } }),
    prisma.sm2Card.count({ where }),
  ]);

  const counts: Record<Sm2Status, number> = {
    new: 0,
    learning: 0,
    review: 0,
    mastered: 0,
  };
  for (const g of byStatus) counts[g.status] = g._count._all;

  return { total, due, ...counts };
}
