// 班级 admin 操作 AuditLog 集成测试（P0 #4）
// 覆盖：
//   POST   /api/admin/classes                     → AuditLog class.create
//   PATCH  /api/admin/classes/:id/archive         → AuditLog class.archive · before/after
//   POST   /api/admin/classes/:id/members         → AuditLog class.member.add
//   DELETE /api/admin/classes/:id/members/:uid    → AuditLog class.member.remove · before
//   学员自助 join（student 路由）→ 无 AuditLog 写入（不污染 admin 审计）
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
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetDb(); });

async function adminCreateClass(admin: { accessToken: string }, courseId: string, name = '测试班') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/classes',
    headers: authHeader(admin),
    payload: { name, courseId },
  });
  return expectOk<{ id: string; joinCode: string }>(res);
}

describe('Admin class operations · AuditLog', () => {
  it('POST /api/admin/classes → AuditLog class.create', async () => {
    const admin = await registerAs(app, 'admin');
    const { courseId } = await seedCourseLesson();
    const cls = await adminCreateClass(admin, courseId, 'A 班');

    const logs = await prisma.auditLog.findMany({
      where: { action: 'class.create', targetId: cls.id },
    });
    expect(logs.length).toBe(1);
    expect(logs[0]!.adminId).toBe(admin.userId);
    expect(logs[0]!.after).toMatchObject({ name: 'A 班', courseId });
  });

  it('PATCH /api/admin/classes/:id/archive → AuditLog class.archive · before isActive=true · after false', async () => {
    const admin = await registerAs(app, 'admin');
    const { courseId } = await seedCourseLesson();
    const cls = await adminCreateClass(admin, courseId);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/classes/${cls.id}/archive`,
      headers: authHeader(admin),
    });
    expectOk(res);

    const logs = await prisma.auditLog.findMany({
      where: { action: 'class.archive', targetId: cls.id },
    });
    expect(logs.length).toBe(1);
    expect(logs[0]!.before).toMatchObject({ isActive: true });
    expect(logs[0]!.after).toMatchObject({ isActive: false });
  });

  it('POST /api/admin/classes/:id/members → AuditLog class.member.add', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    const { courseId } = await seedCourseLesson();
    const cls = await adminCreateClass(admin, courseId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/classes/${cls.id}/members`,
      headers: authHeader(admin),
      payload: { userId: stu.userId, role: 'student' },
    });
    expectOk(res);

    const logs = await prisma.auditLog.findMany({
      where: { action: 'class.member.add' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0]!.adminId).toBe(admin.userId);
    expect(logs[0]!.after).toMatchObject({
      classId: cls.id,
      userId: stu.userId,
      role: 'student',
    });
  });

  it('DELETE /api/admin/classes/:id/members/:userId → AuditLog class.member.remove', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    const { courseId } = await seedCourseLesson();
    const cls = await adminCreateClass(admin, courseId);
    await app.inject({
      method: 'POST',
      url: `/api/admin/classes/${cls.id}/members`,
      headers: authHeader(admin),
      payload: { userId: stu.userId, role: 'student' },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/classes/${cls.id}/members/${stu.userId}`,
      headers: authHeader(admin),
    });
    expect(res.statusCode).toBe(200);

    const logs = await prisma.auditLog.findMany({
      where: { action: 'class.member.remove' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0]!.adminId).toBe(admin.userId);
    expect(logs[0]!.before).toMatchObject({
      classId: cls.id,
      userId: stu.userId,
      role: 'student',
      wasActive: true,
    });
  });

  it('学员自助 join（student 路由）→ 不写 AuditLog', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    const { courseId } = await seedCourseLesson();
    const cls = await adminCreateClass(admin, courseId);
    // 清掉 admin 建班产生的 log
    await prisma.auditLog.deleteMany({});

    const res = await app.inject({
      method: 'POST',
      url: '/api/classes/join',
      headers: authHeader(stu),
      payload: { joinCode: cls.joinCode },
    });
    expect(res.statusCode).toBeLessThan(400);

    const logs = await prisma.auditLog.findMany({});
    expect(logs.length).toBe(0);
  });
});
