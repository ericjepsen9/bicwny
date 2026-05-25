# 三殊胜整合设计方案

> 基于：三殊胜测试场景文档 + 8 组逐项讨论决策  
> 技术栈：维持现有 Fastify + Prisma + PostgreSQL + JWT  
> 策略：现有表保留不动，新增表支持新功能，存在重叠的表在原表上加字段  
> 生成日期：2026-05-25

---

## 目录

1. [改动总览](#一改动总览)
2. [数据库改动](#二数据库改动)
   - 新增枚举
   - 现有表字段扩展
   - 新增表（28 张，含完整 Prisma schema）
   - 新增 SQL 视图
3. [后端改动范围](#三后端改动范围)
4. [前端改动范围](#四前端改动范围)
5. [业务规则与权限约束](#五业务规则与权限约束)
6. [Migration 策略](#六migration-策略)
7. [分阶段实施计划](#七分阶段实施计划)

---

## 一、改动总览

| 类型 | 数量 |
|---|---|
| 新增 Prisma 枚举 | 7 个 |
| 现有表新增字段 | 7 张表，共 24 个字段 |
| 新增表 | 28 张 |
| 新增 SQL 视图 | 2 个 |
| 现有表不动 | 50+ 张（全部保留） |
| 新增后端模块 | 16 个 |
| 修改后端模块 | 6 个 |
| 新增前端页面（师兄端） | 6 个 |
| 新增前端页面（主麦端） | 5 个 |
| 新增前端页面（Admin 端） | 7 个 |

---

## 二、数据库改动

### 2.1 新增枚举

```prisma
// 班级管理员角色
enum ClassAdminRole {
  zhumai  // 主麦：班级运营 + 讲考管理 + 审核打卡
  aixin   // 爱心师兄：关怀跟进
}

// 学习模式
enum LearningMode {
  class       // 跟班学习
  self_study  // 自学
  both        // 混合（同时跟班 + 自学不同科系）
}

// 班级成员状态（替代 removedAt 二态）
enum CohortMemberStatus {
  active      // 正常学习
  paused      // 暂停（师兄自助，可恢复）
  held_back   // 留级（移至下一届）
  graduated   // 毕业
  left        // 退班
}

// 修持愿 7 态状态机
enum VowStatus {
  on_track        // 正常
  slightly_behind // 略微落后
  falling_behind  // 明显落后
  at_risk         // 高风险
  will_overdue    // 即将超期
  completed       // 已完成
  paused          // 已暂停
}

// 修持愿来源
enum VowSource {
  auto    // 入班时按模板自动建
  custom  // 师兄自发建
}

// 修持计量方式
enum PracticeMeasurement {
  count     // 遍数（念诵类）
  duration  // 座次 + 时长（禅修类）
}

// 账号状态（扩展现有 status 字段语义）
enum ProfileStatus {
  active
  suspended
  inactive
  graduated
}
```

---

### 2.2 现有表字段扩展

#### `User` 表（+5 个字段）

```prisma
model User {
  // ... 现有所有字段保留 ...

  // 新增
  studentId          String?      @unique
  // 格式：{年份4位}{序号3位}，如 2026001
  // 新注册：后端事务自动生成；老学员植入：传入原值，系统不覆盖

  accessibilityNeeds String[]     @default([])
  // 取值约束：['blind', 'deaf']，应用层校验

  dataSource         String       @default("self_register")
  // 取值：self_register / imported / admin_created

  learningMode       LearningMode @default(class)
  // class / self_study / both

  preferShowFaxin    Boolean      @default(true)
  // 打卡前是否显示发心语（三殊胜精神框架）
}
```

#### `Class` 表（+4 个字段）

```prisma
model Class {
  // ... 现有字段保留（joinCode / name / courseId 等）...

  // 新增
  programId  String?
  startDate  DateTime?
  // 班级起始日期，算法基准：当前课时号 = 自然周数 - 休息周数
  city       String?
  // 班级所在城市（北京 / 纽约 / 香港等）
  timezone   String?
  // IANA 时区，如 America/New_York。共修/讲考时间按此时区显示

  program    Program? @relation(fields: [programId], references: [id])
}
```

#### `ClassMember` 表（+7 个字段）

```prisma
model ClassMember {
  // ... 现有字段保留（classId / userId / role / joinedAt / removedAt）...
  // removedAt 保留不删，存量数据兼容

  // 新增
  cohortStatus       CohortMemberStatus @default(active)
  isPrimary          Boolean            @default(false)
  // 同一时刻一个师兄只有一个主班，应用层事务保证唯一（不用 DB 唯一索引）
  heldBackCount      Int                @default(0)
  statusChangedAt    DateTime?
  statusChangedBy    String?            // 操作人 userId
  statusChangeReason String?
  graduatedAt        DateTime?
}
```

#### `Course` 表（+2 个字段）

```prisma
model Course {
  // ... 现有字段保留 ...

  // 新增
  isTantric  Boolean  @default(false)
  // 密法标识：未授权师兄所有查询均不返回（零痕迹，非"看到但打不开"）
  programId  String?
  program    Program? @relation(fields: [programId], references: [id])
}
```

#### `Lesson` 表（+1 个字段）

```prisma
model Lesson {
  // ... 现有字段保留（referenceText / teachingSummary 等）...

  // 新增
  sourceText String?
  // 法本原文正文（造论者所著）
  // 与现有 referenceText 并存，referenceText 不废弃
}
```

#### `ClassSession` 表（+2 个字段）

```prisma
model ClassSession {
  // ... 现有字段保留（classId / title / startAt / durationMin / liveLink 等）...

  // 新增（将 ClassSession 扩展为"共修场次"）
  lessonId     String?
  // 本次共修对应哪节课
  sessionEndAt DateTime?
  // 结束时刻（审核态时间窗口使用）

  lesson       Lesson? @relation(fields: [lessonId], references: [id])
}
```

#### `UserCourseEnrollment` 表（+3 个字段）

```prisma
model UserCourseEnrollment {
  // ... 现有字段保留（source / enrolledViaClassId 等）...

  // 新增（自学模式时间推进）
  selfStudyStartDate DateTime?
  selfStudyPace      String?   // standard / fast / custom
  selfStudyStatus    String    @default("active")
  // active / paused / completed / abandoned
}
```

---

### 2.3 新增表（28 张）

#### 组织层级（1 张）

```prisma
// 科系（加行 / 净土 / 入行论 / 基础等）
// Academy 层暂不建表，此处预留 academyId 字段
model Program {
  id          String   @id @default(cuid())
  name        String   // "加行"
  code        String   @unique // "jiaxing"
  description String?
  academyId   String?  // 预留，Academy 表将来建好后再关联

  createdAt   DateTime @default(now())

  classes     Class[]
  courses     Course[]
  selfStudy   UserSelfStudyProgram[]
  semesters   ProgramSemester[]
  weeks       ProgramWeek[]
  studyTypes  ProgramStudyType[]
}
```

#### 班级管理员（1 张）

```prisma
// 主麦 / 爱心师兄（从 ClassMember.role=coach 独立出来）
// Migration：现有 ClassMember.role='coach' 数据批量写入此表，role=zhumai
model ClassAdmin {
  id         String         @id @default(cuid())
  classId    String
  userId     String
  role       ClassAdminRole // zhumai / aixin
  assignedAt DateTime       @default(now())
  assignedBy String?        // 操作人 admin userId

  class      Class          @relation(fields: [classId], references: [id])
  user       User           @relation(fields: [userId], references: [id])

  @@unique([classId, userId, role])
}
```

#### 双模式学习（3 张）

```prisma
// 班级休息周（admin 管理，全班算法自动跳过）
model CohortRestWeek {
  id            String   @id @default(cuid())
  classId       String
  restStartDate DateTime // 休息周的周一日期（ISO 8601）
  reason        String?
  createdBy     String   // admin userId
  createdAt     DateTime @default(now())

  class         Class    @relation(fields: [classId], references: [id])
}

// 自学师兄的科系学习记录
model UserSelfStudyProgram {
  id        String   @id @default(cuid())
  userId    String
  programId String
  startDate DateTime // 个人起修日
  pace      String   @default("standard") // standard / fast / custom
  status    String   @default("active")   // active / paused / completed / abandoned
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id])
  program   Program  @relation(fields: [programId], references: [id])
  restWeeks UserSelfStudyRestWeek[]

  @@unique([userId, programId])
}

// 自学师兄的个人休息周
model UserSelfStudyRestWeek {
  id            String               @id @default(cuid())
  selfStudyId   String
  restStartDate DateTime
  reason        String?
  createdAt     DateTime             @default(now())

  selfStudy     UserSelfStudyProgram @relation(fields: [selfStudyId], references: [id])
}
```

#### 课程内容扩展（2 张）

```prisma
// 课时多讲者讲解资源
// 替代 Lesson 上的固定 teacher 槽位，原有 teacher 字段保留不删
model LessonResource {
  id          String   @id @default(cuid())
  lessonId    String
  speakerName String   // 讲者全名（含尊称），如"索达吉堪布"
  videoUrl    String?
  audioUrl    String?
  notes       String?  // 讲记（富文本）
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())

  lesson      Lesson   @relation(fields: [lessonId], references: [id])
}

// 观修引导内容（92修法等 duration 类修法）
model PracticeGuide {
  id            String   @id @default(cuid())
  practiceId    String   // 关联现有 PracticeProject.id
  contentNumber Int?     // 第几法（92修法：1-92；其他可为 null）
  title         String
  videoUrl      String?
  guideText     String?
  sortOrder     Int      @default(0)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())

  @@unique([practiceId, contentNumber])
}
```

#### 修持愿系统（4 张）

```prisma
// 修持模板库（admin 管理，班级绑定后入班时自动建愿）
model PracticeTemplate {
  id                  String   @id @default(cuid())
  name                String
  description         String?
  practiceProjectId   String?  // 关联现有 PracticeProject
  targetCount         Int?
  targetPeriod        String   // daily / weekly / lifetime
  defaultDailyTarget  Int?
  defaultWeeklyTarget Int?
  startsOffsetDays    Int?     // 距班级 startDate 多少天后起修
  durationDays        Int?     // 起修后多少天内完成
  appliesToPrograms   String[] // 适用科系 code 列表
  isActive            Boolean  @default(true)
  displayOrder        Int      @default(0)
  createdBy           String   // admin userId
  createdAt           DateTime @default(now())

  cohortBindings      CohortRecommendedTemplate[]
  vows                UserPracticeVow[]
}

// 班级 ↔ 修持模板绑定
model CohortRecommendedTemplate {
  id           String           @id @default(cuid())
  classId      String
  templateId   String
  binding      String           @default("auto")
  // auto：入班即自动建愿 / recommended：推荐但不强制
  displayOrder Int              @default(0)

  class        Class            @relation(fields: [classId], references: [id])
  template     PracticeTemplate @relation(fields: [templateId], references: [id])

  @@unique([classId, templateId])
}

// 修持愿（7 态状态机核心表）
model UserPracticeVow {
  id    String    @id @default(cuid())
  userId String
  source VowSource // auto / custom

  // 关联
  templateId        String?  // auto 愿关联模板
  classId           String?  // auto 愿关联班级（custom 愿可为 null）
  eventId           String?  // 法会回向标签
  appointmentId     String?  // 约修关联

  // 修持内容
  practiceProjectId String   // 修什么（关联现有 PracticeProject）
  customName        String?  // custom 愿自定义名称

  // 目标
  targetCount       Int?
  targetPeriod      String   // daily / weekly / lifetime
  dailyTarget       Int?
  weeklyTarget      Int?
  minSessionMinutes Int      @default(30)

  // 节奏历史（每次调整自动追加）
  paceHistory       Json?    // [{set_at, daily_target, changed_by, reason}]

  // 时间
  startDate         DateTime
  currentEndDate    DateTime?
  // auto 愿：仅主麦可改（自动写 AuditLog）
  // custom 愿：师兄自己可改

  // 进度
  currentCount        Int     @default(0)
  currentSessionCount Decimal @default(0)

  // 状态（仅主麦/爱心可见，师兄端 API 不返回）
  currentStatus      VowStatus @default(on_track)
  statusCalculatedAt DateTime?

  // 生命周期
  status      String    @default("active") // active / paused / completed / abandoned
  pausedAt    DateTime?
  pausedBy    String?   // 暂停人 userId
  pausedReason String?
  resumedAt   DateTime?
  completedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User              @relation(fields: [userId], references: [id])
  template PracticeTemplate? @relation(fields: [templateId], references: [id])
  logs     PracticeLog[]
}

// 修持打卡记录
model PracticeLog {
  id     String @id @default(cuid())
  userId String
  vowId  String // 必须关联一条愿（非空）

  // 计量
  count           Int?
  durationMinutes Int?
  sessionCount    Decimal?
  // 自动计算：≥30min=1座, ≥15min=0.5座, <15min=0座

  sessionAttempt  Int      @default(1) // 同日第几次打卡

  // 92修法：必填
  practiceGuideId String?  // 选的第几法（92修法时不可为 null）

  // 反思
  reflection   String?
  reflectionAt DateTime?

  logDate   DateTime
  logTime   DateTime?

  // 审核态
  isConfirmed  Boolean   @default(false)
  confirmedAt  DateTime?
  confirmedBy  String?   // 主麦 userId

  createdAt DateTime @default(now())

  user User            @relation(fields: [userId], references: [id])
  vow  UserPracticeVow @relation(fields: [vowId], references: [id])
}
```

#### 闻思打卡系统（3 张）

```prisma
// 闻思类打卡（听课 / 讲记 / 讲考 / 共修）
model StudyRecord {
  id      String @id @default(cuid())
  userId  String
  classId String?  // 自学师兄可为 null
  lessonId String  // 所有打卡必须绑定课时

  studyType String
  // listen            听课
  // read_notes        读讲记
  // speaking_present  讲考：主讲（三选一）
  // speaking_question 讲考：提问（三选一）
  // speaking_observe  讲考：旁听（三选一）
  // group_attend      共修：出席（二选一）
  // group_absent      共修：缺席（二选一）
  // group_review      共修：复习
  // group_summary     共修：总结

  lessonResourceId  String?  // 听课/读讲记：选哪位讲者版本
  classSessionId    String?  // 共修：关联 ClassSession
  speakingSessionId String?  // 讲考：关联 SpeakingSession

  studyDate DateTime
  createdBy String?  // 本人或主麦代录

  // 审核态
  isConfirmed  Boolean   @default(false)
  confirmedAt  DateTime?
  confirmedBy  String?   // 主麦 userId

  createdAt DateTime @default(now())

  user   User    @relation(fields: [userId], references: [id])
  lesson Lesson  @relation(fields: [lessonId], references: [id])
}

// 讲考场次
model SpeakingSession {
  id           String   @id @default(cuid())
  classId      String
  lessonId     String
  sessionEndAt DateTime // 审核窗口截止时间
  notes        String?
  createdBy    String   // 主麦 userId
  createdAt    DateTime @default(now())

  class  Class  @relation(fields: [classId], references: [id])
  lesson Lesson @relation(fields: [lessonId], references: [id])

  @@unique([classId, lessonId])
}

// 每日修持日记
// 与现有 Note（课时笔记）完全不同：日记绑日期，笔记绑课时
model PracticeJournal {
  id          String   @id @default(cuid())
  userId      String
  classId     String?
  journalDate DateTime // 对应日期（不含时间）
  content     String
  visibility  String   @default("private")
  // private / visible_to_coach

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, journalDate])
}
```

#### 思考题（1 张）

```prisma
// 参考答案独立表（替代 Question.payload.referenceAnswer）
// 现有 Question.payload 字段保留，此表作为正式来源
model QuestionReference {
  id            String    @id @default(cuid())
  questionId    String    @unique // 每题唯一一份参考答案
  referenceText String
  publishedAt   DateTime?
  publishedBy   String?   // admin userId
  updatedAt     DateTime  @updatedAt

  question Question @relation(fields: [questionId], references: [id])
}
```

#### 排表模板系统（6 张）

```prisma
// 学期模板（第几学期，第几周到第几周）
model ProgramSemester {
  id             String   @id @default(cuid())
  programId      String
  semesterNumber Int      // 第几学期
  semesterName   String?
  startsWeek     Int      // 全程第几周开始
  endsWeek       Int      // 全程第几周结束

  program Program       @relation(fields: [programId], references: [id])
  weeks   ProgramWeek[]

  @@unique([programId, semesterNumber])
}

// 周模板（不存具体日历日期，只存内容序号）
model ProgramWeek {
  id            String   @id @default(cuid())
  programId     String
  semesterId    String
  weekNumber    Int      // 学期内第几周
  globalWeekNum Int      // 全程第几周
  isHoliday     Boolean  @default(false)
  notes         String?

  program   Program         @relation(fields: [programId], references: [id])
  semester  ProgramSemester @relation(fields: [semesterId], references: [id])
  courses   ProgramWeekCourse[]
  practices ProgramWeekPractice[]
  selfStudy ProgramWeekSelfStudy[]

  @@unique([programId, globalWeekNum])
}

// 周 ↔ 课程映射
model ProgramWeekCourse {
  id           String @id @default(cuid())
  weekId       String
  courseId     String
  lessonId     String? // 本周上哪节课
  displayOrder Int     @default(0)

  week   ProgramWeek @relation(fields: [weekId], references: [id])
  course Course      @relation(fields: [courseId], references: [id])
}

// 周 ↔ 修法建议（92修法 / 上师瑜伽等）
model ProgramWeekPractice {
  id              String @id @default(cuid())
  weekId          String
  practiceId      String // 关联现有 PracticeProject
  practiceGuideId String? // 具体第几法
  displayOrder    Int     @default(0)
  notes           String?

  week ProgramWeek @relation(fields: [weekId], references: [id])

  @@unique([weekId, practiceId, practiceGuideId])
}

// 周 ↔ 自学读物映射
model ProgramWeekSelfStudy {
  id           String @id @default(cuid())
  weekId       String
  bookId       String
  displayOrder Int    @default(0)

  week ProgramWeek   @relation(fields: [weekId], references: [id])
  book SelfStudyBook @relation(fields: [bookId], references: [id])

  @@unique([weekId, bookId])
}

// 各科系打卡要求声明（数据驱动，不硬编码）
model ProgramStudyType {
  programId    String
  studyType    String  // listen / read_notes / speaking_present 等
  requirement  String  // required / recommended
  displayOrder Int     @default(0)
  displayLabel String  // 前端显示名

  program Program @relation(fields: [programId], references: [id])

  @@id([programId, studyType])
}
```

#### 自学读物（2 张）

```prisma
// 18 本《大学演讲系列》种子数据
model SelfStudyBook {
  id           String @id @default(cuid())
  bookNumber   Int    // 1-18
  title        String
  author       String @default("索达吉堪布")
  description  String?
  displayOrder Int    @default(0)

  records  SelfStudyRecord[]
  weekPlan ProgramWeekSelfStudy[]

  @@unique([bookNumber])
}

// 师兄阅读记录
model SelfStudyRecord {
  id          String    @id @default(cuid())
  userId      String
  classId     String?
  bookId      String
  status      String    @default("not_started")
  // not_started / reading / completed
  startedAt   DateTime?
  completedAt DateTime?
  notes       String?   // 读后感

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User          @relation(fields: [userId], references: [id])
  book SelfStudyBook @relation(fields: [bookId], references: [id])

  @@unique([userId, classId, bookId])
}
```

#### 集体功能（3 张）

```prisma
// 法会活动（集体回向依赖此表）
// 与现有 DharmaAssembly 并存：DharmaAssembly 用于展示，Event 用于回向统计
model Event {
  id          String   @id @default(cuid())
  title       String
  eventType   String   // puja / dharma_assembly / weekly
  startDate   DateTime
  endDate     DateTime
  description String?
  isActive    Boolean  @default(true)
  createdBy   String   // admin userId
  createdAt   DateTime @default(now())
}

// 约修（师兄发起，加入 = 自动建一条 custom 愿）
model PracticeAppointment {
  id            String    @id @default(cuid())
  initiatorId   String
  classId       String?
  title         String
  targetCount   Int?
  practiceId    String    // 关联 PracticeProject
  scheduledDate DateTime?
  notes         String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())

  initiator User @relation(fields: [initiatorId], references: [id])
  // 参与者通过 UserPracticeVow.appointmentId 关联，N 人加入 = N 条 custom 愿
}

// 关怀跟进记录（仅爱心师兄填写，师兄端完全不可见）
model CareFollowup {
  id             String   @id @default(cuid())
  studentId      String   // 被关怀的师兄 userId
  classId        String
  careWorkerId   String   // 爱心师兄 userId
  contactedAt    DateTime
  summary        String
  followUpStatus String   @default("pending")
  // pending / resolved / escalated
  createdAt      DateTime @default(now())

  student    User  @relation("CareStudent",  fields: [studentId],  references: [id])
  careWorker User  @relation("CareWorker",   fields: [careWorkerId], references: [id])
  class      Class @relation(fields: [classId], references: [id])
}
```

#### 权限控制（1 张）

```prisma
// 密法白名单（admin 直接 INSERT，无申请审批）
// 未在白名单的师兄，所有 Course 查询均过滤掉密法（零痕迹）
model TantricAccessGrant {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  grantedAt DateTime @default(now())
  grantedBy String   // admin userId

  user   User   @relation(fields: [userId], references: [id])
  course Course @relation(fields: [courseId], references: [id])

  @@unique([userId, courseId])
}
```

#### 汇总缓存（1 张）

```prisma
// 班级周修持汇总（主麦生成后复制到 WhatsApp）
model CohortWeeklySummary {
  id            String   @id @default(cuid())
  classId       String
  weekStartDate DateTime
  weekEndDate   DateTime
  summaryData   Json     // 结构化汇总（修持总量 / 闻思打卡人数等）
  generatedAt   DateTime @default(now())
  sharedAt      DateTime?
  sharedBy      String?  // 主麦 userId

  class Class @relation(fields: [classId], references: [id])

  @@unique([classId, weekStartDate])
}
```

---

### 2.4 新增 SQL 视图

在 Prisma migration SQL 中创建，后端通过 `$queryRaw` 调用：

```sql
-- 法会回向聚合视图（只显总量，不露个人）
-- 密法愿（practiceProject.isTantric=true）不计入
CREATE VIEW v_event_dedication_totals AS
SELECT
  v.event_id,
  v.practice_project_id,
  SUM(pl.count)            AS total_count,
  SUM(pl.duration_minutes) AS total_minutes,
  COUNT(DISTINCT v.user_id) AS participant_count
FROM user_practice_vows v
JOIN practice_logs pl ON pl.vow_id = v.id
JOIN practice_projects pp ON pp.id = v.practice_project_id
WHERE v.event_id IS NOT NULL
  AND pp.is_tantric = false
GROUP BY v.event_id, v.practice_project_id;

-- 每周回向聚合视图（班级层 + 全会层）
CREATE VIEW v_weekly_dedication_totals AS
SELECT
  DATE_TRUNC('week', pl.log_date) AS week_start,
  v.class_id,
  v.practice_project_id,
  SUM(pl.count)            AS total_count,
  SUM(pl.duration_minutes) AS total_minutes,
  COUNT(DISTINCT v.user_id) AS participant_count
FROM practice_logs pl
JOIN user_practice_vows v ON pl.vow_id = v.id
JOIN practice_projects pp ON pp.id = v.practice_project_id
WHERE pp.is_tantric = false
GROUP BY DATE_TRUNC('week', pl.log_date), v.class_id, v.practice_project_id;
```

---

## 三、后端改动范围

### 3.1 新增 API 模块（16 个）

| 模块 | 路由前缀 | 主要功能 |
|---|---|---|
| Programs | `/api/programs` | 科系 CRUD（admin）|
| ClassAdmins | `/api/classes/:id/admins` | 主麦/爱心分配管理 |
| CohortRestWeeks | `/api/classes/:id/rest-weeks` | 班级休息周管理 |
| CurrentLesson | `/api/classes/:id/current-lesson` | 当前课时号查询（进度算法）|
| VowTemplates | `/api/practice-templates` | 修持模板管理（admin）|
| Vows | `/api/vows` | 修持愿 CRUD + 状态机 |
| VowLogs | `/api/vows/:id/logs` | 修持打卡 |
| VowPause | `/api/vows/:id/pause` + `/resume` | 愿暂停/恢复 |
| StudyRecords | `/api/study-records` | 闻思打卡（含批量补录）|
| SpeakingSessions | `/api/classes/:id/speaking-sessions` | 讲考场次管理 |
| PracticeJournals | `/api/journals` | 修持日记 CRUD |
| SelfStudy | `/api/self-study` | 自学师兄管理 + 读物记录 |
| Events | `/api/events` | 法会活动（admin）+ 回向聚合 |
| Appointments | `/api/appointments` | 约修发起 / 加入 |
| CareFollowups | `/api/care-followups` | 关怀跟进（爱心师兄专属）|
| TantricGrants | `/api/admin/tantric-grants` | 密法白名单（admin 专属）|

### 3.2 修改现有模块（6 个）

| 模块 | 改动内容 |
|---|---|
| `users` | 注册时自动生成 studentId；返回 learningMode / preferShowFaxin；accessibilityNeeds 校验 |
| `classes` | 创建/编辑支持 programId / startDate / city / timezone |
| `class-members` | 状态机操作（pause / hold-back / graduate / leave）；isPrimary 切换事务 |
| `courses` | **所有查询加 isTantric 过滤**：未授权师兄的任何 Course 查询排除密法 |
| `lessons` | 返回 sourceText 字段；关联 LessonResource |
| `question-references` | 新接口：admin 管理参考答案；师兄提交答案后解锁查看 |

### 3.3 核心业务逻辑实现

#### 课程进度算法

```typescript
// 计算某班级在指定日期应学第几课
async function getCurrentLessonNumber(
  classId: string,
  targetDate: Date
): Promise<number> {
  const cls = await prisma.class.findUnique({ where: { id: classId } })
  if (!cls?.startDate) return 1

  const startMonday = getMonday(cls.startDate)
  const targetMonday = getMonday(targetDate)
  const naturalWeeks = weeksBetween(startMonday, targetMonday) + 1

  const restWeeks = await prisma.cohortRestWeek.count({
    where: {
      classId,
      restStartDate: { lt: targetMonday }
    }
  })

  return Math.max(1, naturalWeeks - restWeeks)
}
// 验证：+2周无休息=第3课 ✓ | +1休息周后+2周=第2课 ✓
```

#### 座次计算

```typescript
function calcSessionCount(durationMinutes: number): number {
  if (durationMinutes >= 30) return 1
  if (durationMinutes >= 15) return 0.5
  return 0
}
```

#### 学号自动生成

```typescript
async function generateStudentId(tx: PrismaTransaction): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = String(year)
  const last = await tx.user.findFirst({
    where: { studentId: { startsWith: prefix } },
    orderBy: { studentId: 'desc' },
    select: { studentId: true }
  })
  const seq = last?.studentId
    ? parseInt(last.studentId.slice(4)) + 1
    : 1
  return `${prefix}${String(seq).padStart(3, '0')}`
}
```

#### 修持愿状态机更新（定时任务）

- 每天凌晨 0 点跑一次（或按需触发）
- 对 `status=active` 的愿计算 currentStatus：
  - 当前进度 / 预期进度 ≥ 1.0 → `on_track`
  - 0.8-1.0 → `slightly_behind`
  - 0.6-0.8 → `falling_behind`
  - 0.4-0.6 → `at_risk`
  - < 0.4 → `will_overdue`
- 结果写入 `currentStatus` + `statusCalculatedAt`

### 3.4 权限中间件（新增）

```
vow-visibility.middleware.ts
  师兄：where userId = currentUser.id
  主麦：where source='auto' AND classId IN (主麦管理的班级)
  跨班：禁止

tantric-filter.middleware.ts
  所有 Course 查询：若 isTantric=true，验证 TantricAccessGrant，无记录过滤掉
  影响：courses 列表、搜索、lesson 关联的 course、class 关联的 course

class-admin.middleware.ts
  验证 ClassAdmin 表中的 classId + userId 关系
  zhumai / aixin 分别检查

care-followup.middleware.ts
  仅 ClassAdmin.role=aixin 可访问
  师兄端路由不挂载此接口
```

---

## 四、前端改动范围

### 4.1 师兄端新增页面（6 个）

| 页面 | 路由 | 说明 |
|---|---|---|
| 修持愿列表 | `/vows` | 查看自己全部愿（auto + custom）+ 进度 |
| 修持打卡 | `/vows/:id/log` | 打卡（含座次自动计算）+ 回向 UI |
| 修持日记 | `/journals` | 每日一篇，private / visible_to_coach |
| 集体回向 | `/dedication` | 法会 + 每周总量（只显总数）|
| 自学读物 | `/books` | 18 本读物阅读进度 |
| 约修 | `/appointments` | 查看约修 + 加入（自动建 custom 愿）|

### 4.2 师兄端修改页面（4 个）

| 页面 | 改动 |
|---|---|
| 课程详情 | 多讲者 LessonResource 展示；按班级时区显示共修时间 |
| 打卡记录 | 讲考 3 选 1 UI；共修出席/缺席 UI；审核锁定状态显示 |
| 思考题 | 提交后解锁参考答案入口 |
| 个人设置 | 发心语开关（preferShowFaxin）；学习模式展示 |

### 4.3 主麦端新增页面（5 个）

| 页面 | 说明 |
|---|---|
| 师兄状态管理 | 批量操作：暂停 / 留级 / 毕业 / 退班 + 原因填写 |
| 打卡审核中心 | 批量确认 StudyRecord + PracticeLog；可取消确认 |
| 掉队名单 | 按 currentStatus 排序（at_risk 优先）；查看详情 |
| 修持愿管理 | 查看本班所有 auto 愿；修改到期日 / 每日目标量 |
| 班级周汇总 | 生成本周汇总数据；一键复制到 WhatsApp |

### 4.4 爱心师兄端新增页面（1 个）

| 页面 | 说明 |
|---|---|
| 关怀跟进记录 | 填写联系记录；按 followUpStatus 筛选；师兄端入口不存在 |

### 4.5 Admin 端新增页面（7 个）

| 页面 | 说明 |
|---|---|
| 科系管理 | Program CRUD（code 唯一）|
| 修持模板管理 | PracticeTemplate CRUD + 班级绑定 |
| 密法授权管理 | TantricAccessGrant：直接 INSERT/DELETE，无审批 |
| 班级休息周 | CohortRestWeek 管理；实时预览算法效果 |
| 参考答案管理 | QuestionReference CRUD；发布后师兄答题后可查看 |
| 法会活动管理 | Event CRUD（法会回向依赖）|
| 自学师兄管理 | 全局查看自学进度；修改 status |

### 4.6 无新增表的纯前端功能（3 个）

| 功能 | 实现方式 |
|---|---|
| 打卡报数文本生成 | 打卡后从 PracticeLog 组装文字，复制到剪贴板；密法不参与 |
| 批量补录 | 多选课时 → 批量 POST /api/study-records；仅 listen/read_notes 类型 |
| 打卡前发心语 | 读 User.preferShowFaxin；文案配置在前端常量或 SystemSetting |

---

## 五、业务规则与权限约束

> 我们使用应用层中间件实现，不依赖数据库 RLS。

### 权限红线（7 条）

| 规则 | 实现 |
|---|---|
| 师兄只能看自己的愿 | API：`where userId = req.user.id` |
| 跨班师兄互不可见 | API：验证 classId 归属 |
| 主麦看本班 auto 愿，不看 custom 愿 | API：`where source='auto' AND classId IN (...)` |
| 主麦不能跨班操作 | 中间件：验证 ClassAdmin 表记录 |
| 密法零痕迹 | 所有 Course 查询：未授权则过滤 isTantric=true |
| 关怀记录对师兄不可见 | CareFollowup 路由：仅 aixin 角色可访问 |
| 掉队状态对师兄不可见 | Vow API 响应：师兄端不返回 currentStatus 字段 |

### 数据完整性约束（6 条）

| 规则 | 实现 |
|---|---|
| 同一时刻只有一个主班 | 事务：先 `isPrimary=false`（全班），再 `isPrimary=true`（新主班）|
| 92修法打卡必须选第几法 | Zod schema：`practiceGuideId` required when practiceType='92修法' |
| 讲考三选一互斥 | 后端：同一场次同一人只能有一条 speaking_* 记录 |
| 共修出席/缺席二选一 | 后端：同一场次同一人只能有一条 group_attend/absent 记录 |
| 每日日记一人一天一篇 | DB：`@@unique([userId, journalDate])` |
| 学号全局唯一 | DB：`studentId @unique` |

### to期日变更权限

| 愿类型 | 谁能改到期日 | 谁能改每日目标量 |
|---|---|---|
| auto 愿 | 主麦（自动写 AuditLog）| 主麦 + 师兄自己 |
| custom 愿 | 师兄自己 | 师兄自己 |

---

## 六、Migration 策略

### 原则

- **只增不删**：不删除任何现有字段/表，新字段全部可空或有默认值
- **两层分离**：先跑纯新增 migration，再跑数据迁移脚本
- **现有功能零中断**：migration 期间现有功能不受影响

### 第一层：结构 Migration（无破坏性，可随时跑）

```
migration_001_add_enums.sql         新增 7 个枚举
migration_002_extend_user.sql       User 加 5 个字段
migration_003_extend_class.sql      Class 加 4 个字段
migration_004_extend_classmember.sql ClassMember 加 7 个字段
migration_005_extend_course.sql     Course 加 2 个字段
migration_006_extend_lesson.sql     Lesson 加 1 个字段
migration_007_extend_classsession.sql ClassSession 加 2 个字段
migration_008_extend_enrollment.sql  UserCourseEnrollment 加 3 个字段
migration_009_new_tables.sql        建 28 张新表
migration_010_views.sql             建 2 个 SQL 视图
```

### 第二层：数据 Migration（一次性脚本）

```
seed_001_programs.ts         录入科系种子数据（加行/净土/入行论等）
seed_002_class_admins.ts     ClassMember.role='coach' → ClassAdmin(role=zhumai)
seed_003_self_study_books.ts 18 本《大学演讲系列》种子数据
seed_004_student_ids.ts      为现有用户批量生成 studentId（按注册时间排序）
```

### 注意事项

- `removedAt` 字段保留（旧退班数据兼容），新退班用 `cohortStatus='left'`
- 现有 `ClassMember.role='coach'` 字段保留，但主权转移到 ClassAdmin 表
- 密法 migration 不需要：`isTantric` 默认 false，现有课程默认非密法

---

## 七、分阶段实施计划

### Phase 1 · 基础架构（建议先做）

**目标**：为后续所有功能打地基，本阶段完成后现有功能不受影响

| 任务 | 类型 | 说明 |
|---|---|---|
| 跑 Migration 第一层（结构）| DB | 28 张新表 + 字段扩展 |
| 录入科系种子数据 | DB | Program 表 |
| ClassAdmin 数据迁移 | DB | coach → zhumai |
| 自学读物种子数据 | DB | 18 本 |
| 密法零痕迹中间件 | 后端 | 所有 Course 查询加过滤 |
| 班级管理：时区/科系字段 | 后端+前端 | Admin 建班时可填 |

---

### Phase 2 · 闻思打卡系统

**目标**：替代现有零散的打卡记录方式

| 任务 | 类型 |
|---|---|
| StudyRecord API（含批量补录）| 后端 |
| SpeakingSession API | 后端 |
| 审核态（isConfirmed）API | 后端 |
| 讲考/共修打卡 UI（师兄端）| 前端 |
| 打卡审核中心（主麦端）| 前端 |

---

### Phase 3 · 修持愿系统

**目标**：核心新功能，替代现有 PracticeEntry 简单计数

| 任务 | 类型 |
|---|---|
| PracticeTemplate API（admin）| 后端 |
| UserPracticeVow API + 状态机 | 后端 |
| PracticeLog API + 座次计算 | 后端 |
| 愿暂停/恢复 | 后端 |
| 愿状态机定时任务 | 后端 |
| 修持愿列表/详情（师兄端）| 前端 |
| 修持打卡 UI + 发心语 | 前端 |
| 修持愿管理（主麦端）| 前端 |

---

### Phase 4 · 双模式学习

**目标**：课程进度算法 + 自学师兄独立管理

| 任务 | 类型 |
|---|---|
| 课程进度算法 | 后端 |
| CohortRestWeek API | 后端 |
| UserSelfStudyProgram API | 后端 |
| 班级休息周管理（Admin）| 前端 |
| 自学师兄管理（Admin）| 前端 |

---

### Phase 5 · 集体功能与管理工具

| 任务 | 类型 |
|---|---|
| 集体回向视图 + API | 后端 |
| 约修 API | 后端 |
| 关怀跟进 API（爱心）| 后端 |
| 班级周汇总生成 | 后端 |
| 集体回向页面 | 前端 |
| 约修页面 | 前端 |
| 关怀跟进页面（爱心）| 前端 |
| 掉队名单（主麦）| 前端 |

---

### Phase 6 · 内容与排表

| 任务 | 类型 |
|---|---|
| 排表模板 API（6 张表）| 后端 |
| 多讲者 LessonResource API | 后端 |
| 自学读物 SelfStudyRecord API | 后端 |
| 参考答案 QuestionReference API | 后端 |
| 课程详情多讲者展示 | 前端 |
| 自学读物页面 | 前端 |
| 参考答案管理（Admin）| 前端 |

---

## 附：不改动的现有功能

以下所有现有表和功能**保持原样**，不受影响：

`AuthSession` · `PasswordResetToken` · `EmailVerificationToken` · `DeletedEmail` · `Note` · `Highlight` · `NoteReport` · `TibetanDay` · `DharmaAssembly` · `Meditation` · `MeditationSession` · `Sm2Card` · `UserFavorite` · `UserMistakeBook` · `QuestionReport` · `LlmProviderConfig` · `LlmProviderUsage` · `LlmScenarioConfig` · `LlmPromptTemplate` · `LlmCallLog` · `AuditLog` · `ErrorLog` · `SystemSetting` · `ContentSeed` · `ContentRelease` · `Experiment` · `ExperimentExposure` · `Feedback` · `PracticeCategory` · `PracticeProject` · `PracticeEntry` · `PracticeDailySummary` · `PracticeGoal` · `PracticeTask` · `PracticeMakeup` · `ClassAnnouncement` · `LessonReadingProgress` · `HomePoster` · `NotificationPreference` · `UserAchievementUnlock` · `SystemAnnouncement` · `OrphanedFile` · `PushSubscription` · `Notification` · `NotificationDispatchLog` · `NotificationRule` · `AnalyticsEvent`
