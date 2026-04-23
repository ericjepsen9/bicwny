// Coach 题库路由
//   POST   /api/coach/questions         创建题目（class_private 立即生效 / public 待审）
//   GET    /api/coach/questions         自己创建的题目（?classId 过滤）
//   GET    /api/coach/questions/:id     详情（仅自己创建的；admin 超权）
//   PATCH  /api/coach/questions/:id     编辑（已 approved 的 public 题禁改）
//   DELETE /api/coach/questions/:id     删除（已 approved 的 public 题禁删；有答题记录禁删）
//   POST   /api/coach/questions/batch   批量导入
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { batchCreateQuestions } from './batch.service.js';
import { createQuestion, listCoachQuestions } from './create.service.js';
import { deleteQuestion } from './delete.service.js';
import { generateQuestions } from './generate.service.js';
import { updateQuestion } from './update.service.js';

const coachGuard = requireRole('coach', 'admin');

const questionTypeEnum = z.enum([
  'single', 'fill', 'multi', 'open', 'sort', 'match',
  // v2.0：前端尚未上线，后端允许创建
  'flip', 'image', 'listen', 'flow', 'guided', 'scenario',
]);

const createBody = z.object({
  courseId: z.string().min(1),
  chapterId: z.string().min(1),
  lessonId: z.string().min(1),
  type: questionTypeEnum,
  visibility: z.enum(['class_private', 'public']),
  ownerClassId: z.string().optional(),
  questionText: z.string().min(1),
  correctText: z.string(),
  wrongText: z.string(),
  source: z.string(),
  difficulty: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
  payload: z.any(),
});

const updateBody = z
  .object({
    questionText: z.string().min(1).optional(),
    correctText: z.string().optional(),
    wrongText: z.string().optional(),
    source: z.string().optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    tags: z.array(z.string()).optional(),
    payload: z.any().optional(),
    type: questionTypeEnum.optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: 'patch 不能为空' });

const batchBody = z.object({
  partial: z.boolean().optional(),
  items: z.array(createBody).min(1).max(200),
});

const generateBody = z.object({
  courseId: z.string().min(1),
  chapterId: z.string().min(1),
  lessonId: z.string().min(1),
  passage: z.string().min(20),
  type: questionTypeEnum,
  count: z.number().int().min(1).max(20),
  difficulty: z.number().int().min(1).max(5).optional(),
  visibility: z.enum(['class_private', 'public']),
  ownerClassId: z.string().optional(),
  source: z.string().optional(),
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
      // Zod 推导 z.any() 为 optional，而 CreateQuestionInput.payload 必填，cast 对齐
      const q = await createQuestion(
        userId,
        role,
        parsed.data as Parameters<typeof createQuestion>[2],
      );
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

  app.patch(
    '/api/coach/questions/:id',
    { preHandler: coachGuard },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = updateBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const userId = requireUserId(req);
      const role = getUserRole(req) === 'admin' ? 'admin' : 'coach';
      const q = await updateQuestion(userId, role, pp.data.id, pb.data);
      return { data: q };
    },
  );

  app.delete(
    '/api/coach/questions/:id',
    { preHandler: coachGuard },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const userId = requireUserId(req);
      const role = getUserRole(req) === 'admin' ? 'admin' : 'coach';
      const r = await deleteQuestion(userId, role, pp.data.id);
      return { data: r };
    },
  );

  app.post(
    '/api/coach/questions/batch',
    { preHandler: coachGuard },
    async (req, reply) => {
      const parsed = batchBody.safeParse(req.body);
      if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
      const userId = requireUserId(req);
      const role = getUserRole(req) === 'admin' ? 'admin' : 'coach';
      const result = await batchCreateQuestions(
        userId,
        role,
        parsed.data.items as Parameters<typeof batchCreateQuestions>[2],
        { partial: parsed.data.partial },
      );
      reply.code(parsed.data.partial && result.failed > 0 ? 207 : 201);
      return { data: result };
    },
  );

  app.post(
    '/api/coach/questions/generate',
    { preHandler: coachGuard },
    async (req, reply) => {
      const parsed = generateBody.safeParse(req.body);
      if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
      const userId = requireUserId(req);
      const role = getUserRole(req) === 'admin' ? 'admin' : 'coach';
      const result = await generateQuestions(userId, role, parsed.data);
      reply.code(result.succeeded > 0 ? 201 : 200);
      return { data: result };
    },
  );
};
