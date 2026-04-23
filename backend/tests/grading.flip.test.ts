import type { Question } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { gradeFlip } from '../src/modules/answering/grading.flip.js';

const makeFlip = (): Question =>
  ({
    type: 'flip',
    payload: {
      front: { text: '菩提心', subText: 'Bodhicitta' },
      back: { text: '为利众生愿成佛之心，大乘佛法的核心。' },
      noScoring: true,
    },
  }) as unknown as Question;

describe('gradeFlip · 自评驱动 SM-2', () => {
  it('again → quality 0, isCorrect=false', () => {
    const r = gradeFlip(makeFlip(), { selfRating: 'again' });
    expect(r.sm2Quality).toBe(0);
    expect(r.isCorrect).toBe(false);
    expect(r.score).toBe(0);
    expect(r.source).toBeUndefined(); // source 在 gradeAnswer 里补
  });
  it('hard → quality 3', () => {
    const r = gradeFlip(makeFlip(), { selfRating: 'hard' });
    expect(r.sm2Quality).toBe(3);
    expect(r.isCorrect).toBe(true);
    expect(r.score).toBe(60);
  });
  it('good → quality 4', () => {
    const r = gradeFlip(makeFlip(), { selfRating: 'good' });
    expect(r.sm2Quality).toBe(4);
    expect(r.isCorrect).toBe(true);
    expect(r.score).toBe(80);
  });
  it('easy → quality 5', () => {
    const r = gradeFlip(makeFlip(), { selfRating: 'easy' });
    expect(r.sm2Quality).toBe(5);
    expect(r.isCorrect).toBe(true);
    expect(r.score).toBe(100);
  });
  it('无 selfRating 抛错', () => {
    expect(() => gradeFlip(makeFlip(), {})).toThrow();
  });
  it('非 flip 题抛错', () => {
    const q = { type: 'single', payload: {} } as unknown as Question;
    expect(() => gradeFlip(q, { selfRating: 'good' })).toThrow();
  });
});
