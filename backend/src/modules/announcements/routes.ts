// 班级公告 routes
//   coach:
//     GET    /api/coach/classes/:id/announcements       列班级公告（含归档）
//     POST   /api/coach/classes/:id/announcements       发新公告（自动通知成员）
//     PATCH  /api/coach/announcements/:aid              改 / 归档（仅自己发的 · admin 超权）
//     POST   /api/coach/announcements/upload-image      multipart 单图 → URL
//   student:
//     GET    /api/classes/:id/announcements             学员视角 · 仅 active
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, Forbidden } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  createAnnouncement,
  getAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  uploadImage,
} from './service.js';

const TAGS_COACH = ['Coach'];
const TAGS_STUDENT = ['Class'];
const SEC = [{ bearerAuth: [] as string[] }];

const idParam = z.object({ id: z.string().min(1) });
const aidParam = z.object({ aid: z.string().min(1) });

// 图片 URL 只接受本服务上传 endpoint 产出的相对路径 · 防 javascript:/data:/站外注入
const imageUrl = z.string().regex(/^\/uploads\/announcements\//, '非法图片地址');

const createBody = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().max(5000),
  imageUrls: z.array(imageUrl).max(6).optional(),
  pinned: z.boolean().optional(),
});

const updateBody = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  body: z.string().max(5000).optional(),
  imageUrls: z.array(imageUrl).max(6).nullable().optional(),
  pinned: z.boolean().optional(),
  archive: z.boolean().optional(),
});

async function assertClassCoach(classId: string, userId: string, role: string) {
  if (role === 'admin') return;
  const m = await prisma.classMember.findFirst({
    where: { classId, userId, role: 'coach', removedAt: null },
  });
  if (!m) throw Forbidden('非该班 coach');
}

async function assertClassMember(classId: string, userId: string) {
  const m = await prisma.classMember.findFirst({
    where: { classId, userId, removedAt: null },
  });
  if (!m) throw Forbidden('非该班成员');
}

export const announcementCoachRoutes: FastifyPluginAsync = async (app) => {
  const coachGuard = requireRole('coach', 'admin');

  app.get('/api/coach/classes/:id/announcements', {
    preHandler: coachGuard,
    schema: { tags: TAGS_COACH, summary: '班级公告列表（教师 / admin 视角）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    await assertClassCoach(pp.data.id, requireUserId(req), getUserRole(req) ?? '');
    const data = await listAnnouncements(pp.data.id, { includeArchived: true });
    return { data };
  });

  app.post('/api/coach/classes/:id/announcements', {
    preHandler: coachGuard,
    schema: { tags: TAGS_COACH, summary: '发新公告（自动通知班级成员）', security: SEC },
  }, async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = createBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const userId = requireUserId(req);
    await assertClassCoach(pp.data.id, userId, getUserRole(req) ?? '');
    const data = await createAnnouncement({
      classId: pp.data.id,
      authorId: userId,
      title: body.data.title,
      body: body.data.body,
      imageUrls: body.data.imageUrls,
      pinned: body.data.pinned,
    });
    reply.code(201);
    return { data };
  });

  app.patch('/api/coach/announcements/:aid', {
    preHandler: coachGuard,
    schema: { tags: TAGS_COACH, summary: '改 / 归档公告（coach 仅自己 · admin 超权）', security: SEC },
  }, async (req) => {
    const pp = aidParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = updateBody.safeParse(req.body);
    if (!body.success) throw BadRequest('请求参数不合法', body.error.flatten());
    const role = getUserRole(req) === 'admin' ? 'admin' : 'coach';
    const data = await updateAnnouncement(pp.data.aid, requireUserId(req), role, body.data);
    return { data };
  });

  // 图片上传 · 单图 · 返回 URL · 前端记录 URL · commit 时一并 POST 公告
  app.post('/api/coach/announcements/upload-image', {
    preHandler: coachGuard,
    schema: { tags: TAGS_COACH, summary: '上传公告图（multipart · 返回 URL）', security: SEC, consumes: ['multipart/form-data'] },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req) => {
    const file = await req.file();
    if (!file) throw BadRequest('未收到文件');
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) chunks.push(chunk as Buffer);
    if (file.file.truncated) throw BadRequest('图片超过限制');
    const buf = Buffer.concat(chunks);
    const url = await uploadImage(buf, file.mimetype, buf.length);
    return { data: { url } };
  });
};

export const announcementStudentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/classes/:id/announcements', {
    schema: { tags: TAGS_STUDENT, summary: '学员视角 · 班级公告列表（active）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const userId = requireUserId(req);
    await assertClassMember(pp.data.id, userId);
    const data = await listAnnouncements(pp.data.id, { includeArchived: false });
    return { data };
  });

  app.get('/api/announcements/:aid', {
    schema: { tags: TAGS_STUDENT, summary: '单条公告详情（学员需是该班成员）', security: SEC },
  }, async (req) => {
    const pp = aidParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const ann = await getAnnouncement(pp.data.aid);
    await assertClassMember(ann.classId, requireUserId(req));
    return { data: ann };
  });
};
