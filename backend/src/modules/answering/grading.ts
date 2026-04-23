// 评分分发器
// 客观题：gradeObjective（同步）含 single/fill/multi/sort/match/image/listen/scenario/flow
// 开放题：默认 gradeMockOpen；opts.useLlm=true 走 gateway.chat('open_grading')
//         LLM 解析失败或调用失败，自动降级到 mock，保证答题流不中断。
// v2.0：
//   flip   → gradeFlip（自评 → SM-2 quality）
//   guided → gradeMockGuided（多步 keyPoint 命中；LLM 模式 TODO）
import type { Question } from '@prisma/client';
import { chat, type ChatContext } from '../llm/gateway.js';
import { loadPromptTemplate, renderPrompt } from '../llm/prompt.js';
import { gradeFlip } from './grading.flip.js';
import { gradeMockGuided } from './grading.mockGuided.js';
import { gradeMockOpen } from './grading.mockOpen.js';
import { gradeObjective } from './grading.objective.js';

export interface AnswerGrade {
  isCorrect: boolean;
  score: number;
  feedback?: string;
  covered?: string[];
  missing?: string[];
  source:
    | 'objective'
    | 'mock_open'
    | 'llm_open'
    | 'flip_self'
    | 'mock_guided';
  /** flip 题返回的 SM-2 quality 0..5 */
  sm2Quality?: number;
  /** guided 题每步详情 */
  perStep?: Array<{ stepNum: number; score: number; hits: string[]; missed: string[] }>;
  /** 仅 llm_open 保留，供 Admin 调试 */
  raw?: unknown;
}

export interface GradeOptions {
  useLlm?: boolean;
  llmCtx?: ChatContext;
}

export async function gradeAnswer(
  q: Question,
  answer: unknown,
  opts: GradeOptions = {},
): Promise<AnswerGrade> {
  // v2.0 flip：自评 → SM-2 quality
  if (q.type === 'flip') {
    const r = gradeFlip(q, answer);
    return {
      isCorrect: r.isCorrect,
      score: r.score,
      feedback: r.feedback,
      sm2Quality: r.sm2Quality,
      source: 'flip_self',
    };
  }

  // v2.0 guided：多步骤 mock（未来可接 LLM per-step，同 open 降级模式）
  if (q.type === 'guided') {
    const r = gradeMockGuided(q, answer);
    return {
      isCorrect: r.isCorrect,
      score: r.score,
      feedback: r.feedback,
      perStep: r.perStep,
      source: 'mock_guided',
    };
  }

  // 客观题（含 v2.0 的 image / listen / scenario / flow）
  if (q.type !== 'open') {
    const r = gradeObjective(q, answer);
    return { ...r, source: 'objective' };
  }

  // 开放题
  if (opts.useLlm) {
    try {
      return await gradeOpenWithLlm(q, answer, opts.llmCtx ?? {});
    } catch (e) {
      console.warn(
        '[grading] LLM open_grading 失败，降级到 mock：',
        e instanceof Error ? e.message : e,
      );
    }
  }

  const m = gradeMockOpen(q, answer);
  return {
    isCorrect: m.isCorrect,
    score: m.score,
    feedback: m.feedback,
    covered: m.covered,
    missing: m.missing,
    source: 'mock_open',
  };
}

// ───── LLM 路径 ─────

async function gradeOpenWithLlm(
  q: Question,
  answer: unknown,
  ctx: ChatContext,
): Promise<AnswerGrade> {
  const payload = (q.payload ?? {}) as {
    referenceAnswer?: string;
    keyPoints?: Array<{ point: string; signals: string[] }>;
  };
  const template = await loadPromptTemplate('open_grading');
  const prompt = renderPrompt(template, {
    question: q.questionText,
    referenceAnswer: payload.referenceAnswer ?? '',
    keyPoints: payload.keyPoints ?? [],
    studentAnswer: String((answer as { text?: string })?.text ?? ''),
  });

  const resp = await chat('open_grading', [{ role: 'user', content: prompt }], ctx);
  const parsed = parseGradeJson(resp.content);

  return {
    isCorrect: parsed.score >= 80,
    score: parsed.score,
    feedback: parsed.feedback,
    covered: parsed.covered,
    missing: parsed.missing,
    source: 'llm_open',
    raw: resp.content,
  };
}

interface ParsedGrade {
  score: number;
  covered: string[];
  missing: string[];
  feedback: string;
}

function parseGradeJson(text: string): ParsedGrade {
  // 剥除可能的 markdown 代码块围栏
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const obj = JSON.parse(cleaned) as Partial<ParsedGrade>;
  return {
    score: clamp(Number(obj.score) || 0, 0, 100),
    covered: Array.isArray(obj.covered) ? obj.covered.map(String) : [],
    missing: Array.isArray(obj.missing) ? obj.missing.map(String) : [],
    feedback: String(obj.feedback ?? ''),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
