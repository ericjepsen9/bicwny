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

## 一、🔧 扩展表（12 张）

旧设计字段为底，按新业务逻辑加字段/改语义。

> 注：ProgramSemester 核对后字段够用改判 ✅ 复用；CohortRecommendedTemplate 核对能力 9 后需扩展（classId→programId）从复用区移入；UserPracticeVow 剥离班级任务重新定位为纯发愿表。User 旧设计 13 字段全部复用，但新增 `birthDate`（年龄豁免数据源）从复用区移入扩展区。Class 旧设计 6 字段全部复用，但新增归档三件套（status/archivedAt/archivedBy，D19）从复用区移入扩展区。Course 旧设计 5 扩展字段全部复用，但 TODO-15 核对发现缺课程类型维度，新增 `courseType`（entry/formal/restricted，能力 3 规则 2）从复用区移入扩展区。扩展区最终 12 张。

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
| `lagWindowDays` | Int | 掉队判定窗口天数（默认 14）；D3 专业级配置（TODO-1 闭合，DR-88）| **新增** |
| `lagMildThreshold` | Float | 轻度掉队下界打卡率（默认 0.5，即 50%）| **新增** |
| `lagModerateThreshold` | Float | 中度掉队下界打卡率（默认 0.3）| **新增** |
| `lagSevereThreshold` | Float | 重度掉队下界打卡率（默认 0.1）| **新增** |
| `checkinGraceMinutes` | Int | 共修签到宽限分钟数（默认 30）；token 生成时刻起持续多久可签到（TODO-2 闭合，DR-89）| **新增** |
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
| `snapshots SemesterSnapshot[]` | **新增**（见 §3.7）|
| `advancementChecks AdvancementCheck[]` | **新增**（见 §3.9）|
| `advancementsFrom AdvancementRecord[] @relation("AdvancementFrom")` | **新增**（见 §3.10，升前科系）|
| `advancementsTo AdvancementRecord[] @relation("AdvancementTo")` | **新增**（见 §3.10，升入科系）|
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

> **三表关系**：ExamGrade 结构旧设计已完整，**复用不动**。**Exam 加 `examType`**——核对能力 10 发现旧 Exam 无法区分「随堂测验 vs 升学考」，导致升学预检取不到正确成绩、两类写权限无法分流。**SpeakingGrade.classId 改可空**——平台级讲考（SpeakingSession.classId=null）由 subject_admin/super_admin 评分，无归属班，见 DR-48。本节三张表中，SpeakingGrade（classId 改可空）和 Exam（加 examType）有变更，归入扩展区；ExamGrade 复用不动（收录于本节供对照参考）。

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
> **TODO-2 已闭合（DR-89）**：签到窗口改为「token 生成时刻」为基准，持续 `Program.checkinGraceMinutes`（默认 30 分钟）。startAt 仅作展示，不参与签到计算；老师/辅导员实际开始时生成 token，窗口自动对齐实际开课时间。

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
| 签到窗口 = token 生成时刻 + checkinGraceMinutes | 应用层 | startAt 仅展示，不参与窗口计算（DR-89，TODO-2 闭合）|
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
| `minSessionMinutes` | Int | 单座最短时长，默认 30；**录入校验下界**——每座必须 ≥ 此值才能成座（DR-91，对齐大纲）| 旧（语义强化）|
| `startDate` | DateTime | 发愿起始日 | 旧 |
| `currentEndDate` | DateTime? | 发愿截止日（可调整）| 旧 |
| `currentCount` | Int | 累计遍数/次数，默认 0（乐观计入）| 旧 |
| `currentSessionCount` | Int | 累计座数，默认 0；**改 Int**——废弃 0.5 座制，每座 ≥30 分钟整数计（DR-91）| 旧（**类型变更 Decimal→Int**）|
| `currentSessionMinutes` | Int | 累计观修时长（分钟），默认 0；座数与时长双维度独立计（DR-91）| **新增** |
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
  minSessionMinutes    Int       @default(30)  // 单座录入下界（≥30 才成座，DR-91）
  startDate            DateTime
  currentEndDate       DateTime?
  currentCount         Int       @default(0)
  currentSessionCount  Int       @default(0)  // 累计座数（整数，废弃 0.5 座，DR-91）
  currentSessionMinutes Int      @default(0)  // 累计观修时长（分钟，双维度独立，DR-91）
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

### 1.9 User（用户）✅ 已封板

**服务能力**：能力 2（学员加入）+ 能力 3（盲/聋特殊圆满）+ 能力 10（年龄豁免）+ 能力 12（特殊身份关怀）
**写权限**：本人维护个人资料（realName/phone/city 等）；studentId/nickname 自动生成不可自改（admin 异常可改）；accessibilityNeeds 由 admin 认定（职能 #13）；birthDate 本人填写，年龄豁免资格由系统按 birthDate 计算
**参考决策**：D18（档案永久保留）、DR-70；新增字段 birthDate 见 DR-70

> **判定**：旧设计 §2.2 已扩展 13 个字段，核对新设计后**全部有效照搬**。本表本可纯复用，但因 60 岁年龄豁免规则（大纲明文硬规则，能力 10 升学条件）需要年龄数据源，**新增 `birthDate` 字段**，故从复用区移入扩展区，判 🔧 扩展。

#### 旧设计 13 字段（全部复用，不改）

| 字段 | 用途 | 状态 |
|---|---|---|
| `studentId` | 学号（自动生成/老学员植入），`@unique` | ✅ 复用 |
| `nickname` | 行者昵称（自动生成，不可自改），`@unique` | ✅ 复用 |
| `accessibilityNeeds` | `['blind','deaf']`，盲/聋特殊圆满数据源（能力 3/12）| ✅ 复用 |
| `dataSource` | self_register / imported / admin_created | ✅ 复用 |
| `learningMode` | class / self_study / both（对应 §5.4 自学模式）| ✅ 复用 |
| `preferShowFaxin` | 三殊胜框架总开关（发心语 + 回向 Sheet）| ✅ 复用 |
| `timezone` | IANA 时区（自学进度/打卡基准）| ✅ 复用 |
| `realName` | 真实姓名（辅导员/admin 可见）| ✅ 复用 |
| `phone` | 手机号（不含国家码）| ✅ 复用 |
| `phoneRegion` | 国家码（ISO 3166-1 alpha-2），默认 US | ✅ 复用 |
| `refugeStatus` | 皈依情况（taken/not_taken/unsure）| ✅ 复用 |
| `city` | 所在城市（自由文本）| ✅ 复用 |
| `practiceBackground` | 修行背景（自由文本，可选）| ✅ 复用 |

#### 新增字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `birthDate` | DateTime? | 出生日期；**年龄豁免资格**的唯一数据源——年满 60 岁可申请免考（非自动，见下）| **新增** |

```prisma
model User {
  // ... 旧设计现有所有字段保留 ...
  // ... §2.2 扩展 13 字段保留（studentId/nickname/accessibilityNeeds/dataSource/
  //     learningMode/preferShowFaxin/timezone/realName/phone/phoneRegion/
  //     refugeStatus/city/practiceBackground）...

  // 新增（年龄豁免数据源）
  birthDate DateTime?  // 出生日期；年龄豁免资格计算用（年满60岁可申请免考，非自动）

  // 新建表反向关联（§三 新建区各表写入时补）
  snapshots          SemesterSnapshot[]
  advancementChecks  AdvancementCheck[]
  advancementRecords AdvancementRecord[]
  assistantAssignments AssistantAssignment[]
  leaveRequests      LeaveRequest[]
}
```

#### 年龄豁免规则（60 岁，写入升学条件）

> 大纲明文（升学指南 §一（三）入学条件）：**第一次考试报名时年满 60 岁的学员，没有上述考试要求。**

**业务规则**（区别于盲/聋强制豁免）：

| 维度 | 盲/聋（accessibilityNeeds）| 年龄 60 岁（birthDate）|
|---|---|---|
| **性质** | 强制豁免（身体缺陷必须适用）| **资格豁免**（有资格但不强制）|
| **触发** | 满足即自动切换判定路径（能力 3）| 年满 60 → 获得免考**资格**，是否使用由本人/管理员定 |
| **实现** | 系统自动（圆满判定按身份分支）| **非自动**：走能力 5 代行豁免，管理员显式确认免考、留痕（D17）|
| **原因** | 客观无法完成 | 部分老人有能力正常完成加行/考试，可选择正常考 |

- **年龄计算基准**：以「第一次考试报名时」的年龄为准（`birthDate` → 报名日年龄 ≥ 60）
- **不做成自动满足**：不能「年龄≥60 → exam_score 条件自动置满足」。而是系统标记该学员「**符合年龄豁免资格**」，实际免考是一次显式代行操作（能力 5，留痕、双方可见、可撤回）
- **有能力者正常考**：愿意正常参加考试的 60+ 学员，仍正常录成绩、正常判定

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `studentId` / `nickname` 唯一 | DB（@unique）| 旧设计已有 |
| `accessibilityNeeds` 取值 ['blind','deaf'] | 应用层 | 盲/聋强制圆满路径数据源 |
| 年龄豁免非自动 | 应用层 | 年满 60 仅获资格；实际免考走能力 5 代行豁免、留痕（D17）|
| 档案不物理删除（D18）| 应用层 | 退出/毕业后档案永久保留 |

---

### 1.10 Class（班级）✅ 已封板

**服务能力**：能力 2（学员加入）+ 能力 8（共修出勤）+ 能力 11（留级/退出/归档）+ 能力 14（掉队检测）
**写权限**：班级创建/配置 `class_admin` 及以上；`currentWeekOverride` 辅导员可调（本班）；归档（`status=archived`）`class_admin` 及以上手动操作
**参考决策**：D19（班级只归档不物理删除）、能力 11 §4；新增归档三件套见 DR-71

> **判定**：旧设计 §2.2 已扩展 6 个字段，核对后全部有效复用。本表本可纯复用，但 D19 + 能力 11 §4 明确要求班级**归档**（`status: archived`，不物理删除），旧设计 Class 无归档状态字段，**新增 status/archivedAt/archivedBy 归档三件套**，故从复用区移入扩展区，判 🔧 扩展。

#### 旧设计 6 字段（全部复用，不改）

| 字段 | 用途 | 状态 |
|---|---|---|
| `programId` | 所属科系（关联 Program）| ✅ 复用 |
| `startDate` | 班级起始日期（周号算法基准：当前周 = 自然周数 − 休息周数）| ✅ 复用 |
| `city` | 班级所在城市 | ✅ 复用 |
| `timezone` | IANA 时区（共修/讲考场次时间按此展示）| ✅ 复用 |
| `currentWeekOverride` | 辅导员手动覆盖本班当前周号（null=startDate 自动算）| ✅ 复用 |
| `lagPracticeDaysExpected` | 掉队检测·近 2 周期望打卡天数（taskLag 分母，默认 10）| ✅ 复用 |

保留字段：`joinCode` / `name` / `courseId`（语义更新为「当前主修法本」，辅导员可切换）。

#### 新增字段（归档三件套）

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `status` | String | `active`（默认）/ `archived`（归档）；归档后不接受新成员、不产生新课表/出勤 | **新增** |
| `archivedAt` | DateTime? | 归档时间 | **新增** |
| `archivedBy` | String? | 归档操作人 userId | **新增** |

```prisma
model Class {
  // ... 旧设计现有字段保留（joinCode / name / courseId 等）...
  // ... §2.2 扩展 6 字段保留（programId/startDate/city/timezone/
  //     currentWeekOverride/lagPracticeDaysExpected）...

  // 新增（D19 归档，不物理删除）
  status     String    @default("active")  // active / archived
  archivedAt DateTime?
  archivedBy String?   // 归档操作人 userId

  // 新建表反向关联（§三 新建区各表写入时补）
  snapshots          SemesterSnapshot[]
  advancementChecks  AdvancementCheck[]
  advancementRecords AdvancementRecord[]
  assistantAssignments AssistantAssignment[]
  confessions        ReportConfession[]
  leaveRequests      LeaveRequest[]
}
```

#### 归档规则（D19）

- 班级**不可物理删除**：承载学员出勤/报数/成绩等大量历史事件，删除违反 D18
- 只能**归档**：`status='archived'` 后不接受新学员加入、不产生新课表和出勤，但历史数据完整保留、管理端可查
- 归档触发：本届所有学员升学或退出后，由**管理员手动**归档（不自动触发）

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 归档后禁止新成员/新课表/新出勤 | 应用层 | `status='archived'` 时拦截写操作 |
| 归档手动触发 | 应用层 | 系统不自动归档；class_admin+ 手动操作 |
| 不物理删除（D19）| 应用层 | 无 delete API；只能 `status=archived` |
| `status` 枚举 | 应用层（或 Prisma enum）| 只允许 active/archived |

---

### 1.11 Course（法本/课程）✅ 已封板

**服务能力**：能力 1（专业课程归属）+ 能力 3（闻思圆满 + 课程类型）+ 能力 10（考试范围）+ 能力 17（传承）
**写权限**：`subject_admin` 及以上（课程内容/类型属学科配置）
**参考决策**：D3（课程类型数据驱动）、能力 3 规则 2、DR-65（修订）、DR-93

> **判定（DR-65 修订，2026-05-30）**：旧设计 §2.2 已扩展 5 字段（author/isTantric/programSemesterId/category/tantricGroupId），原判 ✅ 复用（§四）。TODO-15 核对能力 3 规则 2 发现：课程有 entry/formal/restricted **三种教学阶段类型**，但 Course 无字段承载（category 只表内容性质 dharma_text/self_study_book）。**新增 `courseType` 字段**，故从复用区移入扩展区，改判 🔧 扩展。

#### 旧设计 5 扩展字段（全部复用，见 §四 Course 复用说明）

`author` / `isTantric` / `programSemesterId` / `category` / `tantricGroupId` —— 字段不改，详见 §四。

#### 新增字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `courseType` | String | `entry`（第1学期入门课）/ `formal`（第2-8学期主修课）/ `restricted`（第2-7学期限制性辅助课，不进考试）；默认 `formal`，能力 3 规则 2 | **新增** |

```prisma
model Course {
  // ... 旧设计现有字段保留 ...
  // ... §2.2 扩展 5 字段保留（author/isTantric/programSemesterId/category/tantricGroupId）...

  // 新增（能力 3 课程类型维度，DR-93）
  courseType String @default("formal")  // entry / formal / restricted
}
```

#### 两维度正交说明

| 维度 | 字段 | 取值 | 用途 |
|---|---|---|---|
| 教学阶段 | `courseType` | entry / formal / restricted | 闻思圆满路径、考试范围 |
| 内容性质 | `category` | dharma_text / self_study_book | 闻思页分组、自学读物复用 |

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `courseType` 枚举 | 应用层（Zod）| 只允许 entry / formal / restricted |
| 考试范围排除规则 | 应用层 | 进考试 = `courseType ∈ {entry, formal}`；排除 `courseType=restricted` **和** `category=self_study_book`（TODO-15 闭合，DR-93）|
| 闻思圆满按 courseType 分路径 | 应用层 | 正式/入门课需答题；限制性课无答题要求（DR-92 判定矩阵依赖此字段）|
| 不物理删除（D18）| 应用层 | 课程停用走 isActive，无 delete |

#### 设计意图

courseType（教学阶段）与 category（内容性质）正交（DR-93）：大学演讲系列 18 本既是 `category=self_study_book` 又通常 `courseType=restricted`，两维度独立标注、各管各的判定。考试范围与闻思圆满判定（DR-92）均依赖 courseType——这是 TODO-15 与 DR-92 共同的字段缺口，本次一并补齐。

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

> **role 严格为 02 文档四大管理角色**（DR-82 回滚，2026-05-29）：02-roles-and-permissions-v1.md §一 角色表只有 class_tutor/class_admin/subject_admin/super_admin 四个（+student 非管理角色）。辅助员（能力 13）在 02 文档**不是 role**，仅作为职能 #19 的操作对象存在；本表 role 不含 class_assistant，辅助员独立建表 §3.6 AssistantAssignment。

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

> 注：ProgramAdvancementConfig 为核对能力 10 时新增（升学条件数据化，存法二）；EnrollmentStatusHistory 为核对能力 11 时新增（入学状态变更永久留痕，D18）；ClassSessionSchedule 为核对能力 8 时新增（课表模板层，双轨发起）；ClassTask 为核对能力 9 时新增（辅导员布置班级任务，独立于发愿系统）。新建区由 12 张逐步扩展至 16 张；UserRoleAssignment（移入 §二 2.1）和 TransmissionRecord（移入 §二 2.3）从新建区迁出后，最终定为 14 张。（AssistantAssignment 曾短暂并入 §2.1，后核对 02 文档角色定义回滚为独立表，仍计入 14 张，DR-82。）TODO 处理阶段新增 §3.15 LeaveRequest（班级成员请假审批，TODO-6，DR-90），新建区更新为 **15 张**。

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

### 3.2 RoleAssignmentHistory（角色变更留痕）✅ 已封板

**服务能力**：能力 18（角色与权限）+ 能力 20（审计）
**写权限**：系统自动写入（每次 UserRoleAssignment 状态变更时追加；seed 建时 changedBy=`system`）
**参考决策**：D8（多角色+作用域）、D18（append-only 不物理删除）、DR-75

> **设计意图**：与 §3.12 EnrollmentStatusHistory 对称——一个记「角色任命/撤销」链路，一个记「入学状态」链路。UserRoleAssignment 上的 `assignedAt/revokedAt` 是当前状态快照（最近一次），本表存**完整变更链**（任命→撤销→再任命…）。反向关联 `assignment UserRoleAssignment` 与 §2.1 UserRoleAssignment 的 `history RoleAssignmentHistory[]` 成对。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `assignmentId` | String | 关联 UserRoleAssignment |
| `action` | String | `assigned`（任命）/ `revoked`（撤销）/ `reactivated`（重新激活）|
| `role` | String | **冗余**：变更那一刻的角色（class_tutor/class_admin/subject_admin/super_admin）|
| `classId` | String? | **冗余**：变更那一刻的班级作用域 |
| `programId` | String? | **冗余**：变更那一刻的专业作用域 |
| `changedAt` | DateTime | 变更时间，默认 now() |
| `changedBy` | String | 操作人 userId（seed 建时 `system`）|
| `reason` | String? | 变更原因（撤销原因等）|

#### Prisma schema

```prisma
model RoleAssignmentHistory {
  id           String   @id @default(cuid())
  assignmentId String
  action       String   // assigned / revoked / reactivated
  role         String   // 冗余：变更那一刻的角色
  classId      String?  // 冗余：变更那一刻的班级作用域
  programId    String?  // 冗余：变更那一刻的专业作用域
  changedAt    DateTime @default(now())
  changedBy    String   // 操作人 userId；seed 建时 "system"
  reason       String?

  assignment UserRoleAssignment @relation(fields: [assignmentId], references: [id])

  @@index([assignmentId])
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@index([assignmentId])` | DB | 按授权记录查变更链 |
| role/classId/programId 冗余存当时值 | 应用层 | 审计快照不可变，与后续 UserRoleAssignment 改动解耦（DR-75）|
| 不可删除/修改（D18）| 应用层 | append-only，无 update/delete API |

#### 设计意图

审计场景要能回溯「那一刻这个人是什么角色、管哪个班」，即使后来 UserRoleAssignment 被改/撤销也不影响历史快照。故 role/classId/programId 冗余存变更那一刻的值，不靠运行时 join 当前值（join 读到的是当前值，非历史值）。与 §3.12 EnrollmentStatusHistory（按 memberId 查）同套路，但本表按 assignmentId 查角色变更链。

---

### 3.3 StudentSpecialStatus（特殊身份）✅ 已封板

**服务能力**：能力 12（特殊身份学员关怀）
**写权限**：`class_admin` 及以上认定/撤销（职能 #13「学员特殊身份变更认证」）；辅导员无权
**参考决策**：D18（认定/撤销永久留痕）、能力 12、DR-76、DR-77

> **关键约束**：身份**只有 `blind`/`deaf` 两种，不可扩展**（能力 12 绝对约束 #1）。其他任何特殊情况一律走能力 5 管理员代行豁免，不进本表。
>
> **两类语义范围**（DR-92，2026-05-30）：`blind` = **视觉障碍类**（涵盖盲 / 低视力 / 文盲，统一走能力 3「纯听 ≥2 遍」圆满路径）；`deaf` = **听觉障碍类**（涵盖聋 / 听障，统一走「纯看 ≥2 遍」路径）。大纲能力 3 路径表的细分身份（盲/低视力/文盲、聋/听障）由这两类语义覆盖，不增 statusType，符合本约束。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `userId` | String | 被认定学员 |
| `statusType` | String | `blind`（盲）/ `deaf`（聋）——仅两值，应用层强校验 |
| `status` | String | `active`（生效）/ `revoked`（已撤销），默认 active |
| `recognizedAt` | DateTime | 认定时间，默认 now() |
| `recognizedBy` | String | 认定人 userId（class_admin+）|
| `revokedAt` | DateTime? | 撤销时间 |
| `revokedBy` | String? | 撤销人 userId |
| `note` | String? | 认定/撤销备注 |

#### Prisma schema

```prisma
model StudentSpecialStatus {
  id           String    @id @default(cuid())
  userId       String
  statusType   String    // blind / deaf（仅两值，不可扩展）
  status       String    @default("active")  // active / revoked
  recognizedAt DateTime  @default(now())
  recognizedBy String    // 认定人 userId（class_admin+）
  revokedAt    DateTime?
  revokedBy    String?
  note         String?

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, statusType])  // 同一人同一类型唯一；撤销后重认走复活
  @@index([userId])
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([userId, statusType])` | DB | 同一人同一类型一条记录；可同时盲+聋（两条），撤销后重认复活同行（DR-77）|
| statusType ∈ {blind, deaf} | 应用层 | 能力 12 绝对约束 #1，不可扩展 |
| 认定限 class_admin+ | 应用层 | 职能 #13 |
| 撤销走 status='revoked'，不物理删（D18）| 应用层 | 历史记录永久保留，无 delete API |
| 闻思路径自动切换 | 应用层 | active 的 blind/deaf → 能力 3 圆满判定按身份分支 |
| 与 User.accessibilityNeeds 双写同步 | 应用层 | 认定/撤销时同步更新 User.accessibilityNeeds 快照（DR-76）|

#### 设计意图（与 User.accessibilityNeeds 的关系）

本表与 §1.9 `User.accessibilityNeeds String[]` 是「留痕表 + 快照」关系（同 §3.12 EnrollmentStatusHistory 与 ClassMember.statusChanged* 模式）：

- **StudentSpecialStatus** = 认定**过程**留痕——谁认定、何时、撤销历史，append-only 永久保留（D18）
- **User.accessibilityNeeds** = 当前生效状态的**快照**——能力 3 闻思判定直接读，无需 join 本表，性能优先

认定/撤销时应用层事务同步双写：写本表一条记录 + 更新 User.accessibilityNeeds 数组（加/移除对应值）。闻思圆满判定只读快照，审计/历史查本表。

#### 能力 3 闻思圆满判定矩阵（TODO-8 闭合，DR-92）

> 纯应用层判定逻辑，数据源已就位：「听/看」次数来自 LessonCompletion（type），「答题」来自 UserAnswer，「身份」来自 User.accessibilityNeeds 快照。

**维度映射**：
- **听** = `COUNT(LessonCompletion WHERE type IN ('audio','video'))` —— **音频或视频任一都算一次「听」**（TODO-8 核心：二选一合并，不分别要求）
- **看** = `COUNT(LessonCompletion WHERE type='read')`
- **答题** = UserAnswer 全部思考题完成

**判定矩阵**：

| 身份（accessibilityNeeds）| 正式课 / 入门课圆满 | 限制性课圆满 |
|---|---|---|
| 健全（空）| 听 ≥1 且 看 ≥1 且 答题 | 听 ≥1 且 看 ≥1 |
| 含 `blind`（视障类：盲/低视力/文盲）| 听 ≥2（**豁免看、豁免答题**）| 听 ≥2 |
| 含 `deaf`（听障类：聋/听障）| 看 ≥2（**豁免听、豁免答题**）| 看 ≥2 |

> 同时 blind+deaf（双重残疾，极罕见）：大纲无对应路径，**不自动判定**，走能力 5 管理员代行个案豁免（D17 留痕）。身份变更后新课按新身份判定，历史圆满记录按当时身份保留（能力 3 绝对约束 #3）。

---

### 3.4 CareWatchlistItem（关怀清单条目）✅ 已封板

**服务能力**：能力 14（学员关怀清单）
**写权限**：系统自动触发写入；`class_tutor` 及以上可手动添加/移除（按作用域 D8）
**参考决策**：D3（阈值数据化）、D18（条目留痕）、能力 14、DR-78、DR-79

> **分工**：CareWatchlistItem 存**清单条目（触发信号）**；§二 2.2 CareFollowupRecord 存**跟进备注**（sourceType=care_watchlist 关联本表，sourceType=special_status 关联 §3.3）。一个清单条目可有多条跟进记录。

> **核心设计——「活跃信号」+「留痕」分离**：清单条目有生命周期（触发→活跃→解除），但 D18 要求不物理删除，故移除走 `status=resolved` 不删行。一个学员可同时有多个触发原因 → 每个原因一条记录，逐条解除。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `userId` | String | 被关怀学员 |
| `classId` | String? | 班级作用域（清单按班查）|
| `triggerType` | String | 触发原因，见下方取值 |
| `triggerSource` | String | `auto`（系统触发）/ `manual`（辅导员手动添加）|
| `status` | String | `active`（待跟进）/ `resolved`（已解除），默认 active |
| `triggeredAt` | DateTime | 触发时间，默认 now() |
| `triggeredBy` | String? | 手动添加=操作人 userId；自动触发=null |
| `reason` | String? | 触发说明 / 手动添加原因 |
| `resolvedAt` | DateTime? | 解除时间 |
| `resolvedBy` | String? | 解除人（自动解除=system，手动=userId）|

#### triggerType 取值

| 值 | 触发场景 | 来源能力 | 解除方式 |
|---|---|---|---|
| `practice_lag` | 日常功课连续未打卡达阈值 | 能力 7 | 自动（补打卡）|
| `attendance_low` | 共修出勤不足门槛 | 能力 8 | 自动（出勤达标）|
| `report_overdue` | 报数节点逾期未提交 | 能力 9 | 自动（补报）|
| `false_report` | 虚报被管理员标记 | 能力 9 | **手动**（管理员，不自动）|
| `study_lag` | 闻思进度明显滞后达阈值 | 能力 3 | 自动（追上进度）|
| `special_status` | 特殊身份（盲/聋）| 能力 12 | 跟随特殊身份（撤销才移除）|
| `manual` | 辅导员手动添加 | 能力 14 | **手动**（添加人或更高级）|

#### Prisma schema

```prisma
model CareWatchlistItem {
  id            String    @id @default(cuid())
  userId        String
  classId       String?
  triggerType   String    // practice_lag / attendance_low / report_overdue / false_report / study_lag / special_status / manual
  triggerSource String    // auto / manual
  status        String    @default("active")  // active / resolved
  triggeredAt   DateTime  @default(now())
  triggeredBy   String?   // 手动=操作人；自动=null
  reason        String?
  resolvedAt    DateTime?
  resolvedBy    String?

  user        User                 @relation(fields: [userId], references: [id])
  followups   CareFollowupRecord[]
  confessions ReportConfession[]

  @@index([userId])
  @@index([classId, status])
  // 同人同类型最多一条 active：用 partial unique index（status='active'），见约束，不用三列 @@unique
}
```

> **Partial unique index**（应用层 migration 补）：`CREATE UNIQUE INDEX ON care_watchlist_items (user_id, trigger_type) WHERE status = 'active';`——保证同人同类型同时只有一条 active，但允许历史多条 resolved（DR-78）。

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 同人同类型最多一条 active | DB（partial unique index）| `WHERE status='active'`；允许多条 resolved 历史；不能用三列 @@unique（resolved 多行会冲突，DR-78）|
| 触发阈值数据化 | 应用层/配置 | D3；practice_lag/attendance_low/study_lag 阈值即 TODO-1 要数据化的那批，复用 TODO-1，不新开待办（DR-79）|
| false_report / manual 不自动移除 | 应用层 | 虚报由管理员手动解除；手动条目由添加人/更高级解除（能力 14 §5）|
| 解除走 status=resolved，不物理删（D18）| 应用层 | 条目历史永久保留 |
| 备注学员不可见 | 应用层 | 跟进备注在 CareFollowupRecord，内部日志（能力 14 约束 #2）|

#### 设计意图

清单 = 「系统发现问题 → 人工跟进」的桥梁。条目记触发信号（哪个学员、什么原因、何时），跟进记录（CareFollowupRecord）记辅导员处理动作；一对多关联。自动触发条件解除时系统置 resolved（保留历史），多原因叠加时逐条解除。虚报（false_report）和手动条目（manual）不自动移除，符合能力 14 §5。

---

### 3.5 ClassInviteCode（邀请码）✅ 已封板

**服务能力**：能力 19（班级邀请码）
**写权限**：`class_admin` 及以上生成/撤销（职能 #5「班级邀请码管理」）；辅导员只读（R）
**参考决策**：D11（邀请码+时效）、D18（生成/撤销留痕）、能力 19、DR-80、DR-81

> **核心约束**：必须有过期时间（**不允许永久码**，能力 19 绝对约束 #1）；撤销/过期/超次数**只影响新加入，不影响已加入学员**（约束 #2/#6）。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `code` | String | 邀请码字符串，`@unique`，随机生成 |
| `classId` | String | 固定绑定一个班级 |
| `status` | String | `active` / `revoked`，默认 active（**过期不存状态，实时算**，DR-80）|
| `expiresAt` | DateTime | **过期时间，必填**（不允许永久码）|
| `maxUses` | Int? | 使用次数上限；null=不限人数 |
| `usedCount` | Int | 已使用次数，默认 0 |
| `createdBy` | String | 生成人 userId（class_admin+）|
| `createdAt` | DateTime | 默认 now() |
| `revokedAt` | DateTime? | 撤销时间 |
| `revokedBy` | String? | 撤销人 userId |

#### Prisma schema

```prisma
model ClassInviteCode {
  id        String    @id @default(cuid())
  code      String    @unique
  classId   String
  status    String    @default("active")  // active / revoked（expired 实时算，不存）
  expiresAt DateTime  // 必填，不允许永久码
  maxUses   Int?      // null = 不限人数
  usedCount Int       @default(0)
  createdBy String     // 生成人（class_admin+）
  createdAt DateTime  @default(now())
  revokedAt DateTime?
  revokedBy String?

  class Class @relation(fields: [classId], references: [id])

  @@index([classId, status])
}
```

> **过期状态**（DR-80）：`status` 只存 `active`/`revoked` 两个**人为**状态；`expired` 是 `expiresAt` 时间的客观推导，不入库、不靠定时任务维护。有效性校验 = `status='active' AND now() <= expiresAt AND (maxUses IS NULL OR usedCount < maxUses)`。能力 19 展示层的「三态」合成即可。

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `code` 唯一 | DB（@unique）| 随机生成防碰撞 |
| `expiresAt` 必填 | DB（非空）| 能力 19 绝对约束 #1，不允许永久码 |
| 校验=status active + 未过期 + 未超次数 | 应用层 | 使用时三重校验（过期实时算，DR-80）|
| 撤销/过期只影响新加入 | 应用层 | 已加入学员 enrollment 不受影响（约束 #2/#6）|
| 入班幂等 | 应用层 | 同人同班只有一条有效 enrollment，重复用码不重复建（约束 #4）|
| 码不可复用 | 应用层 | revoked/过期不可重新激活，需重新生成（#7）|
| 撤销走 status=revoked，不物理删（D18）| 应用层 | 生成/撤销留痕，无 delete API |

#### 设计意图（与旧 joinCode 的关系）

新表 ClassInviteCode **取代** Class 旧 `joinCode` 字段（DR-81）。旧 joinCode 是无时效的基础邀请，不满足 D11「邀请码必须有过期时间」。Class.joinCode 字段保留兼容（历史数据/旧链接），但**不再生成新码**——所有新邀请走 ClassInviteCode（带 expiresAt/maxUses/状态）。同 PracticeProject.scope 的「保留兼容、新系统不依赖」处理。能力 11 留级/回归的重新加入也走 ClassInviteCode（能力 19 被依赖项）。

---

### 3.6 AssistantAssignment（辅助员配对）✅ 已封板

**服务能力**：能力 13（辅助员配对）
**写权限**：`class_admin` 及以上配对/收回（职能 #19）；辅导员只读（R）
**参考决策**：D17（授予/收回留痕）、D18（配对永久留档）、能力 13、DR-82

> **关键定位**：辅助员**不属于四大管理角色**（02 文档角色表只有 4 个 role，辅助员不在其中），是 class_admin 委托的班级成员，作用域=本班全体，权限随时可收回。**独立建表**，不并入 UserRoleAssignment（DR-82）。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `classId` | String | 配对班级（作用域=本班全体）|
| `userId` | String | 被指定为辅助员的学员 |
| `status` | String | `active` / `revoked`，默认 active |
| `assignedAt` | DateTime | 配对时间，默认 now() |
| `assignedBy` | String | 配对人 userId（class_admin+）|
| `revokedAt` | DateTime? | 收回时间 |
| `revokedBy` | String? | 收回人 userId |
| `note` | String? | 备注 |

> **权限范围**：能力 13 §3 的 4 项权限（发起共修/发起班级法会/发布任务/监督学习只读）是**固定的角色权限集**（所有辅助员一致），由「是 active 辅助员」身份决定，**不在本表存权限字段**——同 UserRoleAssignment「角色定权限、不存 flag」。

#### Prisma schema

```prisma
model AssistantAssignment {
  id         String    @id @default(cuid())
  classId    String
  userId     String
  status     String    @default("active")  // active / revoked
  assignedAt DateTime  @default(now())
  assignedBy String    // 配对人（class_admin+）
  revokedAt  DateTime?
  revokedBy  String?
  note       String?

  class Class @relation(fields: [classId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@index([classId, status])
  @@index([userId])
}
```

> **同人同班 active 唯一**（partial unique index，应用层 migration 补）：`CREATE UNIQUE INDEX ON assistant_assignments (class_id, user_id) WHERE status = 'active';`——同 §3.4/§3.5 思路，允许多条 revoked 历史。

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 同人同班最多一条 active | DB（partial unique index）| `(classId, userId) WHERE status='active'` |
| 配对/收回限 class_admin+ | 应用层 | 职能 #19；辅导员只读（R）|
| 权限范围固定（4 项）| 应用层 | active 辅助员=固定权限集（共修/法会/任务/监督只读），不存权限字段 |
| 操作禁区（能力 13 §4）| 应用层 | 禁编辑/删除学员数据、禁认定特殊身份、禁审核报数/升学 |
| 作用域限本班 | 应用层 | 绝对约束 #1，不能操作其他班数据 |
| 收回走 status=revoked，不物理删（D18）| 应用层 | 配对/收回留痕（D17/D18），无 delete API |

#### 设计意图

辅助员是平行于四大角色的**委托机制**，02 文档明确「不属于四大管理角色」、角色表也无 class_assistant，故独立建表而非塞进 UserRoleAssignment（DR-82）。权限集固定、不可改数据、作用域本班——靠应用层按「是否 active 辅助员」授权，与角色继承体系解耦。

---

### 3.7 SemesterSnapshot（报数快照）✅ 已封板

**服务能力**：能力 6（报数与快照）+ 能力 10（升学资格预检，快照数据源）
**写权限**：系统自动生成（定时任务，节点截止时触发）；无人工写 API
**参考决策**：D3（数据驱动）、D18（无物理删除）、DR-83

快照在每个「汇报节点截止时刻」由系统冻结该学员当前的学修数据，作为节点评估的权威数据源。一旦生成不可修改；admin 事后更正走 AuditLog（§3.11），不改快照本身。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | **新增** |
| `userId` | String | 关联 User | **新增** |
| `classId` | String | 关联 Class（快照时所在班级）| **新增** |
| `programId` | String | 关联 Program（科系）| **新增** |
| `semesterNumber` | Int | 第几学期（科目内序号）| **新增** |
| `reportNodeIndex` | Int | 本学期第几个汇报节点（0-based）| **新增** |
| `snapshotData` | Json | 多维快照数据（见下方结构）| **新增** |
| `nodeDeadline` | DateTime | 本节点截止时刻（UTC）| **新增** |
| `generatedAt` | DateTime | 系统生成时刻，默认 now() | **新增** |

##### snapshotData JSON 结构

```json
{
  "lessonCompletion": { "read": 0, "audio": 0, "video": 0 },
  "meditationStats": { "sessions": 0, "totalMinutes": 0 },
  "innerPractice": [{ "type": "", "count": 0 }],
  "dailyPractice": [{ "projectName": "", "totalCount": 0 }],
  "attendance": { "groupAttend": 0, "speakingAttend": 0 },
  "taskCompletion": [{ "taskName": "", "rate": 0 }]
}
```

> 字段含义由科系类型决定（同 CohortWeeklySummary.summaryData 的 Json 模式）；不同科系结构可扩展，无需改表。

#### 关联

| 关联 | 说明 |
|---|---|
| `user User` | 必填，@relation(userId) |
| `class Class` | 必填，@relation(classId) |
| `program Program` | 必填，@relation(programId) |

> 实现时 Class/Program/User 须补对应反向关联 `snapshots SemesterSnapshot[]`。

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([userId, programId, semesterNumber, reportNodeIndex])` | DB | 同人同科系同节点只有一条快照 |
| `@@index([classId, semesterNumber])` | DB | 按班级+学期查全班快照 |
| 快照生成后不可修改 | 应用层 | 无 update API；事后更正走 AuditLog（D18）|
| 无 delete API | 应用层 | D18 永久档案，快照不可物理删 |

#### 设计意图

快照「冻结」原则（DR-83-B）：节点截止时刻系统拍一张学员当前学修数据的「照片」，之后此值不再变化——即使学员补报、admin 代行修正，历史评估结论不受影响。这与 RoleAssignmentHistory 存冗余快照（DR-75）的不可回溯审计原则一致。snapshotData 选 Json（DR-83-A）而非拆列：各科系维度不同（加行有座次，净土有念佛数），Json 灵活扩展、不改表；同 CohortWeeklySummary.summaryData 已验证此模式。

---

### 3.8 ReportConfession（虚报忏悔记录）✅ 已封板

**服务能力**：能力 9（学期报数）虚报治理规则 #10
**写权限**：学员自助提交（content/submittedAt）；管理员确认（status/reviewedBy/reviewedAt/adminNote）
**参考决策**：D17（代行留痕）、D18（忏悔记录永不删除）、能力 9 规则 #4、DR-84

虚报治理流程中，管理员标记虚报（CareWatchlistItem.triggerType=`false_report`）后要求学员提交书面忏悔，学员撰写正文提交记录；管理员审阅后确认（acknowledged）。拒绝忏悔 / 再次虚报的学员走职能 #14（取消资格），触发 ClassMember 状态变更 + AuditLog，与本表解耦。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | **新增** |
| `userId` | String | 提交忏悔的学员 | **新增** |
| `classId` | String | 所在班级 | **新增** |
| `watchlistItemId` | String? | 关联触发此忏悔的 CareWatchlistItem（false_report 类型）；可空（兼容不经过清单直接要求的情况）| **新增** |
| `content` | String | 书面忏悔正文（学员撰写）| **新增** |
| `status` | String | `submitted`（已提交待确认）/ `acknowledged`（管理员已确认，流程正常结束），默认 submitted | **新增** |
| `submittedAt` | DateTime | 提交时刻，默认 now() | **新增** |
| `reviewedBy` | String? | 确认的管理员 userId | **新增** |
| `reviewedAt` | DateTime? | 管理员确认时刻 | **新增** |
| `adminNote` | String? | 管理员批注 | **新增** |
| `createdAt` | DateTime | 创建时间，默认 now() | **新增** |

#### 关联

| 关联 | 说明 |
|---|---|
| `user User` | 必填，@relation(userId) |
| `class Class` | 必填，@relation(classId) |
| `watchlistItem CareWatchlistItem?` | 可空，@relation(watchlistItemId)；实现时 CareWatchlistItem 补反向 `confessions ReportConfession[]` |

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| status 枚举 | 应用层 | 只允许 submitted / acknowledged |
| acknowledged 必须有 reviewedBy/reviewedAt | 应用层 | 状态变更时校验字段完整性 |
| 无 delete API | 应用层 | D18，忏悔记录永久留档 |
| 拒绝忏悔不在本表记录（DR-84）| 应用层 | 学员拒绝即无记录；管理员走取消资格（职能 #14）+ AuditLog |

#### 设计意图

status 只有两态（`submitted`/`acknowledged`），不引入 `refused`/`escalated`（DR-84）：拒绝忏悔的学员本表无记录，管理员直接走取消资格 + AuditLog 留痕；「虚报处理必须先走忏悔流程，不可跳过」（能力 9 规则 #4）由应用层在取消资格前检查本表是否存在 submitted 记录来保障。

---

### 3.9 AdvancementCheck（升学资格预检报告）✅ 已封板

**服务能力**：能力 10（考试与升学）规则 5（系统自动预检）
**写权限**：系统自动生成（报数节点截止后触发）；管理员可更新 checkResults 豁免字段 + status=reviewed
**参考决策**：D3（条件数据化）、D13（硬条件不放宽）、D17（代行豁免留痕）、D18（不物理删除）、DR-85

报数节点截止 → 系统读 SemesterSnapshot + ProgramAdvancementConfig 自动跑 6 类条件预判 → 生成每人一张预检报告（本表）→ 管理员审阅，对 `isExemptable=true` 的失败条件走能力 5 代行豁免（更新 checkResults Json + 写 AuditLog）→ 管理员拍板升学 → AdvancementRecord（§3.10）。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | **新增** |
| `userId` | String | 被预检的学员 | **新增** |
| `classId` | String | 所在班级 | **新增** |
| `programId` | String | 关联 Program（科系）| **新增** |
| `semesterNumber` | Int | 第几学期 | **新增** |
| `reportNodeIndex` | Int | 本学期第几个汇报节点（0-based）| **新增** |
| `checkResults` | Json | 逐条条件判定结果（见下方结构）| **新增** |
| `overallPassed` | Boolean? | 系统预判汇总（null=计算中；true=全满足；false=有未达标）；豁免后重算 | **新增** |
| `status` | String | `pending`（已生成，管理员未审阅）/ `reviewed`（管理员已确认，已拍板写 AdvancementRecord），默认 pending | **新增** |
| `generatedAt` | DateTime | 系统生成时刻，默认 now() | **新增** |
| `reviewedBy` | String? | 审阅的管理员 userId | **新增** |
| `reviewedAt` | DateTime? | 管理员确认时刻 | **新增** |

##### checkResults JSON 结构

```json
[
  {
    "conditionKey": "practice_92",
    "conditionType": "practice_session",
    "label": "92 修法完成",
    "target": 92,
    "actual": 87,
    "passed": false,
    "exempted": false,
    "exemptedBy": null,
    "exemptedAt": null,
    "note": null
  }
]
```

> 管理员豁免时：更新对应条目 `exempted=true`、`exemptedBy`（管理员 userId）、`exemptedAt`，同步写 AuditLog（D17 留痕）。豁免后 `overallPassed` 重算（所有条件 passed=true OR exempted=true → true）。

#### 关联

| 关联 | 说明 |
|---|---|
| `user User` | 必填，@relation(userId) |
| `class Class` | 必填，@relation(classId) |
| `program Program` | 必填，@relation(programId) |
| `advancementRecord AdvancementRecord?` | 可空反向，@relation(advancementCheckId)（一检一记）|

> User/Class/Program 已在各表关联节补 `advancementChecks AdvancementCheck[]`。

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([userId, programId, semesterNumber, reportNodeIndex])` | DB | 同人同科系同节点只有一张预检报告 |
| `@@index([classId, semesterNumber])` | DB | 按班级+学期查全班预检 |
| 豁免前检查 isExemptable | 应用层 | 对应 ProgramAdvancementConfig.isExemptable=false 的条件不允许豁免（D13）|
| 豁免写 AuditLog | 应用层 | D17，每次豁免均留痕（操作人+原因）|
| 无 delete API | 应用层 | D18，预检报告永久留档 |
| 升学前检查 reviewed | 应用层 | AdvancementRecord 只能在 status=reviewed 的预检基础上创建 |

#### 设计意图

checkResults 选可变 Json（DR-85，方案 A）而非拆 AdvancementCheckItem 子表：豁免信息直接写入对应条目的 `exempted/exemptedBy/exemptedAt` 字段，AuditLog 同时记录操作人，无需独立表即可满足留痕要求（D17）。TODO-9（92 法逐法达标）、TODO-12（60 岁年龄豁免）、TODO-13（考试合格线矩阵）的**判定逻辑**在应用层跑预检时实现，本表字段层面已就位。

---

### 3.10 AdvancementRecord（升学记录）✅ 已封板

**服务能力**：能力 10（考试与升学）规则 6（升学审核流程）
**写权限**：班级管理员（class_admin+，职能 #16）；系统不自动写入，须人工拍板
**参考决策**：D13（硬条件不放宽）、D18（升学记录不物理删除）、DR-83-B（冻结原则）、DR-86

管理员审阅 AdvancementCheck（status=reviewed）后拍板：通过 → `result=passed`，填 `targetProgramId`，触发 ClassMember 加入新班级；驳回 → `result=rejected`，`targetProgramId=null`，留下驳回记录，学员留级走能力 11 流程。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | **新增** |
| `userId` | String | 升学的学员 | **新增** |
| `classId` | String | 升学前所在班级 | **新增** |
| `programId` | String | 升学前所在科系 | **新增** |
| `targetProgramId` | String? | 升入的科系（`result=passed` 时填；驳回为 null，DR-86）| **新增** |
| `advancementCheckId` | String | 关联 AdvancementCheck（一对一）| **新增** |
| `result` | String | `passed`（通过）/ `rejected`（驳回）| **新增** |
| `conditionsSnapshot` | Json | 升学拍板时各条件满足情况快照（冻结，同 DR-83-B）| **新增** |
| `decidedBy` | String | 管理员 userId（职能 #16）| **新增** |
| `decidedAt` | DateTime | 拍板时刻，默认 now() | **新增** |
| `note` | String? | 驳回理由或管理员批注 | **新增** |

#### 关联

| 关联 | 说明 |
|---|---|
| `user User` | 必填，@relation(userId) |
| `class Class` | 必填，@relation(classId) |
| `program Program` | 必填（升前科系），@relation("AdvancementFrom", programId) |
| `targetProgram Program?` | 可空（升入科系），@relation("AdvancementTo", targetProgramId) |
| `advancementCheck AdvancementCheck` | 必填，@relation(advancementCheckId) |

> Program 上须加两个具名反向关联：`advancementsFrom AdvancementRecord[]` 和 `advancementsTo AdvancementRecord[]`。AdvancementCheck 须补反向 `advancementRecord AdvancementRecord?`。

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `advancementCheckId @unique` | DB | 一张预检报告只能出一份升学记录 |
| `conditionsSnapshot` 冻结 | 应用层 | 写入后不可修改（同 DR-83-B，拍板时刻数据即真相）|
| 创建前检查 AdvancementCheck.status=reviewed | 应用层 | 管理员须先完成审阅预检流程再拍板 |
| 通过时 targetProgramId 必填 | 应用层 | result=passed 时校验 targetProgramId 非空 |
| 驳回时 targetProgramId 为 null（DR-86）| 应用层 | result=rejected 时不填升入科系 |
| 无 delete API | 应用层 | D18，升学记录永久留档 |

#### 设计意图

`conditionsSnapshot: Json` 冻结原则（DR-83-B 复用）：升学拍板那一刻的条件快照独立存储，即使后续 AdvancementCheck.checkResults 被更新或条件配置变更，历史升学依据不受影响。驳回不填 targetProgramId（DR-86-A）：驳回只记事实，不预判「本应升哪里」，避免误导；下一轮升学另起新 AdvancementCheck → AdvancementRecord 流程。

---

### 3.11 AuditLog（审计日志）✅ 已封板

**服务能力**：能力 20（决策审计日志）—— D18 底层基础设施
**写权限**：各能力执行高权限操作时主动写入（push model）；无人工写入 API
**参考决策**：D18（不可删除、不可编辑）、DR-87

统一记录全平台高权限操作的「谁、何时、对谁、做了什么、为什么」。覆盖 11 类操作（见 actionType）；不可删除、不可编辑；查询权限按角色作用域过滤（class_admin 看本班、subject_admin 看本科、super_admin 全平台）；学员可查自己相关条目。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | **新增** |
| `operatorId` | String | 操作人 userId（管理员）| **新增** |
| `operatedAt` | DateTime | 操作时刻，默认 now() | **新增** |
| `actionType` | String | 11 类操作类型（见下方）| **新增** |
| `targetType` | String | 作用对象类型（student / class / program / role / exam / transmission 等）| **新增** |
| `targetId` | String | 作用对象 ID（对应 model 的 cuid）| **新增** |
| `payload` | Json | 变更前后关键字段值快照（`{ "before": {...}, "after": {...} }`）| **新增** |
| `reason` | String | 操作理由（必填，D18 要求每次高权限操作留理由）| **新增** |
| `classId` | String? | 班级作用域（平台级操作为 null）| **新增** |
| `programId` | String? | 科系作用域（可空）| **新增** |
| `createdAt` | DateTime | 写入时刻，默认 now() | **新增** |

##### actionType 值域（11 类，来自能力 20 规则 1）

| 值 | 操作 | 来源能力 |
|---|---|---|
| `proxy_action` | 管理员代行（豁免/替代/调整/修正/追溯）| 能力 5 |
| `role_assignment` | 角色任命与撤销 | 能力 18 |
| `exam_grade` | 考试成绩录入与修改 | 能力 10 |
| `advancement_decision` | 升学审核（通过/驳回）| 能力 10 |
| `attendance_revoke` | 撤销学员出勤 | 能力 8 |
| `checkin_proxy` | 补打卡（管理员/辅导员代录）| 能力 8 |
| `special_status` | 特殊身份认定/变更/撤销 | 能力 12 |
| `disqualify_reporter` | 取消虚报学员资格 | 能力 9 |
| `invite_code` | 班级邀请码生成与撤销 | 能力 19 |
| `class_archive` | 班级归档 | 能力 11 |
| `transmission_proxy` | 传承/灌顶代录 | 能力 15/17 |

#### 索引

| 索引 | 说明 |
|---|---|
| `@@index([operatorId, operatedAt])` | 查某管理员的操作历史 |
| `@@index([targetType, targetId])` | 查某对象的全部操作（如某学员的所有代行）|
| `@@index([classId, actionType])` | 班级维度操作审计 |
| `@@index([programId])` | 科系维度审计 |

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `reason` 非空 | DB（String 非空）| D18 要求每条日志必须有理由 |
| 无 update / delete API | 应用层 | D18 绝对约束，写入后不可修改 |
| 查询权限按 classId/programId 作用域过滤 | 应用层 | 能力 20 规则 4，不允许越权查他班日志 |
| 学员只能查 targetId=自己的条目 | 应用层 | 能力 20 规则 5 |

#### 设计意图

**无 Prisma FK 关联**（DR-87）：AuditLog 是终态只写表，operatorId/targetId/classId/programId 均为裸 String，不加 @relation。原因：审计日志须自包含——即使关联对象发生任何变更（D18 下不物理删除，但避免 cascade 影响），历史日志仍可独立读取；无 FK 也让各能力写入时更简单（无需关心关联 model 是否存在）。payload Json 由写入方自行组装 `{ before, after }` 结构。

---

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

### 3.15 LeaveRequest（班级成员请假）✅ 已封板

**服务能力**：能力 11（留级、退出、转专业）→ 请假子流程；能力 14（掉队检测）→ approved 期间不计入窗口
**写权限**：学员自助申请；审批（approved/rejected）限 `class_tutor` 及以上（本班职能）
**参考决策**：D3（数据驱动）、D18（请假记录不物理删除）、DR-90

班级学员申请请假 → 辅导员及以上审批 → approved 期间从掉队判定窗口中扣除，不计入缺卡天数。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | **新增** |
| `userId` | String | 申请请假的学员 | **新增** |
| `classId` | String | 所在班级 | **新增** |
| `startDate` | DateTime | 请假开始日期（学员所在时区本地日期）| **新增** |
| `endDate` | DateTime | 请假结束日期（含）| **新增** |
| `reason` | String | 请假原因（必填）| **新增** |
| `status` | String | `pending` / `approved` / `rejected`，默认 pending；`expired` 实时算（到 startDate 仍 pending → 视为过期，DR-90-A）| **新增** |
| `requestedAt` | DateTime | 申请时刻，默认 now() | **新增** |
| `reviewedBy` | String? | 审批人 userId | **新增** |
| `reviewedAt` | DateTime? | 审批时刻 | **新增** |
| `adminNote` | String? | 审批批注 | **新增** |
| `createdAt` | DateTime | 创建时间，默认 now() | **新增** |

#### 关联

| 关联 | 说明 |
|---|---|
| `user User` | 必填，@relation(userId)；User 补反向 `leaveRequests LeaveRequest[]` |
| `class Class` | 必填，@relation(classId)；Class 补反向 `leaveRequests LeaveRequest[]` |

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| status 枚举 | 应用层 | 只存 pending/approved/rejected；expired 实时算（DR-90-A）|
| expired 实时算 | 应用层 | `startDate <= now() AND status='pending'` → 视为 expired，不入库（同 ClassInviteCode.expired 模式，DR-80）|
| approved 期间不计入掉队窗口 | 应用层 | CohortLagSnapshot 生成时扣除 approved 请假天数（DR-90-B）|
| 审批前检查班级状态 | 应用层 | 班级 archived 后不受理新请假申请 |
| 无 delete API | 应用层 | D18，请假记录永久留档 |

#### 设计意图

expired 不入库（DR-90-A）：startDate 截止前未审批的请假自动失效，由应用层实时判断（`status='pending' AND startDate <= now()`），同 ClassInviteCode.expired 模式（DR-80）——过期是客观时间推导，不需要定时任务维护。掉队豁免（DR-90-B）：approved 请假期间（startDate~endDate）学员打卡缺席属合理缺勤，CohortLagSnapshot 计算 lagWindowDays 内缺卡天数时扣除这段日期，避免合理请假被标掉队。

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
| ~~`Course`~~（已改判 🔧 扩展，移入 §1.11，加 courseType）| 能力 1/3/10/17 | 🔧 移入扩展区 |
| `Lesson`（课时，旧设计 +sourceText 版，详见下）| 能力 3 | ✅ 确认复用 |
| `Meditation`（观修，旧设计 +4 字段版，详见下）| 能力 3/4 | ✅ 确认复用 |
| `PracticeProject`（修持项目字典，旧设计 +2 字段版，详见下）| 能力 4/6/7 | ✅ 确认复用 |
| `ProgramSemester`（科目/学期，字段够用，详见下）| 能力 1 | ✅ 确认复用 |
| `PracticeLog` | 能力 4/6/7 | ✅ 确认复用（C 类批量，DR-72）|
| `PracticeTemplate` | 能力 4/6/7 | ✅ 确认复用（C 类批量，DR-72）|
| ~~`CohortRecommendedTemplate`~~ | 已移入扩展区 §1.8 | ✅ |
| `LessonCompletion` | 能力 3 | ✅ 确认复用（C 类批量，DR-72）|
| `PracticeJournal` | 能力 7 | ✅ 确认复用（C 类批量，DR-72）|
| `QuestionReference` | 能力 3 | ✅ 确认复用（C 类批量，DR-72）|
| `LessonResource` | 能力 3 | ✅ 确认复用（C 类批量，DR-72）|
| `LessonMediaChapter` | 能力 3 | ✅ 确认复用（C 类批量，DR-72）|
| `LessonTextBlock` | 能力 3 | ✅ 确认复用（C 类批量，DR-72）|
| `ProgramWeek` | 能力 1 | ✅ 确认复用（C 类批量，DR-72）|
| `ProgramWeekCourse` | 能力 1 | ✅ 确认复用（C 类批量，DR-72）|
| `ProgramWeekPractice` | 能力 1/4 | ✅ 确认复用（C 类批量，DR-72）|
| `ProgramStudyType` | 能力 8 | ✅ 确认复用（C 类批量，DR-72）|
| `CohortRestWeek` | 能力 8 | ✅ 确认复用（C 类批量，DR-72）|
| `Event` | 能力 15 | ✅ 确认复用（C 类批量，DR-72）|
| `EventCount` | 能力 15 | ✅ 确认复用（C 类批量，DR-72）|
| `TantricGroup` | 能力 15/17 | 🔧 微调（删 grants，补 transmissionRecords，详见下，DR-73）|
| `ContentChunk` | AI 助手 | ⏸ 暂缓（AI 模块，DR-74）|
| `FeatureEntry` | AI 助手 | ⏸ 暂缓（AI 模块，DR-74）|
| `AiConversation` / `AiMessage` / `AiUsage` | AI 助手 | ⏸ 暂缓（AI 模块，DR-74）|
| `SpeakingSession` | 能力 10 | ✅ 复用（classId 已可空，见下方说明）|
| `SpeakingRegistration` | 能力 10 | ✅ 确认复用（C 类批量，DR-72）|
| ~~`Exam`~~ | 已移入扩展区 §1.4 | ✅ |
| `CohortWeeklySummary` | 管理端 ⏸ 暂缓 | ✅ 确认复用（C 类批量，DR-72）|

#### Course 复用说明（🔧 已改判扩展，移入 §1.11）

> **改判（2026-05-30，DR-65 修订）**：Course 原判 ✅ 复用，但 TODO-15 核对能力 3 发现缺 `courseType`（entry/formal/restricted）字段，**新增字段后改判 🔧 扩展，移入 §1.11**。以下 5 个旧扩展字段仍全部复用不改（courseType 详见 §1.11）：

旧设计 §2.2 已将 Course 扩展为含 5 个新字段的版本，核对新设计（05/06）后**全部仍有效，字段不改**：

| 新增字段 | 用途 | 新设计下状态 |
|---|---|---|
| `author` | 造论者（如"索达吉堪布"/"寂天菩萨"），学员端展示用 | ✅ 有效（纯展示）|
| `isTantric` | 密法标识：未授权师兄所有查询零痕迹过滤；管理端不过滤 | ✅ 有效 |
| `programSemesterId` | 归属科目（ProgramSemester），通过科目派生 programId，不直接存 programId | ✅ 有效（三层 Program→ProgramSemester→Course，§1.1 已封板）|
| `category` | `dharma_text`（法本，默认）/ `self_study_book`（自学读物）| ✅ 有效（self_study_book 对应 §5.4 自学读物，复用 Course 全套）|
| `tantricGroupId` | 密法组（灌顶单位），仅 isTantric=true 时填；按组授权 | ✅ 有效 |

> **唯一注意点**：密法访问控制的**查询方式**已变（§二 2.3 废弃 TantricAccessGrant，改为 `EXISTS on TransmissionRecord(sourceType=empowerment)`，DR-44/45）。但这只影响「如何查授权」，**不影响 Course 表本身字段**——`tantricGroupId` 仍保留，用于标记法本所属密法组。Course 表字段完全照搬旧设计扩展版。

---

#### Lesson 复用说明

旧设计 §2.2 对 Lesson 仅扩展 1 个字段，核对新设计后有效，判 ✅ 复用：

| 新增字段 | 用途 | 新设计下状态 |
|---|---|---|
| `sourceText` | 法本原文正文（造论者所著），与现有 `referenceText` 并存，referenceText 不废弃 | ✅ 有效 |

其余字段保留（`referenceText` / `teachingSummary` 等闻思内容字段）。Lesson 服务能力 3（闻思圆满），新设计闻思打卡走 LessonCompletion、答题走 QuestionReference/UserAnswer（均在 §三/§四 处理），Lesson 表本身只承载课时内容字段，无新增需求，字段照搬旧设计扩展版。

---

#### Meditation 复用说明

旧设计 §2.2 对 Meditation 扩展 4 个字段（替代已删除的 PracticeGuide 表），核对新设计后全部有效，判 ✅ 复用：

| 新增字段 | 用途 | 新设计下状态 |
|---|---|---|
| `seriesKey` | 修法系列标识（如 `"92xiufa"`）| ✅ 有效 |
| `seriesNumber` | 第几法（92修法为 1-92；其他修法为 null）| ✅ 有效 |
| `isTantric` | 密法标识（同 Course，未授权学员查询全过滤）| ✅ 有效 |
| `tantricGroupId` | 密法组（灌顶单位），仅 isTantric=true 时填；按组授权 | ✅ 有效 |

**约束**：`@@unique([seriesKey, seriesNumber])`——保证 92 修法每一法唯一。其余字段保留（视频/转图PPT/章节/字幕/发布管理等）。

> **大纲核对佐证**（2026-05-29）：核对《预科19届大纲》§二.1 加行观修要求（92修法逐一观修）后确认，92修法分法记录正由 `seriesKey='92xiufa'` + `seriesNumber(1-92)` + `PracticeLog.meditationId` 实现，字段够用。**Meditation 表字段本身不受影响**——大纲核对发现的 3 个缺口（座次规则 TODO-7、音视频二选一 TODO-8、逐法达标预检 TODO-9）均属判定/配置逻辑层，非 Meditation 表结构问题。密法授权查询方式虽改用 TransmissionRecord（DR-44/45），但同 Course，不影响 `tantricGroupId` 字段。Meditation 字段完全照搬旧设计扩展版。
>
> **座次规则定调（2026-05-30，TODO-7 闭合，DR-91）**：核对能力 4 大纲原文（单修法 ≥3 座且 ≥90 分钟；总计 ≥276 座且 ≥138 小时；单座 ≥30 分钟）后，**废弃系统原 0.5 座制**（≥15min=0.5 违反大纲「30 分钟以下不能单独计数」绝对约束）。改为：**每座录入下界 30 分钟**（`minSessionMinutes`），每条 PracticeLog = 1 座；座数 = `COUNT(records)`、时长 = `SUM(durationMinutes)`，**双维度独立计**。放弃大纲「短座合并」便利（比大纲更严格，不违反硬约束）。UserPracticeVow.currentSessionCount 由 Decimal 改 Int，新增 currentSessionMinutes。

---

#### PracticeProject 复用说明

旧设计 §2.2 对 PracticeProject（修持项目字典：念佛/念咒/观修/读经等）扩展 2 个字段，核对新设计后有效，判 ✅ 复用：

| 新增字段 | 用途 | 新设计下状态 |
|---|---|---|
| `isTantric` | 密法标识：此项目产生的 PracticeLog 在管理端始终可见 | ✅ 有效 |
| `tantricGroupId` | 密法组（灌顶单位），仅 isTantric=true 时填；按组授权 | ✅ 有效 |

保留字段含 `scope`（旧字段，新系统不依赖，历史数据兼容）。PracticeProject 被 PracticeLog（`practiceProjectId`）、PracticeTemplate（`practiceProjectId`）、§5.3 约修（`practiceProjectId`）引用，是「修什么法」的字典表。密法授权查询方式同 Course/Meditation 迁 TransmissionRecord（DR-44/45），不影响字段。新设计对修持项目字典结构无新增需求，字段照搬旧设计扩展版。

> **关闭 TODO-3**（2026-05-29）：§5.3 约修 `PracticeAppointment.practiceProjectId` 此前为普通 String 字段无 @relation。PracticeProject 确认复用后，在其上补反向关联 `appointments PracticeAppointment[]`，并将 PracticeAppointment.practiceProjectId 升格为正式 FK（`practiceProject PracticeProject @relation(fields: [practiceProjectId], references: [id])`）。TODO-3 由此闭合。

---

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

#### TantricGroup 微调说明（🔧）

旧设计 TantricGroup（密法组/灌顶单位）字段本身有效复用，但**反向关联 `grants TantricAccessGrant[]` 已悬空**——TantricAccessGrant 在 §二 2.3 已废弃整合入 TransmissionRecord（DR-44/45）。本次微调：

| 项 | 变更 |
|---|---|
| `key` / `name` / `description` / `createdBy` / `createdAt` | ✅ 复用不动 |
| `courses Course[]` / `meditations Meditation[]` / `practiceProjects PracticeProject[]` | ✅ 复用不动（标记哪些内容属本密法组）|
| ~~`grants TantricAccessGrant[]`~~ | ❌ 删除（TantricAccessGrant 已废弃）|
| `transmissionRecords TransmissionRecord[]` | **新增反向关联**（TransmissionRecord.tantricGroupId → 本组，sourceType=empowerment 表达灌顶授权）|

```prisma
model TantricGroup {
  id          String   @id @default(cuid())
  key         String   @unique
  name        String
  description String?
  createdBy   String
  createdAt   DateTime @default(now())

  courses             Course[]
  meditations         Meditation[]
  practiceProjects    PracticeProject[]
  transmissionRecords TransmissionRecord[]  // 替代废弃的 grants：密法访问 = EXISTS active empowerment record
}
```

> 此微调闭合检查轮次 11 标记的已知项（TransmissionRecord 反向关联须替换）。密法访问控制改为 `EXISTS on TransmissionRecord(tantricGroupId, sourceType=empowerment, status=active)`（DR-44/45），不再查 grants。

---

## 五、⏸ 暂缓表（设计已落实，实现延后）

> 本区表示「设计已定稿、实现待排期」。每个功能已完整设计，可直接用于 Prisma schema，但不在当前迭代实现。

| 状态 | 家族 | 表数 |
|---|---|---|
| ✅ 设计封板 | §5.1 班级动态（ClassPost 家族） | 4 张 |
| ✅ 设计封板 | §5.2 班级讨论（Discussion 家族） | 4 张 |
| ✅ 设计封板 | §5.3 约修（PracticeAppointment 家族） | 2 张 |
| ✅ 设计封板 | §5.4 自学模式（UserSelfStudyProgram 家族） | 2 张 |

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

### 5.3 约修（PracticeAppointment 家族）✅ 设计封板

**⏸ 暂缓**：当前迭代不实现；以下设计可直接用于写 Prisma schema。

**服务能力**：集体约修（班级成员共同发起、参与并追踪集体修持目标），06 文档未列入 20 条能力；⚠️ 实现时需在 06 文档补入对应能力编号及职能矩阵条目。
**写权限**：
- 创建约修：班级 active 成员（任意成员均可发起，DR-58）
- 加入约修：班级 active 成员（`status=active` 的约修，未加入过）
- 贡献打卡：已加入且 `isActive=true` 的参与者（`personalTotal += n`，同步更新 `currentTotal`）
- 取消约修：创建者自己（`creatorId == session.userId`）**或** `class_admin` 及以上
- 退出约修：参与者自己（`isActive=false`，D18 不物理删，DR-59）
**参考决策**：D18（不物理删除）、DR-57~60

#### PracticeAppointment（约修）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `creatorId` | String | 创建者 userId（班级任意 active 成员）|
| `classId` | String | 关联 Class；仅本班成员可见 |
| `title` | String | 约修标题，如「三月上师瑜伽共修」|
| `practiceProjectId` | String | 修什么法（关联 PracticeProject）|
| `totalTarget` | Int | 集体总目标量 |
| `currentTotal` | Int | 缓存累计量，每次打卡后更新；默认 0 |
| `startDate` | DateTime? | 开始日期（可选）|
| `endDate` | DateTime | 截止日期，必填；到期定时任务自动关闭 |
| `description` | String? | 约修说明 |
| `status` | String | `active` / `completed`（达成）/ `expired`（到期未完成）/ `cancelled`（取消），默认 `active` |
| `createdAt` | DateTime | 默认 now() |

```prisma
model PracticeAppointment {
  id                String    @id @default(cuid())
  creatorId         String
  classId           String
  title             String
  practiceProjectId String
  totalTarget       Int
  currentTotal      Int       @default(0)
  startDate         DateTime?
  endDate           DateTime
  description       String?
  status            String    @default("active")
  // active | completed（目标达成）| expired（到期未完成）| cancelled（取消）
  createdAt         DateTime  @default(now())

  creator         User                           @relation(fields: [creatorId], references: [id])
  class           Class                          @relation(fields: [classId], references: [id])
  practiceProject PracticeProject                @relation(fields: [practiceProjectId], references: [id])  // TODO-3 闭合：正式 FK，PracticeProject 上补反向 appointments[]
  participants    PracticeAppointmentParticipant[]

  @@index([classId, status])
}
```

#### PracticeAppointmentParticipant（约修参与记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `appointmentId` | String | 关联 PracticeAppointment |
| `userId` | String | 关联 User（参与者）|
| `personalTotal` | Int | 个人累计贡献量，默认 0 |
| `isActive` | Boolean | 是否仍在参与；退出时置 false（D18 不物理删）|
| `joinedAt` | DateTime | 加入时间，默认 now() |
| `leftAt` | DateTime? | 退出时间（退出时填写）|

```prisma
model PracticeAppointmentParticipant {
  id            String    @id @default(cuid())
  appointmentId String
  userId        String
  personalTotal Int       @default(0)
  isActive      Boolean   @default(true)
  joinedAt      DateTime  @default(now())
  leftAt        DateTime?

  appointment PracticeAppointment @relation(fields: [appointmentId], references: [id])
  user        User                @relation(fields: [userId], references: [id])

  @@unique([appointmentId, userId])  // 同一约修同一人只有一条记录
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 加入防重 | DB（@@unique）| `@@unique([appointmentId, userId])` 保证每人只有一条参与记录 |
| 加入仅限 active 约修 | 应用层 | 写入前校验 `PracticeAppointment.status='active'` |
| 贡献仅限 isActive 参与者 | 应用层 | `isActive=false`（已退出）的参与者不可继续贡献打卡 |
| currentTotal 同步 | 应用层事务 | `personalTotal += n` 与 `currentTotal += n` 在同一事务内执行，防止数据不一致 |
| 自动关闭（completed）| 定时任务或写入时触发 | `currentTotal >= totalTarget` 时置 `status=completed` |
| 自动关闭（expired）| 定时任务（每日凌晨）| `endDate` 到期且 `status=active` → 置 `status=expired` |
| 不物理删除（D18）| 应用层 | 约修取消走 `status=cancelled`；退出走 `isActive=false`；无 delete API |
| 内容仅本班可见 | 应用层 | `classId` 强制按班级过滤 |

---

### 5.4 自学模式（UserSelfStudyProgram 家族）✅ 设计封板

**⏸ 暂缓**：当前迭代不实现；以下设计可直接用于写 Prisma schema。

**服务能力**：自学师兄的科系学习（无班级，按个人起修日 + 个人休息周计算进度），06 文档未列入 20 条能力；⚠️ 实现时需在 06 文档补入对应能力编号及职能矩阵条目。
**写权限**：
- 创建 UserSelfStudyProgram（入学）：`subject_admin` / `super_admin`（DR-61）
- `pace` 修改：学员自己
- `status=paused↔active`：学员自己（暂停/恢复自学）
- `status=abandoned`：`class_admin` 及以上
- `status=completed`：系统自动（所有课时完成时触发）
- 申报休息周（UserSelfStudyRestWeek）：学员自己，**自由申报、即时生效、无需审批**（DR-62）
- 撤销休息周申报：**不允许**（D18，记录锁定，DR-63）

> **休息审批 ≠ 自学休息周**（用户决策 2026-05-29）：休息审批机制确实需要，但**属于班级成员请假场景**（辅导员及以上审批），不在自学模式内。自学师兄自定节奏（pace），其休息周由本人自由申报、直接计入进度补足、无需任何审批。班级请假审批流另行设计（登记 §十 TODO-6）。

**参考决策**：D3（节奏可配置）、D18（不物理删除）、DR-61~64

#### UserSelfStudyProgram（自学科系记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `userId` | String | 自学学员 userId |
| `programId` | String | 关联 Program（科系）|
| `startDate` | DateTime | 个人起修日 |
| `pace` | String | `standard` / `fast` / `custom`，默认 standard；学员可调 |
| `status` | String | `active` / `paused` / `completed` / `abandoned`，默认 active |
| `createdAt` | DateTime | 默认 now() |
| `updatedAt` | DateTime | @updatedAt |

```prisma
model UserSelfStudyProgram {
  id        String   @id @default(cuid())
  userId    String
  programId String
  startDate DateTime
  pace      String   @default("standard") // standard / fast / custom
  status    String   @default("active")   // active / paused / completed / abandoned
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User                    @relation(fields: [userId], references: [id])
  program   Program                 @relation(fields: [programId], references: [id])
  restWeeks UserSelfStudyRestWeek[]

  @@unique([userId, programId])  // 一人一科系一条自学记录
}
```

#### UserSelfStudyRestWeek（个人休息周，自由申报）

> 沿用旧设计：`restStartDate + reason`，自学师兄自由申报、即时生效、无审批。所有申报的休息周直接计入进度补足。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `selfStudyId` | String | 关联 UserSelfStudyProgram |
| `restStartDate` | DateTime | 休息周开始日 |
| `reason` | String? | 休息理由（可选）|
| `createdAt` | DateTime | 默认 now() |

```prisma
model UserSelfStudyRestWeek {
  id            String    @id @default(cuid())
  selfStudyId   String
  restStartDate DateTime
  reason        String?
  createdAt     DateTime  @default(now())

  selfStudy UserSelfStudyProgram @relation(fields: [selfStudyId], references: [id])
}
```

#### 进度补足逻辑（自学进度算法）

> 自学进度算法 = 班级进度算法，但用**个人 startDate + 个人申报的休息周**（无审批，全部计入）。

**核心公式：**
```
有效学习天数 = (今天 − startDate) − Σ(已过去的申报休息周天数)
当前所在周   = ceil(有效学习天数 / 7)
```

**补足规则：**

| 休息周状态 | 进度处理 |
|---|---|
| 休息中（restStartDate ≤ 今天 < 休息结束）| 休息天数不计入有效天数；掉队预警暂停；课程内容仍可访问（学员可自主补课）|
| 已结束 | 休息天数从有效天数永久扣除；返回后当前周顺延，不产生假性落后 |

**示例**：起修日 1/1、每周 1 节，今天 3/1（约 8 周）；2 月申报 1 周休息 → 有效学习天数 = 59 − 7 = 52 天 → 第 8 周（非第 9 周）。第 8 周内容未完成才算落后。

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 一人一科系一条 | DB（@@unique）| `@@unique([userId, programId])` 防重 |
| 入学限管理员 | 应用层 | UserSelfStudyProgram 创建限 subject_admin/super_admin |
| 休息周自由申报、无审批 | 应用层 | 学员自助创建，即时生效，无 pending/审批环节（DR-62）|
| 休息周申报不可撤销 | 应用层 | 无 delete API；申报后记录锁定（D18）|
| 全部申报休息周计入补足 | 应用层 | 进度算法扣除所有已过去的申报休息天数 |
| status 不物理删（D18）| 应用层 | UserSelfStudyProgram 用 abandoned；休息周无删除接口 |

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
| 2026-05-29 | §5.3 约修（PracticeAppointment + PracticeAppointmentParticipant 2 张表）✅ 封板：方案 A 独立参与表（与 UserPracticeVow 完全解耦，DR-57）、创建权=班级任意成员（DR-58）、退出软删 isActive=false（DR-59）、贡献独立计数流（DR-60）；currentTotal 事务同步；§十 新增 TODO-3（practiceProjectId 待 PracticeProject 确认后补 FK）；§八 DR-57~60；§九 检查轮次 15（1 个问题→挂 TODO-3）|
| 2026-05-29 | §5.4 自学模式（UserSelfStudyProgram + UserSelfStudyRestWeek 2 张表）✅ 封板：入学限 subject_admin/super_admin（DR-61）、请假进度补足算法（DR-64）；§十 新增 TODO-5（Program 恢复反向关联）；§八 DR-61~64；§九 检查轮次 16；**§五 四组暂缓表全部设计封板** |
| 2026-05-29 | §5.4 修正（用户决策）：**自学模式不需要休息审批**——移除 UserSelfStudyRestWeek 的审批状态机（pending/approved/rejected/expired + expiresAt + processedBy + rejectReason），回归旧设计自由申报（restStartDate + reason）；学员自助申报、即时生效、不可撤销（DR-62/63 改写）；进度补足改为全部申报休息周计入；删除 TODO-4（审批时效），新增 TODO-6（班级成员请假审批流另行设计）；§九 检查轮次 16 同步更新 |
| 2026-05-29 | B 类核心表开始确认：§四 Course（法本/课程）✅ 复用——旧设计 §2.2 已扩展版（author/isTantric/programSemesterId/category/tantricGroupId 5 字段）核对后全部有效，字段不改；密法授权查询方式已迁 TransmissionRecord（不影响 Course 字段）；§八 DR-65；§九 检查轮次 17（0 问题）|
| 2026-05-29 | §四 Lesson（课时）✅ 复用——旧设计 §2.2 仅扩展 sourceText（法本原文，与 referenceText 并存），课时只承载内容字段，进度/答题走 LessonCompletion/QuestionReference，字段不改；§八 DR-66；§九 检查轮次 18（0 问题）|
| 2026-05-29 | 核对《预科19届学修大纲》（4 专业：加行/净土/入行论/学经）与系统完成情况：法本阅读/音频/视频/报数四项基本由 LessonCompletion + PracticeLog 覆盖；发现 3 个能力缺口记入 §十——TODO-7（加行座次计算规则与大纲不一致：系统含0.5座，大纲合并/封顶无0.5）、TODO-8（闻思「音频或视频」二选一须应用层判定，含盲/聋特殊圆满规则）、TODO-9（加行升学「92法逐法达标」预检粒度，AdvancementCheck §3.9 处理）；Meditation 表字段本身不受影响，缺口属判定/配置逻辑层 |
| 2026-05-29 | §四 Meditation（观修）✅ 复用——旧设计 §2.2 扩展 seriesKey/seriesNumber/isTantric/tantricGroupId 4 字段 + @@unique，大纲核对佐证 92 修法分法字段够用，缺口属判定层（TODO-7/8/9）不影响表结构；§八 DR-67；§九 检查轮次 19（0 问题）|
| 2026-05-29 | 大纲规则全面盘点：核对预科19届大纲全文 vs 06能力/08设计，找出 7 条未设计规则全部登记 §十——TODO-10（金刚萨埵代替顶礼换算/审批）、TODO-11（法王祈祷文补念状态机）、TODO-12 ⚠️（年龄60岁豁免，无字段无逻辑）、TODO-13 ⚠️（考试合格线多维矩阵：出勤档×开卷闭卷×次数×年龄）、TODO-14（兼修加行）、TODO-15（限制性课程不进考试范围）、TODO-16 ❌（转功德会，用户决策不做）；§八 DR-68（转功德会 ❌ 不做留痕）|
| 2026-05-29 | §四 PracticeProject（修持项目字典）✅ 复用——旧设计 §2.2 扩展 isTantric/tantricGroupId 2 字段，scope 保留兼容，字段不改；**顺手闭合 TODO-3**：§5.3 约修 practiceProjectId 升格正式 FK，PracticeProject 补反向 appointments[]；§八 DR-69；§九 检查轮次 20（1 问题→当轮闭合 TODO-3）|
| 2026-05-29 | §1.9 User 🔧 扩展封板——旧设计 13 字段全部复用 + **新增 birthDate**（年龄豁免数据源），从复用区移入扩展区（9→10 张）；正式写入 **60 岁年龄豁免规则**：做成「资格性、非自动」（年满 60 仅获免考资格，实际免考走能力 5 代行留痕 D17），区别于盲/聋强制豁免（能力 3 自动判定路径）；TODO-12 收窄为仅剩逻辑层（字段已就位）；§八 DR-70；§九 检查轮次 21（0 问题）|
| 2026-05-29 | §1.10 Class 🔧 扩展封板——旧设计 6 字段全部复用 + **新增归档三件套** status/archivedAt/archivedBy（D19），从复用区移入扩展区（10→11 张）；班级只归档（status=archived）不物理删除，归档后禁新成员/课表/出勤、手动触发、历史保留；§八 DR-71；§九 检查轮次 22（0 问题）；**B 类核心表全部完成**（Course/Lesson/Meditation/PracticeProject ✅ 复用，User/Class 🔧 扩展）|
| 2026-05-29 | C 类 §四 复用表确认完成：15 张批量 ✅ 复用（PracticeLog/PracticeTemplate/LessonCompletion/PracticeJournal/QuestionReference/LessonResource/LessonMediaChapter/LessonTextBlock/ProgramWeek/ProgramWeekCourse/ProgramWeekPractice/ProgramStudyType/CohortRestWeek/Event/EventCount/SpeakingRegistration/CohortWeeklySummary）；TantricGroup 🔧 微调（删悬空 grants TantricAccessGrant[]，补 transmissionRecords TransmissionRecord[]，闭合检查轮次 11 已知项）；AI 助手 5 张 ⏸ 暂缓（独立模块）；§八 DR-72~74；§九 检查轮次 23（1 问题→当轮闭合）；**§四 复用区全部确认完成** |
| 2026-05-29 | §三 新建区开始：§3.2 RoleAssignmentHistory（角色变更留痕）✅ 封板——与 §3.12 EnrollmentStatusHistory 对称的 append-only 留痕表；role/classId/programId 冗余存变更那一刻快照（审计可回溯，DR-75）；反向关联与 §2.1 UserRoleAssignment.history 成对；§八 DR-75；§九 检查轮次 24（0 问题）|
| 2026-05-29 | §3.3 StudentSpecialStatus（特殊身份）✅ 封板——blind/deaf 两类不可扩展（能力 12 绝对约束）；与 User.accessibilityNeeds 留痕+快照双写（认定过程留痕 vs 当前生效快照，DR-76）；@@unique([userId,statusType]) 防重、撤销后复活同行（DR-77）；认定/撤销限 class_admin+（职能 #13）；§八 DR-76~77；§九 检查轮次 25（0 问题）|
| 2026-05-29 | §3.4 CareWatchlistItem（关怀清单条目）✅ 封板——清单条目（触发信号）与 §2.2 CareFollowupRecord（跟进备注）一对多分工；triggerType 7 类（practice_lag/attendance_low/report_overdue/false_report/study_lag/special_status/manual）；同人同类型 active 唯一用 partial unique index（DR-78）；触发阈值复用 TODO-1（DR-79）；解除走 status=resolved 不删行（D18）；闭合检查轮次 10 反向关联已知项；§八 DR-78~79；§九 检查轮次 26（0 问题）|
| 2026-05-29 | §3.5 ClassInviteCode（邀请码）✅ 封板——expiresAt 必填保证 D11 时效（不允许永久码）；status 只存 active/revoked，expired 实时算不入库（DR-80）；取代旧 Class.joinCode（字段保留兼容、不再生成新码，DR-81）；撤销/过期只影响新加入、入班幂等；生成/撤销限 class_admin+（职能 #5）；§八 DR-80~81；§九 检查轮次 27（0 问题）|
| 2026-05-29 | §3.6 辅助员（能力 13）建模两轮定案：先尝试并入 §2.1 UserRoleAssignment（第 5 role class_assistant，轮次 28）→ 核对 02-roles-and-permissions-v1.md 发现角色表只有 4 个 role、无 class_assistant，能力 13 亦明确「辅助员不属四大角色」→ **回滚为独立表 AssistantAssignment**（轮次 29）。理由：并入会自创 02 文档未定义的第 5 角色，违反「以文档为准」铁律。独立表忠于文档语义，权限集固定在应用层，与角色体系解耦；§三 新建区维持 14 张；UserRoleAssignment.role 复归四大角色；§八 DR-82（记录两轮过程）；§九 检查轮次 28→29（回滚）|
| 2026-05-30 | §3.7 SemesterSnapshot（报数快照）✅ 封板——snapshotData=Json（DR-83-A，各科系维度不同，Json 跨科系灵活扩展，同 CohortWeeklySummary.summaryData 已验证模式）；快照冻结不可改（DR-83-B，节点截止时刻系统自动生成，admin 事后更正走 AuditLog 不改快照）；@@unique([userId,programId,semesterNumber,reportNodeIndex]) 保证每人每科系每节点唯一；无 update/delete API（D18 永久档）；§八 DR-83-A/B；§九 检查轮次 30（0 问题）|
| 2026-05-30 | **检查轮次 35 勘误**：检查项 9「升学条件可全查」原标 ✅ 过度乐观，下修为 🔵 部分——只验证了链路连通（有 ProgramAdvancementConfig 接住），未验证配置表达充分性（params 能否装下双维度逐法/多维合格线，挂 TODO-9/12/13）；且与 §十 ⚠️ 待决策标签自相矛盾未被检查项 7 抓出。方法论盲区（配置表达充分性 + 设计vs代码gap）并入 TODO-17 |
| 2026-05-30 | 核查达标/升学配置现状：backend 无 Program 层/无 ProgramAdvancementConfig/无达标配置（仅通用打卡目标）；新增 TODO-17（各学科达标条件+升学条件后台配置专题，含后台管理界面+学习情况提醒），汇总 TODO-9/12/13 配置承载，**置于本轮 TODO 闭合后专题设计** |
| 2026-05-30 | TODO-15 闭合：核查发现 Course 缺教学阶段维度，新增 courseType（entry/formal/restricted），Course ✅复用→🔧扩展移入 §1.11；考试范围排除 restricted+self_study_book；补齐 DR-92 闻思判定对 courseType 依赖；DR-65 修订；§一 扩展区 11→12 张；§八 DR-93；§九 检查轮次 41（0 问题）|
| 2026-05-30 | TODO-8 闭合：闻思圆满「音视频任一算听」（COUNT 合并）；判定矩阵落点 §3.3；StudentSpecialStatus blind=视障类/deaf=听障类覆盖大纲细分（不扩展 statusType，守 DR-76）；盲+聋走能力 5 代行；§八 DR-92；§九 检查轮次 40（0 问题）|
| 2026-05-30 | TODO-7 闭合：核对能力 4 大纲废弃 0.5 座制，定调「每座 ≥30 分钟、座数 COUNT/时长 SUM 双维度独立计」，放弃短座合并；§1.7 UserPracticeVow.currentSessionCount Decimal→Int + 新增 currentSessionMinutes；§八 DR-91；§九 检查轮次 39（0 问题，2 项实现遗留）|
| 2026-05-30 | TODO-6 闭合：新建 §3.15 LeaveRequest（班级请假审批）；expired 实时算（DR-90-A）；approved 期间不计入掉队窗口（DR-90-B）；User/Class 补反向 leaveRequests[]；§三 新建区 14→15 张；§八 DR-90-A/B；§九 检查轮次 38（0 问题）|
| 2026-05-30 | TODO-2 闭合：签到窗口基准改为 token 生成时刻（DR-89）；Program 补 checkinGraceMinutes（默认 30 分钟）；startAt 仅展示不参与签到；§1.6 约束注释同步；§九 检查轮次 37（0 问题）|
| 2026-05-30 | TODO-1 闭合：Program 补掉队阈值 4 字段（lagWindowDays/lagMild/lagModerate/lagSevereThreshold），与 Class.lagPracticeDaysExpected 构成两层配置；§八 DR-88；§九 检查轮次 36（0 问题）|
| 2026-05-30 | 全文档最终一致性检查（检查轮次 35）：修复 2 项——(1) Prisma 关联对称性：Program/User/Class/CareWatchlistItem/AdvancementCheck 补 6 处缺失反向关联；(2) §1.4 措辞精确化（ExamGrade 复用不动非扩展）。全文档设计封板，可进入实施阶段 |
| 2026-05-30 | §3.11 AuditLog（审计日志）✅ 封板——无 FK 裸 String（DR-87，终态只写表自包含）；11 类 actionType 覆盖能力 20 全部高权限操作；reason 必填；无 update/delete API（D18）；查询权限按角色作用域过滤；学员只查自己相关条目；§八 DR-87；§九 检查轮次 34（0 问题）；**§三 新建区 14 张全部封板** |
| 2026-05-30 | §3.10 AdvancementRecord（升学记录）✅ 封板——advancementCheckId @unique（一检一记）；conditionsSnapshot 冻结（DR-83-B 复用，拍板时刻数据即真相）；驳回 targetProgramId=null（DR-86，不预判「本应升哪里」）；Program 双具名关联（AdvancementFrom/AdvancementTo）；§八 DR-86；§九 检查轮次 33（0 问题）|
| 2026-05-30 | §3.9 AdvancementCheck（升学资格预检报告）✅ 封板——checkResults=Json 可变（DR-85，豁免字段写入对应条目 exempted/exemptedBy/exemptedAt + AuditLog D17 留痕）；overallPassed 豁免后重算（所有条件 passed OR exempted = true）；@@unique([userId,programId,semesterNumber,reportNodeIndex])；TODO-9/12/13 判定逻辑属应用层；升学前须检查 status=reviewed；§八 DR-85；§九 检查轮次 32（0 问题）|
| 2026-05-30 | §3.8 ReportConfession（虚报忏悔记录）✅ 封板——status 只有 submitted/acknowledged 两态（DR-84）；拒绝忏悔不在本表记录，管理员直接走取消资格（职能 #14）+ AuditLog 解耦；watchlistItemId 可空兼容不经 CareWatchlist 直接要求忏悔的情况；「先忏悔再取消资格」业务规则由应用层检查 submitted 记录保障；§八 DR-84；§九 检查轮次 31（0 问题）|

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
| DR-57 | 约修个人参与如何追踪 | 方案 A：新建 PracticeAppointmentParticipant 表（用户决策 2026-05-29）| 旧设计通过 UserPracticeVow(context=appointment, appointmentId) 追踪，但 appointmentId 已在 DR-32 从 UserPracticeVow 移除、context=appointment 未列入 DR-37 的 5 个值。方案 A 约修系统完全独立，PracticeAppointmentParticipant 存个人累计量，边界清晰。排除方案 B（context 补回 appointment）：DR-31 明确去掉 appointment，约修≠个人发愿，强行合并语义混乱。排除方案 C（只记集体总量）：用户无法看到自己的个人贡献，体验不完整 |
| DR-58 | 约修创建权限 | 班级任意 active 成员 | 旧设计注释「创建者（班级任意成员）」。约修是成员自发组织的集体行动，不属于管理权限范畴，任何 active 成员均可发起。排除「仅 class_tutor+」：辅导员主导才能发起会限制成员自发组织共修的灵活性 |
| DR-59 | 退出约修 D18 处理 | isActive=false + leftAt（不物理删）| 参与记录包含 personalTotal（贡献历史），是有价值的历史数据（D18）。退出不删行：isActive=false 标记退出，leftAt 记录退出时间；贡献量留档，退出后集体 currentTotal 不回退（已贡献的不撤回）。排除物理删行：会丢失个人贡献历史 |
| DR-60 | 约修贡献打卡与 PracticeLog/EventCount 的关系 | 独立计数流（不走 PracticeLog / EventCount）| 约修是「向集体目标贡献」，与日常修持愿（PracticeLog）和法会计数（EventCount）语义不同。独立流避免三套系统相互干扰。代价是同一次修持可能需要分别在两个地方记录（如果用户既有日常愿又参与约修）——这是方案 A 的已知 tradeoff（用户已确认接受） |
| DR-61 | UserSelfStudyProgram 创建（入学）权限 | subject_admin / super_admin（用户决策 2026-05-29）| 自学入学是科系级操作（决定某人开始自学某科系），属管理职责，由学科管理员及以上录入。排除「学员自助报名」：自学资格需审核，不应自助开通；排除「class_admin」：自学无班级归属，归科系管理更合理 |
| DR-62 | 自学休息周是否需要审批 | 不需要审批，学员自由申报、即时生效（用户决策 2026-05-29 修正）| 用户修正：「休息审批需要，但是自学模式不需要休息审批」。自学师兄自定节奏（pace 字段），是自主学习者，其休息周属个人安排，无须辅导员审批。原设计的审批状态机（pending/approved/rejected/expired + expiresAt + processedBy）全部移除，回归旧设计的简单申报（restStartDate + reason）。**休息审批机制确实需要，但属班级成员请假场景**（辅导员及以上审批），与自学解耦，另行设计（TODO-6）|
| DR-63 | 自学休息周申报是否可撤销 | 不可撤销（D18，用户决策 2026-05-29）| 申报即生效并影响进度计算，记录有审计价值，不提供删除/撤销接口。符合 D18 append-only。排除「允许撤销」：会引入物理删，且自学进度已据此重算，撤销会造成进度跳变 |
| DR-64 | 请假后进度落后如何补足 | 申报休息周天数从有效学习天数中扣除（用户决策 2026-05-29）| 用户决策「用户请假课程进度落后可以补足」。核心：有效学习天数 = (今天−startDate) − Σ申报休息天数，当前周由有效天数推算。自学无审批，全部已过去的申报休息周均计入补足，避免假性落后。休息中内容仍可访问（学员可自主补课），掉队预警暂停。此算法复用班级进度算法，仅数据源换成个人 startDate + 个人休息周（与旧设计注释「自学进度算法 = 班级进度算法」一致）|
| DR-65 | Course 在新设计下是否需要改字段 | ✅ 复用 5 字段不改；**后修订（2026-05-30）：新增 courseType 改判 🔧 扩展，移入 §1.11**（见 DR-93）| 旧设计 §2.2 已将 Course 扩展为含 author/isTantric/programSemesterId/category/tantricGroupId 5 字段的版本，核对 05/06 后全部仍有效，密法访问控制改 TransmissionRecord 不影响 Course 字段。**修订原因**：原判「字段不改」是基于当时未深查能力 3 课程类型——TODO-15 核对发现 entry/formal/restricted 三类型无字段承载（同 DR-92 判定矩阵的隐含依赖），补 courseType 后 Course 移入扩展区。这正是检查轮次 35 勘误指出的「设计 vs 业务要求充分性」盲区的一个实例 |
| DR-66 | Lesson 在新设计下是否需要改字段 | ✅ 复用，字段不改（用户决策 2026-05-29）| 旧设计 §2.2 仅扩展 sourceText（法本原文，与 referenceText 并存）。Lesson 服务能力 3（闻思圆满），但闻思打卡/答题分别走 LessonCompletion / QuestionReference（§三/§四 处理），Lesson 表只承载课时内容字段，新设计无新增需求。排除「新增进度/状态字段」：进度状态属 LessonCompletion 范畴，Lesson 不冗余存 |
| DR-67 | Meditation 在新设计下是否需要改字段 | ✅ 复用，字段不改（用户决策 2026-05-29）| 旧设计 §2.2 扩展 seriesKey/seriesNumber/isTantric/tantricGroupId 4 字段 + `@@unique([seriesKey, seriesNumber])`。大纲核对佐证 92 修法分法记录由 seriesKey+seriesNumber+PracticeLog.meditationId 实现，字段够用。大纲发现的 3 缺口（座次规则/音视频二选一/逐法达标）均属判定逻辑层，记 TODO-7/8/9，非 Meditation 表结构问题。密法授权同 Course 迁 TransmissionRecord，不影响字段。排除「在 Meditation 上加达标快照字段」：逐法达标是聚合计算结果，属 AdvancementCheck 范畴，不冗余存 |
| DR-68 | ❌ 转功德会（菩提功德会）是否做 | 不做（永久决策，用户决策 2026-05-29）| 大纲规定：取消学员资格后可转入菩提功德会。功德会是独立于觉学学修体系的组织/系统，「转功德会」属跨系统流程，超出觉学平台范围。觉学只负责到「取消学员资格」为止，之后是否入会、入会流程均不在本系统建模。排除「建功德会入会记录表」：会引入与学修无关的组织管理复杂度。登记 §十 TODO-16 仅为留痕「大纲此条已核对、明确排除」，非待办 |
| DR-69 | PracticeProject 在新设计下是否需要改字段 + TODO-3 处理 | ✅ 复用，字段不改；顺手闭合 TODO-3（用户决策 2026-05-29）| 旧设计 §2.2 扩展 isTantric/tantricGroupId 2 字段，scope 旧字段保留兼容。PracticeProject 是「修什么法」字典表，被 PracticeLog/PracticeTemplate/约修引用，新设计无新增需求。密法授权同 Course/Meditation 迁 TransmissionRecord，不影响字段。**顺手闭合 TODO-3**：PracticeProject 确认复用后，§5.3 约修 practiceProjectId 升格正式 FK，PracticeProject 补反向 appointments[]——TODO-3 的处理时机正是「PracticeProject 复用确认时」，故一并处理。排除「拆密法项目独立表」：isTantric 标识 + tantricGroupId 已足够区分，无需拆表 |
| DR-70 | User 是否纯复用 + 60 岁年龄豁免如何建模 | 🔧 扩展：新增 `birthDate`；年龄豁免做成「资格性、非自动」（用户决策 2026-05-29）| 旧设计 13 字段全部有效复用。但 60 岁免考是大纲硬规则、需年龄数据源，User 上无生日字段，故新增 `birthDate`，判 🔧 扩展（从复用区移入）。**关键区分**（用户决策）：盲/聋是身体缺陷→**强制**豁免（能力 3 自动切判定路径）；60 岁是**资格**豁免→年满 60 仅获免考资格，**不自动满足考试条件**，实际免考走能力 5 代行（管理员显式确认、留痕 D17）。理由：部分老人有能力正常完成加行/考试，应允许其正常考、正常计成绩，不能一刀切自动免。排除「年龄≥60 自动置 exam_score 满足」：会剥夺有能力老人正常应考的选择，且与「豁免是个案、可选、留痕」的能力 5 哲学冲突。birthDate 字段先就位，完整豁免逻辑在升学条件配置阶段做（TODO-12 收窄为仅剩逻辑层）|
| DR-71 | Class 是否纯复用 + 班级归档如何建模 | 🔧 扩展：新增归档三件套 status/archivedAt/archivedBy（用户决策 2026-05-29）| 旧设计 §2.2 已扩展 6 字段（programId/startDate/city/timezone/currentWeekOverride/lagPracticeDaysExpected）全部有效复用。但 D19 + 能力 11 §4 明确「班级只归档不物理删除（status: archived）」，旧设计 Class 无归档状态字段，能力 11「对老项目影响」也写明「老项目班级可能有删除操作，需改为归档」。故新增 status（active/archived）+ archivedAt + archivedBy，判 🔧 扩展（从复用区移入）。归档后不接受新成员/新课表/新出勤，历史完整保留；手动触发（不自动）。排除「物理删除班级」：违反 D18/D19，破坏出勤/报数/成绩历史完整性。排除「沿用 isActive 布尔」：归档需留痕（时间+操作人），布尔不够，用 status 字符串 + archivedAt/archivedBy 三件套 |
| DR-72 | C 类 §四 复用表（15 张）是否需要改字段 | ✅ 全部复用不动，批量确认（用户决策 2026-05-29）| 15 张表：PracticeLog/PracticeTemplate/LessonCompletion/PracticeJournal/QuestionReference/LessonResource/LessonMediaChapter/LessonTextBlock/ProgramWeek/ProgramWeekCourse/ProgramWeekPractice/ProgramStudyType/CohortRestWeek/Event/EventCount/SpeakingRegistration/CohortWeeklySummary。逐张核对新设计（05/06）后均无新增需求：日常打卡/模板/闻思完成/日记/思考题/课时资源/周排表/科系打卡声明/休息周/法会/法会计数/讲考报名/周汇总，结构旧设计已完整。Event.classId 可空（平台级/班级级）与 SpeakingSession 同套路已支持平台级法会。批量一条 DR 覆盖，避免逐张冗余 DR |
| DR-73 | TantricGroup 反向关联如何处理 | 🔧 微调：删 grants，补 transmissionRecords（用户决策 2026-05-29）| TantricGroup 字段本身有效，但 `grants TantricAccessGrant[]` 反向关联悬空——TantricAccessGrant 已在 DR-44 废弃整合入 TransmissionRecord。删除 grants，新增 `transmissionRecords TransmissionRecord[]`（TransmissionRecord.tantricGroupId 指向本组，sourceType=empowerment 表达灌顶授权）。密法访问控制改为 EXISTS on TransmissionRecord（DR-44/45）。此微调闭合检查轮次 11 标记的已知项。排除「保留 grants 空关联」：悬空关联指向已删除 model，Prisma 校验不通过 |
| DR-74 | AI 助手 5 张表（ContentChunk/FeatureEntry/AiConversation/AiMessage/AiUsage）是否纳入本次融合 | ⏸ 暂缓（独立 AI 模块，用户决策 2026-05-29）| AI 助手是独立功能模块（详见 docs/AI_ASSISTANT_PLAN.md），决策定型但未实施，依赖 pgvector 扩展，UI/Tier 2-4 均暂缓。不属本次「学修体系融合」范围。统一标 ⏸ 暂缓，不在本文档展开字段级设计；待 AI 模块独立推进时处理。排除「纳入本次复用确认」：AI 模块边界独立，混入会扩散本次融合范围 |
| DR-75 | RoleAssignmentHistory 角色/作用域字段是否冗余存当时值 | 冗余存变更那一刻的 role/classId/programId（用户决策 2026-05-29）| 审计要能回溯「那一刻这个人是什么角色、管哪个班」，UserRoleAssignment 后续被改/撤销不应影响历史快照。排除「只存 assignmentId，运行时 join 读当前值」：join 读到的是当前值非历史值，无法还原变更那一刻的真相，违反审计不可变原则。与 §3.12 EnrollmentStatusHistory 同为 append-only 留痕表，结构对称（一记角色链、一记入学状态链）|
| DR-76 | StudentSpecialStatus 与 User.accessibilityNeeds 的关系 | 留痕表 + 快照双写（用户决策 2026-05-29）| StudentSpecialStatus 存认定过程留痕（谁认定/何时/撤销历史，D18 append-only）；User.accessibilityNeeds 存当前生效快照（能力 3 闻思判定直接读，无需 join）。认定/撤销时应用层事务同步双写。同 §3.12 与 ClassMember.statusChanged* 的「留痕+快照」模式。排除「只保留一处」：只留 accessibilityNeeds 丢失认定历史（违反 D18）；只留 StudentSpecialStatus 则每次闻思判定要 join 查 active 记录，性能差 |
| DR-77 | StudentSpecialStatus 是否加 @@unique([userId, statusType]) | 加（用户决策 2026-05-29）| 一个人可同时盲+聋（两条记录，statusType 不同），但同一人同一类型不应有多条 active。`@@unique([userId, statusType])` 保证唯一；撤销后重新认定走复活同行（status: revoked→active），不新建重复行。同 ClassMember `@@unique([classId, userId])` 复活模式。排除「不加唯一约束」：重复认定会产生多条同类型记录，统计/判定混乱 |
| DR-78 | CareWatchlistItem「同人同类型最多一条 active」如何实现 | Partial unique index（WHERE status='active'）（用户决策 2026-05-29）| 不能用三列 `@@unique([userId, triggerType, status])`：D18 下解除走 status=resolved 不删行，同人同类型历史会有多条 resolved，三列唯一对 resolved 行会冲突报错。改用 PostgreSQL partial unique index `(user_id, trigger_type) WHERE status='active'`——只约束 active 唯一，resolved 历史不限条数。同 §2.1 super_admin NULL 唯一的应用层兜底思路。排除三列 @@unique：会阻止合法的多次「触发→解除」历史 |
| DR-79 | CareWatchlistItem 触发阈值是否新开待办 | 复用 TODO-1，不新开（用户决策 2026-05-29）| practice_lag/attendance_low/study_lag 的触发阈值就是 TODO-1（掉队判定阈值数据化）要处理的那批——CohortLagSnapshot 与 CareWatchlistItem 共用同一套掉队检测阈值（D3 专业配置项）。复用 TODO-1，避免重复登记。排除「新开待办」：同一组阈值两处登记会割裂，实现时易遗漏一致性 |
| DR-80 | ClassInviteCode 过期状态如何表达 | status 只存 active/revoked，expired 实时算（用户决策 2026-05-29）| status 存 active/revoked 两个**人为**状态；expired 是 expiresAt 时间的客观推导，查询时实时算（now()>expiresAt），不入库。排除「定时任务把过期 active 刷成 expired」：引入定时任务维护冗余状态，且过期是确定性时间推导无需持久化；能力 19 展示层「三态」合成即可。校验逻辑：status='active' AND now()<=expiresAt AND (maxUses IS NULL OR usedCount<maxUses）|
| DR-81 | ClassInviteCode 与旧 Class.joinCode 关系 | 新表取代，旧字段保留兼容不再生成新码（用户决策 2026-05-29）| 旧 joinCode 无时效，不满足 D11「邀请码必须有过期时间」。新表 ClassInviteCode 带 expiresAt/maxUses/status，取代 joinCode 成为唯一新邀请入口。Class.joinCode 字段保留兼容（历史数据/旧链接），但不再生成新码——同 PracticeProject.scope「保留兼容、新系统不依赖」处理。排除「物理删 joinCode 字段」：旧链接/历史数据可能仍引用，保留兼容更安全；排除「并存两套生成」：两套邀请入口会分裂校验逻辑、D11 时效无法统一保证 |
| DR-82 | 辅助员（能力 13）是否单建表 | **独立建表 AssistantAssignment**（用户决策 2026-05-29，经核对 02 文档后回滚定案）| 决策经历两轮：先尝试「并入 UserRoleAssignment 作第 5 个 role class_assistant」（图复用角色机制）；后核对 02-roles-and-permissions-v1.md §一——角色表**只有 4 个 role**（class_tutor/class_admin/subject_admin/super_admin）+ student，**class_assistant 不在其中**；能力 13 亦明确「辅助员不属于四大管理角色」，02 文档仅以职能 #19 的操作对象形式承载它。并入会让角色表自创一个文档未定义的第 5 角色，违反 CLAUDE.md「业务规则以 02/05/06 为准、不凭印象自创」铁律，且权限模型分裂（四大靠继承、辅助员靠固定权限集+禁区）。**回滚为独立表**：AssistantAssignment 单表，权限集固定在应用层，与角色体系解耦，忠于 02 文档语义。代价是重写一遍 status/留痕（可接受，配对量小、逻辑简单）。§三 新建区维持 14 张 |
| DR-83-A | SemesterSnapshot.snapshotData 字段类型 | **Json**（用户决策 2026-05-30）| 各科系汇报维度不同（加行有座次/顶礼，净土有念佛数，入行论有默写），若拆成独立列需为每个科系建不同 schema 或预留大量 nullable 列。Json 方案：一张表覆盖全部科系，维度差异封装在 Json 内，新科系扩展无需 migration；同 CohortWeeklySummary.summaryData 已验证此模式。排除「拆列」：过多 nullable 列且不同科系列集合不同，维护成本高于 Json |
| DR-83-B | SemesterSnapshot 快照值是否可改 | **冻结（不可改）**，事后更正走 AuditLog（用户决策 2026-05-30）| 快照目的是「在节点截止时刻留下永久数据证据」，若允许事后修改则历史评估结论失去可信基础（违背 D18 不删、不改的永久档原则）。admin 事后代行更正（如学员补报遗漏数据）只产生 AuditLog 条目说明更正原因和更正人，快照本身不变。排除「允许 admin 改快照」：一旦可改，任何历史争议时快照都不再是权威；排除「有限度可改+版本号」：引入版本机制复杂度高、且无此需求的业务场景 |
| DR-84 | ReportConfession status 是否包含「拒绝忏悔」状态 | **不包含**，status 只有 submitted/acknowledged（用户决策 2026-05-30）| 能力 9「拒绝忏悔」指学员拒绝提交、本表根本无记录，而非提交后再拒绝的中间状态。拒绝后走职能 #14 取消资格 → ClassMember 状态变更 + AuditLog 留痕，与 ReportConfession 表完全解耦。排除「status=refused」：学员拒绝时本表无记录（管理员无法写入 refused），引入该值无实际写入路径；排除「status=escalated」：取消资格是独立的 ClassMember 操作，不应耦合进忏悔记录的状态机。「虚报处理必须先走忏悔流程」（能力 9 规则 #4）由应用层在取消资格前检查本表是否有 submitted 记录来保障 |
| DR-92 | 闻思圆满「音视频二选一」判定 + StudentSpecialStatus 两类语义覆盖 | **音频或视频任一算「听」；blind=视障类、deaf=听障类覆盖大纲细分**（用户决策 2026-05-30，TODO-8 闭合）| 能力 3 大纲「听音视频」指音频或视频任一即满足「听」，但 LessonCompletion 的 audio/video 是两条独立 type。判定逻辑：听 = `COUNT(type IN audio,video)`、看 = `COUNT(type=read)`、答题 = UserAnswer，纯应用层聚合，字段已就位。身份覆盖：大纲路径表细分「盲/低视力/文盲」「聋/听障」，但 §3.3 statusType 只有 blind/deaf 两类（DR-76 不可扩展）；定 blind=视觉障碍类（含低视力/文盲，走纯听≥2）、deaf=听觉障碍类（含听障，走纯看≥2），两类语义覆盖细分。排除「扩展 statusType 增细分」（方案 B）：推翻 DR-76 能力 12 绝对约束，且细分对圆满路径无影响（同走纯听/纯看），两类已足够；盲+聋双重残疾大纲无路径，走能力 5 代行不自创规则。**补记（DR-93）**：判定矩阵「正式/入门课 vs 限制性课」依赖 Course.courseType 字段——此字段当时不存在，已在 §1.11 补齐 |
| DR-93 | Course 是否需要 courseType 字段（教学阶段类型）| **新增 courseType（entry/formal/restricted），与 category 正交**（用户决策 2026-05-30，TODO-15 闭合）| 能力 3 规则 2 定义课程三类型 entry/formal/restricted，但 Course 仅有 category（dharma_text/self_study_book，内容性质），无教学阶段维度。两者正交：courseType 管「闻思圆满路径 + 考试范围」，category 管「闻思页分组 + 自学读物复用」。考试范围排除 = `courseType=restricted OR category=self_study_book`。Course 因此从 ✅ 复用改判 🔧 扩展，移入 §1.11。排除「把 restricted 塞进 category 枚举」：混淆两个正交维度（一门课可同时是 self_study_book 和 restricted，单字段表达不了）；排除「不加字段、限制性课就用 self_study_book 代替」：能力 3 的 restricted 是「第2-7学期辅助课」，外延不等同 self_study_book（18本大学演讲系列），且 DR-92 闻思判定也需区分正式/限制性课 |
| DR-91 | 加行观修座次计算规则 | **废弃 0.5 座，每座录入下界 30 分钟，座数/时长双维度独立计**（用户决策 2026-05-30，TODO-7 闭合）| 核对能力 4 大纲原文：单修法 ≥3 座且 ≥90 分钟、总计 ≥276 座且 ≥138 小时、单座 ≥30 分钟，绝对约束「30 分钟以下不能单独计数」。系统原 0.5 座制（≥15min=0.5）直接违反此约束，须废弃。定调方案：每座录入下界 30 分钟（minSessionMinutes，应用层校验），每条 PracticeLog 观修记录 = 1 座（带 durationMinutes≥30）；**座数 = COUNT(records)、时长 = SUM(durationMinutes)，两维度独立计算**，互不折算。判定：单修法 `COUNT(WHERE meditationId=X)≥3 AND SUM(durationMinutes)≥90`。UserPracticeVow.currentSessionCount 由 Decimal 改 Int（座数无小数），新增 currentSessionMinutes（时长维度）。**取舍**：放弃大纲「短座 <30 分钟可合并报一座」便利——比大纲更严格（大纲是「可合并」非「必合并」），不违反硬约束，换取录入/计算的极大简化（无合并交互、双维度天然 COUNT/SUM）。排除「保留 0.5 座折算」（原方案 A）：直接违反大纲绝对约束，且 0.5 座语义混乱；排除「实现短座合并池」：引入合并操作交互与待合并状态，复杂度高，学员可自行坐满 30 分钟规避 |
| DR-90-A | LeaveRequest expired 状态存法 | **不入库，实时算**（用户决策 2026-05-30，TODO-6，同 DR-80 ClassInviteCode 模式）| status 只存 pending/approved/rejected；expired = `status='pending' AND startDate <= now()`，查询时实时推导，不靠定时任务。排除「写入 expired」：过期是确定性时间推导，维护定时任务引入额外复杂度 |
| DR-90-B | 请假是否影响掉队计算 | **影响：approved 期间从掉队窗口扣除**（用户决策 2026-05-30，TODO-6）| CohortLagSnapshot 生成时，approved 请假期间（startDate~endDate）内缺打卡天数不计入 lagWindowDays 内的缺卡统计，避免合理请假被标掉队。排除「不影响」：合理请假期间缺勤若被计入掉队会产生误判，且与 UserSelfStudyRestWeek 进度补足原则一致 |
| DR-89 | 共修签到窗口基准 | **token 生成时刻为基准 + Program.checkinGraceMinutes**（用户决策 2026-05-30，TODO-2 闭合）| 计划 startAt 与实际开课时间可能不一致（老师迟到/提前），若以 startAt 为基准则学员可能漏卡或窗口错位。改为辅导员/老师实际开始时生成 token，窗口从 token.createdAt 起计 checkinGraceMinutes 分钟，与实际开课完全同步。排除「加 actualStartAt 字段」：token createdAt 天然承担此语义，无需额外字段；排除「方案 A checkinOpenMinutes」：token 生成即开始信号，无需提前激活分钟数 |
| DR-88 | 掉队阈值存在哪 | **4 个阈值字段加 Program 表**（用户决策 2026-05-30，TODO-1 闭合）| D3 要求阈值数据化为专业/班级配置项。将 lagWindowDays/lagMildThreshold/lagModerateThreshold/lagSevereThreshold 加 Program 表（专业级默认值）；Class.lagPracticeDaysExpected 保留（班级级覆盖，已有），形成「专业默认 + 班级可覆盖」两层。排除「新建配置表」：4 个专业级阈值不值得单建表，挂在 Program 表最简；排除「写死代码」：违反 D3 数据驱动原则，各专业掉队判定标准不同 |
| DR-87 | AuditLog 是否加 Prisma FK 关联 | **无 FK，全部裸 String**（用户决策 2026-05-30）| 审计日志须自包含：operatorId/targetId/classId/programId 为裸 String，不加 @relation。原因：(1) AuditLog 是终态只写表，不依赖其他 model 生命周期，无需 cascade；(2) D18 下不物理删除，但万一关联 model 有 FK 变动时不影响历史日志；(3) 各能力写入时无需关心关联 model 状态，简化写入路径。排除「加 @relation」：audit 表加 FK 反而增加写入约束，且 Prisma 不允许对 targetId（多态 ID，对应不同 model）加统一 FK |
| DR-86 | AdvancementRecord 驳回时是否填 targetProgramId | **驳回时 targetProgramId=null**（用户决策 2026-05-30）| 驳回只记录「管理员在此节点拒绝升学」这一事实，不预判本来应升入哪个科系。原因：驳回场景通常是条件不满足（未达标），此时「应升哪里」并无确定性；若填入会造成误导（像是说「本应升 X 但被拒」）。下一轮重新走 AdvancementCheck → AdvancementRecord 流程，此时 targetProgramId 才有意义。排除「驳回也填 targetProgramId」：语义模糊，且不符合「只记发生了的事实」的审计原则 |
| DR-85 | AdvancementCheck 逐条条件结果存法 | **checkResults: Json（可变）**，豁免字段写入对应条目（用户决策 2026-05-30）| 每条条件结果（conditionKey/actual/target/passed/exempted/exemptedBy/exemptedAt）写入 Json 数组，管理员豁免时更新对应条目 + AuditLog 留痕（D17）。排除「拆 AdvancementCheckItem 子表」（方案 B）：一张预检报告最多 ~15 条条件，子表带来额外 FK/JOIN 且豁免写 AuditLog 已满足 D17，无需在关系表上再冗余 exemptedBy/At；保持与 SemesterSnapshot.snapshotData 和 CohortWeeklySummary.summaryData 一致的 Json 模式 | 能力 9「拒绝忏悔」指学员拒绝提交、本表根本无记录，而非提交后再拒绝的中间状态。拒绝后走职能 #14 取消资格 → ClassMember 状态变更 + AuditLog 留痕，与 ReportConfession 表完全解耦。排除「status=refused」：学员拒绝时本表无记录（管理员无法写入 refused），引入该值无实际写入路径；排除「status=escalated」：取消资格是独立的 ClassMember 操作，不应耦合进忏悔记录的状态机。「虚报处理必须先走忏悔流程」（能力 9 规则 #4）由应用层在取消资格前检查本表是否有 submitted 记录来保障 |

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

### 检查轮次 15（2026-05-29，范围：§5.3 约修家族封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | PracticeAppointment.creator↔User；PracticeAppointment.class↔Class；PracticeAppointment.participants↔PracticeAppointmentParticipant.appointment；PracticeAppointmentParticipant.user↔User（旧设计 User/Class model 已有反向关联）；PracticeProject 关联为普通 String 字段（无 @relation，待 §四 PracticeProject 复用确认后补）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 暂缓区不写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §五 目录表已将 §5.3 更新为「✅ 设计封板 / 2 张」；schema 实体数一致 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 暂缓区不生成 migration |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | §5.3 标 ⏸ 暂缓；方案 A 选择理由在 DR-57；退出软删在 DR-59；独立计数流 tradeoff 在 DR-60 |
| 8. 业务规则约束有实现方式 | ✅ | 加入防重→DB @@unique；加入限 active→应用层；currentTotal 同步→应用层事务；自动关闭→定时任务；退出→isActive=false（应用层）；不物理删→应用层无 delete API |
| 9-12. 其余检查项 | ✅/⏸ | D18：取消用 status=cancelled，退出用 isActive=false，均无物理删行合规；D17：无代行操作涉及此表；currentTotal 缓存与 personalTotal 之和一致性由事务保证 |
| 13. 02 文档 23 职能写表覆盖 | ⚠️ 待实现时补 | 约修无对应职能编号，同 DR-52 思路 |
| 14. 枚举值各处一致 | ✅ | status 4 值（active/completed/expired/cancelled）在字段表、schema、约束三处一致 |

**本轮新增待办**：`practiceProjectId` 目前为普通 String 字段（无 @relation），待 §四 PracticeProject 复用确认后补正式 FK 关联（登记 §十 TODO-3）。

**本轮发现问题数**：1（practiceProjectId 无 @relation，挂 TODO-3）。
**结论**：§5.3 约修家族（2 张表）设计封板。方案 A 独立参与表与发愿系统完全解耦；currentTotal 事务同步是核心完整性保证；软删/状态位满足 D18。⚠️ 实现时须补职能编号，并在 PracticeProject 确认后补 FK。

### 检查轮次 16（2026-05-29，范围：§5.4 自学模式家族封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | UserSelfStudyProgram.user↔User.selfStudy（旧设计 User model 370 行有 selfStudy[]）；UserSelfStudyProgram.program↔Program；UserSelfStudyProgram.restWeeks↔UserSelfStudyRestWeek.selfStudy 成对；Program 反向关联需确认（§1.1 Program 当前已删 selfStudy[]，实现时须按暂缓恢复，见下方待办）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 暂缓区不写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §五 目录表 §5.4 更新为「✅ 设计封板 / 2 张」；schema 实体数一致 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 暂缓区不生成 migration |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | §5.4 标 ⏸ 暂缓；自由申报/不可撤销/进度补足均有 DR-61~64 |
| 8. 业务规则约束有实现方式 | ✅ | 一人一科系→DB @@unique；入学限管理员→应用层；自由申报无审批→应用层；不可撤销→应用层无 delete；全部申报计入补足→应用层算法 |
| 9-12. 其余检查项 | ✅/⏸ | D18：UserSelfStudyProgram 用 abandoned，休息周 append-only 无删除，均合规；D3：pace 可配置 |
| 13. 02 文档 23 职能写表覆盖 | ⚠️ 待实现时补 | 自学模式无对应职能编号，同 DR-52 思路 |
| 14. 枚举值各处一致 | ✅ | UserSelfStudyProgram.status 4 值（active/paused/completed/abandoned）+ pace 3 值（standard/fast/custom）在字段表、schema、约束、进度逻辑各处一致；休息周已去状态机，无枚举 |

**本轮新增待办**：(1) §1.1 Program 当前已删 `selfStudy UserSelfStudyProgram[]` 反向关联，实现自学模式时须恢复（§十 TODO-5）；(2) 班级成员请假审批流（辅导员及以上审批，与自学休息周无关）另行设计（§十 TODO-6）。

**本轮发现问题数**：1（Program 反向关联待恢复→TODO-5）。
**结论**：§5.4 自学模式家族（2 张表）设计封板。自学休息周**去审批**（学员自由申报、即时生效，DR-62）+ 进度补足算法（全部申报休息周扣除有效天数）。休息审批属班级请假场景，与自学解耦（TODO-6）。⚠️ 实现时须补职能编号、恢复 Program 反向关联。

### 检查轮次 17（2026-05-29，范围：B 类核心表 §四 Course 复用确认）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | Course.programSemester↔ProgramSemester.courses（§四 ProgramSemester 复用说明已含 courses Course[]）；Course.tantricGroup↔TantricGroup（旧设计已有反向，TantricGroup 在 §四 ⬜ 待确认时一并核对）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §四 复用表新增 Course 一行；扩展区/替换区/暂缓区计数不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | Course 复用不动，无新 migration |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | Course 5 字段逐一标 ✅ 有效；密法查询方式变化已注明不影响字段 |
| 8. 业务规则约束有实现方式 | ✅ | isTantric 零痕迹过滤→应用层查询；category 分组→应用层；密法授权→TransmissionRecord EXISTS（DR-44/45）|
| 9-12. 其余检查项 | ✅/⏸ | D18：Course 复用不动，无删除语义变化；密法授权逻辑迁移至 TransmissionRecord 已封板 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | Course 管理对应职能 #16（管理课程内容，class_admin+），与 §二 DR-39 一致 |
| 14. 枚举值各处一致 | ✅ | category 两值（dharma_text/self_study_book）与旧设计一致；isTantric 布尔与 Meditation/PracticeProject 同套密法标识模式 |

**本轮发现问题数**：0。
**结论**：Course 判 ✅ 复用，字段完全照搬旧设计扩展版。密法授权查询方式虽变（迁至 TransmissionRecord）但不触及 Course 字段。§四 5 张 ⬜ 相关表（TantricGroup 等）待后续逐张确认。

### 检查轮次 18（2026-05-29，范围：B 类核心表 §四 Lesson 复用确认）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | Lesson 关联（course/资源/完成记录等）旧设计已完整；新增 sourceText 为普通 String? 字段无关联；ClassSession.lesson↔Lesson（§1.6 已封板）、Discussion.lesson↔Lesson（§5.2 已含）反向均成对 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §四 复用表新增 Lesson 一行；其余区计数不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | Lesson 复用不动，无新 migration |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | sourceText 标 ✅ 有效；referenceText 注明不废弃、并存 |
| 8. 业务规则约束有实现方式 | ✅ | Lesson 仅承载内容字段，无业务规则约束；闻思圆满判定走 LessonCompletion |
| 9-12. 其余检查项 | ✅/⏸ | D18：Lesson 复用不动，无删除语义变化 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | Lesson 内容管理对应职能 #16（管理课程内容，class_admin+），同 Course |
| 14. 枚举值各处一致 | ✅ | Lesson 无新增 enum；sourceText/referenceText 均为 String? 文本字段 |

**本轮发现问题数**：0。
**结论**：Lesson 判 ✅ 复用，字段照搬旧设计扩展版（含 sourceText）。课时只承载内容字段，进度/答题/完成判定均在关联表处理。

### 检查轮次 19（2026-05-29，范围：B 类核心表 §四 Meditation 复用确认）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | Meditation.tantricGroup↔TantricGroup（旧设计已有反向，TantricGroup 在 §四 ⬜ 待确认）；PracticeLog.meditationId 指向 Meditation.id（普通字段引用，§四 PracticeLog 复用时核对）；其余视频/章节/字幕关联旧设计完整 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §四 复用表新增 Meditation 一行；其余区计数不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | Meditation 复用不动，无新 migration |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | 4 字段逐一标 ✅ 有效；大纲 3 缺口明确归判定逻辑层（TODO-7/8/9），非表结构 |
| 8. 业务规则约束有实现方式 | ✅ | seriesKey+seriesNumber 唯一→DB @@unique；isTantric 零痕迹→应用层；逐法达标→AdvancementCheck 聚合（TODO-9）|
| 9-12. 其余检查项 | ✅/⏸ | D18：Meditation 复用不动；密法授权迁 TransmissionRecord（DR-44/45）不触及字段 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | Meditation 内容管理对应职能 #16（管理课程内容，class_admin+），同 Course/Lesson |
| 14. 枚举值各处一致 | ✅ | Meditation 无新增 enum；isTantric 布尔与 Course/PracticeProject 同套密法标识模式 |

**本轮发现问题数**：0。
**结论**：Meditation 判 ✅ 复用，字段照搬旧设计扩展版（4 字段 + @@unique）。大纲核对佐证 92 修法分法记录字段够用，发现的 3 缺口属判定/配置逻辑层（TODO-7/8/9），不影响 Meditation 表结构。

### 检查轮次 20（2026-05-29，范围：B 类核心表 §四 PracticeProject 复用确认 + TODO-3 闭合）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ⚠️→✅ 已修 | **闭合 TODO-3**：§5.3 PracticeAppointment.practiceProjectId 升格正式 FK `practiceProject PracticeProject @relation`，PracticeProject 上补反向 `appointments PracticeAppointment[]`，关联对称；PracticeProject.tantricGroup↔TantricGroup（旧设计已有反向，TantricGroup §四 ⬜ 待确认）；PracticeLog.practiceProjectId/PracticeTemplate.practiceProjectId 引用旧设计完整 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §四 复用表新增 PracticeProject 一行；其余区计数不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | PracticeProject 复用不动；约修 FK 升格属 §5.3 暂缓表，实现时统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | 2 字段标 ✅ 有效；scope 注明保留兼容、新系统不依赖 |
| 8. 业务规则约束有实现方式 | ✅ | isTantric 管理端始终可见→应用层查询；密法授权→TransmissionRecord EXISTS（DR-44/45）|
| 9-12. 其余检查项 | ✅/⏸ | D18：PracticeProject 复用不动；TODO-3 闭合后约修反向关联完整 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | PracticeProject 字典管理对应职能 #16（管理课程内容，class_admin+）|
| 14. 枚举值各处一致 | ✅ | PracticeProject 无新增 enum；isTantric 布尔与 Course/Meditation 同套密法标识模式 |

**本轮发现问题数**：1（TODO-3 关联不对称）→ 已当轮闭合（补 FK + 反向关联）。
**结论**：PracticeProject 判 ✅ 复用，字段照搬旧设计扩展版（2 字段）。同步闭合 TODO-3——约修 practiceProjectId 升格正式 FK，PracticeProject 补反向 appointments[]，关联对称。

### 检查轮次 21（2026-05-29，范围：§1.9 User 扩展封板 + 60 岁年龄豁免规则）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | User 新增 birthDate 为普通 DateTime? 字段无关联；User 既有海量反向关联（ClassMember/StudyRecord/各打卡/约修/帖子等）旧设计完整，本次不动 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层；birthDate 属敏感字段，实现时注意权限可见性 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §一 扩展区 9→10 张（User 从复用区移入）；§一 标题与注记已同步更新为 10 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 本次仅 User 加 birthDate 单列（ADD COLUMN nullable）；待全表统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | 13 旧字段逐一标 ✅ 复用；birthDate 标新增；年龄豁免「资格性非自动」明确区别于盲聋强制豁免 |
| 8. 业务规则约束有实现方式 | ✅ | studentId/nickname 唯一→DB @unique；accessibilityNeeds 取值→应用层；年龄豁免非自动→应用层（走能力 5 代行，留痕 D17）；档案不删→应用层 |
| 9-12. 其余检查项 | ✅/⏸ | D18：User 档案永久保留；D17：年龄豁免走能力 5 代行留痕；盲/聋强制豁免（能力 3 自动）与年龄资格豁免（能力 5 个案）两层清晰 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | accessibilityNeeds 认定对应职能 #13；年龄豁免实际操作对应能力 5 代行（class_admin+）|
| 14. 枚举值各处一致 | ✅ | learningMode（class/self_study/both）、refugeStatus（taken/not_taken/unsure）、accessibilityNeeds（blind/deaf）、dataSource 三值均与旧设计 enum 一致；birthDate 无枚举 |

**本轮发现问题数**：0。
**结论**：User 判 🔧 扩展（13 旧字段复用 + birthDate 新增）。60 岁年龄豁免做成「资格性、非自动」，与盲/聋强制豁免分层清晰：盲聋走能力 3 自动判定路径，年龄走能力 5 个案代行（留痕）。birthDate 字段就位，TODO-12 收窄为仅剩升学阶段的豁免逻辑层。

### 检查轮次 22（2026-05-29，范围：§1.10 Class 扩展封板 + 班级归档规则）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | Class 新增 status/archivedAt/archivedBy 为普通字段无关联；Class 既有海量反向关联（members/admins/restWeeks/posts/discussions/speakingSessions/exams/events 等）旧设计完整，本次不动 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §一 扩展区 10→11 张（Class 从复用区移入）；标题与注记已同步更新为 11 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 本次仅 Class 加 status/archivedAt/archivedBy（status 带默认 active）；待全表统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | 6 旧字段逐一标 ✅ 复用；归档三件套标新增；D19 归档规则明确 |
| 8. 业务规则约束有实现方式 | ✅ | 归档后禁写→应用层；手动归档→应用层；不物理删→应用层无 delete；status 枚举→应用层/Prisma enum |
| 9-12. 其余检查项 | ✅/⏸ | D19：班级只归档（status=archived）不物理删；D18：历史数据完整保留；归档留痕（archivedAt/archivedBy）|
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | 班级配置/归档对应 class_admin+（职能范畴）；currentWeekOverride 辅导员可调（本班）|
| 14. 枚举值各处一致 | ✅ | status 两值（active/archived）在字段表/schema/约束/归档规则一致；与 ClassMember.cohortStatus（成员状态，5 态）是不同维度，不冲突 |

**本轮发现问题数**：0。
**结论**：Class 判 🔧 扩展（6 旧字段复用 + 归档三件套）。D19 班级归档落地：status=archived 不接受新成员/新课表/新出勤，历史完整保留，手动触发，不物理删除。**至此 B 类核心表全部完成**（Course/Lesson/Meditation/PracticeProject ✅ 复用；User/Class 🔧 扩展）。

### 检查轮次 23（2026-05-29，范围：C 类 §四 复用表批量确认 + TantricGroup 微调 + AI 暂缓）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ⚠️→✅ 已修 | **闭合检查轮次 11 已知项**：TantricGroup 删悬空的 `grants TantricAccessGrant[]`，补 `transmissionRecords TransmissionRecord[]`，与 TransmissionRecord.tantricGroup（§二 2.3）对称；其余 15 张复用表关联旧设计完整（Event.eventCounts↔EventCount.event、ProgramWeek.courses/practices 等）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §四 复用表 15 张批量 ✅；TantricGroup 🔧 微调；AI 5 张 ⏸ 暂缓；核心表 6 张已确认；扩展区 11/替换区 3/暂缓区不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 复用表不动；TantricGroup 微调（删/加反向关联，无物理列变更）待统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | 15 复用表批量 ✅；TantricGroup grants 标 ❌ 删除；AI 5 张标 ⏸ 暂缓（DR-74）|
| 8. 业务规则约束有实现方式 | ✅ | 各复用表唯一约束（@@unique）旧设计已含；密法访问→EXISTS on TransmissionRecord（应用层）|
| 9-12. 其余检查项 | ✅/⏸ | D18：复用表打卡/记录类均 append-only 或 upsert；TantricGroup 微调闭合 DR-44 授权迁移最后一环 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分 | 复用表读写权限散落各能力，全职能核对待全表完成（步骤 3）|
| 14. 枚举值各处一致 | ✅ | Event.eventType（puja/dharma_assembly/weekly）、PracticeJournal.visibility（private/visible_to_coach）、PracticeLog.source 等与旧设计一致 |

**本轮发现问题数**：1（TantricGroup 悬空关联）→ 已当轮闭合（删 grants + 补 transmissionRecords，同步闭合检查轮次 11 已知项）。
**结论**：C 类 §四 复用表确认完毕——15 张批量 ✅ 复用，TantricGroup 🔧 微调（关联替换），AI 5 张 ⏸ 暂缓。**至此 §四 复用区全部表确认完成**（核心表 6 + ProgramSemester/SpeakingSession + C 类 15 + TantricGroup 微调；AI 5 张暂缓在外）。检查轮次 11 标记的 TantricGroup 已知项闭合。

### 检查轮次 24（2026-05-29，范围：§3.2 RoleAssignmentHistory 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | RoleAssignmentHistory.assignment↔UserRoleAssignment.history（§2.1 已声明 `history RoleAssignmentHistory[]`），成对 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14 张不变（RoleAssignmentHistory 本就在列，由 ⬜ 转 ✅）|
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | role/classId/programId 冗余有 DR-75 说明；append-only 明确 |
| 8. 业务规则约束有实现方式 | ✅ | @@index（DB）；冗余快照不可变（应用层）；append-only 无 update/delete（应用层）|
| 9-12. 其余检查项 | ✅/⏸ | D18：append-only 留痕，无删除/修改；与 §3.12 对称（角色链 vs 入学状态链）|
| 13. 02 文档 23 职能写表覆盖 | ✅ | 角色变更由系统在 UserRoleAssignment 写操作时自动追加，对应能力 18 任命链 + 能力 20 审计 |
| 14. 枚举值各处一致 | ✅ | action（assigned/revoked/reactivated）；role 四值与 §2.1 UserRoleAssignment 一致 |

**本轮发现问题数**：0。
**结论**：§3.2 RoleAssignmentHistory 封板。与 §3.12 EnrollmentStatusHistory 对称的 append-only 留痕表，冗余存变更那一刻的角色/作用域快照（DR-75），审计可回溯历史真相。反向关联与 §2.1 成对，无悬空。

### 检查轮次 25（2026-05-29，范围：§3.3 StudentSpecialStatus 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | StudentSpecialStatus.user↔User（User 既有海量反向关联，实现时补 specialStatuses[] 即可）；本表无其他外键 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14 张不变（StudentSpecialStatus 由 ⬜ 转 ✅）|
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | statusType 仅 blind/deaf 不可扩展明确；双写快照有 DR-76 |
| 8. 业务规则约束有实现方式 | ✅ | 唯一→DB @@unique([userId,statusType])；statusType 值域/认定权限/撤销不删/双写→应用层 |
| 9-12. 其余检查项 | ✅/⏸ | D18：撤销 status=revoked 不物理删；认定/撤销留痕；闻思路径切换走能力 3（应用层读 accessibilityNeeds 快照）|
| 13. 02 文档 23 职能写表覆盖 | ✅ | 认定/撤销对应职能 #13（class_admin+），与能力 12 绝对约束 #3 一致 |
| 14. 枚举值各处一致 | ✅ | statusType（blind/deaf）与 User.accessibilityNeeds 取值一致、与能力 12/能力 3 一致；status（active/revoked）与其他留痕表一致 |

**本轮发现问题数**：0。
**结论**：§3.3 StudentSpecialStatus 封板。blind/deaf 两类不可扩展（能力 12 绝对约束）；与 User.accessibilityNeeds 留痕+快照双写（DR-76）；@@unique([userId,statusType]) 防重、撤销后复活（DR-77）。

### 检查轮次 26（2026-05-29，范围：§3.4 CareWatchlistItem 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | **闭合检查轮次 10 已知项**：CareWatchlistItem.followups↔CareFollowupRecord.watchlistItem（§2.2 已有 `watchlistItem CareWatchlistItem?` + watchlistItemId FK），成对；CareWatchlistItem.user↔User（实现时补 careWatchlistItems[] 反向）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14 张不变（CareWatchlistItem 由 ⬜ 转 ✅）|
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待统编；注意 partial unique index 需单独 CREATE INDEX 语句（DR-78）|
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | triggerType 7 值逐一标来源能力 + 解除方式；partial unique 有 DR-78；阈值复用 TODO-1 有 DR-79 |
| 8. 业务规则约束有实现方式 | ✅ | 同人同类型 active 唯一→partial unique index；阈值→TODO-1 配置；false_report/manual 不自动移除→应用层；解除不删→应用层；备注学员不可见→应用层 |
| 9-12. 其余检查项 | ✅/⏸ | D18：解除 status=resolved 不物理删，条目历史保留；D3：阈值数据化（TODO-1）；与 CohortLagSnapshot 共用阈值 |
| 13. 02 文档 23 职能写表覆盖 | ✅ | 自动触发=系统；手动添加/解除限 class_tutor+（按作用域 D8），与能力 14 §2/§3 一致 |
| 14. 枚举值各处一致 | ✅ | triggerType 7 值、triggerSource（auto/manual）、status（active/resolved）各处一致；与 CareFollowupRecord.sourceType（care_watchlist/special_status）分工清晰不冲突 |

**本轮发现问题数**：0（同时闭合检查轮次 10 标记的 §3.4 反向关联已知项）。
**结论**：§3.4 CareWatchlistItem 封板。清单条目（触发信号）与 CareFollowupRecord（跟进备注）一对多分工；同人同类型 active 唯一用 partial unique index（DR-78）；触发阈值复用 TODO-1（DR-79）；解除走 resolved 不删行（D18）。闭合检查轮次 10 反向关联已知项。

### 检查轮次 27（2026-05-29，范围：§3.5 ClassInviteCode 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | ClassInviteCode.class↔Class（实现时补 inviteCodes[] 反向）；无其他外键 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14 张不变（ClassInviteCode 由 ⬜ 转 ✅）|
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 待统编；旧 Class.joinCode 保留兼容不删 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | status 仅 active/revoked（expired 实时算）有 DR-80；joinCode 取代有 DR-81 |
| 8. 业务规则约束有实现方式 | ✅ | code 唯一→DB；expiresAt 必填→DB 非空；三重校验/幂等/不可复用/只影响新加入→应用层；撤销不删→应用层 |
| 9-12. 其余检查项 | ✅/⏸ | D18：撤销 status=revoked 不物理删，生成/撤销留痕；D11：expiresAt 必填保证时效 |
| 13. 02 文档 23 职能写表覆盖 | ✅ | 生成/撤销限 class_admin+（职能 #5），辅导员只读（R），与能力 19 §1 一致 |
| 14. 枚举值各处一致 | ✅ | status（active/revoked）各处一致；展示层 expired 为合成态非存储值，已注明 |

**本轮发现问题数**：0。
**结论**：§3.5 ClassInviteCode 封板。expiresAt 必填保证 D11 时效；status 只存 active/revoked，expired 实时算（DR-80）；取代旧 joinCode（DR-81，字段保留兼容）；撤销/过期只影响新加入，入班幂等。

### 检查轮次 28（2026-05-29，范围：§3.6 辅助员并入 §2.1 UserRoleAssignment）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | 辅助员并入 UserRoleAssignment，复用现有 user/class/program/history 关联，无新表新关联；class_assistant 用 classId 关联 Class（已有）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14→13 张（AssistantAssignment 撤销并入 §2.1）；标题、注记、§3.6 说明三处同步更新 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 无新表；role 增加枚举值 class_assistant 待统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 同上 |
| 7. 暂缓/不做标签完整 | ✅ | §3.6 标删除线 + 并入说明；class_assistant 权限集固定/禁区明确 |
| 8. 业务规则约束有实现方式 | ✅ | classId 必填/权限集固定/操作禁区/配对收回权限→应用层；唯一约束复用 @@unique([userId,role,classId,programId])|
| 9-12. 其余检查项 | ✅/⏸ | D17/D18：配对/收回走 status=revoked 留痕，变更链入 RoleAssignmentHistory（§3.2）；与四大角色同套机制 |
| 13. 02 文档 23 职能写表覆盖 | ✅ | class_assistant 配对/收回=职能 #19（class_admin+）；辅助员权限对应能力 8/9（发共修/任务）|
| 14. 枚举值各处一致 | ✅ | role 第 5 值 class_assistant 在字段表/schema/约束/§3.6 说明四处一致；与能力 13 一致 |

**本轮发现问题数**：0（但结论已被轮次 29 推翻，见下）。
**结论**：~~辅助员并入 §2.1 UserRoleAssignment（第 5 个 role class_assistant，DR-82）~~ ⚠️ **本轮结论已作废**——轮次 29 核对 02 文档后发现「并入」自创了 02 角色表未定义的第 5 角色，违反文档权威，已回滚为独立表。

### 检查轮次 29（2026-05-29，范围：§3.6 辅助员回滚为独立表 AssistantAssignment）

> **背景**：轮次 28「并入 UserRoleAssignment」核对 02-roles-and-permissions-v1.md 后发现冲突——02 角色表只有 4 个 role，无 class_assistant；能力 13 亦明确「辅助员不属于四大管理角色」。并入等于自创文档未定义角色，违反 CLAUDE.md「以文档为准」铁律。本轮回滚为独立表。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | AssistantAssignment.class↔Class、.user↔User（实现时补反向）；§2.1 UserRoleAssignment 已移除 class_assistant，role 复归四大角色 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 13→14 张回滚（AssistantAssignment 复为独立表）；标题/注记/§3.6 三处同步回滚 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 新表 assistant_assignments + partial unique index 待统编；UserRoleAssignment.role 不再加 class_assistant 枚举 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | §3.6 独立表恢复；权限集固定/操作禁区明确；DR-82 记录两轮决策过程 |
| 8. 业务规则约束有实现方式 | ✅ | 同人同班 active 唯一→partial unique index；配对权限/权限集固定/操作禁区/作用域→应用层；收回不删→应用层 |
| 9-12. 其余检查项 | ✅/⏸ | D17/D18：配对/收回 status=revoked 留痕；与角色体系解耦（独立机制）|
| 13. 02 文档 23 职能写表覆盖 | ✅ | 配对/收回=职能 #19（class_admin+），辅导员只读（R）；**回滚后与 02 角色表一致**（不自创 role）|
| 14. 枚举值各处一致 | ✅ | UserRoleAssignment.role 复归四大角色（与 02 §一/D6 一致）；AssistantAssignment.status（active/revoked）一致 |

**本轮发现问题数**：0（回滚操作，修正轮次 28 的文档权威冲突）。
**结论**：§3.6 AssistantAssignment 回滚为独立表封板。忠于 02 文档「辅助员不属四大角色」定性，UserRoleAssignment.role 严格保持四大角色。§三 新建区维持 14 张。DR-82 记录两轮决策（并入→核对文档→回滚独立）。

---

### 检查轮次 30（2026-05-30，范围：§3.7 SemesterSnapshot 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | SemesterSnapshot→User/Class/Program 三个 @relation；实现时须在 User/Class/Program 补 snapshots[] 反向关联（已在设计意图中标注）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14 张不变（§3.7 已在目录内，填充内容不影响计数）|
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 新表 semester_snapshots 待统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | §3.7 无暂缓功能；写权限=系统只读、无 delete API 明确标注 |
| 8. 业务规则约束有实现方式 | ✅ | 同人同节点唯一→@@unique DB；冻结不改→应用层 no-update API；无 delete→应用层 D18 |
| 9-12. 其余检查项 | ✅/⏸ | D18：无 delete API；D3：snapshotData Json 各科系可扩展；D17：admin 事后更正走 AuditLog（§3.11 待封板）|
| 13. 02 文档 23 职能写表覆盖 | ✅ | 快照生成=系统自动，无职能写权限；读取服务能力 6+10 |
| 14. 枚举值各处一致 | ✅ | 无新增 enum |

**本轮发现问题数**：0。
**结论**：§3.7 SemesterSnapshot 封板。snapshotData=Json（DR-83-A，跨科系灵活扩展）；快照冻结不可改（DR-83-B，事后更正走 AuditLog）；@@unique([userId, programId, semesterNumber, reportNodeIndex]) 保证节点唯一性。

---

### 检查轮次 31（2026-05-30，范围：§3.8 ReportConfession 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | ReportConfession→User/Class/CareWatchlistItem；CareWatchlistItem 须补 `confessions ReportConfession[]` 反向关联（实现时处理）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14 张不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 新表 report_confessions 待统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | 无暂缓功能；拒绝忏悔不在本表（DR-84）明确标注 |
| 8. 业务规则约束有实现方式 | ✅ | status 两态枚举→应用层；acknowledged 必须 reviewedBy/At→应用层；无 delete→应用层 D18；「先忏悔再取消资格」→应用层检查 submitted 记录 |
| 9-12. 其余检查项 | ✅/⏸ | D18：无 delete API；D17：reviewedBy 留管理员身份；取消资格路径→ClassMember+AuditLog 解耦 |
| 13. 02 文档 23 职能写表覆盖 | ✅ | 学员提交=自助；管理员确认=职能隐含（class_admin+）；职能 #14 取消资格走 ClassMember，与本表解耦 |
| 14. 枚举值各处一致 | ✅ | status: submitted/acknowledged，无新 enum |

**本轮发现问题数**：0。
**结论**：§3.8 ReportConfession 封板。status 两态（submitted/acknowledged），拒绝忏悔场景不在本表记录（DR-84），取消资格由 ClassMember + AuditLog 独立处理。

---

### 检查轮次 32（2026-05-30，范围：§3.9 AdvancementCheck 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | AdvancementCheck→User/Class/Program；实现时须补各表 `advancementChecks[]` 反向关联（已标注）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14 张不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 新表 advancement_checks 待统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | TODO-9/12/13 的判定逻辑属应用层，明确标注在设计意图 |
| 8. 业务规则约束有实现方式 | ✅ | 唯一约束→@@unique DB；豁免前检查 isExemptable→应用层；豁免写 AuditLog→应用层 D17；升学前检查 reviewed→应用层；无 delete→D18 应用层 |
| 9-12. 其余检查项 | ✅/⏸ | D13：isExemptable 应用层守门；D17：豁免写 AuditLog；D18：无 delete；ProgramAdvancementConfig 是本表数据来源，关系已明确 |
| 13. 02 文档 23 职能写表覆盖 | ✅ | 系统自动生成=无职能；管理员审阅/豁免=能力 5 代行（职能覆盖）；拍板升学→AdvancementRecord |
| 14. 枚举值各处一致 | ✅ | status: pending/reviewed；conditionType 值沿用 §3.1 AdvancementConditionType enum |

**本轮发现问题数**：0。
**结论**：§3.9 AdvancementCheck 封板。checkResults=Json 可变（DR-85，豁免字段写入对应条目+AuditLog）；overallPassed 豁免后重算；TODO-9/12/13 判定逻辑属应用层。

---

### 检查轮次 33（2026-05-30，范围：§3.10 AdvancementRecord 封板）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | Program 须加具名双关联（AdvancementFrom/To）；AdvancementCheck 须补 `advancementRecord AdvancementRecord?` 反向；User/Class 须补 `advancementRecords[]`（已标注）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14 张不变 |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 新表 advancement_records 待统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | 无暂缓功能；驳回不填 targetProgramId 明确标注（DR-86）|
| 8. 业务规则约束有实现方式 | ✅ | advancementCheckId @unique→DB；冻结 conditionsSnapshot→应用层；创建前检查 reviewed→应用层；通过时 targetProgramId 非空→应用层；无 delete→D18 应用层 |
| 9-12. 其余检查项 | ✅/⏸ | D18：无 delete；DR-83-B 冻结原则复用于 conditionsSnapshot；D13：硬条件不放宽由 AdvancementCheck 层保证，本表只记结果 |
| 13. 02 文档 23 职能写表覆盖 | ✅ | 升学审核通过/驳回=职能 #16（class_admin+）|
| 14. 枚举值各处一致 | ✅ | result: passed/rejected；无新 enum |

**本轮发现问题数**：0。
**结论**：§3.10 AdvancementRecord 封板。advancementCheckId @unique 保证一检一记；conditionsSnapshot 冻结（DR-83-B 复用）；驳回 targetProgramId=null（DR-86）；Program 双具名关联已标注。

---

### 检查轮次 34（2026-05-30，范围：§3.11 AuditLog 封板 · §三 新建区 14 张全部完成）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | AuditLog 无 FK 关联（DR-87），无对称反向关联需求；设计意图已明确 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14 张全部封板完成（§3.1~§3.14）|
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 新表 audit_logs 待统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 待全表完成统编 |
| 7. 暂缓/不做标签完整 | ✅ | 无暂缓功能；11 类 actionType 与能力 20 表格一一对应 |
| 8. 业务规则约束有实现方式 | ✅ | reason 非空→DB；无 update/delete→应用层 D18；查询权限按作用域过滤→应用层；学员只查自己→应用层 |
| 9-12. 其余检查项 | ✅ | D18：不可删不可改；D17 路径：所有代行操作均在此表留痕（各能力主动写入）；能力 20 规则 1~6 全覆盖 |
| 13. 02 文档 23 职能写表覆盖 | ✅ | 11 类 actionType 覆盖所有高权限职能（能力 20 规则 1 表格）|
| 14. 枚举值各处一致 | ✅ | actionType 11 值以 String 存（不建 enum，便于扩展）；与能力 20 对应表完全一致 |

**本轮发现问题数**：0。
**结论**：§3.11 AuditLog 封板。无 FK 裸 String（DR-87，终态只写表，自包含）；11 类 actionType 覆盖能力 20 全部高权限操作；D18 约束由应用层保证；**§三 新建区 14 张全部封板**。

---

### 检查轮次 35（2026-05-30，范围：全文档最终一致性检查 · 14 项完整扫描）

> **背景**：§一/§二/§三 全部封板后，由 Explore agent 跑完整 14 项扫描，人工复核并修复所有发现问题。

| 检查项 | 结果 | 修复内容 |
|---|---|---|
| 1. Prisma 关联对称性 | ⚠️→✅ 已修 | 修复 6 处父表缺反向关联：(1) §1.1 Program 补 snapshots/advancementChecks/advancementsFrom/advancementsTo 4 个新建区反向；(2) §1.9 User schema 补 snapshots/advancementChecks/advancementRecords/assistantAssignments 4 个反向；(3) §1.10 Class schema 补 snapshots/advancementChecks/advancementRecords/assistantAssignments/confessions 5 个反向；(4) §3.4 CareWatchlistItem schema 补 `confessions ReportConfession[]`；(5) §3.9 AdvancementCheck 关联表补 `advancementRecord AdvancementRecord?` |
| 2. API 响应字段与 DB 字段对齐 | ✅ 无问题 | 文档主要定义 DB schema，无 API 响应层详细设计 |
| 3. SQL 视图表名正确 | ✅ 无问题 | 无 CREATE VIEW，全部为 Prisma schema |
| 4. 总览计数正确 | ⚠️→✅ 已修 | §一「11 张」计数本身正确（ExamGrade 复用不动不计入、ClassSessionSchedule 属 §3.13 新建区）；修复 §1.4 措辞「本节三张表均有变更」→改为准确说明（SpeakingGrade+Exam 扩展，ExamGrade 复用不动仅供对照） |
| 5. Migration 覆盖完整 | ⏸ 暂不适用 | 全表设计阶段，Migration 待实施阶段统编 |
| 6. Phase 计划覆盖完整 | ⏸ 暂不适用 | 文档为设计层，Phase 实施计划属后续 |
| 7. 暂缓/不做标签完整 | ✅ 无问题 | §五 四组暂缓表标签完整；❌ 不做（转功德会 DR-68）标注完整 |
| 8. 业务规则约束有实现方式 | ✅ 无问题 | 所有约束表格均注明「DB」或「应用层」 |
| 9. 升学条件可全查 | 🔵 部分（**勘误，2026-05-30**）| **原标「✅ 无问题」过度乐观，已下修。** 链路连通（6 类 conditionType 有 ProgramAdvancementConfig 接住）✅，但**配置表达充分性未验证**：targetValue（单 Int）+ params（单 Json）能否真的装下加行双维度逐法（≥3座且≥90分/法）、考试合格线多维矩阵（出勤档×开卷闭卷×次数×年龄）、年龄豁免资格性逻辑——**均未设计透，挂 TODO-9/12/13（⚠️ 待决策）→ TODO-17 专题**。链路通 ≠ 装得下 |
| 10. D18 覆盖完整 | ✅ 无问题 | 所有新建/扩展表均有「无 delete API」约束标注 |
| 11. D17 代行留痕路径完整 | ✅ 无问题 | AuditLog 11 类 actionType 覆盖全部高权限代行路径 |
| 12. 密法访问控制路径完整 | ✅ 无问题 | TransmissionRecord 替代 TantricAccessGrant，路径完整 |
| 13. 02 文档 23 职能写表覆盖 | ✅ 无问题 | 抽查职能 #5/#14/#16/#19 全部与对应表写权限一致 |
| 14. 枚举值各处一致 | ✅ 无问题 | AdvancementConditionType/CohortMemberStatus/ProgramStage/LagStatus 各处一致 |

**本轮发现问题数**：2（均已修复）。
**结论**：全文档最终一致性检查通过。修复 Prisma 关联对称性（6 处父表补反向关联）+ §1.4 措辞精确化。设计文档全部封板，可进入实施阶段。

> **⚠️ 勘误（2026-05-30，事后发现）**：本轮检查项 9 原标「✅ 无问题」**不准确，已下修为「🔵 部分」**。两点教训：(1) **链路通 ≠ 装得下**——检查项 9 只验证了「有 ProgramAdvancementConfig 接住 6 类条件」（链路连通），未验证「targetValue+params 能否表达加行双维度逐法/考试多维合格线」（表达充分性），而后者挂在 TODO-9/12/13 从未定稿；(2) **自相矛盾未抓出**——TODO-9/12/13 在 §十 标着 ⚠️ 待决策，检查项 9 却标 ✅，同文档两处结论打架，本应被检查项 7（标签完整性）抓到。**方法论盲区**：14 项检查全是「文档内部链路自洽」，缺两个维度——①配置表达能力 vs 业务要求充分性、②设计 vs 现状代码 gap（整份 08 是蓝图，哪些全新待建/改造现有未盘）。①②并入 TODO-17 专题处理。

---

### 检查轮次 36（2026-05-30，范围：TODO-1 闭合 · Program 表新增掉队阈值 4 字段）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | 新增字段为标量（Float/Int），无新增关联 |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §一 扩展表 11 张不变（Program 已在 §1.1，字段追加不影响计数）|
| 5-6. Migration/Phase | ⏸ 暂不适用 | 待统编 |
| 7. 暂缓/不做标签完整 | ✅ | TODO-1 闭合标注；Class.lagPracticeDaysExpected 班级覆盖层保留 |
| 8. 业务规则约束有实现方式 | ✅ | 阈值为 Float（0~1 比例），合法范围校验→应用层；默认值在 schema 中注明 |
| 9-14. 其余检查项 | ✅ | D3 数据驱动满足；两层配置（专业默认+班级覆盖）逻辑清晰 |

**本轮发现问题数**：0。
**结论**：TODO-1 闭合。Program 补 lagWindowDays/lagMildThreshold/lagModerateThreshold/lagSevereThreshold 4 个专业级掉队阈值字段（DR-88）；与 Class.lagPracticeDaysExpected 构成两层配置。

---

### 检查轮次 37（2026-05-30，范围：TODO-2 闭合 · Program.checkinGraceMinutes + 签到窗口基准改 token 时刻）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | 新增 Int 标量字段，无新关联 |
| 2-6. 其余基础项 | ⏸/✅ | 无新表/视图/migration |
| 7. 暂缓/不做标签完整 | ✅ | TODO-2 闭合标注；§1.6 ClassSession 约束注释同步更新 |
| 8. 业务规则约束有实现方式 | ✅ | 签到窗口 = token.createdAt + checkinGraceMinutes → 应用层；checkinGraceMinutes 默认值注明 |
| 9-14. 其余检查项 | ✅ | D3 满足（专业级配置）；DR-24（不加 expiresAt）逻辑一致——token 激活窗口由 createdAt+grace 动态算，无需存截止时刻 |

**本轮发现问题数**：0。
**结论**：TODO-2 闭合。签到窗口基准改为 token 生成时刻（DR-89），Program 补 checkinGraceMinutes（默认 30 分钟）；startAt 仅展示，不参与签到计算。

---

### 检查轮次 38（2026-05-30，范围：TODO-6 闭合 · §3.15 LeaveRequest 新建）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | LeaveRequest→User/Class；User.leaveRequests[]/Class.leaveRequests[] 已补入两表 Prisma schema |
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | §三 新建区 14→15 张，注记已更新 |
| 5-6. Migration/Phase | ⏸ 暂不适用 | 新表 leave_requests 待统编 |
| 7. 暂缓/不做标签完整 | ✅ | expired 实时算明确标注（DR-90-A）；掉队豁免规则明确标注（DR-90-B）|
| 8. 业务规则约束有实现方式 | ✅ | expired 实时算→应用层；掉队窗口扣除→应用层（CohortLagSnapshot 生成时）；archived 班级不受理→应用层；无 delete→D18 |
| 9-14. 其余检查项 | ✅ | D18 满足；DR-80 expired 模式复用；与 UserSelfStudyRestWeek 掉队豁免原则一致 |

**本轮发现问题数**：0。
**结论**：TODO-6 闭合，§3.15 LeaveRequest 封板。expired 实时算（DR-90-A）；approved 期间不计入掉队窗口（DR-90-B）；§三 新建区 15 张。

---

### 检查轮次 39（2026-05-30，范围：TODO-7 闭合 · 座次规则对齐大纲，UserPracticeVow 字段调整）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | 无新增/变更关联（仅字段类型变更 + 新增标量）|
| 2. API 响应字段与 DB 字段对齐 | ⏸ 暂不适用 | 未写 API 层 |
| 3. SQL 视图表名正确 | ⏸ 暂不适用 | 无视图 |
| 4. 总览计数正确 | ✅ | 表数量不变（§1.7 UserPracticeVow 内字段调整）|
| 5-6. Migration/Phase | ⏸ 暂不适用 | currentSessionCount 类型变更（Decimal→Int）+ 新增 currentSessionMinutes，待 migration 统编（含历史 0.5 座数据迁移）|
| 7. 暂缓/不做标签完整 | ✅ | TODO-7 标闭合；放弃短座合并的取舍明确记录（DR-91）|
| 8. 业务规则约束有实现方式 | ✅ | 单座 ≥30 分钟→应用层录入校验（minSessionMinutes）；座数=COUNT、时长=SUM→应用层聚合；双维度达标→AdvancementCheck 预检（TODO-9）|
| 9. 升学条件可全查 | ✅ | practice_session 条件双维度（座数 ≥276 / 时长 ≥138h）数据源 = PracticeLog COUNT/SUM，路径清晰 |
| 10-12. D18/D17/密法 | ✅ | 历史 0.5 座数据保留（migration 折算迁移，不物理删）|
| 13. 02 文档职能覆盖 | ✅ | 观修录入=学员自助；代行调整=能力 5 留痕 |
| 14. 枚举值各处一致 | ✅ | 无新 enum；minSessionMinutes 默认 30 与大纲单座下界一致 |

**本轮发现问题数**：0。
**遗留实现项**：(1) UserPracticeVow.currentSessionCount Decimal→Int 的历史数据迁移（0.5 座按合并折算）；(2) PracticeLog 观修记录须含 durationMinutes（≥30 校验）字段——均属实施阶段 migration/字段细化，规则已定。
**结论**：TODO-7 闭合。废弃 0.5 座制，对齐大纲：每座 ≥30 分钟、座数/时长双维度独立计（DR-91）。UserPracticeVow.currentSessionCount 改 Int + 新增 currentSessionMinutes。

---

### 检查轮次 40（2026-05-30，范围：TODO-8 闭合 · 闻思圆满判定矩阵 + StudentSpecialStatus 两类语义）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | 无新增/变更字段（纯应用层判定逻辑文档化）|
| 2-3. API/视图 | ⏸ 暂不适用 | — |
| 4. 总览计数正确 | ✅ | 无表数量变更 |
| 5-6. Migration/Phase | ⏸ 暂不适用 | 无 schema 变更 |
| 7. 暂缓/不做标签完整 | ✅ | TODO-8 标闭合；盲+聋双重残疾边界明确走能力 5 代行，不自创规则 |
| 8. 业务规则约束有实现方式 | ✅ | 听=COUNT(audio,video)、看=COUNT(read)、答题=UserAnswer→应用层聚合；三路径判定→应用层按 accessibilityNeeds 分支 |
| 9. 升学条件可全查 | ✅ | course_completion 条件数据源（闻思圆满）判定路径明确，AdvancementCheck 可取 |
| 10-12. D18/D17/密法 | ✅ | 历史圆满按当时身份保留（能力 3 约束 #3）；盲+聋走能力 5 代行 D17 留痕 |
| 13. 02 文档职能覆盖 | ✅ | 身份认定=职能 #13（class_admin+）；闻思录入=学员自助 |
| 14. 枚举值各处一致 | ✅ | statusType/accessibilityNeeds 仍 blind/deaf 两值（DR-76），语义范围扩展但值不变；LessonCompletion type read/audio/video/meditation 一致 |

**本轮发现问题数**：0。
**结论**：TODO-8 闭合。音视频任一算「听」（COUNT 合并）；blind=视障类、deaf=听障类覆盖大纲细分（DR-92），不扩展 statusType（守 DR-76）；判定矩阵落点 §3.3。

---

### 检查轮次 41（2026-05-30，范围：TODO-15 闭合 · Course 改判扩展加 courseType，移入 §1.11）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | courseType 为标量，无新关联 |
| 2-3. API/视图 | ⏸ 暂不适用 | — |
| 4. 总览计数正确 | ✅ | §一 扩展区 11→12 张（标题+注记已更新，新增 §1.11 Course）；§四 复用区 Course 标记改判移出 |
| 5-6. Migration/Phase | ⏸ 暂不适用 | Course 加 courseType 字段待 migration 统编（默认 formal，历史数据回填） |
| 7. 暂缓/不做标签完整 | ✅ | TODO-15 标闭合；Course 改判扩展两处同步（§1.11 + §四复用说明 + §四复用表） |
| 8. 业务规则约束有实现方式 | ✅ | courseType 枚举→Zod；考试范围排除→应用层（courseType=restricted OR category=self_study_book）；闻思按 courseType 分路径→应用层 |
| 9. 升学条件可全查 | 🔵 部分 | 考试范围圈定路径补齐（courseType 字段就位），但合格线多维矩阵仍挂 TODO-13/17（与勘误一致）|
| 10-12. D18/D17/密法 | ✅ | Course 不物理删；courseType 不影响密法 tantricGroupId 路径 |
| 13. 02 文档职能覆盖 | ✅ | courseType 配置=subject_admin（学科作用域）|
| 14. 枚举值各处一致 | ✅ | courseType（entry/formal/restricted）在 §1.11 字段表/schema/约束/正交表/设计意图五处一致；category 两值不变 |

**本轮发现问题数**：0。
**遗留实现项**：Course.courseType migration（默认 formal + 历史数据回填限制性课标记）。
**结论**：TODO-15 闭合。Course 新增 courseType 改判 🔧 扩展移入 §1.11（DR-93）；考试范围排除 restricted+self_study_book；同步补齐 DR-92 闻思判定的 courseType 依赖；DR-65 修订。§一 扩展区 12 张。

---

## 十、跨表待办清单（设计推进中发现、需在后续表/阶段处理）

> 设计某张表时发现、但应在其他表或后续阶段解决的事项，登记于此防遗漏。

| 编号 | 待办 | 来源 | 处理时机 | 关联决策 |
|---|---|---|---|---|
| ~~TODO-1~~ ✅ 已闭合 | ~~掉队判定阈值数据化~~——**已闭合（2026-05-30）**：Program 新增 lagWindowDays（默认14）/lagMildThreshold（0.5）/lagModerateThreshold（0.3）/lagSevereThreshold（0.1）4 个专业级阈值字段；Class.lagPracticeDaysExpected 班级覆盖保留，两层配置满足 D3 数据驱动（DR-88）| 1.5 CohortLagSnapshot | ✅ 已处理（DR-88）| DR-18 / DR-88 |
| ~~TODO-2~~ ✅ 已闭合 | ~~共修链接激活时效数据化~~——**已闭合（2026-05-30）**：签到窗口改为「token 生成时刻」为基准，startAt 仅展示；Program 补 checkinGraceMinutes（默认 30 分钟），与实际开课时间自动对齐（DR-89）| 1.6 ClassSession | ✅ 已处理（DR-89）| DR-25 / DR-89 |
| ~~TODO-3~~ ✅ 已闭合 | ~~PracticeAppointment.practiceProjectId 无正式 @relation~~——**已闭合（2026-05-29）**：§四 PracticeProject 确认复用，已在 §5.3 PracticeAppointment 补正式 FK `practiceProject PracticeProject @relation(...)`，PracticeProject 上补反向 `appointments PracticeAppointment[]` | §5.3 PracticeAppointment | ✅ 已处理（DR-69）| DR-57 / DR-69 |
| TODO-5 | §1.1 Program 恢复 `selfStudy UserSelfStudyProgram[]` 反向关联——当前因自学模式暂缓已移除，实现 §5.4 时须恢复 | §5.4 UserSelfStudyProgram | 自学模式实现时 | DR-64 |
| ~~TODO-6~~ ✅ 已闭合 | ~~班级成员请假审批流设计~~——**已闭合（2026-05-30）**：新建 §3.15 LeaveRequest；expired 实时算不入库（DR-90-A，同 DR-80）；approved 期间从掉队窗口扣除（DR-90-B）；审批限 class_tutor+；无 delete API（D18）| §5.4 自学模式修正 | ✅ 已处理（DR-90）| DR-62 / DR-90 |
| ~~TODO-7~~ ✅ 已闭合 | ~~加行观修座次计算规则对齐大纲~~——**已闭合（2026-05-30）**：核对能力 4 大纲原文后**废弃 0.5 座制**（违反「30 分钟以下不能单独计数」绝对约束），定调「每座录入下界 30 分钟、座数=COUNT、时长=SUM 双维度独立计」，放弃短座合并便利（比大纲更严格）。UserPracticeVow.currentSessionCount 改 Int + 新增 currentSessionMinutes（DR-91）| 预科19届大纲核对（Meditation/PracticeLog）| ✅ 已处理（DR-91）| DR-91 |
| ~~TODO-8~~ ✅ 已闭合 | ~~闻思圆满「音频或视频」二选一判定~~——**已闭合（2026-05-30）**：定调听=COUNT(type IN audio,video)、看=COUNT(read)、答题=UserAnswer，纯应用层聚合；三路径判定矩阵落点 §3.3；blind=视障类/deaf=听障类覆盖大纲细分（不扩展 statusType，守 DR-76）；盲+聋走能力 5 代行（DR-92）| 预科19届大纲核对（LessonCompletion）| ✅ 已处理（DR-92）| DR-92 |
| TODO-9 | **加行升学「逐法达标」预检**——大纲升学硬条件要求 92 修法**每一法各自**满足 ≥3座 & ≥1.5小时（非仅总量 276座/138h）。系统只有逐条 PracticeLog，无「按 meditationId 分组的逐法达标快照」。`ProgramAdvancementConfig` 的 `practice_session` 条件粒度须确认能否表达「逐法达标」，AdvancementCheck(§3.9) 预检须按 meditationId 分组聚合 92 次比对 | 预科19届大纲核对（ProgramAdvancementConfig/AdvancementCheck）| §3.9 AdvancementCheck 设计时 | DR-4/DR-14 |
| TODO-10 | **金刚萨埵心咒代替顶礼的换算+申请审批**——大纲：身体原因可申请念 200 万金刚萨埵代替 10 万顶礼（已修部分顶礼后中断申请代替的同样念 200 万）。能力 5/6 有「顶礼替代」概念但**换算关系（200万↔10万）、申请审批流程**未数据化落点。须确认换算是配置项还是写死，以及代替申请走能力 5 代行还是独立审批 | 预科19届大纲核对（能力 5/6 代行）| 内加行实修 / 代行能力深化时 | D17 / 能力 5 |
| TODO-11 | **法王祈祷文补念状态机**——大纲：修顶礼时未念法王祈祷文的，毕业前补念 10 万，否则不能进密法。能力 10 升学条件列了「法王祈祷文 10 万」，但**「欠/补」状态机**（欠多少、已补多少、是否清零）未设计。须确认是否作为独立计数项或挂顶礼加行的子条件 | 预科19届大纲核对（能力 6/10）| 内加行实修 / 升学条件设计时 | D13 / 能力 6 |
| TODO-12 | **年龄豁免（60岁）逻辑层**——⚠️ 字段已就位：§1.9 User 已加 `birthDate`（DR-70）。**剩余逻辑层**：年龄豁免是「资格性、非自动」（非「年龄≥60 自动满足 exam_score」），实际免考走能力 5 代行豁免、留痕（D17）。须在升学条件配置/预检阶段实现：(1) 按 birthDate + 第一次考试报名日计算年龄；(2) 标记「符合年龄豁免资格」；(3) 接入能力 5 显式豁免流程，而非自动置满足 | 预科19届大纲核对（能力 5 / 能力 10 / AdvancementCheck）| 升学条件配置 / §3.9 AdvancementCheck 设计时 | DR-70 / 能力 5 |
| TODO-13 | **考试合格线多维矩阵** ⚠️ 硬规则缺口——大纲合格线随场景变化：出勤≥93次→1次合格(30分)；出勤<93次/自学→1次及格(开卷72/闭卷60) 或 2次各合格(30分)。能力 10「合格线是专业配置项」当前是**单一阈值**，无法表达「出勤档 × 开卷/闭卷 × 考试次数 × 年龄」多维矩阵。须扩展 ProgramAdvancementConfig 或 Exam 结构（含 isOpenBook 字段、出勤分档逻辑、多次考试组合判定）| 预科19届大纲核对（ProgramAdvancementConfig / Exam / 能力 10）| 升学条件配置 / 考试设计时 | DR-14 / D13 |
| TODO-14 | **兼修加行**——大纲：修心/念佛专业可兼修加行，毕业升密法时加行学修量保留。能力 9 支持多专业，但**「主修 + 兼修」的附修关系**（一个专业挂另一个专业的课程/实修要求）未设计。须确认兼修是独立 UserSelfStudyProgram/班级，还是新建兼修关系字段 | 预科19届大纲核对（能力 9 / 升学指南）| 多专业 / 升学结构设计时 | D9 / D16 |
| ~~TODO-15~~ ✅ 已闭合 | ~~限制性课程不进考试范围~~——**已闭合（2026-05-30）**：核查发现 Course 缺教学阶段维度，新增 `courseType`（entry/formal/restricted），Course 改判 🔧 扩展移入 §1.11；考试范围排除 = `courseType=restricted OR category=self_study_book`；顺带补齐 DR-92 闻思判定对 courseType 的依赖（DR-93）| 预科19届大纲核对（Course / Exam / 能力 10）| ✅ 已处理（DR-93）| DR-93 |
| TODO-16 | ❌ **转功德会——不做**（用户决策 2026-05-29）——大纲：取消学员资格后可转入菩提功德会。**永久决策：不做**，超出觉学平台范围（功德会是独立组织/系统）。登记于此仅为留痕大纲已核对、明确排除，见 §八 DR-68 | 预科19届大纲核对（能力 11）| ❌ 不做 | DR-68 |
| TODO-17 | 🎯 **各学科达标条件 + 升学条件的后台配置专题设计**（用户决策 2026-05-30，**本轮 TODO 处理结束后统一设计**）——核查现状：backend 代码**完全无** Program/专业层、无 ProgramAdvancementConfig、无任何达标/升学配置（现仅通用 PracticeGoal/PracticeTask 打卡目标）。需专题设计：(1) **达标条件录入结构**——各学科（加行双维度逐法、净土念佛数、入行论默写…）的达标要求如何用 ProgramAdvancementConfig.targetValue+params 表达（汇总 TODO-9 逐法达标、TODO-13 考试合格线多维矩阵、TODO-12 年龄豁免的配置承载）；(2) **后台管理界面**——subject_admin 录入/编辑各专业达标与升学条件的管理端；(3) **学习情况提醒**——基于配置 + 报数快照，向学员/管理员提示达标进度与差距。**关联面广（后台管理 + 学习提醒），故独立成专题，置于本轮零散 TODO 闭合之后**。**另含两项方法论补强**（检查轮次 35 勘误带出）：(4) **配置表达充分性校验**——验证 ProgramAdvancementConfig.targetValue+params 真能装下各学科达标要求（链路通≠装得下）；(5) **设计 vs 现状代码 gap 盘点**——整份 08 是蓝图，逐表标记「全新待建 / 改造现有 / 已存」，明确实现范围 | 课程达标录入核查（ProgramAdvancementConfig / 后台管理 / 提醒）+ 检查轮次 35 勘误 | 本轮 TODO 处理结束后专题设计 | TODO-9 / TODO-12 / TODO-13 / DR-4 |
