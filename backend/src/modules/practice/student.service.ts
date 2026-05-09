// 修学计数 · 学员服务
//   - 列大类 / 子项（合并三来源：平台预置 + 班级专修 + 自建）
//   - 创建 / 改名 / 归档自建子项
//   - 上报 entry 批次（写明细 + upsert daily summary）
//   - 总汇 / 历史聚合 / streak
//   - 目标 / 任务 CRUD（学员视角）
import type { PrismaClient } from '@prisma/client';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { calcStreak, dateKey, lastNDates } from './utils.js';

interface BatchEntryItem {
  projectId: string;
  count: number;       // 单次 ≥ 1（+1 / +10 / 摇一摇 / 批量上报）
  source?: string;     // 'tap' | 'shake' | 'bulk'
  date?: string;       // YYYY-MM-DD 回填历史日期（默认今天 · 不能未来 · 仅 bulk 用）
  note?: string;       // 备注（≤ 50 字 · 仅 bulk 用）
}

export async function listCategories(prisma: PrismaClient) {
  // 「观修」大类已隐藏（用户决定 · 观修单独走观修模块 · 不混进学修计数）
  // 数据保留 · UI 不返回
  return prisma.practiceCategory.findMany({
    where: { key: { not: 'meditation' } },
    orderBy: { displayOrder: 'asc' },
  });
}

/**
 * 列学员可见的所有子项 · 含三来源
 *   - 平台预置：scope=user · ownerId=null · isBuiltin=true
 *   - 班级专修：scope=class · classId IN (我活跃的班)
 *   - 我自建：scope=user · ownerId=me · isBuiltin=false
 * 含每个子项的累计 + 今日数（从 daily summary 聚合）· 已归档不返回
 */
export async function listProjects(prisma: PrismaClient, userId: string) {
  // 我活跃的班级
  const myClasses = await prisma.classMember.findMany({
    where: { userId, removedAt: null },
    select: { classId: true },
  });
  const classIds = myClasses.map((m) => m.classId);

  // 「观修」大类已隐藏 · 拿到隐藏大类 ID 列表用作过滤
  const hiddenCats = await prisma.practiceCategory.findMany({
    where: { key: 'meditation' },
    select: { id: true },
  });
  const hiddenCatIds = hiddenCats.map((c) => c.id);

  const projects = await prisma.practiceProject.findMany({
    where: {
      archivedAt: null,
      ...(hiddenCatIds.length > 0 ? { categoryId: { notIn: hiddenCatIds } } : {}),
      OR: [
        { scope: 'user', ownerId: null, isBuiltin: true },         // 平台预置
        { scope: 'user', ownerId: userId },                         // 我自建
        { scope: 'class', classId: { in: classIds } },             // 班级专修
      ],
    },
    orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
    include: { class: { select: { id: true, name: true } } },
  });

  // 各项目累计 + 今日（一次聚合 · 避免 N+1）
  const projectIds = projects.map((p) => p.id);
  const today = dateKey();

  const [allTimeRows, todayRows] = await Promise.all([
    prisma.practiceDailySummary.groupBy({
      by: ['projectId'],
      where: { userId, projectId: { in: projectIds } },
      _sum: { count: true },
    }),
    prisma.practiceDailySummary.findMany({
      where: { userId, projectId: { in: projectIds }, date: today },
      select: { projectId: true, count: true },
    }),
  ]);
  const allTimeMap = new Map(allTimeRows.map((r) => [r.projectId, r._sum.count ?? 0]));
  const todayMap = new Map(todayRows.map((r) => [r.projectId, r.count]));

  return projects.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    emoji: p.emoji,
    scope: p.scope,
    classId: p.classId,
    className: p.class?.name ?? null,
    ownerId: p.ownerId,
    isBuiltin: p.isBuiltin,
    isMine: p.scope === 'user' && p.ownerId === userId,
    totalCount: allTimeMap.get(p.id) ?? 0,
    todayCount: todayMap.get(p.id) ?? 0,
  }));
}

export async function createUserProject(
  prisma: PrismaClient,
  userId: string,
  data: { categoryId: string; name: string; emoji?: string },
) {
  const cat = await prisma.practiceCategory.findUnique({ where: { id: data.categoryId } });
  if (!cat) throw NotFound('大类不存在');
  // 检查是否已有同名（不论 scope）· 提示用户
  const dup = await prisma.practiceProject.findFirst({
    where: {
      categoryId: data.categoryId,
      name: data.name.trim(),
      archivedAt: null,
      OR: [
        { scope: 'user', ownerId: null, isBuiltin: true },
        { scope: 'user', ownerId: userId },
      ],
    },
  });
  if (dup) throw BadRequest(`已有同名子项「${data.name}」`);

  return prisma.practiceProject.create({
    data: {
      categoryId: data.categoryId,
      name: data.name.trim(),
      emoji: data.emoji?.trim() || null,
      scope: 'user',
      ownerId: userId,
      isBuiltin: false,
    },
  });
}

export async function updateUserProject(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
  patch: { name?: string; emoji?: string | null },
) {
  const p = await prisma.practiceProject.findUnique({ where: { id: projectId } });
  if (!p) throw NotFound('子项不存在');
  if (p.scope !== 'user' || p.ownerId !== userId) {
    throw Forbidden('只能改自己创建的子项');
  }
  return prisma.practiceProject.update({
    where: { id: projectId },
    data: {
      name: patch.name?.trim() || undefined,
      emoji: patch.emoji === null ? null : (patch.emoji?.trim() || undefined),
    },
  });
}

export async function archiveUserProject(prisma: PrismaClient, userId: string, projectId: string) {
  const p = await prisma.practiceProject.findUnique({ where: { id: projectId } });
  if (!p) throw NotFound('子项不存在');
  if (p.scope !== 'user' || p.ownerId !== userId) throw Forbidden('只能归档自己创建的子项');
  return prisma.practiceProject.update({
    where: { id: projectId },
    data: { archivedAt: new Date() },
  });
}

/**
 * 上报 entry 批次（30s batching · 客户端聚合）
 * 同事务：写每条 entry + 按 (projectId, dateKey) 聚合 upsert daily summary
 */
export async function submitEntries(
  prisma: PrismaClient,
  userId: string,
  items: BatchEntryItem[],
) {
  if (items.length === 0) throw BadRequest('items 为空');
  if (items.length > 200) throw BadRequest('单次 ≤ 200 条');

  // 验证 projectId 都可见（防越权写他班 / 他人 project）
  const projectIds = [...new Set(items.map((i) => i.projectId))];
  const projects = await prisma.practiceProject.findMany({
    where: { id: { in: projectIds }, archivedAt: null },
    select: { id: true, categoryId: true, scope: true, ownerId: true, classId: true, isBuiltin: true },
  });
  if (projects.length !== projectIds.length) throw BadRequest('含未知 / 已归档子项');

  // 班级 project 需要学员是该班活跃成员
  const classProjectIds = projects.filter((p) => p.scope === 'class').map((p) => p.classId!);
  if (classProjectIds.length > 0) {
    const myMembers = await prisma.classMember.findMany({
      where: { userId, removedAt: null, classId: { in: classProjectIds } },
      select: { classId: true },
    });
    const myClassSet = new Set(myMembers.map((m) => m.classId));
    for (const p of projects) {
      if (p.scope === 'class' && p.classId && !myClassSet.has(p.classId)) {
        throw Forbidden('不在该班 · 不可计数班级专修');
      }
    }
  }

  // user 自建必须 ownerId === userId（平台预置 ownerId === null 跳过）
  for (const p of projects) {
    if (p.scope === 'user' && !p.isBuiltin && p.ownerId !== userId) {
      throw Forbidden('该子项不属于你');
    }
  }
  const projectMeta = new Map(projects.map((p) => [p.id, p]));

  // 按 (projectId, date) 聚合 · 支持用户回填历史日期
  const aggregateByDate = new Map<string, { projectId: string; categoryId: string; date: string; count: number }>();
  const today = dateKey();
  // 解析每个 item 的有效日期（默认今天 · 不能未来）
  function resolveDate(it: BatchEntryItem): string {
    if (!it.date) return today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date)) throw BadRequest('date 格式应为 YYYY-MM-DD');
    if (it.date > today) throw BadRequest('不能登记未来日期');
    return it.date;
  }
  for (const it of items) {
    if (!Number.isInteger(it.count) || it.count <= 0 || it.count > 10000) {
      throw BadRequest('count 无效');
    }
    if (it.note && it.note.length > 50) throw BadRequest('备注 ≤ 50 字');
    const m = projectMeta.get(it.projectId)!;
    const d = resolveDate(it);
    const key = `${it.projectId}|${d}`;
    const cur = aggregateByDate.get(key) ?? { projectId: it.projectId, categoryId: m.categoryId, date: d, count: 0 };
    cur.count += it.count;
    aggregateByDate.set(key, cur);
  }

  await prisma.$transaction(async (tx) => {
    // 写明细 · createdAt 用回填日期 UTC noon（避开 timezone 边界）
    await tx.practiceEntry.createMany({
      data: items.map((it) => {
        const m = projectMeta.get(it.projectId)!;
        const d = resolveDate(it);
        const createdAt = d === today ? new Date() : new Date(`${d}T12:00:00Z`);
        return {
          userId,
          categoryId: m.categoryId,
          projectId: it.projectId,
          count: it.count,
          source: it.source ?? 'tap',
          note: it.note?.trim() || null,
          createdAt,
        };
      }),
    });
    // upsert daily summary
    for (const agg of aggregateByDate.values()) {
      await tx.practiceDailySummary.upsert({
        where: { userId_projectId_date: { userId, projectId: agg.projectId, date: agg.date } },
        create: {
          userId,
          categoryId: agg.categoryId,
          projectId: agg.projectId,
          date: agg.date,
          count: agg.count,
        },
        update: { count: { increment: agg.count } },
      });
    }
  });
  return { ok: true, accepted: items.length };
}

export async function getSummary(prisma: PrismaClient, userId: string) {
  const today = dateKey();
  // 各大类今日 + 累计
  const [todayByCat, allByCat] = await Promise.all([
    prisma.practiceDailySummary.groupBy({
      by: ['categoryId'],
      where: { userId, date: today },
      _sum: { count: true },
    }),
    prisma.practiceDailySummary.groupBy({
      by: ['categoryId'],
      where: { userId },
      _sum: { count: true },
    }),
  ]);
  const cats = await prisma.practiceCategory.findMany({ orderBy: { displayOrder: 'asc' } });
  const todayMap = new Map(todayByCat.map((r) => [r.categoryId, r._sum.count ?? 0]));
  const allMap = new Map(allByCat.map((r) => [r.categoryId, r._sum.count ?? 0]));
  const streak = await calcStreak(prisma, userId);

  return {
    streak,
    today,
    categories: cats.map((c) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      emoji: c.emoji,
      todayCount: todayMap.get(c.id) ?? 0,
      totalCount: allMap.get(c.id) ?? 0,
    })),
  };
}

/**
 * 历史聚合
 *   range='week' | 'month' | 'year' | 'all'
 *   返回：dailySeries（最近 30 天）+ monthlySeries（最近 12 月）+ projectsSummary（按子项累计）
 */
export async function getHistory(prisma: PrismaClient, userId: string, opt: { projectId?: string }) {
  const dates30 = lastNDates(30);
  const where = opt.projectId ? { userId, projectId: opt.projectId } : { userId };

  const [dailyRows, allProjects] = await Promise.all([
    prisma.practiceDailySummary.findMany({
      where: { ...where, date: { in: dates30 } },
      select: { date: true, count: true, projectId: true, categoryId: true },
    }),
    prisma.practiceDailySummary.groupBy({
      by: ['projectId', 'categoryId'],
      where,
      _sum: { count: true },
    }),
  ]);

  // 按日聚合（不分 project · 总数）
  const dailyMap = new Map<string, number>();
  for (const r of dailyRows) {
    dailyMap.set(r.date, (dailyMap.get(r.date) ?? 0) + r.count);
  }
  const dailySeries = dates30.map((d) => ({ date: d, count: dailyMap.get(d) ?? 0 }));

  // 项目 / 大类汇总（含项目名）· 关联查 project 名
  const projectIds = [...new Set(allProjects.map((r) => r.projectId))];
  const projectMeta = projectIds.length === 0 ? [] : await prisma.practiceProject.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true, emoji: true, categoryId: true, scope: true },
  });
  const metaMap = new Map(projectMeta.map((p) => [p.id, p]));

  const projectsSummary = allProjects.map((r) => {
    const m = metaMap.get(r.projectId);
    return {
      projectId: r.projectId,
      projectName: m?.name ?? '',
      projectEmoji: m?.emoji ?? null,
      categoryId: r.categoryId,
      totalCount: r._sum.count ?? 0,
    };
  }).sort((a, b) => b.totalCount - a.totalCount);

  return { dailySeries, projectsSummary };
}

// ── 目标 ─────────────────────────────────────────
export async function listGoals(prisma: PrismaClient, userId: string) {
  return prisma.practiceGoal.findMany({
    where: { userId },
    include: { project: { select: { id: true, name: true, categoryId: true, emoji: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function upsertGoal(
  prisma: PrismaClient,
  userId: string,
  body: { projectId: string; dailyTarget: number },
) {
  if (body.dailyTarget < 0 || body.dailyTarget > 1_000_000) throw BadRequest('dailyTarget 越界');
  // 子项必须可见（防越权）
  const list = await listProjects(prisma, userId);
  if (!list.find((p) => p.id === body.projectId)) throw BadRequest('子项不可见');
  return prisma.practiceGoal.upsert({
    where: { userId_projectId: { userId, projectId: body.projectId } },
    create: { userId, projectId: body.projectId, dailyTarget: body.dailyTarget },
    update: { dailyTarget: body.dailyTarget },
  });
}

export async function deleteGoal(prisma: PrismaClient, userId: string, goalId: string) {
  const g = await prisma.practiceGoal.findUnique({ where: { id: goalId } });
  if (!g || g.userId !== userId) throw NotFound('目标不存在');
  await prisma.practiceGoal.delete({ where: { id: goalId } });
  return { ok: true };
}

// ── 任务 ─────────────────────────────────────────
export async function listTasks(prisma: PrismaClient, userId: string) {
  // 学员视角：自己创建的 self 任务 + 我所在班的 active class 任务
  const myClasses = await prisma.classMember.findMany({
    where: { userId, removedAt: null },
    select: { classId: true },
  });
  const classIds = myClasses.map((m) => m.classId);
  const tasks = await prisma.practiceTask.findMany({
    where: {
      archivedAt: null,
      OR: [
        { scope: 'self', userId },
        { scope: 'class', classId: { in: classIds } },
      ],
    },
    include: {
      project: { select: { id: true, name: true, emoji: true, categoryId: true } },
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ scope: 'asc' }, { createdAt: 'desc' }],
  });

  // 每个 task 的进度（学员自己的 daily summary 累计 between startAt and endAt）
  const out = await Promise.all(tasks.map(async (t) => {
    const startKey = dateKey(t.startAt);
    const endKey = t.endAt ? dateKey(t.endAt) : dateKey();
    const rows = await prisma.practiceDailySummary.findMany({
      where: {
        userId,
        projectId: t.projectId,
        date: { gte: startKey, lte: endKey },
      },
      select: { count: true },
    });
    const progress = rows.reduce((s, r) => s + r.count, 0);
    return {
      id: t.id,
      scope: t.scope,
      mode: t.mode,
      project: t.project,
      class: t.class,
      title: t.title,
      target: t.target,
      progress,
      startAt: t.startAt,
      endAt: t.endAt,
      isDone: progress >= t.target,
    };
  }));
  return out;
}

export async function createSelfTask(
  prisma: PrismaClient,
  userId: string,
  body: { projectId: string; mode: 'daily' | 'fixed'; target: number; startAt: Date; endAt?: Date | null; title?: string },
) {
  // 子项可见检查
  const list = await listProjects(prisma, userId);
  const proj = list.find((p) => p.id === body.projectId);
  if (!proj) throw BadRequest('子项不可见');
  if (body.target <= 0 || body.target > 10_000_000) throw BadRequest('target 越界');
  if (body.mode === 'fixed' && !body.endAt) throw BadRequest('fixed 模式需 endAt');

  return prisma.practiceTask.create({
    data: {
      scope: 'self',
      mode: body.mode,
      ownerId: userId,
      userId,
      projectId: body.projectId,
      title: body.title?.trim() || null,
      target: body.target,
      startAt: body.startAt,
      endAt: body.endAt ?? null,
    },
  });
}

export async function archiveSelfTask(prisma: PrismaClient, userId: string, taskId: string) {
  const t = await prisma.practiceTask.findUnique({ where: { id: taskId } });
  if (!t) throw NotFound('任务不存在');
  if (t.scope !== 'self' || t.userId !== userId) throw Forbidden('只能归档自己的任务');
  return prisma.practiceTask.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
  });
}

// ── 隐私 ─────────────────────────────────────────
export async function setVisibility(prisma: PrismaClient, userId: string, visible: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { practiceVisibleToClass: visible } });
  return { practiceVisibleToClass: visible };
}
