// 集成测试 · P2 #23 · A/B 实验
// 覆盖：
//   1) deterministicVariant 同 subject 永远同 variant
//   2) POST /api/experiments/:key/assign 首次写 exposure · 二次返回同 variant
//   3) GET /api/admin/experiments + /:key/results · 转化按 goalEvent 算
//   4) PATCH /api/admin/experiments/:key · 归档后 assign 返回 inactive=true
//   5) GET /api/admin/analytics/funnel · 按事件序列算每步留存
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deterministicVariant } from '../../src/lib/experiments.js';
import { prisma } from '../../src/lib/prisma.js';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

describe('deterministicVariant', () => {
  it('同 subject 同 key 永远同 variant', () => {
    const variants = [
      { name: 'control', weight: 50 },
      { name: 'treatment', weight: 50 },
    ];
    const v1 = deterministicVariant(variants, 'uid:abc', 'home_cta');
    const v2 = deterministicVariant(variants, 'uid:abc', 'home_cta');
    expect(v1).toBe(v2);
  });

  it('权重 100/0 时所有 subject 都进 control', () => {
    const variants = [
      { name: 'control', weight: 100 },
      { name: 'treatment', weight: 0 },
    ];
    for (let i = 0; i < 50; i++) {
      expect(deterministicVariant(variants, `uid:${i}`, 'k')).toBe('control');
    }
  });
});

describe('POST /api/experiments/:key/assign', () => {
  it('首次写 exposure · 二次返回同 variant · firstSeen=false', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');

    await app.inject({
      method: 'POST',
      url: '/api/admin/experiments',
      headers: authHeader(admin),
      payload: {
        key: 'home_cta_v1',
        variants: [
          { name: 'control', weight: 50 },
          { name: 'treatment', weight: 50 },
        ],
      },
    });

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/experiments/home_cta_v1/assign',
      headers: authHeader(stu),
      payload: {},
    });
    const d1 = expectOk<{ variant: string; firstSeen: boolean }>(r1);
    expect(['control', 'treatment']).toContain(d1.variant);
    expect(d1.firstSeen).toBe(true);

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/experiments/home_cta_v1/assign',
      headers: authHeader(stu),
      payload: {},
    });
    const d2 = expectOk<{ variant: string; firstSeen: boolean }>(r2);
    expect(d2.variant).toBe(d1.variant);
    expect(d2.firstSeen).toBe(false);

    const exposures = await prisma.experimentExposure.count({
      where: { experimentKey: 'home_cta_v1', userId: stu.userId },
    });
    expect(exposures).toBe(1);
  });

  it('实验归档后 assign 返回 inactive:true · variant=control', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');

    await app.inject({
      method: 'POST',
      url: '/api/admin/experiments',
      headers: authHeader(admin),
      payload: {
        key: 'archived_exp',
        variants: [{ name: 'control', weight: 50 }, { name: 'b', weight: 50 }],
      },
    });
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/experiments/archived_exp',
      headers: authHeader(admin),
      payload: { archive: true },
    });

    const r = await app.inject({
      method: 'POST',
      url: '/api/experiments/archived_exp/assign',
      headers: authHeader(stu),
      payload: {},
    });
    const d = expectOk<{ variant: string; inactive?: boolean }>(r);
    expect(d.variant).toBe('control');
    expect(d.inactive).toBe(true);
    // 归档后不写新 exposure
    const count = await prisma.experimentExposure.count({
      where: { experimentKey: 'archived_exp' },
    });
    expect(count).toBe(0);
  });
});

describe('GET /api/admin/experiments/:key/results', () => {
  it('按 variant 统计 exposed + converted（goalEvent 后的事件）', async () => {
    const admin = await registerAs(app, 'admin');
    const stu1 = await registerAs(app, 'student');
    const stu2 = await registerAs(app, 'student');

    await app.inject({
      method: 'POST',
      url: '/api/admin/experiments',
      headers: authHeader(admin),
      payload: {
        key: 'cta_test',
        variants: [
          { name: 'control', weight: 100 },
          { name: 'treatment', weight: 0 },
        ],
        goalEvent: 'click_start_quiz',
      },
    });

    // 两个用户都进 control（权重 100/0）
    for (const u of [stu1, stu2]) {
      await app.inject({
        method: 'POST',
        url: '/api/experiments/cta_test/assign',
        headers: authHeader(u),
        payload: {},
      });
    }

    // stu1 触发转化 · stu2 没
    await prisma.analyticsEvent.create({
      data: {
        userId: stu1.userId,
        sessionId: 'sess1',
        event: 'click_start_quiz',
        properties: {},
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/experiments/cta_test/results',
      headers: authHeader(admin),
    });
    const d = expectOk<{
      experiment: { goalEvent: string };
      stats: Array<{ variant: string; exposed: number; converted: number; rate: number }>;
    }>(res);
    expect(d.experiment.goalEvent).toBe('click_start_quiz');
    const control = d.stats.find((s) => s.variant === 'control')!;
    expect(control.exposed).toBe(2);
    expect(control.converted).toBe(1);
    expect(control.rate).toBeCloseTo(0.5);
  });
});

describe('GET /api/admin/analytics/funnel', () => {
  it('按事件序列计算每步留存 · 单用户', async () => {
    const admin = await registerAs(app, 'admin');
    const stu1 = await registerAs(app, 'student');
    const stu2 = await registerAs(app, 'student');

    // stu1 完成全部 3 步
    const t = (e: string, off: number) =>
      prisma.analyticsEvent.create({
        data: {
          userId: stu1.userId,
          sessionId: 'sess',
          event: e,
          properties: {},
          createdAt: new Date(Date.now() - 60_000 + off * 1000),
        },
      });
    await t('page_view', 1);
    await t('click_start', 2);
    await t('quiz_submit', 3);
    // stu2 只完成第 1 步
    await prisma.analyticsEvent.create({
      data: {
        userId: stu2.userId,
        sessionId: 'sess2',
        event: 'page_view',
        properties: {},
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/analytics/funnel?steps=page_view,click_start,quiz_submit',
      headers: authHeader(admin),
    });
    const d = expectOk<{
      steps: Array<{ step: string; users: number; rateFromStart: number }>;
    }>(res);
    expect(d.steps.length).toBe(3);
    expect(d.steps[0]!.users).toBe(2);
    expect(d.steps[1]!.users).toBe(1);
    expect(d.steps[2]!.users).toBe(1);
    expect(d.steps[2]!.rateFromStart).toBeCloseTo(0.5);
  });
});
