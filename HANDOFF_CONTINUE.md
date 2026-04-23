# 觉学项目 · 会话交接清单 v2（后端已跑通）

> 复制粘贴本文件到新会话，Claude 就能无缝继续。
> 覆盖上一版 `HANDOFF_CONTINUE.md`。

---

## 📌 当前状态（2026-04-22 新）

```
仓库：   ericjepsen9/bicwny
分支：   claude/setup-bicwny-repo-hGIlF
最新：   da4f323 fix(auth/tokens): 错误消息加 token 种类前缀
```

### ✅ 已完成 + 已在本地跑通

| 区域 | 状态 | 验证证据 |
|---|---|---|
| **Sprint 1-3.5 后端** | 100% 代码 + **本地真跑通** | 下面 14 步 checklist 全过 |
| **原型 P.1-P.4** | 100% | landing + student + coach + admin 4 文件 |
| **单元测试** | 44/44 过 | sm2 · grading.objective/mockOpen · auth.hash · auth.tokens · integration/auth |
| **冒烟测试** | 全过 | health / health/detailed / JWT 登录 / admin 3 端点 / 学员答题链路 |

### ✅ 本次验证 14 步（用户在本地 Win11 + Docker Desktop 全过）

```
 1 git pull                    ✓
 2 npm install 157 包           ✓
 3 docker compose up -d         ✓ postgres healthy
 4 Copy-Item .env.example .env  ✓
 5 prisma migrate + 命名迁移    ✓ 23 表建好
 6 prisma seed                  ✓ 3 账号 / 20 题
 7 typecheck                    ✓ 修了 5 处类型后全过
 8 npm test 44/44               ✓ 修了 2 处消息后全过
 9 npm run dev                  ✓ listening
10 curl /health                 ✓ 200 + reqId
11 curl /health/detailed        ✓ db.ok + llm 健康
12 Invoke-RestMethod 登录       ✓ 199 字符 token
13 admin 3 端点                 ✓ 大盘 / providers / logs
14 学员答题                     ✓ score=100 · SM-2 card+1 · 大盘 answers+1
```

---

## ⚠️ 验证过程中发现的问题（按优先级）

### 🔴 P0 · 已修好（代码已推 da4f323）

| # | 问题 | 修法 | 改动文件 |
|---|---|---|---|
| 1 | `typecheck` 5 处类型错（app.ts err unknown / auth.ts delete / mockOpen JsonValue / coach.routes z.unknown） | cast 与守卫 | `79052e7` + `d89d697` |
| 2 | `auth.tokens.test.ts` 2 个 assertion 因 "token 类型不正确" 不含 `access/refresh` 失败 | 消息加前缀 | `da4f323` |

### 🟠 P1 · 已知工作流问题（下次修）

| # | 问题 | 现在绕开办法 | 未来修法 |
|---|---|---|---|
| 3 | `tests/integration/auth.test.ts` 的 `resetDb()` 会清 `user` 表，导致 seed 的 admin/coach/student 账号消失 | 跑完 `npm test` 重新 `npm run prisma:seed` | 改 helpers 用独立测试库（另一个 DATABASE_URL）或保留 demo 账号 |
| 4 | `package.json` 里 `test: "vitest run --exclude 'tests/integration/**'"` 在 vitest v2.1.9 下**不生效**（仍跑了 integration） | 就让它跑吧（目前通过） | 改用 `testPathIgnorePatterns` 或分包管理 |
| 5 | `prisma migrate dev` 在 PowerShell 下**交互式输入迁移名卡死** | 用 `npx prisma migrate dev --name xxx`（非交互） | 无需修，记入文档即可 |
| 6 | 上一次被 Ctrl+C 中断的 migrate 会**留 advisory lock** 使下次 migrate 超时 P1002 | `docker compose restart postgres` | 下次别 Ctrl+C 中断 migrate |
| 7 | `package.json#prisma` 配置 Prisma 7 将弃用 | 无影响 | 迁移到 `prisma.config.ts` |

### 🟡 P2 · 非 bug 观察

- Seed 数据里没种子答题记录，大盘初始全 0 是正常
- PowerShell 把 Node/Prisma 的 `warn` 消息误标红色（`NativeCommandError`）：**不是错**，看内容不是 `error` 就行
- 7 个 npm vulnerabilities（moderate/high/critical）：dev 可忽略，生产前 `npm audit fix` 处理

---

## ❌ 未完成 · 按优先级排（从上一版 HANDOFF 剔除已做的）

### 🔴 Phase I · 原型（已完）
- [x] I.1 admin.html · 7 小步全完

### 🟠 Phase II · 后端验证（已完）
- [x] 全 14 步完

### 🟠 Phase III · 生产准备（5 步 · 一个都没开始）

- [ ] **III.1** `backend/Dockerfile` + `docker-compose.prod.yml`
- [ ] **III.2** `CORS_ORIGINS` env 白名单（app.ts 改）
- [ ] **III.3** `@fastify/rate-limit`（防注册轰炸 + LLM 刷量）
- [ ] **III.4** 邮件服务（注册验证 + 密码重置 · 需 SMTP/SendGrid）
- [ ] **III.5** 文件上传（头像 / 法本 PDF · 需对象存储）

### 🟣 Phase P+ · 原型图持续完善（你刚选的方向）

当前原型已有 4 个文件 · 6200+ 行，功能页面齐备。继续可做：

#### P.5 · 视觉一致性
- [ ] **P.5.a** 统一 emoji 尺寸 / 替换为 SVG 图标（侧栏 · 角色卡 · 题型标签）
- [ ] **P.5.b** 字号梯度 · 行高 · letter-spacing 统一化（rem 系统）
- [ ] **P.5.c** 深色模式（prefers-color-scheme + 手动切换按钮）
- [ ] **P.5.d** 品牌 LOGO 再打磨（当前 🪷 → SVG 可缩放）

#### P.6 · 交互完整性
- [ ] **P.6.a** 学员：密码找回流程（3 屏 · 邮箱 → 验证码 → 改密）
- [ ] **P.6.b** 学员：首次引导（第一次打开 App 的 onboarding 3 屏）
- [ ] **P.6.c** 通用：空状态 / 加载态 / 错误态 组件
- [ ] **P.6.d** 页面切换动画（slide / fade）
- [ ] **P.6.e** Toast 升级（含 icon · 多级别）

#### P.7 · 数据故事
- [ ] **P.7.a** 更真实的 Mock 数据（20+ 学员 · 多样答题历史 · 多班级）
- [ ] **P.7.b** Admin 大盘的"本周用量趋势"占位替换为 SVG 渐变柱图
- [ ] **P.7.c** Coach 班级统计加折线图（近 7 天答题量）
- [ ] **P.7.d** 错题本 / 收藏增加多样性样本

#### P.8 · 内容扩展
- [ ] **P.8.a** 简繁切换开关（data-lang="zh-Hans/zh-Hant" 驱动）
- [ ] **P.8.b** Student：关于 · 隐私政策 · 帮助页
- [ ] **P.8.c** Student：班级公告板（辅导员发帖 · 学员 like）
- [ ] **P.8.d** Student：法本音频播放器占位

#### P.9 · 移动端优化
- [ ] **P.9.a** 手机 Safe Area 适配（iOS 刘海 / Android 状态栏）
- [ ] **P.9.b** 底部 tab 栏统一（当前 class 页有 · 其他缺）
- [ ] **P.9.c** 下拉刷新指示器
- [ ] **P.9.d** 答题页横屏模式（大平板更友好）

#### P.10 · 可访问性 + 细节
- [ ] **P.10.a** 键盘导航焦点样式
- [ ] **P.10.b** ARIA 标签 + 屏幕阅读器
- [ ] **P.10.c** 高对比度模式
- [ ] **P.10.d** 打印友好 CSS（成就证书导出用）

---

### 🟡 Phase IV · 集成测试补齐

- [ ] **IV.0** 先修 P1 问题 3：改 `tests/integration/helpers.ts` 用独立 test DB
- [ ] **IV.1** `/api/answers` 全流程 e2e（→ UserAnswer + Sm2Card 落库）
- [ ] **IV.2** 班级权限越权 e2e（coach A 访问 coach B 班 → 403）
- [ ] **IV.3** 题目双轨 + Admin 审核 e2e（→ AuditLog）
- [ ] **IV.4** LLM Gateway 切兜底 e2e（mock MiniMax 抛错 → Claude 接替 → `switched=true`）

### 🟢 Phase V · 真前端（Sprint 4 · 大工程）

- [ ] **V.1** Next.js 14 App Router 骨架 + Tailwind + ESLint
- [ ] **V.2** 认证流（login / refresh / middleware）
- [ ] **V.3** 学员路径（courses / lessons / answer / sm2 / mistakes / favorites）
- [ ] **V.4** 辅导员端
- [ ] **V.5** Admin 端
- [ ] **V.6** 部署（Vercel / Cloudflare Pages）

### 🟢 Phase VI · 体验完善（5 步）
- [ ] VI.1 国际化 i18n
- [ ] VI.2 搜索
- [ ] VI.3 CSV 导出
- [ ] VI.4 通知系统
- [ ] VI.5 作业功能

### 🟢 Phase VII · 文档 & 运维（4 步）
- [ ] VII.1 README 最终版
- [ ] VII.2 OpenAPI / Swagger
- [ ] VII.3 Sentry
- [ ] VII.4 Grafana / Prometheus

---

## 🚀 新会话开工命令

### A. 新会话第一条消息复制这段

```
继续觉学项目。分支 claude/setup-bicwny-repo-hGIlF，最新 da4f323。

后端 Sprint 1-3.5 + 原型 P.1-P.4 已完成，本地已跑通 14 步冒烟测试。
请读 HANDOFF_CONTINUE.md（仓库根，v2 版本）了解全貌。

下一步我想做：xxx（填入编号，例如 III.1 / IV.1 / V.1 / P2 修复）

每完成一小步都等我确认再进下一步。
```

### B. 你本地拉最新

```powershell
cd C:\Users\ericj\bicwny
git fetch origin
git pull origin claude/setup-bicwny-repo-hGIlF
```

### C. 如需再次验证后端（已验证过可跳）

```powershell
cd backend
docker compose up -d                              # 如果 postgres 没开
docker compose ps                                 # 等 healthy
npm run dev                                       # 这个窗口别关

# 新开 PowerShell：
$login = Invoke-RestMethod -Method POST `
  -Uri http://localhost:3000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"admin@juexue.app","password":"admin123456"}'
$TOKEN = $login.data.accessToken
$headers = @{ authorization = "Bearer $TOKEN" }

Invoke-RestMethod -Uri http://localhost:3000/api/admin/platform-stats -Headers $headers
```

**如果登录失败**（集成测试把账号清了）→ `npm run prisma:seed` 再试。

### D. 查看原型（已推进但还没让你看过）

```powershell
cd C:\Users\ericj\bicwny
python -m http.server 8000
# 浏览器：
#   http://localhost:8000/              landing
#   http://localhost:8000/student.html  手机 App mockup
#   http://localhost:8000/coach.html    辅导员响应式后台
#   http://localhost:8000/admin.html    管理员 9 页后台
```

---

## 📁 关键文件索引

| 路径 | 作用 |
|---|---|
| `HANDOFF_CONTINUE.md` | **本文件** · 会话交接清单 |
| `backend/README.md` | 后端总览 · 70+ 端点 |
| `backend/TESTING.md` | 详细 checkbox + 调试工具 |
| `backend/prisma/schema.prisma` | 23 model · 11 enum |
| `backend/src/app.ts` | Fastify 装配 · 所有路由注册 |
| `backend/src/lib/` | prisma/config/errors/auth/request-id/timing/error-log |
| `backend/src/modules/` | auth/class/coach/questions/enrollment/courses/learning/favorites/reports/admin/llm/answering/sm2/health |
| `index.html` | landing（3 角色入口） |
| `student.html` | 学员手机 App mockup · 17 页 |
| `coach.html` | 辅导员响应式后台 · 5 页 |
| `admin.html` | 管理员响应式后台 · 9 页 |
| `shared.css` · `admin-shell.css` | 样式 |

---

## 💡 与 Claude 对话的最佳实践

1. **按编号说**：「做 III.1」「修 P1 问题 3」
2. **贴错误完整输出**，含 stack trace（Windows PowerShell 的红色 `NativeCommandError` 可以忽略，看实际内容）
3. **每步拆小再拆**：单次代码改动 ≤ 500 行，每步 1 个 commit
4. **问"当前状态"** 回溯 git log
5. **不要 Ctrl+C 中断 prisma migrate**（会留 advisory lock）

---

## 🆘 常见坑速查

| 症状 | 原因 | 修 |
|---|---|---|
| `prisma migrate` 卡住 | PowerShell 交互提示 | 用 `npx prisma migrate dev --name xxx` |
| `P1002 advisory lock timeout` | 上次被中断的 migrate 留锁 | `docker compose restart postgres` |
| 登录报 `UNAUTHORIZED` | 集成测试清了 users 表 | `npm run prisma:seed` |
| PowerShell 一堆红字 | 把 stderr 当错误显示 | 看内容，`warn` 不是错 |
| Docker 没装 | 装 Docker Desktop | 启动 Docker Desktop + 等 WSL2 就绪 |

---

## 🎯 强烈建议的下一步

按影响从大到小：

1. **P2 修 · P1 问题 3**（集成测试隔离）→ 方便每次重跑测试
2. **III.3 rate-limit**（1 个文件，~60 行）→ 防滥用的第一道门
3. **III.1 Dockerfile**（1 个文件）→ 为部署铺路
4. **V.1 Next.js 骨架**（大工程）→ 开始真前端

或者你有别的想法，直接告诉新 Claude。
