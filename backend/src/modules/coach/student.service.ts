// 单学员学修详情（辅导员视角）
// 类型定义见 ./student.types.ts；权限校验由路由层完成。
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getCardStats } from '../sm2/service.js';
import type { StudentDetail } from './student.types.js';

const RECENT_ANSWERS_DEFAULT = 50;
const MISTAKES_LIMIT = 100;
const DAILY_WINDOW = 30;

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

export interface StudentDetailOpts {
  recentLimit?: number;
}

// CO2: classId 为必传 · 隔离到该班主修法本（class.courseId）的学习数据
//   coach 应只看学员在自己班级 context 下的答题 / 错题 / 进度，
//   不能跨班看其他班的私题答题或自学其他法本的进度
export async function studentDetail(
  userId: string,
  classId: string,
  opts: StudentDetailOpts = {},
): Promise<StudentDetail> {
  const recentLimit = opts.recentLimit ?? RECENT_ANSWERS_DEFAULT;

  // 拿班级主修课程 · 用作所有数据查询的 scoping key
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { courseId: true },
  });
  if (!cls) throw NotFound('班级不存在');
  const courseId = cls.courseId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      dharmaName: true,
      lastLoginAt: true,
      isActive: true,
    },
  });
  if (!user) throw NotFound('用户不存在');

  // 所有 UserAnswer / UserMistakeBook 查询都按 question.courseId === courseId 过滤
  // 防止 coach A 看到学员在 B 班 / 自学其他法本的答题
  const dailyWindowStart = new Date(Date.now() - DAILY_WINDOW * 86_400_000);
  dailyWindowStart.setHours(0, 0, 0, 0);

  const [
    totalAnswers,
    correctAnswers,
    firstAnswer,
    lastAnswer,
    recentRaw,
    mistakesRaw,
    sm2,
    enrollmentsRaw,
    dailyRaw,
  ] = await Promise.all([
    prisma.userAnswer.count({ where: { userId, question: { courseId } } }),
    prisma.userAnswer.count({
      where: { userId, isCorrect: true, question: { courseId } },
    }),
    prisma.userAnswer.findFirst({
      where: { userId, question: { courseId } },
      orderBy: { answeredAt: 'asc' },
      select: { answeredAt: true },
    }),
    prisma.userAnswer.findFirst({
      where: { userId, question: { courseId } },
      orderBy: { answeredAt: 'desc' },
      select: { answeredAt: true },
    }),
    prisma.userAnswer.findMany({
      where: { userId, question: { courseId } },
      orderBy: { answeredAt: 'desc' },
      take: recentLimit,
      select: {
        questionId: true,
        isCorrect: true,
        score: true,
        answeredAt: true,
        question: { select: { lesson: { select: { title: true } } } },
      },
    }),
    prisma.userMistakeBook.findMany({
      where: { userId, removedAt: null, question: { courseId } },
      orderBy: { lastWrongAt: 'desc' },
      take: MISTAKES_LIMIT,
    }),
    // SM-2 直接按 courseId 过滤（getCardStats 已支持）
    getCardStats(userId, courseId),
    // 只返回本班课程的 enrollment（一条记录或为空）
    prisma.userCourseEnrollment.findMany({
      where: { userId, courseId },
      include: { course: { select: { title: true } } },
      orderBy: { lastStudiedAt: 'desc' },
    }),
    // 30 天每日柱图原料 · 仅本班 courseId 范围
    prisma.userAnswer.findMany({
      where: { userId, question: { courseId }, answeredAt: { gte: dailyWindowStart } },
      select: { answeredAt: true, isCorrect: true },
    }),
  ]);

  // 填充每日柱状（缺位以 0 填）
  const dayMap = emptyDays(DAILY_WINDOW);
  for (const a of dailyRaw) {
    const key = ymdLocal(a.answeredAt);
    const cur = dayMap.get(key);
    if (cur) {
      cur.count++;
      if (a.isCorrect === true) cur.correct++;
    }
  }
  const dailySeries = [...dayMap.entries()].map(([date, v]) => ({ date, count: v.count, correct: v.correct }));

  // UserMistakeBook 未建 Question 关系，需单独取 questionText
  const qLookup = await loadMistakeQuestionTexts(mistakesRaw.map((m) => m.questionId));

  return {
    user,
    summary: {
      totalAnswers,
      correctRate: totalAnswers > 0 ? correctAnswers / totalAnswers : 0,
      firstAnswerAt: firstAnswer?.answeredAt ?? null,
      lastActiveAt: lastAnswer?.answeredAt ?? null,
    },
    dailySeries,
    recentAnswers: recentRaw.map((a) => ({
      questionId: a.questionId,
      lessonTitle: a.question.lesson.title,
      isCorrect: a.isCorrect,
      score: a.score,
      answeredAt: a.answeredAt,
    })),
    mistakes: mistakesRaw.map((m) => ({
      questionId: m.questionId,
      questionText: qLookup.get(m.questionId) ?? '(题目已删除)',
      wrongCount: m.wrongCount,
      lastWrongAt: m.lastWrongAt,
    })),
    sm2Progress: sm2,
    enrollments: enrollmentsRaw.map((e) => ({
      courseId: e.courseId,
      title: e.course.title,
      lastStudiedAt: e.lastStudiedAt,
      completedAt: e.completedAt,
    })),
  };
}

async function loadMistakeQuestionTexts(
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.question.findMany({
    where: { id: { in: ids } },
    select: { id: true, questionText: true },
  });
  return new Map(rows.map((r) => [r.id, r.questionText]));
}
