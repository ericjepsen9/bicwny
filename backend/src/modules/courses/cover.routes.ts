// 法本封面图路由（admin only）
//   POST   /api/admin/courses/:id/cover  multipart/form-data 字段名 'file'
//   DELETE /api/admin/courses/:id/cover
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { removeCourseCover, uploadCourseCover } from './cover.service.js';

const adminGuard = requireRole('admin');
const idParam = z.object({ id: z.string().min(1) });
const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

export const adminCoursesCoverRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/admin/courses/:id/cover', {
    preHandler: adminGuard,
    schema: {
      tags: TAGS,
      summary: '上传法本封面图（multipart · jpeg/png/webp · ≤ 2 MB）',
      security: SEC,
      consumes: ['multipart/form-data'],
    },
    config: { rateLimit: false },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');

    const file = await req.file();
    if (!file) throw BadRequest('未收到文件');

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) chunks.push(chunk as Buffer);
    if (file.file.truncated) {
      throw BadRequest('图片超过 multipart 上限（应在路由层 < 2 MB 校验前已挡）');
    }
    const buf = Buffer.concat(chunks);

    const adminId = requireUserId(req);
    const result = await uploadCourseCover(adminId, pp.data.id, {
      mimetype: file.mimetype,
      buffer: buf,
    });
    return { data: result };
  });

  app.delete('/api/admin/courses/:id/cover', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '移除法本封面图（回落到 coverEmoji）', security: SEC },
    config: { rateLimit: false },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const adminId = requireUserId(req);
    await removeCourseCover(adminId, pp.data.id);
    return { data: { ok: true } };
  });
};
