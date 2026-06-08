// 内容举报工作流 integration（P0 #5）
//   - 学员举报 · admin 看队列（含 question + reporter + 同题计数）
//   - admin accept_hide → 题目 reviewStatus=rejected · reporter 收到通知
//   - admin accept_keep → reporter 收到通知 · 题目仍 approved
//   - admin reject → 仅当前举报人收到通知
//   - 同 question 多举报 · accept_* 一并处理
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import {
  authHeader, buildTestApp, expectOk, registerAs,
  resetDb, seedCourseLesson, seedQuestion,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

interface PendingReport {
  id: string;
  reason: string;
  question: { id: string; questionText: string; reviewStatus: string } | null;
  reporter: { id: string; dharmaName: string | null };
  siblingPendingCount: number;
}

async function makeReport(reporterUser: { accessToken: string }, questionId: string, reason = 'doctrine_error') {
  const res = await app.inject({
    method: 'POST', url: '/api/reports',
    payload: { questionId, reason, details: '测试举报' },
    headers: authHeader(reporterUser),
  });
  expect(res.statusCode).toBe(201);
}

describe('举报工作流', () => {
  it('学员举报 → admin 看队列含丰富数据', async () => {
    const seed = await seedCourseLesson();
    const qid = await seedQuestion(seed);
    const reporter = await registerAs(app);
    await makeReport(reporter, qid);

    const admin = await registerAs(app, 'admin');
    const list = expectOk<PendingReport[]>(await app.inject({
      method: 'GET', url: '/api/admin/reports/pending',
      headers: authHeader(admin),
    }));
    expect(list).toHaveLength(1);
    expect(list[0].question?.questionText).toBe('测试题干');
    expect(list[0].reporter.id).toBe(reporter.userId);
    expect(list[0].siblingPendingCount).toBe(1);
  });

  it('accept_hide 把题目下架 + 群发通知', async () => {
    const seed = await seedCourseLesson();
    const qid = await seedQuestion(seed);
    const r1 = await registerAs(app);
    const r2 = await registerAs(app);
    await makeReport(r1, qid);
    await makeReport(r2, qid, 'sensitive');

    const admin = await registerAs(app, 'admin');
    const list = expectOk<PendingReport[]>(await app.inject({
      method: 'GET', url: '/api/admin/reports/pending',
      headers: authHeader(admin),
    }));
    expect(list[0].siblingPendingCount).toBe(2);

    const res = await app.inject({
      method: 'POST', url: `/api/admin/reports/${list[0].id}/handle`,
      payload: { decision: 'accept_hide', note: '内容确有问题' },
      headers: authHeader(admin),
    });
    const data = expectOk<{ alsoUpdated: number; notified: number }>(res);
    // 当前 + 同题另 1 条 = 总共处理 2 条 · alsoUpdated=1
    expect(data.alsoUpdated).toBe(1);
    expect(data.notified).toBe(2);

    // 题目下架
    const q = await prisma.question.findUnique({ where: { id: qid } });
    expect(q?.reviewStatus).toBe('rejected');

    // 两个 reporter 都收到 system 通知
    const notifs = await prisma.notification.findMany({
      where: { type: 'system' },
      orderBy: { createdAt: 'asc' },
    });
    expect(notifs.length).toBe(2);
    expect(notifs.map((n) => n.userId).sort()).toEqual([r1.userId, r2.userId].sort());

    // 队列空
    const after = expectOk<PendingReport[]>(await app.inject({
      method: 'GET', url: '/api/admin/reports/pending',
      headers: authHeader(admin),
    }));
    expect(after).toHaveLength(0);
  });

  it('accept_keep 通知举报人 · 题目保留 approved', async () => {
    const seed = await seedCourseLesson();
    const qid = await seedQuestion(seed);
    const r1 = await registerAs(app);
    await makeReport(r1, qid);
    const admin = await registerAs(app, 'admin');
    const list = expectOk<PendingReport[]>(await app.inject({
      method: 'GET', url: '/api/admin/reports/pending',
      headers: authHeader(admin),
    }));

    await app.inject({
      method: 'POST', url: `/api/admin/reports/${list[0].id}/handle`,
      payload: { decision: 'accept_keep' },
      headers: authHeader(admin),
    });

    const q = await prisma.question.findUnique({ where: { id: qid } });
    expect(q?.reviewStatus).toBe('approved');
    const notif = await prisma.notification.findFirst({
      where: { userId: r1.userId, type: 'system' },
    });
    expect(notif?.title).toContain('已记录');
  });

  it('reject 仅通知该举报人 · 不影响题目', async () => {
    const seed = await seedCourseLesson();
    const qid = await seedQuestion(seed);
    const r1 = await registerAs(app);
    const r2 = await registerAs(app);
    await makeReport(r1, qid);
    await makeReport(r2, qid);
    const admin = await registerAs(app, 'admin');
    const list = expectOk<PendingReport[]>(await app.inject({
      method: 'GET', url: '/api/admin/reports/pending',
      headers: authHeader(admin),
    }));

    // 仅驳回第一条
    await app.inject({
      method: 'POST', url: `/api/admin/reports/${list[0].id}/handle`,
      payload: { decision: 'reject', note: '不构成下架理由' },
      headers: authHeader(admin),
    });

    const q = await prisma.question.findUnique({ where: { id: qid } });
    expect(q?.reviewStatus).toBe('approved');

    const notifs = await prisma.notification.findMany({ where: { type: 'system' } });
    expect(notifs.length).toBe(1);
    expect([r1.userId, r2.userId]).toContain(notifs[0].userId);

    // 队列还剩 1 条（另一举报人的）
    const remaining = expectOk<PendingReport[]>(await app.inject({
      method: 'GET', url: '/api/admin/reports/pending',
      headers: authHeader(admin),
    }));
    expect(remaining).toHaveLength(1);
  });

  it('非 admin 不能查队列 · 403', async () => {
    const u = await registerAs(app);
    const res = await app.inject({
      method: 'GET', url: '/api/admin/reports/pending',
      headers: authHeader(u),
    });
    expect(res.statusCode).toBe(403);
  });
});
