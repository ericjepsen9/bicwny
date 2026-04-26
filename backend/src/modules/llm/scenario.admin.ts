// Admin LLM 场景配置 + Prompt 模板
// - listScenarios / updateScenario
// - listPromptTemplates / createPromptTemplate（默认 isActive=false，需要单独激活）
// - activatePromptTemplate：同 scenario 下旧版本自动停用
import type {
  LlmPromptTemplate,
  LlmScenarioConfig,
  Prisma,
} from '@prisma/client';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export async function listScenarios(): Promise<LlmScenarioConfig[]> {
  return prisma.llmScenarioConfig.findMany({
    orderBy: { scenario: 'asc' },
  });
}

export interface UpdateScenarioPatch {
  primaryProviderId?: string;
  primaryModel?: string;
  fallbackProviderId?: string | null;
  fallbackModel?: string | null;
  temperature?: number;
  maxTokens?: number;
  promptTemplateId?: string | null;
  estimatedTokensPerCall?: number;
}

export async function updateScenario(
  id: string,
  adminId: string,
  patch: UpdateScenarioPatch,
): Promise<LlmScenarioConfig> {
  if (patch.temperature !== undefined && (patch.temperature < 0 || patch.temperature > 2)) {
    throw BadRequest('temperature ∈ [0, 2]');
  }
  if (patch.maxTokens !== undefined && patch.maxTokens <= 0) {
    throw BadRequest('maxTokens 必须为正');
  }
  const before = await prisma.llmScenarioConfig.findUnique({ where: { id } });
  if (!before) throw NotFound('场景配置不存在');

  const [updated] = await prisma.$transaction([
    prisma.llmScenarioConfig.update({ where: { id }, data: patch }),
    prisma.auditLog.create({
      data: {
        adminId,
        action: 'llmScenario.update',
        targetType: 'llmScenario',
        targetId: id,
        before: {
          primaryProviderId: before.primaryProviderId,
          primaryModel: before.primaryModel,
          fallbackProviderId: before.fallbackProviderId,
          fallbackModel: before.fallbackModel,
          temperature: before.temperature,
          maxTokens: before.maxTokens,
          promptTemplateId: before.promptTemplateId,
        } as Prisma.InputJsonValue,
        after: patch as Prisma.InputJsonValue,
      },
    }),
  ]);
  return updated;
}

export async function listPromptTemplates(
  scenario?: string,
): Promise<LlmPromptTemplate[]> {
  return prisma.llmPromptTemplate.findMany({
    where: scenario ? { scenario } : undefined,
    orderBy: [{ scenario: 'asc' }, { createdAt: 'desc' }],
  });
}

export interface CreatePromptTemplateInput {
  scenario: string;
  version: string;
  content: string;
}

export async function createPromptTemplate(
  input: CreatePromptTemplateInput,
  adminId: string,
): Promise<LlmPromptTemplate> {
  const existing = await prisma.llmPromptTemplate.findUnique({
    where: {
      scenario_version: { scenario: input.scenario, version: input.version },
    },
  });
  if (existing) throw Conflict(`模板 ${input.scenario}/${input.version} 已存在`);

  return prisma.llmPromptTemplate.create({
    data: {
      scenario: input.scenario,
      version: input.version,
      content: input.content,
      isActive: false,
      createdByAdminId: adminId,
    },
  });
}

/** 激活此模板并停用同 scenario 的其他版本（事务一致）。 */
export async function activatePromptTemplate(
  id: string,
  adminId: string,
): Promise<LlmPromptTemplate> {
  const target = await prisma.llmPromptTemplate.findUnique({ where: { id } });
  if (!target) throw NotFound('模板不存在');

  const [activated] = await prisma.$transaction([
    prisma.llmPromptTemplate.update({
      where: { id },
      data: { isActive: true },
    }),
    prisma.llmPromptTemplate.updateMany({
      where: {
        scenario: target.scenario,
        id: { not: id },
        isActive: true,
      },
      data: { isActive: false },
    }),
    prisma.auditLog.create({
      data: {
        adminId,
        action: 'llmPrompt.activate',
        targetType: 'llmPromptTemplate',
        targetId: id,
        after: {
          scenario: target.scenario,
          version: target.version,
        } as Prisma.InputJsonValue,
      },
    }),
  ]);
  return activated;
}
