// 通知模块 · CRUD service
//
// 21 软删：deleteNotification 不再物理删除，改写 deletedAt
//   · 所有读路径过滤 deletedAt IS NULL
//   · cursor 行被"删"后仍在 DB 内，分页 anchor 不会失效
// 22 unread+markAll 事务化：避免计数与标记之间的竞态导致红点漂移
import type { Notification, NotificationType } from '@prisma/client';
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
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 50,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
}

/** header 红点计数（count isRead=false） */
export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false, deletedAt: null },
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

/** 内部使用：触发某类型通知时调此函数（如成就解锁、班级公告发布） */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    },
  });
}
