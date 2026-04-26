// 认证 E2E：register → login → /me；错误密码 → 401；refresh 轮转
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, expectOk, resetDb } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetDb();
});

const EMAIL = 'itest@juexue.app';
const PASS = 'testpass123';

describe('auth flow (integration)', () => {
  it('register → login → /me 拿到本人', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: EMAIL, password: PASS, dharmaName: '测试同学' },
    });
    expect(reg.statusCode).toBe(201);
    const regData = expectOk<{ accessToken: string }>(reg);
    expect(regData.accessToken).toBeTruthy();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: EMAIL, password: PASS },
    });
    const { accessToken } = expectOk<{ accessToken: string }>(login);

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const user = expectOk<{ email: string; role: string }>(me);
    expect(user.email).toBe(EMAIL);
    expect(user.role).toBe('student');
  });

  it('错密码 → 401 Unauthorized', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: EMAIL, password: PASS },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: EMAIL, password: 'wrongpass' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('refresh 后旧 refreshToken 不再可用', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: EMAIL, password: PASS },
    });
    const { refreshToken: r0 } = expectOk<{ refreshToken: string }>(reg);

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: r0 },
    });
    expect(r1.statusCode).toBe(200);

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: r0 }, // 旧 token
    });
    expect(r2.statusCode).toBe(401);
  });

  it('并发同 refreshToken 双发 → 仅一笔成功（防双重签发）', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: EMAIL, password: PASS },
    });
    const { refreshToken: r0 } = expectOk<{ refreshToken: string }>(reg);

    const [a, b] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: r0 },
      }),
      app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: r0 },
      }),
    ]);
    const codes = [a.statusCode, b.statusCode].sort();
    expect(codes).toEqual([200, 401]);
  });
});
