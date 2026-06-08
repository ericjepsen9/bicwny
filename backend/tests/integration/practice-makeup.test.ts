// 补签集成测试（此前零覆盖）· 覆盖每周配额 / 窗口校验 / 并发抢配额 TOCTOU
//   规则：只能补「最近 7 天内、过去的某天」· 每自然周(ET) 限 1 次
//   并发不同日期补签靠 Serializable + 重试守住「每周 1 次」（@@unique[userId,date] 只挡同日）
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

interface MakeupStatus {
  perWeek: number;
  usedThisWeek: number;
  remaining: number;
  earliestDate: string;
  latestDate: string;
  madeUpDates: string[];
}

async function getStatus(u: { accessToken: string }): Promise<MakeupStatus> {
  const res = await app.inject({ method: 'GET', url: '/api/practice/makeup', headers: authHeader(u) });
  return expectOk<MakeupStatus>(res);
}

function postMakeup(u: { accessToken: string }, date: string) {
  return app.inject({ method: 'POST', url: '/api/practice/makeup', headers: authHeader(u), payload: { date } });
}

describe('POST /api/practice/makeup', () => {
  it('补签昨天 → 成功 · 本周配额用尽 · madeUpDates 含该日', async () => {
    const u = await registerAs(app, 'student');
    const { latestDate } = await getStatus(u); // = 昨天（ET）

    const res = await postMakeup(u, latestDate);
    const data = expectOk<MakeupStatus>(res);
    expect(data.usedThisWeek).toBe(1);
    expect(data.remaining).toBe(0);
    expect(data.madeUpDates).toContain(latestDate);

    const count = await prisma.practiceMakeup.count({ where: { userId: u.userId } });
    expect(count).toBe(1);
  });

  it('每周限 1 次：补两个不同的有效日 · 第二个 400', async () => {
    const u = await registerAs(app, 'student');
    const { latestDate, earliestDate } = await getStatus(u);

    expect((await postMakeup(u, latestDate)).statusCode).toBe(200);
    expect((await postMakeup(u, earliestDate)).statusCode).toBe(400);

    const count = await prisma.practiceMakeup.count({ where: { userId: u.userId } });
    expect(count).toBe(1);
  });

  it('补未来的日期 → 400', async () => {
    const u = await registerAs(app, 'student');
    expect((await postMakeup(u, '2999-12-31')).statusCode).toBe(400);
  });

  it('补窗口外（> 7 天前）→ 400', async () => {
    const u = await registerAs(app, 'student');
    expect((await postMakeup(u, '2000-01-01')).statusCode).toBe(400);
  });

  it('并发抢配额（两个不同有效日同时补）→ 仅 1 个成功 · DB 只落 1 行（TOCTOU 守卫）', async () => {
    const u = await registerAs(app, 'student');
    const { latestDate, earliestDate } = await getStatus(u);

    const [r1, r2] = await Promise.all([
      postMakeup(u, latestDate),
      postMakeup(u, earliestDate),
    ]);
    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([200, 400]); // 恰好一成一败

    const count = await prisma.practiceMakeup.count({ where: { userId: u.userId } });
    expect(count).toBe(1); // 配额未被并发突破
  });
});
