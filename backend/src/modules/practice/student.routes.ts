// 修学计数 · 学员路由
//   GET    /api/practice/categories                     大类
//   GET    /api/practice/projects                       我可见的子项（三来源合并）
//   POST   /api/practice/projects                       自建子项
//   PATCH  /api/practice/projects/:id                   改名 / emoji
//   DELETE /api/practice/projects/:id                   归档（仅自建）
//   POST   /api/practice/entries                        上报 entry 批次
//   GET    /api/practice/makeup                         补签配额状态
//   POST   /api/practice/makeup                         补签某一天（保连续 · 每周 1 次）
//   GET    /api/practice/summary                        当日总览 + streak
//   GET    /api/practice/history                        历史聚合
//   GET    /api/practice/goals                          目标列表
//   PUT    /api/practice/goals                          upsert 目标
//   DELETE /api/practice/goals/:id                      取消目标
//   GET    /api/practice/tasks                          任务列表（self + class）
//   POST   /api/practice/tasks                          创建 self 任务
//   DELETE /api/practice/tasks/:id                      归档 self 任务
//   PATCH  /api/practice/me                             隐私 toggle
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  archiveSelfTask,
  archiveUserProject,
  createSelfTask,
  createUserProject,
  deleteGoal,
  getHistory,
  getSummary,
  listCategories,
  listGoals,
  listProjects,
  listTasks,
  setVisibility,
  submitEntries,
  updateUserProject,
  upsertGoal,
} from './student.service.js';
import { createMakeup, getMakeupStatus } from './makeup.js';

const TAGS = ['Practice'];
const SEC = [{ bearerAuth: [] as string[] }];

const idParam = z.object({ id: z.string().min(1) });

const projectCreateBody = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().max(8).optional(),
});
const projectPatchBody = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  emoji: z.string().max(8).nullable().optional(),
});

const entriesBody = z.object({
  items: z.array(z.object({
    projectId: z.string().min(1),
    count: z.number().int().min(1).max(10000),
    source: z.string().max(20).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    note: z.string().max(50).optional(),
  })).min(1).max(200),
});

const makeupBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const goalUpsertBody = z.object({
  projectId: z.string().min(1),
  dailyTarget: z.number().int().min(0).max(1_000_000),
});

const taskCreateBody = z.object({
  projectId: z.string().min(1),
  mode: z.enum(['daily', 'fixed']),
  target: z.number().int().min(1).max(10_000_000),
  startAt: z.string().datetime().or(z.date()).transform((v) => new Date(v)),
  endAt: z.string().datetime().or(z.date()).nullable().optional().transform((v) => v ? new Date(v) : null),
  title: z.string().max(120).optional(),
});

const visibilityBody = z.object({
  practiceVisibleToClass: z.boolean(),
});

export const practiceStudentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/practice/categories', {
    schema: { tags: TAGS, summary: '修学大类（5 个固定）', security: SEC },
  }, async () => {
    const data = await listCategories(prisma);
    return { data };
  });

  app.get('/api/practice/projects', {
    schema: { tags: TAGS, summary: '我可见的子项（平台预置 + 我所在班 + 我自建）', security: SEC },
  }, async (req) => {
    const data = await listProjects(prisma, requireUserId(req));
    return { data };
  });

  app.post('/api/practice/projects', {
    schema: { tags: TAGS, summary: '自建子项', security: SEC },
  }, async (req, reply) => {
    const body = projectCreateBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await createUserProject(prisma, requireUserId(req), body.data);
    reply.code(201);
    return { data };
  });

  app.patch('/api/practice/projects/:id', {
    schema: { tags: TAGS, summary: '改子项名 / emoji（仅自建）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const pb = projectPatchBody.safeParse(req.body);
    if (!pb.success) throw BadRequest('请求参数不合法');
    const data = await updateUserProject(prisma, requireUserId(req), pp.data.id, pb.data);
    return { data };
  });

  app.delete('/api/practice/projects/:id', {
    schema: { tags: TAGS, summary: '归档自建子项', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const data = await archiveUserProject(prisma, requireUserId(req), pp.data.id);
    return { data };
  });

  app.post('/api/practice/entries', {
    schema: { tags: TAGS, summary: '上报 entry 批次（30s batching）', security: SEC },
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req) => {
    const body = entriesBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await submitEntries(prisma, requireUserId(req), body.data.items);
    return { data };
  });

  app.get('/api/practice/makeup', {
    schema: { tags: TAGS, summary: '补签配额状态（本周剩余 + 可补窗口）', security: SEC },
  }, async (req) => {
    const data = await getMakeupStatus(prisma, requireUserId(req));
    return { data };
  });

  app.post('/api/practice/makeup', {
    schema: { tags: TAGS, summary: '补签某一天（保连续 · 每周 1 次 · 仅近 7 天）', security: SEC },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req) => {
    const body = makeupBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await createMakeup(prisma, requireUserId(req), body.data.date);
    return { data };
  });

  app.get('/api/practice/summary', {
    schema: { tags: TAGS, summary: '当日总览 + streak', security: SEC },
  }, async (req) => {
    const data = await getSummary(prisma, requireUserId(req));
    return { data };
  });

  app.get('/api/practice/history', {
    schema: { tags: TAGS, summary: '历史聚合（30 天 series + 项目汇总）', security: SEC },
  }, async (req) => {
    const q = z.object({ projectId: z.string().optional() }).safeParse(req.query);
    if (!q.success) throw BadRequest('查询参数不合法');
    const data = await getHistory(prisma, requireUserId(req), q.data);
    return { data };
  });

  app.get('/api/practice/goals', {
    schema: { tags: TAGS, summary: '我的目标列表', security: SEC },
  }, async (req) => {
    const data = await listGoals(prisma, requireUserId(req));
    return { data };
  });

  app.put('/api/practice/goals', {
    schema: { tags: TAGS, summary: 'upsert 每日目标', security: SEC },
  }, async (req) => {
    const body = goalUpsertBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法');
    const data = await upsertGoal(prisma, requireUserId(req), body.data);
    return { data };
  });

  app.delete('/api/practice/goals/:id', {
    schema: { tags: TAGS, summary: '取消目标', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const data = await deleteGoal(prisma, requireUserId(req), pp.data.id);
    return { data };
  });

  app.get('/api/practice/tasks', {
    schema: { tags: TAGS, summary: '任务列表（self + 我所在班 active class）', security: SEC },
  }, async (req) => {
    const data = await listTasks(prisma, requireUserId(req));
    return { data };
  });

  app.post('/api/practice/tasks', {
    schema: { tags: TAGS, summary: '创建 self 任务', security: SEC },
  }, async (req, reply) => {
    const body = taskCreateBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await createSelfTask(prisma, requireUserId(req), body.data);
    reply.code(201);
    return { data };
  });

  app.delete('/api/practice/tasks/:id', {
    schema: { tags: TAGS, summary: '归档 self 任务', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const data = await archiveSelfTask(prisma, requireUserId(req), pp.data.id);
    return { data };
  });

  app.patch('/api/practice/me', {
    schema: { tags: TAGS, summary: '修学计数对班级可见 toggle', security: SEC },
  }, async (req) => {
    const body = visibilityBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法');
    const data = await setVisibility(prisma, requireUserId(req), body.data.practiceVisibleToClass);
    return { data };
  });
};
