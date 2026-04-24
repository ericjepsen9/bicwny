// 通知 HTTP 路由（任意已登录用户）
//   GET    /api/notifications?unreadOnly&limit&cursor   列表
//   GET    /api/notifications/unread-count              未读计数（给 header 红点）
//   POST   /api/notifications/:id/read                  标单条为已读
//   POST   /api/notifications/read-all                  全部标已读
//   DELETE /api/notifications/:id                       删除本人通知
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  deleteNotification,
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from './service.js';

const listQuery = z.object({
  unreadOnly: z.union([z.literal('true'), z.literal('false')]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

const idParam = z.object({ id: z.string().min(1) });

const TAGS = ['Notifications'];
const SEC = [{ bearerAuth: [] as string[] }];

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/notifications', {
    schema: { tags: TAGS, summary: '本人通知列表（游标分页）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');
    const items = await listNotifications(userId, {
      unreadOnly: parsed.data.unreadOnly === 'true',
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    });
    return { data: items };
  });

  app.get('/api/notifications/unread-count', {
    schema: { tags: TAGS, summary: '未读通知数（header 红点用）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const count = await unreadCount(userId);
    return { data: { count } };
  });

  app.post('/api/notifications/:id/read', {
    schema: { tags: TAGS, summary: '标单条为已读', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const n = await markRead(userId, pp.data.id);
    return { data: n };
  });

  app.post('/api/notifications/read-all', {
    schema: { tags: TAGS, summary: '全部标已读', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const r = await markAllRead(userId);
    return { data: r };
  });

  app.delete('/api/notifications/:id', {
    schema: { tags: TAGS, summary: '删除本人通知', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    await deleteNotification(userId, pp.data.id);
    return { data: { ok: true } };
  });
};
