// 文本高亮服务
//   学员在 lesson 原文上画线 · 4 色 · 仅个人可见
//   锚点用 paragraphIndex + textStart/textEnd · 加 anchorText 快照供模糊定位
import { NotFound, Forbidden } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface CreateHighlightInput {
  lessonId: string;
  paragraphIndex: number;
  textStart: number;
  textEnd: number;
  anchorText: string;
  color: HighlightColor;
}

export async function listHighlights(userId: string, lessonId: string) {
  return prisma.highlight.findMany({
    where: { userId, lessonId },
    orderBy: [{ paragraphIndex: 'asc' }, { textStart: 'asc' }],
  });
}

export async function createHighlight(userId: string, input: CreateHighlightInput) {
  return prisma.highlight.create({
    data: {
      userId,
      lessonId: input.lessonId,
      paragraphIndex: input.paragraphIndex,
      textStart: input.textStart,
      textEnd: input.textEnd,
      anchorText: input.anchorText.slice(0, 200),
      color: input.color,
    },
  });
}

export async function deleteHighlight(userId: string, id: string) {
  const h = await prisma.highlight.findUnique({ where: { id } });
  if (!h) throw NotFound('高亮不存在');
  if (h.userId !== userId) throw Forbidden('不能删除他人高亮');
  await prisma.highlight.delete({ where: { id } });
}
