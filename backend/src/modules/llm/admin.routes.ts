// Admin LLM 运维路由（全部 admin 角色）
//   GET   /api/admin/llm/providers                        listProvidersAdmin
//   POST  /api/admin/llm/providers                        createProvider · I 阶段
//   PATCH /api/admin/llm/providers/:id                    updateProvider · I 阶段补 baseUrl/apiKeyEnv/name
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
  createProvider,
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

// I 阶段：patchBody 解锁 name / baseUrl / apiKeyEnv
//   apiKey 本身仍走 env 不落库 · 改 apiKeyEnv 只改"环境变量名"指针
const patchBody = z.object({
  name: z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i).optional(),
  baseUrl: z.string().trim().url().max(500).optional(),
  apiKeyEnv: z.string().trim().min(1).max(100).regex(/^[A-Z][A-Z0-9_]*$/, '只能含大写字母 / 数字 / 下划线 · 以字母开头').optional(),
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

// I 阶段 · 创建新 provider
const createBody = z.object({
  name: z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i),
  displayName: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().url().max(500),
  apiKeyEnv: z.string().trim().min(1).max(100).regex(/^[A-Z][A-Z0-9_]*$/, '只能含大写字母 / 数字 / 下划线 · 以字母开头'),
  defaultModel: z.string().trim().min(1).max(120),
  role: z.enum(['primary', 'fallback', 'disabled']).optional(),
  priority: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
  inputCostPer1k: z.number().min(0).optional(),
  outputCostPer1k: z.number().min(0).optional(),
  monthlyTokenQuota: z.number().int().nullable().optional(),
  dailyRequestQuota: z.number().int().nullable().optional(),
  rpmLimit: z.number().int().nullable().optional(),
  concurrencyLimit: z.number().int().nullable().optional(),
  overagePolicy: z.enum(['stop', 'pay_as_you_go', 'fallback']).optional(),
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

const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

export const llmAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/llm/providers', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: 'LLM provider 列表（含配额 / 健康 / 熔断状态）', security: SEC },
  }, async () => {
    const items = await listProvidersAdmin();
    return { data: items.map(serialize) };
  });

  // I 阶段 · 新建 provider
  app.post(
    '/api/admin/llm/providers',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '新建 provider（默认 isEnabled=false 防误触）', security: SEC },
    },
    async (req, reply) => {
      const pb = createBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = requireUserId(req);
      const p = await createProvider(adminId, pb.data);
      reply.code(201);
      return { data: serialize(p) };
    },
  );

  app.patch(
    '/api/admin/llm/providers/:id',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '更新 provider 配置（配额 / 角色 / 成本等）', security: SEC },
    },
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
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '启停 provider（isEnabled）', security: SEC },
    },
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
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '手动重置熔断（清 circuitOpenUntil + 计数归零）', security: SEC },
    },
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
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '单 provider 用量时序（按周期 year / month / day / hour / minute）', security: SEC },
    },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pq = providerUsageQuery.safeParse(req.query);
      if (!pq.success) throw BadRequest('查询参数不合法');
      const rows = await providerUsageSummary(pp.data.id, pq.data);
      return { data: rows };
    },
  );

  app.get('/api/admin/llm/usage', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: '平台总用量汇总（跨 provider）', security: SEC },
  }, async (req) => {
    const pq = platformUsageQuery.safeParse(req.query);
    if (!pq.success) throw BadRequest('查询参数不合法');
    return { data: await platformUsageSummary(pq.data) };
  });

  app.get('/api/admin/llm/logs', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: 'LLM 调用日志（filter + 游标分页）', security: SEC },
  }, async (req) => {
    const pq = logsQuery.safeParse(req.query);
    if (!pq.success) throw BadRequest('查询参数不合法');
    return { data: await listCallLogs(pq.data) };
  });
};
