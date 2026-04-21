// Admin LLM 运维路由（全部 admin 角色）
//   GET   /api/admin/llm/providers                        listProvidersAdmin
//   PATCH /api/admin/llm/providers/:id                    updateProvider
//   POST  /api/admin/llm/providers/:id/toggle             toggleEnabled
//   POST  /api/admin/llm/providers/:id/reset-circuit      resetCircuit
//   GET   /api/admin/llm/providers/:id/usage              providerUsageSummary
//   GET   /api/admin/llm/usage                             platformUsageSummary
//   GET   /api/admin/llm/logs                              listCallLogs（游标分页）
import type { LlmProviderConfig } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  listProvidersAdmin,
  resetCircuit,
  toggleEnabled,
  updateProvider,
} from './admin.service.js';
import {
  listCallLogs,
  platformUsageSummary,
  providerUsageSummary,
} from './usage.admin.js';

const adminGuard = requireRole('admin');
const periodType = z.enum(['year', 'month', 'day', 'hour', 'minute']);
const idParam = z.object({ id: z.string().min(1) });

const patchBody = z.object({
  displayName: z.string().optional(),
  defaultModel: z.string().optional(),
  isEnabled: z.boolean().optional(),
  role: z.enum(['primary', 'fallback', 'disabled']).optional(),
  priority: z.number().int().min(0).optional(),
  yearlyTokenQuota: z.number().int().nullable().optional(),
  monthlyTokenQuota: z.number().int().nullable().optional(),
  dailyRequestQuota: z.number().int().nullable().optional(),
  rpmLimit: z.number().int().nullable().optional(),
  concurrencyLimit: z.number().int().nullable().optional(),
  reservePercent: z.number().min(0).max(100).optional(),
  enabledFrom: z.coerce.date().nullable().optional(),
  enabledUntil: z.coerce.date().nullable().optional(),
  overagePolicy: z.enum(['stop', 'pay_as_you_go', 'fallback']).optional(),
  inputCostPer1k: z.number().min(0).optional(),
  outputCostPer1k: z.number().min(0).optional(),
});

const toggleBody = z.object({ isEnabled: z.boolean() });
const providerUsageQuery = z.object({
  periodType: periodType.optional(),
  limit: z.coerce.number().int().min(1).max(365).optional(),
});
const platformUsageQuery = z.object({ periodType: periodType.optional() });
const logsQuery = z.object({
  providerUsed: z.string().optional(),
  scenario: z.string().optional(),
  userId: z.string().optional(),
  success: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

function serialize(p: LlmProviderConfig) {
  return {
    ...p,
    yearlyTokenQuota: p.yearlyTokenQuota?.toString() ?? null,
    monthlyTokenQuota: p.monthlyTokenQuota?.toString() ?? null,
  };
}

export const llmAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/llm/providers', { preHandler: adminGuard }, async () => {
    const items = await listProvidersAdmin();
    return { data: items.map(serialize) };
  });

  app.patch(
    '/api/admin/llm/providers/:id',
    { preHandler: adminGuard },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = patchBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = requireUserId(req);
      const p = await updateProvider(pp.data.id, adminId, pb.data);
      return { data: serialize(p) };
    },
  );

  app.post(
    '/api/admin/llm/providers/:id/toggle',
    { preHandler: adminGuard },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = toggleBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = requireUserId(req);
      const p = await toggleEnabled(pp.data.id, adminId, pb.data.isEnabled);
      return { data: serialize(p) };
    },
  );

  app.post(
    '/api/admin/llm/providers/:id/reset-circuit',
    { preHandler: adminGuard },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const adminId = requireUserId(req);
      const p = await resetCircuit(pp.data.id, adminId);
      return { data: serialize(p) };
    },
  );

  app.get(
    '/api/admin/llm/providers/:id/usage',
    { preHandler: adminGuard },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pq = providerUsageQuery.safeParse(req.query);
      if (!pq.success) throw BadRequest('查询参数不合法');
      const rows = await providerUsageSummary(pp.data.id, pq.data);
      return { data: rows };
    },
  );

  app.get('/api/admin/llm/usage', { preHandler: adminGuard }, async (req) => {
    const pq = platformUsageQuery.safeParse(req.query);
    if (!pq.success) throw BadRequest('查询参数不合法');
    return { data: await platformUsageSummary(pq.data) };
  });

  app.get('/api/admin/llm/logs', { preHandler: adminGuard }, async (req) => {
    const pq = logsQuery.safeParse(req.query);
    if (!pq.success) throw BadRequest('查询参数不合法');
    return { data: await listCallLogs(pq.data) };
  });
};
