// 观修内容 admin service
//
// CRUD + 视频/PDF 上传到 OSS 服务器
//
// 视频处理：
//   1. multipart 流到 /tmp/<id>-input.mp4
//   2. ffmpeg -movflags +faststart 修复（让视频 web 流式 · seek 友好）
//   3. ffprobe 提取时长
//   4. scp 上传到 OSS · DB 存 URL
//   5. 清理 /tmp 临时文件
//
// PDF 处理：直传 OSS · 不需要 ffmpeg

import { execFile } from 'node:child_process';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { promisify } from 'node:util';
import type { Meditation, Prisma } from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { deleteFromOss, ossKeyFromUrl, uploadToOss } from '../../lib/oss.js';

const execFileAsync = promisify(execFile);

const TMP_DIR = process.env.MEDITATION_TMP_DIR ?? '/tmp/juexue-meditations';

// 视频限制：单文件 ≤ 500 MB · 时长 1 秒 - 3 小时
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MIN_VIDEO_SEC = 1;
const MAX_VIDEO_SEC = 3 * 3600;

// PDF 限制：单文件 ≤ 30 MB
const MAX_PDF_BYTES = 30 * 1024 * 1024;

async function ensureTmpDir(): Promise<void> {
  await mkdir(TMP_DIR, { recursive: true });
}

async function safeUnlink(p: string): Promise<void> {
  try { await unlink(p); } catch { /* ignore */ }
}

// ─────────────────────── CRUD ───────────────────────

export interface CreateMeditationInput {
  lessonId?: string | null;
  courseId?: string | null;
  title: string;
  titleTraditional?: string | null;
  description?: string | null;
  authorName?: string | null;
  isPublished?: boolean;
  displayOrder?: number;
}

export async function listMeditations(opts?: {
  courseId?: string;
  lessonId?: string;
  includeArchived?: boolean;
}): Promise<Meditation[]> {
  return prisma.meditation.findMany({
    where: {
      ...(opts?.courseId ? { courseId: opts.courseId } : {}),
      ...(opts?.lessonId ? { lessonId: opts.lessonId } : {}),
      ...(opts?.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    take: 500,  // 防御：观修通常一课 1 个 · 500 远超 · 防意外失控
  });
}

export async function getMeditation(id: string): Promise<Meditation> {
  const m = await prisma.meditation.findUnique({ where: { id } });
  if (!m) throw NotFound('观修不存在');
  return m;
}

export async function createMeditation(
  adminId: string,
  input: CreateMeditationInput,
): Promise<Meditation> {
  if (!input.title?.trim()) throw BadRequest('标题不能为空');

  // lessonId 反推 courseId（保证一致性）
  let courseId = input.courseId ?? null;
  if (input.lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: input.lessonId },
      select: { chapter: { select: { courseId: true } } },
    });
    if (!lesson) throw BadRequest('关联课时不存在');
    courseId = lesson.chapter.courseId;
  }

  const created = await prisma.$transaction(async (tx) => {
    const m = await tx.meditation.create({
      data: {
        lessonId: input.lessonId ?? null,
        courseId,
        title: input.title.trim(),
        titleTraditional: input.titleTraditional ?? null,
        description: input.description ?? null,
        authorName: input.authorName ?? null,
        isPublished: input.isPublished ?? true,
        displayOrder: input.displayOrder ?? 0,
        // 占位 URL · 上传视频后会被替换
        videoUrl: '',
        videoDurationSec: 0,
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'meditation.create',
        targetType: 'meditation',
        targetId: m.id,
        before: {} as Prisma.InputJsonValue,
        after: { title: m.title, lessonId: m.lessonId } as Prisma.InputJsonValue,
      },
    });
    return m;
  });
  return created;
}

export interface UpdateMeditationInput {
  lessonId?: string | null;
  courseId?: string | null;
  title?: string;
  titleTraditional?: string | null;
  description?: string | null;
  authorName?: string | null;
  isPublished?: boolean;
  displayOrder?: number;
}

export async function updateMeditation(
  adminId: string,
  id: string,
  input: UpdateMeditationInput,
): Promise<Meditation> {
  const existing = await getMeditation(id);

  // lessonId 变化时反推 courseId
  let courseId = input.courseId !== undefined ? input.courseId : existing.courseId;
  if (input.lessonId !== undefined && input.lessonId !== existing.lessonId) {
    if (input.lessonId === null) {
      courseId = input.courseId ?? null;
    } else {
      const lesson = await prisma.lesson.findUnique({
        where: { id: input.lessonId },
        select: { chapter: { select: { courseId: true } } },
      });
      if (!lesson) throw BadRequest('关联课时不存在');
      courseId = lesson.chapter.courseId;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.meditation.update({
      where: { id },
      data: {
        ...(input.lessonId !== undefined && { lessonId: input.lessonId }),
        courseId,
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.titleTraditional !== undefined && { titleTraditional: input.titleTraditional }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.authorName !== undefined && { authorName: input.authorName }),
        ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
        ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'meditation.update',
        targetType: 'meditation',
        targetId: id,
        before: { title: existing.title, isPublished: existing.isPublished } as Prisma.InputJsonValue,
        after: { title: m.title, isPublished: m.isPublished } as Prisma.InputJsonValue,
      },
    });
    return m;
  });
  return updated;
}

export async function archiveMeditation(adminId: string, id: string): Promise<void> {
  const existing = await getMeditation(id);
  if (existing.archivedAt) return;

  await prisma.$transaction(async (tx) => {
    await tx.meditation.update({
      where: { id },
      data: { archivedAt: new Date(), isPublished: false },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'meditation.archive',
        targetType: 'meditation',
        targetId: id,
        before: { isPublished: existing.isPublished } as Prisma.InputJsonValue,
        after: { archivedAt: new Date() } as Prisma.InputJsonValue,
      },
    });
  });

  // best-effort 清理 OSS 文件（可选 · 留着也无害）
  if (existing.videoUrl) {
    const key = ossKeyFromUrl(existing.videoUrl);
    if (key) deleteFromOss(key).catch(() => undefined);
  }
  if (existing.slidesPdfUrl) {
    const key = ossKeyFromUrl(existing.slidesPdfUrl);
    if (key) deleteFromOss(key).catch(() => undefined);
  }
}

// ─────────────────────── 视频上传 ───────────────────────

export interface UploadVideoResult {
  videoUrl: string;
  videoDurationSec: number;
}

export async function uploadVideo(
  adminId: string,
  meditationId: string,
  fileStream: Readable,
  filename: string,
): Promise<UploadVideoResult> {
  if (!filename.toLowerCase().endsWith('.mp4')) {
    throw BadRequest('仅支持 mp4 文件');
  }
  const m = await getMeditation(meditationId);

  await ensureTmpDir();
  const random = randomBytes(8).toString('hex');
  const inputPath = path.join(TMP_DIR, `${meditationId}-${random}-input.mp4`);
  const fixedPath = path.join(TMP_DIR, `${meditationId}-${random}-fixed.mp4`);

  try {
    // 1. stream 到磁盘 · 不进内存
    await pipeline(fileStream, createWriteStream(inputPath));

    // 检查大小
    const st = await stat(inputPath);
    if (st.size > MAX_VIDEO_BYTES) {
      throw BadRequest(`视频过大 ${(st.size / 1024 / 1024).toFixed(1)} MB · 上限 500 MB`);
    }
    if (st.size < 10 * 1024) {
      throw BadRequest('视频文件异常（< 10 KB）');
    }

    // 2. ffmpeg 修复 faststart · 让 moov atom 移到文件头 · 浏览器秒开
    try {
      await execFileAsync('ffmpeg', [
        '-y',                          // overwrite output
        '-i', inputPath,
        '-c', 'copy',                  // 不重编码 · 仅 remux
        '-movflags', '+faststart',
        fixedPath,
      ], { maxBuffer: 100 * 1024 * 1024 });
    } catch (err) {
      throw BadRequest('视频处理失败 · 请检查文件是否为合法 mp4');
    }

    // 3. ffprobe 提取时长
    let durationSec = 0;
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        fixedPath,
      ]);
      durationSec = Math.floor(parseFloat(stdout.trim()));
    } catch {
      durationSec = 0;
    }
    if (!Number.isFinite(durationSec) || durationSec < MIN_VIDEO_SEC || durationSec > MAX_VIDEO_SEC) {
      throw BadRequest(`视频时长异常（${durationSec}s）· 需在 ${MIN_VIDEO_SEC}-${MAX_VIDEO_SEC} 秒`);
    }

    // 4. 上传到 OSS
    const ossKey = `meditations/videos/${meditationId}.mp4`;
    const url = await uploadToOss(fixedPath, ossKey);

    // 5. 更新 DB · 删旧文件（如果有）
    const oldUrl = m.videoUrl;
    await prisma.$transaction(async (tx) => {
      await tx.meditation.update({
        where: { id: meditationId },
        data: { videoUrl: url, videoDurationSec: durationSec },
      });
      await tx.auditLog.create({
        data: {
          adminId,
          action: 'meditation.video.upload',
          targetType: 'meditation',
          targetId: meditationId,
          before: { videoUrl: oldUrl } as Prisma.InputJsonValue,
          after: { videoUrl: url, durationSec } as Prisma.InputJsonValue,
        },
      });
    });

    // 旧文件 best-effort 删（同 ossKey 已被覆盖 · 这里仅保险）
    if (oldUrl && oldUrl !== url) {
      const oldKey = ossKeyFromUrl(oldUrl);
      if (oldKey && oldKey !== ossKey) {
        deleteFromOss(oldKey).catch(() => undefined);
      }
    }

    return { videoUrl: url, videoDurationSec: durationSec };
  } finally {
    // 清理临时文件
    await safeUnlink(inputPath);
    await safeUnlink(fixedPath);
  }
}

// ─────────────────────── PDF 上传 ───────────────────────

export interface UploadSlidesResult {
  slideImageUrls: string[];
  slidesPdfUrl: string | null;
}

// 接受 pdf / ppt / pptx · ppt/pptx 用 libreoffice headless 自动转 PDF
// 服务器需安装 libreoffice：sudo apt install libreoffice
const ALLOWED_SLIDE_EXTS = ['.pdf', '.ppt', '.pptx', '.key', '.odp'] as const;

export async function uploadSlides(
  adminId: string,
  meditationId: string,
  fileStream: Readable,
  filename: string,
): Promise<UploadSlidesResult> {
  const lower = filename.toLowerCase();
  const ext = ALLOWED_SLIDE_EXTS.find((e) => lower.endsWith(e));
  if (!ext) {
    throw BadRequest('仅支持 pdf / ppt / pptx / key / odp 文件');
  }
  const isPdf = ext === '.pdf';
  const m = await getMeditation(meditationId);

  await ensureTmpDir();
  const random = randomBytes(8).toString('hex');
  // 原始文件路径（含后缀 · libreoffice 靠后缀识别格式）
  const rawPath = path.join(TMP_DIR, `${meditationId}-${random}${ext}`);
  // 转换后 / 上传 OSS 的 PDF 路径
  const pdfPath = path.join(TMP_DIR, `${meditationId}-${random}.pdf`);

  try {
    await pipeline(fileStream, createWriteStream(rawPath));

    const st = await stat(rawPath);
    if (st.size > MAX_PDF_BYTES) {
      throw BadRequest(`文件过大 ${(st.size / 1024 / 1024).toFixed(1)} MB · 上限 30 MB`);
    }
    if (st.size < 100) {
      throw BadRequest('文件异常');
    }

    // PPT/PPTX/KEY/ODP → PDF（libreoffice headless · 30s 上限）
    if (!isPdf) {
      try {
        await execFileAsync(
          'libreoffice',
          [
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', TMP_DIR,
            rawPath,
          ],
          { timeout: 60_000 },
        );
        // libreoffice 输出文件名 = rawPath 的 basename + .pdf
        const expectedPdf = path.join(TMP_DIR, path.basename(rawPath, ext) + '.pdf');
        await stat(expectedPdf); // 确认输出存在
        // 用 fs.rename 把输出文件移到 pdfPath（同目录 · 应该即时）
        const { rename } = await import('node:fs/promises');
        await rename(expectedPdf, pdfPath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('ENOENT') || msg.includes('not found')) {
          throw BadRequest('服务器未安装 libreoffice · 请联系管理员（sudo apt install libreoffice）');
        }
        throw BadRequest(`PPT 转 PDF 失败: ${msg.slice(0, 200)}`);
      }
    } else {
      // pdf 直接用 · 简单 rename 到 pdfPath（保持后续 ossKey 命名一致）
      const { rename } = await import('node:fs/promises');
      await rename(rawPath, pdfPath);
    }

    // PDF → WebP 每页一张 · 用 pdftoppm（poppler-utils）
    // 服务器需安装 poppler-utils：sudo apt install poppler-utils
    const imagesDir = path.join(TMP_DIR, `${meditationId}-${random}-imgs`);
    await mkdir(imagesDir, { recursive: true });
    let pageCount = 0;
    try {
      // -png: 输出 PNG · -r 150: 150dpi（移动端足够清晰 · 文件适中）
      // pdftoppm input.pdf prefix → prefix-1.png prefix-2.png ...
      await execFileAsync(
        'pdftoppm',
        ['-png', '-r', '150', pdfPath, path.join(imagesDir, 'page')],
        { timeout: 120_000 },
      );
      // 列出生成的 PNG · 按页号排序
      const { readdir } = await import('node:fs/promises');
      const files = (await readdir(imagesDir))
        .filter((f) => f.endsWith('.png'))
        .sort((a, b) => {
          // pdftoppm 命名 page-1.png · page-10.png 等 · 用页号数字排
          const ai = parseInt(a.match(/-(\d+)\.png$/)?.[1] ?? '0', 10);
          const bi = parseInt(b.match(/-(\d+)\.png$/)?.[1] ?? '0', 10);
          return ai - bi;
        });
      pageCount = files.length;
      if (pageCount === 0) throw new Error('pdftoppm 没生成任何页面');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('ENOENT')) {
        throw BadRequest('服务器未安装 poppler-utils · sudo apt install poppler-utils');
      }
      throw BadRequest(`PDF 转图片失败: ${msg.slice(0, 200)}`);
    }

    // PNG → WebP（quality=80 · 体积小约 60%）· 上传 OSS
    const sharp = (await import('sharp')).default;
    const slideImageUrls: string[] = [];
    const pad = (n: number) => String(n).padStart(3, '0');
    for (let i = 1; i <= pageCount; i++) {
      const pngPath = path.join(imagesDir, `page-${i}.png`);
      const webpPath = path.join(imagesDir, `page-${pad(i)}.webp`);
      await sharp(pngPath).webp({ quality: 80 }).toFile(webpPath);
      const ossKey = `meditations/slides/${meditationId}/page-${pad(i)}.webp`;
      const url = await uploadToOss(webpPath, ossKey);
      slideImageUrls.push(url);
    }

    // 仍然保留 PDF 上传 · 给老前端 fallback（v1 兼容）
    const pdfOssKey = `meditations/slides/${meditationId}.pdf`;
    const pdfUrl = await uploadToOss(pdfPath, pdfOssKey);

    const oldImageUrls = (m.slideImageUrls as string[] | null) ?? [];
    const oldPdfUrl = m.slidesPdfUrl;
    await prisma.$transaction(async (tx) => {
      await tx.meditation.update({
        where: { id: meditationId },
        data: {
          slideImageUrls: slideImageUrls as Prisma.InputJsonValue,
          slidesPdfUrl: pdfUrl,
        },
      });
      await tx.auditLog.create({
        data: {
          adminId,
          action: 'meditation.slides.upload',
          targetType: 'meditation',
          targetId: meditationId,
          before: { slideImageUrls: oldImageUrls, slidesPdfUrl: oldPdfUrl } as Prisma.InputJsonValue,
          after: { slideImageUrls, slidesPdfUrl: pdfUrl, pageCount } as Prisma.InputJsonValue,
        },
      });
    });

    // 清理老的图片 OSS（重新上传场景）
    for (const oldUrl of oldImageUrls) {
      const oldKey = ossKeyFromUrl(oldUrl);
      if (oldKey && !slideImageUrls.includes(oldUrl)) {
        deleteFromOss(oldKey).catch(() => undefined);
      }
    }
    if (oldPdfUrl && oldPdfUrl !== pdfUrl) {
      const oldKey = ossKeyFromUrl(oldPdfUrl);
      if (oldKey && oldKey !== pdfOssKey) {
        deleteFromOss(oldKey).catch(() => undefined);
      }
    }

    return { slideImageUrls, slidesPdfUrl: pdfUrl };
  } finally {
    await safeUnlink(rawPath);
    await safeUnlink(pdfPath);
    // 清理 imagesDir
    try {
      const { rm } = await import('node:fs/promises');
      await rm(path.join(TMP_DIR, `${meditationId}-${random}-imgs`), { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

export async function removeSlides(adminId: string, meditationId: string): Promise<void> {
  const m = await getMeditation(meditationId);
  const imageUrls = (m.slideImageUrls as string[] | null) ?? [];
  if (!m.slidesPdfUrl && imageUrls.length === 0) return;

  const oldUrl = m.slidesPdfUrl;
  await prisma.$transaction(async (tx) => {
    await tx.meditation.update({
      where: { id: meditationId },
      data: { slidesPdfUrl: null, slideImageUrls: [] as Prisma.InputJsonValue },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'meditation.slides.remove',
        targetType: 'meditation',
        targetId: meditationId,
        before: { slidesPdfUrl: oldUrl, slideImageUrls: imageUrls } as Prisma.InputJsonValue,
        after: { slidesPdfUrl: null, slideImageUrls: [] } as Prisma.InputJsonValue,
      },
    });
  });

  if (oldUrl) {
    const key = ossKeyFromUrl(oldUrl);
    if (key) deleteFromOss(key).catch(() => undefined);
  }
  for (const url of imageUrls) {
    const key = ossKeyFromUrl(url);
    if (key) deleteFromOss(key).catch(() => undefined);
  }
}
