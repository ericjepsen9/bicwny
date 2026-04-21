// 题目公开视图：剥除答案信息以防答前剧透。
// 供答题模块与 SM-2 模块共用（/api/questions/:id · /api/sm2/due）。
import type { Question, QuestionType } from '@prisma/client';

export interface PublicQuestion {
  id: string;
  type: QuestionType;
  courseId: string;
  chapterId: string;
  lessonId: string;
  difficulty: number;
  tags: string[];
  questionText: string;
  source: string;
  payload: Record<string, unknown>;
}

export function toPublicView(q: Question): PublicQuestion {
  return {
    id: q.id,
    type: q.type,
    courseId: q.courseId,
    chapterId: q.chapterId,
    lessonId: q.lessonId,
    difficulty: q.difficulty,
    tags: q.tags,
    questionText: q.questionText,
    source: q.source,
    payload: stripAnswers(q.type, q.payload),
  };
}

type P = Record<string, unknown>;

function stripAnswers(type: QuestionType, payload: unknown): P {
  const p = (payload ?? {}) as P;
  switch (type) {
    case 'single':
    case 'multi':
      return {
        ...(p.scoringMode ? { scoringMode: p.scoringMode } : {}),
        options: ((p.options ?? []) as Array<{ text: string }>).map((o) => ({ text: o.text })),
      };
    case 'fill':
      return {
        verseLines: p.verseLines,
        options: p.options,
        verseSource: p.verseSource,
      };
    case 'sort':
      return {
        items: ((p.items ?? []) as Array<{ text: string }>).map((it) => ({ text: it.text })),
      };
    case 'match':
      return {
        left: p.left,
        right: ((p.right ?? []) as Array<{ id: string; text: string }>).map((r) => ({
          id: r.id,
          text: r.text,
        })),
      };
    case 'open':
      return { minLength: p.minLength, maxLength: p.maxLength };
    default:
      return {};
  }
}
