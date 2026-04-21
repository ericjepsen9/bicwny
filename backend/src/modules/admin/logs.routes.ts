// Admin 运行日志查询
//   GET /api/admin/logs        ErrorLog 列表（filter + 游标分页）
//   GET /api/admin/logs/stats  最近 24h 各 kind 计数
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const adminGuard = requireRole('admin');
const kindEnum = z.enum(['error', 'slow_request', 'slow_query']);

const listQuery = z.object({
  kind: kindEnum.optional(),
  userId: z.string().optional(),
  requestId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

export const adminLogsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/logs', { preHandler: adminGuard }, async (req) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');
    const q = parsed.data;
    const items = await prisma.errorLog.findMany({
      where: {
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.userId ? { userId: q.userId } : {}),
        ...(q.requestId ? { requestId: q.requestId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: q.limit ?? 50,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return { data: items };
  });

  app.get(
    '/api/admin/logs/stats',
    { preHandler: adminGuard },
    async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const groups = await prisma.errorLog.groupBy({
        by: ['kind'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      });
      const counts = { error: 0, slow_request: 0, slow_query: 0 };
      for (const g of groups) counts[g.kind] = g._count._all;
      return { data: { windowHours: 24, counts } };
    },
  );
};
