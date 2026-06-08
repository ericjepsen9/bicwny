// 高亮 routes
//   GET    /api/lessons/:lessonId/highlights   我在该 lesson 的所有高亮
//   POST   /api/highlights                      新建高亮
//   DELETE /api/highlights/:id                  删除高亮
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { createHighlight, deleteHighlight, listHighlights } from './service.js';

const TAGS = ['Highlights'];
const SEC = [{ bearerAuth: [] as string[] }];

const colorEnum = z.enum(['yellow', 'green', 'blue', 'pink']);

const createBody = z.object({
  lessonId: z.string().min(1),
  paragraphIndex: z.number().int().min(0),
  textStart: z.number().int().min(0),
  textEnd: z.number().int().min(0),
  anchorText: z.string().min(1).max(200),
  color: colorEnum,
});

const lessonIdParam = z.object({ lessonId: z.string().min(1) });
const idParam = z.object({ id: z.string().min(1) });

export const highlightsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/lessons/:lessonId/highlights', {
    schema: { tags: TAGS, summary: '我在该 lesson 的高亮列表', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = lessonIdParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('参数不合法');
    return { data: await listHighlights(userId, parsed.data.lessonId) };
  });

  app.post('/api/highlights', {
    schema: { tags: TAGS, summary: '新建高亮', security: SEC },
  }, async (req, reply) => {
    const userId = requireUserId(req);
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    if (parsed.data.textEnd <= parsed.data.textStart) {
      throw BadRequest('textEnd 必须 > textStart');
    }
    const h = await createHighlight(userId, parsed.data);
    reply.code(201);
    return { data: h };
  });

  app.delete('/api/highlights/:id', {
    schema: { tags: TAGS, summary: '删除高亮', security: SEC },
  }, async (req, reply) => {
    const userId = requireUserId(req);
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('参数不合法');
    await deleteHighlight(userId, parsed.data.id);
    reply.code(204);
  });
};
