// 用户 push 偏好 service（spec §8）
//   - getPushPreference: 取 · 不存在则建默认行
//   - updatePushPreference: 改 · 部分字段 patch
//   - canSendPushTo: dispatchToUsers 内部用 · 判断单用户单事件 type 是否允许 push
//
// 与现有 NotificationRule 表区别:
//   - NotificationRule: platform/class/assignment scope 的默认时段（cron 调度用）
//   - NotificationPreference: 单用户的 push 总开关 + per-type 子开关 + 玻璃文字偏好
import type { NotificationPreference, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { BadRequest } from '../../lib/errors.js';
import { inQuietHours, userLocalTime } from '../scheduler/time-utils.js';

/**
 * 取用户 push 偏好 · 不存在则建默认行（spec §8）
 */
export async function getPushPreference(userId: string): Promise<NotificationPreference> {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  // 首次访问 · 用默认值建行
  // createMany skipDuplicates 防并发竞争（两个请求同时初始化）
  try {
    return await prisma.notificationPreference.create({
      data: { userId },
    });
  } catch (e) {
    // P2002 unique violation = 并发已建 · 再读一次
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
      const r = await prisma.notificationPreference.findUnique({ where: { userId } });
      if (r) return r;
    }
    throw e;
  }
}

export interface UpdatePushPreferenceInput {
  pushEnabled?: boolean;
  // partial pushTypes · merge into existing JSON · 不删除其它键
  // value=true 表示「显式开启该 type」· 实际上等同删除（缺省=开）· 简化：只接受 false
  // 前端想再次开启则 value=true（写入但效果上等同删除）· 用 patchPushTypes 处理 merge 逻辑
  pushTypes?: Record<string, boolean>;
  homeCardEnabled?: boolean;
  auspiciousDayCard?: boolean;
}

export async function updatePushPreference(
  userId: string,
  patch: UpdatePushPreferenceInput,
): Promise<NotificationPreference> {
  const existing = await getPushPreference(userId);
  const data: Prisma.NotificationPreferenceUpdateInput = {};
  if (patch.pushEnabled !== undefined) data.pushEnabled = patch.pushEnabled;
  if (patch.homeCardEnabled !== undefined) data.homeCardEnabled = patch.homeCardEnabled;
  if (patch.auspiciousDayCard !== undefined) data.auspiciousDayCard = patch.auspiciousDayCard;
  if (patch.pushTypes !== undefined) {
    // merge：把 patch.pushTypes 合并到 existing.pushTypes
    const current = (existing.pushTypes as Record<string, boolean> | null) ?? {};
    const merged: Record<string, boolean> = { ...current };
    for (const [k, v] of Object.entries(patch.pushTypes)) {
      if (v === true) {
        // true = 开启 · 等同删除该键（缺省 = 开）
        delete merged[k];
      } else if (v === false) {
        merged[k] = false;
      } else {
        throw BadRequest('pushTypes value 必须是 boolean');
      }
    }
    data.pushTypes = merged as Prisma.InputJsonValue;
  }
  return prisma.notificationPreference.update({
    where: { userId },
    data,
  });
}

/**
 * dispatchToUsers L2 · 判单用户单 eventKind 是否允许 push
 * 返回 false 时该用户 push 被跳过（站内 inbox 仍写）
 * 不存在 NotificationPreference 行 · 默认全开（兼容旧用户）
 */
export async function canSendPushTo(userId: string, eventKind: string): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: { pushEnabled: true, pushTypes: true },
  });
  if (!pref) return true; // 未建行 · 默认允许（缺省=开）
  if (!pref.pushEnabled) return false; // 总开关关
  const types = pref.pushTypes as Record<string, boolean> | null;
  if (types && types[eventKind] === false) return false; // per-type 显式关
  return true;
}

/**
 * 批量过滤 · dispatchToUsers fan-out 时用
 * 返回允许 push 的 userIds 子集
 */
export async function filterUsersAllowingPush(
  userIds: string[],
  eventKind: string,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  // 一次性查所有用户的偏好
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, pushEnabled: true, pushTypes: true },
  });
  // 建 map · 缺省 = 允许
  const blocked = new Set<string>();
  for (const p of prefs) {
    if (!p.pushEnabled) {
      blocked.add(p.userId);
      continue;
    }
    const types = p.pushTypes as Record<string, boolean> | null;
    if (types && types[eventKind] === false) {
      blocked.add(p.userId);
    }
  }
  return userIds.filter((u) => !blocked.has(u));
}

/**
 * 静默时段过滤（spec §5 L3）
 *   - critical → 跳过过滤 · 立即发送（无视静默）
 *   - normal / urgent → 落在用户本地静默时段内则跳过 push
 *     · 站内 inbox 仍写 · 用户次日打开 app 可见
 *   - v3 优化：normal 延迟到次日 07:00 聚合发 / urgent 延迟到静默结束单独发
 *     现 v2 实现：静默期跳过 push · 等同「延迟到用户主动看 app」· 接受
 *
 * 用户 quietHoursStart === quietHoursEnd 视为关闭静默 · 走默认 22-7
 *   说明：v1 设计 default 22-7 已写在 schema · null/未设的用户默认有静默时段
 */
export async function filterUsersOutsideQuietHours(
  userIds: string[],
  severity: 'normal' | 'urgent' | 'critical',
  now: Date = new Date(),
): Promise<string[]> {
  if (userIds.length === 0) return [];
  if (severity === 'critical') return userIds; // critical 无视静默

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, timezone: true, quietHoursStart: true, quietHoursEnd: true },
  });
  const blocked = new Set<string>();
  for (const u of users) {
    const local = userLocalTime(now, u.timezone ?? 'Asia/Shanghai');
    if (inQuietHours(local.hour, u.quietHoursStart, u.quietHoursEnd)) {
      blocked.add(u.id);
    }
  }
  return userIds.filter((u) => !blocked.has(u));
}
