// 排行时间窗口 · 统一日历口径（审计 S6）
//   week  = 本自然周（周一 00:00 起）
//   month = 本自然月（1 号 00:00 起）
//   all   = 不限
//
// 时区：暂用 UTC · 与 PracticeDailySummary.date 的 UTC 存储一致（schema 注明后期切 user.timezone）。
// 统一此 helper 后三个排行（念诵 / 观修 / 综合）口径一致 · 避免"本周"在不同页含义不同。
export type RankPeriod = 'week' | 'month' | 'all';

// DateTime 字段用（completedAt / answeredAt 等）· 'all' → null 表示不过滤
export function periodStart(period: RankPeriod, now: Date = new Date()): Date | null {
  if (period === 'all') return null;
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  if (period === 'month') return new Date(Date.UTC(y, mo, 1));
  // week · 周一锚点（getUTCDay 0=Sun..6=Sat）
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(y, mo, now.getUTCDate() - diff));
}

// YYYY-MM-DD 字符串字段用（PracticeDailySummary.date）· 字典序与日期序一致 · 配 gte 过滤
export function periodStartDate(period: RankPeriod, now: Date = new Date()): string | null {
  const start = periodStart(period, now);
  return start ? start.toISOString().slice(0, 10) : null;
}
