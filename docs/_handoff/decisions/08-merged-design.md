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

## 一、🔧 扩展表（9 张）

旧设计字段为底，按新业务逻辑加字段/改语义。

> 注：ProgramSemester 核对后字段够用改判 ✅ 复用；CohortRecommendedTemplate 核对能力 9 后需扩展（classId→programId）从复用区移入；UserPracticeVow 剥离班级任务重新定位为纯发愿表。扩展区最终 9 张。

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

> `statusChanged*` 三件套仅存**最近一次**变更，作当前状态快照（冗余便利）。完整变更链（退出→回归→留级…）由 EnrollmentStatusHistory 永久留档（D18），见 §3.12。

#### 关联

| 关联 | 变更 |
|---|---|
| `class Class` | 保留 |
| `user User` | 保留 |
| `statusHistory EnrollmentStatusHistory[]` | **新增**（见 §3.12）|

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

### 1.4 SpeakingGrade / ExamGrade / Exam（成绩）✅ 已封板

**服务能力**：能力 10（考试与升学）
**写权限**：班级级讲考评分限 `class_tutor` 及以上（本班）；平台级讲考评分限 `subject_admin` / `super_admin`（SpeakingGrade.classId=null）；考试成绩录入限 `class_admin` 及以上（职能 #7，辅导员无权）；Exam 创建——随堂测验辅导员（#11a）、升学考班级管理员（#11b）
**参考决策**：D3（合格线数据驱动）、D13（升学硬条件）、D18（成绩永久留档）

> **三表关系**：ExamGrade 结构旧设计已完整，**复用不动**。**Exam 加 `examType`**——核对能力 10 发现旧 Exam 无法区分「随堂测验 vs 升学考」，导致升学预检取不到正确成绩、两类写权限无法分流。**SpeakingGrade.classId 改可空**——平台级讲考（SpeakingSession.classId=null）由 subject_admin/super_admin 评分，无归属班，见 DR-48。本节三张表均有变更，归入扩展区。

#### SpeakingGrade（讲考评分）— 🔧 扩展：classId 改可空

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `speakingSessionId` | String | 关联 SpeakingSession | 旧 |
| `userId` | String | 被评分学员 | 旧 |
| `classId` | String? | 评分人所在班级；**null = 平台级评分（subject_admin/super_admin）** | 旧→**改可空** |
| `score` | String | `pass` / `fail` / `excellent` | 旧 |
| `comment` | String? | 评语 | 旧 |
| `gradedBy` | String | 评分人 userId | 旧 |
| `gradedAt` | DateTime | 默认 now() | 旧 |

```prisma
model SpeakingGrade {
  id                String   @id @default(cuid())
  speakingSessionId String
  userId            String
  classId           String?  // 评分人所在班级；null=平台级评分（subject_admin/super_admin）
  score             String   // pass / fail / excellent
  comment           String?
  gradedBy          String   // 评分人 userId
  gradedAt          DateTime @default(now())

  session SpeakingSession @relation(fields: [speakingSessionId], references: [id])
  user    User            @relation(fields: [userId], references: [id])

  @@unique([speakingSessionId, userId])  // 每场每人一条
}
```

#### ExamGrade（考试成绩）— ✅ 复用不动

```prisma
model ExamGrade {
  id        String   @id @default(cuid())
  examId    String
  userId    String
  classId   String   // 学员所在班级（权限校验 + 统计维度）
  score     Int      // 0-100 整数
  comment   String?
  gradedBy  String   // admin/coach userId
  gradedAt  DateTime @default(now())

  exam    Exam  @relation(fields: [examId], references: [id])
  user    User  @relation(fields: [userId], references: [id])
  class   Class @relation(fields: [classId], references: [id])
  grader  User  @relation("ExamGrader", fields: [gradedBy], references: [id])

  @@unique([examId, userId])  // 每场每人一条（upsert 更新）
}
```

> 合格线**不写死**在 ExamGrade，由 ProgramAdvancementConfig（§3.1）`exam_score` 条件的 `targetValue`（如 60）判定，符合 D3 数据驱动。

#### Exam（考试）— 🔧 扩展：加 `examType`

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `title` | String | 考试名称 | 旧 |
| `description` | String? | 考试说明 | 旧 |
| `examDate` | DateTime | 考试日期 | 旧 |
| `classId` | String? | null=平台级；有值=班级级 | 旧 |
| `courseId` | String? | 可选关联法本 | 旧 |
| `examType` | String | `quiz`（随堂测验，辅导员起 #11a，不影响升学）/ `advancement`（升学考，班级管理员起 #11b，影响升学资格）；默认 `quiz` | **新增** |
| `createdBy` | String | admin/coach userId | 旧 |
| `createdAt` | DateTime | 默认 now() | 旧 |

```prisma
model Exam {
  id          String    @id @default(cuid())
  title       String
  description String?
  examDate    DateTime
  classId     String?
  courseId    String?
  examType    String    @default("quiz")  // quiz 随堂测验 / advancement 升学考
  createdBy   String
  createdAt   DateTime  @default(now())

  class   Class?  @relation(fields: [classId], references: [id])
  course  Course? @relation(fields: [courseId], references: [id])
  creator User    @relation("ExamCreator", fields: [createdBy], references: [id])
  grades  ExamGrade[]
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([speakingSessionId, userId])` | DB | 讲考每场每人一条 |
| `@@unique([examId, userId])` | DB | 考试每场每人一条 |
| `examType` 仅 quiz/advancement | 应用层（Zod）| 两值枚举，无 Prisma enum（与旧 String 风格一致）|
| 升学考创建限班级管理员、随堂测验限辅导员 | 应用层 | 按 examType 分流写权限（职能 #11a/#11b）|
| 考试成绩录入限 class_admin 及以上 | 应用层 | 职能 #7，辅导员无录入权 |
| 班级级讲考评分限 class_tutor 及以上 | 应用层 | SpeakingGrade.classId 非空时；评分人须在同一班 |
| 平台级讲考评分限 subject_admin / super_admin | 应用层 | SpeakingGrade.classId=null 时；按 SpeakingSession.classId=null 判定 |
| 成绩永久留档（D18）| 应用层 | 无 delete，修正走 upsert + AuditLog |

#### 设计意图

升学考是否分 S5/S8 节点**不在 Exam 上建字段**（4a 决策）：升学节点属专业配置范畴，由 ProgramAdvancementConfig 的 `conditionKey`（如 `exam_s8`）+ `params` 指定要匹配 `examType='advancement'` 的成绩，Exam 只需知道「我是不是升学考」。这样新增/调整升学节点不动 Exam 结构（D3）。

### 1.5 CohortLagSnapshot（掉队快照）✅ 已封板

**服务能力**：能力 14（学员关怀清单）—— 自动触发关怀的检测信号源
**读权限**：辅导员及以上（`class_tutor` / `class_admin` / `subject_admin` / `super_admin`，按作用域，能力 14 规则 3）；**学员端完全不可见**（无 API 返回）
**写权限**：系统每日凌晨定时任务重算，无人工写入
**参考决策**：D3（阈值数据化）、D8（作用域）、D18（备注留档，本表为 computed state 例外见下）

> **复用为主**：字段结构旧设计已严谨，照搬不动。仅两处调整：(1) 新增 `LagStatus` enum 进 §六；(2) 读权限从旧 ClassAdmin flag 体系改写为新 UserRoleAssignment 角色体系（辅导员及以上）。
>
> **⚠️ 待办（能力 14 约束 #1）**：掉队判定阈值（近 2 周窗口、各档比例、`lagPracticeDaysExpected`）目前散落代码/User 表，按能力 14 应数据化为专业配置项（D3）。本表仅存算出的 LagStatus 结果，阈值属计算逻辑层，不在本表字段范围——挂入 §十 待办清单，待 Program/配置表设计时统一处理。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `classId` | String | 关联 Class | 旧 |
| `studentId` | String | 被检测的师兄 userId | 旧 |
| `attendanceLag` | LagStatus | 出勤（近2周必修场次签到率），默认 on_track | 旧 |
| `contentLag` | LagStatus | 闻思内容（近2周 LessonCompletion read/audio/video 完成率）| 旧 |
| `quizLag` | LagStatus | 答题（近2周排表课时关联题目完成率）| 旧 |
| `meditationLag` | LagStatus | 观修（近2周 LessonCompletion type=meditation 完成率）| 旧 |
| `taskLag` | LagStatus | 修持任务（近2周班级/课程任务打卡天数达标率）| 旧（描述更新）|
| `detail` | Json? | 各维度分子分母明细 | 旧 |
| `computedAt` | DateTime | 重算时间，默认 now() | 旧 |

#### 关联

| 关联 | 变更 |
|---|---|
| `class Class` | 保留 |
| `student User` | 保留 |

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([classId, studentId])` | DB | 一人一行只存最新快照 |
| `@@index([classId])` | DB | 名单页按班查询 |
| 仅 `cohortStatus=active` 成员计算 | 应用层 | paused/held_back/graduated/left 不入表（与 ClassMember 状态机对齐）|
| 学员端不可见 | 应用层 | 无 API 返回；仅辅导员及以上可读 |
| 无排表班（programId=null）三维恒 on_track | 应用层 | contentLag/quizLag/meditationLag 分母=0→率=1 |

#### 设计意图

五维独立、不加权汇总——名单页分列展示，辅导员据此逐维度判断关怀重点。本表是 computed state（每日重算覆盖），与成员生命周期表解耦，故不适用 D18「不物理删除」（旧记录被当日重算正常覆盖）；关怀的**永久留痕**落在 care_followup_records（§2.2）和 CareWatchlistItem（§3.4），快照只是触发信号源。读权限对齐能力 14 规则 3 的新角色体系。

```prisma
model CohortLagSnapshot {
  id             String    @id @default(cuid())
  classId        String
  studentId      String
  attendanceLag  LagStatus @default(on_track)
  contentLag     LagStatus @default(on_track)
  quizLag        LagStatus @default(on_track)
  meditationLag  LagStatus @default(on_track)
  taskLag        LagStatus @default(on_track)
  detail         Json?
  computedAt     DateTime  @default(now())

  class   Class @relation(fields: [classId], references: [id])
  student User  @relation(fields: [studentId], references: [id])

  @@unique([classId, studentId])
  @@index([classId])
}
```

### 1.6 ClassSession + ClassSessionSchedule（共修场次 + 课表模板）✅ 已封板

**服务能力**：能力 8（共修与出勤）
**写权限**：ClassSession 临时发起 = 辅导员及以上；课表生成场次 = 系统自动；ClassSessionSchedule 创建/修改 = 辅导员及以上；平台级（classId=null）仅 super_admin
**参考决策**：D3（链接时效/出勤门槛数据化）、D17（补卡/撤销代行留痕）、D18（出勤记录不删除）

> **方案 b（用户决策）**：能力 8「双轨发起」要求课表模板与单次场次分层，单表无法表达循环规则与历史打卡的解耦。ClassSession 升级为单次场次（instance），新建 ClassSessionSchedule 为课表模板（schedule）。ClassSession 名称保留——旧代码/前端引用已用此名，改名迁移成本高。出勤仍走 StudyRecord（classSessionId，已在 1.3 封板），不另建出勤表。
>
> **⚠️ 待办（能力 8 约束）**：链接激活时效（提前 10 分钟、宽限 30 分钟）按能力 8 应为专业/班级配置项（D3），目前仍写在应用层常量 → 挂入 §十 TODO-2，待配置表设计时处理。

#### ClassSession（单次共修场次）— 🔧 扩展

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `classId` | String? | null=平台级（super_admin 发起）；有值=班级级 | 旧→**改可空** |
| `title` | String | 场次标题，如「周三晚共修」 | 旧 |
| `description` | String? | 场次说明 | 旧 |
| `startAt` | DateTime | 开始时间（UTC）| 旧 |
| `sessionEndAt` | DateTime? | 结束时刻（签到时间窗口用）| 旧扩展 |
| `durationMin` | Int | 时长分钟，默认 60 | 旧 |
| `liveLink` | String? | 直播链接（Zoom 等）| 旧 |
| `sessionType` | String | `online`（网络，默认）/ `offline`（线下）/ `self_study`（自学）| **新增** |
| `lessonId` | String? | 本次共修对应课时 | 旧扩展 |
| `checkInToken` | String? | 共修签到 token（@unique；online 类型生成，offline 不需要）| 旧扩展 |
| `scheduleId` | String? | null=临时发起；有值=由课表模板自动生成 | **新增** |
| `editVersion` | Int | 每次 PATCH 自增，客户端 ack 失效校验 | 旧 |
| `createdBy` | String | 操作人 userId | 旧 |
| `createdAt` | DateTime | 默认 now() | 旧 |
| `updatedAt` | DateTime | @updatedAt | 旧 |

```prisma
model ClassSession {
  id           String    @id @default(cuid())
  classId      String?   // null = 平台级
  title        String
  description  String?   @db.Text
  startAt      DateTime
  sessionEndAt DateTime?
  durationMin  Int       @default(60)
  liveLink     String?
  sessionType  String    @default("online")  // online / offline / self_study
  lessonId     String?
  checkInToken String?   @unique
  scheduleId   String?   // null = 临时发起
  editVersion  Int       @default(1)
  createdBy    String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  class    Class?                @relation(fields: [classId], references: [id])
  lesson   Lesson?               @relation(fields: [lessonId], references: [id])
  schedule ClassSessionSchedule? @relation(fields: [scheduleId], references: [id])
  studyRecords StudyRecord[]

  @@index([classId, startAt])
  @@index([startAt])  // 调度器扫窗口用
}
```

#### ClassSessionSchedule（共修课表模板）— ➕ 新建（见 §3.13）

详见 §3.13。此处仅列反向关联：`instances ClassSession[]`。

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `checkInToken` @unique | DB | token 全局唯一（online 场次专用）|
| `@@index([classId, startAt])` | DB | 班级共修时间线查询 |
| 平台级场次（classId=null）限 super_admin 创建 | 应用层 | |
| offline 场次不生成 checkInToken | 应用层 | sessionType='offline' 时 token 置 null |
| 链接时效由 startAt + durationMin + 宽限期计算 | 应用层 | 宽限期见 TODO-2 |
| 补卡/撤销留痕（D17）| 应用层 | 写入 StudyRecord + AuditLog |
| 出勤记录不物理删除（D18）| 应用层 | 撤销走 cohortStatus 或 AuditLog 标记 |

### 1.7 UserPracticeVow（发愿）✅ 已封板

**服务能力**：能力 7（个人修持自主承诺）+ 法会发愿
**写权限**：学员自助（个人发愿/法会发愿）；管理员代行走能力 5 + AuditLog
**参考决策**：D18（发愿记录不物理删除）

> **定位（用户决策 2026-05-29）**：本表是修学计数模块的**统一用户追踪条目表**，覆盖 5 种 context。任务定义（ClassTask / CohortRecommendedTemplate）独立存储，UserPracticeVow 是每个用户的追踪实例，两者通过外键关联。
>
> **保留的旧设计逻辑**：`isPledged` 两分法——用户添加修学时提示「是否发愿」；法会愿进度走 `EventCount` 独立计数流。
>
> **去掉的旧设计字段**：`source`、`classId`（旧任务锚点）、`templateId`（旧模板锚点）、7 态 VowStatus 状态机（source=auto 专属，本表已用 context 区分）、`currentStatus/statusCalculatedAt/statusNote`、`paceHistory`（过度设计）、`appointmentId`（约修 ⏸ 暂缓）。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `userId` | String | 关联 User | 旧 |
| `context` | String | `personal` / `event` / `class_task` / `program_task`（见下方说明）| 旧（扩展）|
| `eventId` | String? | context=event 时关联 Event | 旧 |
| `classTaskId` | String? | context=class_task 时关联 ClassTask | **新增** |
| `cohortTemplateId` | String? | context=program_task 时关联 CohortRecommendedTemplate | **新增** |
| `practiceProjectId` | String | 修持项目 | 旧 |
| `customName` | String? | 自定义显示名（personal 时用户可填）| 旧 |
| `isPledged` | Boolean | 默认 false；**true=发愿/任务**（有目标+进度条）/ **false=裸追踪项**（无目标，仅打卡入口）；class_task/program_task 恒为 true | 旧（**补回**）|
| `targetCount` | Int? | 总目标遍数（lifetime 型）；task 类型不填（运行时从任务读）| 旧 |
| `targetPeriod` | String? | `daily` / `weekly` / `lifetime`；task 类型不填 | 旧 |
| `dailyTarget` | Int? | 每日目标；**personal/event 由用户填；task 类型不填（运行时从 ClassTask 或 PracticeTemplate 读，D3）** | 旧（语义扩展）|
| `weeklyTarget` | Int? | 每周目标；task 类型不填 | 旧 |
| `minSessionMinutes` | Int | 座次最短时长，默认 30；duration 计量专用 | 旧 |
| `startDate` | DateTime | 发愿起始日 | 旧 |
| `currentEndDate` | DateTime? | 发愿截止日（可调整）| 旧 |
| `currentCount` | Int | 累计遍数/次数，默认 0（乐观计入）| 旧 |
| `currentSessionCount` | Decimal | 累计座次，默认 0 | 旧 |
| `status` | String | `active` / `paused` / `completed` / `abandoned`；默认 active | 旧（简化：去 7 态）|
| `pausedAt` | DateTime? | 暂停时间 | 旧 |
| `pausedBy` | String? | 暂停操作人 userId | 旧 |
| `resumedAt` | DateTime? | 恢复时间 | 旧 |
| `completedAt` | DateTime? | 完成时间 | 旧 |
| `createdAt` | DateTime | 默认 now() | 旧 |
| `updatedAt` | DateTime | @updatedAt | 旧 |

```prisma
model UserPracticeVow {
  id                   String    @id @default(cuid())
  userId               String
  // context 5 值：
  //   personal     → 用户手动添加（发愿或裸追踪）
  //   event        → 法会发愿（关联 eventId）
  //   class_task   → 班级任务（关联 classTaskId，系统自动建）
  //   program_task → 课程任务（关联 cohortTemplateId，系统自动建）
  context              String
  eventId              String?   // context=event
  classTaskId          String?   // context=class_task
  cohortTemplateId     String?   // context=program_task
  practiceProjectId    String
  customName           String?
  isPledged            Boolean   @default(false)
  // true  = 发愿/任务：有目标 + 进度条；class_task/program_task 恒为 true
  // false = 裸追踪项：无目标，仅作打卡快捷入口
  // 裸追踪项不可补发愿；要发愿须新建 isPledged=true 的愿
  // task 类型的 dailyTarget/targetPeriod 不存此处，运行时从任务定义读取（D3）
  targetCount          Int?
  targetPeriod         String?   // daily / weekly / lifetime
  dailyTarget          Int?      // personal/event 用；task 类型为 null
  weeklyTarget         Int?      // personal/event 用；task 类型为 null
  minSessionMinutes    Int       @default(30)
  startDate            DateTime
  currentEndDate       DateTime?
  currentCount         Int       @default(0)
  currentSessionCount  Decimal   @default(0)
  status               String    @default("active")
  pausedAt             DateTime?
  pausedBy             String?
  resumedAt            DateTime?
  completedAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user            User                      @relation(fields: [userId], references: [id])
  event           Event?                    @relation(fields: [eventId], references: [id])
  classTask       ClassTask?                @relation(fields: [classTaskId], references: [id])
  cohortTemplate  CohortRecommendedTemplate? @relation(fields: [cohortTemplateId], references: [id])
  logs            PracticeLog[]             // context≠event 的打卡来源
  eventCounts     EventCount[]              // context=event 打卡来源（独立计数流）
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 不物理删除（D18）| 应用层 | 记录永久保留；放弃走 status='abandoned' |
| context=event 时 eventId 必填 | 应用层（Zod）| |
| context=class_task 时 classTaskId 必填 | 应用层（Zod）| |
| context=program_task 时 cohortTemplateId 必填 | 应用层（Zod）| |
| isPledged=false 时 target 字段全 null | 应用层（Zod）| 裸追踪项无目标 |
| class_task / program_task 的 isPledged 恒为 true | 应用层 | 任务天然有目标，不允许裸追踪 |
| task 类型 dailyTarget/targetPeriod 为 null | 应用层 | 目标运行时从 ClassTask 或 PracticeTemplate 读（D3）|
| context=event 愿进度 = SUM(EventCount.count WHERE vowId=:id) | 应用层 | 不走 PracticeLog；发愿前的 EventCount（vowId=null）不回溯 |
| 裸追踪项不可补发愿 | 应用层 | 要发愿须新建 isPledged=true 的愿，历史打卡不追溯 |
| 幂等保护（自动建条目）| 应用层 | 同 userId + classTaskId / cohortTemplateId 已存在则跳过，不重复建 |
| **外部事件不触发 vow 状态变化** | 应用层 | ClassTask 停用、退班、毕业、法会结束——均不改变 UserPracticeVow.status；vow 按用户设定的 currentEndDate 自然到期 |
| auto 建条目的 currentEndDate 初始值 | 应用层 | class_task 继承 ClassTask.endDate（如有，否则 null）；program_task 继承 PracticeTemplate.durationDays 计算值（如有，否则 null）；用户可随时调整 |

#### 设计意图

**打卡入口统一在修学计数模块**：5 种 context 的条目全在同一列表。应用层按 context 分流写表（event → EventCount；其余 → PracticeLog），用户无感知。

**任务目标运行时读取（D3）**：class_task / program_task 的 dailyTarget 不写入此表，每次展示/达标计算时 join ClassTask.dailyTarget 或 PracticeTemplate.defaultDailyTarget。辅导员/管理员修改任务标准后全员实时生效，无需批量同步。

**自动建条目时机**：
- class_task：ClassTask 新建时为班内所有 active 成员建；新成员入班时为所有 active ClassTask 建
- program_task：成员入班时为该专业所有 binding=auto 的 CohortRecommendedTemplate 建

**Vow 生命周期自治（用户决策 2026-05-29）**：任何外部事件均不自动改变 vow 状态。法会结束后法会发愿继续计数；ClassTask 停用后班级任务愿继续；退班/毕业后任务愿继续——一律按用户发愿时设定的 currentEndDate 自然到期。auto 建条目的 currentEndDate 初始值由任务定义预填（用户可调整）。

**列表类别标签**（前端展示，5 值）：

| 标签 | 条件 |
|---|---|
| 普通计数 | isPledged=false |
| 个人发愿 | isPledged=true, context=personal |
| 法会发愿 | isPledged=true, context=event（附带法会名）|
| 班级任务 | context=class_task |
| 课程任务 | context=program_task |

---

### 1.8 CohortRecommendedTemplate（班级模板绑定）✅ 已封板

**服务能力**：能力 9（报数）—— 课程自带任务的专业级配置
**写权限**：`subject_admin` 及以上（专业级绑定）；`class_admin` 及以上（班级追加绑定）
**参考决策**：D3（任务配置数据驱动）

> **从 §四 复用区移入扩展区**：旧设计持 `classId`（每班手动绑），核对能力 9「课程自带任务来自教学大纲（专业级）」后改为持 `programId`（所有该专业班级自动继承）。班级额外追加仍保留 `classId`——两个可空外键，至少填其一。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `programId` | String? | 专业级绑定（课程自带任务，所有该专业班级继承）| **改** |
| `classId` | String? | 班级追加绑定（辅导员手动追加，仅本班）| 旧（语义限定）|
| `templateId` | String | 关联 PracticeTemplate | 旧 |
| `binding` | String | `auto`（入班即生效）/ `recommended`（推荐不强制）；默认 `auto` | 旧 |
| `displayOrder` | Int | 排序，默认 0 | 旧 |

```prisma
model CohortRecommendedTemplate {
  id           String   @id @default(cuid())
  programId    String?  // 专业级；programId/classId 至少一个非空
  classId      String?  // 班级追加级
  templateId   String
  binding      String   @default("auto")
  displayOrder Int      @default(0)

  program  Program?         @relation(fields: [programId], references: [id])
  class    Class?           @relation(fields: [classId], references: [id])
  template PracticeTemplate @relation(fields: [templateId], references: [id])
  vows     UserPracticeVow[] // context=program_task 的用户追踪条目

  @@unique([programId, templateId])
  @@unique([classId, templateId])
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([programId, templateId])` | DB | 同专业同模板唯一 |
| `@@unique([classId, templateId])` | DB | 同班级同模板唯一 |
| programId / classId 至少一个非空 | 应用层（Zod）| 防止孤儿绑定 |

---

## 二、🔄 替换表（3 张）

按新设计逻辑重写，旧表仅作字段命名参考。

---

### 2.1 UserRoleAssignment（替代 ClassAdmin）✅ 已封板

**服务能力**：能力 18（角色与权限）
**写权限**：角色分配链——super_admin 任命 subject_admin；subject_admin/super_admin 任命 class_admin；class_admin 及以上任命 class_tutor；D20：初始 super_admin 由系统 seed 脚本生成
**参考决策**：D6（4 角色）、D7（扁平继承）、D8（多角色+作用域）、D18（不物理删除）、D20（super_admin seed）

> **替代旧 ClassAdmin**：旧设计用 8 个 Boolean flag 实现细粒度权限（canManageMembers/canManageExams/canViewStudents/canCareFollowup/canEditGoals/canManageCourse/canEdit/canDelete）。新设计改用 4 层级角色 + 作用域绑定（D8），权限由角色继承关系决定，不需要 flag。flag 对应关系见 §八 DR-39。
>
> **canEditGoals 处理**：不作为独立 flag——辅导员调整学员目标属「代行操作」，走能力 5（class_admin 及以上，AuditLog 留痕），见 DR-40。
>
> **后端现状**：ClassAdmin 和所有 Boolean flag **从未实现**；后端目前用 User.role(admin/coach/student) + ClassMember.role。本表是全新实现，不涉及迁移破坏。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `userId` | String | 被授权人 |
| `role` | String | `class_tutor`(1) / `class_admin`(2) / `subject_admin`(3) / `super_admin`(99) |
| `classId` | String? | 班级作用域（class_tutor / class_admin 必填）|
| `programId` | String? | 专业作用域（subject_admin 必填）|
| `status` | String | `active` / `revoked`，默认 active |
| `assignedAt` | DateTime | 默认 now() |
| `assignedBy` | String | 操作人 userId；seed 建时填 `system` |
| `revokedAt` | DateTime? | 撤销时间 |
| `revokedBy` | String? | 撤销人 userId |
| `revokedReason` | String? | 撤销原因 |

```prisma
model UserRoleAssignment {
  id            String    @id @default(cuid())
  userId        String
  role          String    // class_tutor / class_admin / subject_admin / super_admin
  classId       String?   // class_tutor / class_admin 的作用域
  programId     String?   // subject_admin 的作用域
  // super_admin: classId=null, programId=null（全局作用域）
  status        String    @default("active")  // active / revoked
  assignedAt    DateTime  @default(now())
  assignedBy    String    // 操作人 userId；seed 建时填 "system"
  revokedAt     DateTime?
  revokedBy     String?
  revokedReason String?

  user    User     @relation(fields: [userId], references: [id])
  class   Class?   @relation(fields: [classId], references: [id])
  program Program? @relation(fields: [programId], references: [id])
  history RoleAssignmentHistory[]

  @@unique([userId, role, classId, programId])
  @@index([userId])
  @@index([classId])
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([userId, role, classId, programId])` | DB | 同一人同一角色同一作用域唯一 |
| super_admin 防重 | 应用层 | PostgreSQL NULL≠NULL 导致 DB unique 对 super_admin（两列均 null）不生效；应用层额外保证同 userId 只有一条 active super_admin |
| class_tutor / class_admin → classId 必填 | 应用层（Zod）| 班级角色必须绑定班级作用域 |
| subject_admin → programId 必填 | 应用层（Zod）| 学科角色必须绑定专业作用域 |
| super_admin → classId / programId 均为 null | 应用层（Zod）| 全局角色无作用域 |
| 角色分配链 | 应用层 | 02 文档 §五；不允许越级任命 |
| 撤销走 status='revoked'，不物理删除（D18）| 应用层 | 历史记录永久保留 |

#### 设计意图

每条记录 = 「某人在某作用域持有某角色」。一人可多角色（D8），如同时是班 A 的 class_tutor 和班 B 的 class_admin。鉴权时：取 userId 的全部 active 记录，按 classId/programId 过滤当前作用域，最高角色级别决定权限（D7 扁平继承）。变更历史走 RoleAssignmentHistory（§3.2），重要操作走 AuditLog（§3.11，能力 20 审计日志）。

### 2.2 CareFollowupRecord（替代 CareFollowup）✅ 已封板

**服务能力**：能力 14（学员关怀清单）+ 能力 12（特殊身份学员跟进，共用，`sourceType` 字段区分）
**写权限**：`class_admin` 及以上（职能 #3 W）；`class_tutor` 只读（职能 #3 R）；学员不可见
**参考决策**：D15（退出后历史可查）、D17（代行留痕）、D18（不物理删除）

> **替代旧 CareFollowup**：旧设计权限守卫是 `ClassAdmin.canCareFollowup` Boolean flag；新设计改为 role-based（职能 #3，class_admin W / class_tutor R），flag 废弃（已随 ClassAdmin 整体废弃，见 DR-39）。
>
> **双能力共用**：能力 14（关怀清单触发）与能力 12（特殊身份跟进）的跟进备注走同一张表，`sourceType` 字段区分来源，见 DR-42。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `studentId` | String | 被关怀学员 userId | 旧 |
| `classId` | String | 班级作用域 | 旧 |
| `careWorkerId` | String | 填写人 userId（辅导员/admin）| 旧 |
| `sourceType` | String | `care_watchlist`（能力14 触发）/ `special_status`（能力12 特殊身份）| **新增** |
| `watchlistItemId` | String? | source=care_watchlist 时关联 §3.4 CareWatchlistItem | **新增** |
| `contactedAt` | DateTime | 实际联系/跟进时间 | 旧 |
| `summary` | String | 跟进内容备注（内部工作日志）| 旧 |
| `followUpStatus` | String | `pending` / `resolved` / `escalated`，默认 pending | 旧 |
| `lagSnapshotAtContact` | Json? | 跟进时学员掉队状态快照（从 CohortLagSnapshot 拷贝定格）；special_status 来源时 null | 旧（nullable 语义扩展）|
| `createdAt` | DateTime | 默认 now() | 旧 |

```prisma
model CareFollowupRecord {
  id                   String   @id @default(cuid())
  studentId            String
  classId              String
  careWorkerId         String
  sourceType           String   // care_watchlist / special_status
  watchlistItemId      String?  // source=care_watchlist 时关联 CareWatchlistItem
  contactedAt          DateTime
  summary              String   // 内部工作日志，学员不可见
  followUpStatus       String   @default("pending")  // pending / resolved / escalated
  lagSnapshotAtContact Json?    // 跟进时掉队快照；special_status 来源时 null
  createdAt            DateTime @default(now())

  student       User               @relation("CareStudent",  fields: [studentId],  references: [id])
  careWorker    User               @relation("CareWorker",   fields: [careWorkerId], references: [id])
  class         Class              @relation(fields: [classId], references: [id])
  watchlistItem CareWatchlistItem? @relation(fields: [watchlistItemId], references: [id])

  @@index([studentId, classId])
  @@index([watchlistItemId])
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| sourceType 枚举校验 | 应用层（Zod）| 只允许 care_watchlist / special_status |
| care_watchlist → watchlistItemId 必填 | 应用层（Zod）| 关怀清单记录必须关联来源条目 |
| 学员不可见 | 应用层 | 无面向学员端的 API 路由 |
| 无物理删除（D18）| 应用层 | 备注永久留档，无 delete API |

#### 设计意图

每条记录 = 「某辅导员在某时间对某学员做了一次跟进，并留下备注」。`lagSnapshotAtContact` 是跟进发生时从 CohortLagSnapshot 拷贝定格的快照——历史数据，事后掉队状态变化不影响此记录（与旧设计一致）。`sourceType` 让能力 14（关怀清单）和能力 12（特殊身份）的跟进记录统一列表展示，查询时按 `sourceType` 过滤，无需拆两张表。

### 2.3 TransmissionRecord（整合 TantricAccessGrant）✅ 已封板

**服务能力**：能力 15（传承管理）+ 能力 17（灌顶记录）
**写权限**：`auto`=系统触发；`self_report`=学员自报；`admin_entry`=`class_tutor`及以上代录；固定清单认定（`isRequired=true`）需 `class_admin` 及以上确认
**参考决策**：D3（传承清单数据化）、D13（灌顶是升密法硬条件）、D17（代行留痕）、D18（不物理删除）

> **整合旧 TantricAccessGrant**：旧表只做密法访问控制（grantedAt+grantedBy，按 TantricGroup 授权）。新表记录完整传承历史，灌顶记录（sourceType=empowerment）天然承担密法授权职责，旧表废弃，见 DR-44。密法访问控制查询改为：该用户是否有 status=active 且 tantricGroupId 匹配的 TransmissionRecord？

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | — |
| `userId` | String | 接受传承的学员 | — |
| `sourceType` | String | `course`（课程圆满触发）/ `dharma_event`（法会）/ `empowerment`（灌顶）| **新建** |
| `transmissionKey` | String? | 固定清单传承的键，对应 `ProgramAdvancementConfig.conditionKey`（conditionType='transmission'）；额外传承时 null | **新建** |
| `name` | String | 传承/灌顶名称（free text）| **新建** |
| `tantricGroupId` | String? | sourceType=empowerment 时关联 TantricGroup；密法访问授权依据 | 旧（整合自 TantricAccessGrant.tantricGroupId）|
| `courseId` | String? | sourceType=course 时，触发的课程 id | **新建** |
| `receivedAt` | DateTime | 接受传承的实际日期 | — |
| `masterName` | String? | 传授上师姓名（法会/灌顶时填写，非系统账号，free text）| — |
| `entryMethod` | String | `auto`（系统）/ `self_report`（学员申报）/ `admin_entry`（代录）| **新建** |
| `entryBy` | String | 录入人 userId；auto 时填 `"system"` | 旧（整合自 TantricAccessGrant.grantedBy）|
| `isRequired` | Boolean | 是否已认定为固定清单传承（可计入升学预检）；默认 false；auto 条目按配置自动判定 | **新建** |
| `isConfirmed` | Boolean | 管理员是否确认申报有效；默认 false；auto 条目默认 true | **新建** |
| `confirmedBy` | String? | 确认人 userId | **新建** |
| `confirmedAt` | DateTime? | 确认时间 | **新建** |
| `status` | String | `active` / `revoked`，默认 active | **新建** |
| `revokedAt` | DateTime? | 撤销时间 | **新建** |
| `revokedBy` | String? | 撤销人 userId | **新建** |
| `revokedReason` | String? | 撤销原因 | **新建** |
| `createdAt` | DateTime | 默认 now() | — |

```prisma
model TransmissionRecord {
  id              String    @id @default(cuid())
  userId          String
  sourceType      String    // course / dharma_event / empowerment
  transmissionKey String?   // 固定清单键（对应 ProgramAdvancementConfig.conditionKey）
  name            String
  tantricGroupId  String?   // empowerment 时必填；密法访问授权依据
  courseId        String?   // course 时填写
  receivedAt      DateTime
  masterName      String?
  entryMethod     String    // auto / self_report / admin_entry
  entryBy         String    // userId 或 "system"
  isRequired      Boolean   @default(false)
  isConfirmed     Boolean   @default(false)
  confirmedBy     String?
  confirmedAt     DateTime?
  status          String    @default("active")  // active / revoked
  revokedAt       DateTime?
  revokedBy       String?
  revokedReason   String?
  createdAt       DateTime  @default(now())

  user         User          @relation(fields: [userId], references: [id])
  tantricGroup TantricGroup? @relation(fields: [tantricGroupId], references: [id])

  @@index([userId])
  @@index([userId, tantricGroupId])
  @@index([userId, transmissionKey])
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| sourceType 枚举校验 | 应用层（Zod）| course / dharma_event / empowerment |
| entryMethod 枚举校验 | 应用层（Zod）| auto / self_report / admin_entry |
| sourceType=empowerment → tantricGroupId 必填 | 应用层（Zod）| 灌顶必须关联传承组（密法授权依据）|
| isRequired=true → transmissionKey 必填 | 应用层（Zod）| 固定清单认定必须有键（升学预检比对用）|
| auto 条目 isConfirmed 默认 true | 应用层 | 课程触发无需管理员二次确认 |
| 密法访问控制 | 应用层 | 查 TransmissionRecord where userId=X AND tantricGroupId=Y AND status=active，替代旧 TantricAccessGrant |
| 撤销走 status=revoked，无物理删除（D18）| 应用层 | 传承记录永久留档 |
| ❌ 不加 @@unique([userId, tantricGroupId]) | — | 同一人可多次接受同组传承（重复录入不应报错）；访问控制改 EXISTS 查询，见 DR-45 |

#### 设计意图

三种来源（课程/法会/灌顶）统一存入一张表，`sourceType` 区分。升学预检（能力 10 conditionType='transmission'）遍历 `ProgramAdvancementConfig` 的传承条件，对每条 `conditionKey` 检查该用户是否有 `transmissionKey=conditionKey AND isRequired=true AND status=active` 的记录。手动录入（学员申报/辅导员代录）默认 `isRequired=false`，admin 审核后置 `isRequired=true`+`confirmedBy`（能力 15 规则 5「升格需管理员确认」）。灌顶记录（`sourceType=empowerment`）同时作为 TantricGroup 密法访问的授权来源（DR-44）。

---

## 三、➕ 新建表（14 张）

按新业务能力从头设计。

> 注：ProgramAdvancementConfig 为核对能力 10 时新增（升学条件数据化，存法二）；EnrollmentStatusHistory 为核对能力 11 时新增（入学状态变更永久留痕，D18）；ClassSessionSchedule 为核对能力 8 时新增（课表模板层，双轨发起）；ClassTask 为核对能力 9 时新增（辅导员布置班级任务，独立于发愿系统）。新建区由 12 张逐步扩展至 16 张；UserRoleAssignment（移入 §二 2.1）和 TransmissionRecord（移入 §二 2.3）从新建区迁出后，最终定为 14 张。

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

### 3.2 RoleAssignmentHistory（角色变更留痕）⬜ 未开始

### 3.3 StudentSpecialStatus（特殊身份）⬜ 未开始

### 3.4 CareWatchlistItem（关怀清单条目）⬜ 未开始

### 3.5 ClassInviteCode（邀请码）⬜ 未开始

### 3.6 AssistantAssignment（辅助员配对）⬜ 未开始

### 3.7 SemesterSnapshot（报数快照）⬜ 未开始

### 3.8 ReportConfession（虚报忏悔记录）⬜ 未开始

### 3.9 AdvancementCheck（升学资格预检报告）⬜ 未开始

### 3.10 AdvancementRecord（升学记录）⬜ 未开始

### 3.11 AuditLog（审计日志）⬜ 未开始

### 3.12 EnrollmentStatusHistory（入学状态变更留痕）✅ 已确认

### 3.13 ClassSessionSchedule（共修课表模板）✅ 已封板

**服务能力**：能力 8（共修与出勤）—— 课表预排主轨
**写权限**：辅导员及以上（本班）；平台级（classId=null）限 super_admin
**参考决策**：D3（时效/门槛数据化）、D18（课表历史不删除）

课表模板定义「每周几、几点、几分钟」的循环规则，系统按规则自动生成 ClassSession 实例并激活签到链接。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `classId` | String? | null=平台级；有值=班级级 |
| `title` | String | 课表名称，如「加行班周三晚共修」 |
| `sessionType` | String | `online` / `offline` / `self_study`，默认 `online` |
| `lessonId` | String? | 可选关联课时（整学期固定课时时填）|
| `durationMin` | Int | 每次时长分钟，默认 60 |
| `recurrenceRule` | Json | 循环规则，如 `{dayOfWeek:3, hour:20, minute:0}`（每周三 20:00）|
| `startDate` | DateTime | 课表生效日期 |
| `endDate` | DateTime? | 课表结束日期；null = 无限期 |
| `isActive` | Boolean | 默认 true；false = 停用不再生成新场次 |
| `createdBy` | String | 操作人 userId |
| `createdAt` | DateTime | 默认 now() |
| `updatedAt` | DateTime | @updatedAt |

```prisma
model ClassSessionSchedule {
  id             String    @id @default(cuid())
  classId        String?
  title          String
  sessionType    String    @default("online")
  lessonId       String?
  durationMin    Int       @default(60)
  recurrenceRule Json      // {dayOfWeek, hour, minute}
  startDate      DateTime
  endDate        DateTime?
  isActive       Boolean   @default(true)
  createdBy      String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  class     Class?          @relation(fields: [classId], references: [id])
  instances ClassSession[]
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 停用走 `isActive=false`，不物理删除（D18）| 应用层 | 历史生成的 ClassSession 实例完整保留 |
| 修改课表不影响已有 ClassSession | 应用层 | 改模板只影响未来新生成实例 |

---

### 3.14 ClassTask（班级任务）✅ 已封板

**服务能力**：能力 9（报数）—— 辅导员布置的班级级修持任务
**写权限**：`class_tutor` 及以上（本班）；平台级任务（课程自带由 CohortRecommendedTemplate 配置）
**参考决策**：D3（任务配置数据驱动）、D18（任务记录不删除）

> **设计背景（用户决策 2026-05-29）**：班级任务与发愿是两个不同业务概念，不合并入 UserPracticeVow。班级任务分两种来源：(1) **课程自带任务**——由 CohortRecommendedTemplate 专业级绑定（`programId`），所有同专业班级自动继承；(2) **辅导员追加任务**——由本表（ClassTask）存储，辅导员主动布置给班级。两种任务的完成情况均走 PracticeLog，达标率用于 CohortLagSnapshot.taskLag 计算。
>
> **达标率定义**（用户决策）：`每日达标天数 / 任务总有效天数`（每日 dailyTarget 次为达标）。每班 5-10 个任务。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `classId` | String | 关联班级（任务作用范围为整班）|
| `practiceProjectId` | String | 修持哪个项目（关联 PracticeProject）|
| `title` | String? | 自定义标题；null 时用 PracticeProject.name 显示 |
| `dailyTarget` | Int | 每日目标次数（达到此数即为当日达标）|
| `startDate` | DateTime | 任务起始日 |
| `endDate` | DateTime? | 任务截止日；null=无限期 |
| `isActive` | Boolean | 默认 true；false=停用（历史 PracticeLog 保留）|
| `createdBy` | String | 创建人 userId（辅导员）|
| `createdAt` | DateTime | 默认 now() |

```prisma
model ClassTask {
  id                String    @id @default(cuid())
  classId           String
  practiceProjectId String
  title             String?
  dailyTarget       Int
  startDate         DateTime
  endDate           DateTime?
  isActive          Boolean   @default(true)
  createdBy         String
  createdAt         DateTime  @default(now())

  class           Class           @relation(fields: [classId], references: [id])
  practiceProject PracticeProject @relation(fields: [practiceProjectId], references: [id])
  vows            UserPracticeVow[] // context=class_task 的用户追踪条目
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 停用走 `isActive=false`，不物理删除（D18）| 应用层 | 历史 PracticeLog 打卡记录完整保留 |
| 每班上限 5-10 个并发任务 | 应用层（软限制）| 防止任务过多，isActive=true 行数检查 |
| 写权限限本班辅导员及以上 | 应用层 | 不允许跨班操作 |

#### 设计意图

ClassTask 只存「任务定义」。每位班级成员有一条对应的 UserPracticeVow（context=class_task），打卡走 PracticeLog，进度展示时 join ClassTask.dailyTarget（不复制，D3 实时生效）。达标率影响 CohortLagSnapshot.taskLag（能力 14）。课程自带任务（CohortRecommendedTemplate）同理，两条路径对学员端完全一致。

---

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

与 RoleAssignmentHistory（§3.2）对称：角色变更留痕 vs 入学状态变更留痕。学员端可直接查自己的 `memberId` 历史满足 D15，无需从面向管理员的 AuditLog（§3.11）里捞。反向关联 `member ClassMember` 与 ClassMember 的 `statusHistory EnrollmentStatusHistory[]` 成对（一致性检查项 1）。

---

## 四、✅ 复用表（直接沿用旧设计）

> 以下表从旧设计直接复用，字段不改，仅确认无遗漏。待步骤 1d 快速过完后补充字段列表。

| 表 | 服务能力 | 状态 |
|---|---|---|
| `ProgramSemester`（科目/学期，字段够用，详见下）| 能力 1 | ✅ 确认复用 |
| `PracticeLog` | 能力 4/6/7 | ⬜ |
| `PracticeTemplate` | 能力 4/6/7 | ⬜ |
| ~~`CohortRecommendedTemplate`~~ | 已移入扩展区 §1.8 | ✅ |
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
| `SpeakingSession` | 能力 10 | ✅ 复用（classId 已可空，见下方说明）|
| `SpeakingRegistration` | 能力 10 | ⬜ |
| ~~`Exam`~~ | 已移入扩展区 §1.4 | ✅ |
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

#### SpeakingSession 复用说明

旧设计 migration_009 已将 `classId` 改为可空（`String?`），明确注释：`// classId=null → 平台级讲考；classId 有值 → 班级讲考`。字段已完整（id/classId/startAt/sessionEndAt/checkInToken/title/lessonId/createdBy 等），新设计**照搬不改**。

权限说明（新角色体系下）：
- 平台级（classId=null）：仅 `subject_admin` / `super_admin` 可创建
- 班级级（classId 有值）：`class_tutor` 及以上可创建（本班）
- 评分：班级级 → `class_tutor` 及以上；平台级 → `subject_admin` / `super_admin`（SpeakingGrade.classId=null，见 §1.4 DR-48）

---

## 五、⏸ 暂缓表（设计已落实，实现延后）

> 本区表示「设计已定稿、实现待排期」。每个功能已完整设计，可直接用于 Prisma schema，但不在当前迭代实现。

| 状态 | 家族 | 表数 |
|---|---|---|
| ✅ 设计封板 | §5.1 班级动态（ClassPost 家族） | 4 张 |
| ✅ 设计封板 | §5.2 班级讨论（Discussion 家族） | 4 张 |
| ⬜ 待讨论 | §5.3 约修（PracticeAppointment） | 1 张 |
| ⬜ 待讨论 | §5.4 自学模式（UserSelfStudyProgram 家族） | 2 张 |

---

### 5.1 班级动态（ClassPost 家族）✅ 设计封板

**⏸ 暂缓**：当前迭代不实现；以下设计可直接用于写 Prisma schema。

**服务能力**：班级动态互动（发帖/评论/反应/转发），06 文档未列入 20 条能力；⚠️ 实现时需在 06 文档补入对应能力编号及职能矩阵条目。
**写权限**：
- 发帖：班级 active 成员（`ClassMember.classId` 内，`cohortStatus=active`）
- 删帖：发帖人自己（`authorId == session.userId`）**或** `class_admin` 及以上（同班，按 UserRoleAssignment）
- 评论：班级 active 成员
- 删评论：评论人自己（`authorId == session.userId`）**或** `class_admin` 及以上
- 点赞（Reaction）：班级成员 toggle（`@@unique([postId, userId])` 防重；取消点赞走物理删行，参见 DR-50）
- 转发记录（Share）：班级成员；仅记录，不物理删
**参考决策**：D18（帖子/评论不物理删除）、DR-50~52

#### ClassPost（班级帖子）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `classId` | String | 关联 Class |
| `authorId` | String | 关联 User（发帖人）|
| `content` | String | 帖子正文 |
| `sharedFromId` | String? | 站内转发来源 postId（转发帖时填，原创为 null）|
| `isDeleted` | Boolean | 软删除标记，默认 false；D18 不物理删 |
| `deletedBy` | String? | 删除操作人 userId（可为 authorId 自删或 class_admin+）|
| `deletedAt` | DateTime? | 删除时间 |
| `createdAt` | DateTime | 默认 now() |
| `updatedAt` | DateTime | @updatedAt |

```prisma
model ClassPost {
  id           String    @id @default(cuid())
  classId      String
  authorId     String
  content      String
  sharedFromId String?   // 站内转发来源 postId；原创为 null
  isDeleted    Boolean   @default(false)
  deletedBy    String?   // 可为 authorId（自删）或 class_admin+
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  class      Class               @relation(fields: [classId], references: [id])
  author     User                @relation(fields: [authorId], references: [id])
  sharedFrom ClassPost?          @relation("PostShares", fields: [sharedFromId], references: [id])
  reshares   ClassPost[]         @relation("PostShares")
  reactions  ClassPostReaction[]
  comments   ClassPostComment[]
  shares     ClassPostShare[]
}
```

#### ClassPostReaction（点赞）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `postId` | String | 关联 ClassPost |
| `userId` | String | 关联 User |
| `createdAt` | DateTime | 默认 now() |

```prisma
model ClassPostReaction {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post ClassPost @relation(fields: [postId], references: [id])
  user User      @relation(fields: [userId], references: [id])

  @@unique([postId, userId])  // 每人每帖只能点赞一次；取消点赞物理删行（DR-50）
}
```

#### ClassPostComment（评论）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `postId` | String | 关联 ClassPost |
| `authorId` | String | 关联 User（评论人）|
| `content` | String | 评论正文 |
| `isDeleted` | Boolean | 软删除标记，默认 false；D18 不物理删 |
| `deletedBy` | String? | 删除操作人（可为 authorId 自删或 class_admin+）|
| `deletedAt` | DateTime? | 删除时间 |
| `createdAt` | DateTime | 默认 now() |

```prisma
model ClassPostComment {
  id        String    @id @default(cuid())
  postId    String
  authorId  String
  content   String
  isDeleted Boolean   @default(false)
  deletedBy String?   // 可为 authorId（自删）或 class_admin+
  deletedAt DateTime?
  createdAt DateTime  @default(now())

  post   ClassPost @relation(fields: [postId], references: [id])
  author User      @relation(fields: [authorId], references: [id])
}
```

#### ClassPostShare（转发记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `postId` | String | 关联 ClassPost |
| `userId` | String | 关联 User（转发人）|
| `createdAt` | DateTime | 默认 now() |

```prisma
model ClassPostShare {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post ClassPost @relation(fields: [postId], references: [id])
  user User      @relation(fields: [userId], references: [id])
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 删帖权限双路：`authorId == session.userId` OR `class_admin`+ | 应用层 | DB 无法表达「OR 条件身份判断」，须在 API 中间件校验 |
| 删评权限双路：同上（评论人自删 OR class_admin+）| 应用层 | 同上 |
| 软删：`isDeleted=true` + `deletedBy` + `deletedAt`（ClassPost、ClassPostComment）| 应用层+DB | 无 delete API；`isDeleted=true` 前端隐藏但 DB 保留（D18）|
| Reaction 点赞防重 | DB（@@unique）| 物理删行用于「取消点赞」，非历史性操作（DR-50）|
| Share 不物理删 | 应用层 | 转发记录视为历史事件，不提供删除接口 |
| 内容仅在本班可见 | 应用层 | ClassPost.classId 强制按班级过滤；跨班不可见 |

---

### 5.2 班级讨论（Discussion 家族）✅ 设计封板

**⏸ 暂缓**：当前迭代不实现；以下设计可直接用于写 Prisma schema。

**服务能力**：班级话题讨论与投票，06 文档未列入 20 条能力；⚠️ 实现时需在 06 文档补入对应能力编号及职能矩阵条目。
**写权限**：
- 创建 Discussion：`class_tutor` 及以上（所有后台角色，含 `subject_admin` / `super_admin`）
- 添加 DiscussionViewpoint：随 Discussion 创建时一并写入，**不允许事后增删**（防止已投票后改选项）
- 投票（DiscussionVote）：班级 active 成员（限 `status=open` 话题；一人一票，**不允许换投**，DR-53）
- 评论（DiscussionComment）：班级 active 成员（限 `status=open` 话题）
- 关闭话题（`open→closed`）：发起人自己（`authorId == session.userId`）**或** `class_admin` 及以上
- 删评论：评论人自己（`authorId == session.userId`）**或** `class_admin` 及以上
**参考决策**：D18（投票/评论不物理删除）、DR-53~56

#### Discussion（班级讨论话题）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `classId` | String | 关联 Class |
| `authorId` | String | 发起人 userId（`class_tutor` 及以上）|
| `title` | String | 话题标题 |
| `description` | String? | 话题说明 |
| `lessonId` | String? | 可选关联课时 |
| `courseId` | String? | 可选关联法本 |
| `status` | String | `open`（进行中）/ `closed`（已关闭），默认 `open` |
| `closedAt` | DateTime? | 关闭时间 |
| `closedBy` | String? | 关闭操作人 userId |
| `createdAt` | DateTime | 默认 now() |
| `updatedAt` | DateTime | @updatedAt |

```prisma
model Discussion {
  id          String    @id @default(cuid())
  classId     String
  authorId    String    // class_tutor 及以上（所有后台角色）
  title       String
  description String?
  lessonId    String?
  courseId    String?
  status      String    @default("open")  // open / closed
  closedAt    DateTime?
  closedBy    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  class      Class                 @relation(fields: [classId], references: [id])
  author     User                  @relation(fields: [authorId], references: [id])
  lesson     Lesson?               @relation(fields: [lessonId], references: [id])
  course     Course?               @relation(fields: [courseId], references: [id])
  viewpoints DiscussionViewpoint[]
  votes      DiscussionVote[]
  comments   DiscussionComment[]
}
```

#### DiscussionViewpoint（投票选项）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `discussionId` | String | 关联 Discussion |
| `content` | String | 选项文本 |
| `sortOrder` | Int | 排序，默认 0 |
| `createdAt` | DateTime | 默认 now() |

```prisma
model DiscussionViewpoint {
  id           String   @id @default(cuid())
  discussionId String
  content      String
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())

  discussion Discussion      @relation(fields: [discussionId], references: [id])
  votes      DiscussionVote[]
}
```

#### DiscussionVote（投票记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `discussionId` | String | 冗余存储（方便查「我在本话题投了哪个观点」）|
| `viewpointId` | String | 关联 DiscussionViewpoint |
| `userId` | String | 关联 User |
| `createdAt` | DateTime | 默认 now() |

```prisma
model DiscussionVote {
  id           String   @id @default(cuid())
  discussionId String   // 冗余，方便按话题查当前用户投票
  viewpointId  String
  userId       String
  createdAt    DateTime @default(now())

  viewpoint  DiscussionViewpoint @relation(fields: [viewpointId], references: [id])
  user       User                @relation(fields: [userId], references: [id])

  @@unique([discussionId, userId])  // 一人一票；不允许换投，无物理删行，D18 完全合规（DR-53）
}
```

#### DiscussionComment（讨论评论）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `discussionId` | String | 关联 Discussion |
| `authorId` | String | 关联 User（评论人）|
| `content` | String | 评论正文 |
| `parentId` | String? | 一级回复；parent 不能再有 parentId（应用层拒绝二级嵌套）|
| `isDeleted` | Boolean | 软删除标记，默认 false |
| `deletedBy` | String? | 删除操作人（可为 authorId 自删或 class_admin+）|
| `deletedAt` | DateTime? | 删除时间 |
| `createdAt` | DateTime | 默认 now() |

```prisma
model DiscussionComment {
  id           String    @id @default(cuid())
  discussionId String
  authorId     String
  content      String
  parentId     String?   // 一级回复；应用层拒绝二级嵌套
  isDeleted    Boolean   @default(false)
  deletedBy    String?   // 可为 authorId（自删）或 class_admin+
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())

  discussion Discussion          @relation(fields: [discussionId], references: [id])
  author     User                @relation(fields: [authorId], references: [id])
  parent     DiscussionComment?  @relation("Replies", fields: [parentId], references: [id])
  replies    DiscussionComment[] @relation("Replies")
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 一人一票不可换投 | DB（@@unique）+ 应用层 | `@@unique([discussionId, userId])` 防重；API 层收到已投票用户的请求返回 409，不删旧行 |
| 投票/评论仅限 open 话题 | 应用层 | 写入前校验 `Discussion.status='open'`，closed 后只读 |
| DiscussionViewpoint 不可事后增删 | 应用层 | 无 viewpoint create/delete API；仅允许随 Discussion 创建时批量写入 |
| 评论一级回复限制 | 应用层 | 写入 parentId 时校验 parent.parentId 为 null |
| 软删：评论 `isDeleted=true`（D18）| 应用层+DB | 无 delete API；isDeleted=true 前端隐藏，DB 保留 |
| 内容仅在本班可见 | 应用层 | Discussion.classId 强制按班级过滤 |

---

### 5.3 约修（PracticeAppointment）⬜ 待讨论

> 旧设计已标 ⏸ Phase 5，含 PracticeAppointment 1 张表，待下一轮讨论确认。

---

### 5.4 自学模式（UserSelfStudyProgram 家族）⬜ 待讨论

> 含 UserSelfStudyProgram + UserSelfStudyRestWeek 2 张表，待下一轮讨论确认。

---

## 六、Enum 定义

| Enum | 值 | 说明 |
|---|---|---|
| `ProgramStage` | `preke` / `zhengke` | 预科/正科，D2 固定（新增）|
| `AdvancementConditionType` | `course_completion` / `practice_session` / `cumulative_count` / `attendance` / `exam_score` / `transmission` | 升学条件 6 类（新增，能力 10）|
| `CohortMemberStatus` | `active` / `paused` / `held_back` / `graduated` / `left` | 成员状态机 5 态（旧设计沿用，能力 11）|
| `LagStatus` | `on_track` / `slightly_behind` / `falling_behind` / `at_risk` | 掉队检测 4 档（旧设计沿用，能力 14；五维各独立取值，不加权）|

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
| 2026-05-29 | 完成 1.4 SpeakingGrade/ExamGrade/Exam 封板：前两表复用不动，Exam 扩展加 examType(quiz/advancement)；升学考不标 S5/S8（4a）；同步 §八 DR-13~16、§九 检查轮次 2（0 问题）|
| 2026-05-29 | 完成 1.5 CohortLagSnapshot 封板：复用不动 + 新增 LagStatus enum + 读权限改写为新角色体系；掉队阈值数据化记入新建 §十 待办清单 TODO-1；同步 §八 DR-17~20、§九 检查轮次 3（0 问题）|
| 2026-05-29 | 完成 1.6 ClassSession+ClassSessionSchedule 封板：拆两层（方案 b），ClassSession 扩展加 sessionType/scheduleId，新建 §3.15 ClassSessionSchedule；新建区 14→15；TODO-2 链接时效数据化；§八 DR-21~25、§九 检查轮次 4（0 问题）|
| 2026-05-29 | 完成 1.7 UserPracticeVow 封板（纯发愿，context=personal/event）、1.8 CohortRecommendedTemplate 封板（从复用区移入扩展区，加 programId 两级绑定）、§3.16 ClassTask 封板（辅导员布置班级任务，独立于发愿系统）；扩展区 8→9 张，新建区 15→16 张；§四 CohortRecommendedTemplate 标移入扩展区；§八 DR-26~32、§九 检查轮次 5 |
| 2026-05-29 | 1.7 UserPracticeVow 修订封板：补回 isPledged 两分法（发愿/裸追踪项）+ eventCounts EventCount[] 关联（法会愿进度独立计数流）；更新约束 3 条；§八 DR-33~34、§九 检查轮次 6（0 问题）|
| 2026-05-29 | 1.7 UserPracticeVow 再次修订：context 扩展为 5 值（+class_task/program_task），新增 classTaskId/cohortTemplateId 外键，任务目标运行时 join 不复制（D3）；§1.8 和 §3.16 补反向关联 vows[]；列表标签扩展为 5 类；§八 DR-35~37、§九 检查轮次 7（0 问题）|
| 2026-05-29 | 全量审查修复：(1) §1.5 taskLag 描述去掉 source=auto；(2) 补 DR-38 vow 生命周期自治原则（外部事件不影响 vow）；(3) §1.7 新增约束 2 条 + 设计意图补充；(4) 轮次 7 检查项 12 修正；§九 检查轮次 8（3 个问题全闭合）|
| 2026-05-29 | 完成 §二 2.1 UserRoleAssignment 封板：替代旧 ClassAdmin 8 flag，4 角色+作用域绑定体系，super_admin NULL unique 应用层兜底；§三 目录重整（UserRoleAssignment/TransmissionRecord 从新建区迁出，16→14 张，3.3→3.2 重排，3.14/3.15/3.16→3.12/3.13/3.14）；全量更新内联引用；§八 DR-39~41；§九 检查轮次 9（0 问题）|
| 2026-05-29 | 完成 §二 2.2 CareFollowupRecord 封板：替代旧 CareFollowup，新增 sourceType（care_watchlist/special_status 双能力共用）、watchlistItemId FK；canCareFollowup flag 废弃改 role-based；§八 DR-42~43；§九 检查轮次 10（1 个问题：§3.4 须补反向关联，已标注）|
| 2026-05-29 | 完成 §二 2.3 TransmissionRecord 封板：整合废弃 TantricAccessGrant，三源统一（course/dharma_event/empowerment），密法授权/固定清单升格/升学预检三条路径打通；§八 DR-44~47；§九 检查轮次 11（1 个问题：TantricGroup 反向关联须替换，已知，不阻断封板）；§二 替换区 3 张全部封板 |
| 2026-05-29 | §1.4 修订：SpeakingGrade.classId String→String?（null=平台级讲考由 subject_admin/super_admin 评分）；§四 SpeakingSession 复用确认（classId 旧设计已可空，照搬）、Exam 标移入 §1.4；写权限说明拆班级/平台两级；§八 DR-48~49；§九 检查轮次 12（0 问题）|
| 2026-05-29 | §五 暂缓区重构：从「保留旧设计原样」改为「设计已落实/实现延后」，拆为 §5.1~5.4 四个子节。§5.1 班级动态（ClassPost/Reaction/Comment/Share 4 张表）✅ 封板：补发帖人自删权限（authorId 自删 OR class_admin+）、软删三件套（D18）、Reaction toggle 物理删例外（DR-50）、职能待定标记（DR-52）；§5.2~5.4 保持 ⬜ 占位；§八 DR-50~52；§九 检查轮次 13（0 问题）|
| 2026-05-29 | §5.2 班级讨论（Discussion/Viewpoint/Vote/Comment 4 张表）✅ 封板：一人一票不允许换投（D18 完全合规，DR-53）、创建权=所有后台角色 class_tutor+（DR-54）、关闭权=发起人 OR class_admin+（DR-55）、Viewpoint 创建后不可增删（DR-56）、评论软删（同 §5.1）；§八 DR-53~56；§九 检查轮次 14（0 问题）|

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
| DR-13 | SpeakingGrade / ExamGrade 是否扩展 | 复用不动 | 讲考评分(三值 score)、考试成绩(0-100)结构旧设计已完整，无新业务需求 |
| DR-14 | Exam 如何区分随堂测验/升学考 | 加 `examType`（quiz/advancement）| 排除「不加字段」：旧 Exam 只有 createdBy，DB 分不出哪场是升学考，升学预检(§3.11)的 exam_score 条件取不到正确成绩、两类写权限(#11a/#11b)无法分流。正是把 Exam 从复用区拉进扩展区的理由 |
| DR-15 | 升学考是否在 Exam 上标 S5/S8 节点 | 不加（4a，用户决策）| 排除「加 advancementStage 字段」：升学节点属专业配置范畴，放 ProgramAdvancementConfig 的 conditionKey/params 更灵活（S5/S8 是否两专业都有尚不确定），Exam 只需知道「是不是升学考」，新增节点不动 Exam 结构 |
| DR-16 | 考试合格线存哪 | ProgramAdvancementConfig.targetValue，不写死 ExamGrade | 符合 D3 数据驱动：各专业合格线可不同，由升学条件配置定义 |
| DR-17 | CohortLagSnapshot 是否扩展 | 复用不动 | 五维独立 LagStatus + detail + 唯一约束结构已严谨，无新业务需求 |
| DR-18 | 掉队阈值数据化 | 暂不在本表做，挂 §十 待办 | 能力 14 约束 #1 要求阈值数据化(D3)，但阈值属计算逻辑层、不是快照表字段；硬改牵连 User 表与算法，超出本表范围，应在 Program/配置表设计时统一处理 |
| DR-19 | CohortLagSnapshot 读权限 | 改写为新角色体系（辅导员及以上，按作用域）| 旧设计用 ClassAdmin flag(canViewStudents)，已被 UserRoleAssignment 替换；对齐能力 14 规则 3，学员端仍完全不可见 |
| DR-20 | CohortLagSnapshot 是否适用 D18 | 不适用（可被重算覆盖）| 本表是每日重算的 computed state，非历史事件；永久留痕落在 care_followup_records/CareWatchlistItem，快照仅信号源 |
| DR-21 | ClassSession 是否拆两层 | 拆（方案 b，用户决策）| 排除单表扩展(a)：课表循环规则与单次场次混在一行，改课表要批量改历史行，查询复杂；能力 8「对老项目影响」也明确要求 schedule/instance 分层 |
| DR-22 | 拆层后 ClassSession 命名 | 保留 ClassSession 作为 instance | 排除重命名为 GongxiuInstance：旧代码/前端已大量引用 ClassSession，改名迁移成本高；新增 ClassSessionSchedule 为模板层，命名风格一致 |
| DR-23 | 出勤记录用哪张表 | 继续走 StudyRecord（classSessionId 已在 1.3 封板）| 排除新建独立出勤表：StudyRecord @@unique([classSessionId, userId, studyType]) 已满足防重需求，新建出勤表属过度设计 |
| DR-24 | checkInToken 过期字段 | 不加 expiresAt，由 startAt+durationMin+宽限期计算 | 宽限期是配置项(TODO-2)，写进字段反而写死；应用层按时间窗口判断更灵活 |
| DR-25 | 链接时效数据化 | 暂不在本表做，挂 §十 TODO-2 | 能力 8「可在专业/班级层配置」，相关配置表未封板；提前在 ClassSession 加字段反而绕过配置层 |
| DR-26 | 班级任务与发愿是否合并 | 完全分离：ClassTask 管任务，UserPracticeVow 管发愿 | 旧设计将班级任务塞进 UserPracticeVow（source=auto、classId、templateId），用户确认两者业务概念不同：任务是辅导员布置全班完成的、发愿是学员自己承诺的。合并导致 7 态状态机过度复杂，新设计文档 05/06 无 VowStatus 概念。分离后各表边界清晰，达标率计算也更直接 |
| DR-27 | ClassTask 作用域 | 班级级（classId 必填）| 课程自带任务走 CohortRecommendedTemplate（programId 专业级），辅导员布置任务走 ClassTask（classId 班级级）；作用域不同，不合表 |
| DR-28 | 达标率计算方式 | 每日达标天数 / 任务总有效天数 | 用户决策：每日打卡次数 ≥ dailyTarget 即为当日达标，比率 = 达标天数 / (endDate - startDate 天数)。相比累计绝对数更公平（短期任务与长期任务可横向比较）|
| DR-29 | CohortRecommendedTemplate 从复用区移入扩展区 | 加 programId，两级绑定（专业级 + 班级级）| 旧设计只有 classId（每班手动绑），核对能力 9「课程自带任务来自教学大纲（专业级）」后须加 programId。字段语义变化，不再是纯复用，改归扩展区 |
| DR-30 | CohortRecommendedTemplate binding 字段 | 保留（auto/recommended）| 课程自带任务 = auto（入班即生效），辅导员可选 recommended（推荐不强制）。两个级别均适用此语义，不需要按级别拆 |
| DR-31 | UserPracticeVow context 取值 | personal / event，去掉 class | 用户决策：发愿只有用户自己的愿（个人发愿 + 法会发愿），班级维度已归 ClassTask。保留 class 上下文会让发愿与班级任务的边界再次模糊 |
| DR-32 | UserPracticeVow 去掉的旧字段 | 移除 source / classId / templateId / 7态 VowStatus / currentStatus / statusCalculatedAt / statusNote / paceHistory / appointmentId | 这些字段均服务于「班级任务（source=auto）」或「辅导员掉队管理」语义；班级任务已归 ClassTask，7态状态机是 source=auto 专属，本表去掉 auto 后这套机制无用 |
| DR-33 | isPledged 是否保留 | 保留（用户决策 2026-05-29 补确认）| 旧设计两分法：用户添加修学时询问「是否发愿」，是则带目标+进度条（isPledged=true），否则是裸追踪项（isPledged=false）。此交互逻辑旧设计已完整设计，是计数模块的核心 UX，不能简化掉 |
| DR-34 | 法会愿进度走哪张表 | EventCount（独立计数流，不走 PracticeLog）| 旧设计有意隔离：法会期间打卡走 EventCount，日常打卡走 PracticeLog，两条流不同步不合并。法会愿发愿前提交的 EventCount（vowId=null）不回溯关联——有意设计，发愿前属随喜、不计入个人愿进度 |
| DR-35 | 班级/课程任务如何进入计数模块 | 方案 A：自动建 UserPracticeVow 条目（context=class_task / program_task）| 排除方案 B（任务单独区块）：两套入口分裂体验；排除方案 C（用户手动添加）：课程任务是教学要求，不应依赖学员自己发现。自动建条目统一列表，标签区分来源，打卡体验与个人发愿完全一致 |
| DR-36 | 任务条目的 dailyTarget 是否复制进 UserPracticeVow | 不复制，运行时 join 任务定义（D3）| 文档能力 1 规则 4：「课程目录、实修要求等都是数据」；D3：标准可配置、可调整。复制意味着标准改变后要批量更新用户行——与数据驱动理念相悖。运行时读取：ClassTask.dailyTarget 或 PracticeTemplate.defaultDailyTarget 改一处全员生效 |
| DR-37 | UserPracticeVow context 扩展为 5 值 | personal / event / class_task / program_task + isPledged=false 裸追踪 | 5 值覆盖所有修学条目来源；class_task/program_task 恒 isPledged=true（任务有明确目标）；裸追踪项只属于 context=personal（用户自主选择，非系统布置）|
| DR-38 | 外部事件是否自动结束 vow | 不影响（用户决策 2026-05-29）| 法会结束、ClassTask停用、退班/毕业——均不触发 UserPracticeVow 状态变化。排除「法会结束自动标 completed」（旧设计逻辑）：发愿是个人承诺，不受外部事件生命周期约束。vow 统一按用户设定的 currentEndDate 到期，外部事件仅影响能否继续新建同类 vow（如退班后不再为该用户建新任务愿），不影响已有 vow |
| DR-39 | 旧 ClassAdmin 8 个 Boolean flag 如何映射到新角色体系 | 按职能边界分摊到 4 角色层级，flag 废弃 | `canManageMembers`→class_admin 职能 #2（管理成员名单）；`canManageExams`→class_tutor #11a（随堂测）/ class_admin #11b（升学考）；`canViewStudents`→class_tutor #8（查看学员信息）；`canCareFollowup`→class_tutor #3 read（查看关怀）/ class_admin #3 write（发起跟进）；`canEditGoals`→见 DR-40；`canManageCourse`→class_admin #16（管理课程内容）；`canEdit`/`canDelete`→全局角色继承覆盖，无需独立 flag。旧 flag 从未后端实现（后端现状见 §二 2.1 背景注），无迁移破坏 |
| DR-40 | canEditGoals 是否作为独立权限 flag | 不作 flag；辅导员调整学员目标 = 代行操作，走能力 5 | 能力 5「代行操作」定义：class_admin 及以上可代学员执行受限操作，每次操作必须写 AuditLog 留痕（D17）。「调整目标」是典型代行：操作人≠当事人，需留痕，权限自然受 class_admin 角色控制，无需再单独 flag |
| DR-41 | super_admin 唯一约束 PostgreSQL NULL≠NULL 问题 | 应用层额外校验 | `@@unique([userId, role, classId, programId])` 对 super_admin（classId=null, programId=null）失效——PostgreSQL 将 NULL≠NULL，导致同一人可插入多条 active super_admin 行。解决方案：应用层 Zod 前置 + 写入前 `findFirst({where:{userId, role:'super_admin', status:'active'}})` 幂等检查，命中则 upsert/返回错误，不命中才 create |
| DR-42 | care_followup_records 是否拆能力14/能力12 两张表 | 合并为一张表，sourceType 字段区分 | 能力 14（关怀清单）与能力 12（特殊身份）的跟进备注在业务上完全同构（谁跟进了谁、何时、说了什么、状态如何）。拆两张表只会产生重复 schema + 重复 UI 组件；`sourceType` 一个字段即可区分来源，查询/过滤/展示均无障碍 |
| DR-43 | canCareFollowup flag 如何处理 | 废弃 flag，改为 role-based（职能 #3）| 旧 `ClassAdmin.canCareFollowup` Boolean 是 ClassAdmin 8 flag 之一，随 ClassAdmin 整体废弃（DR-39）。写权限对应职能 #3 W（class_admin 及以上），读权限对应职能 #3 R（class_tutor）。排除「保留 flag 细粒度控制」：新设计 23 职能矩阵已精确到每个职能的读写边界，额外 flag 是冗余的授权维度 |
| DR-44 | TantricAccessGrant 是否保留 | 废弃，整合入 TransmissionRecord | TantricAccessGrant 只存「谁被授权访问哪个密法组」，语义完全等同于「某人已接受某组灌顶」。TransmissionRecord 的 sourceType=empowerment 条目已包含全部信息（userId+tantricGroupId+status），密法访问控制只需换一条查询（EXISTS on TransmissionRecord）。保留两张表反而造成授权与记录分裂，撤销时须同步更新两表（D18 下有复杂事务）|
| DR-45 | TransmissionRecord 是否加 @@unique([userId, tantricGroupId]) | 不加 | 旧 TantricAccessGrant 有此约束是因为「每人每组最多一条授权」。但传承记录不同：同一人可在不同时间参加同一灌顶法会并被多次录入（重复灌顶合法）。去掉唯一约束；访问控制改为 EXISTS 查询（has any active empowerment record for this group），更符合传承的真实语义 |
| DR-46 | 手动录入传承如何与固定清单打通 | isRequired+isConfirmed 两步，transmissionKey 关联 ProgramAdvancementConfig | 能力 15 规则 3：「手动录入默认为额外传承，升格需管理员确认」。两步流程：(1) 录入时 isRequired=false、isConfirmed=false；(2) admin 审核后置 isRequired=true、isConfirmed=true、confirmedBy+confirmedAt。升学预检查 transmissionKey=conditionKey AND isRequired=true AND status=active——简洁且可溯源 |
| DR-47 | 课程自动触发传承如何关联 ProgramAdvancementConfig | 通过 transmissionKey=conditionKey 打通 | 课程配置（能力 3 圆满触发）中标注「含传承」时，系统写入 TransmissionRecord：entryBy=system、isRequired=true（已知是固定清单项）、isConfirmed=true、transmissionKey=对应 ProgramAdvancementConfig.conditionKey。升学预检无需特殊处理，与手动录入升格后的记录结构完全一致（D3 数据驱动，逻辑不随新传承类型改代码）|
| DR-48 | 平台级讲考 SpeakingGrade.classId 如何处理 | 改为可空（String?），null = 平台级评分 | 平台级 SpeakingSession（classId=null）由 subject_admin/super_admin 评分，评分人无归属班。旧 classId String（辅导员所在班，用于权限范围限定）在平台级场景无法填值。改为 String?：有值时含义不变（班级级评分，辅导员权限范围），null 时表示平台级评分（subject_admin/super_admin 身份即权限依据）。排除「平台级讲考不设评分」：用户明确要求平台级讲考也记评分（2026-05-29）|
| DR-49 | 平台级讲考的创建/评分权限归属 | 创建：subject_admin/super_admin；评分：subject_admin/super_admin | 旧设计平台级场次（classId=null）已明确「仅 admin 可设」（FINAL_DESIGN 2853 行）。新角色体系下，「admin」对应 subject_admin（学科范围）及 super_admin（全局），两者均无归属班，符合平台级操作语义。class_tutor/class_admin 无平台级讲考的创建权（无跨班权限，D8 作用域边界）|
| DR-50 | ClassPostReaction 取消点赞是否物理删行 | 物理删行（D18 例外）| 点赞/取消点赞是纯状态 toggle，无历史留档需求（「曾经点过赞」不是业务关心的历史事件）。物理删行 + @@unique 防重是最简洁正确的 toggle 模式。对比：ClassPost/ClassPostComment 是通讯内容，删除需留痕（isDeleted+deletedBy）；Reaction 是瞬时情绪标记，语义不同。ClassPostShare 不删（转发是历史事件）|
| DR-51 | 帖子/评论删除权限如何表达「发帖人自删 OR 管理员」| 应用层双路判断，不加 DB 约束 | 删除条件：`session.userId == authorId`（自删）OR `UserRoleAssignment.role >= class_admin`（同班管理权）。此「OR」逻辑无法在 DB 层表达，须应用层 API 中间件先做身份判断，再执行软删（isDeleted=true + deletedBy + deletedAt）。deletedBy 字段同时兼做「谁删了」的审计留痕（自删 = 发帖人 userId，管理删除 = 管理员 userId）|
| DR-52 | ClassPost 家族职能归属 | 暂缓实现时再定职能编号，当前设计按角色层级描述 | 06 文档 20 条业务能力未覆盖「班级动态」，没有对应职能编号。旧设计已有完整 schema，新设计权限按角色层级（class_admin+，active 班级成员）描述已足够。排除「强行映射到现有职能」（无对应职能，强映射会导致语义混乱）。待实现时补 06 文档能力条目 + 23职能矩阵行 |
| DR-53 | DiscussionVote 是否允许换投 | 不允许（用户决策 2026-05-29）| 旧设计允许「先删再插」换投。新设计改为一人一票锁定：投票即为当前立场的永久记录，`@@unique([discussionId, userId])` 防重，API 层收到重复投票返回 409。D18 完全合规（无物理删行）。排除「允许换投」：佛法讨论中意见修正有意义但不应反复改票，且锁定设计更简单、无 D18 例外争议 |
| DR-54 | Discussion 发起权限 | 所有后台角色（class_tutor 及以上，含 subject_admin/super_admin）| 用户决策：「发起投票由所有的后台角色都可以发起」。排除「仅 class_admin+」：辅导员（class_tutor）在教学互动中有合理需求发起话题讨论；排除「班级所有成员」：讨论话题设计是教学工具，由有管理职责的角色发起更规范 |
| DR-55 | Discussion 关闭权限 | 发起人自己（`authorId == session.userId`）OR `class_admin` 及以上 | 旧设计注释「创建权限：ClassAdmin 或 admin」，关闭权未单独说明。新设计与帖子/评论删除权同套路：发起人可关闭自己的话题，class_admin+ 可关闭任意话题（管理权）。排除「仅 class_admin+」：发起人无法关闭自己创建的话题不合理 |
| DR-56 | DiscussionViewpoint 事后增删 | 不允许（创建后不可增删）| 选项一旦有人投票，增删选项会导致票数统计失真、已投票用户体验混乱。最简原则：viewpoint 随 discussion 创建时一并批量写入，之后无增删 API。排除「允许追加选项（仅追加，不删）」：追加后旧选项票数比例变化，可能影响讨论方向的真实性 |

---

## 九、一致性检查记录

> 守则要求：每次改动后跑一致性检查。范围限已封板的表（1.1 Program、1.2 ClassMember、1.3 StudyRecord、3.1 ProgramAdvancementConfig、3.12 EnrollmentStatusHistory）。⬜ 未开始的表待其封板后纳入。全表 14 项完整检查在所有表完成后（步骤 3）再跑一次。

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
| 9. 升学条件可全查 | 🔵 部分 | ProgramAdvancementConfig 6 类 conditionType 已映射能力 3/4/6/8/10/17 数据源；待 AdvancementCheck(§3.9) 封板后验证路径闭环 |
| 10. D14 累计/日常豁免字段区分 | ⬜ 待 PracticeLog/UserPracticeVow 封板 | 涉及 vow_type，相关表未封板 |
| 11. D17 代行留痕路径完整 | 🔵 部分 | StudyRecord.createdBy 表达代行，明细走 AuditLog(§3.11)；待 AuditLog 封板验证覆盖全代行类型 |
| 12. D18 不物理删除 | ✅ | 5 张表均注明无 delete / append-only / 状态位归档 |
| 13. 02 文档 23 职能写表覆盖 | ⬜ 待全表完成 | 需全表就绪后逐职能核对 |
| 14. 枚举值各处一致 | ✅ | CohortMemberStatus 在 ClassMember/EnrollmentStatusHistory/§六 三处一致；AdvancementConditionType 在 §3.1/§六 一致 |

**本轮发现问题数**：1（检查项 1 关联不对称）→ 已当轮修复。
**结论**：已封板 5 张表通过范围内检查。⏸/⬜ 项待依赖表封板后纳入下一轮。

### 检查轮次 2（2026-05-29，范围：+ 1.4 SpeakingGrade/ExamGrade/Exam，共 6 节）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | Exam.grades↔ExamGrade.exam、ExamGrade 的 user/class/grader 关联在 User/Class model 已有反向（旧设计 1502-1530 行确认）；SpeakingGrade.session↔SpeakingSession.grades 成对 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | 扩展区仍 7（Exam 扩展归入 1.4，非新增表）；新建区 14 不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | examType 新增、S5/S8 不加均明确标注理由 |
| 8. 业务规则约束有实现方式 | ✅ | examType 枚举(Zod)、写权限分流(应用层)、成绩留档(应用层)均注明 |
| 9. 升学条件可全查 | 🔵 部分→改善 | examType='advancement' 补齐了 exam_score 条件的数据来源，升学预检取数路径前进一步；待 §3.9 封板验证闭环 |
| 10. D14 累计/日常豁免字段区分 | ⬜ 待 PracticeLog/UserPracticeVow 封板 | 本表无关 |
| 11. D17 代行留痕路径完整 | 🔵 部分 | 成绩修正走 upsert+AuditLog；待 AuditLog 封板验证 |
| 12. D18 不物理删除 | ✅ | 三表均无 delete，成绩 upsert 更新 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | #7(录成绩)/#11a(随堂)/#11b(升学考) 已对应 Exam/ExamGrade 写操作；全职能核对待全表完成 |
| 14. 枚举值各处一致 | ✅ | examType(quiz/advancement) 在字段表/约束/Prisma/设计意图四处一致；score 三值(pass/fail/excellent)与旧设计一致 |

**本轮发现问题数**：0。
**结论**：1.4 三表通过范围内检查，无需修复。

### 检查轮次 3（2026-05-29，范围：+ 1.5 CohortLagSnapshot，共 7 节）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | CohortLagSnapshot.class/student ↔ Class.lagSnapshots / User.lagSnapshots（旧设计 1488/1524 行确认反向存在）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | 扩展区仍 7（CohortLagSnapshot 本就在列），无表数变化 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | 阈值数据化已标 ⚠️ 待办并入 §十；读权限改写有标注 |
| 8. 业务规则约束有实现方式 | ✅ | 唯一约束(DB)、active-only/学员不可见/无排表班(应用层)均注明 |
| 9. 升学条件可全查 | ⏸ 本表无关 | CohortLagSnapshot 服务关怀(能力14)，非升学 |
| 10. D14 累计/日常豁免字段区分 | ⬜ 待 PracticeLog/UserPracticeVow 封板 | taskLag 依赖 source=auto 愿，相关表未封板 |
| 11. D17 代行留痕路径完整 | ⏸ 本表无关 | 系统自动重算，无人工代行 |
| 12. D18 不物理删除 | ✅（例外已说明）| 本表为 computed state，可被重算覆盖；永久留痕落 care_followup_records/CareWatchlistItem，已明确说明为何不需要 |
| 13. 02 文档 23 职能写表覆盖 | ⏸ 本表无人工写 | 系统定时任务写入，读权限对应辅导员职能 |
| 14. 枚举值各处一致 | ✅ | LagStatus 4 档在字段表/Prisma/§六 一致；与旧设计 113-118 行一致 |

**本轮发现问题数**：0。
**结论**：1.5 通过范围内检查。新增 §十 待办清单记录「掉队阈值数据化」(DR-18)，待依赖表封板后处理。

### 检查轮次 4（2026-05-29，范围：+ 1.6 ClassSession + §3.15 ClassSessionSchedule，共 9 节）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | ClassSession.schedule ↔ ClassSessionSchedule.instances 成对；ClassSession.studyRecords ↔ StudyRecord（1.3 已封板，classSessionId 指向此表）；ClassSession.class/lesson 反向存在（旧设计 1540 行 classSessions Class）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | 新建区标题改为「15 张」，注记列明 ClassSessionSchedule 来源 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | expiresAt 不加（DR-24）、时效数据化挂 TODO-2 均有说明 |
| 8. 业务规则约束有实现方式 | ✅ | 各约束注明 DB/应用层；offline 不生成 token、平台级限 super_admin 等均注明 |
| 9. 升学条件可全查 | ⏸ 本表无关 | ClassSession 服务能力 8，出勤达标由 ProgramAdvancementConfig.attendance 判定，数据来源 StudyRecord（已封板）|
| 10. D14 豁免字段区分 | ⬜ 待相关表封板 | 无关 |
| 11. D17 代行留痕路径完整 | 🔵 部分 | 补卡/撤销留痕注明走 StudyRecord+AuditLog；待 AuditLog(§3.11) 封板验证 |
| 12. D18 不物理删除 | ✅ | ClassSession 无 delete；ClassSessionSchedule 停用走 isActive=false |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | 共修发起(辅导员)/平台级(admin)写权限已对应 ClassSession/ClassSessionSchedule；全职能待全表完成 |
| 14. 枚举值各处一致 | ✅ | sessionType 三值(online/offline/self_study)在 ClassSession/ClassSessionSchedule/约束三处一致 |

**本轮发现问题数**：0。
**结论**：1.6 两张表通过范围内检查。新增 §十 TODO-2（链接时效数据化）。

### 检查轮次 5（2026-05-29，范围：+ 1.7 UserPracticeVow + 1.8 CohortRecommendedTemplate + §3.16 ClassTask，共 12 节）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ⚠️→✅ | UserPracticeVow.user↔User（旧设计 User model 已有 practiceVows 反向）；UserPracticeVow.event↔Event（需确认 Event 有 practiceVows 反向）；UserPracticeVow.logs↔PracticeLog（PracticeLog 需有 vow 反向）。CohortRecommendedTemplate.program↔Program.recommendedTemplates（本文档 1.1 Program 关联表需补 recommendedTemplates）；.class↔Class（旧设计 Class 有反向）；.template↔PracticeTemplate（旧设计已有反向）。ClassTask.class↔Class.tasks（Class 需有 tasks 反向）；.practiceProject↔PracticeProject.classTasks（PracticeProject 需有反向）。**注**：本文档目前只写 Prisma model 片段，Class/User/PracticeProject/Event 等复用表的反向关联以旧设计 schema 为参考；若旧设计已有对应反向字段则 ✅，否则标记为上线前 migration 须补 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | 扩展区标题「9 张」（1.7+1.8 新入）；新建区标题「16 张」（§3.16 新入）；§四 CohortRecommendedTemplate 标「已移入扩展区 §1.8」；三处计数一致 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | UserPracticeVow 移除字段均标「移除」并注理由（DR-32）；ClassTask appointmentId/法会联动 ⏸ 暂缓已在发愿设计说明中 |
| 8. 业务规则约束有实现方式 | ✅ | UserPracticeVow context 校验(Zod)、ClassTask 并发数软限制(应用层)、CohortRecommendedTemplate 双字段唯一(DB)均注明实现方式 |
| 9. 升学条件可全查 | ⏸ 本节无关 | UserPracticeVow/ClassTask 服务能力 7/9，非升学条件 |
| 10. D14 累计/日常豁免字段区分 | 🔵 部分 | ClassTask.dailyTarget 表达日常型；CohortRecommendedTemplate 通过 binding=auto 绑定 PracticeTemplate（累计/日常区分在 PracticeTemplate 本身，复用区待核对）|
| 11. D17 代行留痕路径完整 | 🔵 部分 | UserPracticeVow 管理员代行走能力 5+AuditLog（已注明）；ClassTask 无代行场景，辅导员直接发起 |
| 12. D18 不物理删除 | ✅ | UserPracticeVow 废弃走 status='abandoned'；ClassTask 停用走 isActive=false；CohortRecommendedTemplate 无 delete API |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | 班级任务发布(辅导员 #10?)已对应 ClassTask；发愿自助(学员)→UserPracticeVow；全职能核对待全表完成 |
| 14. 枚举值各处一致 | ✅ | UserPracticeVow.context 两值(personal/event)在字段表/约束/设计意图一致；ClassTask.isActive 布尔值单处定义；CohortRecommendedTemplate.binding 两值(auto/recommended)在字段表/Prisma 一致 |

**本轮发现问题数**：0（关联对称性的反向字段以旧设计 schema 为参考，需在写 Prisma schema 时最终确认，不阻断本轮封板）。
**结论**：1.7、1.8、§3.16 三张表通过范围内检查。CohortRecommendedTemplate 成功从复用区移入扩展区，计数更新完毕。

### 检查轮次 6（2026-05-29，范围：1.7 UserPracticeVow 修订——补 isPledged + eventCounts）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | 新增 `eventCounts EventCount[]`：EventCount model 需有 `vow UserPracticeVow? @relation(fields: [vowId], references: [id])`——旧设计已有（agent 已确认 EventCount.vowId + vow 反向）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | 扩展区仍 9 张，新建区仍 16 张；本轮是字段修订，不增减表 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | 去掉的字段均注明移除理由（DR-32 更新）；裸追踪项不可补发愿规则已注明 |
| 8. 业务规则约束有实现方式 | ✅ | isPledged=false 时 target 全 null（Zod）；法会愿进度走 EventCount 不走 PracticeLog（应用层）；裸追踪项不可补发愿（应用层）——三条均注明实现层 |
| 9-14. 其余检查项 | ✅/⏸ | 同轮次 5，本轮修订不影响其他检查项结论 |

**本轮发现问题数**：0（本轮为补漏修订，已知问题已修，无新发现）。
**结论**：1.7 修订通过。isPledged 两分法 + EventCount 双轨补回，与旧设计一致；schema 与约束对齐。

### 检查轮次 7（2026-05-29，范围：1.7 context 扩展 + §1.8 / §3.16 反向关联）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | UserPracticeVow.classTask ↔ ClassTask.vows 成对；UserPracticeVow.cohortTemplate ↔ CohortRecommendedTemplate.vows 成对；两组反向关联已同步写入 §3.16 和 §1.8 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | 表数量未变（仍 9 扩展 / 16 新建）；context 值扩展属字段内语义扩展，不增减表 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | task 类型 dailyTarget 不复制有注明（D3 运行时读）；裸追踪项仅属 personal 已注明 |
| 8. 业务规则约束有实现方式 | ✅ | context 外键必填校验（Zod）、task isPledged 恒 true（应用层）、target 运行时读（应用层）、幂等保护（应用层）均注明 |
| 9. 升学条件可全查 | ⏸ 本节无关 | 修学计数服务能力 7/9，非升学条件 |
| 10. D14 累计/日常区分 | 🔵 部分 | class_task/program_task 的 dailyTarget 属 D14b 日常型（各专业独立）；D14a 累计型（10万）通过 PracticeLog 累计总量，与 context 无关；待 PracticeLog 封板确认路径 |
| 11. D17 代行留痕 | 🔵 部分 | 任务打卡代行走 AuditLog；待 AuditLog(§3.11) 封板验证 |
| 12. D18 不物理删除 | ✅ | UserPracticeVow 无 delete；ClassTask 停用走 isActive=false；任务条目不随任务停用改状态（vow 生命周期自治，按 currentEndDate 到期）|
| 13. 02 文档职能覆盖 | 🔵 部分 | 班级任务布置（辅导员）已对应 ClassTask + 自动建 UserPracticeVow；全职能待全表完成 |
| 14. 枚举值各处一致 | ✅ | context 5 值在字段表/schema/约束/设计意图/列表标签五处一致 |

**本轮发现问题数**：0。
**结论**：1.7 context 扩展 + 双向关联通过检查。修学计数模块 5 种条目类型设计完整，运行时读取任务目标符合 D3。

### 检查轮次 8（2026-05-29，专项：全量审查发现的 3 个问题修复验证）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 问题1：§1.5 taskLag 描述（source=auto 过时术语）| ✅ 已修 | 更新为「近2周班级/课程任务打卡天数达标率」，与新设计 class_task/program_task context 对齐 |
| 问题2：ClassTask 停用后 UserPracticeVow 处理 | ✅ 已明确 | DR-38：外部事件不影响 vow；§1.7 约束新增「外部事件不触发 vow 状态变化」；轮次 7 检查项 12 已修正 |
| 问题3：退班后 UserPracticeVow 处理 | ✅ 已明确 | 同 DR-38；原则统一：法会结束/ClassTask停用/退班/毕业 → vow 按 currentEndDate 自然到期 |
| 1. Prisma 关联对称性 | ✅ | 本轮无新增关联 |
| 8. 业务规则约束有实现方式 | ✅ | 新增两条约束均注明「应用层」实现 |
| 14. 枚举值各处一致 | ✅ | taskLag 描述更新后与 1.5 其余四维描述风格一致 |

**本轮发现问题数**：0（本轮为审查修复轮，3 个已知问题全部闭合）。
**结论**：全量审查通过。1.7/1.8/§3.14 设计无逻辑冲突；vow 生命周期自治原则明确写入约束与决策记录。

### 检查轮次 9（2026-05-29，范围：§二 2.1 UserRoleAssignment 封板 + §三 目录重整）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | UserRoleAssignment.user↔User（反向 roleAssignments[]）；.class↔Class（反向 roleAssignments[]）；.program↔Program（反向 roleAssignments[]）；.history↔RoleAssignmentHistory（§3.2，反向 assignment[]）——均在旧设计对应 model 中存在或与 §3.2 成对声明 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三标题更新为「14 张」；§三注记已说明 16→14 迁出路径（UserRoleAssignment→§二 2.1；TransmissionRecord→§二 2.3）；计数与实际条目一致 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | 旧 ClassAdmin 8 flag 在 §二 2.1 背景注中明确标「废弃」并注对应关系（DR-39）；canEditGoals 标「不作独立 flag」并注理由（DR-40）|
| 8. 业务规则约束有实现方式 | ✅ | super_admin NULL唯一约束：DB 约束 + 应用层幂等检查（DR-41）；角色分配链（class_admin任命class_tutor等）：应用层中间件；作用域必填校验：Zod |
| 9-14. 其余检查项 | ✅/⏸ | 同轮次 8，本轮修订不影响其他检查项结论 |

**本轮发现问题数**：0（§三 目录重整为清理操作，无逻辑变更；2.1 设计已在决策确认时验证）。
**结论**：§二 2.1 UserRoleAssignment 封板通过。§三 计数已由 16→14 修正，内联引用全部同步更新（§3.12 EnrollmentStatusHistory / §3.13 ClassSessionSchedule / §3.14 ClassTask / §3.9 AdvancementCheck / §3.11 AuditLog 等）。

### 检查轮次 10（2026-05-29，范围：§二 2.2 CareFollowupRecord 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | CareFollowupRecord.student↔User（`careStudentRecords` 反向，旧设计 1486 行已有）；.careWorker↔User（`careWorkerRecords` 反向，旧设计 1487 行已有）；.class↔Class（Class model 有 `careFollowupRecords` 反向）；.watchlistItem↔CareWatchlistItem（§3.4 设计时须补 `followupRecords CareFollowupRecord[]` 反向关联，已在约束设计意图中标注）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | 替换区仍 3 张（2.1 已封板，2.2 本轮封板，2.3 未开始）；扩展区/新建区计数不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | canCareFollowup flag 废弃在背景注中明确标注（DR-43）；special_status 来源的 `lagSnapshotAtContact=null` 已注明 |
| 8. 业务规则约束有实现方式 | ✅ | sourceType 枚举（Zod）；care_watchlist→watchlistItemId 必填（Zod）；学员不可见（应用层路由）；无物理删除（应用层）——四条均注明实现层 |
| 9. 升学条件可全查 | ⏸ 本表无关 | 关怀记录服务能力 14/12，非升学条件 |
| 10. D14 豁免字段区分 | ⏸ 本表无关 | 无修学计数相关字段 |
| 11. D17 代行留痕路径完整 | ✅ | careWorkerId 即代行人；每次跟进均写入一条记录，天然留痕；无需额外 AuditLog（跟进记录本身即日志，非间接代行）|
| 12. D18 不物理删除 | ✅ | 无 delete API，备注永久留档，与能力 14 绝对约束 #3 一致 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | 职能 #3（学员日常关怀）R/W 已对应 CareFollowupRecord 读写权限；全职能核对待全表完成 |
| 14. 枚举值各处一致 | ✅ | sourceType 两值(care_watchlist/special_status) 在字段表/schema/约束/设计意图四处一致；followUpStatus 三值(pending/resolved/escalated) 在字段表/schema 两处一致，与旧设计一致 |

**本轮发现问题数**：1（检查项 1 发现 §3.4 CareWatchlistItem 设计时须补 `followupRecords CareFollowupRecord[]` 反向关联，已标注为 §3.4 设计时的必做事项）。
**结论**：§二 2.2 CareFollowupRecord 封板通过。`sourceType` 双能力共用方案、role-based 权限、D18 留档均已覆盖。§3.4 CareWatchlistItem 开始设计时须补反向关联。

### 检查轮次 11（2026-05-29，范围：§二 2.3 TransmissionRecord 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | TransmissionRecord.user↔User（旧设计 User model 中 `transmissionRecords` 反向需确认存在；TantricAccessGrant 有，TransmissionRecord 替代后反向仍成立）；.tantricGroup↔TantricGroup（TantricGroup 需有 `transmissionRecords TransmissionRecord[]` 反向，旧设计 TantricGroup.grants 将被替换为此；上线前 migration 须同步）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | 替换区 3 张全部封板（2.1/2.2/2.3）；扩展区 9 张、新建区 14 张不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | @@unique([userId, tantricGroupId]) 明确标 ❌ 不加并注理由（DR-45）；TantricAccessGrant 废弃在背景注中明确标注（DR-44）|
| 8. 业务规则约束有实现方式 | ✅ | sourceType/entryMethod 枚举（Zod）；empowerment→tantricGroupId 必填（Zod）；isRequired→transmissionKey 必填（Zod）；密法访问控制 EXISTS 查询（应用层）；D18 撤销（应用层）——均注明实现层 |
| 9. 升学条件可全查 | ✅ 改善 | conditionType='transmission' 的升学预检路径闭合：ProgramAdvancementConfig.conditionKey ↔ TransmissionRecord.transmissionKey，isRequired=true AND status=active 即满足；§3.9 AdvancementCheck 封板时验证完整路径 |
| 10. D14 豁免字段区分 | ⏸ 本表无关 | 传承记录无修学计数字段 |
| 11. D17 代行留痕路径完整 | ✅ | admin_entry 时 entryBy=操作人 userId（代录留痕）；confirmedBy 记录谁做了固定清单升格（升格代行留痕）；灌顶不可替代豁免须走 AuditLog（能力 5，§3.11）|
| 12. D18 不物理删除 | ✅ | 撤销走 status=revoked+revokedAt+revokedBy+revokedReason，无 delete API |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | 传承录入/灌顶代录对应 class_tutor/class_admin 写权限；固定清单确认对应 class_admin；全职能核对待全表完成 |
| 14. 枚举值各处一致 | ✅ | sourceType 三值(course/dharma_event/empowerment) 在字段表/schema/约束/设计意图四处一致；entryMethod 三值(auto/self_report/admin_entry) 在字段表/schema/约束三处一致；status 两值(active/revoked) 在字段表/schema/约束三处一致 |

**本轮发现问题数**：1（检查项 1：TantricGroup model 需将旧 `grants TantricAccessGrant[]` 反向关联替换为 `transmissionRecords TransmissionRecord[]`；属 TantricGroup 复用表调整，上线前 migration 须处理，已知问题不阻断封板）。
**结论**：§二 2.3 TransmissionRecord 封板通过。§二 替换区 3 张全部封板。传承记录体系完整：课程/法会/灌顶三源统一，密法授权、固定清单升格、升学预检三条路径均已打通。

### 检查轮次 12（2026-05-29，范围：§1.4 SpeakingGrade.classId 修订 + §四 SpeakingSession 复用确认）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | SpeakingGrade 无 classId FK（classId 是普通 String? 字段，无 @relation），改可空不影响关联对称性；SpeakingSession 复用不改，旧设计关联已完整 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §一 扩展区仍 9 张（SpeakingGrade 本就属 §1.4，未增减）；§四 更新：SpeakingSession ✅ 复用，Exam 标移入 §1.4；各区计数不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编；本轮改动为 SpeakingGrade.classId DROP NOT NULL（单列 ALTER） |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | SpeakingGrade.classId 改可空有背景注+DR-48；SpeakingSession 复用有说明注 |
| 8. 业务规则约束有实现方式 | ✅ | 班级级评分限 class_tutor+（应用层）；平台级评分限 subject_admin/super_admin（应用层）——两条均加入 §1.4 约束表 |
| 9-12. 其余检查项 | ✅/⏸ | 本轮修订仅涉及 §1.4 SpeakingGrade 和 §四，不影响其他已封板表结论 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | 讲考评分权限已拆班级/平台两级；全职能核对待全表完成 |
| 14. 枚举值各处一致 | ✅ | score 三值(pass/fail/excellent) 在字段表/schema 一致；classId 语义（null=平台级）在字段表/schema/约束/设计意图四处一致 |

**本轮发现问题数**：0。
**结论**：§1.4 SpeakingGrade 修订通过。classId nullable 设计覆盖班级级/平台级两种讲考评分场景，权限分流逻辑明确。SpeakingSession 复用确认，旧设计 classId 可空已足够，无需 schema 改动。

### 检查轮次 13（2026-05-29，范围：§5.1 ClassPost 家族封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | ClassPost.class↔Class.posts（旧设计 Class model 有 posts[]）；ClassPost.author↔User.posts（旧设计 User model 有 posts[]）；ClassPost.sharedFrom/reshares 自关联对称；ClassPostReaction/Comment/Share 的 post↔reactions/comments/shares 成对；User 反向 reactions[]/comments[]/shares[] 旧设计已有 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | §五 暂缓表不写 API 层；实现时再核对 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §五 暂缓区表头已更新为「设计已落实，实现延后」；4 张暂缓表（ClassPost/Reaction/Comment/Share）已在 §5.1 封板，其余 3 组 §5.2~5.4 保持 ⬜ |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 暂缓区不生成 migration；实现时统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | §5.1 标 ⏸ 暂缓；Reaction 取消点赞物理删行已标 DR-50 说明例外理由；职能待定已标 ⚠️ |
| 8. 业务规则约束有实现方式 | ✅ | 删帖/删评双路权限→应用层（DB 无法表达 OR 条件身份）；软删→应用层+DB 字段；Reaction 防重→DB @@unique；内容班级隔离→应用层过滤 |
| 9-12. 其余检查项 | ⏸/✅ | D18：帖子/评论软删（D18 合规）；Reaction 物理删行（DR-50 说明为状态 toggle 例外，同 D20 快照例外思路）；D17 代行留痕：deletedBy 字段兼做审计，重量级操作仍走 AuditLog（待 §3.11 封板后验证覆盖） |
| 13. 02 文档 23 职能写表覆盖 | ⚠️ 待实现时补 | 班级动态无对应职能编号（DR-52），⏸ 暂缓期间无需补；实现时需在 06 文档新增能力 + 职能矩阵行 |
| 14. 枚举值各处一致 | ✅ | ClassPost 无新增 enum；isDeleted 布尔、deletedBy/deletedAt 软删三件套在 ClassPost 与 ClassPostComment 两表定义一致 |

**本轮发现问题数**：0。
**结论**：§5.1 ClassPost 家族（4 张表）设计封板。权限双路（自删/管理删）、D18 软删、Reaction toggle 例外已有 DR 说明。Reaction 物理删例外与 DR-20 快照例外同类思路（状态/计算值，非历史事件）。⚠️ 实现时须补职能编号（DR-52）。

### 检查轮次 14（2026-05-29，范围：§5.2 Discussion 家族封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | Discussion.class↔Class；Discussion.author↔User；Discussion.lesson↔Lesson?；Discussion.course↔Course?；Discussion.viewpoints↔DiscussionViewpoint.discussion；DiscussionVote.viewpoint↔DiscussionViewpoint.votes；DiscussionVote.user↔User；DiscussionComment.discussion↔Discussion.comments；DiscussionComment.author↔User；DiscussionComment.parent/replies 自关联对称；旧设计 User/Class/Lesson/Course model 均有反向关联（FINAL_DESIGN 1488-1530 行确认） |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 暂缓区不写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §五 目录表已将 §5.2 更新为「✅ 设计封板」；4 张表与 schema 实体数一致 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 暂缓区不生成 migration |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | §5.2 标 ⏸ 暂缓；DiscussionViewpoint 不可增删已标注说明；换投不允许已标 DR-53 |
| 8. 业务规则约束有实现方式 | ✅ | 一人一票→DB @@unique + 应用层 409；投票/评论限 open→应用层；viewpoint 不增删→应用层（无 API）；评论软删→应用层+DB；内容班级隔离→应用层过滤；一级回复限制→应用层 |
| 9-12. 其余检查项 | ✅/⏸ | D18：DiscussionVote append-only（无物理删），DiscussionComment 软删，均合规；D17：deletedBy 兼做审计留痕；一人一票无历史丢失（不换投，无删行）|
| 13. 02 文档 23 职能写表覆盖 | ⚠️ 待实现时补 | 班级讨论无对应职能编号（同 DR-52 思路），⏸ 期间无需补 |
| 14. 枚举值各处一致 | ✅ | Discussion.status 两值（open/closed）在字段表、schema、约束三处一致 |

**本轮发现问题数**：0。
**结论**：§5.2 Discussion 家族（4 张表）设计封板。一人一票+不允许换投是最简 D18 合规方案；DiscussionViewpoint 不可事后增删保护票数真实性；评论软删与 §5.1 ClassPostComment 同套路。⚠️ 实现时须补职能编号。

---

## 十、跨表待办清单（设计推进中发现、需在后续表/阶段处理）

> 设计某张表时发现、但应在其他表或后续阶段解决的事项，登记于此防遗漏。

| 编号 | 待办 | 来源 | 处理时机 | 关联决策 |
|---|---|---|---|---|
| TODO-1 | 掉队判定阈值数据化（近2周窗口、各档比例、lagPracticeDaysExpected）——能力 14 约束 #1 要求阈值为专业配置项(D3)，目前散落代码/User 表 | 1.5 CohortLagSnapshot | Program/专业配置表设计时（扩展区已封板，需在新建区或复用区 Program 相关表处理）| DR-18 |
| TODO-2 | 共修链接激活时效数据化（提前激活 10 分钟、宽限期 30 分钟）——能力 8 明确「可在专业/班级层配置」(D3)，目前写死在应用层常量 | 1.6 ClassSession | 班级/专业配置表设计时处理 | DR-25 |
