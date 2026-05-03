// Admin · 单用户学习画像
//   GET /api/admin/users/:id/learning
//
// 输出：
//   - account：注册/最后登录/邮箱验证 时间戳
//   - summary：累计答题、正确率、首次/最近活跃时间
//   - dailySeries：最近 30 天每天答题数（有数据缺位以 0 填充 · 时区按服务器 local）
//   - sm2Progress：new/learning/review/mastered/due/total
//   - byCourse：每个 enrollment 的标题/答题数/正确率/掌握数/最后学习
//   - classMemberships：用户在哪些班、角色、加入日期
//
// 权限：admin only · 路由层 guard
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getCardStats } from '../sm2/service.js';

export interface DailyPoint {
  date: string;        // 'YYYY-MM-DD' 服务器 local
  count: number;
  correct: number;
}

export interface ByCourseRow {
  courseId: string;
  title: string;
  coverEmoji: string;
  answered: number;
  correct: number;
  masteredCount: number;
  lastStudiedAt: Date | null;
}

export interface ClassMembershipRow {
  classId: string;
  className: string;
  role: 'coach' | 'student';
  joinedAt: Date;
  coverEmoji: string;
}

export interface UserLearningStats {
  account: {
    id: string;
    email: string | null;
    dharmaName: string | null;
    role: string;
    isActive: boolean;
    createdAt: Date;
    lastLoginAt: Date | null;
    emailVerifiedAt: Date | null;
  };
  summary: {
    totalAnswers: number;
    correctAnswers: number;
    correctRate: number;
    firstAnswerAt: Date | null;
    lastActiveAt: Date | null;
  };
  dailySeries: DailyPoint[];
  sm2Progress: { new: number; learning: number; review: number; mastered: number; due: number; total: number };
  byCourse: ByCourseRow[];
  classMemberships: ClassMembershipRow[];
}

const DAILY_WINDOW = 30;

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 给最近 N 天空表 · 后续 fill */
function emptyDays(n: number): Map<string, { count: number; correct: number }> {
  const out = new Map<string, { count: number; correct: number }>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    out.set(ymdLocal(d), { count: 0, correct: 0 });
  }
  return out;
}

export async function userLearningStats(userId: string): Promise<UserLearningStats> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      dharmaName: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
    },
  });
  if (!user) throw NotFound('用户不存在');

  const windowStart = new Date(Date.now() - DAILY_WINDOW * 86_400_000);
  windowStart.setHours(0, 0, 0, 0);

  const [
    totalAnswers,
    correctAnswers,
    firstAnswer,
    lastAnswer,
    recentForChart,
    sm2,
    enrollments,
    memberships,
    perCourseMastered,
  ] = await Promise.all([
    prisma.userAnswer.count({ where: { userId } }),
    prisma.userAnswer.count({ where: { userId, isCorrect: true } }),
    prisma.userAnswer.findFirst({
      where: { userId },
      orderBy: { answeredAt: 'asc' },
      select: { answeredAt: true },
    }),
    prisma.userAnswer.findFirst({
      where: { userId },
      orderBy: { answeredAt: 'desc' },
      select: { answeredAt: true },
    }),
    prisma.userAnswer.findMany({
      where: { userId, answeredAt: { gte: windowStart } },
      select: { answeredAt: true, isCorrect: true },
    }),
    getCardStats(userId), // 全局 · 不限 courseId
    prisma.userCourseEnrollment.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, coverEmoji: true } } },
      orderBy: { lastStudiedAt: 'desc' },
    }),
    prisma.classMember.findMany({
      where: { userId, removedAt: null },
      include: { class: { select: { id: true, name: true, coverEmoji: true } } },
      orderBy: { joinedAt: 'desc' },
    }),
    prisma.sm2Card.groupBy({
      by: ['courseId'],
      where: { userId, status: 'mastered' },
      _count: { _all: true },
    }),
  ]);

  // 填充每日柱状
  const dayMap = emptyDays(DAILY_WINDOW);
  for (const a of recentForChart) {
    const key = ymdLocal(a.answeredAt);
    const cur = dayMap.get(key);
    if (cur) {
      cur.count++;
      if (a.isCorrect === true) cur.correct++;
    }
  }
  const dailySeries: DailyPoint[] = [...dayMap.entries()].map(([date, v]) => ({ date, count: v.count, correct: v.correct }));

  // 按法本聚合：另用 join question.courseId 做更准的 count
  // 数据量大时可改成 raw SQL；此处单用户体量可控
  const courseAns = await prisma.userAnswer.findMany({
    where: { userId },
    select: { isCorrect: true, question: { select: { courseId: true } } },
  });
  const courseAggMap = new Map<string, { answered: number; correct: number }>();
  for (const a of courseAns) {
    const cid = a.question.courseId;
    const cur = courseAggMap.get(cid) ?? { answered: 0, correct: 0 };
    cur.answered++;
    if (a.isCorrect === true) cur.correct++;
    courseAggMap.set(cid, cur);
  }
  const masteredMap = new Map(perCourseMastered.map((x) => [x.courseId, x._count._all]));

  // 把所有"出现过的法本"合并：enrollment OR 答过题
  const courseIds = new Set<string>();
  for (const e of enrollments) courseIds.add(e.courseId);
  for (const cid of courseAggMap.keys()) courseIds.add(cid);

  // 缺失元数据的 courseId 拉一次 Course 表补齐
  const missingMeta = [...courseIds].filter((cid) => !enrollments.some((e) => e.courseId === cid));
  const extraCourses = missingMeta.length
    ? await prisma.course.findMany({
        where: { id: { in: missingMeta } },
        select: { id: true, title: true, coverEmoji: true },
      })
    : [];
  const courseMeta = new Map<string, { title: string; coverEmoji: string }>();
  for (const e of enrollments) courseMeta.set(e.courseId, { title: e.course.title, coverEmoji: e.course.coverEmoji });
  for (const c of extraCourses) courseMeta.set(c.id, { title: c.title, coverEmoji: c.coverEmoji });

  const enrollmentByCid = new Map(enrollments.map((e) => [e.courseId, e]));

  const byCourse: ByCourseRow[] = [...courseIds].map((cid) => {
    const meta = courseMeta.get(cid) ?? { title: '—', coverEmoji: '🪷' };
    const agg = courseAggMap.get(cid) ?? { answered: 0, correct: 0 };
    const en = enrollmentByCid.get(cid);
    return {
      courseId: cid,
      title: meta.title,
      coverEmoji: meta.coverEmoji,
      answered: agg.answered,
      correct: agg.correct,
      masteredCount: masteredMap.get(cid) ?? 0,
      lastStudiedAt: en?.lastStudiedAt ?? null,
    };
  }).sort((a, b) => b.answered - a.answered);

  return {
    account: {
      id: user.id,
      email: user.email,
      dharmaName: user.dharmaName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      emailVerifiedAt: user.emailVerifiedAt,
    },
    summary: {
      totalAnswers,
      correctAnswers,
      correctRate: totalAnswers > 0 ? correctAnswers / totalAnswers : 0,
      firstAnswerAt: firstAnswer?.answeredAt ?? null,
      lastActiveAt: lastAnswer?.answeredAt ?? null,
    },
    dailySeries,
    sm2Progress: sm2,
    byCourse,
    classMemberships: memberships.map((m) => ({
      classId: m.classId,
      className: m.class.name,
      role: m.role as 'coach' | 'student',
      joinedAt: m.joinedAt,
      coverEmoji: m.class.coverEmoji,
    })),
  };
}
