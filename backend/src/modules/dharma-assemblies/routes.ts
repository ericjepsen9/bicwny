// 法会 / 系统活动 HTTP 路由（spec §3.7）
//   Admin:
//     POST   /api/admin/dharma-assemblies          创建 + 触发全平台预告
//     GET    /api/admin/dharma-assemblies          列表（含软删 · 时序倒序）
//     PATCH  /api/admin/dharma-assemblies/:id      改
//     DELETE /api/admin/dharma-assemblies/:id      软删
//   公开（已登录）:
//     GET    /api/assemblies/:id                   详情（push/banner link 跳转目标）
//     GET    /api/assemblies                       active 列表（首页玻璃文字候选）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  createAssembly,
  deleteAssembly,
  getAssembly,
  listActiveAssemblies,
  listAllAssemblies,
  updateAssembly,
} from './service.js';

const TAGS_ADMIN = ['Admin'];
const TAGS_PUBLIC = ['Assemblies'];
const SEC = [{ bearerAuth: [] as string[] }];

const adminGuard = requireRole('admin');

const idParam = z.object({ id: z.string().min(1) });

const createBody = z.object({
  title: z.string().min(1).max(100),
  category: z.enum(['assembly', 'system_session', 'memorial']),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  description: z.string().min(1).max(10000),
  coverImage: z.string().nullable().optional(),
  externalLink: z.string().nullable().optional(),
});

const patchBody = z.object({
  title: z.string().min(1).max(100).optional(),
  category: z.enum(['assembly', 'system_session', 'memorial']).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  description: z.string().min(1).max(10000).optional(),
  coverImage: z.string().nullable().optional(),
  externalLink: z.string().nullable().optional(),
});

export const dharmaAssembliesRoutes: FastifyPluginAsync = async (app) => {
  // === admin ===
  app.post('/api/admin/dharma-assemblies', {
    preHandler: adminGuard,
    schema: { tags: TAGS_ADMIN, summary: '发布法会 / 系统活动（含 dispatch 全平台预告）', security: SEC },
  }, async (req, reply) => {
    const adminId = requireUserId(req);
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const created = await createAssembly(adminId, {
      title: parsed.data.title,
      category: parsed.data.category,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      description: parsed.data.description,
      coverImage: parsed.data.coverImage,
      externalLink: parsed.data.externalLink,
    });
    reply.code(201);
    return { data: created };
  });

  app.get('/api/admin/dharma-assemblies', {
    preHandler: adminGuard,
    schema: { tags: TAGS_ADMIN, summary: 'admin 列表（含软删）', security: SEC },
  }, async () => {
    const items = await listAllAssemblies({});
    return { data: items };
  });

  app.patch('/api/admin/dharma-assemblies/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS_ADMIN, summary: '改法会', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = patchBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const updated = await updateAssembly(pp.data.id, {
      title: body.data.title,
      category: body.data.category,
      startAt: body.data.startAt ? new Date(body.data.startAt) : undefined,
      endAt: body.data.endAt ? new Date(body.data.endAt) : undefined,
      description: body.data.description,
      coverImage: body.data.coverImage,
      externalLink: body.data.externalLink,
    });
    return { data: updated };
  });

  app.delete('/api/admin/dharma-assemblies/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS_ADMIN, summary: '软删法会（已调度 cron 发送前检查 · 自动跳过）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    await deleteAssembly(pp.data.id);
    return { data: { ok: true } };
  });

  // === 公开（已登录）===
  app.get('/api/assemblies/:id', {
    schema: { tags: TAGS_PUBLIC, summary: '法会详情（push/banner link 跳转目标）', security: SEC },
  }, async (req) => {
    requireUserId(req);
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const a = await getAssembly(pp.data.id);
    return { data: a };
  });

  app.get('/api/assemblies', {
    schema: { tags: TAGS_PUBLIC, summary: 'active 法会列表（未结束 · 用于首页候选）', security: SEC },
  }, async (req) => {
    requireUserId(req);
    const items = await listActiveAssemblies();
    return { data: items };
  });
};
