import type { Prisma, PrismaClient } from '@prisma/client';

// 使用 UncheckedCreateInput 允许直接写 courseId/chapterId/lessonId
// 而不必显式 connect 父关系
export type QuestionSeed = Prisma.QuestionUncheckedCreateInput;

export async function upsertQuestions(
  prisma: PrismaClient,
  questions: QuestionSeed[],
) {
  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id! },
      update: {},
      create: q,
    });
  }
}
