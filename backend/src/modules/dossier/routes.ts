// 学修档案 routes
//   GET /api/me/stats                                       学员看自己
//   GET /api/admin/users/:uid/stats                         admin 看任意学员
//   GET /api/coach/classes/:id/students/:uid/stats          coach 看本班学员（校验 ClassMember）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { dashboardToCsv, getClassDashboard } from './dashboard.service.js';
import { getDossierStats } from './service.js';

const TAGS = ['Dossier'];
const SEC = [{ bearerAuth: [] as string[] }];

const idParam = z.object({ id: z.string().min(1) });
const uidParam = z.object({ uid: z.string().min(1) });
const idAndUidParam = z.object({ id: z.string().min(1), uid: z.string().min(1) });

export const dossierRoutes: FastifyPluginAsync = async (app) => {
  // 学员自己
  app.get('/api/me/stats', {
    schema: { tags: TAGS, summary: '我的学修档案（4 维度聚合）', security: SEC },
  }, async (req) => {
    const data = await getDossierStats(prisma, requireUserId(req));
    return { data };
  });

  // admin 看任意
  app.get('/api/admin/users/:uid/stats', {
    preHandler: requireRole('admin'),
    schema: { tags: TAGS, summary: 'admin 看任意学员的学修档案', security: SEC },
  }, async (req) => {
    const pp = uidParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const u = await prisma.user.findUnique({ where: { id: pp.data.uid }, select: { id: true } });
    if (!u) throw NotFound('用户不存在');
    const data = await getDossierStats(prisma, pp.data.uid);
    return { data };
  });

  // 班级 dashboard · 所有学员对比表
  app.get('/api/coach/classes/:id/dashboard', {
    preHandler: requireRole('coach', 'admin'),
    schema: { tags: TAGS, summary: '班级所有学员核心进度对比表', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const actorId = requireUserId(req);
    const role = getUserRole(req);
    if (role !== 'admin') {
      const m = await prisma.classMember.findFirst({
        where: { classId: pp.data.id, userId: actorId, role: 'coach', removedAt: null },
      });
      if (!m) throw Forbidden('非该班 coach');
    }
    const data = await getClassDashboard(prisma, pp.data.id);
    return { data };
  });

  // CSV 导出
  app.get('/api/coach/classes/:id/dashboard.csv', {
    preHandler: requireRole('coach', 'admin'),
    schema: { tags: TAGS, summary: '班级 dashboard CSV 导出', security: SEC },
  }, async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const actorId = requireUserId(req);
    const role = getUserRole(req);
    if (role !== 'admin') {
      const m = await prisma.classMember.findFirst({
        where: { classId: pp.data.id, userId: actorId, role: 'coach', removedAt: null },
      });
      if (!m) throw Forbidden('非该班 coach');
    }
    const cls = await prisma.class.findUnique({ where: { id: pp.data.id }, select: { name: true } });
    const { taskCount, rows } = await getClassDashboard(prisma, pp.data.id);
    const csv = dashboardToCsv(taskCount, rows);
    const fname = encodeURIComponent(`${cls?.name ?? '班级'}-学修档案-${new Date().toISOString().slice(0, 10)}.csv`);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename*=UTF-8''${fname}`);
    return csv;
  });

  // coach 看本班学员（admin 超权放行）
  app.get('/api/coach/classes/:id/students/:uid/stats', {
    preHandler: requireRole('coach', 'admin'),
    schema: { tags: TAGS, summary: 'coach 看本班学员的学修档案', security: SEC },
  }, async (req) => {
    const pp = idAndUidParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const actorId = requireUserId(req);
    const role = getUserRole(req);
    // admin 跳过班级校验 · coach 必须是该班 coach
    if (role !== 'admin') {
      const m = await prisma.classMember.findFirst({
        where: { classId: pp.data.id, userId: actorId, role: 'coach', removedAt: null },
      });
      if (!m) throw Forbidden('非该班 coach');
    }
    // 学员必须是该班成员
    const target = await prisma.classMember.findFirst({
      where: { classId: pp.data.id, userId: pp.data.uid, removedAt: null },
    });
    if (!target) throw NotFound('学员不在该班');
    const data = await getDossierStats(prisma, pp.data.uid);
    return { data };
  });
};
