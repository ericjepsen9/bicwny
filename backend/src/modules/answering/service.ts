// 答题主服务
// 流程：取题 → 评分 → 写 UserAnswer → 错题本联动 → SM-2 排程
import { Prisma, type Question } from '@prisma/client';
import { Conflict, Forbidden, NotFound } from '../../lib/errors.js';
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

  // M4: 题目被驳回 → 拒绝新答题（错题本里的旧记录已在 review 时清理，不该有用户来到这里）
  if (question.reviewStatus === 'rejected') {
    throw Conflict('题目已被驳回，无法作答');
  }
  // M4: 法本归档 → 只读模式 · 拒绝新答题（已答的进度数据保留）
  const course = await prisma.course.findUnique({
    where: { id: question.courseId },
    select: { archivedAt: true },
  });
  if (course?.archivedAt) {
    throw Conflict('该法本已下线，无法新答题');
  }

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

  // 单事务原子：UserAnswer + 错题本 + SM-2 排程
  // 任一步失败 → 整体回滚 → 客户端重试
  // SM-2 旧实现是 try/catch 静默吞，会留下"答题成功但永不到期"的不一致
  let ua;
  try {
    ua = await prisma.$transaction(async (tx) => {
      const created = await tx.userAnswer.create({
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

      if (!grade.isCorrect) {
        await upsertMistake(userId, questionId, new Date(), tx);
      } else if (opts.removeFromMistakesOnCorrect) {
        await removeMistake(userId, questionId, tx);
      }

      await scheduleReview(
        userId,
        question.courseId,
        questionId,
        gradeToRating(grade),
        new Date(),
        tx,
      );

      return created;
    });
  } catch (e) {
    // 幂等键并发竞争：两个相同 requestId 同时进来，先到的赢，后到的拿回缓存
    // 注意：P2002 在事务内部抛出 → 此处仍是 PrismaClientKnownRequestError
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
