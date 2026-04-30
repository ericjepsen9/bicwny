// 错题本 HTTP 路由（service 复用 Sprint 1 的 mistakes.ts）
//   GET    /api/mistakes                          未移除的错题（含 question 剥答案视图）
//   GET    /api/mistakes/count                    错题总数（badge 显示用 · 极轻）
//   GET    /api/mistakes/:questionId              错题详情（含完整 question + 最近作答，仅 owner 可见）
//   DELETE /api/mistakes/:questionId              手动移除（用户掌握后）
//   GET    /api/my/questions/:questionId          M7 · 题目详解（owner-only · 收藏/错题/已答 任一引子）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  getMistakeDetail,
  getQuestionDetailForOwner,
  listActiveMistakesWithQuestions,
  removeMistake,
} from './mistakes.js';

const qidParam = z.object({ questionId: z.string().min(1) });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const TAGS = ['Answering'];
const SEC = [{ bearerAuth: [] as string[] }];

export const mistakesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/mistakes', {
    schema: { tags: TAGS, summary: '错题本列表（含剥答案视图）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');
    return { data: await listActiveMistakesWithQuestions(userId, parsed.data.limit) };
  });

  // 仅返回未移除错题数量 · 复合索引下 O(log N) · payload 几十字节
  // 用于 quiz-center / home badge 显示 · 不再下载完整 limit=500 列表
  app.get('/api/mistakes/count', {
    schema: { tags: TAGS, summary: '错题总数（badge）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const count = await prisma.userMistakeBook.count({
      where: { userId, removedAt: null },
    });
    return { data: { count } };
  });

  app.get('/api/mistakes/:questionId', {
    schema: { tags: TAGS, summary: '错题详情（完整 question + 最近作答 · owner-only）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = qidParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    return { data: await getMistakeDetail(userId, parsed.data.questionId) };
  });

  app.delete('/api/mistakes/:questionId', {
    schema: { tags: TAGS, summary: '移出错题本（软删除）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = qidParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    await removeMistake(userId, parsed.data.questionId);
    return { data: { ok: true } };
  });

  // M7: 题目详解（owner-only · 收藏 / 错题 / 已答 任一引子）
  app.get('/api/my/questions/:questionId', {
    schema: { tags: TAGS, summary: '题目详解（owner · 收藏/错题/已答 三选一即可）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = qidParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    return { data: await getQuestionDetailForOwner(userId, parsed.data.questionId) };
  });
};
