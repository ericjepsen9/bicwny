// 共享题型 props · 每个 renderer 实现这个接口
import type { QuestionPublic } from '@/lib/queries';

export interface QuestionRendererProps {
  question: QuestionPublic;
  /** 当前用户答案 · 父组件控值 */
  value: unknown;
  onChange: (next: unknown) => void;
  /** 是否已提交 · true 时禁用交互 + 显示对错 */
  confirmed: boolean;
  /** 后端返回的 grade · confirmed 后才有 */
  grade?: { isCorrect: boolean | null; score: number | null; feedback: string };
}

export type AnswerValue =
  | { selectedIndex: number }
  | { selectedIndexes: number[] }
  | { selectedOption: number }
  | { text: string }
  | { items: Array<{ text: string; order: number }> }
  | { pairs: Record<string, string> }
  | { __placeholder: true }
  | null;
