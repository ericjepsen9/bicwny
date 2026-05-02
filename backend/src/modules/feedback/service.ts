// 应用内反馈 service
// P2 #30
//
// submit · 用户提交（auth optional · 匿名也允许 · 但限速更严）
// list   · admin 列表 · 按状态过滤 + 游标分页
// handle · admin 处理 · 改 status / 写 response · 同时给原用户发 Notification
import type { FeedbackKind, FeedbackStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';

const MAX_MESSAGE = 4000;
const MAX_RESPONSE = 4000;
const MAX_EMAIL = 200;
const MAX_PAGE = 120;
const MAX_UA = 500;
const MAX_VERSION = 40;

export interface SubmitInput {
  userId: string | null;
  kind: FeedbackKind;
  message: string;
  contactEmail?: string | null;
  page?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
  sessionId?: string | null;
}

function trimOrNull(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.slice(0, max);
}

export async function submitFeedback(input: SubmitInput) {
  const message = trimOrNull(input.message, MAX_MESSAGE);
  if (!message || message.length < 2) throw BadRequest('反馈内容过短');

  // 匿名提交必须给 contactEmail · 否则 admin 没法回复
  // 已登录用户走 user.email · 不强制
  if (!input.userId) {
    const email = trimOrNull(input.contactEmail, MAX_EMAIL);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw BadRequest('匿名提交需要填写联系邮箱');
    }
  }

  return prisma.feedback.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      status: 'open',
      message,
      contactEmail: trimOrNull(input.contactEmail, MAX_EMAIL),
      page: trimOrNull(input.page, MAX_PAGE),
      userAgent: trimOrNull(input.userAgent, MAX_UA),
      appVersion: trimOrNull(input.appVersion, MAX_VERSION),
      sessionId: trimOrNull(input.sessionId, MAX_PAGE),
    },
  });
}

export interface ListInput {
  status?: FeedbackStatus;
  kind?: FeedbackKind;
  limit?: number;
  cursor?: string;
}

export async function listFeedback(input: ListInput) {
  const limit = Math.min(Math.max(input.limit || 50, 1), 200);
  const where: Prisma.FeedbackWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.kind) where.kind = input.kind;

  const rows = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
    include: {
      user: { select: { id: true, dharmaName: true, email: true } },
      handledBy: { select: { id: true, dharmaName: true } },
    },
  });
  const hasMore = rows.length > limit;
  return {
    items: hasMore ? rows.slice(0, limit) : rows,
    nextCursor: hasMore ? rows[limit - 1]!.id : null,
  };
}

export interface HandleInput {
  status: FeedbackStatus;
  response?: string | null;
}

export async function handleFeedback(
  feedbackId: string,
  adminId: string,
  input: HandleInput,
) {
  const fb = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!fb) throw NotFound('反馈不存在');

  const response = input.response != null ? trimOrNull(input.response, MAX_RESPONSE) : null;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.feedback.update({
      where: { id: feedbackId },
      data: {
        status: input.status,
        handledByUserId: adminId,
        handledAt: new Date(),
        response,
      },
    });
    // 给原用户发 in-app notification（匿名提交无 userId · 只能依赖 contactEmail）
    if (fb.userId && response) {
      await tx.notification.create({
        data: {
          userId: fb.userId,
          type: 'system',
          title: '管理员回复了你的反馈',
          body: response.slice(0, 200),
        },
      });
    }
    // 写一行 AuditLog 备查
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'feedback.handle',
        targetType: 'feedback',
        targetId: feedbackId,
        after: {
          status: input.status,
          hasResponse: !!response,
        },
      },
    });
    return u;
  });

  return updated;
}

/** 给用户看自己历史反馈 · 不暴露 admin 字段 */
export async function listMyFeedback(userId: string) {
  if (!userId) throw Forbidden('需登录');
  return prisma.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      kind: true,
      status: true,
      message: true,
      response: true,
      page: true,
      handledAt: true,
      createdAt: true,
    },
  });
}
