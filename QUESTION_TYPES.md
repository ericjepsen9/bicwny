# 📘 觉学 · 6 种题型完整说明

> 原型 & 后端共用的题型参考 · 新会话继续完善前先读这里

---

## 🎯 题型总览

| 枚举 | 中文 | 评分方式 | 答题体验 |
|---|---|---|---|
| `single` | 单选题 | 纯对错 | 4 选项点击 |
| `fill` | 填空题 | 纯对错 | 偈颂中填字 |
| `multi` | 多选题（判断） | strict / partial | 多选 + 扣分规则 |
| `open` | 开放作答 | AI 打分 0-100 | 大文本框 + 字数约束 |
| `sort` | 排序题 | 按比例给分 | 拖拽 / 点击排序 |
| `match` | 配对题 | 按比例给分 | 左右连线 |

---

## 1️⃣ `single` · 单选题

### 数据结构（`payload`）
```json
{
  "options": [
    { "text": "龙树菩萨", "correct": false },
    { "text": "寂天菩萨", "correct": true },
    { "text": "月称论师", "correct": false },
    { "text": "宗喀巴大师", "correct": false }
  ]
}
```

### 用户答案（`answer`）
```json
{ "selectedIndex": 1 }
```

### 判分逻辑
- `selectedIndex` 指向的选项 `correct === true` → 100 分
- 否则 → 0 分

### UI 特点
- 4 个选项纵向排列
- 单选圆点
- 选中后 → 显示解析

### Seed 示例（6 道）
- 作者（龙树 / 寂天 / 月称 / 宗喀巴）
- 宗派（唯识 / 中观 / 说一切有部 / 经量部）
- 菩提心"劫末火"喻
- 愿菩提心譬喻
- 七支供不包含项
- "善逝"含义

---

## 2️⃣ `fill` · 填空题（偈颂）

### 数据结构
```json
{
  "verseLines": ["暇满人身极＿＿得，", "既得能办人生利。"],
  "correctWord": "难",
  "options": ["难", "易", "可", "不"],
  "verseSource": "《入行论·菩提心利益品》"
}
```

### 用户答案（两种）
```json
// 方式 A：直接输入
{ "value": "难" }

// 方式 B：从选项选
{ "selectedOption": 0 }
```

### 判分逻辑
- `.trim()` 后与 `correctWord` 严格匹配 → 100 分
- 否则 → 0 分

### UI 特点
- 偈颂两行展示，中间 `＿＿` 占位
- 下方 4 个选项卡片（可点击）或输入框
- 显示答案后高亮正确项 + 出处

### Seed 示例（3 道）
- 暇满人身极**难**得
- 菩提心如**劫**末火
- 如昔诸**善逝**，先发菩提心

---

## 3️⃣ `multi` · 多选题（判断）

### 数据结构
```json
{
  "scoringMode": "partial",
  "options": [
    { "text": "菩提心能刹那净除无始重罪", "correct": true },
    { "text": "菩提心是一切大乘善法之根本", "correct": true },
    { "text": "菩提心只对出家众有效", "correct": false },
    { "text": "发菩提心可速疾圆成佛果", "correct": true },
    { "text": "发菩提心即可取代闻思修", "correct": false }
  ]
}
```

### 用户答案
```json
{ "selectedIndexes": [0, 1, 3] }
```

### 判分逻辑（关键）

**`scoringMode: "strict"`**：全对才 100，否则 0

**`scoringMode: "partial"`**：
- 每个正确选中 · **+1 点**
- 每个错选 · **-1 点**
- 漏选 · **不扣**
- 归一：`max(0, round(points / correctCount × 100))`

### UI 特点
- 选项前有方框（✓ 可多选）
- 需要"提交"按钮（不像单选点即定）
- 显示答案后 · 正确选项绿 / 错选红 / 漏选黄

### Seed 示例（3 道）· 全 `partial`
- 菩提心功德（3 正 2 误 = 5 项）
- 愿行菩提心区别（3 正 2 误）
- 七支供内容（4 正 2 误）

---

## 4️⃣ `open` · 开放作答（AI 评分）

### 数据结构
```json
{
  "referenceAnswer": "菩提心以利益一切众生为所缘...",
  "keyPoints": [
    {
      "point": "心量广大 · 利益一切众生",
      "signals": ["利益一切", "一切众生", "众生", "为利", "度众生", "广大"]
    },
    {
      "point": "对治我执 / 自私心",
      "signals": ["我执", "自私", "对治", "净除", "罪业"]
    },
    {
      "point": "发起如来种性",
      "signals": ["如来种性", "佛性", "种子", "因", "根基"]
    }
  ],
  "minLength": 30,
  "maxLength": 400,
  "gradingHint": "宽松：涉及 2 点及格，覆盖 3 点优秀。",
  "strictMode": false
}
```

### 用户答案
```json
{ "text": "菩提心利益一切众生..." }
```

### 判分逻辑（两条路）

**默认 · Mock grader（离线，无需 LLM API Key）**：
- 按 `signals` 子串匹配每个 `keyPoint`
- 覆盖数 / 总数 → `30 + 比例 × 70` → 映射 0-100
- 字数 < `minLength` → 压到 ≤ 50
- 字数 > `maxLength × 1.3` → 扣 10

**LLM grader**（请求带 `useLlm: true`）：
- 走 `gateway.chat('open_grading')`
- MiniMax 主路 / Claude 兜底
- 返回 `{ score, covered[], missing[], feedback }`
- LLM 调用失败 → 自动降级 mock

### 评分档位
- **90-100** 圆满 ✨
- **75-89** 良好
- **60-74** 及格
- **40-59** 待补充
- **< 40** 请重新思考

### UI 特点
- 大文本框 · 实时字数计数
- "显示参考答案" 按钮
- 提交后等待 → 显示 `{ score, covered, missing, feedback }`
- Mock vs LLM 有 badge 区分（`source: "mock_open" | "llm_open"`）

### Seed 示例（2 道）
- 菩提心为何能"刹那净除无始重罪"？（3 要点）
- "为利有情愿成佛"理解（4 要点）

---

## 5️⃣ `sort` · 排序题

### 数据结构
```json
{
  "items": [
    { "text": "顶礼支", "order": 1 },
    { "text": "供养支", "order": 2 },
    { "text": "忏悔支", "order": 3 },
    { "text": "随喜支", "order": 4 },
    { "text": "请转法轮支", "order": 5 },
    { "text": "请佛住世支", "order": 6 },
    { "text": "回向支", "order": 7 }
  ]
}
```

UI 展示时 `items` 顺序会**打乱**（前端 shuffle）。

### 用户答案
```json
{ "order": [0, 2, 1, 3, 4, 5, 6] }
```

`[0, 2, 1, ...]` 表示：第 1 位放 `items[0]`，第 2 位放 `items[2]`，…

### 判分逻辑
- 对每一位 `i`：`items[userOrder[i]].order === i + 1` → 命中
- 命中数 / 总数 × 100（四舍五入）
- 项数不符 → 0 分

### UI 特点
- 可拖拽卡片重排（HTML5 drag 或 mobile hold）
- 当前顺序数字徽章
- 提交后 · 错位项高亮红

### Seed 示例（3 道）
- 七支供次第（7 项）
- 大乘修学次第（5 项）
- 受持菩提心仪轨（5 项）

---

## 6️⃣ `match` · 配对题

### 数据结构
```json
{
  "left": [
    { "id": "L1", "text": "布施度" },
    { "id": "L2", "text": "持戒度" },
    { "id": "L3", "text": "安忍度" },
    { "id": "L4", "text": "禅定度" },
    { "id": "L5", "text": "智慧度" }
  ],
  "right": [
    { "id": "R1", "text": "舍己所有利益他人", "match": "L1" },
    { "id": "R2", "text": "防护三门不造恶业", "match": "L2" },
    { "id": "R3", "text": "面对伤害安住不瞋", "match": "L3" },
    { "id": "R4", "text": "心专一境不散乱", "match": "L4" },
    { "id": "R5", "text": "通达诸法实相", "match": "L5" }
  ]
}
```

### 用户答案
```json
{
  "pairs": {
    "L1": "R1",
    "L2": "R2",
    "L3": "R3",
    "L4": "R4",
    "L5": "R5"
  }
}
```

### 判分逻辑
- 对每个右侧 `r`：检查 `pairs[r.match] === r.id`
- 命中数 / 右侧总数 × 100

### UI 特点
- 左右两栏卡片
- 点击左 → 点击右 = 连线
- 已连接显示 SVG 线（或颜色配对）
- 提交后 · 正确连线绿 / 错误红

### Seed 示例（3 道）
- 六度含义配对
- 佛陀十号释义配对
- 菩提心譬喻配对

---

## 🔑 6 种题型 · 共有字段

| 字段 | 作用 |
|---|---|
| `questionText` | 题干文本 |
| `correctText` | 答对时显示的解析 |
| `wrongText` | 答错时的提示 |
| `source` | 出处（如《入行论·供养品》） |
| `difficulty` | 难度 1-5（星级展示） |
| `tags` | 标签数组（用于筛选/搜索） |
| `visibility` | `public` / `class_private` / `draft` |
| `reviewStatus` | `pending` / `approved` / `rejected` |

---

## 📊 Seed 题库分布

```
入行论
├── 第 1 课 · 论名 · 礼敬 · 立誓
│   单选 × 2 (作者/宗派)
│   填空 × 1 (暇满)
│   排序 × 1 (大乘修学次第)
│
├── 第 2 课 · 菩提心之功德
│   单选 × 1 (劫末火)
│   填空 × 1 (劫末火)
│   多选 × 1 (功德 partial)
│   开放 × 1 (净罪原理)
│   配对 × 2 (菩提心譬喻 + 六度含义)
│
├── 第 3 课 · 愿行菩提心
│   单选 × 1 (愿心喻)
│   多选 × 1 (愿行区别)
│
├── 第 4 课 · 七支供养
│   单选 × 1 (非七支)
│   多选 × 1 (七支内容)
│   排序 × 1 (七支次第)
│
└── 第 5 课 · 正受菩提心
    单选 × 1 (善逝)
    填空 × 1 (诸善逝)
    开放 × 1 (为利有情)
    排序 × 1 (受戒仪轨)
    配对 × 1 (佛陀十号)

合计：6 single + 3 fill + 3 multi + 2 open + 3 sort + 3 match = 20 题
```

---

## 🔗 相关源文件

| 文件 | 内容 |
|---|---|
| `backend/prisma/seed/questions/single.ts` | 6 道 single seed |
| `backend/prisma/seed/questions/fill.ts` | 3 道 fill seed |
| `backend/prisma/seed/questions/multi.ts` | 3 道 multi seed |
| `backend/prisma/seed/questions/open.ts` | 2 道 open seed（含 keyPoints.signals） |
| `backend/prisma/seed/questions/sort.ts` | 3 道 sort seed |
| `backend/prisma/seed/questions/match.ts` | 3 道 match seed |
| `backend/src/modules/answering/grading.objective.ts` | 5 客观题判分（single/fill/multi/sort/match） |
| `backend/src/modules/answering/grading.mockOpen.ts` | open 题 mock 评分 |
| `backend/src/modules/answering/grading.ts` | 分发器 + LLM 对接（useLlm=true 时）|
| `backend/src/modules/answering/publicView.ts` | 剥答案（答前不让学员看到 correct/match 字段） |
| `student.html` · `page-quiz` | 答题 UI 实现（6 种 render 分支） |
| `backend/tests/grading.objective.test.ts` | 5 客观题判分单测（13 用例） |
| `backend/tests/grading.mockOpen.test.ts` | mock open 评分单测（7 用例） |

---

## 💡 扩展题型要注意什么

未来加新题型（如"判图题""听力题"）需改动的点：

1. **schema.prisma** · `QuestionType` enum 加值
2. **seed/questions/** · 新建 `xxx.ts` + `index.ts` 注册
3. **grading.objective.ts** 或 **grading.xxx.ts** · 实现判分
4. **grading.ts** · 在 `gradeAnswer` 分发器加分支
5. **publicView.ts** · `stripAnswers` 的 switch 加 case
6. **student.html** 答题页 · `renderXxx()` + CSS
7. **tests/** · 加对应单测

---

## 📖 使用场景

**学员端答题（student.html）**：
- 每道题点击 → 渲染对应 `renderXxx()`
- 答完 POST `/api/answers`
- 后端 `gradeAnswer()` → 返回 `grade + question 完整信息`
- UI 展示 score + feedback + correctText

**辅导员创建题目（coach.html · 创建题目页）**：
- 选题型 → 展示对应 payload 表单
- 提交 POST `/api/coach/questions`
- `visibility=class_private` 立即生效 / `public` 待审

**管理员审核（admin.html · 题目审核页）**：
- GET `/api/admin/questions/pending` 取队列
- 审核员预览题目（所有字段）
- approve / reject + AuditLog

---

**文档维护**：若后续题型结构变化，**请同步更新本文件**。
