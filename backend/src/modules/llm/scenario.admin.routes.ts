// Admin LLM 场景 + Prompt 模板路由
//   GET   /api/admin/llm/scenarios                       列场景
//   PATCH /api/admin/llm/scenarios/:id                   改场景
//   GET   /api/admin/llm/prompts                          列模板（?scenario 过滤）
//   POST  /api/admin/llm/prompts                          创建模板（默认未激活）
//   POST  /api/admin/llm/prompts/:id/activate            激活并停用同 scenario 旧版
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  activatePromptTemplate,
  createPromptTemplate,
  listPromptTemplates,
  listScenarios,
  updateScenario,
} from './scenario.admin.js';

const adminGuard = requireRole('admin');
const idParam = z.object({ id: z.string().min(1) });

const updateScenarioBody = z.object({
  primaryProviderId: z.string().optional(),
  primaryModel: z.string().optional(),
  fallbackProviderId: z.string().nullable().optional(),
  fallbackModel: z.string().nullable().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  promptTemplateId: z.string().nullable().optional(),
  estimatedTokensPerCall: z.number().int().positive().optional(),
});

const promptsQuery = z.object({ scenario: z.string().optional() });
const createPromptBody = z.object({
  scenario: z.string().min(1),
  version: z.string().min(1),
  content: z.string().min(1),
});

const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

export const llmScenarioAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/llm/scenarios', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: 'LLM 场景列表（open_grading / question_generation ...）', security: SEC },
  }, async () => {
    return { data: await listScenarios() };
  });

  app.patch(
    '/api/admin/llm/scenarios/:id',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '更新场景（主/备 provider + 温度 / maxTokens / 模板绑定）', security: SEC },
    },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pb = updateScenarioBody.safeParse(req.body);
      if (!pb.success) throw BadRequest('请求参数不合法', pb.error.flatten());
      const adminId = requireUserId(req);
      const s = await updateScenario(pp.data.id, adminId, pb.data);
      return { data: s };
    },
  );

  app.get('/api/admin/llm/prompts', {
    preHandler: adminGuard,
    schema: { tags: TAGS, summary: 'Prompt 模板列表（?scenario 过滤）', security: SEC },
  }, async (req) => {
    const pq = promptsQuery.safeParse(req.query);
    if (!pq.success) throw BadRequest('查询参数不合法');
    return { data: await listPromptTemplates(pq.data.scenario) };
  });

  app.post(
    '/api/admin/llm/prompts',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '创建 Prompt 模板（默认未激活，需显式 activate）', security: SEC },
    },
    async (req, reply) => {
      const parsed = createPromptBody.safeParse(req.body);
      if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
      const adminId = requireUserId(req);
      const t = await createPromptTemplate(parsed.data, adminId);
      reply.code(201);
      return { data: t };
    },
  );

  app.post(
    '/api/admin/llm/prompts/:id/activate',
    {
      preHandler: adminGuard,
      schema: { tags: TAGS, summary: '激活 Prompt 模板（同 scenario 旧版自动停用）', security: SEC },
    },
    async (req) => {
      const pp = idParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const adminId = requireUserId(req);
      const t = await activatePromptTemplate(pp.data.id, adminId);
      return { data: t };
    },
  );
};
