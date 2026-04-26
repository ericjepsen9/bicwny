// 客观题判分（5 种题型，纯函数）
// 不碰 DB，不调 LLM，便于单测。
// 输入：Question 记录 + 用户 answer（Json shape 由前端按协议提交）
// 输出：{ isCorrect, score 0-100, feedback? }
import type { Question } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';
import type { GradingStrategy } from './grading.strategy.js';

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
    // v2.0 ──────────────────────────────────────────
    case 'image':
      return gradeSingle(payload, answer); // 图像选择：语义等同 single
    case 'listen':
      return gradeSingle(payload, answer); // 音频选择：语义等同 single
    case 'scenario':
      return gradeScenario(payload, answer);
    case 'flow':
      return gradeFlow(payload, answer);
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
  const rawSelected = (a as { selectedIndexes?: number[] })?.selectedIndexes ?? [];
  const filtered = rawSelected.filter((i) => typeof i === 'number');
  // 至少选 1 项 · 防止误触提交 0 分（前端 disable 提交按钮也好 · 服务端再兜一道底）
  if (filtered.length === 0) {
    throw BadRequest('请至少选择一个选项再提交');
  }
  const selected = new Set(filtered);
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

// ───── scenario (v2.0) ─────
// 语义与 multi 近似（可多正确），但每个选项带 reason 供前端展开解释。
// payload: { scenario, options: [{text, correct, reason}] }
// answer:  { selectedIndexes: number[] }
// 评分：严格模式（所选集合必须等于正确集合才满分，否则按命中比例给部分分）
function gradeScenario(p: P, a: unknown): GradeResult {
  const options = (p.options ?? []) as Option[];
  const selected = new Set(
    ((a as { selectedIndexes?: number[] })?.selectedIndexes ?? []).filter(
      (i) => typeof i === 'number',
    ),
  );
  const correctSet = new Set(
    options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0),
  );
  if (correctSet.size === 0) return { isCorrect: false, score: 0 };

  // 部分得分：命中 +1，误选 -1，归一到 0..100；全等才 isCorrect
  let points = 0;
  for (let i = 0; i < options.length; i++) {
    const hit = selected.has(i);
    const expected = correctSet.has(i);
    if (expected && hit) points++;
    else if (!expected && hit) points--;
  }
  const score = Math.max(0, Math.round((points / correctSet.size) * 100));
  const exact =
    selected.size === correctSet.size &&
    [...selected].every((i) => correctSet.has(i));
  return {
    isCorrect: exact,
    score,
    feedback: exact ? undefined : `部分正确：${score} / 100`,
  };
}

// ───── flow (v2.0) ─────
// payload: {
//   canvas:{width,height,backgroundImage?},
//   slots:[{id,x,y,correctItem}],
//   items:[{text}]
// }
// answer:  { placements: Record<slotId, itemText> }
// 评分：每个 slot 放对 +1，全对满分；顺序无关（slot 位置是 payload 定的）
interface FlowSlot {
  id: string;
  correctItem: string;
}
function gradeFlow(p: P, a: unknown): GradeResult {
  const slots = (p.slots ?? []) as FlowSlot[];
  const placements = ((a as { placements?: Record<string, string> })?.placements ?? {});
  const total = slots.length;
  if (total === 0) return { isCorrect: false, score: 0 };
  let hits = 0;
  for (const s of slots) {
    if (placements[s.id] === s.correctItem) hits++;
  }
  const score = Math.round((hits / total) * 100);
  return {
    isCorrect: score === 100,
    score,
    feedback: score === 100 ? undefined : `放置正确：${hits} / ${total}`,
  };
}

export const objectiveStrategy: GradingStrategy = {
  types: ['single', 'fill', 'multi', 'sort', 'match', 'image', 'listen', 'scenario', 'flow'],
  async grade(q, answer) {
    const r = gradeObjective(q, answer);
    return { ...r, source: 'objective' };
  },
};
