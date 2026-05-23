// 班级综合修学排行 · 学员侧
//
//   GET /api/classes/:id/study-ranking?period=week|month|all
//
// 综合积分公式（v1 写死 · v2 admin 可配权重）：
//   积分 = 念诵 × 0.01
//        + 观修完成数 × 5
//        + 观修时长(分) × 0.1
//        + 答题数 × 0.5
//        + 阅读完成课时 × 2
//        + 活跃天数 × 1
//
// 返回时附带各维度原始数 · 前端可按 dimension tab 切显示。
// 隐私：仅班级成员可看 · 各维度独立 visibility（meditation/practice）尊重用户设置。
//
// in-memory cache 5 min · 与其他 ranking 一致。
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getClassForMember } from '../class/service.js';
import { periodStart, periodStartDate, type RankPeriod } from '../../lib/period.js';
import { rankingPrivacyVersion } from '../../lib/ranking-cache.js';

const TAGS = ['Practice'];
const SEC = [{ bearerAuth: [] as string[] }];

const idParam = z.object({ id: z.string().min(1) });
const queryParams = z.object({
  period: z.enum(['week', 'month', 'all']).default('week'),
});

// 积分系数 · v1 写死
const W_CHANTING = 0.01;
const W_MEDITATION_COUNT = 5;
const W_MEDITATION_MIN = 0.1;
const W_ANSWER = 0.5;
const W_READING = 2;
const W_ACTIVE_DAY = 1;

interface StudyRankingRow {
  userId: string;
  dharmaName: string | null;
  avatar: string | null;
  score: number;          // 综合积分（取整）
  breakdown: {
    chanting: number;          // 念诵遍数
    meditationCount: number;   // 观修完成次数
    meditationMin: number;     // 观修时长分钟
    answerCount: number;       // 答题数
    readingLessons: number;    // 阅读完成课时数
    activeDays: number;        // 活跃天数
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: StudyRankingRow[]; expiresAt: number }>();

function calcScore(b: StudyRankingRow['breakdown']): number {
  return Math.round(
    b.chanting * W_CHANTING
      + b.meditationCount * W_MEDITATION_COUNT
      + b.meditationMin * W_MEDITATION_MIN
      + b.answerCount * W_ANSWER
      + b.readingLessons * W_READING
      + b.activeDays * W_ACTIVE_DAY,
  );
}

async function queryStudyRanking(
  classId: string,
  period: RankPeriod,
): Promise<StudyRankingRow[]> {
  // 班级主修法本 · 各维度仅统计本班法本范围（审计 S4）
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { courseId: true } });
  if (!cls) return [];

  // 班级成员（活跃 · 用户未禁用）
  const allMembers = await prisma.classMember.findMany({
    where: { classId, removedAt: null, user: { isActive: true } },
    include: {
      user: {
        select: {
          id: true,
          dharmaName: true,
          avatar: true,
          practiceVisibleToClass: true,
          meditationVisibleToClass: true,
        },
      },
    },
  });
  // 完全隐藏（两个开关都关）的成员不进综合榜（审计 S5）
  const members = allMembers.filter((m) => m.user.practiceVisibleToClass || m.user.meditationVisibleToClass);
  if (members.length === 0) return [];

  const since = periodStart(period);
  const sinceDate = periodStartDate(period);

  // 修学维度（念诵 / 答题 / 阅读 / 活跃天数）统一受 practiceVisibleToClass 管（审计 S5）
  const practiceVisibleIds = members.filter((m) => m.user.practiceVisibleToClass).map((m) => m.userId);
  // 观修维度受 meditationVisibleToClass 管
  const medVisibleIds = members.filter((m) => m.user.meditationVisibleToClass).map((m) => m.userId);

  // ── 1. 念诵聚合（PracticeDailySummary）──
  const chantingRows = practiceVisibleIds.length > 0
    ? await prisma.practiceDailySummary.groupBy({
        by: ['userId'],
        where: {
          userId: { in: practiceVisibleIds },
          ...(sinceDate ? { date: { gte: sinceDate } } : {}),
        },
        _sum: { count: true },
      })
    : [];
  const chantingMap = new Map(chantingRows.map((r) => [r.userId, r._sum.count ?? 0]));

  // ── 2. 观修聚合（MeditationSession · 仅本班法本）──
  const medRows = medVisibleIds.length > 0
    ? await prisma.meditationSession.groupBy({
        by: ['userId'],
        where: {
          userId: { in: medVisibleIds },
          isCompleted: true,
          meditation: { courseId: cls.courseId },
          ...(since ? { completedAt: { gte: since } } : {}),
        },
        _count: { id: true },
        _sum: { videoWatchedSec: true },
      })
    : [];
  const medCountMap = new Map(medRows.map((r) => [r.userId, r._count.id]));
  const medSecMap = new Map(medRows.map((r) => [r.userId, r._sum.videoWatchedSec ?? 0]));

  // ── 3. 答题聚合（UserAnswer · 受 practice 隐私管 · 仅本班法本题目）──
  const answerRows = practiceVisibleIds.length > 0
    ? await prisma.userAnswer.groupBy({
        by: ['userId'],
        where: {
          userId: { in: practiceVisibleIds },
          question: { courseId: cls.courseId },
          ...(since ? { answeredAt: { gte: since } } : {}),
        },
        _count: { id: true },
      })
    : [];
  const answerMap = new Map(answerRows.map((r) => [r.userId, r._count.id]));

  // ── 4. 阅读完成聚合（LessonReadingProgress · 受 practice 隐私管 · 仅本班法本）──
  const readingRows = practiceVisibleIds.length > 0
    ? await prisma.lessonReadingProgress.groupBy({
        by: ['userId'],
        where: {
          userId: { in: practiceVisibleIds },
          isCompleted: true,
          courseId: cls.courseId,
          ...(since ? { completedAt: { gte: since } } : {}),
        },
        _count: { id: true },
      })
    : [];
  const readingMap = new Map(readingRows.map((r) => [r.userId, r._count.id]));

  // ── 5. 活跃天数（PracticeDailySummary distinct date · 受 practice 隐私管）──
  const activeDayRows = practiceVisibleIds.length > 0
    ? await prisma.practiceDailySummary.groupBy({
        by: ['userId', 'date'],
        where: {
          userId: { in: practiceVisibleIds },
          ...(sinceDate ? { date: { gte: sinceDate } } : {}),
        },
        _count: { _all: true }, // 显式要求 · 避免 Prisma 部分版本要求 aggregation
      })
    : [];
  const activeDayMap = new Map<string, number>();
  for (const r of activeDayRows) {
    activeDayMap.set(r.userId, (activeDayMap.get(r.userId) ?? 0) + 1);
  }

  // ── 组装 ──
  const rows: StudyRankingRow[] = members.map((m) => {
    const meditationSec = medSecMap.get(m.userId) ?? 0;
    const breakdown = {
      chanting: chantingMap.get(m.userId) ?? 0,
      meditationCount: medCountMap.get(m.userId) ?? 0,
      meditationMin: Math.round(meditationSec / 60),
      answerCount: answerMap.get(m.userId) ?? 0,
      readingLessons: readingMap.get(m.userId) ?? 0,
      activeDays: activeDayMap.get(m.userId) ?? 0,
    };
    return {
      userId: m.userId,
      dharmaName: m.user.dharmaName,
      avatar: m.user.avatar,
      score: calcScore(breakdown),
      breakdown,
    };
  }).sort((a, b) => (b.score - a.score) || a.userId.localeCompare(b.userId));

  return rows;
}

export const studyRankingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/classes/:id/study-ranking', {
    schema: {
      tags: TAGS,
      summary: '班级综合修学排行（积分制）· 含各维度分解',
      security: SEC,
    },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const pq = queryParams.safeParse(req.query);
    if (!pq.success) throw BadRequest('参数不合法', pq.error.flatten());

    const userId = requireUserId(req);
    await getClassForMember(pp.data.id, userId);

    const cacheKey = `${rankingPrivacyVersion()}:${pp.data.id}:${pq.data.period}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { data: cached.data };
    }
    const data = await queryStudyRanking(pp.data.id, pq.data.period);
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return { data };
  });
};
