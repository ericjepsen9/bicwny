// 评分策略接口（Strategy pattern）
// 每种题型（或一组同源题型）注册一个 GradingStrategy，dispatch 只做 lookup。
// 便于：加新题型只需写一个 strategy 对象；单测按题型隔离。
import type { Question, QuestionType } from '@prisma/client';
import type { ChatContext } from '../llm/gateway.js';

export interface AnswerGrade {
  isCorrect: boolean;
  score: number;
  feedback?: string;
  covered?: string[];
  missing?: string[];
  source:
    | 'objective'
    | 'mock_open'
    | 'llm_open'
    | 'flip_self'
    | 'mock_guided';
  /** flip 题：SM-2 quality 0..5 */
  sm2Quality?: number;
  /** guided 题：每步详情 */
  perStep?: Array<{ stepNum: number; score: number; hits: string[]; missed: string[] }>;
  /** 仅 llm_open 保留：LLM 原始响应供 Admin 调试 */
  raw?: unknown;
}

export interface GradingContext {
  useLlm?: boolean;
  llmCtx?: ChatContext;
}

export interface GradingStrategy {
  /** 本策略声明能处理的题型，dispatcher 以此构建 type→strategy 的索引 */
  readonly types: QuestionType[];
  /** 同步的策略仍可返回 Promise.resolve()；open 走 LLM 时真正异步 */
  grade(q: Question, answer: unknown, ctx: GradingContext): Promise<AnswerGrade>;
}
