// Admin 平台大盘统计
// 16 个并发查询一次拉完，目标响应 < 1s。
// windowDays 控制"近 N 天"口径（活跃用户 / 新增用户 / 答题窗口）。
//
// 单查询超时 2s 后用 fallback（0 / 空对象）继续返回，并把字段名记到 _partial.timedOut。
// 每个查询独立超时，避免某条慢查询锁住整页。
// 60s 内存缓存按 windowDays 分桶 · 路由层 ?cache=true 启用。
import { prisma } from '../../lib/prisma.js';
import { periodKey } from '../llm/period.js';

const QUERY_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  stats: PlatformStats;
  cachedAt: number;
}
// 进程内 Map 缓存 · pm2 多实例下各实例独立维护 · admin 切实例可能看到 60s 内 drift
// 如部署多实例且对 drift 敏感 → 调用方传 useCache=false 或迁 Redis
const cache = new Map<number, CacheEntry>();

type Timeoutable<T> = { ok: true; value: T } | { ok: false };

function timed<T>(p: Promise<T>): Promise<Timeoutable<T>> {
  return Promise.race<Timeoutable<T>>([
    p.then((value) => ({ ok: true as const, value })),
    new Promise<Timeoutable<T>>((resolve) =>
      setTimeout(() => resolve({ ok: false }), QUERY_TIMEOUT_MS),
    ),
  ]);
}

function unwrap<T>(name: string, r: Timeoutable<T>, fallback: T, timedOut: string[]): T {
  if (r.ok) return r.value;
  timedOut.push(name);
  return fallback;
}

export interface PlatformStats {
  windowDays: number;
  users: {
    total: number;
    byRole: Record<string, number>;
    activeInWindow: number;
    newInWindow: number;
  };
  classes: { total: number; active: number; archived: number };
  questions: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  answers: { total: number; correctRate: number; inWindow: number };
  llm: {
    monthCost: number;
    monthTokens: number;
    monthRequests: number;
    errorRate: number;
  };
  sm2: { totalCards: number; dueToday: number; masteredTotal: number };
  /** 超时字段列表 · 仅在有降级时出现 · 前端可据此打灰 */
  _partial?: { timedOut: string[] };
  /** 命中 60s 缓存 · 仅 useCache=true 路径可能为 true */
  _cached?: boolean;
}

export async function platformStats(
  windowDays = 7,
  opts: { useCache?: boolean } = {},
): Promise<PlatformStats> {
  if (opts.useCache) {
    const hit = cache.get(windowDays);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return { ...hit.stats, _cached: true };
    }
  }
  const fresh = await computeStats(windowDays);
  if (opts.useCache) {
    cache.set(windowDays, { stats: fresh, cachedAt: Date.now() });
  }
  return fresh;
}

async function computeStats(windowDays: number): Promise<PlatformStats> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000);
  const monthKey = periodKey('month', now);
  const timedOut: string[] = [];

  const [
    rUsersTotal,
    rUsersByRole,
    rUsersActiveInWindow,
    rUsersNewInWindow,
    rClassesTotal,
    rClassesActive,
    rQuestionsTotal,
    rQuestionsByStatus,
    rQuestionsByType,
    rAnswersTotal,
    rAnswersCorrect,
    rAnswersInWindow,
    rSm2Total,
    rSm2Due,
    rSm2Mastered,
    rLlmUsages,
  ] = await Promise.all([
    timed(prisma.user.count()),
    timed(prisma.user.groupBy({ by: ['role'], _count: { _all: true } })),
    timed(prisma.userAnswer.findMany({
      where: { answeredAt: { gte: windowStart } },
      select: { userId: true },
      distinct: ['userId'],
    })),
    timed(prisma.user.count({ where: { createdAt: { gte: windowStart } } })),
    timed(prisma.class.count()),
    timed(prisma.class.count({ where: { isActive: true } })),
    timed(prisma.question.count()),
    timed(prisma.question.groupBy({ by: ['reviewStatus'], _count: { _all: true } })),
    timed(prisma.question.groupBy({ by: ['type'], _count: { _all: true } })),
    timed(prisma.userAnswer.count()),
    timed(prisma.userAnswer.count({ where: { isCorrect: true } })),
    timed(prisma.userAnswer.count({ where: { answeredAt: { gte: windowStart } } })),
    timed(prisma.sm2Card.count()),
    timed(prisma.sm2Card.count({ where: { dueDate: { lte: now } } })),
    timed(prisma.sm2Card.count({ where: { status: 'mastered' } })),
    timed(prisma.llmProviderUsage.findMany({
      where: { periodType: 'month', periodKey: monthKey },
    })),
  ]);

  const usersTotal = unwrap('users.total', rUsersTotal, 0, timedOut);
  const usersByRole = unwrap('users.byRole', rUsersByRole, [], timedOut);
  const usersActiveInWindow = unwrap('users.activeInWindow', rUsersActiveInWindow, [], timedOut);
  const usersNewInWindow = unwrap('users.newInWindow', rUsersNewInWindow, 0, timedOut);
  const classesTotal = unwrap('classes.total', rClassesTotal, 0, timedOut);
  const classesActive = unwrap('classes.active', rClassesActive, 0, timedOut);
  const questionsTotal = unwrap('questions.total', rQuestionsTotal, 0, timedOut);
  const questionsByStatus = unwrap('questions.byStatus', rQuestionsByStatus, [], timedOut);
  const questionsByType = unwrap('questions.byType', rQuestionsByType, [], timedOut);
  const answersTotal = unwrap('answers.total', rAnswersTotal, 0, timedOut);
  const answersCorrect = unwrap('answers.correct', rAnswersCorrect, 0, timedOut);
  const answersInWindow = unwrap('answers.inWindow', rAnswersInWindow, 0, timedOut);
  const sm2Total = unwrap('sm2.totalCards', rSm2Total, 0, timedOut);
  const sm2Due = unwrap('sm2.dueToday', rSm2Due, 0, timedOut);
  const sm2Mastered = unwrap('sm2.masteredTotal', rSm2Mastered, 0, timedOut);
  const llmUsages = unwrap('llm.usages', rLlmUsages, [], timedOut);

  const byRole: Record<string, number> = {};
  for (const g of usersByRole) byRole[g.role] = g._count._all;
  const byStatus: Record<string, number> = {};
  for (const g of questionsByStatus) byStatus[g.reviewStatus] = g._count._all;
  const byType: Record<string, number> = {};
  for (const g of questionsByType) byType[g.type] = g._count._all;

  let monthCost = 0;
  let monthTokens = 0;
  let monthRequests = 0;
  let monthErrors = 0;
  for (const u of llmUsages) {
    monthCost += Number(u.cost);
    monthTokens += Number(u.tokenCount);
    monthRequests += u.requestCount;
    monthErrors += u.errorCount;
  }

  return {
    windowDays,
    users: {
      total: usersTotal,
      byRole,
      activeInWindow: usersActiveInWindow.length,
      newInWindow: usersNewInWindow,
    },
    classes: {
      total: classesTotal,
      active: classesActive,
      archived: classesTotal - classesActive,
    },
    questions: { total: questionsTotal, byStatus, byType },
    answers: {
      total: answersTotal,
      correctRate: answersTotal > 0 ? answersCorrect / answersTotal : 0,
      inWindow: answersInWindow,
    },
    llm: {
      monthCost: Number(monthCost.toFixed(6)),
      monthTokens,
      monthRequests,
      errorRate: monthRequests > 0 ? monthErrors / monthRequests : 0,
    },
    sm2: {
      totalCards: sm2Total,
      dueToday: sm2Due,
      masteredTotal: sm2Mastered,
    },
    ...(timedOut.length > 0 ? { _partial: { timedOut } } : {}),
  };
}
