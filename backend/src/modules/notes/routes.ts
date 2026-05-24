// 笔记 routes
//   GET    /api/notes                        我的笔记列表
//   GET    /api/notes/shared                 班级共享笔记列表
//   GET    /api/notes/:id                    详情（含权限校验）
//   POST   /api/notes                        新建
//   PATCH  /api/notes/:id                    编辑
//   DELETE /api/notes/:id                    删除
//   POST   /api/notes/llm-assist             LLM 5 个 action
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, Forbidden } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  actionNoteReport,
  createNote,
  deleteNote,
  getNote,
  listMyNotes,
  listNoteReports,
  listSharedNotes,
  reportNote,
  updateNote,
} from './service.js';
import { llmAssist } from './llm-assist.service.js';

const TAGS = ['Notes'];
const SEC = [{ bearerAuth: [] as string[] }];

const visibilityEnum = z.enum(['private', 'class']);

const createBody = z.object({
  lessonId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(80),
  body: z.string().max(10000),
  tags: z.array(z.string().max(20)).max(10).optional(),
  visibility: visibilityEnum.optional(),
  anchorText: z.string().max(80).nullable().optional(),
  anchorIndex: z.number().int().min(0).nullable().optional(),
});

const updateBody = z.object({
  title: z.string().min(1).max(80).optional(),
  body: z.string().max(10000).optional(),
  tags: z.array(z.string().max(20)).max(10).optional(),
  visibility: visibilityEnum.optional(),
  pinned: z.boolean().optional(),
  archive: z.boolean().optional(),
});

const llmBody = z.object({
  action: z.enum(['polish', 'summarize', 'tags', 'title', 'draft']),
  text: z.string().min(1).max(15000),
});

export const notesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/notes', {
    schema: { tags: TAGS, summary: '我的笔记列表', security: SEC },
  }, async (req) => {
    const q = z.object({
      lessonId: z.string().optional(),
      tag: z.string().optional(),
      q: z.string().optional(),
      archived: z.coerce.boolean().optional(),
    }).safeParse(req.query);
    if (!q.success) throw BadRequest('参数不合法');
    const data = await listMyNotes(prisma, requireUserId(req), {
      lessonId: q.data.lessonId,
      tag: q.data.tag,
      q: q.data.q,
      includeArchived: q.data.archived,
    });
    return { data };
  });

  app.get('/api/notes/shared', {
    schema: { tags: TAGS, summary: '班级共享笔记列表', security: SEC },
  }, async (req) => {
    const q = z.object({ q: z.string().optional() }).safeParse(req.query);
    if (!q.success) throw BadRequest('参数不合法');
    const data = await listSharedNotes(prisma, requireUserId(req), { q: q.data.q });
    return { data };
  });

  app.get('/api/notes/:id', {
    schema: { tags: TAGS, summary: '笔记详情', security: SEC },
  }, async (req) => {
    const pp = z.object({ id: z.string().min(1) }).safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const data = await getNote(prisma, requireUserId(req), pp.data.id);
    return { data };
  });

  app.post('/api/notes', {
    schema: { tags: TAGS, summary: '新建笔记', security: SEC },
  }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await createNote(prisma, requireUserId(req), body.data);
    reply.code(201);
    return { data };
  });

  app.patch('/api/notes/:id', {
    schema: { tags: TAGS, summary: '编辑笔记', security: SEC },
  }, async (req) => {
    const pp = z.object({ id: z.string().min(1) }).safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = updateBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await updateNote(prisma, requireUserId(req), pp.data.id, body.data);
    return { data };
  });

  app.delete('/api/notes/:id', {
    schema: { tags: TAGS, summary: '删除笔记', security: SEC },
  }, async (req) => {
    const pp = z.object({ id: z.string().min(1) }).safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    await deleteNote(prisma, requireUserId(req), pp.data.id);
    return { data: { ok: true } };
  });

  // ── 举报（UGC 审核闭环 · 审计 5.7）──
  // 注：/api/notes/reports 是静态路由 · Fastify 优先于 /api/notes/:id 匹配 · 不冲突

  app.post('/api/notes/:id/report', {
    schema: { tags: TAGS, summary: '举报同班共享笔记', security: SEC },
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req) => {
    const pp = z.object({ id: z.string().min(1) }).safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = z.object({ reason: z.string().max(200).optional() }).safeParse(req.body ?? {});
    if (!body.success) throw BadRequest('参数不合法');
    await reportNote(prisma, requireUserId(req), pp.data.id, body.data.reason);
    return { data: { ok: true } };
  });

  app.get('/api/notes/reports', {
    schema: { tags: TAGS, summary: '待处理举报列表（admin 全部 / coach 仅本班）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const role = getUserRole(req);
    if (role !== 'admin' && role !== 'coach') throw Forbidden('无权查看举报');
    const data = await listNoteReports(prisma, role === 'coach' ? { coachUserId: userId } : {});
    return { data };
  });

  app.post('/api/notes/reports/:id/action', {
    schema: { tags: TAGS, summary: '处理举报：takedown(下架) / dismiss(驳回)', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const role = getUserRole(req);
    if (role !== 'admin' && role !== 'coach') throw Forbidden('无权处理举报');
    const pp = z.object({ id: z.string().min(1) }).safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = z.object({ action: z.enum(['takedown', 'dismiss']) }).safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    await actionNoteReport(prisma, pp.data.id, body.data.action, userId, role === 'coach' ? { coachUserId: userId } : {});
    return { data: { ok: true } };
  });

  // LLM 5 个 action · 无 rate limit · 但记录用量（gateway 自动记 LlmCallLog）
  app.post('/api/notes/llm-assist', {
    schema: { tags: TAGS, summary: '笔记 LLM 增强 (polish/summarize/tags/title/draft)', security: SEC },
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } }, // 防短时刷请求 · 不算每日 quota
  }, async (req) => {
    const body = llmBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const data = await llmAssist(body.data.action, body.data.text, requireUserId(req));
    return { data };
  });
};
