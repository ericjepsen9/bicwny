// 法本导入解析 service · F2.1 + F2.2
//
// F2.1 阶段（解析）：
//   parsePdf / parseDocx → 纯文本
//   splitToChapters → 按"第X章"启发切章；章内按"第X节"切节
//   buildPreviewFromBuffer 主入口（不写库，返回预览结构）
//
// F2.2 阶段（写入）：
//   commitImport
//     · mode=new   → 创建新 course + chapters + lessons
//     · mode=append → 在现有 course 末尾追加 chapters + lessons
//   单事务原子性 · 写入 AuditLog (course.import)
//
// 不在范围：
//   · OCR（扫描版 PDF 无文字层 → 抛 EMPTY_TEXT）
//   · 复杂格式（DOCX 表格 / 图片 / 公式）只取 raw text

import type { Prisma } from '@prisma/client';
import mammoth from 'mammoth';
// pdf-parse@1.1.1 有顶层副作用（找测试 PDF）→ 走 lib 子路径绕开
import pdf from 'pdf-parse/lib/pdf-parse.js';

import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export interface PreviewLesson {
  title: string;
  referenceText: string;
  teachingSummary?: string;
}
export interface PreviewChapter {
  title: string;
  lessons: PreviewLesson[];
}
export interface PreviewResult {
  source: 'pdf' | 'docx' | 'text';
  filename: string;
  charCount: number;
  chapters: PreviewChapter[];
}

const MAX_TEXT_CHARS = 600_000; // 60 万字硬上限 · 大致一本中等论典

// ── 提取纯文本 ─────────────────────────────────────

export async function parsePdfBuffer(buf: Buffer): Promise<string> {
  const r = await pdf(buf);
  return (r.text || '').trim();
}

export async function parseDocxBuffer(buf: Buffer): Promise<string> {
  const r = await mammoth.extractRawText({ buffer: buf });
  return (r.value || '').trim();
}

export function detectKindByName(filename: string): 'pdf' | 'docx' | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  return null;
}

// ── 切分启发式 ─────────────────────────────────────

// 中文数字 + 阿拉伯数字
const CN_NUM_CLASS = '一二三四五六七八九十百千万零〇两\\d';
const CHAPTER_RE = new RegExp(`^\\s*第[${CN_NUM_CLASS}]+章[\\s　]*([^\\n]*)$`, 'gm');
const SECTION_RE = new RegExp(`^\\s*第[${CN_NUM_CLASS}]+[节節][\\s　]*([^\\n]*)$`, 'gm');
// Markdown 风格 # / ## / ### 标题
const MD_H1_RE = /^#\s+(.+)$/gm;
const MD_H2_RE = /^##\s+(.+)$/gm;

function findMatches(re: RegExp, text: string): { index: number; matchEnd: number; title: string }[] {
  const out: { index: number; matchEnd: number; title: string }[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    out.push({
      index: m.index,
      matchEnd: m.index + m[0].length,
      title: (m[1] || m[0]).trim() || m[0].trim(),
    });
  }
  return out;
}

/** 按章切分 · 章内按节切分（节缺失则整章作为一节） */
export function splitToChapters(rawText: string, fallbackTitle: string): PreviewChapter[] {
  const text = rawText.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  // 1) 找章
  let chapterMarks = findMatches(CHAPTER_RE, text);
  // fallback 1：找 Markdown # 一级标题
  if (chapterMarks.length === 0) chapterMarks = findMatches(MD_H1_RE, text);

  if (chapterMarks.length === 0) {
    // 整篇做一个 chapter · 再尝试按节切
    return [
      {
        title: fallbackTitle,
        lessons: splitToLessons(text, fallbackTitle),
      },
    ];
  }

  // 2) 按章边界切片
  const chapters: PreviewChapter[] = [];
  for (let i = 0; i < chapterMarks.length; i++) {
    const start = chapterMarks[i].matchEnd;
    const end = i + 1 < chapterMarks.length ? chapterMarks[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    const title = chapterMarks[i].title || `第 ${i + 1} 章`;
    chapters.push({ title, lessons: splitToLessons(body, title) });
  }
  // 章前 preface（首章之前的文字）作为"前言"独立章节，避免丢失
  const preface = text.slice(0, chapterMarks[0].index).trim();
  if (preface) {
    chapters.unshift({ title: '前言', lessons: [{ title: '前言', referenceText: preface }] });
  }
  return chapters;
}

function splitToLessons(chapterBody: string, chapterTitle: string): PreviewLesson[] {
  let marks = findMatches(SECTION_RE, chapterBody);
  if (marks.length === 0) marks = findMatches(MD_H2_RE, chapterBody);
  if (marks.length === 0) {
    return [{ title: chapterTitle, referenceText: chapterBody.trim() }];
  }
  const lessons: PreviewLesson[] = [];
  // section 前小段（章引言）→ 放第一个 lesson 之前的文本作为 "引言" lesson
  const intro = chapterBody.slice(0, marks[0].index).trim();
  if (intro) {
    lessons.push({ title: '引言', referenceText: intro });
  }
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].matchEnd;
    const end = i + 1 < marks.length ? marks[i + 1].index : chapterBody.length;
    const body = chapterBody.slice(start, end).trim();
    const title = marks[i].title || `第 ${i + 1} 节`;
    lessons.push({ title, referenceText: body });
  }
  return lessons;
}

// ── 主入口：从文件 buffer 到预览结构 ────────────────

export async function buildPreviewFromBuffer(
  filename: string,
  buf: Buffer,
): Promise<PreviewResult> {
  const kind = detectKindByName(filename);
  if (!kind) {
    throw BadRequest('仅支持 .pdf / .docx', { filename });
  }
  const rawText = kind === 'pdf'
    ? await parsePdfBuffer(buf)
    : await parseDocxBuffer(buf);

  if (!rawText) {
    throw BadRequest(
      kind === 'pdf'
        ? '未提取到文字（可能为扫描版 PDF · 暂不支持 OCR）'
        : '文档无可提取文本',
    );
  }
  if (rawText.length > MAX_TEXT_CHARS) {
    throw BadRequest(`文本超过 ${MAX_TEXT_CHARS} 字上限（实际 ${rawText.length} 字），请拆分后再上传`);
  }

  // 文件名（去后缀）做 fallback 标题
  const fallbackTitle = filename.replace(/\.[^.]+$/, '').trim() || '正文';
  const chapters = splitToChapters(rawText, fallbackTitle);

  return {
    source: kind,
    filename,
    charCount: rawText.length,
    chapters,
  };
}

// ── 写入：commit 预览到数据库 ─────────────────────

export interface CommitNewCourse {
  slug: string;
  title: string;
  titleTraditional?: string;
  author?: string;
  description?: string;
  coverEmoji?: string;
  isPublished?: boolean;
}

export interface CommitInput {
  /** new = 创建新法本; append = 在现有法本末尾追加章节 */
  mode: 'new' | 'append';
  /** mode=append 必填 */
  courseId?: string;
  /** mode=new 必填 */
  newCourse?: CommitNewCourse;
  chapters: PreviewChapter[];
}

export interface CommitResult {
  courseId: string;
  chapterCount: number;
  lessonCount: number;
}

/** 写入预览树到数据库，单事务保证原子性 */
export async function commitImport(
  adminId: string,
  input: CommitInput,
): Promise<CommitResult> {
  if (!Array.isArray(input.chapters) || input.chapters.length === 0) {
    throw BadRequest('章节列表不能为空');
  }
  for (const ch of input.chapters) {
    if (!ch.title || !ch.title.trim()) throw BadRequest('每章必须有标题');
    if (!Array.isArray(ch.lessons) || ch.lessons.length === 0) {
      throw BadRequest(`章「${ch.title}」下必须至少 1 个课时`);
    }
    for (const le of ch.lessons) {
      if (!le.title || !le.title.trim()) {
        throw BadRequest(`章「${ch.title}」下有课时缺标题`);
      }
    }
  }

  let appendCourseId = '';
  let baseChapterOrder = 0;

  if (input.mode === 'new') {
    if (!input.newCourse) throw BadRequest('mode=new 必须提供 newCourse');
    const nc = input.newCourse;
    if (!nc.slug || !nc.title) throw BadRequest('newCourse 缺 slug / title');
    if (await prisma.course.findUnique({ where: { slug: nc.slug } })) {
      throw Conflict('slug 已被占用');
    }
  } else {
    if (!input.courseId) throw BadRequest('mode=append 必须提供 courseId');
    const exist = await prisma.course.findUnique({
      where: { id: input.courseId },
      include: { chapters: { orderBy: { order: 'desc' }, take: 1 } },
    });
    if (!exist) throw NotFound('目标法本不存在');
    appendCourseId = exist.id;
    baseChapterOrder = exist.chapters[0]?.order ?? 0;
  }

  const result = await prisma.$transaction(async (tx) => {
    let cid: string;

    if (input.mode === 'new') {
      const nc = input.newCourse!;
      const course = await tx.course.create({
        data: {
          slug: nc.slug.trim(),
          title: nc.title.trim(),
          titleTraditional: nc.titleTraditional?.trim() || null,
          author: nc.author?.trim() || null,
          description: nc.description?.trim() || null,
          coverEmoji: nc.coverEmoji?.trim() || '🪷',
          isPublished: nc.isPublished ?? false, // 导入默认 未发布 · admin 校对后再发
        },
      });
      cid = course.id;
    } else {
      cid = appendCourseId;
    }

    let totalLessons = 0;
    for (let ci = 0; ci < input.chapters.length; ci++) {
      const ch = input.chapters[ci];
      const chapter = await tx.chapter.create({
        data: {
          courseId: cid,
          order: baseChapterOrder + ci + 1,
          title: ch.title.trim(),
        },
      });
      for (let li = 0; li < ch.lessons.length; li++) {
        const le = ch.lessons[li];
        await tx.lesson.create({
          data: {
            chapterId: chapter.id,
            order: li + 1,
            title: le.title.trim(),
            referenceText: le.referenceText?.trim() || null,
            teachingSummary: le.teachingSummary?.trim() || null,
          },
        });
        totalLessons++;
      }
    }

    await tx.auditLog.create({
      data: {
        adminId,
        action: input.mode === 'new' ? 'course.import.new' : 'course.import.append',
        targetType: 'course',
        targetId: cid,
        after: {
          mode: input.mode,
          chapterCount: input.chapters.length,
          lessonCount: totalLessons,
        } as Prisma.InputJsonValue,
      },
    });

    return { courseId: cid, chapterCount: input.chapters.length, lessonCount: totalLessons };
  });

  return result;
}
