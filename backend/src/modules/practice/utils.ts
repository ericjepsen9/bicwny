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

/** 算用户连续修学天数（任意大类有计数即算 +1 · 不要求达成目标） */
export async function calcStreak(prisma: PrismaClient, userId: string): Promise<number> {
  // 取最近 90 天（足够覆盖大多数 streak） · 前端展示如想看 365 后期再扩
  const dates = lastNDates(90);
  // group by date
  const rows = await prisma.practiceDailySummary.groupBy({
    by: ['date'],
    where: { userId, date: { in: dates }, count: { gt: 0 } },
    _sum: { count: true },
  });
  const set = new Set(rows.map((r) => r.date));
  // 从今天往前数连续
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (set.has(dates[i]!)) streak++;
    else break;
  }
  return streak;
}
