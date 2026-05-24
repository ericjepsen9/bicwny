// LLM 用量时间分桶
// 输出键与 LlmProviderUsage.periodKey 一致；
// 一律使用纽约时区（America/New_York · 审计 D7/D8）· 全应用日历口径统一。
import type { PeriodType } from '@prisma/client';
import { zonedParts } from '../../lib/timezone.js';

export function periodKey(type: PeriodType, d: Date = new Date()): string {
  const p = zonedParts(d);
  const y = p.year;
  const m = pad2(p.month);
  const day = pad2(p.day);
  const h = pad2(p.hour);
  const min = pad2(p.minute);

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
