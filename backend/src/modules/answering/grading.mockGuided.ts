// Guided（引导分步）· v2.0 mock grader
// Spec:
//   payload: { finalQuestion, steps: [{stepNum, prompt, hint?, keyPoints: string[]}] }
//   answer:  { stepAnswers: Record<stepNum, string> }  // 每步用户文本作答
// 最终上线时每步会走 LLM（与 open 一样），此 mock 只用 keyPoints 词频命中做打分，
// 用于 Sprint 联调与离线测试。
import type { Question } from '@prisma/client';
import { BadRequest } from '../../lib/errors.js';
import type { GradeResult } from './grading.objective.js';
import type { GradingStrategy } from './grading.strategy.js';

interface GuidedStep {
  stepNum: number;
  prompt: string;
  hint?: string;
  keyPoints: string[];
}

export interface GuidedStepResult {
  stepNum: number;
  score: number; // 0..100
  hits: string[]; // 命中的 keyPoint
  missed: string[];
}

export interface GuidedGradeResult extends GradeResult {
  perStep: GuidedStepResult[];
}

export function gradeMockGuided(q: Question, answer: unknown): GuidedGradeResult {
  if (q.type !== 'guided') {
    throw BadRequest(`gradeMockGuided 仅支持 guided 题，得到 ${q.type}`);
  }
  const payload = (q.payload ?? {}) as { steps?: GuidedStep[] };
  const steps = payload.steps ?? [];
  const stepAnswers =
    ((answer as { stepAnswers?: Record<string, string> })?.stepAnswers ?? {});

  if (steps.length === 0) {
    throw BadRequest('guided 题 payload.steps 不能为空');
  }

  const perStep: GuidedStepResult[] = steps.map((step) => {
    const userText = (stepAnswers[String(step.stepNum)] ?? '').trim();
    if (!userText) {
      return {
        stepNum: step.stepNum,
        score: 0,
        hits: [],
        missed: [...step.keyPoints],
      };
    }
    const hits: string[] = [];
    const missed: string[] = [];
    for (const kp of step.keyPoints) {
      if (userText.includes(kp)) hits.push(kp);
      else missed.push(kp);
    }
    const score =
      step.keyPoints.length === 0
        ? (userText.length > 0 ? 100 : 0)
        : Math.round((hits.length / step.keyPoints.length) * 100);
    return { stepNum: step.stepNum, score, hits, missed };
  });

  const avg =
    Math.round(perStep.reduce((s, r) => s + r.score, 0) / perStep.length);
  const allPassed = perStep.every((r) => r.score >= 60);
  return {
    isCorrect: avg >= 80 && allPassed,
    score: avg,
    feedback:
      avg >= 80 ? undefined : `整体 ${avg}/100 · 部分步骤未达标`,
    perStep,
  };
}

export const guidedStrategy: GradingStrategy = {
  types: ['guided'],
  async grade(q, answer) {
    const r = gradeMockGuided(q, answer);
    return {
      isCorrect: r.isCorrect,
      score: r.score,
      feedback: r.feedback,
      perStep: r.perStep,
      source: 'mock_guided',
    };
  },
};
