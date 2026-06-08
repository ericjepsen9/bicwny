// 修学计数 · 离班/班级归档时自动迁移逻辑
//
// 触发：_removeMemberInTx（学员主动退班 / admin 移除）· archiveClass（整班归档批量）
// 行为：
//   1. 找该班 active 的 class-scope PracticeProject
//   2. 对每个 (user, project) · 若该 user 有 entry → 复用或创建 user-scope 副本
//   3. 把该 user 的 entry / dailySummary / goal / 个人 task 全部 reassign 到副本
//   4. 副本命名：「{原 name}（来自《{班名}》）」(决策 A1)
//   5. 同名副本复用合并（审计 S8）· 多班不同名互不合并（决策 C）
//
// 与原 class-scope project 关系：
//   - 原 project 不动 · 班里其他成员仍可继续用
//   - 退班/归档后该用户的所有数据指向副本 · 与原 project 解耦
import type { Prisma } from '@prisma/client';

interface ClassProjectLite {
  id: string;
  categoryId: string;
  name: string;
  emoji: string | null;
}

// 把单个 (user, project) 的修学数据迁到 user-scope 副本（复用或新建）
// 单次离班 / 整班归档共用此核心 · 避免逻辑分叉
async function migrateUserProject(
  tx: Prisma.TransactionClient,
  userId: string,
  proj: ClassProjectLite,
  className: string,
): Promise<void> {
  // 复用已存在的同名 user-scope 副本（审计 S8：防 re-join/re-leave 产生碎片副本）
  const copyName = `${proj.name}（来自《${className}》）`;
  let copyId: string;
  const existingCopy = await tx.practiceProject.findFirst({
    where: { ownerId: userId, scope: 'user', name: copyName, categoryId: proj.categoryId, archivedAt: null },
    select: { id: true },
  });
  if (existingCopy) {
    copyId = existingCopy.id;
  } else {
    const copy = await tx.practiceProject.create({
      data: {
        categoryId: proj.categoryId,
        name: copyName,
        emoji: proj.emoji,
        scope: 'user',
        ownerId: userId,
        isBuiltin: false,
      },
      select: { id: true },
    });
    copyId = copy.id;
  }

  // entries 无 per-date unique · 直接 re-point
  await tx.practiceEntry.updateMany({
    where: { userId, projectId: proj.id },
    data: { projectId: copyId },
  });

  // dailySummary 有 (userId, projectId, date) unique · 复用副本时逐条合并防冲突
  const summaries = await tx.practiceDailySummary.findMany({
    where: { userId, projectId: proj.id },
    select: { id: true, date: true, count: true },
  });
  for (const sm of summaries) {
    const dup = await tx.practiceDailySummary.findUnique({
      where: { userId_projectId_date: { userId, projectId: copyId, date: sm.date } },
      select: { id: true, count: true },
    });
    if (dup) {
      await tx.practiceDailySummary.update({ where: { id: dup.id }, data: { count: dup.count + sm.count } });
      await tx.practiceDailySummary.delete({ where: { id: sm.id } });
    } else {
      await tx.practiceDailySummary.update({ where: { id: sm.id }, data: { projectId: copyId } });
    }
  }

  // goal 有 (userId, projectId) unique · 副本已有目标则保留已有 · 删源；否则 re-point
  const goal = await tx.practiceGoal.findUnique({
    where: { userId_projectId: { userId, projectId: proj.id } },
    select: { id: true },
  });
  if (goal) {
    const dupGoal = await tx.practiceGoal.findUnique({
      where: { userId_projectId: { userId, projectId: copyId } },
      select: { id: true },
    });
    if (dupGoal) await tx.practiceGoal.delete({ where: { id: goal.id } });
    else await tx.practiceGoal.update({ where: { id: goal.id }, data: { projectId: copyId } });
  }

  // 个人任务 self · 同样迁；class 任务不动（学员退班自然看不到 · 不归个人）
  await tx.practiceTask.updateMany({
    where: { userId, projectId: proj.id, scope: 'self' },
    data: { projectId: copyId },
  });
}

// 单个成员离班 · 迁移其在本班所有 class project 的修学数据
export async function migratePracticeOnLeave(
  tx: Prisma.TransactionClient,
  classId: string,
  userId: string,
): Promise<void> {
  const classProjects = await tx.practiceProject.findMany({
    where: { scope: 'class', classId, archivedAt: null },
    select: {
      id: true,
      categoryId: true,
      name: true,
      emoji: true,
      class: { select: { name: true } },
    },
  });
  if (classProjects.length === 0) return;

  for (const proj of classProjects) {
    // 该用户在此 project 留过 entry 才迁（避免空副本）
    const entryCount = await tx.practiceEntry.count({
      where: { userId, projectId: proj.id },
    });
    if (entryCount === 0) continue;
    await migrateUserProject(tx, userId, proj, proj.class?.name ?? '原班');
  }
}

// 整班归档 · 批量迁移所有成员的修学数据（审计 F12）
//   关键优化：class projects 只查一次 · 用单条 groupBy 找出"哪些 (user, project) 有 entry"·
//   替代旧实现"每成员重查 projects + 每 (成员×project) 一次 count"的 O(M×P) 顺序查询。
export async function migratePracticeOnArchive(
  tx: Prisma.TransactionClient,
  classId: string,
  className: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;
  const classProjects = await tx.practiceProject.findMany({
    where: { scope: 'class', classId, archivedAt: null },
    select: { id: true, categoryId: true, name: true, emoji: true },
  });
  if (classProjects.length === 0) return;
  const projById = new Map(classProjects.map((p) => [p.id, p]));

  // 一次性找出有 entry 的 (user, project) 对 · 只为这些对建副本
  const groups = await tx.practiceEntry.groupBy({
    by: ['userId', 'projectId'],
    where: { userId: { in: userIds }, projectId: { in: classProjects.map((p) => p.id) } },
    _count: { _all: true },
  });
  for (const g of groups) {
    const proj = projById.get(g.projectId);
    if (!proj) continue;
    await migrateUserProject(tx, g.userId, proj, className);
  }
}
