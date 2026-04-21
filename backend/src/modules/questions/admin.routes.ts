// Admin 题库审核路由
//   GET  /api/admin/questions/pending   pending 队列
//   GET  /api/admin/questions/:id       任意题目详情
//   POST /api/admin/questions/:id/review { decision:'approve'|'reject', reason? }
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { listPending, reviewQuestion } from './review.service.js';

const adminGuard = requireRole('admin');

const pendingQuery = z.object({
  courseId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const idParam = z.object({ id: z.string().min(1) });

const reviewBody = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

export const adminQuestionRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/admin/questions/pending',
    { preHandler: adminGuard },
    async (req) => {
      const parsed = pendingQuery.safeParse(req.query);
      if (!parsed.success) throw BadRequest('查询参数不合法');
      const items = await listPending(parsed.data);
      return { data: items };
    },
  );

  app.get(
    '/api/admin/questions/:id',
    { preHandler: adminGuard },
    async (req) => {
      const parsed = idParam.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      const q = await prisma.question.findUnique({
        where: { id: parsed.data.id },
      });
      if (!q) throw NotFound('题目不存在');
      return { data: q };
    },
  );

  app.post(
    '/api/admin/questions/:id/review',
    { preHandler: adminGuard },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = reviewBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = requireUserId(req);
      const q = await reviewQuestion(
        pp.data.id,
        adminId,
        pb.data.decision,
        pb.data.reason,
      );
      return { data: q };
    },
  );
};
