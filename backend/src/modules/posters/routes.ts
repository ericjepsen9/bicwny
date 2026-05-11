// 首页画报 routes
//   GET    /api/posters/current               学员 · 获取当前月画报
//   GET    /api/admin/posters/:year           admin · 列某年 12 月画报
//   PUT    /api/admin/posters/:year/:month    admin · upsert（JSON body 含 imageUrl + caption）
//   DELETE /api/admin/posters/:year/:month    admin · 删除
//   POST   /api/admin/posters/upload-image    admin · multipart 单图上传 · 返回 URL
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  deletePoster,
  getCurrentPoster,
  listYearPosters,
  uploadPosterImage,
  upsertPoster,
} from './service.js';

const TAGS = ['Posters'];
const TAGS_ADMIN = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

const yearParam = z.object({ year: z.coerce.number().int().min(2024).max(2100) });
const ymParam = z.object({
  year: z.coerce.number().int().min(2024).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const upsertBody = z.object({
  imageUrl: z.string().min(1).max(500),
  caption: z.string().max(80).nullable().optional(),
});

export const postersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/posters/current', {
    schema: { tags: TAGS, summary: '当前月画报', security: SEC },
  }, async () => {
    const data = await getCurrentPoster(prisma);
    return { data };
  });

  app.get('/api/admin/posters/:year', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS_ADMIN, summary: '某年 12 月画报列表（admin）', security: SEC },
  }, async (req) => {
    const pp = yearParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const data = await listYearPosters(prisma, pp.data.year);
    return { data };
  });

  app.put('/api/admin/posters/:year/:month', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS_ADMIN, summary: 'upsert 某月画报（admin）', security: SEC },
  }, async (req) => {
    const pp = ymParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = upsertBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await upsertPoster(prisma, pp.data.year, pp.data.month, body.data.imageUrl, body.data.caption ?? null);
    return { data };
  });

  app.delete('/api/admin/posters/:year/:month', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS_ADMIN, summary: '删除某月画报（admin）', security: SEC },
  }, async (req) => {
    const pp = ymParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    await deletePoster(prisma, pp.data.year, pp.data.month);
    return { data: { ok: true } };
  });

  app.post('/api/admin/posters/upload-image', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS_ADMIN, summary: '画报图上传（multipart · 返回 URL）', security: SEC, consumes: ['multipart/form-data'] },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req) => {
    const file = await req.file();
    if (!file) throw BadRequest('未收到文件');
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) chunks.push(chunk as Buffer);
    if (file.file.truncated) throw BadRequest('图片超过 8MB');
    const buf = Buffer.concat(chunks);
    const url = await uploadPosterImage(buf, file.mimetype, buf.length);
    return { data: { url } };
  });
};
