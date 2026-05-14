// 个人提醒 · 三档 tick 实现
//   - 每分钟 cron tick 调用一次 · 内部按用户 timezone 命中本地 hour/weekday
//   - 命中后查 buildPayload 评估是否真发 · null 跳过
//   - DispatchLog 幂等：eventKind + eventId(YYYY-MM-DD 或 YYYY-Www) + tier('-') + userId 唯一
//   - 静默时段在 dispatch 入口处兜底拦截（19/20/8 默认时段都在白天外 · 一般不会拦）
//
// 设计取舍：
//   - 每分钟扫描全部 isActive 用户 · 内存里折算每人本地 hour
//   - 1000 用户/分钟 · 每用户 Intl.DateTimeFormat 调用一次 · 性能足够
//   - 真正贵的是数据库查询（buildPayload）· 仅对命中 hour 的用户跑
import type { PrismaClient } from '@prisma/client';
import { dispatchToUsers } from './dispatch.js';
import { inQuietHours, userLocalTime } from './time-utils.js';
import {
  buildDailyDigestPayload,
  buildEveningDuePayload,
  buildWeeklyReportPayload,
} from './reminder-queries.js';

// 代码硬编码兜底（用户/平台都没设时）
const FALLBACK_EVENING_HOUR = 19;
const FALLBACK_DAILY_HOUR = 20;
const FALLBACK_WEEKLY_HOUR = 8;
const FALLBACK_WEEKLY_WEEKDAY = 1; // ISO Mon

// tick 窗口：分钟级匹配 · 即"本地 hour === target && minute < 30"
//   cron 每分钟跑 · 窗口 0-29 分钟 = 该 hour 的前半段
//   理由：60s tick 漂移 · 用前半段一次性扫完该 hour 内的所有用户 · 后半段不再发
//   反例：若窗口 0-59 · 进程在 hh:30 启动会漏 hh:00 那批 · 但 hh:31 启动又会重复扫 hh:00
//   ── 配合 DispatchLog 幂等 · 实际不会重复发 · 但减少无谓 query
const TICK_MINUTE_WINDOW = 30;

interface ResolvedHours {
  eveningHour: number;
  dailyHour: number;
  weeklyHour: number;
  weeklyWeekday: number;
}

/**
 * 拉平台默认 hour（NotificationRule scope=platform）· 给用户字段缺省时用
 *   - 每次 tick 调用 · 单 query · 结果缓存在 tick 内
 */
async function resolvePlatformHours(prisma: PrismaClient): Promise<ResolvedHours> {
  const rules = await prisma.notificationRule.findMany({
    where: { scope: 'platform', isActive: true, classId: null, assignmentId: null },
  });
  let evening = FALLBACK_EVENING_HOUR;
  let daily = FALLBACK_DAILY_HOUR;
  let weekly = FALLBACK_WEEKLY_HOUR;
  let weeklyDay = FALLBACK_WEEKLY_WEEKDAY;
  for (const r of rules) {
    if (r.triggerType === 'evening-due' && r.defaultHour != null) evening = r.defaultHour;
    if (r.triggerType === 'daily-digest' && r.defaultHour != null) daily = r.defaultHour;
    if (r.triggerType === 'weekly-report') {
      if (r.defaultHour != null) weekly = r.defaultHour;
      if (r.defaultWeekday != null) weeklyDay = r.defaultWeekday;
    }
  }
  return { eveningHour: evening, dailyHour: daily, weeklyHour: weekly, weeklyWeekday: weeklyDay };
}

/**
 * 综合三档 · 给定用户算"现在该不该发哪档"
 *   - 同一 tick 可能同时命中两档（理论不会因为 hour 不同 · 但兜底）
 *   - 返回 'evening-due' | 'daily-digest' | 'weekly-report' | null
 */
type Trigger = 'evening-due' | 'daily-digest' | 'weekly-report';

function resolveUserTrigger(
  user: {
    eveningReminderEnabled: boolean;
    eveningReminderHour: number | null;
    dailyDigestEnabled: boolean;
    dailyDigestHour: number | null;
    weeklyReportEnabled: boolean;
    weeklyReportHour: number | null;
    weeklyReportWeekday: number | null;
    quietHoursStart: number;
    quietHoursEnd: number;
  },
  localHour: number,
  localMinute: number,
  localWeekday: number,
  platform: ResolvedHours,
): Trigger | null {
  // 仅在 hour 的前半段触发
  if (localMinute >= TICK_MINUTE_WINDOW) return null;
  // 静默时段兜底拦截
  if (inQuietHours(localHour, user.quietHoursStart, user.quietHoursEnd)) return null;

  if (user.weeklyReportEnabled) {
    const day = user.weeklyReportWeekday ?? platform.weeklyWeekday;
    const hr = user.weeklyReportHour ?? platform.weeklyHour;
    if (localWeekday === day && localHour === hr) return 'weekly-report';
  }
  if (user.eveningReminderEnabled) {
    const hr = user.eveningReminderHour ?? platform.eveningHour;
    if (localHour === hr) return 'evening-due';
  }
  if (user.dailyDigestEnabled) {
    const hr = user.dailyDigestHour ?? platform.dailyHour;
    if (localHour === hr) return 'daily-digest';
  }
  return null;
}

/**
 * 个人提醒 tick · 由 cron.ts 主 tick 调用
 *   - 拉所有 isActive 用户 · 算每人本地时刻
 *   - 命中三档之一 → 查数据 → dispatch
 */
export async function tickPersonalReminders(prisma: PrismaClient): Promise<void> {
  const now = new Date();
  const platform = await resolvePlatformHours(prisma);

  // 拉所有活跃用户 · 仅取需要的字段
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      timezone: true,
      eveningReminderEnabled: true,
      eveningReminderHour: true,
      dailyDigestEnabled: true,
      dailyDigestHour: true,
      weeklyReportEnabled: true,
      weeklyReportHour: true,
      weeklyReportWeekday: true,
      quietHoursStart: true,
      quietHoursEnd: true,
    },
  });

  // 分桶：3 个 trigger 各自的命中用户列表
  type Hit = { userId: string; tz: string; ymd: string; isoWeek: string };
  const eveningHits: Hit[] = [];
  const dailyHits: Hit[] = [];
  const weeklyHits: Hit[] = [];

  for (const u of users) {
    const local = userLocalTime(now, u.timezone);
    const trigger = resolveUserTrigger(u, local.hour, local.minute, local.weekday, platform);
    if (!trigger) continue;
    const hit: Hit = { userId: u.id, tz: u.timezone, ymd: local.ymd, isoWeek: local.isoWeek };
    if (trigger === 'evening-due') eveningHits.push(hit);
    else if (trigger === 'daily-digest') dailyHits.push(hit);
    else weeklyHits.push(hit);
  }

  // 并发执行三档（每档内部串行 · 节省 DB 压力）
  await Promise.all([
    runEveningDue(prisma, eveningHits, now),
    runDailyDigest(prisma, dailyHits, now),
    runWeeklyReport(prisma, weeklyHits, now),
  ]);
}

async function runEveningDue(
  prisma: PrismaClient,
  hits: Array<{ userId: string; tz: string; ymd: string }>,
  _now: Date,
): Promise<void> {
  if (hits.length === 0) return;
  for (const h of hits) {
    try {
      // 幂等：相同 eventId(=ymd) 命中已发则跳
      const already = await prisma.notificationDispatchLog.findUnique({
        where: {
          eventKind_eventId_tier_userId: {
            eventKind: 'evening-due',
            eventId: h.ymd,
            tier: '-',
            userId: h.userId,
          },
        },
      });
      if (already) continue;

      const payload = await buildEveningDuePayload(prisma, h.userId, h.ymd, h.tz);
      if (!payload) continue;

      await dispatchToUsers({
        prisma,
        eventKind: 'evening-due',
        eventId: h.ymd,
        tier: '-',
        userIds: [h.userId],
        title: payload.title,
        body: payload.body,
        link: payload.link,
        notificationType: 'reminder',
      });
    } catch (e) {
      console.error('[scheduler] evening-due failed user=', h.userId, e);
    }
  }
}

async function runDailyDigest(
  prisma: PrismaClient,
  hits: Array<{ userId: string; tz: string; ymd: string }>,
  _now: Date,
): Promise<void> {
  if (hits.length === 0) return;
  for (const h of hits) {
    try {
      const already = await prisma.notificationDispatchLog.findUnique({
        where: {
          eventKind_eventId_tier_userId: {
            eventKind: 'daily-digest',
            eventId: h.ymd,
            tier: '-',
            userId: h.userId,
          },
        },
      });
      if (already) continue;

      const payload = await buildDailyDigestPayload(prisma, h.userId, h.ymd, h.tz);
      if (!payload) continue;

      await dispatchToUsers({
        prisma,
        eventKind: 'daily-digest',
        eventId: h.ymd,
        tier: '-',
        userIds: [h.userId],
        title: payload.title,
        body: payload.body,
        link: payload.link,
        notificationType: 'reminder',
      });
    } catch (e) {
      console.error('[scheduler] daily-digest failed user=', h.userId, e);
    }
  }
}

async function runWeeklyReport(
  prisma: PrismaClient,
  hits: Array<{ userId: string; tz: string; isoWeek: string }>,
  now: Date,
): Promise<void> {
  if (hits.length === 0) return;
  for (const h of hits) {
    try {
      const already = await prisma.notificationDispatchLog.findUnique({
        where: {
          eventKind_eventId_tier_userId: {
            eventKind: 'weekly-report',
            eventId: h.isoWeek,
            tier: '-',
            userId: h.userId,
          },
        },
      });
      if (already) continue;

      const payload = await buildWeeklyReportPayload(prisma, h.userId, now, h.tz);
      if (!payload) continue;

      await dispatchToUsers({
        prisma,
        eventKind: 'weekly-report',
        eventId: h.isoWeek,
        tier: '-',
        userIds: [h.userId],
        title: payload.title,
        body: payload.body,
        link: payload.link,
        notificationType: 'reminder',
      });
    } catch (e) {
      console.error('[scheduler] weekly-report failed user=', h.userId, e);
    }
  }
}

/**
 * Admin / 测试用：直接给某用户触发一档 · 绕过时段判断 · 用 DispatchLog 仍然幂等
 *   - 用于 /admin/notification-rules 测试发送按钮
 *   - 强制 eventId 为 'manual:{timestamp}' 避免和定时发送冲突
 */
export async function triggerManualReminder(
  prisma: PrismaClient,
  userId: string,
  kind: Trigger,
): Promise<{ sent: boolean; reason?: string }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, timezone: true },
  });
  if (!u) return { sent: false, reason: 'user-not-found' };

  const local = userLocalTime(new Date(), u.timezone);
  const now = new Date();
  let payload;
  let eventId;
  if (kind === 'evening-due') {
    payload = await buildEveningDuePayload(prisma, u.id, local.ymd, u.timezone);
    eventId = `manual-${local.ymd}-${Date.now()}`;
  } else if (kind === 'daily-digest') {
    payload = await buildDailyDigestPayload(prisma, u.id, local.ymd, u.timezone);
    eventId = `manual-${local.ymd}-${Date.now()}`;
  } else {
    payload = await buildWeeklyReportPayload(prisma, u.id, now, u.timezone);
    eventId = `manual-${local.isoWeek}-${Date.now()}`;
  }
  if (!payload) return { sent: false, reason: 'no-payload' };

  await dispatchToUsers({
    prisma,
    eventKind: kind,
    eventId,
    tier: '-',
    userIds: [u.id],
    title: payload.title,
    body: payload.body,
    link: payload.link,
    notificationType: 'reminder',
  });
  return { sent: true };
}
