// 全文搜索 · ILIKE + position 排名（无扩展依赖）· 可叠加 pg_trgm GIN 索引加速
// P2 #24
//
// 设计：
//   - 不依赖 tsvector / 中文分词扩展（pg_jieba 等）· 任何 PG 都能跑
//   - 按 ILIKE '%q%' 过滤 · 用 LOWER(text) 里 LOWER(q) 出现位置做粗排（越前越相关）
//   - 标题命中 > 副标命中 > 正文命中 · 通过 weight 加权
//   - 可见性 / cohort / 已发布 等 join 主线表的过滤直接放 SQL
//
// 加速（可选 · 大量数据时）：
//   见 scripts/setup-search-indexes.ts
//   CREATE EXTENSION pg_trgm + GIN gin_trgm_ops 索引
//   ILIKE 自动走索引 · 改 SQL 不需要

import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MIN_QUERY_LEN = 1;

export interface SearchHitCourse {
  type: 'course';
  id: string;
  slug: string;
  title: string;
  titleTraditional: string | null;
  author: string | null;
  coverImageUrl: string | null;
  coverEmoji: string;
  score: number;
}

export interface SearchHitLesson {
  type: 'lesson';
  id: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  title: string;
  order: number;
  score: number;
}

export interface SearchHitQuestion {
  type: 'question';
  id: string;
  courseId: string;
  lessonId: string;
  questionTextPreview: string; // 截断 120 字 + … 高亮区放前端做
  source: string | null;
  score: number;
}

export type SearchHit = SearchHitCourse | SearchHitLesson | SearchHitQuestion;

export interface SearchResult {
  q: string;
  total: number;
  hits: SearchHit[];
  truncated: boolean;
}

export interface SearchOpts {
  q: string;
  kind?: 'all' | 'course' | 'lesson' | 'question';
  limit?: number;
  /** 登录用户 id · 题目搜索按 cohort + visibility 过滤 */
  viewerUserId?: string | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function previewOf(s: string, q: string, len = 120): string {
  if (!s) return '';
  const idx = s.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0 || s.length <= len) return s.slice(0, len) + (s.length > len ? '…' : '');
  // 命中位置居中截断
  const start = Math.max(0, idx - Math.floor(len / 3));
  const end = Math.min(s.length, start + len);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < s.length ? '…' : '';
  return prefix + s.slice(start, end) + suffix;
}

export async function searchAll(opts: SearchOpts): Promise<SearchResult> {
  const q = (opts.q || '').trim();
  if (q.length < MIN_QUERY_LEN) {
    return { q, total: 0, hits: [], truncated: false };
  }
  const limit = clamp(opts.limit || DEFAULT_LIMIT, 1, MAX_LIMIT);
  const kind = opts.kind || 'all';
  const pattern = `%${q.replace(/[\\_%]/g, '\\$&')}%`;

  const hits: SearchHit[] = [];

  if (kind === 'all' || kind === 'course') {
    const courses = await prisma.$queryRaw<Array<{
      id: string; slug: string; title: string; title_traditional: string | null;
      author: string | null; cover_image_url: string | null; cover_emoji: string;
      score: number;
    }>>(Prisma.sql`
      SELECT
        c."id", c."slug", c."title", c."titleTraditional" AS title_traditional,
        c."author", c."coverImageUrl" AS cover_image_url, c."coverEmoji" AS cover_emoji,
        (
          CASE WHEN LOWER(c."title") LIKE LOWER(${pattern}) THEN 100 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(c."titleTraditional", '')) LIKE LOWER(${pattern}) THEN 80 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(c."author", '')) LIKE LOWER(${pattern}) THEN 50 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(c."description", '')) LIKE LOWER(${pattern}) THEN 20 ELSE 0 END
        )::int AS score
      FROM "Course" c
      WHERE
        c."isPublished" = true AND c."archivedAt" IS NULL AND
        (
          LOWER(c."title") LIKE LOWER(${pattern}) OR
          LOWER(COALESCE(c."titleTraditional", '')) LIKE LOWER(${pattern}) OR
          LOWER(COALESCE(c."author", '')) LIKE LOWER(${pattern}) OR
          LOWER(COALESCE(c."description", '')) LIKE LOWER(${pattern})
        )
      ORDER BY score DESC, c."displayOrder" ASC
      LIMIT ${limit}
    `);
    for (const r of courses) {
      hits.push({
        type: 'course',
        id: r.id,
        slug: r.slug,
        title: r.title,
        titleTraditional: r.title_traditional,
        author: r.author,
        coverImageUrl: r.cover_image_url,
        coverEmoji: r.cover_emoji,
        score: r.score,
      });
    }
  }

  if (kind === 'all' || kind === 'lesson') {
    const lessons = await prisma.$queryRaw<Array<{
      id: string; course_id: string; course_slug: string; course_title: string;
      title: string; order: number; score: number;
    }>>(Prisma.sql`
      SELECT
        l."id", c."id" AS course_id, c."slug" AS course_slug, c."title" AS course_title,
        l."title", l."order",
        (
          CASE WHEN LOWER(l."title") LIKE LOWER(${pattern}) THEN 100 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(l."teachingSummary", '')) LIKE LOWER(${pattern}) THEN 30 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(l."referenceText", '')) LIKE LOWER(${pattern}) THEN 10 ELSE 0 END
        )::int AS score
      FROM "Lesson" l
      JOIN "Chapter" ch ON ch."id" = l."chapterId"
      JOIN "Course" c ON c."id" = ch."courseId"
      WHERE
        c."isPublished" = true AND c."archivedAt" IS NULL AND
        (
          LOWER(l."title") LIKE LOWER(${pattern}) OR
          LOWER(COALESCE(l."teachingSummary", '')) LIKE LOWER(${pattern}) OR
          LOWER(COALESCE(l."referenceText", '')) LIKE LOWER(${pattern})
        )
      ORDER BY score DESC, c."displayOrder" ASC, l."order" ASC
      LIMIT ${limit}
    `);
    for (const r of lessons) {
      hits.push({
        type: 'lesson',
        id: r.id,
        courseId: r.course_id,
        courseSlug: r.course_slug,
        courseTitle: r.course_title,
        title: r.title,
        order: r.order,
        score: r.score,
      });
    }
  }

  if (kind === 'all' || kind === 'question') {
    // viewer cohort（cohort-aware filter）
    let viewerCohort: string | null = null;
    if (opts.viewerUserId) {
      const u = await prisma.user.findUnique({
        where: { id: opts.viewerUserId },
        select: { contentCohort: true },
      });
      viewerCohort = u?.contentCohort ?? null;
    }
    const cohortClause = viewerCohort
      ? Prisma.sql`AND (q."cohort" IS NULL OR q."cohort" = ${viewerCohort})`
      : Prisma.sql`AND q."cohort" IS NULL`;

    const questions = await prisma.$queryRaw<Array<{
      id: string; course_id: string; lesson_id: string; question_text: string;
      source: string | null; score: number;
    }>>(Prisma.sql`
      SELECT
        q."id", q."courseId" AS course_id, q."lessonId" AS lesson_id,
        q."questionText" AS question_text, q."source",
        (
          CASE WHEN LOWER(q."questionText") LIKE LOWER(${pattern}) THEN 100 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(q."source", '')) LIKE LOWER(${pattern}) THEN 60 ELSE 0 END +
          CASE WHEN LOWER(q."correctText") LIKE LOWER(${pattern}) THEN 20 ELSE 0 END
        )::int AS score
      FROM "Question" q
      WHERE
        q."reviewStatus" = 'approved' AND
        q."visibility" = 'public'
        ${cohortClause}
        AND
        (
          LOWER(q."questionText") LIKE LOWER(${pattern}) OR
          LOWER(COALESCE(q."source", '')) LIKE LOWER(${pattern}) OR
          LOWER(q."correctText") LIKE LOWER(${pattern})
        )
      ORDER BY score DESC, q."createdAt" DESC
      LIMIT ${limit}
    `);
    for (const r of questions) {
      hits.push({
        type: 'question',
        id: r.id,
        courseId: r.course_id,
        lessonId: r.lesson_id,
        questionTextPreview: previewOf(r.question_text, q),
        source: r.source,
        score: r.score,
      });
    }
  }

  // 跨 kind 合并后再按 score 降序 · 截断到 limit
  hits.sort((a, b) => b.score - a.score);
  const truncated = hits.length > limit;
  return {
    q,
    total: hits.length,
    hits: truncated ? hits.slice(0, limit) : hits,
    truncated,
  };
}
