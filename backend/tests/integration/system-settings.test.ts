// SystemSetting · scraper.fetchVia 切换 + 鉴权 + AuditLog 集成测试
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { clearSettingsCache } from '../../src/modules/admin/system-settings.service.js';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); clearSettingsCache(); });
afterEach(() => { delete process.env.ASIA_RELAY_URL; delete process.env.ASIA_RELAY_TOKEN; });

describe('GET/PUT /api/admin/system/scraper-via', () => {
  it('未登录 → 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/admin/system/scraper-via' });
    expect(r.statusCode).toBe(401);
  });

  it('student → 403（admin guard）', async () => {
    const u = await registerAs(app, 'student');
    const r = await app.inject({
      method: 'GET',
      url: '/api/admin/system/scraper-via',
      headers: authHeader(u),
    });
    expect(r.statusCode).toBe(403);
  });

  it('admin GET 默认返回 local + relayConfigured=false（env 未设）', async () => {
    const a = await registerAs(app, 'admin');
    const r = await app.inject({
      method: 'GET',
      url: '/api/admin/system/scraper-via',
      headers: authHeader(a),
    });
    const d = expectOk<{ value: string; relayConfigured: boolean }>(r);
    expect(d.value).toBe('local');
    expect(d.relayConfigured).toBe(false);
  });

  it('admin PUT asia 但 env 未配置 → 400', async () => {
    const a = await registerAs(app, 'admin');
    const r = await app.inject({
      method: 'PUT',
      url: '/api/admin/system/scraper-via',
      headers: authHeader(a),
      payload: { value: 'asia' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.body).toMatch(/ASIA_RELAY/);
  });

  it('admin PUT 非法值 → 400', async () => {
    const a = await registerAs(app, 'admin');
    const r = await app.inject({
      method: 'PUT',
      url: '/api/admin/system/scraper-via',
      headers: authHeader(a),
      payload: { value: 'mars' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('admin PUT local → 200 · GET 回 local · 写 AuditLog', async () => {
    const a = await registerAs(app, 'admin');
    const put = await app.inject({
      method: 'PUT',
      url: '/api/admin/system/scraper-via',
      headers: authHeader(a),
      payload: { value: 'local' },
    });
    expectOk<{ value: string }>(put);

    const get = await app.inject({
      method: 'GET',
      url: '/api/admin/system/scraper-via',
      headers: authHeader(a),
    });
    const d = expectOk<{ value: string }>(get);
    expect(d.value).toBe('local');

    const logs = await prisma.auditLog.findMany({ where: { action: 'system.setting.update' } });
    expect(logs.length).toBe(1);
    expect(logs[0].targetId).toBe('scraper.fetchVia');
    expect(logs[0].adminId).toBe(a.userId);
  });
});
