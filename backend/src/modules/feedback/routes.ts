// 应用内反馈 routes
//   POST  /api/feedback                  · 提交（auth optional）
//   GET   /api/me/feedback               · 看自己历史（auth required）
//   GET   /api/admin/feedback            · admin 列表
//   PATCH /api/admin/feedback/:id        · admin 处理 + 回复
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserId, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { handleFeedback, listFeedback, listMyFeedback, submitFeedback } from './service.js';

const TAGS = ['feedback'];
const ADMIN_TAGS = ['admin'];
const SEC = [{ bearerAuth: [] }];

const KindEnum = z.enum(['suggestion', 'bug', 'praise', 'other']);
const StatusEnum = z.enum(['open', 'triaged', 'resolved', 'wontfix']);

const submitBody = z.object({
  kind: KindEnum.default('other'),
  message: z.string().trim().min(2).max(4000),
  contactEmail: z.string().trim().email().max(200).optional(),
  page: z.string().max(120).optional(),
  appVersion: z.string().max(40).optional(),
  sessionId: z.string().max(120).optional(),
});

const listQuery = z.object({
  status: StatusEnum.optional(),
  kind: KindEnum.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

const handleBody = z.object({
  status: StatusEnum,
  response: z.string().trim().max(4000).optional(),
});

// 简易 in-memory 限速 · 同 user/session 1 小时 5 条
// （生产用 Redis 共享 · 单实例时 in-memory 够用）
const submitCounters = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimitKey(req: { ip?: string; headers: Record<string, string | string[] | undefined> }, userId: string | null): string {
  if (userId) return `u:${userId}`;
  return `ip:${req.ip || 'unknown'}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const slot = submitCounters.get(key);
  if (!slot || now - slot.windowStart > WINDOW_MS) {
    submitCounters.set(key, { count: 1, windowStart: now });
    // 偶尔清理
    if (submitCounters.size > 5000) {
      for (const [k, v] of submitCounters.entries()) {
        if (now - v.windowStart > WINDOW_MS) submitCounters.delete(k);
      }
    }
    return true;
  }
  if (slot.count >= MAX_PER_WINDOW) return false;
  slot.count += 1;
  return true;
}

export const feedbackRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/feedback',
    {
      schema: {
        tags: TAGS,
        summary: '提交反馈（auth optional · 5/小时限速）',
        security: SEC,
      },
    },
    async (req) => {
      const parsed = submitBody.safeParse(req.body);
      if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
      const userId = getUserId(req);
      const key = rateLimitKey(req as never, userId);
      if (!checkRateLimit(key)) {
        throw BadRequest('提交过于频繁 · 请稍后再试（每小时最多 5 条）');
      }
      const userAgent = String((req.headers['user-agent'] as string) || '').slice(0, 500);
      const fb = await submitFeedback({
        userId,
        kind: parsed.data.kind,
        message: parsed.data.message,
        contactEmail: parsed.data.contactEmail || null,
        page: parsed.data.page || null,
        appVersion: parsed.data.appVersion || null,
        sessionId: parsed.data.sessionId || null,
        userAgent,
      });
      return {
        data: {
          id: fb.id,
          status: fb.status,
          createdAt: fb.createdAt,
        },
      };
    },
  );

  app.get(
    '/api/me/feedback',
    {
      schema: {
        tags: TAGS,
        summary: '查看本人历史反馈',
        security: SEC,
      },
    },
    async (req) => {
      const userId = requireUserId(req);
      return { data: await listMyFeedback(userId) };
    },
  );

  app.get(
    '/api/admin/feedback',
    {
      preHandler: requireRole('admin'),
      schema: { tags: ADMIN_TAGS, summary: '反馈列表（status/kind 过滤）', security: SEC },
    },
    async (req) => {
      const parsed = listQuery.safeParse(req.query);
      if (!parsed.success) throw BadRequest('查询参数不合法');
      return { data: await listFeedback(parsed.data) };
    },
  );

  app.patch(
    '/api/admin/feedback/:id',
    {
      preHandler: requireRole('admin'),
      schema: { tags: ADMIN_TAGS, summary: '处理反馈 + 回复 · 写 Notification', security: SEC },
    },
    async (req) => {
      const idParse = z.object({ id: z.string().min(1) }).safeParse(req.params);
      if (!idParse.success) throw BadRequest('路径参数不合法');
      const parsed = handleBody.safeParse(req.body);
      if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
      const adminId = requireUserId(req);
      const updated = await handleFeedback(idParse.data.id, adminId, parsed.data);
      return { data: updated };
    },
  );
};
