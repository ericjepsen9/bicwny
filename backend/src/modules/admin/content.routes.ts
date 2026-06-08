// Admin · 内容版本化只读
//   GET /api/admin/content/seeds                已应用 seed 列表（最新优先）
//   GET /api/admin/content/releases             审计流水（按 entity 过滤 / 游标分页）
//   POST /api/admin/users/:id/cohort            指派用户内容分组（A/B 实验）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { recordRelease } from '../../lib/content-seed.js';

const adminGuard = requireRole('admin');
const TAGS = ['admin'];
const SEC = [{ bearerAuth: [] }];

const releaseQuery = z.object({
  entity: z.enum(['course', 'chapter', 'lesson', 'question', 'cohort']).optional(),
  entityId: z.string().min(1).max(100).optional(),
  bySeed: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

const cohortBody = z.object({
  // 'A' / 'B' / 自定义 · 空字符串 / null 视为清除
  cohort: z
    .string()
    .trim()
    .max(64)
    .nullable()
    .optional()
    .transform((v) => (v == null || v === '' ? null : v)),
});

export const adminContentRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/admin/content/seeds',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: 'Seed 注册表 · 最新优先', security: SEC },
    },
    async () => {
      const seeds = await prisma.contentSeed.findMany({
        orderBy: { appliedAt: 'desc' },
        take: 200,
      });
      return { data: seeds };
    },
  );

  app.get(
    '/api/admin/content/releases',
    {
      preHandler: adminGuard,
      schema: {
        tags: TAGS,
        summary: '内容变更流水 · ?entity / ?entityId / ?bySeed 过滤',
        security: SEC,
      },
    },
    async (req) => {
      const parsed = releaseQuery.safeParse(req.query);
      if (!parsed.success) throw BadRequest('查询参数不合法');
      const { entity, entityId, bySeed, limit = 50, cursor } = parsed.data;

      const rows = await prisma.contentRelease.findMany({
        where: {
          ...(entity ? { entity } : {}),
          ...(entityId ? { entityId } : {}),
          ...(bySeed ? { bySeed } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      return { data: { items, nextCursor } };
    },
  );

  app.post(
    '/api/admin/users/:id/cohort',
    {
      preHandler: adminGuard,
      schema: {
        tags: TAGS,
        summary: '指派用户内容分组 · 触发 ContentRelease(cohort-set)',
        security: SEC,
      },
    },
    async (req) => {
      const idParam = z.object({ id: z.string().min(1) }).safeParse(req.params);
      if (!idParam.success) throw BadRequest('路径参数不合法');
      const body = cohortBody.safeParse(req.body);
      if (!body.success) throw BadRequest('请求参数不合法', body.error.flatten());

      const adminId = requireUserId(req);
      const userId = idParam.data.id;

      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, contentCohort: true },
      });
      if (!u) throw NotFound('用户不存在');

      const oldCohort = u.contentCohort;
      const newCohort = body.data.cohort ?? null;

      if (oldCohort === newCohort) {
        return { data: { id: userId, contentCohort: newCohort, changed: false } };
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { contentCohort: newCohort },
        });
        await recordRelease(tx, {
          entity: 'cohort',
          entityId: userId,
          change: 'cohort-set',
          diff: { from: oldCohort, to: newCohort },
          byUserId: adminId,
        });
      });

      return { data: { id: userId, contentCohort: newCohort, changed: true } };
    },
  );
};
