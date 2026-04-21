// Coach 题库路由
//   POST /api/coach/questions         创建题目（class_private 立即生效 / public 待审）
//   GET  /api/coach/questions         自己创建的题目（?classId 过滤）
//   GET  /api/coach/questions/:id     详情（仅自己创建的；admin 超权）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { createQuestion, listCoachQuestions } from './create.service.js';

const coachGuard = requireRole('coach', 'admin');

const createBody = z.object({
  courseId: z.string().min(1),
  chapterId: z.string().min(1),
  lessonId: z.string().min(1),
  type: z.enum(['single', 'fill', 'multi', 'open', 'sort', 'match']),
  visibility: z.enum(['class_private', 'public']),
  ownerClassId: z.string().optional(),
  questionText: z.string().min(1),
  correctText: z.string(),
  wrongText: z.string(),
  source: z.string(),
  difficulty: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
  payload: z.unknown(),
});

const listQuery = z.object({
  classId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const idParam = z.object({ id: z.string().min(1) });

export const coachQuestionRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/coach/questions',
    { preHandler: coachGuard },
    async (req, reply) => {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
      const userId = requireUserId(req);
      const role = getUserRole(req) === 'admin' ? 'admin' : 'coach';
      const q = await createQuestion(userId, role, parsed.data);
      reply.code(201);
      return { data: q };
    },
  );

  app.get('/api/coach/questions', { preHandler: coachGuard }, async (req) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');
    const userId = requireUserId(req);
    const items = await listCoachQuestions(userId, parsed.data);
    return { data: items };
  });

  app.get(
    '/api/coach/questions/:id',
    { preHandler: coachGuard },
    async (req) => {
      const parsed = idParam.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      const q = await prisma.question.findUnique({
        where: { id: parsed.data.id },
      });
      if (!q) throw NotFound('题目不存在');

      if (getUserRole(req) !== 'admin' && q.createdByUserId !== requireUserId(req)) {
        throw Forbidden('非本人创建的题目');
      }
      return { data: q };
    },
  );
};
