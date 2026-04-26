// 学员自己的学习进度聚合
// 复用 SM-2 getCardStats；UserAnswer 一次 findMany + JS 聚合。
// 连续答题天数以 UTC 日历计算：最后一个活跃日为 today/昨天时 current 才算延续。
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

export async function myProgress(userId: string): Promise<MyProgress> {
  const [answers, sm2] = await Promise.all([
    prisma.userAnswer.findMany({
      where: { userId },
      select: {
        isCorrect: true,
        answeredAt: true,
        question: {
          select: {
            courseId: true,
            course: { select: { title: true } },
          },
        },
      },
      orderBy: { answeredAt: 'asc' },
    }),
    getCardStats(userId),
  ]);

  const byCourseMap = new Map<
    string,
    { title: string; answered: number; correct: number; lastAnsweredAt: Date | null }
  >();
  const daysSet = new Set<string>();
  let correct = 0;

  for (const a of answers) {
    if (a.isCorrect) correct++;
    const cid = a.question.courseId;
    const entry = byCourseMap.get(cid) ?? {
      title: a.question.course.title,
      answered: 0,
      correct: 0,
      lastAnsweredAt: null,
    };
    entry.answered++;
    if (a.isCorrect) entry.correct++;
    if (!entry.lastAnsweredAt || a.answeredAt > entry.lastAnsweredAt) {
      entry.lastAnsweredAt = a.answeredAt;
    }
    byCourseMap.set(cid, entry);
    daysSet.add(utcDayKey(a.answeredAt));
  }

  const byCourse: CourseProgress[] = [...byCourseMap.entries()]
    .map(([courseId, v]) => ({
      courseId,
      title: v.title,
      answered: v.answered,
      correctRate: v.answered > 0 ? v.correct / v.answered : 0,
      lastAnsweredAt: v.lastAnsweredAt,
    }))
    .sort((a, b) => b.answered - a.answered);

  const now = new Date();
  const streak = computeStreak([...daysSet].sort(), now);
  const today = utcDayKey(now);
  const todayAnswered = answers.reduce(
    (n, a) => (utcDayKey(a.answeredAt) === today ? n + 1 : n),
    0,
  );
  const weekWindow = utcWeekDays(now);
  const weekDays = weekWindow.filter((d) => daysSet.has(d));

  return {
    totalAnswers: answers.length,
    correctRate: answers.length > 0 ? correct / answers.length : 0,
    byCourse,
    streak,
    sm2,
    totalDays: daysSet.size,
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
