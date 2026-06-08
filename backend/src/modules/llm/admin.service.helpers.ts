// admin.service.ts 的内部辅助：类型转换 + AuditLog 快照
import type { LlmProviderConfig, Prisma } from '@prisma/client';
import type { UpdateProviderPatch } from './admin.service.types.js';

export function toUpdateInput(
  p: UpdateProviderPatch,
): Prisma.LlmProviderConfigUpdateInput {
  return {
    // I 阶段补 · 允许 admin 改 标识 / 端点 / api key 变量名
    name: p.name,
    baseUrl: p.baseUrl,
    apiKeyEnv: p.apiKeyEnv,
    displayName: p.displayName,
    defaultModel: p.defaultModel,
    isEnabled: p.isEnabled,
    role: p.role,
    priority: p.priority,
    yearlyTokenQuota: bigIntPatch(p.yearlyTokenQuota),
    monthlyTokenQuota: bigIntPatch(p.monthlyTokenQuota),
    dailyRequestQuota: p.dailyRequestQuota,
    rpmLimit: p.rpmLimit,
    concurrencyLimit: p.concurrencyLimit,
    reservePercent: p.reservePercent,
    enabledFrom: p.enabledFrom,
    enabledUntil: p.enabledUntil,
    overagePolicy: p.overagePolicy,
    inputCostPer1k: p.inputCostPer1k,
    outputCostPer1k: p.outputCostPer1k,
  };
}

function bigIntPatch(
  v: number | null | undefined,
): bigint | null | undefined {
  if (v === undefined) return undefined;
  return v === null ? null : BigInt(v);
}

export function snapshotBefore(
  p: LlmProviderConfig,
): Record<string, unknown> {
  return {
    displayName: p.displayName,
    isEnabled: p.isEnabled,
    role: p.role,
    priority: p.priority,
    yearlyTokenQuota: p.yearlyTokenQuota?.toString() ?? null,
    monthlyTokenQuota: p.monthlyTokenQuota?.toString() ?? null,
    dailyRequestQuota: p.dailyRequestQuota,
    rpmLimit: p.rpmLimit,
    reservePercent: p.reservePercent,
    overagePolicy: p.overagePolicy,
    inputCostPer1k: p.inputCostPer1k,
    outputCostPer1k: p.outputCostPer1k,
  };
}

export function snapshotPatch(p: UpdateProviderPatch): Record<string, unknown> {
  return {
    ...p,
    yearlyTokenQuota:
      p.yearlyTokenQuota == null ? p.yearlyTokenQuota : String(p.yearlyTokenQuota),
    monthlyTokenQuota:
      p.monthlyTokenQuota == null ? p.monthlyTokenQuota : String(p.monthlyTokenQuota),
  };
}
