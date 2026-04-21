// 学员学习路径路由（组装 A.1–A.4 的 services）
//   GET   /api/courses                         公开：论典列表
//   GET   /api/courses/:slug                   可选登录：详情 + 进度叠加
//   GET   /api/lessons/:id/questions           可选登录：按 lesson 列题（剥答案）
//   GET   /api/my/enrollments                  我的报名
//   POST  /api/enrollments                     报名 { courseId }
//   DELETE /api/enrollments/:courseId          退课
//   PATCH /api/enrollments/:courseId/progress  更新进度
//   GET   /api/my/progress                     个人学习进度聚合
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserId, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { toPublicView } from '../answering/publicView.js';
import { myProgress } from '../answering/progress.service.js';
import {
  getCourseBySlug,
  getCourseEnrollmentOverlay,
  listPublishedCourses,
} from '../courses/service.js';
import {
  drop,
  enroll,
  listMyEnrollments,
  updateProgress,
} from '../enrollment/service.js';
import { listLessonQuestions } from '../questions/list.service.js';

const slugParam = z.object({ slug: z.string().min(1) });
const lessonIdParam = z.object({ id: z.string().min(1) });
const courseIdParam = z.object({ courseId: z.string().min(1) });
const lessonQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
const enrollBody = z.object({ courseId: z.string().min(1) });
const progressBody = z.object({
  currentLessonId: z.string().nullable().optional(),
  addCompletedLessonId: z.string().optional(),
});

export const learningRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/courses', async () => {
    const items = await listPublishedCourses();
    return { data: items };
  });

  app.get('/api/courses/:slug', async (req) => {
    const parsed = slugParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    const course = await getCourseBySlug(parsed.data.slug);
    const userId = getUserId(req);
    const overlay = userId
      ? await getCourseEnrollmentOverlay(userId, course.id)
      : null;
    return { data: { course, overlay } };
  });

  app.get('/api/lessons/:id/questions', async (req) => {
    const pp = lessonIdParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const pq = lessonQuery.safeParse(req.query);
    if (!pq.success) throw BadRequest('查询参数不合法');
    const userId = getUserId(req);
    const items = await listLessonQuestions(pp.data.id, userId, {
      limit: pq.data.limit,
    });
    return { data: items.map(toPublicView) };
  });

  app.get('/api/my/enrollments', async (req) => {
    const userId = requireUserId(req);
    return { data: await listMyEnrollments(userId) };
  });

  app.post('/api/enrollments', async (req, reply) => {
    const userId = requireUserId(req);
    const parsed = enrollBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const e = await enroll(userId, parsed.data.courseId);
    reply.code(201);
    return { data: e };
  });

  app.delete('/api/enrollments/:courseId', async (req) => {
    const userId = requireUserId(req);
    const parsed = courseIdParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    await drop(userId, parsed.data.courseId);
    return { data: { ok: true } };
  });

  app.patch('/api/enrollments/:courseId/progress', async (req) => {
    const userId = requireUserId(req);
    const pp = courseIdParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const pb = progressBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
    const updated = await updateProgress(userId, pp.data.courseId, pb.data);
    return { data: updated };
  });

  app.get('/api/my/progress', async (req) => {
    const userId = requireUserId(req);
    return { data: await myProgress(userId) };
  });
};
