// 法本阅读 routes
//   PATCH /api/me/lessons/:id/reading-progress  心跳上报（10s/次）
//   GET   /api/me/reading-stats                 我的阅读统计（学修统计页 + ProfilePage 用）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getMyReadingStats, reportReadingProgress } from './service.js';

const TAGS = ['Reading'];
const SEC = [{ bearerAuth: [] as string[] }];

const idParam = z.object({ id: z.string().min(1) });

const reportBody = z.object({
  scrollPercent: z.number().int().min(0).max(100),
  secondsDelta: z.number().int().min(0).max(60),
});

export const readingRoutes: FastifyPluginAsync = async (app) => {
  app.patch('/api/me/lessons/:id/reading-progress', {
    schema: { tags: TAGS, summary: '心跳上报阅读进度（10s/次 · 满足条件自动标已读）', security: SEC },
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = reportBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await reportReadingProgress(prisma, requireUserId(req), pp.data.id, body.data);
    return { data };
  });

  app.get('/api/me/reading-stats', {
    schema: { tags: TAGS, summary: '我的阅读统计（按课程聚合 + 最近 10 课时）', security: SEC },
  }, async (req) => {
    const data = await getMyReadingStats(prisma, requireUserId(req));
    return { data };
  });
};
