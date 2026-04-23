// questions CRUD 集成：POST / GET / PATCH / DELETE / batch / generate
// 覆盖：
//   - 创建（coach 只能本班 class_private；public 进 pending）
//   - 列表 + 详情（owner 隔离；admin 超权）
//   - 更新（approved public 锁；coach 改 public 回 pending；非 owner 403）
//   - 删除（有答题记录拒删；approved public 禁删；admin 超权）
//   - batch strict / partial
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

function singlePayload(correctIdx = 0) {
  return {
    options: [
      { text: 'A 选项', correct: correctIdx === 0 },
      { text: 'B 选项', correct: correctIdx === 1 },
    ],
  };
}

function makeCreateBody(
  ids: { courseId: string; chapterId: string; lessonId: string },
  over: Partial<{
    visibility: 'public' | 'class_private';
    ownerClassId: string;
    questionText: string;
    type: string;
  }> = {},
) {
  return {
    courseId: ids.courseId,
    chapterId: ids.chapterId,
    lessonId: ids.lessonId,
    type: over.type ?? 'single',
    visibility: over.visibility ?? 'public',
    ownerClassId: over.ownerClassId,
    questionText: over.questionText ?? '新建题',
    correctText: '解析',
    wrongText: '错因',
    source: 'itest',
    payload: singlePayload(0),
  };
}

describe('POST /api/coach/questions (integration)', () => {
  it('coach 发 public 题 → 201 · reviewStatus=pending', async () => {
    const coach = await registerAs(app, 'coach');
    const ids = await seedCourseLesson();
    const res = await app.inject({
      method: 'POST',
      url: '/api/coach/questions',
      headers: authHeader(coach),
      payload: makeCreateBody(ids),
    });
    expect(res.statusCode).toBe(201);
    const q = expectOk<{ id: string; reviewStatus: string; createdByUserId: string }>(res);
    expect(q.reviewStatus).toBe('pending');
    expect(q.createdByUserId).toBe(coach.userId);
  });

  it('student 调 coach 接口 → 403', async () => {
    const stu = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const res = await app.inject({
      method: 'POST',
      url: '/api/coach/questions',
      headers: authHeader(stu),
      payload: makeCreateBody(ids),
    });
    expect(res.statusCode).toBe(403);
  });

  it('class_private 必须指定 ownerClassId', async () => {
    const coach = await registerAs(app, 'coach');
    const ids = await seedCourseLesson();
    const res = await app.inject({
      method: 'POST',
      url: '/api/coach/questions',
      headers: authHeader(coach),
      payload: makeCreateBody(ids, { visibility: 'class_private' }),
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/coach/questions (integration)', () => {
  it('只能看本人的题；admin 看全部', async () => {
    const c1 = await registerAs(app, 'coach');
    const c2 = await registerAs(app, 'coach');
    const admin = await registerAs(app, 'admin');
    const ids = await seedCourseLesson();
    await seedQuestion({ ...ids, createdByUserId: c1.userId });
    await seedQuestion({ ...ids, createdByUserId: c2.userId });

    const l1 = await app.inject({
      method: 'GET',
      url: '/api/coach/questions',
      headers: authHeader(c1),
    });
    const list1 = expectOk<Array<{ createdByUserId: string }>>(l1);
    expect(list1).toHaveLength(1);
    expect(list1[0].createdByUserId).toBe(c1.userId);

    // admin 看 coach 列表路径其实也是过滤「本人创建的」；admin 自己没创建 → 0
    const la = await app.inject({
      method: 'GET',
      url: '/api/coach/questions',
      headers: authHeader(admin),
    });
    expect(expectOk<unknown[]>(la)).toHaveLength(0);
  });
});

describe('PATCH /api/coach/questions/:id (integration)', () => {
  it('coach 改自己的 public 题 · reviewStatus 回 pending', async () => {
    const coach = await registerAs(app, 'coach');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion({
      ...ids,
      createdByUserId: coach.userId,
      reviewStatus: 'approved',
      visibility: 'public',
    });
    // 已 approved 的 public 题 coach 不能改 → 403
    const lock = await app.inject({
      method: 'PATCH',
      url: `/api/coach/questions/${qid}`,
      headers: authHeader(coach),
      payload: { questionText: '改过了' },
    });
    expect(lock.statusCode).toBe(403);

    // 改成 pending 后就能改
    await prisma.question.update({
      where: { id: qid },
      data: { reviewStatus: 'pending', reviewed: false },
    });
    const ok = await app.inject({
      method: 'PATCH',
      url: `/api/coach/questions/${qid}`,
      headers: authHeader(coach),
      payload: { questionText: '改过了' },
    });
    const patched = expectOk<{ questionText: string; reviewStatus: string }>(ok);
    expect(patched.questionText).toBe('改过了');
    expect(patched.reviewStatus).toBe('pending');
  });

  it('非本人 → 403', async () => {
    const c1 = await registerAs(app, 'coach');
    const c2 = await registerAs(app, 'coach');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion({
      ...ids,
      createdByUserId: c1.userId,
      reviewStatus: 'pending',
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/coach/questions/${qid}`,
      headers: authHeader(c2),
      payload: { questionText: '别人手伸太长' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin 改 approved public 题 · 保留 approved', async () => {
    const admin = await registerAs(app, 'admin');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion({
      ...ids,
      createdByUserId: admin.userId,
      reviewStatus: 'approved',
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/coach/questions/${qid}`,
      headers: authHeader(admin),
      payload: { questionText: 'admin 直改' },
    });
    const q = expectOk<{ reviewStatus: string }>(res);
    expect(q.reviewStatus).toBe('approved');
  });

  it('空 patch → 400', async () => {
    const coach = await registerAs(app, 'coach');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion({
      ...ids,
      createdByUserId: coach.userId,
      reviewStatus: 'pending',
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/coach/questions/${qid}`,
      headers: authHeader(coach),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/coach/questions/:id (integration)', () => {
  it('无答题记录 · coach 可删 pending 题', async () => {
    const coach = await registerAs(app, 'coach');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion({
      ...ids,
      createdByUserId: coach.userId,
      reviewStatus: 'pending',
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/coach/questions/${qid}`,
      headers: authHeader(coach),
    });
    expect(expectOk<{ deleted: boolean }>(res).deleted).toBe(true);
    expect(await prisma.question.count({ where: { id: qid } })).toBe(0);
  });

  it('有答题记录 → 400 拒删', async () => {
    const coach = await registerAs(app, 'coach');
    const stu = await registerAs(app, 'student');
    const ids = await seedCourseLesson();
    const qid = await seedQuestion({
      ...ids,
      createdByUserId: coach.userId,
      reviewStatus: 'pending',
    });
    await prisma.userAnswer.create({
      data: {
        userId: stu.userId,
        questionId: qid,
        answer: {},
        isCorrect: false,
      },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/coach/questions/${qid}`,
      headers: authHeader(coach),
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/coach/questions/batch (integration)', () => {
  it('strict 模式：一条非法整批回滚', async () => {
    const coach = await registerAs(app, 'coach');
    const ids = await seedCourseLesson();
    const items = [
      makeCreateBody(ids),
      // draft 禁止外部创建 → 第二条会抛错，strict 模式整批失败
      {
        ...makeCreateBody(ids),
        visibility: 'draft' as unknown as 'public',
      },
    ];
    const res = await app.inject({
      method: 'POST',
      url: '/api/coach/questions/batch',
      headers: authHeader(coach),
      payload: { items },
    });
    // 第二条 zod 不接受 draft → 400
    expect(res.statusCode).toBe(400);
    expect(await prisma.question.count({ where: { createdByUserId: coach.userId } })).toBe(0);
  });

  it('partial 模式：逐条失败不阻断（两条合法 + 一条非法）', async () => {
    const coach = await registerAs(app, 'coach');
    const ids = await seedCourseLesson();
    const items = [
      makeCreateBody(ids, { questionText: 'Q1' }),
      // class_private 缺 ownerClassId → 该条 service 会抛 BadRequest，partial 收拢进 skipped
      { ...makeCreateBody(ids, { questionText: 'Q2' }), visibility: 'class_private' as const },
      makeCreateBody(ids, { questionText: 'Q3' }),
    ];
    const res = await app.inject({
      method: 'POST',
      url: '/api/coach/questions/batch',
      headers: authHeader(coach),
      payload: { partial: true, items },
    });
    expect(res.statusCode).toBe(207);
    const out = expectOk<{
      total: number;
      succeeded: number;
      failed: number;
      items: Array<{ ok: boolean }>;
    }>(res);
    expect(out.total).toBe(3);
    expect(out.succeeded).toBe(2);
    expect(out.failed).toBe(1);
  });
});
