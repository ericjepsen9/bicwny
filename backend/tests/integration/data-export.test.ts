// 集成测试 · P2 #29 · 用户数据导出
// 覆盖：
//   1) 未登录 → 401
//   2) 登录 → 200 · 含 user / answers / favorites / mistakes 等键
//   3) 5 分钟内第二次 → 400
//   4) 不同用户互不影响 · 只导出自己的
//   5) AuditLog 记录一行 user.data_export
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
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

describe('GET /api/auth/me/data-export', () => {
  it('未登录 → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me/data-export' });
    expect(res.statusCode).toBe(401);
  });

  it('登录 → 返回完整结构 + 含本人答题', async () => {
    const u = await registerAs(app, 'student');
    const { courseId, chapterId, lessonId } = await seedCourseLesson();
    const qid = await seedQuestion({ courseId, chapterId, lessonId });
    // 插一条答题
    await prisma.userAnswer.create({
      data: {
        userId: u.userId,
        questionId: qid,
        answer: { selectedIndex: 0 },
        isCorrect: true,
        score: 100,
        answeredAt: new Date(),
      },
    });
    // 收藏一条
    await prisma.userFavorite.create({
      data: { userId: u.userId, questionId: qid },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me/data-export',
      headers: authHeader(u),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=/);
    expect(res.headers['cache-control']).toBe('no-store');

    const data = JSON.parse(res.body);
    expect(data.schemaVersion).toBe(1);
    expect(data.user.id).toBe(u.userId);
    expect(Array.isArray(data.answers)).toBe(true);
    expect(data.answers.length).toBe(1);
    expect(data.answers[0].questionId).toBe(qid);
    expect(data.favorites.length).toBe(1);
    expect(Array.isArray(data.mistakes)).toBe(true);
    expect(Array.isArray(data.sm2Cards)).toBe(true);
    expect(Array.isArray(data.sessions)).toBe(true);
    // session 不包含 refreshTokenHash
    expect(data.sessions[0]).not.toHaveProperty('refreshTokenHash');
  });

  it('5 分钟内重复请求 → 400 cooldown', async () => {
    const u = await registerAs(app, 'student');
    const r1 = await app.inject({
      method: 'GET',
      url: '/api/auth/me/data-export',
      headers: authHeader(u),
    });
    expect(r1.statusCode).toBe(200);

    const r2 = await app.inject({
      method: 'GET',
      url: '/api/auth/me/data-export',
      headers: authHeader(u),
    });
    expect(r2.statusCode).toBe(400);
    const j = JSON.parse(r2.body);
    expect(j.error.message).toMatch(/导出过于频繁/);
  });

  it('用户隔离：A 导出不含 B 的答题', async () => {
    const a = await registerAs(app, 'student');
    const b = await registerAs(app, 'student');
    const { courseId, chapterId, lessonId } = await seedCourseLesson();
    const qid = await seedQuestion({ courseId, chapterId, lessonId });
    await prisma.userAnswer.create({
      data: {
        userId: b.userId,
        questionId: qid,
        answer: { selectedIndex: 0 },
        isCorrect: true,
        answeredAt: new Date(),
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me/data-export',
      headers: authHeader(a),
    });
    const data = JSON.parse(res.body);
    expect(data.user.id).toBe(a.userId);
    expect(data.answers.length).toBe(0);
  });

  it('写一行 AuditLog (user.data_export)', async () => {
    const u = await registerAs(app, 'student');
    await app.inject({
      method: 'GET',
      url: '/api/auth/me/data-export',
      headers: authHeader(u),
    });
    const logs = await prisma.auditLog.findMany({
      where: { action: 'user.data_export', adminId: u.userId },
    });
    expect(logs.length).toBe(1);
    expect(logs[0]!.targetId).toBe(u.userId);
  });
});
