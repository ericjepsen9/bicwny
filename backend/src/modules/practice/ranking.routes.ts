// 班级修学（念诵 / 计数）排行 · 学员侧 routes
//   GET /api/classes/:id/practice-ranking?period=week|month|all
//
// 与 /api/coach/classes/:id/practice-ranking 区别：
//   - 学员侧 · 仅班级成员可看
//   - 班级公告参数复用同一聚合逻辑（practiceDailySummary groupBy）
//   - 在 v1 仅按 total count desc 排（与教练侧逻辑一致）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getClassForMember } from '../class/service.js';
import { periodStartDate, type RankPeriod } from '../../lib/period.js';
import { rankingPrivacyVersion } from '../../lib/ranking-cache.js';
import { TtlCache } from '../../lib/ttl-cache.js';

const TAGS = ['Practice'];
const SEC = [{ bearerAuth: [] as string[] }];

const idParam = z.object({ id: z.string().min(1) });
const queryParams = z.object({
  period: z.enum(['week', 'month', 'all']).default('week'),
  categoryKey: z.string().optional(),
});

interface RankingRow {
  userId: string;
  dharmaName: string | null;
  avatar: string | null;
  total: number;
}

// 5 分钟 in-memory cache · 与 meditation-ranking 风格一致（自清理见 TtlCache · 审计 P9）
const cache = new TtlCache<RankingRow[]>(5 * 60 * 1000);

async function queryRanking(
  classId: string,
  period: RankPeriod,
  categoryKey?: string,
): Promise<RankingRow[]> {
  const members = await prisma.classMember.findMany({
    where: {
      classId,
      removedAt: null,
      user: {
        isActive: true,
        practiceVisibleToClass: true,
      },
    },
    include: {
      user: { select: { id: true, dharmaName: true, avatar: true } },
    },
  });
  if (members.length === 0) return [];
  const userIds = members.map((m) => m.userId);

  let categoryFilter: string | undefined;
  if (categoryKey) {
    const cat = await prisma.practiceCategory.findUnique({ where: { key: categoryKey } });
    categoryFilter = cat?.id;
  }

  const sinceDate = periodStartDate(period); // 日历周/月起始 YYYY-MM-DD · null=不限

  const rows = await prisma.practiceDailySummary.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      ...(sinceDate ? { date: { gte: sinceDate } } : {}),
      ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    },
    _sum: { count: true },
  });
  const sumMap = new Map(rows.map((r) => [r.userId, r._sum.count ?? 0]));

  const data: RankingRow[] = members
    .map((m) => ({
      userId: m.userId,
      dharmaName: m.user.dharmaName,
      avatar: m.user.avatar,
      total: sumMap.get(m.userId) ?? 0,
    }))
    // total desc · 平局按 userId 稳定排序（审计：防同分名次抖动）
    .sort((a, b) => (b.total - a.total) || a.userId.localeCompare(b.userId));
  return data;
}

export const practiceRankingStudentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/classes/:id/practice-ranking', {
    schema: {
      tags: TAGS,
      summary: '班级修学排行（学员侧 · 仅成员可看）',
      security: SEC,
    },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const pq = queryParams.safeParse(req.query);
    if (!pq.success) throw BadRequest('参数不合法', pq.error.flatten());

    const userId = requireUserId(req);
    // 班级成员检查（含 coach）
    await getClassForMember(pp.data.id, userId);

    const cacheKey = `${rankingPrivacyVersion()}:${pp.data.id}:${pq.data.period}:${pq.data.categoryKey ?? ''}`;
    const cached = cache.get(cacheKey);
    if (cached) return { data: cached };
    const data = await queryRanking(pp.data.id, pq.data.period, pq.data.categoryKey);
    cache.set(cacheKey, data);
    return { data };
  });
};
