# 觉学 JueXue · Backend

大乘佛法学习 App 的服务端（Sprint 1–3）。覆盖：

- **Sprint 1**：答题模块 + SM-2 间隔复习 + LLM Gateway（MiniMax 主 / Claude 兜底）
- **Sprint 2**：真 JWT 认证 + 三级角色（admin / coach / student） + 班级系统 + 题库双轨创建
- **Sprint 3**：学员学习路径（浏览论典 / 报名 / 进度）+ 自助功能（收藏 / 错题本 / 举报）+ Admin 运维（LLM 面板 / 用户管理 / 平台大盘 / 审计日志）

## 技术栈

- **运行时**：Node.js 22 · TypeScript · ESM（NodeNext）
- **HTTP**：Fastify 5 · @fastify/cors · @fastify/jwt
- **校验**：Zod 3
- **ORM**：Prisma 6 · PostgreSQL 16
- **测试**：Vitest（单元 42+ 用例 · 集成 3+ 用例）
- **密码**：Node 内建 `crypto.scrypt`（零外部依赖）
- **LLM**：MiniMax（abab6.5s-chat，包年）+ Anthropic Claude Haiku（兜底按量）

## 快速开始

```bash
# 1. 启动 PostgreSQL（docker-compose，端口 5433）
docker compose up -d

# 2. 环境变量
cp .env.example .env     # 按需填入 MINIMAX_API_KEY / ANTHROPIC_API_KEY

# 3. 装依赖 + 生成 Prisma Client
npm install
npm run prisma:generate

# 4. 跑迁移 + 种子
npm run prisma:migrate   # 初次会新建迁移
npm run prisma:seed      # 导入 1 部论典 · 20 题 · 3 demo 账号 · LLM 配置

# 5. 启动
npm run dev              # 默认 http://0.0.0.0:3000
```

健康检查：`GET http://localhost:3000/health` → `{ "ok": true, "env": "development" }`

人工验证清单见 [`TESTING.md`](./TESTING.md)。

## 示范账号（seed 自动创建）

| 角色 | 邮箱 | 密码 |
|---|---|---|
| admin   | `admin@juexue.app`   | `admin123456`  |
| coach   | `coach@juexue.app`   | `coach123456`  |
| student | `student@juexue.app` | `student12345` |

登录示例：

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"coach@juexue.app","password":"coach123456"}'

curl http://localhost:3000/api/coach/classes \
  -H 'authorization: Bearer <accessToken>'
```

Dev 环境下，未携带 JWT 会自动回退到 `DEV_FAKE_USER_ID`（`dev_user_001`，无 role），仅能访问非角色保护端点。

## 目录结构

```
backend/
├── prisma/
│   ├── schema.prisma              22 个 model / 9 个 enum
│   └── seed/                      content / accounts / llm / questions/*
├── src/
│   ├── app.ts · server.ts         Fastify 工厂 + 启动
│   ├── lib/                       prisma / config / errors / auth
│   └── modules/
│       ├── answering/             Sprint 1：答题 + 错题本 + 进度聚合
│       ├── sm2/                   Sprint 1：SM-2 间隔复习
│       ├── llm/                   LLM Gateway + providers + admin 面板
│       ├── auth/                  Sprint 2：注册/登录/刷新/登出
│       ├── class/                 Sprint 2：班级 + 成员（admin/coach/student）
│       ├── coach/                 Sprint 2：班级聚合 + 单学员详情
│       ├── questions/             Sprint 2：双轨创建 + 审核 · Sprint 3：list 可见性
│       ├── enrollment/            Sprint 3：报名 / 进度
│       ├── courses/               Sprint 3：论典浏览
│       ├── learning/              Sprint 3：学员学习入口路由
│       ├── favorites/             Sprint 3：收藏
│       ├── reports/               Sprint 3：题目举报
│       └── admin/                 Sprint 3：用户管理 + 平台大盘 + 审计日志
└── tests/
    ├── *.test.ts                  单元（SM-2 / grading / hash / tokens）
    └── integration/               Sprint 3 scaffold（需 test DB）
```

## HTTP 端点一览

### 公共 / Auth

| Method | Path | 角色 | 说明 |
|---|---|---|---|
| GET  | `/health` | — | 健康检查 |
| POST | `/api/auth/register` | — | 注册 |
| POST | `/api/auth/login` | — | 登录 |
| POST | `/api/auth/refresh` | — | 刷新 access + 轮转 refresh |
| POST | `/api/auth/logout` | — | 登出（幂等） |
| GET  | `/api/auth/me` | any | 当前用户 |

### 学员学习

| Method | Path | 角色 | 说明 |
|---|---|---|---|
| GET    | `/api/courses` | — | 论典列表 |
| GET    | `/api/courses/:slug` | any / — | 详情（登录带进度叠加） |
| GET    | `/api/lessons/:id/questions` | any / — | 按 lesson 列题（剥答案，按可见性过滤） |
| GET    | `/api/my/enrollments` | any | 我的报名 |
| POST   | `/api/enrollments` | any | 报名 |
| DELETE | `/api/enrollments/:courseId` | any | 退课 |
| PATCH  | `/api/enrollments/:courseId/progress` | any | 更新进度 |
| GET    | `/api/my/progress` | any | 个人进度（含 streak + SM-2） |

### 答题 / SM-2 / 错题 / 收藏 / 举报

| Method | Path | 角色 | 说明 |
|---|---|---|---|
| GET    | `/api/questions/:id` | any | 单题公开视图 |
| POST   | `/api/answers` | any | 提交答案 → 评分 → 错题本 → SM-2 |
| GET    | `/api/sm2/due` | any | 到期队列 |
| GET    | `/api/sm2/stats` | any | 状态面板 |
| POST   | `/api/sm2/review` | any | 自评复习 |
| GET    | `/api/mistakes` | any | 错题列表（含 question） |
| DELETE | `/api/mistakes/:questionId` | any | 手动移除（掌握后） |
| POST   | `/api/favorites/:questionId` | any | 收藏 |
| DELETE | `/api/favorites/:questionId` | any | 取消收藏 |
| GET    | `/api/favorites` | any | 收藏列表 |
| POST   | `/api/reports` | any | 举报题目 |

### 班级

| Method | Path | 角色 | 说明 |
|---|---|---|---|
| POST   | `/api/classes/join` | any | 凭 joinCode 加入 |
| POST   | `/api/classes/:id/leave` | any | 退出 |
| GET    | `/api/my/classes` | any | 我的班级 |
| GET    | `/api/coach/classes` | coach / admin | 我负责的班级 |
| GET    | `/api/coach/classes/:id/members` | coach / admin | 成员 |
| GET    | `/api/coach/classes/:id/stats` | coach / admin | 班级聚合 |
| GET    | `/api/coach/classes/:id/students/:uid` | coach / admin | 学员详情 |

### 题库（双轨 + 审核）

| Method | Path | 角色 | 说明 |
|---|---|---|---|
| POST   | `/api/coach/questions` | coach / admin | 创建（class_private 或 public 待审） |
| GET    | `/api/coach/questions` | coach / admin | 我创建的 |
| GET    | `/api/coach/questions/:id` | coach / admin | 详情 |

### Admin

| Method | Path | 说明 |
|---|---|---|
| POST    | `/api/admin/classes` | 创建班级 |
| GET     | `/api/admin/classes` | 列班级 |
| PATCH   | `/api/admin/classes/:id/archive` | 归档 |
| GET     | `/api/admin/classes/:id/members` | 成员 |
| POST    | `/api/admin/classes/:id/members` | 添加成员 |
| DELETE  | `/api/admin/classes/:id/members/:userId` | 移除成员 |
| GET     | `/api/admin/questions/pending` | 待审题目 |
| GET     | `/api/admin/questions/:id` | 题目详情 |
| POST    | `/api/admin/questions/:id/review` | approve / reject + AuditLog |
| GET     | `/api/admin/reports/pending` | 待处理举报 |
| POST    | `/api/admin/reports/:id/handle` | accept / reject + AuditLog |
| GET     | `/api/admin/users` | 用户列表（role / search / cursor） |
| PATCH   | `/api/admin/users/:id/role` | 改角色 |
| POST    | `/api/admin/users/:id/active` | 停用 / 启用（停用吊销所有 session） |
| GET     | `/api/admin/platform-stats` | 平台大盘（users/classes/questions/answers/llm/sm2） |
| GET     | `/api/admin/audit` | AuditLog 查询 |

### Admin · LLM 运维

| Method | Path | 说明 |
|---|---|---|
| GET    | `/api/admin/llm/providers` | provider 列表 |
| PATCH  | `/api/admin/llm/providers/:id` | 17 字段 patch |
| POST   | `/api/admin/llm/providers/:id/toggle` | 启用/停用 |
| POST   | `/api/admin/llm/providers/:id/reset-circuit` | 手动关熔断 |
| GET    | `/api/admin/llm/providers/:id/usage` | 单 provider 时间序列 |
| GET    | `/api/admin/llm/usage` | 当期汇总 |
| GET    | `/api/admin/llm/logs` | call log 游标分页 |
| GET    | `/api/admin/llm/scenarios` | 场景列表 |
| PATCH  | `/api/admin/llm/scenarios/:id` | 改主备 provider / temperature / maxTokens |
| GET    | `/api/admin/llm/prompts` | 模板列表 |
| POST   | `/api/admin/llm/prompts` | 新建模板（不自动激活） |
| POST   | `/api/admin/llm/prompts/:id/activate` | 激活并停用同 scenario 旧版 |

## 常用命令

```bash
npm run dev                  # 开发（tsx watch）
npm run typecheck            # 类型检查
npm test                     # 单元测试（excludes tests/integration）
npm run test:integration     # 集成测试（需 DATABASE_URL 指向测试库）
npm run test:watch           # 单元 watch
npm run prisma:studio        # 浏览数据库
npm run prisma:migrate       # 创建/应用迁移
npm run prisma:seed          # 重新种子（upsert 幂等）
npm run build                # tsc 产出 dist/
npm start                    # node dist/server.js
```

## 架构速览

### 认证

- `access token` 15 分钟 / `refresh token` 30 天；同一 JWT_SECRET + `aud` claim 区分
- `AuthSession.refreshTokenHash` 存 sha256，`refresh` 轮转旧 session → `revokedAt`
- 全局 `onRequest` 钩子 `jwtOptional`：尝试验签，拒绝非 access token（防 refresh 冒充）
- `requireRole(...roles)` 路由级 + 业务层 `assertIsCoachOfClass` / `assertMemberOfClass` 防越权

### 学员学习路径

- `GET /api/courses` → `GET /api/courses/:slug`（含 enrollment overlay） → `POST /api/enrollments` 报名
- `GET /api/lessons/:id/questions`：按 `reviewStatus=approved` + `public OR 本班 class_private` 过滤，剥答案
- `GET /api/my/progress`：总量 / 正确率 / byCourse / **连续答题天数 streak**（UTC 日历，today 或 yesterday 才延续）/ SM-2 分布

### 题库双轨

- `class_private` + `ownerClassId` → 立即 `approved` 生效于本班
- `public` → `pending`，Admin 审核 approve/reject 时写 `AuditLog`（含 before/after + reason）

### LLM Gateway（请求流）

1. 读 `LlmScenarioConfig` → 主备 provider + model
2. 每候选：熔断器 → 4 维配额（年/月 token · 日请求 · RPM；年度达 `reservePercent` 切兜底）→ 凭证
3. `provider.chat()`：成功累加 5 桶用量 + 写 `LlmCallLog`；失败累加错误 + 切下一个
4. 全失败：记录失败日志 + 抛 `UpstreamError`；连错 ≥3 开熔断 60 秒

### Admin LLM 面板

- `updateProvider` 允许改 17 字段（quota / 成本 / 生效期 / 策略）；`name / apiKeyEnv / baseUrl` 不可改（走 env）
- `resetCircuit` 专门的"手动关熔断"入口（Gateway 才能写健康字段）
- Prompt 模板激活时**同场景其他版本自动停用**（事务一致）
- 所有 Admin 改动写 `AuditLog`（BigInt 字段序列化为字符串）

### SM-2 间隔复习

- 四档自评：`0 重来 / 1 困难 / 2 良好 / 3 简单` → SM-2 quality `{0:1, 1:3, 2:4, 3:5}`
- 状态：`new → learning → review → mastered`（interval ≥ 21 且 rating ≥ 2）
- EF 下限 1.3；答题后自动 `scheduleReview`，失败仅 warn 不阻塞主响应

## 许可

法本内容来源公开流通版（CC BY-NC-SA 4.0）；代码许可见仓库根 LICENSE。
