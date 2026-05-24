// 全文搜索 · 跨 Course / Lesson / Question
//   GET /api/search?q=&kind=&limit=
//
// 鉴权可选（题目搜索按 viewer cohort + visibility=public 过滤）
// 未登录可搜公开法本/课时/主线公开题
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { searchAll } from '../../lib/search.js';

const TAGS = ['search'];
const SEC = [{ bearerAuth: [] }];

const searchQuery = z.object({
  q: z.string().trim().min(1).max(120),
  kind: z.enum(['all', 'course', 'lesson', 'question']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/search',
    {
      schema: {
        tags: TAGS,
        summary: '全文搜索 · 跨 course/lesson/question · ILIKE + 评分',
        security: SEC,
      },
    },
    async (req) => {
      const parsed = searchQuery.safeParse(req.query);
      if (!parsed.success) throw BadRequest('查询参数不合法');

      const viewerUserId = getUserId(req);
      const r = await searchAll({
        q: parsed.data.q,
        kind: parsed.data.kind,
        limit: parsed.data.limit,
        viewerUserId,
      });
      return { data: r };
    },
  );
};
