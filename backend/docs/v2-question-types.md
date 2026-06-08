# v2.0 题型后端就绪说明

覺學後端已为 v2.0 的 6 种新题型预备好 schema、API、评分逻辑和测试。
前端 UI 尚未实现，正式上线请按本文档对接。

## 6 种新题型一览

| type       | 评分路径                 | source 值       | 需要前端提交的 answer 形状                            |
| ---------- | ------------------------ | --------------- | ----------------------------------------------------- |
| `flip`     | `gradeFlip`              | `flip_self`     | `{ selfRating: "again" \| "hard" \| "good" \| "easy" }` |
| `image`    | `gradeObjective` → single | `objective`     | `{ selectedIndex: number }`                           |
| `listen`   | `gradeObjective` → single | `objective`     | `{ selectedIndex: number }`                           |
| `scenario` | `gradeObjective` → scenario | `objective`   | `{ selectedIndexes: number[] }`                       |
| `flow`     | `gradeObjective` → flow  | `objective`     | `{ placements: Record<slotId, itemText> }`            |
| `guided`   | `gradeMockGuided`        | `mock_guided`   | `{ stepAnswers: Record<stepNum, string> }`            |

## Payload 形状（创建题目时）

### flip
```json
{
  "front": { "text": "菩提心", "subText": "Bodhicitta" },
  "back":  { "text": "为利众生愿成佛之心...", "example": "如《入菩萨行论》..." },
  "noScoring": true
}
```

### image
```json
{
  "imageUrl": "https://cdn.../guanyin.jpg",
  "imageCaption": "千手观音像",
  "imageCredits": "图片版权：XX博物馆",
  "options": [
    { "text": "观世音菩萨", "correct": true },
    { "text": "文殊菩萨",   "correct": false }
  ]
}
```

### listen
```json
{
  "audioUrl": "https://cdn.../verse.mp3",
  "audioDuration": 15,
  "audioTranscript": "为持珍宝心...",
  "maxReplay": 3,
  "options": [...]
}
```

### scenario
```json
{
  "scenario": "有人无缘无故辱骂你...",
  "scenarioImage": "optional.jpg",
  "options": [
    { "text": "以安忍波罗蜜观照", "correct": true,  "reason": "正确：嗔心正应修忍" },
    { "text": "当场反驳",           "correct": false, "reason": "增长嗔心" }
  ]
}
```

### flow
```json
{
  "canvas": { "width": 400, "height": 400, "backgroundImage": "twelve-nidanas.svg" },
  "slots": [
    { "id": "s1", "x": 200, "y": 50, "correctItem": "无明" },
    { "id": "s2", "x": 320, "y": 120, "correctItem": "行" }
  ],
  "items": [{ "text": "无明" }, { "text": "行" }]
}
```

### guided
```json
{
  "finalQuestion": "为什么菩提心是大乘根本？",
  "steps": [
    { "stepNum": 1, "prompt": "定义", "hint": "考虑对象和目标", "keyPoints": ["为利众生", "愿成佛"] },
    { "stepNum": 2, "prompt": "3 个利益", "keyPoints": ["成佛因", "净罪障", "圆福德"] }
  ]
}
```

## publicView 剥除策略

`toPublicView()` 对 v2.0 类型做如下处理（前端看到的答前 payload）：

- **flip**: 正反面全部暴露（正常流程就是翻转看答案）
- **image / listen**: 剥除 `correct` 字段；听颂可选剥除 `audioTranscript`
- **scenario**: 剥除 `correct` + `reason`（答后由 `/answer` 返回）
- **flow**: 剥除 `correctItem`（只给 slot 坐标和 items 候选）
- **guided**: 剥除每步的 `keyPoints`（评分用）

## Migration

schema 改动仅新增 `QuestionType` 枚举值，Postgres 支持无痛 `ALTER TYPE ... ADD VALUE`。

```bash
cd backend
pnpm prisma generate     # 重新生成 TS 客户端
pnpm prisma migrate dev --name v2_question_types   # 或 db push
```

## v2.0 前端对接 checklist

- [ ] auth 页 → `/api/auth/login` 返回 JWT，前端存 localStorage
- [ ] quiz.html 状态机按 `type` 分派到 12 个 render 函数
- [ ] 12 种 answer 形状的收集逻辑（见上表）
- [ ] 提交 `/api/answering/submit` → 用后端 `grade` 结果渲染反馈
- [ ] **image / listen**：需 CDN 上传对应资源（S3/OSS + 签名 URL）
- [ ] **flow**：HTML5 drag-drop 或触摸事件（移动端）
- [ ] **guided**：每步独立输入框 + 步骤进度条
- [ ] **scenario**：每个选项展开展示 `reason`（无论选了没选）
- [ ] **flip**：翻转动画 + 4 档自评按钮（again/hard/good/easy）

## 题库编辑器（admin/coach 造题）

每个 v2.0 类型需要一个动态表单，由 `type` 决定渲染哪组字段。后端
`POST /api/coach/questions` 已接受全部 12 种 type（见 `coach.routes.ts`），
前端只需按上面 payload 形状收集 + 提交。
