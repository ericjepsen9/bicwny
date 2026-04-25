// Admin 法本（论典 / 章 / 节）三级 CRUD 路由
//
//   GET    /api/admin/courses                              列出全部（含未发布、章节/课时计数）
//   GET    /api/admin/courses/:id                          法本详情（含章节 + 课时树）
//   POST   /api/admin/courses                              创建法本
//   PATCH  /api/admin/courses/:id                          编辑法本
//   DELETE /api/admin/courses/:id                          删除法本（无 Question/Enrollment 引用时）
//
//   POST   /api/admin/courses/:cid/chapters                在法本下加章
//   PATCH  /api/admin/chapters/:id                         编辑章
//   DELETE /api/admin/chapters/:id                         删除章
//
//   POST   /api/admin/chapters/:chid/lessons               在章下加课时
//   PATCH  /api/admin/lessons/:id                          编辑课时（含 referenceText / teachingSummary）
//   DELETE /api/admin/lessons/:id                          删除课时
//
// 全部 admin guard · AuditLog 已在 service 层写入。

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  createChapter,
  createCourse,
  createLesson,
  deleteChapter,
  deleteCourse,
  deleteLesson,
  getCourseTreeAdmin,
  listAllCoursesAdmin,
  updateChapter,
  updateCourse,
  updateLesson,
} from './admin.service.js';

const adminGuard = requireRole('admin');

const idParam   = z.object({ id: z.string().min(1) });
const cidParam  = z.object({ cid: z.string().min(1) });
const chidParam = z.object({ chid: z.string().min(1) });

const createCourseBody = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/i, 'slug 只能含字母 / 数字 / 连字符'),
  title: z.string().min(1).max(120),
  titleTraditional: z.string().max(120).optional(),
  author: z.string().max(120).optional(),
  authorInfo: z.string().max(2000).optional(),
  description: z.string().max(2000).optional(),
  coverEmoji: z.string().max(8).optional(),
  displayOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
  licenseInfo: z.string().max(500).optional(),
});
const updateCourseBody = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/i).optional(),
  title: z.string().min(1).max(120).optional(),
  titleTraditional: z.string().max(120).nullable().optional(),
  author: z.string().max(120).nullable().optional(),
  authorInfo: z.string().max(2000).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  coverEmoji: z.string().max(8).optional(),
  displayOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
  licenseInfo: z.string().max(500).nullable().optional(),
});

const createChapterBody = z.object({
  order: z.number().int().min(1).optional(),
  title: z.string().min(1).max(200),
  titleTraditional: z.string().max(200).optional(),
});
const updateChapterBody = z.object({
  order: z.number().int().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  titleTraditional: z.string().max(200).nullable().optional(),
});

const createLessonBody = z.object({
  order: z.number().int().min(1).optional(),
  title: z.string().min(1).max(200),
  titleTraditional: z.string().max(200).optional(),
  referenceText: z.string().max(200000).optional(),     // 原文 · 最多 20 万字
  teachingSummary: z.string().max(50000).optional(),    // 讲记摘要 · 5 万字
});
const updateLessonBody = z.object({
  order: z.number().int().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  titleTraditional: z.string().max(200).nullable().optional(),
  referenceText: z.string().max(200000).nullable().optional(),
  teachingSummary: z.string().max(50000).nullable().optional(),
});

const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

export const adminCoursesRoutes: FastifyPluginAsync = async (app) => {
  // ─── Course ───────────────────────────────────────────────
  app.get('/api/admin/courses', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '法本列表（含未发布 + 章/课时计数）', security: SEC },
  }, async () => ({ data: await listAllCoursesAdmin() }));

  app.get('/api/admin/courses/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '法本详情（含章节 + 课时树）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    return { data: await getCourseTreeAdmin(pp.data.id) };
  });

  app.post('/api/admin/courses', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '创建法本', security: SEC },
  }, async (req, reply) => {
    const pb = createCourseBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('参数不合法', pb.error.flatten());
    const adminId = requireUserId(req);
    const c = await createCourse(adminId, pb.data);
    reply.code(201);
    return { data: c };
  });

  app.patch('/api/admin/courses/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '编辑法本', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const pb = updateCourseBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('参数不合法', pb.error.flatten());
    const adminId = requireUserId(req);
    return { data: await updateCourse(adminId, pp.data.id, pb.data) };
  });

  app.delete('/api/admin/courses/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '删除法本（仅在无引用时）', security: SEC },
  }, async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const adminId = requireUserId(req);
    await deleteCourse(adminId, pp.data.id);
    reply.code(204);
    return null;
  });

  // ─── Chapter ──────────────────────────────────────────────
  app.post('/api/admin/courses/:cid/chapters', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '在法本下加章', security: SEC },
  }, async (req, reply) => {
    const pp = cidParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const pb = createChapterBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('参数不合法', pb.error.flatten());
    const adminId = requireUserId(req);
    const c = await createChapter(adminId, pp.data.cid, pb.data);
    reply.code(201);
    return { data: c };
  });

  app.patch('/api/admin/chapters/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '编辑章', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const pb = updateChapterBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('参数不合法', pb.error.flatten());
    const adminId = requireUserId(req);
    return { data: await updateChapter(adminId, pp.data.id, pb.data) };
  });

  app.delete('/api/admin/chapters/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '删除章（仅在无 Question 引用时）', security: SEC },
  }, async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const adminId = requireUserId(req);
    await deleteChapter(adminId, pp.data.id);
    reply.code(204);
    return null;
  });

  // ─── Lesson ───────────────────────────────────────────────
  app.post('/api/admin/chapters/:chid/lessons', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '在章下加课时（含原文 / 讲记摘要）', security: SEC },
  }, async (req, reply) => {
    const pp = chidParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const pb = createLessonBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('参数不合法', pb.error.flatten());
    const adminId = requireUserId(req);
    const l = await createLesson(adminId, pp.data.chid, pb.data);
    reply.code(201);
    return { data: l };
  });

  app.patch('/api/admin/lessons/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '编辑课时（标题 / 原文 / 讲记摘要）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const pb = updateLessonBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('参数不合法', pb.error.flatten());
    const adminId = requireUserId(req);
    return { data: await updateLesson(adminId, pp.data.id, pb.data) };
  });

  app.delete('/api/admin/lessons/:id', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '删除课时（仅在无 Question 引用时）', security: SEC },
  }, async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const adminId = requireUserId(req);
    await deleteLesson(adminId, pp.data.id);
    reply.code(204);
    return null;
  });
};
