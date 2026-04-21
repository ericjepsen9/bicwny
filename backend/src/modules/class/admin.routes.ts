// Admin 班级管理路由（全部 admin 角色）
//   POST   /api/admin/classes                     创建班级
//   GET    /api/admin/classes                     列所有班级
//   PATCH  /api/admin/classes/:id/archive         归档
//   GET    /api/admin/classes/:id/members         成员列表
//   POST   /api/admin/classes/:id/members         添加成员
//   DELETE /api/admin/classes/:id/members/:userId 移除成员
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  addMember,
  archiveClass,
  createClass,
  getClass,
  listMembers,
  removeMember,
} from './service.js';

const adminGuard = requireRole('admin');

const idParam = z.object({ id: z.string().min(1) });
const memberParams = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

const createBody = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  coverEmoji: z.string().max(8).optional(),
});

const addMemberBody = z.object({
  userId: z.string().min(1),
  role: z.enum(['coach', 'student']),
});

export const adminClassRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/admin/classes',
    { preHandler: adminGuard },
    async (req, reply) => {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
      const cls = await createClass(parsed.data);
      reply.code(201);
      return { data: cls };
    },
  );

  app.get('/api/admin/classes', { preHandler: adminGuard }, async () => {
    const items = await prisma.class.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { data: items };
  });

  app.patch(
    '/api/admin/classes/:id/archive',
    { preHandler: adminGuard },
    async (req) => {
      const parsed = idParam.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      const cls = await archiveClass(parsed.data.id);
      return { data: cls };
    },
  );

  app.get(
    '/api/admin/classes/:id/members',
    { preHandler: adminGuard },
    async (req) => {
      const parsed = idParam.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      await getClass(parsed.data.id);
      const members = await listMembers(parsed.data.id);
      return { data: members };
    },
  );

  app.post(
    '/api/admin/classes/:id/members',
    { preHandler: adminGuard },
    async (req, reply) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = addMemberBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      await getClass(pp.data.id);
      const member = await addMember(pp.data.id, pb.data.userId, pb.data.role);
      reply.code(201);
      return { data: member };
    },
  );

  app.delete(
    '/api/admin/classes/:id/members/:userId',
    { preHandler: adminGuard },
    async (req) => {
      const parsed = memberParams.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      await removeMember(parsed.data.id, parsed.data.userId);
      return { data: { ok: true } };
    },
  );
};
