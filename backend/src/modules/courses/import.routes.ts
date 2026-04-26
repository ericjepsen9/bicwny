// Admin 法本导入路由 · F2.2 + F3.1
//
//   POST /api/admin/courses/import-file/preview   (multipart) → 预览结构 · F2
//   POST /api/admin/courses/import-url/preview    (JSON)      → 预览结构 · F3
//   POST /api/admin/courses/import-file/commit    (JSON)      → 写入数据库
//
// 前端流程：
//   1. (F2) 选 PDF/DOCX 上传 / (F3) 输 URL → preview 拿章节树
//   2. admin 在前端编辑（改章名/课时名/挪动/删除）
//   3. POST commit { mode: 'new' | 'append', ..., chapters }
//
// 全部 admin guard

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  buildPreviewFromBuffer,
  buildPreviewFromUrl,
  commitImport,
} from './import.service.js';

const adminGuard = requireRole('admin');

const previewLessonSchema: z.ZodType<{ title: string; referenceText?: string; teachingSummary?: string }> = z.object({
  title: z.string().trim().min(1).max(200),
  referenceText: z.string().max(200000).optional(),
  teachingSummary: z.string().max(50000).optional(),
});
const previewChapterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  lessons: z.array(previewLessonSchema).min(1).max(500),
});
const newCourseSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/i),
  title: z.string().min(1).max(120),
  titleTraditional: z.string().max(120).optional(),
  author: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  coverEmoji: z.string().max(8).optional(),
  isPublished: z.boolean().optional(),
});
const commitBody = z.object({
  mode: z.enum(['new', 'append']),
  courseId: z.string().min(1).optional(),
  newCourse: newCourseSchema.optional(),
  chapters: z.array(previewChapterSchema).min(1).max(200),
  // 幂等键：前端开预览模态时生成 uuid · 重复 commit 直接返回上次结果
  clientToken: z.string().min(8).max(64).optional(),
});

const urlPreviewBody = z.object({
  url: z.string().url().max(2000),
});

const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

export const adminCoursesImportRoutes: FastifyPluginAsync = async (app) => {
  // ── 第一步：上传文件 → 解析 → 返回预览结构（不写库）──
  app.post('/api/admin/courses/import-file/preview', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '导入法本 · 上传 PDF/DOCX → 预览章节树（不写库）', security: SEC, consumes: ['multipart/form-data'] },
  }, async (req) => {
    // require @fastify/multipart 已在 app.ts 注册
    const file = await req.file();
    if (!file) throw BadRequest('未收到文件');
    const filename = file.filename || 'unknown';
    const lower = filename.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      throw BadRequest('仅支持 .pdf / .docx');
    }
    // 读完整 buffer · 注意 fastify-multipart 的 file.file 是 stream
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) chunks.push(chunk as Buffer);
    if (file.file.truncated) {
      throw BadRequest('文件超过 20 MB 上限');
    }
    const buf = Buffer.concat(chunks);
    const preview = await buildPreviewFromBuffer(filename, buf);
    return { data: preview };
  });

  // ── F3.1 · 网页抓取 → 预览（与 import-file 同 commit 端点）──
  app.post('/api/admin/courses/import-url/preview', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '导入法本 · 抓取 URL → 预览章节树（不写库）', security: SEC },
  }, async (req) => {
    const parsed = urlPreviewBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const preview = await buildPreviewFromUrl(parsed.data.url);
    return { data: preview };
  });

  // ── 第二步：admin 确认编辑后的预览 → 写入数据库 ──
  app.post('/api/admin/courses/import-file/commit', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '导入法本 · 提交编辑后的预览 → 写入 chapters / lessons + AuditLog', security: SEC },
  }, async (req, reply) => {
    const parsed = commitBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const adminId = requireUserId(req);
    const result = await commitImport(adminId, parsed.data);
    reply.code(201);
    return { data: result };
  });
};
