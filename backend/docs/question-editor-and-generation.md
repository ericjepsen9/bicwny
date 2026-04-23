# 题库编辑 · 批量导入 · LLM 辅助造题

> 本文档描述 Coach/Admin 侧的题目 CRUD 与 LLM 一键生成题卡的后端接口。
> 前端对接只需按下方 payload 形状传参即可。

## 1. CRUD 路由总览

| 方法     | 路径                              | 作用                       | 权限        |
| -------- | --------------------------------- | -------------------------- | ----------- |
| `POST`   | `/api/coach/questions`            | 创建单题                   | coach/admin |
| `GET`    | `/api/coach/questions`            | 自己创建的题（`?classId` 过滤） | coach/admin |
| `GET`    | `/api/coach/questions/:id`        | 详情                       | coach(本人) / admin |
| `PATCH`  | `/api/coach/questions/:id`        | 编辑题目                   | coach(本人未 approved) / admin |
| `DELETE` | `/api/coach/questions/:id`        | 删除题目（无答题记录时）   | coach(本人未 approved) / admin |
| `POST`   | `/api/coach/questions/batch`      | 批量导入 JSON              | coach/admin |
| `POST`   | `/api/coach/questions/generate`   | LLM 辅助造题               | coach/admin |
| `GET`    | `/api/admin/questions/pending`    | 待审队列                   | admin       |
| `POST`   | `/api/admin/questions/:id/review` | approve / reject           | admin       |

### 编辑规则（PATCH）

- **只能改自己创建的**；admin 超权
- **已 approved 的 public 题禁改**（会影响在学学员；如需改，admin 先驳回再编辑，或提交新题）
- **coach 改 public 题 → 状态回 `pending`**（需要复审）
- patch 不能为空

### 删除规则（DELETE）

- **只能删自己创建的**；admin 超权
- **已 approved 的 public 题禁删**
- **有任何 `UserAnswer` / `Sm2Card` 引用时禁删**（避免学习记录悬挂）；此时应走 admin 驳回通道
- 删除会写 `AuditLog`

### 批量导入（POST /batch）

```json
{
  "partial": false,              // true=逐条尝试；false=原子事务（默认）
  "items": [
    { "type": "single", "courseId": "...", ..., "payload": {...} },
    { "type": "multi",  ... }
  ]
}
```

- 单批上限 **200** 条
- strict 模式下任一失败整批回滚，响应 400
- partial 模式下响应 `207 Multi-Status` + `items[].ok/error`

## 2. LLM 辅助造题（POST /generate）

### 请求

```json
{
  "courseId": "course_ruxinglun",
  "chapterId": "ch_ruxinglun_01",
  "lessonId":  "lesson_ruxinglun_01_01",
  "passage":   "菩提心者，为利众生愿成佛之心也……（法本原文，≥20 字）",
  "type":      "single",
  "count":     5,
  "difficulty": 2,
  "visibility": "public",
  "ownerClassId": null,
  "source": "《入菩萨行论》第一品"
}
```

### 响应

```json
{
  "data": {
    "total": 5,
    "succeeded": 4,
    "failed": 1,
    "questions": [ /* Prisma Question 对象 */ ],
    "skipped": [
      { "index": 3, "reason": "需恰 1 个 correct=true", "raw": { ... } }
    ],
    "raw": "原始 LLM 文本（供 Admin 调试）"
  }
}
```

### 流程

1. 载入 lesson/chapter/course，校验层级一致
2. 渲染 `question_generation` prompt 模板（含 passage + type + count）
3. 走 LLM gateway：`minimax` 主通路 → `claude` 兜底
4. 解析 LLM 返回的 JSON 数组（自动剥除 markdown 围栏）
5. 逐条按 type 做结构校验（见下表），不合格的进 `skipped`
6. 合格的 bulk insert（`public` → `pending` · `class_private` → `approved`）

### 各题型结构校验规则

| type     | 规则 |
| -------- | ---- |
| single / image / listen | `options` ≥ 2 · 恰 **1** 个 `correct=true` |
| multi / scenario        | `options` ≥ 3 · 至少 **2** 个 `correct=true` |
| fill     | `verseLines` 数组 + `correctWord` 非空 |
| sort     | `items` ≥ 2 |
| match    | `left` / `right` 都非空 |
| open     | `referenceAnswer` + `keyPoints` 数组 |
| guided   | `steps` 非空 |
| flow     | `slots` 非空 |
| flip     | `front` + `back` 都有 |

**所有题型**都必须有 `questionText`（非空字符串）与 `payload`（对象）。

### Prompt 模板

种子文件：`prisma/seed/llm.ts` → `QUESTION_GENERATION_PROMPT`
版本：`question_generation/v1.0`
Admin 可通过 `/api/admin/llm/prompts/*` 更新（热生效）。

### 限额

- 单次请求 count 1–20
- 温度 0.7 / maxTokens 4000
- 日常 tokens 走 minimax 包年额度；超量自动切 claude

## 3. 状态机

```
                   (coach/admin) create
                         │
                         ├─ visibility=public     → reviewStatus=pending
                         ├─ visibility=class_private → reviewStatus=approved（本班可见）
                         │
(admin) review ─ approve → reviewStatus=approved
                ─ reject  → reviewStatus=rejected
                         │
     (coach) PATCH public → 回 pending（自动重审）
     (coach) DELETE       → 仅允许未 approved 且无答题记录
```

## 4. 部署须知

- 需已跑过 `pnpm prisma generate && pnpm prisma migrate dev` + `pnpm prisma:seed`
- `seed/llm.ts` 会写入 `open_grading` 与 `question_generation` 两个 scenario 及模板
- Admin 应在 `/api/admin/llm/providers` 检查 `minimax` `claude` 两个 provider 的 API key 是否配置（`MINIMAX_API_KEY` / `ANTHROPIC_API_KEY` 环境变量）
