// 通知偏好 + 规则配置 HTTP 路由
//   GET   /api/my/notification-prefs                  学员看自己偏好（含解析后的"最终时段"）
//   PATCH /api/my/notification-prefs                  学员改偏好
//   GET   /api/admin/notification-rules               admin 看平台默认规则
//   PUT   /api/admin/notification-rules               admin upsert 平台规则（按 triggerType 覆盖）
//   POST  /api/admin/notification-test                admin 给某 user 手工触发一档（测试用）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId, requireRole } from '../../lib/auth.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { triggerManualReminder } from '../scheduler/personal-reminders.js';
import { getPushPreference, updatePushPreference } from './push-prefs.service.js';

const TAGS_USER = ['Notification Prefs'];
const TAGS_ADMIN = ['Admin · Notification Rules'];
const SEC = [{ bearerAuth: [] as string[] }];

const hourSchema = z.number().int().min(0).max(23);
const weekdaySchema = z.number().int().min(1).max(7);

const updatePrefsSchema = z.object({
  eveningReminderEnabled: z.boolean().optional(),
  eveningReminderHour: hourSchema.nullable().optional(),
  dailyDigestEnabled: z.boolean().optional(),
  dailyDigestHour: hourSchema.nullable().optional(),
  weeklyReportEnabled: z.boolean().optional(),
  weeklyReportHour: hourSchema.nullable().optional(),
  weeklyReportWeekday: weekdaySchema.nullable().optional(),
  quietHoursStart: hourSchema.optional(),
  quietHoursEnd: hourSchema.optional(),
  timezone: z.string().min(1).max(64).optional(),
});

const TRIGGER_TYPES = ['evening-due', 'daily-digest', 'weekly-report'] as const;
const upsertRuleSchema = z.object({
  triggerType: z.enum(TRIGGER_TYPES),
  defaultHour: hourSchema.nullable().optional(),
  defaultWeekday: weekdaySchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

const testTriggerSchema = z.object({
  userId: z.string().min(1),
  kind: z.enum(TRIGGER_TYPES),
});

interface PlatformDefaults {
  eveningHour: number;
  dailyHour: number;
  weeklyHour: number;
  weeklyWeekday: number;
}

const FALLBACK: PlatformDefaults = {
  eveningHour: 19,
  dailyHour: 20,
  weeklyHour: 8,
  weeklyWeekday: 1,
};

async function resolvePlatformDefaults(): Promise<PlatformDefaults> {
  const rules = await prisma.notificationRule.findMany({
    where: { scope: 'platform', isActive: true, classId: null, assignmentId: null },
  });
  const out = { ...FALLBACK };
  for (const r of rules) {
    if (r.triggerType === 'evening-due' && r.defaultHour != null) out.eveningHour = r.defaultHour;
    if (r.triggerType === 'daily-digest' && r.defaultHour != null) out.dailyHour = r.defaultHour;
    if (r.triggerType === 'weekly-report') {
      if (r.defaultHour != null) out.weeklyHour = r.defaultHour;
      if (r.defaultWeekday != null) out.weeklyWeekday = r.defaultWeekday;
    }
  }
  return out;
}

export const notificationPrefsRoutes: FastifyPluginAsync = async (app) => {
  // ─── 学员 ───
  app.get('/api/my/notification-prefs', {
    schema: { tags: TAGS_USER, summary: '本人通知偏好 + 平台默认快照', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const [user, platform] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
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
      }),
      resolvePlatformDefaults(),
    ]);
    if (!user) throw NotFound('user-not-found');
    return {
      data: {
        prefs: user,
        platformDefaults: platform,
        // 最终解析后的时段（给前端 UI 显示 placeholder 用）
        resolved: {
          eveningHour: user.eveningReminderHour ?? platform.eveningHour,
          dailyHour: user.dailyDigestHour ?? platform.dailyHour,
          weeklyHour: user.weeklyReportHour ?? platform.weeklyHour,
          weeklyWeekday: user.weeklyReportWeekday ?? platform.weeklyWeekday,
        },
      },
    };
  });

  app.patch('/api/my/notification-prefs', {
    schema: { tags: TAGS_USER, summary: '改本人通知偏好', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = updatePrefsSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法');
    const data = parsed.data;
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
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
    return { data: updated };
  });

  // ─── Push 偏好 v2（spec §8 NotificationPreference）─────────────
  // 与 /api/my/notification-prefs 区别:
  //   notification-prefs: 个人提醒时段 + 静默时段（v1 · 写在 User 表）
  //   push-preferences: push 总开关 + per-type 子开关 + 玻璃文字偏好（v2 · NotificationPreference 表）
  app.get('/api/my/push-preferences', {
    schema: { tags: TAGS_USER, summary: 'v2 push 偏好（总开关 + per-type 子开关 + 玻璃文字）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const pref = await getPushPreference(userId);
    return {
      data: {
        pushEnabled: pref.pushEnabled,
        pushTypes: pref.pushTypes ?? {},
        homeCardEnabled: pref.homeCardEnabled,
        auspiciousDayCard: pref.auspiciousDayCard,
      },
    };
  });

  const updatePushPrefsSchema = z.object({
    pushEnabled: z.boolean().optional(),
    // pushTypes value: true = 开（等同删除该键 · 缺省 = 开）· false = 显式关
    pushTypes: z.record(z.string(), z.boolean()).optional(),
    homeCardEnabled: z.boolean().optional(),
    auspiciousDayCard: z.boolean().optional(),
  });

  app.patch('/api/my/push-preferences', {
    schema: { tags: TAGS_USER, summary: '改 v2 push 偏好（partial patch）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = updatePushPrefsSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法');
    const updated = await updatePushPreference(userId, parsed.data);
    return {
      data: {
        pushEnabled: updated.pushEnabled,
        pushTypes: updated.pushTypes ?? {},
        homeCardEnabled: updated.homeCardEnabled,
        auspiciousDayCard: updated.auspiciousDayCard,
      },
    };
  });

  // ─── Admin · 平台规则 ───
  app.get('/api/admin/notification-rules', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS_ADMIN, summary: '平台默认通知规则列表', security: SEC },
  }, async () => {
    const rules = await prisma.notificationRule.findMany({
      where: { scope: 'platform', classId: null, assignmentId: null },
      orderBy: { triggerType: 'asc' },
    });
    return { data: { rules, fallback: FALLBACK } };
  });

  // PUT 行为：按 triggerType upsert · 同一 triggerType 只保留一条 active
  app.put('/api/admin/notification-rules', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS_ADMIN, summary: 'upsert 平台规则（按 triggerType）', security: SEC },
  }, async (req) => {
    const parsed = upsertRuleSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法');
    const { triggerType, defaultHour, defaultWeekday, isActive } = parsed.data;
    const rule = await prisma.notificationRule.upsert({
      where: {
        scope_triggerType_classId_assignmentId: {
          scope: 'platform',
          triggerType,
          classId: null as unknown as string, // composite unique 允许 null · TS narrowing 绕开
          assignmentId: null as unknown as string,
        },
      },
      create: {
        scope: 'platform',
        triggerType,
        defaultHour: defaultHour ?? null,
        defaultWeekday: defaultWeekday ?? null,
        isActive: isActive ?? true,
      },
      update: {
        defaultHour: defaultHour ?? null,
        defaultWeekday: defaultWeekday ?? null,
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    return { data: rule };
  });

  // ─── Admin · 手工触发测试 ───
  app.post('/api/admin/notification-test', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS_ADMIN, summary: '给指定用户手工触发一档（测试用 · 绕过时段）', security: SEC },
  }, async (req) => {
    const parsed = testTriggerSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法');
    const result = await triggerManualReminder(prisma, parsed.data.userId, parsed.data.kind);
    return { data: result };
  });
};
