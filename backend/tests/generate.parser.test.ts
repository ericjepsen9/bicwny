import { describe, expect, it } from 'vitest';
import {
  clampInt,
  parseGeneratedArray,
  validateGenerated,
} from '../src/modules/questions/generate.parser.js';

describe('parseGeneratedArray', () => {
  it('纯 JSON 数组 → 直接解析', () => {
    const arr = parseGeneratedArray('[{"questionText":"q"}]');
    expect(arr).toHaveLength(1);
    expect(arr[0].questionText).toBe('q');
  });

  it('带 ```json 代码块围栏 → 自动剥除', () => {
    const raw = '```json\n[{"questionText":"q"}]\n```';
    const arr = parseGeneratedArray(raw);
    expect(arr).toHaveLength(1);
  });

  it('带 ``` 无语言标记 → 也能剥除', () => {
    const arr = parseGeneratedArray('```\n[{"questionText":"q"}]\n```');
    expect(arr).toHaveLength(1);
  });

  it('非 JSON 抛 BadRequest', () => {
    expect(() => parseGeneratedArray('not json')).toThrow(/非 JSON/);
  });

  it('JSON 但不是数组 → 抛 BadRequest', () => {
    expect(() => parseGeneratedArray('{"a":1}')).toThrow(/不是数组/);
  });
});

describe('validateGenerated · 12 种 type', () => {
  const base = { questionText: '测试题', payload: {} };

  it('single · 恰 1 个 correct → ok', () => {
    const r = validateGenerated(
      {
        ...base,
        payload: {
          options: [
            { text: 'a', correct: true },
            { text: 'b', correct: false },
          ],
        },
      },
      'single',
    );
    expect(r.ok).toBe(true);
  });

  it('single · 2 个 correct → 拒', () => {
    const r = validateGenerated(
      {
        ...base,
        payload: {
          options: [
            { text: 'a', correct: true },
            { text: 'b', correct: true },
          ],
        },
      },
      'single',
    );
    expect(r.ok).toBe(false);
  });

  it('image/listen · 与 single 同规则', () => {
    const payload = {
      options: [
        { text: 'a', correct: true },
        { text: 'b', correct: false },
      ],
    };
    expect(validateGenerated({ ...base, payload }, 'image').ok).toBe(true);
    expect(validateGenerated({ ...base, payload }, 'listen').ok).toBe(true);
  });

  it('multi · 至少 2 个 correct', () => {
    const good = validateGenerated(
      {
        ...base,
        payload: {
          options: [
            { text: 'a', correct: true },
            { text: 'b', correct: true },
            { text: 'c', correct: false },
          ],
        },
      },
      'multi',
    );
    expect(good.ok).toBe(true);

    const bad = validateGenerated(
      {
        ...base,
        payload: {
          options: [
            { text: 'a', correct: true },
            { text: 'b', correct: false },
            { text: 'c', correct: false },
          ],
        },
      },
      'multi',
    );
    expect(bad.ok).toBe(false);
  });

  it('scenario · 与 multi 同规则', () => {
    const r = validateGenerated(
      {
        ...base,
        payload: {
          scenario: '有人辱骂你',
          options: [
            { text: 'a', correct: true, reason: 'r' },
            { text: 'b', correct: true, reason: 'r' },
            { text: 'c', correct: false, reason: 'r' },
          ],
        },
      },
      'scenario',
    );
    expect(r.ok).toBe(true);
  });

  it('fill · 要 verseLines + correctWord', () => {
    expect(
      validateGenerated(
        {
          ...base,
          payload: { verseLines: ['a', 'b'], correctWord: '无明' },
        },
        'fill',
      ).ok,
    ).toBe(true);
    expect(
      validateGenerated({ ...base, payload: { verseLines: ['a'] } }, 'fill').ok,
    ).toBe(false);
  });

  it('sort · items 至少 2', () => {
    expect(
      validateGenerated(
        {
          ...base,
          payload: {
            items: [
              { text: 'a', order: 1 },
              { text: 'b', order: 2 },
            ],
          },
        },
        'sort',
      ).ok,
    ).toBe(true);
    expect(
      validateGenerated(
        { ...base, payload: { items: [{ text: 'a', order: 1 }] } },
        'sort',
      ).ok,
    ).toBe(false);
  });

  it('match · 要 left + right 非空', () => {
    expect(
      validateGenerated(
        {
          ...base,
          payload: {
            left: [{ id: 'l1', text: 'a' }],
            right: [{ id: 'r1', text: 'b', match: 'l1' }],
          },
        },
        'match',
      ).ok,
    ).toBe(true);
  });

  it('open · 要 referenceAnswer + keyPoints 数组', () => {
    expect(
      validateGenerated(
        {
          ...base,
          payload: { referenceAnswer: '参考答案', keyPoints: [] },
        },
        'open',
      ).ok,
    ).toBe(true);
  });

  it('guided · 要 steps 非空', () => {
    expect(
      validateGenerated(
        {
          ...base,
          payload: { finalQuestion: 'q', steps: [{ stepNum: 1, prompt: 'p' }] },
        },
        'guided',
      ).ok,
    ).toBe(true);
    expect(
      validateGenerated({ ...base, payload: { steps: [] } }, 'guided').ok,
    ).toBe(false);
  });

  it('flow · 要 slots 非空', () => {
    expect(
      validateGenerated(
        {
          ...base,
          payload: { slots: [{ id: 's1', x: 0, y: 0, correctItem: 'x' }] },
        },
        'flow',
      ).ok,
    ).toBe(true);
  });

  it('flip · 要 front + back', () => {
    expect(
      validateGenerated(
        { ...base, payload: { front: { text: 'f' }, back: { text: 'b' } } },
        'flip',
      ).ok,
    ).toBe(true);
    expect(
      validateGenerated({ ...base, payload: { front: { text: 'f' } } }, 'flip')
        .ok,
    ).toBe(false);
  });

  it('空 questionText → 拒', () => {
    const r = validateGenerated({ questionText: '', payload: {} }, 'single');
    expect(r.ok).toBe(false);
  });
});

describe('clampInt', () => {
  it('正常范围直通', () => {
    expect(clampInt(3, 1, 5)).toBe(3);
  });
  it('越上界', () => {
    expect(clampInt(99, 1, 5)).toBe(5);
  });
  it('越下界', () => {
    expect(clampInt(-1, 1, 5)).toBe(1);
  });
  it('NaN 取下界', () => {
    expect(clampInt('abc', 1, 5)).toBe(1);
  });
  it('小数下取整', () => {
    expect(clampInt(3.9, 1, 5)).toBe(3);
  });
});
