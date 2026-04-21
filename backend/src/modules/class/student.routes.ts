// 学员加入 / 退出班级路由（任意已登录用户均可调用）
//   POST /api/classes/join       { joinCode }  加入班级（默认 role=student）
//   POST /api/classes/:id/leave                退出（软删 removedAt）
//   GET  /api/my/classes                        我加入的班级列表
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
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

export const studentClassRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/classes/join', async (req, reply) => {
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
    reply.code(201);
    return { data: { class: cls, member } };
  });

  app.post('/api/classes/:id/leave', async (req) => {
    const userId = requireUserId(req);
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    await removeMember(parsed.data.id, userId);
    return { data: { ok: true } };
  });

  app.get('/api/my/classes', async (req) => {
    const userId = requireUserId(req);
    const items = await listUserClasses(userId);
    return { data: items };
  });
};
