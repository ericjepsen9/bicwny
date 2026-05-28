# 新旧设计融合计划

> 状态:进行中
> 制定日期:2026-05-28
> 目标:将旧设计的实现细节与新设计的业务逻辑整合为可执行的融合设计文档

---

## 一、核心判断

旧设计（FINAL_DESIGN_SANSUSHENG.md）的**技术实现层**价值高：47 张表的字段设计、API 模块划分、Migration 策略。
新设计（决策档案三件套）的**业务逻辑层**是正确的：角色/权限/升学条件/传承管理。

两者不互相推翻，而是不同层面各有所长。整合目标：**用新设计的业务逻辑，套进旧设计的实现框架**。

---

## 二、融合方法：以旧设计的表为单位打标签

对旧设计的 47 张新增表 + 8 张扩展表，逐一标注：

| 标签 | 含义 |
|---|---|
| ✅ 复用 | 字段/语义与新设计一致，可直接用 |
| 🔧 扩展 | 表保留，但需加字段或改字段语义 |
| 🔄 替换 | 设计思路冲突，需用新逻辑重写 |
| ❌ 废弃 | 旧设计有但新设计明确不做 |
| ➕ 新建 | 新设计需要但旧设计完全没有 |

---

## 三、执行步骤

### 步骤 1：读旧设计，产出表标签清单（进行中）
- 读 `FINAL_DESIGN_SANSUSHENG.md` 全部表结构
- 对照新设计 20 条业务能力，逐表打标签
- 产出：表标签清单初稿（供用户核对）

### 步骤 2：新能力输出表与旧表对照
- 每条新能力定义的输出表（如 transmission_records / advancement_records）
- 逐一确认旧设计里有无对应、字段是否够用
- 产出：缺口清单（需新建的表）

### 步骤 3：产出融合设计文档
- 以旧设计实现细节为底稿
- 逐节替换/扩展业务逻辑部分
- 最终产出：字段级完整表结构 + API 模块清单 + Migration 策略

---

## 四、表标签清单初稿（待逐表核对）

> 状态：初稿，待用户逐表确认
> 来源：通读 FINAL_DESIGN_SANSUSHENG.md 全部表结构，对照新设计 20 条业务能力

### 🔄 替换（设计思路冲突，需用新逻辑重写）

| 表 | 冲突原因 | 对应新能力 |
|---|---|---|
| `ClassAdmin`（RBAC flags）| 旧设计用 7 个 boolean flag 组合权限，新设计是 4 级角色 + 作用域继承体系，模型根本不同。迁移：主麦（全 flag）→ class_admin；爱心（canViewStudents+canCareFollowup）→ **角色取消，不迁移**，统一用新设计 4 角色体系 | 能力 18 |
| `CareFollowup` | 旧设计只有一类关怀记录；新设计合并为 `care_followup_records`（source_type 区分特殊身份跟进 vs 关怀清单备注）| 能力 12/14 |
| `TantricAccessGrant` | 旧设计用"密法组白名单"控制内容访问；新设计有 `transmission_records`（type=empowerment）传承体系，需整合 | 能力 15/17 |

### 🔧 扩展（表保留，需加字段或改字段语义）

| 表 | 扩展内容 | 对应新能力 |
|---|---|---|
| `Program`（科系）| 需加 `stage` 字段（preke / zhengke），绑定到固定两级阶段（D2）；旧的 `academyId` 预留字段可保留 | 能力 1 |
| `ClassMember` | `CohortMemberStatus` 状态枚举基本对应，但需确认"退出→记录保留可查"（D15）的历史可见性实现 | 能力 2/11 |
| `StudyRecord`（闻思打卡）| 对应能力 8 共修出勤，但 `studyType` 枚举混合了讲考/共修/签到，需拆分或扩展对齐 | 能力 8 |
| `SpeakingGrade` / `ExamGrade` | 旧成绩是 pass/fail/excellent；新设计要求百分制（0-100），需统一 | 能力 10 |
| `CohortLagSnapshot` | 掉队检测对应能力 14 关怀清单自动触发机制，维度基本吻合，但触发阈值需改为"专业配置项"（D3）而非写死 | 能力 14 |
| `ClassSession`（共修场次）| checkInToken 机制已设计，`classId` 可空（平台级）语义在新设计里需确认范围 | 能力 8 |
| `UserPracticeVow`（修持愿）| 核心打卡管理表，大部分逻辑与能力 4/6/7 对应，但"愿"和"报数快照"的关系需明确 | 能力 4/6/7/9 |
| `ProgramSemester`（科目）| 旧设计"科目/年级"语义，对应新设计"专业 × 届"里的学期分层，字段基本可用 | 能力 1 |

### ✅ 复用（字段/语义与新设计一致，几乎不动）

| 表 | 对应新能力 |
|---|---|
| `PracticeLog`（打卡记录）| 能力 4/6/7 |
| `PracticeTemplate`（修持模板）| 能力 4/6/7 |
| `CohortRecommendedTemplate`（班级模板绑定）| 能力 1/2 |
| `LessonCompletion`（内容完成标记）| 能力 3 |
| `PracticeJournal`（修持日记）| 能力 7 |
| `QuestionReference`（思考题参考答案）| 能力 3 |
| `LessonResource`（课时媒体资源）✅ 已实现 | 能力 3 |
| `LessonMediaChapter`（媒体章节）✅ 已实现 | 能力 3 |
| `LessonTextBlock`（段落文字块）✅ 已实现 | 能力 3 |
| `ProgramWeek`（周模板）| 能力 1 |
| `ProgramWeekCourse`（周课程映射）| 能力 1 |
| `ProgramWeekPractice`（周修法建议）| 能力 1/4 |
| `ProgramStudyType`（科系打卡要求）| 能力 8 |
| `CohortRestWeek`（班级休息周）| 能力 8 |
| `Event`（法会活动）| 能力 15 |
| `EventCount`（法会计数）| 能力 15 |
| `CohortWeeklySummary`（班级周汇总）| 管理端 ⏸ 暂缓 |
| `TantricGroup`（密法组）| 能力 15/17 |
| `ContentChunk`（法本切片 RAG）| AI 助手 |
| `FeatureEntry`（功能 catalog）| AI 助手 |
| `AiConversation` / `AiMessage` / `AiUsage` | AI 助手 |
| `SpeakingSession`（讲考场次）| 能力 10 |
| `SpeakingRegistration`（讲考报名）| 能力 10 |
| `Exam`（考试）| 能力 10 |

### ⏸ 暂缓（旧设计有但新设计未覆盖，维持原状不动）

| 表 | 说明 |
|---|---|
| `ClassPost` / `ClassPostReaction` / `ClassPostComment` / `ClassPostShare` | 班级动态社区功能，新设计 20 条能力未覆盖 |
| `Discussion` / `DiscussionViewpoint` / `DiscussionVote` / `DiscussionComment` | 班级讨论功能，新设计未覆盖 |
| `PracticeAppointment`（约修）| 旧设计已标 ⏸ Phase 5，新设计未覆盖 |
| `UserSelfStudyProgram` + `UserSelfStudyRestWeek` | 自学模式，新设计能力 8 提及但未深度设计 |

### ➕ 新建（新设计需要，旧设计完全没有）

| 表 | 对应新能力 |
|---|---|
| `UserRoleAssignment`（角色分配，替代 ClassAdmin）| 能力 18 |
| `RoleAssignmentHistory`（角色变更留痕）| 能力 18 |
| `TransmissionRecord`（传承记录，type=empowerment 含灌顶）| 能力 15/17 |
| `StudentSpecialStatus`（特殊身份：盲/聋）| 能力 12 |
| `CareWatchlistItem`（关怀清单条目）| 能力 14 |
| `ClassInviteCode`（邀请码，扩展老 joinCode）| 能力 19 |
| `AssistantAssignment`（辅助员配对）| 能力 13 |
| `SemesterSnapshot`（报数快照）| 能力 9 |
| `ReportConfession`（虚报忏悔记录）| 能力 9 |
| `AdvancementCheck`（升学资格预检报告）| 能力 10 |
| `AdvancementRecord`（升学记录）| 能力 10 |
| `AuditLog`（审计日志）| 能力 20 |

---

## 五、核对顺序（逐表确认）

核对顺序按影响面从大到小：

1. 🔄 替换区（3 张）：ClassAdmin → UserRoleAssignment、CareFollowup → care_followup_records、TantricAccessGrant → TransmissionRecord 整合
2. 🔧 扩展区（8 张）：Program、ClassMember、StudyRecord、SpeakingGrade/ExamGrade、CohortLagSnapshot、ClassSession、UserPracticeVow、ProgramSemester
3. ➕ 新建区（12 张）：逐表确认字段设计
4. ✅ 复用区：快速过，确认无遗漏
5. ⏸ 暂缓区：确认范围边界

---

## 变更记录

| 日期 | 修改人 | 修改内容 |
|---|---|---|
| 2026-05-28 | 产品负责人 | 创建融合计划，确定 3 步方法论 |
| 2026-05-28 | 产品负责人 | 完成旧设计通读，产出表标签清单初稿（待逐表核对）|
