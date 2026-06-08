// 法本导入 commit 幂等集成测试（P0 #2）
// 覆盖：
//   - mode=new 同 clientToken 重发 → 不创建重复 chapter/lesson · 返回 idempotent: true
//   - mode=append 同 clientToken 重发 → 不追加章节 · 返回 idempotent: true
//   - 不同 clientToken → 正常追加（mode=append）/ 拒绝（mode=new slug 冲突）
//   - 缺 clientToken → 旧行为（mode=new 第二次 409 · mode=append 第二次双倍章节）
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

const samplePayload = (slug: string, clientToken?: string) => ({
  mode: 'new' as const,
  newCourse: {
    slug,
    title: '测试法本',
    coverEmoji: '📘',
  },
  chapters: [
    { title: '第一章', lessons: [{ title: '第1节', referenceText: 'aaa' }] },
    { title: '第二章', lessons: [{ title: '第1节', referenceText: 'bbb' }] },
  ],
  ...(clientToken ? { clientToken } : {}),
});

describe('POST /api/admin/courses/import-file/commit · 幂等性', () => {
  it('同 clientToken 重发：仅 1 个 course / 2 章 / 2 节 · 第二次 idempotent=true', async () => {
    const admin = await registerAs(app, 'admin');
    const token = 'idem-token-import-001';
    const slug = 'idem-test-a';

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: samplePayload(slug, token),
    });
    const d1 = expectOk<{ courseId: string; chapterCount: number; lessonCount: number; idempotent?: boolean }>(r1);
    expect(d1.chapterCount).toBe(2);
    expect(d1.lessonCount).toBe(2);
    expect(d1.idempotent).toBeFalsy();

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: samplePayload(slug, token),
    });
    const d2 = expectOk<{ courseId: string; chapterCount: number; lessonCount: number; idempotent?: boolean }>(r2);
    expect(d2.courseId).toBe(d1.courseId);
    expect(d2.chapterCount).toBe(2);
    expect(d2.lessonCount).toBe(2);
    expect(d2.idempotent).toBe(true);

    // DB 实际只有 2 章 2 节
    const chapters = await prisma.chapter.count({ where: { courseId: d1.courseId } });
    const lessons = await prisma.lesson.count({ where: { chapter: { courseId: d1.courseId } } });
    expect(chapters).toBe(2);
    expect(lessons).toBe(2);
  });

  it('mode=append 同 clientToken 重发：不追加章节', async () => {
    const admin = await registerAs(app, 'admin');
    const slug = 'idem-test-b';

    // 先建 course（不带 token）
    const r0 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: samplePayload(slug),
    });
    const d0 = expectOk<{ courseId: string }>(r0);

    // append 第一次：带 token
    const appendToken = 'idem-token-append-001';
    const appendBody = {
      mode: 'append' as const,
      courseId: d0.courseId,
      chapters: [{ title: '第三章', lessons: [{ title: '第1节' }] }],
      clientToken: appendToken,
    };
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: appendBody,
    });
    expectOk(r1);

    // append 第二次：同 token → 幂等
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: appendBody,
    });
    const d2 = expectOk<{ idempotent?: boolean }>(r2);
    expect(d2.idempotent).toBe(true);

    const chapters = await prisma.chapter.count({ where: { courseId: d0.courseId } });
    expect(chapters).toBe(3); // 2(原) + 1(append) · 第二次未追加
  });

  it('不同 clientToken 的 mode=new + 同 slug → 仍 409（保护已有数据）', async () => {
    const admin = await registerAs(app, 'admin');
    const slug = 'idem-test-c';

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: samplePayload(slug, 'token-a'),
    });
    expectOk(r1);

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: samplePayload(slug, 'token-b'), // 不同 token
    });
    expect(r2.statusCode).toBe(409);
  });

  it('缺 clientToken：保持旧行为 · 第二次 mode=new 同 slug → 409', async () => {
    const admin = await registerAs(app, 'admin');
    const slug = 'idem-test-d';

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: samplePayload(slug),
    });
    expectOk(r1);

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: samplePayload(slug),
    });
    expect(r2.statusCode).toBe(409);
  });
});

describe('DELETE /api/admin/courses/:id · 软删归档（不真删）', () => {
  it('归档后 course 行仍在 · isPublished=false · archivedAt 落值 · AuditLog course.archive', async () => {
    const admin = await registerAs(app, 'admin');
    const slug = 'arch-test-a';
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: samplePayload(slug),
    });
    const d1 = expectOk<{ courseId: string }>(r1);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/admin/courses/${d1.courseId}`,
      headers: authHeader(admin),
    });
    expect(del.statusCode).toBe(204);

    const after = await prisma.course.findUnique({ where: { id: d1.courseId } });
    expect(after).not.toBeNull();
    expect(after!.isPublished).toBe(false);
    expect(after!.archivedAt).not.toBeNull();

    const logs = await prisma.auditLog.findMany({
      where: { action: 'course.archive', targetId: d1.courseId },
    });
    expect(logs.length).toBe(1);
  });

  it('已归档的课再次 DELETE → 400', async () => {
    const admin = await registerAs(app, 'admin');
    const slug = 'arch-test-b';
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/admin/courses/import-file/commit',
      headers: authHeader(admin),
      payload: samplePayload(slug),
    });
    const d1 = expectOk<{ courseId: string }>(r1);

    await app.inject({
      method: 'DELETE',
      url: `/api/admin/courses/${d1.courseId}`,
      headers: authHeader(admin),
    });
    const again = await app.inject({
      method: 'DELETE',
      url: `/api/admin/courses/${d1.courseId}`,
      headers: authHeader(admin),
    });
    expect(again.statusCode).toBe(400);
  });
});
