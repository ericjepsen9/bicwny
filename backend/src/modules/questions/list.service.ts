// 按 lesson 列题（可见性过滤）
// 规则：
//   reviewStatus='approved' 且
//     visibility='public'
//     或（visibility='class_private' 且 ownerClassId ∈ 观察者所在班）
// draft 题永远不在学员视野里。
import type { Question } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** 观察者当前所在（未退出）的 classId 列表，class_private 过滤用 */
export async function getUserActiveClassIds(
  userId: string,
): Promise<string[]> {
  const rows = await prisma.classMember.findMany({
    where: { userId, removedAt: null },
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
  const classIds = viewerUserId
    ? await getUserActiveClassIds(viewerUserId)
    : [];

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
  const classIds = viewerUserId
    ? await getUserActiveClassIds(viewerUserId)
    : [];
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
    },
    orderBy: [{ lessonId: 'asc' }, { difficulty: 'asc' }, { createdAt: 'asc' }],
    take: opts.limit ?? 500,
  });
}
