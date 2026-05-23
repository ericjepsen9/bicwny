// 班级公告 · service
//   - 创建 / 更新 / 归档（教师本班 · admin 任意班）
//   - 学员列表（active class member · 含图片 URL · 自动按 pinned 优先）
//   - 上传图片（多图 · ≤ 6 张 · 复用 cover 同型 sharp resize）
//   - 创建时给班级所有 active 学员发 Notification（class_announcement）
//   - 触发 Notification 时不阻塞主创建（fire-and-forget · 失败仅 console.error）
//   - v2：走统一 dispatchToUsers · 自动入幂等 + web push 推送（v1 旧版仅 createMany 无 push）
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { ClassAnnouncement } from '@prisma/client';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { dispatchToUsers } from '../scheduler/dispatch.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB / 图
const MAX_IMAGES = 6;
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
};

function uploadsRoot(): string {
  const base = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), '..', 'uploads');
  return path.join(base, 'announcements');
}

/** 上传单张图片 · 返回 OSS 相对 URL 数组（多尺寸） · 公告用单尺寸 · 1280 宽即可 */
export async function uploadImage(buf: Buffer, mime: string, size: number): Promise<string> {
  if (size > MAX_IMAGE_BYTES) throw BadRequest('图片超过 5MB');
  const ext = ALLOWED_MIME[mime];
  if (!ext) throw BadRequest('仅支持 jpg / png / webp');
  const dir = uploadsRoot();
  await mkdir(dir, { recursive: true });
  const baseName = randomBytes(8).toString('hex');
  const fname = `${baseName}.webp`;
  const fullPath = path.join(dir, fname);
  await sharp(buf, { failOn: 'none' })
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(fullPath);
  return `/uploads/announcements/${fname}`;
}

interface CreateInput {
  classId: string;
  authorId: string;
  title: string;
  body: string;
  imageUrls?: string[];
  pinned?: boolean;
}

export async function createAnnouncement(input: CreateInput): Promise<ClassAnnouncement> {
  if (!input.title.trim()) throw BadRequest('标题必填');
  if (input.title.length > 80) throw BadRequest('标题 ≤ 80 字');
  if (input.body.length > 5000) throw BadRequest('正文 ≤ 5000 字');
  if (input.imageUrls && input.imageUrls.length > MAX_IMAGES) {
    throw BadRequest(`最多 ${MAX_IMAGES} 张图`);
  }
  const cls = await prisma.class.findUnique({ where: { id: input.classId } });
  if (!cls) throw NotFound('班级不存在');

  const ann = await prisma.classAnnouncement.create({
    data: {
      classId: input.classId,
      authorId: input.authorId,
      title: input.title.trim(),
      body: input.body,
      imageUrls: input.imageUrls && input.imageUrls.length > 0 ? (input.imageUrls as Prisma.InputJsonValue) : Prisma.DbNull,
      pinnedAt: input.pinned ? new Date() : null,
    },
  });

  // fire-and-forget 通知 · 失败仅 log（不阻塞主创建）
  // 走 dispatchToUsers · 自动获得 web push 推送 + 幂等去重（同公告重发不会重复打扰）
  notifyClassMembers(input.classId, cls.name, input.title, ann.id).catch((e) => {
    console.error('[announcement] notify failed:', e);
  });

  return ann;
}

async function notifyClassMembers(classId: string, className: string, title: string, announcementId: string) {
  const members = await prisma.classMember.findMany({
    where: { classId, removedAt: null, role: 'student' },
    select: { userId: true },
  });
  if (members.length === 0) return;
  await dispatchToUsers({
    prisma,
    eventKind: 'class_announcement',
    eventId: announcementId,
    tier: '-',
    userIds: members.map((m) => m.userId),
    title: `《${className}》新公告`,
    body: title,
    link: `/class/${classId}`,
    notificationType: 'class_announcement',
    severity: 'normal',
  });
}

interface UpdateInput {
  title?: string;
  body?: string;
  imageUrls?: string[] | null;
  pinned?: boolean;
  archive?: boolean;
}

export async function updateAnnouncement(
  id: string,
  actorUserId: string,
  actorRole: 'coach' | 'admin',
  patch: UpdateInput,
): Promise<ClassAnnouncement> {
  const a = await prisma.classAnnouncement.findUnique({ where: { id } });
  if (!a) throw NotFound('公告不存在');
  if (actorRole !== 'admin') {
    // coach 必须是该公告所属班级的在册 coach（防跨班越权）· 且仅能改自己发的
    const m = await prisma.classMember.findFirst({
      where: { classId: a.classId, userId: actorUserId, role: 'coach', removedAt: null },
    });
    if (!m) throw Forbidden('非该班 coach');
    if (a.authorId !== actorUserId) throw Forbidden('只能改自己发布的公告');
  }
  if (patch.title !== undefined && (!patch.title.trim() || patch.title.length > 80)) {
    throw BadRequest('标题不合法');
  }
  if (patch.body !== undefined && patch.body.length > 5000) throw BadRequest('正文 ≤ 5000 字');
  if (patch.imageUrls && patch.imageUrls.length > MAX_IMAGES) throw BadRequest(`最多 ${MAX_IMAGES} 张图`);

  const data: Prisma.ClassAnnouncementUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.body !== undefined) data.body = patch.body;
  if (patch.imageUrls !== undefined) {
    data.imageUrls = patch.imageUrls === null || patch.imageUrls.length === 0
      ? Prisma.DbNull
      : (patch.imageUrls as Prisma.InputJsonValue);
  }
  if (patch.pinned !== undefined) data.pinnedAt = patch.pinned ? new Date() : null;
  if (patch.archive) data.archivedAt = new Date();

  return prisma.classAnnouncement.update({ where: { id }, data });
}

export async function listAnnouncements(classId: string, opts: { includeArchived?: boolean } = {}) {
  return prisma.classAnnouncement.findMany({
    // 已归档班级不返回公告（防 archive 后残留数据被读出）
    where: { classId, class: { isActive: true }, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [
      { pinnedAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
    take: 100,
  });
}

export async function getAnnouncement(id: string) {
  const a = await prisma.classAnnouncement.findUnique({ where: { id } });
  if (!a) throw NotFound('公告不存在');
  return a;
}
