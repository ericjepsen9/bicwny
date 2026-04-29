// 法本封面图上传 service
//
// POST /api/admin/courses/:id/cover  (multipart) → { coverImageUrl }
// DELETE /api/admin/courses/:id/cover            → coverImageUrl = null
//
// 文件存储：
//   · 路径：UPLOAD_DIR/courses/<courseId>-<random>.<ext>
//   · DB：Course.coverImageUrl 存相对路径 '/uploads/courses/<file>'
//   · nginx 反代 /uploads/ 到 UPLOAD_DIR · 7d 缓存
//
// 限制：
//   · 单文件 ≤ 2 MB（@fastify/multipart 的 fileSize · 默认 20MB 这里覆盖）
//   · 仅 image/jpeg | image/png | image/webp（按 mime + 扩展名双重校验）
//   · 文件名只用 cuid + 扩展名，不沿用上传文件名（防路径穿越）

import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
};

/** 上传目录（绝对路径）· 默认项目根的 uploads/courses · 可通过 UPLOAD_DIR 覆盖 */
function uploadsRoot(): string {
  // process.cwd() 在 pm2 启动时是 backend/ · 上一层是项目根
  const base = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), '..', 'uploads');
  return path.join(base, 'courses');
}

/** 从 mime 推扩展名 · 不在白名单返回 null */
function extFromMime(mime: string): string | null {
  return ALLOWED_MIME[mime.toLowerCase()] || null;
}

interface UploadInput {
  /** mime type from multipart */
  mimetype: string;
  /** raw bytes */
  buffer: Buffer;
}

export async function uploadCourseCover(
  adminId: string,
  courseId: string,
  input: UploadInput,
): Promise<{ coverImageUrl: string }> {
  const ext = extFromMime(input.mimetype);
  if (!ext) {
    throw BadRequest(`不支持的图片类型：${input.mimetype}（仅 jpeg / png / webp）`);
  }
  if (input.buffer.length > MAX_BYTES) {
    throw BadRequest(`图片过大（${(input.buffer.length / 1024 / 1024).toFixed(2)} MB），上限 2 MB`);
  }
  // 极小图认为是损坏（< 100 字节没有合法图）
  if (input.buffer.length < 100) {
    throw BadRequest('图片数据异常（< 100 字节）');
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, coverImageUrl: true },
  });
  if (!course) throw NotFound('法本不存在');

  // 文件名：courseId + 随机 8 字节 hex + 扩展名 · 不暴露 admin 上传的原文件名
  const fname = `${courseId}-${randomBytes(8).toString('hex')}${ext}`;
  const dir = uploadsRoot();
  await mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, fname);
  await writeFile(fullPath, input.buffer);

  const url = `/uploads/courses/${fname}`;

  // AD5: 用 tx + 行锁原子读 → update · 拿事务内的 coverImageUrl 作为'要删的旧文件'
  // 之前 race：admin1 / admin2 并发 upload，各自先读 (line 69) 拿到同一份 OLD 值，
  // 然后各自 update。最后一笔 update 赢，但前一笔 update 写的文件 Y 没人删，落盘留孤儿。
  // 修复：tx 内 SELECT FOR UPDATE 读最新 coverImageUrl，然后 update。
  // 拿到的 prev 是真正被本次替换的文件 · 只删它 · 杜绝跨事务误删 / 漏删。
  let prevCoverUrl: string | null = null;
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ coverImageUrl: string | null }[]>`
      SELECT "coverImageUrl" FROM "Course" WHERE id = ${courseId} FOR UPDATE
    `;
    prevCoverUrl = locked[0]?.coverImageUrl ?? null;
    await tx.course.update({
      where: { id: courseId },
      data: { coverImageUrl: url },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'course.cover.upload',
        targetType: 'course',
        targetId: courseId,
        before: { coverImageUrl: prevCoverUrl } as Prisma.InputJsonValue,
        after: { coverImageUrl: url } as Prisma.InputJsonValue,
      },
    });
  });

  // 删旧文件（best-effort · DB 已成功就行 · prev 是事务内拿的真正被替换的值）
  if (prevCoverUrl) {
    deleteCoverFile(prevCoverUrl).catch(() => undefined);
  }

  return { coverImageUrl: url };
}

export async function removeCourseCover(adminId: string, courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, coverImageUrl: true },
  });
  if (!course) throw NotFound('法本不存在');
  if (!course.coverImageUrl) return; // 没图就 no-op

  await prisma.$transaction(async (tx) => {
    await tx.course.update({
      where: { id: courseId },
      data: { coverImageUrl: null },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'course.cover.remove',
        targetType: 'course',
        targetId: courseId,
        before: { coverImageUrl: course.coverImageUrl } as Prisma.InputJsonValue,
        after: { coverImageUrl: null } as Prisma.InputJsonValue,
      },
    });
  });
  // 删盘（best-effort · DB 已成功就行）
  await deleteCoverFile(course.coverImageUrl).catch(() => undefined);
}

/** 把 /uploads/courses/<file> 转成绝对路径并删 · 防路径穿越（仅允许 uploadsRoot 子路径） */
async function deleteCoverFile(relUrl: string): Promise<void> {
  // 期望格式 /uploads/courses/<file>
  if (!relUrl.startsWith('/uploads/courses/')) return;
  const fname = path.basename(relUrl); // 防 ../ 穿越
  const fullPath = path.join(uploadsRoot(), fname);
  // 校验解析后路径仍在 uploadsRoot 下（双保险）
  if (!fullPath.startsWith(uploadsRoot() + path.sep)) return;
  await unlink(fullPath);
}
