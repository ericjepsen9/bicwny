// 收藏路由（任意已登录用户）
//   POST   /api/favorites/:questionId    添加（幂等）
//   DELETE /api/favorites/:questionId    移除
//   GET    /api/favorites                 列表（含 question 剥答案视图）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { toPublicView } from '../answering/publicView.js';
import { addFavorite, listFavorites, removeFavorite } from './service.js';

const qidParam = z.object({ questionId: z.string().min(1) });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const TAGS = ['Favorites'];
const SEC = [{ bearerAuth: [] as string[] }];

export const favoritesRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/favorites/:questionId', {
    schema: { tags: TAGS, summary: '添加收藏（幂等 · 新建 201 · 已存在 200）', security: SEC },
  }, async (req, reply) => {
    const userId = requireUserId(req);
    const parsed = qidParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    const { favorite, created } = await addFavorite(userId, parsed.data.questionId);
    reply.code(created ? 201 : 200);
    return { data: favorite };
  });

  app.delete('/api/favorites/:questionId', {
    schema: { tags: TAGS, summary: '移除收藏（不存在返 404）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = qidParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    const { removed } = await removeFavorite(userId, parsed.data.questionId);
    if (removed === 0) throw NotFound('收藏不存在');
    return { data: { ok: true } };
  });

  app.get('/api/favorites', {
    schema: { tags: TAGS, summary: '我的收藏（含题目剥答案视图）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');
    const items = await listFavorites(userId, parsed.data.limit);
    return {
      data: items.map((f) => ({
        id: f.id,
        createdAt: f.createdAt,
        questionId: f.questionId,
        question: f.question ? toPublicView(f.question) : null,
      })),
    };
  });

  // 仅返回收藏数量 · payload 几十字节 · 用于 badge 显示
  app.get('/api/favorites/count', {
    schema: { tags: TAGS, summary: '收藏总数（badge）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const count = await prisma.userFavorite.count({ where: { userId } });
    return { data: { count } };
  });
};
