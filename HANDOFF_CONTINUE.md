# 觉学项目 · 会话交接清单

> 复制粘贴本文件到新会话的第一条消息，Claude 就能无缝继续。

---

## 📌 当前状态

```
仓库：   ericjepsen9/bicwny
分支：   claude/setup-bicwny-repo-hGIlF
最新：   11b9d97 原型 P.3：admin-shell.css + coach.html（辅导员后台 · 响应式）
```

### ✅ 已完成

| 区域 | 完成度 | 文件 |
|---|---|---|
| **Sprint 1 · 后端核心** | 100% | backend/ 答题 + SM-2 + LLM Gateway |
| **Sprint 2 · 认证+协作** | 100% | JWT + Class + Coach + 题库双轨 |
| **Sprint 3 · 学习闭环** | 100% | 学员路径 + 收藏 + 举报 + Admin 面板 |
| **Sprint 3.5 · 观测性** | 100% | requestId + ErrorLog + /health/detailed |
| **原型 P.1** | ✓ | index.html landing + shared.css + student.html 改名 |
| **原型 P.2** | ✓ | student.html 扩充 8 新页（登录/论典/进度/SM-2/错题/收藏/举报） |
| **原型 P.3** | ✓ | admin-shell.css + coach.html（响应式后台） |

### ❌ 未完成 · **12 大项** · **按优先级排**

---

## 🔴 Phase I · 原型最后一块（1 步）

- [ ] **I.1** 写 `admin.html` 9 页 Admin 后台
  - 大盘 / 题目审核 / 举报处理 / 用户管理
  - LLM Providers（17 字段编辑）/ 场景+Prompt
  - 班级管理 / 审计日志 / 运行日志（ErrorLog）
  - 复用 `admin-shell.css`，风格与 coach.html 一致
  - 预计 ~2000 行

---

## 🟠 Phase II · 后端验证（等你跑）

所有后端代码**从未在真 Node 环境跑过**。每步若失败需 Claude 修。

- [ ] **II.1** `npm install` + `npm run prisma:generate`
- [ ] **II.2** `docker compose up -d` + `npm run prisma:migrate`（首次建议命名 `sprint_1_to_3_5_baseline`）
- [ ] **II.3** `npm run prisma:seed` — 期望：1 论典 / 20 题 / 3 账号 / 2 LLM 供应商
- [ ] **II.4** `npm run typecheck` — **最大风险点**，56 ts 文件第一次跑
- [ ] **II.5** `npm test` — 42 用例（SM-2 · 判分 · hash · tokens · mock open）
- [ ] **II.6** `npm run dev` + 冒烟（见 `backend/TESTING.md § E`）
- [ ] **II.7** 集成测试：需要**独立 test DB**，`npm run test:integration`（3 用例 auth 链路）

---

## 🟠 Phase III · 生产准备（5 步）

- [ ] **III.1** `backend/Dockerfile` + `docker-compose.prod.yml`
- [ ] **III.2** `CORS_ORIGINS` env 白名单（app.ts 改）
- [ ] **III.3** `@fastify/rate-limit`（防注册轰炸 + LLM 刷量）
- [ ] **III.4** 邮件服务：注册验证 + 密码重置（需 SMTP/SendGrid）
- [ ] **III.5** 文件上传：头像 + 法本 PDF（需对象存储）

---

## 🟡 Phase IV · 集成测试补齐（4 步）

当前 `tests/integration/` 只有 3 用例（auth）。还缺：

- [ ] **IV.1** `/api/answers` 全流程 e2e（→ UserAnswer + Sm2Card 落库）
- [ ] **IV.2** 班级权限越权（coach A 访问 coach B 班 → 403）
- [ ] **IV.3** 题目双轨 + Admin 审核（→ AuditLog）
- [ ] **IV.4** LLM Gateway 切兜底（mock MiniMax 抛错 → Claude 接替 → `switched=true`）

---

## 🟢 Phase V · 真前端（Sprint 4 · 大工程）

原型是 mockup，真产品需要对接 65+ 端点。

- [ ] **V.1** Next.js 14 App Router 骨架 + Tailwind + ESLint
- [ ] **V.2** 认证流（login / refresh / middleware）
- [ ] **V.3** 学员路径（courses / lessons / answer / sm2 / mistakes / favorites）
- [ ] **V.4** 辅导员端（对应 coach.html 的功能）
- [ ] **V.5** Admin 端（对应 admin.html 的功能）
- [ ] **V.6** 部署（Vercel / Cloudflare Pages）

---

## 🟢 Phase VI · 体验完善（5 步）

- [ ] **VI.1** 国际化 i18n（简 / 繁 / 英）
- [ ] **VI.2** 搜索（题目 + 论典，PG fulltext）
- [ ] **VI.3** 数据导出 CSV（学员学修 / LLM 成本）
- [ ] **VI.4** 通知系统（辅导员消息 / 系统通知）
- [ ] **VI.5** 作业功能（辅导员指定题单）

---

## 🟢 Phase VII · 文档 & 运维（4 步）

- [ ] **VII.1** README 最终版（含 P.3/P.4 原型说明）
- [ ] **VII.2** OpenAPI / Swagger 自动文档
- [ ] **VII.3** Sentry 接入（前后端错误追踪）
- [ ] **VII.4** 监控报警（Grafana / Prometheus）

---

## 🧪 未测试事项（完整版见 `backend/TESTING.md`）

### 关键 checkbox（至少这些要跑）

**A 依赖 & 生成**
- [ ] `npm install` 无报错
- [ ] `prisma:generate` 产出 @prisma/client

**B 迁移**
- [ ] 迁移成功，23 表 / 11 enum（含 Sprint 3.5 ErrorLog）

**C Seed**
- [ ] 1 课程 / 20 题 / 3 账号 / 2 LLM 供应商

**D 类型 + 单测**
- [ ] `npm run typecheck` 无错
- [ ] sm2.test.ts · 8 用例过
- [ ] grading.objective.test.ts · 13 用例过
- [ ] grading.mockOpen.test.ts · 7 用例过
- [ ] auth.hash.test.ts · 6 用例过
- [ ] auth.tokens.test.ts · 8 用例过

**E 服务 + 冒烟（Sprint 1 + 2 + 3 + 3.5）**
- [ ] `/health` · `/health/detailed` 带 `x-request-id` 响应头
- [ ] 登录 → `/api/coach/classes` 带 JWT 可调
- [ ] Admin 创建班级 → Coach 加入 → Student 加入
- [ ] Coach 创建 public 题 → Admin 审核 → AuditLog 新增
- [ ] `/api/courses` + `/api/enrollments` 报名流
- [ ] `/api/favorites` + `/api/mistakes` + `/api/reports`
- [ ] `/api/admin/platform-stats` 返 6 大类指标
- [ ] `/api/admin/llm/providers` 管理面板
- [ ] Sprint 3.5 冒烟：`/api/admin/logs` 能查；`/api/admin/logs/stats` 24h 三类计数
- [ ] 触发慢请求 `setTimeout(1500)` → 日志 + ErrorLog 记录

**F LLM 真调用（需 API Key）**
- [ ] `POST /api/answers` 带 `useLlm:true` → `source='llm_open'`
- [ ] 断网时自动降级 mock

### 前端原型
- [ ] `index.html` landing 3 角色卡
- [ ] `student.html` 所有新页能打开（登录/论典/SM-2/错题/收藏）
- [ ] `coach.html` 响应式：PC 侧栏 + 手机抽屉 + 登录/退出
- [ ] `admin.html` **尚未创建**（I.1 完成后再测）

---

## 🚀 新会话开工命令

### 1. 拉最新代码

```bash
cd ~/bicwny            # 或你克隆的路径
git fetch origin
git checkout claude/setup-bicwny-repo-hGIlF
git pull origin claude/setup-bicwny-repo-hGIlF
```

### 2. 告诉新 Claude 你要干什么

复制这段到新会话第一条消息：

```
继续觉学项目。分支 claude/setup-bicwny-repo-hGIlF，
最新 commit 11b9d97（P.3 coach.html）。

请先读 HANDOFF_CONTINUE.md，里面有完整待办清单。
我的优先顺序：
1. I.1 先把 admin.html 写完
2. 然后我跑 II.1-II.6 验证后端，有错你修
3. 之后看情况推进

每完成一个编号的小步都等我确认再进下一步。
```

### 3. 本地预览原型

```bash
cd ~/bicwny
python3 -m http.server 8000
# 浏览器：http://localhost:8000/
```

### 4. 后端测试命令（你可以一边跑一边交给 Claude）

```bash
cd ~/bicwny/backend

# 第一次
npm install
cp .env.example .env
docker compose up -d
npm run prisma:generate
npm run prisma:migrate    # 迁移名：sprint_1_to_3_5_baseline
npm run prisma:seed

# 检查
npm run typecheck
npm test

# 起服务
npm run dev
# 另开终端跑 TESTING.md § E 的 curl 清单
```

### 5. 有错直接贴给 Claude

```
跑 npm run typecheck 报错：
<粘贴错误>
```

Claude 定位到对应 commit + 文件 + 行号即可修。

---

## 📁 重要文件索引

| 文件 | 作用 |
|---|---|
| `backend/README.md` | 后端总览 · 70+ 端点表 |
| `backend/TESTING.md` | 完整测试 checkbox（F 节 LLM 真调用） |
| `backend/prisma/schema.prisma` | 23 model · 11 enum |
| `backend/src/app.ts` | Fastify 装配 · 所有路由注册处 |
| `backend/src/lib/` | prisma · config · errors · auth · request-id · timing · error-log |
| `backend/src/modules/` | auth / class / coach / questions / enrollment / courses / learning / favorites / reports / admin / llm / answering / sm2 / health |
| `index.html` | landing |
| `student.html` | 学员端（手机 App mockup） |
| `coach.html` | 辅导员端（响应式后台） |
| `admin.html` | **待写（I.1）** |
| `shared.css` / `admin-shell.css` | 样式 tokens |

---

## 💡 与 Claude 对话的最佳实践

1. **按编号说**：「做 I.1」「跑 II.3 报错 xxx」
2. **贴错误完整输出**，含 stack trace
3. **不确定时问"当前状态"**，Claude 会回溯 git log
4. **每完成一步都会提示下一步**，你选要不要进
5. **文件太长时**，Claude 会建议拆分或用 Edit 定点改

---

## 🆘 紧急情况

若 Claude 改乱了：

```bash
git log --oneline -20       # 找最后一个好的 commit
git reset --hard <commit>   # 回滚（注意：会丢未提交改动）
git push --force-with-lease # 推远端（谨慎！）
```

或直接告诉 Claude："回滚到 `e224fe6`（P.1 完成点）"，它会帮你。
