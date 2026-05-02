// 分析埋点 ingestion + summary integration（P1 #8）
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

describe('POST /api/analytics/events', () => {
  it('匿名（无 token）也能上报', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/analytics/events',
      payload: {
        events: [
          { event: 'page_view', properties: { path: '/auth' }, sessionId: 's_anon_1' },
        ],
      },
    });
    expect(res.statusCode).toBe(202);
    const rows = await prisma.analyticsEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBeNull();
    expect(rows[0].event).toBe('page_view');
  });

  it('登录后上报 · userId 自动绑定', async () => {
    const u = await registerAs(app);
    await app.inject({
      method: 'POST', url: '/api/analytics/events',
      payload: { events: [{ event: 'quiz_answer', sessionId: 's_x' }] },
      headers: authHeader(u),
    });
    const rows = await prisma.analyticsEvent.findMany();
    expect(rows[0].userId).toBe(u.userId);
  });

  it('单批最多 100 · 超出 400', async () => {
    const events = Array.from({ length: 101 }, (_, i) => ({
      event: 'spam', sessionId: 's_spam',
    }));
    const res = await app.inject({
      method: 'POST', url: '/api/analytics/events',
      payload: { events },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/admin/analytics/summary', () => {
  it('admin 看聚合 · 含 byEvent + DAU', async () => {
    const u = await registerAs(app);
    // 灌点数据
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST', url: '/api/analytics/events',
        payload: { events: [
          { event: 'page_view', sessionId: 's_a' },
          { event: 'click', sessionId: 's_a' },
        ] },
        headers: authHeader(u),
      });
    }

    const admin = await registerAs(app, 'admin');
    const res = await app.inject({
      method: 'GET', url: '/api/admin/analytics/summary?fromDays=7',
      headers: authHeader(admin),
    });
    const data = expectOk<{
      total: number;
      byEvent: Array<{ event: string; count: number }>;
      dau: Array<{ day: string; uniqueUsers: number }>;
    }>(res);
    expect(data.total).toBeGreaterThanOrEqual(6);
    const byEventMap = Object.fromEntries(data.byEvent.map((e) => [e.event, e.count]));
    expect(byEventMap.page_view).toBeGreaterThanOrEqual(3);
    expect(byEventMap.click).toBeGreaterThanOrEqual(3);
    expect(data.dau.length).toBeGreaterThan(0);
  });

  it('非 admin 403', async () => {
    const u = await registerAs(app);
    const res = await app.inject({
      method: 'GET', url: '/api/admin/analytics/summary',
      headers: authHeader(u),
    });
    expect(res.statusCode).toBe(403);
  });
});
