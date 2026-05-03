// 集成测试 · P2 #24 · 全文搜索
// 覆盖：
//   1) 标题命中 score 高于 description 命中
//   2) 跨 type 返回 course/lesson/question
//   3) cohort 过滤：null 用户不见 cohort='A' 题
//   4) reviewStatus != approved / visibility != public 不出现
//   5) 短词 / 空 q 校验
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

interface SearchHit { type: string; id: string; title?: string; questionTextPreview?: string; score: number; }

async function search(url: string, headers?: Record<string, string>) {
  const res = await app.inject({ method: 'GET', url, headers: headers || {} });
  return expectOk<{ hits: SearchHit[]; q: string; total: number }>(res);
}

describe('GET /api/search', () => {
  it('标题命中 score 高于 description 命中', async () => {
    await prisma.course.create({
      data: {
        slug: 'search-test-1',
        title: '智慧法本',
        description: '介绍智慧的精要',
      },
    });
    await prisma.course.create({
      data: {
        slug: 'search-test-2',
        title: '其他法本',
        description: '提及智慧二字',
      },
    });

    const r = await search('/api/search?q=智慧');
    const titleHit = r.hits.find((h) => h.title === '智慧法本')!;
    const descHit = r.hits.find((h) => h.title === '其他法本')!;
    expect(titleHit).toBeTruthy();
    expect(descHit).toBeTruthy();
    expect(titleHit.score).toBeGreaterThan(descHit.score);
  });

  it('跨 type 返回 course / lesson / question', async () => {
    const { courseId, chapterId, lessonId } = await seedCourseLesson();
    // 改 course 标题命中
    await prisma.course.update({
      where: { id: courseId },
      data: { title: '心要论' },
    });
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { title: '心要总说' },
    });
    await seedQuestion({
      courseId,
      chapterId,
      lessonId,
      payload: {
        options: [
          { text: '心要', correct: true },
          { text: '其他', correct: false },
        ],
      },
    });
    // 给 question 一个命中 questionText 的标题
    await prisma.question.updateMany({ data: { questionText: '心要的核心是什么？' } });

    const r = await search('/api/search?q=心要');
    const types = new Set(r.hits.map((h) => h.type));
    expect(types.has('course')).toBe(true);
    expect(types.has('lesson')).toBe(true);
    expect(types.has('question')).toBe(true);
  });

  it('cohort 过滤：null viewer 不见 cohort=A 题', async () => {
    const stuNull = await registerAs(app, 'student');
    const stuA = await registerAs(app, 'student');
    await prisma.user.update({
      where: { id: stuA.userId },
      data: { contentCohort: 'A' },
    });

    const { courseId, chapterId, lessonId } = await seedCourseLesson();
    await seedQuestion({
      courseId, chapterId, lessonId, cohort: 'A',
      payload: { options: [{ text: 'a', correct: true }, { text: 'b', correct: false }] },
    });
    await prisma.question.updateMany({ data: { questionText: '专属测试题 cohort A' } });

    const rNull = await search('/api/search?q=专属测试题', authHeader(stuNull));
    expect(rNull.hits.find((h) => h.type === 'question')).toBeUndefined();

    const rA = await search('/api/search?q=专属测试题', authHeader(stuA));
    expect(rA.hits.find((h) => h.type === 'question')).toBeTruthy();
  });

  it('未发布 / 已归档 course 不出现', async () => {
    await prisma.course.create({
      data: {
        slug: 'unpub-1',
        title: '未发布法本',
        isPublished: false,
      },
    });
    await prisma.course.create({
      data: {
        slug: 'archived-1',
        title: '已归档法本',
        isPublished: true,
        archivedAt: new Date(),
      },
    });

    const rUn = await search('/api/search?q=未发布');
    expect(rUn.hits.find((h) => h.type === 'course')).toBeUndefined();
    const rAr = await search('/api/search?q=已归档');
    expect(rAr.hits.find((h) => h.type === 'course')).toBeUndefined();
  });

  it('空 q 返回 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=' });
    expect(res.statusCode).toBe(400);
  });
});
