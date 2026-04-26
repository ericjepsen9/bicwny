// 成就徽章集成：/api/achievements 从答题数据派生 · 不写 DB
// 覆盖：
//   - 新用户：所有徽章 locked · progress=0
//   - 答 1 题 → first_answer 解锁 · hundred_answers.progress=0.01
//   - 答对高正确率 → accuracy_80 解锁逻辑（需 ≥50 题）
//   - 本人隔离
//   - 401
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import {
  authHeader,
  buildTestApp,
  expectOk,
  registerAs,
  resetDb,
  seedCourseLesson,
  seedQuestion,
  type RegisteredUser,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

interface Badge {
  id: string;
  category: string;
  unlocked: boolean;
  progress: number;
  current: number;
  target: number;
}
interface AchievementsResp {
  totalBadges: number;
  unlockedCount: number;
  badges: Badge[];
  metrics: {
    totalAnswers: number;
    correctRate: number;
    streakCurrent: number;
    streakLongest: number;
    sm2Mastered: number;
    coursesCovered: number;
  };
}

async function fetchAchievements(u: RegisteredUser): Promise<AchievementsResp> {
  const res = await app.inject({
    method: 'GET',
    url: '/api/achievements',
    headers: authHeader(u),
  });
  return expectOk<AchievementsResp>(res);
}

function findBadge(r: AchievementsResp, id: string): Badge {
  const b = r.badges.find((x) => x.id === id);
  if (!b) throw new Error(`badge not found: ${id}`);
  return b;
}

async function submit(u: RegisteredUser, questionId: string, selectedIndex: number) {
  return app.inject({
    method: 'POST',
    url: '/api/answers',
    headers: authHeader(u),
    payload: { questionId, answer: { selectedIndex }, timeSpentMs: 1000 },
  });
}

describe('GET /api/achievements', () => {
  it('新用户：所有徽章 locked · 计数 0', async () => {
    const u = await registerAs(app, 'student');
    const r = await fetchAchievements(u);
    expect(r.totalBadges).toBeGreaterThanOrEqual(12);
    expect(r.unlockedCount).toBe(0);
    expect(r.metrics.totalAnswers).toBe(0);
    expect(r.badges.every((b) => !b.unlocked)).toBe(true);
  });

  it('答 1 题 → first_answer 解锁 · hundred 进度推进', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion(ids);
    await submit(u, qid, 0);

    const r = await fetchAchievements(u);
    const first = findBadge(r, 'first_answer');
    expect(first.unlocked).toBe(true);
    expect(first.progress).toBe(1);

    const hundred = findBadge(r, 'hundred_answers');
    expect(hundred.unlocked).toBe(false);
    expect(hundred.current).toBe(1);
    expect(hundred.target).toBe(100);
    expect(hundred.progress).toBeCloseTo(0.01, 3);

    expect(r.unlockedCount).toBeGreaterThanOrEqual(2); // first_answer + first_course
    expect(r.metrics.coursesCovered).toBe(1);
  });

  it('breadth：跨 3 法本 → three_courses 解锁', async () => {
    const u = await registerAs(app, 'student');
    for (let i = 0; i < 3; i++) {
      const ids = await seedCourseLesson();
      const qid = await seedQuestion(ids);
      await submit(u, qid, 0);
    }
    const r = await fetchAchievements(u);
    expect(findBadge(r, 'three_courses').unlocked).toBe(true);
    expect(r.metrics.coursesCovered).toBe(3);
  });

  it('accuracy_80：需 ≥50 题且 ≥80% 正确率', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();

    // 49 题全对 → 未满足样本量
    for (let i = 0; i < 49; i++) {
      const qid = await seedQuestion(ids);
      await submit(u, qid, 0);
    }
    let r = await fetchAchievements(u);
    expect(findBadge(r, 'accuracy_80').unlocked).toBe(false);

    // 再答 1 题对 → 50 道且 100% 正确
    const qid50 = await seedQuestion(ids);
    await submit(u, qid50, 0);
    r = await fetchAchievements(u);
    expect(findBadge(r, 'accuracy_80').unlocked).toBe(true);
  });

  it('sm2_10_mastered：伪造 10 张 status=mastered 的 SM-2 卡', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    for (let i = 0; i < 10; i++) {
      const qid = await seedQuestion(ids);
      await prisma.sm2Card.create({
        data: {
          userId: u.userId,
          questionId: qid,
          courseId: ids.courseId,
          easeFactor: 2.5,
          interval: 30,
          repetitions: 5,
          dueDate: new Date(Date.now() + 30 * 86400000),
          status: 'mastered',
        },
      });
    }
    const r = await fetchAchievements(u);
    expect(findBadge(r, 'sm2_10_mastered').unlocked).toBe(true);
    expect(r.metrics.sm2Mastered).toBeGreaterThanOrEqual(10);
  });

  it('本人隔离：A 的答题不影响 B 的徽章', async () => {
    const a = await registerAs(app, 'student');
    const b = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion(ids);
    await submit(a, qid, 0);

    const rb = await fetchAchievements(b);
    expect(findBadge(rb, 'first_answer').unlocked).toBe(false);
    expect(rb.metrics.totalAnswers).toBe(0);
  });

  it('未登录 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/achievements' });
    expect(res.statusCode).toBe(401);
  });
});
