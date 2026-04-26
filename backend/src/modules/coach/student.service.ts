// 单学员学修详情（辅导员视角）
// 类型定义见 ./student.types.ts；权限校验由路由层完成。
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getCardStats } from '../sm2/service.js';
import type { StudentDetail } from './student.types.js';

const RECENT_ANSWERS_DEFAULT = 50;
const MISTAKES_LIMIT = 100;

export interface StudentDetailOpts {
  recentLimit?: number;
}

export async function studentDetail(
  userId: string,
  opts: StudentDetailOpts = {},
): Promise<StudentDetail> {
  const recentLimit = opts.recentLimit ?? RECENT_ANSWERS_DEFAULT;

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

  const [
    totalAnswers,
    correctAnswers,
    firstAnswer,
    lastAnswer,
    recentRaw,
    mistakesRaw,
    sm2,
    enrollmentsRaw,
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
      where: { userId },
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
      where: { userId, removedAt: null },
      orderBy: { lastWrongAt: 'desc' },
      take: MISTAKES_LIMIT,
    }),
    getCardStats(userId),
    prisma.userCourseEnrollment.findMany({
      where: { userId },
      include: { course: { select: { title: true } } },
      orderBy: { lastStudiedAt: 'desc' },
    }),
  ]);

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
