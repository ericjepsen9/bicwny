import type { Question } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { gradeMockGuided } from '../src/modules/answering/grading.mockGuided.js';

const makeGuided = (): Question =>
  ({
    type: 'guided',
    payload: {
      finalQuestion: '为什么菩提心是大乘根本？',
      steps: [
        { stepNum: 1, prompt: '定义', keyPoints: ['为利众生', '愿成佛'] },
        { stepNum: 2, prompt: '利益', keyPoints: ['成佛因', '净罪障', '圆福德'] },
        { stepNum: 3, prompt: '总结', keyPoints: ['综合'] },
      ],
    },
  }) as unknown as Question;

describe('gradeMockGuided · 分步打分', () => {
  it('每步全中 → 100 · isCorrect', () => {
    const r = gradeMockGuided(makeGuided(), {
      stepAnswers: {
        '1': '菩提心是为利众生愿成佛的心',
        '2': '菩提心有成佛因、净罪障、圆福德的利益',
        '3': '综合以上所以是大乘根本',
      },
    });
    expect(r.score).toBe(100);
    expect(r.isCorrect).toBe(true);
    expect(r.perStep).toHaveLength(3);
    expect(r.perStep[0].hits).toEqual(['为利众生', '愿成佛']);
  });

  it('部分 keyPoint 缺失 → 部分分', () => {
    const r = gradeMockGuided(makeGuided(), {
      stepAnswers: {
        '1': '为利众生之心', // 只命中 1/2
        '2': '成佛因和净罪障', // 2/3
        '3': '综合', // 1/1
      },
    });
    // 平均 (50 + 67 + 100) / 3 ≈ 72
    expect(r.score).toBe(72);
    expect(r.isCorrect).toBe(false);
  });

  it('空答步骤 → 该步 0', () => {
    const r = gradeMockGuided(makeGuided(), { stepAnswers: { '1': '' } });
    expect(r.perStep[0].score).toBe(0);
    expect(r.perStep[0].missed).toEqual(['为利众生', '愿成佛']);
    expect(r.isCorrect).toBe(false);
  });

  it('非 guided 题抛错', () => {
    const q = { type: 'open', payload: {} } as unknown as Question;
    expect(() => gradeMockGuided(q, { stepAnswers: {} })).toThrow();
  });

  it('空 steps 抛错', () => {
    const q = { type: 'guided', payload: { steps: [] } } as unknown as Question;
    expect(() => gradeMockGuided(q, { stepAnswers: {} })).toThrow();
  });
});
