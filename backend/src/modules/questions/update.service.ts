// 题目编辑
// 权限：
//   coach → 只能改自己创建的题
//   admin → 任意题
// 状态锁：
//   approved + public → coach 禁改（会影响在学学员，改需走 admin 或重新提审）
//   其它状态（draft/pending/rejected/class_private）→ 可自由改
// 特殊规则：
//   coach 改 public 题后，状态回 pending（需要复审）
import type { Prisma, Question, QuestionType } from '@prisma/client';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export interface UpdateQuestionPatch {
  questionText?: string;
  correctText?: string;
  wrongText?: string;
  source?: string;
  difficulty?: number;
  tags?: string[];
  payload?: unknown;
  type?: QuestionType;
}

export async function updateQuestion(
  userId: string,
  role: 'coach' | 'admin',
  questionId: string,
  patch: UpdateQuestionPatch,
): Promise<Question> {
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) throw NotFound('题目不存在');

  if (role !== 'admin' && q.createdByUserId !== userId) {
    throw Forbidden('非本人创建的题目');
  }
  if (
    role !== 'admin' &&
    q.visibility === 'public' &&
    q.reviewStatus === 'approved'
  ) {
    throw Forbidden('已审核通过的公开题不可编辑，请联系管理员或重新提交新题');
  }
  if (Object.keys(patch).length === 0) {
    throw BadRequest('patch 不能为空');
  }

  const data: Prisma.QuestionUpdateInput = {
    ...(patch.questionText !== undefined ? { questionText: patch.questionText } : {}),
    ...(patch.correctText !== undefined ? { correctText: patch.correctText } : {}),
    ...(patch.wrongText !== undefined ? { wrongText: patch.wrongText } : {}),
    ...(patch.source !== undefined ? { source: patch.source } : {}),
    ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty } : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.payload !== undefined ? { payload: patch.payload as Prisma.InputJsonValue } : {}),
  };

  // coach 编辑 public 题 → 状态回 pending 等复审
  if (role !== 'admin' && q.visibility === 'public') {
    data.reviewStatus = 'pending';
    data.reviewed = false;
  }

  return prisma.question.update({ where: { id: questionId }, data });
}
