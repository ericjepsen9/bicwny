import type { Question, QuestionType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { gradeObjective } from '../src/modules/answering/grading.objective.js';

// gradeObjective 只读 type + payload，用最小存根避免构造完整 Question
const makeQ = (type: QuestionType, payload: unknown): Question =>
  ({ type, payload }) as unknown as Question;

describe('gradeObjective · single', () => {
  const q = makeQ('single', {
    options: [
      { text: 'A', correct: false },
      { text: 'B', correct: true },
    ],
  });
  it('选中正确选项 → 100', () => {
    expect(gradeObjective(q, { selectedIndex: 1 })).toMatchObject({ isCorrect: true, score: 100 });
  });
  it('选错 → 0', () => {
    expect(gradeObjective(q, { selectedIndex: 0 })).toMatchObject({ isCorrect: false, score: 0 });
  });
});

describe('gradeObjective · fill', () => {
  const q = makeQ('fill', { correctWord: '难', options: ['难', '易', '不', '可'] });
  it('value 文本匹配（trim）', () => {
    expect(gradeObjective(q, { value: '难' }).isCorrect).toBe(true);
    expect(gradeObjective(q, { value: '难 ' }).isCorrect).toBe(true);
    expect(gradeObjective(q, { value: '易' }).isCorrect).toBe(false);
  });
  it('selectedOption 索引匹配', () => {
    expect(gradeObjective(q, { selectedOption: 0 }).score).toBe(100);
    expect(gradeObjective(q, { selectedOption: 1 }).score).toBe(0);
  });
});

describe('gradeObjective · multi', () => {
  const options = [
    { text: 'a', correct: true },
    { text: 'b', correct: true },
    { text: 'c', correct: false },
  ];

  it('strict：全对才 100', () => {
    const q = makeQ('multi', { scoringMode: 'strict', options });
    expect(gradeObjective(q, { selectedIndexes: [0, 1] }).score).toBe(100);
    expect(gradeObjective(q, { selectedIndexes: [0] }).score).toBe(0);
    expect(gradeObjective(q, { selectedIndexes: [0, 1, 2] }).score).toBe(0);
  });

  it('partial：命中 +1 错选 -1 漏选不扣', () => {
    const q = makeQ('multi', { scoringMode: 'partial', options });
    expect(gradeObjective(q, { selectedIndexes: [0, 1] }).score).toBe(100);
    expect(gradeObjective(q, { selectedIndexes: [0] }).score).toBe(50);
    expect(gradeObjective(q, { selectedIndexes: [0, 2] }).score).toBe(0); // +1 -1 = 0
    expect(gradeObjective(q, { selectedIndexes: [] }).score).toBe(0);
  });
});

describe('gradeObjective · sort', () => {
  const q = makeQ('sort', {
    items: [
      { text: 'a', order: 1 },
      { text: 'b', order: 2 },
      { text: 'c', order: 3 },
    ],
  });
  it('全对 → 100', () => {
    expect(gradeObjective(q, { order: [0, 1, 2] }).score).toBe(100);
  });
  it('部分正确按比例', () => {
    // [0,2,1] 仅第 0 位正确（items[0].order=1）
    expect(gradeObjective(q, { order: [0, 2, 1] }).score).toBe(33);
  });
  it('项数不对 → 0', () => {
    expect(gradeObjective(q, { order: [0, 1] }).score).toBe(0);
  });
});

describe('gradeObjective · match', () => {
  const payload = {
    left: [{ id: 'L1', text: '' }, { id: 'L2', text: '' }],
    right: [
      { id: 'R1', text: '', match: 'L1' },
      { id: 'R2', text: '', match: 'L2' },
    ],
  };
  const q = makeQ('match', payload);
  it('全对 → 100', () => {
    expect(gradeObjective(q, { pairs: { L1: 'R1', L2: 'R2' } }).score).toBe(100);
  });
  it('一半正确 → 50', () => {
    expect(gradeObjective(q, { pairs: { L1: 'R1', L2: 'R1' } }).score).toBe(50);
  });
  it('全错 → 0', () => {
    expect(gradeObjective(q, { pairs: { L1: 'R2', L2: 'R1' } }).score).toBe(0);
  });
});

// ═══════════════════ v2.0 新增 ═══════════════════

describe('gradeObjective · image', () => {
  const q = makeQ('image', {
    imageUrl: 'https://cdn/x.jpg',
    options: [
      { text: '观音', correct: true },
      { text: '文殊', correct: false },
    ],
  });
  it('选对像 single', () => {
    expect(gradeObjective(q, { selectedIndex: 0 })).toMatchObject({ isCorrect: true, score: 100 });
  });
  it('选错', () => {
    expect(gradeObjective(q, { selectedIndex: 1 }).isCorrect).toBe(false);
  });
});

describe('gradeObjective · listen', () => {
  const q = makeQ('listen', {
    audioUrl: 'https://cdn/y.mp3',
    options: [
      { text: 'A', correct: false },
      { text: 'B', correct: true },
    ],
  });
  it('音频选对像 single', () => {
    expect(gradeObjective(q, { selectedIndex: 1 }).score).toBe(100);
  });
});

describe('gradeObjective · scenario', () => {
  const q = makeQ('scenario', {
    scenario: '受辱时对治',
    options: [
      { text: '安忍',  correct: true,  reason: 'r1' },
      { text: '反驳',  correct: false, reason: 'r2' },
      { text: '走开',  correct: false, reason: 'r3' },
      { text: '慈悲',  correct: true,  reason: 'r4' },
    ],
  });
  it('全选对 → 100 且 isCorrect', () => {
    expect(gradeObjective(q, { selectedIndexes: [0, 3] })).toMatchObject({ isCorrect: true, score: 100 });
  });
  it('漏选 → 部分分 isCorrect=false', () => {
    const r = gradeObjective(q, { selectedIndexes: [0] });
    expect(r.isCorrect).toBe(false);
    expect(r.score).toBe(50);
  });
  it('误选 → 负分归零', () => {
    const r = gradeObjective(q, { selectedIndexes: [1, 2] });
    expect(r.isCorrect).toBe(false);
    expect(r.score).toBe(0);
  });
});

describe('gradeObjective · flow', () => {
  const q = makeQ('flow', {
    canvas: { width: 400, height: 400 },
    slots: [
      { id: 's1', x: 100, y: 50, correctItem: '无明' },
      { id: 's2', x: 200, y: 50, correctItem: '行' },
      { id: 's3', x: 300, y: 50, correctItem: '识' },
    ],
    items: [{ text: '无明' }, { text: '行' }, { text: '识' }, { text: '名色' }],
  });
  it('全对 → 100', () => {
    const r = gradeObjective(q, {
      placements: { s1: '无明', s2: '行', s3: '识' },
    });
    expect(r).toMatchObject({ isCorrect: true, score: 100 });
  });
  it('部分对 → 按比例给分', () => {
    const r = gradeObjective(q, {
      placements: { s1: '无明', s2: '识', s3: '行' },
    });
    expect(r.score).toBe(33);
    expect(r.isCorrect).toBe(false);
  });
  it('空作答 → 0', () => {
    expect(gradeObjective(q, { placements: {} }).score).toBe(0);
  });
});
