// 笔记 LLM 增强 service · 5 个 action · 严约束 prompt · 不解释法义
import * as gateway from '../llm/gateway.js';

export type LlmAction = 'polish' | 'summarize' | 'tags' | 'title' | 'draft';

const SYSTEM_BASE = '你是觉学 app 的笔记助手。严格规则：不解释法义 · 不评价宗教内容 · 不发挥 · 不引申 · 仅按下方指令处理用户文本。';

const PROMPTS: Record<LlmAction, string> = {
  polish: `${SYSTEM_BASE}

任务：润色用户笔记的语言风格 · 改成通顺书面语。
约束：
- 不改变原意 · 不补充内容 · 不删减事实
- 不解释专有名词
- 输出仅返回润色后的全文 · 不加前缀后缀`,

  summarize: `${SYSTEM_BASE}

任务：提炼用户笔记的 3-5 行要点。
约束：
- 仅基于用户原文 · 不引申
- 每行 ≤ 30 字 · 用 - 开头
- 输出仅返回要点列表 · 不加前缀后缀`,

  tags: `${SYSTEM_BASE}

任务：从用户笔记提取 3-5 个标签。
约束：
- 每个标签 2-6 字的中文短词
- 仅基于已有内容 · 不引申
- 输出严格 JSON 数组格式，例如：["无常","因果","闻思"]`,

  title: `${SYSTEM_BASE}

任务：从用户笔记正文猜一个标题。
约束：
- ≤ 20 字
- 仅基于已有内容 · 不评价 · 不引申
- 输出仅返回标题字符串 · 不加引号 · 不加前缀后缀`,

  draft: `${SYSTEM_BASE}

任务：把用户提供的法本段落整理成笔记骨架。
绝对约束：
- 严禁解释段落 · 严禁添加任何法义阐释 · 严禁评论原文
- 仅做结构搭建 · 把原文原样作为引用块
- 输出格式严格如下（不要加任何其他内容）：

> [完整原文]

**我的理解**
（待补充...）

**我的疑问**
（待补充...）`,
};

export interface AssistResult {
  result: string | string[];
}

export async function llmAssist(action: LlmAction, text: string, userId: string): Promise<AssistResult> {
  const system = PROMPTS[action];
  const resp = await gateway.chat(
    'notes_assist',
    [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ],
    { userId, temperature: 0.4, maxTokens: 2000, timeoutMs: 30_000 },
  );
  const out = resp.content.trim();

  if (action === 'tags') {
    // 尝试解析 JSON 数组 · 失败则按行/逗号 fallback
    try {
      const arr = JSON.parse(out);
      if (Array.isArray(arr)) return { result: arr.map(String).slice(0, 8) };
    } catch { /* fallthrough */ }
    const tags = out
      .replace(/[\[\]"`]/g, '')
      .split(/[,，\n]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
    return { result: tags };
  }

  return { result: out };
}
