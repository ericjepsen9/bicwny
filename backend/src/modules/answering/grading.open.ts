// Open 题（问答）策略
// 默认 mock（keyPoint 子串命中）；ctx.useLlm=true 时走 gateway.chat('open_grading')。
// LLM 失败（网络/解析/所有 provider 不可用）→ 自动降级到 mock，保证答题流不中断。
import type { Question } from '@prisma/client';
import { chat, type ChatContext } from '../llm/gateway.js';
import { loadPromptTemplate, renderPrompt } from '../llm/prompt.js';
import { gradeMockOpen } from './grading.mockOpen.js';
import type { AnswerGrade, GradingStrategy } from './grading.strategy.js';

export const openStrategy: GradingStrategy = {
  types: ['open'],
  async grade(q, answer, ctx) {
    if (ctx.useLlm) {
      try {
        return await gradeOpenWithLlm(q, answer, ctx.llmCtx ?? {});
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
  },
};

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
