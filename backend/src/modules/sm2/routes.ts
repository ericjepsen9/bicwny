// SM-2 模块 HTTP 路由
//   GET  /api/sm2/due       到期复习队列（含题目公开视图）
//   GET  /api/sm2/stats     状态面板（new/learning/review/mastered + due + total）
//   POST /api/sm2/review    自评复习，写回卡片并重新排程
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { toPublicView } from '../answering/publicView.js';
import type { Sm2Rating } from './algorithm.js';
import { getCardStats, listDueCards, scheduleReview } from './service.js';

const dueQuery = z.object({
  courseId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
const statsQuery = z.object({ courseId: z.string().optional() });
const reviewBody = z.object({
  questionId: z.string().min(1),
  courseId: z.string().min(1),
  rating: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

const TAGS = ['SM-2'];
const SEC = [{ bearerAuth: [] as string[] }];

export const sm2Routes: FastifyPluginAsync = async (app) => {
  app.get('/api/sm2/due', {
    schema: { tags: TAGS, summary: '到期复习队列', security: SEC },
  }, async (req) => {
    const parsed = dueQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const userId = requireUserId(req);
    const cards = await listDueCards(
      userId,
      parsed.data.courseId,
      parsed.data.limit,
    );
    return {
      data: cards.map((c) => ({
        cardId: c.id,
        questionId: c.questionId,
        courseId: c.courseId,
        status: c.status,
        interval: c.interval,
        repetitions: c.repetitions,
        easeFactor: c.easeFactor,
        dueDate: c.dueDate,
        lastReviewed: c.lastReviewed,
        lastRating: c.lastRating,
        question: toPublicView(c.question),
        // SM-2 复习是学过内容的再巩固，用户需要"显示答案"做自评
        // correctText / wrongText 只在复习队列里返回，不在 /api/questions/:id 公开
        answerReveal: {
          correctText: c.question.correctText,
          wrongText: c.question.wrongText,
        },
      })),
    };
  });

  app.get('/api/sm2/stats', {
    schema: { tags: TAGS, summary: 'SM-2 状态面板（new/learning/review/mastered + due + total）', security: SEC },
  }, async (req) => {
    const parsed = statsQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const userId = requireUserId(req);
    const stats = await getCardStats(userId, parsed.data.courseId);
    return { data: stats };
  });

  app.post('/api/sm2/review', {
    schema: { tags: TAGS, summary: '自评复习 · 写回卡片并重新排程', security: SEC },
  }, async (req) => {
    const parsed = reviewBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const userId = requireUserId(req);
    const card = await scheduleReview(
      userId,
      parsed.data.courseId,
      parsed.data.questionId,
      parsed.data.rating as Sm2Rating,
    );
    return { data: card };
  });
};
