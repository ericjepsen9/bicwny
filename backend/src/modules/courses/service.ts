// 论典 / 课程浏览服务
// 学员侧只看 isPublished=true 的论典；Admin 面板走自己的 service 不受限。
import type { Course } from '@prisma/client';
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export async function listPublishedCourses(): Promise<Course[]> {
  // M4: archived 法本不在网格出现（学员侧不导流到已下线内容）
  return prisma.course.findMany({
    where: { isPublished: true, archivedAt: null },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getCourseBySlug(
  slug: string,
  opts?: { lite?: boolean; lessonId?: string },
) {
  // lite=true · 仅返回章节 + lesson id/title/order · 省掉 referenceText / teachingSummary
  // referenceText 单课可达 100KB+ · 全树可达数 MB · TOC / 进度叠加场景不需要
  // lessonId=xxx · scripture-reading 模式 · 只有匹配的 lesson 带 referenceText/teachingSummary
  //   其他 lesson 仍返回 id/title/order 给前端拼 prev/next 导航
  //   省掉非当前 lesson 的几 MB 原文
  const lite = opts?.lite || !!opts?.lessonId;
  const lessonSelect = lite
    ? {
        id: true,
        order: true,
        title: true,
        titleTraditional: true,
      }
    : {
        id: true,
        order: true,
        title: true,
        titleTraditional: true,
        referenceText: true,
        teachingSummary: true,
      };
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      chapters: {
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
            select: lessonSelect,
          },
        },
      },
    },
  });
  if (!course) throw NotFound('课程不存在');

  // lessonId 模式：单独查目标 lesson 的 referenceText/teachingSummary 注回去
  if (opts?.lessonId) {
    const target = await prisma.lesson.findUnique({
      where: { id: opts.lessonId },
      select: { id: true, referenceText: true, teachingSummary: true },
    });
    if (target) {
      for (const ch of course.chapters) {
        for (const l of ch.lessons) {
          if (l.id === target.id) {
            (l as { referenceText?: string | null }).referenceText = target.referenceText;
            (l as { teachingSummary?: string | null }).teachingSummary = target.teachingSummary;
            break;
          }
        }
      }
    }
  }
  return course;
}

export interface EnrollmentOverlay {
  enrolled: boolean;
  currentLessonId: string | null;
  completedLessonIds: string[];
  totalLessons: number;
  progressPercent: number;
  lastStudiedAt: Date | null;
  completedAt: Date | null;
}

export async function getCourseEnrollmentOverlay(
  userId: string,
  courseId: string,
): Promise<EnrollmentOverlay> {
  const [enrollment, lessonCount] = await Promise.all([
    prisma.userCourseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    }),
    prisma.lesson.count({ where: { chapter: { courseId } } }),
  ]);

  if (!enrollment) {
    return {
      enrolled: false,
      currentLessonId: null,
      completedLessonIds: [],
      totalLessons: lessonCount,
      progressPercent: 0,
      lastStudiedAt: null,
      completedAt: null,
    };
  }

  const done = enrollment.lessonsCompleted.length;
  return {
    enrolled: true,
    currentLessonId: enrollment.currentLessonId,
    completedLessonIds: enrollment.lessonsCompleted,
    totalLessons: lessonCount,
    progressPercent:
      lessonCount > 0 ? Math.round((done / lessonCount) * 100) : 0,
    lastStudiedAt: enrollment.lastStudiedAt,
    completedAt: enrollment.completedAt,
  };
}
