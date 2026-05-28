# 觉学融合设计文档

> 状态：进行中
> 制定日期：2026-05-28
> 说明：以新设计业务逻辑为准，参考旧设计（FINAL_DESIGN_SANSUSHENG.md）字段命名与结构规范，产出字段级完整设计，可直接用于写 Prisma schema。
> 每次工作前必读：docs/_handoff/decisions/07-integration-plan.md

---

## 使用说明

- 每张表必须注明：服务能力、写权限、约束实现层
- 状态标记：✅ 已确认 / 🔵 草稿待确认 / ⬜ 未开始
- 新增 enum 统一在本文档 §七 定义

---

## 一、🔧 扩展表（8 张）

旧设计字段为底，按新业务逻辑加字段/改语义。

---

### 1.1 Program（科系）✅ 已确认

**服务能力**：能力 1（阶段与专业体系）
**写权限**：`super_admin`（全局作用域，D12）
**参考决策**：D2（两级固定）、D3（专业可配置）

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `name` | String | 专业显示名，如"加行2024届" | 旧 |
| `code` | String | 专业类型码，如"jiaxing"（同类型不同届共用同一 code）| 旧（语义扩展）|
| `cohortYear` | Int | 届数年份，如 2024；同一 code+cohortYear 唯一 | **新增** |
| `stage` | ProgramStage | `preke`（预科）/ `zhengke`（正科），D2 固定两级 | **新增** |
| `description` | String? | 专业说明 | 旧 |
| `isActive` | Boolean | 默认 true；false = 停用，不可新建关联班级 | **新增** |
| `createdAt` | DateTime | 创建时间 | 旧 |
| ~~`academyId`~~ | ~~String?~~ | 移除：新设计无 Academy 层，阶段直接用 stage 字段 | **移除** |

#### 关联

| 关联 | 变更 |
|---|---|
| `classes Class[]` | 保留 |
| `semesters ProgramSemester[]` | 保留 |
| `weeks ProgramWeek[]` | 保留 |
| `studyTypes ProgramStudyType[]` | 保留 |
| ~~`selfStudy UserSelfStudyProgram[]`~~ | 移除（自学模式 ⏸ 暂缓）|

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([code, cohortYear])` | DB | 同一专业同一届只有一个实例 |
| `stage` 枚举 | DB（Prisma enum）| 只允许 preke/zhengke |
| `isActive=false` 时禁止新建关联班级 | 应用层 | 防止停用专业还能入班 |
| 专业不可物理删除（D18）| 应用层 | 只允许 `isActive=false`，无 delete API |

---

### 1.2 ProgramSemester（科目/学期）⬜ 未开始

### 1.3 ClassMember（班级成员）⬜ 未开始

### 1.4 StudyRecord（闻思打卡）⬜ 未开始

### 1.5 SpeakingGrade / ExamGrade（讲考/考试成绩）⬜ 未开始

### 1.6 CohortLagSnapshot（掉队快照）⬜ 未开始

### 1.7 ClassSession（共修场次）⬜ 未开始

### 1.8 UserPracticeVow（修持愿）⬜ 未开始

---

## 二、🔄 替换表（3 张）

按新设计逻辑重写，旧表仅作字段命名参考。

---

### 2.1 UserRoleAssignment（替代 ClassAdmin）⬜ 未开始

### 2.2 care_followup_records（替代 CareFollowup）⬜ 未开始

### 2.3 TransmissionRecord（整合 TantricAccessGrant）⬜ 未开始

---

## 三、➕ 新建表（12 张）

按新业务能力从头设计。

---

### 3.1 UserRoleAssignment（角色分配）⬜ 未开始

### 3.2 RoleAssignmentHistory（角色变更留痕）⬜ 未开始

### 3.3 TransmissionRecord（传承记录）⬜ 未开始

### 3.4 StudentSpecialStatus（特殊身份）⬜ 未开始

### 3.5 CareWatchlistItem（关怀清单条目）⬜ 未开始

### 3.6 ClassInviteCode（邀请码）⬜ 未开始

### 3.7 AssistantAssignment（辅助员配对）⬜ 未开始

### 3.8 SemesterSnapshot（报数快照）⬜ 未开始

### 3.9 ReportConfession（虚报忏悔记录）⬜ 未开始

### 3.10 AdvancementCheck（升学资格预检报告）⬜ 未开始

### 3.11 AdvancementRecord（升学记录）⬜ 未开始

### 3.12 AuditLog（审计日志）⬜ 未开始

---

## 四、✅ 复用表（直接沿用旧设计）

> 以下表从旧设计直接复用，字段不改，仅确认无遗漏。待步骤 1d 快速过完后补充字段列表。

| 表 | 服务能力 | 状态 |
|---|---|---|
| `PracticeLog` | 能力 4/6/7 | ⬜ |
| `PracticeTemplate` | 能力 4/6/7 | ⬜ |
| `CohortRecommendedTemplate` | 能力 1/2 | ⬜ |
| `LessonCompletion` | 能力 3 | ⬜ |
| `PracticeJournal` | 能力 7 | ⬜ |
| `QuestionReference` | 能力 3 | ⬜ |
| `LessonResource` | 能力 3 | ⬜ |
| `LessonMediaChapter` | 能力 3 | ⬜ |
| `LessonTextBlock` | 能力 3 | ⬜ |
| `ProgramWeek` | 能力 1 | ⬜ |
| `ProgramWeekCourse` | 能力 1 | ⬜ |
| `ProgramWeekPractice` | 能力 1/4 | ⬜ |
| `ProgramStudyType` | 能力 8 | ⬜ |
| `CohortRestWeek` | 能力 8 | ⬜ |
| `Event` | 能力 15 | ⬜ |
| `EventCount` | 能力 15 | ⬜ |
| `TantricGroup` | 能力 15/17 | ⬜ |
| `ContentChunk` | AI 助手 | ⬜ |
| `FeatureEntry` | AI 助手 | ⬜ |
| `AiConversation` / `AiMessage` / `AiUsage` | AI 助手 | ⬜ |
| `SpeakingSession` | 能力 10 | ⬜ |
| `SpeakingRegistration` | 能力 10 | ⬜ |
| `Exam` | 能力 10 | ⬜ |
| `CohortWeeklySummary` | 管理端 ⏸ 暂缓 | ⬜ |

---

## 五、⏸ 暂缓表（保留旧设计原样）

| 表 | 说明 |
|---|---|
| `ClassPost` / `ClassPostReaction` / `ClassPostComment` / `ClassPostShare` | 班级动态，新设计 20 条能力未覆盖 |
| `Discussion` / `DiscussionViewpoint` / `DiscussionVote` / `DiscussionComment` | 班级讨论，未覆盖 |
| `PracticeAppointment` | 约修，旧设计已标 ⏸ Phase 5 |
| `UserSelfStudyProgram` + `UserSelfStudyRestWeek` | 自学模式，未深度设计 |

---

## 六、Enum 定义

| Enum | 值 | 说明 |
|---|---|---|
| `ProgramStage` | `preke` / `zhengke` | 预科/正科，D2 固定（新增）|

---

## 七、变更记录

| 日期 | 内容 |
|---|---|
| 2026-05-28 | 创建文档；完成 1.1 Program 扩展设计（用户确认）|
