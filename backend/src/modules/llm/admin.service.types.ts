import type { OveragePolicy, ProviderRole } from '@prisma/client';

export interface UpdateProviderPatch {
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
