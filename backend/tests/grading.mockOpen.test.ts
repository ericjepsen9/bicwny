import type { Question } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { gradeMockOpen } from '../src/modules/answering/grading.mockOpen.js';

const makeOpen = (payload: unknown): Question =>
  ({ type: 'open', questionText: '测试', payload }) as unknown as Question;

const BASE_PAYLOAD = {
  keyPoints: [
    { point: '动机广大', signals: ['利益一切', '众生'] },
    { point: '对治我执', signals: ['我执', '对治'] },
    { point: '发佛性', signals: ['如来种性', '佛性'] },
  ],
  minLength: 30,
  maxLength: 200,
};

describe('gradeMockOpen', () => {
  it('mocked=true 标记 + source 可识别', () => {
    const r = gradeMockOpen(makeOpen(BASE_PAYLOAD), { text: 'x' });
    expect(r.mocked).toBe(true);
  });

  it('空答案 → 低分 + 字数不足提示 + covered 空', () => {
    const r = gradeMockOpen(makeOpen(BASE_PAYLOAD), { text: '' });
    expect(r.score).toBeLessThanOrEqual(50);
    expect(r.feedback).toMatch(/字数不足/);
    expect(r.covered).toEqual([]);
  });

  it('覆盖 1/3 要点 → 40-59 待补充', () => {
    const text = '菩提心利益一切众生，让我们心量广大广大广大广大广大广大广大广大广大广大广大。';
    const r = gradeMockOpen(makeOpen(BASE_PAYLOAD), { text });
    expect(r.score).toBeGreaterThan(40);
    expect(r.score).toBeLessThan(60);
    expect(r.covered).toContain('动机广大');
    expect(r.feedback).toMatch(/待补充/);
  });

  it('覆盖 2/3 要点 → ≥ 60 （及格或良好）', () => {
    const text = '菩提心利益一切众生，对治我执我执我执我执我执我执我执我执我执我执我执我执。';
    const r = gradeMockOpen(makeOpen(BASE_PAYLOAD), { text });
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.covered.length).toBe(2);
    expect(r.missing).toContain('发佛性');
  });

  it('覆盖全部要点 → ≥ 90 圆满 · isCorrect=true', () => {
    const text = '菩提心利益一切众生，对治我执，令如来种性现前。菩提心的广大心量是关键。';
    const r = gradeMockOpen(makeOpen(BASE_PAYLOAD), { text });
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.covered.length).toBe(3);
    expect(r.missing).toEqual([]);
    expect(r.isCorrect).toBe(true);
    expect(r.feedback).toMatch(/圆满/);
  });

  it('过长答案 → 扣 10 + 篇幅偏长提示', () => {
    const text = '菩提心利益一切众生对治我执令如来种性现前菩提心广大心量是关键';
    const normal = gradeMockOpen(makeOpen(BASE_PAYLOAD), { text });
    const overLimit = gradeMockOpen(
      makeOpen({ ...BASE_PAYLOAD, maxLength: 10 }),
      { text },
    );
    expect(overLimit.score).toBeLessThan(normal.score);
    expect(overLimit.feedback).toMatch(/篇幅偏长/);
  });

  it('非 open 题抛错', () => {
    expect(() =>
      gradeMockOpen({ type: 'single' } as Question, { text: 'x' }),
    ).toThrow();
  });
});
