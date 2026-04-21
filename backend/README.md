# 觉学 JueXue · Backend

大乘佛法学习 App 的服务端（Sprint 1）。覆盖 **答题模块 + SM-2 间隔复习 + LLM Gateway（MiniMax 主 / Claude 兜底）**。

## 技术栈

- **运行时**：Node.js 22 · TypeScript · ESM（NodeNext）
- **HTTP**：Fastify 5 · @fastify/cors · @fastify/jwt
- **校验**：Zod 3
- **ORM**：Prisma 6 · PostgreSQL 16
- **测试**：Vitest
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
npm run prisma:seed      # 导入 1 部论典 · 20 题 · 2 LLM 供应商配置

# 5. 启动
npm run dev              # 默认 http://0.0.0.0:3000
```

健康检查：`GET http://localhost:3000/health` → `{ "ok": true, "env": "development" }`

## 目录结构

```
backend/
├── prisma/
│   ├── schema.prisma              18 个 model
│   └── seed/                      Seed 模块化拆分
│       ├── ids.ts                   共享 ID
│       ├── content.ts               user + course + chapters + lessons
│       ├── llm.ts                   providers + scenario + prompt 模板
│       └── questions/               6 种题型各一文件
├── src/
│   ├── app.ts                     Fastify 工厂
│   ├── server.ts                  启动入口 + 优雅停机
│   ├── lib/                       基础设施
│   │   ├── prisma.ts                单例
│   │   ├── config.ts                env + Zod 校验
│   │   ├── errors.ts                AppError + 工厂
│   │   └── auth.ts                  dev 身份注入
│   └── modules/
│       ├── llm/                   LLM Gateway
│       │   ├── providers/           MiniMax + Claude 适配器
│       │   ├── period.ts            时间分桶
│       │   ├── usage.ts             用量读写（5 桶）
│       │   ├── quota.ts             4 维配额 + 预留阈值
│       │   ├── circuit.ts           熔断器
│       │   ├── prompt.ts            模板加载 + 渲染
│       │   ├── gateway.ts           主调度
│       │   └── gateway.helpers.ts   辅助
│       ├── answering/             答题
│       │   ├── grading.objective.ts 5 种客观题判分
│       │   ├── grading.mockOpen.ts  开放题 mock 评分
│       │   ├── grading.ts           分发器（对接 LLM）
│       │   ├── mistakes.ts          错题本
│       │   ├── publicView.ts        题目剥答案视图
│       │   ├── service.ts           主流程
│       │   └── routes.ts            HTTP 端点
│       └── sm2/                   间隔复习
│           ├── algorithm.ts         SM-2 纯函数
│           ├── service.ts           数据访问
│           └── routes.ts            HTTP 端点
└── tests/                         Vitest 离线单测
```

## HTTP 端点一览

| Method | Path | 说明 |
|---|---|---|
| GET  | `/health` | 健康检查 |
| GET  | `/api/questions/:id` | 题目公开视图（剥答案） |
| POST | `/api/answers` | 提交答案 → 评分 → 错题本 → SM-2 排程 |
| GET  | `/api/sm2/due?courseId&limit` | 到期待复习队列 |
| GET  | `/api/sm2/stats?courseId` | 状态面板（new/learning/review/mastered + due） |
| POST | `/api/sm2/review` | 自评复习（rating 0-3） |

**Sprint 1 身份注入**：`req.user.sub` 不存在时 dev 环境回退到 `DEV_FAKE_USER_ID`。真 JWT 登录在 Sprint 5。

## 常用命令

```bash
npm run dev              # 开发（tsx watch）
npm run typecheck        # 仅类型检查
npm test                 # vitest run
npm run test:watch       # vitest watch
npm run prisma:studio    # 浏览数据库
npm run prisma:migrate   # 创建/应用迁移
npm run prisma:seed      # 重新种子（upsert 幂等）
npm run build            # tsc 产出 dist/
npm start                # node dist/server.js
```

## 架构速览

### LLM Gateway

用户请求 → `gateway.chat(scenario, messages, ctx?)`：

1. 读 `LlmScenarioConfig` 得主备 provider + model
2. 对每个候选依次：
   - **熔断器**：`circuitOpenUntil` 未过期则跳
   - **4 维配额**：year/month 触达预留阈值切兜底；day/rpm 硬上限
   - **凭证**：env 无 API Key 则跳
3. 调 provider.chat()：
   - 成功：`recordSuccess` + `incrementUsage`（5 桶事务）+ 写 `LlmCallLog`，返回
   - 失败：`recordFailure`（连错 ≥3 开熔断 60 秒）+ 记错误用量，试下一个
4. 全失败：写失败日志 + 抛 `UpstreamError`

### SM-2 间隔复习

- 四档自评：`0 重来 / 1 困难 / 2 良好 / 3 简单`
- 映射 SM-2 quality：`{ 0:1, 1:3, 2:4, 3:5 }`
- 状态：`new → learning → review → mastered`（interval ≥ 21 且 rating ≥ 2）
- EF 下限 1.3；每次答题后 `submitAnswer` 自动调 `scheduleReview`，SM-2 错误仅 warn 不阻塞。

## 许可

法本内容来源公开流通版（CC BY-NC-SA 4.0）；代码许可见仓库根 LICENSE。
