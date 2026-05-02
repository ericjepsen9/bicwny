// 集成测试 · P2 #30 · 应用内反馈
// 覆盖：
//   1) 匿名提交无邮箱 → 400
//   2) 匿名提交带邮箱 → 200 · userId=null
//   3) 已登录提交 → 200 · userId 自动绑
//   4) admin list / handle · 处理后给原用户写 Notification
//   5) 用户 GET /api/me/feedback 看自己历史 · admin 字段不暴露
//   6) 限速：6 次后第 6 次 400
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

describe('POST /api/feedback', () => {
  it('匿名 + 无邮箱 → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: { kind: 'suggestion', message: 'hello world' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.message).toMatch(/邮箱/);
  });

  it('匿名 + 邮箱 → 200 · userId=null', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        kind: 'bug',
        message: '播放有问题',
        contactEmail: 'anon@example.com',
      },
    });
    expect(res.statusCode).toBe(200);
    const data = expectOk<{ id: string; status: string }>(res);
    expect(data.status).toBe('open');
    const fb = await prisma.feedback.findUnique({ where: { id: data.id } });
    expect(fb).toBeTruthy();
    expect(fb!.userId).toBe(null);
    expect(fb!.kind).toBe('bug');
    expect(fb!.contactEmail).toBe('anon@example.com');
  });

  it('已登录 → 200 · userId 自动绑 · 不需要邮箱', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: authHeader(u),
      payload: { kind: 'suggestion', message: '加个夜间模式' },
    });
    expect(res.statusCode).toBe(200);
    const data = expectOk<{ id: string }>(res);
    const fb = await prisma.feedback.findUnique({ where: { id: data.id } });
    expect(fb!.userId).toBe(u.userId);
  });
});

describe('Admin list + handle', () => {
  it('admin GET /api/admin/feedback 看到列表', async () => {
    const admin = await registerAs(app, 'admin');
    const u = await registerAs(app, 'student');
    await app.inject({
      method: 'POST', url: '/api/feedback',
      headers: authHeader(u),
      payload: { kind: 'bug', message: '无法登录' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/feedback',
      headers: authHeader(admin),
    });
    const data = expectOk<{ items: Array<{ message: string; user: { id: string } | null }> }>(res);
    expect(data.items.length).toBe(1);
    expect(data.items[0]!.message).toBe('无法登录');
    expect(data.items[0]!.user!.id).toBe(u.userId);
  });

  it('PATCH 处理后给原用户写 Notification + AuditLog', async () => {
    const admin = await registerAs(app, 'admin');
    const u = await registerAs(app, 'student');
    const r1 = await app.inject({
      method: 'POST', url: '/api/feedback',
      headers: authHeader(u),
      payload: { kind: 'bug', message: 'X' },
    });
    const fbId = expectOk<{ id: string }>(r1).id;

    const r2 = await app.inject({
      method: 'PATCH',
      url: `/api/admin/feedback/${fbId}`,
      headers: authHeader(admin),
      payload: { status: 'resolved', response: '已修复，感谢反馈' },
    });
    expect(r2.statusCode).toBe(200);

    const fb = await prisma.feedback.findUnique({ where: { id: fbId } });
    expect(fb!.status).toBe('resolved');
    expect(fb!.response).toBe('已修复，感谢反馈');
    expect(fb!.handledByUserId).toBe(admin.userId);

    // 写了一条 Notification 给原用户
    const notif = await prisma.notification.findFirst({
      where: { userId: u.userId, type: 'system' },
    });
    expect(notif).toBeTruthy();
    expect(notif!.body).toMatch(/已修复/);

    // 写了一条 AuditLog
    const log = await prisma.auditLog.findFirst({
      where: { action: 'feedback.handle', targetId: fbId },
    });
    expect(log).toBeTruthy();
  });

  it('GET /api/me/feedback 看自己历史 · 不暴露 admin 字段', async () => {
    const u = await registerAs(app, 'student');
    await app.inject({
      method: 'POST', url: '/api/feedback',
      headers: authHeader(u),
      payload: { kind: 'praise', message: '很好用' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/feedback',
      headers: authHeader(u),
    });
    const items = expectOk<Array<Record<string, unknown>>>(res);
    expect(items.length).toBe(1);
    expect(items[0]!.message).toBe('很好用');
    expect(items[0]).not.toHaveProperty('handledByUserId');
    expect(items[0]).not.toHaveProperty('userAgent');
  });

  it('非 admin 调 admin 路由 → 403', async () => {
    const stu = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'GET', url: '/api/admin/feedback',
      headers: authHeader(stu),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('Rate limit', () => {
  it('已登录 1 小时 5 条 · 第 6 次 400', async () => {
    const u = await registerAs(app, 'student');
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({
        method: 'POST', url: '/api/feedback',
        headers: authHeader(u),
        payload: { kind: 'other', message: 'm' + i },
      });
      expect(r.statusCode).toBe(200);
    }
    const r6 = await app.inject({
      method: 'POST', url: '/api/feedback',
      headers: authHeader(u),
      payload: { kind: 'other', message: 'overflow' },
    });
    expect(r6.statusCode).toBe(400);
    expect(JSON.parse(r6.body).error.message).toMatch(/过于频繁/);
  });
});
