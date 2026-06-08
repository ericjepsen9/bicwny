// 法会 / 系统活动 service（spec §3.7 + §13）
//   - 信息型 · 无 app 内入口 · 外部参与
//   - 三 tier: created / daily_t1h / in_progress_arrival（后者由前端「进 app」时触发 · v3）
//   - 撤回用 deletedAt 软删 · 已调度 cron job 发送前检查（spec §19.8）
import type { DharmaAssembly, Prisma } from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { dispatchToUsers } from '../scheduler/dispatch.js';

const MAX_TITLE = 100;
const MAX_DESC = 10000;
const ALLOWED_CATEGORIES = new Set(['assembly', 'system_session', 'memorial']);

export interface CreateInput {
  title: string;
  category: string;
  startAt: Date;
  endAt: Date;
  description: string;
  coverImage?: string | null;
  externalLink?: string | null;
}

export async function createAssembly(adminId: string, input: CreateInput): Promise<DharmaAssembly> {
  const title = input.title.trim();
  if (!title) throw BadRequest('标题必填');
  if (title.length > MAX_TITLE) throw BadRequest(`标题 ≤ ${MAX_TITLE} 字`);
  if (!ALLOWED_CATEGORIES.has(input.category)) throw BadRequest('category 必须是 assembly / system_session / memorial');
  if (input.description.length > MAX_DESC) throw BadRequest(`介绍 ≤ ${MAX_DESC} 字`);
  if (input.endAt.getTime() <= input.startAt.getTime()) throw BadRequest('结束时间必须晚于开始时间');
  // externalLink 校验 · 必须 http(s) 开头 · 防 javascript: 注入
  if (input.externalLink && !/^https?:\/\//.test(input.externalLink)) {
    throw BadRequest('外部链接必须以 http:// 或 https:// 开头');
  }

  const created = await prisma.dharmaAssembly.create({
    data: {
      title,
      category: input.category,
      startAt: input.startAt,
      endAt: input.endAt,
      description: input.description,
      coverImage: input.coverImage ?? null,
      externalLink: input.externalLink ?? null,
      createdBy: adminId,
    },
  });

  // fire-and-forget · created tier · 给所有 active 用户发预告通知
  notifyCreated(created).catch((e) => {
    console.error('[dharma-assembly] notify created failed:', e);
  });

  return created;
}

export interface UpdateInput {
  title?: string;
  category?: string;
  startAt?: Date;
  endAt?: Date;
  description?: string;
  coverImage?: string | null;
  externalLink?: string | null;
}

export async function updateAssembly(id: string, patch: UpdateInput): Promise<DharmaAssembly> {
  const existing = await prisma.dharmaAssembly.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw NotFound('法会不存在');

  const data: Prisma.DharmaAssemblyUpdateInput = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw BadRequest('标题不能为空');
    if (t.length > MAX_TITLE) throw BadRequest(`标题 ≤ ${MAX_TITLE} 字`);
    data.title = t;
  }
  if (patch.category !== undefined) {
    if (!ALLOWED_CATEGORIES.has(patch.category)) throw BadRequest('category 不合法');
    data.category = patch.category;
  }
  if (patch.startAt !== undefined) data.startAt = patch.startAt;
  if (patch.endAt !== undefined) data.endAt = patch.endAt;
  if (patch.description !== undefined) {
    if (patch.description.length > MAX_DESC) throw BadRequest(`介绍 ≤ ${MAX_DESC} 字`);
    data.description = patch.description;
  }
  if (patch.coverImage !== undefined) data.coverImage = patch.coverImage;
  if (patch.externalLink !== undefined) {
    if (patch.externalLink && !/^https?:\/\//.test(patch.externalLink)) {
      throw BadRequest('外部链接必须以 http:// 或 https:// 开头');
    }
    data.externalLink = patch.externalLink;
  }

  // 起止时间合法性
  const newStart = (data.startAt as Date | undefined) ?? existing.startAt;
  const newEnd = (data.endAt as Date | undefined) ?? existing.endAt;
  if (newEnd.getTime() <= newStart.getTime()) throw BadRequest('结束时间必须晚于开始时间');

  return prisma.dharmaAssembly.update({ where: { id }, data });
}

export async function deleteAssembly(id: string): Promise<void> {
  const existing = await prisma.dharmaAssembly.findUnique({ where: { id } });
  if (!existing) return; // idempotent
  await prisma.dharmaAssembly.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/** admin 列表（含软删 · 时序倒序） */
export async function listAllAssemblies(opts: { limit?: number } = {}) {
  return prisma.dharmaAssembly.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 50, 100),
  });
}

/** 公开 active 列表（未删 + 未结束 · 含进行中和未来）· 用于首页玻璃文字候选 */
export async function listActiveAssemblies() {
  return prisma.dharmaAssembly.findMany({
    where: {
      deletedAt: null,
      endAt: { gt: new Date() },
    },
    orderBy: { startAt: 'asc' },
  });
}

export async function getAssembly(id: string): Promise<DharmaAssembly> {
  const a = await prisma.dharmaAssembly.findUnique({ where: { id } });
  if (!a) throw NotFound('法会不存在');
  return a;
}

/** 创建后给全平台 active 用户发预告通知（created tier · spec §3.7） */
async function notifyCreated(ann: DharmaAssembly): Promise<void> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (users.length === 0) return;

  // 文案格式化 · 简体（前端 i18n 不影响 push payload · 用户进 app 看详情会按 lang 渲染）
  const dateStr = ann.startAt.toLocaleDateString('zh-CN', { timeZone: 'America/New_York', month: 'numeric', day: 'numeric' });
  await dispatchToUsers({
    prisma,
    eventKind: 'dharma_assembly',
    eventId: ann.id,
    tier: 'created',
    userIds: users.map((u) => u.id),
    title: `${ann.title} · ${dateStr} 开启（美东时间）`,
    body: ann.description.slice(0, 200),
    link: `/assemblies/${ann.id}`,
    notificationType: 'system',
    severity: 'normal',
  });
}

/**
 * cron 用 · 给每天首场前 1h 发提醒
 * 「首场前 1h」语义:
 *   - 简化策略：法会期间每天找 startAt = now+1h 命中的 · 没有「首场」精细概念
 *   - v1 法会通常多日跨度 + 每日定时主题 · admin 用 startAt 标记今日主题开始
 *   - v3 优化：DharmaAssembly 子表 dailyTopics(date, time) 支持细化日程
 *
 * 当前实现:
 *   - 在 startAt..endAt 期间 · 找今日 1h 后开始的法会（用 startAt 当固定每日时刻）
 *   - 实际上等于 created 后再发一次 t1h 提醒（如果开始时间正好在 1h 后）
 *   - 简单可用 · 待 v3 子表精细化
 */
export async function getAssembliesForT1hReminder(now: Date) {
  // 窗口 ±90s · cron 每分钟 tick
  const minStart = new Date(now.getTime() + 60 * 60_000 - 90_000);
  const maxStart = new Date(now.getTime() + 60 * 60_000 + 90_000);
  return prisma.dharmaAssembly.findMany({
    where: {
      deletedAt: null,
      // 法会期间内 · 今日 1h 后开始
      startAt: { gte: minStart, lte: maxStart },
    },
  });
}
