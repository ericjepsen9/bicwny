// Coach 班级路由（coach 或 admin 角色）
//   GET /api/coach/classes               我负责的班级
//   GET /api/coach/classes/:id/members   班级成员（需本人是该班 coach；admin 放行）
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  assertIsCoachOfClass,
  getClass,
  listMembers,
  listUserClasses,
} from './service.js';

const coachGuard = requireRole('coach', 'admin');
const idParam = z.object({ id: z.string().min(1) });

/** coach 必须是该班 coach；admin 全放行 */
async function requireClassCoachAccess(
  req: FastifyRequest,
  classId: string,
): Promise<string> {
  const userId = requireUserId(req);
  if (getUserRole(req) === 'admin') return userId;
  await assertIsCoachOfClass(userId, classId);
  return userId;
}

const TAGS = ['Coach'];
const SEC = [{ bearerAuth: [] as string[] }];

export const coachClassRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/coach/classes', {
    preHandler: coachGuard,
    schema: { tags: TAGS, summary: '我负责的班级', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const items = await listUserClasses(userId, 'coach');
    return { data: items };
  });

  app.get(
    '/api/coach/classes/:id/members',
    {
      preHandler: coachGuard,
      schema: { tags: TAGS, summary: '班级成员（仅本班 coach / admin）', security: SEC },
    },
    async (req) => {
      const parsed = idParam.safeParse(req.params);
      if (!parsed.success) throw BadRequest('路径参数不合法');
      await requireClassCoachAccess(req, parsed.data.id);
      await getClass(parsed.data.id);
      const members = await listMembers(parsed.data.id);
      return { data: members };
    },
  );
};
