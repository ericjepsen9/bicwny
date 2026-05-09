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
  const all = await prisma.lessonReadingProgress.findMany({
    where: { userId },
    orderBy: { lastReadAt: 'desc' },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          chapter: { select: { id: true, title: true, course: { select: { id: true, slug: true, title: true, coverEmoji: true } } } },
        },
      },
    },
  });

  // 按课程聚合 · 总课时数 / 已读课时数 / 最近读的课
  const byCourse = new Map<string, {
    courseId: string;
    courseTitle: string;
    coverEmoji: string;
    completedCount: number;
    inProgressCount: number;
    totalSeconds: number;
    lastReadAt: Date;
    lastLesson: { id: string; title: string };
  }>();

  for (const p of all) {
    const c = p.lesson.chapter.course;
    const cur = byCourse.get(c.id) ?? {
      courseId: c.id,
      courseTitle: c.title,
      coverEmoji: c.coverEmoji,
      completedCount: 0,
      inProgressCount: 0,
      totalSeconds: 0,
      lastReadAt: p.lastReadAt,
      lastLesson: { id: p.lesson.id, title: p.lesson.title },
    };
    if (p.isCompleted) cur.completedCount++;
    else cur.inProgressCount++;
    cur.totalSeconds += p.totalSeconds;
    if (p.lastReadAt > cur.lastReadAt) {
      cur.lastReadAt = p.lastReadAt;
      cur.lastLesson = { id: p.lesson.id, title: p.lesson.title };
    }
    byCourse.set(c.id, cur);
  }

  return {
    totalSeconds: all.reduce((acc, p) => acc + p.totalSeconds, 0),
    completedLessons: all.filter((p) => p.isCompleted).length,
    inProgressLessons: all.filter((p) => !p.isCompleted).length,
    byCourse: [...byCourse.values()].sort((a, b) => +b.lastReadAt - +a.lastReadAt),
    recent: all.slice(0, 10).map((p) => ({
      lessonId: p.lessonId,
      lessonTitle: p.lesson.title,
      courseId: p.courseId,
      courseTitle: p.lesson.chapter.course.title,
      scrollPercent: p.scrollPercent,
      totalSeconds: p.totalSeconds,
      isCompleted: p.isCompleted,
      lastReadAt: p.lastReadAt,
    })),
  };
}
