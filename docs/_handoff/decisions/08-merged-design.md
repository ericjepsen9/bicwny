# 觉学融合设计文档

> 状态：进行中
> 制定日期：2026-05-28
> 说明：以新设计业务逻辑为准，参考旧设计（FINAL_DESIGN_SANSUSHENG.md）字段命名与结构规范，产出字段级完整设计，可直接用于写 Prisma schema。
> 每次工作前必读：docs/_handoff/decisions/07-integration-plan.md

---

## 使用说明

- 每张表必须注明：服务能力、写权限、约束实现层
- 状态标记：✅ 已确认 / 🔵 草稿待确认 / ⬜ 未开始
- 新增 enum 统一在本文档 §六 定义

---

## 一、🔧 扩展表（7 张）

旧设计字段为底，按新业务逻辑加字段/改语义。

> 注：ProgramSemester 原列入扩展区，核对后确认字段够用、无需扩展，改判为 ✅ 复用（见 §四）。扩展区由 8 张调整为 7 张。

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
| `advancementConfigs ProgramAdvancementConfig[]` | **新增**（见 §三 升学条件配置）|
| ~~`selfStudy UserSelfStudyProgram[]`~~ | 移除（自学模式 ⏸ 暂缓）|

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([code, cohortYear])` | DB | 同一专业同一届只有一个实例 |
| `stage` 枚举 | DB（Prisma enum）| 只允许 preke/zhengke |
| `isActive=false` 时禁止新建关联班级 | 应用层 | 防止停用专业还能入班 |
| 专业不可物理删除（D18）| 应用层 | 只允许 `isActive=false`，无 delete API |

---

### 1.2 ClassMember（班级成员）✅ 已封板

**服务能力**：能力 2（学员加入专业）+ 能力 11（留级、退出、转专业）
**写权限**：状态机操作分级——`paused↔active` 学员自助；`held_back/graduated/left` 限 `class_admin` 及以上；复活（非 active→active）限 admin
**参考决策**：D15（退出后历史可查）、D18（不物理删除）、D19（班级只归档）

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `classId` | String | 关联 Class | 旧 |
| `userId` | String | 关联 User | 旧 |
| `joinedAt` | DateTime | 加入时间，默认 now() | 旧 |
| `cohortStatus` | CohortMemberStatus | active/paused/held_back/graduated/left，默认 active | 旧 |
| `isPrimary` | Boolean | 主班标记，默认 false；一人多班只有一个主班 | 旧 |
| `heldBackCount` | Int | 留级累计次数，默认 0；转 held_back 时 +1 | 旧 |
| `graduatedAt` | DateTime? | 毕业时间 | 旧 |
| `statusChangedAt` | DateTime? | 当前状态快照——最近一次变更时间 | 旧 |
| `statusChangedBy` | String? | 最近一次变更操作人 userId（学员自助 = 本人）| 旧 |
| `statusChangeReason` | String? | 最近一次变更原因 | 旧 |
| ~~`role`~~ | ~~String~~ | 移除：旧纯历史兼容字段，鉴权已移交 UserRoleAssignment；辅导员身份从 UserRoleAssignment 按班级作用域读 | **移除** |
| ~~`removedAt`~~ | ~~DateTime?~~ | 移除：旧退班兼容字段，无生产数据可兼容；退班统一用 `cohortStatus='left'` + `statusChangedAt` | **移除** |

> `statusChanged*` 三件套仅存**最近一次**变更，作当前状态快照（冗余便利）。完整变更链（退出→回归→留级…）由 EnrollmentStatusHistory 永久留档（D18），见 §3.14。

#### 关联

| 关联 | 变更 |
|---|---|
| `class Class` | 保留 |
| `user User` | 保留 |
| `statusHistory EnrollmentStatusHistory[]` | **新增**（见 §3.14）|

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([classId, userId])` | DB | 一个师兄在一个班只有一条成员记录（回归走 left→active 复活同行，不新建）|
| 一人一主班 | 应用层 | `isPrimary` 不加 DB 唯一索引（无法单列表达「一人一主班」），切换走事务 |
| 状态机合法转移 | 应用层 | 自助/管理员/admin 三级权限校验 |
| 不物理删除（D18/D19）| 应用层 | 退班 = `cohortStatus='left'`，记录保留可查；无 delete API |

#### 设计意图

退班用状态位而非删行，配合 EnrollmentStatusHistory 满足 D15「退出后学员仍可只读查看历史」。`@@unique([classId, userId])` 保证回归（能力 11 规则#2）时复活原成员行、记录自动衔接，不产生重复成员。

> **辅导员与成员身份**（用户决策 2026-05-29）：辅导员**可以是班级成员**（ClassMember 装学员也装辅导员），其管理角色叠加在 UserRoleAssignment 上。ClassMember 只表达「属于这个班」，不再用字段区分学员/辅导员——身份一律从 UserRoleAssignment 按班级作用域读。删除 `role` 即据此。
>
> **业务逻辑权威**：本表及后续所有表的业务规则，一切以新设计决策文档（05/06）为准，旧设计仅作字段命名/结构参考。

### 1.3 StudyRecord（讲考+共修打卡）✅ 已封板

**服务能力**：能力 8（共修与出勤）+ 能力 10（讲考）
**写权限**：学员 App 内自助（需登录，校验场次时间窗口）；管理员可代行补卡（能力 5，代行明细走 AuditLog）
**参考决策**：D17（代行留痕）、D18（不物理删除）

> **边界澄清**（重要）：StudyRecord **只装讲考 + 共修**，不装闻思圆满。听音视频/看法本/观修走 LessonCompletion（复用区），答思考题走 UserAnswer/QuestionReference（复用区）。旧设计「闻思打卡系统」是分类名，实际表内容是讲考/共修。原 08 文档把本表标为「闻思打卡 / 能力 3/4」是错的，已纠正为「讲考+共修 / 能力 8/10」。
>
> **去掉 `self_checkin`**（用户决策 2026-05-29）：首页日常签到移除，StudyRecord 仅保留讲考、共修两类。连带「一天一次」按天去重难题消失，全部改用按场次的 DB 唯一约束。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `userId` | String | 关联 User | 旧 |
| `classId` | String? | 平台级讲考可为 null | 旧 |
| `lessonId` | String | 所有打卡必须绑定课时 | 旧 |
| `studyType` | String | 见下方取值（已去 self_checkin）| 旧（语义收窄）|
| `lessonResourceId` | String? | 听课/读讲记：选哪位讲者版本 | 旧 |
| `classSessionId` | String? | 共修：关联 ClassSession | 旧 |
| `speakingSessionId` | String? | 讲考：关联 SpeakingSession | 旧 |
| `studyDate` | DateTime | 打卡日期 | 旧 |
| `createdBy` | String? | 本人 或 管理员代行（代行明细走 AuditLog）| 旧 |
| `isConfirmed` | Boolean | 审核态字段保留，无审核 UI；自助打卡置 true | 旧 |
| `confirmedAt` | DateTime? | 保留字段 | 旧 |
| `confirmedBy` | String? | 保留字段 | 旧 |
| `createdAt` | DateTime | 默认 now() | 旧 |
| ~~`self_checkin`（studyType 取值）~~ | — | 移除：首页日常签到取消 | **移除** |

#### studyType 取值（互斥）

| 值 | 含义 | 能力 |
|---|---|---|
| `speaking_present` | 讲考：主讲（三选一互斥）| 能力 10 |
| `speaking_question` | 讲考：提问 | 能力 10 |
| `speaking_observe` | 讲考：旁听 | 能力 10 |
| `group_attend` | 共修：出席（二选一互斥）| 能力 8 |
| `group_absent` | 共修：缺席 | 能力 8 |
| `group_review` | 共修：复习 | 能力 8 |
| `group_summary` | 共修：总结 | 能力 8 |

#### 关联

| 关联 | 变更 |
|---|---|
| `user User` | 保留 |
| `lesson Lesson` | 保留 |

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([classSessionId, userId, studyType])` | DB | 共修签到防重；**补回旧设计正文引用但 model 漏写的约束** |
| `@@unique([speakingSessionId, userId, studyType])` | DB | 讲考签到防重；同上补回 |
| 不物理删除（D18）| 应用层 | 无 delete API |

#### 设计意图

去掉 self_checkin 后，每条记录必有 classSessionId 或 speakingSessionId 之一非空，两条唯一约束按场次各管一类（NULL 在唯一约束中互不冲突），与 LessonCompletion 双 @@unique 同套路。修复了旧设计「正文说有 @@unique、model 却没写」的审计级不一致。

### 1.4 SpeakingGrade / ExamGrade（讲考/考试成绩）⬜ 未开始

### 1.5 CohortLagSnapshot（掉队快照）⬜ 未开始

### 1.6 ClassSession（共修场次）⬜ 未开始

### 1.7 UserPracticeVow（修持愿）⬜ 未开始

---

## 二、🔄 替换表（3 张）

按新设计逻辑重写，旧表仅作字段命名参考。

---

### 2.1 UserRoleAssignment（替代 ClassAdmin）⬜ 未开始

### 2.2 care_followup_records（替代 CareFollowup）⬜ 未开始

### 2.3 TransmissionRecord（整合 TantricAccessGrant）⬜ 未开始

---

## 三、➕ 新建表（14 张）

按新业务能力从头设计。

> 注：ProgramAdvancementConfig 为核对能力 10 时新增（升学条件数据化，存法二）；EnrollmentStatusHistory 为核对能力 11 时新增（入学状态变更永久留痕，D18）。新建区由 12 张调整为 14 张。

---

### 3.1 ProgramAdvancementConfig（升学条件配置）✅ 已确认

**服务能力**：能力 1（专业可配置）+ 能力 10（升学硬条件）
**写权限**：`subject_admin`（学科作用域）及以上
**参考决策**：D3（数据驱动）、D13（硬条件不放宽）、D17（代行豁免逐条标记）

每个专业的每条升学条件 = 一行记录。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `programId` | String | 关联 Program（专业×届）|
| `conditionType` | AdvancementConditionType | 6 类条件（见 §六 enum）|
| `conditionKey` | String | 细分标识，如 `practice_92`、`cumulative_guanyin` |
| `label` | String | 管理端识别名，如"92 修法完成" |
| `targetValue` | Int? | 数量门槛（10万=100000 / 出勤次数 / 合格分 60）|
| `params` | Json? | 额外参数（累计型关联模板 id、座数+时长双指标等）|
| `isRequired` | Boolean | 默认 true；是否硬性必须 |
| `isExemptable` | Boolean | 是否允许管理员代行豁免（D17）|
| `displayOrder` | Int | 排序，默认 0 |

#### conditionType 与硬条件对应（能力 10 规则 4 的 6 类）

| 值 | 对应硬条件 | 判定数据来源 |
|---|---|---|
| `course_completion` | 全部正式课程闻思圆满 | 能力 3 |
| `practice_session` | 92 修法（座数+时长）| 能力 4 |
| `cumulative_count` | 6 项内加行各 10 万 | 能力 6 |
| `attendance` | 共修出勤达标 | 能力 8 |
| `exam_score` | S8 升学考合格 | 能力 10 |
| `transmission` | 灌顶（已接受传承）| 能力 17 |

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([programId, conditionKey])` | DB | 同专业同条件唯一 |
| 配置不可物理删除（D18）| 应用层 | 停用走 `isRequired=false`，无 delete |

#### 设计意图

能力 10 的 AdvancementCheck（升学预检）遍历本表逐条判定，新增专业/调整门槛不动代码（D3）。逐条 `isExemptable` 标记支持 D17 代行豁免的细粒度控制。

#### Prisma schema

```prisma
model ProgramAdvancementConfig {
  id            String                    @id @default(cuid())
  programId     String
  conditionType AdvancementConditionType
  conditionKey  String   // 细分标识，如 "practice_92"、"cumulative_guanyin"
  label         String   // 管理端识别名，如 "92 修法完成"
  targetValue   Int?     // 数量门槛（10万=100000 / 出勤次数 / 合格分 60）
  params        Json?    // 额外参数（累计型关联模板 id、座数+时长双指标等）
  isRequired    Boolean  @default(true)   // 是否硬性必须
  isExemptable  Boolean  @default(false)  // 是否允许管理员代行豁免（D17）
  displayOrder  Int      @default(0)

  program Program @relation(fields: [programId], references: [id])

  @@unique([programId, conditionKey])
}
```

> 默认值说明：`isRequired=true`（条件默认硬性）、`isExemptable=false`（默认不可豁免，需管理员显式开启），契合 D13「硬条件不放宽」基调。

---

### 3.2 UserRoleAssignment（角色分配）⬜ 未开始

### 3.3 RoleAssignmentHistory（角色变更留痕）⬜ 未开始

### 3.4 TransmissionRecord（传承记录）⬜ 未开始

### 3.5 StudentSpecialStatus（特殊身份）⬜ 未开始

### 3.6 CareWatchlistItem（关怀清单条目）⬜ 未开始

### 3.7 ClassInviteCode（邀请码）⬜ 未开始

### 3.8 AssistantAssignment（辅助员配对）⬜ 未开始

### 3.9 SemesterSnapshot（报数快照）⬜ 未开始

### 3.10 ReportConfession（虚报忏悔记录）⬜ 未开始

### 3.11 AdvancementCheck（升学资格预检报告）⬜ 未开始

### 3.12 AdvancementRecord（升学记录）⬜ 未开始

### 3.13 AuditLog（审计日志）⬜ 未开始

### 3.14 EnrollmentStatusHistory（入学状态变更留痕）✅ 已确认

**服务能力**：能力 11（留级、退出、转专业）
**写权限**：随状态机操作写入（学员自助退出 = 本人；管理员操作 = 操作人）
**参考决策**：D15（退出后学员可查）、D18（永久留档不删除）

一次状态变更 = 一行记录，永久保留。与 ClassMember 上的 `statusChanged*` 快照互补：快照存最近一次，本表存完整链路。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `memberId` | String | 关联 ClassMember |
| `fromStatus` | CohortMemberStatus? | 变更前状态；首次记录可空 |
| `toStatus` | CohortMemberStatus | 变更后状态 |
| `changedAt` | DateTime | 变更时间，默认 now() |
| `changedBy` | String | 操作人 userId（学员自助退出 = 本人）|
| `reason` | String? | 变更原因 |

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@index([memberId])` | DB | 按成员查历史链 |
| 不可删除/修改（D18）| 应用层 | 只追加（append-only），无 update/delete API |

#### Prisma schema

```prisma
model EnrollmentStatusHistory {
  id         String              @id @default(cuid())
  memberId   String
  fromStatus CohortMemberStatus?  // 首次记录可空
  toStatus   CohortMemberStatus
  changedAt  DateTime            @default(now())
  changedBy  String              // 操作人 userId（学员自助退出 = 本人）
  reason     String?

  member ClassMember @relation(fields: [memberId], references: [id])

  @@index([memberId])
}
```

#### 设计意图

与 RoleAssignmentHistory（§3.3）对称：角色变更留痕 vs 入学状态变更留痕。学员端可直接查自己的 `memberId` 历史满足 D15，无需从面向管理员的 AuditLog（§3.13）里捞。反向关联 `member ClassMember` 与 ClassMember 的 `statusHistory EnrollmentStatusHistory[]` 成对（一致性检查项 1）。

---

## 四、✅ 复用表（直接沿用旧设计）

> 以下表从旧设计直接复用，字段不改，仅确认无遗漏。待步骤 1d 快速过完后补充字段列表。

| 表 | 服务能力 | 状态 |
|---|---|---|
| `ProgramSemester`（科目/学期，字段够用，详见下）| 能力 1 | ✅ 确认复用 |
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

#### ProgramSemester 复用说明

学期分层 = 「第几周到第几周」的单一属性，由 `startsWeek` / `endsWeek` 两个 Int 表达，不需要拆成多条记录的子表。旧设计字段已满足新业务，照搬不改：

```prisma
model ProgramSemester {
  id             String   @id @default(cuid())
  programId      String
  semesterNumber Int      // 科目序号（1=一年级）
  semesterName   String?  // 科目名（如"加行一年级"）
  startsWeek     Int      // 全程第几周开始
  endsWeek       Int      // 全程第几周结束

  program  Program        @relation(fields: [programId], references: [id])
  weeks    ProgramWeek[]
  courses  Course[]

  @@unique([programId, semesterNumber])
}
```

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
| `AdvancementConditionType` | `course_completion` / `practice_session` / `cumulative_count` / `attendance` / `exam_score` / `transmission` | 升学条件 6 类（新增，能力 10）|
| `CohortMemberStatus` | `active` / `paused` / `held_back` / `graduated` / `left` | 成员状态机 5 态（旧设计沿用，能力 11）|

---

## 七、变更记录

| 日期 | 内容 |
|---|---|
| 2026-05-28 | 创建文档；完成 1.1 Program 扩展设计（用户确认）|
| 2026-05-28 | ProgramSemester 改判为 ✅ 复用（字段够用）；新增 ProgramAdvancementConfig 表（升学条件数据化，存法二，用户确认）；扩展区 8→7 张，新建区 12→13 张 |
| 2026-05-29 | ProgramSemester 补复用说明 + Prisma schema（学期=周区间单一属性，照搬旧设计）；ProgramAdvancementConfig 落 Prisma 代码块（isRequired 默认 true、isExemptable 默认 false，契合 D13）|
| 2026-05-29 | 完成 1.2 ClassMember 扩展（删 removedAt，role 标 ⚠️ 待决策）；新增 §3.14 EnrollmentStatusHistory（入学状态变更留痕，D18，与 RoleAssignmentHistory 对称）；新建区 13→14 张；新增 CohortMemberStatus enum |
| 2026-05-29 | ClassMember 封板：确认删 `role`（辅导员可为班级成员，身份从 UserRoleAssignment 读）；记录「业务逻辑一切以新设计文档 05/06 为准」|
| 2026-05-29 | 完成 1.3 StudyRecord 封板：纠正边界（仅讲考+共修，服务能力 8/10，非 3/4）；去掉 self_checkin 日常签到；补回旧设计漏写的两条按场次 @@unique |
| 2026-05-29 | 补建 §八 决策记录、§九 一致性检查记录（守则要求每次记录决策过程 + 跑检查，前几轮缺，本轮回填）；修复 EnrollmentStatusHistory 缺反向关联（检查项 1）|

---

## 八、决策记录（每条非显然选择的 WHY 与排除方案）

> 守则要求：每个非显然的设计选择，注明为什么这样做、排除了什么方案。以下回填 1.1~1.3 各轮决策。

| 编号 | 决策 | 选定方案 | 排除方案及理由 |
|---|---|---|---|
| DR-1 | Program 如何表达「专业 × 届」 | 每届 = 一条 Program 记录，`code`（专业类型）+ `cohortYear`（届）联合唯一 | 排除「共享 Program 模板 + 届放别处」：会让起修日/课表/升学配置随届变化时无处落，按届独立成行最简单直接 |
| DR-2 | Program 是否保留 academyId | 移除 | 新设计无 Academy 层，阶段直接用 `stage` 枚举（D2 两级固定），保留是死字段 |
| DR-3 | ProgramSemester 是否需要扩展 | 改判为 ✅ 复用，不动 | 学期分层 = `startsWeek`/`endsWeek` 周区间的单一属性，旧字段已够，无新业务需求，不拆子表 |
| DR-4 | 升学条件如何存储 | 新建 ProgramAdvancementConfig，一条规则一行（存法二）| 排除「Program 上加 Json 字段」（存法一）：JSON 不可按条件查询、无法逐条标记 isExemptable，而能力 10 升学预检要逐条判定、D17 要逐条豁免 |
| DR-5 | ProgramAdvancementConfig 默认值 | `isRequired=true`、`isExemptable=false` | 契合 D13「硬条件不放宽」基调——条件默认硬性且默认不可豁免，豁免需管理员显式开启 |
| DR-6 | ClassMember 退班如何表达 | `cohortStatus='left'` 状态位 + EnrollmentStatusHistory 留痕 | 排除物理删行（违反 D18）；排除保留旧 `removedAt`（无生产数据要兼容，与 cohortStatus 语义重复）|
| DR-7 | 状态变更完整链路如何留档 | 新建 EnrollmentStatusHistory，一次变更一行 | 排除「只用 ClassMember 上 statusChanged* 三件套」：三件套只存最近一次，退出→回归→留级链路会被覆盖丢失，违反 D18/D15。排除「塞进通用 AuditLog」：AuditLog 面向管理员，D15 要学员自己可只读查看 |
| DR-8 | ClassMember 是否保留 role 字段 | 移除 | 旧设计 role 早已不做鉴权（移交 ClassAdmin→新设计 UserRoleAssignment）。用户决策：辅导员可为班级成员，身份统一从 UserRoleAssignment 按班级作用域读 |
| DR-9 | 一人一主班如何约束 | 应用层事务，不加 DB 唯一索引 | 「一人在多班中只有一个 isPrimary=true」无法用单列唯一约束表达，只能应用层保证 |
| DR-10 | StudyRecord 服务什么能力 | 纠正为仅讲考(10)+共修(8) | 旧设计 model 注释明确「listen/read_notes 已移除走 LessonCompletion」，原 08 文档标「闻思/能力3/4」是误读；闻思圆满全在复用区表 |
| DR-11 | 是否保留 self_checkin 日常签到 | 移除 | 用户决策：按能力签到只要讲考+共修。连带好处：self_checkin「一天一次」的按天去重难题（DateTime 无法做按天 DB 约束）随之消失 |
| DR-12 | StudyRecord 签到防重如何实现 | 两条按场次 `@@unique`（classSessionId / speakingSessionId）| 去掉 self_checkin 后每条必有一个场次 id 非空，按场次去重天然成立，无需冗余 studyDay 字段。同时修复旧设计「正文引用 @@unique、model 漏写」的不一致 |

---

## 九、一致性检查记录

> 守则要求：每次改动后跑一致性检查。范围限已封板的表（1.1 Program、1.2 ClassMember、1.3 StudyRecord、3.1 ProgramAdvancementConfig、3.14 EnrollmentStatusHistory）。⬜ 未开始的表待其封板后纳入。全表 14 项完整检查在所有表完成后（步骤 3）再跑一次。

### 检查轮次 1（2026-05-29，范围：已封板 5 张表）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ⚠️→✅ 已修 | 发现 ClassMember.`statusHistory` 缺 EnrollmentStatusHistory 反向 `member` 关联 → 本轮补 Prisma schema 含反向关联 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 本文档暂未写 API 响应层，待 API 设计阶段核对 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 已封板表均无 SQL 视图 |
| 4. 总览计数正确 | ✅ | §三标题「14 张」与实际条目一致；扩展区 7、新建区 14 与各注记一致 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | Migration 列表待全表完成后统一编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | self_checkin、removedAt、role、academyId 均明确标「移除」并注理由 |
| 8. 业务规则约束有实现方式 | ✅ | 各表约束均注明 DB / 应用层 |
| 9. 升学条件可全查 | 🔵 部分 | ProgramAdvancementConfig 6 类 conditionType 已映射能力 3/4/6/8/10/17 数据源；待 AdvancementCheck(§3.11) 封板后验证路径闭环 |
| 10. D14 累计/日常豁免字段区分 | ⬜ 待 PracticeLog/UserPracticeVow 封板 | 涉及 vow_type，相关表未封板 |
| 11. D17 代行留痕路径完整 | 🔵 部分 | StudyRecord.createdBy 表达代行，明细走 AuditLog(§3.13)；待 AuditLog 封板验证覆盖全代行类型 |
| 12. D18 不物理删除 | ✅ | 5 张表均注明无 delete / append-only / 状态位归档 |
| 13. 02 文档 23 职能写表覆盖 | ⬜ 待全表完成 | 需全表就绪后逐职能核对 |
| 14. 枚举值各处一致 | ✅ | CohortMemberStatus 在 ClassMember/EnrollmentStatusHistory/§六 三处一致；AdvancementConditionType 在 §3.1/§六 一致 |

**本轮发现问题数**：1（检查项 1 关联不对称）→ 已当轮修复。
**结论**：已封板 5 张表通过范围内检查。⏸/⬜ 项待依赖表封板后纳入下一轮。
