# 觉学（JueXue）项目移交报告

**生成日期**：2026-06-08  
**适用对象**：新接手产品经理  
**文档性质**：非权威设计文档（权威来源见§9 设计文档体系）  

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [产品概述](#2-产品概述)
3. [用户角色与权限体系](#3-用户角色与权限体系)
4. [核心业务流程](#4-核心业务流程)
5. [技术架构](#5-技术架构)
6. [数据库架构概览](#6-数据库架构概览)
7. [业务能力全清单（51项）](#7-业务能力全清单51项)
8. [老系统现状 vs 新设计目标](#8-老系统现状-vs-新设计目标)
9. [设计文档体系（5层SoT）](#9-设计文档体系5层-sot)
10. [设计验证测试现状](#10-设计验证测试现状)
11. [待决策事项](#11-待决策事项)
12. [已知风险与技术债](#12-已知风险与技术债)
13. [实施路线图（Phase 1–5）](#13-实施路线图phase-15)
14. [基础设施与部署](#14-基础设施与部署)
15. [接手清单](#15-接手清单)

---

## 1. 执行摘要

**觉学（JueXue）** 是一个面向佛法修学团体的在线学修管理平台，服务于师生关系明确、有结构化升学路径的闻修体系。

**当前状态（2026-06-08）**：

- **生产系统在运行**：老版本系统已上线，覆盖学员日常学修、打卡、考试、共修等核心功能
- **新一代设计已完成**：51 项业务能力的完整设计文档已定稿（DR-1~209），覆盖数据模型、API 契约、权限体系
- **实施阶段尚未开始**：新设计需要对数据库扩展约13张新表、改造若干现有表，并对前端进行大幅重构
- **当前工作重心**：设计验证（P0级别场景测试），在写代码之前确认设计无逻辑漏洞

**关键数字**：

| 指标 | 数字 |
|---|---|
| 业务能力（设计范围） | 51 项 |
| 已实现能力（老系统） | ~35 项（含净资产） |
| 新增/改造能力 | ~16 项 |
| 数据库现有表 | 60 张 |
| 新增表（设计目标） | ~13 张 |
| 设计决策记录（DR） | 209 条（DR-1~209） |
| 角色数量 | 4 个 |
| 生产服务器 | 2 台 OCI |

---

## 2. 产品概述

### 2.1 产品定位

觉学服务于一个有传统师承关系的佛法修学体系。学员在辅导员带领下，按专业（Program）分班修学，完成闻（听法）、思（答题）、修（实修打卡、共修出勤）三环节，达到升学条件后进入更高阶段。

**核心特点**：
- **不是普通网课平台**：有严格的升学审核（六条件并达），有代打卡追责机制，有法本内容保护（密法访问控制）
- **线上线下结合**：共修出勤同时支持线上（时效签到码）和线下（辅导员批量勾选）
- **多专业并行**：一个学员可同时在加行班和净土班，两套升学体系完全独立
- **辅导员是核心角色**：辅导员负责管理自己班级的学员，跟进进度，发起考试，处理补卡

### 2.2 核心学修模块

| 模块 | 说明 |
|---|---|
| 法本阅读 | 沉浸式阅读器，手动确认"读完"写入完成记录 |
| 音视频学习 | 上师讲法录音/视频，手动确认写入完成记录 |
| 思考题/答题 | 14种题型，客观题自动判分，开放题AI判分 |
| 加行观修 | 92修法打卡（座数+时长双维度） |
| 内加行实修 | 顶礼/心咒打卡，法王祈祷文计数 |
| 日常打卡 | 各专业日常修持记录 |
| 共修出勤 | 在线/线下共修签到，升学六条件之一 |
| 学期报数 | 每期末提交修行数据，管理层审核 |
| 升学预检 | 六条件自动预检，班级管理员审核后提交 |

### 2.3 学员升学六条件

以加行为例，升正科需同时满足：

1. **闻思圆满**：本专业全部课程听≥1遍 + 看≥1遍 + 答题通过
2. **传承达标**：必要传承记录完整
3. **加行观修**：92修法全部完成（≥3座/修法，≥90分钟/修法）
4. **共修出勤**：出勤次数≥专业配置门槛（如93次）
5. **讲考通过**：升学讲考评分合格
6. **考试合格**：升学考试达到合格线

以上六条由 `ProgramAdvancementConfig` 配置，`AdvancementCheck` 自动预检，全部通过后提交 `AdvancementRecord`。

---

## 3. 用户角色与权限体系

### 3.1 四角色线性继承

```
class_tutor（辅导员）
    ↓ 继承
class_admin（班级管理员）
    ↓ 继承
subject_admin（专业管理员）
    ↓ 继承
super_admin（平台管理员）
```

| 角色 | 中文 | 作用域 | 核心职能 |
|---|---|---|---|
| `class_tutor` | 辅导员 | 单个班级 | 查看学员进度、发起出勤、批量勾选签到、出随堂题 |
| `class_admin` | 班级管理员 | 单个班级 | 辅导员所有权限 + 补卡/撤销出勤/留级/升学预检/豁免 |
| `subject_admin` | 专业管理员 | 整个专业 | 班级管理员所有权限 + 跨班级 + 创建考试/评分/传承管理 |
| `super_admin` | 平台管理员 | 整个平台 | 所有权限 + 撤销升学/专业配置/再入学审批 |

**重要规则**：
- 角色通过 `UserRoleAssignment` 分配，含作用域（classId 或 programId）
- 同一人可在A班是辅导员、在B班是管理员（多角色叠加）
- 学员端（`/app/`）永远看纯消费视图，即使该人同时是辅导员
- 管理操作只能在辅导员端（`/coach/*`）或admin端（`/admin/*`）进行

### 3.2 学员身份特殊情况

| 情况 | 处理 |
|---|---|
| 盲/低视力/文盲 | 闻思只需听≥2遍，免答题（`StudentSpecialStatus.statusType=blind`）|
| 聋/听障 | 闻思只需看≥2遍，免答题（`statusType=deaf`）|
| 自学学员 | 无班级、不计出勤、不升学、自我追踪用 |

---

## 4. 核心业务流程

### 4.1 学员完整生命周期

```
邀请码加入班级
    ↓
cohortStatus: active（在读）
    ↓
日常学修（闻思+实修+共修）
    ↓
学期末：提交报数（SemesterSnapshot）
    ↓
达到毕业条件：cohortStatus → graduated
    ↓
升学预检（AdvancementCheck，六条件自动检查）
    ↓
通过 → AdvancementRecord（升学记录）→ 进入下一专业
    ↓
未通过 → 留级（cohortStatus: held_back）→ 新届从头
```

### 4.2 共修出勤流程

```
辅导员/admin 创建 ClassSession（线上/线下/自学）
    ↓
线上：生成 checkInToken（有效期=checkinGraceMinutes，默认30分钟）
    ↓
学员扫码/点链接签到 → 写 StudyRecord（studyType=group_attend）
线下：辅导员进入批量勾选页 → 提交 → 批量写 StudyRecord
    ↓
升学预检 attendance COUNT StudyRecord（已失效的不计，invalidatedAt IS NULL）
```

### 4.3 代行操作流程（能力5）

管理员可代学员操作（补录修量、调整进度等），通过 `ProxyAction` 表留痕：
- 代行写入 `ProxyAction`（originalValue / newValue / reason）
- 同步写 `AuditLog`（不可删改）
- 撤销代行：新值回滚到原值，ProxyAction 双保留

---

## 5. 技术架构

### 5.1 技术栈

**前端**（`juexue-v2/`）：

| 技术 | 版本 | 用途 |
|---|---|---|
| React | 18.3 | UI框架 |
| Vite | 5.4 | 构建工具 |
| TypeScript | 5.6 | 类型系统 |
| TanStack Query | 5.59 | 服务端状态管理 |
| Zustand | 5.0 | 客户端状态 |
| React Router DOM | 7.0 | 路由 |
| Capacitor | 8.x | iOS/Android 原生封装 |
| Playwright | 1.59 | E2E测试 |

**后端**（`backend/`）：

| 技术 | 版本 | 用途 |
|---|---|---|
| Fastify | 5.2 | API框架 |
| TypeScript | 5.7 (ESM) | 语言 |
| Prisma | 6.1 | ORM |
| PostgreSQL | 16 (Docker) | 数据库 |
| Zod | 3.24 | Schema校验 |
| `@fastify/jwt` | 10.1 | JWT认证 |
| undici | 6.21 | HTTP客户端 |
| Vitest | 2.1 | 单元/集成测试 |
| Sentry | 8.55 | 错误监控 |

**LLM网关**（`backend/src/modules/llm/`）：

| 要素 | 内容 |
|---|---|
| Provider | Claude（Anthropic）+ MiniMax（双Provider） |
| 功能 | 答题批改（open/guided题型）、AI助手问答 |
| 特性 | 熔断器、配额管理、场景路由、用量统计 |

**亚洲中转节点**（`asia-relay/`）：
- 纯 Node 标准库，零依赖，独立服务
- 用于法本站点抓取（香港/东京/新加坡节点）
- Caddy 反代 + systemd 守护

### 5.2 系统架构

```
用户（浏览器/iOS/Android）
    ↓ HTTPS
nginx（主服务器）
    ├── /app/ → 前端静态文件（/var/www/juexue/app/）
    └── /api/ → 反代 Fastify（127.0.0.1:3000）
                    ↓
                Fastify（PM2 进程 juexue-api）
                    ├── PostgreSQL（Docker, 端口5433）
                    ├── OSS服务器（129.213.64.152，ssh+scp上传）
                    └── LLM API（Anthropic / MiniMax）

亚洲中转节点（asia-relay, 独立服务器）
    → 法本站点抓取代理
```

### 5.3 代码组织

```
bicwny/
├── backend/            Fastify API（34个业务模块）
│   ├── src/modules/    业务模块（auth/class/courses/llm/...）
│   ├── src/lib/        公共库（ttl-cache/circuit/oss/...）
│   └── prisma/         Schema + Migration
├── juexue-v2/          React SPA
│   ├── src/pages/      页面组件
│   ├── src/components/ 通用组件
│   └── src/api/        API hooks（React Query）
├── asia-relay/         法本抓取中转（relay.mjs）
├── e2e/                Playwright端到端测试
├── deploy/             nginx配置 + 部署脚本
└── docs/_handoff/      设计文档（SoT）
```

---

## 6. 数据库架构概览

### 6.1 现有系统（生产，60张表）

分14个域组：

| 域 | 主要表 | 说明 |
|---|---|---|
| 用户 | User | 中心节点，含旧版 role enum（admin/coach/student）|
| 班级 | Class, ClassMember | 班级与成员关系 |
| 内容 | Course, Chapter, Lesson, LessonResource | 课程内容树 |
| 题库 | Question, UserAnswer, Sm2Card | 答题与间隔复习 |
| 观修 | Meditation, MeditationSession | 加行观修 |
| 打卡 | PracticeCategory, PracticeProject, PracticeLog | 实修打卡 |
| 成绩 | 各类成绩表 | 讲考/考试 |
| LLM | LlmProviderConfig, LlmScenarioConfig | AI网关配置 |
| 审计 | AuditLog | 高权限操作留痕 |
| 通知 | NotificationRule, DispatchLog | 通知体系 |
| 其他 | TibetanDay, HomePoster, Achievement等 | 运营内容 |

**注意**：现有系统使用旧版 `User.role` 枚举（admin/coach/student），**尚未迁移**到新4角色设计（UserRoleAssignment）。

### 6.2 新设计新增表（13张，待实施）

| 表名 | 用途 | Migration单元 |
|---|---|---|
| UserRoleAssignment | 新4角色分配（含作用域）| M2a |
| RoleAssignmentHistory | 角色变更留痕 | M2a |
| CareFollowupRecord | 关怀跟进记录 | M2b |
| TransmissionRecord | 传承记录 | M2c |
| ClassSession | 共修场次 | M3 |
| ClassSessionSchedule | 场次排期 | M3 |
| StudyRecord | 出勤记录 | M3 |
| SpeakingSession | 讲考场次 | M3 |
| SpeakingGrade | 讲考评分 | M3 |
| ExamGrade / Exam | 考试成绩 | M3 |
| LessonCompletion | 闻思完成事件 | M3f |
| AdvancementCheck | 升学资格预检 | M4 |
| AdvancementRecord | 升学记录 | M4 |

---

## 7. 业务能力全清单（51项）

### 核心能力（1–25）

| 能力 | 名称 | 实现状态 | 测试状态 |
|---|---|---|---|
| 1 | 阶段与专业体系 | 🔧 需改造 | ⚠️ 侧面覆盖 |
| 2 | 学员加入专业（邀请码） | ✅ 已实现 | ⚠️ 侧面覆盖 |
| 3 | 闻思学习与圆满判定 | 🔧 需改造 | ❌ 待验证 |
| 4 | 加行观修 | 🔧 需改造 | ❌ 待验证 |
| 5 | 管理员代行 | 🔧 需改造 | ⚠️ 部分覆盖 |
| 6 | 内加行实修 | 🔧 需改造 | ⚠️ 部分覆盖 |
| 7 | 日常实修打卡 | ✅ 已实现 | ❌ 未单独验证 |
| 8 | 共修与出勤 | 🆕 新建 | ✅ 接缝测试通过 |
| 9 | 学期报数 | 🔧 需改造 | ⚠️ 部分覆盖 |
| 10 | 考试与升学 | 🆕 新建 | ✅ R1/R2/R3 全覆盖 |
| 11 | 留级、退出、转专业 | 🔧 需改造 | ✅ R1/R3 全覆盖 |
| 12 | 特殊身份学员关怀 | 🔧 需改造 | ❌ 未单独验证 |
| 13 | 辅助员配对 | ✅ 已实现 | P3跳过 |
| 14 | 学员关怀清单 | 🔧 需改造 | ⚠️ 侧面覆盖 |
| 15 | 传承管理 | 🆕 新建 | ⚠️ 侧面覆盖 |
| 17 | 灌顶记录 | 🔧 需改造 | ⚠️ 侧面覆盖 |
| 18 | 角色与权限 | 🆕 新建 | ✅ 越权攻击测试A1-A16完成 |
| 19 | 班级邀请码 | ✅ 已实现 | ⚠️ 侧面覆盖 |
| 20 | 决策审计日志 | ✅ 已实现 | ⚠️ 侧面覆盖 |
| 21 | 自学模式 | ✅ 已实现 | P3跳过 |
| 22 | 班级动态 | ✅ 已实现 | P3跳过 |
| 23 | 班级讨论 | ✅ 已实现 | P3跳过 |
| 24 | 约修 | ✅ 已实现 | P3跳过 |
| 25 | AI助手问答 | ⏸ 暂缓（DR-109）| — |

### 净资产能力（26–51，部分已实现）

| 能力 | 名称 | 状态 |
|---|---|---|
| 26 | 积分排行 | ✅ 已实现 |
| 27 | 综合活动列表 | ✅ 已实现 |
| 28 | 法会管理 | ✅ 已实现 |
| 29 | 个人学修提醒 | ✅ 已实现（数据源需改造）|
| 30 | 成就解锁通知 | ⏸ 随能力38暂缓 |
| 31 | 辅导员AI出题 | ✅ 已实现 |
| 32 | 题库答题与判分 | ✅ 已实现 |
| 33 | SM-2间隔复习 | ✅ 已实现 |
| 34 | 错题本 | ✅ 已实现 |
| 35 | 收藏夹 | ✅ 已实现 |
| 36 | 笔记与高亮 | ✅ 已实现 |
| 37 | 法本阅读器 | ✅ 已实现（完成判定改手动）|
| 38 | 成就徽章 | ⏸ 暂缓（后台保留，不正式上线）|
| 39 | 音视频学习 + 分维度完成 | 🆕 内容已有/完成记录待新建 |
| 40 | 藏历日历 | ✅ 已实现 |
| 41 | 首页画报 | ✅ 已实现 |
| 42 | 用户档案 | ✅ 已实现 |
| 43 | 推送通知 | ✅ 已实现 |
| 44 | 上课提醒 | ✅ 已实现 |
| 45 | 短信通道 | 🆕 待新建 |
| 46 | 密法授权 | ✅ 已实现（TransmissionRecord改造）|
| 47 | 内容举报 | ✅ 已实现 |
| 48 | 学员档案（Dossier）| ✅ 已实现 |
| 49 | 数据分析 | ✅ 已实现（基础）|
| 50 | A/B实验 | ✅ 已实现 |
| 51 | 用户反馈 | ✅ 已实现 |

---

## 8. 老系统现状 vs 新设计目标

### 8.1 主要差距

| 项目 | 老系统（现在生产） | 新设计目标 |
|---|---|---|
| 角色体系 | `User.role` 枚举（admin/coach/student）| `UserRoleAssignment` 表（4角色+作用域）|
| 出勤记录 | 无结构化共修场次 | `ClassSession` + `StudyRecord` 完整体系 |
| 升学记录 | 无 | `AdvancementCheck` + `AdvancementRecord` |
| 闻思完成 | 无分维度完成记录 | `LessonCompletion`（audio/video/read 分维度）|
| 传承记录 | 无 | `TransmissionRecord` |
| 升学讲考 | 无 | `SpeakingSession` + `SpeakingGrade` |
| 升学考试 | 无 | `Exam` + `ExamGrade` |
| 完成判定 | 自动双阈值（已废弃） | 纯手动用户确认（DR-143）|

### 8.2 需要注意的迁移风险

1. **角色迁移**：旧 `User.role=coach` 需要映射到新 `UserRoleAssignment`，需要确认每个辅导员属于哪个班级
2. **出勤数据**：老系统若有出勤记录（不同表结构），迁移到 `StudyRecord` 需要字段映射
3. **`prisma migrate resolve`**：若使用旧版 `db push` 方式，首次切换到 migrate 需要先运行 `prisma migrate resolve --applied 0_init`

---

## 9. 设计文档体系（5层 SoT）

这是本项目设计的权威来源，产品经理需要熟悉这套文档。

### 9.1 五个核心文件

| 层级 | 文件路径 | 内容 |
|---|---|---|
| 战略层 | `docs/_handoff/decisions/05-decision-log.md` | 战略决策 D1-D20（不可删改原则、角色设计等）|
| 权限层 | `docs/_handoff/decisions/02-roles-and-permissions-v1.md` | 4角色 + 23职能完整定义 |
| 业务层 | `docs/_handoff/decisions/06-business-capabilities-WIP.md` | 51项业务能力详细设计（主要工作文档）|
| 数据层 | `docs/_handoff/decisions/08-merged-design.md` | 数据模型 + DR编号档 + 一致性检查（最长文件，~5500行）|
| API层 | `docs/_handoff/decisions/09-api-and-pages-design.md` | API契约 + 页面清单 |

### 9.2 DR 编号系统

每条设计决策用 DR-编号记录，格式：`DR-XXX 标题——内容`。

- DR-1 ~ DR-209 已封板（2026-06-08）
- 每次会话产出新 DR 时，在 `08-merged-design.md` §九 变更日志追加
- 每次追加后必须跑一致性检查（8个检查项，见 §九 检查轮次 1~109）

### 9.3 诊断报告（非权威，参考用）

| 文件 | 内容 |
|---|---|
| `reports/03-大纲符合性验收报告.md` | 设计与业务大纲的对齐状态 |
| `reports/04-设计完整性与app需求验收.md` | 设计完整性评估 |
| `reports/design/03-attack-capability18-rbac.md` | 能力18越权攻击测试报告（A1-A16）|
| `reports/design/03-attack-capability18-testplan.md` | 越权攻击可执行测试计划 |

### 9.4 使用规则（重要）

- **任何业务规则的回答都要引用具体的 DR 编号**，不凭印象
- **新业务决策前必须读 06-business-capabilities-WIP.md**，避免重复
- **文档与印象不一致时，永远以文档为准**
- **设计会话结束前必须跑8项一致性检查**（见 CLAUDE.md 详细清单）

---

## 10. 设计验证测试现状

### 10.1 测试优先级分层

```
P0（必做）：能力39 → 能力3 → 能力4 → 能力8 → 能力18
P1（应做）：能力5 → 能力9
P2（代码层）：9项，实现期逐个验证
P3（跳过）：9项，逻辑直白
```

### 10.2 各能力验证进度

| 能力 | 测试类型 | 状态 | 发现问题 | 修复状态 |
|---|---|---|---|---|
| 能力10（考试与升学）| 场景回归 R1/R2/R3 | ✅ 已完成 | R1/R2/R3各轮发现问题 | ✅ 全部修复（DR-155~184）|
| 能力11（留级/退出）| 场景回归 R1/R3 | ✅ 已完成 | 多处设计空白 | ✅ 全部修复 |
| 能力8（共修出勤）| 接缝回归测试 | ✅ 已完成 | S1/S2/S3 三处接缝空白 | ✅ 全部修复（DR-207/208/209）|
| 能力18（角色权限）| 越权攻击测试 A1-A16 | ✅ 报告完成 | 🔴8 / 🟡6 / ✅2 | ⚠️ 设计层风险已记录，实施层修复待评估 |
| 能力39（音视频）| P0-1 场景验证 | ⚠️ 进行中 | G1（留级后记录处置）/ G2（文档缺引用）| ❌ G1待决策 |
| 能力3（闻思判定）| P0-2 | ❌ 未开始 | — | — |
| 能力4（加行观修）| P0-3 | ❌ 未开始 | — | — |

### 10.3 能力18 越权攻击测试关键风险

安全测试发现以下 🔴 高风险（设计未明文约束）：

| 编号 | 风险 | 严重度 |
|---|---|---|
| A2 | 自豁免（自己豁免自己的升学条件）无明文禁止 | 🔴 |
| A3② | class_admin 自行申报升学免考 | 🔴 |
| A4/A5 | 超出作用域的 classId/programId 参数注入 | 🔴 |
| A16 | disqualified 学员若曾是辅导员，角色未被撤销 | 🔴 |

完整报告见 `docs/_handoff/reports/design/03-attack-capability18-rbac.md`。

---

## 11. 待决策事项

### 11.1 阻断性待决策（需在实施前确认）

| 编号 | 问题 | 影响 |
|---|---|---|
| G1 | 留级后 LessonCompletion 是否重算（保留 or 重置）| 能力39验证、DR-181补充 |
| A2/A3 | super_admin 自豁免/免考是否明文禁止 | 能力18安全边界 |
| A4/A5 | API层是否强制校验作用域（classId必须属于操作者管辖）| 能力18安全实施 |

### 11.2 暂缓决策（已标注，不阻断当前工作）

| 能力 | 暂缓原因 | DR |
|---|---|---|
| 能力25 AI助手 | 产品暂不上线 | DR-109 |
| 能力38 成就徽章 | 暂不作正式功能 | DR-128 |
| DR-84 忏悔机制 | 「学员拒绝忏悔时如何处理」待讨论 | DR-84 |

---

## 12. 已知风险与技术债

### 12.1 架构风险

| 风险 | 说明 | 缓解措施 |
|---|---|---|
| 角色迁移复杂度 | 老系统 `User.role` 迁移到新 `UserRoleAssignment`，需要数据迁移脚本 | 分阶段迁移，新老共存一段时间 |
| 旧 `prisma db push` 历史 | 只有2条正式 migration，大量历史变更通过 db push 做 | 首次切换需 `migrate resolve --applied 0_init` |
| YouTube 内容访问 | 部分用户在中国大陆无法访问 YouTube 嵌入视频 | asia-relay 中转节点（已建）|

### 12.2 技术债

| 项目 | 说明 | 优先级 |
|---|---|---|
| TODO-23 | 积分排行数据源从废弃 PracticeDailySummary 迁到实时聚合 | 中 |
| TODO-24 | 完成记录统一到 LessonCompletion（法本阅读/音视频完成机制统一）| 高 |
| TODO-G1.5 | S5 节点（升学检查点）业务含义待确认 | 低 |
| 旧出勤数据 | 老系统若有出勤数据，迁移到新 StudyRecord 格式 | 待评估 |

### 12.3 安全边界

参见能力18越权测试报告（A1-A16），实施期间需要在以下位置加强校验：
- 所有班级管理端点必须校验 `classId` 属于操作者作用域
- `operatorId ≠ targetUserId`（防自操作）
- disqualified 学员取消资格时同步撤销角色

---

## 13. 实施路线图（Phase 1–5）

| Phase | 内容 | 依赖 | 估计工作量 |
|---|---|---|---|
| P1 | 角色体系迁移（UserRoleAssignment + 迁移脚本）| 无 | 大 |
| P2 | 传承记录 + 关怀跟进记录 | P1 | 中 |
| P3 | 共修出勤体系（ClassSession + StudyRecord）| P1 | 大 |
| P4 | 升学体系（AdvancementCheck + LessonCompletion + 讲考/考试）| P1/P3 | 最大 |
| P5 | 传承管理 + 密法授权改造 | P2/P4 | 中 |

**优先级逻辑**：P1 角色体系是底层，几乎所有新能力都依赖它。P4 升学体系是最复杂的，包含六条件预检全部逻辑。

---

## 14. 基础设施与部署

### 14.1 生产服务器

| 服务器 | 用途 | 地址/标识 |
|---|---|---|
| 主服务器 | 后端 Fastify + PostgreSQL（Docker）+ nginx | `instance-20260213-1230` |
| OSS服务器 | 媒体文件静态服务（视频/图片）| `129.213.64.152` |

### 14.2 关键路径

| 用途 | 值 |
|---|---|
| 项目根目录 | `/home/ubuntu/projects/juexue` |
| 后端 PM2 进程 | `juexue-api`（`pm2 reload juexue-api` 零停机重启）|
| 前端静态文件 | `/var/www/juexue/app/` |
| 数据库 | PostgreSQL 容器 `juexue-postgres`，端口 5433 |
| 域名（前端）| `juexue.caughtalert.com/app/` |
| 域名（OSS）| `media.juexue.caughtalert.com` |

### 14.3 部署流程

```bash
# 后端更新
cd /home/ubuntu/projects/juexue/backend
git pull origin main
npx prisma generate
npx prisma migrate deploy    # 执行新增 migration
npm run build
pm2 reload juexue-api        # 零停机重启

# 前端更新
cd ../juexue-v2
git pull origin main
rm -rf dist/
npm run build
sudo rsync -av --delete dist/ /var/www/juexue/app/
```

### 14.4 数据库连接

PostgreSQL 运行在 Docker 容器中，没有系统级 `postgres` 用户。

```bash
# 连接数据库
sudo docker exec juexue-postgres psql -U juexue -d juexue

# 备份
./backend/db-backup.sh

# 查看数据目录
sudo docker volume inspect juexue_pg
```

---

## 15. 接手清单

### 15.1 必读文件（按顺序）

1. `CLAUDE.md` —— 工作守则和关键规则
2. `TECH_STACK.md` —— 完整技术栈
3. `docs/_handoff/decisions/05-decision-log.md` —— 战略决策（D1-D20）
4. `docs/_handoff/decisions/02-roles-and-permissions-v1.md` —— 4角色23职能
5. `docs/_handoff/decisions/06-business-capabilities-WIP.md` —— 51项业务能力（最重要）
6. `docs/_handoff/reports/design/03-attack-capability18-rbac.md` —— 权限安全风险报告

### 15.2 需要了解的核心概念

| 概念 | 说明 |
|---|---|
| `cohortStatus` | 学员在班状态（active/paused/graduated/held_back/advanced/disqualified/withdrawn）|
| `UserPracticeVow` | 修持任务/发愿（起修日、日标等），留级后新建 |
| `LessonCompletion` | 闻思完成事件（一行=一遍），按 type 分 audio/video/read |
| `AdvancementCheck` | 升学六条件自动预检报告 |
| `ProxyAction` | 管理员代行操作记录（可逆，双保留）|
| `invalidatedAt` | 软删除标记（StudyRecord 因场次取消而失效）|
| `programId` | 专业ID，多专业隔离的核心字段 |
| DR编号 | 设计决策记录，格式 DR-XXX，当前最新 DR-209 |

### 15.3 当前工作状态（2026-06-08）

正在进行的工作：
- **P0-1 能力39 验证**：G1（留级后LessonCompletion处置）待决策，G2（文档补引用）待写入
- 完成 G1 决策后 → 继续 P0-2 能力3 → P0-3 能力4

已完成的工作：
- 能力10/11 全场景验证 ✅
- 能力8 接缝测试（S1/S2/S3）全部修复 ✅
- 能力18 越权攻击测试报告 ✅
- 全部设计文档 DR-1~209 封板 ✅

### 15.4 立即需要回答的问题

接手后请尽快决策：

1. **G1**：留级后学员的闻思完成记录是否保留？（建议：保留，留级=出勤/修量不足，已读法本不重读）
2. **A2/A3**：是否明文禁止管理员自豁免自己的升学条件？（建议：是，加 `operatorId ≠ targetUserId` 约束）
3. **A16**：学员被取消资格（disqualified）时，是否同步撤销其班级角色？（建议：是）

---

*本报告由 Claude（AI）生成，基于截至 2026-06-08 的项目状态。*  
*权威设计来源：`docs/_handoff/decisions/` 下的 5 个 SoT 文件。*  
*如有疑问，以设计文档为准，不以本报告为准。*
