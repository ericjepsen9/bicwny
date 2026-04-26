// 学员加入 / 退出班级路由（任意已登录用户均可调用）
//   POST /api/classes/join       { joinCode }  加入班级（默认 role=student）
//   POST /api/classes/:id/leave                退出（软删 removedAt）
//   GET  /api/my/classes                        我加入的班级列表
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  addMember,
  findClassByCode,
  listUserClasses,
  removeMember,
} from './service.js';

const joinBody = z.object({
  joinCode: z.string().min(1).max(20),
});
const idParam = z.object({ id: z.string().min(1) });

const TAGS = ['Classes'];
const SEC = [{ bearerAuth: [] as string[] }];

export const studentClassRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/classes/join', {
    schema: { tags: TAGS, summary: '凭加入码加入班级', security: SEC },
  }, async (req, reply) => {
    const userId = requireUserId(req);
    const parsed = joinBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    // 加入码大小写不敏感
    const code = parsed.data.joinCode.toUpperCase().trim();
    const cls = await findClassByCode(code);
    // preserveExistingRole：若本人已是该班 coach，加入不会降级
    const member = await addMember(cls.id, userId, 'student', {
      preserveExistingRole: true,
    });
    // 自动报名班级主修法本（upsert 幂等）
    // 已 self 报名 → 升级为 'class' 源（用户失去退课权但可保留进度）
    // 已 class 源（来自其他班级）→ 不动 source · 仍指向最早绑定的班级
    await prisma.userCourseEnrollment.upsert({
      where: { userId_courseId: { userId, courseId: cls.courseId } },
      create: {
        userId, courseId: cls.courseId,
        source: 'class', enrolledViaClassId: cls.id,
      },
      update: {
        // 仅在原 source=self 时升级为 class · 其他班级源保持不动
        source: 'class',
        enrolledViaClassId: cls.id,
      },
    });
    // 返回时附 course 让前端可立刻提示"已加入 XXX 法本"
    const course = await prisma.course.findUnique({
      where: { id: cls.courseId },
      select: { id: true, slug: true, title: true, titleTraditional: true, coverEmoji: true },
    });
    reply.code(201);
    return { data: { class: { ...cls, course }, member } };
  });

  app.post('/api/classes/:id/leave', {
    schema: { tags: TAGS, summary: '退出班级（软删除 removedAt）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    await removeMember(parsed.data.id, userId);
    return { data: { ok: true } };
  });

  app.get('/api/my/classes', {
    schema: { tags: TAGS, summary: '我加入的班级', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const items = await listUserClasses(userId);
    return { data: items };
  });
};
