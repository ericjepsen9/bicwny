// 密码找回集成测试（Batch 2.1 backend）
// 覆盖：
//   POST /api/auth/forgot
//     · 邮箱存在 → 200 + DB 创建 PasswordResetToken + dev 带 devToken
//     · 邮箱不存在 → 200（静默成功，防枚举）
//     · 邮箱非法 → 400
//   POST /api/auth/reset
//     · 合法 token + 新密码 → 200；用新密码能登录；旧 session 全吊销
//     · token 用过 → 401
//     · token 过期 → 401
//     · 非法 token → 401（统一错消息）
//     · 新密码太短 → 400
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

describe('POST /api/auth/forgot (integration)', () => {
  it('邮箱存在 → 200 · 创建 token · dev 环境回传 devToken', async () => {
    const u = await registerAs(app, 'student');

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot',
      payload: { email: u.email },
    });
    const data = expectOk<{ ok: boolean; devToken?: string }>(res);
    expect(data.ok).toBe(true);
    // dev / test 环境都不是 production，所以 devToken 应回传
    expect(data.devToken).toBeTruthy();
    expect(data.devToken!.length).toBeGreaterThan(20);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: u.userId },
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0]!.usedAt).toBeNull();
    // expiresAt 约 30 分钟后（±1 分钟容忍）
    const diff = tokens[0]!.expiresAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(29 * 60_000);
    expect(diff).toBeLessThan(31 * 60_000);
  });

  it('邮箱不存在 → 200 · 响应同上（防枚举）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot',
      payload: { email: 'nobody@nowhere.app' },
    });
    const data = expectOk<{ ok: boolean; devToken?: string }>(res);
    expect(data.ok).toBe(true);
    expect(data.devToken).toBeUndefined();

    const tokens = await prisma.passwordResetToken.findMany();
    expect(tokens.length).toBe(0);
  });

  it('邮箱停用状态 → 200 · 不生成 token（防绕过停用）', async () => {
    const u = await registerAs(app, 'student');
    await prisma.user.update({ where: { id: u.userId }, data: { isActive: false } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot',
      payload: { email: u.email },
    });
    expect(res.statusCode).toBe(200);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: u.userId },
    });
    expect(tokens.length).toBe(0);
  });

  it('邮箱非法 → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot',
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/reset (integration)', () => {
  async function requestToken(email: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot',
      payload: { email },
    });
    const data = expectOk<{ devToken?: string }>(res);
    return data.devToken!;
  }

  it('合法 token + 新密码 → 200 · 新密码登录成功 · 旧 session 吊销', async () => {
    const u = await registerAs(app, 'student', { password: 'oldpass123' });
    const token = await requestToken(u.email);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset',
      payload: { token, newPassword: 'newpass456' },
    });
    const data = expectOk<{ ok: boolean }>(res);
    expect(data.ok).toBe(true);

    // 旧密码应该登不上
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: u.email, password: 'oldpass123' },
    });
    expect(oldLogin.statusCode).toBe(401);

    // 新密码应该登得上
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: u.email, password: 'newpass456' },
    });
    expect(newLogin.statusCode).toBe(200);

    // 原有 session 应该全吊销（注册时的那条）
    const revokedSessions = await prisma.authSession.count({
      where: { userId: u.userId, revokedAt: { not: null } },
    });
    expect(revokedSessions).toBeGreaterThanOrEqual(1);

    // 本 token 应标 usedAt
    const tkn = await prisma.passwordResetToken.findFirst({
      where: { userId: u.userId },
    });
    expect(tkn!.usedAt).not.toBeNull();
  });

  it('同一 token 二次使用 → 401', async () => {
    const u = await registerAs(app, 'student');
    const token = await requestToken(u.email);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/reset',
      payload: { token, newPassword: 'newpass456' },
    });
    expect(ok.statusCode).toBe(200);

    const again = await app.inject({
      method: 'POST',
      url: '/api/auth/reset',
      payload: { token, newPassword: 'another789' },
    });
    expect(again.statusCode).toBe(401);
  });

  it('过期 token → 401', async () => {
    const u = await registerAs(app, 'student');
    const token = await requestToken(u.email);

    // 手动把 expiresAt 调到过去
    await prisma.passwordResetToken.updateMany({
      where: { userId: u.userId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset',
      payload: { token, newPassword: 'newpass456' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('非法 token 字符串 → 401（统一消息）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset',
      payload: { token: 'x'.repeat(43), newPassword: 'newpass456' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('新密码太短 → 400', async () => {
    const u = await registerAs(app, 'student');
    const token = await requestToken(u.email);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset',
      payload: { token, newPassword: '12345' }, // < 6
    });
    expect(res.statusCode).toBe(400);

    // token 应仍未消费
    const tkn = await prisma.passwordResetToken.findFirst({
      where: { userId: u.userId },
    });
    expect(tkn!.usedAt).toBeNull();
  });

  it('同一用户再次 forgot → 旧 token 立即作废（仅最新有效）', async () => {
    const u = await registerAs(app, 'student');
    const t1 = await requestToken(u.email);
    const t2 = await requestToken(u.email);

    // t1 应当已被 t2 的请求作废
    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: u.userId },
      orderBy: { requestedAt: 'asc' },
    });
    expect(tokens.length).toBe(2);
    expect(tokens[0]!.usedAt).not.toBeNull(); // t1 被作废
    expect(tokens[1]!.usedAt).toBeNull();      // t2 仍有效

    // 用 t1 应该 401
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/reset',
      payload: { token: t1, newPassword: 'newpass456' },
    });
    expect(bad.statusCode).toBe(401);

    // 用 t2 应该 200
    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/reset',
      payload: { token: t2, newPassword: 'newpass456' },
    });
    expect(ok.statusCode).toBe(200);
  });

  it('reset 成功后剩余未用 token 也一并作废（resetPassword 的级联）', async () => {
    const u = await registerAs(app, 'student');
    // 通过两次 forgot 验证级联：第二次 forgot 后只有 t2 有效
    await requestToken(u.email);
    const t2 = await requestToken(u.email);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/reset',
      payload: { token: t2, newPassword: 'newpass456' },
    });
    expect(ok.statusCode).toBe(200);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: u.userId },
    });
    expect(tokens.length).toBe(2);
    tokens.forEach((t) => expect(t.usedAt).not.toBeNull());
  });
});
