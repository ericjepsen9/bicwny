// 题目批量导入
// 输入：CreateQuestionInput[] · 最多 200 条/批
// 模式：
//   strict（默认）· 先全量校验，再原子事务插入；任一失败整批回滚
//   partial       · 逐条独立 try/catch，汇总失败原因，成功的照常落库
import type { Prisma, Question } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { assertIsCoachOfClass } from '../class/service.js';
import { createQuestion, type CreateQuestionInput } from './create.service.js';

export interface BatchOptions {
  /** true = 单条失败不阻断整批；false = 全批原子（默认） */
  partial?: boolean;
}

export interface BatchItemResult {
  index: number;
  ok: boolean;
  id?: string;
  error?: string;
}

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  items: BatchItemResult[];
  questions: Question[];
}

const MAX_BATCH_SIZE = 200;

export async function batchCreateQuestions(
  createdByUserId: string,
  createdByRole: 'coach' | 'admin',
  inputs: CreateQuestionInput[],
  opts: BatchOptions = {},
): Promise<BatchResult> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw BadRequest('batch 不能为空');
  }
  if (inputs.length > MAX_BATCH_SIZE) {
    throw BadRequest(`单批最多 ${MAX_BATCH_SIZE} 条`);
  }

  if (opts.partial) {
    const items: BatchItemResult[] = [];
    const questions: Question[] = [];
    for (let i = 0; i < inputs.length; i++) {
      try {
        const q = await createQuestion(createdByUserId, createdByRole, inputs[i]);
        questions.push(q);
        items.push({ index: i, ok: true, id: q.id });
      } catch (e) {
        items.push({
          index: i,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return {
      total: inputs.length,
      succeeded: questions.length,
      failed: inputs.length - questions.length,
      items,
      questions,
    };
  }

  // strict · 先全量校验（含跨班权限），再事务内一次性插入
  for (const input of inputs) {
    validateInput(input);
  }
  if (createdByRole !== 'admin') {
    const classIds = new Set(
      inputs
        .filter((i) => i.visibility === 'class_private' && i.ownerClassId)
        .map((i) => i.ownerClassId as string),
    );
    for (const classId of classIds) {
      await assertIsCoachOfClass(createdByUserId, classId);
    }
  }

  const questions = await prisma.$transaction(
    inputs.map((input) => {
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
    }),
  );

  return {
    total: inputs.length,
    succeeded: questions.length,
    failed: 0,
    items: questions.map((q, i) => ({ index: i, ok: true, id: q.id })),
    questions,
  };
}

function validateInput(input: CreateQuestionInput): void {
  if (input.visibility === 'draft') {
    throw BadRequest('draft 题目仅限 Admin 内部管理');
  }
  if (input.visibility === 'public' && input.ownerClassId) {
    throw BadRequest('public 题不能带 ownerClassId');
  }
  if (input.visibility === 'class_private' && !input.ownerClassId) {
    throw BadRequest('class_private 题必须指定 ownerClassId');
  }
}
