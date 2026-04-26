// 答题模块 HTTP 路由
//   GET  /api/questions/:id   题目公开视图（剥除答案信息）
//   POST /api/answers         提交答案 → 评分 → 持久化
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { toPublicView } from './publicView.js';
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

const TAGS = ['Answering'];
const SEC = [{ bearerAuth: [] as string[] }];

export const answeringRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/questions/:id', {
    schema: { tags: TAGS, summary: '题目公开视图（剥除答案）' },
  }, async (req) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法', parsed.error.flatten());
    const q = await getQuestion(parsed.data.id);
    return { data: toPublicView(q) };
  });

  app.post('/api/answers', {
    schema: { tags: TAGS, summary: '提交答案 · 评分 · 持久化', security: SEC },
    // 防 LLM 计费刷量：60 req/min/userId（已认证）
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req) => {
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
