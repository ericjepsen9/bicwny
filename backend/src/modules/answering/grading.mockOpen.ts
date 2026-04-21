// Mock open grader（Sprint 1 联调 / 离线用）
// 基于 payload.keyPoints[].signals 的子串匹配，给出一个粗略分 + 中文反馈。
// Claude/MiniMax 正式接通后，由 gateway.chat('open_grading', ...) 替代。
import type { Question } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';
import type { GradeResult } from './grading.objective.js';

export interface MockOpenResult extends GradeResult {
  covered: string[];
  missing: string[];
  mocked: true;
}

interface OpenPayload {
  keyPoints: Array<{ point: string; signals: string[] }>;
  minLength?: number;
  maxLength?: number;
}

export function gradeMockOpen(q: Question, answer: unknown): MockOpenResult {
  if (q.type !== 'open') {
    throw BadRequest(`gradeMockOpen 仅支持 open 题，得到 ${q.type}`);
  }
  const payload = (q.payload ?? {}) as OpenPayload;
  const keyPoints = payload.keyPoints ?? [];
  const text = String((answer as { text?: string })?.text ?? '').trim();
  const len = [...text].length;

  // 覆盖统计
  const covered: string[] = [];
  const missing: string[] = [];
  for (const kp of keyPoints) {
    const hit = (kp.signals ?? []).some((s) => s && text.includes(s));
    (hit ? covered : missing).push(kp.point);
  }

  // 基础分：30 分底 + 覆盖比例 × 70
  const total = Math.max(1, keyPoints.length);
  let score = Math.round(30 + (covered.length / total) * 70);

  // 字数约束
  const minLen = payload.minLength ?? 0;
  const maxLen = payload.maxLength ?? Infinity;
  let lengthNote = '';
  if (minLen > 0 && len < minLen) {
    score = Math.min(score, 50);
    lengthNote = `字数不足（${len}/${minLen}）`;
  } else if (maxLen !== Infinity && len > maxLen * 1.3) {
    score = Math.max(0, score - 10);
    lengthNote = `篇幅偏长（${len} 字，建议 ≤ ${maxLen}）`;
  }

  return {
    isCorrect: score >= 80,
    score,
    feedback: buildFeedback(score, covered, missing, lengthNote),
    covered,
    missing,
    mocked: true,
  };
}

function buildFeedback(
  score: number,
  covered: string[],
  missing: string[],
  lengthNote: string,
): string {
  const tier =
    score >= 90 ? '圆满'
      : score >= 75 ? '良好'
      : score >= 60 ? '及格'
      : score >= 40 ? '待补充'
      : '请重新思考';

  const parts = [`评价：${tier}。`];
  if (covered.length > 0) {
    parts.push(`你已触及：${covered.slice(0, 3).join('、')}。`);
  }
  if (missing.length > 0) {
    parts.push(`建议补充：${missing.slice(0, 2).join('、')}。`);
  }
  if (lengthNote) parts.push(lengthNote);
  return parts.join(' ');
}
