// 班级学习聚合统计（辅导员面板）
// 审计 P4：DB 内按 (userId, lessonId) GROUP BY 聚合（结果≤成员×课时 · 有界），
//   不再把全班所有答题行拉进内存。Prisma groupBy 不支持按关系字段分组 → 用 $queryRaw 联表。
import { Prisma } from '@prisma/client';
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

  // 班级统计只算「本班主修法本」的答题 · 否则正确率 / 排行 / byLesson
  // 会混入学员在其它课程的答题数据（与单学员详情页 CO2 scope 对齐）
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { courseId: true } });

  const studentIds = members.map((m) => m.userId);
  const userLookup = new Map(members.map((m) => [m.userId, m.user]));

  const windowStart = new Date(Date.now() - windowDays * 86_400_000);
  const courseFilter = cls?.courseId ? Prisma.sql`AND q."courseId" = ${cls.courseId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{
    userId: string;
    lessonId: string;
    lessonTitle: string;
    answered: bigint;
    correct: bigint;
    windowAnswered: bigint;
    lastActiveAt: Date;
  }>>(Prisma.sql`
    SELECT ua."userId" AS "userId",
           q."lessonId" AS "lessonId",
           l.title AS "lessonTitle",
           COUNT(*) AS answered,
           COUNT(*) FILTER (WHERE ua."isCorrect" = true) AS correct,
           COUNT(*) FILTER (WHERE ua."answeredAt" >= ${windowStart}) AS "windowAnswered",
           MAX(ua."answeredAt") AS "lastActiveAt"
    FROM "UserAnswer" ua
    JOIN "Question" q ON q.id = ua."questionId"
    JOIN "Lesson" l ON l.id = q."lessonId"
    WHERE ua."userId" IN (${Prisma.join(studentIds)})
      ${courseFilter}
    GROUP BY ua."userId", q."lessonId", l.title
  `);

  const byLesson = new Map<string, { title: string; answered: number; correct: number }>();
  const byUser = new Map<
    string,
    { answers: number; correct: number; lastActiveAt: Date | null }
  >();
  const activeIds = new Set<string>();
  let correct = 0;
  let total = 0;

  for (const r of rows) {
    const answered = Number(r.answered);
    const corr = Number(r.correct);
    total += answered;
    correct += corr;
    if (Number(r.windowAnswered) > 0) activeIds.add(r.userId);

    const le = byLesson.get(r.lessonId) ?? { title: r.lessonTitle, answered: 0, correct: 0 };
    le.answered += answered;
    le.correct += corr;
    byLesson.set(r.lessonId, le);

    const ue = byUser.get(r.userId) ?? { answers: 0, correct: 0, lastActiveAt: null };
    ue.answers += answered;
    ue.correct += corr;
    if (!ue.lastActiveAt || r.lastActiveAt > ue.lastActiveAt) ue.lastActiveAt = r.lastActiveAt;
    byUser.set(r.userId, ue);
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
