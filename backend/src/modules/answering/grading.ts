// 评分分发器 · Strategy pattern
// 每个策略声明自己处理的题型；dispatcher 用 Map 做 lookup，不再知道每种题型的细节。
// 加新题型 = 写一个新的 GradingStrategy 并加到 STRATEGIES 数组。
import type { Question } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';
import { flipStrategy } from './grading.flip.js';
import { guidedStrategy } from './grading.mockGuided.js';
import { objectiveStrategy } from './grading.objective.js';
import { openStrategy } from './grading.open.js';
import type { AnswerGrade, GradingContext, GradingStrategy } from './grading.strategy.js';

// 保留既有公开类型以维持向下兼容
export type { AnswerGrade, GradingContext, GradingStrategy };
export type GradeOptions = GradingContext;

const STRATEGIES: GradingStrategy[] = [
  flipStrategy,
  guidedStrategy,
  objectiveStrategy,
  openStrategy,
];

// Build type → strategy 索引一次；重复 type 会抛（策略冲突）
const BY_TYPE = (() => {
  const m = new Map<string, GradingStrategy>();
  for (const s of STRATEGIES) {
    for (const t of s.types) {
      if (m.has(t)) {
        throw new Error(`grading 策略冲突：题型 ${t} 被多个 strategy 声明`);
      }
      m.set(t, s);
    }
  }
  return m;
})();

export async function gradeAnswer(
  q: Question,
  answer: unknown,
  opts: GradingContext = {},
): Promise<AnswerGrade> {
  const s = BY_TYPE.get(q.type);
  if (!s) throw BadRequest(`不支持的题型 ${q.type}`);
  return s.grade(q, answer, opts);
}
