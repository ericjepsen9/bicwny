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
npm run prisma:migrate   # 首次需要输入迁移名，建议 `sprint_1_2_baseline`
```

- [ ] 迁移成功应用，PostgreSQL 表结构含 22 个表 / 若干 enum

---

## C. Seed 验证

```bash
npm run prisma:seed
```

- [ ] 控制台出现：1 user · 1 course · 2 chapters · 5 lessons · 6 题型 20 题 · 3 demo accounts · 2 LLM providers · 1 scenario · 1 prompt template
- [ ] Prisma Studio (`npm run prisma:studio`) 可见 demo 账号：
      `admin@juexue.app` / `coach@juexue.app` / `student@juexue.app`

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

## G. 已知未覆盖的集成测试

以下路径目前 **只有单元测试**，缺端到端验证。若发现 bug 优先看这几处：

| 路径 | 单测 | 集成测 | 建议 |
|---|---|---|---|
| `/api/answers` 全流程（含 SM-2 联动） | ✖ | ✖ | supertest + SQLite |
| `/api/auth/*` 登录轮转全链 | 部分（hash/tokens 纯函数） | ✖ | supertest 跑一遍流程 |
| 班级权限越权（coach A 查 coach B 的班） | ✖ | ✖ | supertest 403 |
| 题目审核事务一致性 | ✖ | ✖ | 模拟失败回滚 |
| LLM Gateway 切兜底路径 | ✖ | ✖ | mock provider |

集成测试 scaffold 计划放在 Sprint 3 最后一个 phase。

---

## H. 发现问题后

- 先看 commit 范围：每个 Sprint 的 step 都独立提交，定位到"最后一个好的"容易回滚
- 文档中若提到的行为与实际不符，请优先改代码 / 再改文档
