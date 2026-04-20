"""
觉学题库生成器 · MiniMax API 版
基于《入菩萨行论》讲记自动生成题卡
"""

import os
import json
import time
from openai import OpenAI

# ===== 配置区 =====
API_KEY = "your_minimax_api_key_here"  # 换成你的 MiniMax API Key
MODEL = "MiniMax-M2.7"                  # 可选 M2.7 / M2.5 / M2.1
OUTPUT_FILE = "questions.json"
SLEEP_BETWEEN = 2                       # 每次调用间隔秒，避免限流

# MiniMax 官方 API 端点
client = OpenAI(
    api_key=API_KEY,
    base_url="https://api.minimaxi.com/v1"
)

# ===== 题卡生成 Prompt 模板 =====
SYSTEM_PROMPT = """你是藏传佛教教理题库编辑专家，精通《入菩萨行论》。
你的任务：基于用户提供的讲记段落，生成标准格式的佛法题卡。

严格要求：
1. 所有题目必须忠于讲记原文，不得脱离讲记义理
2. 干扰选项要合理，体现常见误解，不能太离谱
3. 讲解部分要准确，宁可简短也不要编造
4. 出处必须精确到品名和颂号
5. 只输出 JSON 数组，不要任何其他文字、解释或 markdown 标记
"""

USER_PROMPT_TEMPLATE = """【讲记原文】
章节：{chapter}
颂词范围：{verse_range}

{content}

【任务】
基于上述讲记，生成 {num} 道题卡，题型均衡分布在以下 6 种中：
- single：单选题（四选一）
- fill：填空题（颂文填一个空）
- image：佛像/法器辨识题（四选一）
- listen：听颂选答（四选一，此题暂用文字描述听到的内容）
- sort：排序题（4 个选项按次第排列）
- match：名相配对（4 对左右配对）

【输出 JSON 格式】
[
  {{
    "type": "single",
    "typeLabel": "单选题",
    "chapter": {chapter},
    "verseRange": "{verse_range}",
    "question": "题目文字",
    "options": [
      {{"text": "选项A", "correct": false}},
      {{"text": "选项B", "correct": true}},
      {{"text": "选项C", "correct": false}},
      {{"text": "选项D", "correct": false}}
    ],
    "correctText": "答对讲解 50-80 字",
    "wrongText": "答错时的正解说明",
    "source": "出处：《入菩萨行论》第{chapter}品·XX颂"
  }}
]

对于 fill 类型，字段结构是：
{{
  "type": "fill",
  "typeLabel": "填空题",
  "question": "补全颂词：",
  "verseLines": ["第一行", "第二行带___的", "第三行", "第四行"],
  "verseSource": "出处",
  "correctWord": "正确答案",
  "options": ["正确答案", "干扰1", "干扰2", "干扰3"],
  "correctText": "...",
  "wrongText": "...",
  "source": "..."
}}

对于 sort 类型：
{{
  "type": "sort",
  "typeLabel": "排序题",
  "question": "请按次第排列：",
  "items": [
    {{"text": "第一步", "order": 1}},
    {{"text": "第二步", "order": 2}},
    {{"text": "第三步", "order": 3}},
    {{"text": "第四步", "order": 4}}
  ],
  "correctText": "...",
  "wrongText": "...",
  "source": "..."
}}

对于 match 类型：
{{
  "type": "match",
  "typeLabel": "名相配对",
  "question": "配对题目",
  "left": [
    {{"id": "a", "text": "名相1"}},
    {{"id": "b", "text": "名相2"}},
    {{"id": "c", "text": "名相3"}},
    {{"id": "d", "text": "名相4"}}
  ],
  "right": [
    {{"id": "1", "text": "释义1", "match": "a"}},
    {{"id": "2", "text": "释义2", "match": "b"}},
    {{"id": "3", "text": "释义3", "match": "c"}},
    {{"id": "4", "text": "释义4", "match": "d"}}
  ],
  "correctText": "...",
  "wrongText": "...",
  "source": "..."
}}

只输出 JSON 数组，不要 ```json 标记，不要任何其他文字。
"""

# ===== 核心生成函数 =====
def generate_cards(chapter, verse_range, content, num=6):
    """生成题卡，返回 list of dict"""
    user_prompt = USER_PROMPT_TEMPLATE.format(
        chapter=chapter,
        verse_range=verse_range,
        content=content,
        num=num
    )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        text = response.choices[0].message.content.strip()

        # 去掉可能的 markdown 包裹
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        cards = json.loads(text)
        return cards

    except json.JSONDecodeError as e:
        print(f"  ❌ JSON 解析失败: {e}")
        print(f"  原始输出前 300 字: {text[:300]}")
        return []
    except Exception as e:
        print(f"  ❌ API 调用失败: {e}")
        return []

# ===== 讲记数据 · 你把你的讲记按此格式组织 =====
LECTURES = [
    {
        "chapter": 3,
        "verse_range": "1-8",
        "content": """
【颂文】
为持珍宝心，我今修供养。
无垢妙法宝，佛子功德海。
鲜花与珍果，各式诸良药，
世间珍宝物，悦意澄净水。
巍巍珍宝山，静谧宜人林，
花树珠宝树，珍果满枝桠...

【讲记】
这一段是《入菩萨行论》第三品受持菩提心的开端，寂天菩萨首先宣讲七支供养中的供养支。
为什么要修供养呢？论中讲「为持珍宝心」——为了持有珍宝般的菩提心，必须先积累广大的福德资粮。
供养的对境是三宝：佛宝（佛陀）、法宝（妙法）、僧宝（佛子，即菩萨僧众）。
供养的物品分两类：一是「有主物供养」，即实际拥有的鲜花、珍果、药物、水等；
二是「无主物供养」——大自然中的山川林木、花果水池，一切美好事物都可以在心中观想供养给三宝。
修供养的根本动机不是讨好三宝，而是为了圆满自己的福德资粮，为受持菩提心做准备。
"""
    },
    # 继续添加更多颂词...
    # {
    #     "chapter": 3,
    #     "verse_range": "9-16",
    #     "content": "..."
    # },
]

# ===== 主流程 =====
def main():
    all_cards = []

    # 续写模式：如果已有文件，先读取
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            all_cards = json.load(f)
        print(f"📂 已加载现有 {len(all_cards)} 道题")

    for idx, lec in enumerate(LECTURES):
        print(f"\n[{idx+1}/{len(LECTURES)}] 正在生成 · 第{lec['chapter']}品 · 颂{lec['verse_range']}")

        cards = generate_cards(
            chapter=lec["chapter"],
            verse_range=lec["verse_range"],
            content=lec["content"],
            num=6
        )

        if cards:
            all_cards.extend(cards)
            print(f"  ✅ 生成 {len(cards)} 道题 · 累计 {len(all_cards)} 道")

            # 每次都保存（防中断）
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(all_cards, f, ensure_ascii=False, indent=2)

        time.sleep(SLEEP_BETWEEN)

    print(f"\n🎉 完成！共 {len(all_cards)} 道题，已保存到 {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
