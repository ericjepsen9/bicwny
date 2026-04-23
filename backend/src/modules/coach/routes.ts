// 辅导员端学员统计路由
//   GET /api/coach/classes/:id/stats           班级聚合面板
//   GET /api/coach/classes/:id/students/:uid   单学员学修详情
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import {
  assertIsCoachOfClass,
  assertMemberOfClass,
  getClass,
} from '../class/service.js';
import { classStats } from './stats.service.js';
import { studentDetail } from './student.service.js';

const coachGuard = requireRole('coach', 'admin');

const classIdParam = z.object({ id: z.string().min(1) });
const classStudentParams = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
});
const statsQuery = z.object({
  windowDays: z.coerce.number().int().min(1).max(90).optional(),
});
const studentQuery = z.object({
  recentLimit: z.coerce.number().int().min(1).max(200).optional(),
});

async function requireCoachOnClass(
  req: FastifyRequest,
  classId: string,
): Promise<void> {
  if (getUserRole(req) === 'admin') return;
  await assertIsCoachOfClass(requireUserId(req), classId);
}

const TAGS = ['Coach'];
const SEC = [{ bearerAuth: [] as string[] }];

export const coachStatsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/coach/classes/:id/stats',
    {
      preHandler: coachGuard,
      schema: { tags: TAGS, summary: '班级聚合统计（成员 / 活跃 / 正确率 / 本周答题）', security: SEC },
    },
    async (req) => {
      const pp = classIdParam.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pq = statsQuery.safeParse(req.query);
      if (!pq.success) throw BadRequest('查询参数不合法');
      await requireCoachOnClass(req, pp.data.id);
      await getClass(pp.data.id);
      const stats = await classStats(pp.data.id, pq.data.windowDays);
      return { data: stats };
    },
  );

  app.get(
    '/api/coach/classes/:id/students/:uid',
    {
      preHandler: coachGuard,
      schema: { tags: TAGS, summary: '单学员学修详情（本班 coach 限访）', security: SEC },
    },
    async (req) => {
      const pp = classStudentParams.safeParse(req.params);
      if (!pp.success) throw BadRequest('路径参数不合法');
      const pq = studentQuery.safeParse(req.query);
      if (!pq.success) throw BadRequest('查询参数不合法');
      await requireCoachOnClass(req, pp.data.id);
      // 二次校验：学员必须属于该班，避免 coach 跨班看人
      await assertMemberOfClass(pp.data.id, pp.data.uid);
      const detail = await studentDetail(pp.data.uid, {
        recentLimit: pq.data.recentLimit,
      });
      return { data: detail };
    },
  );
};
