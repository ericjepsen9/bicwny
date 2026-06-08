// A/B 实验路由
//   POST /api/experiments/:key/assign       前端 boot 调 · 返回 variant · 首次写 exposure
//   GET  /api/admin/experiments             列表（admin）
//   POST /api/admin/experiments             创建（admin）
//   PATCH /api/admin/experiments/:key       更新（active / archive / variants）
//   GET  /api/admin/experiments/:key/results 按 variant 看 exposed / converted / rate
//
// 客户端无法手填 variant · 只能拿到 server 抽签结果 · 防止用户态绕过实验
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserId, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { assignVariant, getExperimentResults } from '../../lib/experiments.js';

const adminGuard = requireRole('admin');
const TAGS = ['experiments'];
const ADMIN_TAGS = ['admin'];
const SEC = [{ bearerAuth: [] }];

const variantSchema = z.array(
  z.object({
    name: z.string().trim().min(1).max(64),
    weight: z.number().min(0).max(10000),
  }),
).min(1);

const createBody = z.object({
  key: z.string().regex(/^[A-Za-z0-9_\-]+$/).min(2).max(80),
  description: z.string().max(500).optional(),
  variants: variantSchema,
  goalEvent: z.string().min(1).max(120).nullable().optional(),
});

const updateBody = z.object({
  description: z.string().max(500).optional(),
  variants: variantSchema.optional(),
  goalEvent: z.string().min(1).max(120).nullable().optional(),
  isActive: z.boolean().optional(),
  archive: z.boolean().optional(),
});

const assignBody = z.object({
  sessionId: z.string().min(1).max(120).optional(),
});

export const experimentsRoutes: FastifyPluginAsync = async (app) => {
  // 客户端：拿 variant
  app.post(
    '/api/experiments/:key/assign',
    {
      schema: {
        tags: TAGS,
        summary: '分配 variant（确定性 hash · 同 subject 永远同 variant）',
        security: SEC,
      },
    },
    async (req) => {
      const params = z.object({ key: z.string().min(1) }).safeParse(req.params);
      if (!params.success) throw BadRequest('路径参数不合法');
      const body = assignBody.safeParse(req.body ?? {});
      if (!body.success) throw BadRequest('请求参数不合法', body.error.flatten());

      const userId = getUserId(req);
      const sessionId = body.data.sessionId ?? null;
      if (!userId && !sessionId) {
        throw BadRequest('需要 userId（登录）或 sessionId');
      }
      const r = await assignVariant({
        key: params.data.key,
        userId,
        sessionId,
      });
      return { data: r };
    },
  );

  // Admin · 列表
  app.get(
    '/api/admin/experiments',
    {
      preHandler: adminGuard,
      schema: { tags: ADMIN_TAGS, summary: '实验列表（最新优先）', security: SEC },
    },
    async () => {
      const rows = await prisma.experiment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return { data: rows };
    },
  );

  // Admin · 创建
  app.post(
    '/api/admin/experiments',
    {
      preHandler: adminGuard,
      schema: { tags: ADMIN_TAGS, summary: '创建实验', security: SEC },
    },
    async (req) => {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success) throw BadRequest('请求参数不合法', parsed.error.flatten());
      const adminId = requireUserId(req);
      const exp = await prisma.experiment.create({
        data: {
          key: parsed.data.key,
          description: parsed.data.description ?? null,
          variants: parsed.data.variants,
          goalEvent: parsed.data.goalEvent ?? null,
          createdBy: adminId,
        },
      });
      return { data: exp };
    },
  );

  // Admin · 更新（含归档）
  app.patch(
    '/api/admin/experiments/:key',
    {
      preHandler: adminGuard,
      schema: { tags: ADMIN_TAGS, summary: '更新实验 / 归档', security: SEC },
    },
    async (req) => {
      const params = z.object({ key: z.string().min(1) }).safeParse(req.params);
      if (!params.success) throw BadRequest('路径参数不合法');
      const body = updateBody.safeParse(req.body);
      if (!body.success) throw BadRequest('请求参数不合法', body.error.flatten());

      const exp = await prisma.experiment.findUnique({ where: { key: params.data.key } });
      if (!exp) throw NotFound('实验不存在');

      const data: Record<string, unknown> = {};
      if (body.data.description !== undefined) data.description = body.data.description;
      if (body.data.variants !== undefined) data.variants = body.data.variants;
      if (body.data.goalEvent !== undefined) data.goalEvent = body.data.goalEvent;
      if (body.data.isActive !== undefined) data.isActive = body.data.isActive;
      if (body.data.archive === true) {
        data.archivedAt = new Date();
        data.isActive = false;
      }
      const updated = await prisma.experiment.update({
        where: { key: params.data.key },
        data,
      });
      return { data: updated };
    },
  );

  // Admin · 结果
  app.get(
    '/api/admin/experiments/:key/results',
    {
      preHandler: adminGuard,
      schema: {
        tags: ADMIN_TAGS,
        summary: '按 variant 统计 exposed / converted / rate',
        security: SEC,
      },
    },
    async (req) => {
      const params = z.object({ key: z.string().min(1) }).safeParse(req.params);
      if (!params.success) throw BadRequest('路径参数不合法');
      try {
        return { data: await getExperimentResults(params.data.key) };
      } catch (e) {
        if ((e as Error).message.includes('not found')) throw NotFound('实验不存在');
        throw e;
      }
    },
  );
};
