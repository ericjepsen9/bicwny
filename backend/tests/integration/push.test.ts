// Web Push 订阅 integration（P0 #2）
//   - GET /api/push/vapid-public-key（VAPID 缺失 → 500）
//   - POST /api/push/subscribe upsert by endpoint
//   - DELETE /api/push/subscribe 仅删自己的
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

const fakeSub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-1',
  keys: { p256dh: 'BPK_test_pubkey_base64url', auth: 'auth_secret_base64' },
  platform: 'web' as const,
};

describe('GET /api/push/vapid-public-key', () => {
  it('VAPID 未配置 → 500 NOT_CONFIGURED', async () => {
    // dev 环境默认无 VAPID · 应 500
    const res = await app.inject({ method: 'GET', url: '/api/push/vapid-public-key' });
    // 缺失 secret 时 service 抛 Internal · status 500
    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/push/subscribe', () => {
  it('未登录 401', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/push/subscribe',
      payload: fakeSub,
    });
    expect(res.statusCode).toBe(401);
  });

  it('登录后上报 · DB 落 PushSubscription', async () => {
    const u = await registerAs(app);
    const res = await app.inject({
      method: 'POST', url: '/api/push/subscribe',
      payload: fakeSub,
      headers: authHeader(u),
    });
    expect(res.statusCode).toBe(201);
    const subs = await prisma.pushSubscription.findMany({ where: { userId: u.userId } });
    expect(subs).toHaveLength(1);
    expect(subs[0].endpoint).toBe(fakeSub.endpoint);
    expect(subs[0].platform).toBe('web');
  });

  it('同 endpoint 二次订阅 = upsert · 不会重复行', async () => {
    const u = await registerAs(app);
    await app.inject({
      method: 'POST', url: '/api/push/subscribe',
      payload: fakeSub, headers: authHeader(u),
    });
    await app.inject({
      method: 'POST', url: '/api/push/subscribe',
      payload: { ...fakeSub, platform: 'capacitor-ios' as const },
      headers: authHeader(u),
    });
    const subs = await prisma.pushSubscription.findMany({ where: { userId: u.userId } });
    expect(subs).toHaveLength(1);
    expect(subs[0].platform).toBe('capacitor-ios'); // 后写覆盖
  });

  it('同 endpoint 跨账户 → 转移 ownership 防 ghost', async () => {
    const a = await registerAs(app);
    const b = await registerAs(app);
    await app.inject({
      method: 'POST', url: '/api/push/subscribe',
      payload: fakeSub, headers: authHeader(a),
    });
    // b 用同设备登录 · 同 endpoint
    await app.inject({
      method: 'POST', url: '/api/push/subscribe',
      payload: fakeSub, headers: authHeader(b),
    });
    const aSubs = await prisma.pushSubscription.findMany({ where: { userId: a.userId } });
    const bSubs = await prisma.pushSubscription.findMany({ where: { userId: b.userId } });
    expect(aSubs).toHaveLength(0);
    expect(bSubs).toHaveLength(1);
  });
});

describe('DELETE /api/push/subscribe', () => {
  it('仅删自己的订阅', async () => {
    const a = await registerAs(app);
    const b = await registerAs(app);
    await app.inject({
      method: 'POST', url: '/api/push/subscribe',
      payload: fakeSub, headers: authHeader(a),
    });
    // b 试图删 a 的订阅
    const res = await app.inject({
      method: 'DELETE', url: '/api/push/subscribe',
      payload: { endpoint: fakeSub.endpoint },
      headers: authHeader(b),
    });
    const data = expectOk<{ removed: number }>(res);
    expect(data.removed).toBe(0); // 没删到（不是 a 的就动不了）
    // a 仍有订阅
    expect(await prisma.pushSubscription.count({ where: { userId: a.userId } })).toBe(1);
  });
});
