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

    // 3. 创建 user-scope 副本（决策 A1：名字带班名 · 学员清楚来源）
    const className = proj.class?.name ?? '原班';
    const copy = await tx.practiceProject.create({
      data: {
        categoryId: proj.categoryId,
        name: `${proj.name}（来自《${className}》）`,
        emoji: proj.emoji,
        scope: 'user',
        ownerId: userId,
        isBuiltin: false,
      },
    });

    // 4. 迁移所有相关记录到副本
    await tx.practiceEntry.updateMany({
      where: { userId, projectId: proj.id },
      data: { projectId: copy.id },
    });
    await tx.practiceDailySummary.updateMany({
      where: { userId, projectId: proj.id },
      data: { projectId: copy.id },
    });
    await tx.practiceGoal.updateMany({
      where: { userId, projectId: proj.id },
      data: { projectId: copy.id },
    });
    // 个人任务 self · 同样迁；class 任务不动（学员退班自然看不到 · 不归个人）
    await tx.practiceTask.updateMany({
      where: { userId, projectId: proj.id, scope: 'self' },
      data: { projectId: copy.id },
    });
  }
}
