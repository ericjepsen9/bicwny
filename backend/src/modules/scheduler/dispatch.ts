// 推送派发工具 · 给一组用户写 inbox + 发 push · 自动跳过已派发
//   - 用 NotificationDispatchLog unique(eventKind, eventId, tier, userId, channel) 强一致幂等
//   - inbox 行 + push 发送原子相关 · push 失败仅日志 · 不回滚 inbox
//   - v2 扩展：severity / link 校验 / channel 通道粒度日志
import type { Prisma, PrismaClient } from '@prisma/client';
import { sendPushToUsers } from '../push/service.js';

// v1 类型保留作为 hint · v2 实际接受任意 string · 由调用方约定取值
// 取值规约见 NOTIFICATION_FINAL_SPEC.md §2 路由表
export type EventKind =
  | 'class_session'
  | 'class_announcement'
  | 'practice_task'
  | 'evening-due'
  | 'daily-digest'
  | 'weekly-report'
  | 'achievement'
  | 'system_announcement'
  | 'dharma_assembly'
  | 'membership_change'
  | (string & {}); // 允许扩展但保留类型提示
export type Tier = 'T-30' | 'T-5' | 'T0' | '-' | (string & {});
export type NotifType =
  | 'class_session'
  | 'class_session_soon'
  | 'class_announcement'
  | 'reminder'
  | 'achievement'
  | 'system'
  | (string & {});
export type Severity = 'normal' | 'urgent' | 'critical';

/**
 * 不发 push 的事件类型白名单（spec §3 ⑧ ⑨ + §5 L1 第一层过滤）
 * 这些事件仅写站内 Notification · 不通过 Web Push 触达手机系统通知栏
 *   - membership_change: 身份变动属于私密 · 不主动打扰
 *   - auspicious_day: 藏历加持日仅展示 · 不打扰（v3 实现）
 */
const NO_PUSH_EVENTS = new Set<string>([
  'membership_change',
  'auspicious_day',
]);

export interface DispatchInput {
  prisma: PrismaClient;
  eventKind: EventKind;
  eventId: string;
  tier: Tier;
  userIds: string[];
  title: string;
  body: string;
  link: string;                  // 应用内路径 · 必须 / 开头同源相对（见 isValidLink）
  notificationType: NotifType;   // 旧 enum 兼容 · 写入 Notification.type 列
  severity?: Severity;            // v2 · 默认 'normal'
  contentHash?: string;           // v2 · 公告等内容可变事件用 · dismissal 失效判定
}

export interface DispatchResult {
  newPushedUsers: number;     // 本次新派发的用户数
  alreadyDispatched: number;  // 已派发过的用户数（跳过）
  pushDelivered: number;      // web-push 实际推送成功数
  pushInvalid: number;        // 失效订阅
  pushFailed: number;         // 网络等失败
}

/**
 * Link 安全校验（spec §19.1）· 防 javascript: / data: / 跨源协议注入
 * 仅接受 / 开头的同源相对路径（如 /class/123 / /practice / /notifications）
 * SW 收到后会再次校验 + 自动补 /app 前缀（router basename）
 */
export function isValidLink(link: string | null | undefined): boolean {
  if (!link || typeof link !== 'string') return false;
  return link.startsWith('/');
}

export async function dispatchToUsers(input: DispatchInput): Promise<DispatchResult> {
  const { prisma, eventKind, eventId, tier, userIds } = input;
  const severity: Severity = input.severity ?? 'normal';
  const channel = 'push'; // v2 阶段仅 push 通道写 dispatch log · banner / sms 后续接入时各自加 channel

  const result: DispatchResult = {
    newPushedUsers: 0,
    alreadyDispatched: 0,
    pushDelivered: 0,
    pushInvalid: 0,
    pushFailed: 0,
  };
  if (userIds.length === 0) return result;

  // Link 安全校验
  if (!isValidLink(input.link)) {
    console.error('[dispatch] invalid link · 跳过派发', { eventKind, eventId, tier, link: input.link });
    return result;
  }

  // 1. 查已派发 · 过滤（按 channel 维度）
  const already = await prisma.notificationDispatchLog.findMany({
    where: { eventKind, eventId, tier, channel, userId: { in: userIds } },
    select: { userId: true },
  });
  const alreadySet = new Set(already.map((r) => r.userId));
  const newUsers = userIds.filter((u) => !alreadySet.has(u));
  result.alreadyDispatched = alreadySet.size;

  if (newUsers.length === 0) return result;

  // 2. 事务：批量写 Notification + DispatchLog
  //    抽出公共写入逻辑 · 避免 P2002 fallback 复制粘贴
  async function insertOne(tx: Prisma.TransactionClient, uid: string): Promise<void> {
    const n = await tx.notification.create({
      data: {
        userId: uid,
        type: input.notificationType as Prisma.NotificationCreateInput['type'],
        title: input.title,
        body: input.body,
        link: input.link,
        // v2 扩展字段（与旧 type 并存 · 渐进迁移）
        eventKind: eventKind as string,
        eventId,
        tier: tier as string,
        severity,
        contentHash: input.contentHash,
      },
    });
    await tx.notificationDispatchLog.create({
      data: {
        eventKind, eventId, tier, userId: uid, channel,
        notificationId: n.id,
        success: true,
      },
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const uid of newUsers) {
        await insertOne(tx, uid);
      }
    });
    result.newPushedUsers = newUsers.length;
  } catch (e) {
    // 并发场景下 unique 冲突 · 退回单条 try/catch（避免整事务回滚损失已写入用户）
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
      for (const uid of newUsers) {
        try {
          await prisma.$transaction((tx) => insertOne(tx, uid));
          result.newPushedUsers++;
        } catch (e2) {
          if ((e2 as Prisma.PrismaClientKnownRequestError)?.code !== 'P2002') {
            console.error('[dispatch] insert failed', uid, e2);
          }
          // unique 冲突 = 并发派发 · 静默跳过
        }
      }
    } else {
      console.error('[dispatch] tx failed', e);
      throw e;
    }
  }

  // 3. 发 web push（事务外 · push 失败不回滚 inbox）
  // spec §3 路由表：部分事件类型不发 push（仅站内）· 这里精确过滤
  if (result.newPushedUsers > 0 && !NO_PUSH_EVENTS.has(eventKind as string)) {
    const tag = `${eventKind}:${eventId}:${tier}`;
    const pushResult = await sendPushToUsers(newUsers, {
      title: input.title,
      body: input.body,
      link: input.link,
      tag,
    });
    result.pushDelivered = pushResult.delivered;
    result.pushInvalid = pushResult.invalid;
    result.pushFailed = pushResult.failed;
  }

  return result;
}
