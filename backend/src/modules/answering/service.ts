// 答题主服务
// 流程：取题 → 评分 → 写 UserAnswer → 错题本联动 → SM-2 排程
import { Prisma, type Question } from '@prisma/client';
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { Sm2Rating } from '../sm2/algorithm.js';
import { scheduleReview } from '../sm2/service.js';
import { type AnswerGrade, gradeAnswer } from './grading.js';
import { removeMistake, upsertMistake } from './mistakes.js';

export interface SubmitOptions {
  /** 开放题是否走 LLM 评分；默认 false（使用 mock） */
  useLlmForOpen?: boolean;
  /** 答对时是否从错题本软删除；默认 false（由前端策略决定） */
  removeFromMistakesOnCorrect?: boolean;
  /** 做题用时（毫秒） */
  timeSpentMs?: number;
  /** 所属班级（用于辅导员统计，可选） */
  classId?: string;
  /** 幂等键，透传给 LLM 网关 */
  requestId?: string;
}

export interface SubmitResult {
  userAnswerId: string;
  question: Question;
  grade: AnswerGrade;
}

export async function submitAnswer(
  userId: string,
  questionId: string,
  answer: unknown,
  opts: SubmitOptions = {},
): Promise<SubmitResult> {
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw NotFound(`题目不存在: ${questionId}`);

  const grade = await gradeAnswer(question, answer, {
    useLlm: opts.useLlmForOpen,
    llmCtx: { userId, requestId: opts.requestId },
  });

  const aiGrade =
    question.type === 'open'
      ? {
          score: grade.score,
          feedback: grade.feedback,
          covered: grade.covered,
          missing: grade.missing,
          source: grade.source,
        }
      : null;

  const ua = await prisma.userAnswer.create({
    data: {
      userId,
      questionId,
      answer: answer as Prisma.InputJsonValue,
      isCorrect: grade.isCorrect,
      score: grade.score,
      // nullable Json：用 Prisma.DbNull 显式表达 SQL NULL（Prisma 6 严格模式）
      aiGrade: aiGrade === null ? Prisma.DbNull : (aiGrade as Prisma.InputJsonValue),
      timeSpentMs: opts.timeSpentMs ?? null,
      classId: opts.classId ?? null,
    },
  });

  // 错题本
  if (!grade.isCorrect) {
    await upsertMistake(userId, questionId);
  } else if (opts.removeFromMistakesOnCorrect) {
    await removeMistake(userId, questionId);
  }

  // SM-2 排程：失败不阻塞主响应，仅 warn
  try {
    await scheduleReview(
      userId,
      question.courseId,
      questionId,
      gradeToRating(grade),
    );
  } catch (e) {
    console.warn(
      '[answering] SM-2 scheduleReview 失败（不影响答题）：',
      e instanceof Error ? e.message : e,
    );
  }

  return { userAnswerId: ua.id, question, grade };
}

/** 评分结果 → SM-2 自评四档 */
function gradeToRating(grade: AnswerGrade): Sm2Rating {
  if (!grade.isCorrect) return 0; // 重来
  if (grade.score >= 95) return 3; // 简单
  if (grade.score >= 80) return 2; // 良好
  return 1; // 困难（60-79，通常出现在 partial multi 或 open）
}

export async function getQuestion(questionId: string): Promise<Question> {
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) throw NotFound(`题目不存在: ${questionId}`);
  return q;
}
