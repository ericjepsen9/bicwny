// 答题链路集成：POST /api/answers · GET/DELETE /api/mistakes[:qid] · GET /api/my/progress
// 覆盖：
//   - single 答对 → isCorrect · 不入错题本
//   - single 答错 → 入错题本 · wrongCount 累计
//   - /api/mistakes list 含 question（剥答案）
//   - /api/mistakes/:qid 含完整 question（含 correct 标记）· owner 隔离
//   - DELETE /api/mistakes/:qid 软删除
//   - /api/my/progress 字段齐全（totalAnswers / totalDays / todayAnswered / weekDays）
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  authHeader,
  buildTestApp,
  expectOk,
  registerAs,
  resetDb,
  seedCourseLesson,
  seedQuestion,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

async function submit(u: { accessToken: string }, questionId: string, selectedIndex: number) {
  return app.inject({
    method: 'POST',
    url: '/api/answers',
    headers: authHeader(u),
    payload: {
      questionId,
      answer: { selectedIndex },
      timeSpentMs: 1000,
    },
  });
}

describe('POST /api/answers (integration)', () => {
  it('答对 · 不入错题本', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion(ids); // 默认 correctIdx=0

    const res = await submit(u, qid, 0);
    const d = expectOk<{ grade: { isCorrect: boolean } }>(res);
    expect(d.grade.isCorrect).toBe(true);

    const mistakes = await app.inject({
      method: 'GET',
      url: '/api/mistakes',
      headers: authHeader(u),
    });
    expect(expectOk<unknown[]>(mistakes)).toHaveLength(0);
  });

  it('答错 · 入错题本 · 再错 wrongCount 累计', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion(ids);

    await submit(u, qid, 1);
    await submit(u, qid, 1);

    const list = await app.inject({
      method: 'GET',
      url: '/api/mistakes',
      headers: authHeader(u),
    });
    const items = expectOk<Array<{ questionId: string; wrongCount: number }>>(list);
    expect(items).toHaveLength(1);
    expect(items[0].questionId).toBe(qid);
    expect(items[0].wrongCount).toBe(2);
  });

  it('先答错入册 · 再答对 · 可选 removeFromMistakesOnCorrect=true 移除', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion(ids);

    await submit(u, qid, 1);
    await app.inject({
      method: 'POST',
      url: '/api/answers',
      headers: authHeader(u),
      payload: {
        questionId: qid,
        answer: { selectedIndex: 0 },
        timeSpentMs: 1000,
        removeFromMistakesOnCorrect: true,
      },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/mistakes',
      headers: authHeader(u),
    });
    expect(expectOk<unknown[]>(list)).toHaveLength(0);
  });
});

describe('GET /api/mistakes (list) · 剥答案', () => {
  it('list 中 question.payload.options 不含 correct 字段', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion(ids);
    await submit(u, qid, 1); // 答错入册

    const list = await app.inject({
      method: 'GET',
      url: '/api/mistakes',
      headers: authHeader(u),
    });
    const items = expectOk<Array<{
      question: { payload: { options: Array<Record<string, unknown>> } } | null;
    }>>(list);
    expect(items).toHaveLength(1);
    const opts = items[0].question?.payload.options ?? [];
    for (const o of opts) {
      expect(o).not.toHaveProperty('correct');
    }
  });
});

describe('GET /api/mistakes/:questionId · owner-only 完整 view', () => {
  it('owner 能看完整 question（含 correct 标记）+ 最近一次作答', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion(ids);
    await submit(u, qid, 1);

    const res = await app.inject({
      method: 'GET',
      url: `/api/mistakes/${qid}`,
      headers: authHeader(u),
    });
    const d = expectOk<{
      wrongCount: number;
      question: { payload: { options: Array<{ correct?: boolean }> } };
      lastAnswer: { isCorrect: boolean; answer: { selectedIndex: number } } | null;
    }>(res);
    expect(d.wrongCount).toBe(1);
    // 完整 view 保留 correct 字段
    expect(d.question.payload.options.some((o) => 'correct' in o)).toBe(true);
    expect(d.lastAnswer?.isCorrect).toBe(false);
    expect(d.lastAnswer?.answer.selectedIndex).toBe(1);
  });

  it('跨用户访问 → 404', async () => {
    const u1 = await registerAs(app, 'student');
    const u2 = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion(ids);
    await submit(u1, qid, 1);

    const res = await app.inject({
      method: 'GET',
      url: `/api/mistakes/${qid}`,
      headers: authHeader(u2),
    });
    expect(res.statusCode).toBe(404);
  });

  it('不存在的 qid → 404', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'GET',
      url: '/api/mistakes/no_such_qid',
      headers: authHeader(u),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/mistakes/:questionId (soft-delete)', () => {
  it('删除后列表为空；不影响原 question', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion(ids);
    await submit(u, qid, 1);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/mistakes/${qid}`,
      headers: authHeader(u),
    });
    expect(del.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/api/mistakes',
      headers: authHeader(u),
    });
    expect(expectOk<unknown[]>(list)).toHaveLength(0);
  });
});

describe('GET /api/my/progress (integration)', () => {
  it('空用户 → zero 骨架', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'GET',
      url: '/api/my/progress',
      headers: authHeader(u),
    });
    const d = expectOk<{
      totalAnswers: number;
      correctRate: number;
      totalDays: number;
      todayAnswered: number;
      weekDays: string[];
      streak: { current: number };
      byCourse: unknown[];
    }>(res);
    expect(d.totalAnswers).toBe(0);
    expect(d.correctRate).toBe(0);
    expect(d.totalDays).toBe(0);
    expect(d.todayAnswered).toBe(0);
    expect(d.weekDays).toEqual([]);
    expect(d.streak.current).toBe(0);
    expect(d.byCourse).toEqual([]);
  });

  it('答 3 题（2 对 1 错）→ 聚合正确率 + 今日 + streak', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const q1 = await seedQuestion(ids);
    const q2 = await seedQuestion(ids);
    const q3 = await seedQuestion(ids);

    await submit(u, q1, 0); // ✓
    await submit(u, q2, 0); // ✓
    await submit(u, q3, 1); // ✗

    const res = await app.inject({
      method: 'GET',
      url: '/api/my/progress',
      headers: authHeader(u),
    });
    const d = expectOk<{
      totalAnswers: number;
      correctRate: number;
      totalDays: number;
      todayAnswered: number;
      weekDays: string[];
      streak: { current: number; longest: number };
      byCourse: Array<{ courseId: string; answered: number }>;
    }>(res);
    expect(d.totalAnswers).toBe(3);
    expect(d.correctRate).toBeCloseTo(2 / 3, 5);
    expect(d.totalDays).toBe(1);
    expect(d.todayAnswered).toBe(3);
    expect(d.weekDays).toHaveLength(1);
    expect(d.streak.current).toBe(1);
    expect(d.streak.longest).toBe(1);
    expect(d.byCourse).toHaveLength(1);
    expect(d.byCourse[0].answered).toBe(3);
  });
});
