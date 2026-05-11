// 首页画报 service
//   - admin 按 (year, month) 上传 / 替换 / 删除
//   - 学员 GET 当前月画报
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import type { PrismaClient } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function uploadsRoot(): string {
  const base = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), '..', 'uploads');
  return path.join(base, 'posters');
}

/** 上传画报图 · 1600 宽 webp 压缩 · 适合手机壁纸级清晰度 */
export async function uploadPosterImage(buf: Buffer, mime: string, size: number): Promise<string> {
  if (size > MAX_IMAGE_BYTES) throw BadRequest('图片超过 8MB');
  const ext = ALLOWED_MIME[mime];
  if (!ext) throw BadRequest('仅支持 jpg / png / webp');
  const dir = uploadsRoot();
  await mkdir(dir, { recursive: true });
  const baseName = randomBytes(8).toString('hex');
  const fname = `${baseName}.webp`;
  const fullPath = path.join(dir, fname);
  await sharp(buf, { failOn: 'none' })
    .rotate()
    .resize({ width: 1600, height: 2400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 })
    .toFile(fullPath);
  return `/uploads/posters/${fname}`;
}

export interface PosterDto {
  id: string;
  year: number;
  month: number;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function upsertPoster(
  prisma: PrismaClient,
  year: number,
  month: number,
  imageUrl: string,
  caption: string | null,
): Promise<PosterDto> {
  if (month < 1 || month > 12) throw BadRequest('月份不合法');
  const row = await prisma.homePoster.upsert({
    where: { year_month: { year, month } },
    create: { year, month, imageUrl, caption },
    update: { imageUrl, caption },
  });
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    imageUrl: row.imageUrl,
    caption: row.caption,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getCurrentPoster(prisma: PrismaClient): Promise<PosterDto | null> {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return getPoster(prisma, y, m);
}

export async function getPoster(prisma: PrismaClient, year: number, month: number): Promise<PosterDto | null> {
  const row = await prisma.homePoster.findUnique({ where: { year_month: { year, month } } });
  if (!row) return null;
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    imageUrl: row.imageUrl,
    caption: row.caption,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listYearPosters(prisma: PrismaClient, year: number): Promise<PosterDto[]> {
  const rows = await prisma.homePoster.findMany({
    where: { year },
    orderBy: { month: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    imageUrl: r.imageUrl,
    caption: r.caption,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function deletePoster(prisma: PrismaClient, year: number, month: number): Promise<void> {
  await prisma.homePoster.delete({ where: { year_month: { year, month } } }).catch(() => undefined);
}
