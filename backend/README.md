# 觉学 JueXue · Backend

大乘佛法学习 App 的服务端（Sprint 1–2）。覆盖：

- **Sprint 1**：答题模块 + SM-2 间隔复习 + LLM Gateway（MiniMax 主 / Claude 兜底）
- **Sprint 2**：真 JWT 认证 + 三级角色（admin / coach / student） + 班级系统 + 题库双轨创建（class_private / 平台审核）

## 技术栈

- **运行时**：Node.js 22 · TypeScript · ESM（NodeNext）
- **HTTP**：Fastify 5 · @fastify/cors · @fastify/jwt
- **校验**：Zod 3
- **ORM**：Prisma 6 · PostgreSQL 16
- **测试**：Vitest
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

## 示范账号（seed 自动创建）

| 角色 | 邮箱 | 密码 |
|---|---|---|
| admin   | `admin@juexue.app`   | `admin123456`  |
| coach   | `coach@juexue.app`   | `coach123456`  |
| student | `student@juexue.app` | `student12345` |

登录示例：

```bash
# 拿 accessToken / refreshToken
curl -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"coach@juexue.app","password":"coach123456"}'

# 带 JWT 调 coach 端点
curl http://localhost:3000/api/coach/classes \
  -H 'authorization: Bearer <accessToken>'
```

Dev 环境下，未携带 JWT 时会自动回退到 `DEV_FAKE_USER_ID`（`dev_user_001`，无 role），可用于快速调试非角色保护的端点。

## 目录结构

```
backend/
├── prisma/
│   ├── schema.prisma              Sprint 1–2 共 22 个 model
│   └── seed/                      Seed 模块化拆分
│       ├── ids.ts                   共享 ID
│       ├── content.ts               course + chapters + lessons
│       ├── accounts.ts              admin / coach / student demo
│       ├── llm.ts                   providers + scenario + prompt
│       └── questions/               6 种题型各一文件
├── src/
│   ├── app.ts · server.ts         Fastify 工厂 + 启动
│   ├── lib/                       基础设施（prisma · config · errors · auth）
│   └── modules/
│       ├── auth/                  Sprint 2：注册 / 登录 / 刷新 / 登出
│       │   ├── hash.ts              scrypt 哈希
│       │   ├── tokens.ts            JWT 签 / 验（access + refresh）
│       │   ├── service(.helpers).ts 业务编排
│       │   └── routes.ts            HTTP
│       ├── class/                 Sprint 2：班级 + 成员（三角色 routes）
│       ├── coach/                 Sprint 2：班级聚合 + 单学员详情
│       ├── questions/             Sprint 2：双轨创建 + Admin 审核
│       ├── llm/                   Sprint 1：LLM Gateway
│       ├── answering/             Sprint 1：答题
│       └── sm2/                   Sprint 1：间隔复习
└── tests/                         Vitest 离线单测（5 文件 · 40+ 用例）
```

## HTTP 端点一览

### 公共

| Method | Path | 角色 | 说明 |
|---|---|---|---|
| GET  | `/health` | — | 健康检查 |

### Auth

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册，201 返回 token 对 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/refresh` | 刷新 access（轮转 refresh） |
| POST | `/api/auth/logout` | 登出（幂等） |
| GET  | `/api/auth/me` | 当前用户公开字段 |

### 答题 / SM-2（任意已登录）

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/questions/:id` | 题目公开视图（剥答案） |
| POST | `/api/answers` | 提交答案 → 评分 → 错题本 → SM-2 |
| GET  | `/api/sm2/due` | 到期待复习 |
| GET  | `/api/sm2/stats` | 状态面板 |
| POST | `/api/sm2/review` | 自评复习 |

### 班级

| Method | Path | 角色 | 说明 |
|---|---|---|---|
| POST   | `/api/classes/join` | any | 凭 joinCode 加入 |
| POST   | `/api/classes/:id/leave` | any | 退出 |
| GET    | `/api/my/classes` | any | 我的班级 |
| GET    | `/api/coach/classes` | coach / admin | 我负责的班级 |
| GET    | `/api/coach/classes/:id/members` | coach / admin | 成员列表 |
| POST   | `/api/admin/classes` | admin | 创建 |
| GET    | `/api/admin/classes` | admin | 全班级 |
| PATCH  | `/api/admin/classes/:id/archive` | admin | 归档 |
| GET    | `/api/admin/classes/:id/members` | admin | 成员列表 |
| POST   | `/api/admin/classes/:id/members` | admin | 添加成员 |
| DELETE | `/api/admin/classes/:id/members/:userId` | admin | 移除成员 |

### 辅导员统计

| Method | Path | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/coach/classes/:id/stats` | coach / admin | 班级聚合 |
| GET | `/api/coach/classes/:id/students/:uid` | coach / admin | 单学员学修详情 |

### 题库（双轨）

| Method | Path | 角色 | 说明 |
|---|---|---|---|
| POST | `/api/coach/questions` | coach / admin | 创建（class_private 或 public 待审） |
| GET  | `/api/coach/questions` | coach / admin | 我创建的 |
| GET  | `/api/coach/questions/:id` | coach / admin | 详情（限本人；admin 放行） |
| GET  | `/api/admin/questions/pending` | admin | 待审队列 |
| GET  | `/api/admin/questions/:id` | admin | 任意题目详情 |
| POST | `/api/admin/questions/:id/review` | admin | approve / reject + AuditLog |

## 常用命令

```bash
npm run dev              # 开发（tsx watch）
npm run typecheck        # 仅类型检查
npm test                 # vitest run（40+ 用例）
npm run test:watch       # vitest watch
npm run prisma:studio    # 浏览数据库
npm run prisma:migrate   # 创建/应用迁移
npm run prisma:seed      # 重新种子（upsert 幂等）
npm run build            # tsc 产出 dist/
npm start                # node dist/server.js
```

## 架构速览

### 认证

- `access token`：15 分钟，`aud=access`，带 `role`
- `refresh token`：30 天，`aud=refresh`，仅 sha256 落库（`AuthSession.refreshTokenHash`）
- `refresh` 调用时旧 session 置 `revokedAt`，新 session 一次 write 写入（避免占位哈希 race）
- 全局 `onRequest` 钩子 `jwtOptional`：有 token 就挂 `req.user`，拒绝非 access（防 refresh 冒充身份）；无 token 不抛
- 路由级 `requireRole(...roles)`：硬校验；进一步业务层 `assertIsCoachOfClass` / `assertMemberOfClass` 防跨班越权

### 题库双轨

- 辅导员 `POST /api/coach/questions`：
  - `visibility=class_private` + `ownerClassId` → 立即生效于本班（`reviewStatus=approved`）
  - `visibility=public` → 置 `reviewStatus=pending`，进 Admin 审核队列
- Admin `POST /api/admin/questions/:id/review`：通过 / 驳回并写 `AuditLog`（`before`/`after` + `reason`）

### LLM Gateway

1. 读 `LlmScenarioConfig` 得主备 provider + model
2. 对每个候选依次：熔断器 → 4 维配额（year/month/day/rpm，年度触达 `reservePercent` 切兜底）→ 凭证检查
3. 调 `provider.chat()`；成功累加 5 桶用量 + 写 `LlmCallLog`，失败累加错误 + 切下一个
4. 全失败：写日志 + `UpstreamError`；连错 ≥3 次开熔断 60 秒

### SM-2 间隔复习

- 四档自评：`0 重来 / 1 困难 / 2 良好 / 3 简单`
- 映射 SM-2 quality `{0:1, 1:3, 2:4, 3:5}`
- 状态：`new → learning → review → mastered`（interval ≥ 21 且 rating ≥ 2）
- EF 下限 1.3；答题后自动 `scheduleReview`，SM-2 故障仅 warn 不阻塞主响应

## 许可

法本内容来源公开流通版（CC BY-NC-SA 4.0）；代码许可见仓库根 LICENSE。
