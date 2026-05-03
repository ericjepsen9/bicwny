// LLM 生成结果的 JSON 解析 + 结构校验（无副作用 · 单元可测）
// 从 generate.service.ts 拆出，方便脱库测试。
import type { QuestionType } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';

export interface RawQuestion {
  questionText?: string;
  correctText?: string;
  wrongText?: string;
  difficulty?: number;
  tags?: unknown;
  source?: string;
  payload?: unknown;
  [k: string]: unknown;
}

export type Check = { ok: true } | { ok: false; reason: string };

export function parseGeneratedArray(text: string): RawQuestion[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch (e) {
    throw BadRequest('LLM 返回非 JSON', {
      message: e instanceof Error ? e.message : String(e),
      preview: cleaned.slice(0, 400),
    });
  }
  if (!Array.isArray(obj)) {
    throw BadRequest('LLM 返回不是数组', { preview: cleaned.slice(0, 400) });
  }
  return obj as RawQuestion[];
}

export function validateGenerated(item: RawQuestion, type: QuestionType): Check {
  if (!item || typeof item !== 'object') return { ok: false, reason: '非对象' };
  if (!item.questionText || typeof item.questionText !== 'string') {
    return { ok: false, reason: '缺 questionText' };
  }
  if (!item.payload || typeof item.payload !== 'object') {
    return { ok: false, reason: '缺 payload' };
  }
  const p = item.payload as Record<string, unknown>;
  switch (type) {
    case 'single':
    case 'image':
    case 'listen': {
      const opts = p.options as Array<{ correct?: boolean }> | undefined;
      if (!Array.isArray(opts) || opts.length < 2) {
        return { ok: false, reason: 'options 至少 2' };
      }
      if (opts.filter((o) => o.correct).length !== 1) {
        return { ok: false, reason: '需恰 1 个 correct=true' };
      }
      return { ok: true };
    }
    case 'multi':
    case 'scenario': {
      const opts = p.options as Array<{ correct?: boolean }> | undefined;
      if (!Array.isArray(opts) || opts.length < 3) {
        return { ok: false, reason: 'options 至少 3' };
      }
      if (opts.filter((o) => o.correct).length < 2) {
        return { ok: false, reason: '至少 2 个 correct=true' };
      }
      return { ok: true };
    }
    case 'fill':
      if (!Array.isArray(p.verseLines) || !p.correctWord) {
        return { ok: false, reason: 'fill 缺 verseLines/correctWord' };
      }
      return { ok: true };
    case 'sort':
      if (!Array.isArray(p.items) || p.items.length < 2) {
        return { ok: false, reason: 'sort.items 至少 2' };
      }
      return { ok: true };
    case 'match':
      if (
        !Array.isArray(p.left) ||
        !Array.isArray(p.right) ||
        p.left.length === 0
      ) {
        return { ok: false, reason: 'match 缺 left/right' };
      }
      return { ok: true };
    case 'open':
      if (!p.referenceAnswer || !Array.isArray(p.keyPoints)) {
        return { ok: false, reason: 'open 缺 referenceAnswer/keyPoints' };
      }
      return { ok: true };
    case 'guided':
      if (!Array.isArray(p.steps) || p.steps.length === 0) {
        return { ok: false, reason: 'guided 缺 steps' };
      }
      return { ok: true };
    case 'flow':
      if (!Array.isArray(p.slots) || p.slots.length === 0) {
        return { ok: false, reason: 'flow 缺 slots' };
      }
      return { ok: true };
    case 'flip':
      if (!p.front || !p.back) return { ok: false, reason: 'flip 缺 front/back' };
      return { ok: true };
    default:
      return { ok: false, reason: `不支持的 type: ${type}` };
  }
}

export function clampInt(n: unknown, lo: number, hi: number): number {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}
