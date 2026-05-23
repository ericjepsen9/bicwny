// 通知模块 · CRUD service
//
// 21 软删：deleteNotification 不再物理删除，改写 deletedAt
//   · 所有读路径过滤 deletedAt IS NULL
//   · cursor 行被"删"后仍在 DB 内，分页 anchor 不会失效
// 22 unread+markAll 事务化：避免计数与标记之间的竞态导致红点漂移
//
// v2 迁移说明：旧 createNotification 已删除 · 所有事件源走 scheduler/dispatch.ts 统一入口
import type { Notification } from '@prisma/client';
import { NotFound, Forbidden } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export interface ListOpts {
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export async function listNotifications(
  userId: string,
  opts: ListOpts = {},
): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(opts.unreadOnly ? { isRead: false } : {}),
    },
    // createdAt 非唯一 · 加 id 兜底排序 · 防同毫秒行在游标分页处重复/漏（审计）
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit ?? 50,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
}

/** header 红点计数（count isRead=false）· 排除已撤回（审计：撤回项不应让红点虚高） */
export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false, deletedAt: null, revokedAt: null },
  });
}

export async function markRead(
  userId: string,
  notificationId: string,
): Promise<Notification> {
  const n = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!n || n.deletedAt) throw NotFound('通知不存在');
  if (n.userId !== userId) throw Forbidden('非本人通知');
  if (n.isRead) return n;
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * 按事件标记已读（审计 N5）· 用户点系统推送 banner 后 · app 用 nr 令牌回写。
 * 匹配本人 (eventKind, eventId, tier) 的未读通知 · 幂等。
 */
export async function markReadByEvent(
  userId: string,
  eventKind: string,
  eventId: string,
  tier: string,
): Promise<{ updated: number }> {
  const r = await prisma.notification.updateMany({
    where: { userId, eventKind, eventId, tier, isRead: false, deletedAt: null },
    data: { isRead: true, readAt: new Date() },
  });
  return { updated: r.count };
}

/**
 * 标记全部已读 + 返回操作前的未读数（22 事务化）。
 * 单事务避免「count → markAll」之间收到新通知导致计数与实际标记不符。
 */
export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const beforeCount = await tx.notification.count({
      where: { userId, isRead: false, deletedAt: null },
    });
    await tx.notification.updateMany({
      where: { userId, isRead: false, deletedAt: null },
      data: { isRead: true, readAt: new Date() },
    });
    return beforeCount;
  });
  return { updated: result };
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<void> {
  const n = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!n || n.deletedAt) throw NotFound('通知不存在');
  if (n.userId !== userId) throw Forbidden('非本人通知');
  await prisma.notification.update({
    where: { id: notificationId },
    data: { deletedAt: new Date() },
  });
}

// createNotification(v1) 已删除 · 见文件头说明 · 用 scheduler/dispatch.ts 的 dispatchToUsers
