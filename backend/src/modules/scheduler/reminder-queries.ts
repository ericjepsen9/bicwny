// 个人提醒 · 数据查询层
//   3 个 build* 函数负责"给定 user · 算今天/上周的数据 · 返回 push payload 或 null（不发）"
//   tick 函数仅做 schedule 判断 · 不查数据 · 保持职责单一
//
// 设计：所有 query 在事务外、可被取消；不写数据库；返回 null 即跳过发送
import type { PrismaClient } from '@prisma/client';
import { lastWeekRange, localDayRange, userLocalTime } from './time-utils.js';

// ───────────────────────────────────────────────────────────────
// 19:00 临期 · "还差 X 即可圆满"
// ───────────────────────────────────────────────────────────────

export interface EveningDuePayload {
  title: string;
  body: string;
  link: string;
}

/**
 * 评估用户今日是否有"已开始但未达每日目标"的 daily 目标
 *   - 检查 PracticeGoal（用户自设每日目标）+ self/class PracticeTask（daily mode）
 *   - 任一已起修 (today count > 0) 且 < target → 临期
 *   - 多项命中只取前 1 项写主文 · 多余写 "等 N 项"
 */
export async function buildEveningDuePayload(
  prisma: PrismaClient,
  userId: string,
  todayYmd: string,
  tz: string,
): Promise<EveningDuePayload | null> {
  // 拉用户所有 daily 目标 · 联表 project 拿 name + emoji
  const [goals, selfTasks, classMemberships] = await Promise.all([
    prisma.practiceGoal.findMany({
      where: { userId, dailyTarget: { gt: 0 } },
      include: { project: { select: { id: true, name: true, emoji: true } } },
    }),
    prisma.practiceTask.findMany({
      where: { scope: 'self', userId, mode: 'daily', archivedAt: null },
      include: { project: { select: { id: true, name: true, emoji: true } } },
    }),
    prisma.classMember.findMany({
      where: { userId, removedAt: null },
      select: { classId: true },
    }),
  ]);

  const classIds = classMemberships.map((m) => m.classId);
  const classTasks = classIds.length > 0
    ? await prisma.practiceTask.findMany({
        where: { scope: 'class', classId: { in: classIds }, mode: 'daily', archivedAt: null },
        include: { project: { select: { id: true, name: true, emoji: true } } },
      })
    : [];

  // 候选项目 id 集合（去重 · goal 优先级 > task）
  const candidates = new Map<string, { name: string; emoji: string | null; target: number }>();
  for (const t of classTasks) {
    candidates.set(t.projectId, { name: t.title || t.project.name, emoji: t.project.emoji, target: t.target });
  }
  for (const t of selfTasks) {
    candidates.set(t.projectId, { name: t.title || t.project.name, emoji: t.project.emoji, target: t.target });
  }
  for (const g of goals) {
    candidates.set(g.projectId, { name: g.project.name, emoji: g.project.emoji, target: g.dailyTarget });
  }
  if (candidates.size === 0) return null;

  // 今日 count（PracticeDailySummary）· date 用用户本地 ymd
  const summaries = await prisma.practiceDailySummary.findMany({
    where: { userId, projectId: { in: [...candidates.keys()] }, date: todayYmd },
    select: { projectId: true, count: true },
  });
  const countMap = new Map(summaries.map((s) => [s.projectId, s.count]));

  // 筛选：已起修（count > 0）但 < target
  const dueItems: Array<{ name: string; emoji: string | null; remaining: number; target: number }> = [];
  for (const [pid, info] of candidates) {
    const c = countMap.get(pid) ?? 0;
    if (c > 0 && c < info.target) {
      dueItems.push({ name: info.name, emoji: info.emoji, remaining: info.target - c, target: info.target });
    }
  }
  if (dueItems.length === 0) return null;

  // 取主项 = 还差比例最大的（最快圆满的）
  dueItems.sort((a, b) => (a.remaining / a.target) - (b.remaining / b.target));
  const top = dueItems[0];

  const emoji = top.emoji ? `${top.emoji} ` : '';
  const extra = dueItems.length > 1 ? ` · 等 ${dueItems.length} 项` : '';
  return {
    title: `师兄 · ${emoji}${top.name} 即将圆满`,
    body: `还差 ${top.remaining} 即可达成今日目标${extra}`,
    link: '/practice',
  };
}

// ───────────────────────────────────────────────────────────────
// 20:00 日报 · "今日尚未起修"
// ───────────────────────────────────────────────────────────────

export interface DailyDigestPayload {
  title: string;
  body: string;
  link: string;
}

/**
 * 评估用户今日是否 0 修学
 *   - 检查 PracticeEntry + MeditationSession + UserAnswer + LessonReadingProgress
 *   - 任意 1 条 > 0 → 不发
 *   - 全 0 → 发日报 · 副文带未起修的 daily 目标名（前 2 项）
 */
export async function buildDailyDigestPayload(
  prisma: PrismaClient,
  userId: string,
  todayYmd: string,
  tz: string,
): Promise<DailyDigestPayload | null> {
  const { startUtc, endUtc } = localDayRange(todayYmd, tz);

  // 任一表有今日记录就跳过
  const [practiceCnt, medCnt, ansCnt, readCnt] = await Promise.all([
    prisma.practiceEntry.count({
      where: { userId, createdAt: { gte: startUtc, lt: endUtc } },
    }),
    prisma.meditationSession.count({
      where: { userId, startedAt: { gte: startUtc, lt: endUtc } },
    }),
    prisma.userAnswer.count({
      where: { userId, answeredAt: { gte: startUtc, lt: endUtc } },
    }),
    prisma.lessonReadingProgress.count({
      where: { userId, lastReadAt: { gte: startUtc, lt: endUtc } },
    }),
  ]);

  if (practiceCnt + medCnt + ansCnt + readCnt > 0) return null;

  // 拉 daily 目标名作为副文 hint（让用户知道有什么可做）
  const [goals, classMemberships] = await Promise.all([
    prisma.practiceGoal.findMany({
      where: { userId, dailyTarget: { gt: 0 } },
      include: { project: { select: { name: true, emoji: true } } },
      take: 5,
    }),
    prisma.classMember.findMany({ where: { userId, removedAt: null }, select: { classId: true } }),
  ]);

  const classIds = classMemberships.map((m) => m.classId);
  const classTasks = classIds.length > 0
    ? await prisma.practiceTask.findMany({
        where: { scope: 'class', classId: { in: classIds }, mode: 'daily', archivedAt: null },
        include: { project: { select: { name: true, emoji: true } } },
        take: 5,
      })
    : [];

  const names = new Set<string>();
  for (const g of goals) names.add(g.project.name);
  for (const t of classTasks) names.add(t.title || t.project.name);

  const hintArr = [...names].slice(0, 2);
  const hint = hintArr.length > 0
    ? `· ${hintArr.join(' / ')}${names.size > 2 ? ' 等' : ''}`
    : '';

  return {
    title: '师兄 · 今日尚未起修',
    body: `一念正知即资粮 ${hint}`.trim(),
    link: '/',
  };
}

// ───────────────────────────────────────────────────────────────
// 周一 08:00 周报 · "上周修学 X 次"
// ───────────────────────────────────────────────────────────────

export interface WeeklyReportPayload {
  title: string;
  body: string;
  link: string;
}

/**
 * 评估用户上周数据 · 0 修学跳过 · 否则组装周报
 *   - 总次数 = practice entries + meditation completions + answers + reading completions
 *   - 班级排名：取用户所有班级里最高名次
 *   - 连续天数 = 上周 7 天里有任意修学记录的天数
 */
export async function buildWeeklyReportPayload(
  prisma: PrismaClient,
  userId: string,
  now: Date,
  tz: string,
): Promise<WeeklyReportPayload | null> {
  const { startUtc, endUtc } = lastWeekRange(now, tz);

  const [practiceEntries, medCompleted, answers, readingCompleted, user] = await Promise.all([
    prisma.practiceEntry.findMany({
      where: { userId, createdAt: { gte: startUtc, lt: endUtc } },
      select: { createdAt: true },
    }),
    prisma.meditationSession.count({
      where: { userId, isCompleted: true, completedAt: { gte: startUtc, lt: endUtc } },
    }),
    prisma.userAnswer.count({
      where: { userId, answeredAt: { gte: startUtc, lt: endUtc } },
    }),
    prisma.lessonReadingProgress.count({
      where: { userId, isCompleted: true, completedAt: { gte: startUtc, lt: endUtc } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);

  // 在被报告的那一周（startUtc=上周一）之后才注册 → 未完整经历该周 · 跳过
  if (user && user.createdAt > startUtc) return null;

  const practiceCount = practiceEntries.length;
  const total = practiceCount + medCompleted + answers + readingCompleted;
  if (total === 0) return null; // 0 修学 · 跳过避免羞辱

  // 连续天数 = 上周这 4 表里 distinct date 数（按用户本地 tz · 与周报口径一致）
  // 简化版：用 practice 的天 + 把 medCompleted/answers/readingCompleted 当 1 天补足
  const practiceDays = new Set(practiceEntries.map((e) => userLocalTime(e.createdAt, tz).ymd));
  let activeDays = practiceDays.size;
  if (medCompleted > 0 && practiceDays.size === 0) activeDays = Math.max(1, activeDays);
  if (answers > 0 && practiceDays.size === 0) activeDays = Math.max(1, activeDays);
  if (readingCompleted > 0 && practiceDays.size === 0) activeDays = Math.max(1, activeDays);
  // 上限 7
  activeDays = Math.min(7, activeDays);

  // 班级排名（取用户最佳名次 · 没班级则跳过这段）
  const memberships = await prisma.classMember.findMany({
    where: { userId, removedAt: null },
    select: { classId: true },
  });

  let rankLine = '';
  if (memberships.length > 0) {
    const bestRank = await computeBestClassRank(prisma, userId, memberships.map((m) => m.classId));
    if (bestRank) rankLine = `班内第 ${bestRank} · `;
  }

  const streakLine = activeDays > 0 ? `连续 ${activeDays} 天 · ` : '';

  return {
    title: `师兄 · 上周共修学 ${total} 次`,
    body: `${rankLine}${streakLine}点开查看完整周报`,
    link: '/dossier?week=last',
  };
}

/**
 * 取用户在所属班级里上周的最佳名次（综合积分榜）
 *   - 复用 study-ranking 的积分逻辑 · 但为避免循环依赖 · 直接简化为"看 practice entries 排名"
 *   - 仅用于周报 hint · 不必精确等于 ranking 页
 *   - 数据范围：上周 7 天 · 与周报数据保持同步
 */
async function computeBestClassRank(
  prisma: PrismaClient,
  userId: string,
  classIds: string[],
): Promise<number | null> {
  if (classIds.length === 0) return null;

  // 批量化（审计 · 消除 N+1）：一次拉全部班的可见成员 + 一次 groupBy 全部成员的上周次数
  const members = await prisma.classMember.findMany({
    where: { classId: { in: classIds }, removedAt: null, user: { isActive: true, practiceVisibleToClass: true } },
    select: { classId: true, userId: true },
  });
  if (members.length === 0) return null;

  const byClass = new Map<string, string[]>();
  for (const m of members) {
    if (!byClass.has(m.classId)) byClass.set(m.classId, []);
    byClass.get(m.classId)!.push(m.userId);
  }
  // 仅保留"用户本人可见在册"的班
  const relevant = [...byClass.values()].filter((ids) => ids.includes(userId));
  if (relevant.length === 0) return null;

  const allIds = [...new Set(relevant.flat())];
  const last7 = new Date(Date.now() - 7 * 86400_000);
  const rows = await prisma.practiceEntry.groupBy({
    by: ['userId'],
    where: { userId: { in: allIds }, createdAt: { gte: last7 } },
    _sum: { count: true },
  });
  const sumByUser = new Map(rows.map((r) => [r.userId, r._sum.count ?? 0]));

  const mySum = sumByUser.get(userId) ?? 0;
  if (mySum === 0) return null; // 上周没修学 · 不显示名次（与旧行为一致）

  // 名次 = 班内严格高于我的人数 + 1（竞争排名 · 平局取最优 · 确定性）
  let best: number | null = null;
  for (const ids of relevant) {
    let higher = 0;
    for (const uid of ids) {
      if (uid !== userId && (sumByUser.get(uid) ?? 0) > mySum) higher++;
    }
    const rank = higher + 1;
    if (best === null || rank < best) best = rank;
  }
  return best;
}
