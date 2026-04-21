// 客观题判分（5 种题型，纯函数）
// 不碰 DB，不调 LLM，便于单测。
// 输入：Question 记录 + 用户 answer（Json shape 由前端按协议提交）
// 输出：{ isCorrect, score 0-100, feedback? }
import type { Question } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';

export interface GradeResult {
  isCorrect: boolean;
  score: number;
  feedback?: string;
}

type P = Record<string, unknown>;

export function gradeObjective(q: Question, answer: unknown): GradeResult {
  const payload = (q.payload ?? {}) as P;
  switch (q.type) {
    case 'single':
      return gradeSingle(payload, answer);
    case 'fill':
      return gradeFill(payload, answer);
    case 'multi':
      return gradeMulti(payload, answer);
    case 'sort':
      return gradeSort(payload, answer);
    case 'match':
      return gradeMatch(payload, answer);
    default:
      throw BadRequest(`gradeObjective 不支持题型: ${q.type}`);
  }
}

// ───── single ─────
// payload: { options: [{text, correct}] }
// answer:  { selectedIndex: number }
interface Option {
  text: string;
  correct: boolean;
}
function gradeSingle(p: P, a: unknown): GradeResult {
  const options = (p.options ?? []) as Option[];
  const idx = (a as { selectedIndex?: number })?.selectedIndex ?? -1;
  const isCorrect = options[idx]?.correct === true;
  return { isCorrect, score: isCorrect ? 100 : 0 };
}

// ───── fill ─────
// payload: { correctWord, options: string[] }
// answer:  { value?: string } 或 { selectedOption?: number }
function gradeFill(p: P, a: unknown): GradeResult {
  const correct = String(p.correctWord ?? '').trim();
  const ans = (a ?? {}) as { value?: string; selectedOption?: number };
  let picked = '';
  if (typeof ans.value === 'string') {
    picked = ans.value.trim();
  } else if (typeof ans.selectedOption === 'number') {
    const opts = (p.options ?? []) as string[];
    picked = (opts[ans.selectedOption] ?? '').trim();
  }
  const isCorrect = picked !== '' && picked === correct;
  return { isCorrect, score: isCorrect ? 100 : 0 };
}

// ───── multi ─────
// payload: { options, scoringMode: 'strict'|'partial' }
// answer:  { selectedIndexes: number[] }
function gradeMulti(p: P, a: unknown): GradeResult {
  const options = (p.options ?? []) as Option[];
  const mode = ((p.scoringMode as string) ?? 'strict') as 'strict' | 'partial';
  const selected = new Set(
    ((a as { selectedIndexes?: number[] })?.selectedIndexes ?? []).filter(
      (i) => typeof i === 'number',
    ),
  );
  const correctSet = new Set(
    options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0),
  );

  if (mode === 'strict') {
    const same =
      selected.size === correctSet.size &&
      [...selected].every((i) => correctSet.has(i));
    return { isCorrect: same, score: same ? 100 : 0 };
  }

  // partial：命中 +1，错选 -1，漏选不扣；归一到 0..100
  let points = 0;
  for (let i = 0; i < options.length; i++) {
    const hit = selected.has(i);
    const expected = correctSet.has(i);
    if (expected && hit) points++;
    else if (!expected && hit) points--;
  }
  const max = Math.max(1, correctSet.size);
  const score = Math.max(0, Math.round((points / max) * 100));
  return {
    isCorrect: score === 100,
    score,
    feedback: score === 100 ? undefined : `部分得分：${score} / 100`,
  };
}

// ───── sort ─────
// payload: { items: [{text, order}] }  order 为正确位次（1-based）
// answer:  { order: number[] }         用户的排列，值为 items 的索引
function gradeSort(p: P, a: unknown): GradeResult {
  const items = (p.items ?? []) as Array<{ text: string; order: number }>;
  const userOrder = ((a as { order?: number[] })?.order ?? []).filter(
    (n) => typeof n === 'number',
  );
  if (userOrder.length !== items.length) {
    return { isCorrect: false, score: 0, feedback: '排序项数不正确' };
  }
  let hits = 0;
  for (let i = 0; i < userOrder.length; i++) {
    const item = items[userOrder[i]];
    if (item && item.order === i + 1) hits++;
  }
  const score = Math.round((hits / items.length) * 100);
  return { isCorrect: score === 100, score };
}

// ───── match ─────
// payload: { left, right: [{id, text, match}] }  match 指向左侧 id
// answer:  { pairs: Record<leftId, rightId> }
function gradeMatch(p: P, a: unknown): GradeResult {
  const right = (p.right ?? []) as Array<{ id: string; match: string }>;
  const pairs = ((a as { pairs?: Record<string, string> })?.pairs ?? {});
  const total = right.length;
  if (total === 0) return { isCorrect: false, score: 0 };
  let hits = 0;
  for (const r of right) {
    if (pairs[r.match] === r.id) hits++;
  }
  const score = Math.round((hits / total) * 100);
  return { isCorrect: score === 100, score };
}
