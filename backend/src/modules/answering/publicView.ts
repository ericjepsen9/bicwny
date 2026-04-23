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
    // ── v2.0 ──
    case 'image':
      return {
        imageUrl: p.imageUrl,
        imageCaption: p.imageCaption,
        imageCredits: p.imageCredits,
        options: ((p.options ?? []) as Array<{ text: string }>).map((o) => ({ text: o.text })),
      };
    case 'listen':
      return {
        audioUrl: p.audioUrl,
        audioDuration: p.audioDuration,
        // audioTranscript 可选择剥除：背听不给文稿
        ...(p.audioTranscript ? { audioTranscript: p.audioTranscript } : {}),
        ...(p.maxReplay !== undefined ? { maxReplay: p.maxReplay } : {}),
        options: ((p.options ?? []) as Array<{ text: string }>).map((o) => ({ text: o.text })),
      };
    case 'scenario':
      // reason 字段留到答题后由 /answer 返回作为反馈，答前只给选项文本
      return {
        scenario: p.scenario,
        scenarioImage: p.scenarioImage,
        options: ((p.options ?? []) as Array<{ text: string }>).map((o) => ({ text: o.text })),
      };
    case 'flow':
      // 保留 canvas + slots 的坐标（答题必需），剥除 correctItem
      return {
        canvas: p.canvas,
        slots: ((p.slots ?? []) as Array<{ id: string; x: number; y: number }>).map((s) => ({
          id: s.id,
          x: s.x,
          y: s.y,
        })),
        items: p.items,
      };
    case 'guided':
      // 保留步骤提示，剥除每步的 keyPoints（评分用）
      return {
        finalQuestion: p.finalQuestion,
        steps: ((p.steps ?? []) as Array<{
          stepNum: number;
          prompt: string;
          hint?: string;
        }>).map((s) => ({
          stepNum: s.stepNum,
          prompt: s.prompt,
          ...(s.hint ? { hint: s.hint } : {}),
        })),
      };
    case 'flip':
      // 正反面都要暴露（用户翻转看答案是正常流程），但没有"正确选项"可剥
      return {
        front: p.front,
        back: p.back,
        noScoring: true,
      };
    default:
      return {};
  }
}
