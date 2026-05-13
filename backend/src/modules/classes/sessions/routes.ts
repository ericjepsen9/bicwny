// 班级排课 routes
//   辅导员侧（需 coach 权限）：
//     GET    /api/coach/classes/:classId/sessions          列表（含 past 参数）
//     POST   /api/coach/classes/:classId/sessions          新建
//     PATCH  /api/coach/sessions/:id                       编辑
//     DELETE /api/coach/sessions/:id                       删除
//
//   学员侧：
//     GET    /api/my/upcoming-events                       未来 60 分钟内的事件
//     GET    /api/my/top-home-card                         单条 · 用于首页卡
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../../lib/auth.js';
import { BadRequest } from '../../../lib/errors.js';
import {
  createSession,
  deleteSession,
  getMyTopHomeCard,
  listClassSessions,
  listMyUpcomingEvents,
  updateSession,
} from './service.js';

const TAGS = ['ClassSessions'];
const SEC = [{ bearerAuth: [] as string[] }];

const classIdParam = z.object({ classId: z.string().min(1) });
const idParam = z.object({ id: z.string().min(1) });

const createBody = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(2000).nullable().optional(),
  startAt: z.string().datetime(), // ISO 8601
  durationMin: z.number().int().min(1).max(24 * 60).optional(),
  liveLink: z.string().max(500).nullable().optional(),
});

const updateBody = z.object({
  title: z.string().min(1).max(80).optional(),
  description: z.string().max(2000).nullable().optional(),
  startAt: z.string().datetime().optional(),
  durationMin: z.number().int().min(1).max(24 * 60).optional(),
  liveLink: z.string().max(500).nullable().optional(),
});

const listQuery = z.object({
  past: z.coerce.boolean().optional(),
});

const upcomingQuery = z.object({
  within: z.coerce.number().int().min(1).max(60 * 24).optional(),
});

export const classSessionsRoutes: FastifyPluginAsync = async (app) => {
  // 辅导员：列表
  app.get('/api/coach/classes/:classId/sessions', {
    schema: { tags: TAGS, summary: '辅导员：班级排课列表', security: SEC },
  }, async (req) => {
    requireUserId(req); // 仅鉴权 · service 内校验是否本班 coach
    const pp = classIdParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const pq = listQuery.safeParse(req.query);
    if (!pq.success) throw BadRequest('查询参数不合法');
    return { data: await listClassSessions(pp.data.classId, { past: pq.data.past }) };
  });

  // 辅导员：新建
  app.post('/api/coach/classes/:classId/sessions', {
    schema: { tags: TAGS, summary: '辅导员：新建排课', security: SEC },
  }, async (req, reply) => {
    const userId = requireUserId(req);
    const pp = classIdParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = createBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const s = await createSession(userId, {
      classId: pp.data.classId,
      title: body.data.title,
      description: body.data.description,
      startAt: new Date(body.data.startAt),
      durationMin: body.data.durationMin,
      liveLink: body.data.liveLink,
    });
    reply.code(201);
    return { data: s };
  });

  // 辅导员：编辑
  app.patch('/api/coach/sessions/:id', {
    schema: { tags: TAGS, summary: '辅导员：编辑排课', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = updateBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const s = await updateSession(userId, pp.data.id, {
      title: body.data.title,
      description: body.data.description,
      startAt: body.data.startAt ? new Date(body.data.startAt) : undefined,
      durationMin: body.data.durationMin,
      liveLink: body.data.liveLink,
    });
    return { data: s };
  });

  // 辅导员：删除
  app.delete('/api/coach/sessions/:id', {
    schema: { tags: TAGS, summary: '辅导员：删除排课', security: SEC },
  }, async (req, reply) => {
    const userId = requireUserId(req);
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    await deleteSession(userId, pp.data.id);
    reply.code(204);
  });

  // 学员：upcoming events
  app.get('/api/my/upcoming-events', {
    schema: { tags: TAGS, summary: '学员：我未来 N 分钟内的事件', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const pq = upcomingQuery.safeParse(req.query);
    if (!pq.success) throw BadRequest('查询参数不合法');
    return { data: await listMyUpcomingEvents(userId, pq.data.within ?? 60) };
  });

  // 学员：top-1 home card · v1 简化版（返回 null 或单条）
  app.get('/api/my/top-home-card', {
    schema: { tags: TAGS, summary: '学员：首页提醒卡（已仲裁单条）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    return { data: await getMyTopHomeCard(userId) };
  });
};
