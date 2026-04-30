// 集成测试 · P2 #22 · 内容版本化
// 覆盖：
//   1) runSeed 幂等：同名 + 同 hash 两次只跑一次 · ContentSeed 1 行
//   2) runSeed hash 改了不让重跑 · 除非 force=true
//   3) GET /api/admin/content/seeds + /releases · admin 看到 / student 403
//   4) POST /api/admin/users/:id/cohort · 写 release · oldCohort==newCohort 返回 changed:false
//   5) listLessonQuestions cohort 过滤：null 用户只见 cohort=null · 'A' 用户见 null+A · 不见 B
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/lib/content-seed.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  authHeader,
  buildTestApp,
  expectOk,
  registerAs,
  resetDb,
  seedCourseLesson,
  seedQuestion,
} from './helpers.js';
import { listLessonQuestions } from '../../src/modules/questions/list.service.js';

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

describe('runSeed 幂等', () => {
  it('同名同 hash 第二次直接 skipped', async () => {
    const { courseId } = await seedCourseLesson();
    const def = {
      name: 'V_test_idempotent',
      hash: 'fixed-hash',
      run: async (tx: any, ctx: any) => {
        await ctx.record('course', courseId, 'create', null, 1);
        return { ok: 1 };
      },
    };
    const r1 = await runSeed(def);
    expect(r1.skipped).toBe(false);
    expect(r1.releases).toBe(1);

    const r2 = await runSeed(def);
    expect(r2.skipped).toBe(true);
    expect(r2.releases).toBe(0);

    const seedRows = await prisma.contentSeed.count();
    expect(seedRows).toBe(1);
    const releaseRows = await prisma.contentRelease.count();
    expect(releaseRows).toBe(1);
  });

  it('同名 hash 变了默认拒跑 · force=true 才允许', async () => {
    const { courseId } = await seedCourseLesson();
    const make = (hash: string, force = false) => ({
      name: 'V_test_hash_change',
      hash,
      force,
      run: async (tx: any, ctx: any) => {
        await ctx.record('course', courseId, 'update', 1, 2);
        return null;
      },
    });
    await runSeed(make('hash-v1'));
    await expect(runSeed(make('hash-v2'))).rejects.toThrow(/different hash/);

    const r = await runSeed(make('hash-v2', true));
    expect(r.skipped).toBe(false);
    expect(r.hashChanged).toBe(true);

    const cs = await prisma.contentSeed.findUnique({
      where: { name: 'V_test_hash_change' },
    });
    expect(cs?.hash).toBe('hash-v2');
    // 两次跑都写了 release
    const releases = await prisma.contentRelease.count({
      where: { bySeed: 'V_test_hash_change' },
    });
    expect(releases).toBe(2);
  });
});

describe('GET /api/admin/content/{seeds,releases}', () => {
  it('admin 看到 · student 403', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    const { courseId } = await seedCourseLesson();
    await runSeed({
      name: 'V_admin_route',
      hash: 'h',
      run: async (tx, ctx) => {
        await ctx.record('course', courseId, 'create', null, 1);
        return null;
      },
    });

    const seedsOk = await app.inject({
      method: 'GET',
      url: '/api/admin/content/seeds',
      headers: authHeader(admin),
    });
    const seeds = expectOk<Array<{ name: string }>>(seedsOk);
    expect(seeds.some((s) => s.name === 'V_admin_route')).toBe(true);

    const releasesOk = await app.inject({
      method: 'GET',
      url: '/api/admin/content/releases?bySeed=V_admin_route',
      headers: authHeader(admin),
    });
    const releases = expectOk<{ items: Array<{ entity: string }>; nextCursor: string | null }>(
      releasesOk,
    );
    expect(releases.items.length).toBe(1);
    expect(releases.items[0]!.entity).toBe('course');

    const denied = await app.inject({
      method: 'GET',
      url: '/api/admin/content/seeds',
      headers: authHeader(stu),
    });
    expect(denied.statusCode).toBe(403);
  });
});

describe('POST /api/admin/users/:id/cohort', () => {
  it('指派 cohort 写 release · 同值返回 changed:false', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');

    const r1 = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${stu.userId}/cohort`,
      headers: authHeader(admin),
      payload: { cohort: 'A' },
    });
    const d1 = expectOk<{ contentCohort: string | null; changed: boolean }>(r1);
    expect(d1.contentCohort).toBe('A');
    expect(d1.changed).toBe(true);

    const r2 = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${stu.userId}/cohort`,
      headers: authHeader(admin),
      payload: { cohort: 'A' },
    });
    const d2 = expectOk<{ changed: boolean }>(r2);
    expect(d2.changed).toBe(false);

    const releases = await prisma.contentRelease.findMany({
      where: { entity: 'cohort', entityId: stu.userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(releases.length).toBe(1);
    expect(releases[0]!.change).toBe('cohort-set');
    const diff = releases[0]!.diff as { from: string | null; to: string | null };
    expect(diff.from).toBe(null);
    expect(diff.to).toBe('A');
  });
});

describe('Cohort 过滤 · listLessonQuestions', () => {
  it('null 用户只见 cohort=null · A 用户见 null+A · 不见 B', async () => {
    const userNull = await registerAs(app, 'student');
    const userA = await registerAs(app, 'student');
    await prisma.user.update({
      where: { id: userA.userId },
      data: { contentCohort: 'A' },
    });

    const { courseId, chapterId, lessonId } = await seedCourseLesson();
    await seedQuestion({ courseId, chapterId, lessonId }); // cohort=null
    await seedQuestion({ courseId, chapterId, lessonId, cohort: 'A' });
    await seedQuestion({ courseId, chapterId, lessonId, cohort: 'B' });

    const forNull = await listLessonQuestions(lessonId, userNull.userId);
    expect(forNull.length).toBe(1);
    expect(forNull[0]!.cohort).toBe(null);

    const forA = await listLessonQuestions(lessonId, userA.userId);
    expect(forA.length).toBe(2);
    const cohorts = forA.map((q) => q.cohort).sort();
    expect(cohorts).toEqual([null, 'A']);
  });
});
