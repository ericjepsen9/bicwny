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

  it('学员先后 join 两个班级（同 course）→ enrollment 保留首班指针', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    const { courseId } = await seedCourseLesson();
    const clsA = await adminCreateClass(admin, courseId, 'A 班');
    const clsB = await adminCreateClass(admin, courseId, 'B 班');

    // join A
    await app.inject({
      method: 'POST',
      url: '/api/classes/join',
      headers: authHeader(stu),
      payload: { joinCode: clsA.joinCode },
    });
    // join B
    await app.inject({
      method: 'POST',
      url: '/api/classes/join',
      headers: authHeader(stu),
      payload: { joinCode: clsB.joinCode },
    });

    const enr = await prisma.userCourseEnrollment.findUnique({
      where: { userId_courseId: { userId: stu.userId, courseId } },
    });
    // 应保留 A 班指针，不被 B 班覆盖
    expect(enr!.source).toBe('class');
    expect(enr!.enrolledViaClassId).toBe(clsA.id);
  });

  it('removeMember · 用户在另一班还有同 course → enrollment 转向另一班', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    const { courseId } = await seedCourseLesson();
    const clsA = await adminCreateClass(admin, courseId, 'A 班');
    const clsB = await adminCreateClass(admin, courseId, 'B 班');

    // 先 join A 再 join B
    await app.inject({
      method: 'POST',
      url: '/api/classes/join',
      headers: authHeader(stu),
      payload: { joinCode: clsA.joinCode },
    });
    await app.inject({
      method: 'POST',
      url: '/api/classes/join',
      headers: authHeader(stu),
      payload: { joinCode: clsB.joinCode },
    });

    // admin 把学员从 A 班移除
    await app.inject({
      method: 'DELETE',
      url: `/api/admin/classes/${clsA.id}/members/${stu.userId}`,
      headers: authHeader(admin),
    });

    const enr = await prisma.userCourseEnrollment.findUnique({
      where: { userId_courseId: { userId: stu.userId, courseId } },
    });
    // enrollment 仍存在，指针转向 B 班
    expect(enr).not.toBeNull();
    expect(enr!.enrolledViaClassId).toBe(clsB.id);
    expect(enr!.source).toBe('class');
  });

  it('removeMember 批量场景 · 多 course / 多 fallback / 多 delete 一次性处理', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    const c1 = (await seedCourseLesson()).courseId;
    const c2 = (await seedCourseLesson()).courseId;
    const c3 = (await seedCourseLesson()).courseId;
    // tA(c1) tB(c2) tC(c3) 各覆盖一门法本 · fallbackC1 给 c1 留个备胎
    const tA = await adminCreateClass(admin, c1, 'tA');
    const tB = await adminCreateClass(admin, c2, 'tB');
    const tC = await adminCreateClass(admin, c3, 'tC');
    const fallbackC1 = await adminCreateClass(admin, c1, 'fallbackC1');

    for (const cls of [tA, tB, tC, fallbackC1]) {
      await app.inject({
        method: 'POST',
        url: '/api/classes/join',
        headers: authHeader(stu),
        payload: { joinCode: cls.joinCode },
      });
    }
    // join 顺序：tA 抢到 c1 enrollment.viaClassId · 后续 fallbackC1 join 时保留指向 tA

    // 删 tA 班：c1 应转向 fallbackC1
    await app.inject({
      method: 'DELETE',
      url: `/api/admin/classes/${tA.id}/members/${stu.userId}`,
      headers: authHeader(admin),
    });
    const enr1 = await prisma.userCourseEnrollment.findUnique({
      where: { userId_courseId: { userId: stu.userId, courseId: c1 } },
    });
    expect(enr1!.enrolledViaClassId).toBe(fallbackC1.id);

    // 删 tB 班：c2 无 fallback → 删 enrollment
    await app.inject({
      method: 'DELETE',
      url: `/api/admin/classes/${tB.id}/members/${stu.userId}`,
      headers: authHeader(admin),
    });
    const enr2 = await prisma.userCourseEnrollment.findUnique({
      where: { userId_courseId: { userId: stu.userId, courseId: c2 } },
    });
    expect(enr2).toBeNull();

    // tC 仍存在
    const enr3 = await prisma.userCourseEnrollment.findUnique({
      where: { userId_courseId: { userId: stu.userId, courseId: c3 } },
    });
    expect(enr3).not.toBeNull();
    expect(enr3!.enrolledViaClassId).toBe(tC.id);
  });

  it('removeMember · 用户唯一来源是当前班 → enrollment 删除', async () => {
    const admin = await registerAs(app, 'admin');
    const stu = await registerAs(app, 'student');
    const { courseId } = await seedCourseLesson();
    const cls = await adminCreateClass(admin, courseId);

    await app.inject({
      method: 'POST',
      url: '/api/classes/join',
      headers: authHeader(stu),
      payload: { joinCode: cls.joinCode },
    });
    await app.inject({
      method: 'DELETE',
      url: `/api/admin/classes/${cls.id}/members/${stu.userId}`,
      headers: authHeader(admin),
    });

    const enr = await prisma.userCourseEnrollment.findUnique({
      where: { userId_courseId: { userId: stu.userId, courseId } },
    });
    expect(enr).toBeNull();
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
