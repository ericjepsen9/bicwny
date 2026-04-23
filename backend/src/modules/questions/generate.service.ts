// LLM 辅助造题
// 输入：courseId + chapterId + lessonId + 法本原文 passage + 目标 type + count
// 步骤：
//   1. 载入 lesson/course/chapter 基本信息（题干 context）
//   2. 渲染 prompt（question_generation 模板）
//   3. chat() → 解析 JSON 数组
//   4. 逐条做 payload 结构校验（宽容匹配）
//   5. 批量落库为 pending public 或 class_private
// 失败策略：LLM 返回异常 / JSON 解析失败 → 抛 BadRequest 并带 raw 片段，方便调试
import type { Prisma, Question, QuestionType } from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { assertIsCoachOfClass } from '../class/service.js';
import { chat, type ChatContext } from '../llm/gateway.js';
import { loadPromptTemplate, renderPrompt } from '../llm/prompt.js';
import {
  clampInt,
  parseGeneratedArray,
  validateGenerated,
} from './generate.parser.js';

export type Visibility = 'public' | 'class_private';

export interface GenerateInput {
  courseId: string;
  chapterId: string;
  lessonId: string;
  passage: string;
  type: QuestionType;
  count: number;
  difficulty?: number;
  visibility: Visibility;
  ownerClassId?: string;
  /** 可选：覆盖默认 source（默认取 course.title + lesson.title） */
  source?: string;
}

export interface GenerateResult {
  total: number;
  succeeded: number;
  failed: number;
  questions: Question[];
  skipped: Array<{ index: number; reason: string; raw?: unknown }>;
  raw: string;
}

const MIN_COUNT = 1;
const MAX_COUNT = 20;

export async function generateQuestions(
  createdByUserId: string,
  createdByRole: 'coach' | 'admin',
  input: GenerateInput,
  llmCtx: ChatContext = {},
): Promise<GenerateResult> {
  if (input.count < MIN_COUNT || input.count > MAX_COUNT) {
    throw BadRequest(`count 需在 ${MIN_COUNT}-${MAX_COUNT} 之间`);
  }
  if (!input.passage || input.passage.trim().length < 20) {
    throw BadRequest('法本原文至少 20 字');
  }
  if (input.visibility === 'class_private') {
    if (!input.ownerClassId) throw BadRequest('class_private 必须指定 ownerClassId');
    if (createdByRole !== 'admin') {
      await assertIsCoachOfClass(createdByUserId, input.ownerClassId);
    }
  } else if (input.ownerClassId) {
    throw BadRequest('public 题不能带 ownerClassId');
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: input.lessonId },
    include: { chapter: { include: { course: true } } },
  });
  if (!lesson) throw NotFound('lesson 不存在');
  if (lesson.chapterId !== input.chapterId) {
    throw BadRequest('chapterId 与 lessonId 不一致');
  }
  if (lesson.chapter.courseId !== input.courseId) {
    throw BadRequest('courseId 与 lessonId 不一致');
  }
  if (createdByRole !== 'admin' && input.visibility === 'public') {
    // 所有人都可以提交 public（进入 pending）—— 交给 review 环节把关
  }

  const template = await loadPromptTemplate('question_generation');
  const difficulty = input.difficulty ?? 2;
  const prompt = renderPrompt(template, {
    courseTitle: lesson.chapter.course.title,
    chapterTitle: lesson.chapter.title,
    lessonTitle: lesson.title,
    passage: input.passage,
    type: input.type,
    count: input.count,
    difficulty,
    source: input.source ?? `${lesson.chapter.course.title} · ${lesson.title}`,
  });

  const resp = await chat(
    'question_generation',
    [{ role: 'user', content: prompt }],
    { ...llmCtx, coachId: createdByUserId },
  );

  const parsed = parseGeneratedArray(resp.content);

  const questions: Question[] = [];
  const skipped: GenerateResult['skipped'] = [];
  const isPublic = input.visibility === 'public';

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const check = validateGenerated(item, input.type);
    if (!check.ok) {
      skipped.push({ index: i, reason: check.reason, raw: item });
      continue;
    }
    try {
      const q = await prisma.question.create({
        data: {
          type: input.type,
          courseId: input.courseId,
          chapterId: input.chapterId,
          lessonId: input.lessonId,
          difficulty: clampInt(item.difficulty ?? difficulty, 1, 5),
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          questionText: String(item.questionText),
          correctText: String(item.correctText ?? ''),
          wrongText: String(item.wrongText ?? ''),
          source: String(item.source ?? input.source ?? lesson.title),
          payload: item.payload as Prisma.InputJsonValue,
          visibility: input.visibility,
          ownerClassId: input.ownerClassId ?? null,
          createdByUserId,
          reviewStatus: isPublic ? 'pending' : 'approved',
          reviewed: !isPublic,
        },
      });
      questions.push(q);
    } catch (e) {
      skipped.push({
        index: i,
        reason: `DB 写入失败: ${e instanceof Error ? e.message : String(e)}`,
        raw: item,
      });
    }
  }

  return {
    total: parsed.length,
    succeeded: questions.length,
    failed: skipped.length,
    questions,
    skipped,
    raw: resp.content,
  };
}

