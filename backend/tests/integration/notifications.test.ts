// 通知模块集成：5 条路由 + 本人隔离 + 未读计数 + 游标分页
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createNotification } from '../../src/modules/notifications/service.js';
import {
  authHeader,
  buildTestApp,
  expectOk,
  registerAs,
  resetDb,
  type RegisteredUser,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

async function seedFor(u: RegisteredUser, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = await createNotification({
      userId: u.userId,
      type: i % 2 === 0 ? 'system' : 'achievement',
      title: `通知 #${i}`,
      body: `内容 ${i}`,
      link: `notification.html#${i}`,
    });
    ids.push(n.id);
  }
  return ids;
}

describe('GET /api/notifications', () => {
  it('按 createdAt desc 返回本人通知', async () => {
    const u = await registerAs(app, 'student');
    await seedFor(u, 3);
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: authHeader(u),
    });
    const list = expectOk<Array<{ id: string; title: string; isRead: boolean }>>(res);
    expect(list).toHaveLength(3);
    // 倒序：#2 最新
    expect(list[0]?.title).toBe('通知 #2');
    expect(list[2]?.title).toBe('通知 #0');
    expect(list.every((n) => !n.isRead)).toBe(true);
  });

  it('unreadOnly=true 过滤已读', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedFor(u, 3);
    // 标第二条为已读
    await app.inject({
      method: 'POST',
      url: `/api/notifications/${ids[1]}/read`,
      headers: authHeader(u),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications?unreadOnly=true',
      headers: authHeader(u),
    });
    const list = expectOk<Array<{ id: string }>>(res);
    expect(list).toHaveLength(2);
    expect(list.find((n) => n.id === ids[1])).toBeUndefined();
  });

  it('limit + cursor 游标分页', async () => {
    const u = await registerAs(app, 'student');
    await seedFor(u, 5);
    const first = await app.inject({
      method: 'GET',
      url: '/api/notifications?limit=2',
      headers: authHeader(u),
    });
    const page1 = expectOk<Array<{ id: string; title: string }>>(first);
    expect(page1).toHaveLength(2);
    expect(page1[0]?.title).toBe('通知 #4');

    const second = await app.inject({
      method: 'GET',
      url: `/api/notifications?limit=2&cursor=${page1[1]!.id}`,
      headers: authHeader(u),
    });
    const page2 = expectOk<Array<{ title: string }>>(second);
    expect(page2).toHaveLength(2);
    expect(page2[0]?.title).toBe('通知 #2');
  });

  it('本人隔离：看不到他人通知', async () => {
    const me = await registerAs(app, 'student');
    const other = await registerAs(app, 'student');
    await seedFor(other, 2);
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: authHeader(me),
    });
    const list = expectOk<unknown[]>(res);
    expect(list).toHaveLength(0);
  });

  it('未登录 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/notifications' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/notifications/unread-count', () => {
  it('返回未读数', async () => {
    const u = await registerAs(app, 'student');
    const ids = await seedFor(u, 4);
    await app.inject({
      method: 'POST',
      url: `/api/notifications/${ids[0]}/read`,
      headers: authHeader(u),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications/unread-count',
      headers: authHeader(u),
    });
    const d = expectOk<{ count: number }>(res);
    expect(d.count).toBe(3);
  });

  it('无数据时 count=0', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications/unread-count',
      headers: authHeader(u),
    });
    expect(expectOk<{ count: number }>(res).count).toBe(0);
  });
});

describe('POST /api/notifications/:id/read', () => {
  it('标已读写 readAt', async () => {
    const u = await registerAs(app, 'student');
    const [id] = await seedFor(u, 1);
    const res = await app.inject({
      method: 'POST',
      url: `/api/notifications/${id}/read`,
      headers: authHeader(u),
    });
    const n = expectOk<{ isRead: boolean; readAt: string | null }>(res);
    expect(n.isRead).toBe(true);
    expect(n.readAt).not.toBeNull();
  });

  it('非本人 403', async () => {
    const owner = await registerAs(app, 'student');
    const other = await registerAs(app, 'student');
    const [id] = await seedFor(owner, 1);
    const res = await app.inject({
      method: 'POST',
      url: `/api/notifications/${id}/read`,
      headers: authHeader(other),
    });
    expect(res.statusCode).toBe(403);
  });

  it('不存在 404', async () => {
    const u = await registerAs(app, 'student');
    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/no-such-id/read',
      headers: authHeader(u),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/notifications/read-all', () => {
  it('全部标已读并返回 updated 数', async () => {
    const u = await registerAs(app, 'student');
    await seedFor(u, 3);
    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/read-all',
      headers: authHeader(u),
    });
    expect(expectOk<{ updated: number }>(res).updated).toBe(3);

    const cnt = await app.inject({
      method: 'GET',
      url: '/api/notifications/unread-count',
      headers: authHeader(u),
    });
    expect(expectOk<{ count: number }>(cnt).count).toBe(0);
  });

  it('不影响他人通知', async () => {
    const me = await registerAs(app, 'student');
    const other = await registerAs(app, 'student');
    await seedFor(me, 2);
    await seedFor(other, 2);
    await app.inject({
      method: 'POST',
      url: '/api/notifications/read-all',
      headers: authHeader(me),
    });
    const cnt = await app.inject({
      method: 'GET',
      url: '/api/notifications/unread-count',
      headers: authHeader(other),
    });
    expect(expectOk<{ count: number }>(cnt).count).toBe(2);
  });
});

describe('DELETE /api/notifications/:id', () => {
  it('成功删除本人通知', async () => {
    const u = await registerAs(app, 'student');
    const [id] = await seedFor(u, 1);
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/notifications/${id}`,
      headers: authHeader(u),
    });
    expect(del.statusCode).toBe(200);
    const list = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: authHeader(u),
    });
    expect(expectOk<unknown[]>(list)).toHaveLength(0);
  });

  it('非本人 403', async () => {
    const owner = await registerAs(app, 'student');
    const other = await registerAs(app, 'student');
    const [id] = await seedFor(owner, 1);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/notifications/${id}`,
      headers: authHeader(other),
    });
    expect(res.statusCode).toBe(403);
  });
});
