// 班级共享笔记举报闭环集成测试（审计 5.7）
//   学员举报同班共享笔记 → admin 看到 → takedown 把笔记转回 private（移出共享流）
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { authHeader, buildTestApp, expectOk, registerAs, resetDb, seedCourseLesson } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

async function setupSharedNote() {
  const admin = await registerAs(app, 'admin');
  const author = await registerAs(app, 'student');
  const reporter = await registerAs(app, 'student');
  const { courseId } = await seedCourseLesson();
  const cls = expectOk<{ id: string; joinCode: string }>(await app.inject({
    method: 'POST', url: '/api/admin/classes', headers: authHeader(admin), payload: { name: '班', courseId },
  }));
  for (const u of [author, reporter]) {
    await app.inject({ method: 'POST', url: '/api/classes/join', headers: authHeader(u), payload: { joinCode: cls.joinCode } });
  }
  const note = expectOk<{ id: string }>(await app.inject({
    method: 'POST', url: '/api/notes', headers: authHeader(author),
    payload: { title: '共享笔记', body: '内容', visibility: 'class' },
  }));
  return { admin, author, reporter, noteId: note.id };
}

describe('班级共享笔记举报闭环', () => {
  it('举报 → admin 列表可见 → takedown 转回 private', async () => {
    const { admin, reporter, noteId } = await setupSharedNote();

    expect((await app.inject({
      method: 'POST', url: `/api/notes/${noteId}/report`, headers: authHeader(reporter), payload: { reason: '不当内容' },
    })).statusCode).toBe(200);

    const reports = expectOk<Array<{ id: string; noteId: string }>>(await app.inject({
      method: 'GET', url: '/api/notes/reports', headers: authHeader(admin),
    }));
    expect(reports).toHaveLength(1);
    expect(reports[0]!.noteId).toBe(noteId);

    expect((await app.inject({
      method: 'POST', url: `/api/notes/reports/${reports[0]!.id}/action`,
      headers: authHeader(admin), payload: { action: 'takedown' },
    })).statusCode).toBe(200);

    const note = await prisma.note.findUnique({ where: { id: noteId }, select: { visibility: true } });
    expect(note?.visibility).toBe('private'); // 已下架 · 移出共享流

    // 结案后 admin 列表清空
    const after = expectOk<unknown[]>(await app.inject({ method: 'GET', url: '/api/notes/reports', headers: authHeader(admin) }));
    expect(after).toHaveLength(0);
  });

  it('举报自己的笔记 → 400', async () => {
    const { author, noteId } = await setupSharedNote();
    expect((await app.inject({
      method: 'POST', url: `/api/notes/${noteId}/report`, headers: authHeader(author), payload: {},
    })).statusCode).toBe(400);
  });

  it('同一人重复举报 → 幂等（仍只 1 条）', async () => {
    const { admin, reporter, noteId } = await setupSharedNote();
    await app.inject({ method: 'POST', url: `/api/notes/${noteId}/report`, headers: authHeader(reporter), payload: {} });
    await app.inject({ method: 'POST', url: `/api/notes/${noteId}/report`, headers: authHeader(reporter), payload: {} });
    const reports = expectOk<unknown[]>(await app.inject({ method: 'GET', url: '/api/notes/reports', headers: authHeader(admin) }));
    expect(reports).toHaveLength(1);
  });

  it('普通学员无权看举报列表 → 403', async () => {
    const { reporter } = await setupSharedNote();
    expect((await app.inject({ method: 'GET', url: '/api/notes/reports', headers: authHeader(reporter) })).statusCode).toBe(403);
  });
});
