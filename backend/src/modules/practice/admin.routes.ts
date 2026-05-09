// 修学计数 · admin 路由（管理平台预置子项）
//   GET    /api/admin/practice/projects                      所有平台预置 + class 概览
//   POST   /api/admin/practice/projects                      加平台预置（scope=user · ownerId=null · isBuiltin=true）
//   PATCH  /api/admin/practice/projects/:id                  改名 / emoji / 归档
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../../lib/auth.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];
const adminGuard = requireRole('admin');

const idParam = z.object({ id: z.string().min(1) });

const builtinCreateBody = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().max(8).optional(),
});

const builtinPatchBody = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  emoji: z.string().max(8).nullable().optional(),
  archive: z.boolean().optional(),
});

export const practiceAdminRoutes: FastifyPluginAsync = async (app) => {
  // 看所有平台预置（按大类分组）
  app.get('/api/admin/practice/projects', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '平台预置子项 + 各大类汇总', security: SEC },
  }, async () => {
    const cats = await prisma.practiceCategory.findMany({ orderBy: { displayOrder: 'asc' } });
    const projects = await prisma.practiceProject.findMany({
      where: { scope: 'user', ownerId: null, isBuiltin: true },
      orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }],
    });
    const byCat = new Map<string, typeof projects>();
    for (const p of projects) {
      const arr = byCat.get(p.categoryId) ?? [];
      arr.push(p);
      byCat.set(p.categoryId, arr);
    }
    const data = cats.map((c) => ({
      category: c,
      projects: byCat.get(c.id) ?? [],
    }));
    return { data };
  });

  app.post('/api/admin/practice/projects', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '加平台预置子项', security: SEC },
  }, async (req, reply) => {
    const body = builtinCreateBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());

    const cat = await prisma.practiceCategory.findUnique({ where: { id: body.data.categoryId } });
    if (!cat) throw NotFound('大类不存在');

    const dup = await prisma.practiceProject.findFirst({
      where: { categoryId: body.data.categoryId, name: body.data.name.trim(), isBuiltin: true, archivedAt: null },
    });
    if (dup) throw BadRequest(`已有同名预置「${body.data.name}」`);

    const data = await prisma.practiceProject.create({
      data: {
        categoryId: body.data.categoryId,
        name: body.data.name.trim(),
        emoji: body.data.emoji?.trim() || null,
        scope: 'user',
        ownerId: null,
        isBuiltin: true,
      },
    });
    reply.code(201);
    return { data };
  });

  app.patch('/api/admin/practice/projects/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '改 / 归档平台预置子项', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = builtinPatchBody.safeParse(req.body);
    if (!body.success) throw BadRequest('请求参数不合法');
    const proj = await prisma.practiceProject.findUnique({ where: { id: pp.data.id } });
    if (!proj || !proj.isBuiltin) throw NotFound('平台预置子项不存在');
    const data = await prisma.practiceProject.update({
      where: { id: pp.data.id },
      data: {
        name: body.data.name?.trim() || undefined,
        emoji: body.data.emoji === null ? null : (body.data.emoji?.trim() || undefined),
        archivedAt: body.data.archive ? new Date() : undefined,
      },
    });
    return { data };
  });
};
