// Admin 路由集成测试（P3c · Batch 0.4）
// 覆盖：
//   GET   /api/admin/users                  列表 / 角色过滤 / 搜索 / 游标
//   PATCH /api/admin/users/:id/role         升降级 + AuditLog · 自降级 403
//   POST  /api/admin/users/:id/active       停启账号 · 停用吊销 session · 自停 403
//   GET   /api/admin/platform-stats         聚合 KPI · windowDays 校验
// 非 admin 一律 403。
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

describe('GET /api/admin/users (integration)', () => {
  it('admin 看到列表；student 403', async () => {
    const admin = await registerAs(app, 'admin');
    await registerAs(app, 'student');
    await registerAs(app, 'coach');

    const ok = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: authHeader(admin),
    });
    const users = expectOk<Array<{ id: string; role: string; passwordHash?: string }>>(ok);
    expect(users.length).toBe(3);
    // 脱敏：响应里不能带 passwordHash
    users.forEach((u) => expect(u).not.toHaveProperty('passwordHash'));

    const stu = await registerAs(app, 'student');
    const denied = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: authHeader(stu),
    });
    expect(denied.statusCode).toBe(403);
  });

  it('?role=coach 只返回 coach', async () => {
    const admin = await registerAs(app, 'admin');
    await registerAs(app, 'student');
    await registerAs(app, 'coach');
    await registerAs(app, 'coach');

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?role=coach',
      headers: authHeader(admin),
    });
    const users = expectOk<Array<{ role: string }>>(res);
    expect(users.length).toBe(2);
    users.forEach((u) => expect(u.role).toBe('coach'));
  });

  it('?search 匹配 email 或 dharmaName（不区分大小写）', async () => {
    const admin = await registerAs(app, 'admin');
    await registerAs(app, 'student', { dharmaName: '明心' });
    await registerAs(app, 'student', { dharmaName: '净慧' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?search=明心',
      headers: authHeader(admin),
    });
    const users = expectOk<Array<{ dharmaName: string | null }>>(res);
    expect(users.length).toBe(1);
    expect(users[0]!.dharmaName).toBe('明心');
  });

  it('?cursor + ?limit 游标分页不重复', async () => {
    const admin = await registerAs(app, 'admin');
    for (let i = 0; i < 4; i++) await registerAs(app, 'student');

    const p1 = await app.inject({
      method: 'GET',
      url: '/api/admin/users?limit=2',
      headers: authHeader(admin),
    });
    const page1 = expectOk<Array<{ id: string }>>(p1);
    expect(page1.length).toBe(2);

    const cursor = page1[page1.length - 1]!.id;
    const p2 = await app.inject({
      method: 'GET',
      url: `/api/admin/users?limit=2&cursor=${cursor}`,
      headers: authHeader(admin),
    });
    const page2 = expectOk<Array<{ id: string }>>(p2);
    // 每页 2 条、共 5 人（admin + 4 student）：第 2 页至少有 1 条，且不含游标 id
    expect(page2.length).toBeGreaterThanOrEqual(1);
    expect(page2.find((u) => u.id === cursor)).toBeUndefined();
  });
});

describe('PATCH /api/admin/users/:id/role (integration)', () => {
  it('admin 升 student → coach；AuditLog 落库', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${stu.userId}/role`,
      headers: authHeader(admin),
      payload: { role: 'coach' },
    });
    const u = expectOk<{ id: string; role: string }>(res);
    expect(u.role).toBe('coach');

    const logs = await prisma.auditLog.findMany({
      where: { action: 'user.updateRole', targetId: stu.userId },
    });
    expect(logs.length).toBe(1);
    expect(logs[0]!.adminId).toBe(admin.userId);
    expect(logs[0]!.before).toMatchObject({ role: 'student' });
    expect(logs[0]!.after).toMatchObject({ role: 'coach' });
  });

  it('admin 给自己降级 → 403', async () => {
    const admin = await registerAs(app, 'admin');
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${admin.userId}/role`,
      headers: authHeader(admin),
      payload: { role: 'student' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('不存在的 userId → 404', async () => {
    const admin = await registerAs(app, 'admin');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/users/no-such-id/role',
      headers: authHeader(admin),
      payload: { role: 'coach' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('非法 role → 400', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${stu.userId}/role`,
      headers: authHeader(admin),
      payload: { role: 'superuser' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('student 调此接口 → 403', async () => {
    const stu = await registerAs(app, 'student');
    const victim = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${victim.userId}/role`,
      headers: authHeader(stu),
      payload: { role: 'coach' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/admin/users/:id/active (integration)', () => {
  it('停用 student → 吊销其 session + AuditLog', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');

    // 停用前有活跃 session（注册时已建一条）
    const before = await prisma.authSession.count({
      where: { userId: stu.userId, revokedAt: null },
    });
    expect(before).toBeGreaterThanOrEqual(1);

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${stu.userId}/active`,
      headers: authHeader(admin),
      payload: { isActive: false },
    });
    const u = expectOk<{ isActive: boolean }>(res);
    expect(u.isActive).toBe(false);

    const after = await prisma.authSession.count({
      where: { userId: stu.userId, revokedAt: null },
    });
    expect(after).toBe(0);

    const logs = await prisma.auditLog.findMany({
      where: { action: 'user.deactivate', targetId: stu.userId },
    });
    expect(logs.length).toBe(1);
  });

  it('重新启用 → AuditLog action=user.reactivate', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    await prisma.user.update({ where: { id: stu.userId }, data: { isActive: false } });

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${stu.userId}/active`,
      headers: authHeader(admin),
      payload: { isActive: true },
    });
    const u = expectOk<{ isActive: boolean }>(res);
    expect(u.isActive).toBe(true);

    const logs = await prisma.auditLog.findMany({
      where: { action: 'user.reactivate', targetId: stu.userId },
    });
    expect(logs.length).toBe(1);
  });

  it('admin 停自己 → 403', async () => {
    const admin = await registerAs(app, 'admin');
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${admin.userId}/active`,
      headers: authHeader(admin),
      payload: { isActive: false },
    });
    expect(res.statusCode).toBe(403);
  });

  it('coach 调此接口 → 403', async () => {
    const coach = await registerAs(app, 'coach');
    const victim = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${victim.userId}/active`,
      headers: authHeader(coach),
      payload: { isActive: false },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /api/admin/platform-stats (integration)', () => {
  it('admin 拿到完整聚合；默认 windowDays=7', async () => {
    const admin = await registerAs(app, 'admin');
    await registerAs(app, 'student');
    await registerAs(app, 'coach');

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/platform-stats',
      headers: authHeader(admin),
    });
    const stats = expectOk<{
      windowDays: number;
      users: { total: number; byRole: Record<string, number> };
      classes: { total: number; active: number; archived: number };
      questions: { total: number };
      answers: { total: number; correctRate: number; inWindow: number };
      llm: { monthCost: number };
      sm2: { totalCards: number };
    }>(res);

    expect(stats.windowDays).toBe(7);
    expect(stats.users.total).toBe(3);
    expect(stats.users.byRole.admin).toBe(1);
    expect(stats.users.byRole.coach).toBe(1);
    expect(stats.users.byRole.student).toBe(1);
    expect(stats.classes).toBeDefined();
    expect(stats.questions).toBeDefined();
    expect(stats.answers.correctRate).toBeGreaterThanOrEqual(0);
    expect(stats.llm).toBeDefined();
    expect(stats.sm2).toBeDefined();
  });

  it('?windowDays=30 生效', async () => {
    const admin = await registerAs(app, 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/platform-stats?windowDays=30',
      headers: authHeader(admin),
    });
    const stats = expectOk<{ windowDays: number }>(res);
    expect(stats.windowDays).toBe(30);
  });

  it('?windowDays=0 或 91 → 400（范围 1-90）', async () => {
    const admin = await registerAs(app, 'admin');
    const bad1 = await app.inject({
      method: 'GET',
      url: '/api/admin/platform-stats?windowDays=0',
      headers: authHeader(admin),
    });
    expect(bad1.statusCode).toBe(400);

    const bad2 = await app.inject({
      method: 'GET',
      url: '/api/admin/platform-stats?windowDays=91',
      headers: authHeader(admin),
    });
    expect(bad2.statusCode).toBe(400);
  });

  it('student → 403', async () => {
    const stu = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/platform-stats',
      headers: authHeader(stu),
    });
    expect(res.statusCode).toBe(403);
  });
});
