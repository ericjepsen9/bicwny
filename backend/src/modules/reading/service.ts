// 法本阅读进度 · service
//   心跳上报：scrollPercent (0-100) + secondsDelta (本次心跳间隔活跃秒数)
//   完成判定：scrollPercent ≥ 90 OR (totalSeconds ≥ 30 AND scrollPercent ≥ 50)
//   完成时同步加入 UserCourseEnrollment.lessonsCompleted
import type { PrismaClient } from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';

const SCROLL_COMPLETE = 90;
const SCROLL_PARTIAL = 50;
const SECONDS_THRESHOLD = 30;
const MAX_SECONDS_DELTA = 60; // 单次心跳上限 · 防客户端伪造大数

export function isReadingCompleted(scrollPercent: number, totalSeconds: number): boolean {
  if (scrollPercent >= SCROLL_COMPLETE) return true;
  if (totalSeconds >= SECONDS_THRESHOLD && scrollPercent >= SCROLL_PARTIAL) return true;
  return false;
}

interface UpsertInput {
  scrollPercent: number; // 0-100
  secondsDelta: number;  // 本次心跳累计秒数
}

export async function reportReadingProgress(
  prisma: PrismaClient,
  userId: string,
  lessonId: string,
  input: UpsertInput,
) {
  if (input.scrollPercent < 0 || input.scrollPercent > 100) {
    throw BadRequest('scrollPercent 应在 0-100');
  }
  if (input.secondsDelta < 0 || input.secondsDelta > MAX_SECONDS_DELTA) {
    throw BadRequest(`secondsDelta 应在 0-${MAX_SECONDS_DELTA}`);
  }
  // 拿 lesson 的 courseId（冗余字段方便后续聚合）
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, chapter: { select: { courseId: true } } },
  });
  if (!lesson) throw NotFound('课时不存在');
  const courseId = lesson.chapter.courseId;

  const existing = await prisma.lessonReadingProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  const newScrollPercent = Math.max(existing?.scrollPercent ?? 0, Math.floor(input.scrollPercent));
  const newTotalSeconds = (existing?.totalSeconds ?? 0) + Math.floor(input.secondsDelta);
  const wasCompleted = !!existing?.isCompleted;
  const completed = wasCompleted || isReadingCompleted(newScrollPercent, newTotalSeconds);

  const data = await prisma.lessonReadingProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      courseId,
      scrollPercent: newScrollPercent,
      totalSeconds: newTotalSeconds,
      isCompleted: completed,
      completedAt: completed ? new Date() : null,
    },
    update: {
      scrollPercent: newScrollPercent,
      totalSeconds: newTotalSeconds,
      lastReadAt: new Date(),
      ...(completed && !wasCompleted ? { isCompleted: true, completedAt: new Date() } : {}),
    },
  });

  // 新完成 → 同步到 UserCourseEnrollment.lessonsCompleted（去重）
  if (completed && !wasCompleted) {
    const enr = await prisma.userCourseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (enr && !enr.lessonsCompleted.includes(lessonId)) {
      await prisma.userCourseEnrollment.update({
        where: { id: enr.id },
        data: {
          lessonsCompleted: [...enr.lessonsCompleted, lessonId],
          lastStudiedAt: new Date(),
          currentLessonId: lessonId,
        },
      });
    }
  }

  return {
    scrollPercent: data.scrollPercent,
    totalSeconds: data.totalSeconds,
    isCompleted: data.isCompleted,
    justCompleted: completed && !wasCompleted,
  };
}

/** 我的阅读统计 · 全部已读课时 + 各课程进度 */
export async function getMyReadingStats(prisma: PrismaClient, userId: string) {
  // 审计 P5：不再把全部 LessonReadingProgress 行拉进内存聚合。
  //   ① groupBy(courseId,isCompleted) 求每课程完成/在读数 + 总秒数
  //   ② DISTINCT ON(courseId) 取每课程最近一次阅读（lastReadAt + lastLesson）· 结果 ≤ 课程数
  const [grouped, latestPerCourse] = await Promise.all([
    prisma.lessonReadingProgress.groupBy({
      by: ['courseId', 'isCompleted'],
      where: { userId },
      _count: { _all: true },
      _sum: { totalSeconds: true },
    }),
    prisma.$queryRaw<Array<{ courseId: string; lessonId: string; lessonTitle: string; lastReadAt: Date }>>`
      SELECT DISTINCT ON (lrp."courseId")
             lrp."courseId" AS "courseId",
             lrp."lessonId" AS "lessonId",
             l.title AS "lessonTitle",
             lrp."lastReadAt" AS "lastReadAt"
      FROM "LessonReadingProgress" lrp
      JOIN "Lesson" l ON l.id = lrp."lessonId"
      WHERE lrp."userId" = ${userId}
      ORDER BY lrp."courseId", lrp."lastReadAt" DESC
    `,
  ]);

  const courseIds = [...new Set(grouped.map((g) => g.courseId))];
  if (courseIds.length === 0) {
    return { totalSeconds: 0, completedLessons: 0, inProgressLessons: 0, byCourse: [], recent: [] };
  }

  // 课程元数据 + recent top10（courseTitle 复用 meta · 不再深 include）
  const [courses, recentRows] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true, coverEmoji: true },
    }),
    prisma.lessonReadingProgress.findMany({
      where: { userId },
      orderBy: { lastReadAt: 'desc' },
      take: 10,
      select: {
        lessonId: true,
        courseId: true,
        scrollPercent: true,
        totalSeconds: true,
        isCompleted: true,
        lastReadAt: true,
        lesson: { select: { title: true } },
      },
    }),
  ]);

  const courseMeta = new Map(courses.map((c) => [c.id, c]));
  const latestMap = new Map(latestPerCourse.map((r) => [r.courseId, r]));

  const perCourse = new Map<string, { completedCount: number; inProgressCount: number; totalSeconds: number }>();
  let totalSeconds = 0;
  let completedLessons = 0;
  let inProgressLessons = 0;
  for (const g of grouped) {
    const cnt = g._count._all;
    const sec = g._sum.totalSeconds ?? 0;
    totalSeconds += sec;
    if (g.isCompleted) completedLessons += cnt;
    else inProgressLessons += cnt;
    const cur = perCourse.get(g.courseId) ?? { completedCount: 0, inProgressCount: 0, totalSeconds: 0 };
    if (g.isCompleted) cur.completedCount += cnt;
    else cur.inProgressCount += cnt;
    cur.totalSeconds += sec;
    perCourse.set(g.courseId, cur);
  }

  const byCourse = courseIds
    .map((cid) => {
      const meta = courseMeta.get(cid);
      const agg = perCourse.get(cid)!;
      const latest = latestMap.get(cid);
      return {
        courseId: cid,
        courseTitle: meta?.title ?? '',
        coverEmoji: meta?.coverEmoji ?? '',
        completedCount: agg.completedCount,
        inProgressCount: agg.inProgressCount,
        totalSeconds: agg.totalSeconds,
        lastReadAt: latest?.lastReadAt ?? new Date(0),
        lastLesson: latest ? { id: latest.lessonId, title: latest.lessonTitle } : { id: '', title: '' },
      };
    })
    .sort((a, b) => +b.lastReadAt - +a.lastReadAt);

  return {
    totalSeconds,
    completedLessons,
    inProgressLessons,
    byCourse,
    recent: recentRows.map((p) => ({
      lessonId: p.lessonId,
      lessonTitle: p.lesson.title,
      courseId: p.courseId,
      courseTitle: courseMeta.get(p.courseId)?.title ?? '',
      scrollPercent: p.scrollPercent,
      totalSeconds: p.totalSeconds,
      isCompleted: p.isCompleted,
      lastReadAt: p.lastReadAt,
    })),
  };
}
