// Admin LLM Provider 管理
// 允许改：显示名 / 模型 / 启用 / 角色 / 优先级 / 各种 quota / 成本 / 生效期 / 超额策略
// 不允许改（走 env 或代码）：name / apiKeyEnv / baseUrl
// Gateway 维护的 healthStatus / consecutiveErrors / circuitOpenUntil 由 resetCircuit 明确清零
// 辅助函数 / 类型见 ./admin.service.helpers.ts 与 ./admin.service.types.ts
import type { LlmProviderConfig, Prisma } from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  snapshotBefore,
  snapshotPatch,
  toUpdateInput,
} from './admin.service.helpers.js';
import type { UpdateProviderPatch } from './admin.service.types.js';

export type { UpdateProviderPatch } from './admin.service.types.js';

export async function listProvidersAdmin(): Promise<LlmProviderConfig[]> {
  return prisma.llmProviderConfig.findMany({
    orderBy: [{ role: 'asc' }, { priority: 'asc' }],
  });
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

  const before = await prisma.llmProviderConfig.findUnique({ where: { id } });
  if (!before) throw NotFound('provider 不存在');

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
