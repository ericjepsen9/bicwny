// 班级排课 ClassSession 服务
//   - v1 仅单次事件 · 无 recurrence
//   - 辅导员 CRUD · 学员 GET 自己班级的 upcoming
import type { Prisma } from '@prisma/client';
import { Forbidden, NotFound, BadRequest } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { dispatchToUsers } from '../../scheduler/dispatch.js';

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

export async function listClassSessions(classId: string, userId: string, opts?: { past?: boolean }) {
  await assertCoachOfClass(userId, classId); // 审计 S1：防越权读取他班排课（含 liveLink）
  const now = new Date();
  const where: Prisma.ClassSessionWhereInput = {
    classId,
    // 已归档班级不返回共修（防 archive 后残留数据被读出）
    class: { isActive: true },
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

/**
 * 学员侧单场共修详情 · 权限：必须是本班成员
 * 用于 /class/:id/sessions/:sid 学员详情页（push / banner 跳转目标）
 */
export async function getSessionDetailForUser(userId: string, classId: string, sessionId: string) {
  const s = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      class: { select: { id: true, name: true } },
    },
  });
  if (!s) throw NotFound('共修不存在');
  if (s.classId !== classId) throw NotFound('共修不属于该班');
  // 班级成员校验（含 coach + student · 移除的 removedAt 不允许）
  const member = await prisma.classMember.findFirst({
    where: { classId, userId, removedAt: null },
    select: { id: true },
  });
  if (!member) throw Forbidden('非本班成员 · 无权查看');
  return {
    id: s.id,
    classId: s.classId,
    className: s.class.name,
    title: s.title,
    description: s.description,
    startAt: s.startAt,
    durationMin: s.durationMin,
    liveLink: s.liveLink,
    editVersion: s.editVersion,
  };
}

export async function createSession(userId: string, input: CreateSessionInput) {
  await assertCoachOfClass(userId, input.classId);
  if (input.title.trim().length === 0) throw BadRequest('标题不能为空');
  if (input.durationMin != null && (input.durationMin < 1 || input.durationMin > 24 * 60)) {
    throw BadRequest('时长必须在 1 分钟到 24 小时之间');
  }
  const session = await prisma.classSession.create({
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
  // spec §3 ① created tier · normal severity · 新建即通知学员（fire-and-forget）
  notifySessionCreated(session.classId, session.id, session.title, session.startAt).catch((e) => {
    console.error('[session] notify created failed:', e);
  });
  return session;
}

/**
 * 共修创建通知（spec §3 ① created tier · normal）
 */
async function notifySessionCreated(classId: string, sessionId: string, title: string, startAt: Date): Promise<void> {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!cls) return;
  const members = await prisma.classMember.findMany({
    where: { classId, removedAt: null, role: 'student' },
    select: { userId: true },
  });
  if (members.length === 0) return;
  const tz = 'America/New_York';
  const fmt = startAt.toLocaleString('zh-CN', { timeZone: tz, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  await dispatchToUsers({
    prisma,
    eventKind: 'class_session',
    eventId: sessionId,
    tier: 'created',
    userIds: members.map((m) => m.userId),
    title: `《${cls.name}》共修已安排`,
    body: `${title} · ${fmt}（美东时间）`,
    link: `/class/${classId}/sessions/${sessionId}`,
    notificationType: 'class_session',
    severity: 'normal',
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
    // 注：仅清未来还会再触发的（保留历史 audit）· 含 channel 维度
    await prisma.notificationDispatchLog.deleteMany({
      where: {
        eventKind: 'class_session',
        eventId: id,
        tier: { in: ['T-24h', 'T-30', 'T-5', 'T0'] },
      },
    });
  }
  const updated = await prisma.classSession.update({ where: { id }, data });

  // spec §3 ① time_changed tier · urgent severity · 改时间后即时通知学员（fire-and-forget）
  if (patch.startAt !== undefined) {
    notifySessionTimeChanged(updated.classId, updated.id, updated.title, updated.startAt).catch((e) => {
      console.error('[session] notify time_changed failed:', e);
    });
  }
  return updated;
}

export async function deleteSession(userId: string, id: string) {
  const s = await prisma.classSession.findUnique({ where: { id } });
  if (!s) throw NotFound('排课不存在');
  await assertCoachOfClass(userId, s.classId);
  // 删除前先取学员名单 · 用于发取消通知
  const members = await prisma.classMember.findMany({
    where: { classId: s.classId, removedAt: null, role: 'student' },
    select: { userId: true },
  });
  await prisma.classSession.delete({ where: { id } });
  // 删除后调度器自然不再扫到 · DispatchLog 保留作 audit

  // spec §3 ① cancelled tier · urgent severity · 取消通知学员（fire-and-forget）
  if (members.length > 0) {
    notifySessionCancelled(s.classId, s.id, s.title, members.map((m) => m.userId)).catch((e) => {
      console.error('[session] notify cancelled failed:', e);
    });
  }
}

/**
 * 共修改时间通知（spec §3 ① time_changed tier）
 */
async function notifySessionTimeChanged(classId: string, sessionId: string, title: string, newStartAt: Date): Promise<void> {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!cls) return;
  const members = await prisma.classMember.findMany({
    where: { classId, removedAt: null, role: 'student' },
    select: { userId: true },
  });
  if (members.length === 0) return;
  // 简单格式化时间 · 给文案用（用户本地时间在前端处理）
  const tz = 'America/New_York';
  const fmt = newStartAt.toLocaleString('zh-CN', { timeZone: tz, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  await dispatchToUsers({
    prisma,
    eventKind: 'class_session',
    eventId: sessionId,
    tier: 'time_changed',
    userIds: members.map((m) => m.userId),
    title: `《${cls.name}》共修时间变更`,
    body: `${title} · 新时间 ${fmt}（美东时间）`,
    link: `/class/${classId}/sessions/${sessionId}`,
    notificationType: 'class_session_soon',
    severity: 'urgent',
  });
}

/**
 * 共修取消通知（spec §3 ① cancelled tier）
 */
async function notifySessionCancelled(classId: string, sessionId: string, title: string, userIds: string[]): Promise<void> {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!cls) return;
  await dispatchToUsers({
    prisma,
    eventKind: 'class_session',
    eventId: sessionId,
    tier: 'cancelled',
    userIds,
    title: `《${cls.name}》共修已取消`,
    body: title,
    // cancelled 后 session 已删除 · 跳详情页会 404 · 改为跳班级页
    link: `/class/${classId}`,
    notificationType: 'class_session_soon',
    severity: 'urgent',
  });
}

// 学员侧 · 我未来 N 分钟内所有事件
//   v1: 仅 ClassSession
//   v2: 含 DharmaAssembly（系统法会 / 系统共修 · 全平台）
export interface UpcomingEventOut {
  kind: 'class_session' | 'dharma_assembly';
  id: string;
  title: string;
  description: string | null;
  subtitle: string;       // 班级名 / 法会 category
  startAt: Date;
  endAt?: Date;           // 法会用 · ClassSession 无 endAt
  durationMin?: number;   // ClassSession 用
  liveLink?: string | null;     // ClassSession liveLink · 法会 externalLink
  editVersion?: number;   // ClassSession 用
  classId?: string;       // ClassSession 用
  category?: string;      // 法会 category
  detailPath: string;
}

export async function listMyUpcomingEvents(userId: string, withinMinutes = 60): Promise<UpcomingEventOut[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + withinMinutes * 60_000);
  const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);

  // 拉用户所有 active 班级
  const memberships = await prisma.classMember.findMany({
    where: { userId, removedAt: null },
    select: { classId: true },
  });
  const classIds = memberships.map((m) => m.classId);

  // 并行查 · 班级共修 + 法会
  const [sessions, assemblies] = await Promise.all([
    classIds.length > 0
      ? prisma.classSession.findMany({
          where: {
            classId: { in: classIds },
            startAt: { gte: fiveMinAgo, lte: horizon },
          },
          orderBy: { startAt: 'asc' },
          include: { class: { select: { id: true, name: true } } },
        })
      : Promise.resolve([] as any[]),
    // 法会：未删 + (startAt 在窗口内 OR 已开始未结束)
    prisma.dharmaAssembly.findMany({
      where: {
        deletedAt: null,
        OR: [
          { startAt: { gte: fiveMinAgo, lte: horizon } },     // 即将开始
          { AND: [{ startAt: { lte: now } }, { endAt: { gt: now } }] }, // 进行中
        ],
      },
      orderBy: { startAt: 'asc' },
    }),
  ]);

  const sessionItems: UpcomingEventOut[] = sessions.map((s: any) => ({
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
    detailPath: `/class/${s.classId}/sessions/${s.id}`,
  }));

  const assemblyItems: UpcomingEventOut[] = assemblies.map((a) => ({
    kind: 'dharma_assembly' as const,
    id: a.id,
    title: a.title,
    description: a.description.slice(0, 200),
    subtitle: a.category,
    startAt: a.startAt,
    endAt: a.endAt,
    liveLink: a.externalLink,
    category: a.category,
    detailPath: `/assemblies/${a.id}`,
  }));

  // 合并 + 时间排序
  return [...sessionItems, ...assemblyItems].sort(
    (x, y) => x.startAt.getTime() - y.startAt.getTime(),
  );
}

// 学员侧 · 取 top-1（已仲裁的最重要事件 · 用于首页卡）
// v1 仅 ClassSession · 时间近的赢
export async function getMyTopHomeCard(userId: string) {
  const events = await listMyUpcomingEvents(userId, 60);
  if (events.length === 0) return null;
  // 仅返回 top-1 · 后端不需要前端再排序
  return events[0];
}
