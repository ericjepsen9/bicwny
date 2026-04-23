// 论典 / 课程浏览服务
// 学员侧只看 isPublished=true 的论典；Admin 面板走自己的 service 不受限。
import type { Course } from '@prisma/client';
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export async function listPublishedCourses(): Promise<Course[]> {
  return prisma.course.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getCourseBySlug(slug: string) {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      chapters: {
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              title: true,
              titleTraditional: true,
              referenceText: true,
              teachingSummary: true,
            },
          },
        },
      },
    },
  });
  if (!course) throw NotFound('课程不存在');
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
