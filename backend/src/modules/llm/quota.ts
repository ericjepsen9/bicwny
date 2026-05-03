// 4 维配额检查 + 预留阈值
// 调用流程：Gateway 选 provider 前调用 checkQuota(cfg)；
//   allowed=true         → 可以用
//   allowed=false        → 切兜底 / 拒绝，dimension 表明被哪一维卡住
//
// 维度说明：
//   yearly_reserve  主通路剩余量跌破 reservePercent → 主动切兜底
//   yearly_hard     年度额度真正耗尽（overagePolicy=stop 才拒绝）
//   monthly         月度额度
//   daily           日请求数
//   rpm             每分钟请求数
import type { LlmProviderConfig } from '@prisma/client';
import { allPeriodKeys } from './period.js';
import { readUsage } from './usage.js';

export type QuotaDimension =
  | 'yearly_reserve'
  | 'yearly_hard'
  | 'monthly'
  | 'daily'
  | 'rpm';

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  dimension?: QuotaDimension;
}

const ALLOWED: QuotaCheckResult = { allowed: true };

export async function checkQuota(
  cfg: LlmProviderConfig,
  at: Date = new Date(),
): Promise<QuotaCheckResult> {
  if (!cfg.isEnabled || cfg.role === 'disabled') {
    return deny('provider 已禁用');
  }
  if (cfg.enabledFrom && at < cfg.enabledFrom) {
    return deny('provider 尚未到生效日期');
  }
  if (cfg.enabledUntil && at > cfg.enabledUntil) {
    return deny('provider 已过有效期');
  }

  const keys = allPeriodKeys(at);
  const [year, month, day, minute] = await Promise.all([
    cfg.yearlyTokenQuota !== null ? readUsage(cfg.id, 'year', keys.year) : null,
    cfg.monthlyTokenQuota !== null ? readUsage(cfg.id, 'month', keys.month) : null,
    cfg.dailyRequestQuota !== null ? readUsage(cfg.id, 'day', keys.day) : null,
    cfg.rpmLimit !== null ? readUsage(cfg.id, 'minute', keys.minute) : null,
  ]);

  // 年度
  if (cfg.yearlyTokenQuota !== null) {
    const used = year ? Number(year.tokenCount) : 0;
    const quota = Number(cfg.yearlyTokenQuota);
    const reserveLine = quota * (1 - cfg.reservePercent / 100);
    if (used >= quota && cfg.overagePolicy !== 'pay_as_you_go') {
      return deny(`年度额度已耗尽 (${used}/${quota})`, 'yearly_hard');
    }
    if (used >= reserveLine && cfg.overagePolicy === 'fallback') {
      return deny(
        `已达预留阈值 ${cfg.reservePercent}%（${used}/${quota}），切兜底`,
        'yearly_reserve',
      );
    }
  }

  // 月度
  if (cfg.monthlyTokenQuota !== null) {
    const used = month ? Number(month.tokenCount) : 0;
    const quota = Number(cfg.monthlyTokenQuota);
    if (used >= quota && cfg.overagePolicy !== 'pay_as_you_go') {
      return deny(`月度额度已耗尽 (${used}/${quota})`, 'monthly');
    }
  }

  // 日请求
  if (cfg.dailyRequestQuota !== null) {
    const used = day?.requestCount ?? 0;
    if (used >= cfg.dailyRequestQuota) {
      return deny(`日请求上限 ${cfg.dailyRequestQuota} 已达`, 'daily');
    }
  }

  // RPM
  if (cfg.rpmLimit !== null) {
    const used = minute?.requestCount ?? 0;
    if (used >= cfg.rpmLimit) {
      return deny(`RPM 限制 ${cfg.rpmLimit} 已达`, 'rpm');
    }
  }

  return ALLOWED;
}

function deny(reason: string, dimension?: QuotaDimension): QuotaCheckResult {
  return { allowed: false, reason, dimension };
}
