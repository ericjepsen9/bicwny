// Flip card（速记卡片）· v2.0
// 无对错判分。用户看正面→思考→翻转看答案→自评四档掌握度：
//   "again" | "hard" | "good" | "easy"
// 四档直接映射为 SM-2 quality 0..5（Anki 风格）。
// 本 grader 只把自评转成 GradeResult，真正的间隔重排由 sm2 服务处理。
import type { Question } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';
import type { GradeResult } from './grading.objective.js';

export type FlipSelfRating = 'again' | 'hard' | 'good' | 'easy';

export interface FlipGradeResult extends GradeResult {
  sm2Quality: number; // 0..5
  selfRating: FlipSelfRating;
}

// Anki → SM-2 quality 映射
//   again  0 (完全忘记 / 需要立即再练)
//   hard   3 (想起来但费力)
//   good   4 (正常想起)
//   easy   5 (非常轻松)
const RATING_TO_QUALITY: Record<FlipSelfRating, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

export function gradeFlip(q: Question, answer: unknown): FlipGradeResult {
  if (q.type !== 'flip') {
    throw BadRequest(`gradeFlip 仅支持 flip 题，得到 ${q.type}`);
  }
  const rating = (answer as { selfRating?: FlipSelfRating })?.selfRating;
  if (!rating || !(rating in RATING_TO_QUALITY)) {
    throw BadRequest('flip 题必须提交 selfRating: again | hard | good | easy');
  }
  const quality = RATING_TO_QUALITY[rating];
  // flip 无严格对错；"again" 视为需要再练（isCorrect=false 以便进错题本）
  // "hard"/"good"/"easy" 视为已掌握
  const isCorrect = rating !== 'again';
  // 分数用作 UI 反馈：0/60/80/100
  const score = { again: 0, hard: 60, good: 80, easy: 100 }[rating];
  return {
    isCorrect,
    score,
    feedback: `自评：${rating}`,
    sm2Quality: quality,
    selfRating: rating,
  };
}
