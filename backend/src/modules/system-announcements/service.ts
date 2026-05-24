// 系统公告 · service（spec §3.6 · 实施 §13 + §19.10/19.20）
//   - createSystemAnnouncement: admin 发布 · 触发全平台通知派发
//   - updateSystemAnnouncement: 改内容 · contentHash 变 · dismissal 失效
//   - revokeSystemAnnouncement: 撤回 · 写 revokedAt · 不发新通知
//   - listSystemAnnouncements: admin 列表（时序倒序）+ 公开 active 查询
//   - getSystemAnnouncement: 公开详情 · 已撤回 / 过期可返回（前端兜底显示）
import { createHash } from 'node:crypto';
import type { SystemAnnouncement } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { dispatchToUsers } from '../scheduler/dispatch.js';

const MAX_TITLE = 100;
const MAX_BODY = 5000;
const ALLOWED_SEVERITY = new Set(['normal', 'urgent', 'critical']);

function computeContentHash(title: string, body: string): string {
  return createHash('sha256').update(`${title}\n${body}`).digest('hex').slice(0, 16);
}

export interface CreateSystemAnnouncementInput {
  title: string;
  body: string;
  severity: string;
  expiresAt?: Date;  // 可空 · 默认 +24h（spec §19.20）
}

export async function createSystemAnnouncement(
  adminId: string,
  input: CreateSystemAnnouncementInput,
): Promise<SystemAnnouncement> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw BadRequest('标题必填');
  if (title.length > MAX_TITLE) throw BadRequest(`标题 ≤ ${MAX_TITLE} 字`);
  if (!body) throw BadRequest('内容必填');
  if (body.length > MAX_BODY) throw BadRequest(`内容 ≤ ${MAX_BODY} 字`);
  if (!ALLOWED_SEVERITY.has(input.severity)) throw BadRequest('severity 必须为 normal / urgent / critical');
  // expiresAt 默认 +24h · spec §19.20
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (expiresAt.getTime() < Date.now()) throw BadRequest('expiresAt 不能在过去');

  const created = await prisma.systemAnnouncement.create({
    data: {
      title,
      body,
      severity: input.severity,
      expiresAt,
      contentHash: computeContentHash(title, body),
      createdBy: adminId,
    },
  });

  // fire-and-forget 触发全平台 dispatch（active user · 不含已 archive / disable）
  notifySystemAnnouncement(created).catch((e) => {
    console.error('[system-announcement] notify failed:', e);
  });

  return created;
}

export interface UpdateSystemAnnouncementInput {
  title?: string;
  body?: string;
  severity?: string;
  expiresAt?: Date | null;
}

export async function updateSystemAnnouncement(
  id: string,
  patch: UpdateSystemAnnouncementInput,
): Promise<SystemAnnouncement> {
  const existing = await prisma.systemAnnouncement.findUnique({ where: { id } });
  if (!existing) throw NotFound('系统公告不存在');

  const data: Prisma.SystemAnnouncementUpdateInput = {};
  let contentChanged = false;
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw BadRequest('标题不能为空');
    if (t.length > MAX_TITLE) throw BadRequest(`标题 ≤ ${MAX_TITLE} 字`);
    data.title = t;
    contentChanged = true;
  }
  if (patch.body !== undefined) {
    const b = patch.body.trim();
    if (!b) throw BadRequest('内容不能为空');
    if (b.length > MAX_BODY) throw BadRequest(`内容 ≤ ${MAX_BODY} 字`);
    data.body = b;
    contentChanged = true;
  }
  if (patch.severity !== undefined) {
    if (!ALLOWED_SEVERITY.has(patch.severity)) throw BadRequest('severity 必须为 normal / urgent / critical');
    data.severity = patch.severity;
  }
  if (patch.expiresAt !== undefined && patch.expiresAt !== null) {
    if (patch.expiresAt.getTime() < Date.now()) throw BadRequest('expiresAt 不能在过去');
    data.expiresAt = patch.expiresAt;
  }
  if (contentChanged) {
    const newTitle = (data.title as string | undefined) ?? existing.title;
    const newBody = (data.body as string | undefined) ?? existing.body;
    data.contentHash = computeContentHash(newTitle, newBody);
  }
  return prisma.systemAnnouncement.update({ where: { id }, data });
}

export async function revokeSystemAnnouncement(id: string): Promise<SystemAnnouncement> {
  const existing = await prisma.systemAnnouncement.findUnique({ where: { id } });
  if (!existing) throw NotFound('系统公告不存在');
  if (existing.revokedAt) return existing; // idempotent
  return prisma.systemAnnouncement.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/** admin 后台列表（含已撤回 / 已过期 · 时序倒序） */
export async function listAllSystemAnnouncements(opts: { limit?: number; cursor?: string } = {}) {
  return prisma.systemAnnouncement.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 30, 100),
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
}

/** 公开 active 列表（未撤回 + 未过期）· 给学员首页 / banner 候选用 */
export async function listActiveSystemAnnouncements() {
  return prisma.systemAnnouncement.findMany({
    where: {
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSystemAnnouncement(id: string): Promise<SystemAnnouncement> {
  const a = await prisma.systemAnnouncement.findUnique({ where: { id } });
  if (!a) throw NotFound('系统公告不存在');
  return a;
}

/** 创建后触发全平台 dispatch · 仅 active 用户 · 一次性单 tier 通知（spec §3.6） */
async function notifySystemAnnouncement(ann: SystemAnnouncement): Promise<void> {
  // 拿所有 active user · 一次性 fan-out
  // 注：未来用户量大时应分页 batch · 当前 1000 级别可一次性
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (users.length === 0) return;

  // severity 'critical' 在通知中心 + 站内通道按高优显示
  // banner / SMS 通道 v3 实现（spec §6.3 §11）
  // 现阶段：critical 等同 urgent 的 push 行为 · 不无视静默时段
  const severity = ann.severity === 'critical' || ann.severity === 'urgent' || ann.severity === 'normal'
    ? ann.severity
    : 'normal';

  await dispatchToUsers({
    prisma,
    eventKind: 'system_announcement',
    eventId: ann.id,
    tier: 'published',
    userIds: users.map((u) => u.id),
    title: ann.title,
    body: ann.body.slice(0, 200),  // push 文案截断 · 站内 inbox 保留全文
    link: `/announcements/${ann.id}`,
    notificationType: 'system',
    severity: severity as 'normal' | 'urgent' | 'critical',
    contentHash: ann.contentHash ?? undefined,
  });
}
