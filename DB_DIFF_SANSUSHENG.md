# 数据库差异文档 · 三殊胜新需求

> 技术栈：维持现有 Fastify + Prisma + PostgreSQL + JWT  
> 策略：现有表保留不动，新增表支持三殊胜功能，存在重叠的表在原表基础上加字段  
> 现有已确认功能：自学/班级双模式（UserCourseEnrollment）、笔记（Note）、共修（ClassSession）、藏历（TibetanDay）

---

## 目录

1. [枚举新增](#一枚举新增)
2. [现有表字段新增](#二现有表字段新增)
3. [新增表（30张）](#三新增表)
4. [新增数据库视图（2个）](#四新增视图)
5. [改动数量汇总](#五改动数量汇总)

---

## 一、枚举新增

```prisma
// 新增：班级管理员角色（主麦/爱心师兄）
// 现有 ClassMemberRole(coach/student) 保留不变
enum ClassAdminRole {
  zhumai  // 主麦：班级管理 + 讲考 + 审核
  aixin   // 爱心师兄：关怀跟进
}

// 新增：学习模式
enum LearningMode {
  class       // 跟班学习
  self_study  // 自学
  both        // 混合
}

// 新增：师兄在班级的状态（扩展现有 removedAt 机制）
enum CohortMemberStatus {
  active
  paused
  held_back   // 留级
  graduated   // 毕业
  left        // 退班
}

// 新增：修持愿状态机（7态）
enum VowStatus {
  on_track
  slightly_behind
  falling_behind
  at_risk
  will_overdue
  completed
  paused
}

// 新增：修持愿来源（2种）
enum VowSource {
  auto    // 入班按模板自动建
  custom  // 师兄自发
}

// 新增：修持计量方式
enum PracticeMeasurement {
  count     // 遍数
  duration  // 座次 + 时长
}

// 新增：学员账号状态（精简，原有status字段扩展）
enum ProfileStatus {
  active
  suspended
  inactive
  graduated
}
```

---

## 二、现有表字段新增

### `User` 表（新增 5 个字段）

```prisma
model User {
  // ... 现有字段保留 ...

  // 新增
  studentId          String?   @unique          // 学号，格式 {年份}{3位顺序}，如 2026001
  accessibilityNeeds String[]  @default([])     // 视力/听力障碍：['blind','deaf']
  dataSource         String    @default("self_register")
                                                // self_register / imported / admin_created
  learningMode       LearningMode @default(class)  // 班级/自学/混合
  preferShowFaxin    Boolean   @default(true)   // 是否显示打卡前发心语
}
```

### `Class` 表（新增 5 个字段）

```prisma
model Class {
  // ... 现有字段保留（joinCode / name / courseId 等）...

  // 新增
  programId   String?   // 关联科系（新增 Program 表后使用）
  startDate   DateTime? // 班级起始日期（算本周第N课的基准）
  city        String?   // 所在城市（纽约/北京/香港等）
  timezone    String?   // IANA 时区（如 America/New_York）
  program     Program?  @relation(fields: [programId], references: [id])
}
```

### `ClassMember` 表（新增 7 个字段）

```prisma
model ClassMember {
  // ... 现有字段保留（classId / userId / role / joinedAt / removedAt）...

  // 新增
  cohortStatus       CohortMemberStatus @default(active)   // 5态状态机
  isPrimary          Boolean  @default(false)               // 是否主班（每用户唯一）
  heldBackCount      Int      @default(0)                   // 留级次数
  statusChangedAt    DateTime?
  statusChangedBy    String?                                // 变更人 userId
  statusChangeReason String?
  graduatedAt        DateTime?

  @@unique([userId], name: "uniq_primary_class", map: "uniq_primary_class_member")
  // 注：该唯一索引仅在 isPrimary = true 时生效，需用 partial index 或应用层保证
}
```

### `Course` 表（新增 3 个字段）

```prisma
model Course {
  // ... 现有字段保留 ...

  // 新增
  isTantric  Boolean @default(false)  // 密法课程（未授权师兄 API 返回 404）
  isRequired Boolean @default(true)   // 限制性学修（影响毕业评估）
  programId  String?                  // 关联科系
  program    Program? @relation(fields: [programId], references: [id])
}
```

### `Lesson` 表（新增 1 个字段）

```prisma
model Lesson {
  // ... 现有字段保留（referenceText / teachingSummary 等）...

  // 新增
  sourceText String? // 法本原文正文（造论者所著原文）
              // 注：与现有 referenceText 并存，referenceText 保留不废弃
}
```

### `ClassSession` 表（新增 2 个字段，扩展为共修场次）

```prisma
model ClassSession {
  // ... 现有字段保留（classId / title / startAt / durationMin / liveLink 等）...

  // 新增
  lessonId    String?  // 关联具体课时（实现"共修哪节课"）
  sessionEndAt DateTime? // 结束时刻（用于审核态时间窗口）
  lesson       Lesson? @relation(fields: [lessonId], references: [id])
}
```

### `UserCourseEnrollment` 表（新增 3 个字段，扩展自学模式）

```prisma
model UserCourseEnrollment {
  // ... 现有字段保留（source / enrolledViaClassId 等）...

  // 新增（自学模式时间推进字段）
  selfStudyStartDate DateTime? // 自学起修日
  selfStudyPace      String?   // 节奏（standard/fast/custom）
  selfStudyStatus    String    @default("active")
                               // active/paused/completed/abandoned
}
```

---

## 三、新增表

### 组织层级（2 张）

```prisma
// 学会/院系层（最高组织层）
model Academy {
  id           String    @id @default(cuid())
  name         String
  description  String?
  displayOrder Int       @default(0)
  createdAt    DateTime  @default(now())

  programs     Program[]
}

// 科系（加行/净土/入行论/学经/基础等）
model Program {
  id             String    @id @default(cuid())
  academyId      String?
  name           String
  code           String    @unique  // 如 "jiaxing" / "jingtu"
  description    String?
  totalSemesters Int       @default(8)
  weeksPerSem    Int       @default(26)
  displayOrder   Int       @default(0)
  createdAt      DateTime  @default(now())

  academy        Academy?  @relation(fields: [academyId], references: [id])
  classes        Class[]
  courses        Course[]
}
```

---

### 双模式学习（3 张）

```prisma
// 班级休息周（admin 管，算法自动跳过）
model CohortRestWeek {
  id            String   @id @default(cuid())
  classId       String   // 关联 Class
  restStartDate DateTime // 休息周的周一日期
  reason        String?
  createdBy     String   // admin userId
  createdAt     DateTime @default(now())

  class         Class    @relation(fields: [classId], references: [id])
}

// 自学师兄的科系学习记录
model UserSelfStudyProgram {
  id          String   @id @default(cuid())
  userId      String
  programId   String
  startDate   DateTime // 个人起修日
  status      String   @default("active") // active/paused/completed/abandoned
  pace        String   @default("standard")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])
  program     Program  @relation(fields: [programId], references: [id])
  restWeeks   UserSelfStudyRestWeek[]

  @@unique([userId, programId])
}

// 自学师兄的个人休息周
model UserSelfStudyRestWeek {
  id            String               @id @default(cuid())
  selfStudyId   String
  restStartDate DateTime             // 休息周的周一日期
  reason        String?
  createdAt     DateTime             @default(now())

  selfStudy     UserSelfStudyProgram @relation(fields: [selfStudyId], references: [id])
}
```

---

### 班级管理员（1 张）

```prisma
// 班级管理员（主麦/爱心师兄，从 ClassMember 中独立）
model ClassAdmin {
  id         String         @id @default(cuid())
  classId    String
  userId     String
  role       ClassAdminRole // zhumai / aixin
  assignedAt DateTime       @default(now())
  assignedBy String?        // admin userId

  class      Class          @relation(fields: [classId], references: [id])
  user       User           @relation(fields: [userId], references: [id])

  @@unique([classId, userId, role])
}
```

---

### 课程内容扩展（2 张）

```prisma
// 多讲者讲解资源（替代 Lesson 上的固定 teacher 槽位）
// 现有 Lesson.referenceText / teachingSummary 保留不动
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

// 观修引导内容（92修法等，对应 practices 中 measurement=duration 的修法）
model PracticeGuide {
  id            String    @id @default(cuid())
  practiceId    String    // 关联修持类型（如"92修法"）
  contentNumber Int?      // 第几法（92修法: 1-92；其他可为 null）
  title         String
  videoUrl      String?
  guideText     String?   // 引导文字
  sortOrder     Int       @default(0)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())

  // practiceId 关联现有 PracticeProject 或新建 Practice 类型表
  @@unique([practiceId, contentNumber])
}
```

---

### 修持愿系统（4 张）

```prisma
// 修持模板库（admin 管理，班级绑定后自动建愿）
model PracticeTemplate {
  id                String    @id @default(cuid())
  name              String
  description       String?
  practiceProjectId String?   // 关联现有 PracticeProject

  targetCount       Int?      // 总目标数（如 10万）
  targetPeriod      String    // daily / weekly / lifetime
  defaultDailyTarget  Int?
  defaultWeeklyTarget Int?
  paceLevel         String?   // fast / standard / custom
  startsOffsetDays  Int?      // 距班级 startDate 多少天起修
  durationDays      Int?      // 起修后多少天完成

  appliesToPrograms String[]  // 适用科系 ID 列表
  isActive          Boolean   @default(true)
  displayOrder      Int       @default(0)
  createdAt         DateTime  @default(now())
  createdBy         String    // admin userId

  cohortBindings    CohortRecommendedTemplate[]
  vows              UserPracticeVow[]
}

// 班级推荐/自动模板绑定
model CohortRecommendedTemplate {
  id           String           @id @default(cuid())
  classId      String
  templateId   String
  binding      String           @default("auto")  // auto（v1.0）/ recommended（v1.5+）
  displayOrder Int              @default(0)

  class        Class            @relation(fields: [classId], references: [id])
  template     PracticeTemplate @relation(fields: [templateId], references: [id])

  @@unique([classId, templateId])
}

// 修持愿（7状态机核心表）
model UserPracticeVow {
  id          String    @id @default(cuid())
  userId      String
  source      VowSource // auto / custom

  // 关联
  templateId      String?   // auto 愿关联模板
  classId         String?   // auto 愿关联班级（custom 愿可为 null）
  eventId         String?   // 法会回向标签（可选）
  appointmentId   String?   // 约修（可选）

  // 修持内容
  practiceProjectId String  // 修什么（关联现有 PracticeProject）
  customName        String? // custom 愿自定义名称

  // 目标
  targetCount       Int?
  targetPeriod      String  // daily / weekly / lifetime
  dailyTarget       Int?
  weeklyTarget      Int?
  minSessionMinutes Int     @default(30)

  // 节奏历史
  paceHistory       Json?   // [{set_at, daily_target, reason}]

  // 时间
  startDate         DateTime
  isEarlyStart      Boolean  @default(false)
  originalEndDate   DateTime?
  currentEndDate    DateTime? // 主麦可改（自动写 audit_logs）

  // 进度
  currentCount        Int     @default(0)
  currentSessionCount Decimal @default(0)

  // 状态（仅管理者可见，师兄端不显示）
  currentStatus       VowStatus @default(on_track)
  statusCalculatedAt  DateTime?
  statusDetails       Json?

  // 元信息
  isRequiredForPromotion Boolean @default(false)
  status                 String  @default("active") // active/paused/completed/abandoned
  pausedAt               DateTime?
  pausedBy               String?  // 谁暂停的（自己/主麦）
  pausedReason           String?
  resumedAt              DateTime?
  completedAt            DateTime?
  notes                  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User             @relation(fields: [userId], references: [id])
  template  PracticeTemplate? @relation(fields: [templateId], references: [id])
  logs      PracticeLog[]
}

// 修持打卡记录（替代现有 PracticeEntry，现有 PracticeEntry 保留不动）
model PracticeLog {
  id          String   @id @default(cuid())
  userId      String
  vowId       String   // 必须关联一条愿

  count             Int?
  durationMinutes   Int?
  sessionCount      Decimal? // 自动算：≥30min=1座，≥15min=0.5座
  sessionAttempt    Int      @default(1) // 同日第几次

  practiceGuideId   String?  // 92修法：选的第几法
  reflection        String?  // 每座可选反思
  reflectionAt      DateTime?

  logDate   DateTime
  logTime   DateTime?
  notes     String?

  // 审核态
  isConfirmed   Boolean   @default(false)
  confirmedAt   DateTime?
  confirmedBy   String?

  createdAt DateTime @default(now())

  user User            @relation(fields: [userId], references: [id])
  vow  UserPracticeVow @relation(fields: [vowId], references: [id])
}
```

---

### 闻思打卡系统（3 张）

```prisma
// 闻思类打卡（听课/讲考/共修）
// 注：ClassSession 扩展了 lessonId 字段，作为 group_sessions 使用
model StudyRecord {
  id        String   @id @default(cuid())
  userId    String
  classId   String?  // 关联班级（自学师兄可为 null）
  lessonId  String   // 关联课时（原则 11：所有打卡必须绑 lesson_id）

  studyType String   // listen / read_notes / speaking_present / speaking_question /
                     // speaking_observe / group_attend / group_absent /
                     // group_review / group_summary

  lessonResourceId    String?  // 听/读：具体哪位讲者的版本
  classSessionId      String?  // 共修：关联 ClassSession（扩展后的）
  speakingSessionId   String?  // 讲考：关联 SpeakingSession

  createdBy String?  // 谁创建的（本人 or 主麦代打）
  studyDate DateTime
  notes     String?

  // 审核态
  isConfirmed Boolean   @default(false)
  confirmedAt DateTime?
  confirmedBy String?

  createdAt DateTime @default(now())

  user   User    @relation(fields: [userId], references: [id])
  lesson Lesson  @relation(fields: [lessonId], references: [id])
}

// 讲考场次
model SpeakingSession {
  id           String   @id @default(cuid())
  classId      String
  lessonId     String
  sessionEndAt DateTime
  notes        String?
  createdBy    String
  createdAt    DateTime @default(now())

  class  Class  @relation(fields: [classId], references: [id])
  lesson Lesson @relation(fields: [lessonId], references: [id])

  @@unique([classId, lessonId])
}

// 每日修持日记（与现有 Note 并存，用途不同）
// 现有 Note：绑定课时的学习笔记
// PracticeJournal：每天一篇的修持反思日记
model PracticeJournal {
  id          String   @id @default(cuid())
  userId      String
  classId     String?  // 可为 null（个人愿日记）
  journalDate DateTime // 对应日期
  content     String
  visibility  String   @default("private") // private / visible_to_coach

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user  User  @relation(fields: [userId], references: [id])

  @@unique([userId, journalDate])
}
```

---

### 思考题改进（1 张）

```prisma
// 参考答案独立表（从 Question.payload.referenceAnswer 迁出）
// 现有 Question.payload 保留，新增此表作为正式来源
model QuestionReference {
  id            String   @id @default(cuid())
  questionId    String   @unique  // 全局唯一，每题只有 1 份参考答案
  referenceText String
  publishedAt   DateTime?
  publishedBy   String?  // admin userId
  updatedAt     DateTime @updatedAt

  question Question @relation(fields: [questionId], references: [id])
}
```

---

### 排表模板系统（6 张）

```prisma
// 学期模板
model ProgramSemester {
  id             String   @id @default(cuid())
  programId      String
  semesterNumber Int
  semesterName   String?
  startsWeek     Int      // 第几全局周开始
  endsWeek       Int      // 第几全局周结束

  program Program  @relation(fields: [programId], references: [id])
  weeks   ProgramWeek[]

  @@unique([programId, semesterNumber])
}

// 周模板（课程内容序号 + 元数据，不存具体日历日期）
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

// 周 ↔ 课程（主课程）
model ProgramWeekCourse {
  id           String      @id @default(cuid())
  weekId       String
  courseId     String
  lessonId     String?     // 本周上哪节课
  displayOrder Int         @default(0)

  week   ProgramWeek @relation(fields: [weekId], references: [id])
  course Course      @relation(fields: [courseId], references: [id])
}

// 周 ↔ 修法建议（92修法/上师瑜伽等）
model ProgramWeekPractice {
  id              String      @id @default(cuid())
  weekId          String
  practiceId      String      // 关联 PracticeProject
  practiceGuideId String?     // 具体哪个引导（第几法）
  displayOrder    Int         @default(0)
  notes           String?

  week ProgramWeek @relation(fields: [weekId], references: [id])

  @@unique([weekId, practiceId, practiceGuideId])
}

// 周 ↔ 自学读物
model ProgramWeekSelfStudy {
  id           String      @id @default(cuid())
  weekId       String
  bookId       String
  displayOrder Int         @default(0)

  week ProgramWeek   @relation(fields: [weekId], references: [id])
  book SelfStudyBook @relation(fields: [bookId], references: [id])

  @@unique([weekId, bookId])
}

// 各系打卡要求（数据驱动，不硬编码）
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

---

### 自学读物（2 张）

```prisma
// 18本《大学演讲系列》
model SelfStudyBook {
  id           String   @id @default(cuid())
  bookNumber   Int      // 1-18
  title        String
  author       String   @default("索达吉堪布")
  description  String?
  displayOrder Int      @default(0)

  records  SelfStudyRecord[]
  weekPlan ProgramWeekSelfStudy[]

  @@unique([bookNumber])
}

// 师兄阅读记录
model SelfStudyRecord {
  id          String   @id @default(cuid())
  userId      String
  classId     String?
  bookId      String
  status      String   @default("not_started") // not_started / reading / completed
  startedAt   DateTime?
  completedAt DateTime?
  notes       String?  // 读后感

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User          @relation(fields: [userId], references: [id])
  book SelfStudyBook @relation(fields: [bookId], references: [id])

  @@unique([userId, classId, bookId])
}
```

---

### 集体功能（3 张）

```prisma
// 法会活动（集体回向依赖此表；与现有 DharmaAssembly 并存）
// DharmaAssembly 保留用于活动展示，events 用于修持回向
model Event {
  id          String   @id @default(cuid())
  title       String
  eventType   String   // puja / dharma_assembly / weekly
  startDate   DateTime
  endDate     DateTime
  description String?
  isActive    Boolean  @default(true)
  createdBy   String
  createdAt   DateTime @default(now())

  vows UserPracticeVow[] // 挂 event_id 的愿（法会回向）
}

// 约修（师兄发起，他人加入；加入=建一条 custom 愿）
model PracticeAppointment {
  id            String   @id @default(cuid())
  initiatorId   String   // 发起人
  classId       String?  // 可以跨班
  title         String   // 约修名称
  targetCount   Int?     // 目标量
  practiceId    String   // 修什么
  scheduledDate DateTime?
  notes         String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())

  initiator User @relation(fields: [initiatorId], references: [id])
  // 参与者通过 UserPracticeVow.appointmentId 关联
}

// 关怀跟进记录（爱心师兄填写，师兄完全不可见）
model CareFollowup {
  id             String   @id @default(cuid())
  studentId      String   // 被关怀的师兄
  classId        String
  careWorkerId   String   // 爱心师兄 userId
  contactedAt    DateTime
  summary        String   // 跟进内容
  followUpStatus String   @default("pending") // pending / resolved / escalated
  createdAt      DateTime @default(now())

  student    User  @relation("CareStudent", fields: [studentId], references: [id])
  careWorker User  @relation("CareWorker", fields: [careWorkerId], references: [id])
  class      Class @relation(fields: [classId], references: [id])
}
```

---

### 权限控制（1 张）

```prisma
// 密法课程白名单（admin 直接 INSERT，无申请审批流程）
model TantricAccessGrant {
  id         String   @id @default(cuid())
  userId     String
  courseId   String
  grantedAt  DateTime @default(now())
  grantedBy  String   // admin userId

  user   User   @relation(fields: [userId], references: [id])
  course Course @relation(fields: [courseId], references: [id])

  @@unique([userId, courseId])
}
```

---

### 班级汇总缓存（1 张）

```prisma
// 班级周修持汇总（主麦生成后复制到 WhatsApp）
model CohortWeeklySummary {
  id            String   @id @default(cuid())
  classId       String
  weekStartDate DateTime
  weekEndDate   DateTime
  summaryData   Json     // 结构化汇总数据
  generatedAt   DateTime @default(now())
  sharedAt      DateTime?
  sharedBy      String?  // 主麦 userId

  class Class @relation(fields: [classId], references: [id])

  @@unique([classId, weekStartDate])
}
```

---

## 四、新增视图

以下 2 个视图通过 Prisma `$queryRaw` 或直接 SQL 实现（Prisma 本身不支持定义视图，在 migration SQL 中创建）：

```sql
-- 法会回向聚合视图（只看总数，不显个人）
CREATE VIEW v_event_dedication_totals AS
SELECT
  v.event_id,
  v.practice_project_id,
  SUM(pl.count)           AS total_count,
  SUM(pl.duration_minutes) AS total_minutes,
  COUNT(DISTINCT v.user_id) AS participant_count
FROM user_practice_vows v
JOIN practice_logs pl ON pl.vow_id = v.id
WHERE v.event_id IS NOT NULL
GROUP BY v.event_id, v.practice_project_id;

-- 每周回向聚合视图（班级层 + 全会层）
CREATE VIEW v_weekly_dedication_totals AS
SELECT
  pl.log_date,
  v.class_id,
  v.practice_project_id,
  SUM(pl.count)            AS total_count,
  SUM(pl.duration_minutes) AS total_minutes,
  COUNT(DISTINCT v.user_id) AS participant_count
FROM practice_logs pl
JOIN user_practice_vows v ON pl.vow_id = v.id
GROUP BY pl.log_date, v.class_id, v.practice_project_id;
```

---

## 五、改动数量汇总

| 类型 | 数量 | 说明 |
|---|---|---|
| 新增枚举 | 7 个 | ClassAdminRole / LearningMode / CohortMemberStatus / VowStatus / VowSource / PracticeMeasurement / ProfileStatus |
| 现有表新增字段 | 7 张表 | User / Class / ClassMember / Course / Lesson / ClassSession / UserCourseEnrollment |
| 新增表 | 30 张 | 见第三节 |
| 新增 SQL 视图 | 2 个 | 集体回向聚合 |
| **现有表不动** | 50 张 | 所有现有功能保留 |

### 新增表分类

| 分类 | 表数 |
|---|---|
| 组织层级 | 2（Academy / Program） |
| 双模式学习 | 3（CohortRestWeek / UserSelfStudyProgram / UserSelfStudyRestWeek） |
| 班级管理员 | 1（ClassAdmin） |
| 课程内容扩展 | 2（LessonResource / PracticeGuide） |
| 修持愿系统 | 4（PracticeTemplate / CohortRecommendedTemplate / UserPracticeVow / PracticeLog） |
| 闻思打卡 | 3（StudyRecord / SpeakingSession / PracticeJournal） |
| 思考题 | 1（QuestionReference） |
| 排表模板 | 6（ProgramSemester / ProgramWeek / ProgramWeekCourse / ProgramWeekPractice / ProgramWeekSelfStudy / ProgramStudyType） |
| 自学读物 | 2（SelfStudyBook / SelfStudyRecord） |
| 集体功能 | 3（Event / PracticeAppointment / CareFollowup） |
| 权限控制 | 1（TantricAccessGrant） |
| 汇总缓存 | 1（CohortWeeklySummary） |
| **合计** | **30 张** |

---

## 附：不需要改动的现有表

以下表维持现状，功能保留，新需求不影响：

`AuthSession` · `PasswordResetToken` · `EmailVerificationToken` · `DeletedEmail` · `Note` · `Highlight` · `NoteReport` · `TibetanDay` · `DharmaAssembly` · `Meditation` · `MeditationSession` · `Sm2Card` · `UserFavorite` · `UserMistakeBook` · `QuestionReport` · `LlmProviderConfig` · `LlmProviderUsage` · `LlmScenarioConfig` · `LlmPromptTemplate` · `LlmCallLog` · `AuditLog` · `ErrorLog` · `SystemSetting` · `ContentSeed` · `ContentRelease` · `Experiment` · `ExperimentExposure` · `Feedback` · `PracticeCategory` · `PracticeProject` · `PracticeEntry` · `PracticeDailySummary` · `PracticeGoal` · `PracticeTask` · `PracticeMakeup` · `ClassAnnouncement` · `LessonReadingProgress` · `HomePoster` · `NotificationPreference` · `UserAchievementUnlock` · `SystemAnnouncement` · `OrphanedFile` · `PushSubscription` · `Notification` · `NotificationDispatchLog` · `NotificationRule` · `AnalyticsEvent`
