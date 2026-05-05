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

// in-memory cache (key = classId:period · TTL 5 min)
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: RankingRow[]; expiresAt: number }>();

function startOfPeriod(period: 'week' | 'month' | 'all'): Date | null {
  const now = new Date();
  if (period === 'all') return null;
  if (period === 'week') {
    // Monday 0:00 user-local · v1 简化为 UTC 周一
    const day = now.getUTCDay(); // 0=Sun
    const diff = day === 0 ? 6 : day - 1;
    const d = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff,
    ));
    return d;
  }
  // month
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function queryRanking(classId: string, period: 'week' | 'month' | 'all'): Promise<RankingRow[]> {
  const since = startOfPeriod(period);

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

  // 排序：次数 desc → 时长 desc
  ranking.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.totalSec - a.totalSec;
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

    const cacheKey = `${pp.data.id}:${pq.data.period}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { data: cached.data };
    }

    const data = await queryRanking(pp.data.id, pq.data.period);
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return { data };
  });
};
