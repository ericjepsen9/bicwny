// 学修档案 · service · 一次性聚合 4 维度（修学计数 / 观修 / 法本阅读 / 答题）
//   - 不做权限 · 由路由层决定谁能拿哪个 userId 的数据
//   - 每个维度 mini 概览 · 详情仍走原专项页
import type { PrismaClient } from '@prisma/client';
import { calcStreak, dateKey, lastNDates } from '../practice/utils.js';

export interface DossierStats {
  // 修学计数
  practice: {
    streak: number;
    totalCount: number;
    todayCount: number;
    categories: Array<{
      categoryId: string;
      categoryKey: string;
      categoryName: string;
      emoji: string;
      totalCount: number;
      todayCount: number;
    }>;
  };
  // 观修
  meditation: {
    completedCount: number;
    totalSeconds: number;
    recent: Array<{
      meditationId: string;
      title: string;
      videoWatchedSec: number;
      completedAt: Date;
    }>;
  };
  // 法本阅读
  reading: {
    totalSeconds: number;
    completedLessons: number;
    inProgressLessons: number;
    byCourse: Array<{
      courseId: string;
      courseTitle: string;
      coverEmoji: string;
      completedCount: number;
      inProgressCount: number;
      totalSeconds: number;
      lastReadAt: Date;
    }>;
  };
  // 答题
  quiz: {
    totalAnswers: number;
    correctRate: number;
    todayAnswers: number;
    weekAnswers: number;
    streakDays: number;
    sm2: { new: number; learning: number; review: number; mastered: number; due: number; total: number };
    mistakeCount: number;
  };
}

export async function getDossierStats(prisma: PrismaClient, userId: string): Promise<DossierStats> {
  const today = dateKey();
  const last7 = lastNDates(7);

  const [
    practiceCategories,
    practiceTotalsByCat,
    practiceTodayByCat,
    practiceStreak,
    meditationsRaw,
    readingProgress,
    quizTotal,
    quizCorrect,
    quizToday,
    quizWeek,
    sm2Cards,
    mistakeCount,
  ] = await Promise.all([
    prisma.practiceCategory.findMany({
      where: { key: { not: 'meditation' } },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.practiceDailySummary.groupBy({
      by: ['categoryId'],
      where: { userId },
      _sum: { count: true },
    }),
    prisma.practiceDailySummary.groupBy({
      by: ['categoryId'],
      where: { userId, date: today },
      _sum: { count: true },
    }),
    calcStreak(prisma, userId),
    prisma.meditationSession.findMany({
      where: { userId, isCompleted: true },
      orderBy: { completedAt: 'desc' },
      select: {
        meditationId: true,
        videoWatchedSec: true,
        completedAt: true,
        meditation: { select: { title: true, archivedAt: true } },
      },
      take: 100,
    }),
    prisma.lessonReadingProgress.findMany({
      where: { userId },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            chapter: { select: { course: { select: { id: true, title: true, coverEmoji: true } } } },
          },
        },
      },
    }),
    prisma.userAnswer.count({ where: { userId } }),
    prisma.userAnswer.count({ where: { userId, isCorrect: true } }),
    prisma.userAnswer.count({
      where: { userId, answeredAt: { gte: new Date(`${today}T00:00:00Z`) } },
    }),
    prisma.userAnswer.count({
      where: { userId, answeredAt: { gte: new Date(`${last7[0]}T00:00:00Z`) } },
    }),
    prisma.sm2Card.findMany({
      where: { userId },
      select: { status: true, dueDate: true },
    }),
    prisma.userMistakeBook.count({ where: { userId, removedAt: null } }),
  ]);

  // 修学聚合
  const totalsMap = new Map(practiceTotalsByCat.map((r) => [r.categoryId, r._sum.count ?? 0]));
  const todaysMap = new Map(practiceTodayByCat.map((r) => [r.categoryId, r._sum.count ?? 0]));
  const practiceCats = practiceCategories.map((c) => ({
    categoryId: c.id,
    categoryKey: c.key,
    categoryName: c.name,
    emoji: c.emoji,
    totalCount: totalsMap.get(c.id) ?? 0,
    todayCount: todaysMap.get(c.id) ?? 0,
  }));

  // 观修：去重（同 meditationId 只算一次 · 取最早完成）· 跳过归档
  const seen = new Set<string>();
  const medUnique: typeof meditationsRaw = [];
  for (const m of meditationsRaw) {
    if (m.meditation.archivedAt) continue;
    if (seen.has(m.meditationId)) continue;
    seen.add(m.meditationId);
    medUnique.push(m);
  }

  // 阅读：按课程聚合
  const byCourseMap = new Map<string, {
    courseId: string;
    courseTitle: string;
    coverEmoji: string;
    completedCount: number;
    inProgressCount: number;
    totalSeconds: number;
    lastReadAt: Date;
  }>();
  let readingTotalSec = 0;
  let readingCompleted = 0;
  let readingInProgress = 0;
  for (const p of readingProgress) {
    readingTotalSec += p.totalSeconds;
    if (p.isCompleted) readingCompleted++;
    else readingInProgress++;
    const c = p.lesson.chapter.course;
    const cur = byCourseMap.get(c.id) ?? {
      courseId: c.id,
      courseTitle: c.title,
      coverEmoji: c.coverEmoji,
      completedCount: 0,
      inProgressCount: 0,
      totalSeconds: 0,
      lastReadAt: p.lastReadAt,
    };
    if (p.isCompleted) cur.completedCount++;
    else cur.inProgressCount++;
    cur.totalSeconds += p.totalSeconds;
    if (p.lastReadAt > cur.lastReadAt) cur.lastReadAt = p.lastReadAt;
    byCourseMap.set(c.id, cur);
  }

  // SM2
  const now = new Date();
  const sm2 = {
    new: sm2Cards.filter((c) => c.status === 'new').length,
    learning: sm2Cards.filter((c) => c.status === 'learning').length,
    review: sm2Cards.filter((c) => c.status === 'review').length,
    mastered: sm2Cards.filter((c) => c.status === 'mastered').length,
    due: sm2Cards.filter((c) => c.dueDate && c.dueDate <= now).length,
    total: sm2Cards.length,
  };

  // 答题 streak（最近 90 天连续有答题的天数）
  const ninetyDays = lastNDates(90);
  const dayBoundaries = new Date(`${ninetyDays[0]}T00:00:00Z`);
  const dailyAnswers = await prisma.userAnswer.findMany({
    where: { userId, answeredAt: { gte: dayBoundaries } },
    select: { answeredAt: true },
  });
  const daySet = new Set(dailyAnswers.map((a) => a.answeredAt.toISOString().slice(0, 10)));
  let streakDays = 0;
  for (let i = ninetyDays.length - 1; i >= 0; i--) {
    if (daySet.has(ninetyDays[i]!)) streakDays++;
    else break;
  }

  return {
    practice: {
      streak: practiceStreak,
      totalCount: practiceCats.reduce((acc, c) => acc + c.totalCount, 0),
      todayCount: practiceCats.reduce((acc, c) => acc + c.todayCount, 0),
      categories: practiceCats,
    },
    meditation: {
      completedCount: medUnique.length,
      totalSeconds: medUnique.reduce((acc, m) => acc + m.videoWatchedSec, 0),
      recent: medUnique.slice(0, 5).map((m) => ({
        meditationId: m.meditationId,
        title: m.meditation.title,
        videoWatchedSec: m.videoWatchedSec,
        completedAt: m.completedAt!,
      })),
    },
    reading: {
      totalSeconds: readingTotalSec,
      completedLessons: readingCompleted,
      inProgressLessons: readingInProgress,
      byCourse: [...byCourseMap.values()].sort((a, b) => +b.lastReadAt - +a.lastReadAt),
    },
    quiz: {
      totalAnswers: quizTotal,
      correctRate: quizTotal > 0 ? quizCorrect / quizTotal : 0,
      todayAnswers: quizToday,
      weekAnswers: quizWeek,
      streakDays,
      sm2,
      mistakeCount,
    },
  };
}
