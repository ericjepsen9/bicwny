// 题目编辑
// 权限：
//   coach → 只能改自己创建的题（含自己自审通过的）· 改后状态回 pending 复审
//   admin → 任意题 · 不影响状态
// 设计：coach 自审是「初审 · 表达对自己 LLM/手写产物的自信」· 不锁死编辑
//   · 后续发现错字仍能改 · 改完自动回 pending 让 coach 再审或 admin 把关
//   · 防滥用：可在 audit log 看到改动记录
// 旧版本曾锁 coach 改 approved+public 题（导致自审通过后改不了 · 用户卡死）·
// 现已放开 · 因为 coach 永远只能改自己创建的（line 35 owner check 已防越权）
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
