// 藏历 routes
//   学员（已登录）:
//     GET  /api/calendar/today                今日
//     GET  /api/calendar/upcoming?days=7      今日+未来 N 天
//     GET  /api/calendar/month/:ym            'YYYY-MM' 月内
//     GET  /api/calendar/day/:date            'YYYY-MM-DD'
//   admin:
//     PUT    /api/admin/calendar/:date        upsert
//     DELETE /api/admin/calendar/:date        删除
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  deleteDay,
  getDay,
  getToday,
  getUpcoming,
  listMonth,
  upsertDay,
} from './service.js';

const TAGS = ['Calendar'];
const TAGS_ADMIN = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

const ymParam = z.object({ ym: z.string().regex(/^\d{4}-\d{2}$/) });
const dateParam = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

const tagEnum = z.enum(['十斋日', '飞幡日', '八吉同聚', '九凶同聚']);
const upsertBody = z.object({
  lunar: z.string().min(1).max(20),
  tibetan: z.string().min(1).max(20),
  tibetanMonth: z.string().min(1).max(20),
  isIntercalary: z.boolean().optional(),
  tags: z.array(tagEnum).optional(),
  auspicious: z.boolean().optional(),
  events: z.array(z.string().max(80)).max(20).optional(),
  publicHoliday: z.string().max(20).nullable().optional(),
});

export const tibetanRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/calendar/today', {
    schema: { tags: TAGS, summary: '今日藏历', security: SEC },
  }, async () => {
    const data = await getToday(prisma);
    return { data };
  });

  app.get('/api/calendar/upcoming', {
    schema: { tags: TAGS, summary: '今日 + 未来 N 天 · default 7', security: SEC },
  }, async (req) => {
    const q = z.object({ days: z.coerce.number().int().min(1).max(60).optional() }).safeParse(req.query);
    if (!q.success) throw BadRequest('参数不合法');
    const data = await getUpcoming(prisma, q.data.days ?? 7);
    return { data };
  });

  app.get('/api/calendar/month/:ym', {
    schema: { tags: TAGS, summary: '某月藏历对照（YYYY-MM）', security: SEC },
  }, async (req) => {
    const pp = ymParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const data = await listMonth(prisma, pp.data.ym);
    return { data };
  });

  app.get('/api/calendar/day/:date', {
    schema: { tags: TAGS, summary: '某日藏历（YYYY-MM-DD）', security: SEC },
  }, async (req) => {
    const pp = dateParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const data = await getDay(prisma, pp.data.date);
    return { data };
  });

  // admin 编辑
  app.put('/api/admin/calendar/:date', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS_ADMIN, summary: 'upsert 某日藏历（admin）', security: SEC },
  }, async (req) => {
    const pp = dateParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = upsertBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await upsertDay(prisma, { date: pp.data.date, ...body.data });
    return { data };
  });

  app.delete('/api/admin/calendar/:date', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS_ADMIN, summary: '删除某日藏历（admin）', security: SEC },
  }, async (req) => {
    const pp = dateParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    await deleteDay(prisma, pp.data.date);
    return { data: { ok: true } };
  });
};
