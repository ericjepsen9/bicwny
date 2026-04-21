// 班级学习聚合统计（辅导员面板）
// 一次 findMany 拉所有成员答题，JS 端单遍聚合。
// Sprint 2 MVP，单班级通常答题量级可控；大规模再换 groupBy + 分批。
import { prisma } from '../../lib/prisma.js';
import {
  type ByLesson,
  type ClassStats,
  emptyClassStats,
  type PerStudent,
} from './stats.types.js';

const WINDOW_DAYS_DEFAULT = 7;
const TOP_STUDENTS = 5;

export async function classStats(
  classId: string,
  windowDays: number = WINDOW_DAYS_DEFAULT,
): Promise<ClassStats> {
  const members = await prisma.classMember.findMany({
    where: { classId, removedAt: null, role: 'student' },
    include: {
      user: { select: { id: true, dharmaName: true, email: true } },
    },
  });
  if (members.length === 0) return emptyClassStats(windowDays);

  const studentIds = members.map((m) => m.userId);
  const userLookup = new Map(members.map((m) => [m.userId, m.user]));

  const answers = await prisma.userAnswer.findMany({
    where: { userId: { in: studentIds } },
    select: {
      userId: true,
      isCorrect: true,
      answeredAt: true,
      question: {
        select: {
          lessonId: true,
          lesson: { select: { title: true } },
        },
      },
    },
  });

  const windowStart = new Date(Date.now() - windowDays * 86_400_000);
  const byLesson = new Map<string, { title: string; answered: number; correct: number }>();
  const byUser = new Map<
    string,
    { answers: number; correct: number; lastActiveAt: Date | null }
  >();
  const activeIds = new Set<string>();
  let correct = 0;

  for (const a of answers) {
    if (a.isCorrect) correct++;
    if (a.answeredAt >= windowStart) activeIds.add(a.userId);

    const lid = a.question.lessonId;
    const le = byLesson.get(lid) ?? {
      title: a.question.lesson.title,
      answered: 0,
      correct: 0,
    };
    le.answered++;
    if (a.isCorrect) le.correct++;
    byLesson.set(lid, le);

    const ue = byUser.get(a.userId) ?? {
      answers: 0,
      correct: 0,
      lastActiveAt: null,
    };
    ue.answers++;
    if (a.isCorrect) ue.correct++;
    if (!ue.lastActiveAt || a.answeredAt > ue.lastActiveAt) {
      ue.lastActiveAt = a.answeredAt;
    }
    byUser.set(a.userId, ue);
  }

  const perStudent: PerStudent[] = [...byUser.entries()].map(([uid, v]) => ({
    userId: uid,
    dharmaName: userLookup.get(uid)?.dharmaName ?? null,
    answers: v.answers,
    correctRate: v.answers > 0 ? v.correct / v.answers : 0,
    lastActiveAt: v.lastActiveAt,
  }));

  const topStudents = [...perStudent]
    .sort((a, b) => b.answers - a.answers)
    .slice(0, TOP_STUDENTS);

  const stragglers: PerStudent[] = members
    .filter((m) => !activeIds.has(m.userId))
    .map((m) => {
      const s = byUser.get(m.userId);
      return {
        userId: m.userId,
        dharmaName: m.user.dharmaName,
        answers: s?.answers ?? 0,
        correctRate: s && s.answers > 0 ? s.correct / s.answers : 0,
        lastActiveAt: s?.lastActiveAt ?? null,
      };
    });

  const byLessonList: ByLesson[] = [...byLesson.entries()].map(
    ([lessonId, v]) => ({
      lessonId,
      title: v.title,
      answered: v.answered,
      correctRate: v.answered > 0 ? v.correct / v.answered : 0,
    }),
  );

  const total = answers.length;
  return {
    memberCount: members.length,
    activeInWindow: activeIds.size,
    totalAnswers: total,
    correctRate: total > 0 ? correct / total : 0,
    windowDays,
    byLesson: byLessonList,
    topStudents,
    stragglers,
  };
}
