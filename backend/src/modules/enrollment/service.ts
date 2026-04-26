// 课程报名 · 进度跟踪
// 每学员每课程一条 UserCourseEnrollment（@@unique([userId, courseId])）。
// 退课：硬删（历史若需要保留可再加 archivedAt，Sprint 3 暂不需要）。
import type { UserCourseEnrollment } from '@prisma/client';
import { Conflict, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export interface UpdateProgressInput {
  /** 推进到某课；传 null 代表清空 */
  currentLessonId?: string | null;
  /** 把某 lessonId 追加到已完成数组（去重） */
  addCompletedLessonId?: string;
}

export async function enroll(
  userId: string,
  courseId: string,
): Promise<UserCourseEnrollment> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isPublished: true },
  });
  if (!course) throw NotFound('课程不存在');
  if (!course.isPublished) throw Conflict('课程尚未发布');

  // upsert 防止并发重复；已有记录保留已学进度
  return prisma.userCourseEnrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId },
    update: {},
  });
}

export async function drop(userId: string, courseId: string): Promise<void> {
  // 班级主修法本不能直接退课，需先退班 · 给清晰错误提示
  const existing = await prisma.userCourseEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!existing) return; // 没报名直接 no-op，幂等
  if (existing.source === 'class') {
    throw Conflict('该法本由班级带来，请先退出班级再退课');
  }
  await prisma.userCourseEnrollment.delete({
    where: { userId_courseId: { userId, courseId } },
  });
}

export async function updateProgress(
  userId: string,
  courseId: string,
  input: UpdateProgressInput,
): Promise<UserCourseEnrollment> {
  const existing = await prisma.userCourseEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!existing) throw NotFound('未报名此课程');

  let lessonsCompleted = existing.lessonsCompleted;
  if (
    input.addCompletedLessonId &&
    !lessonsCompleted.includes(input.addCompletedLessonId)
  ) {
    lessonsCompleted = [...lessonsCompleted, input.addCompletedLessonId];
  }

  return prisma.userCourseEnrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: {
      lastStudiedAt: new Date(),
      currentLessonId:
        input.currentLessonId !== undefined
          ? input.currentLessonId
          : existing.currentLessonId,
      lessonsCompleted,
    },
  });
}

export async function markCompleted(
  userId: string,
  courseId: string,
): Promise<UserCourseEnrollment> {
  const existing = await prisma.userCourseEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!existing) throw NotFound('未报名此课程');
  return prisma.userCourseEnrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: { completedAt: new Date() },
  });
}

export async function listMyEnrollments(userId: string) {
  // source / enrolledViaClassId 是 model 标量字段会默认返回，
  // 但显式 select 主要数据 + 关联班级名（避免前端多次请求拼）
  return prisma.userCourseEnrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: 'desc' },
    include: {
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          titleTraditional: true,
          author: true,
          coverEmoji: true,
          isPublished: true,
        },
      },
    },
  });
}
