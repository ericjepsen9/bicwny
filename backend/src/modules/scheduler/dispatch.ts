// 推送派发工具 · 给一组用户写 inbox + 发 push · 自动跳过已派发
//   - 用 NotificationDispatchLog unique(eventKind, eventId, tier, userId) 强一致幂等
//   - inbox 行 + push 发送原子相关 · push 失败仅日志 · 不回滚 inbox
import type { Prisma, PrismaClient } from '@prisma/client';
import { sendPushToUsers } from '../push/service.js';

export type EventKind = 'class_session';
export type Tier = 'T-30' | 'T-5' | 'T0';
export type NotifType = 'class_session' | 'class_session_soon';

export interface DispatchInput {
  prisma: PrismaClient;
  eventKind: EventKind;
  eventId: string;
  tier: Tier;
  userIds: string[];
  title: string;
  body: string;
  link: string;          // 应用内路径 · SW 收到后 location.href = link
  notificationType: NotifType;
}

export interface DispatchResult {
  newPushedUsers: number;     // 本次新派发的用户数
  alreadyDispatched: number;  // 已派发过的用户数（跳过）
  pushDelivered: number;      // web-push 实际推送成功数
  pushInvalid: number;        // 失效订阅
  pushFailed: number;         // 网络等失败
}

export async function dispatchToUsers(input: DispatchInput): Promise<DispatchResult> {
  const { prisma, eventKind, eventId, tier, userIds } = input;
  const result: DispatchResult = {
    newPushedUsers: 0,
    alreadyDispatched: 0,
    pushDelivered: 0,
    pushInvalid: 0,
    pushFailed: 0,
  };
  if (userIds.length === 0) return result;

  // 1. 查已派发 · 过滤
  const already = await prisma.notificationDispatchLog.findMany({
    where: { eventKind, eventId, tier, userId: { in: userIds } },
    select: { userId: true },
  });
  const alreadySet = new Set(already.map((r) => r.userId));
  const newUsers = userIds.filter((u) => !alreadySet.has(u));
  result.alreadyDispatched = alreadySet.size;

  if (newUsers.length === 0) return result;

  // 2. 事务：批量写 Notification + DispatchLog
  //    用 try/catch 单独捕获 unique 冲突 · 防并发 race（虽然单实例下罕见）
  try {
    await prisma.$transaction(async (tx) => {
      for (const uid of newUsers) {
        const n = await tx.notification.create({
          data: {
            userId: uid,
            type: input.notificationType,
            title: input.title,
            body: input.body,
            link: input.link,
          },
        });
        await tx.notificationDispatchLog.create({
          data: { eventKind, eventId, tier, userId: uid, notificationId: n.id },
        });
      }
    });
    result.newPushedUsers = newUsers.length;
  } catch (e) {
    // 并发场景下 unique 冲突 · 退回单条 try/catch
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
      for (const uid of newUsers) {
        try {
          await prisma.$transaction(async (tx) => {
            const n = await tx.notification.create({
              data: {
                userId: uid,
                type: input.notificationType,
                title: input.title,
                body: input.body,
                link: input.link,
              },
            });
            await tx.notificationDispatchLog.create({
              data: { eventKind, eventId, tier, userId: uid, notificationId: n.id },
            });
          });
          result.newPushedUsers++;
        } catch (e2) {
          if ((e2 as Prisma.PrismaClientKnownRequestError)?.code !== 'P2002') {
            console.error('[dispatch] insert failed', uid, e2);
          }
          // unique 冲突 = 已派发 · 静默跳过
        }
      }
    } else {
      console.error('[dispatch] tx failed', e);
      throw e;
    }
  }

  // 3. 发 web push（事务外 · push 失败不回滚 inbox）
  if (result.newPushedUsers > 0) {
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
