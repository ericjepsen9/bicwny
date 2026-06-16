# 觉学(juexue)仓库代码审计报告 · sss v2.0 复用评估

**审计日期**：2026-06-16
**审计范围**：`ericjepsen9/bicwny` 全仓库
**目的**：评估 juexue 代码库作为 sss v2.0 基础的复用可行性

---

## P0-A：测试覆盖 / CI 现状

**后端测试**：31 个测试文件，约 5,055 行

| 类型 | 数量 | 行数 |
|---|---|---|
| 单元测试（unit） | 8 | ~817 |
| 集成测试（integration） | 23 | ~4,238 |

覆盖模块：auth、answering、grading（5 种题型）、sm2、notifications、password-reset、questions、sessions、reports、analytics、push、search、admin、content-versioning、data-export、experiments、feedback、notes、achievements、practice-makeup、llm circuit、system-settings

**前端测试**：8 个 Playwright E2E spec，约 903 行，覆盖 smoke、flows、student-flow、interaction、page-tour、visual（截图回归）

**CI（GitHub Actions，2 个 workflow）**：

- `test.yml`：4 个并行 job（backend unit+integration、e2e、frontend typecheck+lint+build、prototypes syntax）。触发：push to `main` 或 `claude/**`、PR、手动。
- `deploy.yml`：手动触发，SSH 部署到 staging 或 prod，可选 `prisma migrate deploy`。

**结论**：测试体系完整，CI 覆盖全流程。复用时继承 CI 配置成本低，主要改动是替换环境变量。

---

## P0-B：Auth 触点 · JWT · 四角色爆炸半径

**角色系统**：

```prisma
enum UserRole {
  admin
  coach
  student
}
```

三个角色，硬编码在 Prisma schema。JWT accessToken payload：

```ts
{ sub: string, role: UserRole, sid: string, aud: 'access' }
```

**requireRole 调用计数**：

- 出现文件数：**32 个**（含 1 个定义文件）
- 总调用次数：**76 次**（跨 31 个路由文件）
- 实现位置：`backend/src/lib/auth.ts`，单函数返回 `preHandlerAsyncHookHandler`

典型使用模式：

```ts
const adminGuard = requireRole('admin');
const coachGuard = requireRole('coach', 'admin');
app.get('/path', { preHandler: adminGuard }, handler);
```

**全局钩子**：`jwtOptional` 挂在 `app.ts` 作 `onRequest` 全局钩子，静默附加 `req.user`，从不抛错。路由级 `requireRole` 才强制检查。

**爆炸半径评估**：

| 场景 | 影响 |
|---|---|
| 保留 3 角色、仅改角色名称 | 需修改 Prisma enum + 76 处 requireRole 调用 + 前端权限判断，工作量：1-2天 |
| 增加第 4 角色（如 `manager`） | schema + 1 个新 guard 函数 + 相关路由的 guard 注册，工作量：<1天 |
| 完全重构角色体系（RBAC/ABAC） | 需替换 lib/auth.ts 核心 + 76 处路由 preHandler，工作量：1周+ |
| sss 与 juexue 角色名称相同 | 零改动 |

**Auth 模块本身**（`backend/src/modules/auth/`，9 个文件）：**高度可复用**。涵盖 email 验证、密码重置（SHA-256 token，24h TTL，每用户 3次/小时限速）、session 管理、refresh token（DB 存 hash）。仅依赖 `lib/config`、`lib/errors`、`lib/prisma`，无业务域耦合。

---

## P0-C：实践域重写范围

**深度业务耦合模块（~18 个，佛法学习域锁定）**：

| 模块 | 文件数 | 内容 | 复用可能性 |
|---|---|---|---|
| answering | 13 | 14 种题型评分策略 + SM-2 集成 + 进度聚合 | 评分引擎可提取，业务聚合层需重写 |
| questions | 11 | 题库 CRUD + LLM 生成 + 审核队列 + 答错本 | 题库模式可复用，内容域耦合中等 |
| courses | 7 | 论典/法本 → 章 → 节 三层树 CRUD | 课程树结构通用，字段名需改 |
| practice | 9 | 修学计数（心咒/顶礼/打坐）+ 補卡 + 排行 | 全部重写 |
| sm2 | 3 | Anki SM-2 算法 + 间隔复习调度 | algorithm.ts 可直接复用；service.ts 需适配 |
| meditations | 5 | 观修视频 + FFmpeg + SCP 到 OSS | 完全重写（除非 sss 也用观修视频） |
| dharma-assemblies | 2 | 法会/法会系统 CRUD + 藏历 + push | 重写 |
| tibetan | 3 | 藏历日 TibetanDay 查询服务 | 重写（除非 sss 需要藏历） |
| enrollment | 1 | 课程报名 + 80% 答题通过阈值 | 逻辑可复用，阈值改配置 |
| reading | 2 | 阅读进度心跳（scrollPercent + 秒数）| 模式可复用 |
| highlights | 2 | 文本段落高亮（4色）| 模式可复用 |
| achievements | 2 | 成就勋章（基于 UserAnswer/SM-2）| 重写 |
| dossier | 3 | 学员画像聚合（调用 6+ 模块）| 重写 |
| learning | 1 | 学习路径 facade | 重写 |
| coach | 5 | 辅导员仪表盘（班级/学员统计）| 若 sss 有辅导员角色则结构可参考 |
| class | 4+subdir | 班级排课（ClassSession）| 若 sss 有班级则可复用 |
| posters | 2 | 月度首页画报 | 图片 CMS 模式可复用 |

---

## P0-D：模块级引擎可复用性

**高度可复用（~16 个模块，建议直接继承）**：

| 模块 | 文件数 | 可复用原因 |
|---|---|---|
| **auth** | 9 | 标准 email/password + session，无域耦合 |
| **llm** (gateway) | 14 | 多 provider（MiniMax/Claude）+ 熔断 + quota + 日志，完全解耦 |
| notifications | 4 | 通知 inbox（软删除 + cursor 分页），通用 |
| push | 2 | Web Push VAPID 封装，纯基础设施 |
| scheduler | 5 | cron + dispatch pipeline，提醒 builder 需替换 |
| analytics | 1 | 事件批量摄入 + admin 聚合，通用 |
| health | 1 | 健康检查端点，通用 |
| search | 1 | 全文搜索路由层，实现层适配即可 |
| experiments | 1 | A/B 实验分配，通用基础设施 |
| favorites | 2 | 书签（幂等 P2002 模式），通用 |
| feedback | 2 | 用户反馈收件箱（匿名 + 限速），通用 |
| notes | 3 | 富文本笔记（标签 + 置顶 + 归档），结构通用 |
| system-announcements | 2 | 平台公告（严重级别 + 撤销），通用 |
| admin (scaffold) | 9 | admin 脚手架模式，内容需替换 |
| reports | 2 | 内容举报工作流（三态），通用模式 |
| announcements | 2 | 班级公告 + 图片，若 sss 有班级则可用 |

**LLM Gateway 是最高价值复用件**：支持 3 个 provider（minimax / minimax-m27 / claude），干净的 `ChatProvider` 接口，内置熔断器、quota 管理、per-scenario DB 配置、promptHash 日志，抽为独立 package 或直接 fork 均只需改 `.env`。

---

## P1-A：前端技术栈评估

**技术选型**：React 18 + Vite + TypeScript + Capacitor 8 + Zustand + React Query

**页面规模**：78 个页面文件，覆盖三个门户（学员 / 辅导员 / admin）

**Capacitor 状态**：
- `capacitor.config.ts` 已配置（appId: `app.juexue`，离线 bundle 模式）
- **iOS / Android 原生项目尚未生成**（`ios/` 和 `android/` 目录不存在）
- `cap sync` 脚本存在，但从未执行 `cap add ios/android`
- 实质：当前是 **Web-only**，Capacitor 封装未落地

**对 sss v2.0 的含义**：
- 若 sss 也用 Web+Capacitor 技术栈 → 直接继承，仅改 appId/appName/domain
- 若 sss 要原生 iOS/Android → 需从零执行 `cap add`，当前无原生代码可复用
- API 客户端层（`src/lib/api.ts` + `queries.ts`）可作为模式参考，实际内容需替换

---

## P1-B：模块存在性清单

| 模块 | 是否存在 | 备注 |
|---|---|---|
| notifications | ✅ | 4 个文件，通用 inbox |
| search | ✅ | 1 个文件，路由层通用 |
| analytics | ✅ | 事件摄入 + 聚合 |
| experiments | ✅ | A/B 实验 |
| achievements | ✅ | 但深度耦合 UserAnswer/SM-2 |
| tibetan | ✅ | 藏历专用 |
| **sms** | ❌ | **缺失** — DR-暂缓，未实现 |
| push | ✅ | Web Push VAPID |

**唯一缺失**：SMS 模块。DR 文档中已标注暂缓，未实现。若 sss v2.0 需要短信通道，需从头开发。

---

## P1-C：代码量指标

| 范围 | 文件数 | 估算 LOC |
|---|---|---|
| backend/src/ | 166 .ts | ~25,260 |
| juexue-v2/src/ | 159 .ts/.tsx | ~36,305 |
| **合计** | **325** | **~61,565** |

| 测试代码 | 文件数 | 行数 |
|---|---|---|
| 后端测试 | 31 | ~5,055 |
| 前端 E2E | 8 | ~903 |
| **合计** | **39** | **~5,958** |

测试/源码比：约 9.7%（集成测试为主，单元测试较少）

---

## P1-D：数据库与迁移状态

**Prisma 模型数量**：60 个 model

**Migration 数量**：**仅 2 个**（`0_init` + `1_lesson_resources`）

这表明：
- 数据库 schema 基本以 `db push` 方式演进（非迁移驱动），历史变更无版本追踪
- `1_lesson_resources` 是首个正式 migration，说明迁移规范化刚起步（CLAUDE.md 中 `prisma migrate deploy` 取代 `db push` 的备注印证这一点）
- 对 sss fork：**这是有利条件** — 初始 schema 未被大量历史迁移锁定，fork 时可以 `0_init` 为起点自由改造

---

## P2-A：Auth 范式（应用层 vs DB-RLS）

**当前范式**：完全应用层（middleware），无 DB 层 RLS

- `jwtOptional` 全局 onRequest hook → 附加 `req.user`
- `requireRole()` preHandler → 在路由层强制角色检查
- Prisma 查询不含任何 `WHERE userId = req.user.id` 的 RLS 等价逻辑（作用域通过 service 层显式传参控制）

**含义**：
- 切换到 Supabase 时，若要利用 Supabase RLS，需要在每个表上重新定义策略（60 个 model）
- 若 Supabase 仅作为托管 PostgreSQL（不用 RLS），当前 Fastify 层可直接对接，零范式迁移成本
- 建议：继续使用应用层鉴权，Supabase 当托管 PG + Storage 用（与 handoff report 中的 Supabase 建议一致）

---

## P2-B：pgvector / RAG

grep 扫描显示 24 个文件命中向量相关关键词，但**全部位于设计文档和前端 utility 文件中**（lib/practiceLimit.ts、readMode.tsx 等，属于误匹配），后端源码中**无任何 pgvector 实现**。

- `backend/src/lib/search.ts` 存在，但是标准全文搜索（PostgreSQL `tsvector`），非向量检索
- DR-109（AI 助手能力25）已整体标注 `⏸ 暂缓，不进入 1.0`
- **结论**：pgvector / RAG 当前为零代码。sss v2.0 若需要，从头开发。

---

## 已知代码层缺陷（审计发现）

1. **verse / chain 题型 publicView.ts 空白**：`backend/src/modules/answering/publicView.ts` 无 `verse` 或 `chain` 分支，`default` 返回 `{}`，前端无法接收 token 列表或上句。后端评分逻辑已就绪，但前端无法渲染这两种题型。影响：verse/chain 在前端实际不可用。

2. **SM-2 服务层域耦合**：`sm2/service.ts` 直接操作 `Question`、`UserAnswer`、Course 相关表。`sm2/algorithm.ts` 纯算法可直接复用，service 层需在 sss 中重新绑定模型。

3. **Capacitor 原生项目未生成**：移动端能力仍是零。

---

# 复用评估结论

**总体判断：适合 fork 改造，不适合从头重写，也不建议直接 clone。**

## 直接可用（零或极少改动）

| 资产 | 行动 |
|---|---|
| LLM Gateway（minimax + claude + 熔断 + quota）| 直接继承，改 `.env` |
| Auth 模块（email/password/session/refresh）| 直接继承，仅改角色 enum 值 |
| CI/CD pipeline（test.yml + deploy.yml）| 直接继承，改环境变量 |
| 通知/Push/Analytics/Experiments/Feedback/Notes | 直接继承 |
| Fastify + Prisma + Zod 后端脚手架 | 直接继承 |
| React + Vite + Zustand + React Query 前端脚手架 | 直接继承 |

## 需要适配（结构保留，内容替换）

| 资产 | 工作量 |
|---|---|
| 角色名称（admin/coach/student）| 若 sss 角色不同：改 schema + 76 处 requireRole，1-2 天 |
| 课程树（Course→Chapter→Lesson）| 若 sss 内容结构类似：字段重命名，1-2 天 |
| 题库/答题引擎 | 若 sss 有答题：保留评分策略框架，重写 publicView + 业务层 |
| 前端三门户（学员/辅导员/admin）| 页面结构参考，内容全部重写 |

## 必须重写（强域耦合）

| 资产 | 原因 |
|---|---|
| practice（修学计数）| 完全佛法专用 |
| dharma-assemblies、tibetan | sss 不太可能需要法会/藏历 |
| meditations（观修视频 + FFmpeg + SCP）| 依赖特定基础设施 |
| dossier（学员画像聚合）| 纯域编排层 |
| 60 个 Prisma 模型中约 35 个 | 只保留通用模型（User, AuthSession, Notification 等） |

## 关键数字

- 后端总 LOC：~25K；可直接复用比例估算：约 35%（~9K LOC）
- 前端总 LOC：~36K；可直接复用比例估算：约 15%（~5K LOC，主要是 lib/ 工具层）
- Migration 包袱极轻（仅 2 个），fork 起步成本低
- 测试体系完整，继承后可立即为 sss 提供 CI 保障

## 最高价值单一资产

**LLM Gateway**（`backend/src/modules/llm/`，14 个文件）：支持 MiniMax + Claude 双 provider，内置熔断、quota、per-scenario DB 配置、成本记录，是整个仓库中与业务域耦合最低、工程质量最高的模块。单独提取为 npm package 或 git subtree 对 sss v2.0 价值极大。

## 一句话建议

Fork juexue 仓库，保留 auth + llm + 基础设施层（~16 个通用模块），清空 practice/courses/meditations/dossier/tibetan 等 ~18 个域锁定模块，在干净的 Prisma schema 基础上开始 sss 的业务建模。预计基础搭建时间比从头开始缩短 3-4 周。

---

*审计数据依据：*
- *测试：31 后端 + 8 前端测试文件，5,958 行测试代码*
- *Auth：`backend/src/lib/auth.ts`，requireRole 76 次调用跨 31 文件*
- *模块：34 个后端模块，~130 .ts 文件，60 个 Prisma model*
- *规模：~61,565 LOC（后端 25K + 前端 36K）*
- *迁移：仅 2 个 migration，schema 改造成本低*
- *移动端：Capacitor 8 配置存在但原生项目未生成*
