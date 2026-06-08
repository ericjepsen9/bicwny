// 班级观修排行 routes
//
//   GET /api/classes/:id/meditation-ranking?period=month
//
// v1 仅支持 month 维度 · 仅按 count 排序
// 用 in-memory cache 5 分钟避免频繁聚合查询

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getClassForMember } from '../class/service.js';
import { periodStart, type RankPeriod } from '../../lib/period.js';
import { rankingPrivacyVersion } from '../../lib/ranking-cache.js';
import { TtlCache } from '../../lib/ttl-cache.js';

const TAGS = ['Meditation'];
const SEC = [{ bearerAuth: [] as string[] }];

const idParam = z.object({ id: z.string().min(1) });
const queryParams = z.object({
  period: z.enum(['week', 'month', 'all']).default('month'),
});

interface RankingRow {
  userId: string;
  dharmaName: string | null;
  count: number;
  totalSec: number;
}

// in-memory cache (key = privacyVersion:classId:period · TTL 5 min · 自清理见 TtlCache)
const cache = new TtlCache<RankingRow[]>(5 * 60 * 1000);

async function queryRanking(classId: string, period: RankPeriod): Promise<RankingRow[]> {
  const since = periodStart(period);

  // 班级主修法本 · 排行仅统计本班法本下的观修（审计 S4 · 与 classStats 课程范围一致）
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { courseId: true } });
  if (!cls) return [];

  // 取班级活跃成员（未退班 · 用户未禁用 · 未隐藏观修可见性）
  const members = await prisma.classMember.findMany({
    where: {
      classId,
      removedAt: null,
      user: {
        isActive: true,
        meditationVisibleToClass: true,
      },
    },
    select: {
      userId: true,
      user: { select: { dharmaName: true } },
    },
  });

  if (members.length === 0) return [];

  const userIds = members.map(m => m.userId);

  // 聚合每个用户的完成次数 + 总时长
  const sessions = await prisma.meditationSession.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      isCompleted: true,
      meditation: { courseId: cls.courseId },
      ...(since ? { completedAt: { gte: since } } : {}),
    },
    _count: { id: true },
    _sum: { videoWatchedSec: true },
  });

  const stats = new Map<string, { count: number; totalSec: number }>();
  for (const s of sessions) {
    stats.set(s.userId, {
      count: s._count.id,
      totalSec: s._sum.videoWatchedSec ?? 0,
    });
  }

  const ranking: RankingRow[] = members.map(m => ({
    userId: m.userId,
    dharmaName: m.user.dharmaName,
    count: stats.get(m.userId)?.count ?? 0,
    totalSec: stats.get(m.userId)?.totalSec ?? 0,
  }));

  // 排序：次数 desc → 时长 desc → userId 稳定兜底
  ranking.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.totalSec !== a.totalSec) return b.totalSec - a.totalSec;
    return a.userId.localeCompare(b.userId);
  });

  return ranking;
}

export const meditationRankingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/classes/:id/meditation-ranking', {
    schema: {
      tags: TAGS,
      summary: '班级观修排行（v1 仅 month/week/all · 按完成次数）',
      security: SEC,
    },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const pq = queryParams.safeParse(req.query);
    if (!pq.success) throw BadRequest('参数不合法', pq.error.flatten());

    const userId = requireUserId(req);
    // 仅班级成员可看（含 coach + admin）
    await getClassForMember(pp.data.id, userId);

    const cacheKey = `${rankingPrivacyVersion()}:${pp.data.id}:${pq.data.period}`;
    const cached = cache.get(cacheKey);
    if (cached) return { data: cached };

    const data = await queryRanking(pp.data.id, pq.data.period);
    cache.set(cacheKey, data);
    return { data };
  });
};
