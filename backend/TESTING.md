# 觉学 Backend · 待人工验证清单

> 由于开发环境无 Node.js / Docker，以下步骤全部 **尚未实际执行过**。
> 当你在本机或 CI 拿到环境后，按顺序走一遍。每项执行完可勾掉。

---

## A. 装依赖 & 生成 Prisma Client

```bash
cd backend
npm install
npm run prisma:generate
```

- [ ] `npm install` 无报错（关键新依赖：`dotenv ^16.4.7`）
- [ ] `prisma:generate` 成功产出 `node_modules/@prisma/client`

---

## B. 首次迁移

```bash
docker compose up -d
npm run prisma:migrate   # Sprint 1+2+3+3.5，建议命名 `sprint_1_to_3_5_baseline`
```

- [ ] 迁移成功应用，PostgreSQL 表结构含 **23 个表 / 11 个 enum**
      （含 Sprint 3.5 新增的 `ErrorLog` + `LogKind`）

---

## C. Seed 验证

```bash
npm run prisma:seed
```

- [ ] 控制台出现：1 user · 1 course · 2 chapters · 5 lessons · 6 题型 20 题 · 3 demo accounts · 2 LLM providers · 1 scenario · 1 prompt template
- [ ] Prisma Studio (`npm run prisma:studio`) 可见 demo 账号：
      `admin@juexue.app` / `coach@juexue.app` / `student@juexue.app`
- [ ] `ErrorLog` 表存在且为空（Sprint 3.5 新表）

---

## D. 类型检查 & 单元测试

```bash
npm run typecheck
npm test
```

Sprint 1 测试（28 用例）：
- [ ] `tests/sm2.test.ts` · 8 用例全过
- [ ] `tests/grading.objective.test.ts` · 13 用例全过
- [ ] `tests/grading.mockOpen.test.ts` · 7 用例全过

Sprint 2 测试（14 用例）：
- [ ] `tests/auth.hash.test.ts` · 6 用例全过
- [ ] `tests/auth.tokens.test.ts` · 8 用例全过

**若 typecheck 报错**：多半在 Prisma 类型转换边界（`InputJsonValue` / `DbNull` / 联合类型），改起来应很快。

---

## E. 服务启动 & 冒烟测试

```bash
npm run dev
```

健康检查：
- [ ] `curl http://localhost:3000/health` → `{"ok":true,"env":"development"}`

Sprint 1 冒烟：
- [ ] `GET /api/questions/q_single_001` 能返回题目（剥答案）
- [ ] `POST /api/answers`（dev 模式无 JWT）：提交正确答案，返回 `grade.score=100`
- [ ] `GET /api/sm2/stats` 返回 5 个计数

Sprint 2 冒烟：
- [ ] `POST /api/auth/login` 用 `coach@juexue.app` / `coach123456` → 拿 accessToken + refreshToken
- [ ] 带 `Authorization: Bearer <accessToken>` 调 `GET /api/coach/classes` → 返回 `[]`（coach 尚未绑定任何班级）
- [ ] Admin 账号登录后 `POST /api/admin/classes` 创建班级 → 返回 `joinCode`
- [ ] Admin `POST /api/admin/classes/:id/members` 把 coach 加为 coach → coach 再调 `/api/coach/classes` 可见该班
- [ ] Student 用 `POST /api/classes/join` 加入 → coach 调 `/api/coach/classes/:id/stats` 能看到该 student
- [ ] Coach `POST /api/coach/questions`（visibility=public）→ Admin `/api/admin/questions/pending` 可见 → Admin `.../review` approve → AuditLog 新增一行

Refresh / 登出：
- [ ] `POST /api/auth/refresh` 能拿到新 token 对，旧 refresh 不再可用
- [ ] `POST /api/auth/logout` 后再用同一 refresh 调 `/refresh` 应 401

Sprint 3 冒烟（学员学习路径）：
- [ ] `GET /api/courses` 返回至少 1 部论典
- [ ] `POST /api/enrollments` { courseId: 'course_ruxinglun' } → 201；`GET /api/my/enrollments` 可见
- [ ] `GET /api/lessons/lesson_ruxinglun_01_01/questions` 按 lesson 返回题目（剥答案）
- [ ] `POST /api/favorites/q_single_001` → `GET /api/favorites` 可见
- [ ] `POST /api/reports` { questionId:'q_single_002', reason:'typo' } → admin `GET /api/admin/reports/pending` 可见
- [ ] Admin `GET /api/admin/platform-stats` 返回 users/classes/questions/answers/llm/sm2 六大类
- [ ] Admin `GET /api/admin/users?search=coach` 能搜到辅导员账号
- [ ] Admin `GET /api/admin/llm/providers` 可见 2 个 provider；`PATCH` 改 priority 后再查可见变化 + AuditLog 新增

Sprint 3.5 冒烟（可观测性 · 最关键）：
- [ ] `curl -i http://localhost:3000/health` 响应头含 `x-request-id`
- [ ] `curl -H 'x-request-id: manual-test-001' http://localhost:3000/health` 响应头回传同一个 `manual-test-001`
- [ ] 响应成功后，服务日志应有一条 `request done`（含 `reqId/method/url/status/duration`）
- [ ] 登录后调任意端点，日志应额外带 `userId`
- [ ] `GET /health/detailed` 返回 `{ok, db:{ok:true}, llm:{providers:[...]}, memory, uptimeSec}`
- [ ] 触发一个 5xx（例如故意让 prisma 失败 or 访问不存在的 adminId），`GET /api/admin/logs?kind=error` 能查到
- [ ] `GET /api/admin/logs/stats` 返回最近 24h 三类计数 `{ error, slow_request, slow_query }`
- [ ] 慢请求验证：在某 handler 里插入 `await new Promise(r => setTimeout(r, 1500))`，调一次
      → 日志打 `slow request`，且 `GET /api/admin/logs?kind=slow_request` 能查到

---

## F. LLM 真调用（可选）

```env
MINIMAX_API_KEY=...
MINIMAX_GROUP_ID=...
ANTHROPIC_API_KEY=...
```

- [ ] `POST /api/answers` 对 `q_open_001` 带 `{"useLlm":true}` → 返回 `grade.source="llm_open"`，且 `LlmCallLog` 新增一行 `success=true`
- [ ] 断网 / 错误 API Key 场景：应自动切兜底或返回 `UPSTREAM_ERROR`，不阻塞答题（mock 降级）

---

## G. 集成测试（Sprint 3 已 scaffold · 需人工跑）

scaffold 位置：`tests/integration/`
- `helpers.ts`：`buildTestApp()` / `resetDb()` / `expectOk()`
- `auth.test.ts`：3 用例（register→login→/me · 错密码 401 · refresh 轮转废旧 token）

### 环境要求

- 单独的 **test Postgres 库**（避免污染开发数据）
- 运行前把 `DATABASE_URL` 指向测试库：

```bash
# 建议 docker-compose 加 postgres_test 服务，或改用不同端口 / 库名
export DATABASE_URL="postgresql://juexue:juexue_dev@localhost:5433/juexue_test?schema=public"
npx prisma migrate deploy     # 建表
npx prisma db execute --file /dev/stdin <<< 'TRUNCATE llm_provider_config RESTART IDENTITY CASCADE;'
# 或最简单：
# npm run prisma:migrate  # dev 库和 test 库都建
# 然后 seed 一次 LLM 配置到 test 库（tests 不清 LLM 表，依赖存在）
```

### 运行命令

```bash
npm run test:integration         # 只跑 tests/integration/**
npm test                         # 单元测试（已 exclude integration）
```

### 已写用例（3 条）

- [ ] `auth.test.ts · register → login → /me`
- [ ] `auth.test.ts · 错密码 → 401`
- [ ] `auth.test.ts · refresh 轮转后旧 refresh 失效`

### 仍未覆盖（建议 Sprint 4 前补齐）

| 路径 | 优先级 | 建议 |
|---|---|---|
| `/api/answers` 全流程（含 SM-2 联动）| 高 | 种 1 个 course+lesson+question，答题验证 UserAnswer/Sm2Card 落库 |
| 班级权限越权（coach A 查 coach B 班）| 高 | 建 2 coach 2 class，验证 403 |
| 题目双轨创建 + Admin 审核 | 中 | coach 创建 public → admin approve → AuditLog |
| LLM Gateway 切兜底（mock provider）| 中 | 让 MiniMax 抛错，验证 Claude 接替 + LlmCallLog.switched=true |

---

## H. 排错快速路径（Sprint 3.5 新增观测工具）

### 1. 一个请求出了什么事？

响应头 `x-request-id: abc123` → 用它串整条链路：

```bash
# 服务器日志（pino JSON）
grep '"reqId":"abc123"' server.log

# DB 里的错误/慢日志
curl -s 'http://localhost:3000/api/admin/logs?requestId=abc123' \
  -H 'authorization: Bearer <admin-token>' | jq
```

### 2. 最近 24h 出了多少问题？

```bash
curl -s http://localhost:3000/api/admin/logs/stats \
  -H 'authorization: Bearer <admin-token>' | jq
# → { windowHours: 24, counts: { error, slow_request, slow_query } }
```

### 3. 某个用户持续报错？

```bash
curl -s 'http://localhost:3000/api/admin/logs?userId=user_xxx&kind=error' \
  -H 'authorization: Bearer <admin-token>' | jq
```

### 4. DB / LLM 哪个挂了？

```bash
curl -s http://localhost:3000/health/detailed | jq
# 看 db.ok 与 llm.providers[].isDown
```

### 5. 慢在哪里？

- 慢请求（端点级）：`GET /api/admin/logs?kind=slow_request`
- 慢查询（SQL 级）：`GET /api/admin/logs?kind=slow_query`
- 阈值：请求 1000ms / 查询 500ms（改 `lib/timing.ts` 与 `lib/prisma.ts` 常量）

### 6. 日志定位 commit

- 每个 Sprint 的 step 都独立提交，`git bisect` 或对应 commit 回滚容易
- 文档若与代码不符：**优先改代码，再改文档**
