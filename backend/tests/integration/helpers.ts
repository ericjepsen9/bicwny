// 集成测试辅助
// 假设运行前 DATABASE_URL 已指向一个测试库（与开发库隔离）。
// 每次测试前 resetDb 清空业务表，保留 LLM 配置（供 gateway 测试依赖）。
import type { QuestionType, UserRole } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

/**
 * 清空业务数据，保留 LlmProviderConfig / LlmScenarioConfig / LlmPromptTemplate。
 * 顺序按外键依赖从叶到根。
 */
export async function resetDb(): Promise<void> {
  await prisma.$transaction([
    prisma.llmCallLog.deleteMany(),
    prisma.llmProviderUsage.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.questionReport.deleteMany(),
    prisma.userFavorite.deleteMany(),
    prisma.userMistakeBook.deleteMany(),
    prisma.sm2Card.deleteMany(),
    prisma.userAnswer.deleteMany(),
    prisma.userCourseEnrollment.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.authSession.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.classMember.deleteMany(),
    prisma.class.deleteMany(),
    prisma.question.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.chapter.deleteMany(),
    prisma.course.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

/** 从 app.inject 响应里快速取 data 字段，失败时打印 body 方便排错 */
export function expectOk<T>(res: { statusCode: number; body: string }): T {
  if (res.statusCode >= 400) {
    throw new Error(`期望 2xx，实际 ${res.statusCode}: ${res.body}`);
  }
  return JSON.parse(res.body).data as T;
}

// ═══════ 以下为新路由集成测试共用脚手架 ═══════

export interface RegisteredUser {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

let seq = 0;
function uniqEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${++seq}@itest.app`;
}

/** 注册一个 student；可选 promote 到 coach/admin（用 prisma 直接改 role） */
export async function registerAs(
  app: FastifyInstance,
  role: UserRole = 'student',
  opts: { password?: string; dharmaName?: string } = {},
): Promise<RegisteredUser> {
  const email = uniqEmail(role);
  const password = opts.password ?? 'testpass123';
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, dharmaName: opts.dharmaName },
  });
  const data = expectOk<{
    user: { id: string };
    accessToken: string;
    refreshToken: string;
  }>(reg);
  if (role !== 'student') {
    await prisma.user.update({ where: { id: data.user.id }, data: { role } });
    // 升级后需要重新登录拿到带新 role 的 access token
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    const fresh = expectOk<{ accessToken: string; refreshToken: string }>(login);
    return {
      userId: data.user.id,
      email,
      password,
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
    };
  }
  return {
    userId: data.user.id,
    email,
    password,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

export function authHeader(u: Pick<RegisteredUser, 'accessToken'>) {
  return { authorization: `Bearer ${u.accessToken}` };
}

/** 建一套最小法本骨架：1 course + 1 chapter + 1 lesson。 */
export async function seedCourseLesson(): Promise<{
  courseId: string;
  chapterId: string;
  lessonId: string;
  slug: string;
}> {
  const slug = `itest-${Date.now()}-${++seq}`;
  const course = await prisma.course.create({
    data: { slug, title: 'ITest 论典', isPublished: true },
  });
  const chapter = await prisma.chapter.create({
    data: { courseId: course.id, order: 1, title: '第一品' },
  });
  const lesson = await prisma.lesson.create({
    data: {
      chapterId: chapter.id,
      order: 1,
      title: '第 1 课',
      referenceText: '测试原文',
      teachingSummary: '测试要点',
    },
  });
  return { courseId: course.id, chapterId: chapter.id, lessonId: lesson.id, slug };
}

export interface SeededQuestionOpts {
  courseId: string;
  chapterId: string;
  lessonId: string;
  type?: QuestionType;
  payload?: Record<string, unknown>;
  correctText?: string;
  visibility?: 'public' | 'class_private' | 'draft';
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  createdByUserId?: string | null;
}

/** 直插一道题（绕过 coach 路由），返回 id。默认 single，选项 [a(对), b(错)]。 */
export async function seedQuestion(opts: SeededQuestionOpts): Promise<string> {
  const payload =
    opts.payload ??
    {
      options: [
        { text: '正确选项', correct: true },
        { text: '错误选项', correct: false },
      ],
    };
  const q = await prisma.question.create({
    data: {
      type: opts.type ?? 'single',
      courseId: opts.courseId,
      chapterId: opts.chapterId,
      lessonId: opts.lessonId,
      questionText: '测试题干',
      correctText: opts.correctText ?? '正确选项解析',
      wrongText: '常见错点',
      source: 'itest',
      payload,
      visibility: opts.visibility ?? 'public',
      reviewStatus: opts.reviewStatus ?? 'approved',
      reviewed: (opts.reviewStatus ?? 'approved') !== 'pending',
      createdByUserId: opts.createdByUserId ?? null,
    },
  });
  return q.id;
}
