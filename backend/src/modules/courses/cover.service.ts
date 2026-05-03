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
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import sharp from 'sharp';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
};

// 生成 320/640/1024 三尺寸 WebP · 1:1 cover 裁切 · q=80
//   320 → 移动列表缩略图
//   640 → tablet / 高 dpi 移动 detail
//   1024 → 桌面 / 详情大图
//   节省带宽 50-70% · WebP 比 JPEG 同质量小 ~30%
const VARIANT_SIZES = [320, 640, 1024] as const;

async function generateVariants(buf: Buffer, dir: string, baseName: string): Promise<string[]> {
  const tasks = VARIANT_SIZES.map(async (w) => {
    const fname = `${baseName}-${w}.webp`;
    const fullPath = path.join(dir, fname);
    // EXIF rotate 自动校正 · cover 1:1 裁切（封面卡片是方形）· q=80 视觉上看不出差异
    await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize({ width: w, height: w, fit: 'cover', position: 'centre' })
      .webp({ quality: 80, effort: 4 })
      .toFile(fullPath);
    return `/uploads/courses/${fname}`;
  });
  return Promise.all(tasks);
}

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

  // 用 sharp 生成 320/640/1024 三尺寸 WebP（节省带宽 + 客户端按 srcset 选最合适）
  // baseName = courseId + 随机 8 字节 hex · 不暴露 admin 上传原文件名
  // coverImageUrl 存最大 1024w · 前端按 -1024.webp 后缀推 -640/-320 · 拼 <picture> srcset
  const baseName = `${courseId}-${randomBytes(8).toString('hex')}`;
  const dir = uploadsRoot();
  await mkdir(dir, { recursive: true });
  const variantUrls = await generateVariants(input.buffer, dir, baseName);
  const url = variantUrls.find((u) => u.endsWith('-1024.webp')) || variantUrls[0];
  // 同时保存 ext 让旧客户端能命中 fallback ·（暂不用 · 旧 client 不存在）

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

/** 把 /uploads/courses/<file> 转成绝对路径并删 · 防路径穿越（仅允许 uploadsRoot 子路径）
 *  新版本格式 abc-1024.webp · 同步删 abc-320.webp / abc-640.webp 兄弟文件
 *  老版本单文件（abc.png 等）· 仅删本身
 */
async function deleteCoverFile(relUrl: string): Promise<void> {
  // 期望格式 /uploads/courses/<file>
  if (!relUrl.startsWith('/uploads/courses/')) return;
  const fname = path.basename(relUrl); // 防 ../ 穿越
  const root = uploadsRoot();
  // 检测是否新格式 <base>-{320|640|1024}.webp · 是则删全套
  const m = fname.match(/^(.*)-(?:320|640|1024)\.webp$/);
  const fnames = m
    ? VARIANT_SIZES.map((w) => `${m[1]}-${w}.webp`)
    : [fname];
  for (const f of fnames) {
    const fullPath = path.join(root, f);
    if (!fullPath.startsWith(root + path.sep)) continue;
    await unlink(fullPath).catch(() => undefined);
  }
}
