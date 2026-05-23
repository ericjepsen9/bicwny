// 学员自己的学习进度聚合
//
// 实现策略（性能向）：用 PG 端聚合代替"全量 findMany + JS reduce"。
// 旧实现把用户全部 UserAnswer 拉进内存做 reduce，活跃用户答题数 1k+ × 万人级
// 会显著拖慢首屏 + 内存峰值。新实现 4 条小查询：
//   1) groupBy isCorrect → totalAnswers / correctRate
//   2) groupBy 按 (questionId)→course 聚合 byCourse · 走 raw SQL（Prisma groupBy
//      不能跨关系 join）
//   3) DISTINCT day（纽约日）→ totalDays / streak / weekDays · raw SQL
//   4) 今日 count（窄 where + index）→ todayAnswered
// 都吃 @@index([userId, answeredAt])，每条命中索引扫描。
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getCardStats } from '../sm2/service.js';
import { addDaysToDateKey, zonedDateKey, zonedTimeToUtc, zonedWeekday } from '../../lib/timezone.js';

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
  /** 累计活跃天数（有答题记录的不同纽约日数） */
  totalDays: number;
  /** 今日已答题数（纽约日） */
  todayAnswered: number;
  /** 本周（纽约周一起 7 天）活跃日 YYYY-MM-DD 集合 */
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
  const today = zonedDateKey(now); // 纽约日历日
  const [ty, tm, td] = today.split('-').map(Number);
  const startOfTodayUtc = zonedTimeToUtc(ty!, tm! - 1, td!, 0, 0, 0); // 纽约今日 00:00 → UTC 时刻
  const tomorrow = addDaysToDateKey(today, 1);
  const [ny, nm, nd] = tomorrow.split('-').map(Number);
  const startOfTomorrowUtc = zonedTimeToUtc(ny!, nm! - 1, nd!, 0, 0, 0);

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
    // 3) DISTINCT 日（纽约时区）→ 单查询拿 streak / totalDays / weekDays 全套
    //    列是 timestamp(无时区)存 UTC · 先按 UTC 解读再折算到纽约墙上日
    prisma.$queryRaw<DayRow[]>(Prisma.sql`
      SELECT DISTINCT to_char(("answeredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS day
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
  const weekWindow = weekDaysNY(now);
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

// ───── streak helpers（纽约时区 · 审计 D7/D8）─────

/** 本周（纽约周一 ~ 周日）的 7 个 YYYY-MM-DD 键 */
function weekDaysNY(now: Date): string[] {
  const today = zonedDateKey(now);
  const wd = zonedWeekday(now); // 0=周日 .. 6=周六
  const diff = wd === 0 ? 6 : wd - 1; // 距本周一的天数
  const monday = addDaysToDateKey(today, -diff);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(addDaysToDateKey(monday, i));
  return out;
}

function computeStreak(sortedDays: string[], now: Date): StreakInfo {
  if (sortedDays.length === 0) {
    return { current: 0, longest: 0, lastActiveDay: null };
  }
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    if (sortedDays[i] === addDaysToDateKey(sortedDays[i - 1]!, 1)) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  const lastDay = sortedDays[sortedDays.length - 1];
  const today = zonedDateKey(now);
  const yesterday = addDaysToDateKey(today, -1);
  return {
    current: lastDay === today || lastDay === yesterday ? run : 0,
    longest,
    lastActiveDay: lastDay,
  };
}
