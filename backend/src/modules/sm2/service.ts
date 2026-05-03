// SM-2 数据访问层：把纯算法接到 Prisma
// - scheduleReview：首次答题或每次自评都走此入口（upsert）· 可传 tx 与答题主流程同事务
// - listDueCards：到期卡片（按 dueDate 升序），支持按课程过滤
// - getCardStats：面板用状态分布 + 到期数 + 总数
//
// 并发幂等：scheduleReview 自身基于 (userId, questionId) unique 的 upsert 是原子的，
// 但在答题主流程的 $transaction 内被并发同 requestId 调用时，外层已通过
// answering/service.ts 的 cache-hit 短路避免重入；外层 P2002 兜底也会让重入路径
// 不进入此函数。本函数只在"非幂等"或"首次 requestId"下被调用。
import type { Prisma, PrismaClient, Sm2Card, Sm2Status } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getUserActiveClassIds } from '../questions/list.service.js';
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
  // C2: 过滤跨班泄漏 · 学员退班后不应继续看到该班私题
  // - 私题 visibility=class_private 必须 ownerClassId ∈ 用户当前活跃班
  // - rejected 题被 M4 cascade 删 sm2Card · 此处 reviewStatus=approved 是双保险
  // SM1: 已 mastered 的卡片不再进 due 队列 · 队列噪音过滤
  // - mastered 仍写 dueDate（未来 6 个月）· 但 listDueCards 不显示
  // - 答错降级会重新设 status=learning · 自动回归队列
  const classIds = await getUserActiveClassIds(userId);
  return prisma.sm2Card.findMany({
    where: {
      userId,
      ...(courseId ? { courseId } : {}),
      dueDate: { lte: now },
      status: { not: 'mastered' },
      question: {
        reviewStatus: 'approved',
        OR: [
          { visibility: 'public' },
          ...(classIds.length > 0
            ? [{ visibility: 'class_private' as const, ownerClassId: { in: classIds } }]
            : []),
        ],
      },
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

  // SM2: 把 3 个查询合并成 2 个
  // - groupBy status 一并算出 byStatus + total（求和即 total · 省一次 count）
  // - due 仍单独 count · 因 Prisma groupBy 不易表达"dueDate ≤ now AND status != mastered"组合
  // SM1 一致性：due 排除 mastered（与 listDueCards 同口径）
  const [byStatus, due] = await Promise.all([
    prisma.sm2Card.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.sm2Card.count({
      where: { ...where, dueDate: { lte: now }, status: { not: 'mastered' } },
    }),
  ]);

  const counts: Record<Sm2Status, number> = {
    new: 0,
    learning: 0,
    review: 0,
    mastered: 0,
  };
  let total = 0;
  for (const g of byStatus) {
    counts[g.status] = g._count._all;
    total += g._count._all;
  }

  return { total, due, ...counts };
}
