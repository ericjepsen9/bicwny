// 答题模块 HTTP 路由
//   GET  /api/questions/:id   题目公开视图（剥除答案信息）
//   POST /api/answers         提交答案 → 评分 → 持久化
import type { FastifyPluginAsync } from 'fastify';
import type { Question, QuestionType } from '@prisma/client';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { getQuestion, submitAnswer } from './service.js';

const idParam = z.object({ id: z.string().min(1) });

const submitBody = z.object({
  questionId: z.string().min(1),
  answer: z.unknown(),
  timeSpentMs: z.number().int().nonnegative().optional(),
  classId: z.string().optional(),
  useLlm: z.boolean().optional(),
  removeFromMistakesOnCorrect: z.boolean().optional(),
  requestId: z.string().optional(),
});

export const answeringRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/questions/:id', async (req) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法', parsed.error.flatten());
    const q = await getQuestion(parsed.data.id);
    return { data: toPublicView(q) };
  });

  app.post('/api/answers', async (req) => {
    const userId = requireUserId(req);
    const parsed = submitBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('请求参数不合法', parsed.error.flatten());
    const b = parsed.data;
    const r = await submitAnswer(userId, b.questionId, b.answer, {
      timeSpentMs: b.timeSpentMs,
      classId: b.classId,
      useLlmForOpen: b.useLlm,
      removeFromMistakesOnCorrect: b.removeFromMistakesOnCorrect,
      requestId: b.requestId,
    });
    return {
      data: {
        userAnswerId: r.userAnswerId,
        grade: r.grade,
        question: r.question, // 答完可返回完整信息（含 correctText/wrongText）
      },
    };
  });
};

// ───── 公开视图：剥除解答信息，防剧透 ─────

function toPublicView(q: Question) {
  return {
    id: q.id,
    type: q.type,
    courseId: q.courseId,
    chapterId: q.chapterId,
    lessonId: q.lessonId,
    difficulty: q.difficulty,
    tags: q.tags,
    questionText: q.questionText,
    source: q.source,
    payload: stripAnswers(q.type, q.payload),
  };
}

type P = Record<string, unknown>;

function stripAnswers(type: QuestionType, payload: unknown): P {
  const p = (payload ?? {}) as P;
  switch (type) {
    case 'single':
    case 'multi':
      return {
        ...(p.scoringMode ? { scoringMode: p.scoringMode } : {}),
        options: ((p.options ?? []) as Array<{ text: string }>).map((o) => ({ text: o.text })),
      };
    case 'fill':
      return {
        verseLines: p.verseLines,
        options: p.options,
        verseSource: p.verseSource,
      };
    case 'sort':
      return {
        items: ((p.items ?? []) as Array<{ text: string }>).map((it) => ({ text: it.text })),
      };
    case 'match':
      return {
        left: p.left,
        right: ((p.right ?? []) as Array<{ id: string; text: string }>).map((r) => ({
          id: r.id,
          text: r.text,
        })),
      };
    case 'open':
      return {
        minLength: p.minLength,
        maxLength: p.maxLength,
      };
    default:
      return {};
  }
}
