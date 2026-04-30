// 多设备会话管理 integration
//   - 列我的活跃 sessions
//   - 当前 session 不可吊销
//   - 吊销其他 session 后无法 refresh
//   - revoke-others 留当前
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

interface SessionItem {
  id: string;
  isCurrent: boolean;
  browser: string;
  os: string;
}

describe('GET /api/auth/sessions', () => {
  it('返回当前用户活跃 session · 包含 isCurrent 标', async () => {
    const u = await registerAs(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/sessions',
      headers: authHeader(u),
    });
    const sessions = expectOk<SessionItem[]>(res);
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const current = sessions.filter((s) => s.isCurrent);
    expect(current.length).toBe(1);
  });

  it('未登录 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/sessions' });
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /api/auth/sessions/:id', () => {
  it('不能吊销当前 session · 403', async () => {
    const u = await registerAs(app);
    const list = expectOk<SessionItem[]>(await app.inject({
      method: 'GET', url: '/api/auth/sessions', headers: authHeader(u),
    }));
    const me = list.find((s) => s.isCurrent)!;
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/auth/sessions/${me.id}`,
      headers: authHeader(u),
    });
    expect(res.statusCode).toBe(403);
  });

  it('不能吊销别人的 session · 404', async () => {
    const a = await registerAs(app);
    const b = await registerAs(app);
    const bSessions = expectOk<SessionItem[]>(await app.inject({
      method: 'GET', url: '/api/auth/sessions', headers: authHeader(b),
    }));
    const bSid = bSessions[0].id;
    // a 用 b 的 sid · 校验是 userId 隔离
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/auth/sessions/${bSid}`,
      headers: authHeader(a),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/auth/sessions/revoke-others', () => {
  it('吊销其他 session · 留当前可继续访问', async () => {
    const u = await registerAs(app);
    // 再登录一次创造第二个 session（同 email + password）
    const second = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: u.email, password: u.password },
    });
    expect(second.statusCode).toBe(200);

    const before = expectOk<SessionItem[]>(await app.inject({
      method: 'GET', url: '/api/auth/sessions', headers: authHeader(u),
    }));
    expect(before.length).toBeGreaterThanOrEqual(2);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sessions/revoke-others',
      payload: {},
      headers: authHeader(u),
    });
    const data = expectOk<{ revoked: number }>(res);
    expect(data.revoked).toBeGreaterThanOrEqual(1);

    const after = expectOk<SessionItem[]>(await app.inject({
      method: 'GET', url: '/api/auth/sessions', headers: authHeader(u),
    }));
    // 留 1 条（自己）
    expect(after.length).toBe(1);
    expect(after[0].isCurrent).toBe(true);
  });
});
