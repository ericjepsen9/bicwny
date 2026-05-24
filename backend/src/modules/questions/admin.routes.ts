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

// coach 也能进审核队列（用户决策 · coach 自审 + 跨人审）· 看 pending + approve/reject
const adminGuard = requireRole('coach', 'admin');

const pendingQuery = z.object({
  courseId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const idParam = z.object({ id: z.string().min(1) });

const reviewBody = z.object({
  decision: z.enum(['approve', 'reject']),
  // reason 提供时必须有内容（防纯空白）· trim 是避免" "通过 min(1)
  reason: z.string().trim().min(1).max(500).optional(),
});

const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

export const adminQuestionRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/admin/questions/pending',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '待审题目队列（FIFO · ?courseId 过滤）', security: SEC },
    },
    async (req) => {
      const parsed = pendingQuery.safeParse(req.query);
      if (!parsed.success) throw BadRequest('查询参数不合法');
      const items = await listPending(parsed.data);
      return { data: items };
    },
  );

  app.get(
    '/api/admin/questions/:id',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '任意题目详情（完整 payload）', security: SEC },
    },
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

  // 列出某课时下所有题目（admin 视角 · 跨 coach · 含 pending / approved / class_private）
  app.get(
    '/api/admin/lessons/:id/questions',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '某课时所有题目（admin 视角）', security: SEC },
    },
    async (req) => {
      const parsed = idParam.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      const items = await prisma.question.findMany({
        where: { lessonId: parsed.data.id },
        orderBy: [{ reviewStatus: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true, type: true, questionText: true, difficulty: true, tags: true,
          visibility: true, reviewStatus: true, ownerClassId: true,
          createdByUserId: true, createdAt: true, updatedAt: true,
          courseId: true, chapterId: true, lessonId: true,
        },
      });
      return { data: items };
    },
  );

  app.post(
    '/api/admin/questions/:id/review',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '审核（approve / reject + reason → AuditLog）', security: SEC },
    },
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
