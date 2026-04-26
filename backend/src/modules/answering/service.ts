// 答题主服务
// 流程：取题 → 评分 → 写 UserAnswer → 错题本联动 → SM-2 排程
import { Prisma, type Question } from '@prisma/client';
import { Forbidden, NotFound } from '../../lib/errors.js';
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

  // 幂等短路：同 (userId, questionId, requestId) 已写入过则直接返回上次结果
  // —— 不再写错题本、不再排 SM-2，避免双击/重试副作用倍增
  if (opts.requestId) {
    const cached = await prisma.userAnswer.findUnique({
      where: {
        userId_questionId_requestId: {
          userId,
          questionId,
          requestId: opts.requestId,
        },
      },
    });
    if (cached) {
      return {
        userAnswerId: cached.id,
        question,
        grade: await reconstructGrade(question, cached),
      };
    }
  }

  // classId 是交给辅导员端统计用的归属字段，必须验证答题人确属该班级
  if (opts.classId) {
    const member = await prisma.classMember.findFirst({
      where: { classId: opts.classId, userId, removedAt: null },
      select: { id: true },
    });
    if (!member) throw Forbidden('非该班级成员，无法提交到该班级');
  }

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

  let ua;
  try {
    ua = await prisma.userAnswer.create({
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
        requestId: opts.requestId ?? null,
      },
    });
  } catch (e) {
    // 并发竞争：两个相同 requestId 同时进来，先到的赢，后到的拿回缓存
    if (
      opts.requestId &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      const cached = await prisma.userAnswer.findUnique({
        where: {
          userId_questionId_requestId: {
            userId,
            questionId,
            requestId: opts.requestId,
          },
        },
      });
      if (cached) {
        return {
          userAnswerId: cached.id,
          question,
          grade: await reconstructGrade(question, cached),
        };
      }
    }
    throw e;
  }

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

// 幂等命中时从持久化字段还原 grade
//   - open 题：直接读 aiGrade JSON（避免重复 LLM 调用）
//   - 客观/flip/guided：本地重判（确定性、无 LLM、与首次响应等价）
async function reconstructGrade(
  question: Question,
  ua: { answer: Prisma.JsonValue; isCorrect: boolean | null; score: number | null; aiGrade: Prisma.JsonValue | null },
): Promise<AnswerGrade> {
  if (question.type === 'open' && ua.aiGrade && typeof ua.aiGrade === 'object') {
    const a = ua.aiGrade as Record<string, unknown>;
    return {
      isCorrect: ua.isCorrect ?? false,
      score: typeof a.score === 'number' ? a.score : (ua.score ?? 0),
      source: (a.source as AnswerGrade['source']) ?? 'mock_open',
      feedback: typeof a.feedback === 'string' ? a.feedback : undefined,
      covered: Array.isArray(a.covered) ? (a.covered as string[]) : undefined,
      missing: Array.isArray(a.missing) ? (a.missing as string[]) : undefined,
    };
  }
  return gradeAnswer(question, ua.answer, { useLlm: false });
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
