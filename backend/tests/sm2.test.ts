import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, nextReview } from '../src/modules/sm2/algorithm.js';

const NOW = new Date('2026-04-21T00:00:00Z');

describe('nextReview (SM-2)', () => {
  it('新卡 rating=2 (Good) → interval=1, reps=1, status=learning', () => {
    const r = nextReview(INITIAL_STATE, 2, NOW);
    expect(r.interval).toBe(1);
    expect(r.repetitions).toBe(1);
    expect(r.easeFactor).toBeCloseTo(2.5, 5); // q=4 时 EF 不变
    expect(r.status).toBe('learning');
    expect(r.lastRating).toBe(2);
    expect(r.dueDate.toISOString()).toBe('2026-04-22T00:00:00.000Z');
  });

  it('第 2 次 reps=1 rating=2 → interval=6, reps=2, status=review', () => {
    const prev = { easeFactor: 2.5, interval: 1, repetitions: 1, status: 'learning' as const };
    const r = nextReview(prev, 2, NOW);
    expect(r.interval).toBe(6);
    expect(r.repetitions).toBe(2);
    expect(r.status).toBe('review');
  });

  it('第 3 次 reps=2 rating=2 → interval = round(6 × EF)', () => {
    const prev = { easeFactor: 2.5, interval: 6, repetitions: 2, status: 'review' as const };
    const r = nextReview(prev, 2, NOW);
    expect(r.interval).toBe(15); // 6 × 2.5
    expect(r.repetitions).toBe(3);
  });

  it('rating=0 (Again) 重置 reps/interval 并降 EF', () => {
    const prev = { easeFactor: 2.5, interval: 6, repetitions: 2, status: 'review' as const };
    const r = nextReview(prev, 0, NOW);
    expect(r.repetitions).toBe(0);
    expect(r.interval).toBe(1);
    expect(r.status).toBe('learning');
    expect(r.easeFactor).toBeLessThan(2.5);
  });

  it('EF 下限 1.3（连续 20 次 rating=0 不破底）', () => {
    let s = INITIAL_STATE;
    for (let i = 0; i < 20; i++) s = nextReview(s, 0, NOW);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('interval ≥ 21 且 rating ≥ 2 → status=mastered', () => {
    const prev = { easeFactor: 2.5, interval: 15, repetitions: 3, status: 'review' as const };
    const r = nextReview(prev, 2, NOW);
    expect(r.interval).toBeGreaterThanOrEqual(21);
    expect(r.status).toBe('mastered');
  });

  it('rating=3 (Easy) 比 rating=2 (Good) 提高 EF', () => {
    const base = { easeFactor: 2.5, interval: 6, repetitions: 2, status: 'review' as const };
    const good = nextReview(base, 2, NOW);
    const easy = nextReview(base, 3, NOW);
    expect(easy.easeFactor).toBeGreaterThan(good.easeFactor);
  });

  it('rating=1 (Hard) 算答对但 EF 略降', () => {
    const base = { easeFactor: 2.5, interval: 6, repetitions: 2, status: 'review' as const };
    const r = nextReview(base, 1, NOW);
    expect(r.repetitions).toBe(3); // 仍算通过
    expect(r.easeFactor).toBeLessThan(2.5);
  });
});
