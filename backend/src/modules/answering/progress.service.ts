// 学员自己的学习进度聚合
//
// 实现策略（性能向）：用 PG 端聚合代替"全量 findMany + JS reduce"。
// 旧实现把用户全部 UserAnswer 拉进内存做 reduce，活跃用户答题数 1k+ × 万人级
// 会显著拖慢首屏 + 内存峰值。新实现 4 条小查询：
//   1) groupBy isCorrect → totalAnswers / correctRate
//   2) groupBy 按 (questionId)→course 聚合 byCourse · 走 raw SQL（Prisma groupBy
//      不能跨关系 join）
//   3) DISTINCT day（UTC）→ totalDays / streak / weekDays · raw SQL
//   4) 今日 count（窄 where + index）→ todayAnswered
// 都吃 @@index([userId, answeredAt])，每条命中索引扫描。
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getCardStats } from '../sm2/service.js';

export interface CourseProgress {
  courseId: string;
  title: string;
  answered: number;
  correctRate: number;
  lastAnsweredAt: Date | null;
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastActiveDay: string | null; // YYYY-MM-DD UTC
}

export interface MyProgress {
  totalAnswers: number;
  correctRate: number;
  byCourse: CourseProgress[];
  streak: StreakInfo;
  sm2: {
    new: number;
    learning: number;
    review: number;
    mastered: number;
    due: number;
    total: number;
  };
  /** 累计活跃天数（有答题记录的不同 UTC 日数） */
  totalDays: number;
  /** 今日已答题数（UTC 日） */
  todayAnswered: number;
  /** 本周（UTC 周一起 7 天）活跃日 YYYY-MM-DD 集合 */
  weekDays: string[];
}

interface ByCourseRow {
  courseId: string;
  title: string;
  answered: bigint;
  correct: bigint;
  lastAnsweredAt: Date | null;
}

interface DayRow {
  day: string;
}

export async function myProgress(userId: string): Promise<MyProgress> {
  const now = new Date();
  const today = utcDayKey(now);
  const startOfTodayUtc = new Date(`${today}T00:00:00Z`);
  const startOfTomorrowUtc = new Date(startOfTodayUtc);
  startOfTomorrowUtc.setUTCDate(startOfTomorrowUtc.getUTCDate() + 1);

  const [grouped, byCourseRows, dayRows, todayAnswered, sm2] = await Promise.all([
    // 1) total + correct（一个 groupBy 直接拿两个值）
    prisma.userAnswer.groupBy({
      by: ['isCorrect'],
      where: { userId },
      _count: { _all: true },
    }),
    // 2) byCourse: SQL JOIN Question + Course，避免在 JS 里 reduce 万行
    prisma.$queryRaw<ByCourseRow[]>(Prisma.sql`
      SELECT q."courseId" AS "courseId",
             c."title" AS "title",
             COUNT(*)::bigint AS "answered",
             SUM(CASE WHEN ua."isCorrect" THEN 1 ELSE 0 END)::bigint AS "correct",
             MAX(ua."answeredAt") AS "lastAnsweredAt"
      FROM "UserAnswer" ua
      JOIN "Question" q ON q.id = ua."questionId"
      JOIN "Course" c ON c.id = q."courseId"
      WHERE ua."userId" = ${userId}
      GROUP BY q."courseId", c."title"
      ORDER BY "answered" DESC
    `),
    // 3) DISTINCT 日（UTC）→ 单查询拿 streak / totalDays / weekDays 全套
    prisma.$queryRaw<DayRow[]>(Prisma.sql`
      SELECT DISTINCT to_char("answeredAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
      FROM "UserAnswer"
      WHERE "userId" = ${userId}
      ORDER BY day
    `),
    // 4) 今日 count
    prisma.userAnswer.count({
      where: {
        userId,
        answeredAt: { gte: startOfTodayUtc, lt: startOfTomorrowUtc },
      },
    }),
    getCardStats(userId),
  ]);

  let totalAnswers = 0;
  let correct = 0;
  for (const g of grouped) {
    totalAnswers += g._count._all;
    if (g.isCorrect === true) correct += g._count._all;
  }

  const byCourse: CourseProgress[] = byCourseRows.map((r) => ({
    courseId: r.courseId,
    title: r.title,
    answered: Number(r.answered),
    correctRate: Number(r.answered) > 0 ? Number(r.correct) / Number(r.answered) : 0,
    lastAnsweredAt: r.lastAnsweredAt,
  }));

  const sortedDays = dayRows.map((r) => r.day);
  const streak = computeStreak(sortedDays, now);
  const weekWindow = utcWeekDays(now);
  const daysSet = new Set(sortedDays);
  const weekDays = weekWindow.filter((d) => daysSet.has(d));

  return {
    totalAnswers,
    correctRate: totalAnswers > 0 ? correct / totalAnswers : 0,
    byCourse,
    streak,
    sm2,
    totalDays: sortedDays.length,
    todayAnswered,
    weekDays,
  };
}

// ───── streak helpers ─────

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 本周（UTC 周一 ~ 周日）的 7 个 YYYY-MM-DD 键；JS 的 getUTCDay 周日=0，需换算到 0=周一 */
function utcWeekDays(now: Date): string[] {
  const dow = (now.getUTCDay() + 6) % 7; // 0=周一 ... 6=周日
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - dow);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function addUtcDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function computeStreak(sortedDays: string[], now: Date): StreakInfo {
  if (sortedDays.length === 0) {
    return { current: 0, longest: 0, lastActiveDay: null };
  }
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    if (sortedDays[i] === addUtcDays(sortedDays[i - 1], 1)) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  const lastDay = sortedDays[sortedDays.length - 1];
  const today = utcDayKey(now);
  const yesterday = addUtcDays(today, -1);
  return {
    current: lastDay === today || lastDay === yesterday ? run : 0,
    longest,
    lastActiveDay: lastDay,
  };
}
