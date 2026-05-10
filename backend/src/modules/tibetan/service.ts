// 藏历服务 · 按月查询 / 按日查询 / admin 编辑
import type { Prisma, PrismaClient } from '@prisma/client';
import type { TibetanDayDto, TibetanTag } from './types.js';

function rowToDto(row: {
  date: Date;
  lunar: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary: boolean;
  tags: Prisma.JsonValue;
  auspicious: boolean;
  events: Prisma.JsonValue;
  publicHoliday: string | null;
}): TibetanDayDto {
  return {
    date: row.date.toISOString().slice(0, 10),
    lunar: row.lunar,
    tibetan: row.tibetan,
    tibetanMonth: row.tibetanMonth,
    isIntercalary: row.isIntercalary,
    tags: (Array.isArray(row.tags) ? row.tags : []) as TibetanTag[],
    auspicious: row.auspicious,
    events: Array.isArray(row.events) ? (row.events as string[]) : [],
    publicHoliday: row.publicHoliday,
  };
}

// 检查 client 是否含 TibetanDay model（生产 prisma generate 没跑时为 undefined）
function modelReady(prisma: PrismaClient): boolean {
  return typeof (prisma as { tibetanDay?: { findMany?: unknown } }).tibetanDay?.findMany === 'function';
}

// 表未创建时（生产 db push 没跑）静默降级 · 否则正常抛错
function isTableMissing(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const code = (e as { code?: string }).code;
  const msg = (e as { message?: string }).message ?? '';
  // Prisma P2021 = table not found · Postgres 42P01 = relation does not exist
  return code === 'P2021' || /TibetanDay|relation .* does not exist/i.test(msg);
}

/** 按 YYYY-MM 取月内全部日 */
export async function listMonth(prisma: PrismaClient, ym: string): Promise<TibetanDayDto[]> {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return [];
  if (!modelReady(prisma)) return [];
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  try {
    const rows = await prisma.tibetanDay.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });
    return rows.map(rowToDto);
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

/** 取某一天 */
export async function getDay(prisma: PrismaClient, date: string): Promise<TibetanDayDto | null> {
  const d = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (!modelReady(prisma)) return null;
  try {
    const row = await prisma.tibetanDay.findUnique({ where: { date: d } });
    return row ? rowToDto(row) : null;
  } catch (e) {
    if (isTableMissing(e)) return null;
    throw e;
  }
}

/** 取「今天」（UTC · 与 seed 一致） */
export async function getToday(prisma: PrismaClient): Promise<TibetanDayDto | null> {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  return getDay(prisma, ymd);
}

/** 取「今日 + 未来 N 天」窗口（首页 widget） */
export async function getUpcoming(prisma: PrismaClient, days = 7): Promise<TibetanDayDto[]> {
  if (!modelReady(prisma)) return [];
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const end = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  try {
    const rows = await prisma.tibetanDay.findMany({
      where: { date: { gte: today, lt: end } },
      orderBy: { date: 'asc' },
    });
    return rows.map(rowToDto);
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export interface UpsertTibetanInput {
  date: string;
  lunar: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary?: boolean;
  tags?: TibetanTag[];
  auspicious?: boolean;
  events?: string[];
  publicHoliday?: string | null;
}

export async function upsertDay(
  prisma: PrismaClient,
  input: UpsertTibetanInput,
): Promise<TibetanDayDto> {
  const d = new Date(`${input.date}T00:00:00.000Z`);
  const data = {
    lunar: input.lunar,
    tibetan: input.tibetan,
    tibetanMonth: input.tibetanMonth,
    isIntercalary: input.isIntercalary ?? false,
    tags: (input.tags ?? []) as Prisma.InputJsonValue,
    auspicious: input.auspicious ?? false,
    events: (input.events ?? []) as Prisma.InputJsonValue,
    publicHoliday: input.publicHoliday ?? null,
  };
  const row = await prisma.tibetanDay.upsert({
    where: { date: d },
    create: { date: d, ...data },
    update: data,
  });
  return rowToDto(row);
}

export async function deleteDay(prisma: PrismaClient, date: string): Promise<void> {
  const d = new Date(`${date}T00:00:00.000Z`);
  await prisma.tibetanDay.delete({ where: { date: d } }).catch(() => undefined);
}
