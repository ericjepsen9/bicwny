// 集成测试辅助
// 假设运行前 DATABASE_URL 已指向一个测试库（与开发库隔离）。
// 每次测试前 resetDb 清空业务表，保留 LLM 配置（供 gateway 测试依赖）。
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
    prisma.authSession.deleteMany(),
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
