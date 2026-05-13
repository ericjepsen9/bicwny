// 班级排课 ClassSession 服务
//   - v1 仅单次事件 · 无 recurrence
//   - 辅导员 CRUD · 学员 GET 自己班级的 upcoming
import type { Prisma } from '@prisma/client';
import { Forbidden, NotFound, BadRequest } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';

export interface CreateSessionInput {
  classId: string;
  title: string;
  description?: string | null;
  startAt: Date;
  durationMin?: number;
  liveLink?: string | null;
}

export interface UpdateSessionInput {
  title?: string;
  description?: string | null;
  startAt?: Date;
  durationMin?: number;
  liveLink?: string | null;
}

// 辅导员权限校验：必须是该班 active coach
async function assertCoachOfClass(userId: string, classId: string): Promise<void> {
  const m = await prisma.classMember.findFirst({
    where: { userId, classId, role: 'coach', removedAt: null },
    select: { id: true },
  });
  if (!m) throw Forbidden('非该班辅导员 · 无权操作排课');
}

export async function listClassSessions(classId: string, opts?: { past?: boolean }) {
  const now = new Date();
  const where: Prisma.ClassSessionWhereInput = {
    classId,
    startAt: opts?.past ? { lt: now } : { gte: new Date(now.getTime() - 30 * 60_000) },
    // 历史也展示开始 30 分钟内（正在进行的不算"过去"）
  };
  return prisma.classSession.findMany({
    where,
    orderBy: { startAt: opts?.past ? 'desc' : 'asc' },
    take: opts?.past ? 50 : undefined,
  });
}

export async function getSession(id: string) {
  const s = await prisma.classSession.findUnique({ where: { id } });
  if (!s) throw NotFound('排课不存在');
  return s;
}

export async function createSession(userId: string, input: CreateSessionInput) {
  await assertCoachOfClass(userId, input.classId);
  if (input.title.trim().length === 0) throw BadRequest('标题不能为空');
  if (input.durationMin != null && (input.durationMin < 1 || input.durationMin > 24 * 60)) {
    throw BadRequest('时长必须在 1 分钟到 24 小时之间');
  }
  return prisma.classSession.create({
    data: {
      classId: input.classId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      startAt: input.startAt,
      durationMin: input.durationMin ?? 60,
      liveLink: input.liveLink?.trim() || null,
      createdBy: userId,
    },
  });
}

export async function updateSession(userId: string, id: string, patch: UpdateSessionInput) {
  const s = await prisma.classSession.findUnique({ where: { id } });
  if (!s) throw NotFound('排课不存在');
  await assertCoachOfClass(userId, s.classId);

  const data: Prisma.ClassSessionUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.startAt !== undefined) data.startAt = patch.startAt;
  if (patch.durationMin !== undefined) {
    if (patch.durationMin < 1 || patch.durationMin > 24 * 60) {
      throw BadRequest('时长必须在 1 分钟到 24 小时之间');
    }
    data.durationMin = patch.durationMin;
  }
  if (patch.liveLink !== undefined) data.liveLink = patch.liveLink?.trim() || null;

  // 改 startAt 或 title 时 editVersion +1 · 让前端 acknowledged 缓存失效
  const significant = patch.startAt !== undefined || patch.title !== undefined;
  if (significant) {
    data.editVersion = { increment: 1 };
    // 清掉相关 DispatchLog · 让调度器按新时间重新触发
    // 注：仅清未来还会再触发的（保留历史 audit）
    await prisma.notificationDispatchLog.deleteMany({
      where: {
        eventKind: 'class_session',
        eventId: id,
        // T-30/T-5/T0 三档无论改前改后都清 · 简单稳妥
      },
    });
  }
  return prisma.classSession.update({ where: { id }, data });
}

export async function deleteSession(userId: string, id: string) {
  const s = await prisma.classSession.findUnique({ where: { id } });
  if (!s) throw NotFound('排课不存在');
  await assertCoachOfClass(userId, s.classId);
  await prisma.classSession.delete({ where: { id } });
  // 删除后调度器自然不再扫到 · DispatchLog 保留作 audit
}

// 学员侧 · 我未来 N 分钟内所有班级的 ClassSession（v1 仅这一种事件源）
export async function listMyUpcomingEvents(userId: string, withinMinutes = 60) {
  const now = new Date();
  const horizon = new Date(now.getTime() + withinMinutes * 60_000);
  // 拉用户所有 active 班级
  const memberships = await prisma.classMember.findMany({
    where: { userId, removedAt: null },
    select: { classId: true },
  });
  if (memberships.length === 0) return [];
  const classIds = memberships.map((m) => m.classId);

  // 当前活跃事件 · 包括 T-{N} 内即将开始 + 已开始 5 分钟内
  const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
  const sessions = await prisma.classSession.findMany({
    where: {
      classId: { in: classIds },
      startAt: { gte: fiveMinAgo, lte: horizon },
    },
    orderBy: { startAt: 'asc' },
    include: {
      class: { select: { id: true, name: true } },
    },
  });

  return sessions.map((s) => ({
    kind: 'class_session' as const,
    id: s.id,
    title: s.title,
    description: s.description,
    subtitle: s.class.name,
    startAt: s.startAt,
    durationMin: s.durationMin,
    liveLink: s.liveLink,
    editVersion: s.editVersion,
    classId: s.classId,
    detailPath: `/class/${s.classId}`,
  }));
}

// 学员侧 · 取 top-1（已仲裁的最重要事件 · 用于首页卡）
// v1 仅 ClassSession · 时间近的赢
export async function getMyTopHomeCard(userId: string) {
  const events = await listMyUpcomingEvents(userId, 60);
  if (events.length === 0) return null;
  // 仅返回 top-1 · 后端不需要前端再排序
  return events[0];
}
