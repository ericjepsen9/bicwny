// 全应用统一时区 · 纽约（America/New_York · 含夏令时 EST/EDT 自动切换）
//   "日历日 / 周 / 月" 一律按纽约墙上时钟切分 · 替代原先的 UTC 锚定（审计 D7/D8）
//   纽约有夏令时 · 不能用固定偏移 · 一律走 Intl.DateTimeFormat
//
//   注意：DB 的 DateTime 列是 timestamp(无时区) 存 UTC · 若要在 SQL 内按纽约日分桶需：
//     to_char(("col" AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'YYYY-MM-DD')
export const APP_TIMEZONE = 'America/New_York';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 时刻 d 在纽约时区的日历日 'YYYY-MM-DD' */
export function zonedDateKey(d: Date = new Date()): string {
  return dayFmt.format(d); // en-CA → 'YYYY-MM-DD'
}

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0=Sun .. 6=Sat
}

/** 时刻 d 在纽约时区的 年/月/日/时/分/秒/星期 */
export function zonedParts(d: Date = new Date()): ZonedParts {
  const map: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(d)) map[p.type] = p.value;
  let hour = Number(map.hour);
  if (hour === 24) hour = 0; // 某些引擎午夜返回 '24'
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY[map.weekday ?? 'Sun'] ?? 0,
  };
}

/** 纽约时区的星期（0=周日 .. 6=周六） */
export function zonedWeekday(d: Date = new Date()): number {
  return zonedParts(d).weekday;
}

/** 'YYYY-MM-DD' 加减 n 个日历日 · 纯标签运算（UTC 正午锚点 · 避开 DST 边界） */
export function addDaysToDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** 最近 n 个纽约日历日的 'YYYY-MM-DD' · 升序 [today-n+1 .. today] */
export function lastNZonedDates(n: number): string[] {
  const today = zonedDateKey();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDaysToDateKey(today, -i));
  return out;
}

/** 纽约墙上时间 (y, m0[0-11], d, hh, mm, ss) 对应的 UTC 时刻 */
export function zonedTimeToUtc(y: number, m0: number, d: number, hh = 0, mm = 0, ss = 0): Date {
  const guess = Date.UTC(y, m0, d, hh, mm, ss);
  return new Date(guess - tzOffsetMs(new Date(guess)));
}

/** 给定时刻 · 纽约墙上时钟相对 UTC 的偏移(ms)（EDT≈-4h · EST≈-5h） */
function tzOffsetMs(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}
