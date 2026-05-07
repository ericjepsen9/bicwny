// 题干显示 helper · 处理 fill 题型 LLM 生成时 questionText 与 verseLines 重复的情况
//
// 现象：LLM 生成 fill 题时常把整条带空白的偈颂塞进 questionText · 同时 verseLines
//   也是同一句 · 导致 quiz / review / admin 页面顶部题干和 Fill 组件渲染的偈颂
//   显示同样内容（截图证据：'华智仁波切在上师前听过 _____ 遍...' 出现两次）
//
// 策略：检测 questionText 是否包含 verseLines 内容（前 8 字模糊匹配）·
//   是 → 显示通用 prompt · verse 由 Fill 组件渲染
//   否 → 原样返回（questionText 提供了额外上下文 · 不应丢）
//
// 设计为纯函数 · 跨 6 个题目展示入口共用：
//   - QuizPage 学员答题
//   - CoachQuestionsPage 抽屉
//   - AdminReviewPage 抽屉
//   - AdminReportsPage 卡片
//   - QuestionAdminInline 列表展开
//   - CoachQuestionGeneratePage 生成预览（GenQuestionRow）
type S = (sc: string, tc: string, en?: string) => string;

interface QLike {
  type: string;
  questionText: string;
  // 各题型 payload 形态不同 · 只读取 verseLines · 允许 undefined / 任意 shape
  payload?: { verseLines?: string[] } & Record<string, unknown>;
}

export function displayQuestionText(q: QLike, s: S): string {
  if (q.type === 'fill') {
    const verseLines = q.payload?.verseLines ?? [];
    const verseHead = (verseLines[0] ?? '')
      .replace(/[_＿]+|（_+）/g, '')
      .trim()
      .slice(0, 8);
    if (verseHead.length >= 4 && q.questionText.includes(verseHead)) {
      return s('请将下列偈颂中的空格填入恰当的词语：', '請將下列偈頌中的空格填入恰當的詞語：', 'Fill the blank below:');
    }
  }
  return q.questionText;
}
