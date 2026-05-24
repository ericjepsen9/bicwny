// Admin 班级管理路由（全部 admin 角色）
//   POST   /api/admin/classes                     创建班级
//   GET    /api/admin/classes                     列所有班级
//   PATCH  /api/admin/classes/:id/archive         归档
//   GET    /api/admin/classes/:id/members         成员列表
//   POST   /api/admin/classes/:id/members         添加成员
//   DELETE /api/admin/classes/:id/members/:userId 移除成员
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  addMember,
  archiveClass,
  assertIsCoachOfClass,
  createClass,
  getClass,
  listMembers,
  removeMember,
  replaceCoach,
  setMemberRole,
  updateClass,
} from './service.js';

// coach 也能管班级 + 成员（用户决策 · 放权 coach 给自己班加/移除学员）
// 但 coach 只能管「自己的班」· 每个 :id handler 须过 requireClassScope 归属校验
const adminGuard = requireRole('coach', 'admin');

/** coach 必须是该班 coach；admin 全放行。返回 actor userId。 */
async function requireClassScope(req: FastifyRequest, classId: string): Promise<string> {
  const userId = requireUserId(req);
  if (getUserRole(req) === 'admin') return userId;
  await assertIsCoachOfClass(userId, classId);
  return userId;
}

const idParam = z.object({ id: z.string().min(1) });
const memberParams = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

const createBody = z.object({
  name: z.string().min(1).max(80),
  courseId: z.string().min(1), // 主修法本 · 必填
  description: z.string().max(500).optional(),
  coverEmoji: z.string().max(8).optional(),
});

const updateBody = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  coverEmoji: z.string().max(8).nullable().optional(),
}).refine((p) => Object.keys(p).length > 0, { message: 'patch 不能为空' });

const addMemberBody = z.object({
  userId: z.string().min(1),
  role: z.enum(['coach', 'student']),
});

const replaceCoachBody = z.object({
  newCoachUserId: z.string().min(1),
  oldCoachUserId: z.string().min(1),
  oldDisposition: z.enum(['demote', 'remove']),
});

const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

export const adminClassRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/admin/classes',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '创建班级（自动生成 6 字加入码）', security: SEC },
    },
    async (req, reply) => {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
      const adminId = requireUserId(req);
      const cls = await createClass(parsed.data, { actorAdminId: adminId });
      reply.code(201);
      return { data: cls };
    },
  );

  app.get('/api/admin/classes', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '班级列表（admin 全部 · coach 仅自己班）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const isAdmin = getUserRole(req) === 'admin';
    const items = await prisma.class.findMany({
      // coach 只看自己带的班 · 防止跨班泄漏 joinCode / 成员
      where: isAdmin ? undefined : { members: { some: { userId, role: 'coach', removedAt: null } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        course: {
          select: {
            id: true, slug: true, title: true, titleTraditional: true,
            author: true, coverEmoji: true,
          },
        },
      },
    });
    return { data: items };
  });

  // 更新班级元数据（不含归档 · 不含主修法本变更 · 不含 joinCode 变更）
  app.patch(
    '/api/admin/classes/:id',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '更新班级（name / description / coverEmoji）', security: SEC },
    },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = updateBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = await requireClassScope(req, pp.data.id);
      const cls = await updateClass(pp.data.id, pb.data, { actorAdminId: adminId });
      return { data: cls };
    },
  );

  app.patch(
    '/api/admin/classes/:id/archive',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '归档班级（one-way · 学员立即失去访问权）', security: SEC },
    },
    async (req) => {
      const parsed = idParam.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      const adminId = await requireClassScope(req, parsed.data.id);
      const cls = await archiveClass(parsed.data.id, { actorAdminId: adminId });
      return { data: cls };
    },
  );

  app.get(
    '/api/admin/classes/:id/members',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '班级成员（admin 超权）', security: SEC },
    },
    async (req) => {
      const parsed = idParam.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      await requireClassScope(req, parsed.data.id);
      await getClass(parsed.data.id);
      const members = await listMembers(parsed.data.id);
      return { data: members };
    },
  );

  app.post(
    '/api/admin/classes/:id/members',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '添加成员（指定 role=coach / student）', security: SEC },
    },
    async (req, reply) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = addMemberBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = await requireClassScope(req, pp.data.id);
      await getClass(pp.data.id);
      const member = await addMember(pp.data.id, pb.data.userId, pb.data.role, {
        actorAdminId: adminId,
      });
      reply.code(201);
      return { data: member };
    },
  );

  // 切换成员角色（coach ↔ student）· 不删除成员
  app.patch(
    '/api/admin/classes/:id/members/:userId/role',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '切换成员角色（防降级到 0 coach）', security: SEC },
    },
    async (req) => {
      const pp = memberParams.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = z.object({ role: z.enum(['coach', 'student']) }).safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = await requireClassScope(req, pp.data.id);
      const m = await setMemberRole(pp.data.id, pp.data.userId, pb.data.role, { actorAdminId: adminId });
      return { data: m };
    },
  );

  // 更换辅导员（一步替换 · 仅平台 admin · 应对人员变动）
  //   新 coach 可班内升任或班外账号加入 · 旧 coach 可降为学员或移出班级
  app.put(
    '/api/admin/classes/:id/coach',
    {
      preHandler: requireRole('admin'),
      schema: { tags: TAGS, summary: '更换辅导员（先加新后撤旧 · 仅 admin）', security: SEC },
    },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = replaceCoachBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = requireUserId(req);
      await getClass(pp.data.id);
      await replaceCoach(pp.data.id, pb.data, { actorAdminId: adminId });
      return { data: { ok: true } };
    },
  );

  app.delete(
    '/api/admin/classes/:id/members/:userId',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '移出班级成员（软删除 removedAt）', security: SEC },
    },
    async (req) => {
      const parsed = memberParams.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      const adminId = await requireClassScope(req, parsed.data.id);
      await removeMember(parsed.data.id, parsed.data.userId, { actorAdminId: adminId });
      return { data: { ok: true } };
    },
  );
};
