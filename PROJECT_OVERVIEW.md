# 觉学（Juexue）项目对接文档

> 版本：2026-05-27  
> 用途：新技术人员 / 产品经理快速入项目、了解当前状态、安全增减需求

---

## 目录

1. [项目是什么](#一项目是什么)
2. [技术栈与部署](#二技术栈与部署)
3. [三端分离架构（铁律）](#三三端分离架构铁律)
4. [当前实现状态](#四当前实现状态)
5. [数据模型全图](#五数据模型全图)
6. [功能模块与分阶段计划](#六功能模块与分阶段计划)
7. [关键设计决策（已拍板，不可随意改）](#七关键设计决策已拍板不可随意改)
8. [明确不做清单（增需求前必读）](#八明确不做清单增需求前必读)
9. [时区规则（六层）](#九时区规则六层)
10. [权限模型](#十权限模型)
11. [如何阅读设计文档](#十一如何阅读设计文档)

---

## 一、项目是什么

**觉学**是一个藏传佛教在线学习平台，服务对象是修学班的学员与辅导员。

### 核心业务流程

```
admin 建科系/排表/法本
  ↓
admin 建班级，绑科系
  ↓
辅导员（主麦）邀请学员入班 → 入班自动派发修持任务愿
  ↓
学员：
  · 闻思学习（阅读法本课文、看观修视频、做思考题）
  · 修持打卡（念诵遍数 / 禅修时长座次）
  · 参加法会（发愿 + 回向）
  · 参加共修 / 讲考（签到 + 评分）
  ↓
辅导员：查看成员数据 / 掉队名单 / 关怀跟进 / 生成周汇总
```

### 三类用户

| 角色 | 入口 | 核心权限 |
|---|---|---|
| **学员** | `/`（学员端）| 自己的学习、打卡、法会参与 |
| **辅导员（主麦/师兄）** | `/coach/*` | 管理自己负责的班级；Admin 后台分配细粒度 flags |
| **平台 Admin** | `/admin/*` | 管理全平台：科系/法本/班级/法会/密法授权 |

---

## 二、技术栈与部署

### 开发环境

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + TypeScript · React Query · React Router · CSS 变量设计系统 |
| 后端 | Fastify + Prisma ORM + PostgreSQL（port 5433）· Zod 请求校验 · JWT 认证 |
| OSS | 独立服务器（129.213.64.152）· nginx 静态服务 · scp 投递视频 |

### 生产环境

| 项目 | 值 |
|---|---|
| 主服务器 | `instance-20260213-1230` |
| 域名 | `juexue.caughtalert.com`（前端 `/app/`）· `media.juexue.caughtalert.com`（OSS）|
| 后端进程 | PM2：`juexue-api` |
| 前端静态目录 | `/var/www/juexue/app/` |
| 项目根目录 | `/home/ubuntu/projects/juexue` |
| 数据库 | PostgreSQL · localhost:5433 · db 名 `juexue` |

### 代码仓库结构

```
bicwny/
├── juexue-v2/          前端（React + Vite）
│   └── src/
│       ├── pages/      所有页面组件
│       ├── components/ 共用组件
│       └── lib/        api客户端、i18n、hooks
├── backend/            后端（Fastify + Prisma）
│   ├── src/modules/    按功能模块分目录
│   └── prisma/         schema + migrations
└── docs/               设计文档
    ├── BL_REVIEW.md          业务逻辑核对文档（76条，已全量覆盖）
    ├── SCENARIO_SIMULATION.md  场景走查（S-001～S-060）
    └── CSS-GOTCHAS.md        前端踩坑记录（必读）
```

---

## 三、三端分离架构（铁律）

**这是不可违反的设计原则，新增任何功能前必须确认所属端。**

| 端 | 路由 | 原则 |
|---|---|---|
| 学员端 | `/`、`/class`、`/practice`、`/me` 等 | 纯消费视图，即便 admin 登入也不出现管理按钮 |
| 辅导员端 | `/coach/*` | 管理自己的班，学员被路由守卫挡掉 |
| Admin 端 | `/admin/*` | 管理全平台，只有 admin role 可进 |

**历史事故**：曾在学员端 ClassDetailPage 加「+ 去发布」等管理按钮给 admin 看到，后全部清除。  
新增任何 section 前先问：**这个功能该出现在哪一端？**

---

## 四、当前实现状态

### ✅ 已在生产中运行的功能

| 模块 | 说明 |
|---|---|
| 注册 / 登录 / 找回密码 | 邮箱注册 · JWT · 256位 token 重置（30分钟有效）|
| 班级管理 | 邀请码入班 · ClassMember · ClassAnnouncement |
| 法本学习 | Course → Chapter → Lesson · 阅读进度 · 笔记 · 高亮 |
| 观修视频 | Meditation · MeditationSession · 92修法 |
| 答题系统 | 14 种题型 · AI 评分 · 错题本 · SM-2 复习 |
| 修持打卡（旧系统）| PracticeEntry（待迁移至 PracticeLog）|
| 法会（旧系统）| DharmaAssembly（待迁移至 Event）|
| 藏历日历 | TibetanDay · 节日/吉日展示 |
| 通知系统 | Notification · Push 推送 |
| 成就系统 | UserAchievementUnlock |
| AI 助手（基础）| LLM 提供商配置 · 多 Scenario · PromptTemplate |
| 管理后台（基础）| 法本/课时/题目/用户/班级/法会/日历管理 |

### 🔨 已设计、待实现的新功能（本次大改版）

见第六章分阶段计划。共新增：
- 新增表 47 张（包含修持愿系统、组织层级、集体功能等）
- 新增后端模块 26 个
- 新增前端页面 25 个（学员端 11 + 辅导员端 4 + Admin 端 10）

---

## 五、数据模型全图

### 现有表（保留不动）

| 分组 | 表 |
|---|---|
| 认证安全 | User · AuthSession · PasswordResetToken · EmailVerificationToken · DeletedEmail |
| 班级 | Class · ClassMember · ClassAnnouncement · HomePoster |
| 学习内容 | Course · Chapter · Lesson · LessonResource · LessonReadingProgress |
| 观修 | Meditation · MeditationSession |
| 答题 | Question · UserAnswer · Sm2Card · UserFavorite · UserMistakeBook · QuestionReport |
| 打卡（旧，待删） | PracticeEntry · PracticeGoal · PracticeTask · PracticeDailySummary · PracticeMakeup |
| 修持项目 | PracticeCategory · PracticeProject |
| 法会（旧，待迁移） | DharmaAssembly |
| 藏历 | TibetanDay |
| 笔记 | Note · Highlight · NoteReport |
| 通知 | Notification · NotificationPreference · PushSubscription · NotificationDispatchLog · NotificationRule |
| 成就 | UserAchievementUnlock · SystemAnnouncement |
| AI | LlmProviderConfig · LlmProviderUsage · LlmScenarioConfig · LlmPromptTemplate · LlmCallLog |
| 运营 | AuditLog · ErrorLog · SystemSetting · Experiment · AnalyticsEvent · Feedback · OrphanedFile |

### 字段扩展（现有表新增字段，不删旧字段）

| 表 | 新增字段 | 用途 |
|---|---|---|
| **User** | studentId / nickname / timezone / learningMode / preferShowFaxin / realName / phone / city / refugeStatus 等 +13 字段 | 学号 · 时区 · 三殊胜开关 · 真实信息收集 |
| **Class** | programId / startDate / timezone / city / currentWeekOverride / lagPracticeDaysExpected | 科系关联 · 排表基准 · 掉队检测配置 |
| **ClassMember** | cohortStatus / isPrimary / heldBackCount 等 +7 字段 | 五态成员状态机 · 留级计数 · 主班标记 |
| **Course** | isTantric / programSemesterId / category / tantricGroupId / author | 密法 · 科系归属 · 自学读物分类 |
| **ClassSession** | lessonId / sessionEndAt / checkInToken / classId改可空 | 共修签到 · 平台级共修支持 |
| **Meditation** | seriesKey / seriesNumber / isTantric / tantricGroupId | 92修法系列 · 密法标识 |
| **PracticeProject** | isTantric / tantricGroupId / categoryId | 密法修持 · 科目排行筛选 |

### 新增表（47 张，按功能分组）

| 分组 | 表 | 说明 |
|---|---|---|
| 组织层级 | Program · ProgramSemester · ProgramWeek · ProgramWeekCourse · ProgramWeekPractice · ProgramStudyType | 科系 → 科目 → 周排表 |
| RBAC | ClassAdmin | 辅导员细粒度权限（替代旧的 role=zhumai/aixin 枚举）|
| 修持愿系统 | UserPracticeVow · PracticeTemplate · PracticeTemplateBinding · PracticeLog · LessonCompletion | 新修持系统核心 |
| 法会（新） | Event · EventCount · UserPracticeVow（context=event）| DharmaAssembly 迁移至 Event |
| 约修 | Appointment · AppointmentParticipant | 小组约修 |
| 讲考 | SpeakingSession（字段扩展）· SpeakingRegistration · SpeakingGrade | 讲考报名/签到/评分 |
| 考试 | Exam · ExamGrade | 书面考试成绩 |
| 掉队 | CohortLagSnapshot · CohortWeeklySummary · CohortRestWeek | 掉队检测快照 · 周汇总 |
| 自学 | UserSelfStudyProgram · UserSelfStudyRestWeek | 自学科系报名 |
| 密法 | TantricGroup · TantricAccessGrant | 密法组 · 按组授权 |
| 日记 | PracticeJournal | 修持日记（嵌藏历日历）|
| 关怀 | CareFollowup | 辅导员关怀跟进记录 |
| 班级动态 | ClassPost · ClassPostLike · ClassPostComment · ClassPostMedia | 感想动态（⏸ 暂缓）|
| 讨论 | ClassDiscussion · ClassDiscussionOption · ClassDiscussionVote · ClassDiscussionComment | 班级讨论/投票（⏸ 暂缓）|
| AI（新） | AiConversation · AiMessage · AiFeatureEntry · AiIntentLog · AiKnowledgeChunk | AI 助手升级（⏸ 暂缓）|
| SQL 视图 | v_event_dedication_totals · v_weekly_dedication_totals · v_practice_daily | 聚合视图（替代旧快照表）|

---

## 六、功能模块与分阶段计划

**当前状态：所有 migration 均未跑。新功能全部待实现。**

### Phase 1 · 基础架构（先做）

| 任务 | 说明 |
|---|---|
| 跑 12 个结构 migration | 建新表 · 删旧表 · 字段扩展 |
| 录入科系种子数据 | Program（加行/净土/入行论等）|
| ClassAdmin 数据迁移 | coach role → RBAC flags 全开 |
| 密法零痕迹中间件 | 未授权学员查询全过滤 |
| 班级字段支持 | timezone / programId / startDate（admin 建班）|
| ClassAdmin 权限分配 UI | Admin 后台 |
| 注册流程简化 | 移除姓名输入；后端自动生成 nickname + studentId |
| 入班 Onboarding | 邀请码成功后「完善个人信息」步骤 |

### Phase 2 · 闻思打卡系统

| 任务 | 说明 |
|---|---|
| 讲考全流程 | 场次管理 · 报名 · 签到 · 评分 · 历史统计 |
| 考试成绩 | Exam · ExamGrade CRUD + 学员查看 |
| 共修签到 | App 内签到 + 签到链接（无需登录）|
| 5 Tab 导航改造 | TabBar 3→5 Tab：首页/班级/修持/闻思/我的 |
| 首页今日修学卡 | 闻思进度 + 修持遍数 + 日常签到按钮 |
| 课时轻量完成标记 | LessonCompletion（听/读/观修）|

### Phase 3 · 修持愿系统

| 任务 | 说明 |
|---|---|
| PracticeTemplate API | admin 建模板 · 入班自动派发愿 |
| UserPracticeVow + PracticeLog API | 新修持系统核心 |
| KPI / streak 实时聚合 | 按 User.timezone；旧 PracticeDailySummary 停更 |
| 物化视图 + 刷新 cron | v_practice_daily 每 15 分钟刷新（排行榜用）|
| 成员状态机 | 五态（active/paused/held_back/graduated/left）+ 级联 |
| /practice 页面改造 | 班级愿区 + 我的修学区 + 打卡 Sheet + 发心语/回向 |
| 辅导员端基础框架 | CoachLayout + 权限守卫 + 落地页 |
| 成员管理页 | 代操作暂停/留级/毕业/退班 |

### Phase 4 · 双模式学习

| 任务 | 说明 |
|---|---|
| 课程进度算法 | 周号 = startDate 起 - 休息周；支持手动覆盖 |
| 本周基准内容 | 排表驱动「本周第 N 课」在课程页顶部展示 |
| 自学模式 | UserSelfStudyProgram · 个人起修日 · 个人休息周 |
| 班级进度基准线 UI | 课程页/阅读页顶部进度提示 |
| 闻思页自学读物分组 | category=self_study_book（18本大学演讲系列）|

### Phase 5 · 集体功能与管理工具

| 任务 | 说明 |
|---|---|
| 法会活动全流程 | Event API · 学员发愿 · 回向 · 发愿人数展示 |
| 活动中心页 `/events` | 3 Tab：法会/共修/讲考 |
| 每周回向页 `/class/:id/dedication` | 班级集体回向 |
| 藏历日历 + 修持日记 | PracticeJournal 嵌入 /calendar |
| 掉队检测系统 | CohortLagSnapshot · 五维度 · 每日 cron |
| 辅导员管理工具 | 掉队名单 · 关怀跟进 · 学员修行数据 · 修持愿管理 · 周汇总 |
| 约修系统 | Appointment · 创建/加入/关闭 |
| 密法组管理 | TantricGroup · 授权 Admin 后台 |
| 班级动态 ClassPost | ⏸ 暂缓（后续 Phase）|
| 讨论/投票 | ⏸ 暂缓（后续 Phase）|
| AI 助手升级 | ⏸ 暂缓（后续 Phase）|

### Phase 6 · 内容与排表

| 任务 | 说明 |
|---|---|
| 排表模板 CRUD | Program → ProgramSemester → ProgramWeek → 周内容 |
| 排表编辑器 UI | Admin：左树（科系/科目/周）+ 右区编辑 |
| 参考答案系统 | QuestionReference · 提交后解锁查看 |
| 思考题 UI 改造 | open 题：写思考 → 提交 → 显示参考答案 |

---

## 七、关键设计决策（已拍板，不可随意改）

以下决策已完成多轮讨论确认，改动前需与产品负责人对齐。

### 修持系统

| 决策 | 结论 |
|---|---|
| 旧修持表处理 | **全部删除**（PracticeEntry / PracticeGoal / PracticeTask / PracticeDailySummary / PracticeMakeup）；项目开发阶段无生产数据，直接合并替换 |
| 修持日记载体 | 唯一载体：PracticeJournal（嵌藏历日历），不单设 /journals 页，打卡反思字段已移除 |
| 发愿 vs 裸追踪 | `isPledged=true`：发愿（有进度条）；`isPledged=false`：裸追踪（仅累计数）；两者均走 UserPracticeVow 单表 |
| 历史裸打卡 | 不支持追溯关联愿，发愿从新建愿起算 |

### 法会系统（重要：需求变更 2026-05-27）

| 决策 | 结论 |
|---|---|
| 法会个人记数 | ❌ **已废弃**：线下数量由师兄自行汇报，App 不提供记数入口 |
| 法会区块 2 | 展示「发愿人数 N 人」（不再是集体实时总量）|
| 回向触发条件 | 有法会愿即可点回向（不依赖提交记录）|
| EventCount 表 | 保留表结构（历史数据），但不再写入 |
| 法会愿状态 | 纯时间边界判断：进行中→on_track，已结束→completed |

### 权限系统

| 决策 | 结论 |
|---|---|
| 辅导员权限 | RBAC flags 模型（ClassAdmin 表），不用旧的 role 枚举；Admin 后台逐模块分配 |
| 密法可见性 | 未授权学员零痕迹（列表/搜索/关联全过滤），管理端始终可见 |
| 密法打卡 | 计入集体回向 · 参与打卡报数生成（决策已确认）|
| 数据库层隔离（RLS）| ⏸ 暂缓：当前全靠应用层中间件（详见 DESIGN_DECISIONS.md SEC-001）|

### 三殊胜精神框架

| 决策 | 结论 |
|---|---|
| 框架开关 | `User.preferShowFaxin`（个人设置页），默认开 |
| 控制范围 | 修持打卡前发心语 + 内容完成后回向 Sheet |
| 无新增表 | 回向为纯前端 UI，不写 DB |

---

## 八、明确不做清单（增需求前必读）

以下功能经过讨论已明确不做，若有新需求与之相关，需重新评估后再变更：

| 不做的功能 | 原因 |
|---|---|
| Academy 表 | Program 上预留 academyId 字段，将来如需再建 |
| 裸打卡追溯补发愿 | 发愿从新建起算，历史数据不回溯关联 |
| 修持日记独立页 | 嵌入藏历日历，不单设路由 |
| 班级间下一届关联（FK）| 转班用 heldBackTransfer 事务，不预建关系 |
| 主麦分配下级权限 | RBAC 分配仅 admin 操作 |
| 留级自动建目标班成员 | 必须指定目标班，不自动 |
| 约修审批流 / 推送通知 | 用户自行浏览发现 |
| 约修个人指标 | 只有总目标，参与者无强制指标 |
| 约修跨班 | classId 必填 |
| 打卡报数存 DB | 纯前端生成文字 |
| 批量补录次数限制 | 无审核态，随时可点 |
| 后端藏历-公历自动换算 | admin 手动确认公历日期 |
| 升科目自动触发 | 主麦手动操作 |
| 法会宽松补录模式 | 法会结束后页面只读，禁止补提 |
| 法会个人记数入口 | ❌ **2026-05-27 废弃**（见七）|

---

## 九、时区规则（六层）

系统涉及六处时区判断，每处规则不同，新功能涉及时间时必须对照：

| 场景 | 时区基准 | 说明 |
|---|---|---|
| 共修/讲考场次展示 | `Class.timezone` | 班级时区，辅导员建班时设置 |
| 修持打卡（logDate 划天）| `User.timezone` | 跨时区学员按本地时间划天 |
| 本周进度基准线 | `Class.timezone` | 班级统一节奏 |
| streak / KPI 计算 | `User.timezone` | 个人连签按本地时间 |
| 法会边界判断 | `Event.timezone` | 通常 Asia/Shanghai，法会统一边界 |
| 藏历日历「今天」| `User.timezone` | 学员看到的日历日按本地时间 |

**注意**：logDate 存储为 UTC timestamp（`now()`），显示层按 User.timezone 转换；不传本地日期字符串。

---

## 十、权限模型

### ClassAdmin RBAC Flags

辅导员权限由 Admin 后台逐模块分配，不再用 role 枚举：

| Flag | 能力 |
|---|---|
| `canManageMembers` | 暂停/恢复/留级/毕业/退班成员 |
| `canManageExams` | 讲考/考试场次管理 |
| `canViewStudents` | 查看学员修行数据（愿/打卡/日记）|
| `canCareFollowup` | 关怀跟进记录 |
| `canEditGoals` | 编辑学员每日目标量 |
| `canManageCourse` | 课程进度/法本切换/当前周覆盖 |
| `canEdit` | 通用编辑（默认 true）|
| `canDelete` | 通用删除（默认 false）|

### 密法可见性矩阵

| 角色 | 密法课程/视频 | 密法愿 | 密法打卡 |
|---|---|---|---|
| 未授权学员 | ❌ 零痕迹（列表不出现）| ❌ | ❌ |
| 已授权学员 | ✅ | ✅ 自己的 | ✅ 自己的 |
| 辅导员（任意 flag）| ✅ 全班可见 | ✅ 全班 | ✅ 全班 |
| Admin | ✅ 全平台 | ✅ 全平台 | ✅ 全平台 |

---

## 十一、如何阅读设计文档

所有设计文档在 `/home/user/bicwny/`（仓库根目录）和 `/docs/` 下：

| 文档 | 用途 | 适合谁读 |
|---|---|---|
| `FINAL_DESIGN_SANSUSHENG.md` | **主设计文档**：数据库 schema · API 范围 · 分阶段计划 · 不做清单 | 技术负责人 · 后端开发 |
| `DESIGN_DECISIONS.md` | **决策日志**：每个非显然设计选择的背景 · 排除方案 · 最终决定 | PM · 技术负责人 |
| `docs/BL_REVIEW.md` | **业务逻辑核对**：76 条页面/算法/约束逐条白话描述，供 PM 核对 | PM · 全团队 |
| `docs/SCENARIO_SIMULATION.md` | **场景走查**：S-001～S-060，具体用户操作流的完整路径 | PM · 前端开发 |
| `docs/CSS-GOTCHAS.md` | **前端踩坑**：position:fixed / Dialog / 图片/上传/invalidate 的已知问题 | 前端开发 |
| `CLAUDE.md` | **开发规范**：提交前自检 · 部署流程 · 触雷规则 | 技术开发 |

### 功能标签含义

文档中每个功能旁带标签说明状态：

| 标签 | 含义 |
|---|---|
| `✅ 已实现` 或 `✅ 已核对` | 已在生产或已完成设计确认 |
| `⏸ 暂缓（Phase N）` | 计划做，Phase N 再实施 |
| `❌ 不做` 或 `❌ 已废弃` | 永久不做，或需求变更后废弃 |
| `⚠️ 待决策` | 需要产品负责人拍板才能推进 |

### 增加或修改需求时

1. 先读 `docs/BL_REVIEW.md` 对应章节，确认当前设计是什么
2. 读 `DESIGN_DECISIONS.md` 确认有无相关已拍板决策
3. 读第八章「明确不做清单」确认新需求未与已明确方向冲突
4. 若需改动数据库，读 `FINAL_DESIGN_SANSUSHENG.md` §二、§六
5. 在 `DESIGN_DECISIONS.md` 补记新决策（背景 · 排除方案 · 最终决定）
6. 在 `docs/BL_REVIEW.md` 更新受影响的 UI-XX / BL-XX 条目

---

*文档由 Claude Code 辅助生成，基于 2026-05-27 当前设计状态。*
