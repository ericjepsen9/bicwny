// LLM 用量时间分桶
// 输出键与 LlmProviderUsage.periodKey 一致；
// 一律使用 UTC，避免服务器所在地时区影响计量。
import type { PeriodType } from '@prisma/client';

export function periodKey(type: PeriodType, d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());

  switch (type) {
    case 'year':
      return `${y}`;
    case 'month':
      return `${y}-${m}`;
    case 'day':
      return `${y}-${m}-${day}`;
    case 'hour':
      return `${y}-${m}-${day}T${h}`;
    case 'minute':
      return `${y}-${m}-${day}T${h}:${min}`;
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 一次生成当前时刻全部 5 个桶的 key，Gateway 统一累加用量时调用 */
export function allPeriodKeys(d: Date = new Date()): Record<PeriodType, string> {
  return {
    year: periodKey('year', d),
    month: periodKey('month', d),
    day: periodKey('day', d),
    hour: periodKey('hour', d),
    minute: periodKey('minute', d),
  };
}
