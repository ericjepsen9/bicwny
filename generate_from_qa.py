"""
课后思考题处理脚本 · MiniMax API 版
把每道思考题扩展成多种题型
"""

import os
import json
import time
from openai import OpenAI

API_KEY = "your_minimax_api_key_here"
MODEL = "MiniMax-M2.7"
OUTPUT_FILE = "qa_cards.json"

client = OpenAI(
    api_key=API_KEY,
    base_url="https://api.minimaxi.com/v1"
)

# ═══════════════════════════════════════════════════════
# 策略一：原样转录（忠实保留法师原文）
# ═══════════════════════════════════════════════════════
SYSTEM_EXACT = """你是佛法题库转录员。你的唯一任务是把已有的「课后思考题 + 标准答案」
转换成标准 JSON 格式，不改动原意、不增减内容。严格忠实于原文。"""

PROMPT_EXACT = """【原始思考题】
章节：{chapter}
第几课：{lesson_num}
问题：{question}
标准答案：{answer}

【任务】
将上述思考题按以下 JSON 格式输出（open 类型 = 开放问答题，由 AI 评分）：

{{
  "type": "open",
  "typeLabel": "思考题",
  "chapter": {chapter},
  "lessonNum": {lesson_num},
  "question": "题目原文",
  "referenceAnswer": "法师给出的标准答案全文，不要改动",
  "keyPoints": ["答案核心要点1", "答案核心要点2", "答案核心要点3"],
  "gradingHint": "评分时重点看这几个方面",
  "source": "出处：第{chapter}品·第{lesson_num}课思考题"
}}

只输出 JSON 对象，不要 markdown 标记，不要其他文字。
keyPoints 从答案中提取 3-5 个核心得分点，用于 AI 评分时判断用户是否答到要点。
"""

# ═══════════════════════════════════════════════════════
# 策略二：一题多变（派生多种题型）
# ═══════════════════════════════════════════════════════
SYSTEM_DERIVE = """你是佛法题库扩展员，擅长把一道思考题扩展成多种互相关联的题型。
所有派生题目必须忠于原答案的义理，不得编造新观点。"""

PROMPT_DERIVE = """【原始思考题】
章节：{chapter}
第几课：{lesson_num}
问题：{question}
标准答案：{answer}

【任务】
基于上述思考题和答案，派生 3 道不同题型的题卡。要求：
1. 所有题目必须能从「标准答案」中找到依据
2. 不得编造答案之外的新内容
3. 题型搭配：必须包含 single、fill、match/sort 至少一种

【输出 JSON 数组】
[
  {{
    "type": "single",
    "typeLabel": "单选题",
    "chapter": {chapter},
    "lessonNum": {lesson_num},
    "question": "题目（基于原答案某个要点）",
    "options": [
      {{"text": "选项A", "correct": false}},
      {{"text": "选项B", "correct": true}},
      {{"text": "选项C", "correct": false}},
      {{"text": "选项D", "correct": false}}
    ],
    "correctText": "答对时的简短讲解（引用原答案关键句）",
    "wrongText": "答错时的正解",
    "source": "出处：第{chapter}品·第{lesson_num}课思考题"
  }},
  {{
    "type": "fill",
    "typeLabel": "填空题",
    ...
  }},
  {{
    "type": "match",
    "typeLabel": "名相配对",
    ...
  }}
]

题型 JSON schema 参见其它文档。
只输出 JSON 数组，不要 markdown 标记。
"""

# ═══════════════════════════════════════════════════════
# 核心生成函数
# ═══════════════════════════════════════════════════════
def generate_open_card(qa):
    """策略一：生成原题保留卡"""
    prompt = PROMPT_EXACT.format(**qa)
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_EXACT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,  # 低温度保证忠实
            max_tokens=2000
        )
        text = response.choices[0].message.content.strip()
        text = strip_md(text)
        return json.loads(text)
    except Exception as e:
        print(f"  ❌ open 类型生成失败: {e}")
        return None

def derive_cards(qa):
    """策略二：派生多种题型"""
    prompt = PROMPT_DERIVE.format(**qa)
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_DERIVE},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=3000
        )
        text = response.choices[0].message.content.strip()
        text = strip_md(text)
        return json.loads(text)
    except Exception as e:
        print(f"  ❌ 派生题生成失败: {e}")
        return []

def strip_md(text):
    """去掉可能的 markdown 代码块标记"""
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return text.strip()

# ═══════════════════════════════════════════════════════
# 数据：你的课后思考题按下面格式整理
# ═══════════════════════════════════════════════════════
COURSE_QA = [
    {
        "chapter": 1,
        "lesson_num": 1,
        "question": "什么是菩提心？它有哪些利益？",
        "answer": """菩提心是为了利益一切众生而发愿成佛的心。它是大乘佛法的根本，具有不可思议的利益：
一、菩提心是成佛之因。若无菩提心，虽修六度万行亦不能成佛。
二、菩提心能净除罪障。一念真实菩提心，能净无量劫所造罪业。
三、菩提心能圆满福德。菩提心如摩尼宝，能出生一切善法功德。
四、菩提心能令凡夫身转为佛子。初发菩提心即堕佛种性，堪受人天供养。"""
    },
    {
        "chapter": 3,
        "lesson_num": 1,
        "question": "七支供养具体指哪七支？各自作用是什么？",
        "answer": """七支供养是修持积资净障的根本方法，包括：
一、礼敬支——身口意三门恭敬顶礼诸佛菩萨，对治骄慢。
二、供养支——以有主物和无主物广作供养，对治悭贪。
三、忏悔支——于诸佛前至心忏悔所造罪业，净除业障。
四、随喜支——随喜他人善行功德，对治嫉妒。
五、请转法轮支——祈请诸佛菩萨宣说妙法。
六、请佛住世支——祈请诸佛不入涅槃长久住世。
七、回向支——将所有功德回向一切众生成就菩提。"""
    },
    # 继续添加你的全部思考题...
]

# ═══════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════
def main():
    all_cards = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            all_cards = json.load(f)
        print(f"📂 已加载 {len(all_cards)} 道题")

    for idx, qa in enumerate(COURSE_QA):
        print(f"\n[{idx+1}/{len(COURSE_QA)}] 第{qa['chapter']}品·第{qa['lesson_num']}课")
        print(f"  📝 原题：{qa['question'][:40]}...")

        # 策略一：原题保留
        open_card = generate_open_card(qa)
        if open_card:
            all_cards.append(open_card)
            print(f"  ✅ 保留原问答题")

        # 策略二：派生多种题型
        derived = derive_cards(qa)
        if derived:
            all_cards.extend(derived)
            print(f"  ✅ 派生 {len(derived)} 道题")

        # 实时保存
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(all_cards, f, ensure_ascii=False, indent=2)

        time.sleep(2)

    print(f"\n🎉 完成 · 共 {len(all_cards)} 道题")

if __name__ == "__main__":
    main()
