// 补签 · 修学打卡 streak 补救（审计 D7/D8 后续）
//   规则：只能补「最近 7 天内、过去的某一天」· 每自然周(ET) 限 1 次
//   两条入口共用本模块的校验/配额逻辑：
//     1) 专用端点 POST /api/practice/makeup —— 纯保连续 · 不加计数（要求那天本是空白）
//     2) 批量录入回填过去日期 —— 既写计数也占同一份周配额（收紧原「无限回填」）
import type { Prisma, PrismaClient } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';
import { periodStart } from '../../lib/period.js';
import { addDaysToDateKey, zonedDateKey } from '../../lib/timezone.js';

export const MAKEUP_WINDOW_DAYS = 7;
export const MAKEUP_PER_WEEK = 1;

type Db = PrismaClient | Prisma.TransactionClient;

export interface MakeupStatus {
  perWeek: number;
  usedThisWeek: number;
  remaining: number;
  windowDays: number;
  earliestDate: string; // 可补的最早日（含）
  latestDate: string;   // 可补的最晚日（昨天）
  madeUpDates: string[]; // 窗口内已补签的目标日（前端标 ✓ · 避免补完仍显示成空缺）
}

/** 本周(ET)已用补签数 · 配额按 makeup.createdAt 落在哪个 ET 周计 */
async function usedThisWeek(db: Db, userId: string): Promise<number> {
  const weekStart = periodStart('week')!; // ET 本周一 00:00 的 UTC 时刻
  return db.practiceMakeup.count({ where: { userId, createdAt: { gte: weekStart } } });
}

export async function getMakeupStatus(db: Db, userId: string): Promise<MakeupStatus> {
  const today = zonedDateKey();
  const earliestDate = addDaysToDateKey(today, -MAKEUP_WINDOW_DAYS);
  const latestDate = addDaysToDateKey(today, -1);
  const [used, madeUp] = await Promise.all([
    usedThisWeek(db, userId),
    db.practiceMakeup.findMany({
      where: { userId, date: { gte: earliestDate, lte: latestDate } },
      select: { date: true },
    }),
  ]);
  return {
    perWeek: MAKEUP_PER_WEEK,
    usedThisWeek: used,
    remaining: Math.max(0, MAKEUP_PER_WEEK - used),
    windowDays: MAKEUP_WINDOW_DAYS,
    earliestDate,
    latestDate,
    madeUpDates: madeUp.map((m) => m.date),
  };
}

/** 校验单个补签目标日（格式 / 必须是过去 / 在窗口内）· today 为 ET 日键 */
export function assertMakeupDate(date: string, today: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw BadRequest('date 格式应为 YYYY-MM-DD');
  if (date >= today) throw BadRequest('补签只能针对过去的日期');
  if (date < addDaysToDateKey(today, -MAKEUP_WINDOW_DAYS)) {
    throw BadRequest(`只能补签最近 ${MAKEUP_WINDOW_DAYS} 天内`);
  }
}

/**
 * 专用补签：纯保连续 · 不写计数。
 * 要求目标日本是空白（无 count>0），否则无需补签。
 */
export async function createMakeup(prisma: PrismaClient, userId: string, date: string): Promise<MakeupStatus> {
  const today = zonedDateKey();
  assertMakeupDate(date, today);

  const hasCount = await prisma.practiceDailySummary.findFirst({
    where: { userId, date, count: { gt: 0 } },
    select: { id: true },
  });
  if (hasCount) throw BadRequest('那天已有修学记录 · 无需补签');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.practiceMakeup.findUnique({ where: { userId_date: { userId, date } } });
    if (existing) throw BadRequest('那天已补签过');
    if ((await usedThisWeek(tx, userId)) >= MAKEUP_PER_WEEK) {
      throw BadRequest(`本周补签额度已用完（每周 ${MAKEUP_PER_WEEK} 次）`);
    }
    await tx.practiceMakeup.create({ data: { userId, date } });
    return getMakeupStatus(tx, userId);
  });
}

/**
 * 批量录入回填过去日期时调用（事务内）：
 *   - 每个过去日校验窗口
 *   - 尚无 makeup 记录的「新补签日」占用本周配额 · 超额抛错（整批回滚）
 *   - 为新补签日建 makeup 账本行（去重靠 unique[userId,date]）
 * today 传入 ET 日键 · pastDates 为本批次里所有「非今天」的目标日。
 */
export async function reserveBackfillMakeups(
  tx: Prisma.TransactionClient,
  userId: string,
  pastDates: string[],
  today: string,
): Promise<void> {
  const distinct = [...new Set(pastDates)];
  if (distinct.length === 0) return;
  for (const d of distinct) assertMakeupDate(d, today);

  const existing = await tx.practiceMakeup.findMany({
    where: { userId, date: { in: distinct } },
    select: { date: true },
  });
  const existingSet = new Set(existing.map((e) => e.date));
  const newDates = distinct.filter((d) => !existingSet.has(d));
  if (newDates.length === 0) return;

  const used = await usedThisWeek(tx, userId);
  if (used + newDates.length > MAKEUP_PER_WEEK) {
    throw BadRequest(`回填/补签每周限 ${MAKEUP_PER_WEEK} 次 · 本周已用 ${used} 次`);
  }
  await tx.practiceMakeup.createMany({ data: newDates.map((d) => ({ userId, date: d })) });
}
