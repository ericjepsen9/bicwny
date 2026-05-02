// Admin LLM Provider 管理
// 允许改：标识 / 显示名 / 端点 / apiKeyEnv / 模型 / 启用 / 角色 / 优先级
//   / 各种 quota / 成本 / 生效期 / 超额策略
// 注意：apiKey 本身仍走 env 不落库（apiKeyEnv 字段只存"环境变量名"）
// Gateway 维护的 healthStatus / consecutiveErrors / circuitOpenUntil 由 resetCircuit 明确清零
// 辅助函数 / 类型见 ./admin.service.helpers.ts 与 ./admin.service.types.ts
import type { LlmProviderConfig, Prisma } from '@prisma/client';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  snapshotBefore,
  snapshotPatch,
  toUpdateInput,
} from './admin.service.helpers.js';
import type {
  CreateProviderInput,
  UpdateProviderPatch,
} from './admin.service.types.js';

export type {
  CreateProviderInput,
  UpdateProviderPatch,
} from './admin.service.types.js';

export async function listProvidersAdmin(): Promise<LlmProviderConfig[]> {
  return prisma.llmProviderConfig.findMany({
    orderBy: [{ role: 'asc' }, { priority: 'asc' }],
  });
}

export async function createProvider(
  adminId: string,
  input: CreateProviderInput,
): Promise<LlmProviderConfig> {
  const name = input.name.trim();
  if (!/^[a-z0-9_-]+$/i.test(name)) {
    throw BadRequest('name 只能含字母 / 数字 / 下划线 / 连字符');
  }
  if (await prisma.llmProviderConfig.findUnique({ where: { name } })) {
    throw Conflict(`provider name 「${name}」已存在`);
  }
  if (input.priority !== undefined && input.priority < 0) {
    throw BadRequest('priority 不可为负');
  }

  const created = await prisma.$transaction(async (tx) => {
    const p = await tx.llmProviderConfig.create({
      data: {
        name,
        displayName: input.displayName.trim(),
        baseUrl: input.baseUrl.trim(),
        apiKeyEnv: input.apiKeyEnv.trim(),
        defaultModel: input.defaultModel.trim(),
        role: input.role ?? 'fallback',
        priority: input.priority ?? 50,
        isEnabled: input.isEnabled ?? false, // 新建默认未启用 · 防误触
        inputCostPer1k: input.inputCostPer1k ?? 0,
        outputCostPer1k: input.outputCostPer1k ?? 0,
        monthlyTokenQuota: input.monthlyTokenQuota != null ? BigInt(input.monthlyTokenQuota) : null,
        dailyRequestQuota: input.dailyRequestQuota ?? null,
        rpmLimit: input.rpmLimit ?? null,
        concurrencyLimit: input.concurrencyLimit ?? null,
        overagePolicy: input.overagePolicy ?? 'stop',
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'llmProvider.create',
        targetType: 'llmProvider',
        targetId: p.id,
        after: {
          name: p.name,
          baseUrl: p.baseUrl,
          apiKeyEnv: p.apiKeyEnv,
          defaultModel: p.defaultModel,
          role: p.role,
          isEnabled: p.isEnabled,
        } as Prisma.InputJsonValue,
      },
    });
    return p;
  });
  return created;
}

export async function updateProvider(
  id: string,
  adminId: string,
  patch: UpdateProviderPatch,
): Promise<LlmProviderConfig> {
  if (
    patch.reservePercent !== undefined &&
    (patch.reservePercent < 0 || patch.reservePercent > 100)
  ) {
    throw BadRequest('reservePercent 应在 [0, 100]');
  }
  if (patch.priority !== undefined && patch.priority < 0) {
    throw BadRequest('priority 不可为负');
  }
  if (patch.name !== undefined && !/^[a-z0-9_-]+$/i.test(patch.name)) {
    throw BadRequest('name 只能含字母 / 数字 / 下划线 / 连字符');
  }

  const before = await prisma.llmProviderConfig.findUnique({ where: { id } });
  if (!before) throw NotFound('provider 不存在');

  if (patch.name !== undefined && patch.name !== before.name) {
    const dup = await prisma.llmProviderConfig.findUnique({ where: { name: patch.name } });
    if (dup) throw Conflict(`provider name 「${patch.name}」已存在`);
  }

  const [updated] = await prisma.$transaction([
    prisma.llmProviderConfig.update({ where: { id }, data: toUpdateInput(patch) }),
    prisma.auditLog.create({
      data: {
        adminId,
        action: 'llmProvider.update',
        targetType: 'llmProvider',
        targetId: id,
        before: snapshotBefore(before) as Prisma.InputJsonValue,
        after: snapshotPatch(patch) as Prisma.InputJsonValue,
      },
    }),
  ]);
  return updated;
}

export async function toggleEnabled(
  id: string,
  adminId: string,
  isEnabled: boolean,
): Promise<LlmProviderConfig> {
  return updateProvider(id, adminId, { isEnabled });
}

export async function resetCircuit(
  id: string,
  adminId: string,
): Promise<LlmProviderConfig> {
  const before = await prisma.llmProviderConfig.findUnique({ where: { id } });
  if (!before) throw NotFound('provider 不存在');

  const [updated] = await prisma.$transaction([
    prisma.llmProviderConfig.update({
      where: { id },
      data: {
        consecutiveErrors: 0,
        circuitOpenUntil: null,
        healthStatus: 'healthy',
      },
    }),
    prisma.auditLog.create({
      data: {
        adminId,
        action: 'llmProvider.resetCircuit',
        targetType: 'llmProvider',
        targetId: id,
        before: {
          healthStatus: before.healthStatus,
          consecutiveErrors: before.consecutiveErrors,
          circuitOpenUntil: before.circuitOpenUntil?.toISOString() ?? null,
        } as Prisma.InputJsonValue,
      },
    }),
  ]);
  return updated;
}
