// 通知模块 · CRUD service
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
    where: { userId, isRead: false },
  });
}

export async function markRead(
  userId: string,
  notificationId: string,
): Promise<Notification> {
  const n = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!n) throw NotFound('通知不存在');
  if (n.userId !== userId) throw Forbidden('非本人通知');
  if (n.isRead) return n;
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const r = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { updated: r.count };
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<void> {
  const n = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!n) throw NotFound('通知不存在');
  if (n.userId !== userId) throw Forbidden('非本人通知');
  await prisma.notification.delete({ where: { id: notificationId } });
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
