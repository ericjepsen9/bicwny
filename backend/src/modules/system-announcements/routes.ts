// 系统公告 HTTP 路由
//   Admin（requireRole admin）:
//     POST   /api/admin/system-announcements          创建 + 触发全平台通知
//     GET    /api/admin/system-announcements          列表（含撤回 / 过期 · 时序倒序）
//     PATCH  /api/admin/system-announcements/:id      改内容（contentHash 自动重算）
//     POST   /api/admin/system-announcements/:id/revoke  撤回
//   公开（已登录）:
//     GET    /api/system-announcements/:id            详情（前端 link 跳转用 · 兜底显示已撤回/过期）
//     GET    /api/system-announcements                active 列表（前端 banner / 玻璃文字候选用）
//   注：公开 endpoint 用 /api/system-announcements 而非 /api/announcements
//   后者已被班级公告占用（announcements/routes.ts:/api/announcements/:aid）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  createSystemAnnouncement,
  getSystemAnnouncement,
  listActiveSystemAnnouncements,
  listAllSystemAnnouncements,
  revokeSystemAnnouncement,
  updateSystemAnnouncement,
} from './service.js';

const TAGS_ADMIN = ['Admin'];
const TAGS_PUBLIC = ['Announcements'];
const SEC = [{ bearerAuth: [] as string[] }];

const adminGuard = requireRole('admin');

const idParam = z.object({ id: z.string().min(1) });

const createBody = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(5000),
  severity: z.enum(['normal', 'urgent', 'critical']),
  // ISO 字符串 · 可空（默认 +24h）
  expiresAt: z.string().datetime().optional(),
});

const patchBody = z.object({
  title: z.string().min(1).max(100).optional(),
  body: z.string().min(1).max(5000).optional(),
  severity: z.enum(['normal', 'urgent', 'critical']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export const systemAnnouncementsRoutes: FastifyPluginAsync = async (app) => {
  // === admin ===
  app.post('/api/admin/system-announcements', {
    preHandler: adminGuard,
    schema: { tags: TAGS_ADMIN, summary: '发布系统公告（含 dispatch 全平台）', security: SEC },
  }, async (req, reply) => {
    const adminId = requireUserId(req);
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const created = await createSystemAnnouncement(adminId, {
      title: parsed.data.title,
      body: parsed.data.body,
      severity: parsed.data.severity,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    });
    reply.code(201);
    return { data: created };
  });

  app.get('/api/admin/system-announcements', {
    preHandler: adminGuard,
    schema: { tags: TAGS_ADMIN, summary: 'admin 列表（含撤回 / 过期）', security: SEC },
  }, async (req) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');
    const items = await listAllSystemAnnouncements(parsed.data);
    return { data: items };
  });

  app.patch('/api/admin/system-announcements/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS_ADMIN, summary: '改系统公告（contentHash 自动重算）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = patchBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const updated = await updateSystemAnnouncement(pp.data.id, {
      title: body.data.title,
      body: body.data.body,
      severity: body.data.severity,
      expiresAt: body.data.expiresAt === undefined
        ? undefined
        : body.data.expiresAt === null
          ? null
          : new Date(body.data.expiresAt),
    });
    return { data: updated };
  });

  app.post('/api/admin/system-announcements/:id/revoke', {
    preHandler: adminGuard,
    schema: { tags: TAGS_ADMIN, summary: '撤回系统公告（不发新通知 · 已发通知 join revokedAt 置灰）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const revoked = await revokeSystemAnnouncement(pp.data.id);
    return { data: revoked };
  });

  // === 公开（已登录）===
  app.get('/api/system-announcements/:id', {
    schema: { tags: TAGS_PUBLIC, summary: '系统公告详情（前端 link 跳转用）', security: SEC },
  }, async (req) => {
    requireUserId(req); // 仅登录 · 任意 role
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const a = await getSystemAnnouncement(pp.data.id);
    return { data: a };
  });

  app.get('/api/system-announcements', {
    schema: { tags: TAGS_PUBLIC, summary: 'active 系统公告列表（前端 banner / 玻璃文字候选）', security: SEC },
  }, async (req) => {
    requireUserId(req);
    const items = await listActiveSystemAnnouncements();
    return { data: items };
  });
};
