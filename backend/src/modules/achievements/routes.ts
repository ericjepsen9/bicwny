// 成就徽章 HTTP 路由（任意已登录用户）
//   GET /api/achievements   获取本人徽章墙（无副作用 · 每次从答题数据派生）
import type { FastifyPluginAsync } from 'fastify';
import { requireUserId } from '../../lib/auth.js';
import { getAchievements } from './service.js';

const TAGS = ['Achievements'];
const SEC = [{ bearerAuth: [] as string[] }];

export const achievementsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/achievements', {
    schema: { tags: TAGS, summary: '本人成就徽章墙（从答题/SM-2/streak 派生）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const r = await getAchievements(userId);
    return { data: r };
  });
};
