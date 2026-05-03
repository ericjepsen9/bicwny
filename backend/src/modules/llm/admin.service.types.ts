import type { OveragePolicy, ProviderRole } from '@prisma/client';

export interface CreateProviderInput {
  name: string;            // 唯一标识 · "minimax" / "claude" 等
  displayName: string;
  baseUrl: string;
  apiKeyEnv: string;       // 环境变量名 · 实际 key 走 env，不落库
  defaultModel: string;
  role?: ProviderRole;
  priority?: number;
  isEnabled?: boolean;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
  monthlyTokenQuota?: number | null;
  dailyRequestQuota?: number | null;
  rpmLimit?: number | null;
  concurrencyLimit?: number | null;
  overagePolicy?: OveragePolicy;
}

export interface UpdateProviderPatch {
  // 可改字段 · I 阶段补 baseUrl / apiKeyEnv / name
  // (apiKey 本身仍走 env 不落库 · 安全设计保留)
  name?: string;
  baseUrl?: string;
  apiKeyEnv?: string;
  displayName?: string;
  defaultModel?: string;
  isEnabled?: boolean;
  role?: ProviderRole;
  priority?: number;
  yearlyTokenQuota?: number | null;
  monthlyTokenQuota?: number | null;
  dailyRequestQuota?: number | null;
  rpmLimit?: number | null;
  concurrencyLimit?: number | null;
  reservePercent?: number;
  enabledFrom?: Date | null;
  enabledUntil?: Date | null;
  overagePolicy?: OveragePolicy;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
}
