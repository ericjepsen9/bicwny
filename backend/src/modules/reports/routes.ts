// 题目举报路由
//   POST /api/reports                       任意登录用户提交举报
//   GET  /api/admin/reports/pending         admin：待处理列表
//   POST /api/admin/reports/:id/handle      admin：accept/reject + AuditLog
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  createReport,
  handleReport,
  listPendingReports,
} from './service.js';

const adminGuard = requireRole('admin');

const createBody = z.object({
  questionId: z.string().min(1),
  reason: z.enum([
    'wrong_answer',
    'sensitive',
    'doctrine_error',
    'typo',
    'other',
  ]),
  details: z.string().max(1000).optional(),
});

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  reason: z
    .enum(['wrong_answer', 'sensitive', 'doctrine_error', 'typo', 'other'])
    .optional(),
});

const idParam = z.object({ id: z.string().min(1) });

const handleBody = z.object({
  // accept_hide = 举报成立 · 隐藏题目（reviewStatus=rejected）· 群发举报人通知
  // accept_keep = 举报成立 · 保留题目（轻微问题已记录）
  // reject      = 举报不成立
  // 兼容老 'accept' = accept_hide
  decision: z.enum(['accept', 'accept_hide', 'accept_keep', 'reject']),
  note: z.string().max(500).optional(),
});

const SEC = [{ bearerAuth: [] as string[] }];

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/reports', {
    schema: { tags: ['Reports'], summary: '提交举报', security: SEC },
  }, async (req, reply) => {
    const userId = requireUserId(req);
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const r = await createReport(userId, parsed.data);
    reply.code(201);
    return { data: r };
  });

  app.get(
    '/api/admin/reports/pending',
    {
      preHandler: adminGuard,
      schema: { tags: ['Admin'], summary: '待处理举报', security: SEC },
    },
    async (req) => {
      const parsed = listQuery.safeParse(req.query);
      if (!parsed.success) throw BadRequest('查询参数不合法');
      const items = await listPendingReports(parsed.data);
      return { data: items };
    },
  );

  app.post(
    '/api/admin/reports/:id/handle',
    {
      preHandler: adminGuard,
      schema: { tags: ['Admin'], summary: '处理举报（accept / reject + AuditLog）', security: SEC },
    },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = handleBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = requireUserId(req);
      // 兼容老 client：'accept' → accept_hide
      const decision = pb.data.decision === 'accept' ? 'accept_hide' : pb.data.decision;
      const r = await handleReport(
        pp.data.id,
        adminId,
        decision,
        pb.data.note,
      );
      return { data: r };
    },
  );
};
