// 辅导员端学员统计路由
//   GET /api/coach/classes/:id/stats           班级聚合面板
//   GET /api/coach/classes/:id/students/:uid   单学员学修详情
//   GET /api/coach/llm-calls                   自己最近的 LLM 调用日志（CO8）
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, Forbidden } from '../../lib/errors.js';
import {
  assertIsCoachOfClass,
  assertMemberOfClass,
  getClass,
} from '../class/service.js';
import { prisma } from '../../lib/prisma.js';
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

/** coach 不能访问已归档班级（admin 仍可看历史）· 防归档后数据继续被 coach 拉取 */
async function assertClassActiveForCoach(
  req: FastifyRequest,
  classId: string,
): Promise<void> {
  if (getUserRole(req) === 'admin') return;
  const cls = await getClass(classId);
  if (!cls.isActive) {
    throw Forbidden('班级已归档，coach 仅 admin 可查看历史');
  }
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
      await assertClassActiveForCoach(req, pp.data.id);
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
      await assertClassActiveForCoach(req, pp.data.id);
      // 二次校验：学员必须属于该班，避免 coach 跨班看人
      await assertMemberOfClass(pp.data.id, pp.data.uid);
      const detail = await studentDetail(pp.data.uid, pp.data.id, {
        recentLimit: pq.data.recentLimit,
      });
      return { data: detail };
    },
  );

  // CO8: coach 自助 LLM 调用日志
  //   只返回 coachId === requireUserId(req) 的记录 · 任何 coach / admin 角色都可访问
  //   admin 可看自己作为 coach 创建的题（不能跨用户）· 跨用户审计走 admin-llm 后台
  //   字段：基础诊断信息（不含原文），含 promptHash 用于追溯
  app.get(
    '/api/coach/llm-calls',
    {
      preHandler: coachGuard,
      schema: { tags: ['Coach'], summary: '自己最近的 LLM 调用日志', security: [{ bearerAuth: [] as string[] }] },
    },
    async (req) => {
      const userId = requireUserId(req);
      const q = z
        .object({ limit: z.coerce.number().int().min(1).max(200).optional() })
        .safeParse(req.query);
      if (!q.success) throw BadRequest('查询参数不合法');
      const items = await prisma.llmCallLog.findMany({
        where: { coachId: userId },
        orderBy: { timestamp: 'desc' },
        take: q.data.limit ?? 50,
        select: {
          requestId: true,
          scenario: true,
          providerUsed: true,
          providerTried: true,
          switched: true,
          switchReason: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          cost: true,
          latencyMs: true,
          success: true,
          errorMessage: true,
          promptHash: true,
          timestamp: true,
        },
      });
      return { data: items };
    },
  );
};
