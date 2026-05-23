// 修学计数 · 离班/班级归档时自动迁移逻辑
//
// 触发：_removeMemberInTx（学员主动退班 / admin 移除 / archiveClass 批量级联）
// 行为：
//   1. 找该班 active 的 class-scope PracticeProject
//   2. 对每个 project · 若该 user 有 entry → 创建 user-scope 副本
//   3. 把该 user 的 entry / dailySummary / goal / 个人 task 全部 reassign 到副本
//   4. 副本命名：「{原 name}（来自《{班名}》）」(决策 A1)
//   5. 多班同名互不合并（决策 C）
//
// 与原 class-scope project 关系：
//   - 原 project 不动 · 班里其他成员仍可继续用
//   - 退班/归档后该用户的所有数据指向副本 · 与原 project 解耦
import type { Prisma } from '@prisma/client';

export async function migratePracticeOnLeave(
  tx: Prisma.TransactionClient,
  classId: string,
  userId: string,
): Promise<void> {
  // 1. 该班 active 的 class-scope projects（含班名）
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
    // 2. 该用户是否在此 project 留过 entry · 没留过就跳过（避免空副本）
    const entryCount = await tx.practiceEntry.count({
      where: { userId, projectId: proj.id },
    });
    if (entryCount === 0) continue;

    // 3. 复用已存在的同名 user-scope 副本（审计 S8：防 re-join/re-leave 产生碎片副本）
    //    副本名确定（原 name + 班名）· 第二次离班会并入第一次的副本而非新建
    const className = proj.class?.name ?? '原班';
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

    // 4. 迁移记录到副本
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
}
