# 觉学融合设计文档

> 状态：维护中·封板校准至 DR-158（2026-06-04）
> 制定日期：2026-05-28
> 说明：以新设计业务逻辑为准，参考旧设计（FINAL_DESIGN_SANSUSHENG.md）字段命名与结构规范，产出字段级完整设计，可直接用于写 Prisma schema。
> 每次工作前必读：docs/_handoff/decisions/07-integration-plan.md

---

## 使用说明

- 每张表必须注明：服务能力、写权限、约束实现层
- 状态标记：✅ 已确认 / 🔵 草稿待确认 / ⬜ 未开始
- 新增 enum 统一在本文档 §六 定义

---

## 一、🔧 扩展表（12 张，DR-123 校准）

旧设计字段为底，按新业务逻辑加字段/改语义。

> 注：ProgramSemester 核对后字段够用改判 ✅ 复用；CohortRecommendedTemplate 核对能力 9 后需扩展（classId→programId）从复用区移入；UserPracticeVow 剥离班级任务重新定位为纯发愿表。User 旧设计 13 字段全部复用，但新增 `birthDate`（年龄豁免数据源）从复用区移入扩展区。Class 旧设计 6 字段全部复用，但新增归档三件套（status/archivedAt/archivedBy，D19）从复用区移入扩展区。Course 旧设计 5 扩展字段全部复用，但 TODO-15 核对发现缺课程类型维度，新增 `courseType`（entry/formal/restricted，能力 3 规则 2）从复用区移入扩展区。PracticeLog 旧设计字段全部复用，但 TODO-11 核对发现顶礼打卡须同步录入法王祈祷文遍数，新增 `prayerCount` 字段，从复用区移入扩展区（DR-95）。扩展区曾达 13 张；**DR-123 实修域改造细化后校准为 12 张**——UserPracticeVow 改判 🆕 改造新建移入 §三（线上无此表），PracticeLog 保留本区（由线上 PracticeEntry 改造扩展，migration 属 ALTER）。

---

### 1.1 Program（科系）🆕 线上无·实为新建（DR-130）· ✅ 设计已确认

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
| `primaryUsers User[] @relation("UserPrimaryProgram")` | **新增**（反向：以本专业为主修的学员，对应 User.primaryProgramId，DR-120）|
| `practiceLogs PracticeLog[] @relation("PracticeLogProgram")` | **新增**（反向：归属本专业的修持打卡，对应 PracticeLog.programId，跨专业追溯 DR-120）|
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
**写权限**：状态机操作分级——`active→paused` 系统自动（LeaveRequest 批准时原子写入，同步记 EnrollmentStatusHistory）；`paused→active` 实时推算（endDate < today 且 status=approved 视为到期，同 DR-90-A expired 模式；DB 字段由辅导员"结束请假"端点落库）；`active→graduated` 管理员手动结业（第八学期结束批量置毕业，class_admin+，绝对约束4「无自动」精神，DR-149）；`graduated→advanced` 升学审核通过时写（能力 10 职能#16，class_admin+，DR-149）；`held_back/left/disqualified` 限 `class_admin` 及以上（`disqualified`=职能#14 取消资格，downstream DR-152+DR-156：① 可继续登录 App、仅查历史档案，失去班级访问权；② 再入学须 `super_admin` 审批 + **书面背书忏悔确认**（必填说明字段写 AuditLog，不依赖系统 gate，不依赖 DR-84，DR-156 D1）+ 邀请码重新加班；③ 档案视图（D18）永久保留 + 本期升学新 ClassMember + 新 program_task vow 起算，vowId 隔离旧数据不计入新轮升学（DR-156 D2））；复活（left→active）限 admin；disqualified 再入学限 super_admin（DR-152）
**参考决策**：D15（退出后历史可查）、D18（不物理删除）、D19（班级只归档）

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `classId` | String | 关联 Class | 旧 |
| `userId` | String | 关联 User | 旧 |
| `joinedAt` | DateTime | 加入时间，默认 now() | 旧 |
| `cohortStatus` | CohortMemberStatus | active/paused/held_back/graduated/advanced/disqualified/left，默认 active（advanced/disqualified 为 DR-149 新增）| 旧+扩 |
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

> **毕业（graduated）vs 升正科（advanced）语义分离**（裁判剧本 1 T16/T17 缺口闭合，DR-149，2026-06-03）：
> - `graduated` = **第八学期学制走完的时间事件**，管理员手动结业触发（class_admin+，绝对约束4「无自动」精神），**无实修门槛**——走完学制即毕业，留在预科原地（大纲§573「第八学期结束毕业」）。
> - `advanced` = 毕业**且已升入正科**（升学审核通过，能力 10 职能#16），本预科成员关系因升学终结；升学详情存 AdvancementRecord（§3.10），不另设 `advancedAt` 字段。
> - **法王祈祷文 / 灌顶 / 完整内加行是「升密法（advanced）」门槛，不是「毕业（graduated）」门槛**（大纲§651「否则，不能进入密法」）。故法王祈祷文欠账学员 **可 graduated、不可 advanced**——这正是 graduated/advanced 必须分离的业务理由。
> - graduated 同时表达「达标未升学」（如净土达标但选择留预科）：达标与否只决定能否再 advanced，不改变 graduated 本身。
> - **毕业去向决策树**：升学（→advanced，能力 10）／留级（→held_back，能力 11）／转预科（退出+加入两步走，能力 11）／转功德会（❌ 不做，DR-68）。
> - 结业（active→graduated）与升学（graduated→advanced）均同步写 EnrollmentStatusHistory（D18 永久留痕）。
> - **落班机制（DR-150）**：邀请码两步走——approve 只写预科侧（→advanced + AdvancementRecord + EnrollmentStatusHistory），管理员另发正科班邀请码，学员走能力 2 加入正科班（与留级机制对称，**不自动建正科 ClassMember**）；`advanced` 是「已批准升学、等待加入正科」过渡态，无超时机制。
> - **原专业终态（DR-150）**：原预科 ClassMember 升学后永久停留在 `advanced`，不再改变；正科班为新 ClassMember（active），两条记录各自独立存档（D18）。
> - **并行专业归宿（DR-150）**：其他并行专业（如净土）的 ClassMember **不因本专业升学而改变**（D9/D16 多专业完全独立，不级联）；「正科密法 + 预科净土跨阶段并存」合法，各走各的生命周期。

> **辅导员与成员身份**（用户决策 2026-05-29）：辅导员**可以是班级成员**（ClassMember 装学员也装辅导员），其管理角色叠加在 UserRoleAssignment 上。ClassMember 只表达「属于这个班」，不再用字段区分学员/辅导员——身份一律从 UserRoleAssignment 按班级作用域读。删除 `role` 即据此。
>
> **业务逻辑权威**：本表及后续所有表的业务规则，一切以新设计决策文档（05/06）为准，旧设计仅作字段命名/结构参考。

### 1.3 StudyRecord（讲考+共修打卡）🆕 线上无·实为新建（DR-130）· ✅ 设计已封板

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

### 1.4 SpeakingGrade / ExamGrade / Exam（成绩）🆕 线上无·实为新建（DR-130）· ✅ 设计已封板

**服务能力**：能力 10（考试与升学）
**写权限**：班级级讲考评分限 `class_tutor` 及以上（本班）；平台级讲考评分限 `subject_admin` / `super_admin`（SpeakingGrade.classId=null）；考试成绩录入限 `class_admin` 及以上（职能 #7，辅导员无权）；Exam 创建——随堂测验辅导员（#11a）、升学考班级管理员（#11b）
**参考决策**：D3（合格线数据驱动）、D13（升学硬条件）、D18（成绩永久留档）

> **三表关系**：ExamGrade 结构旧设计已完整，**复用不动**。**Exam 加 `examType`**——核对能力 10 发现旧 Exam 无法区分「随堂测验 vs 升学考」，导致升学预检取不到正确成绩、两类写权限无法分流。**Exam 加 `isOpenBook`**——TODO-17 检查轮次 45 发现 exam_score params 的开卷/闭卷合格线分支需要数据来源，Exam 必须标记本次考试是否开卷（DR-99，2026-05-30 补充）。**SpeakingGrade.classId 改可空**——平台级讲考（SpeakingSession.classId=null）由 subject_admin/super_admin 评分，无归属班，见 DR-48。本节三张表中，SpeakingGrade（classId 改可空）和 Exam（加 examType）有变更，归入扩展区；ExamGrade 复用不动（收录于本节供对照参考）。

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

#### Exam（考试）— 🔧 扩展：加 `examType` + `isOpenBook`

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `title` | String | 考试名称 | 旧 |
| `description` | String? | 考试说明 | 旧 |
| `examDate` | DateTime | 考试日期 | 旧 |
| `classId` | String? | null=平台级；有值=班级级 | 旧 |
| `courseId` | String? | 可选关联法本 | 旧 |
| `examType` | String | `quiz`（随堂测验，辅导员起 #11a，不影响升学）/ `advancement`（升学考，班级管理员起 #11b，影响升学资格）；默认 `quiz` | **新增** |
| `isOpenBook` | Boolean | 是否开卷；默认 false（闭卷）；AdvancementCheck 按此值对照 exam_score params 的 openBookPassScore/closedBookPassScore 分支判定（DR-99，TODO-17 修复）| **新增** |
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
  isOpenBook  Boolean   @default(false)   // 开卷/闭卷标记（DR-99，升学考合格线分支判定）
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
| `isOpenBook` 默认 false | DB | 升学考创建时 subject_admin 标记；AdvancementCheck 读此值选合格线分支（DR-99）|
| 升学考创建限班级管理员、随堂测验限辅导员 | 应用层 | 按 examType 分流写权限（职能 #11a/#11b）|
| 考试成绩录入限 class_admin 及以上 | 应用层 | 职能 #7，辅导员无录入权 |
| 班级级讲考评分限 class_tutor 及以上 | 应用层 | SpeakingGrade.classId 非空时；评分人须在同一班 |
| 平台级讲考评分限 subject_admin / super_admin | 应用层 | SpeakingGrade.classId=null 时；按 SpeakingSession.classId=null 判定 |
| 成绩永久留档（D18）| 应用层 | 无 delete，修正走 upsert + AuditLog |

#### 设计意图

升学考是否分 S5/S8 节点**不在 Exam 上建字段**（4a 决策）：升学节点属专业配置范畴，由 ProgramAdvancementConfig 的 `conditionKey`（如 `exam_s8`）+ `params` 指定要匹配 `examType='advancement'` 的成绩，Exam 只需知道「我是不是升学考」。这样新增/调整升学节点不动 Exam 结构（D3）。

### 1.5 CohortLagSnapshot（掉队快照）🆕 线上无·实为新建（DR-130）· ✅ 设计已封板

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
| `contentLag` | LagStatus | 闻思内容（近2周 LessonCompletion read/audio/video 已确认完成数/应完成率，DR-143）| 旧 |
| `quizLag` | LagStatus | 答题（近2周排表课时关联题目完成率）| 旧 |
| `meditationLag` | LagStatus | 观修（近2周 PracticeLog 按 meditationId 已确认座完成率，DR-111/143；原写 LessonCompletion type=meditation 为旧引用，已废）| 旧 |
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
| 仅 `cohortStatus=active` 成员计算 | 应用层 | paused/held_back/graduated/advanced/disqualified/left 不入表（与 ClassMember 状态机对齐）|
| 学员端不可见 | 应用层 | 无 API 返回；仅辅导员及以上可读 |
| 无排表班（programId=null）三维恒 on_track | 应用层 | contentLag/quizLag/meditationLag 分母=0→率=1 |

#### 设计意图

五维独立、不加权汇总——名单页分列展示，辅导员据此逐维度判断关怀重点。本表是 computed state（每日重算覆盖），与成员生命周期表解耦，故不适用 D18「不物理删除」（旧记录被当日重算正常覆盖）；关怀的**永久留痕**落在 care_followup_records（§2.2）和 CareWatchlistItem（§3.4），快照只是触发信号源。读权限对齐能力 14 规则 3 的新角色体系。

**`taskLag` 达标基准查询范围（ISG-12 闭合，DR-167）**：`taskLag` 计算以 `classId → Class.programId → Program` 的任务配置（`dailyTarget`）为达标基准；`CohortLagSnapshot` 无需单独存 `programId` 字段，因为一个班唯一归属一个 `Program`（DR-1），关联链隐式已确定。多专业学员在各专业班各持独立快照，各自独立判掉队；**任一专业掉队即触发关怀**（能力 14），互不干扰。

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

### 1.7 UserPracticeVow（发愿）🆕 改造新建（DR-121/122）· ✅ 设计已封板

**服务能力**：能力 7（个人修持自主承诺）+ 法会发愿 + 能力 4/6（加行/内加行座数·时长·计数聚合，DR-91/94）
**写权限**：学员自助（个人发愿/法会发愿）；管理员代行走能力 5 + AuditLog
**参考决策**：D18（发愿记录不物理删除）、DR-91/94（座数时长双计 + 顶礼替代）、**DR-121/122（改造新建·非复用：线上无 vow 表，是计数打卡器之上新建的发愿层；折叠线上 PracticeGoal 的每日/每周目标）**

> **改造定性（DR-121/122）**：~~✅ 已封板复用~~ **修订**——线上实修是纯计数打卡器（无 vow 表），本表是**改造新建**。线上 **PracticeGoal**（每日目标）**折叠进本表**（dailyTarget/weeklyTarget 承载，PracticeGoal 废表）。下方字段定义有效。

> **定位（用户决策 2026-05-29）**：本表是修学计数模块的**统一用户追踪条目表**，覆盖 5 种 context。任务定义（ClassTask / CohortRecommendedTemplate）独立存储，UserPracticeVow 是每个用户的追踪实例，两者通过外键关联。
>
> **保留的旧设计逻辑**：`isPledged` 两分法——用户添加修学时提示「是否发愿」；~~法会愿进度走 `EventCount` 独立计数流~~ **（DR-134 改：法会愿进度走 PracticeLog，context=event 独立标识，不混日常打卡总量/排行；EventCount 废弃）**。
>
> **去掉的旧设计字段**：`source`、`classId`（旧任务锚点）、`templateId`（旧模板锚点）、7 态 VowStatus 状态机（source=auto 专属，本表已用 context 区分）、`currentStatus/statusCalculatedAt/statusNote`、`paceHistory`（过度设计）、`appointmentId`（约修 ⏸ 暂缓）。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | 旧 |
| `userId` | String | 关联 User | 旧 |
| `context` | String | `personal` / `event` / `class_task` / `program_task`（见下方说明）| 旧（扩展）|
| `eventId` | String? | context=event 时关联 **DharmaAssembly**（DR-134：原指 Event 幻影表，改指线上真表）；存 `targetCount`=发愿数量 | 旧（DR-134 改指向）|
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
| `isSubstituted` | Boolean | 默认 false；**true=顶礼 vow 已获批心咒代替**——历史修行数值原封不动、独立保留，不参与顶礼升学预检达标判定；应用层另建心咒 vow 从 0 独立计（DR-94）| **新增** |
| `substitutionFor` | String? | 仅心咒代替 vow 使用（practiceProjectId=心咒项目）；存被代替的顶礼 UserPracticeVow.id——升学预检时先找到此字段指向的顶礼 vow（isSubstituted=true），再验证本 vow.`currentCount ≥ 2,000,000` 才触发顶礼+法王祈祷文双豁免（DR-151 因果链：一因两果，大纲§649）| **新增** |
| `status` | String | `active` / `paused` / `completed` / `abandoned` / **`revoked`**；默认 active；`revoked` 专用于撤销替代后的心咒 vow（D18 不删除，区别于 abandoned 自愿放弃；DR-155）| 旧（简化：去 7 态）+ **DR-155 新增 revoked** |
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
  isSubstituted        Boolean   @default(false) // 顶礼→心咒代替标记；true=历史数值保留+独立，不参与顶礼达标（DR-94）
  substitutionFor      String?   // 心咒代替 vow 专用：指向顶礼 vow id；升学预检验 currentCount ≥ 2,000,000 → 顶礼+法王祈祷文双豁免（DR-151）
  status               String    @default("active")  // active/paused/completed/abandoned/revoked；revoked=心咒代替撤销（DR-155，D18 不删）
  pausedAt             DateTime?
  pausedBy             String?
  resumedAt            DateTime?
  completedAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user            User                      @relation(fields: [userId], references: [id])
  event           DharmaAssembly?           @relation(fields: [eventId], references: [id])  // DR-134：改指线上真表 DharmaAssembly（原 Event 幻影表废弃）
  classTask       ClassTask?                @relation(fields: [classTaskId], references: [id])
  cohortTemplate  CohortRecommendedTemplate? @relation(fields: [cohortTemplateId], references: [id])
  logs            PracticeLog[]             // context≠event 的打卡来源
  // DR-134：删 eventCounts EventCount[]——EventCount 幻影表废弃（旧设计独立计数流，2026-05-27 已废计数）。法会计数改走 PracticeLog（context=event 独立标识，不混日常打卡总量/排行）
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
| context=event 愿进度 = SUM(PracticeLog.count WHERE vowId=:id) | 应用层 | **DR-134：改走 PracticeLog（统一修学计数模块），context=event 独立标识不混日常打卡总量/排行**（承接 DR-34 区隔初衷，但用统一表 + 标识区分，非独立 EventCount 表）|
| 法会页统计：参与人数 = COUNT(DISTINCT userId)；发愿总数 = SUM(targetCount) WHERE eventId=:assemblyId | 应用层 | DR-134：人数=发愿人头，总数=各人发愿数量之和 |
| 裸追踪项不可补发愿 | 应用层 | 要发愿须新建 isPledged=true 的愿，历史打卡不追溯 |
| 幂等保护（自动建条目）| 应用层 | 同 userId + classTaskId / cohortTemplateId 已存在则跳过，不重复建 |
| **外部事件不触发 vow 状态变化** | 应用层 | ClassTask 停用、退班、毕业、法会结束——均不改变 UserPracticeVow.status；vow 按用户设定的 currentEndDate 自然到期 |
| auto 建条目的 currentEndDate 初始值 | 应用层 | class_task 继承 ClassTask.endDate（如有，否则 null）；program_task 继承 PracticeTemplate.durationDays 计算值（如有，否则 null）；用户可随时调整 |
| isSubstituted=true 时豁免条件（DR-151）| 应用层 | 顶礼 vow 置 isSubstituted=true 后，升学预检通过 `substitutionFor` 找到**status=active**的心咒 vow，验证 `currentCount ≥ 2,000,000`：完成→顶礼 ✅ + 法王祈祷文 ✅（双豁免，一因两果，大纲§649）；未完成→两项均 ❌；历史顶礼数值原封保留（DR-94/DR-151）|
| 心咒代替换算比例写死 | 应用层 | 新建心咒 vow 的 targetCount = 2,000,000，同步写 `substitutionFor = 顶礼 vow id`（应用层常量，大纲规定不可配置；DR-94/DR-151）|
| **撤销替代时心咒 vow 置 revoked（DR-155）** | 应用层 | 撤销替代动作：① 顶礼 vow `isSubstituted` → false；② 心咒 vow `status` → `revoked`（不物理删除，D18；不用 abandoned 以区分用户主动放弃）；`substitutionFor` 指针保留（历史留档）|
| **二次替代复用既有心咒 vow（DR-155）** | 应用层 | 再次替代时：先检查同一顶礼 vow 是否有 `substitutionFor=顶礼vow.id` 且 `status=revoked` 的心咒 vow → 有则复用（`status`→`active`，`currentCount`→0，重新起算）；无则新建（首次替代路径）；**严禁新建第二条 active 心咒 vow 指向同一顶礼 vow**（应用层前置检查，消除多行非确定性，R1-T5/T6/T10）|
| 预检只读 status=active 心咒 vow（DR-155）| 应用层 | AdvancementCheck 反查时过滤条件：`substitutionFor=顶礼vow.id AND status=active`，确保唯一一行（revoked 心咒 vow 不参与预检）|

#### 设计意图

**打卡入口统一在修学计数模块**：5 种 context 的条目全在同一列表。~~应用层按 context 分流写表（event → EventCount；其余 → PracticeLog）~~ **（DR-134 改：全部 context 统一写 PracticeLog，event 用 context=event 标识区分，不再分流到 EventCount；EventCount 废弃）**，用户无感知。

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

### 1.8 CohortRecommendedTemplate（班级模板绑定）🆕 线上无·实为新建（DR-130）· ✅ 设计已封板

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
| `gender` | String? | 性别 male/female/other/null；个人档案展示，暂无业务规则依赖（DR-136，能力 48）| **新增** |
| `primaryProgramId` | String? | **主修专业**（多专业并行时的 UI 偏好，能力 2 绝对约束 3，DR-120）；可空（未设则无主修）；与「主班 ClassMember.isPrimary」语义区分——主班是「一人多班的默认进入班级」，主修专业是「多专业里偏好展示的那个专业」| **新增** |
| `practiceVisibleToClass` | Boolean | 默认 false；修学量（念诵/答题/阅读/活跃天数）是否对班级可见——能力 7/26 排行 + 能力 14 关怀的隐私开关数据源（DR-125 补列）| **线上已有·此前漏列·补回复用** |
| `meditationVisibleToClass` | Boolean | 默认 false；观修量是否对班级可见——能力 4/26 观修排行的隐私开关数据源（DR-125 补列）| **线上已有·此前漏列·补回复用** |

> **隐私开关补列说明（DR-125）**：`practiceVisibleToClass` / `meditationVisibleToClass` 线上 schema 已有（schema.prisma 42/45 行），但本表此前「旧设计 13 字段」清单遗漏。能力 4/7/14/26 的「尊重隐私开关、关闭可见性不进榜/不展示」均依赖此二字段——改造建表时**必须保留**，否则隐私功能失效。补列后归「复用」（非新增，线上已存在）。

```prisma
model User {
  // ... 旧设计现有所有字段保留 ...
  // ... §2.2 扩展 13 字段保留（studentId/nickname/accessibilityNeeds/dataSource/
  //     learningMode/preferShowFaxin/timezone/realName/phone/phoneRegion/
  //     refugeStatus/city/practiceBackground）...

  // 线上已有·此前漏列·补回复用（隐私开关，DR-125）
  practiceVisibleToClass   Boolean @default(false) // 修学量对班级可见（能力7/14/26）
  meditationVisibleToClass Boolean @default(false) // 观修量对班级可见（能力4/26）

  // 新增（年龄豁免数据源）
  birthDate DateTime?  // 出生日期；年龄豁免资格计算用（年满60岁可申请免考，非自动）

  // 新增（个人档案字段，DR-136；能力 48 C4）
  gender    String?    // 'male' | 'female' | 'other' | null（不填）；个人档案展示，暂无业务规则依赖（60岁豁免靠 birthDate 非 gender）

  // 新增（主修专业偏好，能力 2 绝对约束 3，DR-120）
  primaryProgramId String?   // 多专业并行时偏好展示的专业；可空；区别于主班 ClassMember.isPrimary
  primaryProgram   Program? @relation("UserPrimaryProgram", fields: [primaryProgramId], references: [id])

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

### 1.12 PracticeLog（修持打卡日志）🆕 改造扩展自 PracticeEntry（DR-121/122/123）

> **计数口径（DR-123）**：本表由线上 `PracticeEntry`（纯计数表）**改造**而来——rename + 加列，migration 属 ALTER（M1），故**计入 §一 扩展区**（语义是「改造」，物理是「扩展现有表」）。区别于 UserPracticeVow（线上无此表，真新建，计入 §三）。

**服务能力**：能力 4（加行观修座数/时长）+ 能力 6（内加行计数 + **法王祈祷文独立计数**）+ 能力 7（修持日志）
**写权限**：学员自助录入；管理员代录走能力 5 + AuditLog
**参考决策**：DR-95（新增 prayerCount）、DR-120（新增 programId 跨专业追溯 + taskSourceType + source 值域明确）、**DR-121/122（改造新建·非复用：由线上纯计数表 PracticeEntry 改造而来；source 值域 tap/shake/bulk→manual/auto/ai_assistant（后 DR-144 再校准 in_app/external/ai_assistant）；note 字段承载修行心得，PracticeJournal 废表）**

> **判定（DR-121/122 修订）**：~~旧设计字段完整，✅ 复用 / 🔧 扩展~~ **作废**——线上对应表是 **PracticeEntry**（纯计数：count + source `tap/shake/bulk` + note，无 vowId/durationMinutes/meditationId/prayerCount），本表是**改造新建**（由 PracticeEntry 改造而来，§三性质）。改造内容：(1) 加 vowId/durationMinutes/meditationId/prayerCount/programId/taskSourceType；(2) source 值域 `tap/shake/bulk` → `manual/auto/ai_assistant`（新设计目标语义，DR-120）；(3) **note 字段承载修行心得**（折叠 PracticeJournal，DR-122）。DR-95 prayerCount / DR-120 字段全部有效。

#### 旧设计字段（全部复用，见 §四 PracticeLog 复用说明）

旧设计字段不改，以旧 schema 为准（含 id / userId / vowId / practiceProjectId / meditationId / count / durationMinutes / loggedAt / source 等）。

#### 新增字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `prayerCount` | Int? | 本次顶礼同步念诵法王祈祷文遍数；非顶礼类打卡为 null；顶礼类必填（Zod 按 practiceProjectId 判断）| **新增** |
| `programId` | String? | **达标来源专业**（能力 6 绝对约束 4 / D14a 跨专业累计共享，DR-120）；标注这条修量算在哪个专业名下；可空（无专业归属的自由打卡）；升学预检按 programId 聚合并可显示「通过 A 专业达成」| **新增** |
| `taskSourceType` | String? | **任务来源类型**（能力 9，DR-120）：`course`（课程自带）/ `class_task`（辅导员布置）/ `self`（学员自发）；与 source（录入方式）正交 | **新增** |

> **`source` 字段值域明确（DR-120）**：旧设计已有 `source` 字段，本次明确其值域为 `manual`（学员手动录入）/ `auto`（系统自动产生）/ `ai_assistant`（AI 代录，TODO-AI-2 实现时启用）。能力 9 绝对约束 1「每条记录必须标注来源（自动/手动）」由本字段承载；taskSourceType（任务来源）与 source（录入方式）是两个正交维度。

```prisma
model PracticeLog {
  // ... 旧设计现有字段保留（含 source，值域 in_app/external/ai_assistant，DR-144 校准——DR-143 后 auto 无来源）...

  // 新增（能力 6 法王祈祷文独立计数，DR-95）
  prayerCount Int?  // 顶礼类打卡时必填，其余 null

  // 新增（能力 6 跨专业追溯 + 能力 9 任务来源，DR-120）
  programId      String?   // 达标来源专业；升学预检按此聚合，可显示「通过A专业达成」
  program        Program? @relation("PracticeLogProgram", fields: [programId], references: [id])
  taskSourceType String?   // course / class_task / self（任务来源，与 source 录入方式正交）
}
```

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 顶礼打卡时 prayerCount 必填 | 应用层（Zod）| `practiceProjectId` 对应顶礼项目时，prayerCount 不可为 null |
| 非顶礼打卡时 prayerCount 为 null | 应用层（Zod）| 其余修持项目不录祈祷文 |
| prayerCount 取值范围 | 应用层（Zod）| ≥ 0 的整数；不超过当次顶礼数量的合理倍数（应用层宽松校验）|
| source 必标 | 应用层（Zod）| 值域 in_app/external/ai_assistant（DR-144 校准，原 manual/auto/ai_assistant）；能力 9 绝对约束 1「每条记录必须标注来源」（DR-120/144）|
| taskSourceType 值域 | 应用层（Zod）| course/class_task/self；与 source 正交，可空（DR-120）|
| programId 跨专业追溯 | 应用层 | 升学预检按 programId 聚合，B 专业满足时溯源「通过 A 专业达成」（D14a，DR-120）|
| **vowId 必填（多专业分流）** | 应用层（Zod）| POST /api/practice-logs 时 `vowId` 必须提供（非 null）；后端校验该 vow 属于当前用户 + 当前活跃学期的 ClassMember；多专业并修时 vowId 是唯一可靠的分流依据（DR-153）|
| 不物理删除（D18）| 应用层 | 打卡记录永久保留 |

#### 设计意图

**法王祈祷文独立计数（能力 6 规则 1）**：升学预检时，祈祷文达标 = `SUM(prayerCount WHERE practiceProjectId = 顶礼项目 AND userId = :id AND ritualCompliant IS NOT FALSE) ≥ 100,000`（`ritualCompliant IS NOT FALSE` 过滤同 DR-164）。**聚合范围同 cumulative_count DR-157**：不过滤 `programId` / `vowId`，全量聚合该用户该修持项目全部打卡的 prayerCount；多专业并修学员在任一专业顶礼时记录的 prayerCount 均计入（D14a 跨专业共享精神，ISG-11 闭合，DR-166）。同次录入（顶礼数 + 祈祷文数）消除两张表对账的复杂性；prayerCount 可小于顶礼次数（用户当次只念了部分），累计计算自然处理差距。

**isSubstituted 豁免路径**：顶礼 `UserPracticeVow.isSubstituted = true`（心咒代替）→ 升学预检通过心咒 vow.`substitutionFor` 找到被代替的顶礼 vow，核查心咒 vow.`currentCount ≥ 2,000,000`。完成→顶礼 ✅ + 法王祈祷文 ✅（双豁免，无需聚合 prayerCount，一因两果，大纲§649）；未完成→两项均 ❌（DR-94/DR-95/DR-151 协同）。

> **心咒 cumulative_count 独立判定（T4 闭合，DR-171）**：替代路径（isSubstituted=true）所用的心咒打卡记录，**同时也计入心咒自身的 `cumulative_count` 条件**（如心咒项 10 万），两者独立判定、互不排斥。同理，正常路径顶礼打卡产生的 `prayerCount` 同时计入法王祈祷文条件——顶礼、法王祈祷文、心咒三者本为同时进行的修持，一笔打卡服务多个升学条件是有意设计，非重复计算错误（用户决策 2026-06-04）。

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

## 三、➕ 新建表（20 张，DR-145 校准）

按新业务能力从头设计。

> 注：ProgramAdvancementConfig 为核对能力 10 时新增（升学条件数据化，存法二）；EnrollmentStatusHistory 为核对能力 11 时新增（入学状态变更永久留痕，D18）；ClassSessionSchedule 为核对能力 8 时新增（课表模板层，双轨发起）；ClassTask 为核对能力 9 时新增（辅导员布置班级任务，独立于发愿系统）。新建区由 12 张逐步扩展至 16 张；UserRoleAssignment（移入 §二 2.1）和 TransmissionRecord（移入 §二 2.3）从新建区迁出后，最终定为 14 张。（AssistantAssignment 曾短暂并入 §2.1，后核对 02 文档角色定义回滚为独立表，仍计入 14 张，DR-82。）TODO 处理阶段新增 §3.15 LeaveRequest（班级成员请假审批，TODO-6，DR-90），新建区更新为 15 张。**DR-123 实修域改造细化后校准为 17 张**——新增 UserPracticeVow（§1.7，发愿层，线上无此表）+ PracticeTemplate（修持模板，CohortRecommendedTemplate 依赖的承重表，DR-123 纠正前误判废弃）两张 🆕 改造新建（编号物理保留原位 §1.7 / §四原行，计数归本区，详见 DR-123）。**DR-129 再校准为 18 张**——LessonCompletion（闻思听/看/观修完成事件表，带 type）此前 08 误标 §四「复用」，实为线上幻影表（grep=0），改判 🆕 新建移入本区，详见 DR-129。**DR-139 再校准为 19 张**——SmsLog（短信发送记录，DR-126 D3 能力 45 净资产补建）此前 ⚠️ 待定「复用 DispatchLog vs 独立表」，用户拍板独立新表（承载短信专有字段 + 幂等），新增 §3.16，详见 DR-139。**DR-145 再校准为 20 张**——UserSelfStudyProgram（自学模式，原 §5.4 暂缓）随能力 21 转必做正式功能，由 §五暂缓移入本区（物理位置保留 §5.4，计数归本区，同 DR-129 处理），详见 DR-145。

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

#### 各 conditionType 标准 params 结构（TODO-17 专题设计，2026-05-30）

> **设计原则（DR-97）**：`params` Json 可完整表达所有复杂条件，无需新建子表。每种 conditionType 的解析逻辑固定在应用层，params 只是参数包。`targetValue` 单 Int 不够用时，相关数值全写进 `params`，`targetValue` 置 null。

##### practice_session（逐法达标，DR-98，ISG-10 闭合，DR-165）

```json
{
  "type": "per_item",
  "groupBy": "meditationId",
  "itemCount": 92,
  "minSessionsPerItem": 3,
  "minMinutesPerItem": 90,
  "totalMinSessions": 276,
  "totalMinMinutes": 8280
}
```

**判定逻辑**：`GROUP BY meditationId WHERE userId=:id AND loggedAt >= :vowCreatedAt`（`:vowCreatedAt` = `UserPracticeVow.createdAt` 起修日，即 vow 建立时刻，ISG-4 闭合，DR-161）→ 每组 `COUNT ≥ minSessionsPerItem AND SUM(durationMinutes) ≥ minMinutesPerItem` → 满足组数 = `itemCount` AND 全局 `COUNT ≥ totalMinSessions` AND `SUM ≥ totalMinMinutes`。双维度独立达标（DR-91）。起修日前（S1）的修量不计入升学预检（能力 4 规则 8）。**`source` 不过滤**：`in_app`（app 内记录）与 `external`（线下计数模块申报，DR-144）同等计入；"须录完整信息"的约束（`meditationId` 必填 + `durationMinutes ≥ 30`）在录入层 Zod 校验把关，预检不二次过滤（ISG-10 闭合，DR-165）。

##### exam_score（考试合格线多维矩阵，DR-99，T13 闭合，DR-168）

```json
{
  "attendanceThreshold": 93,
  "highAttendance": {
    "maxAttempts": 1,
    "passScore": 30
  },
  "lowAttendance": {
    "openBookPassScore": 72,
    "closedBookPassScore": 60,
    "orTwoAttemptsEachScore": 30
  },
  "ageExemptionMinAge": 60
}
```

**判定逻辑**：查该学员出勤次数（ClassSession 出勤记录）→ 对照 `attendanceThreshold` 选分支 → highAttendance: 1次≥30分合格；lowAttendance: 1次及格（开卷≥72 或闭卷≥60）或2次各≥30分。`ageExemptionMinAge` 仅用于标记资格，不自动通过（DR-100）。

> **考试线下/后台录入约束（DR-99）**：考试在线下进行，不经 app 端。成绩由 subject_admin 在后台管理端录入 ExamGrade（能力 10 职能 #11b，§1.4 已封板）。AdvancementCheck 读 ExamGrade 判断合格线。

> **多专业学员隔离（DR-168）**：`exam_score` 预检通过 JOIN 链 `ExamGrade → Exam（examType='advancement'）→ Class.programId = :pid` 过滤成绩范围，仅取本次预检目标专业对应班级的升学考成绩。`ExamGrade` 无需加 `programId` 冗余字段，隔离由 JOIN 链隐式保证（T13 闭合）。

##### cumulative_count（内加行累计，ISG-7 闭合，DR-164，T2 闭合，DR-170，T5 闭合，DR-172）

```json
{ "practiceProjectId": "<项目 id>" }
```

**判定**：`SUM(PracticeLog.count WHERE practiceProjectId=:id AND userId=:id AND ritualCompliant IS NOT FALSE) ≥ targetValue`。法王祈祷文用 `SUM(PracticeLog.prayerCount WHERE ritualCompliant IS NOT FALSE)` 独立聚合（DR-95）。管理员标记 `ritualCompliant=false` 的打卡记录不计入升学预检（ISG-7 根因修复，DR-164）。

> **不过滤起修日（DR-170）**：`cumulative_count` 聚合**不加** `loggedAt >= UserPracticeVow.createdAt` 过滤，全量历史打卡均计入。内加行是终身修持的累计遍数，历史念成的功德不因立誓时间晚而倒扣（D14a「念一份算多份」的时间维度延伸）。此点与 `practice_session` 的起修日过滤（DR-161）有意不同：92 修法讲的是"完整修完一轮"的座次资格，起修日界定修行起点合理；内加行讲的是"累计遍数够不够"，历史遍数已念成，无需重置起点（用户决策 2026-06-04，T2 闭合）。

> **isSubstituted=true 时顶礼 cumulative_count 整体切换替代路径（T5 闭合，DR-172）**：当顶礼 `UserPracticeVow.isSubstituted = true`，升学预检对顶礼项的判定**整体切换为替代路径**（DR-151）——验证心咒 vow `currentCount ≥ 2,000,000`，不再聚合顶礼历史打卡的 `count`。顶礼历史打卡数值原封保留（DR-94），仅不参与本次预检达标判定。两路并行（既聚合历史打卡又验证替代）会产生语义歧义（"顶礼差 5 万但替代已达成，算通过吗？"），故明确：isSubstituted=true 即切换路径，非叠加路径（用户决策 2026-06-04）。

##### course_completion（闻思圆满，ISG-9 闭合，DR-158）

```json
{
  "courseTypes": ["entry", "formal"]
}
```

**判定逻辑**：
1. 获取本专业（`programId=:pid`）下 `Course.courseType IN params.courseTypes` 的全部课时集合（lessonIds）
2. 对集合中每一课时判断该学员是否「闻思圆满」：
   - **普通学员**：`LessonCompletion WHERE userId=:uid AND programId=:pid AND lessonId=:lid AND type IN (audio,video)` COUNT ≥ 1（听）+ `type=read` COUNT ≥ 1（看）+ 对应 UserAnswer 全部 passed（答题）
   - **blind（视障）**：听 ≥ 2 遍（`type IN audio,video` COUNT ≥ 2），免答题（DR-92）
   - **deaf（听障）**：看 ≥ 2 遍（`type=read` COUNT ≥ 2），免答题（DR-92）
3. 全部课时均圆满 → `passed: true`；任意一课时未圆满 → `passed: false`（`targetValue` 留 null，达标条件=100% 覆盖）

**关键约束**：过滤条件必须包含 `programId=:pid`，确保 A 专业的 LessonCompletion 记录不满足 B 专业的 course_completion 预检（ISG-9 根因修复；能力 3 规则 7"各自完成"的数据层落实，DR-158）。

##### attendance（共修出勤达标，ISG-2 闭合，DR-159）

```json
{
  "studyType": "group_attend",
  "classScope": "current_member"
}
```

**判定逻辑**：
```sql
SELECT COUNT(*) FROM StudyRecord
WHERE userId = :uid
  AND studyType = 'group_attend'
  AND classId = (
    SELECT classId FROM ClassMember
    WHERE userId = :uid AND programId = :pid AND cohortStatus = 'active'
  )
≥ targetValue
```

- `studyType = group_attend`：只计实到课次，不含补课回看（`group_review`）/总结课（`group_summary`）（D-A2）
- `classScope = current_member`：只计当届 ClassMember 对应班级出勤（`cohortStatus='active'`），留级后历史出勤不自动累入（DR-163）；前届已满足可由管理员授予 `exempted=true` 豁免（DR-85）
- `targetValue`：在 ProgramAdvancementConfig 行上配置门槛值（如 93）

##### transmission（灌顶传承达标，ISG-3 闭合，DR-160）

```json
{ "transmissionKey": "<条件键>" }
```

**判定逻辑**：
```sql
SELECT 1 FROM TransmissionRecord
WHERE userId = :uid
  AND transmissionKey = :conditionKey
  AND isRequired = true
  AND status = 'active'
```

> 传承记录仅由管理员在后台录入，无学员自报路径，`isConfirmed=false` 的记录不会出现；故无需额外加 `isConfirmed=true` 过滤（DR-160）。与 DR-46 原描述一致。

##### 年龄豁免处理（DR-100）

不是独立 conditionType，而是 `exam_score` 条件的豁免路径：
- `exam_score` 条件上 `isExemptable: true`
- params 含 `ageExemptionMinAge: 60`
- AdvancementCheck：若 `now() - birthDate ≥ 60年` → checkResults 该条加 `"ageEligible": true`，但 `passed: false`
- Admin 看到 `ageEligible=true` 提示，手动走能力 5 代行豁免 → `exempted: true` + AuditLog（D17）
- **不自动置满足**（DR-70 已定调，用户决策 2026-05-29）

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

> 纯应用层判定逻辑，数据源已就位：「听/看」次数来自 LessonCompletion（type），「答题」来自 UserAnswer，「身份」来自 User.accessibilityNeeds 快照。**DR-143：听/看完成事件由用户手动确认写入（非自动达标）；闻思仅含听/看/答题、不含观修（观修属能力 4，走 PracticeLog）。DR-144：听/看完成可来自 in_app（app 内确认）或 external（app 外计数模块申报），COUNT 不区分来源、判定口径一致。**

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

**服务能力**：能力 6（报数与快照）~~+ 能力 10（升学资格预检，快照数据源）~~（DR-162：升学预检改直接查询，本表仅服务报数展示）
**写权限**：系统自动生成（定时任务，节点截止时触发）；无人工写 API
**参考决策**：D3（数据驱动）、D18（无物理删除）、DR-83

快照在每个「汇报节点截止时刻」由系统冻结该学员当前的学修数据，作为节点评估的权威数据源。一旦生成不可修改；admin 事后更正走 AuditLog（§3.11），不改快照本身。
> **与升学预检解耦（DR-162）**：本表仅用于报数汇总展示，AdvancementCheck 直接查询原始数据，不读本表。

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
| 拒绝忏悔不在本表记录（DR-84）| 应用层 | 学员拒绝即无记录；管理员走取消资格（职能 #14）+ AuditLog；⏸ **取消资格前置检查逻辑待定**（见 DR-84）|

#### 设计意图

status 只有两态（`submitted`/`acknowledged`），不引入 `refused`/`escalated`（DR-84）：拒绝忏悔的学员本表无记录，管理员直接走取消资格 + AuditLog 留痕；⏸ **取消资格前置检查逻辑待定**（DR-84）：「虚报处理必须先走忏悔流程，不可跳过」（能力 9 规则 #4）的应用层 gate 实现方式——包括学员拒绝忏悔时如何满足 gate、检查哪张表/哪个字段——待后续讨论后再定。

---

### 3.9 AdvancementCheck（升学资格预检报告）✅ 已封板（T10 闭合，DR-169）

**服务能力**：能力 10（考试与升学）规则 5（系统自动预检）
**写权限**：系统自动生成（报数节点截止后触发）；管理员可更新 checkResults 豁免字段 + status=reviewed
**参考决策**：D3（条件数据化）、D13（硬条件不放宽）、D17（代行豁免留痕）、D18（不物理删除）、DR-85

管理员触发（或报数节点后自动触发）→ 系统**直接查询原始数据表**（PracticeLog / LessonCompletion / StudyRecord / TransmissionRecord / ExamGrade）+ ProgramAdvancementConfig 跑 6 类条件预判，**不依赖 SemesterSnapshot**（DR-162）→ 生成每人一张预检报告（本表）→ 管理员审阅，对 `isExemptable=true` 的失败条件走能力 5 代行豁免（更新 checkResults Json + 写 AuditLog）→ 管理员拍板升学 → AdvancementRecord（§3.10）。

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
| `@@unique([userId, programId, semesterNumber, reportNodeIndex])` | DB | 同人同科系同节点只有一张预检报告；重触发预检时 **upsert**（DR-169）|
| `@@index([classId, semesterNumber])` | DB | 按班级+学期查全班预检 |
| 豁免前检查 isExemptable | 应用层 | 对应 ProgramAdvancementConfig.isExemptable=false 的条件不允许豁免（D13）|
| 豁免写 AuditLog | 应用层 | D17，每次豁免均留痕（操作人+原因）|
| 无 delete API | 应用层 | D18，预检报告永久留档 |
| 升学前检查 reviewed | 应用层 | AdvancementRecord 只能在 status=reviewed 的预检基础上创建 |
| 多专业预检独立（D9/D16）| 应用层 | 每条预科升学线按 programId 各自跑 6 条件，**无跨专业豁免**——在读正科 A 不豁免并行预科 B 的预检（R1-T14 撤销 zhengke_bypass）|

#### 设计意图

**重触发预检 = upsert（DR-169）**：学员补足条件后管理员可再次触发预检，系统以 `[userId, programId, semesterNumber, reportNodeIndex]` 为 upsert 键，更新 `checkResults` / `overallPassed` / `status`，不创建新行。历史留证靠 `AdvancementRecord`（每次管理员拍板 = 一条，不可变）+ `AuditLog`（每次豁免 = 一条）双层留痕，`AdvancementCheck` 只保存当前预检状态，无需堆版本。实现层必须用 upsert（而非 create）避免唯一键冲突。

checkResults 选可变 Json（DR-85，方案 A）而非拆 AdvancementCheckItem 子表：豁免信息直接写入对应条目的 `exempted/exemptedBy/exemptedAt` 字段，AuditLog 同时记录操作人，无需独立表即可满足留痕要求（D17）。TODO-9（92 法逐法达标）、TODO-12（60 岁年龄豁免）、TODO-13（考试合格线矩阵）的**判定逻辑**在应用层跑预检时实现，本表字段层面已就位。**多专业预检独立（D9/D16）**：每条升学线按 programId 各自跑 6 条件，无跨专业豁免——曾设 `zhengke_bypass`（DR-154 G1.7-3：在读正科即跳过预科预检），R1-T14 回归发现作用域过宽会让在读正科密法豁免掉并行净土预科的真实未达标，与 D9/D16 多专业独立正面冲突，故撤销；已 `advanced` 的成员本就不进预检，bypass 实为冗余。

**D14a/D14b conditionType 的预检 Query Scope 规则（DR-157）**：同一个修持项目（如观音心咒）可能同时出现在多个专业、以不同 conditionType 要求——以下两条规则明确各自的聚合范围，缺一不可：

- **cumulative_count 条件（D14a 累计型，跨专业共享）**：预检聚合范围 = `SELECT SUM(count) FROM PracticeLog WHERE userId=:uid AND practiceProjectId=:pid`，**不过滤 programId、不过滤 vowId**。任意 programId/vowId 下录入的该修持项目打卡均计入。PracticeLog.programId 仅用于结果溯源展示（"通过 X 专业达成"，DR-120），不作过滤条件。这样"念一份功德算多份"（D14a）在数据层得以实现——学员从入行论任务卡片录入的观音心咒同时计入加行的累计预检，无需重复录入。

- **daily_frequency 条件（D14b 日常型，跨专业不共享）**：预检聚合范围 = `SELECT DATE(loggedAt), SUM(count) FROM PracticeLog WHERE userId=:uid AND practiceProjectId=:pid AND vowId IN (本专业所有 active/revoked vow id)`，**按 vowId 过滤本专业**，再按日统计每日 SUM ≥ dailyTarget 的天数。只有通过本专业 vow 录入的打卡才算入日常达标，其他专业的打卡不计（D14b 不豁免，06 能力 7 绝对约束 1）。vowId 是最精确的"本专业"判定依据（DR-153），programId 为可空追溯字段不作过滤主键。

> 两条规则的调和：学员若同时有加行_vow（cumulative 10万）+ 入行论_vow（daily 1000），从入行论任务卡片录入 1000 遍观音心咒 → PracticeLog.vowId=入行论_vow → D14b 入行论日常达标 ✅；D14a 加行累计聚合（无 vowId/programId 过滤）也同时得到这 1000 ✅。一次录入满足两个条件，不矛盾，不需要录两次。（剧本验证：03-scenario-shared-mantra.md GAP-1/2/3 闭合）

---

### 3.10 AdvancementRecord（升学记录）✅ 已封板（T4/T5 闭合，DR-174）

**服务能力**：能力 10（考试与升学）规则 6（升学审核流程）
**写权限**：班级管理员（class_admin+，职能 #16）；系统不自动写入，须人工拍板
**参考决策**：D13（硬条件不放宽）、D18（升学记录不物理删除）、DR-83-B（冻结原则）、DR-174

管理员审阅 AdvancementCheck（status=reviewed）后拍板：**通过 → 写 `AdvancementRecord(result=passed)`**，填 `targetProgramId`，触发 ClassMember 加入新班级；**驳回 → 不写 AdvancementRecord，只写 AuditLog（actionType=advancement_decision, result=rejected, note=驳回理由）**（DR-174）。"升学记录"只记录"升了"这件事，驳回属审核过程，由 AuditLog 承载留证。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | **新增** |
| `userId` | String | 升学的学员 | **新增** |
| `classId` | String | 升学前所在班级 | **新增** |
| `programId` | String | 升学前所在科系 | **新增** |
| `targetProgramId` | String | 升入的科系（本表只写 passed，必填）| **新增** |
| `advancementCheckId` | String | 关联 AdvancementCheck（一对一，@unique）| **新增** |
| `result` | String | `passed`（唯一值；驳回不写本表，只写 AuditLog，DR-174）| **新增** |
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
| `advancementCheckId @unique` | DB | 一张预检报告只能出一份升学记录（本表只写 passed，故唯一约束可靠）|
| `conditionsSnapshot` 冻结 | 应用层 | 写入后不可修改（同 DR-83-B，拍板时刻数据即真相）|
| 创建前检查 AdvancementCheck.status=reviewed | 应用层 | 管理员须先完成审阅预检流程再拍板 |
| `targetProgramId` 必填 | 应用层 | 本表只在 passed 时写入，targetProgramId 不可为空 |
| 驳回不写本表 | 应用层 | 驳回只写 AuditLog(advancement_decision)，不创建 AdvancementRecord（DR-174）|
| 无 delete API | 应用层 | D18，升学记录永久留档 |

#### 设计意图

`conditionsSnapshot: Json` 冻结原则（DR-83-B 复用）：升学拍板那一刻的条件快照独立存储，即使后续 AdvancementCheck.checkResults 被更新或条件配置变更，历史升学依据不受影响。

**驳回不写本表（DR-174）**：AdvancementRecord 只在 passed 时写入，驳回只写 AuditLog（actionType=advancement_decision, result=rejected, note=驳回理由）。这解决了 approve-after-reject 的 @unique 冲突：驳回不占用唯一键槽位，补足后 approve 可顺利写入 AdvancementRecord。"升学记录"语义上是"升了"的档案，驳回的审核过程由 AuditLog 承载（D17 留痕），与能力 20 审计链一致（DR-174）。下一轮升学仍另起 AdvancementCheck upsert → AdvancementRecord（passed）流程。

**conditionsSnapshot 深度说明（T11/T14 消解，DR-173）**：`conditionsSnapshot` 冻结"结论层"（每条条件的 `actual` / `passed` / `exempted` 值），无需额外冻结原始数据细节（心咒 vow 当时的 `currentCount`、ExamGrade 原始分数等）。理由：DR-162 重构后，预检直接查原始数据表（PracticeLog / ExamGrade / StudyRecord 等），原始表本身即永久留档（D18 不物理删除）；审计"当时凭什么升学"可直接查原始表截面，不依赖快照复现。`AdvancementCheck.checkResults` 也永久留档（D18），两者共同构成完整审计链，conditionsSnapshot 无需深度复制原始数据（用户决策 2026-06-04）。

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
> **达标率定义（DR-124 扩展）**：按 `period` 分三种口径——daily=`每日达标天数/有效天数`、weekly=`达标周数/有效周数`、fixed=`期间累计是否 ≥ targetCount`（达成即 100%）。每班 5-10 个任务。

> **多周期支持（DR-124，用户决策 2026-05-31）**：班级任务可「以时间为单位」——用户举例「每星期必须 3 座禅修」（weekly）、「每天 1000 遍观音心咒」（daily），加上「期间累计型」（fixed，如本月共持咒 10 万遍）。故 ClassTask 加 `period`（daily/weekly/fixed）+ 对应目标字段，与 UserPracticeVow.targetPeriod 结构对齐。

#### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `classId` | String | 关联班级（任务作用范围为整班）|
| `practiceProjectId` | String | 修持哪个项目（关联 PracticeProject）|
| `title` | String? | 自定义标题；null 时用 PracticeProject.name 显示 |
| `period` | String | **任务周期（DR-124）**：`daily`（每日）/ `weekly`（每周）/ `fixed`（期间累计）|
| `dailyTarget` | Int? | period=daily 时必填：每日目标次数（达到即当日达标）|
| `weeklyTarget` | Int? | period=weekly 时必填：每周目标次数（如「每周 3 座禅修」）|
| `targetCount` | Int? | period=fixed 时必填：期间累计目标（如「本月共 10 万遍」，startDate→endDate 区间内累计）|
| `startDate` | DateTime | 任务起始日 |
| `endDate` | DateTime? | 任务截止日；null=无限期（period=fixed 时必填，累计需明确区间）|
| `isActive` | Boolean | 默认 true；false=停用（历史 PracticeLog 保留）|
| `createdBy` | String | 创建人 userId（辅导员）|
| `createdAt` | DateTime | 默认 now() |

```prisma
model ClassTask {
  id                String    @id @default(cuid())
  classId           String
  practiceProjectId String
  title             String?
  period            String    @default("daily") // daily / weekly / fixed（DR-124）
  dailyTarget       Int?      // period=daily 必填
  weeklyTarget      Int?      // period=weekly 必填（如每周 3 座）
  targetCount       Int?      // period=fixed 必填（期间累计，如本月 10 万遍）
  startDate         DateTime
  endDate           DateTime? // period=fixed 时必填
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
| period 与 target 字段配套（DR-124）| 应用层（Zod）| daily→dailyTarget 必填；weekly→weeklyTarget 必填；fixed→targetCount + endDate 必填；非对应字段为 null |
| period 值域 daily/weekly/fixed | 应用层（Zod）| 与 UserPracticeVow.targetPeriod（daily/weekly/lifetime）平行；ClassTask 用 fixed（有起止区间）而非 lifetime |

#### 设计意图

ClassTask 只存「任务定义」。每位班级成员有一条对应的 UserPracticeVow（context=class_task），打卡走 PracticeLog，进度展示时按 `period` join ClassTask 对应目标字段（dailyTarget/weeklyTarget/targetCount，不复制，D3 实时生效）。达标率影响 CohortLagSnapshot.taskLag（能力 14）——按 period 三种口径计算（daily 按天、weekly 按周、fixed 按期间累计达成与否，DR-124）。课程自带任务（CohortRecommendedTemplate）同理，两条路径对学员端完全一致。

**多周期示例（DR-124）**：辅导员可布置「每天 1000 遍观音心咒」（period=daily, dailyTarget=1000）、「每周 3 座禅修」（period=weekly, weeklyTarget=3）、「本月共持咒 10 万遍」（period=fixed, targetCount=100000, endDate=月末）三类。weekly/fixed 是 DR-124 在原纯每日制（dailyTarget Int 必填）基础上扩展，承接了线上 PracticeTask 的 mode=fixed 并新增 weekly。

#### 线上 PracticeTask → 本表归并映射（DR-122/123）

> 线上 `PracticeTask` 是改造源，按新设计**按 scope 拆流归并**：`class`→ ClassTask（辅导员布置），`self`→ UserPracticeVow（个人发愿/目标，context=personal, isPledged=true）。两条线在新设计里语义本就分属「班级任务」与「个人发愿」，不强行塞进一张表。

| 线上 PracticeTask 字段 | 归宿 | 说明 |
|---|---|---|
| `scope`（self / class）| **拆流** | class → ClassTask；self → UserPracticeVow（context=personal, isPledged=true，折叠了 PracticeGoal）|
| `mode`（daily / fixed）| → ClassTask.period（DR-124）| class 流：daily → dailyTarget、fixed → targetCount，**另新增 weekly → weeklyTarget**（DR-124 ClassTask 已扩多周期，缺口闭合）|
| `classId` | → ClassTask.classId | class 流 |
| `ownerId`（class=辅导员 uid）| → ClassTask.createdBy | 创建者 |
| `userId`（self=归属学员）| → UserPracticeVow.userId | self 流 |
| `projectId` | → ClassTask.practiceProjectId / UserPracticeVow.practiceProjectId | |
| `title` | → ClassTask.title / UserPracticeVow.customName | |
| `target`（daily=每日N / fixed=累计N）| class → ClassTask.dailyTarget/weeklyTarget/targetCount（按 period）；self → UserPracticeVow.dailyTarget/weeklyTarget | fixed 班级累计=targetCount（DR-124 已落，缺口闭合）|
| `startAt` / `endAt` | → ClassTask.startDate / endDate | |
| `archivedAt` | → ClassTask.isActive=false（停用不删，D18）| |

> ✅ **fixed 班级任务缺口已闭合（DR-124，TODO-22）**：用户决策（2026-05-31）班级任务可「以时间为单位」——举例「每星期 3 座禅修」（weekly）、「每天 1000 遍观音心咒」（daily），加期间累计型（fixed）。ClassTask 已加 `period`（daily/weekly/fixed）+ dailyTarget/weeklyTarget/targetCount 三目标字段（见上字段表），承接线上 mode=fixed 并新增 weekly。**无功能丢失**，缺口闭合。

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

### 3.16 SmsLog（短信发送记录）✅ 已封板（DR-139）

**服务能力**：能力 45（短信通道）—— dispatchToUsers 第 3 通道（channel=sms）的专有发送记录
**写权限**：系统写入（sendSms 发送层），无对外写 API；admin 可读（排障/对账）
**参考决策**：DR-132（短信通道设计）、DR-139（独立表拍板：非复用 DispatchLog，承载短信专有字段 + 幂等）

短信按条计费、有服务商状态回执，专有信息（脱敏号码/模板/provider/计费/回执/重试）DispatchLog 装不下，故独立成表。DispatchLog 仍负责跨通道派发去重；SmsLog 负责短信通道的发送全记录 + 短信级幂等。

#### 字段

| 字段 | 类型 | 说明 | 来源 |
|---|---|---|---|
| `id` | String | cuid | **新增** |
| `userId` | String? | 收信人（验证码场景未登录时可空，靠 phone 关联）| **新增** |
| `phone` | String | 接收手机号（存储/展示按需脱敏）| **新增** |
| `purpose` | String | 用途：`verify_code`（验证码）/ `critical_announce`（critical 公告）/ `speaking_due`（⑦讲考）/ `advancement_result`（⑧升学）/ `late_attendance`（⑨迟到）| **新增** |
| `templateCode` | String | 服务商报备的模板编号 | **新增** |
| `params` | Json? | 模板填充参数（脱敏存储）| **新增** |
| `provider` | String? | 实际发送服务商（实现时填，DR-139 不锁定）| **新增** |
| `status` | String | `pending` / `sent` / `delivered` / `failed`（服务商回执更新）| **新增** |
| `providerMsgId` | String? | 服务商返回的消息 ID（对账/查回执）| **新增** |
| `errorMsg` | String? | 失败原因（重试依据）| **新增** |
| `retryCount` | Int | 重试次数，默认 0 | **新增** |
| `costCents` | Int? | 计费（分），对账用 | **新增** |
| `dedupeKey` | String | 幂等键（purpose + userId/phone + 业务日期粒度），@@unique | **新增** |
| `createdAt` | DateTime | 创建时间，默认 now() | **新增** |
| `sentAt` | DateTime? | 实际发送时刻 | **新增** |

#### 关联

| 关联 | 说明 |
|---|---|
| `user User?` | 可空，@relation(userId)；User 补反向 `smsLogs SmsLog[]`（验证码未登录场景 userId 可空，仅靠 phone）|

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| `@@unique([dedupeKey])` | DB | 短信级幂等去重——同一用途/收件人/业务日期不重复发（绝对约束 3）|
| `@@index([userId])` / `@@index([phone])` | DB | 按人/按号查发送历史 |
| 仅 verified 手机号可发业务短信 | 应用层 | 验证码除外（能力 45 约束 1）|
| 验证码频率 60s/条、5 条/天 | 应用层 | DR-139 标准档；有效期 5 分钟（校验侧） |
| 仅 critical + 指定场景走短信 | 应用层 | 用途规则 + 后台场景开关（能力 45 D/E）|

#### 设计意图

DR-139 用户拍板「独立 SmsLog 表」而非复用 DispatchLog：短信按条计费且有服务商异步回执，需要 provider/providerMsgId/costCents/status 状态机/retryCount 等专有字段，塞进通用 DispatchLog 会污染其结构。分工：**DispatchLog** 做跨通道（站内/push/sms）派发幂等的统一账；**SmsLog** 做短信通道的发送明细 + 短信级幂等 + 对账。`dedupeKey` 承载短信级去重（绝对约束 3）。`userId` 可空容纳验证码未登录场景。

---

## 四、✅ 复用表（直接沿用旧设计）

> 🔴 **现状校正（DR-130，2026-05-31）**：本区原标「复用」是 DR-72 对照旧设计文档批量确认、未 grep 验证线上 schema。经 DR-130 全量体检，**本区真实复用仅 8 张**（Lesson/LessonMediaChapter/LessonResource/LessonTextBlock/Meditation/PracticeProject/LlmCallLog/LlmProviderUsage），**12 张是线上幻影表已逐个改标「🆕 线上无·实为新建」**（ProgramSemester/ProgramStudyType/ProgramWeek×3/QuestionReference/Speaking×2/Event×2/CohortRestWeek/CohortWeeklySummary）。下表状态列已逐行更新，以 grep 结果为准。

> 以下表从旧设计直接复用，字段不改，仅确认无遗漏。待步骤 1d 快速过完后补充字段列表。

| 表 | 服务能力 | 状态 |
|---|---|---|
| ~~`Course`~~（已改判 🔧 扩展，移入 §1.11，加 courseType）| 能力 1/3/10/17 | 🔧 移入扩展区 |
| `Lesson`（课时，旧设计 +sourceText 版，详见下）| 能力 3 | ✅ 确认复用 |
| `Meditation`（观修，旧设计 +4 字段版，详见下）| 能力 3/4 | ✅ 确认复用 |
| `PracticeProject`（修持项目字典，旧设计 +2 字段版，详见下）| 能力 4/6/7 | ✅ 确认复用 |
| `PracticeCategory`（大类字典：持咒/礼拜/诵经/供曼扎/观修）| 能力 4/6/7 | ✅ 保留纳入设计（DR-122，PracticeProject 依赖它）|
| `PracticeMakeup`（补签：7天内每周1次）| 能力 7 | ✅ 保留纳入设计（DR-122，补签作正式功能）|
| `ProgramSemester`（科目/学期）| 能力 1 | 🆕 线上无·实为新建（DR-130）|
| ~~`PracticeLog`~~（改造扩展自 PracticeEntry，移入 §1.12，留 §一扩展区）| 能力 4/6/7 | 🆕 改造扩展（DR-121/122/123；计入 §一）|
| ~~`PracticeTemplate`~~（DR-123 纠正：非废弃，CohortRecommendedTemplate.templateId 依赖的承重表）| 能力 4/6/7 | 🆕 改造新建·移入 §三（DR-123）|
| ~~`CohortRecommendedTemplate`~~ | 已移入扩展区 §1.8 | ✅ |
| ~~`LessonCompletion`~~（DR-129 纠正：线上幻影表，改判 🆕 新建，移入 §三）| 能力 3 | 🆕 改造新建·移入 §三（DR-129）|
| ~~`PracticeJournal`~~ | 能力 7 | ❌ **废弃**（DR-122：修行心得折叠进 PracticeLog.note / Note）|
| `QuestionReference` | 能力 3 | 🆕 线上无·实为新建（DR-130）|
| `LessonResource` | 能力 3 | ✅ 确认复用（C 类批量，DR-72）|
| `LessonMediaChapter` | 能力 3 | ✅ 确认复用（C 类批量，DR-72）|
| `LessonTextBlock` | 能力 3 | ✅ 确认复用（C 类批量，DR-72）|
| `ProgramWeek` | 能力 1 | 🆕 线上无·实为新建（DR-130）|
| `ProgramWeekCourse` | 能力 1 | 🆕 线上无·实为新建（DR-130）|
| `ProgramWeekPractice` | 能力 1/4 | 🆕 线上无·实为新建（DR-130）|
| `ProgramStudyType` | 能力 8 | 🆕 线上无·实为新建（DR-130）|
| `CohortRestWeek` | 能力 8 | 🆕 线上无·实为新建（DR-130）|
| ~~`Event`~~ | 能力 15→法会发愿 | ❌ **废弃**（DR-134：旧设计法会重结构，从未上线；法会统一用线上真表 DharmaAssembly）|
| ~~`EventCount`~~ | 法会计数 | ❌ **废弃**（DR-134：旧设计独立计数流，2026-05-27 旧设计自己已废计数；法会计数改走 PracticeLog context=event 独立标识）|
| `DharmaAssembly` | 能力 46 法会 + 法会发愿 | ✅ **真实复用净资产**（DR-134：线上真表，补反向 `vows UserPracticeVow[]`）|
| `TantricGroup` | 能力 15/17 | 🔧 微调（删 grants，补 transmissionRecords，详见下，DR-73）|
| `ContentChunk` | 能力 25 AI 助手 | ⏸ 暂缓实现（AI 模块，DR-74；业务已登记能力 25，DR-106；调用层复用既有 LLM 网关，DR-108）|
| `FeatureEntry` | 能力 25 AI 助手 | ⏸ 暂缓实现（AI 模块，DR-74；业务已登记能力 25，DR-106；调用层复用既有 LLM 网关，DR-108）|
| `AiConversation` / `AiMessage` | 能力 25 AI 助手 | ⏸ 暂缓实现（对话历史，真新建；AI 模块 DR-74；业务登记 DR-106；调用层复用既有网关 DR-108）|
| ~~`AiUsage`~~ | 能力 25 AI 助手 | ❌ **不新建 → 复用 `LlmCallLog`（userId/scenario/cost + @@index([userId,timestamp]) 可算限流）+ `LlmProviderUsage`（按日聚合 cost）**（表重估，DR-110）|
| `SpeakingSession` | 能力 10 | 🆕 线上无·实为新建（DR-130；classId 可空设计见下）|
| `SpeakingRegistration` | 能力 10 | 🆕 线上无·实为新建（DR-130）|
| ~~`Exam`~~ | 已移入扩展区 §1.4 | ✅ |
| `CohortWeeklySummary` | 管理端 ⏸ 暂缓 | 🆕 线上无·实为新建（DR-130）|

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
> **DR-145 重整**：自学模式（原 §5.4，1 张）转必做、移入 §三实施区（物理位置保留 §5.4）；社交三家族（§5.1/5.2/5.3，10 张）降为「只做后台关键部分」——建表+后台逻辑、不做正式前端 UI，仍留本区（实现待排期）。

| 状态 | 家族 | 表数 |
|---|---|---|
| ⏸ 建表+后台·不做正式前端（DR-145）| §5.1 班级动态（ClassPost 家族） | 4 张 |
| ⏸ 建表+后台·不做正式前端（DR-145）| §5.2 班级讨论（Discussion 家族） | 4 张 |
| ⏸ 建表+后台·不做正式前端（DR-145）| §5.3 约修（PracticeAppointment 家族） | 2 张 |
| ✅ 必做·移入 §三实施（DR-145，物理保留 §5.4）| §5.4 自学模式（UserSelfStudyProgram） | （计入 §三）|

> **暂缓区合计 10 张**（4+4+2；DR-145 自学 1 张转必做移入 §三，原 11 张）。

---

### 5.1 班级动态（ClassPost 家族）✅ 设计封板

**⏸ 暂缓**：当前迭代不实现；以下设计可直接用于写 Prisma schema。

**服务能力**：**能力 22 班级动态**（发帖/评论/反应/转发，2026-05-30 已登记 06 能力 22，DR-105，⚠️ 解除）。
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

**服务能力**：**能力 23 班级讨论**（话题/投票/评论，2026-05-30 已登记 06 能力 23，DR-105，⚠️ 解除）。
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

**服务能力**：**能力 24 约修**（班级成员共同发起、参与并追踪集体修持目标，2026-05-30 已登记 06 能力 24，DR-105，⚠️ 解除）。
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

### 5.4 自学模式（UserSelfStudyProgram）✅ 必做·移入 §三实施（DR-145，物理位置保留于此、计数归 §三新建）

**⏸ 暂缓**：当前迭代不实现；以下设计可直接用于写 Prisma schema。

**服务能力**：**能力 21 自学模式**（2026-05-30 已登记 06 能力 21，⚠️「未登记」解除）。自学师兄无班级，按个人完成量学修某科系内容，进度独立于班级（DR-104）。
**写权限**：
- 创建 UserSelfStudyProgram（入学）：`subject_admin` / `super_admin`（DR-61）
- `status=paused↔active`：学员自己（暂停/恢复自学）
- `status=abandoned`：`subject_admin` 及以上（自学无班级、归科系管理，与 DR-61 入学权限一致；原「class_admin 及以上」是作用域漏洞，已改正）
- `status=completed`：系统自动（所有课时完成时触发）

**参考决策**：D3、D18（不物理删除）、DR-61（入学限管理员）、DR-103（自学与升学体系边界）、**DR-104（进度=纯完成量，推翻 DR-62~64）**

#### 自学与升学体系边界（DR-103，2026-05-30）

> 自学模式 = **纯自我学习轨道**，与班级中心的升学体系完全解耦。

| 维度 | 自学模式 | 说明 |
|---|---|---|
| 升学 | ❌ 不升学 | 自学不通向正科；要升学须先经邀请码加入正式班级（能力 2），届时按班级学员标准 |
| 共修出勤 | ❌ 不做 | 自学无班级、无共修；能力 8 出勤机制不适用 |
| 学期报数快照 | ❌ 不生成 | SemesterSnapshot 是升学结算机制，自学不升学故不产生 |
| 升学考 / 升学预检 | ❌ 不适用 | 无升学路径 |
| 关怀清单 | ❌ 不进 | 能力 14 关怀清单是班级机制（CareWatchlistItem.classId）；自学无班级，不进关怀名单。自学进度独立、无掉队概念故无预警（DR-104），与班级关怀解耦（SS-4，用户决策 2026-05-30）|
| 个人学修数量 | ✅ 可录入 | 念诵/观修等，复用 PracticeLog（无 classId，零改造），发愿走 context=personal；纯个人完成量追踪（DR-104）|
| 进度计算 | 独立 | 纯完成量，不对标班级课表周次、无掉队判定、无休息周、无进度补足（DR-104）|
| 升学体系表改造 | 零 | 不为「无班级」场景给 SemesterSnapshot/Exam/AdvancementCheck 加可空 classId |

**排除「自学也能升学」**：会迫使升学/考试/报数/出勤全体系为「无班级」改造，复杂度高且违背班级中心模型（能力 2/8/9/10 均以 class 为锚）。

#### UserSelfStudyProgram（自学科系记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | cuid |
| `userId` | String | 自学学员 userId |
| `programId` | String | 关联 Program（科系）|
| `status` | String | `active` / `paused` / `completed` / `abandoned`，默认 active |
| `createdAt` | DateTime | 默认 now() |
| `updatedAt` | DateTime | @updatedAt |

```prisma
model UserSelfStudyProgram {
  id        String   @id @default(cuid())
  userId    String
  programId String
  status    String   @default("active")   // active / paused / completed / abandoned
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User      @relation(fields: [userId], references: [id])
  program   Program   @relation(fields: [programId], references: [id])

  @@unique([userId, programId])  // 一人一科系一条自学记录
}
```

> **去掉的字段（DR-104）**：`startDate`（起修日）、`pace`（节奏）——二者均为「按班级课表周次推算进度」服务，自学进度独立、纯完成量，无周次对标，故去除。`UserSelfStudyRestWeek` 表整张删除（休息周存在意义=暂停班级周次时钟防假性掉队，自学无周次时钟，无意义）。

#### 进度模型（DR-104）

> 自学进度 = **纯完成量**，独立于班级。无周次对标、无截止、无掉队判定、无休息周、无进度补足。

进度按 `userId` 聚合既有记录计算：
- 课时完成度：`LessonCompletion`（该科系下完成的课时数 / 总课时数）
- 学修量：`PracticeLog`（个人念诵/观修累计，context=personal）

完成多少即多少，学员自定快慢，系统不判定「落后」。

#### 约束

| 约束 | 类型 | 说明 |
|---|---|---|
| 一人一科系一条 | DB（@@unique）| `@@unique([userId, programId])` 防重 |
| 入学限管理员 | 应用层 | UserSelfStudyProgram 创建限 subject_admin/super_admin（DR-61）|
| 放弃限科系管理员 | 应用层 | `status=abandoned` 限 subject_admin+（自学无班级，DR-61 一致）|
| 进度独立、无掉队 | 应用层 | 纯完成量聚合，不跑班级掉队判定（CohortLagSnapshot），无预警（DR-104）|
| status 不物理删（D18）| 应用层 | UserSelfStudyProgram 用 abandoned，无 delete API |

## 六、Enum 定义

| Enum | 值 | 说明 |
|---|---|---|
| `ProgramStage` | `preke` / `zhengke` | 预科/正科，D2 固定（新增）|
| `AdvancementConditionType` | `course_completion` / `practice_session` / `cumulative_count` / `attendance` / `exam_score` / `transmission` | 升学条件 6 类（新增，能力 10）|
| `CohortMemberStatus` | `active` / `paused` / `held_back` / `graduated` / `advanced` / `disqualified` / `left` | 成员状态机 7 态（旧 5 态 + DR-149 新增 `advanced` 升正科 / `disqualified` 取消资格，能力 9/10/11）|
| `LagStatus` | `on_track` / `slightly_behind` / `falling_behind` / `at_risk` | 掉队检测 4 档（旧设计沿用，能力 14；五维各独立取值，不加权）|
| `VowStatus`（UserPracticeVow.status）| `active` / `paused` / `completed` / `abandoned` / **`revoked`** | 发愿状态 5 值（旧 4 值 + DR-155 新增 `revoked`：专用于替代撤销后的心咒 vow，与 abandoned 语义区分）|

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
| 2026-05-30 | 社交三件套登记 06 能力（DR-105）：班级动态/讨论/约修登记为能力 22/23/24（§5.1/5.2/5.3 封板设计转录，无新业务决策）；08 三处 ⚠️「06 未登记能力」全部解除；06 能力清单 1-21→1-24，范围扩到含班级社交；§八 DR-105；§九 检查轮次 52 |
| 2026-05-30 | 自学进度模型简化（DR-104，能力 21 登记）：自学进度=纯完成量、独立于班级，取消休息周/起修日/节奏（推翻 DR-62/63/64）；删表 UserSelfStudyRestWeek（§五 12→11），UserSelfStudyProgram 精简为 userId/programId/status；abandoned 权限 class_admin+→subject_admin+；06 登记能力 21、⚠️ 解除；§八 DR-104；§九 检查轮次 51 |
| 2026-05-30 | SS-4 闭合：自学不进关怀清单（能力 14 班级机制，自学无班级）；进度预警走 DR-64 个人算法。DR-103 连锁含义补 (5)；§5.4 边界表补「关怀清单 ❌ 不进」行；§九 检查轮次 50 |
| 2026-05-30 | 暂缓决策讨论·自学模式边界定稿（DR-103，§5.4）：自学=纯自我学习轨道，无班级、不升学（SS-1=c）、不做共修出勤；可录个人学修数量作自我追踪（复用 PracticeLog，零改造）。§5.4 加「自学与升学体系边界」小节；同步改 06 能力 8/9 自学条款；§十二 P7 去掉对 P2 依赖；§八 DR-103；§九 检查轮次 49 |
| 2026-05-30 | 对抗性核查修复（检查轮次 48）：§十一 M2 整体单元横跨三 Phase 不可原子执行 → 拆为 M2a(UserRoleAssignment→P1)/M2b(CareFollowupRecord→P3)/M2c(TransmissionRecord→P5)；M3c 对 M2 依赖方向反（实为 M2b→M3c）已修正；全文 M2 引用同步；Migration 单元与 Phase 完全对齐 |
| 2026-05-30 | **全表封板后统编收口**：新增 §十一 Migration 统编（M0~M8，按 FK 拓扑序，检查项 5 闭合）、§十二 实施 Phase 计划（P0~P8，权限地基→升学核心→暂缓，检查项 6 闭合）、§十三 02 文档 23 职能×写表核对（21✅/1⏸/1❌，AuditLog 11 类 actionType 全覆盖，检查项 13 闭合）；修复 §三 表头计数 14→15（检查项 4，TODO-6 加 LeaveRequest 后漏改）；检查项 9/11 由 🔵 升 ✅；§九 检查轮次 47——**14 项检查清单全部 ✅，设计层面全部收口** |
| 2026-05-30 | TODO-18 闭合：请假对进度时钟——能力 3/9 暂停型（截止日顺延请假总天数）；能力 10 升学截止固定不变；无需新表/字段，应用层聚合 LeaveRequest(status=approved)；§八 DR-102；§九 检查轮次 46 |
| 2026-05-30 | TODO-17 闭合（专题设计）：TODO-9/12/13 一并闭合——①params 充分性(DR-97)②逐法达标 per_item 结构(DR-98)③考试合格线 attendanceThreshold 分支矩阵+考试线下后台录入(DR-99)④年龄豁免 ageEligible 标记+手动豁免(DR-100)⑤管理界面 4 页(DR-101)⑥跨 program 聚合已含 DR-96；§3.1 补各 conditionType 标准 params 结构；§九 检查轮次 45 |
| 2026-05-30 | TODO-14 闭合：兼修加行——无需新表/字段；兼修=独立加入加行班（D9 多专业已支持）；升密法资格判定为 admin 手动触发+系统 userId 维度全量聚合；跨 program 聚合逻辑纳入 TODO-17；§八 DR-96；§九 检查轮次 44 |
| 2026-05-30 | TODO-11 闭合：法王祈祷文——无欠/补状态机，PracticeLog 新增 prayerCount（顶礼打卡同次录入），SUM≥10万即达标；心咒代顶礼(isSubstituted=true)豁免判定；PracticeLog ✅复用→🔧扩展移入 §1.12；§一 扩展区 12→13 张；§八 DR-95；§九 检查轮次 43 |
| 2026-05-30 | TODO-10 闭合：金刚萨埵心咒代替顶礼——换算 200万↔10万 写死应用层常量；能力 5 代行 AuditLog(proxy_action) 留痕；顶礼 UserPracticeVow 置 isSubstituted=true（历史数值保留不动）；新建心咒 UserPracticeVow(practiceProjectId=心咒, targetCount=2,000,000, currentCount=0) 从 0 独立计；§1.7 字段表/schema/约束表更新；§八 DR-94；§九 检查轮次 42（2 问题已修：vowType→practiceProjectId、补换算常量约束）|
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
| 2026-06-03 | 裁判剧本 1 Unit ② 毕业事件定义——DR-149/DR-150 封板：graduated（毕业=时间事件）vs advanced（升正科）语义分离；cohortStatus 5→7 态（+advanced/+disqualified）；法王祈祷文/灌顶/完整内加行卡升密法（advanced）不卡毕业（graduated）；落班机制=邀请码两步走；原专业永久 advanced；并行专业不级联；§1.2 写权限/字段/设计意图/§六 enum/§八 DR-149/DR-150/§九 检查轮次 99 全部更新；跨 06/08/09 一致（0 问题）|
| 2026-06-03 | 裁判剧本 1 Unit ②-C 剩余缺口——DR-151 封板：(1) 多正科并存不设上限；(2) primaryProgramId 主修由用户自设、系统永不自动更改（修订 05 D16 + 06 能力 10 规则 8）；(3) 升学确认=邀请码（DR-150 已覆盖，无新步骤）；(4) UserPracticeVow +substitutionFor 字段 + 200万心咒→顶礼+法王祈祷文双豁免因果链（大纲§649）；(5) DR-84 虚报忏悔矛盾标 ⏸ 待处理（Unit ⑤ 最后）；§1.7 字段表/Prisma schema/约束/§1.12 设计意图/§八 DR-94/DR-95/DR-84/DR-151/§九 检查轮次 100 全部更新；跨 05/06/08 一致（0 问题）|
| 2026-06-03 | DR-84 忏悔机制整体标 ⏸ 待定——取消资格前置检查 gate 逻辑（含「学员拒绝忏悔时如何满足 gate」）待后续讨论；§3.8 约束行 + 设计意图 + §八 DR-84 + 06 能力 9 绝对约束 4 同步标注 ⏸ 待定 |
| 2026-06-03 | DR-154 G1.7 跨预科/正科并存身份三决策封板——G1.7-1 学员端直接显示班级名无阶段分组；G1.7-2 辅导员可查学员所有班级（新 GET 端点）；G1.7-3 正科在读时预科升学预检自动 bypass（zhengke_bypass）；08 §3.9 约束+设计意图 + §八 DR-154 + 06 能力 10 规则 11 + 09 API 同步更新（⚠️ G1.7-3 旋即经 R1-T14 撤销，见下方 2026-06-03 撤销条目）|
| 2026-06-03 | G1.5 S5 节点业务含义标 ⏸ 待定——S5 是否有特殊检查点待大纲确认，现阶段按普通节点处理；06 能力 10 考试表 S5 标注 ⏸ 待定 + §十 TODO-G1.5 登记 |
| 2026-06-03 | G1.3 闭合——能力 4 规则 7/8 细化：任务制起算（UserPracticeVow 于起修日建立），S1 修持无任务不自动计入升学，S1 历史修量须管理员走能力 5 代行补录（方案 B）；06 能力 4 规则 7/8 更新 |
| 2026-06-03 | DR-153 G1.4 多专业报数分流封板——`POST /api/practice-logs` 增加 `vowId` 必填参数；前端从任务卡片上下文带入，后端校验归属；09 三处 POST 入参 + 08 §1.12 约束表 + §八 DR-153 同步更新 |
| 2026-06-03 | DR-152 `disqualified` 下游三决策封板——① 可登录查历史档案、失去班级访问权；② 再入学须 super_admin 审批+忏悔/认罪流程（⏸ 忏悔机制 DR-84 待定）+邀请码；③ 历史档案保留（D18）但升学从 0 重算；§1.2 ClassMember 写权限/§八 DR-152/06 能力 11 规则 6+绝对约束 6 同步更新 |
| 2026-06-03 | DR-156 R1-T18/T19 议题D闭合——(D1) 再入学忏悔验证=super_admin书面背书（必填AuditLog，不依赖DR-84 gate，两者解耦）；(D2) 从0重算=新ClassMember+新program_task vow（起始日=新入班日），vowId隔离旧数据，双层视图（本期进度/档案历史）；无新表/无新字段；跨06/R1报告同步 |
| 2026-06-03 | DR-155 R1-T5/T6/T10 议题C闭合——二次替代复用心咒 vow 方案A：撤销→status=revoked（不删）；再替代→复用 revoked vow，reset currentCount=0；预检只取 status=active vow；§1.7 status 字段+Prisma注释+约束表（3条新增）+§六 VowStatus enum 更新；无新表/无新字段；跨 06/R1报告同步 |
| 2026-06-03 | **DR-154 G1.7-3 撤销（R1-T14 回归发现）**——zhengke_bypass「任意 active 正科在读→所有预科预检自动放行」作用域过宽，在多专业场景让在读正科密法静默豁免并行净土预科的真实未达标，与 D9/D16 多专业独立正面冲突；且 `advanced` 成员本就不进预检，bypass 属冗余设计。撤销后每条预科升学线按 programId 各自独立跑 6 条件，无跨专业豁免。DR-154 仅保留 G1.7-1/G1.7-2；08 §3.9 约束改「多专业预检独立」+设计意图记撤销+§八 DR-154 标注+06 删能力 10 规则 11、绝对约束 5 改写+09 删预检端点 bypass、删业务落点 ⑤；跨 06/08/09 一致 |
| 2026-06-04 | DR-158 ISG-9 闭合——LessonCompletion 加 `programId String`（必填），course_completion 预检加 `AND programId=:pid` 隔离，A 专业闻思记录不满足 B 专业升学条件；§3.1 course_completion 标准 params 结构首次明文（courseTypes+判定逻辑，含 blind/deaf 路径）；M3f 表定义更新；06 能力 3 规则 7 加 DR-158 引用；无新表；无新 migration 单元（M3f 内加列）|
| 2026-06-04 | DR-157 剧本「小周双专业实修」GAP-1/2/3 闭合——D14a/D14b conditionType → AdvancementCheck query scope 映射规则首次明文落纸面：cumulative_count 不过滤 programId/vowId（跨专业全量聚合，D14a "念一份算多份"）；daily_frequency 按 vowId IN (本专业 vow) 过滤（D14b 跨专业不豁免）；PracticeLog.programId 仅作追溯展示（DR-120），不作预检过滤条件；DR-153 vowId 与 D14a 调和路径明文确认（一次录入同时满足两个条件）。08 §3.9 设计意图更新 + §八 DR-157 新增；03-scenario-shared-mantra.md GAP-1/2/3 标注已闭合；无新表/无新字段 |
| 2026-06-04 | DR-159 ISG-2 闭合——`attendance` conditionType 标准 params 结构首次明文：studyType=group_attend（只计实到，不含 group_review/group_summary）、classScope=program_all_members（本专业所有届班全量聚合，留级不清零）；判定逻辑 `COUNT(StudyRecord WHERE studyType='group_attend' AND classId IN ClassMember 本专业) ≥ targetValue`；§3.1 attendance params 新增节；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-160 ISG-3 闭合——`transmission` conditionType 标准 params 结构首次明文：判定 `SELECT 1 FROM TransmissionRecord WHERE userId=:uid AND transmissionKey=:conditionKey AND isRequired=true AND status='active'`；传承记录仅管理员后台录入，无学员自报路径，`isConfirmed=false` 不会出现，无需 `isConfirmed=true` 过滤；DR-46 原描述正确无需修改；§3.1 transmission params 新增节；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-161 ISG-4 闭合——`practice_session` 判定逻辑补 `loggedAt >= UserPracticeVow.createdAt`（起修日 = vow 建立时刻）过滤；S1 阶段修量不自动计入升学预检（能力 4 规则 8）；管理员通过能力 5 代行补录的 S1 修量若需计入升学须以 `loggedAt >= vow.createdAt` 记录（行政行为非系统自动）；§3.1 practice_session 判定逻辑行内更新；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-162 升学预检改直接查询——AdvancementCheck 不再读 SemesterSnapshot，改为直接查询原始数据表（PracticeLog/LessonCompletion/StudyRecord/TransmissionRecord/ExamGrade）；SemesterSnapshot 保留仅服务报数汇总展示；§3.9 设计意图更新；§3.7 服务能力标注解耦；ISG-5/ISG-8 消解；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-174 R3-T4/T5 闭合——`AdvancementRecord` 只在 passed 时写入；驳回只写 AuditLog(advancement_decision)，不创建 record；解决 approve-after-reject 的 @unique 冲突；§3.10 简介段/字段表/约束表/设计意图全部更新；DR-86 语义调整（驳回不存 AdvancementRecord，targetProgramId=null 约束失效）；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-173 T11/T14 消解——`conditionsSnapshot` 深度说明：冻结结论层（actual/passed/exempted）已足够；DR-162 直接查原始表架构下原始数据永久留档（D18），无需快照复制细节；§3.10 设计意图补注；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-172 T5 闭合——`isSubstituted=true` 时顶礼 cumulative_count 整体切换替代路径：不再聚合历史打卡，改验心咒 vow currentCount ≥ 200万；两路不叠加；§3.1 cumulative_count 补注；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-171 T4 闭合——心咒打卡一因多果明文：替代路径的心咒打卡同时计入心咒 cumulative_count 条件；顶礼打卡同时产生 prayerCount 计入法王祈祷文；三者同时进行是有意设计，非重复计算；§1.12 isSubstituted 段补注；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-170 T2 闭合——`cumulative_count` 预检明文不过滤起修日：全量历史打卡累计，D14a「念一份算多份」时间维度延伸；与 practice_session 起修日过滤（DR-161）有意区分；§3.1 cumulative_count 判定逻辑补注；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-169 T10 闭合——`AdvancementCheck` 重触发预检语义明文为 upsert：以 `[userId,programId,semesterNumber,reportNodeIndex]` 为 upsert 键，更新 checkResults/overallPassed/status；历史留证靠 AdvancementRecord（拍板记录）+ AuditLog（豁免留痕）双层；§3.9 约束表补注 + 设计意图段首补 DR-169 段落；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-168 T13 闭合——`exam_score` 预检多专业隔离明文：通过 JOIN 链 `ExamGrade→Exam（examType='advancement'）→Class.programId=:pid` 过滤，仅取目标专业升学考成绩；`ExamGrade` 无需加 `programId` 冗余字段；§3.1 exam_score 判定逻辑补注；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-167 ISG-12 闭合——`CohortLagSnapshot.taskLag` 达标基准查询范围明文：基准来自 `classId → Class.programId → Program` 任务配置（`dailyTarget`），无需快照表单存 `programId`；多专业学员各专业班各持独立快照，任一专业掉队即触发关怀（能力 14）；§1.5 CohortLagSnapshot 设计意图行内补注；§十 TODO-1 补 DR-167 范围说明；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-166 ISG-11 闭合——法王祈祷文 `prayerCount` 聚合范围明文与 DR-157 对齐：不过滤 `programId`/`vowId`，全量聚合该用户顶礼项目全部打卡的 prayerCount（D14a 跨专业共享精神）；同步补 `ritualCompliant IS NOT FALSE` 过滤（与 DR-164 cumulative_count 口径一致）；§1.12 设计意图行内更新；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-165 ISG-10 闭合——`practice_session` 预检明文不过滤 `source`：`in_app` 与 `external`（线下计数模块申报，DR-144）同等计入；"须录完整信息"约束（`meditationId` 必填 + `durationMinutes ≥ 30`）在录入层 Zod 校验把关，预检不二次过滤；§3.1 practice_session 判定逻辑行内补注；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-164 ISG-7 闭合——`cumulative_count` 判定逻辑补 `ritualCompliant IS NOT FALSE` 过滤；管理员标记作废（`ritualCompliant=false`）的打卡记录不计入升学聚合；法王祈祷文独立聚合（`SUM(prayerCount)`）同步补相同过滤；§3.1 cumulative_count 判定逻辑行内更新；无新表/无新字段/无新 migration |
| 2026-06-04 | DR-163 ISG-6 闭合 + DR-159 出勤范围逆转——`attendance` classScope 从 `program_all_members` 改回 `current_member`（只计当届 `cohortStatus='active'` 班级出勤，留级后历史出勤不累入）；SQL 改为 `classId = (SELECT classId FROM ClassMember WHERE userId=:uid AND programId=:pid AND cohortStatus='active')`；前届已满足的条件：管理员通过 DR-85 豁免机制（`exempted=true`）授权豁免，学员补足剩余缺口即可升学；§3.1 attendance params 行内更新；DR-159 §八 条目补后修订说明；无新表/无新字段/无新 migration |

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
| DR-62 | 自学休息周是否需要审批 | ⛔ **已推翻（DR-104，2026-05-30）**：自学进度改为纯完成量、独立于班级，休息周机制整体取消，本决策作废。~~不需要审批，学员自由申报、即时生效（用户决策 2026-05-29 修正）~~ | 用户修正：「休息审批需要，但是自学模式不需要休息审批」。自学师兄自定节奏（pace 字段），是自主学习者，其休息周属个人安排，无须辅导员审批。原设计的审批状态机（pending/approved/rejected/expired + expiresAt + processedBy）全部移除，回归旧设计的简单申报（restStartDate + reason）。**休息审批机制确实需要，但属班级成员请假场景**（辅导员及以上审批），与自学解耦，另行设计（TODO-6）|
| DR-63 | 自学休息周申报是否可撤销 | ⛔ **已推翻（DR-104，2026-05-30）**：休息周机制整体取消，本决策作废。~~不可撤销（D18，用户决策 2026-05-29）~~ | 申报即生效并影响进度计算，记录有审计价值，不提供删除/撤销接口。符合 D18 append-only。排除「允许撤销」：会引入物理删，且自学进度已据此重算，撤销会造成进度跳变 |
| DR-64 | 请假后进度落后如何补足 | ⛔ **已推翻（DR-104，2026-05-30）**：自学进度改为纯完成量、独立于班级，无周次对标/无掉队/无进度补足，「补足算法」作废。~~申报休息周天数从有效学习天数中扣除（用户决策 2026-05-29）~~ | 用户决策「用户请假课程进度落后可以补足」。核心：有效学习天数 = (今天−startDate) − Σ申报休息天数，当前周由有效天数推算。自学无审批，全部已过去的申报休息周均计入补足，避免假性落后。休息中内容仍可访问（学员可自主补课），掉队预警暂停。此算法复用班级进度算法，仅数据源换成个人 startDate + 个人休息周（与旧设计注释「自学进度算法 = 班级进度算法」一致）|
| DR-65 | Course 在新设计下是否需要改字段 | ✅ 复用 5 字段不改；**后修订（2026-05-30）：新增 courseType 改判 🔧 扩展，移入 §1.11**（见 DR-93）| 旧设计 §2.2 已将 Course 扩展为含 author/isTantric/programSemesterId/category/tantricGroupId 5 字段的版本，核对 05/06 后全部仍有效，密法访问控制改 TransmissionRecord 不影响 Course 字段。**修订原因**：原判「字段不改」是基于当时未深查能力 3 课程类型——TODO-15 核对发现 entry/formal/restricted 三类型无字段承载（同 DR-92 判定矩阵的隐含依赖），补 courseType 后 Course 移入扩展区。这正是检查轮次 35 勘误指出的「设计 vs 业务要求充分性」盲区的一个实例 |
| DR-66 | Lesson 在新设计下是否需要改字段 | ✅ 复用，字段不改（用户决策 2026-05-29）| 旧设计 §2.2 仅扩展 sourceText（法本原文，与 referenceText 并存）。Lesson 服务能力 3（闻思圆满），但闻思打卡/答题分别走 LessonCompletion / QuestionReference（§三/§四 处理），Lesson 表只承载课时内容字段，新设计无新增需求。排除「新增进度/状态字段」：进度状态属 LessonCompletion 范畴，Lesson 不冗余存 |
| DR-67 | Meditation 在新设计下是否需要改字段 | ✅ 复用，字段不改（用户决策 2026-05-29）| 旧设计 §2.2 扩展 seriesKey/seriesNumber/isTantric/tantricGroupId 4 字段 + `@@unique([seriesKey, seriesNumber])`。大纲核对佐证 92 修法分法记录由 seriesKey+seriesNumber+PracticeLog.meditationId 实现，字段够用。大纲发现的 3 缺口（座次规则/音视频二选一/逐法达标）均属判定逻辑层，记 TODO-7/8/9，非 Meditation 表结构问题。密法授权同 Course 迁 TransmissionRecord，不影响字段。排除「在 Meditation 上加达标快照字段」：逐法达标是聚合计算结果，属 AdvancementCheck 范畴，不冗余存 |
| DR-68 | ❌ 转功德会（菩提功德会）是否做 | 不做（永久决策，用户决策 2026-05-29）| 大纲规定：取消学员资格后可转入菩提功德会。功德会是独立于觉学学修体系的组织/系统，「转功德会」属跨系统流程，超出觉学平台范围。觉学只负责到「取消学员资格」为止，之后是否入会、入会流程均不在本系统建模。排除「建功德会入会记录表」：会引入与学修无关的组织管理复杂度。登记 §十 TODO-16 仅为留痕「大纲此条已核对、明确排除」，非待办 |
| DR-69 | PracticeProject 在新设计下是否需要改字段 + TODO-3 处理 | ✅ 复用，字段不改；顺手闭合 TODO-3（用户决策 2026-05-29）| 旧设计 §2.2 扩展 isTantric/tantricGroupId 2 字段，scope 旧字段保留兼容。PracticeProject 是「修什么法」字典表，被 PracticeLog/PracticeTemplate/约修引用，新设计无新增需求。密法授权同 Course/Meditation 迁 TransmissionRecord，不影响字段。**顺手闭合 TODO-3**：PracticeProject 确认复用后，§5.3 约修 practiceProjectId 升格正式 FK，PracticeProject 补反向 appointments[]——TODO-3 的处理时机正是「PracticeProject 复用确认时」，故一并处理。排除「拆密法项目独立表」：isTantric 标识 + tantricGroupId 已足够区分，无需拆表 |
| DR-70 | User 是否纯复用 + 60 岁年龄豁免如何建模 | 🔧 扩展：新增 `birthDate`；年龄豁免做成「资格性、非自动」（用户决策 2026-05-29）| 旧设计 13 字段全部有效复用。但 60 岁免考是大纲硬规则、需年龄数据源，User 上无生日字段，故新增 `birthDate`，判 🔧 扩展（从复用区移入）。**关键区分**（用户决策）：盲/聋是身体缺陷→**强制**豁免（能力 3 自动切判定路径）；60 岁是**资格**豁免→年满 60 仅获免考资格，**不自动满足考试条件**，实际免考走能力 5 代行（管理员显式确认、留痕 D17）。理由：部分老人有能力正常完成加行/考试，应允许其正常考、正常计成绩，不能一刀切自动免。排除「年龄≥60 自动置 exam_score 满足」：会剥夺有能力老人正常应考的选择，且与「豁免是个案、可选、留痕」的能力 5 哲学冲突。birthDate 字段先就位，完整豁免逻辑在升学条件配置阶段做（TODO-12 收窄为仅剩逻辑层）|
| DR-71 | Class 是否纯复用 + 班级归档如何建模 | 🔧 扩展：新增归档三件套 status/archivedAt/archivedBy（用户决策 2026-05-29）| 旧设计 §2.2 已扩展 6 字段（programId/startDate/city/timezone/currentWeekOverride/lagPracticeDaysExpected）全部有效复用。但 D19 + 能力 11 §4 明确「班级只归档不物理删除（status: archived）」，旧设计 Class 无归档状态字段，能力 11「对老项目影响」也写明「老项目班级可能有删除操作，需改为归档」。故新增 status（active/archived）+ archivedAt + archivedBy，判 🔧 扩展（从复用区移入）。归档后不接受新成员/新课表/新出勤，历史完整保留；手动触发（不自动）。排除「物理删除班级」：违反 D18/D19，破坏出勤/报数/成绩历史完整性。排除「沿用 isActive 布尔」：归档需留痕（时间+操作人），布尔不够，用 status 字符串 + archivedAt/archivedBy 三件套 |
| DR-72 | C 类 §四 复用表（15 张）是否需要改字段 | ✅ 全部复用不动，批量确认（用户决策 2026-05-29）；**后修订（2026-05-30）：PracticeLog 改判 🔧 扩展，移入 §1.12（见 DR-95）**；**🔴 重大后修订（2026-05-31，DR-130）：本「批量复用确认」是对照旧设计文档打勾、从未 grep 验证线上 schema——经 DR-130 全量体检，这 15 张里 12 张是线上幻影表（实为新建），仅 LessonResource/LessonMediaChapter/LessonTextBlock 等真实存在。本 DR 复用结论大部作废，以 DR-130 grep 体检为线上现状权威** | 15 张表：PracticeLog/PracticeTemplate/LessonCompletion/PracticeJournal/QuestionReference/LessonResource/LessonMediaChapter/LessonTextBlock/ProgramWeek/ProgramWeekCourse/ProgramWeekPractice/ProgramStudyType/CohortRestWeek/Event/EventCount/SpeakingRegistration/CohortWeeklySummary。逐张核对新设计（05/06）后均无新增需求：日常打卡/模板/闻思完成/日记/思考题/课时资源/周排表/科系打卡声明/休息周/法会/法会计数/讲考报名/周汇总，结构旧设计已完整。Event.classId 可空（平台级/班级级）与 SpeakingSession 同套路已支持平台级法会。批量一条 DR 覆盖，避免逐张冗余 DR。**修订原因（DR-95）**：TODO-11 核对能力 6 规则 1 发现顶礼须同步录入法王祈祷文计数，PracticeLog 需新增 prayerCount 字段，故改判扩展（与 DR-65 Course 改判同一机制） |
| DR-73 | TantricGroup 反向关联如何处理 | 🔧 微调：删 grants，补 transmissionRecords（用户决策 2026-05-29）| TantricGroup 字段本身有效，但 `grants TantricAccessGrant[]` 反向关联悬空——TantricAccessGrant 已在 DR-44 废弃整合入 TransmissionRecord。删除 grants，新增 `transmissionRecords TransmissionRecord[]`（TransmissionRecord.tantricGroupId 指向本组，sourceType=empowerment 表达灌顶授权）。密法访问控制改为 EXISTS on TransmissionRecord（DR-44/45）。此微调闭合检查轮次 11 标记的已知项。排除「保留 grants 空关联」：悬空关联指向已删除 model，Prisma 校验不通过 |
| DR-74 | AI 助手 5 张表（ContentChunk/FeatureEntry/AiConversation/AiMessage/AiUsage）是否纳入本次融合 | ⏸ 暂缓（独立 AI 模块，用户决策 2026-05-29）；**实现方式修订见 DR-108**（复用线上既有 LLM 网关，非从零自建）| AI 助手是独立功能模块（详见 docs/AI_ASSISTANT_PLAN.md），决策定型但未实施，依赖 pgvector 扩展，UI/Tier 2-4 均暂缓。不属本次「学修体系融合」范围。统一标 ⏸ 暂缓，不在本文档展开字段级设计；待 AI 模块独立推进时处理。排除「纳入本次复用确认」：AI 模块边界独立，混入会扩散本次融合范围 |
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
| DR-84 ⏸ **忏悔机制待定** | ReportConfession status 是否包含「拒绝忏悔」状态，以及取消资格前置检查 gate 逻辑 | **暂定**：status 只有 submitted/acknowledged（用户决策 2026-05-30）；⏸ **忏悔机制整体待定**（用户决策 2026-06-03）：取消资格前如何验证「已走忏悔流程」、学员拒绝时 gate 如何通过——待后续讨论，现阶段应用层 gate 实现不写死。| 已排除「status=refused」：学员拒绝时本表无记录，管理员无写入路径；已排除「status=escalated」：取消资格为独立 ClassMember 操作，不应耦合到忏悔状态机。**⚠️ 内在矛盾**（已知，整体待定）：「必须先走忏悔流程」（能力 9 规则 #4）的应用层 gate 若检查 submitted 记录——当学员拒绝时本表无记录，检查将永远阻断取消资格；矛盾与「虚报忏悔」业务规则整体留待后续决策。|
| DR-92 | 闻思圆满「音视频二选一」判定 + StudentSpecialStatus 两类语义覆盖 | **音频或视频任一算「听」；blind=视障类、deaf=听障类覆盖大纲细分**（用户决策 2026-05-30，TODO-8 闭合）| 能力 3 大纲「听音视频」指音频或视频任一即满足「听」，但 LessonCompletion 的 audio/video 是两条独立 type。判定逻辑：听 = `COUNT(type IN audio,video)`、看 = `COUNT(type=read)`、答题 = UserAnswer，纯应用层聚合，字段已就位。身份覆盖：大纲路径表细分「盲/低视力/文盲」「聋/听障」，但 §3.3 statusType 只有 blind/deaf 两类（DR-76 不可扩展）；定 blind=视觉障碍类（含低视力/文盲，走纯听≥2）、deaf=听觉障碍类（含听障，走纯看≥2），两类语义覆盖细分。排除「扩展 statusType 增细分」（方案 B）：推翻 DR-76 能力 12 绝对约束，且细分对圆满路径无影响（同走纯听/纯看），两类已足够；盲+聋双重残疾大纲无路径，走能力 5 代行不自创规则。**补记（DR-93）**：判定矩阵「正式/入门课 vs 限制性课」依赖 Course.courseType 字段——此字段当时不存在，已在 §1.11 补齐 |
| DR-93 | Course 是否需要 courseType 字段（教学阶段类型）| **新增 courseType（entry/formal/restricted），与 category 正交**（用户决策 2026-05-30，TODO-15 闭合）|
| DR-95 | 法王祈祷文独立计数：PracticeLog 新增 prayerCount + 无欠债状态机 | **顶礼打卡同次录入 prayerCount（Int?），无独立欠/补状态机，累计 SUM ≥ 100,000 即满足**（用户决策 2026-05-30，TODO-11 闭合）| 能力 6 规则 1「法王祈祷文必须独立计数」要求必须有独立字段（不能合并到顶礼计数）。原 TODO-11 设计思路假设需要「欠/补」状态机——用户质疑「为什么要标记是否欠？」后明确：prayerCount 是累计计数，差值（100,000 - SUM）即实时欠量，不需要存储债务状态。审批流：无需额外审批；学员每次顶礼打卡同步填祈祷文遍数，系统实时聚合。PracticeLog 改判 🔧 扩展（原判 ✅ 复用，DR-72），移入 §1.12。豁免路径：`UserPracticeVow.isSubstituted=true`（心咒代顶礼）→ 升学预检检查心咒 vow.`currentCount ≥ 2,000,000`：完成→顶礼 ✅ + 法王祈祷文 ✅（双豁免，无需聚合 prayerCount，DR-94/DR-151 协同）；未完成→两项均 ❌。排除「独立欠债表/状态机」：过度工程，SUM 聚合已能实时算差值，无需存储中间状态 |
| DR-132 | D3 短信通道（能力 45）完整设计：第 3 触达通道 + User 手机号体系（🆕 新建）| **能力 45 短信通道完整设计：(A) User +phone/phoneVerified/phoneVerifiedAt 字段（线上 User 无手机号，grep 确认）+ 绑定验证流程；(B) sendSms 发送抽象层（Provider 接口 + 模板化 + 失败重试）；(C) 作为 dispatchToUsers 第 3 通道 channel='sms'（复用 DispatchLog 幂等）；(D) 用途规则：验证码/critical 系统公告/⑦⑧⑨关键学修提醒走短信，一般提醒/普通通知不走（控成本防骚扰）；(E) NotificationPreference +smsEnabled（验证码不受开关影响）。服务商选型等挂 TODO-SMS**（用户决策：用途=重要通知兜底+关键学修提醒，深度=完整设计短信通道，2026-05-31/06-01）| 用户追问「系统公告与通知推送/短信是不是两个模块」引出核查：dispatchToUsers 现仅 channel='push'（站内 Notification ✅+Web Push ✅），**SMS 完全未实现**——代码仅占位注释「banner/sms 后续接入时各自加 channel」，且**User 表连 phone 字段都没有**（grep phone/mobile 全空）。用户决策「都要做、逐条确认」+ 选项「用途=重要通知兜底+关键学修提醒」「深度=完整设计短信通道」。**设计要点**：短信是 Web Push 之外的兜底通道，但**按条计费**故严格限场景（仅 critical+关键学修提醒+验证码），非全量发；前置缺口是 User 手机号体系（字段+验证流程），无手机号则无法发。**通道选择**：站内信必达→push 有订阅则推→sms 仅 critical/关键且符合用途规则。**待决策**（TODO-SMS）：服务商选型（阿里云/腾讯云/国际）、smsEnabled 默认值、是否独立 SmsLog 表（默认复用 DispatchLog）、验证码频率/有效期。排除「短信全量发所有通知」：成本爆炸+骚扰，仅限关键场景；排除「不做手机号验证直接发」：未验证号码发短信浪费+合规风险，须 verified 才发业务短信（验证码除外）|
| DR-155 | R1-T5/T6/T10 议题C：二次替代撤销后心咒 vow 状态管理 | **方案A：复用既有心咒 vow，不新建第二条**：(1) 撤销替代：顶礼 vow `isSubstituted`→false；心咒 vow `status`→`revoked`（不物理删除，D18；区别于 `abandoned` 自愿放弃，审计可追溯）；`substitutionFor` 指针保留；(2) 再次替代：先检查是否有 `substitutionFor=顶礼vow.id AND status=revoked` 的心咒 vow → 有则复用（status→active，currentCount→0 重新起算）；无则新建（首次替代路径）；严禁建第二条 active 心咒 vow 指向同一顶礼 vow（应用层前置检查）；(3) 预检只取 `status=active` 心咒 vow，确保唯一一行。`UserPracticeVow.status` 新增 `revoked` 值（§六 enum 更新，无新表/无新字段）（用户决策 2026-06-03）| 排除「新建第二条心咒 vow+唯一约束（方案B）」：允许多条 vow 存在（即便 revoked），预检查询条件复杂化；且二次替代后两条 revoked+active vow 都指向同一顶礼 vow，历史关系图不清晰；复用方案更简洁，substitutionFor 始终一对一，不引入多行。排除「撤销时用 abandoned」：abandoned 语义=用户主动放弃，revoked=被外部动作撤销，审计追溯时需区分来源。关联 DR-94/DR-151（substitutionFor 因果链）/D18（永久留档）|
| DR-154 | G1.7 跨预科/正科并存身份三决策（G1.7-1/2/3）| **(1) G1.7-1 学员端展示**：直接显示 `Class.name`，无阶段分组标签；`primaryProgramId`（DR-151）控制默认专业展示；❌ 不做阶段分组 UI（零新字段）。**(2) G1.7-2 辅导员可见所有班级**：新增 `GET /api/coach/students/:uid/classes`（class_tutor+ 守卫，须为该学员至少一个班的辅导员/管理员）→ 返回该学员全部 ClassMember（班级名/专业名/阶段/cohortStatus）；❌ 不做跨班写权限（辅导员只能看、不能编辑非本班数据）。**(3) G1.7-3 正科在读豁免预检 ❌ 已撤销（R1-T14，2026-06-03）**：原设计=学员有任意 `active` 正科 ClassMember → 所有预科专业 AdvancementCheck 自动短路 `zhengke_bypass`。R1 回归发现作用域过宽：在读正科**密法**会豁免掉并行**净土**预科的真实未达标（静默放行），与 D9/D16 多专业独立冲突。**撤销后**：每条预科升学线按 programId 各自独立跑 6 条件，无任何跨专业豁免；已 `advanced` 的成员本就不进预检，无需 bypass（用户决策 2026-06-03）| (1) 排除阶段分组标签：增加认知层级，primaryProgramId 已够用；(2) 排除「辅导员只见自己班级」：跨阶段并存时辅导员无法了解学员全貌，增加新 GET-only 端点代价低、协助辅导员做关怀判断；(3) G1.7-3 撤销说明：bypass 原假设「已升入正科证明能力已验证」仅对**同一升学线**成立，对**并行专业**是类别错误——在读正科密法与净土修学水平无关；且 `advanced` 成员本就不进预检，bypass 实为冗余设计却引入跨专业污染（R1-T14）。撤销后回到 D9/D16：每专业预检独立。无新表/无新字段；09 G1.7-2 端点保留、§预检端点+业务落点 ⑤ 删 bypass；08 §3.9 约束改「多专业预检独立」+ 设计意图记撤销；06 能力 10 删规则 11、绝对约束 5 改「多专业预检独立」 |
| DR-153 | G1.4 多专业报数分流：`POST /api/practice-logs` 必须携带 `vowId` | **`vowId` 必填**：打卡提交时必须明确归属哪条 `UserPracticeVow`；后端校验该 vow 属于当前用户 + 当前活跃学期（Zod 必须字段，非 null）；多专业并修时各专业任务卡片各自持有 vowId，前端从卡片上下文自动带入，无需学员手选（用户决策 2026-06-03）| 排除「不传 vowId，后端按 practiceProjectId+userId+programId 推断」：多专业并修时同一用户同一修法项目可能有多条 vow（各专业一条），无法唯一推断；排除「提交时下拉选专业」：打卡入口已在专业任务卡片上下文内，多一个选择器增加认知负担且易误选。无新表/无新字段（vowId 已在旧设计 PracticeLog 中存在）；09 三处 POST /api/me/practice-logs 入参补充 `vowId` 必填；PracticeLog §1.12 约束表新增 vowId 必填行；关联 G1.2（多专业独立学期钟）/ DR-120 / D9 |
| DR-152 | `disqualified`（取消资格）下游三决策（DR-149 遗留 Unit ⑤）| **(1) App 访问**：disqualified 后可继续登录 App、查看历史档案（D18），但失去班级成员权限（不可进班级主页/课程/报数/出勤）。**(2) 再入学**：允许，但条件比 `left` 更严——须 `super_admin` 审批 + 忏悔/认罪流程 + 邀请码重新加班（能力 2）。⚠️ 再入学中「忏悔/认罪流程」的系统验证方式 → **由 DR-156 D1 补全（书面背书，不依赖 DR-84 gate）**。**(3) 历史记录**：档案永久保留（D18），升学从 0 重算。⚠️ 「从 0 重算」的机制 → **由 DR-156 D2 补全（新 vow + 时间窗口隔离）**（用户决策 2026-06-03）| (1) 排除「禁止登录」：D18 全数据保留精神，学员有权查看历史档案；排除「维持完整班级访问」：disqualified 已不是班级有效成员；(2) 排除「永久禁止再入学」：佛教学修体系以认罪忏悔为改过门径；排除「与 left 同等待遇」：取消资格需更高授权；(3) 排除「历史记录接续计入升学」：历史数据可信度存疑；排除「物理删除历史」：违反 D18。关联 DR-84（忏悔前置 gate ⏸ 待定）/ DR-149 / DR-156 / D18 / 能力 9/11 |
| DR-156 | R1-T18/T19 议题D：disqualified 再入学忏悔验证机制（D1）+ 历史保留vs从0重算的视图与 vow 机制（D2）| **(D1) 再入学忏悔验证 = super_admin 书面背书**：super_admin 审批再入学时必填「忏悔确认说明」文字字段，内容写入 AuditLog 永久留档，super_admin 对忏悔完成结果负责；系统**不做自动 gate 检查**（不依赖 DR-84，不读 ReportConfession 表），DR-84 取消资格前置 gate 继续 ⏸ 待定，两者解耦；无新表/无新字段（AuditLog 已有 payload Json）。**(D2) 从0重算 = 新 vow + 时间窗口隔离（双层视图）**：再入学时建新 ClassMember（邀请码落班，能力 2）+ 新 program_task vow（起始日=新入班日）；升学预检只计入新 vow 对应的 PracticeLog（vowId 隔离，DR-153）；旧 vow/旧打卡在档案视图（D18）永久保留但不参与新轮升学条件；**学员端两层**：进度页=本期（新 vow 进度）/ 档案页=完整历史（D18）（用户决策 2026-06-03）| (D1) 排除「系统自动 gate 检查 ReportConfession 提交记录」：学员拒绝忏悔时本表无记录，gate 将永久阻断取消资格/再入学（DR-84 死锁问题）；排除「DR-84 先解决再定」：再入学路径可先行，书面背书满足留痕要求（D17），不损失治理能力，只是由系统检查改为管理员负责；排除「直接跳过忏悔要求」：忏悔/认罪在佛教治理体系中具有根本意义，不可省略，需以人工背书形式保留。(D2) 排除「历史记录接续计入升学」：被取消资格意味历史数据可信度存疑；排除「全部重置旧 vow（物理删）」：违反 D18；排除「新旧 vow 共用进度视图」：混合展示无法区分本期达标情况与历史存档数据，运营判断混乱。**无新表/无新字段**（AuditLog payload 承载背书文字；新 ClassMember + 新 vow 走既有能力 2 流程）；关联 DR-84（⏸ 继续待定）/ DR-152 / DR-153（vowId 隔离）/ D17 / D18 / 能力 2/5/9/11 |
| DR-160 | ISG-3 闭合：`transmission` conditionType 标准 params 结构 + 传承记录创建主体澄清（2026-06-04）| **传承记录仅管理员后台录入**（无学员自报路径）→ `isConfirmed=false` 记录不会出现 → 预检查询 `transmissionKey=conditionKey AND isRequired=true AND status='active'` 已充分，**无需加 `isConfirmed=true` 过滤**；DR-46 原描述正确。`transmission` params = `{ "transmissionKey": "<条件键>" }`，判定 `SELECT 1 FROM TransmissionRecord WHERE userId=:uid AND transmissionKey=:conditionKey AND isRequired=true AND status='active'`（用户决策 2026-06-04）| 排除「加 isConfirmed=true 过滤（原 ISG-3 建议）」：ISG-3 风险基于"学员可自报灌顶"的错误前提——实际上传承记录创建主体是管理员，管理员在后台录入即为确认，`isConfirmed=false` 状态不会在正常流程中出现；加过滤条件等于对不存在的场景防御，徒增查询条件复杂度。关联 DR-46（传承判定原描述）/ DR-47（课程触发传承，isConfirmed=true by default）/ 能力 17 / ISG-3 |
| DR-174 | R3-T4/T5 闭合：`AdvancementRecord` 只在 passed 时写入，驳回只写 AuditLog（2026-06-04）| **驳回不写 AdvancementRecord**：AdvancementRecord 只在 result=passed 时创建，驳回时只写 AuditLog（actionType=advancement_decision, result=rejected, note=驳回理由）（用户决策 2026-06-04）。解决 approve-after-reject 的 @unique 冲突：驳回不占唯一键槽位，补足后 approve 可顺利写入。DR-86（驳回 targetProgramId=null）语义失效：驳回不写本表，targetProgramId=null 约束变为不适用，DR-86 历史保留（append-only），本条为后修订说明。**`result` 字段保留**（恒为 passed），备扩展（如未来区分 passed 子类型）（用户决策 2026-06-04）| 排除「@unique 改为只约束 passed（应用层）」：DB 约束降级到应用层，并发写入时无法防重；排除「允许多条 record（去掉 @unique）」：增加查询复杂度，需额外逻辑取最终记录；"只写 passed"方案 DB 约束保持最强，AuditLog 承载驳回留证（能力 20 / D17 职责本就如此），语义最纯粹。关联 DR-86（驳回 targetProgramId=null，现失效）/ DR-169（AdvancementCheck upsert）/ DR-83-B（conditionsSnapshot 冻结）/ D17 / §3.11 AuditLog / R3-T4/T5 |
| DR-173 | T11/T14 消解：`conditionsSnapshot` 深度——DR-162 直接查原始表架构下，原始数据永久留档，快照只需冻结结论层（2026-06-04）| **conditionsSnapshot 冻结结论层已足够**：`actual` / `passed` / `exempted` 冻结的是判定结论；原始数据（PracticeLog / ExamGrade 等）在 DR-162 直接查询架构下永久可查（D18 不物理删除），审计时直接查原始表截面即可，快照无需深度复制细节（用户决策 2026-06-04）。**消解，非闭合**：T11（isSubstituted 细节缺失）/ T14（exam score 细节缺失）是 DR-162 架构变更的副作用——原担忧基于"快照是唯一留证"的旧假设，直接查原始表后旧假设不成立，问题自然消失。关联 DR-162（直接查原始表）/ DR-83-B（conditionsSnapshot 冻结）/ D18（不物理删除）/ T11 / T14 |
| DR-172 | T5 闭合：`isSubstituted=true` 时顶礼 cumulative_count 整体切换替代路径，不叠加（2026-06-04）| **切换路径，不叠加**：顶礼 `UserPracticeVow.isSubstituted = true` 时，升学预检顶礼项判定整体切换为替代路径（验证心咒 vow `currentCount ≥ 2,000,000`），不再聚合顶礼历史 `count`；历史数值原封保留（DR-94），仅不参与预检达标判定（用户决策 2026-06-04）| 排除「两路并行」：允许叠加会产生语义歧义（顶礼差 5 万但替代已完成，判定如何？），且替代路径本身已覆盖顶礼+法王祈祷文双豁免（DR-151），再聚合历史打卡是冗余；明确"切换"语义让预检逻辑分支清晰，开发者只需判断 isSubstituted 标志后走一条路。关联 DR-94（isSubstituted 字段）/ DR-151（双豁免因果链）/ DR-170（不过滤起修日）/ T5 |
| DR-171 | T4 闭合：心咒打卡一因多果——替代路径心咒打卡同时计入心咒 cumulative_count；顶礼打卡同时产生 prayerCount（2026-06-04）| **一笔打卡服务多个升学条件，有意设计**：(1) 正常路径顶礼打卡 = 同次录入顶礼 count + prayerCount → 分别计入顶礼 cumulative_count 条件 + 法王祈祷文条件；(2) 替代路径（isSubstituted=true）心咒打卡 = 既用于 200万 触发顶礼✅+法王祈祷文✅双豁免，**同时**也计入心咒项自身的 cumulative_count 条件（如 10万）。两个用途互不排斥（用户决策 2026-06-04）| 排除「心咒打卡被替代路径"消费"后不再计入 cumulative_count」：顶礼、法王祈祷文、心咒三者本为同时进行的修持（用户明确），功德不因系统判定路径而拆分；DR-171 仅补明文，业务逻辑本已由 DR-151（一因两果）+ DR-95（prayerCount 同次录入）覆盖，此前缺的是明文防止开发者误判为 bug 而"修复"。关联 DR-151（一因两果）/ DR-95（prayerCount）/ DR-94（isSubstituted）/ DR-157（cumulative_count 全量聚合）/ T4 |
| DR-170 | T2 闭合：`cumulative_count` 预检不过滤起修日——全量历史累计，D14a 时间维度延伸（2026-06-04）| **不过滤起修日**：`cumulative_count` 升学聚合不加 `loggedAt >= UserPracticeVow.createdAt` 条件，全量历史打卡均计入（用户决策 2026-06-04）| 排除「与 practice_session 对齐、也过滤起修日」：92 修法是座次资格（起修日界定修行起点合理）；内加行是累计遍数（历史已念成的功德不倒扣），两者性质不同；D14a「念一份算多份」的跨专业共享精神同样适用于时间维度；强制对齐会产生 false-negative（学员立誓前已累计的遍数被清零）。关联 DR-161（practice_session 起修日过滤）/ DR-157（cumulative_count 全量跨专业聚合）/ D14a / T2 |
| DR-169 | T10 闭合：`AdvancementCheck` 重触发预检语义——upsert，不堆版本（2026-06-04）| **重触发 = upsert**：补足条件后管理员再次触发预检，系统以 `[userId, programId, semesterNumber, reportNodeIndex]` 为 upsert 键更新 `checkResults` / `overallPassed` / `status`（用户决策 2026-06-04）| 排除「加 attemptNumber 字段、每次建新行」：AdvancementCheck 本已设计为可变（DR-85，豁免时写入 checkResults），旧预检行对历史无额外价值；每次驳回后的历史由 AdvancementRecord（拍板记录，不可变）+ AuditLog（豁免留痕）双层承载，AdvancementCheck 只保存"当前最新预检状态"，堆版本是过度设计；排除「允许 create 并容错唯一键冲突」：隐式假设危险，开发者若误用 create 会拿到 unique constraint error，不如明文要求 upsert。关联 DR-85（checkResults 可变）/ DR-83-B（AdvancementRecord 冻结原则）/ T10 |
| DR-168 | T13 闭合：`exam_score` 预检多专业隔离——JOIN 链 `ExamGrade→Exam→Class.programId`，无需冗余字段（2026-06-04）| **JOIN 链隔离，不加字段**：`exam_score` 升学预检查询 `ExamGrade` 时，通过 `ExamGrade → Exam（examType='advancement'）→ Class.programId = :pid` 三表 JOIN 确定"目标专业的升学考成绩"；多专业学员（如小周同时读净土+密法预科）的两套升学考成绩自然隔离，各专业预检只取本专业班级创建的升学考（用户决策 2026-06-04）| 排除「ExamGrade 加 programId 字段」：字段可从 `examId → Exam.classId → Class.programId` 派生，写入时需双写 + 与 Class.programId 保持同步，维护成本高于 JOIN；排除「params 里指定 examId」：按场次绑定升学考过于刚性，换届需重配，而按专业班级 JOIN 更自然稳定。关联 DR-14（Exam.examType）/ DR-99（exam_score params）/ DR-101（ExamGrade 写权限）/ T13 |
| DR-167 | ISG-12 闭合：`CohortLagSnapshot.taskLag` 达标基准查询范围——`classId → Program` 隐式链，多专业独立判掉队（2026-06-04）| **`taskLag` 达标基准 = `classId → Class.programId → Program` 任务配置**：计算掉队率时，以该班所属 `Program` 的 `dailyTarget`（或 `weeklyTarget`/`targetCount`，DR-124）为达标基准；快照表不需要单独存 `programId` 字段，因为 `classId` 已唯一确定 `programId`（一班一专业，DR-1）。**多专业独立**：多专业学员在各专业班各有独立 `CohortLagSnapshot`，各自独立判掉队，**任一专业掉队即触发关怀**（能力 14）（用户决策 2026-06-04）| 排除「在 CohortLagSnapshot 加 programId 字段」：`classId → Class.programId` 链已隐式确定专业，冗余字段增加维护成本（需与 Class.programId 保持同步）且无必要；排除「多专业学员按主修专业判掉队」：D9 多专业独立，主修只是默认展示专业，不应让主修的掉队阈值代替其他专业；排除「多专业全部不掉队才触发」：掉队触发是关怀，AND 逻辑让任何一个专业掉队都无法得到关怀，过严；任一专业掉队即关怀与能力 14「关怀所有需要关注的学员」精神一致。关联 DR-1（一班一专业）/ DR-88（阈值数据化）/ DR-124（ClassTask 三口径）/ ISG-12 / 能力 14 |
| DR-166 | ISG-11 闭合：法王祈祷文 `prayerCount` 聚合范围与 DR-157 对齐——全量聚合，不过滤 programId/vowId（2026-06-04）| **全量聚合，不过滤 programId/vowId**：`prayerCount` 升学聚合范围与 `cumulative_count` DR-157 口径完全对齐——`SUM(prayerCount WHERE practiceProjectId=:顶礼项目 AND userId=:id AND ritualCompliant IS NOT FALSE)`，不加 `programId`/`vowId` 过滤；多专业并修学员在任一专业顶礼时记录的 prayerCount 均计入（D14a「念一份算多份」跨专业共享精神）。同时同步 DR-164 `ritualCompliant IS NOT FALSE` 过滤至 §1.12（避免 §3.1 与 §1.12 口径不一致）（用户决策 2026-06-04）| 排除「只聚合加行专业对应 vow 的 prayerCount」：顶礼 `cumulative_count` 按 DR-157 全量聚合，`prayerCount` 是同一笔打卡产生的字段，若两字段口径不同（count 全量聚合但 prayerCount 按 vow/programId 过滤），同一笔打卡在两个升学条件上呈现不同聚合范围，设计矛盾；法王祈祷文与顶礼本身共生（一次打坐同时产生），功德属性与 D14a 一致，不应按专业拆分。排除「加 programId 过滤」：多专业学员若在 A 专业顶礼时记录的 prayerCount 不计入 B 专业法王祈祷文，与 D14a「念一份算多份」精神冲突，且与 cumulative_count 口径不一致（false-negative）。关联 DR-157（cumulative_count 全量聚合）/ DR-164（ritualCompliant IS NOT FALSE）/ DR-95（prayerCount 字段）/ D14a / ISG-11 |
| DR-165 | ISG-10 闭合：`practice_session` 预检不过滤 `source`——`in_app` 与 `external` 同等计入（2026-06-04）| **`source` 不过滤**：`practice_session` 升学预检聚合 `PracticeLog` 时不加 `source` 过滤条件，`in_app`（app 内打坐记录）与 `external`（线下打坐经计数模块申报，DR-144）贡献相同，两者对升学条件无区别；"须录完整信息才能进升学聚合"（09 能力 4 注记）的含义是录入层的完整性校验（`meditationId` 必填 + `durationMinutes ≥ 30`，Zod 把关），而非预检时按 source 二次过滤（用户决策 2026-06-04）| 排除「过滤 source=external 不计入」：DR-144 明确承诺 app 外申报可进升学聚合，过滤则让功能承诺与实现矛盾，线下用功的学员全部丢失升学积分（false-negative）；排除「预检时二次校验 durationMinutes ≥ 30」：录入层已通过 Zod 保证完整性，到预检时数据已合格，重复校验是多余的防御；`source` 是录入来源标记，与修量有效性无关（信任模型与 ritualCompliant 区分：合规标志是管理员事后评审，source 只是来源）。关联 DR-144（app 外申报设计）/ DR-98（practice_session params）/ DR-161（起修日过滤）/ ISG-10 |
| DR-164 | ISG-7 闭合：`cumulative_count` 预检补 `ritualCompliant IS NOT FALSE` 过滤（2026-06-04）| **`ritualCompliant IS NOT FALSE`**：cumulative_count 判定 `SUM(PracticeLog.count)` 及法王祈祷文 `SUM(prayerCount)` 均加 `AND ritualCompliant IS NOT FALSE` 过滤，仅排除管理员显式标记 `ritualCompliant=false` 的记录；`true` 和 `null` 均计入（null 不惩罚：能力 6 绝对约束 2 要求必填，线上正常流程不应出现 null，但防御性兼容）（用户决策 2026-06-04）| 排除「全量不过滤」：管理员已标作废的不合规打卡记录被计入升学聚合，违反能力 6 规则 4「仪轨不合规修量作废」；排除「只计 `ritualCompliant=true`」：过严，null 值的合法记录（如历史数据、admin 代行补录未填合规标志）会被静默排除，导致 false-negative；选 `IS NOT FALSE` = 只排除已明确标作废的，语义精确最小干预。关联 能力 6 规则 4 / 绝对约束 2 / DR-95（prayerCount 独立聚合）/ ISG-7 |
| DR-163 | ISG-6 闭合：`attendance` 出勤计算范围逆转——current_member + 豁免机制（2026-06-04）| **(逆转 DR-159 D-A1) classScope = current_member**：出勤聚合范围收窄为当届 `ClassMember.cohortStatus='active'` 对应班级；留级后历史出勤不自动累入升学预检（留级 = 重新修此届、历史出勤不自然延伸）。**(豁免机制) DR-85 exempted=true**：管理员若认为学员前届出勤已达标，可在 checkResults JSON 对应条目设 `exempted=true/exemptedBy/exemptedAt`（DR-85 已有此机制），该条件预检自动通过；学员只需补足其余缺口。**SQL 收窄**：`classId = (SELECT classId FROM ClassMember WHERE userId=:uid AND programId=:pid AND cohortStatus='active')`（= 替代 IN，仅一个活跃班，逻辑更精确）（用户决策 2026-06-04）| 排除「保留 program_all_members（DR-159 D-A1 原选）」：跨届历史出勤自动累入会让留级形同虚设——留级本意是让学员重修、补足不足，若历史出勤照算则留级对出勤条件无实质约束；排除「清零但无豁免」：前届确已达标的学员被强迫重修出勤不合理，豁免机制是对个案的精准弹性（DR-85 已存在，零新字段）；排除「自动识别前届已达标」：自动逻辑复杂且边界不清（哪届算已达标？累积如何算？），管理员手动授权更可控、更符合治理精神（DR-5 硬条件默认不放宽，豁免须管理员显式开启）。关联 DR-159（被逆转的 D-A1）/ DR-85（exemptable 机制）/ ISG-6 / 能力 8 / 能力 10 |
| DR-162 | 升学预检改直接查询原始数据（不经 SemesterSnapshot，2026-06-04）| **直接查询**：AdvancementCheck 遍历 ProgramAdvancementConfig 6 条，每条按 conditionType 直接查对应原始表（course_completion→LessonCompletion；practice_session→PracticeLog；cumulative_count→PracticeLog；attendance→StudyRecord；exam_score→ExamGrade；transmission→TransmissionRecord），不依赖 SemesterSnapshot（用户决策 2026-06-04）。**SemesterSnapshot 保留**：仅服务报数汇总展示（能力 6），与升学判断解耦。**ISG-5/ISG-8 消解**：两条缺口均是"快照聚合口径"问题，快照退出升学判断流程后自动消解 | 排除「继续走快照（原设计）」：快照多一层中间状态，存在不一致风险；首版学员数量有限，直接查询性能完全足够；无快照则无需讨论聚合口径（ISG-5/ISG-8），架构更简洁。排除「完全删除 SemesterSnapshot」：报数汇总展示仍需快照，只是升学判断不再依赖。关联 §3.9 AdvancementCheck / §3.7 SemesterSnapshot / ISG-5 / ISG-8 |
| DR-161 | ISG-4 闭合：`practice_session` conditionType 判定逻辑补起修日过滤（2026-06-04）| **`loggedAt >= Program.startDate`**：预检聚合范围限定为起修日（`Program.startDate`，即 S2 开始时间/UserPracticeVow 建立时间）之后的 PracticeLog；起修日前（S1）的修量不自动计入升学聚合（能力 4 规则 8）。管理员通过能力 5 代行补录 S1 修量若需计入升学，须将 `loggedAt` 设为 >= vow.createdAt（行政行为，非系统自动）（用户决策 2026-06-04）| 排除「不加时间过滤」：S1 阶段通过 source=external 申报或管理员补录的座数会被预检计入，违反"起修日之前不算"硬规则（能力 4 规则 8）；选定 UserPracticeVow.createdAt 而非 Program.startDate：startDate 字段在 Program 表不存在；UserPracticeVow 在起修日建立（G1.3），createdAt 精确反映每个学员的个人起修时刻，比 ProgramSemester[S2].startDate（程序级统一时间）更准确（用户决策 2026-06-04）。关联 能力 4 规则 8 / G1.3（S1 修量代行补录方案 B）/ DR-98（practice_session params）/ ISG-4 |
| DR-159 | ISG-2 闭合：`attendance` conditionType 标准 params 结构（共修出勤达标查询范围，2026-06-04）| **(D-A1) classScope = program_all_members**：出勤聚合范围 = 本专业下该用户全部 ClassMember 行对应的班级全历史出勤；留级后历史出勤**不清零**，本专业所有届班累计计入（`classId IN SELECT classId FROM ClassMember WHERE userId=:uid AND programId=:pid`）。**(D-A2) studyType = group_attend**：只计实到课次（`StudyRecord.studyType='group_attend'`），不含补课回看（group_review）/总结课（group_summary）。完整判定：`SELECT COUNT(*) FROM StudyRecord WHERE userId=:uid AND studyType='group_attend' AND classId IN (SELECT classId FROM ClassMember WHERE userId=:uid AND programId=:pid) ≥ targetValue`（用户决策 2026-06-04）。**🔻后修订（DR-163，2026-06-04）：D-A1 逆转，classScope 改为 current_member，SQL 改为 `classId = (SELECT classId FROM ClassMember WHERE ... AND cohortStatus='active')`；前届已满足可由管理员授豁免（DR-85）** | 排除「classScope=current_member（只算当前班）」：留级学员历史出勤被清零，勤奋参课但因其他原因留级的学员会被冤枉——出勤是积累，留级不应重置；排除「classScope=program_all_active_classes」：revoked/ended 历史班出勤被遗漏，program_all_members（含所有历史 ClassMember）更完整。排除「studyType IN (group_attend, group_review)」：补课回看是缺席补偿、非实际共修参与，出勤门槛本意「到场参与共修」，回看不等同实到。关联 能力 8 / ISG-2 / ISG-6（留级语义，同源）/ DR-163（后修订）|
| DR-158 | ISG-9：course_completion 闻思圆满跨专业隔离——LessonCompletion 加 programId 字段（2026-06-04）| **(1) programId 必填**：LessonCompletion 新增 `programId String`（必填，非空），写入时从学员当前所在专业上下文带入（前端从任务卡/课程页传递，与 PracticeLog.programId DR-120 G4 同思路）；与 User/Lesson 并列外键关联 Program；Migration M3f 表定义追加此列。**(2) course_completion 预检过滤**：`course_completion` conditionType 预检加 `AND programId=:pid` 过滤，确保 A 专业的闻思记录不满足 B 专业的 course_completion 条件（见 §3.1 params 新增节）；与 D14b "daily_frequency 按 vowId 过滤本专业"同一隔离思路（DR-157）。**(3) 不设跨专业共享例外**：闻思圆满的语义是"在本专业教学框架下理解并圆满该法本"，不同于实修打卡的功德义（D14a 累计共享）；故不与 D14a 共享路径对齐；能力 3 规则 7"各自完成"由此得到数据层落实（用户决策 2026-06-04）| 排除「闻思记录全局共享（方案 B）」：法本在不同专业可能有不同深度的学习要求，且共享会让学员用一个专业的记录直接满足另一专业的升学硬条件，治理风险高；D14a 共享仅适用于"修持功德累积"场景（物理行为不可分割），闻思是课程达标事件，按专业隔离与 D13 硬条件精神一致。排除「programId 可空（String?）」：可空会导致历史记录无法被 course_completion 预检正确聚合（NULL 不匹配 `:pid`）；LessonCompletion 是新建表（幻影表纠正，DR-129），起点就非空最干净；能力 5 代行补录也可从上下文得到 programId（管理员知道为哪个专业补录）。关联 DR-129（表新建）/ DR-120 G4（programId 字段同思路）/ DR-157（daily_frequency 隔离参照）/ ISG-9 / 能力 3 规则 7 / D13 |
| DR-157 | 剧本「小周双专业实修」GAP-1/2/3：D14a/D14b conditionType → AdvancementCheck query scope 映射规则（2026-06-04）| **(累计型 D14a：cumulative_count 条件跨专业全量聚合)**：预检 SQL = `SELECT SUM(count) FROM PracticeLog WHERE userId=:uid AND practiceProjectId=:pid`，**不加 programId 过滤，不加 vowId 过滤**；用户在任何 vow/专业下录入该修持项目的打卡均计入（"念一份功德算多份"，D14a）。`PracticeLog.programId` 仅用于结果溯源展示（"通过 X 专业达成"，DR-120），**不作预检过滤条件**。**(日常型 D14b：daily_frequency 条件按本专业 vow 过滤)**：预检 SQL = `SELECT DATE(loggedAt), SUM(count) FROM PracticeLog WHERE userId=:uid AND practiceProjectId=:pid AND vowId IN (本专业所有 active/revoked vow id)`，**按 vowId 限定本专业**（vowId 集合 = 该用户该 programId 下所有 UserPracticeVow，含 active 和已 revoked 的历史 vow，DR-155）；每日 SUM 需 ≥ threshold 才算达标，不因另一专业的打卡豁免（"跨专业日常不豁免"，D14b）。**(DR-153 调和)**：vowId 必填保证打卡路由到正确专业（D14b 正确），D14a 预检不用 vowId 过滤实现跨程聚合——一次打卡同时满足两个条件，无需录入两次（用户决策 2026-06-04）| 排除「cumulative_count 也按 programId 过滤」：使 D14a "念一份算多份"在多专业场景静默失效——学员录入 1 万遍，升学预检仍显示"未达标"（false-negative），GAP-1/GAP-3 根因；排除「daily_frequency 按 programId 过滤」：programId 在录入时来自前端 context，若用户从加行任务卡录入入行论心咒，programId 会赋加行，导致 D14b 净土/入行论日常计数污染，不如 vowId 精确；排除「vowId 区分 daily 但 programId 区分 cumulative」：双路由条件逻辑不一致，易混淆，vowId 全覆盖更统一。关联 D14a/D14b、DR-153（vowId 必填）、DR-120（programId 追溯）、DR-97（conditionType）、08 §3.9 设计意图、03-scenario-shared-mantra.md（GAP-1/2/3 已闭合）|
| DR-151 | 裁判剧本 1 剩余缺口合并决策：(1) 多正科并存无上限；(2) 主修永不自动更改；(3) 升学确认=邀请码；(4) 200万心咒完成→双豁免因果链 + substitutionFor 字段（裁判剧本 1 T24/T25 缺口闭合）| **(1) 多正科并存不设上限**：D9/D16 独立升学适用于所有阶段，正科并存专业数量无上限约束，管理层通过邀请码自然控制。**(2) 主修永不自动更改**：`primaryProgramId` 由用户在设置页自行设定，任何系统事件（升学/毕业/留级/加入新班）均不自动修改主修字段，需用户主动操作；删除所有「升正科后主修可能自动切换」表述（修订 D16/能力 10 规则 8）。**(3) 升学确认=邀请码**：学员「确认升学」即使用管理员发送的正科班邀请码加入正科班（走能力 2 落班机制，DR-150 已覆盖），无需额外确认步骤、无中间状态、无新 API，`advanced` 状态下等待加入正科班即为「已升学待入班」（用户决策 2026-06-03）。**(4) 200万因果链**：`substitutionFor String?` 新增至 UserPracticeVow（心咒代替 vow 专用，存顶礼 vow id）；升学预检当 `isSubstituted=true`：通过 `substitutionFor` 找心咒 vow → 验证 `currentCount ≥ 2,000,000`；完成→顶礼 ✅ + 法王祈祷文 ✅（双豁免，一因两果，大纲§649）；未完成→两项均 ❌（用户决策 2026-06-03）| (1) 排除「正科并存设上限」：D9/D16 明确多专业平等独立，无上限约束符合设计原则，管理员邀请制天然控制入口；(2) 排除「系统自动切换主修」：主修是用户对自身学习重心的主观声明，系统无法代为判断，自动切换会覆盖用户意图；排除「不提供主修设置」：D9 多专业并行需要一个默认展示专业，用户设定是最合理入口；(3) 排除「新增学员升学确认步骤」：DR-150 落班机制已是两步走（approve→advanced→邀请码加入），再加一个「学员确认」步骤等于三步，过于繁琐；邀请码使用本身就是用户主动确认的行为；(4) 排除「顶礼已修多少折算减免心咒目标」：大纲无此公式，不自创规则；排除「法王祈祷文独立豁免路径」：大纲§649 200万心咒的因是「代替身体条件（顶礼）」，果是「顶礼+祈祷文均豁免」，两个效果来自同一原因，不可拆分；排除「不记录 substitutionFor」：无此字段则升学预检无法验证是哪条心咒 vow 完成，因果链断裂。无新表；§三 UserPracticeVow 加 1 字段；关联 D9/D16、DR-94/DR-95/DR-150、能力 7/10、大纲§649 |
| DR-150 | 升学后三方归宿：落班机制 / 原专业终态 / 并行专业归宿（裁判剧本 1 T22/T23 缺口闭合）| **(1) 落班机制=邀请码两步走**：approve 只写预科侧（graduated→advanced + AdvancementRecord），管理员另发正科班邀请码，学员走能力 2 加入正科班（不自动建正科 ClassMember）；与留级机制完全对称（能力 11 规则 7）。**(2) 原专业终态=永久 advanced**：原预科 ClassMember 升学后停留在 `advanced` 不再改变；正科班是全新 ClassMember（active）；二者独立存档（D18）；`advanced` 无超时机制（学员若长期未加入正科班亦无需处理）。**(3) 并行专业不级联**：其他并行专业（如净土）ClassMember 不因本专业升学而改变（D9/D16 多专业完全独立）；「正科密法 + 预科净土跨阶段并存」合法（用户决策 2026-06-03）| 排除「approve 时选目标班+自动建正科 ClassMember」：正科班开班时间未必与预科结业同步，强制同步会卡流程；且留级走邀请码、升学若走自动建造成双轨不一致；邀请码两步走更灵活、与留级对称、advanced 语义清晰；排除「并行专业随升学 cascade」：D9/D16 明确多专业平等独立，任何 cascade 均违反设计原则；排除「advanced 设超时降回 active」：advanced 是事实状态（管理员已拍板升学），回退会造成审计混乱（D18/DR-149）。无新表/新字段；关联 D9/D16/D18、DR-149、能力 2/10/11 |
| DR-149 | 「加行毕业」作为独立事件未定义 + 毕业 vs 升密法条件混淆（裁判剧本 1 T16/T17）+ cohortStatus 缺 advanced/disqualified 值 | **(1) graduated/advanced 语义分离**：`graduated`=第八学期学制走完的时间事件（管理员手动结业、无实修门槛、留预科原地，大纲§573）；`advanced`=毕业且升入正科（升学审核通过，大纲§613-672 硬条件）。**(2) 法王祈祷文/灌顶/完整内加行是升密法（advanced）门槛、非毕业（graduated）门槛**（大纲§651「否则不能进入密法」）→ 欠账学员可 graduated 不可 advanced。**(3)** cohortStatus 加 `advanced`（升正科）+ `disqualified`（取消资格，职能#14）两值，5 态→7 态。**(4)** 毕业触发=管理员手动结业（class_admin+，绝对约束4「无自动」精神）。**(5)** 毕业去向决策树：升学（→advanced）/留级（→held_back）/转预科（退出+加入）/转功德会（❌ DR-68）（用户决策 2026-06-03）| 排除「毕业设实修门槛」：大纲§573 毕业=第八学期结束的时间事件、非达标事件，实修硬条件是升密法门槛（§651），「毕业留级」（大纲PAGE25-26）指毕业后升学预检不过而留级、非毕业本身有门槛；排除「graduated 一值兼表毕业与升学」：无法区分「达标未升学」（净土达标留预科=graduated）与「升学成功」（=advanced），且法王祈祷文欠账「可毕业不可升密法」无法表达，故必须二值分离；排除「disqualified 复用 left」：取消资格与自主退出在语义/权限/再入学规则上不同（downstream 详 Unit ⑤）。详见 DR-150（落班机制 + 原专业终态 + 并行专业归宿）。§一12/§三20/§四20 不变（仅扩 enum 值）；关联 D13/D16/DR-68、能力 9/10/11、大纲§573/§651 |
| DR-148 | 大纲 C3「念佛号三选一只报一种」/ C4「入行论观修·心咒二选一」互斥 + C5「自选功课不计入升学」——加新字段还是用现有结构？ | **config 驱动·零新字段**：① 互斥规则写进 `ProgramAdvancementConfig.params`（已是 Json，如 `{selectionGroup:'nianfo', selectionMode:'pick_one'}`），`POST /api/practice-logs` 读 params 校验（同组 pick_one 已报另一项→409），**不给 ClassTask 加字段**；② 自选功课「不计入升学」**靠 config 引用判定**——升学预检只认 `ProgramAdvancementConfig` 引用的功课，自选功课不在任何 config 中→天然不计，**不给 PracticeProject/PracticeLog 加 countsForAdvancement**（用户决策 2026-06-02） | 排除「09 原拟加新字段」（ClassTask.selectionMode/selectionGroup + PracticeProject.countsForAdvancement）：后者会让 PracticeProject 从复用区移入扩展区（计数 churn + migration），且 ClassTask 只覆盖辅导员任务、大纲级 C3/C4 落点不全。**现有结构（params Json + config 引用）更贴合 08 的 D3 数据驱动，零字段零 churn。** §一12/§三20/§四20 不变；关联 D3、能力 7/10、大纲 C3/C4/C5 |
| DR-147 | 角色任命是否支持「过期时间」`expiresAt`？——06 能力18 规则7 要求，但 08 `UserRoleAssignment` 只有 revoke、无 expiresAt（06↔08 冲突） | **选 B·废规则**：角色**不设自动过期**，仅手动撤销（`status='revoked'`），历史永久留痕（D18）。08 `UserRoleAssignment` 无需加 `expiresAt`；06 规则7 已同步标 ❌废弃（用户决策 2026-06-01） | 排除「A·补字段」（08 加 `expiresAt` + 到期 cron/查询判失效）：线上无角色过期需求、手动 revoke 已够；08 设计未纳入过期应是有意，加字段+到期判定徒增维护面。**以 08 封板为准，废 06 规则7。** 零新表零字段，§一12/§三20/§四20 不变；关联 D6/D8、06 能力18 规则7 |
| DR-146 | 大纲 E1/E2「每月≥2 次共修 / 每月 1 次实修共修」频率门槛——app 是否记录/追踪？ | **不记录·走建课时课表配置**：该频率不作为 app 追踪/展示/校验的运行指标，而是建课时课表配置的内在排程要求——管理员/辅导员创建课程/共修课表（能力 1 课程配置 + 能力 8 ClassSessionSchedule）时按大纲排足每月≥2 次共修（及每月 1 次实修共修），频率由课表结构本身保证；app 无 monthlyFrequency 字段/展示/预警/升学校验（用户决策 2026-06-02） | 排除「app 算并展示 monthlyFrequency（原拟 C 折中告知）」：频率是排课配置的结果、非需追踪的运行指标，多余；排除「app 自动预警+卡升学（A）」：把排课配置问题错位成学员考核；排除「app 完全不提（B）」：仍需在建课配置层体现大纲要求。**定位：频率是『配置期』约束（建课排足），非『运行期』指标。** 零新表零字段，§一12/§三20/§四20 不变；关联能力 1/8、大纲 E1-E2 |
| DR-145 | 暂缓功能群梳理：自学模式转必做（移入实施）+ 社交/AI/徽章只做后台关键部分 —— Phase 图重排 | **暂缓群一分为二**：① **自学模式（能力 21）转必做正式功能**——⏸暂缓→✅必做，§5.4 UserSelfStudyProgram 由 §五暂缓移入 §三实施（计数归 §三、物理位置保留 §5.4，同 DR-129 处理），Phase 紧接 P5 后=新 P6（核心跑通即上自学），TODO-5（Program.selfStudy 反向关联）转必做；② **社交（能力 22/23/24 班级动态/讨论/约修）降为「只做后台关键部分」**——原「全功能待实现」→建表+后台逻辑、不做正式用户前端 UI（同徽章/AI 调子），10 张表留 §五暂缓区（仍实现待排期）、仅重标 scope，Phase 顺延 P7；③ **AI（能力 25）维持 DR-109「后台必要部分」、成就徽章（能力 38）维持 DR-128「后台保留不上线」**，均不变。**战略**：收敛到「核心学修管理 + 自学」，社交/AI/游戏化压成后台预留（用户决策 2026-06-01）| 第③条暂缓功能群梳理。用户拍板：自学是必要功能（独立于升学体系、用户价值直接）→提优先级转必做；社交/AI/徽章只做后台关键部分。**自学排位**：依赖 P0 地基 + 能力 7 打卡（P4），核心（P0-P5）跑通即上，故新 P6；不依赖升学 P2（DR-103/104）。**社交「建表+后台」**：用户明确选「建表+后台」（非纯留设计）——表与后台逻辑保留为 latent 能力，但不做正式社交 UI，故留暂缓区（实现待排期）、scope 收窄。**表计数**：自学 1 张跨区 §五暂缓→§三新建（19→20、暂缓 11→10）；社交 10 张留 §五不动；AI/徽章不变；§一12/§四20 不变。Phase 净变化：原 P6 社交/P7 自学/P8 AI → 新 P6 自学（必做）/P7 社交（后台 only）/P8 AI。排除「社交纯留设计·表不建」：用户选建表+后台；排除「自学继续暂缓」：用户明确必做；排除「社交全砍」：用户要保留后台能力非永久不做 | 第③条；关联 DR-103/104（自学）/DR-105（社交）/DR-109（AI）/DR-128（徽章）；改 §三/§五计数 + §十二 Phase |
| DR-144 | app 外学修申报入口（计数模块按课时标记听/看/读/观修完成）+ 录入方式重定义 in_app/external —— 收 DR-143 对能力 9 的连带矛盾 | **在能力 9 计数/报数模块加「app 外学修申报」入口,服务不在 app 内学习的学员(纸质法本/线下音视频/线下打坐),按课时(科)手动标记听/看/读/观修某遍完成,帮助统计学习进度**：① 申报维度=听(audio/video)/看(read)/观修;**答题不可申报**(交互题仅 app 内做);② **可填 N 遍**——线下一周听 3 遍即填 3,展开成 N 条完成事件(一遍一行,供能力 3 COUNT);③ 落点不变——听/看/读→LessonCompletion(type=audio/video/read)、观修→PracticeLog{meditationId,durationMinutes}(录完整信息:选修法+手填时长+≥30 分钟校验,同能力 4/DR-91);④ **录入方式重定义**(收 DR-143 矛盾)——能力 9 规则 2 旧「自动记录/手动记录」(举例 app 内看视频自动计次,已被 DR-143 改纯手动、过时)改为 **in_app(app 内看/读/听完确认) / external(app 外学习、计数模块申报)**,两者都是手动、只是触发地点不同;⑤ **来源落字段**——LessonCompletion 加 `source(in_app/external)`;PracticeLog 既有 `source` 值域校准 manual/auto/ai_assistant→**in_app/external/ai_assistant**(DR-143 后 auto 已无来源,清理对齐),承载能力 9 绝对约束 1「每条记录标注来源」;⑥ **防刷**——source=external 且零 app 活动=管理员重点核查对象,接虚报治理(能力 9 规则 10 忏悔→取消资格),与 DR-143「防刷交治理+审核」一致(用户决策 2026-06-01)| 用户提「计数模块内也可给阅读/音视频/观修标记某科完成,适用于不用 app 学习的人,帮助统计学习进度」。**判断**：DR-143 把完成统一为「用户手动确认」后,天然存在两个触发入口——app 内看读完点完成、app 外学完进计数模块申报;本诉求即后者,与 DR-143 同一套表/判定,只是地点不同,故用 source(in_app/external) 标记区分即可,无需新判定逻辑。**正好收 DR-143 连带**:能力 9 旧「自动/手动」分类的「自动=app 内看视频自动计次」举例已被 DR-143 作废,本决策把该轴重定义为 in_app/external,矛盾闭合。**N 遍**:闻思按遍数 COUNT(盲听≥2/聋看≥2),线下补录须能一次报多遍,展开成 N 行保持一遍一行 COUNT 语义。**观修录完整信息**:进升学须 meditationId 分组 + 时长(DR-98/DR-91),app 外申报不能省。**答题仅 app 内**:随堂题交互判分,线下无从申报。**source 字段**:LessonCompletion 是新表(DR-129),加 source 仅扩 spec、零计数影响;PracticeLog 既有 source 值域 DR-143 后「auto」无意义,校准为 in_app/external/ai_assistant 顺带清理(DR-120/M1 spec 同步注)。**表计数**:新表加字段 + 既有字段值域校准,零新表零删表,§一12/§三19/§四20 不变。排除「app 外申报另建表」:与 app 内完成同语义同判定,分表徒增聚合复杂度;排除「不标来源混入」:违反能力 9 绝对约束 1、且失去对纯线下自报的核查抓手 | 收 DR-143 能力9 连带;校准 DR-120 source 值域;关联 DR-111/DR-91/DR-98/能力3/4/9 |
| DR-143 | 🔴 完成判定全面转纯手动（法本阅读/音频/视频/观修）+ app-kill 续播延迟确认 —— supersede DR-141/142、改 DR-92/DR-129 完成口径 | **四类学修内容（法本阅读 type=read、音频/视频 type=audio/video、观修）完成一律以用户手动确认为准，系统不做自动达标判定**：① 每类内容页加「完成」按钮（观修沿用现有「完成观修」），离开页面（路由切换）若有实质进度未确认→弹「本遍是否完成？」，用户确认才写完成；② 落点不变只改触发——法本/音视频→LessonCompletion(type=read/audio/video) 用户确认写，观修→PracticeLog{meditationId,durationMinutes}+UserPracticeVow（DR-111 不变），观修时长纯用户手填、确认时校验 DR-91 ≥30 分钟；③ DR-141/142 音视频阈值 + 能力 37 scrollPercent/totalSeconds 阈值全部 supersede（不再判完成），技术防刷（playedSeconds 累计/心跳≤60s）失效，防刷改交虚报治理（忏悔→取消资格）+ 升学管理员审核，与 10 万顶礼自报同一套信任模型；④ LessonCompletion type 收敛 audio/video/read（去掉 meditation——观修走 PracticeLog，DR-111），DR-92 矩阵不含观修、meditationLag 旧引用改指 PracticeLog(meditationId)；⑤ 掉队检测（能力 14 contentLag/meditationLag）口径改按「已确认完成数」（LessonCompletion COUNT / PracticeLog 座数）；⑥ app-kill 续播+延迟确认：播放/阅读位置 + 未确认会话标记存 localStorage（进程被杀不丢，本地持久存储），重进续播到上次位置 + 若有未确认会话补弹「上次读到/听到 X，本遍是否完成？」（观修完成接手填时长），同设备不跨设备（用户接受）（用户决策 2026-06-01）| 用户两轮决策：先选「自动检测降为辅助」，后明确推翻为「不设自动检测、改纯手动，但要做后台被杀处理」+「观修时长纯手填」。**判断**：以用户确认为完成唯一权威，则自动达标阈值失去意义——观修早已是纯手动（DR-111 手动提交座、看视频80%不算座），本决策让法本/音视频向观修看齐，模型最一致；自动阈值取消后技术防刷无附着点，回归与 10 万顶礼/座次自报相同的「自报+治理+审核」信任模型，统一全平台报数信任口径。**app-kill**：正常离开有路由事件可当场弹确认，进程被杀无事件→须持久化；选 localStorage 而非服务端表——同设备抗杀够用（localStorage 本地持久、杀进程不丢）、零新表、不引入跨设备一致性复杂度，用户明确接受不跨设备。**观修落点澄清**：研究三表分工确认 DR-111 早定观修=PracticeLog（零新表），所谓「DR-92 矩阵/meditationLag 写 LessonCompletion type=meditation」只是 DR-111 后未清理的旧引用（违背 DR-111），本决策一并清，LessonCompletion 去 meditation type；能力 3 闻思本不含观修（仅听/看/答题）。**表计数**：纯触发/口径变更 + 去一个 enum 值，零新表零删表，§一12/§三19/§四20 全不变。排除「自动检测降为辅助/预填」：用户明确否，纯手动更简、信任口径统一；排除「服务端进度表抗 kill」：localStorage 同设备已够、避免 §三+1 与跨设备一致性；排除「保留 type=meditation」：违背 DR-111 观修走 PracticeLog，是旧引用残留 | supersede DR-141/142；改 DR-92/DR-129/DR-127；关联 DR-111/DR-91/能力14/37/39 |
| DR-142 | 能力 39 音视频采集层——拍板：两种播放源同口径 + YouTube 走 IFrame API | **采集层设计**：① OSS 直链（type=audio/video）用 HTML5 `<audio>/<video>` 的 `timeupdate` 事件取 currentTime/duration；② YouTube 嵌入（type=youtube）用 **YouTube IFrame Player API**（`enablejsapi=1`），PLAYING 时轮询 `getCurrentTime()`/`getDuration()`，`onStateChange` ENDED 直接判达标（视同 100%）；③ **口径统一防刷量**：`playedSeconds`=累计实际播放秒（仅 PLAYING 累加，拖进度条到末尾不加秒）、`playedPercent`=最远观看位置/总时长——两源算出同口径两数写同一条 LessonCompletion，DR-141 阈值源无关，能力 3「听」COUNT 不受播放源影响；④ YouTube 墙内不可达即播不出→自然不达标、不特殊兜底（用户决策 2026-06-01）。**🔻后修订（DR-143，2026-06-01）：完成判定全面转纯手动，本采集口径不再判完成；playedSeconds/playedPercent 仅留 localStorage 续播位置用途**| 用户在 DR-141 定阈值后追问「视频两种模式（OSS 直链 vs YouTube 嵌入）怎么统计」——DR-141 只定了阈值数字，没定**两种源各自怎么采集进度数据**，是真实采集层缺口。**判断**：① iframe 内的 YouTube 播放前端无法用原生 media 事件监听，必须挂 IFrame Player API 才能拿到 currentTime/duration/状态——这是唯一可行的 YouTube 进度采集路径；② playedSeconds 用「累计实际播放」而非「最远位置」是为防拖进度条到末尾刷秒数（拖动不在 PLAYING 态、不累加），但 playedPercent 仍取最远位置（与看法本 scrollPercent furthest 同思路，覆盖率语义）——两者组合：覆盖率达 90% 或「实质听过≥60秒且过半」；③ ENDED 事件是 YouTube 最可靠的「看完」信号，直接判达标省去轮询临界判断。**排除**「都用最远位置」：拖到末尾即刷达标，视频比文本更易作弊；「分段去重覆盖率」：最严但前后端实现过重，看法本都未做、不破坏双端一致性收益不值。**遗留实现期**（非设计期开放决策）：(a) youtube 源面向谁/是否有 OSS 备份（墙内可达性）；(b) 是否持久化播放进度为表（断点续播/跨设备，类比 LessonReadingProgress）——阈值统计不依赖持久化，达标即 POST LessonCompletion，故不影响当前表计数 §三19 | DR-141 / DR-129 |
| DR-141 | 能力 39 音视频播放达标阈值——拍板：双轨 90% OR 60秒&50% | **音视频播放达标判定 `playedPercent ≥ 90% OR (playedSeconds ≥ 60 AND playedPercent ≥ 50%)`**，满足时写一条 LessonCompletion(type=audio/video)，供能力 3 闻思「听」维度 COUNT。双轨对齐看法本（能力 37：scrollPercent≥90 OR totalSeconds≥30&≥50%），保持双端完成判定同构（用户决策 2026-06-01）。**🔻后修订（DR-143，2026-06-01）：完成判定全面转纯手动，本阈值不再作完成判定，降为 localStorage 续播位置参考；防刷改交虚报治理+升学审核**| 清待决策项追加：TODO-25（音视频阈值）原挂「实现时按大纲定」，但属可在设计期拍板的产品数字，用户选择现在定。**判断**：① 与看法本双轨同构——单纯「百分比」对超长开示过苛（听满 90% 的整场录音不现实）、对短音频又太松，故保留「时长&过半」第二轨兜底；② 时长底线相对看法本 30 秒抬到 **60 秒**——音视频是连续媒体、信息密度高于滚动文本，60 秒更能代表「实质听过一段」；③ 第二轨要求 playedPercent≥50% 防短视频刷量（30 秒视频播 60 秒不可能，按比例≥50% 才算）。排除「单阈值 90%」：超长音频过苛；排除「统一碰 80%」：与看法本 90% 主轨不一致、且 80% 对长音频仍偏苛。**清待决策项方向真正收官**：设计期可拍板的待决策（TODO-SMS/能力44 critical/TODO-25）全清；§十残留 TODO-23/24 为实现期重构任务、TODO-5/20 为暂缓，均非设计期开放决策 |
| DR-140 | 能力 44 关怀/逾期类提醒是否算 critical——拍板：均非 critical | **关怀/逾期类定时提醒（①进度落后/②班级任务逾期/③个人任务逾期/⑧关怀名单更新）均非 critical 级**：尊重用户静默时段（quiet hours）+ 受每小时频率上限约束，不强制突破勿扰；站内信仍必达，只是不强推 push。**critical 强制送达（无视静默）仅限系统公告 severity=critical（能力 42）**；⑨上课迟到的关键触达靠推送+短信单独保障（DR-133/139），不依赖 critical 突破静默（用户决策 2026-06-01）| 「清待决策项」最后一条：能力 44 约束 4 挂的「关怀/逾期等是否 critical ⚠️ 待决策」。**判断**：critical 在能力 42 的定义是系统公告最高级、无视静默强制达；而关怀/逾期是**日常学修提醒、非紧急系统事件**，强制突破用户勿扰设置会造成骚扰、损害体验。站内信箱本就必达（能力 43），用户不开 app 也能看到，无需 push 强突静默。**保留例外**：⑨上课迟到时间窗口紧迫且直接关联升学出勤率，已单独定推送+短信双通道保障（DR-133/139），不走 critical 这条路径。排除「关怀名单也 critical」：辅导员收的关怀提醒虽重要但非分秒必争，日间正常推送足够；排除「逾期类 critical」：逾期是状态非紧急事件，隔日重提已够。**至此 TODO-SMS + 能力 44 critical 两簇待决策全部清空**，「清待决策项」方向收官 |
| DR-139 | TODO-SMS 4 项待决策全部拍板（能力 45 短信通道）| **(1) 服务商选型=先不锁定**：Provider 抽象层（sendSms 接口）留待实现时接，阿里云/腾讯云/国际皆可不被绑死；**(2) 短信开关=后台场景级**：admin 在后台对每种短信场景（critical 公告/⑦讲考/⑧升学/⑨迟到）分别设开关，**非**用户级单一 smsEnabled，机制随场景挂载（NotificationRule +smsEnabled / 公告 critical 配置），验证码不受影响；**(3) SmsLog=独立新表**（非复用 DispatchLog）：承载短信专有字段（脱敏号码/模板/provider/计费/状态回执/重试）+ 短信级幂等 dedupeKey，§三新建 18→19，新增 §3.16 + M3g；**(4) 验证码=标准档**：60s/条间隔、5 条/天上限、有效期 5 分钟（用户决策 2026-06-01）| 「清待决策项」方向下逐条核对 TODO-SMS。**服务商**：用户选「先不锁定」——抽象层设计不被服务商绑死，符合「设计先行、实现时定技术细节」。**开关**：用户选「后台设定、每种场景分别设开关」，区别于原设计草案的用户级 NotificationPreference.smsEnabled——改为 admin 后台场景级控制（更符合短信按条计费、需平台统一管控成本的特性；用户个人不应自行开启高成本通道）；故 NotificationPreference **不**加 smsEnabled，改挂场景配置。**SmsLog**：用户选「独立表」而非复用 DispatchLog——短信有计费/异步回执/重试等专有字段，独立表避免污染通用 DispatchLog；分工=DispatchLog 跨通道派发幂等、SmsLog 短信明细+对账+短信级幂等。**验证码**：标准档（60s/5 条天/5min），防刷与体验平衡。**表计数影响**：§三 18→19（+SmsLog），§一扩展 12 不变（User +phone 是字段扩展非新表），§四复用 20 不变。排除「复用 DispatchLog」：短信专有字段污染通用表；排除「用户级 smsEnabled」：高成本通道应平台管控非用户自启；排除「现在锁定服务商」：设计阶段无需绑死，抽象层足矣 |
| DR-138 | C 组收尾：举报闭环（能力 50）+ 用户反馈（能力 51）拆为两条独立；Feedback 净资产转正式能力 | **(1) 能力 50 内容举报闭环（QuestionReport 题目举报 + NoteReport 笔记举报，admin/辅导员处理）；(2) 能力 51 用户反馈（Feedback 表，bug/建议/其他统一一张表 kind 区分，支持匿名+自动采集复现信息+admin 回复）；(3) 举报与反馈拆为两条独立能力——业务面不同（举报=内容合规审核/反馈=产品 bug 建议）**（用户决策 2026-06-01）| 落 C6 举报闭环时用户问「增加问题反馈/bug 反馈是否存一张表还是单独设计」。**核查**：线上**早有 Feedback 表**（grep=1），且设计周到——kind（FeedbackKind：bug/建议/其他）已区分类型、支持匿名（userId 可空+contactEmail）、自动采集复现信息（page/userAgent/appVersion/sessionId 关联 sentry）、处理闭环（status/handledBy/response）；前端 HelpPage + 端点 /api/feedback、/api/me/feedback、/api/admin/feedback。**历史**：DR-118 把 Feedback 列「弱②」，DR-119 明确「由弱②提为明确保留」净资产，但**一直没登记成业务能力**（与举报闭环同属「有表有功能、06 未登记」孤儿）。**回答用户疑问**：bug/问题反馈**无需新建表**——线上已是一张统一 Feedback 表，kind 区分足矣。**拆条决策（用户「拆为两条独立」）**：举报闭环（能力 50）vs 用户反馈（能力 51）业务面不同——举报针对具体内容做合规审核（题目隐藏/笔记下架），反馈是产品 bug/建议（面向产品团队迭代），独立登记更清晰。**至此 DR-126 净资产补登记收官**：A 学习引擎 8（能力 32-39）+ B 运营内容 4（40-42、46）+ D 通知触达 4（42-45）+ C 账户通知（47-51，C1/C2 并入 43）= 能力 32-51。排除「bug 反馈单独建表」：线上 Feedback.kind 已区分，统一表更简洁、admin 一处理；排除「举报反馈合并一条」：合规审核与产品反馈业务面不同，合并混淆 |
| DR-137 | C5 设置：注销账户行为核对——符合 D18，无需改动 | **能力 49 注销账户（`DELETE /api/auth/me`）行为=软删 isActive=false + 清 email/passwordHash + 吊销全部 session + 30 天邮箱冷却。经核对**符合 D18**：isActive=false 不物理删行（D18 标准手段）+ 学修档案/历史事件永久保留（D18 核心）；清 email/passwordHash 是清登录凭证（非 D18 保护的档案数据），不违反**（用户决策 2026-06-01「注销不删除」+「确认是否符合新设计」）| 落 C5 设置（能力 49）时用户决策「注销不删除」，并要求「确认是否符合新设计」。**核查**：① 线上注销实现（routes.ts:329「软删除 isActive=false + 清 email/passwordHash」+ service.ts:37「30 天邮箱冷却」）；② D18 原文（决策档案 05:142「学员档案全数据保留」，核心是出勤/报数/成绩等历史事件归属容器不可物理删）；③ 新设计 isActive 字段已登记（08:42「false=停用」），全系统专业/课程/班级/场次停用均走 isActive=false 无 delete API。**判定**：D18 保护「档案与历史事件」（学修数据），email/passwordHash 是登录凭证非档案数据——清凭证 ≠ 删档案，**注销行为完全符合 D18，无需修改**。**先查文档再确认**（吸取 DR-133 教训）：D18 范围、isActive 设计登记、线上实现三者对齐。排除「改为不清凭证仅停用」：清凭证为隐私/防登录正当需求，且不违反 D18；排除「改为物理删除」：直接违反 D18 全数据保留 |
| DR-136 | C4 个人档案：新增 gender 字段（🆕）+ 厘清档案字段落差（设计已有 birthDate/city/phone 等，线上未暴露）| **能力 48 个人档案：(1) User +gender 字段（male/female/other/null，个人档案展示，暂无业务规则依赖）；(2) 厘清落差——用户要加「性别/生日/地区」，核查发现 birthDate（DR-70 已加，60 岁升学豁免唯一数据源）、city/phone/phoneRegion/realName/refugeStatus/practiceBackground 设计 §1.9 早已有，仅线上 ProfileEditPage 未暴露（只暴露 dharmaName/avatar/timezone）→ 🔧 待补暴露；唯 gender 设计真无 → 🆕 新增**（用户决策 2026-06-01）| 落 C4 个人档案（能力 48）时用户要求「加性别/生日/地区，因为要判断 60 岁豁免」并要求核对升学/毕业要求。**核查升学/毕业**：60 岁豁免（大纲§一(三)：第一次考试报名时年满 60 岁免考试要求）是**资格性非自动**，数据源是 **birthDate**（DR-70 已加 §1.9，AdvancementCheck line 1258 已写 `now()-birthDate≥60年→ageEligible`）；毕业要求走 cohortStatus 状态机 + 法王祈祷文补足 + 观修计入（DR-111）——**均不需要 gender**。**关键发现**：① birthDate/city/phone 等设计 §1.9 早有（用户以为要新加，实为线上未暴露）；② gender 设计 grep=0 真无；③ §1.9 User 档案字段（realName/phone/phoneRegion/city/refugeStatus/practiceBackground/birthDate）远多于线上 ProfileEdit 暴露的 3 个（dharmaName/avatar/timezone）——又一处「设计已定、线上未落」的落差。**处理**：gender 🆕 新增（无业务依赖，纯档案，明确标注「60 岁豁免靠 birthDate 非 gender」避免误解）；其余字段 🔧 标待补暴露到编辑页。**无新表**：User 字段扩展（gender 一字段）。排除「gender 作豁免依据」：豁免硬规则只认年龄（birthDate）；排除「birthDate 当新字段加」：DR-70 早已加，避免重复——体现先查文档再决策（吸取 DR-133 教训）|
| DR-135 | C3 账户体系：加 Google 登录（🆕）+ 改硬单设备登录（🔧）| **能力 47 账户体系两项变更：(1) 🆕 Google OAuth 登录——User +googleId/authProvider 字段，Google 邮箱视为已验证，首次登录自动建账户（同 email 则关联）；(2) 🔧 硬单设备登录——新设备登录时立即 revoke 该用户所有旧 AuthSession，旧设备需重登（强制一人一机），改造现状（仅 push 踢出 + 手动 revoke-others）**（用户决策 2026-06-01）| 落 C3 账户体系（能力 47）时用户要求「加 Google 登录 + 只允许登录一台设备」。**核查现状**：① Google/OAuth 线上 grep=0 完全未实现 → 🆕 新建（User 加 googleId/authProvider，Google 登录账户 passwordHash 可空，邮箱免验证）；② 单设备——线上**已部分实现**（push/service.ts:59「单设备登录」push 订阅踢出 + revoke-others 手动；DR-112 列为净资产），但**非硬强制**（旧设备登录态不一定立即失效）。用户「只允许一台」本意=硬单设备，故 🔧 改造：登录时自动 revoke 旧 AuthSession（复用现有 revokedAt 机制 + revoke-others 逻辑，移到登录流程自动触发）。**复用基建**：AuthSession.revokedAt 已有、revoke-others 逻辑已有——硬单设备是「把手动 revoke-others 改为登录时自动执行」，改动小。**无新表**：User 字段扩展（googleId/authProvider）。排除「软单设备（仅 push 踢出）」：用户明确「只允许一台」需登录态强制失效；排除「Google 登录建独立账户表」：复用 User + googleId 字段，同 email 关联避免重复账户。**实现注**（不在本轮改代码）：Google OAuth 需配 client_id/secret（挂实现期）；硬单设备改造注意 token 刷新链路同步失效 |
| DR-134 | 🔴 法会双表分叉厘清：统一到 DharmaAssembly（线上真表），废弃 Event/EventCount（旧设计幻影）；法会发愿带数量 + 进修学计数模块 | **(1) 法会统一用线上真表 DharmaAssembly，❌ 废弃 Event/EventCount 两张幻影表（DR-130 曾标「实为新建」，本轮改判废弃——不新建）；(2) 法会发愿复用 UserPracticeVow（context=event，eventId 改指 DharmaAssembly，原指 Event），带 targetCount=发愿数量；(3) 计数走 PracticeLog（统一修学计数模块），context=event 独立标识不混日常打卡总量/排行；(4) 法会页：参与人数=COUNT(DISTINCT userId)、发愿总数=SUM(targetCount)；(5) DharmaAssembly 补反向 vows UserPracticeVow[]**（用户决策 2026-06-01）| 写 B4 法会（能力 46）时用户要求「法会要有发愿按钮 + 发愿进学修记录 + 页面显示发愿总数与参与人数」，并追问「为什么两套表设计不一样、先查清再定」。**派 agent 全量溯源**得权威结论：**DharmaAssembly 与 Event/EventCount 是两个时代的产物，非一表两版**——Event/EventCount 是更早旧设计（BL_REVIEW/SCENARIO_SIMULATION）的「法会+发愿+计数」重结构，**线上从未建表**；DharmaAssembly 是后来实际落地的轻量信息展示（纯 CRUD+push，无发愿/计数）。**分叉根因**：审计（07-integration-plan）对照旧设计文档把 Event/EventCount 误标「✅ 复用直接搬」，从未 grep 验证，直到 DR-130 揪出。**关键证据**：① EventCount 旧设计自己 2026-05-27 已废弃（法会计数改线下上报，只留发愿+回向）；② grep Event/EventCount=0；③ 能力 15（传承）实际用 TransmissionRecord 非 Event，08「Event 服务能力15」是旧归类残留；④ 能力 27/46 都用 DharmaAssembly。**用户新逻辑**（比旧设计两版更优）：发愿带数量 → 并入统一修学计数模块计数（非旧设计 EventCount 独立流，也非 v2 砍掉计数）。**方案**：统一 DharmaAssembly + 废弃 Event/EventCount + 发愿复用 UserPracticeVow + 计数走 PracticeLog（独立标识）。**表计数**：§四 Event/EventCount 原标「实为新建」→ 废弃移除（-2）；DharmaAssembly 补登记为真实复用净资产（原漏登）；净额对设计新建无影响（两幻影本就不入线上、不入 migration）。**§1.7 同步改 4 处**：eventId 指向、event 关联类型、删 eventCounts、愿进度公式 + 统计公式。承接 DR-34（法会/日常计数区隔）：初衷保留，但实现从「独立 EventCount 表」改为「统一 PracticeLog + context 标识」。排除「保留 Event 重结构」：从未上线、旧设计已废计数、多一套幻影表需同步；排除「DharmaAssembly 加计数字段」：发愿/计数本是 UserPracticeVow+PracticeLog 职责，DharmaAssembly 保持展示纯粹性，加反向关联即可 |
| DR-133 | D2 补 ⑨ 上课迟到提醒（推送+短信）·复用 DR-89 签到窗口机制 | **能力 44 增第 9 条 triggerType `class-late`：签到 token 生成后接近 checkinGraceMinutes 窗口末仍未签到的本班成员 → 推送+短信催签。完全复用 DR-89（签到窗口=token.createdAt+checkinGraceMinutes，startAt 仅展示），零新字段/零新表**（用户决策 2026-06-01）| 用户要求「上课迟到要推送+短信提醒」，并指出**逻辑闭环**：升学条件要求出勤率（ProgramAdvancementConfig conditionKey=attendance），故每场必须记出勤。我初判「线上无签到/考勤机制，需新建考勤子系统」并两度发问迟到计时基准——**实为重复发问，违反 CLAUDE.md「以文档为准」**：用户纠正「之前讨论过，发出链接后才开始计算上课」。翻 **DR-89（TODO-2 闭合，2026-05-30）**确认：签到窗口早已定为 **token 生成时刻为基准 + Program.checkinGraceMinutes（默认 30min）**，startAt 仅展示不参与计算，且 DR-89 明确「排除加 actualStartAt 字段：token createdAt 天然承担此语义」。故迟到规则**无需任何新字段**：token 生成（辅导员发链接）→ checkinGrace 窗口 → 窗口内未签到的本班成员=迟到 → 推送+短信。闭环：升学卡出勤率→每场记出勤（StudyRecord）→窗口内未签到=迟到→催签→保出勤率→保升学。短信归类「关键学修提醒」（能力 45 用途规则 +1 行 class-late→✅发，直接关联升学出勤率）。**教训**：动「迟到/出勤」议题前应先 grep 决策日志（DR-89 关键词「签到窗口/token/checkinGrace」），避免重复已闭合讨论。排除「新建考勤子系统」：StudyRecord+DR-89 已是完整出勤机制；排除「加 checkInOpenedAt 字段」：DR-89 已用 token.createdAt 承担 |
| DR-131 | D2 定时通知规则集：8 条新提醒规则确立（用户提 4 + 补充 4，「全部补入」）；**后补（DR-133）：+⑨ class-late 上课迟到，共 9 条** | **能力 44 定时通知规则新增 8 条 triggerType：①progress-lag 进度落后 ②class-task-overdue 班级任务逾期 ③personal-task-overdue 个人任务逾期 ④rest-week 班级放假/休息周 ⑤lesson-incomplete 闻思未圆满 ⑥review-due 复习到期 ⑦exam-upcoming 讲考/考试临近 ⑧advancement-care-result 升学/关怀结果。复用 NotificationRule + cron + 能力 43 派发引擎，无新表（依赖各业务源表）**（用户决策 2026-05-31）；**⑨ class-late 上课迟到由 DR-133 补入（2026-06-01）** | 核查能力 43 EventKind 时，用户提出「学习进度落后/未完成班级任务/未完成个人任务/班级放假」要提醒，问「还有哪些需补充」。核查现状：线上 cron 仅 evening-due/daily-digest/weekly-report（个人提醒）+ class_session/practice_task（截止前）+ achievement 聚合——用户提的 4 个**线上均无**。补充 4 个同类「关怀/节律」提醒：⑤闻思未圆满（大纲硬规则，能力 3/39）、⑥复习到期（SM-2 不提醒则白做，能力 33）、⑦讲考/考试临近（能力 8/10 有日程）、⑧升学/关怀结果（能力 10/关怀）。用户决策「全部补入」（8 条）。**机制**：复用现有 NotificationRule（scope/triggerType/defaultHour/meta/isActive）+ cron 每分钟扫描 + DispatchLog 日期粒度幂等，每条加 triggerType + 判定逻辑，经能力 43 dispatchToUsers 派发——**无新表**。**收件人分流**：学员收 ①②③④⑤⑥⑦+⑧升学结果；辅导员收 ⑧关怀名单。**绝对约束**：幂等不轰炸（日期粒度去重）+ 达阈值才发（不空发）+ 收件人精确 + 受偏好/静默/频率上限约束。**待决策**：各规则是否 critical 级（无视静默）⚠️ 挂 TODO 待定。**依赖新建表**：⑧依赖 AdvancementRecord/CareWatchlistItem，①依赖 CohortLagSnapshot，④依赖 CohortRestWeek，⑦依赖 SpeakingSession/Exam——均 DR-130 确认的设计新建表，规则实现待这些表就位。排除「只做用户提的 4 个」：⑤⑥⑦⑧是已登记能力（3/33/8/10）的必要触达闭环，缺则那些能力做了不提醒等于半成品；排除「为提醒规则建独立表」：NotificationRule.meta 足够承载扩展参数，复用即可 |
| DR-130 | 🔴🔴 全量复用表存在性体检：DR-72 批量复用确认是对照旧设计文档（未验证线上 schema），逐表 grep 纠正（用户决策「一切按新设计、不改代码」）| **全量 grep 体检：08 标「复用/扩展」的表对照线上 60 表，揪出「线上无却标复用/扩展」的表，逐个改判 🆕 线上无·实为新建。本轮纠正 §一扩展区 5 表（Program/StudyRecord/SpeakingGrade·ExamGrade·Exam/CohortLagSnapshot/CohortRecommendedTemplate）+ §四复用区 12 表（ProgramSemester/ProgramStudyType/ProgramWeek/ProgramWeekCourse/ProgramWeekPractice/QuestionReference/SpeakingRegistration/SpeakingSession/Event/EventCount/CohortRestWeek/CohortWeeklySummary）**（用户决策 2026-05-31）| 连撞 5 个幻影表（DR-121 实修域、DR-123 PracticeTemplate、DR-129 LessonCompletion 等）后，用户两轮质疑「核查不全」，遂做**全量复用表存在性体检**——提取 08 所有标「复用/旧设计已有/扩展现有」的表名，逐一 `grep "^model X" backend/prisma/schema.prisma` 对照线上真实 60 表。**触目惊心的结论**：标「复用」的表里**真实存在仅 8 个**（Lesson/LessonMediaChapter/LessonResource/LessonTextBlock/Meditation/PracticeProject/LlmCallLog/LlmProviderUsage），**12 个幻影**（见上）；§一「扩展现有表」13 个里**真实仅 4 个**（User/Class/Course/ClassMember），其余 9 个线上无（含已处理的 UserPracticeVow/PracticeLog/DR-121~129，本轮再补 Program/StudyRecord/SpeakingGrade·ExamGrade·Exam/CohortLagSnapshot/CohortRecommendedTemplate 5 个）。**根因**：DR-72「C 类 15 张批量复用确认」是**对照旧设计文档打的勾，从未 grep 验证线上 schema**——这就是为什么 DR-121/123/129 一个个撞出幻影表。**本质认知**：线上目前是**轻量「法本学习+答题+打卡」App**（真实表=Class/ClassMember/ClassSession/ClassAnnouncement/Course/UserCourseEnrollment + 学习引擎表 Question/UserAnswer/Sm2Card/笔记/阅读/打卡/通知/LLM 网关），新设计 08 是**完整「佛学院学修管理系统」**——专业体系/讲考/升学/报数/关怀/传承/角色权限/周排课/法会等主体**线上全无，实为从零新建**。**处理（用户「一切按新设计、不改代码」）**：(1) 逐表改标签——线上无的标「🆕 线上无·实为新建（DR-130）」，§一 5 表标题 + §四 12 表状态列已逐个改；(2) **设计内容全部有效不动**——错的只是「现状标签」（以为线上有、实为新建），新设计要建什么/字段怎样都对；(3) 表计数维持设计口径（实现工作量远大于文档显示，但目标设计权威）。**修正 DR-72**：其「15 张批量复用」结论作废，以本条 grep 体检为线上现状权威；DR-72 历史保留（append-only），加指向本条的后修订注。**不动代码**：纯文档现状标签校正。排除「逐字重写每个表设计」：设计内容有效，只需改现状标签；排除「全量重写复用区分类」：标签逐个改 + 总纲 DR-130 钉死更稳，保留设计史。**这是第 4 轮、也是最彻底一轮的「08 误标复用、实为新建」纠正**——印证用户坚持核查的价值：复用区分类此前整体不可信，本轮 grep 体检建立可信基线 |
| DR-129 | 🔴 LessonCompletion 幻影表纠正 + 闻思「听音视频」分维度计数缺口补全（能力 39）| **LessonCompletion 此前 08 误标 §四「复用」，实为线上幻影表（grep=0），改判 🆕 §三新建（M3f）；补能力 39 音视频学习——LessonResource 播放达标写 LessonCompletion(type=audio/video) 分维度计数，支撑大纲盲(听≥2)/聋(看≥2)判定。两层结构：进度明细层（LessonReadingProgress 看 + MeditationSession 观修 + 音视频播放进度）+ 完成事件层（LessonCompletion 带 type）**（用户决策 2026-05-31「按我建议补全」）。**🔻后修订（DR-143，2026-06-01）：LessonCompletion type 收敛为 audio/video/read（去掉 meditation——观修完成走 PracticeLog 不写本表，DR-111）；听/看完成事件写入触发由自动达标改纯手动用户确认；过程明细层（LessonReadingProgress/音视频位置）降为续播用途**| 逐条核查时用户追问「音视频学习+计数」是否查过——核查挖出比能力 37 更严重的问题，同 DR-121 幻影表类：**(事实1)** `LessonCompletion`（新设计能力 3 闻思圆满判定核心表：听=COUNT(type audio/video)、看=COUNT(type read)、观修=COUNT(type meditation)）线上 grep=0 **不存在**，但 08 §四标「✅ 确认复用（DR-72）」——误判幻影表为复用；**(事实2)** 线上有音视频内容（`LessonResource` type=youtube/audio/video + url + `LessonMediaChapter` 章节时间戳），但**播放不记完成**——无任何"听/看完成事件"表；线上"课时完成"是粗粒度（UserCourseEnrollment.lessonsCompleted 数组，整课时标完成，不分听/看维度）；**(事实3)** 大纲明文硬规则要分维度：盲/文盲「听≥2遍」、聋「看≥2遍」、健全「听≥1+看≥1+答题」——必须能分别 COUNT 听/看遍数，线上粗粒度机制做不到。**下游依赖**：LessonCompletion 支撑 能力 3 闻思圆满 + 能力 14 掉队检测（contentLag/meditationLag，08 line 326/328）+ 能力 9 报数 + 能力 26 积分排行（阅读维度）——是闻思判定基石却是幻影表。**方案（用户认可「按我建议」）**：(1) LessonCompletion 改判 🆕 §三新建（带 type=audio/video/read/meditation，一行=一遍完成事件，供 COUNT）；(2) **两层结构**——过程明细层（看=LessonReadingProgress 心跳、观修=MeditationSession 播放、听音视频=新增播放进度）记滚动/播放进度，达标时各写一条 LessonCompletion 完成事件；(3) 补**能力 39 音视频学习**（LessonResource 播放 + 分维度听/看完成记录）；(4) 线上粗粒度 UCE.lessonsCompleted 数组 = 改造源（同 DR-127/TODO-24，机制统一到 LessonCompletion）。**表计数校准**：§三 17→18（+LessonCompletion，M3f）；§四 22→21（−LessonCompletion 移出）。**修正 DR-127 前提**：DR-127/TODO-24 原说"迁移到 LessonCompletion"，未意识到它是幻影表——前提修正为「LessonCompletion 须先新建（M3f），再做完成记录机制统一」。**同 DR-121 处理**：幻影表纠正为新建 + 线上现状（粗粒度完成/分散进度表）为改造源。排除「听音视频不单独计数（简化）」：大纲盲/聋判定硬性要求分维度 COUNT，简化则判定做不了；排除「维持 LessonCompletion 标复用」：grep=0 铁证不存在，复用标签是误判必须纠正 |
| DR-128 | 成就徽章定位：暂不作正式功能上线，只保留后台关键部分（能力 38 + 联动能力 30）| **能力 38 成就徽章本体 ⏸ 暂不作正式功能上线（只保留 BADGES 定义 + UserAchievementUnlock 表 + 派生/解锁逻辑后台运行）；联动能力 30 成就解锁通知聚合随之降为 ⏸（cron 后台保留，不作正式通知功能）**（用户决策 2026-05-31）| 逐条登记 A7 成就徽章时，用户决策「成就徽章暂时不做，只做后台关键部分」——同 DR-109 AI 模块「只做后台必要部分、不作正式用户功能上线」调子。**处理**：(1) 能力 38 打 ⏸ 标签，仅如实登记线上现状（5 类徽章 BadgeCategory、BADGES 代码常量定义、从 UserAnswer/SM-2/streak 派生、detectAndPersistNewUnlocks 解锁持久化），保留后台运行不扩展；(2) **联动能力 30**——成就解锁通知聚合是徽章解锁的下游通知，徽章本体既暂缓，其通知聚合也随之降 ⏸（DR-125 原登记 ✅ 纳入，本条修订为 ⏸）；cron 后台逻辑保留（解锁记录仍聚合标记 notifiedAt 避免堆积），但不作正式用户通知功能；徽章上线时即可恢复。**为何登记而非删除**：06 是 source of truth，线上活功能即便暂缓也须登记打 ⏸ 标签（功能标签铁律），避免净资产孤儿——同 25.C 笔记 AI 现状登记逻辑。**无表计数变化**：UserAchievementUnlock 净资产保留，无新表。排除「彻底删除徽章」：用户选「只做后台关键部分」非「去掉」，保留后台 + ⏸ 标签；排除「能力 30 维持 ✅」：徽章本体暂缓则解锁通知无正式功能意义，降 ⏸ 保持一致 |
| DR-127 | 完成记录机制冲突：线上课程级数组 vs 新设计 LessonCompletion 表（能力 37 核查挖出）| **改造时统一到 LessonCompletion：完成写入端（reading/meditations）+ 下游读取端（courses/enrollment/dossier/smart-practice）一并迁移；UserCourseEnrollment 完成数组随 DR-113 废弃。挂 TODO-24**（用户决策 2026-05-31）| 登记能力 37 法本阅读器时核查阅读完成写入路径，挖出与 DR-121 同类的「功能依赖将被改造掉的东西」问题，但更准确的是**机制冲突**：**(事实1)** 线上阅读完成（`reading/service.ts`）+ 观修完成（`meditations/student.service.ts` 视频≥80%）把 lessonId/medId 追加进 `UserCourseEnrollment.lessonsCompleted`/`meditationsCompleted` **数组**（课程级，@@unique([userId,courseId])）；**(事实2)** 新设计闻思圆满判定**走 `LessonCompletion` 表**（DR-92：看=COUNT(LessonCompletion type=read)），与课程级数组是**两套不同机制**；**(事实3)** UserCourseEnrollment 课程语义随 DR-113 废弃迁专业级。**下游依赖核查**（grep 全仓，6 处）：写端 reading/meditations 2 处；读端 courses（课程进度展示 done/total%）、enrollment（进度管理）、dossier（学情统计完成课时数）、smart-practice（"已学课时"抽题）4 处。**关键澄清**：新设计判定端（LessonCompletion）已是目标态、无需改；要改的是**写入端 + 读取端的对接**——这不是"幻影表"（DR-121 那种结构性大坑），而是"完成记录从课程级数组 → LessonCompletion 表"的**机制统一迁移**。**处理**：挂 TODO-24，改造 DR-113 时一并迁移写入/读取两端，确保阅读/观修完成接上新设计闻思圆满判定，否则改造后完成记录写废弃表 → 闻思圆满判定取不到数据 → 升学预检数据错。排除「现在就改写入/读取代码」：本轮是设计登记非实现，且牵动 DR-113 专业级进度结构设计，统一在 DR-113 实现时做；排除「保留课程级数组双写」：与新设计 LessonCompletion 单一数据源冲突、双写一致性难维护 |
| DR-126 | 第二轮功能级核查：净资产对应的用户功能补登记（接 DR-125，逐条进行）| **用户指出 DR-125 核查不全（藏历/画报/系统公告/通知推送等净资产功能未登记），完整差集核查找出 17 个孤儿，逐条讨论补登记为能力 32 起；首条能力 32 题库答题与判分已确认**（用户决策 2026-05-31，进行中）| DR-125 仅挖 6 个盲区，用户点名藏历/首页画报/通知推送/系统公告为何没列——核查确认：这些是**净资产对应的用户功能**，此前我把「净资产=表保留」误等同「功能已登记」，整层跳过，是方法性漏核。**完整差集**（76 前端页 × 已登记 31 能力）找出 **17 个有功能/有前端页、06 零能力登记**的孤儿：**A 组学习引擎 7**（题库答题/SM2 复习/错题本/收藏夹/笔记本体+高亮/法本阅读器+进度/成就徽章本体）、**B 组运营内容 4**（藏历/首页画报/系统公告/法会信息）、**C 组账户通知 6**（通知中心+偏好/Web 推送订阅/账户体系/个人档案/设置+隐私开关/内容举报闭环）。用户决策：**全部纳入，但每条逐个讨论确定**（符合「每条决策与我核对」工作风格）。**首条落地**：能力 32 题库答题与判分（A1）——14 题型（QuestionType 枚举，8 上线 + 6 v2 就位）、三类判分（客观程序判 / 开放 AI 判 / flip 自评）、答题反馈 correctText/wrongText、答错入错题本；服务能力 3，衔接能力 33/34/31，复用 LLM 网关（DR-108）。复用 Question/UserAnswer 净资产，无新表。**后续 16 条逐条确认中**。排除「批量一次性补」：用户明确逐条讨论；排除「不登记继续当净资产」：净资产=表保留 ≠ 功能登记，06 是 source of truth，活功能不登记是孤儿、违反功能标签铁律（这正是本轮要纠正的漏核根因）|
| DR-125 | 功能级反向核对：从线上前后端实现挖「线上有、新设计没正经体现」的用户功能/自动化规则，补登记能力 26-31 | **6 个盲区功能用户逐个确认全部纳入，补登记为能力 26-31（均 ✅ 线上已实现·纳入设计）**（用户决策 2026-05-31）：26 综合修学积分排行 / 27 综合活动列表 / 28 设备与会话管理 / 29 个人智能提醒 / 30 成就解锁通知聚合 / 31 辅导员 AI 出题与批量导入 | 接 DR-118~124（model+端点级核对）后，本轮下沉到**功能级**反向核对——从线上 `juexue-v2/`（159 文件 36k 行）+ `backend/`（166 文件 25k 行）实扫用户可见功能 + 端点之外的自动化规则（定时任务/中间件/service 自动逻辑），排除 DR-118~124 已处理项 + 净资产，挖出 6 个真盲区。**方法补记**：原派两 agent 后台扫，但 agent 卡住（输出文件 mtime 不动），改为**自己直接扫**（代码库仅 6 万行规模适中）。**6 个盲区**：(26) 综合修学积分排行——`ClassRankingPage` 综合/念诵/观修三 tab，综合 tab 积分制（念诵×0.01+观修完成×5+观修时长×0.1+答题×0.5+阅读×W+活跃天数×W，v2 admin 可配权重），06/08 此前 0 处提"积分/综合排行"；(27) 综合活动列表——`/api/my/upcoming-events` 聚合共修+法会+纪念日成统一活动流，聚合视图未登记；(28) 设备与会话管理——`DevicesPage` 会话列表+登出其他设备（AuthSession revoke 的用户界面）；(29) 个人智能提醒——cron 按时区三档（即将圆满/今日未打卡/默认时段），**关联实修域改造**（读 PracticeGoal/Task/DailySummary 三张已折叠/废弃表，须迁数据源→TODO-23）；(30) 成就解锁通知聚合——cron 5 分钟聚合未通知解锁合并推送；(31) 辅导员 AI 出题——LLM question_gen 生成题目+批量导入（复用 LLM 网关 DR-108，面向辅导员非学员，区别于 25.C 笔记 AI）。**落盘**：06 新增「能力 26-31：线上已实现功能补登记」整章（每条业务意图/规则/输入输出/约束/对老项目影响齐备，✅ 标签）；08 本 DR-125 + TODO-23（能力 29 数据源迁移）+ 检查轮次 70。**无表计数变化**：6 个能力全部复用现有表/净资产（StudyRanking 聚合查询、ClassSession/DharmaAssembly、AuthSession、Practice*+Notification、UserAchievementUnlock+Notification、Question+LLM 网关），无新表，§一12/§三17/§四22 不变。排除「不登记只当现状」：用户明确"找出来逐个确认后加入设计文档"，06 是 source of truth，线上活功能不登记会留孤儿、违反功能标签铁律；排除「合并进现有能力」：6 个各有独立业务意图（排行/活动/安全/提醒/通知/出题），独立登记更清晰、便于改造追溯 |
| DR-124 | 班级任务多周期支持：ClassTask 加 period（daily/weekly/fixed）（闭合 TODO-22）| **ClassTask 加 `period`（daily/weekly/fixed）+ dailyTarget/weeklyTarget/targetCount 三目标字段，dailyTarget 由必填改可空；达标率按 period 三口径算**（用户决策 2026-05-31，TODO-22 闭合）| TODO-22 暴露「ClassTask 纯每日制装不下线上 fixed 班级任务」，问用户时用户进一步指出**班级任务本就可能「以时间为单位」**——举例「每星期必须 3 座禅修」（weekly）、「每天 1000 遍观音心咒」（daily），加上期间累计型（fixed，如本月共 10 万遍）。故不止补 fixed，**补齐 daily/weekly/fixed 三周期**。**实现**：ClassTask 加 `period String @default("daily")` + `weeklyTarget Int?` + `targetCount Int?`，原 `dailyTarget Int` 改 `Int?`（按 period 配套，Zod 守）；period=fixed 时 endDate 必填（累计需明确区间）。**与 UserPracticeVow 对齐**：UserPracticeVow.targetPeriod 是 daily/weekly/lifetime，ClassTask 用 daily/weekly/**fixed**（班级任务有起止区间，用 fixed 而非 lifetime）。**达标率三口径**（CohortLagSnapshot.taskLag，能力 14）：daily=每日达标天数/有效天数、weekly=达标周数/有效周数、fixed=期间累计≥targetCount 即 100%。**承接线上**：PracticeTask mode=fixed → period=fixed（缺口闭合），并新增 weekly。配套更新 §3.14（字段表+prisma+约束+设计意图+映射表）、TODO-22 闭合。**无 migration 结构变化**：ClassTask 是 §三新建表（M3d），加字段即在建表 DDL 内，不需额外 ALTER。排除「只补 fixed 不补 weekly」：用户明确举了 weekly 例子（每周 3 座），只补 fixed 会再次漏掉时间单位型任务；排除「班级任务保持纯每日制、fixed 走个人发愿」：辅导员布置的「本月共修 N」是班级集体任务，塞进个人发愿语义错位 |
| DR-123 | 实修域改造细化落地：ClassTask←PracticeTask 字段映射 + Migration 清单 + 表计数校准 + PracticeTemplate 纠正（接 DR-122）| **(1) PracticeTemplate 纠正废弃→🆕改造新建**（承重表）；**(2) ClassTask←PracticeTask 按 scope 拆流映射**（class→ClassTask / self→UserPracticeVow）；**(3) fixed 班级任务缺口挂 TODO-22**；**(4) 表计数校准：§一 13→12、§三 15→17、§四 22 不变**；**(5) Migration：M1 含 PracticeLog=rename PracticeEntry+加列、新增 M1.5 改造源清理 + M3e 实修体系**（用户决策 2026-05-31，TODO-21 细化闭合）| 接 DR-122 实修 11 表归宿，本条落地细节并**纠正 DR-122 一处事实错误**。**(1) PracticeTemplate 纠正（用户拍板）**：DR-122 曾判「PracticeTemplate 废弃，职责被 CohortRecommendedTemplate 覆盖」——**错**。核查：CohortRecommendedTemplate.templateId **外键指向** PracticeTemplate（§1.8 line 616），DR-36 设计「任务目标运行时读 PracticeTemplate.defaultDailyTarget」，能力 1 课表层也依赖它——PracticeTemplate 是设计**承重表**（届推荐功课的模板定义），废弃会同时打断 CohortRecommendedTemplate 绑定 + D3 运行时读取。它确是幻影表（线上无），但设计需**新建**它，非废弃。改判 🆕 改造新建（§三）。**(2) ClassTask←PracticeTask 映射（task 1）**：线上 PracticeTask 按 scope 拆流——`class`→ ClassTask（mode/classId/ownerId/projectId/title/target/startAt/endAt 逐字段映射，见 §3.14 映射表），`self`→ UserPracticeVow（context=personal, isPledged=true，折叠 PracticeGoal）。两线语义本分属「班级任务」「个人发愿」，不强塞一表。**(3) fixed 缺口（TODO-22）**：ClassTask 纯每日制（仅 dailyTarget），线上 fixed（期间累计）班级任务无落点，用户决策挂 TODO-22 待定（需要则 ClassTask 加 period+targetCount）。**(4) 表计数校准（task 2）**：实修域改造前后——§一 扩展 13→**12**（UserPracticeVow 移出至 §三，PracticeLog 留本区因系 PracticeEntry rename+ALTER）；§三 新建 15→**17**（+UserPracticeVow +PracticeTemplate）；§四 复用 **22 不变**（−PracticeTemplate(→§三) −PracticeJournal(废弃) +PracticeCategory +PracticeMakeup，净 0）。**物理编号保留原位**（§1.7/§1.12 不迁移避免大幅重排），计数以本条口径为准——同 DR-110「5→4」只改计数不重排历史的惯例。**(5) Migration（task 2）**：M1 含 PracticeLog=rename PracticeEntry + 加 vowId/durationMinutes/meditationId/prayerCount/programId/taskSourceType + source 值域改（ALTER+RENAME）；新增 **M1.5** 改造源清理（PracticeGoal/PracticeTask/PracticeDailySummary 不入目标 schema，开发期无数据直接不建，DR-116）；新增 **M3e** 实修体系（UserPracticeVow + PracticeTemplate 新建）；11.3 覆盖核对 + §十二 P4 + 12.1 时序注同步更新。**双任务（用户「1和2」）全部落地**：task1=ClassTask 映射，task2=migration+计数。排除「PracticeTemplate 仍废弃+改造 CohortRecommendedTemplate 去 templateId」：改动更大且拆散模板复用机制；排除「物理迁移 §1.7/§1.12 章节」：130+ 行大段搬移风险高、引用众多，用计数口径声明 + 原位保留更稳（同 append-only 史惯例）|
| DR-122 | 实修模型改造细化方案：11 张实修表逐张定归宿（接 DR-121 定向「一切按新设计改造」）| **改造映射定稿（用户决策 2026-05-31，TODO-21 闭合）**：①保留纳入设计 3 张（PracticeCategory 大类字典 / PracticeProject 项目·真表复用 / PracticeMakeup 补签）；②改造新建 2 张（PracticeEntry→PracticeLog；新建 UserPracticeVow）；③折叠 2 项（PracticeGoal→UserPracticeVow.dailyTarget/weeklyTarget；修行心得→PracticeLog.note/Note）；④改造归并 1 张（PracticeTask→ClassTask §3.14）；⑤废弃 3 张（PracticeDailySummary 排行改实时算+缓存 / PracticeJournal / PracticeTemplate） | 接 DR-121 用户拍板「一切按新设计改造」，本条把实修域 11 张表（线上 7 真实 + 设计 4 幻影）逐张定归宿，闭合 TODO-21。**机械改判（DR-121 已定向、字段已决）**：(a) **PracticeCategory**（持咒/礼拜/诵经/供曼扎/观修 5 大类字典）→ 保留·明确纳入设计（PracticeProject 依赖它，真表）；(b) **PracticeProject**（修持项目 user/class scope）→ §四复用（真表，合法存在）；(c) **PracticeEntry**（线上纯计数 count+tap/shake/bulk+note）→ **改造为 PracticeLog**：加 vowId/durationMinutes/prayerCount/programId/taskSourceType，source 值域 tap/shake/bulk→manual/auto/ai_assistant（新设计目标语义）；(d) **PracticeGoal**（每日目标）→ **折叠进 UserPracticeVow**（vow 已有 dailyTarget/weeklyTarget），废表；(e) **PracticeTask**（任务 daily/fixed）→ **改造归并 ClassTask**（§3.14 班级任务体系）；(f) **UserPracticeVow / PracticeLog** → §三新建（改造新建，非复用/扩展现有，承载 DR-91/94/95/120 已决字段）。**用户拍板 4 个 TODO-21 歧义点（2026-05-31）**：(Q1 排行) PracticeDailySummary 日聚合表 **废**，班级观修排行从 PracticeLog **实时算+缓存**（CLAUDE.md 已有 5 分钟 in-memory cache 模式）；(Q2 补签) PracticeMakeup **保留**补签功能（7 天内每周 1 次）纳入新设计作正式功能；(Q3 心得) PracticeJournal **不独立建表**，修行心得**折叠进 PracticeLog.note**（打卡顺带）或复用 Note 表；(Q4 模板) PracticeTemplate 查清=无字段定义/无代码/职责被 CohortRecommendedTemplate（届推荐功课）+PracticeProject（项目字典）完全覆盖→**废弃**，不进新设计。**结论**：实修域改造蓝图清晰——3 保留 + 2 改造新建 + 2 折叠 + 1 归并 + 3 废弃 = 11 张全部有归宿。配套需更新 §1.7（UserPracticeVow 复用→改造新建+折叠 Goal）、§1.12（PracticeLog 同+source 值域+note 承载心得）、§四（废 PracticeTemplate/Journal/Goal/DailySummary，补 PracticeCategory/Makeup 保留）、TODO-21 闭合。排除「保留 PracticeDailySummary 排行表」：用户选实时算，少一张聚合表、避免双写一致性；排除「PracticeJournal 独立表」：心得轻量，打卡顺带 note 足够，不值单表；排除「PracticeTemplate 保留」：无独立职责，纯冗余幻影 |
| DR-121 | 🔴 实修域数据模型「设计 vs 线上现状」根本落差的定性与定向（理清 PracticeEntry↔PracticeLog 命名时挖出）| **一切按新设计做：设计的 vow/时长制实修模型是改造目标，线上计数打卡器是改造源；观修计入升学（DR-111 成立）**（用户决策 2026-05-31）。**纠正此前 DR-91/94/95/111/120 及 §1.7/§1.12/§四 的「复用旧设计/✅封板复用/零新表」标签——这些实修表实为改造新建，非线上现成可复用** | 理清命名待办（DR-118）时三重核查（schema + 后端源码 grep + 审计 01）挖出根本落差，远超「命名待理清」：**(事实1)** `UserPracticeVow`/`PracticeLog`/`PracticeTemplate`/`PracticeJournal` 是**幻影表**——全仓代码（.ts/.tsx/.prisma）0 处，仅存在于设计文档；后端实际只有 7 张 `prisma.practiceX`（Category/Project/**Entry**/DailySummary/Goal/Makeup/Task）。**(事实2)** 线上实修=**纯计数打卡器**：PracticeEntry 字段 `{count, source:'tap'|'shake'|'bulk', note}`（点/摇/批量录入数数），**无** durationMinutes/meditationId/vowId/prayerCount——设计假设的座时长/发愿/祈祷文字段一个都没有。**(事实3)** 「观修不做计数」是线上既定决策（Meditation 表注释明文「用户决定观修不做计数·学修不含观修大类·旧字段 practiceProjectId/practiceCount 已移除」，审计 01 line 84 记录），DR-111 反转了它。**诊断**：设计做实修域时参照的是某份**旧 schema 快照**（含 vow/时长制 PracticeLog），但线上后端后来被重构成计数打卡器并砍观修计数，设计没跟上重构、继承了幻影表，于是把「待建的改造目标」误标成「复用现有」。**用户拍板（2026-05-31）**：「设计是对目前项目的改版，一切按新设计做，目前项目改造成新设计的方案」+「观修计入升学随此一起定」。**定向结论**：(1) 设计 vow/时长制实修模型 = **改造目标**，权威；(2) 线上计数打卡器 7 表 = **改造源**，按新设计重构（非原封保留的净资产，撤销 DR-118 把簇A 5 表「归净资产暂不深入」的临时定性）；(3) 观修计入升学成立（DR-111 方向保留），但其「零新表·走 PracticeLog/UserPracticeVow」表述纠正为「改造新建这些表」；(4) DR-95 prayerCount / DR-94 isSubstituted / DR-91 currentSessionMinutes / DR-120 programId+taskSourceType 所加字段全部有效，但承载它们的 PracticeLog/UserPracticeVow 是**改造新建表**（非「扩展现有」），§一「扩展区」对这两张的归类在实现时按新建处理；(5) §四「PracticeTemplate/PracticeJournal 复用」纠正为改造新建；(6) DR-120 提到的 source 值域 manual/auto/ai_assistant 是**新设计目标语义**（替换线上 tap/shake/bulk），成立。**遗留待办（登记 TODO-21）**：线上打卡器的配套能力（补签 PracticeMakeup / 日聚合排行 PracticeDailySummary / 每日目标 PracticeGoal / 大类字典 PracticeCategory）在新设计实修模型里**尚无显式等价物**，改造细化时须确认这些功能去留，勿在「改造」名义下静默丢失。**影响范围**：03 §5 簇A 定性、03 §9 迁移难度「打卡🟢易」、04 命名 note 均需对齐本条（见配套编辑）。排除「线上打卡器为准·设计返工」：用户明确一切按新设计；排除「继续当命名问题轻描淡写」：字段缺失+幻影表+观修计数反转远超改名，必须定性留痕防实现期踩雷 |
| DR-120 | 正向完整性核对：25 能力 → 是否都有表/字段支撑（反向核对的另半，补「双向覆盖」）| **核对结论：❌ 硬缺口=0（主体表全就位）；8 个 ⚠️ 字段级缺口，处置：G1 User 加 primaryProgramId；G4 PracticeLog 加 programId；G6 PracticeLog 加 taskSourceType + 明确 source 值域；G2 14届转入走能力5代行（无新字段，TODO-19 闭合）；G3 仪轨合规挂待办（TODO-20）；G5/G7/G8 不动（应用层/已登记 TODO-5/TODO-AI-2）**（用户决策 2026-05-31）| 接 DR-118/119 反向核对,补做正向另半（此前 §十三仅做 23 职能×写表，能力级字段支撑未系统核）。派 agent 对 25 能力逐条核对「业务规则/绝对约束/输入输出」是否都有表+字段接住。**结论**：主体表 100% 就位,**无任何「能力声称要做、08 完全没表」的硬缺口（❌=0）**；14 条 ✅ 完整、5 条 ⚠️ 部分（能力2/3/6/7/9）、6 条 ⏸ 暂缓（设计齐备）。**8 个 ⚠️ 字段缺口逐项处置（用户拍板）**：(G1 能力2) 主修专业只有主班 isPrimary 语义错位 → User 加 `primaryProgramId String?`（区别于主班，Program 补反向 primaryUsers）;(G4 能力6) 跨专业累计共享「通过A专业达成」无追溯字段（D14a）→ PracticeLog 加 `programId String?`（升学预检按此聚合溯源，Program 补反向 practiceLogs）;(G6 能力9) 任务来源/录入方式 06 明列要扩展 08 未落 → PracticeLog 加 `taskSourceType`（course/class_task/self）+ 明确既有 `source` 值域（manual/auto/ai_assistant），两维度正交,承载绝对约束1;(G2 能力3) 14届转入「重修/直接报圆满」无落点 → **走能力5代行**（直接报圆满=管理员代行标完成写 LessonCompletion+AuditLog proxy_action 留痕;重修=正常重学），复用既有表无新字段,TODO-19 闭合;(G3 能力6) 仪轨合规标志必填无字段 → 用户决策**挂待办暂不加**(TODO-20),留内加行实现时定;(G5 能力7 路径选择) 偏应用层判定逻辑,不强制落字段;(G7 能力21 Program.selfStudy 反向/G8 能力25.B 字段) 已是登记在案待办 TODO-5/TODO-AI-2,不重复处理。**无表数量变化**:G1/G4/G6 均给已在扩展区的 User/PracticeLog 加字段,不新增表;G2 复用既有表;故 §一 扩展区仍 13 张,无计数churn。**双向覆盖闭环**:反向(DR-118/119 从表/端点找盲区)+正向(本条从能力找字段缺口)合起来,设计完整性首次双向核对完毕。排除「G2 给 LessonCompletion 加转入标记字段」:会把 LessonCompletion 从复用区推入扩展区、增加计数维护,而转入报圆满本质是 admin/导入动作,走代行留痕(AuditLog)足够追溯,与既有代行模式一致更轻 |
| DR-119 | 反向核对 ④三不管功能的逐项去留（接 DR-118）| **埋点/AB实验保留；ClassAnnouncement 保留·与能力22并存；Dossier 归入新设计学员档案改造（③冲突类）；其余运维/辅助设施一律保留防误删**（用户决策 2026-05-31）| 接 DR-118 反向核对,对簇B 9 张 + ClassAnnouncement + 端点侧 5 类 + Feedback 逐项定去留。**三个歧义点用户拍板**：(1) **埋点+A/B实验**（AnalyticsEvent/Experiment/ExperimentExposure/admin分析看板）=运营增长功能,用户决策**保留**(进净资产「平台/运维设施」),非学修硬规则但对产品迭代有用,不删;(2) **ClassAnnouncement**(班级单向公告)与能力22班级动态(双向社交)语义重叠,用户决策**保留·与能力22并存**——公告(辅导员单向通知)与动态(双向互动)是两回事,不并入,ClassAnnouncement 独立保留(进净资产「学习辅助/班级」);(3) **Dossier**(线上4维学情统计+班级dashboard+CSV)用户决策**归入新设计学员档案改造**——不当净资产原封保留,而是按能力5/9/10重建学员档案时纳入(改判③冲突/改造,进 03 §4)。**默认保留项**（用户未单独质疑,按基础设施默认保留进净资产）：ErrorLog/SystemSetting/OrphanedFile/DeletedEmail/ContentSeed/ContentRelease(运维)、Search/data-export/Health/onboarding(辅助)、Feedback(由弱②提为明确保留)。**落盘**：03 §5 净资产补「平台/运维设施」「学习辅助/班级」两组;Dossier 进 03 §4 改造表。**至此反向核对 ④三不管 15 张 model + 端点侧盲区全部有归属**:簇A→净资产暂不深入(DR-118)、簇B+端点→本条逐项定(保留为主,Dossier 改造)。排除「埋点/AB实验删除」：对产品迭代有价值,删除不可逆;排除「ClassAnnouncement 并入能力22」：单向公告≠双向社交,合并会混淆两种班级沟通语义;排除「Dossier 原封保留」：线上聚合口径未按新角色/专业体系,需随档案重建,原封保留会与新档案口径打架 |
| DR-118 | 反向全覆盖核对：从线上 60 model + 139 端点出发找"项目有·新设计没沟通过"的功能 | **核对出 15 张 ④三不管 model + 端点侧 5 类盲区；数字校准 60 model/19 enum（非 61/23）；簇A 5 张打卡配套表先归净资产·暂不深入（命名 PracticeEntry↔PracticeLog 待理清）；簇B 9 张运维表 + 端点侧逐项待决**（用户决策 2026-05-31）| 用户质疑"很多功能没在新设计体现(如通知推送)",指出此前只做正向覆盖(以 25 能力为骨架对照审计),从未做反向覆盖(从线上每张表/端点出发查归属)。本条派两 agent 穷尽核对 60 model + 26 端点模块。**结论分四标签**：①已映射 15、②净资产保留 27、③冲突改造 3(UserCourseEnrollment/AuditLog/MeditationSession)、④三不管 15。**两簇系统性盲区**：簇A=修持打卡配套 5 张(PracticeCategory/PracticeDailySummary/PracticeMakeup/PracticeGoal/PracticeTask)——新设计大改打坐报数(DR-91/111)却整簇遗漏,且线上真实表名 PracticeEntry 与设计用名 PracticeLog 对不上;簇B=平台/运维设施 9 张(AnalyticsEvent/ErrorLog/SystemSetting/ContentSeed/ContentRelease/Experiment/ExperimentExposure/OrphanedFile/DeletedEmail)+ ClassAnnouncement 班级公告——连净资产清单都没收录。端点侧另有 Search/Dossier/data-export/Health/onboarding 5 类三不管 + Feedback 弱②。**数字校准**:`grep -c "^model"`=60(此前 04 文档误记 61、enum 23 实为 19,已修正,与审计 01 的 60/19 一致)。**本轮处置(用户决策)**:(1) 簇A 5 张先归 03 §5 净资产「修学打卡配套」分组,标"暂不深入",命名理清挂待办,留待打坐报数实现时一并处理;(2) 簇B 9 张 + 端点侧 5 类 + Feedback 逐项待用户决策(本条仅留痕,不预判);(3) 通知/推送澄清:本就在净资产②,非盲区,但"无能力编号"问题真实(转正式能力与否待簇全部核完再定)。**方法论补记**:此前 #1-#9 修订是正向覆盖,本条补反向覆盖;正向另半"25 能力→是否都有表/字段支撑"(08 §十三仅做 23 职能×写表,能力级未系统过)登记为后续可做项。排除"出独立反向核对文档":用户要求直接更新现有文档(03/04/08),不新增文档 |
| DR-117 | 权限改造统一点：散落角色判断收敛到哪 | **三个集中入口：`auth.ts` requireRole 工厂（改内核，调用点签名不变）+ 新建 `permissions.ts`（ROLE_LEVEL 等级继承 + canDo 作用域交集 + assignments 查库缓存）+ `class/service.ts` 断言（2 处）；校准 requireRole 实测 44 处（非审计 265）**（用户决策 2026-05-31，审计 02 §五 #9）| 审计 02 §一定方向「auth.ts + permissions.ts 为集中改造入口」，本条钉死落点。现状核实：`permissions.ts` 不存在（待建）；`auth.ts` 导出 6 函数，requireRole 工厂（line 62）比对 `payload.role` 单值；班级断言 `assertIsCoachOfClass`/`assertMemberOfClass` 在 `class/service.ts:853/866`。**三个集中入口**：(1) **auth.ts requireRole 工厂**——内核由「比对 payload.role 单值」改为「查 assignments(DR-114) → permissions.ts 等级判定」，**44 处调用点签名尽量不变**（改工厂内部，多数调用零改动）；(2) **permissions.ts（新建）**——`ROLE_LEVEL`(class_tutor1/class_admin2/subject_admin3/super_admin99，D7)+ `canDo(user,permission,scope)` 继承+作用域交集(02 §二)+ assignments 查库 + 短 TTL 缓存(DR-114)+ 缓存失效；(3) **class/service.ts 断言(2 处)**——assertIsCoachOfClass 改用 permissions.ts 作用域判定(class_tutor/class_admin 分级 + classId 交集)。**逐点改造(非集中)**：16 处 admin 全局 bypass 重表达为 super_admin 等级 + coach→class_tutor 语义点。**分阶段**：①建 permissions.ts 地基 → ②切 requireRole/断言内核 → ③逐点改 bypass + 测试。**数字校准**：审计 02 记 requireRole「265 处」，本会话实测 `grep -rn "requireRole(" backend/src` = **44 处**（265 疑早期 agent 估算偏大或含其他口径）；以 44 为准，审计 02/03/runbook 数字加注修正。排除「散点逐处改不建 permissions.ts」：265/44 处分散维护权限逻辑必致遗漏与不一致，集中库是唯一可控点 |
| DR-116 | 项目阶段澄清：开发中·无客户·无生产数据 → 迁移/过渡类内容重新定位 | **本项目处于开发阶段，无真实客户、无生产数据库；"数据迁移"不成立，改造=直接按目标设计建/演进 schema。DR-113/114/115 的「存量迁移/过渡期/token 重登/归类硬门槛」部分标注 N.A.（开发期不适用，保留备未来生产数据）；其「目标角色映射/JWT 架构/Program 归属约束」部分仍有效**（用户决策 2026-05-31）| 与 07-integration-plan 开头「本项目无生产数据库、是文档融合非数据迁移」一致；前序 #6/#8 顺审计「迁移」框架写实了过渡期内容，本条统一重新定位。**逐条重定位**：(1) **DR-113**——`coach→class_tutor`/`admin→super_admin`/`enrollment 专业级` 作为**目标角色与结构设定**仍有效（开发期直接用新 4 角色 seed）；❌ N.A.：存量迁移脚本、过渡期补任命、token 全失效重登（无存量 coach/admin/报名）。(2) **DR-114**——JWT 方案 B（token 只留 sub/sid + 查库 + 短 TTL 缓存）**架构决策有效**；❌ N.A.：已签发 token 全失效需重登（无线上用户）。(3) **DR-115**——「每个班必须归属 Program(code+cohortYear)」降级为**设计约束**（建数据时即满足，应用层禁止无 programId 的班）；❌ N.A.：存量班级人工归类、阻断式迁移硬门槛（无存量班）。**文档影响**：runbook §三「数据迁移」+ 03 §9「迁移路径」整章标 ⏸「开发期不适用，备未来生产数据」横幅，不删除（保留供未来若上线有数据时参考）。**#9 不受影响**：权限改造统一点是纯架构，与数据无关。排除「直接删除迁移类内容」：未来若进入有真实用户的运营期仍可能需要，标 N.A. 保留比删除更稳；排除「迁移内容当作仍生效」：开发期无数据，过渡期/重登/归类硬门槛是无的放矢，会误导实施 |
| DR-115 | 专业×届映射规则：现有班级如何归入 Program（最大卡点 #8）| **专业 code + 届 cohortYear 全部运营逐班人工填；无占位专业；未归类班级不能上线（阻断式硬门槛）**（用户决策 2026-05-31，审计 02 §五 #8）| 现状（审计 02 §三）：Class 仅 `name`(自由文本)/`courseId`/`createdAt`，**无专业×届结构化维度**，迁移无法自动判断班属哪专业哪届——审计判 🔴 最大卡点。Program 需 `code`(专业类型)+`cohortYear`(届年份)+`stage`，`@@unique([code, cohortYear])`。**三项决策**：(1) **专业 code 运营逐班人工填**——不按 courseId/班名自动推断（班名是自由文本、一法本可属多专业，推断不可靠），班名/courseId 仅作人工参考；(2) **届 cohortYear 全部人工填**——不用 createdAt 年份预填（创建年≠开班届，且预填易被误信跳过核对）；(3) **无占位专业 + 未归类不能上线（硬门槛）**——不建 unassigned 占位 Program，所有存量 Class 必须先补齐 programId 才能完成迁移上线。**硬门槛定位**：这是 P1 地基→P2 上线之间的**阻断式前置闸门**——运营把每个存量 Class 定 code+cohortYear → 建对应 Program → 回填 programId，全部完成才放行迁移。**连带**：DR-113 enrollment 迁专业级、DR-114 作用域均依赖本步先完成，硬门槛保证它们不拿到空 programId。runbook 迁移第 2 步由「人工补（卡点）」升级为「阻断式闸门 + 完成度检查清单」。**实现影响（不在本轮改代码）**：迁移脚本须校验「无 programId=null 的存量 Class」方可放行；运营需「班级→code+cohortYear」全量映射台账。排除「按 courseId/班名自动推断 code」：班名自由文本、法本↔专业非一对一，自动推断错误率高且静默；排除「createdAt 预填 cohortYear」：创建年≠开班届，预填诱导跳过核对；排除「建 unassigned 占位专业」：占位班的升学/报数/作用域语义模糊，且会让「迁移未完成」状态被掩盖，硬门槛更干净、强制运营一次归类到位 |
| DR-114 | JWT 结构修订：单 role 如何承载「一人多角色+作用域」| **方案 B：JWT 只留 sub/sid，权限每请求从 DB 查 UserRoleAssignment（短 TTL 内存缓存补性能）；角色变更/撤销即时生效**（用户决策 2026-05-31，审计 02 §五 #7）| 现状（审计 02 §一）：JWT payload `{sub, role?(单值), aud, sid, exp}`，role 烤进 token，265 处 requireRole 全靠 `payload.role` 同步零查库判定。新设计需「一人多角色 + 每角色作用域(class_id/major_id)」，单值 role 装不下。**方案 B（选定）**：token 去掉 role、只留 sub + sid（aud/exp 不变）；登录时不烤角色，鉴权时由 permissions.ts 按 sub 查 UserRoleAssignment（+ 短 TTL 内存缓存补每请求查库开销）。**选 B 理由**：(1) 学修体系要求角色变更/撤销**即时生效**（D17 代行、撤销资格职能#14、任命/失效 02§六 expires_at），方案 A「等 token 过期才生效」不可接受；(2) 线上已有 `sid → AuthSession` 每请求查库机制（jwtOptional 钩子），加查 assignments 有现成入口、改动小；(3) 作用域数量可能多，烤进 token 致膨胀。**代价**：每请求多一次查库/缓存（用登录预载 + 短 TTL 缓存补偿）。**实现影响（不在本轮改代码）**：(a) token 签发去 role；(b) requireRole 工厂改为查 assignments + 等级判定（permissions.ts，连 #9）；(c) 已签发 token 全失效需全员重登（连 DR-113 迁移）；(d) 缓存失效策略：角色写操作后清该用户缓存。排除「方案 A token 内嵌 assignments」：改角色要等过期才生效、撤销难、token 膨胀，与即时生效冲突；排除「方案 C 混合(内嵌+version)」：兼顾性能与即时撤销但实现最复杂，当前规模 B+缓存已够，不引入 version 机制复杂度 |
| DR-113 | 现状角色/报名迁移映射的具体规则 | **coach→仅 class_tutor（人工补 class_admin）；admin→全部 super_admin 后人工降级 subject_admin；UserCourseEnrollment 彻底迁专业级（废课程语义）**（用户决策 2026-05-31，审计 02 §五 #6）| 审计 02 §三给出角色/报名迁移方向，本条定具体规则。三项决策：(1) **coach → 仅 class_tutor**（scope=classId）——推翻 02 文档原「coach→tutor+admin 双角色自动迁移」，改为只给教学角色，**class_admin 行政权由 subject_admin 逐个手动补任命**（最小权限原则）。代价=过渡期辅导员暂无报数审核(职能#2)/邀请码(#5)/关怀(#3)/共修管理(#4)等行政操作，须补任命后恢复（线上 coach 现可做这些，是一次有意的权限收紧，用户接受过渡期）。(2) **admin → 全部 super_admin 后人工降级**——迁移脚本先全升 super_admin，再人工 review 把学科级管理者降 subject_admin。代价=降级前窗口期所有原 admin 为全局最高权限（用户接受，须尽快 review）。(3) **报名 UserCourseEnrollment 彻底迁专业级**——非「保留课程级+派生」（审计原建议 🟡），而是 🔴 彻底迁走：课程级进度数据（completedLessons/source/enrolledViaClassId 等）迁入新专业级结构，课程级报名语义废弃。**实现影响（不在本轮改代码）**：迁移脚本须含 coach→class_tutor、admin→super_admin、enrollment 进度数据迁移三段；需备补任命名单 + token 全失效全员重登（连 #7）。同步更新 02 §七迁移表 + 03 §9 + runbook。排除「coach→tutor+admin 双角色」（02 原方案）：自动给行政权违反最小权限，宁可人工补；排除「admin 选择性迁移」：脚本无法判断哪个 admin 该降，统一升后人工降更安全可控；排除「enrollment 保留课程级+派生」（审计 🟡 建议）：用户要彻底迁走，避免两层并存的语义混淆 |
| DR-112 | 净资产纳入交付文档 + 实现状态标签体系 + 整套配套文档 | **线上净资产正式纳入设计（改造须保留复用）；确立五类实现状态标签（✅保留/🔧需改/🆕待建/⏸暂不上线/❌去掉）；建独立修改方案 + 全套配套文档**（用户决策 2026-05-31，审计 01 §九 #5）| 用户要求「无论功能是否已实现都进设计，标清未实现/需改/去掉/暂不上线」+「要独立修改方案文档 + 其余配套文档」。处理：(1) **净资产纳入**——线上已有、不在 1-25 能力内的成熟功能（题库 14 题型+SM2/错题/收藏、成就/藏历/法会信息/画报/系统公告、通知体系 v2、LLM 网关、邮箱验证/密码重置/单设备登录/举报闭环、笔记+高亮/阅读进度、观修视频引导）正式登记为 ✅ 保留复用，改造不得误删；(2) **五类实现状态标签**确立为全套文档通用图例；(3) **新建独立文档**：`audit/03-modification-plan`（修改方案，现状→设计动作清单）、`00-INDEX`（总索引）、`audit/04-data-model-overview`（61 model 数据模型总图）、`audit/05-api-endpoints`（139 端点清单）、`glossary`（术语表）、`acceptance-checklist`（验收清单）、`deploy-migration-runbook`（部署迁移）。**文档定位厘清**：最终设计=06/08/02/05，现状=audit 01/02，改造方案=audit 03，互为索引。**本条不新建业务表、不改表计数**——纯文档体系决策。排除「净资产只在审计里提、不进设计」：用户明确要「都进设计」，审计是现状记录、设计是 source of truth，净资产须在设计侧有保留标签防改造遗漏。排除「用审计 01/02 充当修改方案」：用户明确要独立修改方案文档 |
| DR-111 | 观修语义冲突：线上 Meditation 看视频 vs 能力 4 打坐统计，是否并存 | **并存 + 观修计入升学（手动提交、不自动记录，数据按 DR-91 走 PracticeLog/UserPracticeVow）**（用户决策 2026-05-31，审计 01 §五/§九 #4）| 现状冲突：线上 Meditation = 看引导视频（schema 注释「观修不做计数」，MeditationSession 记看视频进度 + 完成次数/秒数排行），能力 4 = 92 修法打坐座数/时长统计（升学硬条件）。用户决策：(1) **并存**——视频/PPT 观修页面保留为引导内容（净资产），MeditationSession 看视频进度 + 完成排行不动；(2) **观修计入升学**（关系毕业）——线上旧「观修不做计数」修订为按能力 4 计入升学统计；(3) **手动提交、不自动记录**——学员实修后点页面现有「完成观修」按钮提交这一座时间，看视频 80% 不再自动算一座；(4) **数据落点按 DR-91**——「完成观修」按钮所在 Meditation 页面天然带 `meditationId`，提交时间即写一条 `PracticeLog`{meditationId, durationMinutes} 座记录，`UserPracticeVow` 聚合（currentSessionCount 座数 + currentSessionMinutes 时长）；AdvancementCheck 按 meditationId 分组判 92 修法逐法达标（DR-98）。故观修页面既是引导内容、又是座录入入口，模型自洽、**零新表**；(5) **约束按 DR-91**——单座 ≥30 分钟才记一座，座数 + 时长双维度独立计，废弃短座合并（比大纲严格）；(6) **两套各管各的**——看视频排行（MeditationSession count/totalSec，活跃度）与打坐报数（PracticeLog 座/分钟，升学）口径独立、不强行统一。**顺带对齐 06↔08**：06 能力 4 原「输出 observation_record / 新增 observation_records 表」改走 PracticeLog（消孤儿表名，与 DR-91 一致）；06 业务规则 4「短座可合并」改「不合并」（与 DR-91 一致，原为大纲旧表述）。**实现影响（不在本轮改代码）**：「完成观修」按钮需从「标记 isCompleted」扩展为「提交座时间 → 写 PracticeLog」；schema 注释「观修不做计数」需随能力 4 实现时更新。排除「替换（废看视频）」：丢失已上线引导视频内容 + 用户数据，引导对学员有教学价值。排除「合并（看视频也算座）」：看视频 ≠ 打坐，违背手动实修语义、违反「30 分钟打坐才算座」绝对约束 |
| DR-110 | 能力 25 AI 助手表重估：AiUsage 是否新建 | **AiUsage 不新建，复用线上 `LlmCallLog` + `LlmProviderUsage`；AI 模块真正新增表 5 → 4（ContentChunk/FeatureEntry/AiConversation/AiMessage）**（用户决策 2026-05-31，审计 01 §五 #3 / §九 #3；DR-108 已预告）| 闭合 DR-108 预告的「AiUsage 复用 + 表重估」。核实线上：`LlmCallLog` 有 userId + scenario + cost + `@@index([userId, timestamp])`——AI 助手「每学员每日 ≤30 次」限流可直接 `COUNT(userId=X AND scenario=dharma_qa AND timestamp>=当日)` 算出；`LlmProviderUsage` 按 year/month/day/hour 聚合 cost/requestCount——「每日成本上限 $20」可直接读。两表完全覆盖 AiUsage 原职责（per-user 限流 + 每日成本统计），故 AiUsage 冗余、不新建。**真正新增 4 张**：ContentChunk（法本向量索引 pgvector）/ FeatureEntry（功能目录）/ AiConversation + AiMessage（对话历史，AiMessage 含 25.B toolCall/actionResult 契约 DR-107）。更新 §四（AiUsage 标复用）/ §十一 M8 / §十二 暂缓区计数 / 06 能力 25.A 对老项目影响 + 汇总表「5 张 → 4 张新建 + AiUsage 复用」。DR-106 加后修订注（5→4）；DR-106/检查轮次 53 文中「5 张」「AiUsage @@unique 计数」为历史记录不改写（append-only），以本条为准。排除「仍新建 AiUsage」：与线上 LlmCallLog（userId/scenario/cost 索引齐全）重复，且分裂用量统计为两套控制 |
| DR-109 | AI 模块整体上线定位 + 补登记子能力 25.C 笔记 AI 加工（现状）| **AI 模块（25.A/25.B/25.C 全部）只做后台必要部分，暂不作为正式用户功能上线；已上线的笔记 AI 加工保留运行但不扩展、不作正式能力推进。补 25.C 仅为如实登记线上现状 + 关闭 TODO-AI-1**（用户决策 2026-05-31，审计 01 §五 #2 / §九 #2）| 现状审计 + TODO-AI-1 核实：笔记 AI 加工（5 action 润色/摘要/标签/拟标题/起草，复用 gateway）已在生产运行（后端 `POST /api/notes/llm-assist`，前端 NotesDrawer「AI 草稿」入口），但 06/08 此前未登记。**用户决策**：整个 AI 模块暂不作为正式功能推进，只做后台必要部分（AskUserQuestion 2026-05-31 选「整个 AI 模块都不作为正式功能推」）。处理：(1) 06 能力 25 顶部加「AI 模块整体暂不上线」状态横幅；(2) 补子能力 25.C，但**仅作「已上线现状」登记**（避免 source-of-truth 留孤儿、满足「每功能必有标签」铁律），打 ⏸ 不扩展标签；(3) 25.C **零新表**（复用 Note + gateway，无状态调用不需对话历史表，AiConversation/AiMessage 不为其新增）；(4) 25.C 红线「严禁碰法义」与 25.A「必须基于法义」方向相反，故独立子能力不并入 25.A。**关闭 TODO-AI-1**。排除「把 25.C 当正式新能力推进/扩展」：与用户「AI 模块暂不上线」定调冲突。排除「不登记、只用一句备注带过」：06 是 source of truth，线上活功能不登记会留孤儿、违反功能标签铁律 |
| DR-108 | DR-74 修订：AI 助手实现时复用线上既有 LLM 网关（非从零自建）| **能力 25 实现时大模型调用 / 配额 / 熔断 / 每日成本上限一律复用线上既有 LLM 网关，仅新增 `dharma_qa`（法义问答）/ `feature_nav`（功能导航）两个 LlmScenarioConfig；DR-74「5 张表 ⏸ 暂缓实现」结论不变**（用户决策 2026-05-31，审计 01 §五 #1 / TODO-AI-1 关联）| 现状审计（01 §五）发现线上已有成熟 LLM 网关基础设施且比 AI_ASSISTANT_PLAN 设想更完善：LlmProviderConfig（多 provider minimax/claude/deepseek + 自动切兜底）/ LlmScenarioConfig（场景化，已上线 open_grading 判分 + question_gen 出题）/ LlmPromptTemplate（prompt 版本管理）/ LlmProviderUsage + LlmCallLog（用量 + 调用日志）/ gateway.ts + circuit.ts + quota.ts + AdminLlmPage 后台。DR-74 与 AI_ASSISTANT_PLAN.md 原假设「独立从零建 AI 模块」与实况冲突——调用层 / 配额 / 熔断 / 成本控制 / super_admin 配置后台均已存在。修订：能力 25 实现时**对接既有网关**，新增 dharma_qa / feature_nav 两个场景配置，复用多 provider 调度 + 熔断 + 配额 + 成本上限，**不重建调用层**。**修订范围界定**：DR-74「5 张表暂缓实现」结论不变（仍待 AI 模块独立推进、依赖 pgvector），本条仅修订「实现方式」= 复用而非自建；不改变任何表的暂缓状态、不动 §一/§四/§五 计数。**连带**：AiUsage 表可不新建（复用 LlmProviderUsage/LlmCallLog）、真正新增表重估 → 单独走后续「能力 25 表重估」核对，本条不预改表清单。排除「按 AI_ASSISTANT_PLAN 从零建调用层」：与既有网关重复造轮子，且分裂成本/配额/熔断为两套控制，运维与 super_admin 配置入口割裂 |
| DR-107 | AI 代操作（能力 25.B）：定位、范围、确认与纠错（提前设计）| **并入能力 25 作子能力 25.B；首批=录入类写+全部查询；所有写操作一律确认；纠错沿用能力 9**（用户决策 2026-05-31）| 用户决策提前设计 AI 代操作（理由：上线后给各能力写路径补「AI 可调用+强制确认+来源标记」契约成本更大）。能力 25 重组为 **25.A 法义问答/导航（只读，原内容）** + **25.B AI 代操作（写+查询）**。**五条铁律**：(1) 权限不放大——AI 只能代用户做用户本人有权做的操作，管理员/辅导员高权限操作 AI 永不代做；(2) 只碰本人数据；(3) 写操作前强制结构化确认卡，确认后才落库；(4) 多专业必须问清归属（D14b 跨专业不豁免，确认卡带专业选择，不许擅自猜）；(5) 来源留痕 source=ai_assistant。**四个拍板点**：(Q1) 定位=并入能力 25 子能力（非独立能力 26）；(Q2) 首批范围=录入类写（打卡 7/内加行 6/观修 4/约修 24/笔记）+ 全部只读查询（3/4/6/7/8/9/10/15/17）；(Q3) 纠错=沿用能力 9 铁律（确认是主防线，落库后学员不能自改，走能力 5 修正留痕 D17）；(Q4) 确认=所有写操作一律确认（含笔记）。**禁区**：代行豁免（5）/升学审核/成绩录入（10）/角色任命（18）/撤销出勤·取消资格（8/9）/邀请码（19）/归档（11）/状态变更（退出专业 11·设主修·改设置）/报数快照触发（9 系统自动）/替他人操作。**留痕定位**：AI 代操作本质是用户本人操作（非 D17 管理员代行豁免），不进 AuditLog（能力 20 只记高权限），但记录带 source 标记 + AiMessage 记 toolCall/actionResult 关联记录 id 可追溯。**数据契约**（提前设计核心产出）：不新建业务表，复用各能力写路径；写表（PracticeLog 等）来源标注扩展 ai_assistant 值；AiMessage 扩展 toolCall/actionResult 字段——登记 §十 TODO-AI-2，仍 ⏸ 暂缓随 AI 模块实现。**排除「独立能力 26」**：用户选并入，代操作与问答同属「AI 助手」一个用户触点，子能力划分已足够区隔只读/可写性质。**排除「给 AI 代录自助撤销窗口」**：与能力 9「学员不能改已提交记录」冲突，确认环节已是主防线，纠错统一走能力 5 保持一致 |
| DR-106 | AI 助手登记为 06 能力 25（暂缓决策讨论）| **AI 助手登记为能力 25；RAG 检索覆盖全部法本；学员可问 / 辅导员只读洞察 / super_admin 配置**（用户决策 2026-05-31）；**后修订（DR-110）：AiUsage 不新建、复用 LlmCallLog/LlmProviderUsage，AI 新增表 5→4**| 暂缓决策讨论：AI 助手 5 张表（ContentChunk/FeatureEntry/AiConversation/AiMessage/AiUsage）DB 设计与技术方案早在 docs/AI_ASSISTANT_PLAN.md（2026-05-04）定型，DR-74 决策暂缓字段级设计、不在融合范围内，但 06 未登记对应能力。本轮补登记能力 25，完成业务能力定稿（DB 仍 ⏸ 暂缓实现）。三个待拍板业务点用户决策：(1) **提问权限**=学员可问、class_tutor+ 只读「班级问答洞察」（不可自己提问）、super_admin 负责配置（职能 #20）；(2) **RAG 范围**=覆盖系统内全部已索引法本，不限学员是否已加入该专业（与专业归属解耦，任何学员可问任何法本）；(3) **辅导员洞察**=纳入本次定稿（Top N 热门问题聚合，不展示提问学员姓名）。其余沿用 AI_ASSISTANT_PLAN：法义必走 RAG 带引用（红线，无依据导向辅导员）、个人修行体验/教派评判不答、Rate Limit 30/日/学员、PII 不发 LLM、对话历史可物理清空（**D18 明确例外**：对话属 UI 工具记录非学修档案）、每日成本上限默认 $20。**06 范围说明**：能力 25 是横切型工具能力（同能力 18/20），非学修硬规则。**排除「RAG 限已加入专业」**（原 Q2 草稿 b）：用户明确放开为全部法本，检索范围与能力 2 归属解耦。**排除「辅导员也能提问」**：辅导员侧定位为备课洞察工具，提问入口仅面向学员（消费视图，符合三端分离）|
| DR-105 | 社交三件套登记为 06 能力（暂缓决策讨论）| **班级动态/讨论/约修登记为能力 22/23/24**（用户决策 2026-05-30）| 暂缓决策讨论：§5.1/5.2/5.3 三家族 DB 设计早已封板（DR-50~60），但服务的功能不在 06 的 20 条能力内，三处均挂 ⚠️「06 未登记能力」。用户选「现在补登记」。三能力为已封板设计的转录（无新业务决策）：能力 22 班级动态（发帖/评论/点赞/转发，DR-50~52）、能力 23 班级讨论（话题/投票一人一票不换投，DR-53~56）、能力 24 约修（集体修持目标，任意成员发起，DR-57~60）。三者均「内容本班可见 + 不物理删（D18，点赞物理删为 DR-50 例外）」。**06 范围说明**：登记后 06 从「纯预科学修管理」扩到含「班级社交/协作」——这三个是班级级互动功能，非学修硬规则，与能力 18/20 等横切能力一样可纳入。08 §5.1/5.2/5.3 三处 ⚠️ 解除。**排除「不登记，留作基础设施」**：06 是 source of truth，有表无能力会留下孤儿设计，违反「先有能力才有表」原则 |
| DR-104 | 自学进度模型（暂缓决策讨论·能力 21）| **自学进度=纯完成量，独立于班级；取消休息周/起修日/节奏（推翻 DR-62~64）**（用户决策 2026-05-30）| 用户决策：「自学不需要申报休息周，自学进度独立于班级」。逻辑：休息周存在的唯一意义是在「按班级课表周次推进」模型里暂停进度时钟、防假性掉队；自学进度独立、不对标周次、无掉队概念，故休息周（DR-62/63）/ 进度补足算法（DR-64）/ pace 节奏 / startDate 起修日**全部失去意义，一并取消**。新模型：进度 = 纯完成量，按 userId 聚合 LessonCompletion（课时完成度）+ PracticeLog（个人学修量），完成多少算多少，学员自定快慢，系统不判「落后」。**删表 UserSelfStudyRestWeek**（§五 12→11）；UserSelfStudyProgram 精简为 userId/programId/status（去 startDate/pace）。顺带修正 abandoned 权限 class_admin+→subject_admin+（自学无班级，作用域漏洞，与 DR-61 一致）。推翻 DR-62/63/64（均标作废）。**排除「保留休息周但不强制」**：无周次时钟可暂停，休息周纯属冗余字段，删除最干净 |
| DR-103 | 自学模式与升学体系的接轨边界（§5.4，暂缓决策讨论）| **自学=纯自我学习轨道：无班级、不升学、不做共修出勤；可录个人学修数量作自我追踪**（用户决策 2026-05-30）| 暂缓决策讨论确认自学模式定位。闸门问题「自学能否升学」定为**不能**（SS-1=c）：自学师兄要升学，须先经邀请码加入正式班级（能力 2），届时与班级学员一视同仁。连锁：(1) 不升学→不考升学考、不生成 SemesterSnapshot、不进升学预检；(2) 不做共修出勤（能力 8 机制不适用，自学无班级无共修）；(3) **可录个人学修数量**（念诵/观修，复用 PracticeLog——经核对 PracticeLog 字段无 classId，零改造；发愿走 context=personal）作个人进度追踪（DR-104 纯完成量）；(4) 升学体系表零改造（不为无班级加可空 classId）；(5) **不进关怀清单**（SS-4，用户决策 2026-05-30）——能力 14 关怀清单是班级机制（CareWatchlistItem.classId），自学无班级故不进；自学进度独立、无掉队概念故无预警（DR-104）。同步修订 06 能力 8 自学条款（不做出勤统计）+ 能力 9 规则 8（个人学修追踪，不做升学报数快照）。**排除 a/b（自学也能升学）**：会迫使升学/考试/报数/出勤全体系为「无班级」改造，复杂度高且违背班级中心模型（能力 2/8/9/10 均以 class 为锚）。§十二 P7 同步去掉对 P2 升学预检的依赖 |
| DR-102 | 请假对进度时钟的影响模型（TODO-18 闭合）| **能力 3/9 暂停型（截止日顺延）；能力 10 无影响（升学截止固定）**（用户决策 2026-05-30）| 三个维度分别处理：(1) **闻思圆满（能力 3）**：暂停型——LeaveRequest.approved 期间，课时截止日顺延等量天数，应用层计算截止日时聚合 `SUM(approved leave days)` 加到原截止日。(2) **报数达标（能力 9）**：暂停型——报数节点截止日同上顺延 N 天（N = 学员在该班的已批准请假总天数）。(3) **升学资格预检（能力 10）**：无影响——升学截止日固定不变，不受请假影响；学员须在请假前规划好升学节点。**实现路径**：应用层计算能力 3/9 截止日时，查 `LeaveRequest(userId, classId, status=approved)` 聚合请假总天数后顺延；能力 10 不读请假记录。无需新表/新字段（`LeaveRequest.startDate/endDate/status` 已就位，DR-90）。**排除「三维度统一暂停」**：升学截止若可顺延，会给刻意请假规避升学时限留下操作空间，与升学节点「硬截止」的管理目标冲突。**排除「三维度统一无影响」**：闻思/报数有绝对学习量要求（无法压缩），请假期间无法学习，不给顺延等同惩罚请假，与请假制度初衷冲突 |
| DR-101 | 后台管理界面范围（TODO-17 ⑤）| **考试线下进行，成绩录入在后台管理；升学相关管理 4 页**（用户决策 2026-05-30，TODO-17 闭合）| 考试不在 app 端进行，但成绩录入必须在后台：subject_admin 录入每位学员的 ExamGrade（§1.4 已封板，写权限已有）。管理界面范围：(1) 升学条件配置 `/admin/programs/:id/conditions`——ProgramAdvancementConfig CRUD，操作角色 subject_admin；(2) 考试管理 `/admin/classes/:id/exams`——创建考场、录入成绩（→ ExamGrade），操作角色 subject_admin；(3) 升学资格预检 `/admin/classes/:id/advancement`——触发 AdvancementCheck、查看预检报告、逐条豁免、拍板升学，操作角色 class_admin+；(4) 学员达标进度 `/admin/classes/:id/progress`——实时展示各条件完成量 vs 目标（SemesterSnapshot + 实时聚合），操作角色 class_tutor+。后台 UI 均为全新待建，与现有 PracticeGoal/PracticeTask 打卡体系并存不干扰 |
| DR-100 | 年龄豁免逻辑层（TODO-12 闭合）| **params.ageExemptionMinAge=60；AdvancementCheck 标 ageEligible=true，不自动通过；admin 手动走能力 5 代行豁免**（用户决策 2026-05-30，DR-70 已定调）| TODO-12 逻辑层补全：字段 User.birthDate 已就位（DR-70）。年龄豁免是「资格性、非自动」——AdvancementCheck 读 `birthDate` 计算年龄（基准日=第一次升学考报名日），若 ≥60 岁则在 checkResults 该条加 `ageEligible: true`，但 `passed` 仍为 false（不自动通过）。Admin 见 ageEligible 提示后，手动走能力 5 代行（proxy_action AuditLog 留痕）将该条 `exempted: true`。exam_score 条件的 `isExemptable=true` 已在设计中（默认false需手动开启）。排除「年龄≥60自动置exam_score满足」：剥夺有能力老人正常应考选择，违反能力5豁免「显式确认」哲学（DR-70）|
| DR-99 | exam_score 考试合格线多维矩阵 params 结构（TODO-13 闭合）| **params 含 attendanceThreshold/highAttendance/lowAttendance/ageExemptionMinAge；Exam 加 isOpenBook；考试线下进行，成绩后台录入**（用户决策 2026-05-30）| TODO-13 多维矩阵：大纲合格线按出勤档变化，单一 targetValue 无法表达，全写入 params（DR-97 原则）。分支逻辑：出勤≥93 次 → 1次合格(≥30分)；出勤<93次/自学 → 1次及格(开卷≥72/闭卷≥60) OR 2次各≥30分。AdvancementCheck 读 `Exam.isOpenBook` 确定分支后与 ExamGrade.score 比对。**Exam.isOpenBook 字段**（检查轮次 45 修复）：params 有开卷/闭卷两条合格线，但 AdvancementCheck 需从 Exam 表知道该场考试是哪种——Exam 加 `isOpenBook Boolean @default(false)`（subject_admin 创建考试时标记）。**考试约束**：考试在线下进行，不经 app 端；成绩由 subject_admin 在后台录入 ExamGrade，AdvancementCheck 读 ExamGrade 判定。排除「把矩阵逻辑写死应用层」：门槛数值（30/72/60/93）属专业配置，D3 要求数据驱动，故放入 params 而非 hardcode |
| DR-98 | practice_session 逐法达标 params 结构（TODO-9 闭合）| **params 含 per_item/groupBy/itemCount/minSessionsPerItem/minMinutesPerItem/totalMin*；双维度独立判定**（用户决策 2026-05-30）| TODO-9 逐法达标：大纲要求 92修法**每一法**各自满足 ≥3座 AND ≥90分钟（非仅总量），单一 targetValue 无法表达，写入 params（DR-97 原则）。AdvancementCheck 按 `groupBy: meditationId` 分组聚合，每组 `COUNT(sessions) ≥ minSessionsPerItem AND SUM(durationMinutes) ≥ minMinutesPerItem`，满足组数 = itemCount（92），同时全局 `COUNT ≥ totalMinSessions(276) AND SUM ≥ totalMinMinutes(8280)`。双维度独立计（DR-91，座数与时长不折算）。排除「把92法逐法快照存独立表」：AdvancementCheck 运行时聚合即可，不需冗余存逐法快照；排除「单一 totalMinSessions 条件」：违反大纲「每一法各自≥3座」绝对约束 |
| DR-97 | ProgramAdvancementConfig params 充分性验证（TODO-17 ⑤）| **params Json 可完整表达所有复杂条件，无需新建子表**（用户决策 2026-05-30，TODO-17 专题设计）| 原 TODO-17 勘误（检查轮次 35）发现：仅验证「链路连通」（有 ProgramAdvancementConfig 接住条件），未验证「params 能否装下复杂要求」（表达充分性）。专题设计核查结论：(1) 6 类 conditionType 枚举固定，每类解析逻辑在应用层硬化；(2) `params` Json 可表达逐法双维度（per_item 结构）、考试多维矩阵（attendanceThreshold 分支）、累计项目 id、年龄豁免触发条件等全部复杂要求；(3) `targetValue Int?` 不够用时，数值全写进 params（targetValue 置 null）。排除「新建 ConditionSubRule 子表」：conditionType 固定（6类），无动态扩展子条件需求，Json params + 应用层分类解析已足够，子表增加联表复杂度且无额外收益 |
| DR-96 | 兼修加行建模方式 | **无需新表或新字段；兼修 = 独立班级注册；升密法资格判定为用户维度、admin 手动触发**（用户决策 2026-05-30，TODO-14 闭合）| 大纲：修心/念佛专业可兼修加行，升密法时加行学修量保留。方案 a（独立班级）：学员同时加入加行班（UserRoleAssignment 多条记录），D9 已支持多专业并行，无需新建「附修关系字段」。加行班的 PracticeLog/UserPracticeVow 自然落在加行 classId/programId 下，学修量自然分开、各自独立，不混淆。升密法资格判断：**手动操作，系统只判断条件是否具备**——admin 手动发起资格检查，系统以 userId 为维度聚合该学员所有 programId 下的记录（非单 programId 作用域），判定结果供 admin 参考，录取密法班由 admin 手动完成。跨 program 聚合逻辑属升学条件查询层，纳入 TODO-17 专题设计。排除「新建 concurrentProgramId/secondaryClassId 字段」：已有多班级注册能力（D9），新字段是过度工程；排除「在 PracticeLog 打兼修标签」：升学预检以 userId 全量聚合，不需区分来源班级 |
| DR-94 | 金刚萨埵心咒代替顶礼：换算比例 + 审批流 + DB 落点 | **换算写死（2,000,000）；走能力5代行 AuditLog 留痕；顶礼 vow 标 isSubstituted=true；新建心咒 vow 从 0 独立计**（用户决策 2026-05-30，TODO-10 闭合）| 大纲规则：身体原因可申请以 200 万金刚萨埵心咒代替 10 万顶礼，无论已修多少顶礼。换算比例 200万↔10万 是大纲规定，非平台可调，写死应用层常量（`MANTRA_SUBSTITUTE_COUNT = 2_000_000`）；不入配置表，避免误配置引发业务偏差。审批流：class_tutor+ 在能力 5 代行界面操作，AuditLog 写一条 `actionType=proxy_action`（"替代"语义已含于 proxy_action 值域），`reason` 必填（记录身体原因），`payload={"before":{"practiceProjectId":"<顶礼 project id>","currentCount":X},"after":{"practiceProjectId":"<心咒 project id>","targetCount":2000000}}`。**区分两种修行**：UserPracticeVow 没有独立 vowType 字段，通过 `practiceProjectId` 区分（顶礼和心咒是两条不同的 PracticeProject 记录）。DB 执行：(1) 顶礼 `UserPracticeVow`（关联顶礼 practiceProjectId）置 `isSubstituted=true`，currentCount/currentSessionCount/currentSessionMinutes **原封不动**；(2) 新建心咒 `UserPracticeVow`（关联心咒 practiceProjectId，`targetCount=2_000_000`，`currentCount=0`），从 0 开始独立计算。两条 vow 并存，各自独立，互不影响（用户决策：「已修的要保存，不改变，独立计算」）。应用层升学预检时：顶礼 `isSubstituted=true` → 通过 `substitutionFor` 找心咒 vow → 验证 `currentCount ≥ 2,000,000`；达成→顶礼 ✅ + 法王祈祷文 ✅（双豁免，一因两果，大纲§649，DR-151）；未达成→两项均 ❌。新建心咒 vow 时同步写 `substitutionFor = 顶礼 vow id`（DR-151）。排除「顶礼进度折算入心咒」：大纲无此规定，且折算逻辑（已修 3 万顶礼 → 心咒还需 X 万？）无明确公式，不自创规则 | 能力 3 规则 2 定义课程三类型 entry/formal/restricted，但 Course 仅有 category（dharma_text/self_study_book，内容性质），无教学阶段维度。两者正交：courseType 管「闻思圆满路径 + 考试范围」，category 管「闻思页分组 + 自学读物复用」。考试范围排除 = `courseType=restricted OR category=self_study_book`。Course 因此从 ✅ 复用改判 🔧 扩展，移入 §1.11。排除「把 restricted 塞进 category 枚举」：混淆两个正交维度（一门课可同时是 self_study_book 和 restricted，单字段表达不了）；排除「不加字段、限制性课就用 self_study_book 代替」：能力 3 的 restricted 是「第2-7学期辅助课」，外延不等同 self_study_book（18本大学演讲系列），且 DR-92 闻思判定也需区分正式/限制性课 |
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

### 检查轮次 42（2026-05-30，范围：TODO-10 闭合 · UserPracticeVow 新增 isSubstituted · 心咒代替顶礼 DR-94）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | isSubstituted 为布尔标量，无新 FK 关联 |
| 2. API 响应字段对齐 | ✅（修复后）| 初版 DR-94 用了不存在的 vowType 字段→已改为 practiceProjectId（通过 PracticeProject 区分顶礼/心咒两种修持项目）|
| 3. AuditLog actionType 覆盖 | ✅ | proxy_action 值域含「替代」语义，已覆盖心咒代替顶礼场景 |
| 4. 总览计数正确 | ✅ | isSubstituted 是字段扩展，不新增表；12 张扩展区/15 张新建区计数不变 |
| 5-6. Migration/Phase | ⏸ 暂不适用 | UserPracticeVow.isSubstituted 新增字段待 migration 统编（@default(false)，不影响历史数据）|
| 7. 暂缓/不做标签完整 | ✅ | TODO-10 标闭合；TODO-11（法王祈祷文）为独立待办，无遗漏 |
| 8. 业务规则约束有实现方式 | ✅（修复后）| 初版约束表缺「换算比例常量」→已补；isSubstituted=true 排除预检约束已在约束表；换算常量 2,000,000 应用层写死已在约束表+DR-94 双重记录 |

**本轮发现问题数**：2（初版），修复后 0。
**修复内容**：(1) DR-94 payload 示例 vowType→practiceProjectId，补「区分两种修行通过 practiceProjectId」说明；(2) §1.7 约束表补「换算比例写死常量 2,000,000」条目。
**结论**：TODO-10 闭合。金刚萨埵心咒代替顶礼：换算常量写死 2,000,000；能力5代行(proxy_action) AuditLog 留痕；顶礼 UserPracticeVow.isSubstituted=true 历史数值原封不动；新建心咒 UserPracticeVow 从 0 独立计算（DR-94）。

---

### 检查轮次 43（2026-05-30，范围：TODO-11 闭合 · PracticeLog 改判扩展 §1.12 · 新增 prayerCount · DR-95）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | prayerCount 为 Int? 标量，无 FK，schema 片段格式正确 |
| 2. API 响应字段对齐 | ✅ | 聚合路径 SUM(prayerCount WHERE practiceProjectId=顶礼项目) 与字段定义一致；practiceProjectId 作为顶礼类型判断依据已说明 |
| 3. 总览计数正确 | ✅（误报已澄清）| agent 将节数（12）与张数（13）混淆——§1.4 含 3 张表、§1.6 含 2 张，故 12 节 = 13 张，标题「13 张」正确 |
| 4. §四 PracticeLog 改判标注 | ✅ | PracticeLog 条目已标注删除线 + 「🔧 移入扩展区（DR-95）」，不再显示 ✅ 确认复用 |
| 5. DR-72 一致性 | ✅（修复后）| 初版 DR-72「全部复用不动」在 PracticeLog 改判后产生冲突→已补注「后修订（2026-05-30）：PracticeLog 改判 🔧 扩展，移入 §1.12，见 DR-95」，与 DR-65 Course 修订处理方式对称 |
| 6. TODO-11 闭合 | ✅ | §十 TODO-11 已标 ✅ 已闭合（2026-05-30），关联决策 D13/DR-95 正确 |
| 7. 豁免路径一致性 | ✅ | §1.12 设计意图注明「isSubstituted=true 跳过法王祈祷文判定（DR-94/DR-95 协同）」；§1.7 UserPracticeVow.isSubstituted 字段 + DR-94 大纲规则均支持此路径 |
| 8. 业务规则约束有实现方式 | ✅ | 「独立计数」通过独立字段 prayerCount（应用层）保证；「不合并入顶礼 count」通过 Zod 分类校验（顶礼 prayerCount 必填 Int，非顶礼 null）隐式保证 |

**本轮发现问题数**：1（DR-72 补注），修复后 0。
**修复内容**：DR-72 补「后修订（2026-05-30）：PracticeLog 改判 🔧 扩展，移入 §1.12，见 DR-95」。
**结论**：TODO-11 闭合。法王祈祷文无欠/补状态机；PracticeLog 新增 prayerCount(Int?) 同次录入；SUM≥100,000 达标；isSubstituted=true 豁免；PracticeLog ✅复用→🔧扩展 移入 §1.12（DR-95）。§一 扩展区 13 张。

---

### 检查轮次 44（2026-05-30，范围：TODO-14 闭合 · 兼修加行无需新表/字段 · DR-96）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-96 无新表/字段；§一 仍 13 张，§三 仍 15 张 |
| 2. D9 引用正确性 | ✅ | D9「可加入多个班级，同时在多个专业修学，所有专业完全平等」与 DR-96「兼修=独立班级注册」完全对标 |
| 3. TODO-17 关联完整 | ✅（修复后）| 初版 TODO-17 未显式提及兼修跨 program 聚合需求→已补充第(6)项「多班级/多 program 学修聚合逻辑」，关联 DR-96 |
| 4. TODO-14 闭合标注 | ✅ | §十 TODO-14 已标 ✅ 已闭合（2026-05-30），关联 D9/DR-96 |
| 5. 暂缓/不做标签完整 | ✅ | 剩余：TODO-5（暂缓）/ TODO-9/12/13（⚠️ 待决策，纳入 TODO-17）/ TODO-16（❌ 不做）/ TODO-17（🎯 专题）/ TODO-18（⚠️ 待决策）；标签体系完整 |
| 6. 业务规则约束有实现方式 | ✅ | 「学修量保留」= D9 多班级注册自然分散到各 programId；「升密法手动触发」= admin 手动 + AdvancementCheck userId 全量聚合，两条路径均在 DR-96 明确 |

**本轮发现问题数**：1（TODO-17 缺兼修跨 program 说明），修复后 0。
**修复内容**：TODO-17 补第(6)项「多班级/多 program 学修聚合逻辑（DR-96，TODO-14）」，关联决策补 DR-96。
**结论**：TODO-14 闭合。兼修加行无需新表/字段；兼修=独立加入加行班（D9 已支持）；升密法资格判定为 userId 维度全量聚合、admin 手动触发（DR-96）；跨 program 聚合逻辑纳入 TODO-17。

---

### 检查轮次 45（2026-05-30，范围：TODO-17 闭合 · TODO-9/12/13 一并闭合 · §3.1 params 结构 · DR-97~101 · Exam.isOpenBook 修复）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | Exam.isOpenBook 为 Boolean 标量，无 FK；params 均为 Json?，无新关联字段；§1.4 schema 片段格式正确 |
| 2. API 响应字段对齐 | ✅ | exam_score params 分支逻辑读 `Exam.isOpenBook`，字段已在 §1.4 Exam 表定义；attendanceThreshold/highAttendance/lowAttendance/ageExemptionMinAge 均在 params 文档结构中 |
| 3. 总览计数正确 | ✅ | DR-97~101 均为配置层/逻辑层决策，无新表；§一 仍 13 张，§三 仍 15 张（ProgramAdvancementConfig 早已计入） |
| 4. isOpenBook 字段覆盖完整 | ✅（修复后）| 初版 exam_score params 有 openBookPassScore/closedBookPassScore 分支，但 Exam 表无字段标记开卷/闭卷；修复：§1.4 Exam 加 `isOpenBook Boolean @default(false)`，字段表、Prisma schema 片段、约束表、表头注释、DR-99 均已更新 |
| 5. TODO-9/12/13 闭合标注 | ✅ | §十 三条均已标 ✅ 已闭合（2026-05-30，TODO-17 专题），关联 DR-97/98/99/100 正确 |
| 6. TODO-17 闭合标注 | ✅ | §十 TODO-17 已标 ✅ 已闭合（2026-05-30），6 子议题列表完整，代码 gap 小结已记录 |
| 7. 暂缓/不做标签完整 | ✅ | 剩余：TODO-5（⏸ 暂缓）/ TODO-16（❌ 不做）/ TODO-18（⚠️ 待决策）；所有已闭合项已打 ✅；标签体系完整 |
| 8. 业务规则约束有实现方式 | ✅ | 逐法达标→AdvancementCheck 按 meditationId 分组聚合（DR-98）；合格线矩阵→attendanceThreshold 分支 + isOpenBook 字段（DR-99）；年龄豁免→ageEligible 标记 + 能力 5 代行（DR-100）；考试成绩→subject_admin 后台录入 ExamGrade（DR-101）；均有明确实现路径 |
| 9. params 充分性覆盖 | ✅ | DR-97 明确：targetValue(Int?) 不够用时，数值全写 params，targetValue 置 null；6 类 conditionType 枚举固定，params 结构各类在 §3.1 均有标准定义 |
| 10. 管理界面 4 页与权限一致 | ✅ | DR-101 四页：conditions(subject_admin)/ exams(subject_admin)/ advancement(class_admin+)/ progress(class_tutor+)，与 §三 角色权限模型一致；ExamGrade 写权限（subject_admin）已在 §1.4 封板 |

**本轮发现问题数**：1（Exam.isOpenBook 字段缺失），修复后 0。
**修复内容**：§1.4 Exam 加 `isOpenBook Boolean @default(false)`（字段表、Prisma schema、约束表、表头注释、DR-99 同步更新）。
**结论**：TODO-17 闭合（连带 TODO-9/12/13）。params 充分性已验证（DR-97）；逐法达标 per_item 结构（DR-98）；考试合格线 attendanceThreshold 分支矩阵 + isOpenBook 标记（DR-99）；年龄豁免 ageEligible 非自动（DR-100）；管理界面 4 页（DR-101）。§一 扩展区仍 13 张。

---

### 检查轮次 46（2026-05-30，范围：TODO-18 闭合 · 请假进度时钟三维度建模 · DR-102）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-102 无新表/字段；§一 仍 13 张，§三 仍 15 张；LeaveRequest 字段（startDate/endDate/status）均在 DR-90 已封板 |
| 2. DR-90 字段对齐 | ✅ | §3.15 LeaveRequest 有 startDate/endDate/status（pending/approved/rejected），DR-102 引用 `status=approved` 合法值正确 |
| 3. TODO-18 闭合标注 | ✅ | §十 TODO-18 已标 ✅ 已闭合（2026-05-30），关联 DR-90/DR-102，处理状态「✅ 已处理（DR-102）」 |
| 4. 暂缓/不做标签完整 | ✅ | 剩余：TODO-5（⏸ 暂缓）/ TODO-16（❌ 不做）；TODO-18 已闭合，§十 无残留 ⚠️ 待决策项 |
| 5. 业务规则约束有实现方式 | ✅ | 能力 3/9：应用层聚合 `SUM(approved leave days)` 顺延截止日；能力 10：升学截止日固定，应用层不读请假记录；两条路径均明确 |
| 6. DR-90 目标一致性 | ✅ | DR-90-B（掉队窗口扣除请假天数）+ DR-102（能力 3/9 截止日顺延）方向一致，均保护请假学员；能力 10 无影响与升学硬截止管理目标一致，无逻辑冲突 |

**本轮发现问题数**：0。
**结论**：TODO-18 闭合。请假进度时钟三维度定稿：能力 3（闻思圆满）暂停型 / 能力 9（报数达标）暂停型 / 能力 10（升学预检）无影响；应用层聚合 LeaveRequest(status=approved) 计算顺延天数，无需新表/字段（DR-102）。§十 待决策项清零，仅余 TODO-5（⏸ 暂缓）和 TODO-16（❌ 不做）。

---

### 检查轮次 47（2026-05-30，范围：全表封板后统编收口 · §十一 Migration · §十二 Phase · §十三 23 职能核对 · 升级检查项 4/5/6/9/11/13）

> 本轮是「全表封板后的统编收口」，专门回收此前因「待全表完成」而长期挂起的检查项。

| 检查项 | 此前状态 | 本轮结果 | 说明 |
|---|---|---|---|
| 4. 总览计数正确 | ✅（局部）| ✅（修复后）| **发现 §三 表头计数错误**：表头标「14 张」，但行内注（line 1099）+ 实际子节（3.1~3.15）均为 15 张——TODO-6 加 §3.15 LeaveRequest 后表头漏改。已修「14 张」→「15 张」。最终：§一 13 / §二 3 / §三 15 / §四 22（B类核心 5 + C类批量 16 + TantricGroup 微调 1；不含已移出至扩展/替换区的 Course/PracticeLog/CohortRecommendedTemplate/Exam，不含 AI 暂缓 5 张）/ §五 12 + AI 5（注：§五 后由 DR-104 删 RestWeek 修订为 11，见检查轮次 51）|
| 5. Migration 覆盖完整 | ⏸ 全程暂不适用（待全表完成统编）| ✅（本轮闭合）| **新增 §十一 Migration 统编**：M0(enum) + M1(扩展13) + M2a/b/c(替换3) + M3a~d(新建15) 覆盖全部已发布范围；M4~M8 覆盖暂缓区；逐区核对无遗漏（11.3）。循环依赖（ClassSession.scheduleId ↔ ClassSessionSchedule）已用两步拆解处理 |
| 6. Phase 计划覆盖完整 | ⏸ 全程暂不适用（待全表完成统编）| ✅（本轮闭合）| **新增 §十二 实施 Phase 计划**：P0~P8 共 9 个 Phase，权限地基（P1）→ 升学核心（P2）→ 关怀/运维/传承（P3~P5）→ 暂缓（P6~P8）；所有新表/字段均落某 Phase，依赖链无环（12.1）|
| 9. 升学条件可全查 | 🔵 部分（检查轮次 35 勘误下修）| ✅（本轮升级）| 勘误的两点已补齐：①「装得下」由 TODO-17（DR-97~101）验证透——params 可表达逐法双维度/考试多维矩阵/年龄豁免；②「设计 vs 代码 gap」由 §十一/§十二 系统盘点（哪些全新待建/扩展字段/暂缓）。链路连通 + 表达充分 + 实施路径三者齐备，升 ✅ |
| 11. D17 代行留痕路径完整 | 🔵 部分（待 AuditLog 封板）| ✅（本轮升级）| §3.11 AuditLog 已封板（检查轮次 34）；§十三 核对确认 11 类 actionType 全部对应到职能、无悬空、无缺失留痕的高权限职能（13.1）。代行留痕路径完整 |
| 13. 02 文档 23 职能写表覆盖 | 🔵 部分（贯穿十余轮，全职能核对待全表完成）| ✅（本轮闭合）| **新增 §十三 23 职能 × 写表核对**：21 项 ✅ 就位、1 项（#6 自学/网络共修）⏸ 表暂缓但权限链就位、1 项（#15）❌ 不做；AuditLog 11 类 actionType 全覆盖；权限继承等级与 02 矩阵一致 |

**本轮发现问题数**：1（§三 表头计数 14→15），修复后 0。
**修复内容**：§三 表头「14 张」→「15 张」（与行内注、实际子节对齐）。
**结论**：全表封板后统编收口完成。检查项 4/5/6/9/11/13 全部 ✅。新增三节：§十一 Migration 统编（5 闭合）、§十二 Phase 计划（6 闭合）、§十三 23 职能核对（13 闭合）；检查项 9/11 由 🔵 升 ✅。**至此 14 项检查清单全部 ✅，无 🔵 部分残留**（除暂缓区按决策延后实现外，设计层面全部收口）。

---

### 检查轮次 48（2026-05-30，范围：§十一/§十二 M2 拆分修复 · 对抗性核查反馈）

> 检查轮次 47 后跑对抗性全文核查（Explore agent 扫描 §十一/§十二/§十三），发现 1 处 migration 单元与 Phase 不对齐问题。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. M2 单元与 Phase 对齐 | ✅（修复后）| **发现问题**：§十一 原把 §二 3 张替换表定义为「M2 一个整体单元」，但 §十二 将其拆到不同 Phase（UserRoleAssignment→P1、TransmissionRecord→P5），且 CareFollowupRecord 实属 P3 关怀——一个 migration 单元横跨三 Phase，无法作为原子 migrate 执行。修复：M2 拆为 M2a(UserRoleAssignment→P1) / M2b(CareFollowupRecord→P3) / M2c(TransmissionRecord→P5)，各随对应 Phase 执行 |
| 2. M2b 依赖方向修正 | ✅（修复后）| 原 M3c「依赖前置」误写「M2（CareFollowupRecord）」，方向反了——实为 CareFollowupRecord(M2b).watchlistItemId → CareWatchlistItem(M3c)，M2b 依赖 M3c。修复：M3c 去掉对 M2 的依赖，P3 内顺序明确为「先 CareWatchlistItem 后 CareFollowupRecord」|
| 3. 引用一致性 | ✅ | §十一 11.3、§十二 P1/P3/P5 行、12.1 核对、§九 轮次 47 检查项 5 中所有 M2 引用均同步更新为 M2a/b/c |
| 4. 其余核查项 | ✅ | 对抗性核查确认：§一 13→M1、§三 15→M3a~d 逐张点名无遗漏无重复；P0~P8 覆盖 M0~M8；23 职能 #1~23 全覆盖；AuditLog 11 类 actionType 名单与 §3.11 一致；权限继承等级与 02 矩阵一致 |

**本轮发现问题数**：1（M2 整体单元横跨三 Phase + M3c 依赖方向反），修复后 0。
**修复内容**：M2 拆为 M2a/M2b/M2c 按消费 Phase 对齐；M3c 依赖方向修正；全文 M2 引用同步。
**结论**：Migration 单元与 Phase 计划完全对齐，每个 migration 单元可作为原子 `migrate deploy` 执行。§十一/§十二/§十三 经对抗性核查无其余事实错误。**14 项检查清单维持全 ✅。**

---

### 检查轮次 49（2026-05-30，范围：暂缓决策·自学模式边界 DR-103 · 跨 06/08 双文档）

> 本轮含跨文档修订（06 source of truth + 08 设计），需额外核对双文档一致性。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-103 无新表/字段——核实 PracticeLog 字段（userId/practiceProjectId/meditationId/count/durationMinutes/loggedAt/source/prayerCount）无 classId，自学录学修量零改造；发愿走 context=personal（UserPracticeVow.classTaskId/cohortTemplateId 均可空）|
| 2. 06↔08 双文档一致 | ✅ | 06 能力 8 自学条款（不做出勤统计）+ 能力 9 规则 8（个人学修追踪，不做升学报数）与 08 §5.4 边界小节、DR-103 表述一致；双文档均引 DR-103 |
| 3. 升学体系零改造确认 | ✅ | SemesterSnapshot/Exam/AdvancementCheck 的 classId 仍为必填（不为自学加可空）——DR-103 明确自学不升学，无需改造 |
| 4. 能力交叉引用正确 | ✅ | 自学升学路径「先加入正式班级」正确引能力 2；不做出勤引能力 8；不做报数快照引能力 9/10；与 06 各能力定义对齐 |
| 5. §十二 P7 依赖修正 | ✅ | P7 自学模式原标「依赖 P2 升学预检」→ 改「依赖 P0（仅需扩展字段）」，与 DR-103「自学不碰升学」一致；12.1 核对无残留 P2 引用冲突 |
| 6. 暂缓标签完整 | ✅ | §5.4 仍标 ⏸ 暂缓（DR-103 是边界定义，非启动实现）；TODO-5（恢复 Program.selfStudy 反向）仍挂自学实现时，不受影响 |
| 7. 业务规则约束有实现方式 | ✅ | 「不做出勤」=自学无 ClassSession 记录（应用层不生成）；「可录学修量」=PracticeLog 按 userId 直录（无 class 依赖）；「不升学」=不进升学预检引擎（应用层不为自学跑 AdvancementCheck）|

**本轮发现问题数**：0。
**修复内容**：无（DR-103 为新增决策，配套改动一次到位）。
**结论**：自学模式边界定稿（DR-103）。自学=纯自我学习轨道：无班级、不升学、不做共修出勤；可录个人学修数量作自我追踪（PracticeLog 零改造）。升学须先经邀请码加入正式班级（能力 2）。06 能力 8/9 同步修订，06↔08 双文档一致。§5.4 仍 ⏸ 暂缓待实现。

---

### 检查轮次 50（2026-05-30，范围：SS-4 自学不进关怀清单 · DR-103 补充）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | SS-4 无新表/字段；CareWatchlistItem.classId 仍必填（不为自学加可空）|
| 2. 能力 14 一致性 | ✅ | 能力 14 关怀清单触发源（能力 3/7/8/9/12）均班级维度；自学不做出勤/不做升学报数（DR-103），自然不触发；显式记「不进关怀清单」与能力 14 班级机制一致 |
| 3. DR-103 与 §5.4 表同步 | ✅ | DR-103 连锁含义补 (5) 不进关怀；§5.4 边界表补「关怀清单 ❌ 不进」行；两处表述一致 |
| 4. 进度预警替代路径 | ✅ | 自学进度预警走 DR-64 个人算法（休息周暂停预警），不依赖 CohortLagSnapshot（班级掉队快照），路径自洽 |

**本轮发现问题数**：0。
**结论**：SS-4 闭合——自学不进关怀清单（能力 14 班级机制，自学无班级）；进度预警走 DR-64 个人算法。DR-103 与 §5.4 边界表同步补充。
> ⛔ **后续修订**：本轮提到的「DR-64 个人算法（休息周暂停预警）」已被 DR-104 推翻（检查轮次 51）——自学进度改为纯完成量、无掉队预警、无休息周。结论的「不进关怀清单」不变。

---

### 检查轮次 51（2026-05-30，范围：自学进度模型简化 DR-104 · 删 RestWeek · 登记能力 21 · 跨 06/08）

> 本轮含：推翻 DR-62/63/64、删表、06 新增能力 21、跨双文档一致核对。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 删表与计数一致 | ✅ | UserSelfStudyRestWeek 删除：§5.4 表删、§五概览 2→1 张、§五合计 12→11、§十一 M7（1 张）、§十二 12.1（§五 11）、检查轮次 47 检查项 4 加修订注，全部同步 |
| 2. Prisma 关联对称性 | ✅ | UserSelfStudyProgram 删 `restWeeks` 反向关联（RestWeek 已删）；user/program 关联保留；TODO-5（Program.selfStudy 反向）实现时恢复，不受影响 |
| 3. 推翻决策标注完整 | ✅ | DR-62/63/64 均加 ⛔ 已推翻（DR-104）标注 + 删除线；DR-104 新增并说明推翻理由；无悬空引用 |
| 4. DR-64 残留引用清理 | ✅ | §5.4 边界表（关怀行/学修量行/进度行）、DR-103 连锁(3)(5)、TODO-5 关联决策、检查轮次 50（加后续修订注）中的 DR-64 引用全部改 DR-104 或加修订注 |
| 5. 字段去除一致 | ✅ | startDate/pace 从字段表、Prisma schema、写权限（pace 修改行删）、约束表全部去除；UserSelfStudyProgram = id/userId/programId/status/createdAt/updatedAt |
| 6. 06↔08 双文档一致 | ✅ | 06 新增能力 21（自学模式），与 08 §5.4、DR-103/104 表述一致；能力清单汇总加能力 21；06 changelog 同步 |
| 7. 权限作用域修正 | ✅ | abandoned 权限 class_admin+→subject_admin+（自学无班级，class_admin 作用域够不着，与 DR-61 入学权限一致）；§5.4 写权限 + 约束表同步 |
| 8. 暂缓标签完整 | ✅ | §5.4 仍 ⏸ 暂缓；⚠️「06 未登记能力」解除（已登记能力 21）|

**本轮发现问题数**：0（DR-104 为用户决策，配套改动一次到位）。
**结论**：自学进度模型简化定稿（DR-104）。进度=纯完成量、独立于班级、无周次/无掉队/无休息周/无进度补足；删 UserSelfStudyRestWeek（§五 12→11）；UserSelfStudyProgram 精简为 4 业务字段；推翻 DR-62/63/64。06 登记能力 21，⚠️ 解除，06↔08 一致。§5.4 仍 ⏸ 暂缓待实现。

---

### 检查轮次 52（2026-05-30，范围：社交三件套登记 06 能力 22/23/24 · DR-105 · 跨 06/08）

> 本轮含 06 新增 3 条能力 + 08 三处 ⚠️ 解除 + 跨双文档一致核对。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-105 是封板设计转录，无新表/字段；§5.1/5.2/5.3 表结构不动（§五暂缓仍 11 张）|
| 2. 06↔08 双文档一致 | ✅ | 06 能力 22/23/24 业务规则与 08 §5.1/5.2/5.3 写权限 + DR-50~60 逐条对齐（发帖权限、一人一票不换投、任意成员发起约修等）|
| 3. ⚠️ 标签全部解除 | ✅ | 08 §5.1/5.2/5.3 三处「06 未列入 20 条能力 ⚠️」均改为「已登记能力 22/23/24，DR-105」；全文 §五 再无 ⚠️ 未登记残留 |
| 4. 能力编号无冲突 | ✅ | 16 ❌ 不做、21 自学、22/23/24 社交三件套；编号连续无重复；06 汇总表 1-24、状态行 1-24 同步 |
| 5. 能力交叉引用正确 | ✅ | 三能力均正确引能力 2（班级成员）、能力 18（越权判定）；能力 24 引能力 4/6/7（修持项目 PracticeProject）|
| 6. 业务规则约束有实现方式 | ✅ | 本班可见=classId 过滤（应用层）；软删=isDeleted+D18；点赞物理删=DR-50 例外；一人一票=@@unique+不换投应用层；均在 §5.x 约束表就位 |
| 7. 暂缓标签完整 | ✅ | §5.1/5.2/5.3 仍 ⏸ 暂缓（DR-105 是登记，非启动实现）；06 汇总表三条均标「⏸ 暂缓实现」|

**本轮发现问题数**：0（DR-105 为封板设计转录，无新业务决策）。
**结论**：社交三件套登记完成（DR-105）。能力 22 班级动态 / 23 班级讨论 / 24 约修，均为 §5.1/5.2/5.3 封板设计转录；08 三处 ⚠️ 全部解除。**至此 §五 暂缓区四家族全部完成 06 能力登记**（21 自学 + 22/23/24 社交），§五 再无未登记能力。06 能力清单 1-24。三家族仍 ⏸ 暂缓待实现。

---

### 检查轮次 53（2026-05-31，范围：AI 助手登记 06 能力 25 · DR-106 · 跨 06/08）

> 本轮含 06 新增能力 25 + 08 §四 AI 表注释更新 + DR-106 + §十一/十二 关联 + 跨双文档一致核对。AI 5 张表 DB 设计与技术方案早在 AI_ASSISTANT_PLAN.md（2026-05-04）定型，本轮仅补业务能力登记，DB 仍 ⏸ 暂缓实现。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-106 仅补业务能力，AI 5 张表沿用 AI_ASSISTANT_PLAN 既有设计，无新表/字段；§四 三行仅更新注释（关联能力 25），表本身不动；§五暂缓仍 11 张（AI 5 张始终在 §四 复用区外的暂缓清单，计数不变）|
| 2. 06↔08 双文档一致 | ✅ | 06 能力 25 业务规则与 08 DR-106、§四 5 张表、§十一 M8、§十二 P8 逐条对齐（RAG 全部法本、学员可问/辅导员只读/super_admin 配置、对话历史可物理删 D18 例外）；AI_ASSISTANT_PLAN.md 技术细节为引用源，未冲突 |
| 3. 能力编号无冲突 | ✅ | 1-24 已用，能力 25 为下一连续编号；06 状态行 1-25、汇总表 1-25、changelog 同步 |
| 4. 能力交叉引用正确 | ✅ | 能力 25 依赖能力 2（提问者身份）、能力 3（法本索引为 ContentChunk）、能力 18（权限：学员/辅导员/super_admin 职能 #20）；均为已存在能力，无悬空引用 |
| 5. 业务规则约束有实现方式 | ✅ | RAG 红线=system prompt 约束+引用后处理（AI_ASSISTANT_PLAN §六/九）；Rate Limit=AiUsage @@unique([userId,date]) 计数；PII 不发=应用层净化；对话物理删=AiConversation/AiMessage 物理 DELETE（D18 例外，规则 7 已注明）；成本上限=super_admin 配置项；洞察不展姓名=应用层聚合脱敏 |
| 6. D18 例外标注完整 | ✅ | 对话历史物理删除是 D18「永不物理删除」的明确例外，理由（UI 工具记录非学修档案）在 06 规则 7、绝对约束 4、DR-106 三处一致标注；与 DR-50 点赞物理删同为 D18 列举例外 |
| 7. 暂缓标签完整 | ✅ | §四 三行仍 ⏸ 暂缓实现；§十一 M8 / §十二 P8 仍 ⏸；06 汇总表能力 25 标「⏸ 暂缓实现」；DR-74（暂缓 DB 实现）与 DR-106（业务登记）并存不矛盾 |
| 8. 三端分离一致 | ✅ | 学员端=提问入口（消费视图）；辅导员端=只读问答洞察（不可提问）；super_admin=配置中心；符合 CLAUDE.md 三端分离铁律，辅导员管理操作不混入学员端 |

**本轮发现问题数**：1（§11.3 line 4050「§五 暂缓 12 张」为 DR-104 删 RestWeek 后检查轮次 51 漏改的旧残留，本轮顺修为 11 张；与 §五 实际 11 张、line 4077 一致）。DR-106 本身配套改动一次到位。
**结论**：AI 助手登记完成（DR-106）。能力 25 = RAG 法义问答（覆盖全部法本、带引用红线）+ 功能导航 + 辅导员洞察；学员可问 / 辅导员只读 / super_admin 配置。DB 5 张表（含 pgvector）仍 ⏸ 暂缓实现（DR-74）。**至此 06 能力清单 1-25 全部完成登记**，08 §四 AI 三行 ⚠️/暂缓注释与 06 对齐。

---

### 检查轮次 54（2026-05-31，范围：AI 代操作 能力 25.B · DR-107 · 跨 06/08）

> 本轮含 06 能力 25 重组为 25.A/25.B + 25.B 代操作定稿 + 08 DR-107 + §十 TODO-AI-1/2 登记 + 跨双文档一致核对。AI 代操作为提前设计（DB 仍 ⏸ 暂缓），核心产出是数据契约登记防上线后返工。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-107 不新建业务表；数据契约（写表 source=ai_assistant 值、AiMessage toolCall/actionResult）登记 §十 TODO-AI-2 待实现，本轮不动表结构；§四/§一/§五 计数全不变 |
| 2. 06↔08 双文档一致 | ✅ | 06 能力 25.B 五条铁律/可做禁区清单/确认/纠错与 08 DR-107 逐条对齐；25.A 原内容降级 #### 嵌套、内容不变；两处均标 DR-107 |
| 3. 权限不放大可落地 | ✅ | 铁律 1「AI 只能代用户做用户本人有权做的操作」=应用层调用前过 §3.11 权限判定（与人工操作同一套 canDo）；禁区清单逐项对应高权限职能（02 文档职能 #7/11b/16/19/22 等），AI 永不触达 |
| 4. 多专业归属约束有实现方式 | ✅ | 铁律 4 对应 D14b（能力 7 跨专业不豁免）；确认卡带 majorEnrollment 选择，AI 不猜——应用层在写 PracticeLog 前必须有明确 programId，无则澄清追问 |
| 5. 纠错路径与能力 9 一致 | ✅ | 落库后学员不能自改（能力 9 规则 5）→ 走能力 5 修正留痕（D17）；排除「AI 代录自助撤销窗口」（与能力 9 冲突，DR-107 已记排除理由）；确认环节为主防线 |
| 6. 留痕定位正确（不混淆 D17）| ✅ | AI 代操作=用户本人操作（非 D17 管理员代行豁免），不进 AuditLog（能力 20 只记高权限）；仅记录带 source 标记 + AiMessage 工具调用追溯——与能力 9「录入方式自动/手动」来源维度同构，新增 ai_assistant 第三态 |
| 7. 暂缓标签完整 | ✅ | 25.B 随能力 25 整体 ⏸ 暂缓实现；TODO-AI-1（笔记现状）/TODO-AI-2（数据契约）均登记 §十，处理时机明确（现状分析 / AI 模块实现）|
| 8. 三端分离一致 | ✅ | 25.B 仅代「当前登录用户本人」操作（铁律 2）；学员的 AI 不能做管理操作；不破坏学员端纯消费视图（AI 代录的仍是学员自助可做的打卡/报数，非管理动作）|

**本轮发现问题数**：0（DR-107 为用户决策，25.A 降级嵌套 + 25.B 新增 + TODO 登记一次到位）。
**结论**：AI 代操作定稿（DR-107）。能力 25 重组为 25.A 只读问答导航 + 25.B 代操作；五条铁律（权限不放大/只碰本人数据/写前强制确认/多专业问清/来源留痕）；首批录入类写+全部查询，高权限永不代做，纠错沿用能力 9。数据契约登记 TODO-AI-2、笔记 LLM 现状登记 TODO-AI-1，DB 仍 ⏸ 暂缓。

---

### 检查轮次 55（2026-05-31，范围：DR-108 修订 DR-74 · AI 助手复用线上既有 LLM 网关 · 跨 06/08）

> 本轮处理审计待修订清单 **#1**（01 §五）：DR-74 原假设「AI 从零自建独立模块」与现状审计（线上已有成熟 LLM 网关）冲突，修订为「实现时对接既有网关」。**仅修订实现方式，不改任何表的暂缓状态、不动表计数。** #2（笔记 25.C）/ #3（表重估）单独后续核对。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-108 仅修订实现方式（调用层复用网关），不新建表 / 不改字段 / 不动 §一(13)/§三(15)/§四/§五 任何计数；表清单零改动 |
| 2. 06↔08 双文档一致 | ✅ | 06 能力 25.A「对老项目影响」补「LLM 调用层复用既有网关 + 新增 dharma_qa/feature_nav 两场景」与 08 DR-108、§四 AI 三行注释「调用层复用既有 LLM 网关 DR-108」三处一致 |
| 3. 交叉引用双向闭合 | ✅ | DR-74 行加「实现方式修订见 DR-108」（向后指）；DR-108 引 DR-74 + 审计 01§五#1 + TODO-AI-1（向前指）；§四三行 + 06 均引 DR-108 |
| 4. 暂缓标签完整未动 | ✅ | §四 AI 三行仍「⏸ 暂缓实现」；§十一 M8 / §十二 P8 仍 ⏸（未触碰）；DR-108 明确「DR-74『5 张表暂缓实现』结论不变」 |
| 5. 表清单未被预改 | ✅ | DR-108 明确「AiUsage 复用 / 真正新增表重估 → 单独核对，本条不预改表清单」；06「新增 5 张表」一句保持原样，留待 #3 处理，避免越界 |
| 6. 审计待修订项对齐 | ✅ | 01 §五 #1 = 本轮 DR-108；同步在 01 §九 #1 标「✅ 已处理（DR-108）」；与 TODO-AI-1（笔记现状=#2）区分清楚，未混入 |
| 7. 与既有网关事实相符 | ✅ | LlmProviderConfig/LlmScenarioConfig/LlmPromptTemplate/LlmProviderUsage/LlmCallLog + gateway/circuit/quota.ts + AdminLlmPage 均经审计 01 §五核实存在，已上线 open_grading/question_gen 两场景 |

**本轮发现问题数**：0（DR-108 为用户决策，4 处改动 + 审计回标一次到位）。
**结论**：待修订 #1 闭合。DR-74 实现方式修订为「复用线上既有 LLM 网关（多 provider/配额/熔断/成本/super_admin 后台），仅加 dharma_qa/feature_nav 两场景，不重建调用层」；5 张表暂缓实现结论不变。AiUsage 复用 + 表重估留 #3 单独核对。

---

### 检查轮次 56（2026-05-31，范围：DR-109 AI 模块整体暂不上线 + 补子能力 25.C 笔记加工 · 跨 06/08）

> 本轮处理审计待修订清单 **#2**（01 §九）+ 闭合 TODO-AI-1：用户定调「整个 AI 模块都不作为正式功能推」（AskUserQuestion 2026-05-31）。补登记线上已运行的笔记 AI 加工为子能力 25.C（仅记现状不扩展），并在能力 25 顶部加模块级「暂不上线」横幅。**不新建任何表、不改任何表计数。**

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-109 不新建表 / 不改字段；25.C 明确「零新表」（复用 Note + gateway，无状态调用不需对话历史表）；§一(13)/§三(15)/§四/§五 计数全不变 |
| 2. 06↔08 双文档一致 | ✅ | 06 能力 25 顶部横幅 + 25.C 小节 + 汇总表 + 变更记录，与 08 DR-109、TODO-AI-1 闭合三处对齐；25.C 红线「严禁碰法义」与 25.A「必须基于法义」相反，两文档均如此表述 |
| 3. TODO-AI-1 闭合 | ✅ | §十 TODO-AI-1 标 ~~已闭合~~（DR-109）；处理时机由「项目审计阶段」→「✅ 已处理」；笔记现状（5 action/路由/前端入口）已核实写入 25.C |
| 4. 功能标签完整 | ✅ | 25.C 打 ⏸「已上线但不作正式能力扩展」标签；25.A/25.B 受顶部「AI 模块整体暂不上线」横幅覆盖；无无标签的暧昧状态（设计文档守则） |
| 5. 表清单未被改动 | ✅ | §四 AI 5 张表行未动（状态仍 ⏸ 暂缓，DR-74/106/108）；DR-109 是上线政策 + 25.C（零表），不改表状态，故 §四不加 DR-109 引用，保持聚焦 |
| 6. 与既有实现事实相符 | ✅ | 笔记 AI 5 action（polish/summarize/tags/title/draft）、`POST /api/notes/llm-assist`（routes.ts:164）、NotesDrawer 入口（line 60/150）经本会话核实存在并已上线 |
| 7. 审计待修订项对齐 | ✅ | 01 §九 #2 标「✅ 已处理（DR-109）」；与 #1（DR-108 网关复用）不冲突——DR-108 管「真做时怎么做」、DR-109 管「现在不作正式功能上线」 |

**本轮发现问题数**：0（DR-109 为用户决策，06 四处 + 08 三处 + 审计回标一次到位）。
**结论**：待修订 #2 闭合，TODO-AI-1 闭合。AI 模块整体定位 = 只做后台必要部分、暂不作为正式用户功能上线；补登记子能力 25.C 笔记 AI 文本加工（仅记现状、零新表、不扩展）。

---

### 检查轮次 57（2026-05-31，范围：DR-110 能力 25 AI 助手表重估 · AiUsage 复用 · 跨 06/08）

> 本轮处理审计待修订清单 **#3**（01 §九）+ 闭合 DR-108 预告：核实线上 `LlmCallLog`/`LlmProviderUsage` 已覆盖 AiUsage 职责，AiUsage 不新建，AI 模块真正新增表 5 → 4。**纯计数/归类修订，不新建表、不改字段。**

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-110 是表重估（AiUsage 从「新建」改判「复用」），不新建表 / 不改字段；§一(13)/§三(15)/§五(11) 学修体系计数全不变；仅 AI 暂缓区「5→4」 |
| 2. AiUsage 复用可落地 | ✅ | LlmCallLog（userId/scenario/cost + @@index([userId,timestamp])）→ 限流 COUNT；LlmProviderUsage（periodType=day 聚合 cost）→ 每日成本上限；两表经 schema 核实索引齐全，覆盖 AiUsage 全部原职责 |
| 3. 当前状态引用全部对齐 | ✅ | §四（AiUsage 拆出标复用，AiConversation/AiMessage 单列新建）/ §十一 M8（4 张新建 + AiUsage 复用）/ §十二 暂缓区两处（AI 5→4）/ 06 输出·对老项目影响·汇总表 —— 6 处当前状态引用全改「4 张新建 + AiUsage 复用」 |
| 4. 历史记录不改写（append-only）| ✅ | DR-74/DR-106 决策点文中「5 张表」、检查轮次 1/23/53 等历史检查的「AI 5 张」「AiUsage @@unique 计数」均保留原样；DR-106 加「后修订（DR-110）」前向注；以 DR-110 为权威，不篡改历史 |
| 5. 06↔08 双文档一致 | ✅ | 06 能力 25.A（输出 4 表 + AiUsage 复用、对老项目影响 4 张新建）与 08 DR-110、§四、§十一 M8 一致；汇总表引用 DR-110 |
| 6. 真正新增 4 张内容正确 | ✅ | ContentChunk（pgvector 向量）/ FeatureEntry（功能目录）/ AiConversation + AiMessage（对话历史，AiMessage 含 DR-107 toolCall/actionResult 契约）——4 张职责互不重叠，均非线上既有 |
| 7. 审计待修订项对齐 | ✅ | 01 §九 #3 标「✅ 已处理（DR-110）」；与 #1（DR-108 网关复用）连续——DR-108 预告、DR-110 闭合 |

**本轮发现问题数**：0（DR-110 为用户决策，08 六处 + 06 四处 + 审计回标一次到位）。
**结论**：待修订 #3 闭合。AiUsage 不新建（复用 LlmCallLog + LlmProviderUsage）；AI 模块真正新增表 5 → 4（ContentChunk/FeatureEntry/AiConversation/AiMessage）。**至此 AI 模块三条修订（#1 网关复用 DR-108 / #2 暂不上线+25.C DR-109 / #3 表重估 DR-110）全部闭合。**

---

### 检查轮次 58（2026-05-31，范围：DR-111 观修语义并存 · 能力 4 对齐 DR-91 · 跨 06/08）

> 本轮处理审计待修订清单 **#4**（01 §九，唯一 ⚠️ 语义冲突项）：线上 Meditation 看视频 vs 能力 4 打坐统计。用户决策并存 + 观修计入升学（手动提交、不自动、数据按 DR-91）。**零新表**（复用 PracticeLog/UserPracticeVow/MeditationSession）。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-111 不新建表 / 不改字段；座记录用既有 PracticeLog（已有 meditationId/durationMinutes，line 836）+ UserPracticeVow（已有 currentSessionCount/Minutes，DR-91）；MeditationSession 不动；§一/§三/§四/§五 计数全不变 |
| 2. 消除 observation_records 孤儿表名 | ✅ | 06 能力 4「输出 observation_record / 新增 observation_records 表」改走 PracticeLog；全文 grep 确认 observation_record 仅余 06 line 175「不新增 observation_records 表」一处说明，08 从无此名 |
| 3. 与 DR-91/DR-98 一致 | ✅ | 单座 ≥30 分钟、座数 COUNT + 时长 SUM 双维度（DR-91）；按 meditationId 分组判 92 修法逐法（DR-98）；06 业务规则 4 由「短座可合并」改「不合并」、绝对约束 1 对齐，消除 06 与 DR-91 的活冲突 |
| 4. 06↔08 双文档一致 | ✅ | 06 能力 4（录入方式规则 10 + 输入输出 + 对老项目影响）与 08 DR-111 逐条对齐；术语统一用 PracticeLog/UserPracticeVow |
| 5. 净资产保留 | ✅ | Meditation/MeditationSession（看视频引导 + 完成次数/秒数排行）保留不动，DR-111 明确「与升学打坐报数各管各的」；正式纳入净资产清单待 #5 处理 |
| 6. 旧线上决策修订标注 | ✅ | 线上 schema 注释「观修不做计数」由 DR-111 修订为「计入升学」；标注「实现时更新 schema 注释」为代码层影响（本轮不改代码，纯设计） |
| 7. 审计待修订项对齐 | ✅ | 01 §九 #4 标「✅ 已处理（DR-111）」；⚠️ 语义冲突 2 项之一（观修）闭合，另一项（AI 模块定位）已由 #1/#2 闭合 |

**本轮发现问题数**：0（DR-111 为用户决策；06 五处 + 08 DR-111 + 审计回标一次到位；顺带消除 observation_records 孤儿表名 + 短座合并旧表述两处 06↔08 不一致）。
**结论**：待修订 #4 闭合。观修语义 = 并存（视频/PPT 引导保留）+ 观修计入升学（手动点「完成观修」提交座时间、不自动记录、按 DR-91 走 PracticeLog/UserPracticeVow）；看视频排行与打坐报数各管各的。**01 §九 两项 ⚠️ 语义冲突全部闭合。**

---

### 检查轮次 59（2026-05-31，范围：DR-112 净资产纳入 + 实现状态标签 + 配套文档体系）

> 本轮处理审计待修订清单 **#5**（01 §九）+ 用户新要求（独立修改方案 + 全套配套文档）：净资产正式纳入、确立五类实现状态标签、新建 7 份交付文档。**纯文档体系决策，不新建业务表、不改表计数。**

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-112 是文档/标签体系决策，不新建表 / 不改字段；§一/§三/§四/§五 计数全不变 |
| 2. 净资产清单完整 | ✅ | 审计 01 §八 净资产全集（题库/SM2/通知/成就/藏历/画报/系统公告/LLM网关/账户安全/UGC/笔记高亮/阅读/观修引导）逐项落入 03 §5，均标 ✅ 保留 |
| 3. 实现状态标签一致 | ✅ | 五类标签（✅/🔧/🆕/⏸/❌）定义在 00-INDEX §三 + 03 §1，glossary/acceptance/04/05 引用同一套，无歧义 |
| 4. 配套文档齐全且互链 | ✅ | 7 份新文档（00/03/04/05/glossary/acceptance/runbook）创建；00-INDEX 登记全部并标状态；03 §11 链待修订进度；04/05 数据源 schema+routes 全量清点 |
| 5. 文档定位无重叠冲突 | ✅ | 设计(06/08/02/05) vs 现状(audit 01/02) vs 改造(audit 03) 三层定位清晰；04/05 为现状快照归 audit；glossary/acceptance/runbook 为跨文档工具 |
| 6. 数据准确性 | ✅ | 04 标 61 model/23 enum（直接清点，修正审计 01 早期 60/19 约数）；05 标 139 端点/26 模块；PracticeLog↔PracticeEntry 命名差异在 04 标注（接 #6）|
| 7. 审计待修订项对齐 | ✅ | 01 §九 #5 标「✅ 已处理（DR-112）」；净资产保留诉求闭合 |

**本轮发现问题数**：0（DR-112 为用户决策；7 份文档 + DR + 审计回标一次到位）。顺带暴露两条待后续处理：PracticeLog/PracticeEntry 命名对齐（接 #6 迁移映射）、审计 01 早期「60 model」约数（04 已修正为 61）。
**结论**：待修订 #5 闭合。净资产正式纳入设计（✅ 保留复用）；五类实现状态标签确立；独立修改方案（03）+ 全套配套文档（00/04/05/glossary/acceptance/runbook）建齐。

---

### 检查轮次 60（2026-05-31，范围：DR-113 角色/报名迁移映射 · 跨 02/03/08/runbook）

> 本轮处理审计待修订清单 **#6**（02 §五）：定 coach/admin/enrollment 三项迁移具体规则。**纯迁移规则决策，不新建业务表、不改表计数。**

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-113 是迁移脚本规则，不新建表 / 不改字段；§一/§三/§四/§五 计数全不变 |
| 2. 02 文档迁移表对齐 | ✅ | 02 §七迁移表由「coach→tutor+admin 双角色」改「coach→仅 class_tutor + 人工补 class_admin」；admin「→super_admin」补「后人工降级」；加 DR-113 修订说明 + 变更记录 |
| 3. 03/runbook 同步 | ✅ | 03 §9 迁移步骤(7 步含人工补任命)+ 难度表(enrollment 升🔴、角色补任命)+ §8 风险 + 过渡期须知；runbook 迁移顺序 + 过渡期须知；三处一致 |
| 4. 跨文档无残留旧表述 | ✅ | 全文 grep「coach→tutor+admin」「派生专业级」旧表述已清；03 §11 #6 标 ✅ DR-113 |
| 5. 过渡期风险显式记录 | ✅ | 辅导员行政功能待补任命、admin 降级前超权窗口、enrollment 课程语义废弃——三项代价均在 DR-113/02/03/runbook 显式标注，用户已接受 |
| 6. 与 #7/#8 衔接 | ✅ | DR-113 连 #7（token 全失效重登）、#8（专业×届 programId 是 enrollment 迁专业级前置）；未越界预判 #7/#8 决策 |
| 7. 审计待修订项对齐 | ✅ | 02 §五 #6 标「✅ 已处理（DR-113）」 |

**本轮发现问题数**：0（DR-113 为用户决策；02 两处 + 03 三处 + runbook + 08 DR + 审计回标一次到位）。
**结论**：待修订 #6 闭合。coach→仅 class_tutor（人工补行政权）；admin→全 super_admin 后人工降级；UserCourseEnrollment 彻底迁专业级。三项过渡期代价已显式记录并被用户接受。

---

### 检查轮次 61（2026-05-31，范围：DR-114 JWT 结构修订 · 方案 B 查库+缓存 · 跨 02/03/08/runbook）

> 本轮处理审计待修订清单 **#7**（02 §五）：JWT 单 role 改为查库承载多角色+作用域。**纯鉴权架构决策，不新建业务表、不改表计数。**

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-114 是 token/鉴权架构决策，权限数据落在已设计的 UserRoleAssignment（§二 2.1），本条不新建表 / 不改字段；§一/§三/§四/§五 计数全不变 |
| 2. 与 02 权限模型一致 | ✅ | 02 §二代码实现思路（canDo 等级比较 + rolesInScope）天然契合方案 B「查库取 assignments 后判等级」；02 补 DR-114 实现注 |
| 3. 03 §8 权限改造对齐 | ✅ | 03 §8 JWT 修订条（原 #7）由「单 role→带 assignments（或改查库）」明确为「方案 B 查库+缓存」；permissions.ts 统一入口承接（连 #9）|
| 4. runbook 同步 | ✅ | token 全失效全员重登已在 runbook 角色迁移须知（DR-113）记录；DR-114 token 去 role 同属此次重登，无新增重登事件 |
| 5. 即时生效可落地 | ✅ | 查库 + 缓存失效（角色写操作后清该用户缓存）支持 D17 代行/撤销即时生效；与方案 A「等过期」相比满足学修体系硬要求 |
| 6. 与 #9 衔接 | ✅ | DR-114 的「requireRole 改查 assignments + 等级判定」落在 permissions.ts，正是 #9 权限改造统一点；本条定数据来源（查库），#9 定继承/作用域交集逻辑，不重叠 |
| 7. 审计待修订项对齐 | ✅ | 02 §五 #7 标「✅ 已处理（DR-114）」；03 §11 #7→✅ |

**本轮发现问题数**：0（DR-114 为用户决策；08 DR + 02 实现注 + 03 §8 + 审计回标一次到位）。
**结论**：待修订 #7 闭合。JWT 采方案 B：token 只留 sub/sid，权限每请求查 UserRoleAssignment + 短 TTL 缓存，角色变更/撤销即时生效；token 去 role 致已签发全失效需重登（并入 DR-113 迁移重登）。

---

### 检查轮次 62（2026-05-31，范围：DR-115 专业×届映射规则 · 迁移最大卡点 · 跨 02/03/08/runbook）

> 本轮处理审计待修订清单 **#8**（02 §五，迁移最大卡点 🔴）：现有班级如何归入 Program。**纯迁移规则决策，不新建业务表、不改表计数。**

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-115 是迁移归类规则，Program/programId 早已在 §1.1 设计；本条不新建表 / 不改字段；§一/§三/§四/§五 计数全不变 |
| 2. 与 Program 定义一致 | ✅ | 归类粒度 = code + cohortYear，与 §1.1 `@@unique([code, cohortYear])` 对齐；stage 由 Program 自带 |
| 3. 03/runbook 同步 | ✅ | 03 §9 迁移第 2 步由「人工补（卡点）」升级「阻断式硬门槛」+ 过渡期须知；runbook 迁移顺序 + 前置闸门检查清单；两处一致 |
| 4. 硬门槛逻辑自洽 | ✅ | 无占位专业 + 未归类不上线：迁移脚本校验「无 programId=null 存量 Class」方放行；保证 DR-113 enrollment 迁专业级、DR-114 作用域不拿空 programId |
| 5. 与 #6/#7 衔接 | ✅ | DR-115 是 DR-113（enrollment 迁专业级）、DR-114（major_id 作用域）的前置；P1→P2 闸门定位明确，不越界预判 #9 |
| 6. 排除方案有据 | ✅ | 排除自动推断 code（班名自由文本/法本非一对一）、createdAt 预填 cohortYear（创建年≠开班届）、占位专业（语义模糊+掩盖迁移未完成）三项均记理由 |
| 7. 审计待修订项对齐 | ✅ | 02 §五 #8 标「✅ 已处理（DR-115）」；03 §11 #8→✅ |

**本轮发现问题数**：0（DR-115 为用户决策；08 DR + 03 两处 + runbook + 审计回标一次到位）。
**结论**：待修订 #8 闭合。专业 code + 届 cohortYear 全部运营逐班人工填；无占位专业；未归类班级不能上线（P1→P2 阻断式硬门槛）。最大卡点的运营规则定案。

---

### 检查轮次 63（2026-05-31，范围：DR-116 项目阶段澄清 · 迁移/过渡类内容重新定位 · 跨 02/03/08/runbook）

> 本轮处理用户澄清「项目开发中·无客户·无生产数据」：把 DR-113/114/115 的迁移/过渡/重登/归类硬门槛部分标 N.A.（开发期不适用，保留备未来），目标设定/架构/约束部分仍有效。**纯定位调整，不新建表、不改表计数、不删历史 DR。**

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-116 是阶段定位决策，不新建表 / 不改字段；§一/§三/§四/§五 计数全不变 |
| 2. 前序 DR 不被篡改 | ✅ | DR-113/114/115 原文保留（append-only），DR-116 以「重新定位」叠加标注 N.A. 部分，不改写历史决策正文 |
| 3. 有效/失效边界清晰 | ✅ | 逐条列明：DR-113 目标角色映射有效/存量迁移 N.A.；DR-114 JWT 架构有效/token 重登 N.A.；DR-115 Program 归属约束有效/存量归类硬门槛 N.A. |
| 4. runbook/03 迁移章对齐 | ✅ | runbook §三 + 03 §9 加 ⏸「开发期不适用，备未来生产数据」横幅，整章保留不删 |
| 5. 与 07 一致 | ✅ | 与 07-integration-plan 开头「无生产数据库、文档融合非迁移」一致，本条把该原则贯彻到 DR-113/114/115 |
| 6. #9 不受影响 | ✅ | DR-116 明确权限改造统一点（#9）是纯架构、与数据无关，照常推进 |
| 7. 保留而非删除 | ✅ | 迁移类内容标 N.A. 保留供未来运营期参考，排除「直接删除」 |

**本轮发现问题数**：0（DR-116 为用户决策；08 DR + runbook + 03 横幅一次到位）。
**结论**：项目开发阶段定调。迁移/过渡/重登/归类硬门槛 = 开发期 N.A.（保留备未来）；目标角色映射/JWT 架构/Program 归属约束仍有效。#9 不受影响照常推进。

---

### 检查轮次 64（2026-05-31，范围：DR-117 权限改造统一点 · 最后一条待修订 · 跨 02/03/08）

> 本轮处理审计待修订清单 **#9**（02 §五，最后一条）：权限改造集中入口钉死。**纯架构决策，不新建业务表、不改表计数。**

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. DB 变更为零 | ✅ | DR-117 是代码架构决策（auth.ts/permissions.ts/class service），不新建表 / 不改字段；§一/§三/§四/§五 计数全不变 |
| 2. 与 02 权限模型一致 | ✅ | permissions.ts 的 ROLE_LEVEL + canDo 即 02 §二代码实现思路；与 DR-114（查库取 assignments）落点同一文件，不冲突 |
| 3. 现状核实准确 | ✅ | permissions.ts 不存在（待建）、auth.ts requireRole 工厂 line 62、class/service.ts 断言 853/866 均本会话核实 |
| 4. 数字校准 | ✅ | requireRole 实测 44 处（非审计 265）；02/03/runbook 加注修正，以 44 为准 |
| 5. 与 #7 衔接不重叠 | ✅ | DR-114 定「数据来源=查库取 assignments」；DR-117 定「逻辑落点=permissions.ts 继承+作用域交集」+「入口=requireRole 工厂/断言」，职责互补不重叠 |
| 6. 不受 DR-116 影响 | ✅ | 权限改造是纯架构、与数据无关；DR-116 已明确 #9 照常推进；本条无迁移/过渡内容 |
| 7. 审计待修订项对齐 | ✅ | 02 §五 #9 标「✅ 已处理（DR-117）」；03 §11 #9→✅；**9 条待修订全部闭合** |

**本轮发现问题数**：0（DR-117 为用户决策；08 DR + 03 §8/§11 + 审计回标 + 数字校准一次到位）。
**结论**：待修订 #9 闭合。权限改造三入口：auth.ts requireRole 工厂（改内核）+ permissions.ts（新建，等级继承+作用域交集+查库缓存）+ class service 断言；requireRole 校准 44 处。**至此审计 9 条待修订清单（#1-#9）全部闭合。**

---

### 检查轮次 65（2026-05-31，范围：DR-120 正向完整性核对 · 25 能力→字段支撑 · 补双向覆盖另半 · 跨 06/08）

> 接 DR-118/119 反向核对（从表/端点找盲区），本轮补正向另半：从 25 能力出发核对是否都有表/字段接住。派 agent 逐条核对，对 5 个实质 ⚠️ 字段缺口逐项处置。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 关联对称性 | ✅ | 新增 2 个 @relation 均双向对称：User.primaryProgramId ↔ Program.primaryUsers（"UserPrimaryProgram"，各 1 处共 2）；PracticeLog.programId ↔ Program.practiceLogs（"PracticeLogProgram"，各 1 处共 2）— grep 实测各 2 |
| 2. 字段与 06 对齐 | ✅ | User.primaryProgramId 对应 06 能力 2 `primary_major_id`（可空，UI 偏好），06 line 67/81 本就标「主修是 UI 偏好/可空」，方向一致；PracticeLog.programId/taskSourceType/source 值域对应 06 能力 6 约束 4 + 能力 9 约束 1 |
| 3. 表计数不变 | ✅ | G1/G4/G6 均给已在扩展区的 User(§1.9)/PracticeLog(§1.12) 加字段，不新增表；G2 复用既有 LessonCompletion+AuditLog；§一 扩展区仍 13 张，§二 3 / §三 15 / §四 / §五 全不变 |
| 4. Migration 覆盖 | ⏸ | 三个新字段（User.primaryProgramId、PracticeLog.programId、PracticeLog.taskSourceType）属字段级 migration，与既有 birthDate/prayerCount 同批；§十一 Migration 统编清单待 Phase 实施时一并补列（不阻塞设计封板）|
| 5. 待办标签完整 | ✅ | TODO-19（G2）标 ✅ 已闭合（走能力5代行）；TODO-20（G3 仪轨合规）标 ⏸ 待办（用户决策暂不加字段）；G5 应用层/G7=TODO-5/G8=TODO-AI-2 均已有归属 |
| 6. 业务规则有实现方式 | ✅ | source 必标→Zod 值域 manual/auto/ai_assistant；taskSourceType→Zod course/class_task/self；programId 跨专业溯源→应用层升学预检按 programId 聚合；G2 转入报圆满→能力5代行+AuditLog；均注明落点 |

**本轮发现问题数**：0（正向核对 ❌ 硬缺口=0；8 个 ⚠️ 字段缺口全部逐项处置，3 补字段 + 1 走代行 + 1 挂待办 + 3 已有归属）。
**结论**：正向完整性核对闭合（DR-120）。**双向覆盖首次闭环**——反向（DR-118/119 表/端点找盲区）+ 正向（本轮能力找字段缺口）合璧。设计对 25 能力主体表 100% 就位，无硬缺口；补 User.primaryProgramId / PracticeLog.programId+taskSourceType 三字段，G2 走能力5代行，G3 挂 TODO-20。§一 扩展区仍 13 张。

---

### 检查轮次 66（2026-05-31，范围：DR-121 实修域「设计 vs 线上现状」根本落差定性定向 · 跨 03/04/08）

> 理清 PracticeEntry↔PracticeLog 命名（DR-118 遗留待办）时，三重核查挖出根本落差，远超命名。本轮定性 + 用户定向 + 配套文档对齐。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 事实核查三重证据 | ✅ | (a) grep 全仓 .ts/.tsx/.prisma：UserPracticeVow/PracticeLog/PracticeTemplate/PracticeJournal 各 0 处；(b) 后端实际 7 张 prisma.practiceX（Category/Project/Entry/DailySummary/Goal/Makeup/Task）；(c) Meditation 表注释 + 审计 01 line 84「观修不做计数」——三证一致 |
| 2. 用户定向明确落盘 | ✅ | 「一切按新设计做、目前项目改造成新设计方案」+「观修计入升学随此定」→ DR-121：设计为目标、线上打卡器为改造源、DR-111 成立 |
| 3. 受影响决策标注 | ✅ | DR-91/94/95/111/120 所加字段有效但承载表（PracticeLog/UserPracticeVow）改判改造新建；DR-121 作为后修订层声明，不逐条重写封板 DR（沿用 DR-108 修订 DR-74 的惯例）|
| 4. 配套文档对齐 | ✅ | 03 §5 簇A 撤「净资产」改「改造源」；03 §9 迁移难度「打卡🟢易」改🔴难（结构性重构）；03 §5 note + 04 两处 note 全升级为 DR-121 定性 |
| 5. 遗留功能防丢失 | ✅ | 线上打卡器配套（补签/排行/目标/大类字典）新设计无显式等价物 → 登记 TODO-21，改造细化时逐一确认去留，禁静默丢失 |
| 6. 表计数影响 | ⏸ | PracticeLog/UserPracticeVow 由「扩展现有」改判「改造新建」，§一「扩展区 13 张」的计数口径在实现期需复核（本轮仅定性，不改 §一/§三计数，避免连锁 churn；留实修模型改造细化时统一）|

**本轮发现问题数**：1（实修域设计建在 4 张幻影表上、且观修计数反转线上既定决策——已定性 DR-121、用户定向、配套对齐）。
**结论**：DR-118 遗留的「命名待理清」升级为 DR-121「根本落差定性定向」。用户拍板一切按新设计改造。实修域成为**已知重大改造区**（非「易·加字段」），配套能力去留挂 TODO-21。本轮不动表计数（留改造细化时统一），仅定性 + 防功能静默丢失。

---

### 检查轮次 67（2026-05-31，范围：DR-122 实修模型改造细化方案 · 11 表逐张定归宿 · TODO-21 闭合 · 跨 08）

> 接 DR-121 定向，本轮把实修域 11 张表（线上 7 真实 + 设计 4 幻影）逐张定归宿，闭合 TODO-21。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 11 表全部有归宿 | ✅ | 3 保留（Category/Project/Makeup）+ 2 改造新建（Entry→Log、UserPracticeVow）+ 2 折叠（Goal→Vow、心得→Log.note）+ 1 归并（Task→ClassTask）+ 3 废弃（DailySummary/Journal/Template）= 11，无遗漏 |
| 2. 用户 4 决策落盘 | ✅ | Q1 排行废表实时算 / Q2 补签保留 / Q3 心得折叠 / Q4 Template 废弃——均入 DR-122 + TODO-21 闭合 |
| 3. §1.7/§1.12 改判对齐 | ✅ | UserPracticeVow ✅封板→🆕改造新建（折叠 Goal）；PracticeLog 🔧→🆕改造新建（Entry 改造、source 值域改、note 承载心得）；判定段+参考决策已改 |
| 4. §四清单对齐 | ✅ | PracticeTemplate/PracticeJournal 改 ❌废弃；补 PracticeCategory/PracticeMakeup ✅保留；PracticeLog 行改 🆕改造新建 |
| 5. 折叠去重无冲突 | ✅ | PracticeGoal @@unique([userId,projectId]) 与 UserPracticeVow @@unique([userId,practiceProjectId]) 同维度，折叠后约束一致；心得折叠 note 不与 Note 表冲突（Note 是独立笔记，打卡心得走 Log.note 轻量）|
| 6. 表计数影响 | ⏸ | 净效应：废 3（DailySummary/Journal/Template）+ 改造新建 2（Vow/Log，原误列复用/扩展）+ 保留 2（Category/Makeup）。§一/§三/§四 精确计数留实修域 migration 统编时一次校准（DR-121 已定基调，避免逐次 churn）|

**本轮发现问题数**：0（11 表归宿清晰，4 决策落盘，配套段落对齐）。
**结论**：DR-122 实修模型改造蓝图定稿，TODO-21 闭合。实修域从「已知重大改造区」推进到「改造方案明确」：哪张保留、哪张改造新建、哪张折叠、哪张废弃全部钉死。精确表计数留 migration 统编校准。**至此「理清 PracticeEntry↔PracticeLog + 簇A 配套表」待办全部闭合**（DR-118 发现→DR-121 定向→DR-122 细化）。

---

### 检查轮次 68（2026-05-31，范围：DR-123 实修域改造落地 · ClassTask 映射 + Migration + 表计数校准 + PracticeTemplate 纠正 · 跨 08）

> 用户「做 1 和 2」：task1=ClassTask←PracticeTask 字段映射，task2=实修域 migration 清单 + 表计数校准。落地中**发现并纠正 DR-122 一处事实错误**（PracticeTemplate 承重表误判废弃），并修一处文档损伤（§1.12 标题重复）。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. PracticeTemplate 纠正 | ✅ | 核查 CohortRecommendedTemplate.templateId FK（§1.8）+ DR-36 运行时读 defaultDailyTarget——承重表，废弃→🆕改造新建（§三）。DR-123 + TODO-21 + §四列表 + §三注 + M3e 四处同步 |
| 2. ClassTask←PracticeTask 映射（task1）| ✅ | §3.14 加映射表：scope 拆流（class→ClassTask / self→UserPracticeVow），10 字段逐一对应；fixed 缺口挂 TODO-22 防静默丢失 |
| 3. 表计数校准（task2）| ✅ | §一 13→12（标题+注+M1+11.3）；§三 15→17（标题+注+11.3+M3e）；§四 22 不变（−Template−Journal+Category+Makeup 净 0，11.3 注明）。三区计数自洽 |
| 4. Migration 完整（task2）| ✅ | M1 含 PracticeLog=rename PracticeEntry+加列（移除 UserPracticeVow）；新增 M1.5 改造源清理（Goal/Task/DailySummary）；新增 M3e（UserPracticeVow/PracticeTemplate）；11.3 三区核对：§一12→M1、§三17→M3a~e(2+4+3+6+2)、§四22 不入 migration |
| 5. 关联对称性 | ✅ | UserPracticeVow.classTaskId↔ClassTask.vows（§3.14 已有 vows 反向）；UserPracticeVow.cohortTemplateId↔CohortRecommendedTemplate.vows（§1.8 已有）；PracticeTemplate↔CohortRecommendedTemplate.template（§1.8 已有 FK）；PracticeLog.vowId↔UserPracticeVow.logs（§1.7 已有）。新建表反向关联均已就位 |
| 6. 文档损伤修复 | ✅ | §1.12 标题此前误重复（833+835 两行相同），本轮合一并更新为「改造扩展自 PracticeEntry」+ 计数口径注 |
| 7. 物理编号 vs 计数口径 | ✅ | §1.7/§1.12 物理保留原位（不迁移避免大幅重排），计数口径以 DR-123 为准——同 DR-110「5→4」惯例；§一注/§三注均注明「编号物理保留、计数归本区」 |

**本轮发现问题数**：2（PracticeTemplate 误判废弃→已纠正；§1.12 标题重复→已修），均当轮闭合。
**结论**：DR-123 实修域改造落地。用户「1 和 2」双任务完成——ClassTask←PracticeTask 映射（task1）+ Migration 清单 M1/M1.5/M3e + 表计数校准 §一12/§三17/§四22（task2）。顺带纠正 DR-122 的 PracticeTemplate 承重表误判、修复 §1.12 标题重复。**实修域改造从「方案明确」推进到「字段映射 + migration + 计数全部落地」**。TODO-22（fixed 班级任务）为唯一待确认项。

---

### 检查轮次 69（2026-05-31，范围：DR-124 班级任务多周期 · ClassTask 加 period · TODO-22 闭合 · 跨 08）

> TODO-22 问用户「是否需要 fixed 班级任务」，用户指出班级任务本就可能「以时间为单位」（每周 3 座禅修、每天 1000 遍心咒），故不止补 fixed，补齐 daily/weekly/fixed 三周期。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. ClassTask 字段扩展 | ✅ | 加 period（daily/weekly/fixed）+ weeklyTarget + targetCount；dailyTarget Int→Int?；endDate（fixed 必填）。字段表 + prisma model 同步 |
| 2. 约束配套 | ✅ | 加 Zod 约束：period↔target 配套（daily→dailyTarget / weekly→weeklyTarget / fixed→targetCount+endDate）；period 值域 daily/weekly/fixed |
| 3. 达标率三口径 | ✅ | 设计意图 + 达标率定义改：daily 按天 / weekly 按周 / fixed 按期间累计达成；CohortLagSnapshot.taskLag（能力 14）按 period 分流 |
| 4. 映射表更新 | ✅ | PracticeTask mode→period（daily/fixed 有落点 + 新增 weekly）；target 行三字段分流；删重复 mode 行；fixed 缺口警告块改 ✅ 已闭合 |
| 5. 与 UserPracticeVow 对齐 | ✅ | ClassTask period（daily/weekly/fixed）平行 UserPracticeVow.targetPeriod（daily/weekly/lifetime）；班级任务有区间用 fixed 而非 lifetime，差异注明 |
| 6. TODO-22 闭合 | ✅ | TODO-22 标 ✅ 已闭合（DR-124）；DR-124 入 §八；本轮检查轮次 69 |
| 7. Migration 无结构变化 | ✅ | ClassTask 是 §三新建表（M3d），加字段在建表 DDL 内，不需额外 ALTER；§一/§三/§四 计数不变（12/17/22） |

**本轮发现问题数**：0（多周期扩展干净落地）。
**结论**：DR-124 班级任务多周期落地，TODO-22 闭合。ClassTask 从纯每日制扩为 daily/weekly/fixed 三周期，承接线上 PracticeTask mode=fixed 并按用户需求新增 weekly（每周 N 座/遍）。**实修域 + 班级任务改造全部闭合**——DR-118 发现→121 定向→122 蓝图→123 落地→124 多周期，TODO-21/22 均闭合。表计数稳定 §一12/§三17/§四22。

---

### 检查轮次 70（2026-05-31，范围：DR-125 功能级反向核对 · 补登记能力 26-31 · 跨 06/08）

> 接 DR-118~124（model+端点级），本轮下沉功能级——自扫线上前后端，挖出 6 个「线上有、新设计没正经体现」的用户功能/自动化规则，用户逐个确认全部纳入，补登记能力 26-31。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 盲区穷尽 | ✅ | 自扫 juexue-v2(159 文件)+backend(166 文件)，排除 DR-118~124+净资产，挖出 6 真盲区（agent 卡住后改自扫，代码库 6 万行规模适中）|
| 2. 用户逐个确认 | ✅ | A-F 6 个全部"纳入"（A/B/C 先确认，D/E/F 后补确认）→ 能力 26-31 |
| 3. 06 落盘 | ✅ | 新增「能力 26-31：线上已实现功能补登记」整章，每条业务意图/规则/输入输出/绝对约束/对老项目影响齐备，均 ✅ 线上已实现·纳入设计标签 |
| 4. 08 落盘 | ✅ | DR-125（核对结论+6 盲区明细+落盘+排除方案）+ TODO-23（能力 29 数据源迁移）+ 本检查轮次 70 |
| 5. 表计数影响 | ✅ | 0 新表——6 能力全复用现有表/净资产（StudyRanking 聚合查询/ClassSession+DharmaAssembly/AuthSession/Practice*+Notification/UserAchievementUnlock/Question+LLM 网关）；§一12/§三17/§四22 不变 |
| 6. 改造关联标注 | ✅ | 能力 29 个人提醒读 PracticeGoal/Task/DailySummary（已折叠/废弃）→ TODO-23 标注数据源须迁 UserPracticeVow+实时聚合；能力 26 排行数据源随 DR-122 对齐；能力 31 复用 LLM 网关（DR-108 同源）|
| 7. 功能标签完整 | ✅ | 6 能力均打 ✅ 线上已实现·纳入设计；能力 29 额外挂 ⚠️ 改造关联（TODO-23）；无无标签暧昧状态 |

**本轮发现问题数**：0（6 盲区清晰登记，数据源改造关联已标注）。
**结论**：DR-125 功能级反向核对闭合。从 model+端点级（DR-118~124）下沉到功能级，补齐 6 个线上已实现但未登记的能力（26-31）。**至此反向核对三层级全覆盖**：表级 + 端点级（DR-118/119）+ 功能级（DR-125）。无新表，计数稳定 §一12/§三17/§四22。能力 29 数据源迁移挂 TODO-23 待实修域改造时处理。

---

### 检查轮次 71（2026-05-31，范围：DR-126 第二轮功能级核查 · 能力 32 题库答题（逐条第 1 条）· 跨 06/08）

> 用户指出 DR-125 核查不全（藏历/画报/系统公告/通知推送未登记），完整差集核查找出 17 个净资产孤儿，**逐条讨论补登记**。本轮落第 1 条：能力 32 题库答题与判分。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 漏核根因定性 | ✅ | 「净资产=表保留」误等同「功能已登记」，整层跳过——DR-126 明确记录此方法性漏核 |
| 2. 完整差集 | ✅ | 76 前端页 × 31 能力，找出 17 孤儿（A 学习引擎 7/B 运营内容 4/C 账户通知 6），DR-126 列全 |
| 3. 逐条节奏 | ✅ | 用户要求每条逐个讨论；能力 32 草案确认后才写入；06 章首「进度」标注 32✅ 余 16 待确认 |
| 4. 能力 32 落盘 | ✅ | 06 新增能力 32（业务意图/14 题型/三类判分/输入输出/衔接/约束/对老项目影响齐备，✅ 标签）；08 DR-126 + 本检查轮次 71 |
| 5. 题型/判分准确 | ✅ | 14 题型对齐线上 QuestionType 枚举（grep 核实：single/fill/multi/open/sort/match/verse/chain/flip/image/listen/flow/guided/scenario）；三类判分对齐 answering/ 判分器 |
| 6. 表计数影响 | ✅ | 复用 Question/UserAnswer 净资产，无新表；§一12/§三17/§四22 不变 |
| 7. 标签完整 | ✅ | 能力 32 打 ✅ 线上已实现·纳入设计；DR-126 标「进行中」（余 16 条待逐条） |

**本轮发现问题数**：0（能力 32 单条干净落盘）。
**结论**：DR-126 启动，能力 32（A1 题库答题与判分）逐条落地完成。纠正了 DR-125 把净资产层整体跳过的漏核——17 孤儿已列全，逐条补登记中。无新表，计数稳定。待用户「下一条」继续 A2（SM2 间隔复习）。

---

### 检查轮次 72（2026-05-31，范围：DR-126 逐条第 2 条 · 能力 33 SM-2 间隔复习 · 跨 06/08）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 能力 33 落盘 | ✅ | 06 新增能力 33（业务意图/复习流程/4 档评分/SM-2 算法/到期队列/状态机/衔接/约束/对老项目影响齐备，✅ 标签）|
| 2. 算法细节准确 | ✅ | 对齐 Sm2Card 表（easeFactor/interval/repetitions/dueDate/status）+ 4 档评分（0-3）对齐前端 Sm2ReviewPage + sm2/algorithm.ts |
| 3. 衔接关系 | ✅ | 与能力 32（flip 驱动）、能力 34（错题复习）衔接标注；@@unique([userId,questionId]) 每用户每题一卡 |
| 4. 进度更新 | ✅ | 06 章首进度行更新「32✅ 33✅ 余 15」 |
| 5. 表计数影响 | ✅ | 复用 Sm2Card 净资产，无新表；§一12/§三17/§四22 不变 |

**本轮发现问题数**：0。
**结论**：能力 33（A2 SM-2 间隔复习）逐条落地。A 组学习引擎已补 2/7（题库答题、SM-2 复习）。无新表，计数稳定。待「下一条」A3 错题本。

---

### 检查轮次 73（2026-05-31，范围：DR-126 逐条第 3 条 · 能力 34 错题本 · 跨 06/08）

> 用户追问「为什么错题本软删除」——核查 mistakes.ts 确认软删有真实业务理由（非烂实现），补 WHY 后落盘。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 能力 34 落盘 | ✅ | 06 新增能力 34（自动收集/列表筛选/刷错题/软删移除/详情/级联，✅ 标签）|
| 2. 软删 WHY 补全 | ✅ | 核查 mistakes.ts：软删因 ① wrongCount 累计错次跨「移除→再错→复活」保留 ② 配合 @@unique 复活同一行避免重复行——规则 4 已写明，非「不物理删」一句带过 |
| 3. 衔接关系 | ✅ | 与能力 32（答错来源）、33（错题复习）、35（同属「我的题目」工具）衔接标注 |
| 4. 进度更新 | ✅ | 06 章首进度行「32/33/34✅ 余 14」|
| 5. 表计数影响 | ✅ | 复用 UserMistakeBook 净资产，无新表；§一12/§三17/§四22 不变 |

**本轮发现问题数**：0。
**结论**：能力 34（A3 错题本）逐条落地。A 组学习引擎已补 3/7。软删机制 WHY 已说清（累计错次 + 复活）。无新表，计数稳定。待「下一条」A4 收藏夹。

---

### 检查轮次 74（2026-05-31，范围：DR-126 逐条第 4 条 · 能力 35 题目收藏夹 · 跨 06/08）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 能力 35 落盘 | ✅ | 06 新增能力 35（添加移除/幂等/列表筛选/剥答案/级联，✅ 标签）|
| 2. 幂等机制准确 | ✅ | 对齐 favorites 路由：create-first + 捕 P2002 幂等；@@unique([userId,questionId]) |
| 3. 衔接关系 | ✅ | 与能力 32（收藏题目）、34（同属「我的题目」工具集）衔接标注 |
| 4. 进度更新 | ✅ | 06 章首进度行「32/33/34/35✅ 余 13」|
| 5. 表计数影响 | ✅ | 复用 UserFavorite 净资产，无新表；§一12/§三17/§四22 不变 |

**本轮发现问题数**：0。
**结论**：能力 35（A4 收藏夹）逐条落地。A 组学习引擎已补 4/7。无新表，计数稳定。待「下一条」A5 笔记本体+高亮。

---

### 检查轮次 75（2026-05-31，范围：DR-126 逐条第 5 条 · 能力 36 笔记与高亮 · 跨 06/08）

> 用户确认笔记可见性 private/class 两档符合设计后落盘。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 能力 36 落盘 | ✅ | 06 新增能力 36（笔记 CRUD/段落锚点/可见性/置顶归档/高亮 4 色/全文搜索/举报衔接，✅ 标签）|
| 2. 与 25.C 区分 | ✅ | 25.C 是笔记 AI 文本加工，能力 36 是笔记/高亮 CRUD 本体——明确标注不重叠 |
| 3. 可见性确认 | ✅ | 用户确认 private（默认）/class 两档符合设计；高亮仅个人可见 |
| 4. 衔接关系 | ✅ | 与能力 3（阅读记笔记）、25.C（笔记 AI）、47（共享笔记举报）衔接标注 |
| 5. 进度更新 | ✅ | 06 章首进度行「32-36✅ 余 12，A 组 5/7」|
| 6. 表计数影响 | ✅ | 复用 Note/Highlight 净资产，无新表；§一12/§三17/§四22 不变 |

**本轮发现问题数**：0。
**结论**：能力 36（A5 笔记与高亮）逐条落地。A 组学习引擎已补 5/7（题库/SM-2/错题/收藏/笔记高亮）。无新表，计数稳定。待「下一条」A6 法本阅读器+进度。

---

### 检查轮次 76（2026-05-31，范围：DR-126 逐条第 6 条 · 能力 37 法本阅读器 + DR-127 完成记录机制冲突 · 跨 06/08）

> 登记能力 37 时核查阅读完成写入路径，挖出完成记录机制冲突（线上课程级数组 vs 新设计 LessonCompletion 表），用户要求先查实下游影响范围再落盘——grep 确认 6 处依赖、判定端已是目标态。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 能力 37 落盘 | ✅ | 06 新增能力 37（沉浸阅读器/心跳上报/双阈值完成判定/阅读统计/⚠️改造关联，✅ 标签）|
| 2. 完成机制冲突核查 | ✅ | grep 全仓确认：写端 reading/meditations 2 处、读端 courses/enrollment/dossier/smart-practice 4 处依赖 lessonsCompleted 数组；新设计判定走 LessonCompletion（DR-92）是另一套机制 |
| 3. 关键澄清 | ✅ | 非「幻影表」（DR-121 那种），是机制统一迁移；判定端（LessonCompletion）已是目标态无需改，要改写入端+读取端对接 |
| 4. DR-127 + TODO-24 | ✅ | DR-127 记冲突定性+下游 6 处+处理方向；TODO-24 列写入/读取两端迁移清单，挂 DR-113 实现时 |
| 5. 进度更新 | ✅ | 06 章首进度行「32-37✅ A 组 6/7 余 A7 成就徽章本体」 |
| 6. 表计数影响 | ✅ | LessonReadingProgress 复用净资产，无新表；§一12/§三17/§四22 不变 |

**本轮发现问题数**：1（完成记录机制冲突——已定性 DR-127、查实下游、挂 TODO-24）。
**结论**：能力 37（A6 法本阅读器）逐条落地，顺带挖出并定性 DR-127 完成记录机制冲突（同 DR-121 类，但是机制迁移非幻影表）。A 组学习引擎已补 6/7。无新表，计数稳定。待「下一条」A7 成就徽章本体。

---

### 检查轮次 77（2026-05-31，范围：DR-126 逐条第 7 条 · 能力 38 成就徽章 ⏸ 暂缓 + 联动能力 30 · 跨 06/08）

> 逐条登记 A7 成就徽章，用户决策「暂时不做、只做后台关键部分」（同 DR-109 调子），打 ⏸ 标签并联动调整能力 30。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 能力 38 ⏸ 落盘 | ✅ | 06 能力 38 打 ⏸ 暂不作正式功能上线，仅登记现状（5 类徽章/BADGES 常量/派生/解锁），保留后台不扩展 |
| 2. 联动能力 30 | ✅ | 能力 30（DR-125 原 ✅）修订为 ⏸——徽章本体暂缓则解锁通知随之暂缓；cron 后台保留（聚合标记 notifiedAt 避免堆积），徽章上线即恢复 |
| 3. 标签一致性 | ✅ | 能力 38/30 同步 ⏸，DR-128 记联动逻辑；同 25.C/DR-109「只做后台必要部分」调子 |
| 4. 登记非删除 | ✅ | 用户选「只做后台关键部分」非「去掉」，保留后台 + ⏸ 标签（功能标签铁律，避免净资产孤儿）|
| 5. 进度更新 | ✅ | 06 章首「A 组 7/7 完成（6 纳入 + 1 暂缓）」；下一组 B 运营内容 4 条 |
| 6. 表计数影响 | ✅ | UserAchievementUnlock 净资产保留，无新表；§一12/§三17/§四22 不变 |

**本轮发现问题数**：0（A7 暂缓决策清晰，联动一致）。
**结论**：能力 38（A7 成就徽章）⏸ 暂不作正式功能（只保留后台），联动能力 30 同步 ⏸。**A 组学习引擎 7/7 全部处理完**（6 纳入 + 1 暂缓）。无新表，计数稳定。待「下一条」进 B 组运营内容（藏历/画报/系统公告/法会）。

---

### 检查轮次 78（2026-05-31，范围：🔴 DR-129 LessonCompletion 幻影表纠正 + 能力 39 音视频学习 · 表计数 §三18/§四21 · 跨 06/08）

> 用户追问「音视频学习+计数查了吗」——核查挖出 LessonCompletion 是幻影表（同 DR-121 类，且是闻思判定基石），用户「按我建议补全」。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 幻影表事实核查 | ✅ | grep `^model LessonCompletion`=0 铁证不存在；08 §四误标「✅ 确认复用 DR-72」；线上音视频有内容（LessonResource type=audio/video）但不记完成 |
| 2. 缺口定性 | ✅ | 大纲盲(听≥2)/聋(看≥2)硬规则要分维度 COUNT，线上粗粒度 UCE.lessonsCompleted 做不到；LessonCompletion 支撑能力 3/9/14/26 却是幻影 |
| 3. DR-129 + 能力 39 | ✅ | DR-129 纠正幻影表→🆕新建（M3f）+ 两层结构；能力 39 音视频学习落 06（A8）|
| 4. 表计数校准 | ✅ | §三 17→18（+LessonCompletion，标题+注+11.3+M3f 同步）；§四 22→21（−LessonCompletion，11.3 同步）；§一12 不变 |
| 5. 修正 DR-127 前提 | ✅ | TODO-24 原「LessonCompletion 已是目标态无需改」修正为「须先新建（M3f）再机制统一」 |
| 6. 待办登记 | ✅ | TODO-25 音视频播放达标阈值待定；TODO-24 前提已修 |
| 7. 进度更新 | ✅ | 06 章首「A 组 8 条（7 纳入+1 暂缓），含核查挖出 A8」|

**本轮发现问题数**：1（LessonCompletion 幻影表——已纠正 DR-129、补能力 39、表计数校准、修 DR-127 前提）。
**结论**：DR-129 纠正闻思判定基石 LessonCompletion 幻影表（08 误标复用），补能力 39 音视频学习 + 分维度听/看完成计数（满足大纲盲/聋判定）。**表计数变动：§三新建 17→18、§四复用 22→21**（LessonCompletion 移位），§一扩展 12 不变。这是 DR-121 实修域、DR-123 PracticeTemplate 之后第 3 个「08 误标复用、实为幻影/新建」的纠正——印证用户两轮质疑「核查不全」的价值。待「下一条」进 B 组运营内容。

---

### 检查轮次 79（2026-05-31，范围：🔴🔴 DR-130 全量复用表存在性体检 · 17 表改判线上无·实为新建 · 跨 08）

> 连撞 5 个幻影表后用户两轮质疑「核查不全」，遂做全量 grep 体检（08 复用/扩展表 × 线上 60 表）。用户决策「一切按新设计、不改代码」——逐表改现状标签。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 全量体检方法 | ✅ | 提取 08 所有标「复用/旧设计已有/扩展」表名，逐一 `grep "^model X" schema.prisma` 对照线上 60 表 |
| 2. 体检结论 | ✅ | 标「复用」真实仅 8、幻影 12；§一「扩展」真实仅 4（User/Class/Course/ClassMember）、其余 9 线上无 |
| 3. 根因定性 | ✅ | DR-72 批量复用是对照旧设计文档打勾、从未 grep 验证线上——DR-121/123/129 逐个撞幻影的根源 |
| 4. 逐表改标签 | ✅ | §一 5 表标题（Program/StudyRecord/SpeakingGrade组/CohortLagSnapshot/CohortRecommendedTemplate）+ §四 12 表状态列，均改「🆕 线上无·实为新建（DR-130）」 |
| 5. 设计内容不动 | ✅ | 用户「一切按新设计」——只改现状标签（以为线上有→实为新建），表字段/设计全有效；DR-72 加重大后修订注、§四加现状校正横幅 |
| 6. 不改代码 | ✅ | 纯文档现状标签校正，零代码改动 |
| 7. 认知校正 | ✅ | 线上=轻量「学习+答题+打卡」App；新设计=完整「学修管理系统」，主体从零新建——DR-130 建立可信现状基线 |

**本轮发现问题数**：17（标复用/扩展实为幻影——§一 5 + §四 12，已逐表改判 DR-130）。
**结论**：DR-130 全量复用表存在性体检完成。这是第 4 轮、最彻底一轮「08 误标复用、实为新建」纠正——共揪出 17 表（叠加此前 DR-121/123/129 的 5 表，08 误标复用/扩展的幻影表基本清完）。**复用区分类此前整体不可信，本轮 grep 体检建立可信现状基线**。设计内容全有效，错的只是现状标签。用户「一切按新设计、不改代码」——文档现状标签已校正。计数维持设计口径（§一12/§三18/§四21，含 DR-129）。

---

### 检查轮次 80（2026-05-31，范围：DR-126 逐条第 8 条（B1）· 能力 40 藏历日历 · 跨 06/08）

> DR-130 体检后回到 B 组逐条。按 DR-130 教训，每个表先 grep 验证存在性——B 组 4 表（TibetanDay/HomePoster/SystemAnnouncement/DharmaAssembly）grep 全=1 真实存在。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 存在性先验 | ✅ | B 组 4 表 grep 全=1 真实存在（吸取 DR-130 教训，不再假设）|
| 2. 能力 40 落盘 | ✅ | 06 新增能力 40（藏历页/数据结构/查询接口/admin 维护，✅ 标签）|
| 3. 数据结构准确 | ✅ | 对齐 TibetanDay（公历↔农历↔藏历/月名/闰日/tags/auspicious/events/假日）|
| 4. 衔接关系 | ✅ | 与能力 27 综合活动列表（文化日历背景）衔接 |
| 5. 进度更新 | ✅ | 06 章首「B 组能力 40✅（B1 藏历）」|
| 6. 表计数影响 | ✅ | 复用 TibetanDay 净资产，无新表；§一12/§三18/§四21 不变 |

**本轮发现问题数**：0。
**结论**：能力 40（B1 藏历日历）逐条落地。B 组运营内容 1/4。无新表，计数稳定。待「下一条」B2 首页画报。

---

### 检查轮次 81（2026-05-31，范围：DR-126 逐条第 9 条（B2）· 能力 41 首页画报 · 跨 06/08）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 存在性 | ✅ | HomePoster grep=1 真实存在 |
| 2. 能力 41 落盘 | ✅ | 06 新增能力 41（首页画报背景/数据结构/admin 维护/上传，✅ 标签）|
| 3. 数据结构准确 | ✅ | 对齐 HomePoster（year/month 唯一/imageUrl/caption）+ 接口（current/admin upsert/upload）|
| 4. 衔接关系 | ✅ | 与能力 40 藏历（画报点击进藏历 + 叠加藏历信息）衔接 |
| 5. 进度更新 | ✅ | 06 章首「B 组能力 41✅（B2 画报）」|
| 6. 表计数影响 | ✅ | 复用 HomePoster 净资产，无新表；§一12/§三18/§四21 不变 |

**本轮发现问题数**：0。
**结论**：能力 41（B2 首页画报）逐条落地。B 组运营内容 2/4。无新表，计数稳定。待「下一条」B3 系统公告。

---

### 检查轮次 82（2026-05-31，范围：DR-126 逐条第 10 条（B3）· 能力 42 系统公告 + D 组拆法确立 · 跨 06/08）

> 用户追问「系统公告与通知推送/短信是不是两个模块」——核查通知链路：系统公告=内容层，dispatchToUsers=派发层（站内信 ✅ + Web Push ✅），SMS 占位未实现。用户「都要做、逐条确认」，确立 D 组通知与触达 4 条拆法（按业务面非技术表）。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 存在性 | ✅ | SystemAnnouncement grep=1 真实存在；区别于 ClassAnnouncement（班级公告）|
| 2. 通道现状核实 | ✅ | dispatchToUsers→站内 Notification ✅+Web Push（VAPID）✅；SMS 仅占位（channel 预留，无服务商）|
| 3. 能力 42 落盘 | ✅ | 06 新增能力 42（发布/撤回/改内容/学员侧 + 通道现状标注 + SMS 指向能力 45）|
| 4. D 组拆法 | ✅ | 4 条：B3 系统公告✅ + D1 通知中心与派发（能力 43）+ D2 定时规则（能力 44）+ D3 短信（能力 45，🆕）|
| 5. 联动关系 | ✅ | 联动能力 43 通知派发（发布触发/点击跳转/撤回置灰）；区别班级公告 |
| 6. 进度更新 | ✅ | 06 章首「能力 42✅（B3）+ D 组 4 条拆法规划」|
| 7. 表计数影响 | ✅ | 复用 SystemAnnouncement 净资产，无新表；§一12/§三18/§四21 不变（能力 45 短信新建待 D3 评估）|

**本轮发现问题数**：0。
**结论**：能力 42（B3 系统公告）逐条落地，并确立 D 组通知与触达 4 条拆法（按业务面切分，吸取能力 30「通知本体未登记」教训）。SMS 缺口明确指向能力 45（D3，唯一新建，待服务商/场景决策）。无新表（短信表待 D3 评估），计数稳定。待「下一条」D1 通知中心与派发（能力 43）。

---

### 检查轮次 83（2026-05-31，范围：DR-126 逐条第 11 条（D1）· 能力 43 通知中心与派发 + D2 提醒规则需求确认 · 跨 06/08）

> 用户提出「学习进度落后/未完成班级任务/未完成个人任务/班级放假」要提醒，问「还有哪些需补充」。核查 10 个 EventKind 触发模块 + cron 现状（现仅开课/功课截止/成就/个人提醒）→ 用户提的 4 个线上均无。补充 4 个同类（闻思未圆满/复习到期/讲考临近/升学关怀），用户决策「全部补入」（8 条提醒规则归 D2 能力 44 逐条列清）。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 存在性 | ✅ | Notification/PushSubscription/NotificationDispatchLog/NotificationPreference grep 全=1 真实存在 |
| 2. 能力 43 落盘 | ✅ | 06 新增能力 43（A 派发引擎/B 通知中心/C Web Push/D 偏好 + EventKind×触发模块对照表）|
| 3. EventKind 溯源 | ✅ | 10 个事件类型逐一 grep 触发模块（class_session→cron/sessions 等），即时/定时分类标注 |
| 4. D2 需求确认 | ✅ | 用户 4 个（进度落后/班级任务/个人任务/放假）+ 补充 4 个（闻思/复习/讲考/升学关怀）=8 条，「全部补入」→ 能力 44 逐条列清 |
| 5. 联动关系 | ✅ | 触达底座：能力 42/29/30/44/B4 法会/班级公告均经本引擎；区别能力 44（即时 vs 定时）；预留能力 45 短信 |
| 6. 进度更新 | ✅ | 06 章首「能力 43✅ + D2 待列 8 条提醒规则」|
| 7. 表计数影响 | ✅ | 复用 4 表净资产，无新表；§一12/§三18/§四21 不变（D2 提醒规则复用 NotificationRule + 各业务源表）|

**本轮发现问题数**：0（D2 的 8 条提醒规则线上未实现，但属能力 44 待逐条设计，非本轮问题）。
**结论**：能力 43（D1 通知中心与派发）逐条落地，作为所有主动触达能力的基建底座。确认 D2 定时通知规则将列 8 条新提醒（用户 4 + 补充 4，「全部补入」）。无新表，计数稳定。待「下一条」D2 定时通知规则（能力 44）逐条列清 8 条提醒。

---

### 检查轮次 84（2026-05-31，范围：DR-126 逐条第 12 条（D2）· 能力 44 定时通知规则 8 条 + DR-131 · 跨 06/08）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 机制存在性 | ✅ | NotificationRule grep=1；现有 3 triggerType（evening-due/daily-digest/weekly-report）范式可复用 |
| 2. 能力 44 落盘 | ✅ | 06 新增能力 44（机制 + 8 条规则表：triggerType/触发条件/数据源/收件人/频率）|
| 3. 8 条规则完整 | ✅ | 用户 4（进度落后/班级任务/个人任务/放假）+ 补充 4（闻思/复习/讲考/升学关怀），逐条列触发条件/数据源/收件人/频率 |
| 4. DR-131 记录 | ✅ | 决策过程 + 排除项（只做 4 个 / 建独立表）+ 收件人分流 + critical 待决策挂 TODO |
| 5. 依赖关系 | ✅ | 依赖能力 43 派发；依赖数据源表（CohortLagSnapshot/LessonCompletion/Sm2Card/CohortRestWeek/SpeakingSession/Exam/AdvancementRecord/CareWatchlistItem）|
| 6. 进度更新 | ✅ | 06 章首「能力 44✅（D2，8 条规则）」|
| 7. 表计数影响 | ✅ | 复用 NotificationRule（meta 承载扩展），无新表；§一12/§三18/§四21 不变；依赖的源表均 DR-130 已确认设计新建 |

**本轮发现问题数**：0（8 条规则线上未实现属待建，依赖表已在设计新建区，非计数问题）。
**结论**：能力 44（D2 定时通知规则）逐条落地，8 条新提醒规则钉死（触发条件/数据源/收件人/频率），DR-131 记录决策。复用 NotificationRule + cron + 能力 43 派发，无新表。各规则 critical 级别 ⚠️ 挂 TODO 待决策。待「下一条」D3 短信通道（能力 45，唯一新建，需服务商/场景决策）。

---

### 检查轮次 85（2026-06-01，范围：D2 补 ⑨ 上课迟到提醒 + DR-133 · 复用 DR-89 · 跨 06/08）

> 用户要求「上课迟到推送+短信」，指出升学卡出勤率→每场必记出勤的逻辑闭环。我误判需新建考勤、两度重复发问迟到基准，用户纠正「之前讨论过，发链接后才计算」。翻 DR-89 确认签到窗口早闭合（token.createdAt+checkinGraceMinutes）。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 翻查既有决策 | ✅ | DR-89（TODO-2 闭合）：签到窗口=token.createdAt+Program.checkinGraceMinutes，startAt 仅展示——迟到基准早已定义 |
| 2. ⑨ 规则落盘 | ✅ | 能力 44 规则表 +⑨ class-late（触发条件/数据源/收件人/频率/通道=推送+短信）|
| 3. 零新字段核实 | ✅ | DR-89 明确「token.createdAt 天然承担，排除加 actualStartAt」——⑨ 复用，无新字段/新表 |
| 4. 逻辑闭环 | ✅ | 升学卡出勤率→每场记 StudyRecord→窗口内未签到=迟到→催签→保出勤率→保升学 |
| 5. 短信关联 | ✅ | ⑨ 归「关键学修提醒」走短信，能力 45 用途规则待 +1 行（D3 落盘时补）|
| 6. 计数/标题同步 | ✅ | 能力 44 标题 8→9 条；DR-131 加后补注；进度行 +⑨；§一12/§三18/§四21 不变 |
| 7. 教训记录 | ✅ | DR-133 记「动出勤/迟到议题前先 grep 决策日志」——避免重复已闭合讨论（违反 CLAUDE.md 以文档为准）|

**本轮发现问题数**：1（我重复发问已闭合的迟到基准——DR-133 记教训，规则改为零新字段复用 DR-89）。
**结论**：⑨ 上课迟到提醒补入能力 44（共 9 条），完全复用 DR-89 签到窗口机制，零新字段/零新表。逻辑闭环（出勤率↔升学）打通。DR-133 记决策 + 教训。待「下一条」D3 短信通道（能力 45），落盘时把 class-late 补进短信用途规则。

---

### 检查轮次 86（2026-06-01，范围：DR-126 逐条第 13 条（D3）· 能力 45 短信通道 + DR-132 · D 组收尾 · 跨 06/08）

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 存在性 | ✅ | 线上零实现：User 无 phone 字段（grep 空）、无短信服务商、dispatch 仅占位注释——确认 🆕 新建 |
| 2. 能力 45 落盘 | ✅ | 06 新增能力 45（A 手机号体系/B 发送抽象层/C dispatch 第3通道/D 用途规则/E 偏好）|
| 3. 用途规则含 ⑨ | ✅ | 短信用途表含 class-late（⑨ 上课迟到）+ critical 系统公告 + ⑦⑧关键提醒 + 验证码；一般/普通不发 |
| 4. DR-132 记录 | ✅ | 决策过程 + 用户选项（用途=兜底+关键学修提醒，深度=完整设计）+ 排除项（全量发/不验证发）|
| 5. 待决策挂 TODO | ✅ | TODO-SMS（服务商/smsEnabled 默认/SmsLog 表/验证码频率）|
| 6. 进度更新 | ✅ | 06 章首「能力 45✅，D 组通知与触达 4 条全部完成（42-45）」|
| 7. 表计数影响 | ✅ | User +phone 字段属字段扩展（User 已在 §一扩展区，不增表数）；NotificationPreference +smsEnabled 字段扩展；SmsLog 是否新建 ⚠️ 待 TODO-SMS——当前 §一12/§三18/§四21 不变 |

**本轮发现问题数**：0。
**结论**：能力 45（D3 短信通道）完整设计落地，DR-132 记录。User 手机号体系（字段扩展）+ 短信发送层 + dispatch 第3通道 + 用途规则（严格限 critical/关键场景控成本）。**D 组通知与触达 4 条全部完成**（能力 42 系统公告/43 通知中心/44 定时规则 9 条/45 短信）。服务商等挂 TODO-SMS。表计数 §一12/§三18/§四21 不变（SmsLog 待 TODO 评估）。待「下一条」B4 法会（DharmaAssembly，B 组收尾）。

---

### 检查轮次 87（2026-06-01，范围：DR-126 逐条第 14 条（B4）· 能力 46 法会+发愿 + DR-134 双表分叉厘清 · 跨 06/08）

> 用户要法会发愿按钮+进学修记录+显示发愿总数/参与人数，并追问「为什么两套表设计不一样、先查清再定」。派 agent 全量溯源：DharmaAssembly（线上真表）vs Event/EventCount（旧设计幻影，从未上线，旧设计自己已废计数）。用户新逻辑：发愿带数量+并入统一修学计数模块。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 双表溯源 | ✅ | agent 证据：Event/EventCount 旧设计重结构线上从无；DharmaAssembly 是落地的轻量展示；分叉源于审计误标复用（DR-130 已揪） |
| 2. 能力 46 落盘 | ✅ | 06 新增能力 46（A 展示✅ + B 发愿🆕：发愿数量/UserPracticeVow context=event/PracticeLog 计数/参与人数+发愿总数）|
| 3. §1.7 同步改 | ✅ | eventId 指向 DharmaAssembly（原 Event）+ event 关联类型 + 删 eventCounts + 愿进度公式（走 PracticeLog）+ 统计公式，共 4 处 |
| 4. 废弃 Event/EventCount | ✅ | §四两行改 ❌ 废弃；DharmaAssembly 补真实复用行；M3e migration 清单 Event→DharmaAssembly |
| 5. DR-134 记录 | ✅ | 溯源结论 + 用户新逻辑 + 计数区隔（context=event 不混日常）+ 排除项 |
| 6. 表计数校准 | ✅ | §四 21→20（−Event −EventCount 废弃 +DharmaAssembly 补登记）；§一12/§三18 不变；发愿复用 UserPracticeVow+PracticeLog 无新表 |
| 7. 进度更新 | ✅ | 06 章首「B 组 4 条完成（含 B4 能力 46）」|

**本轮发现问题数**：1（法会双表分叉——Event/EventCount 幻影 vs DharmaAssembly 真表，DR-134 厘清并废弃幻影、统一真表）。
**结论**：能力 46（B4 法会）逐条落地，含展示（✅ 已实现）+ 发愿（🆕 复用 UserPracticeVow context=event + PracticeLog 计数）。DR-134 厘清双表分叉、废弃 Event/EventCount 幻影、统一 DharmaAssembly。**B 组运营内容 4 条全部完成**（能力 40-42、46）。表计数 §一12/§三18/§四20。承 DR-34 计数区隔（context=event 独立标识不混日常）。下一组待定（C 组等）。

---

### 检查轮次 88（2026-06-01，范围：DR-126 逐条 C 组 C3 · 能力 47 账户体系 + DR-135 · 跨 06/08）

> C 组原 6 项，C1 通知中心+偏好/C2 Web 推送已并入能力 43（D1），收敛为 4 条（C3 账户/C4 档案/C5 设置隐私/C6 举报）。用户对 C3 提两需求：加 Google 登录 + 只允许一台设备。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 存在性核查 | ✅ | auth 模块全套 + User/AuthSession/PasswordResetToken/EmailVerificationToken grep=1；Google/OAuth grep=0（未实现）|
| 2. 能力 47 落盘 | ✅ | 06 新增能力 47（A 注册验证/B Google登录🆕/C 单设备🔧/D 密码/E 合规/F 角色）|
| 3. Google 登录定性 | ✅ | grep=0 → 🆕 新建（User +googleId/authProvider，Google 邮箱免验证，同 email 关联）|
| 4. 单设备定性 | ✅ | 线上已部分实现（push 踢出+手动 revoke-others，DR-112 净资产）但非硬强制 → 🔧 改造（登录时自动 revoke 旧 AuthSession）|
| 5. DR-135 记录 | ✅ | 两项变更 + 现状核查 + 复用基建（revokedAt/revoke-others）+ 排除项 + 实现注 |
| 6. C 组拆法 | ✅ | C1/C2 已并入 43；C3 本轮；C4/C5/C6 待逐条 |
| 7. 表计数影响 | ✅ | User 字段扩展（googleId/authProvider，User 已在 §一扩展区，不增表数）；§一12/§三18/§四20 不变 |

**本轮发现问题数**：0（Google 待建、单设备改造均属设计变更，非文档不一致）。
**结论**：能力 47（C3 账户体系）逐条落地。Google 登录 🆕 新建（User 字段扩展）、硬单设备 🔧 改造（复用 revokedAt 机制，登录时自动踢旧）。DR-135 记录。C 组 C1/C2 已并入能力 43，本轮 C3，剩 C4 个人档案/C5 设置隐私/C6 举报闭环。表计数 §一12/§三18/§四20 不变。待「下一条」C4 个人档案。

---

### 检查轮次 89（2026-06-01，范围：DR-126 逐条 C 组 C4 · 能力 48 个人档案 + DR-136 + gender 字段 · 跨 06/08）

> 用户要加「性别/生日/地区」判断 60 岁豁免，要求核对升学/毕业。先查文档（吸取 DR-133 教训）：birthDate（DR-70）+city/phone 设计已有，gender 真无。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 先查后决策 | ✅ | 翻 §1.9 User + 升学/毕业要求：birthDate（DR-70，60 岁豁免数据源）+city/phone/realName/refugeStatus/practiceBackground 设计已有；gender grep=0 真无 |
| 2. 升学/毕业核对 | ✅ | 60 岁豁免=资格性非自动（birthDate，AdvancementCheck 已写判定）；毕业=cohortStatus+祈祷文补足+观修（DR-111）——均不需 gender |
| 3. gender 落盘 | ✅ | §1.9 User +gender 字段（model 片段 + 字段表行）；明确「豁免靠 birthDate 非 gender」 |
| 4. 能力 48 落盘 | ✅ | 06 新增能力 48（A 档案字段/B 升学判定字段/C 我的中心/D 多语）|
| 5. 落差厘清 | ✅ | 设计 §1.9 档案字段（7+）远多于线上 ProfileEdit 暴露的 3 个 → 🔧 待补暴露；gender 🆕 新增 |
| 6. DR-136 记录 | ✅ | 决策 + 核查发现 + 排除项（gender 非豁免依据/birthDate 不重复加）|
| 7. 表计数影响 | ✅ | User +gender 字段扩展（User 已在 §一扩展区，不增表数）；§一12/§三18/§四20 不变 |

**本轮发现问题数**：0（gender 新增、字段补暴露均属设计变更；birthDate/city 已有避免了重复加）。
**结论**：能力 48（C4 个人档案）逐条落地。gender 🆕 新增（纯档案，无业务依赖），birthDate/city/phone 等设计已有（🔧 待补暴露到编辑页）。厘清「60 岁豁免靠 birthDate 非 gender」+ 升学/毕业要求。DR-136 记录。先查文档避免重复加 birthDate（吸取 DR-133 教训）。表计数 §一12/§三18/§四20 不变。待「下一条」C5 设置+隐私。

---

### 检查轮次 90（2026-06-01，范围：DR-126 逐条 C 组 C5 · 能力 49 设置与隐私 + DR-137 注销核对 · 跨 06/08）

> 用户决策「注销不删除」+「确认是否符合新设计」。先查 D18 原文 + 线上注销实现 + isActive 设计登记三者对齐。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 存在性 | ✅ | practiceVisibleToClass/meditationVisibleToClass/isActive grep=1；SettingsPage/PrivacyPage 真实存在 |
| 2. 能力 49 落盘 | ✅ | 06 新增能力 49（A 端侧偏好/B 隐私可见性/C 通知偏好/D 账户安全/E 注销与 D18/F 隐私政策）|
| 3. 注销符合 D18 核对 | ✅ | D18=档案全数据保留；isActive=false 不物理删（标准手段）+ 学修数据保留；清凭证 ≠ 删档案，符合 |
| 4. 三者对齐 | ✅ | D18 原文（05:142）+ 线上实现（routes.ts:329 软删+清凭证+冷却）+ 设计 isActive（08:42）一致 |
| 5. DR-137 记录 | ✅ | 注销行为符合 D18 无需改 + 先查文档 + 排除项（不清凭证/物理删） |
| 6. 隐私可见性 opt-in | ✅ | 默认 false 隐私优先（审计 5.6），服务能力 7/26 排行 + 14 关怀 |
| 7. 表计数影响 | ✅ | 复用 User 净资产（可见性/isActive 字段已有），无新表；§一12/§三18/§四20 不变 |

**本轮发现问题数**：0（注销行为经核对符合 D18，无需改动）。
**结论**：能力 49（C5 设置与隐私）逐条落地。端侧偏好（localStorage）+ 隐私可见性（opt-in）+ 通知偏好（联动 43）+ 账户操作。**注销行为经 DR-137 核对符合 D18**（软删不删档案，仅清登录凭证）——用户「确认符合新设计」诉求达成，无需改动。表计数 §一12/§三18/§四20 不变。待「下一条」C6 内容举报闭环（C 组收尾）。

---

### 检查轮次 91（2026-06-01，范围：DR-126 逐条 C 组 C6 收尾 · 能力 50 举报闭环 + 能力 51 用户反馈 + DR-138 · 跨 06/08）

> 用户问「bug/问题反馈存一张表还是单独设计」。核查线上已有 Feedback 表（kind 区分 bug/建议/其他），DR-118/119 已保留为净资产但未登记能力。用户决策「拆为两条独立」（举报 vs 反馈）。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 存在性 | ✅ | QuestionReport/NoteReport/Feedback grep 全=1 真实存在 |
| 2. 能力 50 落盘 | ✅ | 06 新增能力 50（题目举报/笔记举报/处理闭环，✅ 标签）|
| 3. 能力 51 落盘 | ✅ | 06 新增能力 51（Feedback：kind 区分/匿名/复现信息/admin 回复，✅ 标签）|
| 4. 反馈无需新表 | ✅ | 线上 Feedback.kind 已区分 bug/建议/其他，统一一张表——回答用户疑问 |
| 5. 拆条依据 | ✅ | 举报=内容合规审核（题目/笔记下架）、反馈=产品 bug/建议；业务面不同独立两条 |
| 6. DR-138 记录 | ✅ | 接 DR-118/119 Feedback 净资产转正式能力 + 拆条决策 + 排除项 |
| 7. 表计数影响 | ✅ | 复用 QuestionReport/NoteReport/Feedback 净资产，无新表；§一12/§三18/§四20 不变 |

**本轮发现问题数**：0（Feedback 早有表，无需新建；举报/反馈均净资产复用）。
**结论**：能力 50（C6 举报闭环）+ 能力 51（用户反馈）逐条落地，拆为两条独立。Feedback 净资产（DR-118/119 保留）正式登记为能力 51。**C 组账户通知全部完成**（C1/C2 并入 43，C3-C6=能力 47-50 + 反馈能力 51）。**DR-126 净资产功能补登记收官**：A 组 8（32-39）+ B 组 4（40-42、46）+ D 组 4（42-45）+ C 组（47-51）= 能力 32-51（20 条，其中能力 42 跨 B/D 组）。表计数 §一12/§三18/§四20。可进入下一阶段（剩余待办梳理/反向核对收尾/或其他）。

---

### 检查轮次 92（2026-06-01，范围：清待决策项 · TODO-SMS 4 项拍板 + DR-139 + SmsLog 新表 · 跨 06/08）

> 「清待决策项」方向下逐条核对能力 45 短信通道挂起的 TODO-SMS（服务商/开关/SmsLog/验证码）。用户拍板：服务商不锁定、后台场景级开关、独立 SmsLog 表、验证码标准档。其中「独立 SmsLog」带来表计数变动（§三 18→19）。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 4 项决策落盘 | ✅ | 06 能力 45 规则 E（场景开关）+ 约束 3/4/5（SmsLog/验证码/服务商）+ ✅已决策段 + 章首；08 DR-139 |
| 2. SmsLog 表定义 | ✅ | 08 新增 §3.16（字段 15/关联/约束/设计意图，dedupeKey 幂等 + userId 可空容验证码场景）|
| 3. 表计数校准（检查项 4）| ✅ | §三标题 18→19 + 注加 DR-139；§一扩展 12 不变（User +phone 是字段扩展非新表）；§四复用 20 不变 |
| 4. Migration 覆盖（检查项 5）| ✅ | §11.1 加 M3g（SmsLog 新建 + User +phone ALTER + 场景开关字段）；§11.3 覆盖核对 18→19、M3g 计入 |
| 5. 开关机制一致 | ✅ | 后台场景级（NotificationRule +smsEnabled / 公告 critical 配置），**不**在用户级 NotificationPreference 加 smsEnabled——能力 45 规则 E 与 DR-139 一致 |
| 6. 幂等机制对齐 | ✅ | 原约束「复用 DispatchLog 幂等」改为「SmsLog dedupeKey 短信级幂等」；DispatchLog 仍管跨通道派发去重，分工清晰无冲突 |
| 7. 待决策标记清除 | ✅ | 06 能力 45 原「⚠️ 待决策项（挂 TODO-SMS）」段落改为「✅ TODO-SMS 已决策（DR-139）」，无悬空 ⚠️ |

**本轮发现问题数**：0（4 项决策清晰，SmsLog 独立表带来的计数/Migration 连锁已同步）。
**结论**：TODO-SMS 4 项待决策全部拍板（DR-139）。**表计数变动：§三新建 18→19**（+SmsLog），§一扩展 12 / §四复用 20 不变。能力 45 短信通道设计封板（服务商实现时接）。**剩余待决策项**：能力 44 关怀/逾期等是否 critical（⚠️ 下一条待核对）。

---

### 检查轮次 93（2026-06-01，范围：清待决策项收官 · 能力 44 关怀/逾期是否 critical · DR-140 · 仅 06/08 文字）

> 「清待决策项」最后一条：能力 44 约束 4 挂的关怀/逾期是否 critical。用户拍板均非 critical（尊重静默+频率约束）。无表/字段变动。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 决策落盘 | ✅ | 06 能力 44 约束 4 清除 ⚠️ 待决策，改为「均非 critical（DR-140）」+ 例外说明 |
| 2. DR-140 记录 | ✅ | 08 决策记录加 DR-140（判断依据 + ⑨例外 + 排除项）|
| 3. 与能力 42 一致 | ✅ | critical 无视静默仅限系统公告 severity=critical；关怀/逾期非系统公告，不冲突 |
| 4. 与 ⑨迟到一致 | ✅ | ⑨关键触达靠推送+短信（DR-133/139），不靠 critical 突破静默——两条路径不矛盾 |
| 5. 表计数影响 | ✅ | 纯通道策略决策，无表/字段变动；§一12/§三19/§四20 不变 |
| 6. 待决策清空 | ✅ | 全文 grep「⚠️ 待决策」「TODO-SMS 待决策」——两簇均已转已决策，无悬空 |

**本轮发现问题数**：0（纯策略决策，无连锁）。
**结论**：能力 44 关怀/逾期类提醒均非 critical（DR-140），尊重静默+频率约束。两簇待决策（TODO-SMS DR-139 + 能力 44 critical DR-140）清空。**补充**：盘点 §十 TODO 主表时发现 TODO-25（音视频阈值）仍挂 ⚠️，下一轮（CR94）补决。

---

### 检查轮次 94（2026-06-01，范围：清待决策项真收官 · 能力 39 音视频阈值 · DR-141 · 仅 06/08 文字）

> CR93 后盘点 §十 TODO 主表，发现 TODO-25 音视频达标阈值仍 ⚠️ 待决策（原挂「实现时按大纲定」，实为可设计期拍板的产品数字）。用户选「现在定」，拍板双轨 90% OR 60秒&50%。无表/字段变动。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 决策落盘 | ✅ | 06 能力 39 规则 5 清 ⚠️ 待定→写入阈值（DR-141）+ 绝对约束 3 + 改造关联标题改 DR-129/141/TODO-24 |
| 2. DR-141 记录 | ✅ | 08 决策记录加 DR-141（双轨判断 + 60秒抬升理由 + 排除单阈值/统一80%）|
| 3. TODO-25 闭合 | ✅ | §十 TODO-25 划删除线标「✅ 已闭合（DR-141）」，处理时机→已处理 |
| 4. 与能力 37 一致 | ✅ | 看法本 scrollPercent≥90 OR totalSeconds≥30&≥50%；音视频 90% OR 60秒&50%，双端双轨同构（仅时长底线 30→60）|
| 5. 与能力 3 一致 | ✅ | 闻思「听」=COUNT(LessonCompletion type IN audio,video)，阈值定后该 COUNT 有明确触发口径 |
| 6. 表计数影响 | ✅ | 纯阈值常量决策，无表/字段变动；§一12/§三19/§四20 不变 |
| 7. 待决策清空 | ✅ | 全文 grep ⚠️ 待决策——设计期开放决策已全清；残留 TODO-23/24（实现期重构）、TODO-5/20（暂缓）非设计期开放项 |

**本轮发现问题数**：0（纯阈值决策，无连锁）。
**结论**：能力 39 音视频达标阈值 `playedPercent≥90% OR (playedSeconds≥60 AND ≥50%)`（DR-141），与看法本双轨同构。**「清待决策项」方向真正收官**——设计期可拍板的三簇（TODO-SMS/能力44 critical/TODO-25）全清；§十残留 TODO-23/24 为实现期重构任务、TODO-5/20 为暂缓功能，均非设计期开放决策。表计数稳定 §一12/§三19/§四20。下一方向：**梳理暂缓功能群**（TODO-5/20 + 暂缓能力 21-25 等 + 管理端/正科学修管理整理成 Phase 路线图）。

---

### 检查轮次 95（2026-06-01，范围：能力 39 音视频采集层 · DR-142 · 仅 06/08 文字）

> 用户在 DR-141 定阈值后追问「视频两种模式（OSS 直链 vs YouTube 嵌入）怎么统计」——DR-141 只定阈值数字、未定采集机制，是真实采集层缺口。用户拍板：两源同口径，YouTube 走 IFrame API + ENDED 判达标，playedSeconds 累计实际播放防刷。无表/字段变动。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. 决策落盘 | ✅ | 06 能力 39 新增规则 6（采集层）+ 绝对约束 4 + 规则 3 过程明细层补客户端追踪说明 |
| 2. DR-142 记录 | ✅ | 08 决策记录加 DR-142（OSS/YouTube 双源采集 + 防刷口径 + ENDED + 排除项 + 实现期遗留）|
| 3. 与 DR-141 一致 | ✅ | DR-142 是 DR-141 的采集层落地：阈值数字不变，补「两源各自怎么拿到 playedSeconds/playedPercent」|
| 4. 与能力 3 一致 | ✅ | 两源写同一条 LessonCompletion(type=audio/video)，闻思「听」COUNT 源无关，判定口径不分裂 |
| 5. 与能力 37 一致 | ✅ | playedPercent 取最远位置（对齐 scrollPercent furthest）；playedSeconds 累计（对齐 totalSeconds 停留）——双端同思路 |
| 6. 表计数影响 | ✅ | 采集是前端逻辑；播放进度是否持久化为表留实现期定，不动当前计数；§一12/§三19/§四20 不变 |
| 7. 实现期遗留登记 | ✅ | (a) youtube 源面向谁/OSS 备份（墙内可达性）、(b) 进度持久化表——均标实现期，非设计期开放决策；TODO-25 仍闭合 |

**本轮发现问题数**：0（采集层补充，无连锁；阈值/表/COUNT 口径均不变）。
**结论**：能力 39 音视频采集层封板（DR-142）——OSS HTML5 timeupdate + YouTube IFrame API 同口径，playedSeconds 累计防刷、playedPercent 最远位置、YouTube ENDED 判达标、墙内不可达不兜底。两实现期遗留（youtube 可达性 / 进度持久化表）已登记。表计数稳定 §一12/§三19/§四20。「清待决策项」收官状态不变，下一方向仍为**梳理暂缓功能群**。

---

### 检查轮次 96（2026-06-01，范围：🔴 完成判定全面转纯手动 · DR-143 · supersede DR-141/142 · 跨 06/08）

> 用户两轮决策：先「自动检测降为辅助」，后明确推翻为「不设自动检测、改纯手动，但要做后台被杀处理」+「观修时长纯手填」。本轮落 DR-143：法本阅读/音频/视频/观修四类完成一律以**用户手动确认**为准，自动达标阈值（DR-141/142、能力 37）全部 supersede；app-kill 续播 + 延迟确认走 localStorage（无新表）；LessonCompletion type 去 meditation（观修走 PracticeLog，DR-111）。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | DR-143 不新增表/关联；纯触发与口径变更，无 @relation 变动 |
| 2. API 响应/DB 字段对齐 | ✅ | 无新字段；LessonCompletion type enum 收敛 audio/video/read（去 meditation），08 M3f + 能力 39 规则 2/4 + DR-92 矩阵 + meditationLag 引用全部对齐到「观修走 PracticeLog」 |
| 3. SQL/读取口径正确 | ✅ | meditationLag 改读 PracticeLog(meditationId) 座完成率（line 328）；contentLag 仍读 LessonCompletion read/audio/video COUNT；掉队口径统一为「已确认完成数」 |
| 4. 总览计数正确 | ✅ | 零新表零删表，§一12/§三19/§四20 全不变（DR-143 决策行已注明）|
| 5. Migration 覆盖完整 | ✅ | 无新表/新字段 migration；M3f 表 spec 已更新 type 枚举（去 meditation），无需新 migration |
| 6. Phase 计划覆盖完整 | ✅ | 完成判定改纯手动在既有 M3f/能力 37/39 实施项内；app-kill localStorage 为前端实现期工作，无新 Phase 表项 |
| 7. supersede/废标签完整 | ✅ | DR-141/142 已加 🔻后修订标；能力 37 规则 2/3 + 绝对约束 1/2、能力 39 规则 5/6 + 绝对约束 3/4、§十 TODO-25 均打 supersede/删除线 |
| 8. 业务规则约束有实现方式 | ✅ | 纯手动=应用层「完成」按钮 + 离开提示用户确认；app-kill=localStorage 续播位置 + 未确认会话标记；防刷=虚报治理（忏悔→取消资格）+ 升学管理员审核（应用层，非技术阈值）|

**本轮发现问题数**：0（旧引用 type=meditation 在 08 M3f/meditationLag/能力 39 + 06 能力 39 规则 2/4 共 4 处，均在本轮一并清理对齐 DR-111；DR-141/142/能力 37 阈值 supersede 标记完整，无遗漏悬空）。
**结论**：DR-143 封板——四类学修内容完成全面转纯手动用户确认，自动达标阈值（DR-141/142/能力 37）supersede、防刷回归「自报+治理+审核」信任模型；观修维持 DR-111（PracticeLog，时长纯手填）；app-kill 续播+延迟确认走 localStorage（同设备，无新表）；LessonCompletion type 去 meditation、闻思口径澄清（仅听/看/答题、不含观修）。06↔08 双向对齐，表计数稳定 §一12/§三19/§四20。

---

### 检查轮次 97（2026-06-01，范围：app 外学修申报入口 + 录入方式重定义 in_app/external · DR-144 · 收 DR-143 能力 9 连带 · 跨 06/08）

> 用户提「计数模块内也可给阅读/音视频/观修标记某科完成，适用于不用 app 学习的人，帮助统计学习进度」。落 DR-144：能力 9 加 app 外申报入口（按课时标记听/看/读/观修，可填 N 遍，观修录完整信息，答题仅 app 内）；录入方式从「自动/手动」重定义为 in_app/external，顺带收掉 DR-143 对能力 9 规则 2 的连带矛盾；LessonCompletion +source 字段、PracticeLog source 值域校准。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | 无新表/新关联；LessonCompletion +source（enum 字段）、PracticeLog source 值域校准，均不涉及 @relation |
| 2. API 响应/DB 字段对齐 | ✅ | source(in_app/external) 落 LessonCompletion（M3f spec 已加）+ PracticeLog（§1.12 注释/校验表/M1 spec 三处校准）；能力 9 规则 2/2b/约束 1 与字段一致 |
| 3. 读取/聚合口径正确 | ✅ | app 内/外写同表同判定，能力 3 COUNT 不区分 source；观修 external 仍 meditationId 分组 + 时长，升学预检 DR-98 口径不变 |
| 4. 总览计数正确 | ✅ | 新表加字段 + 既有字段值域校准，零新表零删表，§一12/§三19/§四20 全不变 |
| 5. Migration 覆盖完整 | ✅ | LessonCompletion 为新表（M3f）spec 内含 source；PracticeLog source 值域校准已并入 M1 既有 ALTER（tap/shake/bulk→in_app/external/ai_assistant），无新增 migration |
| 6. Phase 计划覆盖完整 | ✅ | app 外申报入口落能力 9 学员端录入，复用 M3f/能力 4 既有落点；无新 Phase 表项 |
| 7. supersede/废标签完整 | ✅ | 能力 9 规则 2 旧「自动/手动」已重定义并注明旧举例作废；约束 1、08 各 source 引用同步校准 |
| 8. 业务规则约束有实现方式 | ✅ | app 外申报=能力 9 计数模块入口（应用层）；来源标注=source 字段（Zod 值域）；N 遍=展开 N 行 LessonCompletion；观修完整信息=meditationId+durationMinutes+≥30 校验（Zod）；防刷=管理员核查+虚报治理 |

**本轮发现问题数**：0（DR-143 对能力 9 规则 2 的连带矛盾在本轮一并收口；source 值域 08 共 4 处（M3f/§1.12 注释/§1.12 校验表/M1 spec）+ 06 规则 2/约束 1 全部对齐 in_app/external）。
**结论**：DR-144 封板——app 外学修申报入口服务线下学习者（按课时标记听/看/读/观修、可填 N 遍、观修录完整信息、答题仅 app 内）；录入方式重定义 in_app/external 收掉 DR-143 连带矛盾；source 落 LessonCompletion 新字段 + PracticeLog 值域校准。app 内/外同表同判定、source 区分供核查。06↔08 双向对齐，表计数稳定 §一12/§三19/§四20。

---

### 检查轮次 98（2026-06-01，范围：暂缓功能群梳理 · DR-145 · 自学转必做 + 社交/AI/徽章后台关键部分 · 表计数迁移 + Phase 重排 · 跨 06/08）

> 第③条暂缓功能群梳理。用户拍板：自学模式（能力 21）转必做正式功能；社交（能力 22/23/24）+ AI（25）+ 徽章（38）只做后台关键部分。自学 1 张表（UserSelfStudyProgram）由 §五暂缓移入 §三实施（§三 19→20、§五 11→10），Phase 重排（新 P6 自学/P7 社交/P8 AI）。本轮有真实表计数迁移，重点核四处对齐。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | 无新表/新字段；UserSelfStudyProgram 既有设计不变，仅区位与状态变；TODO-5（Program.selfStudy 反向）转必做、实现时恢复 |
| 2. API 响应/DB 字段对齐 | ✅ | 自学/社交表 schema 设计均不动，仅实施状态变更，无字段增删 |
| 3. 读取/聚合口径正确 | ✅ | 自学进度=聚合 LessonCompletion/PracticeLog（DR-104，不升学）；社交后台逻辑保留不影响核心读取 |
| **4. 总览计数正确（重点）** | ✅ | **五处对齐**：①§三表头 19→20（DR-145 校准注已加）；②§三总览注追加 DR-145 条；③§五暂缓表头合计 11→10 + 自学行改「计入 §三」；④§十二 12.1「暂缓区 §五 10 + AI 4 对应 P7~P8」；⑤§十一 11.3「§三 20（+M7）/§五暂缓 10」+ M 单元表 M7 改 ✅必做。§一12/§四20 不变 |
| 5. Migration 覆盖完整 | ✅ | M7 自学由暂缓改 ✅必做随新 P6、计入 §三；社交 M4~M6 标「建表+后台·不做前端」随 P7；AI M8 随 P8；11.3 分区计数同步重算（§三 19+M7=20、§五暂缓 10），所有 migration 仍各有 Phase 归属、无遗漏 |
| 6. Phase 计划覆盖完整 | ✅ | §十二 P6/P7 对调：P6=自学（M7，✅必做）、P7=社交（M4~M6，⏸建表+后台无前端）、P8=AI（维持暂缓）；12.1 覆盖核对同步更新 |
| 7. 暂缓/必做标签完整 | ✅ | 06 能力 21 顶部加 ✅必做标 + 对老项目改标；能力 22/23/24 顶部加 ⏸建表+后台标 + 对老项目改标；08 §5.1~5.4 状态行同步；AI（DR-109）/徽章（DR-128）维持原标不动 |
| 8. 业务规则约束有实现方式 | ✅ | 自学=正式功能（应用层 + UserSelfStudyProgram 表 + P6）；社交=建表+后台（schema + 后端逻辑，无前端）；防呆=保留设计文档作后台/将来参考 |

**本轮发现问题数**：0（表计数迁移四处对齐已核；社交 10 张留 §五不动、自学 1 张跨区，§一12/§四20 稳定）。
**结论**：DR-145 封板——暂缓群一分为二：自学（能力 21）转必做、移入 §三实施、入新 P6；社交（能力 22/23/24）+ AI（25）+ 徽章（38）只做后台关键部分（社交建表+后台不做前端、AI/徽章维持 DR-109/128）。战略收敛到「核心学修管理 + 自学」。**表计数迁移：§三 19→20、§五 11→10**，§一12/§四20 不变。06↔08 双向对齐，Phase 图重排无环。

---

### 检查轮次 99（2026-06-03，范围：DR-149 · 加行毕业作为独立事件 + cohortStatus 5→7 态 · 跨 06/08/09 · 裁判剧本 1 T16/T17 缺口闭合）

> Unit ② 毕业事件定义。用户拍板：毕业=第八学期时间事件（无实修门槛、管理员手动批量结业）；graduated（留预科原地）vs advanced（升正科）语义分离；cohortStatus 加 advanced/disqualified（5→7 态）。法王祈祷文/灌顶/完整内加行卡升密法（advanced）不卡毕业（graduated）（大纲§651）。无新表、无新字段，仅扩 enum 值域。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | 无新表/新字段；EnrollmentStatusHistory.fromStatus/toStatus 引用 CohortMemberStatus 类型，新增枚举值自动支持；结业/升学均写 EnrollmentStatusHistory（既有 statusHistory/leaveRequests 反向不变）|
| 2. API 响应/DB 字段对齐 | ✅ | advanced/disqualified 同落 08（§六 enum）+ 09（能力 10/11 涉及表+API）；graduate 批量结业 API 写 cohortStatus=graduated、approve 写 graduated→advanced，与 08 §1.2 写权限分级一致 |
| 3. 读取/聚合口径正确 | ✅ | 名单快照「仅 active 计算」排除列表同步加 advanced/disqualified；graduated/advanced 均不入掉队计算 |
| 4. 总览计数正确 | ✅ | CohortMemberStatus 5 态→7 态：7 处值域串全部对齐（§六 enum + §1.2 字段 + §1.2 写权限 + 名单快照排除列表 + 09×2 + 06×1）；**无表计数变化**（§一12/§三20/§四20 不变，仅扩 enum 值）|
| 5. Migration 覆盖完整 | ✅ | 纯 enum 值域扩展（+advanced/+disqualified），归入既有 §十一 M0「CohortMemberStatus」扩展单元；无新表/新字段 migration |
| 6. Phase 计划覆盖完整 | ✅ | 毕业/升学属能力 10/11，已在既有 P2 升学结算 Phase；批量结业 API 随能力 11，无新 Phase |
| 7. 暂缓/必做标签完整 | ✅ | 转功德会 ❌ 不做（DR-68）；落班机制/原专业终态/并行专业 ✅ DR-150 已闭合；disqualified downstream（登录/再入学）⏸ Unit ⑤ 另轮 |
| 8. 业务规则约束有实现方式 | ✅ | 毕业=时间事件→graduate 批量 API（应用层 class_admin+）；graduated≠advanced→ 二 enum 值 + 写权限分级（08 §1.2）；法王祈祷文卡升密法不卡毕业→升学预检读硬条件（能力 10 规则 4）+ 毕业无门槛（能力 10 callout）；毕业去向→决策树（升学/留级/转预科/转功德会❌）|

**本轮发现问题数**：1（06:662「对老项目影响」残留旧 3 值占位 active/exited/graduated，已对齐为 7 态权威值域 + 标旧值作废）。
**结论**：DR-149 封板——「加行毕业」定义为第八学期时间事件（管理员手动批量结业、无实修门槛）；graduated（毕业留原地）vs advanced（升正科）语义分离，cohortStatus 5→7 态；法王祈祷文/灌顶/完整内加行卡升密法（advanced）不卡毕业（graduated），裁判剧本 1 T16/T17 缺口闭合。DR-150 同轮补入（落班机制=邀请码两步走 + 原专业终态=永久 advanced + 并行专业不级联），T22/T23 缺口同步闭合。disqualified downstream（Unit ⑤）另轮。无新表/新字段，仅扩 enum，§一12/§三20/§四20 稳定。

---

### 检查轮次 100（2026-06-03，范围：DR-151 · 多正科并存无上限 + 主修永不自动更改 + 升学确认=邀请码 + 200万因果链 + substitutionFor 字段 · 跨 05/06/08 · 裁判剧本 1 T24/T25 缺口闭合）

> Unit ②-C 剩余缺口批量闭合。用户拍板：(1) 正科并存不设上限；(2) 主修 primaryProgramId 由用户自设、系统永不自动更改；(3) 升学确认=学员使用邀请码加入正科班（Option A，已含于 DR-150 落班机制，无新步骤）；(4) 200万心咒完成是顶礼+法王祈祷文双豁免的充要条件（因果链），新增 substitutionFor 字段连接心咒 vow 与顶礼 vow；(5) DR-84 虚报忏悔内在矛盾标 ⏸ 待处理（Unit ⑤ 最后）。

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. Prisma 关联对称性 | ✅ | `substitutionFor String?` 是 UserPracticeVow 内部自引用（指向同表另一行 id），无需反向关联；UserPracticeVow 其余关联不变 |
| 2. API 响应/DB 字段对齐 | ✅ | substitutionFor 新增字段落点 §1.7 字段表 + Prisma schema + 约束表三处一致；DR-94/DR-151 升学预检逻辑描述一致；DR-95 豁免路径描述一致 |
| 3. 因果链完整性 | ✅ | 200万→顶礼✅+法王祈祷文✅（一因两果，大纲§649）；substitutionFor 提供因果链数据锚点；isSubstituted=true 触发条件 → 找心咒 vow → 验 currentCount ≥ 2,000,000 → 双豁免/双❌，逻辑无歧义 |
| 4. 主修字段修订完整 | ✅ | 05 D16「可能自动变为正科」→ 改为「用户自设，系统不自动更改（DR-151）」；06 能力 10 规则 8「T24 模糊点另处理」→ 改为「系统永不自动更改（DR-151）」；两处均已修订，无残留「可能自动切换」表述 |
| 5. Migration 覆盖完整 | ✅ | substitutionFor 归入既有 §十一 M1（UserPracticeVow 字段扩展）；无新表；§一/§三/§四计数全不变 |
| 6. Phase 计划覆盖完整 | ✅ | substitutionFor 随 UserPracticeVow 属 M3e（P4 实修体系），DR-94/DR-151 升学预检逻辑随 P2，无新 Phase |
| 7. 暂缓/不做标签完整 | ✅ | DR-84 标 ⏸ 待处理（Unit ⑤ 最后）；其余均 ✅ 已决策或 ❌ 不做 |
| 8. 业务规则约束有实现方式 | ✅ | 200万双豁免→升学预检应用层（DR-94/DR-151 协同）；主修不自动更改→无系统 primaryProgramId 自动写入路径（仅用户操作端点可写）；升学确认=邀请码→已含于 DR-150 落班机制（能力 2 端点）；多正科并存→无数量约束，邀请码天然控制入口 |

**本轮发现问题数**：0（批量决策配套改动一次到位）。
**结论**：DR-151 封板——多正科并存不设上限；主修由用户自设、系统永不自动更改（修订 D16/能力 10 规则 8）；升学确认=邀请码（DR-150 已覆盖，无新步骤）；200万心咒→顶礼+法王祈祷文双豁免（一因两果，大纲§649），新增 substitutionFor 字段实现因果链数据锚点（§1.7 +1 字段）；DR-84 虚报忏悔矛盾标 ⏸ Unit ⑤ 最后。裁判剧本 1 T24/T25 缺口闭合。§一12/§三20/§四20 稳定（substitutionFor 属字段扩展，不增表数）。

---

## 十、跨表待办清单（设计推进中发现、需在后续表/阶段处理）

> 设计某张表时发现、但应在其他表或后续阶段解决的事项，登记于此防遗漏。

| 编号 | 待办 | 来源 | 处理时机 | 关联决策 |
|---|---|---|---|---|
| ~~TODO-1~~ ✅ 已闭合 | ~~掉队判定阈值数据化~~——**已闭合（2026-05-30）**：Program 新增 lagWindowDays（默认14）/lagMildThreshold（0.5）/lagModerateThreshold（0.3）/lagSevereThreshold（0.1）4 个专业级阈值字段；Class.lagPracticeDaysExpected 班级覆盖保留，两层配置满足 D3 数据驱动（DR-88）。**查询范围补注（DR-167，2026-06-04）**：`taskLag` 达标基准来自 `classId → Class.programId → Program` 任务配置；多专业学员各专业独立判掉队，任一掉队即触发关怀。| 1.5 CohortLagSnapshot | ✅ 已处理（DR-88）/ 补注（DR-167）| DR-18 / DR-88 / DR-167 |
| ~~TODO-2~~ ✅ 已闭合 | ~~共修链接激活时效数据化~~——**已闭合（2026-05-30）**：签到窗口改为「token 生成时刻」为基准，startAt 仅展示；Program 补 checkinGraceMinutes（默认 30 分钟），与实际开课时间自动对齐（DR-89）| 1.6 ClassSession | ✅ 已处理（DR-89）| DR-25 / DR-89 |
| ~~TODO-3~~ ✅ 已闭合 | ~~PracticeAppointment.practiceProjectId 无正式 @relation~~——**已闭合（2026-05-29）**：§四 PracticeProject 确认复用，已在 §5.3 PracticeAppointment 补正式 FK `practiceProject PracticeProject @relation(...)`，PracticeProject 上补反向 `appointments PracticeAppointment[]` | §5.3 PracticeAppointment | ✅ 已处理（DR-69）| DR-57 / DR-69 |
| TODO-5 | §1.1 Program 恢复 `selfStudy UserSelfStudyProgram[]` 反向关联——当前因自学模式暂缓已移除，实现时须恢复 | §5.4 UserSelfStudyProgram | **自学转必做（DR-145），随新 P6 实现** | DR-103 / DR-104 / DR-145 |
| ~~TODO-AI-1~~ ✅ 已闭合 | ~~现状缺口：线上笔记功能已接入 LLM，本版 06/08 未体现~~——**已闭合（2026-05-31，DR-109）**：核实笔记 AI = 5 action（润色/摘要/标签/拟标题/起草）复用 gateway，`POST /api/notes/llm-assist` + NotesDrawer 入口已上线；判定为**独立子能力 25.C**（红线与 25.A 相反，不并入），仅登记现状不扩展；零新表（复用 Note）| 项目审计阶段 | ✅ 已处理（DR-109）| 能力 25 / 笔记模块 |
| TODO-AI-2 | **AI 代操作数据契约**（能力 25.B，DR-107）：实现时须给各写表（PracticeLog 等）来源标注扩展 `ai_assistant` 值；AiMessage 扩展 `toolCall`/`actionResult`（关联记录 id）字段。不新建业务表，复用各能力写路径 | §四 AiMessage + 各写能力写路径 | AI 模块实现时（晚于现状分析）| DR-107 |
| ~~TODO-6~~ ✅ 已闭合 | ~~班级成员请假审批流设计~~——**已闭合（2026-05-30）**：新建 §3.15 LeaveRequest；expired 实时算不入库（DR-90-A，同 DR-80）；approved 期间从掉队窗口扣除（DR-90-B）；审批限 class_tutor+；无 delete API（D18）| §5.4 自学模式修正 | ✅ 已处理（DR-90）| DR-62 / DR-90 |
| ~~TODO-7~~ ✅ 已闭合 | ~~加行观修座次计算规则对齐大纲~~——**已闭合（2026-05-30）**：核对能力 4 大纲原文后**废弃 0.5 座制**（违反「30 分钟以下不能单独计数」绝对约束），定调「每座录入下界 30 分钟、座数=COUNT、时长=SUM 双维度独立计」，放弃短座合并便利（比大纲更严格）。UserPracticeVow.currentSessionCount 改 Int + 新增 currentSessionMinutes（DR-91）| 预科19届大纲核对（Meditation/PracticeLog）| ✅ 已处理（DR-91）| DR-91 |
| ~~TODO-8~~ ✅ 已闭合 | ~~闻思圆满「音频或视频」二选一判定~~——**已闭合（2026-05-30）**：定调听=COUNT(type IN audio,video)、看=COUNT(read)、答题=UserAnswer，纯应用层聚合；三路径判定矩阵落点 §3.3；blind=视障类/deaf=听障类覆盖大纲细分（不扩展 statusType，守 DR-76）；盲+聋走能力 5 代行（DR-92）| 预科19届大纲核对（LessonCompletion）| ✅ 已处理（DR-92）| DR-92 |
| ~~TODO-9~~ ✅ 已闭合 | ~~加行升学「逐法达标」预检~~——**已闭合（2026-05-30，TODO-17 专题）**：practice_session 条件 params 加 `per_item/groupBy/itemCount/minSessionsPerItem/minMinutesPerItem/totalMin*` 结构，AdvancementCheck 按 meditationId 分组聚合 92 次比对，双维度独立判定（DR-98）| 预科19届大纲核对（ProgramAdvancementConfig/AdvancementCheck）| ✅ 已处理（DR-98）| DR-97 / DR-98 |
| ~~TODO-10~~ ✅ 已闭合 | ~~金刚萨埵心咒代替顶礼的换算+申请审批~~——**已闭合（2026-05-30）**：换算比例 200万↔10万 写死应用层常量（大纲规定，非配置项）；代替申请走能力 5 代行，AuditLog(actionType=proxy_action, reason 必填) 留痕；顶礼 UserPracticeVow 置 isSubstituted=true（历史数值保留不动）；新建心咒 UserPracticeVow(targetCount=2,000,000, currentCount=0) 从 0 独立计；两条 vow 并存互不干扰（DR-94）| 预科19届大纲核对（能力 5/6 代行）| ✅ 已处理（DR-94）| D17 / DR-94 |
| ~~TODO-11~~ ✅ 已闭合 | ~~法王祈祷文补念状态机~~——**已闭合（2026-05-30）**：无需欠/补状态机；PracticeLog 新增 `prayerCount Int?`，顶礼打卡时同次录入；升学预检直接聚合 `SUM(prayerCount) ≥ 100,000`；心咒代顶礼（isSubstituted=true）豁免此判定。PracticeLog 从复用区改判扩展，移入 §1.12（DR-95）| 预科19届大纲核对（能力 6/10）| ✅ 已处理（DR-95）| D13 / DR-95 |
| ~~TODO-12~~ ✅ 已闭合 | ~~年龄豁免（60岁）逻辑层~~——**已闭合（2026-05-30，TODO-17 专题）**：params 加 `ageExemptionMinAge:60`；AdvancementCheck 计算年龄后标 `ageEligible:true`，但不自动通过；admin 手动走能力 5 代行豁免（`exempted:true`）+ AuditLog 留痕（DR-100，DR-70 定调不变）| 预科19届大纲核对（能力 5 / 能力 10 / AdvancementCheck）| ✅ 已处理（DR-100）| DR-70 / DR-100 |
| ~~TODO-13~~ ✅ 已闭合 | ~~考试合格线多维矩阵~~——**已闭合（2026-05-30，TODO-17 专题）**：exam_score 条件 params 加 `attendanceThreshold/highAttendance/lowAttendance` 多维结构；AdvancementCheck 按出勤分档判定；考试线下进行，成绩由 subject_admin 后台录入 ExamGrade（DR-99，DR-101）| 预科19届大纲核对（ProgramAdvancementConfig / Exam / 能力 10）| ✅ 已处理（DR-99）| DR-97 / DR-99 |
| ~~TODO-14~~ ✅ 已闭合 | ~~兼修加行~~——**已闭合（2026-05-30）**：无需新表或新字段。兼修 = 独立加入加行班（D9 多专业并行已支持），加行学修量自然落在加行 programId 下。升密法资格判断为 admin 手动触发、系统以 userId 维度全量聚合（非单 programId），跨 program 聚合逻辑纳入 TODO-17（DR-96）| 预科19届大纲核对（能力 9 / 升学指南）| ✅ 已处理（DR-96）| D9 / DR-96 |
| ~~TODO-15~~ ✅ 已闭合 | ~~限制性课程不进考试范围~~——**已闭合（2026-05-30）**：核查发现 Course 缺教学阶段维度，新增 `courseType`（entry/formal/restricted），Course 改判 🔧 扩展移入 §1.11；考试范围排除 = `courseType=restricted OR category=self_study_book`；顺带补齐 DR-92 闻思判定对 courseType 的依赖（DR-93）| 预科19届大纲核对（Course / Exam / 能力 10）| ✅ 已处理（DR-93）| DR-93 |
| TODO-16 | ❌ **转功德会——不做**（用户决策 2026-05-29）——大纲：取消学员资格后可转入菩提功德会。**永久决策：不做**，超出觉学平台范围（功德会是独立组织/系统）。登记于此仅为留痕大纲已核对、明确排除，见 §八 DR-68 | 预科19届大纲核对（能力 11）| ❌ 不做 | DR-68 |
| ~~TODO-17~~ ✅ 已闭合 | ~~各学科达标条件 + 升学条件后台配置专题设计~~——**已闭合（2026-05-30）**：6 子议题全部完成——①params 充分性 ✅（DR-97，无需子表）；②逐法达标 params ✅（DR-98，per_item 结构）；③考试合格线 params ✅（DR-99，attendanceThreshold 分支矩阵）；④年龄豁免逻辑层 ✅（DR-100，ageEligible 标记+手动豁免）；⑤管理界面 4 页 ✅（DR-101，含考试成绩线下后台录入）；⑥跨 program 聚合 ✅（DR-96，TODO-14 已闭合）。**代码 gap 小结**：升学条件体系（ProgramAdvancementConfig/AdvancementCheck/AdvancementRecord/SemesterSnapshot）全新待建；PracticeLog.prayerCount / UserPracticeVow.isSubstituted+currentSessionMinutes / Course.courseType 需 migration 新增字段；管理端 4 页全新待建。现有 PracticeGoal/PracticeTask 打卡体系与升学条件体系并存不干扰 | TODO-9/12/13 子议题 + 检查轮次 35 勘误 + DR-96 | ✅ 已处理（DR-97~101）| DR-97 / DR-98 / DR-99 / DR-100 / DR-101 |
| ~~TODO-18~~ ✅ 已闭合 | ~~课程中途请假是否影响毕业/升学资格~~——**已闭合（2026-05-30）**：三维度分层处理——能力 3（闻思圆满）暂停型：课时截止日顺延已批准请假总天数；能力 9（报数达标）暂停型：报数节点截止日同上顺延；能力 10（升学资格预检）无影响：升学截止日固定不变。应用层计算能力 3/9 截止日时聚合 LeaveRequest(status=approved) 请假天数，无需新表/字段（DR-102，DR-90）| §3.15 LeaveRequest（DR-90）| ✅ 已处理（DR-102）| DR-90 / DR-102 |
| ~~TODO-19~~ ✅ 已闭合 | ~~14 届转入学员对已学课程「重修 / 直接报圆满」无落点（正向核对 G2）~~——**已闭合（2026-05-31）**：定调走**能力 5 代行**，无需新字段——「直接报圆满」= 转入/导入时管理员代行批量标记完成，写 LessonCompletion + AuditLog(actionType=proxy_action, reason 必填) 留痕；「重修」= 不标完成、学员正常重新学。复用既有 LessonCompletion + AuditLog，LessonCompletion 不动（仍 ✅ 复用）（DR-120）| 正向完整性核对 G2（能力 3 规则 6）| ✅ 已处理（DR-120）| DR-120 |
| TODO-20 | ⏸ **仪轨合规标志字段**（正向核对 G3）：能力 6 绝对约束 2「仪轨合规标志必填、不合规修量作废」目前 PracticeLog 无 `ritualCompliant` 字段承载。**用户决策暂不加字段**（2026-05-31），留待内加行模块实现时定细节（合规判定是布尔还是枚举、由谁标、不合规修量如何作废）| 正向完整性核对 G3（能力 6 绝对约束 2）| 内加行模块实现时 | DR-120 |
| ~~TODO-21~~ ✅ 已闭合 | ~~线上打卡器配套能力去留（DR-121）~~——**已闭合（2026-05-31，DR-122）**：实修 11 表逐张定归宿。补签 PracticeMakeup **保留**（纳入设计作正式功能）；日聚合排行 PracticeDailySummary **废**（排行从 PracticeLog 实时算+缓存）；每日目标 PracticeGoal **折叠**进 UserPracticeVow；大类字典 PracticeCategory **保留**；另 PracticeTask→ClassTask（class）+UserPracticeVow（self）、PracticeJournal 废弃、**PracticeTemplate 改造新建（DR-123 纠正：曾误判废弃，实为 CohortRecommendedTemplate 依赖的承重表）**、PracticeEntry→PracticeLog 改造扩展、UserPracticeVow 改造新建。**细化见 DR-123**（含表计数校准 §一13→12/§三15→17、ClassTask 映射、M3e/M1.5 migration）| DR-121 实修域落差核查 | ✅ 已处理（DR-122/123）| DR-121 / DR-122 / DR-123 |
| ~~TODO-22~~ ✅ 已闭合 | ~~fixed（期间累计）班级任务无落点（DR-123）~~——**已闭合（2026-05-31，DR-124）**：用户决策班级任务可「以时间为单位」（每周 3 座禅修=weekly、每天 1000 遍观音心咒=daily、本月共 10 万遍=fixed）。ClassTask 加 `period`（daily/weekly/fixed）+ dailyTarget/weeklyTarget/targetCount 三目标字段，承接线上 mode=fixed 并新增 weekly；达标率按 period 三口径算 | DR-123 ClassTask←PracticeTask 映射 | ✅ 已处理（DR-124）| DR-123 / DR-124 |
| TODO-23 | ⚠️ **能力 26/29 实修数据源迁移**（DR-125）：两个能力都读实修域改造后**不再保留**的表，须迁数据源。**能力 29 个人智能提醒**（`scheduler/personal-reminders.ts`/`reminder-queries.ts`）读 PracticeGoal（已折叠进 UserPracticeVow.dailyTarget，DR-122）、PracticeTask daily（已拆流 ClassTask/UserPracticeVow，DR-123）、PracticeDailySummary（已废弃，DR-122）——「即将圆满/今日未打卡」判定须接到 UserPracticeVow + 实时聚合 PracticeLog。**能力 26 综合积分排行**（`practice/study-ranking.routes.ts`）念诵维度 + 活跃天数维度读 PracticeDailySummary（已废弃）——须改为实时聚合 PracticeLog（与观修排行实时算同口径，DR-122）；观修/答题/阅读维度（MeditationSession/UserAnswer/LessonReadingProgress）不受影响。**共因**：PracticeDailySummary 废弃后，所有依赖它的读取都要转实时聚合 PracticeLog | DR-125 能力 26/29 ← 实修域改造（DR-122/123）| 实修域改造实现时 | DR-122 / DR-123 / DR-125 |
| TODO-24 | ⚠️ **完成记录机制统一**（DR-127）：线上阅读完成（`reading/service.ts`，能力 37）+ 观修完成（`meditations/student.service.ts` 视频≥80%，能力 4）写 `UserCourseEnrollment.lessonsCompleted`/`meditationsCompleted` 数组（课程级），但新设计闻思圆满判定走 `LessonCompletion` 表（DR-92），UserCourseEnrollment 随 DR-113 废弃。改造时统一迁移：① 写入端 reading/meditations 改写 LessonCompletion；② 读取端 courses（进度展示）/enrollment/dossier（学情）/smart-practice（已学课时抽题）改读 LessonCompletion 聚合。**前提修正（DR-129）**：原说「LessonCompletion 已是目标态无需改」有误——LessonCompletion 是幻影表，须**先新建**（M3f），再做本机制统一 | DR-127 能力 37/4 ← DR-113/DR-92/DR-129 | DR-113 专业级迁移实现时（LessonCompletion 新建后）| DR-113 / DR-92 / DR-127 / DR-129 |
| ~~TODO-25~~ ✅ 已闭合 | ~~音视频播放达标阈值~~——**已闭合（2026-06-01，DR-141）**：定阈值 `playedPercent≥90% OR (playedSeconds≥60 AND playedPercent≥50%)` 写一条 LessonCompletion(type=audio/video)。双轨对齐看法本（能力 37：scrollPercent≥90 OR totalSeconds≥30&≥50%），但音视频比文本重，时长底线 30→60 秒；超长开示靠「90% OR 过半&≥60秒」避免要求听满 90% 过苛。**🔻DR-143 后修订：阈值 supersede，完成改纯手动用户确认，本阈值不再判完成** | DR-129 能力 39 音视频完成判定 | ✅ 已处理（DR-141，后 DR-143 supersede）| DR-129 / DR-141 / DR-143 |
| TODO-DR156-API | ⚠️ **disqualified 再入学审批端点待补入 09**（DR-156 D1）：09 尚无 `POST /api/admin/disqualified-students/:id/reinstate`（super_admin 审批再入学 + 填写忏悔确认说明 + 触发邀请码发放）；非本轮强制，能力 11 实现时补入 09 API 层 | 09 能力 11 再入学 | 能力 11 API 实现时 | DR-156 |
| TODO-G1.5 | ⏸ **S5 节点业务含义待大纲确认**（G1.5，用户决策 2026-06-03）：大纲明确提到 S5 升学节点（08 DR-15：「S5/S8 是否两专业都有尚不确定」）；S5 是否有特殊业务含义（密法资格开放/中期汇报/其他检查点）需核对大纲原文后决策；**现阶段按普通节点处理**——ProgramAdvancementConfig conditionKey 预留 `exam_s5` 占位，不写入任何 S5 专属条件；06 能力 10 考试表 S5 标 ⏸ 待定 | 06 能力 10 考试规则 / 08 DR-15 / ProgramAdvancementConfig | 大纲核对后定 | DR-15 |
| TODO-SMS | ✅ **已决策（DR-139，2026-06-01）**——4 项全部拍板：① 服务商=先不锁定（Provider 抽象层实现时接）；② 短信开关=后台场景级（admin 按场景分设，非用户级 smsEnabled）；③ SmsLog=独立新表（§3.16，非复用 DispatchLog）；④ 验证码=标准档（60s/条、5 条/天、有效期 5min）。设计层全部封板，仅服务商对接留实现期 | DR-132/139 能力 45 短信通道 | ✅ 设计已闭合（服务商实现时接）| DR-132/139 |

---

## 十一、Migration 统编清单（全表封板后统编，检查项 5 闭合）

> 全表设计封板后的 migration 统编。按**外键依赖拓扑序**编排，确保 FK 目标表先于引用表创建。本节为「实施 migration 的逻辑分组与顺序」，非逐字 SQL。采用 `prisma migrate`（CLAUDE.md 部署流程，审计 5.4），每个 migration 单元一次 `migrate dev` 生成、`migrate deploy` 应用。
>
> **基线**：现有生产库已有旧 schema（含 User/Class/Program/Lesson/Course/PracticeLog 等复用表）。本统编只覆盖**本次融合新增/变更**部分；§四 复用表（22 张）不动，不列入。

### 11.1 Migration 单元（已发布实现范围，按序）

| 单元 | 内容 | 涉及表 | 依赖前置 | 类型 |
|---|---|---|---|---|
| **M0 · Enum 扩展** | 新增/扩展枚举：LagStatus（on_track/mild/moderate/severe）、CohortMemberStatus、角色 role 枚举值、各 status/sourceType/actionType/conditionType/triggerType 字符串域（应用层 Zod 守，DB 存 String）| —（enum 定义，见 §六）| 无 | 新增 enum |
| **M1 · 现有表扩展字段** | §一 扩展区 12 张的 ALTER：Program +8（cohortYear/stage/isActive/lag×4/checkinGraceMinutes）；User +birthDate+primaryProgramId（DR-120）；Class +归档三件套（status/archivedAt/archivedBy）；Course +courseType；**PracticeLog = rename PracticeEntry + 加列**（vowId/durationMinutes/meditationId/prayerCount/programId/taskSourceType + source 值域改 tap/shake/bulk→in_app/external/ai_assistant，DR-121/122/123/144）；Exam +examType+isOpenBook；ClassSession +sessionType/lessonId/checkInToken/scheduleId + classId 改可空；SpeakingGrade classId 改可空；CohortRecommendedTemplate programId 改可空 | Program/User/Class/Course/PracticeEntry→PracticeLog/Exam/ClassSession/SpeakingGrade/CohortRecommendedTemplate/ClassMember/StudyRecord/CohortLagSnapshot | M0（部分字段引用新 enum）| ALTER TABLE，加列设默认值，存量行回填默认；PracticeLog 含 RENAME TABLE |
| **M1.5 · 实修域改造源清理** | 线上改造源表不并入目标 schema：PracticeGoal（折叠 UserPracticeVow.dailyTarget）/ PracticeTask（拆流 ClassTask + UserPracticeVow）/ PracticeDailySummary（排行改实时算+缓存）—— 这 3 张线上表不保留（DR-122）。开发期无数据（DR-116），直接不建即可 | PracticeGoal/PracticeTask/PracticeDailySummary（不入目标 schema）| M1（PracticeLog/ClassTask/UserPracticeVow 就位后）| 改造源不保留（DR-122）|
| **M2a · 角色替换** | UserRoleAssignment（替换旧 ClassAdmin flags 模型）| UserRoleAssignment | M1（FK 指向 User/Class/Program 已就位）；旧角色数据迁移（coach→class_tutor+class_admin，admin→super_admin，见 02 §七）| 新建表 + 旧数据迁移 + 旧表保留只读（D18）|
| **M2b · 关怀替换** | CareFollowupRecord（加 sourceType/watchlistItemId）| CareFollowupRecord | M1；M3c（watchlistItemId → CareWatchlistItem，sourceType=care_watchlist 时）| 新建表 |
| **M2c · 传承替换** | TransmissionRecord（整合废弃 TantricAccessGrant）| TransmissionRecord | M1；TransmissionRecord 数据迁移需读旧 TantricAccessGrant | 新建表 + 旧数据迁移 + 旧表保留只读（D18）|

> **M2 拆分说明（检查轮次 48 修复）**：§二 3 张替换表分属不同 Phase（UserRoleAssignment→P1 权限地基、CareFollowupRecord→P3 关怀、TransmissionRecord→P5 传承），故按消费 Phase 拆为 M2a/M2b/M2c 三个独立 migration 单元，各自随对应 Phase 执行。注意 M2b CareFollowupRecord 的 watchlistItemId FK 指向 M3c 的 CareWatchlistItem，故 M2b 须在 M3c 之后（两者同属 P3 范畴，顺序：先建 CareWatchlistItem 再建 CareFollowupRecord）。
| **M3a · 权限审计骨架** | UserRoleAssignment 已在 M2；本单元建 RoleAssignmentHistory、AuditLog（无 FK，自包含）| RoleAssignmentHistory（→UserRoleAssignment）、AuditLog（无 FK）| M2 | 新建表 |
| **M3b · 升学条件体系** | ProgramAdvancementConfig、SemesterSnapshot、AdvancementCheck、AdvancementRecord | 均 →Program/Class/User；AdvancementRecord→AdvancementCheck | M1（Program/Class/User 就位）、M3a（AuditLog 供豁免留痕）| 新建表 |
| **M3c · 关怀体系** | StudentSpecialStatus、CareWatchlistItem、ReportConfession（CareFollowupRecord 见 M2b）| →User/Class；ReportConfession→CareWatchlistItem（故 CareWatchlistItem 先建）| M1 | 新建表 |
| **M3d · 班级运维** | ClassInviteCode、AssistantAssignment、LeaveRequest、ClassTask、ClassSessionSchedule、EnrollmentStatusHistory | →Class/User；ClassTask→PracticeProject；ClassSessionSchedule→Lesson；EnrollmentStatusHistory→ClassMember；ClassSession.scheduleId→ClassSessionSchedule（M1 已加列，此处补 FK）| M1 | 新建表；ClassSession.scheduleId 外键在此单元补建（解循环依赖）|
| **M3e · 实修体系**（DR-123）| UserPracticeVow（发愿层）、PracticeTemplate（修持模板，CohortRecommendedTemplate 依赖）| UserPracticeVow→User/**DharmaAssembly**（DR-134 改指，原 Event）/ClassTask/CohortRecommendedTemplate/PracticeProject/PracticeLog；PracticeTemplate→PracticeProject | M1（PracticeLog/PracticeProject 就位）、M3d（ClassTask 就位，UserPracticeVow.classTaskId FK）、DharmaAssembly（净资产已在线上）| 新建表（实修域改造细化，DR-122/123）|
| **M3f · 闻思完成事件**（DR-129；触发改纯手动确认 DR-143；+source DR-144；**+programId DR-158**）| LessonCompletion（听/看完成事件，带 type=audio/video/read + `source`(in_app/external，DR-144) + **`programId String`（必填，写入时从专业上下文带入，用于 course_completion 按专业隔离，DR-158）**；观修完成走 PracticeLog 不入本表，DR-111/143）| LessonCompletion→User/Lesson/Program（+冗余 courseId）| M1（Lesson/Program 就位）| 新建表（幻影表纠正，DR-129；能力 3 闻思圆满 + 能力 14 掉队 + 能力 9 报数 + 能力 26 阅读维度的判定数据源）|
| **M3g · 短信通道**（DR-132/139）| (1) User ALTER +phone/phoneVerified/phoneVerifiedAt（手机号体系）；(2) SmsLog 新建（短信发送记录，§3.16）；(3) 后台场景短信开关字段（NotificationRule +smsEnabled 等，随场景挂载）| SmsLog→User；User ALTER | M1（User 就位）| 新建表 + User ALTER（能力 45 短信通道，第 3 触达通道；服务商实现时接，DR-139 不锁定）|

> **循环依赖处理**：M1 给 ClassSession 加 `scheduleId String?` 列（仅列，不建 FK），M3d 创建 ClassSessionSchedule 后再补 `scheduleId → ClassSessionSchedule` 外键约束。两步拆开避免 M1 引用尚未存在的表。

### 11.2 Migration 单元（暂缓区，实现时再编）

| 单元 | 内容 | 涉及表 | 触发时机 |
|---|---|---|---|
| **M4 · 班级动态** ⏸（建表+后台·不做前端，DR-145）| §5.1 ClassPost/ClassPostReaction/ClassPostComment/ClassPostShare（4 张）| →Class/User | P7 社交（DR-50~52；DR-145 仅后台）|
| **M5 · 班级讨论** ⏸（建表+后台·不做前端，DR-145）| §5.2 Discussion/DiscussionViewpoint/DiscussionVote/DiscussionComment（4 张）| →Class/User/Lesson/Course | P7 社交（DR-53；DR-145 仅后台）|
| **M6 · 约修** ⏸（建表+后台·不做前端，DR-145）| §5.3 PracticeAppointment/PracticeAppointmentParticipant（2 张）| →Class/User/PracticeProject；需恢复 PracticeProject.appointments[] 反向（已补，TODO-3）| P7 社交（DR-57~60；DR-145 仅后台）|
| **M7 · 自学模式** ✅ 必做（DR-145）| §5.4 UserSelfStudyProgram（1 张，DR-104 删 RestWeek，DR-145 计入 §三新建）；同时恢复 Program.selfStudy[] 反向关联（TODO-5）| →User/Program | **新 P6（核心跑通即上，DR-145）**（DR-61/103/104，TODO-5）|
| **M8 · AI 助手** ⏸ | ContentChunk/FeatureEntry/AiConversation/AiMessage（**4 张新建**）+ AiUsage **复用 LlmCallLog/LlmProviderUsage 不新建**（DR-110）；依赖 pgvector 扩展 | 独立模块 | 能力 25；AI 模块独立推进（DR-74/106/108/109）|

### 11.3 Migration 覆盖完整性核对

- **§一 扩展 12 张**（DR-123 校准，UserPracticeVow 移出至 §三）→ M1 全覆盖 ✅（含 PracticeLog = PracticeEntry rename+加列）
- **§二 替换 3 张** → M2a(UserRoleAssignment) + M2b(CareFollowupRecord) + M2c(TransmissionRecord) 全覆盖 ✅
- **§三 新建 20 张**（DR-123→129→139→145 校准，+UserPracticeVow +PracticeTemplate +LessonCompletion +SmsLog +UserSelfStudyProgram）→ M3a(2) + M3b(4) + M3c(3) + M3d(6) + M3e(2) + M3f(1) + M3g(1, SmsLog) = 19 + **M7(1, UserSelfStudyProgram, DR-145 转必做)** = 20 ✅（M3g 另含 User +phone ALTER，属 §一字段扩展不计表数）
- **实修域改造源清理** → M1.5（PracticeGoal/PracticeTask/PracticeDailySummary 不入目标 schema，DR-122）
- **§五 暂缓 10 张（社交）+ AI 4 张**（AiUsage 复用不计，DR-110）→ 社交 M4~M6（建表+后台·不做前端，P7）+ AI M8（暂缓，P8）⏸（§五 10 = 社交 4+4+2；**自学 M7（1 张）随 DR-145 转必做、移 §三、入 P6**，不再属暂缓）
- **§四 复用 20 张**（DR-134 校准：DR-129 后 21 张 −Event −EventCount（废弃幻影，DR-134）+DharmaAssembly（补登记真实净资产，原漏登）= 20）→ 不动，不入 migration。**注**：此 20 张口径含 DR-130 标「实为新建」的幻影表（物理列于 §四但实为新建），真实可复用净资产仅 8 张（详见 DR-130/134）；Event/EventCount 废弃后不入任何区

---

## 十二、实施 Phase 计划（全表封板后统编，检查项 6 闭合）

> 按「依赖优先 + 业务价值」排期。权限体系是一切的地基（所有写操作要校验角色），故 Phase 1 先行；升学条件体系是本次融合的核心新能力，Phase 2 紧随。每个 Phase 含：DB（对应 migration）+ 后端 API + 管理端页面 + 验收口径。

| Phase | 主题 | DB（migration）| 后端 API | 管理端/前端 | 依赖 | 状态 |
|---|---|---|---|---|---|---|
| **P0** | 地基：枚举 + 扩展字段 | M0 + M1 | 无（仅 schema）| 无 | 无 | 待建 |
| **P1** | 角色权限 + 审计 | M2a(UserRoleAssignment) + M3a | 角色任命/撤销 API、`canDo(user,perm,scope)` 中间件、AuditLog 写入与查询（能力 20）| 角色管理页、审计日志查询页 | P0 | 待建 |
| **P2** | 升学条件体系（核心）| M3b | ProgramAdvancementConfig CRUD、SemesterSnapshot 定时生成、AdvancementCheck 预检引擎（6 类 conditionType 解析）、AdvancementRecord 拍板 | DR-101 四页：①升学条件配置 ②考试管理（录 ExamGrade）③升学资格预检 ④学员达标进度 | P1（写操作校验角色 + 豁免走 AuditLog）| 待建 |
| **P3** | 关怀体系 | M3c + M2b（先 CareWatchlistItem 后 CareFollowupRecord）| StudentSpecialStatus 认定（能力 13）、CareWatchlistItem 自动触发 + 手动添加、CareFollowupRecord 跟进、ReportConfession 虚报忏悔流（能力 14）| 关怀清单页、特殊身份认定页、虚报处理页 | P1、P2（report_overdue/false_report 触发依赖 SemesterSnapshot/AdvancementCheck）| 待建 |
| **P4** | 班级运维 + 实修体系 | M3d + M3e | ClassInviteCode（能力 5）、AssistantAssignment（能力 19）、LeaveRequest 审批（DR-90）、ClassTask 布置、ClassSessionSchedule 定时生成 ClassSession（能力 4/8）、EnrollmentStatusHistory 留痕；**实修打卡（能力 4/6/7）：UserPracticeVow 发愿/聚合、PracticeLog 打卡录入、PracticeTemplate 模板**（DR-122/123）| 邀请码管理页、辅助员配对页、请假审批页、班级任务页、共修课表页、实修打卡页 | P1 | 待建 |
| **P5** | 传承体系 | M2c(TransmissionRecord) | TransmissionRecord 录入/灌顶代录、密法访问 EXISTS 查询（DR-44/45）、升学清单 isRequired 核对 | 传承录入页 | P1 | 待建 |
| **P6** | 自学模式（DR-145 转必做）| M7 | 自学开通（subject_admin）、纯完成量进度（聚合 LessonCompletion/PracticeLog，DR-104）、个人学修量录入（恢复 TODO-5 反向关联）| 自学管理页 + 学员自学端 | P0+P4（需扩展字段 + 能力 7 打卡复用；不升学故不依赖 P2，DR-103/104）| ✅ 必做（核心跑通即上）|
| **P7** | 班级动态/讨论/约修（DR-145 降后台关键部分）| M4 + M5 + M6 | 帖子/评论/点赞、讨论投票、集体约修（建表+后台逻辑，不做正式前端 UI）| —（不做正式前端）| P1 | ⏸ 建表+后台·不做正式前端 |
| **P8** | AI 助手 ⏸（能力 25）| M8 | RAG 检索（全部法本）、对话、用量统计、辅导员洞察 | AI 助手入口（学员）+ 问答洞察（辅导员）+ AI 配置中心（super_admin）| 独立（pgvector）| ⏸ 暂缓（DR-74/106）|

### 12.1 Phase 覆盖完整性核对

- **所有新表/扩展字段**均落在某 Phase：P0（扩展字段 M1 + 改造源清理 M1.5）/ P1（权限审计 M2a+M3a）/ P2（升学 M3b）/ P3（关怀 M3c+M2b）/ P4（运维 M3d + 实修 M3e）/ P5（传承 M2c）/ **P6 自学 M7（DR-145 必做）/ P7 社交 M4~M6（后台关键部分）/ P8 AI M8（暂缓）** ✅
- **实修域 P2↔P4 时序注（DR-123）**：升学预检（P2）消费加行/内加行修量聚合（UserPracticeVow，M3e 在 P4）。UserPracticeVow 核心字段不依赖 ClassTask（仅 classTaskId 可空 FK 依赖 M3d），实现时若 P2 需先于 P4，可比照 ClassSession.scheduleId 模式延后 classTaskId FK；或将 M3e 的 UserPracticeVow 提前至 P2。属实现期排期细节，不影响设计完整性
- **§二 替换 3 张分属三 Phase**：M2a→P1、M2b→P3、M2c→P5（检查轮次 48 修复，原 M2 整体单元拆为 M2a/b/c）✅
- **DR-101 四页管理界面**全部落 P2 ✅
- **关键依赖链**：P1（权限）→ 一切写操作；P2（升学）→ P3 触发器；P3 内 CareWatchlistItem→CareFollowupRecord 顺序；无环 ✅
- **暂缓区**（DR-145 后 §五 10 张社交 + AI 4 张，AiUsage 复用 DR-110）对应 P7~P8 ✅（§五 10 = 班级动态 4 + 讨论 4 + 约修 2，均「建表+后台·不做正式前端」；自学 1 张随 DR-145 转必做、移 §三、入 P6）

---

## 十三、02 文档 23 职能 × 写表覆盖核对（检查项 13 闭合）

> 对《02-roles-and-permissions-v1.md》§四 23 项职能逐条核对：每个**写权限（W）**职能是否有对应表承载写操作，高权限操作是否有 AuditLog 留痕。读权限（R）职能不涉及写表，标「只读」。

| # | 职能 | 写权限角色 | 承载表（写操作）| 留痕表 | 覆盖 |
|---|---|---|---|---|---|
| 1 | 教学讲解（讲法/答疑/笔记导读）| class_tutor W | Lesson / LessonResource / LessonTextBlock / LessonMediaChapter / QuestionReference（§四 复用）| —（内容编辑，非高权限）| ✅ |
| 2 | 学员报数审核（本班）| class_admin W | SemesterSnapshot（快照数据源，冻结）+ 底层 PracticeLog/UserPracticeVow/LessonCompletion；虚报触发 CareWatchlistItem(false_report)| ReportConfession（虚报忏悔）+ AuditLog | ✅ |
| 3 | 学员日常关怀（本班）| class_admin W | CareFollowupRecord（§2.2）+ CareWatchlistItem（§3.4）| —（关怀记录本身即留痕）| ✅ |
| 4 | 班级共修活动管理 | class_admin W | ClassSession（§1.6）+ ClassSessionSchedule（§3.13）| —| ✅ |
| 5 | 班级邀请码管理 | class_admin W | ClassInviteCode（§3.5）| AuditLog(invite_code) | ✅ |
| 6 | 批准自学/网络共修申请 | class_admin W | UserSelfStudyProgram（§5.4 ⏸ 暂缓）+ ClassSession(sessionType=self_study/online) | —| ⏸ 表暂缓，权限链就位 |
| 7 | 学员考试成绩录入 | class_admin W | ExamGrade（§1.4，subject_admin 升学考 / class_admin 随堂）| AuditLog(exam_grade) | ✅ |
| 8 | 看本班学员数据 | class_tutor R | 只读 | — | ✅ 只读 |
| 9 | 看本学科全部班级数据 | subject_admin R | 只读 | — | ✅ 只读 |
| 10 | 看全平台数据 | super_admin R | 只读 | — | ✅ 只读 |
| 11a | 出本班测验/随堂题 | class_tutor W | Exam(examType=quiz)（§1.4）| —| ✅ |
| 11b | 出升学考题（S5/S8）| class_admin W | Exam(examType=advancement)（§1.4）| —| ✅ |
| 12 | 批准 200 万金刚萨埵替代顶礼 | class_admin W | UserPracticeVow(isSubstituted=true)（§1.7）+ 新建心咒 vow | AuditLog(proxy_action)（DR-94）| ✅ |
| 13 | 学员特殊身份变更认证 | class_admin W | StudentSpecialStatus（§3.3）+ User.accessibilityNeeds 双写 | AuditLog(special_status) | ✅ |
| 14 | 取消虚报学员资格 | class_admin W | ReportConfession（§3.8）+ ClassMember(cohortStatus 改)| AuditLog(disqualify_reporter) | ✅ |
| 15 | 批量登记传承法会 | ❌ 不做 | —（02 文档已标 ❌）| — | ✅ 不做 |
| 16 | 升学资格审核（预科→正科）| class_admin W | AdvancementCheck（§3.9，豁免）+ AdvancementRecord（§3.10，拍板）| AuditLog(advancement_decision) | ✅ |
| 17 | 创建新一届班级 | subject_admin W | Class（§1.10）+ ClassMember | —| ✅ |
| 18 | 创建新专业 | super_admin W | Program（§1.1）| —| ✅ |
| 19 | 配对辅助员（全班学员）| class_admin W | AssistantAssignment（§3.6）| —| ✅ |
| 20 | 平台级配置（LLM/法本元数据/全局参数）| super_admin W | Program/Lesson 元数据 + 全局配置 | AuditLog（class_archive 等高权限）| ✅ |
| 21 | 管理员代行操作（豁免/替代/调整/修正/追溯）| class_admin W | **横切**：作用于 UserPracticeVow/StudyRecord/AdvancementCheck/ExamGrade 等被代行对象 | AuditLog(proxy_action)（D17 核心）| ✅ |
| 22 | 撤销学员的出勤打卡 | class_admin W | StudyRecord（出勤记录，不物理删 D18）| AuditLog(attendance_revoke) | ✅ |
| 23 | 给学员补打卡（任意类型）| class_tutor W | StudyRecord / LessonCompletion / PracticeLog（补录）| AuditLog(checkin_proxy) | ✅ |

### 13.1 核对结论

- **23 职能全部有承载**：21 项 ✅ 已就位（写表 + 留痕齐全）；1 项（#6 自学/网络共修）⏸ 表暂缓但权限链就位；1 项（#15）❌ 不做（02 已标）。
- **AuditLog 11 类 actionType 全部对应到职能**：proxy_action(#12/21)、role_assignment(P1 角色任命)、exam_grade(#7)、advancement_decision(#16)、attendance_revoke(#22)、checkin_proxy(#23)、special_status(#13)、disqualify_reporter(#14)、invite_code(#5)、class_archive(#20 归档)、transmission_proxy(#15 传承代录——注：#15 法会批量登记 ❌ 不做，但单条传承代录仍走 §2.3 TransmissionRecord.entryMethod + 此 actionType）。**无悬空 actionType，无缺失留痕的高权限职能** ✅。
- **权限继承一致性**：所有 W 职能的最低角色等级与 02 文档矩阵一致（class_tutor=1 的 #1/#11a/#23；class_admin=2 的多数；subject_admin=3 的 #17；super_admin=99 的 #18/#20）✅。
