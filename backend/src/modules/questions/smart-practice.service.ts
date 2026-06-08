// 智能练习选题服务
//
// 策略（按优先级混合）：
//   1. SM-2 dueDate ≤ now & status != 'mastered' 的题（间隔重复到期）
//   2. UserMistakeBook 中 wrongCount > 0 且 removedAt == null 的题
//   3. 用户已报名 course 中"已学课时"的题随机抽（lessonsCompleted ∈ enrollment）
//   4. 仍不够 → 已报名 course 随机抽题（兜底）
//
// 比例：limit 题里 50% SM-2 / 30% mistakes / 20% random（不足部分往后顺降）
// 最终去重 + Fisher-Yates 乱序
import type { Question } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cohortWhere } from '../../lib/content-seed.js';
import { getUserActiveClassIds } from '../questions/list.service.js';

interface SmartPracticeOpts {
  limit?: number; // 5 / 10 / 20
  /** 限定到某 course · 如果提供 · 仅从这个 course 抽题 */
  courseId?: string;
  /** 仅刷错题（UserMistakeBook · removedAt = null）· 不混 SM-2 / 随机 */
  onlyMistakes?: boolean;
  /** 仅练某一道题（错题详情"再练这一道"）· 优先级最高 · limit 强制为 1 */
  questionId?: string;
}

async function viewerVisibilityWhere(userId: string) {
  const [classIds, user] = await Promise.all([
    getUserActiveClassIds(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { contentCohort: true },
    }),
  ]);
  const visibilityClauses = [
    { visibility: 'public' as const },
    ...(classIds.length > 0
      ? [{ visibility: 'class_private' as const, ownerClassId: { in: classIds } }]
      : []),
  ];
  return {
    reviewStatus: 'approved' as const,
    OR: visibilityClauses,
    AND: [cohortWhere(user?.contentCohort ?? null)],
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export async function smartPractice(
  userId: string,
  opts: SmartPracticeOpts = {},
): Promise<Question[]> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 10));
  const visibilityWhere = await viewerVisibilityWhere(userId);

  // ── 0. 单题模式（错题详情"再练这一道"）──
  if (opts.questionId) {
    const q = await prisma.question.findFirst({
      where: { id: opts.questionId, ...visibilityWhere },
    });
    return q ? [q] : [];
  }

  // ── 0b. 仅刷错题模式 ──
  if (opts.onlyMistakes) {
    const mistakeRows = await prisma.userMistakeBook.findMany({
      where: {
        userId,
        removedAt: null,
        ...(opts.courseId ? { question: { courseId: opts.courseId } } : {}),
      },
      orderBy: { lastWrongAt: 'desc' },
      take: limit * 3, // 多取一点 · 后面 visibility 过滤可能去掉一些
      select: { questionId: true },
    });
    if (mistakeRows.length === 0) return [];
    const items = await prisma.question.findMany({
      where: {
        id: { in: mistakeRows.map((m) => m.questionId) },
        ...visibilityWhere,
      },
    });
    return shuffle(items).slice(0, limit);
  }

  // 拿用户已报名的 course ids · 后续 random 兜底用 · 如有 courseId 参数则限定
  const enrolls = await prisma.userCourseEnrollment.findMany({
    where: { userId, ...(opts.courseId ? { courseId: opts.courseId } : {}) },
    select: { courseId: true, lessonsCompleted: true },
  });
  const enrolledCourseIds = enrolls.map((e) => e.courseId);
  const completedLessonIds = enrolls.flatMap((e) => e.lessonsCompleted);

  if (enrolledCourseIds.length === 0) {
    // 未报名 · 直接拉公开题随机
    return shuffle(
      await prisma.question.findMany({
        where: visibilityWhere,
        orderBy: [{ createdAt: 'desc' }],
        take: limit * 4,
      }),
    ).slice(0, limit);
  }

  // ── 1. SM-2 due ──
  const dueCards = await prisma.sm2Card.findMany({
    where: {
      userId,
      courseId: { in: enrolledCourseIds },
      dueDate: { lte: new Date() },
      status: { not: 'mastered' },
    },
    orderBy: { dueDate: 'asc' },
    take: Math.ceil(limit * 0.6),
    select: { questionId: true },
  });
  const sm2Ids = dueCards.map((c) => c.questionId);

  // ── 2. 错题 ──
  const mistakes = await prisma.userMistakeBook.findMany({
    where: {
      userId,
      removedAt: null,
      question: { courseId: { in: enrolledCourseIds } },
    },
    orderBy: { lastWrongAt: 'desc' },
    take: Math.ceil(limit * 0.4),
    select: { questionId: true },
  });
  const mistakeIds = mistakes.map((m) => m.questionId);

  // ── 3. 已学课时随机 ──
  const completedLessonIdSet = new Set(completedLessonIds);
  let completedLessonQs: { id: string }[] = [];
  if (completedLessonIdSet.size > 0) {
    completedLessonQs = await prisma.question.findMany({
      where: {
        ...visibilityWhere,
        lessonId: { in: [...completedLessonIdSet] },
      },
      select: { id: true },
      take: limit * 5,
    });
  }
  const completedQIdsShuffled = shuffle(completedLessonQs.map((q) => q.id));

  // ── 4. 已报名 course 随机兜底 ──
  const courseRandomQs = await prisma.question.findMany({
    where: {
      ...visibilityWhere,
      courseId: { in: enrolledCourseIds },
    },
    select: { id: true },
    take: limit * 5,
  });
  const courseRandomIdsShuffled = shuffle(courseRandomQs.map((q) => q.id));

  // 合并 · 去重 · 顺序：sm2 → mistake → 已学课时 → 课程随机
  const seen = new Set<string>();
  const finalIds: string[] = [];
  const pools: string[][] = [
    sm2Ids,
    mistakeIds,
    completedQIdsShuffled,
    courseRandomIdsShuffled,
  ];
  for (const pool of pools) {
    for (const id of pool) {
      if (seen.has(id)) continue;
      seen.add(id);
      finalIds.push(id);
      if (finalIds.length >= limit) break;
    }
    if (finalIds.length >= limit) break;
  }

  if (finalIds.length === 0) return [];

  // 拉完整 Question · 保留 finalIds 顺序但全局再 shuffle 一次让 SM-2 题不集中开头
  const items = await prisma.question.findMany({
    where: { id: { in: finalIds }, ...visibilityWhere },
  });
  const itemMap = new Map(items.map((q) => [q.id, q]));
  const ordered = finalIds
    .map((id) => itemMap.get(id))
    .filter((q): q is Question => !!q);
  return shuffle(ordered);
}
