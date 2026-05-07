// 更新 question_generation prompt template · 强化 fill 题约定
//
// 跑：cd backend && npx tsx scripts/update-llm-prompt.ts
//
// 背景：seed 文件用 upsert + 空 update · DB 已有模板不会自动覆盖 ·
// 需要显式跑这个脚本同步最新版本到 prod。
import { PrismaClient } from '@prisma/client';

const PROMPT = `你是觉学佛法题库的出题助手，请基于给定法本原文，产出指定类型的题目。

【课程】{{courseTitle}}
【章节 · 课时】{{chapterTitle}} · {{lessonTitle}}
【法本原文】
{{passage}}

【要求】
- 题型：{{type}}
- 数量：{{count}}
- 难度：{{difficulty}}（1=基础 / 2=普通 / 3=进阶 / 4=难 / 5=挑战）
- 语言：简体中文
- 杜绝常识性错误、避免引入经文外的观点；涉及名相保留佛法标准表述
- 每题 questionText 与 payload 必须一一对应，不得自相矛盾

【各题型 payload 形状约定】
- single  : { options: [{ text: string, correct: boolean }] }   // 恰有 1 个 correct=true
- multi   : { options: [{ text: string, correct: boolean }], scoringMode: "partial" }  // 至少 2 个 correct=true
- fill    : { verseLines: string[], correctWord: string, mode: "typing" | "choice", options?: string[], verseSource: string }
            // ⚠️ 关键：verseLines 必须用 ____（4 个下划线）标记空位
            //   错例：verseLines = ["《大圆满前行》分为三部分：共同前行、不共前行、往生法。"]
            //         （把答案 '往生法' 写在原文里 · 学员看不到空位）
            //   对例：verseLines = ["《大圆满前行》分为三部分：共同前行、不共前行、____。"]
            //         correctWord = "往生法"
            //         mode = "typing"
            // mode 选择：
            //   "typing" (推荐 · 默认) · 学员手动输入 · options 可省
            //   "choice" (选词填空) · options 必填 · 正好 4 个字串 · 第 1 个就是 correctWord
- sort    : { items: [{ text: string, order: number }] }        // order 从 1 起
- match   : { left: [{ id, text }], right: [{ id, text, match }] }  // match 指向 left.id
- open    : { referenceAnswer: string, keyPoints: [{ point: string, signals: string[] }], minLength: 80, maxLength: 400 }
- scenario: { scenario: string, options: [{ text, correct, reason }] }  // 至少 2 correct，每项必须给 reason
- guided  : { finalQuestion: string, steps: [{ stepNum: number, prompt: string, hint?: string, keyPoints: string[] }] }

【输出 —— 严格 JSON 数组，不要使用 markdown 代码块】
[
  {
    "type": "{{type}}",
    "questionText": "<题干>",
    "correctText": "<正确答案的可读文本>",
    "wrongText": "<常见错误说明，可为空串>",
    "difficulty": {{difficulty}},
    "tags": ["<1-3 个中文标签>"],
    "source": "{{source}}",
    "payload": { ... 按题型约定 ... }
  }
  // ... 共 {{count}} 条 ...
]`;

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.llmPromptTemplate.updateMany({
    where: { scenario: 'question_generation', isActive: true },
    data: { content: PROMPT },
  });
  console.log(`✓ 更新 ${result.count} 条 question_generation prompt template`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
