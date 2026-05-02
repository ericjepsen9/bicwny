// Coach / Admin 创建题目
// 两种 visibility：
//   class_private → 立即生效，ownerClassId 必填，创建者须是该班 coach（admin 绕过）
//   public        → 提交平台题库，reviewStatus=pending，等 admin 审核
// draft 留给 Admin 内部直接管理，不暴露外部入口。
import type { Prisma, Question, QuestionType, Visibility } from '@prisma/client';
import { BadRequest, Conflict } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { assertIsCoachOfClass } from '../class/service.js';

export interface CreateQuestionInput {
  courseId: string;
  chapterId: string;
  lessonId: string;
  type: QuestionType;
  visibility: Visibility;
  ownerClassId?: string;
  questionText: string;
  correctText: string;
  wrongText: string;
  source: string;
  difficulty?: number;
  tags?: string[];
  payload: unknown;
}

export async function createQuestion(
  createdByUserId: string,
  createdByRole: 'coach' | 'admin',
  input: CreateQuestionInput,
): Promise<Question> {
  if (input.visibility === 'draft') {
    throw BadRequest('draft 题目仅限 Admin 内部管理');
  }
  if (input.visibility === 'public' && input.ownerClassId) {
    throw BadRequest('public 题不能带 ownerClassId');
  }
  if (input.visibility === 'class_private') {
    if (!input.ownerClassId) {
      throw BadRequest('class_private 题必须指定 ownerClassId');
    }
    if (createdByRole !== 'admin') {
      await assertIsCoachOfClass(createdByUserId, input.ownerClassId);
    }
    // C6: 不允许给已归档 / inactive 班级创建私题（学员侧 C2 检查也会拒答 → 题成孤儿）
    const cls = await prisma.class.findUnique({
      where: { id: input.ownerClassId },
      select: { isActive: true },
    });
    if (!cls || !cls.isActive) {
      throw Conflict('班级已归档，无法创建私题');
    }
  }

  const isPublic = input.visibility === 'public';

  return prisma.question.create({
    data: {
      type: input.type,
      courseId: input.courseId,
      chapterId: input.chapterId,
      lessonId: input.lessonId,
      difficulty: input.difficulty ?? 2,
      tags: input.tags ?? [],
      questionText: input.questionText,
      correctText: input.correctText,
      wrongText: input.wrongText,
      source: input.source,
      payload: input.payload as Prisma.InputJsonValue,
      visibility: input.visibility,
      ownerClassId: input.ownerClassId ?? null,
      createdByUserId,
      reviewStatus: isPublic ? 'pending' : 'approved',
      reviewed: !isPublic,
    },
  });
}

/** coach 查看自己创建的题目（可选按 ownerClassId 过滤） */
export async function listCoachQuestions(
  coachUserId: string,
  opts: { classId?: string; limit?: number } = {},
) {
  return prisma.question.findMany({
    where: {
      createdByUserId: coachUserId,
      ...(opts.classId ? { ownerClassId: opts.classId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 100,
  });
}
