// 按 lesson 列题（可见性过滤）
// 规则：
//   reviewStatus='approved' 且
//     visibility='public'
//     或（visibility='class_private' 且 ownerClassId ∈ 观察者所在班）
//   且 cohort==null 或 cohort==viewer.contentCohort
// draft 题永远不在学员视野里。
import type { Question } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cohortWhere } from '../../lib/content-seed.js';

async function getViewerCohort(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { contentCohort: true },
  });
  return u?.contentCohort ?? null;
}

/** 观察者当前所在（未退出、班级未归档且启用）的 classId 列表，class_private 过滤用 */
export async function getUserActiveClassIds(
  userId: string,
): Promise<string[]> {
  const rows = await prisma.classMember.findMany({
    where: {
      userId,
      removedAt: null,
      class: { archivedAt: null, isActive: true },
    },
    select: { classId: true },
  });
  return rows.map((r) => r.classId);
}

export interface ListLessonQuestionsOpts {
  limit?: number;
}

export async function listLessonQuestions(
  lessonId: string,
  viewerUserId: string | null,
  opts: ListLessonQuestionsOpts = {},
): Promise<Question[]> {
  const [classIds, cohort] = await Promise.all([
    viewerUserId ? getUserActiveClassIds(viewerUserId) : [],
    getViewerCohort(viewerUserId),
  ]);

  const visibilityClauses = [
    { visibility: 'public' as const },
    ...(classIds.length > 0
      ? [
          {
            visibility: 'class_private' as const,
            ownerClassId: { in: classIds },
          },
        ]
      : []),
  ];

  return prisma.question.findMany({
    where: {
      lessonId,
      reviewStatus: 'approved',
      OR: visibilityClauses,
      AND: [cohortWhere(cohort)],
    },
    orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
    take: opts.limit ?? 200,
  });
}

/** 按论典列题（限 approved + 可见），带数量上限。Admin 面板另有专用 service。 */
export async function listCourseQuestions(
  courseId: string,
  viewerUserId: string | null,
  opts: ListLessonQuestionsOpts = {},
): Promise<Question[]> {
  const [classIds, cohort] = await Promise.all([
    viewerUserId ? getUserActiveClassIds(viewerUserId) : [],
    getViewerCohort(viewerUserId),
  ]);
  const visibilityClauses = [
    { visibility: 'public' as const },
    ...(classIds.length > 0
      ? [
          {
            visibility: 'class_private' as const,
            ownerClassId: { in: classIds },
          },
        ]
      : []),
  ];

  return prisma.question.findMany({
    where: {
      courseId,
      reviewStatus: 'approved',
      OR: visibilityClauses,
      AND: [cohortWhere(cohort)],
    },
    orderBy: [{ lessonId: 'asc' }, { difficulty: 'asc' }, { createdAt: 'asc' }],
    take: opts.limit ?? 500,
  });
}
