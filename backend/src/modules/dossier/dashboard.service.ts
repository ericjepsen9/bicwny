// 班级 dashboard · 教师/admin 看本班所有学员的核心 stats 对比表
//   - 服务返回该班所有 active 学员 mini stats（不返回明细 · 详情走 /coach/classes/:id/students/:uid/stats）
//   - 字段：dharmaName / 修学累计 / streak / 已读课时 / 答题数 / 正确率 / 班级任务完成度
//   - 班级任务完成度：取该班所有 active class task · 计算该学员各任务进度均值
import type { PrismaClient } from '@prisma/client';
import { calcStreaksBatch, dateKey } from '../practice/utils.js';

export interface DashboardRow {
  userId: string;
  dharmaName: string | null;
  email: string | null;
  joinedAt: Date;
  practiceTotal: number;
  practiceStreak: number;
  meditationCompleted: number;
  readingCompleted: number;
  totalAnswers: number;
  correctRate: number;
  classTaskAvgProgress: number; // 0-100 该学员所有班级任务进度的平均
  classTaskDoneCount: number;   // 该学员完成的班级任务数
}

export async function getClassDashboard(prisma: PrismaClient, classId: string): Promise<{
  taskCount: number;
  rows: DashboardRow[];
}> {
  // 该班 active 学员
  const members = await prisma.classMember.findMany({
    where: { classId, removedAt: null, role: 'student' },
    include: { user: { select: { id: true, dharmaName: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  if (members.length === 0) return { taskCount: 0, rows: [] };
  const userIds = members.map((m) => m.userId);

  // 该班 active class tasks
  const classTasks = await prisma.practiceTask.findMany({
    where: { scope: 'class', classId, archivedAt: null },
    select: { id: true, projectId: true, target: true, startAt: true, endAt: true },
  });
  const today = dateKey();

  // 批量拿各维度
  const [
    practiceTotals,
    meditationCounts,
    readingCounts,
    answerCounts,
    correctCounts,
    practiceDailyAll,
  ] = await Promise.all([
    prisma.practiceDailySummary.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _sum: { count: true },
    }),
    prisma.meditationSession.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, isCompleted: true },
      _count: { meditationId: true },
    }),
    prisma.lessonReadingProgress.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, isCompleted: true },
      _count: { lessonId: true },
    }),
    prisma.userAnswer.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { id: true },
    }),
    prisma.userAnswer.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, isCorrect: true },
      _count: { id: true },
    }),
    // 班级任务进度 · 取所有 (userId, projectId) 的 daily summary 在每个 task 的 dateRange 内
    classTasks.length > 0 ? prisma.practiceDailySummary.findMany({
      where: {
        userId: { in: userIds },
        projectId: { in: classTasks.map((t) => t.projectId) },
      },
      select: { userId: true, projectId: true, date: true, count: true },
    }) : Promise.resolve([]),
  ]);

  const practiceTotalsMap = new Map(practiceTotals.map((r) => [r.userId, r._sum.count ?? 0]));
  const meditationMap = new Map(meditationCounts.map((r) => [r.userId, r._count.meditationId]));
  const readingMap = new Map(readingCounts.map((r) => [r.userId, r._count.lessonId]));
  const answerMap = new Map(answerCounts.map((r) => [r.userId, r._count.id]));
  const correctMap = new Map(correctCounts.map((r) => [r.userId, r._count.id]));

  // 班级任务进度计算（per user · per task）
  // 每个 (userId, taskId) 取 daily summary 在 task 时间窗内的 sum 作为 progress
  const taskProgressMap = new Map<string, Map<string, number>>(); // userId → taskId → progress
  for (const t of classTasks) {
    const startKey = dateKey(t.startAt);
    const endKey = t.endAt ? dateKey(t.endAt) : today;
    for (const r of practiceDailyAll) {
      if (r.projectId !== t.projectId) continue;
      if (r.date < startKey || r.date > endKey) continue;
      const userMap = taskProgressMap.get(r.userId) ?? new Map<string, number>();
      userMap.set(t.id, (userMap.get(t.id) ?? 0) + r.count);
      taskProgressMap.set(r.userId, userMap);
    }
  }

  // streak 批量算（2 条查询）· 替代逐学员 calcStreak 的 N+1（100 人=200 并发查询打满连接池）
  const streakMap = await calcStreaksBatch(prisma, members.map((m) => m.userId));
  const rows: DashboardRow[] = members.map((m) => {
    const totalAnswers = answerMap.get(m.userId) ?? 0;
    const correctAnswers = correctMap.get(m.userId) ?? 0;
    const userTaskMap = taskProgressMap.get(m.userId) ?? new Map();
    let avgProgress = 0;
    let doneCount = 0;
    if (classTasks.length > 0) {
      let pctSum = 0;
      for (const t of classTasks) {
        const p = userTaskMap.get(t.id) ?? 0;
        const pct = t.target > 0 ? Math.min(100, Math.round((p / t.target) * 100)) : 0;
        pctSum += pct;
        if (p >= t.target) doneCount++;
      }
      avgProgress = Math.round(pctSum / classTasks.length);
    }
    const streak = streakMap.get(m.userId) ?? 0;
    return {
      userId: m.userId,
      dharmaName: m.user.dharmaName,
      email: m.user.email,
      joinedAt: m.joinedAt,
      practiceTotal: practiceTotalsMap.get(m.userId) ?? 0,
      practiceStreak: streak,
      meditationCompleted: meditationMap.get(m.userId) ?? 0,
      readingCompleted: readingMap.get(m.userId) ?? 0,
      totalAnswers,
      correctRate: totalAnswers > 0 ? correctAnswers / totalAnswers : 0,
      classTaskAvgProgress: avgProgress,
      classTaskDoneCount: doneCount,
    };
  });

  return { taskCount: classTasks.length, rows };
}

/** 导出 CSV · 表头中文 · UTF-8 BOM 让 Excel 正确识别 */
export function dashboardToCsv(taskCount: number, rows: DashboardRow[]): string {
  const headers = [
    '法名/Email', '加入日期', '修学累计', '🔥连续(天)',
    '观修完成', '已读课时', '答题数', '正确率',
    `班级任务完成数/${taskCount}`, '任务平均进度(%)',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      `"${(r.dharmaName ?? r.email ?? r.userId).replace(/"/g, '""')}"`,
      dateKey(r.joinedAt),
      r.practiceTotal,
      r.practiceStreak,
      r.meditationCompleted,
      r.readingCompleted,
      r.totalAnswers,
      Math.round(r.correctRate * 100) + '%',
      r.classTaskDoneCount,
      r.classTaskAvgProgress,
    ].join(','));
  }
  // UTF-8 BOM + CRLF · Excel 友好
  return '﻿' + lines.join('\r\n');
}
