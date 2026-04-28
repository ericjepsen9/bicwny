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

const COMPLETION_THRESHOLD = 0.8;

// M1: 后端实算 80% 阈值
// 每题取最近一次 UserAnswer.isCorrect; 跳过 null（待 AI 评分的开放题）;
// 全部 null → 视为未通过; lesson 无题 → 直接通过（admin 还没出题不该卡用户）
async function isLessonPassed(
  userId: string,
  lessonId: string,
  threshold = COMPLETION_THRESHOLD,
): Promise<boolean> {
  const questions = await prisma.question.findMany({
    where: { lessonId },
    select: { id: true },
  });
  if (questions.length === 0) return true;

  const answers = await prisma.userAnswer.findMany({
    where: {
      userId,
      questionId: { in: questions.map((q) => q.id) },
    },
    orderBy: { answeredAt: 'desc' },
    select: { questionId: true, isCorrect: true },
  });

  // 同 question 取最近一次（list 已按 answeredAt desc）
  const seen = new Set<string>();
  let graded = 0;
  let correct = 0;
  for (const a of answers) {
    if (seen.has(a.questionId)) continue;
    seen.add(a.questionId);
    if (a.isCorrect === null) continue;
    graded += 1;
    if (a.isCorrect === true) correct += 1;
  }
  if (graded === 0) return false;
  return correct / graded >= threshold;
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
    // M1: 防伪造 · 验 lesson 属于本 course + 实算 80% 阈值（前端值不可信）
    const lesson = await prisma.lesson.findUnique({
      where: { id: input.addCompletedLessonId },
      select: { chapter: { select: { courseId: true } } },
    });
    const belongsToCourse = !!lesson && lesson.chapter.courseId === courseId;
    if (belongsToCourse) {
      const passed = await isLessonPassed(userId, input.addCompletedLessonId);
      if (passed) {
        lessonsCompleted = [...lessonsCompleted, input.addCompletedLessonId];
      }
      // 不达 80% 或 lesson 不属于此 course → 静默忽略 addCompletedLessonId
      // currentLessonId 仍正常推进（不影响"已读"语义）
    }
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
  const rows = await prisma.userCourseEnrollment.findMany({
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
          coverImageUrl: true,
          isPublished: true,
          // M3: 同步返回总课时数 · 让 quiz-center 能显示 N / M
          chapters: {
            select: { _count: { select: { lessons: true } } },
          },
        },
      },
    },
  });
  // 把 chapters → totalLessons 摊平 · 去掉中间 chapters payload 减体积
  return rows.map((r) => {
    const chapters = r.course.chapters;
    const totalLessons = chapters.reduce(
      (sum: number, ch: { _count: { lessons: number } }) => sum + ch._count.lessons,
      0,
    );
    const { chapters: _omit, ...course } = r.course;
    return { ...r, course: { ...course, totalLessons } };
  });
}
