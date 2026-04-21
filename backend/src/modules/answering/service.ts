// 答题主服务
// 流程：取题 → 评分 → 写 UserAnswer → 错题本联动
// SM-2 联动（scheduleReview）在 6.x 完成后回补（service 已预留钩子位置）。
import type { Prisma, Question } from '@prisma/client';
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
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
      aiGrade: aiGrade as Prisma.InputJsonValue | null,
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

  // TODO (6.x)：scheduleReview(userId, question.courseId, questionId, grade)

  return { userAnswerId: ua.id, question, grade };
}

export async function getQuestion(questionId: string): Promise<Question> {
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) throw NotFound(`题目不存在: ${questionId}`);
  return q;
}
