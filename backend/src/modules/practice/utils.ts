// 修学计数 · 共用工具
//   - 日期归一化：YYYY-MM-DD（纽约时区锚定 · 审计 D7/D8 · 见 lib/timezone）
//   - streak 算法
//   - 项目可见性（user 自建 / 班级专修 / 平台预置）
import type { PrismaClient } from '@prisma/client';
import { lastNZonedDates, zonedDateKey } from '../../lib/timezone.js';

/** date → 'YYYY-MM-DD'（纽约日历日 · 跨日聚合用） */
export function dateKey(d: Date | string = new Date()): string {
  return zonedDateKey(typeof d === 'string' ? new Date(d) : d);
}

/** 给定 days 天数 · 返回 [today-N+1 .. today] 的纽约 dateKey 数组 */
export function lastNDates(n: number): string[] {
  return lastNZonedDates(n);
}

/** 算用户连续修学天数（任意大类有计数、或当天有补签即算 +1 · 不要求达成目标） */
export async function calcStreak(prisma: PrismaClient, userId: string): Promise<number> {
  // 取最近 90 天（足够覆盖大多数 streak） · 前端展示如想看 365 后期再扩
  const dates = lastNDates(90);
  const [rows, makeups] = await Promise.all([
    prisma.practiceDailySummary.groupBy({
      by: ['date'],
      where: { userId, date: { in: dates }, count: { gt: 0 } },
      _sum: { count: true },
    }),
    prisma.practiceMakeup.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true },
    }),
  ]);
  // 有真实计数 或 有补签 的日都算「已打卡」
  const set = new Set<string>([...rows.map((r) => r.date), ...makeups.map((m) => m.date)]);
  // 从今天往前数连续
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (set.has(dates[i]!)) streak++;
    else break;
  }
  return streak;
}

/**
 * 批量算多用户 streak（班级 dashboard 用 · 替代逐人 calcStreak 的 N+1）。
 * 全程 2 条查询（groupBy + findMany 各一），按用户在内存里折算。
 */
export async function calcStreaksBatch(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (userIds.length === 0) return result;
  const dates = lastNDates(90);
  const [rows, makeups] = await Promise.all([
    prisma.practiceDailySummary.groupBy({
      by: ['userId', 'date'],
      where: { userId: { in: userIds }, date: { in: dates }, count: { gt: 0 } },
      _sum: { count: true },
    }),
    prisma.practiceMakeup.findMany({
      where: { userId: { in: userIds }, date: { in: dates } },
      select: { userId: true, date: true },
    }),
  ]);
  const byUser = new Map<string, Set<string>>();
  const mark = (uid: string, d: string) => {
    let set = byUser.get(uid);
    if (!set) { set = new Set(); byUser.set(uid, set); }
    set.add(d);
  };
  for (const r of rows) mark(r.userId, r.date);
  for (const m of makeups) mark(m.userId, m.date);
  for (const uid of userIds) {
    const set = byUser.get(uid) ?? new Set<string>();
    let streak = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (set.has(dates[i]!)) streak++;
      else break;
    }
    result.set(uid, streak);
  }
  return result;
}
