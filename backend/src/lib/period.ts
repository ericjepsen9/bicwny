// 排行时间窗口 · 统一日历口径（审计 S6）
//   week  = 本自然周（纽约时区周一 00:00 起）
//   month = 本自然月（纽约时区 1 号 00:00 起）
//   all   = 不限
//
// 时区：纽约（America/New_York · 审计 D7/D8）· 与 PracticeDailySummary.date 的纽约日键一致。
// 统一此 helper 后三个排行（念诵 / 观修 / 综合）口径一致 · 避免"本周"在不同页含义不同。
import { addDaysToDateKey, zonedDateKey, zonedTimeToUtc, zonedWeekday } from './timezone.js';

export type RankPeriod = 'week' | 'month' | 'all';

// DateTime 字段用（completedAt / answeredAt 等 · 存 UTC）· 返回纽约边界对应的 UTC 时刻 · 'all' → null 不过滤
export function periodStart(period: RankPeriod, now: Date = new Date()): Date | null {
  if (period === 'all') return null;
  const key = zonedDateKey(now);
  const [y, m, d] = key.split('-').map(Number);
  if (period === 'month') return zonedTimeToUtc(y!, m! - 1, 1, 0, 0, 0);
  // week · 纽约周一 00:00（zonedWeekday 0=Sun..6=Sat）
  const wd = zonedWeekday(now);
  const diff = wd === 0 ? 6 : wd - 1;
  const monday = addDaysToDateKey(key, -diff);
  const [my, mm, md] = monday.split('-').map(Number);
  return zonedTimeToUtc(my!, mm! - 1, md!, 0, 0, 0);
}

// YYYY-MM-DD 字符串字段用（PracticeDailySummary.date · 纽约日键）· 字典序与日期序一致 · 配 gte 过滤
export function periodStartDate(period: RankPeriod, now: Date = new Date()): string | null {
  if (period === 'all') return null;
  const key = zonedDateKey(now);
  if (period === 'month') return `${key.slice(0, 7)}-01`;
  const wd = zonedWeekday(now);
  const diff = wd === 0 ? 6 : wd - 1;
  return addDaysToDateKey(key, -diff);
}
