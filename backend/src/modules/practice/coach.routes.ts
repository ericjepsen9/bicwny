// 修学计数 · 教师路由
//   POST   /api/coach/classes/:id/practice-projects        班级专修加子项
//   PATCH  /api/coach/classes/:id/practice-projects/:pid   改子项 / 归档
//   POST   /api/coach/classes/:id/practice-tasks           下达班级任务
//   PATCH  /api/coach/classes/:id/practice-tasks/:tid      改任务 / 归档
//   GET    /api/coach/classes/:id/practice-ranking         班级排行（周/月/累计）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserRole, requireRole, requireUserId } from '../../lib/auth.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { dispatchToUsers } from '../scheduler/dispatch.js';
import { dateKey, lastNDates } from './utils.js';

const TAGS = ['Coach'];
const SEC = [{ bearerAuth: [] as string[] }];
const coachGuard = requireRole('coach', 'admin');

/**
 * 班级任务创建后给所有 active 学员发通知
 * spec §3.3 PracticeTask · created tier · severity normal
 */
async function notifyClassPracticeTask(classId: string, taskId: string, taskTitle: string): Promise<void> {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!cls) return;
  const members = await prisma.classMember.findMany({
    where: { classId, removedAt: null, role: 'student' },
    select: { userId: true },
  });
  if (members.length === 0) return;
  await dispatchToUsers({
    prisma,
    eventKind: 'practice_task',
    eventId: taskId,
    tier: 'created',
    userIds: members.map((m) => m.userId),
    title: `《${cls.name}》新任务`,
    body: taskTitle,
    link: `/class/${classId}`,  // 跳班级首页 · 上下文完整（含修学任务卡）
    notificationType: 'reminder',
    severity: 'normal',
  });
}

const idParam = z.object({ id: z.string().min(1) });
const idAndPidParam = z.object({ id: z.string().min(1), pid: z.string().min(1) });
const idAndTidParam = z.object({ id: z.string().min(1), tid: z.string().min(1) });

const projectCreateBody = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().max(8).optional(),
});
const projectPatchBody = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  emoji: z.string().max(8).nullable().optional(),
  archive: z.boolean().optional(),
});

const taskCreateBody = z.object({
  projectId: z.string().min(1),
  mode: z.enum(['daily', 'fixed']),
  target: z.number().int().min(1).max(10_000_000),
  startAt: z.string().datetime().or(z.date()).transform((v) => new Date(v)),
  endAt: z.string().datetime().or(z.date()).nullable().optional().transform((v) => v ? new Date(v) : null),
  title: z.string().max(120).optional(),
});
const taskPatchBody = z.object({
  archive: z.boolean().optional(),
  title: z.string().max(120).optional(),
  target: z.number().int().min(1).max(10_000_000).optional(),
  endAt: z.string().datetime().or(z.date()).nullable().optional().transform((v) => v == null ? v : new Date(v)),
});

// 检查 coach 是该班的 coach（admin 超权放行）
async function assertClassCoach(classId: string, userId: string, role: string) {
  if (role === 'admin') return;
  const m = await prisma.classMember.findFirst({
    where: { classId, userId, role: 'coach', removedAt: null },
  });
  if (!m) throw Forbidden('非该班 coach');
}

export const practiceCoachRoutes: FastifyPluginAsync = async (app) => {
  // 班级专修 · 列表（已通过现有 student/projects 接口可拿 · 这里给 admin 后台按班看用）
  app.get('/api/coach/classes/:id/practice-projects', {
    preHandler: coachGuard,
    schema: { tags: TAGS, summary: '班级专修子项列表', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    await assertClassCoach(pp.data.id, requireUserId(req), getUserRole(req) ?? '');
    const data = await prisma.practiceProject.findMany({
      where: { scope: 'class', classId: pp.data.id },
      include: { category: { select: { id: true, key: true, name: true, emoji: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  });

  app.post('/api/coach/classes/:id/practice-projects', {
    preHandler: coachGuard,
    schema: { tags: TAGS, summary: '班级加专修子项', security: SEC },
  }, async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = projectCreateBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const userId = requireUserId(req);
    await assertClassCoach(pp.data.id, userId, getUserRole(req) ?? '');

    const cat = await prisma.practiceCategory.findUnique({ where: { id: body.data.categoryId } });
    if (!cat) throw NotFound('大类不存在');
    const dup = await prisma.practiceProject.findFirst({
      where: { scope: 'class', classId: pp.data.id, categoryId: body.data.categoryId, name: body.data.name.trim(), archivedAt: null },
    });
    if (dup) throw BadRequest(`该班已有同名子项「${body.data.name}」`);

    const data = await prisma.practiceProject.create({
      data: {
        categoryId: body.data.categoryId,
        name: body.data.name.trim(),
        emoji: body.data.emoji?.trim() || null,
        scope: 'class',
        classId: pp.data.id,
        ownerId: userId,  // 用 coach userId 标记建者
      },
    });
    reply.code(201);
    return { data };
  });

  app.patch('/api/coach/classes/:id/practice-projects/:pid', {
    preHandler: coachGuard,
    schema: { tags: TAGS, summary: '改 / 归档班级专修子项', security: SEC },
  }, async (req) => {
    const pp = idAndPidParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = projectPatchBody.safeParse(req.body);
    if (!body.success) throw BadRequest('请求参数不合法');
    await assertClassCoach(pp.data.id, requireUserId(req), getUserRole(req) ?? '');

    const proj = await prisma.practiceProject.findUnique({ where: { id: pp.data.pid } });
    if (!proj || proj.scope !== 'class' || proj.classId !== pp.data.id) throw NotFound('子项不存在');

    const data = await prisma.practiceProject.update({
      where: { id: pp.data.pid },
      data: {
        name: body.data.name?.trim() || undefined,
        emoji: body.data.emoji === null ? null : (body.data.emoji?.trim() || undefined),
        archivedAt: body.data.archive ? new Date() : undefined,
      },
    });
    return { data };
  });

  // 班级任务
  app.get('/api/coach/classes/:id/practice-tasks', {
    preHandler: coachGuard,
    schema: { tags: TAGS, summary: '班级任务列表', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    await assertClassCoach(pp.data.id, requireUserId(req), getUserRole(req) ?? '');
    const data = await prisma.practiceTask.findMany({
      where: { scope: 'class', classId: pp.data.id },
      include: { project: { select: { id: true, name: true, emoji: true, categoryId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  });

  app.post('/api/coach/classes/:id/practice-tasks', {
    preHandler: coachGuard,
    schema: { tags: TAGS, summary: '下达班级任务', security: SEC },
  }, async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = taskCreateBody.safeParse(req.body);
    if (!body.success) throw BadRequest('参数不合法', body.error.flatten());
    const userId = requireUserId(req);
    await assertClassCoach(pp.data.id, userId, getUserRole(req) ?? '');

    // projectId 必须是该班可用（class scope of this class · 或平台预置）
    const proj = await prisma.practiceProject.findUnique({ where: { id: body.data.projectId } });
    if (!proj) throw NotFound('子项不存在');
    if (proj.scope === 'class' && proj.classId !== pp.data.id) throw BadRequest('子项不属于本班');
    if (proj.scope === 'user' && !proj.isBuiltin) throw BadRequest('班级任务子项必须为班级专修或平台预置');

    if (body.data.mode === 'fixed' && !body.data.endAt) throw BadRequest('fixed 模式需 endAt');

    const data = await prisma.practiceTask.create({
      data: {
        scope: 'class',
        mode: body.data.mode,
        ownerId: userId,
        classId: pp.data.id,
        projectId: body.data.projectId,
        title: body.data.title?.trim() || null,
        target: body.data.target,
        startAt: body.data.startAt,
        endAt: body.data.endAt ?? null,
      },
    });

    // fire-and-forget · 通知班级所有 active 学员（spec §3.3 PracticeTask created tier）
    notifyClassPracticeTask(pp.data.id, data.id, body.data.title?.trim() || proj.name).catch((e) => {
      console.error('[practice-task] notify failed:', e);
    });

    reply.code(201);
    return { data };
  });

  app.patch('/api/coach/classes/:id/practice-tasks/:tid', {
    preHandler: coachGuard,
    schema: { tags: TAGS, summary: '改 / 归档班级任务', security: SEC },
  }, async (req) => {
    const pp = idAndTidParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const body = taskPatchBody.safeParse(req.body);
    if (!body.success) throw BadRequest('请求参数不合法');
    await assertClassCoach(pp.data.id, requireUserId(req), getUserRole(req) ?? '');
    const t = await prisma.practiceTask.findUnique({ where: { id: pp.data.tid } });
    if (!t || t.scope !== 'class' || t.classId !== pp.data.id) throw NotFound('任务不存在');
    const data = await prisma.practiceTask.update({
      where: { id: pp.data.tid },
      data: {
        title: body.data.title?.trim(),
        target: body.data.target,
        endAt: body.data.endAt,
        archivedAt: body.data.archive ? new Date() : undefined,
      },
    });
    return { data };
  });

  // 班级排行（周 / 月 / all）· 仅活跃成员 + practiceVisibleToClass=true
  app.get('/api/coach/classes/:id/practice-ranking', {
    preHandler: coachGuard,
    schema: { tags: TAGS, summary: '班级排行（按累计降序）', security: SEC },
  }, async (req) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) throw BadRequest('路径参数不合法');
    const q = z.object({
      period: z.enum(['week', 'month', 'all']).optional(),
      categoryKey: z.string().optional(),  // 仅看某大类
    }).safeParse(req.query);
    if (!q.success) throw BadRequest('查询参数不合法');
    await assertClassCoach(pp.data.id, requireUserId(req), getUserRole(req) ?? '');

    const period = q.data.period ?? 'week';
    const dateRange = period === 'week' ? lastNDates(7)
      : period === 'month' ? lastNDates(30)
      : null;

    // 班级活跃成员（公开计数的）
    const members = await prisma.classMember.findMany({
      where: { classId: pp.data.id, removedAt: null, user: { practiceVisibleToClass: true } },
      include: { user: { select: { id: true, dharmaName: true, avatar: true } } },
    });
    if (members.length === 0) return { data: [] };
    const userIds = members.map((m) => m.userId);

    let categoryFilter: string | undefined;
    if (q.data.categoryKey) {
      const cat = await prisma.practiceCategory.findUnique({ where: { key: q.data.categoryKey } });
      categoryFilter = cat?.id;
    }

    const rows = await prisma.practiceDailySummary.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        ...(dateRange ? { date: { in: dateRange } } : {}),
        ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      },
      _sum: { count: true },
    });
    const sumMap = new Map(rows.map((r) => [r.userId, r._sum.count ?? 0]));

    const data = members.map((m) => ({
      userId: m.userId,
      dharmaName: m.user.dharmaName,
      avatar: m.user.avatar,
      total: sumMap.get(m.userId) ?? 0,
    })).sort((a, b) => b.total - a.total);
    return { data };
  });
};
