// Admin 审计日志查询
//   GET /api/admin/audit?adminId&action&targetType&targetId&limit&cursor
// timestamp 降序 + 游标分页。
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const adminGuard = requireRole('admin');

const query = z.object({
  adminId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

const SEC = [{ bearerAuth: [] as string[] }];

export const adminAuditRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/audit', {
    preHandler: adminGuard,
    schema: { tags: ['Admin'], summary: '审计日志（AuditLog · filter + 游标分页）', security: SEC },
  }, async (req) => {
    const parsed = query.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');
    const q = parsed.data;

    const items = await prisma.auditLog.findMany({
      where: {
        ...(q.adminId ? { adminId: q.adminId } : {}),
        ...(q.action ? { action: q.action } : {}),
        ...(q.targetType ? { targetType: q.targetType } : {}),
        ...(q.targetId ? { targetId: q.targetId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: q.limit ?? 50,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return { data: items };
  });
};
