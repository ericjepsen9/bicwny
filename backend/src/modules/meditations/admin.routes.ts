// 观修内容 admin routes（coach + admin · 观修为平台全局内容 · 见下方 adminGuard 注释 · 审计 S4 确认有意）
//
//   GET    /api/admin/meditations
//   GET    /api/admin/meditations/:id
//   POST   /api/admin/meditations               { title, lessonId?, ... }
//   PATCH  /api/admin/meditations/:id           更新元数据
//   DELETE /api/admin/meditations/:id           归档
//
//   POST   /api/admin/meditations/:id/upload-video    multipart · field 'file'
//   POST   /api/admin/meditations/:id/upload-slides   multipart · field 'file'
//   DELETE /api/admin/meditations/:id/slides          删除 PDF（保留视频）
//
// 上传视频限 500 MB · 在 route 层 override @fastify/multipart 全局 20 MB 限制

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  archiveMeditation,
  createMeditation,
  getMeditation,
  listMeditations,
  removeSlides,
  updateMeditation,
  uploadSlides,
  uploadVideo,
} from './admin.service.js';

// coach 也能管观修 · 可创建 / 上传 / 编辑 · 不限制 owner（小平台 · 所有
// coach 都是 vetted · 后续要按班级隔离再加 ownerClassId 字段）
const adminGuard = requireRole('coach', 'admin');
const TAGS = ['Admin · Meditation'];
const SEC = [{ bearerAuth: [] as string[] }];

const idParam = z.object({ id: z.string().min(1) });
const listQuery = z.object({
  courseId: z.string().min(1).optional(),
  lessonId: z.string().min(1).optional(),
  includeArchived: z.coerce.boolean().optional(),
});
const createBody = z.object({
  lessonId: z.string().min(1).nullable().optional(),
  courseId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(200),
  titleTraditional: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  authorName: z.string().max(200).nullable().optional(),
  isPublished: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});
const updateBody = createBody.partial();

// 视频限 500 MB · PDF 限 30 MB · 复用同一 multipart 实例 · 取大值
const VIDEO_FILE_SIZE = 500 * 1024 * 1024;
const PDF_FILE_SIZE = 30 * 1024 * 1024;

export const adminMeditationsRoutes: FastifyPluginAsync = async (app) => {
  // ── GET list ─────────────────────────────────────────
  app.get('/api/admin/meditations', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '观修内容列表', security: SEC },
  }, async (req) => {
    const pq = listQuery.safeParse(req.query);
    if (!pq.success) throw BadRequest('参数不合法');
    const data = await listMeditations(pq.data);
    return { data };
  });

  // ── GET detail ───────────────────────────────────────
  app.get('/api/admin/meditations/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '观修详情', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const data = await getMeditation(pp.data.id);
    return { data };
  });

  // ── POST create ─────────────────────────────────────
  app.post('/api/admin/meditations', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '新建观修（仅元数据）', security: SEC },
  }, async (req, reply) => {
    const pb = createBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('参数不合法', pb.error.flatten());
    const adminId = requireUserId(req);
    const data = await createMeditation(adminId, pb.data);
    reply.code(201);
    return { data };
  });

  // ── PATCH update ────────────────────────────────────
  app.patch('/api/admin/meditations/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '更新观修', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const pb = updateBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('参数不合法', pb.error.flatten());
    const adminId = requireUserId(req);
    const data = await updateMeditation(adminId, pp.data.id, pb.data);
    return { data };
  });

  // ── DELETE archive ──────────────────────────────────
  app.delete('/api/admin/meditations/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '归档观修', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const adminId = requireUserId(req);
    await archiveMeditation(adminId, pp.data.id);
    return { data: { ok: true } };
  });

  // ── POST upload video ───────────────────────────────
  app.post('/api/admin/meditations/:id/upload-video', {
    preHandler: adminGuard,
    schema: {
      tags: TAGS,
      summary: '上传观修视频（mp4 · ≤ 500 MB · multipart field "file"）',
      security: SEC,
      consumes: ['multipart/form-data'],
    },
    config: { rateLimit: false },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');

    const file = await req.file({
      limits: { fileSize: VIDEO_FILE_SIZE, files: 1 },
    });
    if (!file) throw BadRequest('未收到文件');

    const adminId = requireUserId(req);
    const result = await uploadVideo(adminId, pp.data.id, file.file, file.filename);

    if (file.file.truncated) {
      throw BadRequest('视频超过 500 MB 上限');
    }

    return { data: result };
  });

  // ── POST upload slides ──────────────────────────────
  app.post('/api/admin/meditations/:id/upload-slides', {
    preHandler: adminGuard,
    schema: {
      tags: TAGS,
      summary: '上传观修 PDF（≤ 30 MB · multipart field "file"）',
      security: SEC,
      consumes: ['multipart/form-data'],
    },
    config: { rateLimit: false },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');

    const file = await req.file({
      limits: { fileSize: PDF_FILE_SIZE, files: 1 },
    });
    if (!file) throw BadRequest('未收到文件');

    const adminId = requireUserId(req);
    const result = await uploadSlides(adminId, pp.data.id, file.file, file.filename);

    if (file.file.truncated) {
      throw BadRequest('PDF 超过 30 MB 上限');
    }

    return { data: result };
  });

  // ── DELETE slides ───────────────────────────────────
  app.delete('/api/admin/meditations/:id/slides', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '删除观修 PDF（保留视频）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const adminId = requireUserId(req);
    await removeSlides(adminId, pp.data.id);
    return { data: { ok: true } };
  });
};
