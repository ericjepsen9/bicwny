// 观修学员 routes
//
//   GET  /api/lessons/:id/meditation                         本课观修（如有）
//   GET  /api/courses/:id/meditations                        法本所有观修（目录页批量用）
//   GET  /api/meditations/:id                                观修详情 + 我的进度
//   POST /api/meditations/:id/sessions                       开始 session
//   PATCH /api/meditations/:id/sessions/:sid                 上报进度（每 10s）
//   POST /api/meditations/:id/complete                       手动标完成

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  getCourseMeditations,
  getLessonMeditation,
  getMeditationDetail,
  manualComplete,
  startSession,
  updateSessionProgress,
} from './student.service.js';

const TAGS = ['Meditation'];
const SEC = [{ bearerAuth: [] as string[] }];

const lessonIdParam = z.object({ id: z.string().min(1) });
const medIdParam = z.object({ id: z.string().min(1) });
const sessionParams = z.object({
  id: z.string().min(1),    // meditation id
  sid: z.string().min(1),   // session id
});
const progressBody = z.object({
  videoWatchedSec: z.number().int().nonnegative(),
});

export const studentMeditationRoutes: FastifyPluginAsync = async (app) => {
  // ── GET 本课观修 ──────────────────────────────────
  app.get('/api/lessons/:id/meditation', {
    schema: { tags: TAGS, summary: '获取本课关联的观修（如无返回 null）', security: SEC },
  }, async (req) => {
    const pp = lessonIdParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    requireUserId(req);
    const data = await getLessonMeditation(pp.data.id);
    return { data };
  });

  // ── GET 法本下所有观修（目录页批量用）────────────────────
  app.get('/api/courses/:id/meditations', {
    schema: { tags: TAGS, summary: '某法本下所有已发布观修', security: SEC },
  }, async (req) => {
    const pp = lessonIdParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    requireUserId(req);
    const data = await getCourseMeditations(pp.data.id);
    return { data };
  });

  // ── GET 观修详情 ─────────────────────────────────
  app.get('/api/meditations/:id', {
    schema: { tags: TAGS, summary: '观修详情 + 我的进度', security: SEC },
  }, async (req) => {
    const pp = medIdParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const userId = requireUserId(req);
    const data = await getMeditationDetail(userId, pp.data.id);
    return { data };
  });

  // ── POST 开始 session ───────────────────────────
  app.post('/api/meditations/:id/sessions', {
    schema: { tags: TAGS, summary: '开始一次播放 session', security: SEC },
  }, async (req, reply) => {
    const pp = medIdParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const userId = requireUserId(req);
    const data = await startSession(userId, pp.data.id);
    reply.code(201);
    return { data };
  });

  // ── PATCH 上报进度 ──────────────────────────────
  app.patch('/api/meditations/:id/sessions/:sid', {
    schema: { tags: TAGS, summary: '上报视频进度（每 10s）', security: SEC },
  }, async (req) => {
    const pp = sessionParams.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const pb = progressBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('参数不合法', pb.error.flatten());
    const userId = requireUserId(req);
    const data = await updateSessionProgress(
      userId, pp.data.id, pp.data.sid, pb.data.videoWatchedSec,
    );
    return { data };
  });

  // ── POST 手动标完成 ─────────────────────────────
  app.post('/api/meditations/:id/complete', {
    schema: { tags: TAGS, summary: '手动标完成（兜底 · 不依赖 80%）', security: SEC },
  }, async (req) => {
    const pp = medIdParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('参数不合法');
    const userId = requireUserId(req);
    const data = await manualComplete(userId, pp.data.id);
    return { data };
  });
};
