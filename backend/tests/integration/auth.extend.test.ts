// auth 扩展路由集成：PATCH /me · POST /change-password · DELETE /me
// 覆盖：
//   - updateMe 改 dharmaName / avatar / locale / timezone（空 patch 400）
//   - changePassword：错密 401、新旧同 400、过短 400、成功 200 + 旧 session 全吊销
//   - deleteAccount：错密 401、成功后登录失败、邮箱释放可重注册
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

describe('PATCH /api/auth/me (integration)', () => {
  it('改 dharmaName / avatar / locale / timezone 并落库', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers: authHeader(u),
      payload: {
        dharmaName: '明心',
        avatar: '明',
        locale: 'zh-Hant',
        timezone: 'Asia/Hong_Kong',
      },
    });
    const user = expectOk<Record<string, unknown>>(res);
    expect(user.dharmaName).toBe('明心');
    expect(user.avatar).toBe('明');
    expect(user.locale).toBe('zh-Hant');
    expect(user.timezone).toBe('Asia/Hong_Kong');
  });

  it('空字符串 → null（释放字段）', async () => {
    const u = await registerAs(app, 'student', { dharmaName: '旧名' });
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers: authHeader(u),
      payload: { dharmaName: '', avatar: '' },
    });
    const user = expectOk<{ dharmaName: string | null; avatar: string | null }>(res);
    expect(user.dharmaName).toBeNull();
    expect(user.avatar).toBeNull();
  });

  it('空 patch → 400', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers: authHeader(u),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('locale 过短 → 400', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers: authHeader(u),
      payload: { locale: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/change-password (integration)', () => {
  it('正常改密 · 返回 ok · 旧 refresh 被吊销', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: authHeader(u),
      payload: { currentPassword: u.password, newPassword: 'newpass456' },
    });
    expect(expectOk<{ ok: boolean }>(res).ok).toBe(true);

    // 旧 refresh 失效
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: u.refreshToken },
    });
    expect(r.statusCode).toBe(401);

    // 新密码可登
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: u.email, password: 'newpass456' },
    });
    expect(login.statusCode).toBe(200);

    // 旧密码不行
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: u.email, password: u.password },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('当前密码错误 → 401', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: authHeader(u),
      payload: { currentPassword: 'WRONG', newPassword: 'newpass456' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('新旧相同 → 400（zod refine）', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: authHeader(u),
      payload: { currentPassword: u.password, newPassword: u.password },
    });
    expect(res.statusCode).toBe(400);
  });

  it('新密码过短 → 400', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: authHeader(u),
      payload: { currentPassword: u.password, newPassword: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/auth/me (integration)', () => {
  it('软删除：账号失活 · 邮箱释放 · 同邮箱可重注册', async () => {
    const u = await registerAs(app, 'student');
    const email = u.email;

    const del = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers: authHeader(u),
      payload: { currentPassword: u.password },
    });
    expect(expectOk<{ ok: boolean }>(del).ok).toBe(true);

    // 用老凭证登录应失败（isActive=false 且 passwordHash 已清）
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: u.password },
    });
    expect(login.statusCode).toBe(401);

    // 旧 refresh 失效
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: u.refreshToken },
    });
    expect(r.statusCode).toBe(401);

    // 同邮箱重注册成功（unique 约束已释放）
    const reReg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'brandnew456' },
    });
    expect(reReg.statusCode).toBe(201);
  });

  it('当前密码错误 → 401', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers: authHeader(u),
      payload: { currentPassword: 'WRONG' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('空 body → 400', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers: authHeader(u),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
