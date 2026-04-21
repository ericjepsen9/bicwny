// 错题本 HTTP 路由（service 复用 Sprint 1 的 mistakes.ts）
//   GET    /api/mistakes                  未移除的错题（含 question 剥答案视图）
//   DELETE /api/mistakes/:questionId      手动移除（用户掌握后）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { listActiveMistakes, removeMistake } from './mistakes.js';
import { toPublicView } from './publicView.js';

const qidParam = z.object({ questionId: z.string().min(1) });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const mistakesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/mistakes', async (req) => {
    const userId = requireUserId(req);
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');

    const items = await listActiveMistakes(userId, parsed.data.limit);
    if (items.length === 0) return { data: [] };

    // UserMistakeBook 无 Question 关系，单独 join
    const questions = await prisma.question.findMany({
      where: { id: { in: items.map((m) => m.questionId) } },
    });
    const qMap = new Map(questions.map((q) => [q.id, q]));

    return {
      data: items.map((m) => {
        const q = qMap.get(m.questionId);
        return {
          id: m.id,
          questionId: m.questionId,
          wrongCount: m.wrongCount,
          lastWrongAt: m.lastWrongAt,
          question: q ? toPublicView(q) : null,
        };
      }),
    };
  });

  app.delete('/api/mistakes/:questionId', async (req) => {
    const userId = requireUserId(req);
    const parsed = qidParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    await removeMistake(userId, parsed.data.questionId);
    return { data: { ok: true } };
  });
};
