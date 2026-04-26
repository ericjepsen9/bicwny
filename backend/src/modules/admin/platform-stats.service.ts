// Admin 平台大盘统计
// 14 个并发查询一次拉完，目标响应 < 1s。
// windowDays 控制"近 N 天"口径（活跃用户 / 新增用户 / 答题窗口）。
import { prisma } from '../../lib/prisma.js';
import { periodKey } from '../llm/period.js';

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
}

export async function platformStats(
  windowDays = 7,
): Promise<PlatformStats> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000);
  const monthKey = periodKey('month', now);

  const [
    usersTotal,
    usersByRole,
    usersActiveInWindow,
    usersNewInWindow,
    classesTotal,
    classesActive,
    questionsTotal,
    questionsByStatus,
    questionsByType,
    answersTotal,
    answersCorrect,
    answersInWindow,
    sm2Total,
    sm2Due,
    sm2Mastered,
    llmUsages,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.userAnswer.findMany({
      where: { answeredAt: { gte: windowStart } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.user.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.class.count(),
    prisma.class.count({ where: { isActive: true } }),
    prisma.question.count(),
    prisma.question.groupBy({ by: ['reviewStatus'], _count: { _all: true } }),
    prisma.question.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.userAnswer.count(),
    prisma.userAnswer.count({ where: { isCorrect: true } }),
    prisma.userAnswer.count({ where: { answeredAt: { gte: windowStart } } }),
    prisma.sm2Card.count(),
    prisma.sm2Card.count({ where: { dueDate: { lte: now } } }),
    prisma.sm2Card.count({ where: { status: 'mastered' } }),
    prisma.llmProviderUsage.findMany({
      where: { periodType: 'month', periodKey: monthKey },
    }),
  ]);

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
  };
}
