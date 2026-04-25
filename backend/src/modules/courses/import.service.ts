// 法本导入解析 service · F2.1
//
// 输入：上传文件 buffer + mime/扩展
// 输出：预览结构 { source, filename, chapters: [{ title, lessons: [{ title, referenceText }] }] }
//
// 流程：
//   1. parsePdf / parseDocx → 纯文本
//   2. splitToChapters → 按"第X章"启发切章；章内按"第X节"切节
//      · 无章标题 → 整篇做一个 chapter，章 title = 文件名
//      · 章内无节 → 章下放一个 lesson，lesson title 同章 title
//   3. 返回结构供 admin 在前端预览编辑后再 commit 写库
//
// 不在范围：
//   · OCR（扫描版 PDF 无文字层 → 抛 EMPTY_TEXT）
//   · 复杂格式（DOCX 表格 / 图片 / 公式）只取 raw text
//   · 中文姓名 / 标题正则边界 case 由 admin 在预览中手改

import mammoth from 'mammoth';
// pdf-parse@1.1.1 有顶层副作用（找测试 PDF）→ 走 lib 子路径绕开
import pdf from 'pdf-parse/lib/pdf-parse.js';

import { BadRequest } from '../../lib/errors.js';

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
