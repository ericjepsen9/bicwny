// 时区时间工具 · 把 UTC 时刻折算到用户本地 IANA tz 下的"小时/星期/日期"
//   - cron tick 用：判断每个用户本地是不是 19:00 / 20:00 / 周一 08:00
//   - DispatchLog eventId 用：YYYY-MM-DD（日报/临期）· YYYY-Www（周报）
//   - 无效 tz 退回 UTC · 不抛
//
// 节俭原则：Intl.DateTimeFormat 在 hot loop 中性能 OK（V8 缓存）· 不需要预热

export interface UserLocalTime {
  hour: number;    // 0-23
  minute: number;  // 0-59
  weekday: number; // 1-7（ISO · 1=Mon, 7=Sun）
  ymd: string;     // 'YYYY-MM-DD' · 用户本地日期
  isoWeek: string; // 'YYYY-Www' · ISO 周编号 · 周报 dedup 用
}

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

/**
 * 算用户本地时间 · 抗 tz 字符串错误
 * @param now JS Date 实例（UTC 内部存储 · 由 Intl 折算）
 * @param tz IANA 时区字符串（e.g. 'America/Los_Angeles'）
 */
export function userLocalTime(now: Date, tz: string): UserLocalTime {
  let safeTz = tz;
  // 简单 sanity check · Intl 不识别会 throw RangeError
  try {
    // 用 'en-CA' 出来是 'YYYY-MM-DD' 顺序（ISO 友好）
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: safeTz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = dtf.formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    let hour = parseInt(get('hour'), 10);
    // Chrome 在 hour12:false 下偶尔返回 '24:xx' (午夜) · 折回 0
    if (hour === 24) hour = 0;
    const minute = parseInt(get('minute'), 10);
    const weekdayKey = get('weekday');
    const weekday = WEEKDAY_MAP[weekdayKey] ?? 1;
    const ymd = `${year}-${month}-${day}`;
    const isoWeek = computeIsoWeek(year, month, day);
    return { hour, minute, weekday, ymd, isoWeek };
  } catch {
    // 无效 tz · 退 UTC 重算一次
    if (safeTz !== 'UTC') return userLocalTime(now, 'UTC');
    // UTC 也炸 · 不可能 · 给个安全默认
    return { hour: 0, minute: 0, weekday: 1, ymd: '1970-01-01', isoWeek: '1970-W01' };
  }
}

/**
 * 算 ISO 8601 周编号 · 接受用户本地日期字符串
 * 算法：取目标日期最近的周四 · 该周四所在年 + 该周四是该年第几周
 */
function computeIsoWeek(year: string, month: string, day: string): string {
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const dayNum = d.getUTCDay() || 7; // 周日=0 → 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 推到最近的周四
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * 静默时段判断 · 跨午夜支持（22:00-07:00 即 start > end）
 * start === end 视为关闭静默
 */
export function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false; // 关闭静默
  if (start < end) return hour >= start && hour < end;
  // 跨午夜：22-7 → 22 <= h <= 23 OR 0 <= h < 7
  return hour >= start || hour < end;
}

/**
 * 用户本地 YYYY-MM-DD 的 UTC 范围（用于 query 当日聚合）
 * 返回 [startUtc, endUtc] · endUtc 是次日 00:00（半开区间）
 */
export function localDayRange(ymd: string, tz: string): { startUtc: Date; endUtc: Date } {
  // 用本地 00:00:00 反折算到 UTC
  // 做法：构造 'YYYY-MM-DDT00:00:00' 在用户 tz 下 · 用偏移逆推
  // 简化：迭代 1 次 · 算 tz 与 UTC 的当时偏移
  const [y, m, d] = ymd.split('-').map(Number);
  // 先用 UTC 假定 · 算这个 UTC 时刻在 tz 下显示几点
  const guessUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const local = userLocalTime(guessUtc, tz);
  // 按分钟算偏移（审计）· 否则 +5:30 印度 / +5:45 尼泊尔 等半/三刻钟时区会丢 30~45 分钟
  const localMinutes = local.hour * 60 + local.minute;
  const offsetMinutes = local.ymd < ymd
    ? -((24 * 60) - localMinutes) // 负偏移：本地还停在前一天
    : localMinutes;               // 正偏移 / 零
  const startUtc = new Date(guessUtc.getTime() - offsetMinutes * 60_000);
  const endUtc = new Date(startUtc.getTime() + 86400_000);
  return { startUtc, endUtc };
}

/**
 * 用户本地"上周"的 UTC 范围 · 周报数据用
 * 上周 = 截至本周一 00:00 之前的 7 天
 */
export function lastWeekRange(now: Date, tz: string): { startUtc: Date; endUtc: Date } {
  const local = userLocalTime(now, tz);
  // 本周一 00:00 = 本地 ymd 减 (weekday-1) 天 · 再取 00:00
  const [y, m, d] = local.ymd.split('-').map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const daysSinceMonday = local.weekday - 1;
  const thisMondayUtc = new Date(todayUtc.getTime() - daysSinceMonday * 86400_000);
  const lastMondayUtc = new Date(thisMondayUtc.getTime() - 7 * 86400_000);
  // 这俩是"本地 ymd 的 UTC 0 点"占位 · 需折成"用户本地 00:00 的 UTC 时刻"
  const fmt = (utc: Date) => {
    const yr = utc.getUTCFullYear();
    const mo = String(utc.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(utc.getUTCDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  };
  const startRange = localDayRange(fmt(lastMondayUtc), tz);
  const endRange = localDayRange(fmt(thisMondayUtc), tz);
  return { startUtc: startRange.startUtc, endUtc: endRange.startUtc };
}
