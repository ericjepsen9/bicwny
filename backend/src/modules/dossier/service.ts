// 学修档案 · service · 一次性聚合多维度（修学计数 / 观修 / 法本阅读 / 答题 / 班级任务 / 已选法本）
//   - 不做权限 · 由路由层决定谁能拿哪个 userId 的数据
//   - 教师/admin 用同一 service · 看到的内容跟学员自己一致
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
    dailySeries: Array<{ date: string; count: number }>; // 30 天柱图
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
  // 法本阅读 · 含每节课时进度
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
      lessons: Array<{
        lessonId: string;
        lessonTitle: string;
        chapterTitle: string;
        scrollPercent: number;
        totalSeconds: number;
        isCompleted: boolean;
        lastReadAt: Date;
      }>;
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
    dailySeries: Array<{ date: string; count: number; correct: number }>; // 30 天每日答题
    recentMistakes: Array<{
      questionId: string;
      questionText: string;
      wrongCount: number;
      lastWrongAt: Date;
    }>;
  };
  // 班级任务（学员所在班 active task + 该学员进度）
  classTasks: Array<{
    id: string;
    classId: string;
    className: string;
    projectId: string;
    projectName: string;
    projectEmoji: string | null;
    title: string | null;
    mode: 'daily' | 'fixed';
    target: number;
    progress: number;
    isDone: boolean;
    startAt: Date;
    endAt: Date | null;
  }>;
  // 已选法本（含进度 · 学员所有 enrollment · 不仅本班）
  enrolledCourses: Array<{
    courseId: string;
    courseTitle: string;
    coverEmoji: string;
    lessonsCompleted: number;
    lessonsTotal: number;
    lastStudiedAt: Date | null;
  }>;
}

export async function getDossierStats(prisma: PrismaClient, userId: string): Promise<DossierStats> {
  const today = dateKey();
  const last7 = lastNDates(7);
  const last30 = lastNDates(30);

  const [
    practiceCategories,
    practiceTotalsByCat,
    practiceTodayByCat,
    practiceStreak,
    practice30dRaw,
    meditationsRaw,
    readingProgress,
    quizTotal,
    quizCorrect,
    quizToday,
    quizWeek,
    sm2Cards,
    mistakeCount,
    recentMistakesRaw,
    myClasses,
    enrollmentsRaw,
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
    prisma.practiceDailySummary.findMany({
      where: { userId, date: { in: last30 } },
      select: { date: true, count: true },
    }),
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
            chapter: { select: { id: true, title: true, course: { select: { id: true, title: true, coverEmoji: true } } } },
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
    prisma.userMistakeBook.findMany({
      where: { userId, removedAt: null },
      orderBy: { lastWrongAt: 'desc' },
      take: 10,
    }),
    prisma.classMember.findMany({
      where: { userId, removedAt: null },
      select: { classId: true, class: { select: { id: true, name: true } } },
    }),
    prisma.userCourseEnrollment.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, coverEmoji: true, chapters: { select: { lessons: { select: { id: true } } } } } } },
      orderBy: { lastStudiedAt: 'desc' },
    }),
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
  // 30 天柱图：按日聚合（不分 project · 总数）
  const dailyMap = new Map(practice30dRaw.map((r) => [r.date, 0]));
  for (const r of practice30dRaw) dailyMap.set(r.date, (dailyMap.get(r.date) ?? 0) + r.count);
  const practiceDailySeries = last30.map((d) => ({ date: d, count: dailyMap.get(d) ?? 0 }));

  // 观修去重
  const seen = new Set<string>();
  const medUnique: typeof meditationsRaw = [];
  for (const m of meditationsRaw) {
    if (m.meditation.archivedAt) continue;
    if (seen.has(m.meditationId)) continue;
    seen.add(m.meditationId);
    medUnique.push(m);
  }

  // 阅读：按课程 + 课时聚合
  const byCourseMap = new Map<string, {
    courseId: string;
    courseTitle: string;
    coverEmoji: string;
    completedCount: number;
    inProgressCount: number;
    totalSeconds: number;
    lastReadAt: Date;
    lessons: Array<{
      lessonId: string;
      lessonTitle: string;
      chapterTitle: string;
      scrollPercent: number;
      totalSeconds: number;
      isCompleted: boolean;
      lastReadAt: Date;
    }>;
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
      lessons: [],
    };
    if (p.isCompleted) cur.completedCount++;
    else cur.inProgressCount++;
    cur.totalSeconds += p.totalSeconds;
    if (p.lastReadAt > cur.lastReadAt) cur.lastReadAt = p.lastReadAt;
    cur.lessons.push({
      lessonId: p.lessonId,
      lessonTitle: p.lesson.title,
      chapterTitle: p.lesson.chapter.title,
      scrollPercent: p.scrollPercent,
      totalSeconds: p.totalSeconds,
      isCompleted: p.isCompleted,
      lastReadAt: p.lastReadAt,
    });
    byCourseMap.set(c.id, cur);
  }
  // 课时按 lastReadAt desc 排
  for (const c of byCourseMap.values()) {
    c.lessons.sort((a, b) => +b.lastReadAt - +a.lastReadAt);
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

  // 答题 streak + 30 天柱图（一次取 90 天 · streak 用 90 · 柱图用 last30）
  const ninetyDays = lastNDates(90);
  const dayBoundaries = new Date(`${ninetyDays[0]}T00:00:00Z`);
  const dailyAnswers = await prisma.userAnswer.findMany({
    where: { userId, answeredAt: { gte: dayBoundaries } },
    select: { answeredAt: true, isCorrect: true },
  });
  const dayCountMap = new Map<string, { count: number; correct: number }>();
  for (const a of dailyAnswers) {
    const key = a.answeredAt.toISOString().slice(0, 10);
    const cur = dayCountMap.get(key) ?? { count: 0, correct: 0 };
    cur.count++;
    if (a.isCorrect === true) cur.correct++;
    dayCountMap.set(key, cur);
  }
  let streakDays = 0;
  for (let i = ninetyDays.length - 1; i >= 0; i--) {
    if (dayCountMap.has(ninetyDays[i]!)) streakDays++;
    else break;
  }
  const quizDailySeries = last30.map((d) => {
    const v = dayCountMap.get(d) ?? { count: 0, correct: 0 };
    return { date: d, count: v.count, correct: v.correct };
  });

  // 错题 + question text 解决（n+1 防止）
  const mistakeQuestionIds = recentMistakesRaw.map((m) => m.questionId);
  const mistakeQs = mistakeQuestionIds.length > 0 ? await prisma.question.findMany({
    where: { id: { in: mistakeQuestionIds } },
    select: { id: true, questionText: true },
  }) : [];
  const qMap = new Map(mistakeQs.map((q) => [q.id, q.questionText]));

  // 班级任务：拿学员所有班的 active class tasks + 该学员进度
  const classIds = myClasses.map((m) => m.classId);
  const classNameMap = new Map(myClasses.map((m) => [m.classId, m.class.name]));
  const tasks = classIds.length > 0 ? await prisma.practiceTask.findMany({
    where: {
      scope: 'class',
      classId: { in: classIds },
      archivedAt: null,
    },
    include: {
      project: { select: { id: true, name: true, emoji: true } },
    },
    orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }],
  }) : [];

  const classTasks = await Promise.all(tasks.map(async (t) => {
    const startKey = dateKey(t.startAt);
    const endKey = t.endAt ? dateKey(t.endAt) : dateKey();
    const rows = await prisma.practiceDailySummary.findMany({
      where: {
        userId,
        projectId: t.projectId,
        date: { gte: startKey, lte: endKey },
      },
      select: { count: true },
    });
    const progress = rows.reduce((s, r) => s + r.count, 0);
    return {
      id: t.id,
      classId: t.classId!,
      className: classNameMap.get(t.classId!) ?? '',
      projectId: t.projectId,
      projectName: t.project.name,
      projectEmoji: t.project.emoji,
      title: t.title,
      mode: t.mode,
      target: t.target,
      progress,
      isDone: progress >= t.target,
      startAt: t.startAt,
      endAt: t.endAt,
    };
  }));

  // 已选法本：含课时总数（用于进度条）
  const enrolledCourses = enrollmentsRaw.map((e) => ({
    courseId: e.courseId,
    courseTitle: e.course.title,
    coverEmoji: e.course.coverEmoji,
    lessonsCompleted: e.lessonsCompleted.length,
    lessonsTotal: e.course.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0),
    lastStudiedAt: e.lastStudiedAt,
  }));

  return {
    practice: {
      streak: practiceStreak,
      totalCount: practiceCats.reduce((acc, c) => acc + c.totalCount, 0),
      todayCount: practiceCats.reduce((acc, c) => acc + c.todayCount, 0),
      categories: practiceCats,
      dailySeries: practiceDailySeries,
    },
    meditation: {
      completedCount: medUnique.length,
      totalSeconds: medUnique.reduce((acc, m) => acc + m.videoWatchedSec, 0),
      recent: medUnique.slice(0, 10).map((m) => ({
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
      dailySeries: quizDailySeries,
      recentMistakes: recentMistakesRaw.map((m) => ({
        questionId: m.questionId,
        questionText: qMap.get(m.questionId) ?? '(题目已删除)',
        wrongCount: m.wrongCount,
        lastWrongAt: m.lastWrongAt,
      })),
    },
    classTasks,
    enrolledCourses,
  };
}
