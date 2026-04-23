// Admin 用户 + 平台大盘路由（全部 admin）
//   GET   /api/admin/users                 列表（role/search/cursor/limit）
//   PATCH /api/admin/users/:id/role        { role }
//   POST  /api/admin/users/:id/active      { isActive }
//   GET   /api/admin/platform-stats        platformStats（windowDays 可配）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { platformStats } from './platform-stats.service.js';
import { listUsers, setUserActive, updateUserRole } from './users.service.js';

const adminGuard = requireRole('admin');

const roleEnum = z.enum(['admin', 'coach', 'student']);
const idParam = z.object({ id: z.string().min(1) });

const listUsersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
  role: roleEnum.optional(),
  search: z.string().min(1).max(100).optional(),
});

const roleBody = z.object({ role: roleEnum });
const activeBody = z.object({ isActive: z.boolean() });

const statsQuery = z.object({
  windowDays: z.coerce.number().int().min(1).max(90).optional(),
});

const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/users', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '用户列表（?role / ?search / 游标分页）', security: SEC },
  }, async (req) => {
    const parsed = listUsersQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');
    return { data: await listUsers(parsed.data) };
  });

  app.patch(
    '/api/admin/users/:id/role',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '改用户角色（禁止自己降级）+ AuditLog', security: SEC },
    },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = roleBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = requireUserId(req);
      const u = await updateUserRole(pp.data.id, adminId, pb.data.role);
      return { data: u };
    },
  );

  app.post(
    '/api/admin/users/:id/active',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '启停账号（停用时吊销所有活跃 session）+ AuditLog', security: SEC },
    },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = activeBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = requireUserId(req);
      const u = await setUserActive(pp.data.id, adminId, pb.data.isActive);
      return { data: u };
    },
  );

  app.get(
    '/api/admin/platform-stats',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '平台大盘（users / classes / questions / answers / llm / sm2）', security: SEC },
    },
    async (req) => {
      const parsed = statsQuery.safeParse(req.query);
      if (!parsed.success) throw BadRequest('查询参数不合法');
      return { data: await platformStats(parsed.data.windowDays) };
    },
  );
};
