// Open 题（问答）策略
// 默认 mock（keyPoint 子串命中）；ctx.useLlm=true 时走 gateway.chat('open_grading')。
// LLM 失败（网络/解析/所有 provider 不可用）→ 自动降级到 mock，保证答题流不中断。
import type { Question } from '@prisma/client';
import { chat, type ChatContext } from '../llm/gateway.js';
import { loadPromptTemplate, renderPrompt } from '../llm/prompt.js';
import { gradeMockOpen } from './grading.mockOpen.js';
import type { AnswerGrade, GradingStrategy } from './grading.strategy.js';

// 防 prompt injection / DoS：用户答案最长 4KB · 超长截断
//   理由：开放题正常答案 200-800 字 · 4KB 已远超人类输入速度
//   触发降级到 mock 不抛错 · 用户体验不受影响
const MAX_STUDENT_ANSWER_LEN = 4000;

// 控制字符（除 \n \t）替换为空格 · 防止 ANSI / 终端控制序列影响 LLM 解析
function sanitizeUserText(s: string): string {
  const truncated = s.length > MAX_STUDENT_ANSWER_LEN
    ? s.slice(0, MAX_STUDENT_ANSWER_LEN)
    : s;
  // eslint-disable-next-line no-control-regex
  return truncated.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ');
}

export const openStrategy: GradingStrategy = {
  types: ['open'],
  async grade(q, answer, ctx) {
    if (ctx.useLlm) {
      try {
        return await gradeOpenWithLlm(q, answer, ctx.llmCtx ?? {});
      } catch (e) {
        console.warn(
          '[grading] LLM open_grading 失败，降级到 mock：',
          e instanceof Error ? e.message : e,
        );
      }
    }
    const m = gradeMockOpen(q, answer);
    return {
      isCorrect: m.isCorrect,
      score: m.score,
      feedback: m.feedback,
      covered: m.covered,
      missing: m.missing,
      source: 'mock_open',
    };
  },
};

async function gradeOpenWithLlm(
  q: Question,
  answer: unknown,
  ctx: ChatContext,
): Promise<AnswerGrade> {
  const payload = (q.payload ?? {}) as {
    referenceAnswer?: string;
    keyPoints?: Array<{ point: string; signals: string[] }>;
  };
  const rawStudent = String((answer as { text?: string })?.text ?? '');
  const studentAnswer = sanitizeUserText(rawStudent);
  const template = await loadPromptTemplate('open_grading');
  // 用 XML 标签包住用户内容 · 让 LLM 能区分'指令'和'被评数据'
  //   即使模板本身没用 tag · 在用户字符串外加 <student_answer>...</student_answer>
  //   可显著降低 prompt injection 成功率（模型更倾向于把 tag 内文本当数据）
  const prompt = renderPrompt(template, {
    question: q.questionText,
    referenceAnswer: payload.referenceAnswer ?? '',
    keyPoints: payload.keyPoints ?? [],
    studentAnswer: '<student_answer>\n' + studentAnswer + '\n</student_answer>',
  });

  const resp = await chat('open_grading', [{ role: 'user', content: prompt }], ctx);
  const parsed = parseGradeJson(resp.content);

  return {
    isCorrect: parsed.score >= 80,
    score: parsed.score,
    feedback: parsed.feedback,
    covered: parsed.covered,
    missing: parsed.missing,
    source: 'llm_open',
    raw: resp.content,
  };
}

interface ParsedGrade {
  score: number;
  covered: string[];
  missing: string[];
  feedback: string;
}

// 解析 LLM 输出 · 防御性：任何字段缺失 / 类型不对都回落到安全默认值
//   不再 trust LLM 输出（可能被注入诱导返回 score=100 + feedback='满分'）
//   - score：必须是 0-100 finite number · 否则 0
//   - feedback：截断到 2KB 防 DoS
//   - covered/missing：只保留 string · 数组项截断到 200 字符
function parseGradeJson(text: string): ParsedGrade {
  // 剥除可能的 markdown 代码块围栏
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let obj: Partial<ParsedGrade>;
  try {
    obj = JSON.parse(cleaned) as Partial<ParsedGrade>;
  } catch {
    return { score: 0, covered: [], missing: [], feedback: '评分解析失败' };
  }
  const rawScore = Number(obj.score);
  const score = Number.isFinite(rawScore) ? clamp(rawScore, 0, 100) : 0;
  return {
    score,
    covered: Array.isArray(obj.covered)
      ? obj.covered.slice(0, 50).map((x) => String(x).slice(0, 200))
      : [],
    missing: Array.isArray(obj.missing)
      ? obj.missing.slice(0, 50).map((x) => String(x).slice(0, 200))
      : [],
    feedback: String(obj.feedback ?? '').slice(0, 2000),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
