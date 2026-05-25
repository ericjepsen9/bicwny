# 三殊胜整合设计方案（最终版）

> 基于：DESIGN_DECISIONS.md 全部确认决策（8 组 + A1/A2/A3 + B1/B2/B3 + C1/C2/C3 + 5 处一致性冲突决议）
> 技术栈：维持现有 Fastify + Prisma + PostgreSQL + JWT，扩展不重建
> 策略：现有表只增字段不删，冲突表新建独立表，历史数据原地保留
> 生成日期：2026-05-25（全部决策确认后最终版）

**功能标签说明**

| 标签 | 含义 |
|---|---|
| `⏸ 暂缓（Phase N）` | 计划做，但不在当前阶段；Phase N 实施 |
| `❌ 不做` | 永久决策，不会实现；见 §八 |
| `⚠️ 待决策` | 需要用户拍板才能推进 |

---

## 目录

1. [改动总览](#一改动总览)
2. [数据库改动](#二数据库改动)
   - 2.1 新增枚举
   - 2.2 现有表字段扩展
   - 2.3 新增表（44 张，含完整 Prisma schema）
   - 2.4 新增 SQL 视图
3. [后端改动范围](#三后端改动范围)
4. [前端改动范围](#四前端改动范围)
5. [业务规则与权限约束](#五业务规则与权限约束)
6. [Migration 策略](#六migration-策略)
7. [分阶段实施计划](#七分阶段实施计划)
8. [明确不做清单](#八明确不做清单)
9. [现有功能保留清单](#九现有功能保留清单)

---

## 一、改动总览

| 类型 | 数量 | 说明 |
|---|---|---|
| 新增 Prisma 枚举 | 7 个 | 见 2.1 |
| 现有表字段扩展 | 8 张表 | User / Class / ClassMember / Course / Lesson / ClassSession / Meditation / PracticeProject |
| 新增表 | 44 张 | 见 2.3（PracticeGuide 删除 + LessonCompletion + EventCount + ClassPost 系列 4 张 + Discussion 系列 4 张 + AI 助手 5 张 + LessonMediaChapter + LessonTextBlock 新增 = 净 44）|
| 新增 SQL 视图 | 2 个 | v_event_dedication_totals / v_weekly_dedication_totals |
| 现有表不动 | 50+ 张 | 全部保留，零回归 |
| 新增后端模块 | 16 个 | 见 3.1 |
| 修改后端模块 | 6 个 | 见 3.2 |
| 新增前端页面（学员端）| 8 个 | 含法会列表 + 法会详情 |
| 新增前端页面（管理端 /coach/*）| 5 个 | |
| 新增前端页面（Admin 端）| 7 个 | |

**核心策略说明：**
- 修持系统（UserPracticeVow / PracticeLog）与现有 PracticeTask / PracticeGoal / PracticeEntry 并存，新功能全走新表，旧功能零回归
- PracticeEntry 停止新写入，历史数据原地保留供旧统计使用
- 密法（isTantric）对未授权学员零痕迹，对管理端不过滤

---

## 二、数据库改动

### 2.1 新增枚举

```prisma
// 学习模式
enum LearningMode {
  class       // 跟班学习
  self_study  // 自学
  both        // 混合（同时跟班 + 自学不同科系）
}

// 班级成员状态（替代 removedAt 二态）
enum CohortMemberStatus {
  active      // 正常学习
  paused      // 暂停（自助，可恢复）
  held_back   // 留级（移至下一届）
  graduated   // 毕业
  left        // 退班
}

// 修持愿 7 态状态（打卡后实时重算；掉队检测系统独立使用同名状态，语义不同）
enum VowStatus {
  on_track        // 正常
  slightly_behind // 略微落后
  falling_behind  // 明显落后
  at_risk         // 高风险
  will_overdue    // 即将超期（优先级最高）
  completed       // 已完成
  paused          // 已暂停
}

// 修持愿来源
enum VowSource {
  auto    // 入班时按模板自动建
  custom  // 师兄自发建
}

// 修持愿场景（多态单表）
enum VowContext {
  class        // 班级修学愿
  event        // 法会愿
  appointment  // 约修愿
  personal     // 纯个人愿
}

// 修持计量方式（模板层声明）
enum PracticeMeasurement {
  count     // 遍数（念诵类）
  duration  // 座次 + 时长（禅修类）
}

// 账号状态
enum ProfileStatus {
  active
  suspended
  inactive
  graduated
}
```

---

### 2.2 现有表字段扩展

#### `User` 表（+6 个字段）

```prisma
model User {
  // ... 现有所有字段保留 ...

  // 新增
  studentId          String?  @unique
  // 格式：{年份4位}{序号3位}，如 2026001
  // 新注册：后端事务自动生成；老学员植入：传入原值，系统不覆盖
  // ⚠️ 上线前必须完成历史数据导入（开放注册前）

  accessibilityNeeds String[] @default([])
  // 取值约束：['blind', 'deaf']，应用层校验

  dataSource         String   @default("self_register")
  // 取值：self_register / imported / admin_created

  learningMode       LearningMode @default(class)
  // class / self_study / both

  preferShowFaxin    Boolean  @default(true)
  // 打卡前是否显示发心语（三殊胜精神框架）

  timezone           String?
  // IANA 格式（如 America/New_York），用户设置页选择，自学进度和个人愿打卡时区基准
}
```

#### `Class` 表（+4 个字段）

```prisma
model Class {
  // ... 现有字段保留（joinCode / name / courseId 等）...
  // courseId 保留，语义更新为"当前主修法本"，辅导员可切换

  // 新增
  programId  String?
  // 所属科系（关联 Program）

  startDate  DateTime?
  // 班级起始日期，算法基准：当前课时号 = 自然周数 - 休息周数

  city       String?
  // 班级所在城市（北京 / 纽约 / 香港等）

  timezone   String?
  // IANA 时区（如 America/New_York）；共修/讲考场次时间按此时区展示

  program    Program? @relation(fields: [programId], references: [id])
}
```

#### `ClassMember` 表（+7 个字段）

```prisma
model ClassMember {
  // ... 现有字段保留（classId / userId / role / joinedAt / removedAt）...
  // removedAt 保留，旧退班数据兼容；新退班用 cohortStatus='left'

  // 新增
  cohortStatus       CohortMemberStatus @default(active)
  isPrimary          Boolean            @default(false)
  // 同一时刻一个师兄只有一个主班，应用层事务保证（不用 DB 唯一索引）
  heldBackCount      Int                @default(0)
  statusChangedAt    DateTime?
  statusChangedBy    String?            // 操作人 userId
  statusChangeReason String?
  graduatedAt        DateTime?
}
```

#### `Course` 表（+3 个字段）

```prisma
model Course {
  // ... 现有字段保留 ...

  // 新增
  author            String?
  // 造论者（如"索达吉堪布"/"寂天菩萨"），学员端法本详情页展示用

  isTantric         Boolean  @default(false)
  // 密法标识：未授权师兄所有查询均不返回（零痕迹，非"看到但打不开"）
  // 管理端（主麦/辅导员/admin）不过滤，始终可见

  programSemesterId String?
  // 归属科目（ProgramSemester）；通过科目派生 programId，不再直接存 programId

  programSemester ProgramSemester? @relation(fields: [programSemesterId], references: [id])
}
```

#### `Lesson` 表（+1 个字段）

```prisma
model Lesson {
  // ... 现有字段保留（referenceText / teachingSummary 等）...

  // 新增
  sourceText String?
  // 法本原文正文（造论者所著），与现有 referenceText 并存，referenceText 不废弃
}
```

#### `ClassSession` 表（+2 个字段）

```prisma
model ClassSession {
  // ... 现有字段保留（classId / title / startAt / durationMin / liveLink 等）...

  // 新增（扩展 ClassSession 承载共修场次）
  lessonId     String?
  // 本次共修对应哪节课（不新建 group_sessions 表）
  sessionEndAt DateTime?
  // 结束时刻（审核态时间窗口使用）

  lesson       Lesson? @relation(fields: [lessonId], references: [id])
}
```

#### `Meditation` 表（+3 个字段）

```prisma
model Meditation {
  // ... 现有字段全部保留（视频/转图PPT/章节/字幕/发布管理等）...

  // 新增（92修法系列归组；替代已删除的 PracticeGuide 表）
  seriesKey    String?  // 修法系列标识（如 "92xiufa"）
  seriesNumber Int?     // 第几法（92修法为 1-92；其他修法为 null）
  isTantric    Boolean  @default(false)
  // 密法标识：同 Course.isTantric，未授权学员查询全过滤

  @@unique([seriesKey, seriesNumber])
}
```

#### `PracticeProject` 表（+1 个字段）

```prisma
model PracticeProject {
  // ... 现有字段保留（含 scope，新系统不依赖 scope，历史数据兼容）...

  // 新增
  isTantric Boolean @default(false)
  // 密法标识：此项目产生的 PracticeLog 在管理端始终可见
}
```

---

### 2.3 新增表（44 张）

#### 组织层级（1 张）

```prisma
// 科系（加行 / 净土 / 入行论 / 基础等）
// 三层结构：科系（Program）→ 科目（ProgramSemester）→ 法本（Course）
// Academy 层暂不建表，预留 academyId 字段
model Program {
  id          String   @id @default(cuid())
  name        String   // "加行"
  code        String   @unique // "jiaxing"
  description String?
  academyId   String?  // 预留，Academy 表将来建好后再关联

  createdAt   DateTime @default(now())

  classes     Class[]
  semesters   ProgramSemester[]
  weeks       ProgramWeek[]
  studyTypes  ProgramStudyType[]
  selfStudy   UserSelfStudyProgram[]
}
```

#### 班级管理员（1 张）

```prisma
// 细粒度 RBAC flags（替代旧的 role=zhumai|aixin 枚举方案）
// Admin 后台逐模块分配权限，灵活组合
// 同一人同一班只有一条记录（@@unique([classId, userId])），跨班各自独立
model ClassAdmin {
  id      String @id @default(cuid())
  classId String
  userId  String

  // 模块权限（admin 后台逐项勾选）
  canManageMembers  Boolean @default(false)  // 成员管理（暂停/留级/毕业/退班）
  canManageExams    Boolean @default(false)  // 讲考场次管理
  canAuditPractice  Boolean @default(false)  // 审核打卡（StudyRecord + PracticeLog）
  canViewStudents   Boolean @default(false)  // 查看学员修行数据（愿/打卡/日记）
  canCareFollowup   Boolean @default(false)  // 关怀跟进记录（CareFollowup）
  canEditGoals      Boolean @default(false)  // 编辑愿的每日目标量
  canManageCourse   Boolean @default(false)  // 课程进度/法本切换/升科目

  // 操作级权限（作用于已开放的所有模块）
  canEdit   Boolean @default(true)
  canDelete Boolean @default(false)

  assignedAt DateTime @default(now())
  assignedBy String?  // 操作人 admin userId
  createdAt  DateTime @default(now())

  class Class @relation(fields: [classId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@unique([classId, userId])
}
```

**预设含义（参考，无需写进表）：**
| 原概念 | 对应 flags |
|---|---|
| 主麦（全权班管）| 全部 true |
| 爱心（关怀跟进）| canViewStudents + canCareFollowup = true，其余 false |
| 自定义子角色 | admin 后台任意组合 |

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

// 自学师兄的科系学习记录（科系级）
// 自学进度算法 = 班级进度算法，但用个人 startDate + 个人休息周
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

#### 课程内容扩展（3 张）✅ 已实现（migration_001_lesson_resources · commit ca0e975）

```prisma
// 课时媒体资源（讲法音视频 + YouTube 链接）
// ✅ 已实现：DB + 后端 API（GET/POST/DELETE /api/admin/lessons/:id/resources）+ Admin UI
// 支持 type: "youtube" | "audio" | "video"
// YouTube：后端提取 videoId 存储，前端用 <iframe> 渲染
// audio/video：存 OSS URL（上传逻辑 ⏸ 暂缓 Phase 6）
model LessonResource {
  id        String   @id @default(cuid())
  lessonId  String
  type      String   // "youtube" | "audio" | "video"
  url       String   // YouTube videoId 或 OSS URL
  label     String?  // 可选显示名称（如"索达吉堪布讲授"）
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lesson   Lesson               @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  chapters LessonMediaChapter[]

  @@index([lessonId, sortOrder])
}

// 媒体章节标记（C/D 模式：音频章节导航 + 文字同步）
// ✅ 已实现：DB only（migration_001_lesson_resources）
// API + UI ⏸ 暂缓（Phase 6）
model LessonMediaChapter {
  id               String         @id @default(cuid())
  lessonResourceId String
  title            String         // 章节名（如"第一节：皈依发心"）
  startSec         Float          // 章节开始时间（秒）
  sortOrder        Int
  createdAt        DateTime       @default(now())

  lessonResource LessonResource @relation(fields: [lessonResourceId], references: [id], onDelete: Cascade)

  @@index([lessonResourceId, sortOrder])
}

// 段落级文字块，与音频时间戳对齐（B/C 模式用）
// ✅ 已实现：DB only（migration_001_lesson_resources）
// API + UI ⏸ 暂缓（Phase 6）
model LessonTextBlock {
  id            String   @id @default(cuid())
  lessonId      String
  blockIndex    Int      // 段落顺序（0-based）
  content       String   // 段落原文
  audioStartSec Float?   // 对应音频开始时间（秒）
  audioEndSec   Float?   // 对应音频结束时间（秒）
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@index([lessonId, blockIndex])
}
```

注：`PracticeGuide` 表已删除，功能并入 `Meditation.seriesKey/seriesNumber`（见冲突 2 决议）。

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
  isActive                Boolean  @default(true)
  displayOrder            Int      @default(0)
  isRequiredForPromotion  Boolean  @default(false)
  // 此模板对应的愿为升科目必修条件；UserPracticeVow 从关联 template 读取，不冗余存储
  createdBy               String   // admin userId
  createdAt               DateTime @default(now())

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
// 两正交维度：source（怎么建的）× context（为什么发、挂在哪）
model UserPracticeVow {
  id     String    @id @default(cuid())
  userId String
  source VowSource // auto / custom

  // 场景（多态单表）
  context VowContext // class / event / appointment / personal

  // 可空外键（按 context 填对应项，应用层校验）
  templateId     String?  // auto 愿关联模板
  classId        String?  // 班级愿（auto/custom 均可）
  eventId        String?  // 法会愿
  appointmentId  String?  // 约修愿

  // 可见性（仅适用于 context=personal / context=appointment；共修愿和法会愿不适用此开关）
  isPublic Boolean @default(false)
  // false（默认）：仅自己和管理员可见；true：班级内其他成员可见愿名和进度条

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

  // 时间（UTC 时间戳）
  startDate         DateTime
  currentEndDate    DateTime?
  // auto 愿：仅 canEditGoals=true 的管理员可改（自动写 AuditLog）
  // custom 愿：师兄自己可改

  // 进度（乐观计算：未确认打卡立即计入）
  currentCount        Int     @default(0)
  currentSessionCount Decimal @default(0)

  // 状态（7 态，打卡后实时重算；优先级：will_overdue > at_risk > falling_behind > slightly_behind > on_track）
  // 仅管理者可见，师兄端 API 不返回此字段
  currentStatus      VowStatus @default(on_track)
  statusCalculatedAt DateTime?
  statusNote         String?
  // 管理员可选填状态备注（如"最近出差，落后属正常"）；师兄端不可见

  // 生命周期
  status       String    @default("active") // active / paused / completed / abandoned
  pausedAt     DateTime?
  pausedBy     String?   // 暂停人 userId
  pausedReason String?
  resumedAt    DateTime?
  completedAt  DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user        User              @relation(fields: [userId], references: [id])
  template    PracticeTemplate? @relation(fields: [templateId], references: [id])
  appointment PracticeAppointment? @relation(fields: [appointmentId], references: [id])
  logs        PracticeLog[]
  eventCounts EventCount[]      // context=event 愿的计数来源（非 PracticeLog）
}

// 修持打卡记录（自描述模型，vowId 可空）
// 两种打卡场景：
//   日常裸打卡：vowId=null
//   发愿修持：vowId=有
// ⚠️ 法会计数不走此表，走独立的 EventCount 表
// 现有 PracticeEntry 停止新写入（历史数据保留）；新打卡一律走 PracticeLog
model PracticeLog {
  id     String @id @default(cuid())
  userId String

  // 修什么（必填，自描述，独立于愿）
  practiceProjectId String
  meditationId      String?  // 92修法第几法（指向 Meditation.id，seriesNumber 表示第几法）

  // 可选关联层
  vowId   String?  // 有发愿才挂（日常裸打卡为空）
  eventId String?  // 保留字段（旧数据兼容），新系统法会计数走 EventCount，不再写此字段
  classId String?  // 班级归属（无愿也能算班级/每周回向）

  // 双计量
  count           Int?      // 遍数（咒语）
  durationMinutes Int?      // 时长（座次类）
  sessionCount    Decimal?  // 座次（自动计算：≥30min=1, ≥15min=0.5, <15min=0）

  source        String   @default("manual") // manual / bulk / tap / shake
  reflection    String?
  reflectionAt  DateTime? // 填写反思的时间戳，服务端写反思时自动赋值
  logDate       DateTime  // UTC 时间戳；可补填历史日期；显示层按 User.timezone 或 Class.timezone 转换

  // 审核态
  isConfirmed Boolean   @default(false)
  confirmedAt DateTime?
  confirmedBy String?   // 管理员 userId

  createdAt DateTime @default(now())

  user User             @relation(fields: [userId], references: [id])
  vow  UserPracticeVow? @relation(fields: [vowId], references: [id])
}
```

#### 闻思打卡系统（3 张）

```prisma
// 闻思类打卡（仅覆盖讲考 + 共修；听/读/观修走轻量 LessonCompletion，不审核）
model StudyRecord {
  id       String  @id @default(cuid())
  userId   String
  classId  String?  // 自学师兄可为 null
  lessonId String   // 所有打卡必须绑定课时

  studyType String
  // speaking_present  讲考：主讲（三选一，互斥）
  // speaking_question 讲考：提问（三选一，互斥）
  // speaking_observe  讲考：旁听（三选一，互斥）
  // group_attend      共修：出席（二选一，互斥）
  // group_absent      共修：缺席（二选一，互斥）
  // group_review      共修：复习
  // group_summary     共修：总结
  // 注：listen 和 read_notes 已从此表移除，走 LessonCompletion

  lessonResourceId  String?  // 听课/读讲记：选哪位讲者版本
  classSessionId    String?  // 共修：关联 ClassSession
  speakingSessionId String?  // 讲考：关联 SpeakingSession

  studyDate DateTime
  createdBy String?  // 本人或主麦代录

  // 审核态
  isConfirmed Boolean   @default(false)
  confirmedAt DateTime?
  confirmedBy String?   // 管理员 userId

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
  createdBy    String   // 管理员 userId
  createdAt    DateTime @default(now())

  class  Class  @relation(fields: [classId], references: [id])
  lesson Lesson @relation(fields: [lessonId], references: [id])

  @@unique([classId, lessonId])
}

// 每日修持日记（与现有 Note 课时笔记完全不同：日记绑日期，笔记绑课时）
model PracticeJournal {
  id          String   @id @default(cuid())
  userId      String
  classId     String?
  journalDate DateTime // 对应日期
  content     String
  visibility  String   @default("private")
  // private / visible_to_coach

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, journalDate])
}
```

#### 内容完成标记（1 张）

```prisma
// 轻量内容消费完成标记（听/读/观修/音频/视频，不审核，即时生效）
// 预留音频课程和视频课程扩展（type=audio / type=video）
// 与现有 LessonReadingProgress（细粒度滚动进度）并存，不替代
// MeditationSession（视频观看进度，≥80% 自动完成）并存，完成后写一条此表（type=meditation）
model LessonCompletion {
  id          String   @id @default(cuid())
  userId      String
  classId     String?  // 班级归属，用于后台/班级统计聚合

  // 内容定位（二选一必填）
  lessonId    String?  // 法本课时（听课/读法本）
  contentRef  String?  // 通用内容 ID（Meditation.id / 未来 AudioCourse.id 等）

  type        String   // 'listen' | 'read' | 'meditation' | 'audio' | 'video'
  completedAt DateTime
  durationSec Int?     // 实际消耗时长（音频/视频自动记录）

  @@unique([userId, contentRef, type])
}
```

**批量补录说明：** 批量勾选多节课 → 一次性写入 `LessonCompletion`（type=listen 或 type=read），无次数限制，无审核。

#### 思考题（1 张）

```prisma
// 参考答案独立表（替代 Question.payload.referenceAnswer，payload 字段保留）
// 师兄提交答案后才能查看；答案全局唯一（一题一份）；师兄修改答案无次数限制
model QuestionReference {
  id            String    @id @default(cuid())
  questionId    String    @unique
  referenceText String
  publishedAt   DateTime?
  publishedBy   String?   // admin userId
  updatedAt     DateTime  @updatedAt

  question Question @relation(fields: [questionId], references: [id])
}
```

#### 排表模板系统（6 张）

```prisma
// 科目（最小排课单位；语义=科目/年级，下面直接是周，不再分上下学期）
// 示例：加行一年级（第1-26周）、加行二年级（第27-52周）
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

// 周模板（不存具体日历日期，只存内容序号；周编号每班独立，从本班 startDate 起算）
model ProgramWeek {
  id            String   @id @default(cuid())
  programId     String
  semesterId    String
  weekNumber    Int      // 科目内第几周
  globalWeekNum Int      // 科系全程第几周
  isHoliday     Boolean  @default(false)
  notes         String?

  program   Program          @relation(fields: [programId], references: [id])
  semester  ProgramSemester  @relation(fields: [semesterId], references: [id])
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
  id           String  @id @default(cuid())
  weekId       String
  practiceId   String  // 关联现有 PracticeProject
  meditationId String? // 92修法时：指向 Meditation（含 seriesNumber，即第几法）
  displayOrder Int     @default(0)
  notes        String?

  week ProgramWeek @relation(fields: [weekId], references: [id])

  @@unique([weekId, practiceId, meditationId])
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
  studyType    String  // speaking_present / group_attend 等
  requirement  String  // required / recommended
  displayOrder Int     @default(0)
  displayLabel String  // 前端显示名

  program Program @relation(fields: [programId], references: [id])

  @@id([programId, studyType])
}
```

#### 自学读物（2 张）

```prisma
// 18 本《大学演讲系列》种子数据（预置内容）
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
// 法会活动（集体回向依赖此表；与现有 DharmaAssembly 并存）
// 藏历法会：timezone = "Asia/Shanghai"（西藏时间 = 北京时间 UTC+8）
// 法会边界判断：服务器将 PracticeLog.logDate（UTC）转为 Event.timezone 本地日期后比较
model Event {
  id             String   @id @default(cuid())
  title          String
  eventType      String   // puja / dharma_assembly / weekly
  coverImageUrl  String?  // 封面图（法会列表卡片 + 详情页顶部）
  startDate      DateTime // Event.timezone 所在地的日期（全天事件）
  endDate        DateTime
  timezone       String   // 必填，IANA 格式（藏历法会固定填 Asia/Shanghai）
  tibetanDate    String?  // 纯展示文字（如"藏历四月十五"），不参与任何计算
  description    String?
  liveStreamUrl  String?  // 直播链接（Zoom / YouTube Live / 腾讯会议等），进行中时展示「进入直播」按钮
  recordingUrl   String?  // 录像链接，法会结束后 admin 补填，展示「观看回放」按钮
  isActive       Boolean  @default(true)
  createdBy      String   // admin userId
  createdAt      DateTime @default(now())

  eventCounts    EventCount[]
}

// 约修 ⏸ 暂缓（Phase 5）：DB + 后台 API 先建，学员端 UI 暂缓
// 可见性：仅本班成员可见（classId 必填，不跨班）
// 总目标：集体目标，无个人指标
// 自动关闭：endDate 到期（expired）或 currentTotal ≥ totalTarget（completed）
model PracticeAppointment {
  id                String   @id @default(cuid())
  creatorId         String   // 创建者（班级任意成员）
  classId           String   // 必填，仅对该班成员可见
  title             String   // 约修标题，如"三月上师瑜伽共修"（列表展示用，必填）

  practiceProjectId String   // 修什么（关联 PracticeProject）
  totalTarget       Int      // 集体总目标量
  currentTotal      Int      @default(0)  // 缓存累计量，每次打卡后更新

  startDate         DateTime?
  endDate           DateTime  // 必填，到期自动关闭

  description       String?
  status            String   @default("active")
  // active | completed（目标达成）| expired（到期未完成）| cancelled（创建者取消）

  createdAt         DateTime @default(now())

  vows UserPracticeVow[]

  @@index([classId, status])
}

// 法会计数（完全独立于 PracticeLog，不同步，不合并）
// 职责：记录用户在法会期间的修持贡献量，驱动集体回向实时总量
// 严格补录规则：今天 > event.endDate（按 event.timezone 计算）后禁止新提交，页面只读
// 有法会愿时 vowId 自动填入，愿进度 = SUM(count) WHERE vowId = :id（不走 PracticeLog）
// 与日常修持愿（PracticeLog）完全独立，不同步
model EventCount {
  id                String   @id @default(cuid())
  eventId           String
  userId            String
  practiceProjectId String
  count             Int
  vowId             String?  // 有法会愿时自动关联
  submittedAt       DateTime @default(now())

  event Event            @relation(fields: [eventId], references: [id])
  user  User             @relation(fields: [userId], references: [id])
  vow   UserPracticeVow? @relation(fields: [vowId], references: [id])

  @@index([eventId, practiceProjectId])
  @@index([userId, eventId])
}

// 关怀跟进记录（仅 canCareFollowup=true 的 ClassAdmin 可填写，师兄端完全不可见）
model CareFollowup {
  id             String   @id @default(cuid())
  studentId      String   // 被关怀的师兄 userId
  classId        String
  careWorkerId   String   // 关怀人 userId
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

#### 班级动态（1 张）

```prisma
// 学修感想 / 班级动态（UI ⏸ 暂缓，DB + API 当前阶段预留）
// 互动：点赞 + 评论 + 转发（转发见 ClassPostShare）
// 删除权限：本人 或 ClassAdmin（canManageMembers=true）
model ClassPost {
  id        String    @id @default(cuid())
  classId   String
  authorId  String
  content   String
  isDeleted Boolean   @default(false)
  deletedBy String?   // 操作者 userId
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  class     Class              @relation(fields: [classId], references: [id])
  author    User               @relation(fields: [authorId], references: [id])
  reactions ClassPostReaction[]
  comments  ClassPostComment[]
  shares    ClassPostShare[]
}

// 点赞（一人一赞，可取消）
model ClassPostReaction {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post ClassPost @relation(fields: [postId], references: [id])
  user User      @relation(fields: [userId], references: [id])

  @@unique([postId, userId])
}

// 评论（支持管理员软删除）
model ClassPostComment {
  id        String    @id @default(cuid())
  postId    String
  authorId  String
  content   String
  isDeleted Boolean   @default(false)
  deletedBy String?
  deletedAt DateTime?
  createdAt DateTime  @default(now())

  post   ClassPost @relation(fields: [postId], references: [id])
  author User      @relation(fields: [authorId], references: [id])
}

// 转发记录（⚠️ 待决策：站内转发 or 仅复制文本到剪贴板？当前只记录行为）
model ClassPostShare {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post ClassPost @relation(fields: [postId], references: [id])
  user User      @relation(fields: [userId], references: [id])
}
```

#### 班级讨论（4 张）

```prisma
// 班级讨论话题（UI ⏸ 暂缓，DB + API 当前阶段预留）
// 创建权限：ClassAdmin（任意 flag）或 admin；投票/评论：班级任意成员
model Discussion {
  id          String    @id @default(cuid())
  classId     String
  authorId    String    // 仅 ClassAdmin 或 admin
  title       String
  description String?
  lessonId    String?   // 可选关联课时
  courseId    String?   // 可选关联法本
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
  comments   DiscussionComment[]
}

// 可投票的观点选项
model DiscussionViewpoint {
  id           String   @id @default(cuid())
  discussionId String
  content      String
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())

  discussion Discussion      @relation(fields: [discussionId], references: [id])
  votes      DiscussionVote[]
}

// 投票记录（一人只能投一个观点；换投时先删再插）
model DiscussionVote {
  id           String   @id @default(cuid())
  discussionId String   // 冗余存储，方便查「我在本话题投了哪个观点」
  viewpointId  String
  userId       String
  createdAt    DateTime @default(now())

  viewpoint  DiscussionViewpoint @relation(fields: [viewpointId], references: [id])
  user       User                @relation(fields: [userId], references: [id])

  @@unique([discussionId, userId])  // DB 层保证一人一票
}

// 讨论评论（支持一级回复，应用层拒绝二级嵌套）
model DiscussionComment {
  id           String    @id @default(cuid())
  discussionId String
  authorId     String
  content      String
  parentId     String?   // 一级回复；parent 不能再有 parentId（应用层校验）
  isDeleted    Boolean   @default(false)
  deletedBy    String?   // 本人 or canManageMembers=true 的 ClassAdmin
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())

  discussion Discussion          @relation(fields: [discussionId], references: [id])
  author     User                @relation(fields: [authorId], references: [id])
  parent     DiscussionComment?  @relation("Replies", fields: [parentId], references: [id])
  replies    DiscussionComment[] @relation("Replies")
}
```

#### AI 助手（5 张）

> 详细设计见 `docs/AI_ASSISTANT_PLAN.md`（决策定型，暂未实施）。
> ⚠️ 依赖：需先启用 pgvector 扩展（`CREATE EXTENSION IF NOT EXISTS vector;`，单独 migration）。
> UI ⏸ 暂缓；Tier 2（功能导航）⏸ 暂缓；Tier 3-4 ⏸ 暂缓。

```prisma
// 法本切片 + RAG 检索（pgvector embedding）
model ContentChunk {
  id        String  @id @default(cuid())
  courseId  String
  lessonId  String?
  chapterId String?
  text      String  @db.Text
  textNorm  String  @db.Text
  charStart Int
  charEnd   Int
  lang      String                        // sc | tc | en
  embedding Unsupported("vector(1536)")?
  metadata  Json?

  course Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lesson Lesson? @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@index([courseId])
  @@index([lessonId])
}

// 功能 catalog（功能导航；Tier 2 ⏸ 暂缓，DB 当前预留）
model FeatureEntry {
  id        String   @id @default(cuid())
  nameSc    String
  nameTc    String?
  nameEn    String?
  descSc    String
  descTc    String?
  descEn    String?
  keywords  String[]
  url       String
  icon      String?
  category  String                        // learning | practice | account | help
  isActive  Boolean  @default(true)
  embedding Unsupported("vector(1536)")?
}

// AI 对话会话（历史保存，用户可清空）
model AiConversation {
  id              String   @id @default(cuid())
  userId          String
  title           String?
  contextCourseId String?
  contextLessonId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user     User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages AiMessage[]

  @@index([userId, updatedAt])
}

// AI 消息（含 RAG 引用 / 功能跳转 / 用户反馈 / token 统计）
model AiMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String                  // user | assistant | system
  content        String   @db.Text
  sources        Json?                   // [{lessonId, courseId, chunkId, snippet, relevance}]
  navTarget      Json?                   // [{url, label, icon}]
  feedback       Int?                    // 1=helpful | -1=unhelpful
  feedbackText   String?
  llmModel       String?
  tokenInput     Int?
  tokenOutput    Int?
  createdAt      DateTime @default(now())

  conversation AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
}

// 用量统计（rate limit + 每日成本；与 LlmProviderUsage 不重叠：前者按用户/日，后者按 provider）
model AiUsage {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @db.Date
  queryCount  Int      @default(0)
  tokenInput  Int      @default(0)
  tokenOutput Int      @default(0)

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, date])
}
```

#### 权限控制（1 张）

```prisma
// 密法白名单（admin 直接 INSERT，无申请审批）
// 作用：控制学员是否能访问和使用密法内容（Course/Meditation/PracticeProject.isTantric=true）
// 未在白名单的学员：所有密法查询均过滤（零痕迹）
// 管理端（主麦/辅导员/admin）无需授权即可查看所有密法数据
// 撤销后：历史打卡和愿记录保留，学员失去内容访问权
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
  weekStartDate DateTime // Class.timezone 所在地的周一日期
  weekEndDate   DateTime
  summaryData   Json     // 结构化汇总（修持总量 / 闻思打卡人数等）
  generatedAt   DateTime @default(now())
  sharedAt      DateTime?
  sharedBy      String?  // 管理员 userId

  class Class @relation(fields: [classId], references: [id])

  @@unique([classId, weekStartDate])
}
```

---

### 2.4 新增 SQL 视图

在 Prisma migration SQL 中创建，后端通过 `$queryRaw` 调用：

```sql
-- 法会回向聚合视图（只显总量，不露个人）
-- 数据源：EventCount 表（独立于 PracticeLog，密法计入集体回向）
CREATE VIEW v_event_dedication_totals AS
SELECT
  ec.event_id,
  ec.practice_project_id,
  SUM(ec.count)              AS total_count,
  COUNT(DISTINCT ec.user_id) AS participant_count
FROM event_counts ec
GROUP BY ec.event_id, ec.practice_project_id;

-- 每周回向聚合视图（班级层 + 全会层）
-- 数据源：PracticeLog（日常修持）；EventCount 不计入此视图（有意设计：法会参与独立在 /events/:id 展示）
-- 密法打卡同样计入
CREATE VIEW v_weekly_dedication_totals AS
SELECT
  DATE_TRUNC('week', pl.log_date) AS week_start,
  pl.class_id,
  pl.practice_project_id,
  SUM(pl.count)              AS total_count,
  SUM(pl.duration_minutes)   AS total_minutes,
  COUNT(DISTINCT pl.user_id) AS participant_count
FROM practice_logs pl
GROUP BY DATE_TRUNC('week', pl.log_date), pl.class_id, pl.practice_project_id;
```

---

### 2.5 现有表反向关联字段（配合 2.3 新增表）

> 2.3 新增表的 `@relation` 字段指向现有模型（User / Class / Lesson / Course / Event / PracticeTemplate），
> 这些现有模型需在 migration_010 时补充对应反向字段，否则 Prisma schema 无法通过校验。

#### `User` 表新增反向关联

```prisma
model User {
  // ... 现有字段 + 2.2 新增字段 ...

  // 新增反向关联
  classAdmins          ClassAdmin[]
  selfStudyPrograms    UserSelfStudyProgram[]
  vows                 UserPracticeVow[]
  practiceLog          PracticeLog[]
  studyRecords         StudyRecord[]
  journals             PracticeJournal[]
  eventCounts          EventCount[]
  careStudentRecords   CareFollowup[]        @relation("CareStudent")
  careWorkerRecords    CareFollowup[]        @relation("CareWorker")
  authoredPosts        ClassPost[]
  postReactions        ClassPostReaction[]
  postComments         ClassPostComment[]
  postShares           ClassPostShare[]
  authoredDiscussions  Discussion[]
  discussionVotes      DiscussionVote[]
  discussionComments   DiscussionComment[]
  aiConversations      AiConversation[]
  aiUsage              AiUsage[]
  tantricGrants        TantricAccessGrant[]
}
```

> `CareFollowup` 中 `studentId` 和 `careWorkerId` 均指向 User，
> 需在 CareFollowup 上显式命名 `@relation("CareStudent")` / `@relation("CareWorker")`：
>
> ```prisma
> student    User @relation("CareStudent",  fields: [studentId],    references: [id])
> careWorker User @relation("CareWorker",   fields: [careWorkerId], references: [id])
> ```

#### `Class` 表新增反向关联

```prisma
model Class {
  // ... 现有字段 + 2.2 新增字段 ...
  admins               ClassAdmin[]
  restWeeks            CohortRestWeek[]
  recommendedTemplates CohortRecommendedTemplate[]
  careFollowups        CareFollowup[]
  posts                ClassPost[]
  discussions          Discussion[]
  weeklySummaries      CohortWeeklySummary[]
}
```

#### `Lesson` 表新增反向关联

```prisma
model Lesson {
  // ... 现有字段 + 2.2 新增字段 ...
  speakingSessions     SpeakingSession[]
  studyRecords         StudyRecord[]
  contentChunks        ContentChunk[]
}
```

#### `Course` 表新增反向关联

```prisma
model Course {
  // ... 现有字段 + 2.2 新增字段 ...
  contentChunks        ContentChunk[]
  tantricGrants        TantricAccessGrant[]
}
```

#### `PracticeTemplate` 表新增反向关联

```prisma
model PracticeTemplate {
  // ... 现有字段 ...
  cohortBindings       CohortRecommendedTemplate[]
}
```

---

## 三、后端改动范围

### 3.1 新增 API 模块（16 个）

| 模块 | 路由前缀 | 主要功能 |
|---|---|---|
| Programs | `/api/programs` | 科系 CRUD（admin）|
| ClassAdmins | `/api/classes/:id/admins` | ClassAdmin RBAC 分配管理 |
| CohortRestWeeks | `/api/classes/:id/rest-weeks` | 班级休息周管理 |
| CurrentLesson | `/api/classes/:id/current-lesson` | 当前课时号查询（进度算法）|
| VowTemplates | `/api/practice-templates` | 修持模板管理（admin）|
| Vows | `/api/vows` | 修持愿 CRUD + 状态机 |
| VowLogs | `/api/vows/:id/logs` | 修持打卡 |
| VowPause | `/api/vows/:id/pause` + `/resume` | 愿暂停/恢复（自助，无审批）|
| StudyRecords | `/api/study-records` | 闻思打卡（讲考+共修，含批量）|
| SpeakingSessions | `/api/classes/:id/speaking-sessions` | 讲考场次管理 |
| PracticeJournals | `/api/journals` | 修持日记 CRUD |
| SelfStudy | `/api/self-study` | 自学师兄管理 + 读物记录 |
| Events | `/api/events` | 法会活动（admin CRUD）+ 学员端列表/详情/集体回向/打卡/发愿 |
| Appointments | `/api/appointments` | 约修创建/加入/关闭 ⏸ 暂缓（Phase 5：后端 API 先做，学员端 UI 暂缓）|
| CareFollowups | `/api/care-followups` | 关怀跟进（canCareFollowup=true 专属）|
| TantricGrants | `/api/admin/tantric-grants` | 密法白名单（admin 专属）|
| ClassPosts | `/api/classes/:id/posts` | 学修感想发布/列表/软删除 + 点赞/评论/转发记录（UI ⏸ 暂缓，API 当前阶段预留）|
| ClassDiscussions | `/api/classes/:id/discussions` | 话题 CRUD + 投票 + 评论（UI ⏸ 暂缓，API 当前阶段预留）|
| AiAssistant | `/api/ai` | 对话 CRUD + SSE 流式问答 + 用量检查（UI ⏸ 暂缓）|
| AiAdmin | `/api/admin/ai` | LLM 配置 / 法本索引触发 / 功能 catalog 管理 / 用量 dashboard（UI ⏸ 暂缓）|

#### Events 模块端点明细

```
GET  /api/events
  query: status=upcoming|active|ended|all（默认 all）
  学员端：只返回 isActive=true 的事件
  响应：id / title / eventType / coverImageUrl / startDate / endDate /
        timezone / tibetanDate / status（服务端计算）/ participantCount /
        liveStreamUrl / recordingUrl

GET  /api/events/:id
  响应：同上 + description + dedicationTotals（来自 v_event_dedication_totals，
        按 practiceProjectId 分组）
  // liveStreamUrl / recordingUrl 直接透传，前端按状态决定按钮显示

GET  /api/events/:id/my-participation
  响应：vow（UserPracticeVow，有愿时）/ submissionCount / totalCount
  // submissionCount：提交次数；totalCount：累计遍数（EventCount 无时长字段）
  用于前端判断「我的参与」状态机

POST /api/events/:id/count
  前置校验：toLocalDate(now, event.timezone) <= event.endDate，否则 403「法会已结束，不接受新提交」
  body: { practiceProjectId, count }
  写 EventCount { eventId, userId, practiceProjectId, count,
    vowId: 自动查询用户当前有效法会愿（context=event AND eventId=:id AND status=active），有则填入 }
  后置：若 vowId 存在，更新 UserPracticeVow.currentCount（= SUM EventCount.count WHERE vowId）
  响应：EventCount + 更新后的 dedicationTotals（eventId 维度聚合）
  注：不写 PracticeLog，不影响日常修持愿进度，两套记录完全独立

POST /api/events/:id/vow
  body: { practiceProjectId, targetCount?, targetPeriod='lifetime' }
  写 UserPracticeVow { context: 'event', eventId, source: 'custom',
    startDate: max(event.startDate, toLocalDate(now, event.timezone)) }
  // "today" 以 event.timezone 为准（如法会在 Asia/Shanghai，上海时间的今天）
  响应：UserPracticeVow

// Admin only
POST   /api/admin/events
PUT    /api/admin/events/:id
DELETE /api/admin/events/:id（软删：isActive=false）
```

### 3.2 修改现有模块（6 个）

| 模块 | 改动内容 |
|---|---|
| `users` | 注册时自动生成 studentId；返回 learningMode / preferShowFaxin / timezone；accessibilityNeeds 校验 |
| `classes` | 创建/编辑支持 programId / startDate / city / timezone |
| `class-members` | 状态机操作（pause / hold-back / graduate / leave）；isPrimary 切换事务；ClassAdmin flags 验证 |
| `courses` | **所有学员侧查询加 isTantric 过滤**：未授权学员的任何 Course 查询排除密法；管理端不过滤 |
| `lessons` | 返回 sourceText 字段；关联 LessonResource ✅ Admin 端 LessonResource YouTube 管理 UI 已实现（AdminCoursesPage · commit ca0e975）|
| `question-references` | 新接口：admin 管理参考答案；师兄提交答案后解锁查看 |

### 3.3 核心业务逻辑

#### 课程进度算法（TS 函数，非 SQL 函数）

```typescript
async function getCurrentLessonNumber(
  classId: string,
  targetDate: Date
): Promise<number> {
  const cls = await prisma.class.findUnique({ where: { id: classId } })
  if (!cls?.startDate) return 1

  const startMonday = getMonday(cls.startDate)
  const targetMonday = getMonday(targetDate)
  const naturalWeeks = weeksBetween(startMonday, targetMonday) + 1

  // 只计算目标日期之前的休息周（当天及之后不算）
  const restWeeks = await prisma.cohortRestWeek.count({
    where: {
      classId,
      restStartDate: { lt: targetMonday }
    }
  })

  return Math.max(1, naturalWeeks - restWeeks)
}
// 验证：+2周无休息=第3课 ✓ | 中间1个休息周后+2周=第2课 ✓
// 周编号每班独立，从本班 startDate 起算，不跨班共享
// 升科目 = 主麦手动操作（需 canManageCourse=true），不自动触发
```

#### 座次计算（每次打卡调用）

```typescript
function calcSessionCount(durationMinutes: number): number {
  if (durationMinutes >= 30) return 1
  if (durationMinutes >= 15) return 0.5
  return 0
}
// 阈值 30/15 分钟为确认值（测试场景文档 45/20 为举例，非阈值）
```

#### 学号自动生成（事务内调用）

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
// ⚠️ 历史数据导入必须在开放注册前完成，否则序号冲突
```

#### 修持愿状态机（打卡后实时重算）

**重算触发点**（全部实现）：
- 每次提交 PracticeLog 后（context≠event 愿）
- 每次提交 EventCount 后（context=event 愿）
- 主麦修改愿的到期日（currentEndDate）后
- 师兄暂停/恢复愿后
- 补录历史打卡后

**重算逻辑**：

```typescript
async function recalcVowStatus(vowId: string): Promise<VowStatus> {
  const vow = await prisma.userPracticeVow.findUnique({
    where: { id: vowId },
    include: { logs: true, eventCounts: true }
  })

  if (!vow || vow.status === 'paused') return 'paused'

  // context=event 愿：计数来源是 EventCount；其他愿来源是 PracticeLog
  const totalCount = vow.context === 'event'
    ? vow.eventCounts.reduce((s, ec) => s + ec.count, 0)
    : vow.logs.reduce((s, l) => s + (l.count ?? 0), 0)

  if (vow.targetCount && totalCount >= vow.targetCount) return 'completed'

  const now = new Date()
  const totalDays = daysBetween(vow.startDate, vow.currentEndDate ?? now)
  const elapsedDays = daysBetween(vow.startDate, now)
  const expectedProgress = totalDays > 0 ? elapsedDays / totalDays : 1
  const actualProgress = vow.targetCount ? totalCount / vow.targetCount : 1
  const ratio = expectedProgress > 0 ? actualProgress / expectedProgress : 1

  // 近 7 天日均速度预测（event 愿用 eventCounts，其他用 logs）
  const recent7dayCount = vow.context === 'event'
    ? countEventCountsInLast7Days(vow.eventCounts)
    : countLogsInLast7Days(vow.logs)
  const dailyRate = recent7dayCount / 7
  const remaining = (vow.targetCount ?? 0) - totalCount
  const daysToFinish = dailyRate > 0 ? remaining / dailyRate : Infinity
  const daysLeft = daysBetween(now, vow.currentEndDate ?? now)
  const willOverdue = daysToFinish > daysLeft

  // 优先级链：will_overdue > at_risk > falling_behind > slightly_behind > on_track
  if (willOverdue) return 'will_overdue'
  if (ratio < 0.5) return 'at_risk'
  if (ratio < 0.7) return 'falling_behind'
  if (ratio < 0.9) return 'slightly_behind'
  return 'on_track'
}
// 进度计算乐观：未确认（isConfirmed=false）的打卡立即计入，不等主麦确认
// 阈值（0.5/0.7/0.9，近7天窗口）上线前可配置调整
// ⚠️ context=event 愿：用户在发愿之前提交的 EventCount（vowId=null）不会回溯关联
//    此为有意设计：发愿前的随喜计数仅计入集体总量，不纳入个人愿进度
```

**掉队检测**（独立系统，每日凌晨定时任务）：
- 计算对象：学员在班级的综合学习状态（非单条愿）
- 结果写入另一字段/表（与愿状态独立）
- 4 级：on_track / slightly_behind / falling_behind / at_risk
- 阈值基准：近 2 周修持达标率（实际/本班设定目标），⏸ 上线前可调

**约修自动关闭**（每日凌晨定时任务）：

```typescript
async function closeExpiredAppointments() {
  const now = new Date()
  const expired = await prisma.practiceAppointment.findMany({
    where: { status: 'active', endDate: { lt: now } }
  })
  for (const apt of expired) {
    await prisma.$transaction([
      prisma.practiceAppointment.update({
        where: { id: apt.id },
        data: { status: 'expired' }
      }),
      prisma.userPracticeVow.updateMany({
        where: { appointmentId: apt.id, status: 'active' },
        data: { status: 'paused' }
      })
    ])
  }
}
```

**法会边界判断（五层时区）**：

```typescript
function isPracticeLogInEvent(log: PracticeLog, event: Event): boolean {
  // logDate 为 UTC，转为 event.timezone 本地日期后与 event 日期比较
  const logLocalDate = toLocalDate(log.logDate, event.timezone)
  return logLocalDate >= event.startDate && logLocalDate <= event.endDate
}
// 藏历法会 event.timezone = "Asia/Shanghai"
// 纽约参与者在北京时间 00:00 之前的打卡不计入当天法会
```

### 3.4 权限中间件（新增）

```
class-admin.middleware.ts
  验证 ClassAdmin 表中的 classId + userId 关系
  按路由需求检查对应 flag（canManageMembers / canAuditPractice 等）
  无记录或 flag=false → 403

tantric-filter.middleware.ts
  学员侧所有 Course / Meditation / PracticeProject 查询：
    isTantric=true 时验证 TantricAccessGrant，无记录直接过滤（零痕迹）
  管理端 API 不挂此中间件

vow-visibility.middleware.ts
  师兄：where userId = currentUser.id
  管理员（canViewStudents=true）：where source='auto' AND classId IN (管理的班级)
  custom 愿对管理员不可见
  跨班禁止

care-followup.middleware.ts
  仅 ClassAdmin.canCareFollowup=true 可访问
  师兄端路由不挂载此接口
```

---

## 四、前端改动范围

### 4.1 学员端新增页面（8 个）

| 页面 | 路由 | 说明 |
|---|---|---|
| 修持愿列表 | `/vows` | 查看自己全部愿（auto + custom）+ 进度条 |
| 修持打卡 | `/vows/:id/log` | 打卡（含座次自动计算）+ 回向 UI |
| 修持日记 | `/journals` | 每日一篇，private / visible_to_coach |
| 每周回向 | `/dedication` | 跨法会每周修持总量汇总（只显总数，不露个体）；法会专项回向在 `/events/:id` 内展示 |
| 自学读物 | `/books` | 18 本读物阅读进度 |
| 约修 | `/appointments` | 查看班级约修 + 加入 ⏸ 暂缓（Phase 5）|
| 法会列表 | `/events` | 三分区：正在进行 / 即将开始 / 往期 |
| 法会详情 | `/events/:id` | 见下方详细设计 |

#### 法会列表页（`/events`）

三个分区，垂直排列：

| 分区 | 数据条件 | 排序 | 卡片内容 |
|---|---|---|---|
| 正在进行 | `startDate ≤ 今天 ≤ endDate` | startDate asc | 封面图 + 标题 + 藏历日期 + 「还剩 N 天」倒计时 + 橙色「参与」按钮 |
| 即将开始 | `startDate > 今天` | startDate asc | 同上，按钮文案改为「预发愿」 |
| 往期法会 | `endDate < 今天` | endDate desc | 折叠态；展开后纯列表：标题 + 日期区间 + 参与人数 |

#### 法会详情页（`/events/:id`）

**区块 1：法会基本信息**
- 封面图（`coverImageUrl`，全宽 16:9；无图时用主题色占位块）
- 标题（大字）
- 藏历日期（`tibetanDate`）+ 公历日期区间
- 时区说明：小字「以北京时间为准」（`timezone=Asia/Shanghai` 时自动显示）
- 活动描述（超过 3 行折叠，点击展开）
- 状态 badge：`即将开始` / `进行中` / `已结束`
- 入口按钮（按状态和字段是否填写控制显示）：

  | 状态 | liveStreamUrl | recordingUrl | 显示 |
  |---|---|---|---|
  | 进行中 | 有 | — | 「进入直播」（主色，prominent）|
  | 进行中 | 空 | — | 不显示 |
  | 已结束 | — | 有 | 「观看回放」|
  | 已结束 | — | 空 | 不显示 |
  | 即将开始 | 有 | — | 「直播链接」（次要样式，提前展示）|

  点击均在新标签页打开，不做 in-app 播放。

**区块 2：集体回向**
- 按 `practiceProjectId` 分组，每项显示：修法名 + 遍数或座次合计 + 参与人数
- 示例：「上师瑜伽 · 共 12,450 遍 · 38 人参与」
- 数据来源：`v_event_dedication_totals` 视图（只显总量，不透露个人）
- 进行中时 30 秒轮询刷新；已结束时静态展示

**区块 3：我的参与（状态机）**

| 用户状态 | 区块展示 | 可用操作 |
|---|---|---|
| 未发愿、未打卡 | 两个并排按钮 | 「发法会愿」/ 「随喜打卡」|
| 已发法会愿（进行中）| 愿进度条（已完成量 / 目标量）+ 按钮 | 「去打卡」|
| 仅随喜（无愿）| 「已随喜 N 次，合计 X 遍」 | 「继续打卡」|
| 已发愿且法会已结束 | 愿最终进度 | 无操作按钮 |
| 未发愿且法会已结束 | 「此法会已结束」 | 无操作按钮 |

**即将开始时**：「发法会愿」按钮正常可用（`vow.startDate = event.startDate`，提前建愿）；「随喜打卡」按钮不可用（法会未开始不能打卡，tooltip 提示）。

**回向 Sheet（区块 3 内联，不跳转新页）：**
- 点击「回向」或「继续回向」→ 底部 Sheet 弹出（桌面用 centered Dialog，见 CSS-GOTCHAS.md §7）
- Sheet 内容（极简，无反思/审核字段）：
  - 修法项目选择（有法会愿时 pre-fill 愿的 practiceProjectId，可修改）
  - 遍数输入（Int，必填；法会计数以遍数为单位，不记时长/座次）
  - 提交 → 写 `EventCount { eventId, userId, practiceProjectId, count, vowId（自动）}`
  - 提交成功 → Sheet 关闭，区块 2 集体总量实时 +N 动效
- **法会结束后**：「回向」按钮不渲染，区块 3 显示「法会已结束」，仅展示最终贡献量
- ⚠️ 此提交不写 PracticeLog，不影响日常修持愿，与学修计数模块完全隔离

**发愿 Sheet（区块 3 内联）：**
- 点击「发法会愿」→ 底部 Sheet 弹出
- Sheet 内容：
  - 修法项目选择
  - 目标量输入（targetPeriod 固定为 `lifetime`，整个法会期间完成）
  - startDate 只读显示（= event.startDate 或 today，取较大值）
  - 提交 → 写 `UserPracticeVow { context: 'event', eventId, source: 'custom' }`
  - 提交成功 → 状态切换到「已发法会愿」状态

### 4.2 学员端修改页面（4 个）

| 页面 | 改动 |
|---|---|
| 课程详情 | 多讲者 LessonResource 展示；按 Class.timezone 显示共修时间；「已学完」轻量按钮 |
| 打卡记录 | 讲考 3 选 1 UI；共修出席/缺席 UI；审核锁定状态显示 |
| 思考题 | 提交后解锁参考答案入口（QuestionReference）|
| 个人设置 | 发心语开关（preferShowFaxin）；timezone 选择 |

### 4.3 管理端（/coach/*）新增页面（5 个）

```
/coach/                            落地页：此人管理的班级列表
/coach/:classId/                   班级首页（仅显示有权限的模块）
/coach/:classId/members            canManageMembers（暂停/留级/毕业/退班）
/coach/:classId/exams              canManageExams（讲考场次管理）
/coach/:classId/audit              canAuditPractice（批量确认 StudyRecord + PracticeLog）
/coach/:classId/students           canViewStudents（学员修行数据 + 掉队名单）
/coach/:classId/care               canCareFollowup（关怀跟进记录）
/coach/:classId/goals              canEditGoals（愿每日目标量）
/coach/:classId/course             canManageCourse（法本切换/升科目，手动操作）
```

无权限的模块：前端不渲染（隐藏），后端 API 也守卫（双重保障，三端分离铁律不变）。

| 页面 | 说明 |
|---|---|
| 成员状态管理 | 批量操作：暂停/留级/毕业/退班 + 原因填写；需 canManageMembers |
| 打卡审核中心 | 批量确认 StudyRecord + PracticeLog；可取消确认；需 canAuditPractice |
| 掉队名单 | 按掉队状态排序；查看详情；需 canViewStudents |
| 修持愿管理 | 查看本班 auto 愿；修改到期日/每日目标量；需 canEditGoals |
| 班级周汇总 | 生成本周汇总数据；一键复制到 WhatsApp；需 canViewStudents |

### 4.4 Admin 端新增页面（7 个）

| 页面 | 说明 |
|---|---|
| 科系管理 | Program CRUD（code 唯一）+ 科目/周排表 |
| 修持模板管理 | PracticeTemplate CRUD + 班级绑定 |
| 密法授权管理 | TantricAccessGrant：直接 INSERT/DELETE ⏸ 暂缓（Phase 5：后台先做，学员端 UI 暂缓）|
| 班级休息周 | CohortRestWeek 管理；实时预览课程进度效果 |
| 参考答案管理 | QuestionReference CRUD；发布后师兄答题后可查看 |
| 法会活动管理 | Event CRUD（法会回向依赖）+ 藏历日期展示字段 |
| 自学师兄管理 | 全局查看自学进度；修改 status |
| ClassAdmin 权限分配 | `/admin/classes/:id/admins`：搜索用户 → 逐 flag 勾选 → 保存 |

### 4.5 无新增表的纯前端/后端逻辑（5 个）

| 功能 | 实现方式 |
|---|---|
| 打卡报数文本生成 | 打卡后从 PracticeLog 组装文字，复制到剪贴板；密法参与报数 |
| 批量补录 | 多选课时 → 批量 POST 写入 LessonCompletion；无次数限制 |
| 打卡前发心语 | 读 User.preferShowFaxin；preferShowFaxin=false 时隐藏；文案配置在前端常量 |
| 打卡后回向 UI | 打卡成功确认页，可选点击，不强制；无新增表 |
| 掉队检测计算 | 后端定时任务，结果写掉队状态字段 |

---

## 五、业务规则与权限约束

> 使用应用层中间件实现，不依赖数据库 RLS。

### 权限红线（7 条）

| 规则 | 实现 |
|---|---|
| 师兄只能看自己的愿 | API：`where userId = req.user.id` |
| 跨班师兄互不可见愿 | API：验证 classId 归属 |
| 管理员看本班 auto 愿，不看 custom 愿 | API：`where source='auto' AND classId IN (...)` |
| 管理员不能跨班操作 | 中间件：验证 ClassAdmin 记录 |
| 密法零痕迹（学员侧）| 所有学员侧 Course/Meditation/PracticeProject 查询：isTantric=true 过滤 |
| 关怀记录对学员不可见 | CareFollowup 路由：仅 canCareFollowup=true 可访问 |
| 掉队状态对学员不可见 | Vow API 响应：学员端不返回 currentStatus 字段 |
| 法会字段写权限限 admin | Event CRUD（含 liveStreamUrl / recordingUrl）仅 admin 角色可写；学员侧 API 只读 |
| 讨论话题创建权限 | Discussion 创建/关闭：ClassAdmin（任意 flag）或 admin；投票/评论：班级任意成员 |
| 讨论一人一票 | DB：`@@unique([discussionId, userId])`；换投：应用层先删旧票再插新票 |

### 数据完整性约束（7 条）

| 规则 | 实现 |
|---|---|
| 同一时刻只有一个主班 | 事务：先 `isPrimary=false`（全班），再 `isPrimary=true`（新主班）|
| 92修法打卡建议关联第几法 | Zod schema：meditationId 可空，但 seriesKey='92xiufa' 时建议不为空 |
| 讲考三选一互斥 | DB：`@@unique([classSessionId, userId, studyType])`；应用层校验 studyType 为讲考类之一（speaking_pass/speaking_fail/speaking_absent） |
| 共修出席/缺席二选一 | DB：`@@unique([classSessionId, userId, studyType])`；应用层校验 studyType 为共修类之一（group_attend/group_absent） |
| 每日日记一人一天一篇 | DB：`@@unique([userId, journalDate])` |
| 学号全局唯一 | DB：`studentId @unique` |
| isPublic 仅限 personal/appointment 愿 | Zod schema：context=class 或 context=event 时强制 isPublic=false，忽略传入值 |

### 到期日与目标量变更权限

| 愿类型 | 谁能改到期日 | 谁能改每日目标量 |
|---|---|---|
| auto 愿 | canEditGoals=true 的管理员（自动写 AuditLog）| 管理员 + 师兄自己（节奏自主原则）|
| custom 愿 | 师兄自己 | 师兄自己 |
| 所有改动 | — | 自动写 AuditLog |

### 五层时区规则

| 场景 | 存储格式 | 时区基准 | 显示层处理 |
|---|---|---|---|
| 班级共修/讲考场次 | UTC timestamp | `Class.timezone` | 前端按班级时区转换显示 |
| 打卡时间戳 `PracticeLog.logDate` | UTC timestamp | — | 前端按 `User.timezone` 或 `Class.timezone` 显示 |
| 周汇总边界 `CohortWeeklySummary.weekStartDate` | `Class.timezone` 的周一日期 | `Class.timezone` | 直接展示 |
| 自学进度计算 | UTC timestamp | `User.timezone` | 前端按 `User.timezone` 显示 |
| 法会时间 `Event.startDate/endDate` | `Event.timezone` 的本地日期 | `Event.timezone` | 前端同时展示法会时区 + 用户本地时间，标注"以藏历所在地时间为准" |

**藏历法会**：`Event.timezone` 固定填 `Asia/Shanghai`（西藏时间 = 北京时间 UTC+8）。法会日期边界按上海时间子夜（00:00 CST）起算。

### 密法可见性矩阵

| 角色 | 密法内容（Course/Meditation）| 密法愿 | 密法打卡 |
|---|---|---|---|
| 未授权学员 | ❌ 零痕迹（列表/搜索/关联全过滤）| ❌ | ❌ |
| 授权学员（TantricAccessGrant）| ✅ | ✅ 自己的 | ✅ 自己的 |
| 管理员（任何 flag）| ✅ 始终可见 | ✅ 全班 | ✅ 全班 |
| Admin | ✅ 全平台 | ✅ 全平台 | ✅ 全平台 |

**密法计数规则**：
- ✅ 密法打卡计入集体回向
- ✅ 密法打卡参与打卡报数生成
- ✅ 密法打卡计入个人愿进度

---

## 六、Migration 策略

### 原则

- **只增不删**：不删除任何现有字段/表，新字段全部可空或有默认值
- **两层分离**：先跑纯新增 migration（结构），再跑数据迁移脚本（种子/历史数据）
- **现有功能零中断**：migration 期间现有功能不受影响

### 第一层：结构 Migration（无破坏性，可随时跑）

```
migration_001_add_enums.sql           新增 7 个枚举
migration_002_extend_user.sql         User 加 6 个字段
migration_003_extend_class.sql        Class 加 4 个字段
migration_004_extend_classmember.sql  ClassMember 加 7 个字段
migration_005_extend_course.sql       Course 加 3 个字段（author + isTantric + programSemesterId）
migration_006_extend_lesson.sql       Lesson 加 1 个字段（sourceText）
migration_007_extend_classsession.sql ClassSession 加 2 个字段
migration_008_extend_meditation.sql   Meditation 加 3 个字段（seriesKey/seriesNumber/isTantric）
migration_009_extend_practice.sql     PracticeProject 加 1 个字段（isTantric）
migration_009_pgvector.sql            启用 pgvector 扩展（CREATE EXTENSION IF NOT EXISTS vector）
migration_001_lesson_resources.sql    ✅ 已跑 · 建 LessonResource / LessonMediaChapter / LessonTextBlock 3 张表（对应 backend/prisma/migrations/1_lesson_resources/）
migration_010_new_tables.sql          建 44 张新表（含 EventCount / ClassPost 系列 / Discussion 系列 / AI 助手 5 张 / LessonMediaChapter / LessonTextBlock；PracticeGuide 未进入生产，无需 DROP）
migration_011_views.sql               建 2 个 SQL 视图
```

### 第二层：数据 Migration（一次性脚本，按顺序执行）

```
seed_001_programs.ts         录入科系种子数据（加行/净土/入行论等）
seed_002_class_admins.ts     ClassMember.role='coach' 数据 → ClassAdmin（canManageCourse + canAuditPractice 等全部 true）
seed_003_self_study_books.ts 18 本《大学演讲系列》种子数据
seed_004_student_ids.ts      为现有用户批量生成 studentId（按注册时间排序）
                             ⚠️ 必须在开放新用户注册之前执行
```

### 注意事项

- `removedAt` 字段保留（旧退班数据兼容），新退班用 `cohortStatus='left'`
- 现有 `ClassMember.role='coach'` 字段保留，但权限管理转移到 `ClassAdmin` 表
- 现有 `PracticeEntry` 数据原地保留（旧统计继续读），新打卡走 `PracticeLog`
- 密法 migration 不需要：`isTantric` 默认 `false`，现有数据默认非密法
- `UserCourseEnrollment` 上的 `selfStudyStartDate/selfStudyPace/selfStudyStatus` 三字段**不添加**（自学功能走 `UserSelfStudyProgram`）

---

## 七、分阶段实施计划

### Phase 1 · 基础架构（建议先做）

**目标**：打地基，本阶段完成后现有功能不受影响

| 任务 | 类型 |
|---|---|
| 跑 Migration 第一层（结构，11 个文件）| DB |
| 录入科系种子数据（Program）| DB |
| ClassAdmin 数据迁移（coach → RBAC flags 全开）| DB |
| 自学读物种子数据（18 本）| DB |
| 密法零痕迹中间件（所有学员侧 Course/Meditation 查询加过滤）| 后端 |
| 班级管理：timezone / programId / startDate 字段支持（admin 建班）| 后端+前端 |
| ClassAdmin RBAC 权限分配 UI（/admin/classes/:id/admins）| 前端 Admin |

### Phase 2 · 闻思打卡系统

| 任务 | 类型 |
|---|---|
| StudyRecord API（讲考+共修，含批量）| 后端 |
| SpeakingSession API | 后端 |
| 审核态（isConfirmed）API（确认/取消确认）| 后端 |
| LessonCompletion API（轻量听/读/观修完成标记，含批量补录）| 后端 |
| 讲考/共修打卡 UI（学员端）| 前端 |
| 「已学完」轻量按钮（课程详情页）| 前端 |
| 打卡审核中心（管理端）| 前端 |

### Phase 3 · 修持愿系统

| 任务 | 类型 |
|---|---|
| PracticeTemplate API（admin）| 后端 |
| UserPracticeVow API + 状态机（打卡后实时重算）| 后端 |
| PracticeLog API + 座次计算 | 后端 |
| 愿暂停/恢复 | 后端 |
| 每日定时任务（约修自动关闭 + 掉队检测）| 后端 |
| 修持愿列表/详情（学员端）| 前端 |
| 修持打卡 UI + 发心语 + 回向 | 前端 |
| 修持愿管理（管理端）| 前端 |

### Phase 4 · 双模式学习

| 任务 | 类型 |
|---|---|
| 课程进度算法（getCurrentLessonNumber）| 后端 |
| CurrentLesson API（`/api/classes/:id/current-lesson`）| 后端 |
| CohortRestWeek API | 后端 |
| UserSelfStudyProgram API | 后端 |
| 班级休息周管理（Admin，含实时预览）| 前端 |
| 自学师兄管理（Admin）| 前端 |

### Phase 5 · 集体功能与管理工具

| 任务 | 类型 |
|---|---|
| EventCount 表（migration_010 含）+ Events API 学员端端点 | 后端 |
| ClassPost 表 + ClassPosts API（发帖/列表/删除/点赞/评论/转发）| 后端 |
| ClassPost UI（班级页感想动态区）⏸ 暂缓（后续 Phase）| ⏸ |
| Discussion 系列 4 张表 + ClassDiscussions API（话题/投票/评论）| 后端 |
| Discussion UI（班级讨论页）⏸ 暂缓（后续 Phase）| ⏸ |
| pgvector 扩展 migration（migration_009）| DB |
| AI 助手 5 张表 + /api/ai + /api/admin/ai API | 后端 |
| AI 助手 UI（浮动按钮 + 聊天面板）⏸ 暂缓（后续 Phase）| ⏸ |
| AI Tier 2 功能导航（FeatureEntry catalog + 意图分类）⏸ 暂缓（后续 Phase）| ⏸ |
| AI Tier 3-4（课时内联 / 辅导员洞察 / 个性化 / 语音）⏸ 暂缓（后续 Phase）| ⏸ |
| 集体回向 SQL 视图（v_event_dedication_totals + v_weekly_dedication_totals）| 后端 |
| 法会列表页 `/events` | 前端 |
| 法会详情页 `/events/:id`（含回向 Sheet + 发愿 Sheet）| 前端 |
| 每周回向页面 `/dedication` | 前端 |
| 关怀跟进 API（canCareFollowup 专属）| 后端 |
| 约修 API（创建/加入/关闭）| 后端 |
| 班级周汇总生成 + 复制 | 后端 |
| 关怀跟进页面（管理端，canCareFollowup）| 前端 |
| 掉队名单（管理端，canViewStudents）| 前端 |
| 约修页面（学员端）⏸ 暂缓（后续 Phase）| ⏸ |
| 密法授权管理 Admin 后台 ⏸ 暂缓（Phase 5，后台先做）| ⏸ |

### Phase 6 · 内容与排表

| 任务 | 类型 |
|---|---|
| 排表模板 API（6 张表）| 后端 |
| LessonResource API（YouTube 链接 + audio/video · GET/POST/DELETE）✅ 已实现 | 后端 |
| LessonResource 音频/视频文件上传（OSS · type=audio/video）⏸ 暂缓 | 后端 |
| LessonMediaChapter API（章节标记 · C/D 模式）⏸ 暂缓 | 后端 |
| LessonTextBlock API（段落同步 · B/C 模式）⏸ 暂缓 | 后端 |
| 自学读物 SelfStudyRecord API | 后端 |
| 参考答案 QuestionReference API | 后端 |
| 课程详情多讲者展示（学员端）| 前端 |
| 自学读物页面（学员端）| 前端 |
| 参考答案管理（Admin）| 前端 |
| Meditation.seriesKey/seriesNumber 管理（Admin）| 前端 |

---

## 八、明确不做清单

| ❌ 不做 | 原因 / 替代方案 |
|---|---|
| Academy 表 | 不建；Program 上预留 `academyId String?` |
| PracticeGuide 表 | 删除，功能并入 `Meditation.seriesKey/seriesNumber` |
| StudyRecord.listen 类型 | 轻量 LessonCompletion 替代，不走审核态 |
| StudyRecord.read_notes 类型 | 同上 |
| group_sessions 独立表 | 复用现有 ClassSession，加两字段即可 |
| 法会发愿独立表 | 法会愿就是 UserPracticeVow（context=event），无需另表 |
| PracticeEntry 新写入 | 历史数据保留；新打卡一律走 PracticeLog |
| UserCourseEnrollment.selfStudy* 三字段 | 自学走 UserSelfStudyProgram（科系级），字段重复废弃 |
| PracticeProject.scope 在新系统使用 | 历史包袱；新愿归属完全由 UserPracticeVow 表达 |
| ClassAdminRole 枚举（zhumai/aixin）| 改为 RBAC flags，admin 后台细粒度分配 |
| 约修审批流 / 推送通知 | 无审批、无推送；用户自行浏览班级页发现 |
| 约修个人指标 | 总目标由创建者设；参与者无个人强制指标 |
| 约修跨班可见 | classId 必填，不支持跨班 |
| 打卡报数新增表 | 纯前端生成文字，无 DB |
| 批量补录新增表 | 前端 + 后端批量写入 LessonCompletion，无新表 |
| 批量补录每学期 2 次限制 | 轻量完成标记无审核，随时可点，无需次数约束 |
| 三殊胜精神框架新增表 | 回向为前端 UI；发心语开关用 User.preferShowFaxin |
| LessonReadingProgress 扩展字段方案 | 无法扩展音频/视频课程；改用 LessonCompletion 统一表 |
| logDate 前端本地日期字符串方案 | 跨时区班级打卡日期漂移；改为 UTC timestamp |
| 后端藏历-公历自动换算 | 前端展示参考对照；admin 手动确认公历日期 |
| 密法排除集体回向 | 决策已逆转：密法打卡**计入**集体回向（见 DESIGN_DECISIONS.md 7A）|
| 密法排除打卡报数 | 决策已逆转：密法**参与**打卡报数生成 |
| EventCount 与 PracticeLog 同步 | 两套记录完全独立，法会计数不影响日常修持愿进度 |
| 法会补录宽松模式 | 严格模式：`today > event.endDate`（按 event.timezone）即禁止提交，页面只读 |
| 全局周编号跨班共享 | 周编号每班独立，从本班 startDate 起算 |
| 升科目自动触发 | 主麦手动操作（canManageCourse），不自动 |
| 历史数据强删（PracticeEntry 等）| 保留历史数据，旧统计继续读 |

---

## 九、现有功能保留清单

以下所有现有表和功能**保持原样**，不受影响：

**认证与安全**：`AuthSession` · `PasswordResetToken` · `EmailVerificationToken` · `DeletedEmail`

**学习内容**：`Note` · `Highlight` · `NoteReport` · `LessonReadingProgress`（继续记录滚动进度）

**题目系统**（14 种题型全部保留，AI 评分全部保留）：`Sm2Card` · `UserFavorite` · `UserMistakeBook` · `QuestionReport`

**藏历与法会**：`TibetanDay` · `DharmaAssembly`（展示用，与新 Event 并存）

**观修**：`Meditation`（新增 3 字段，其余保留）· `MeditationSession`（保留，继续驱动班级观修排行）

**AI 功能**：`LlmProviderConfig` · `LlmProviderUsage` · `LlmScenarioConfig` · `LlmPromptTemplate` · `LlmCallLog`

**现有修持记录**：`PracticeCategory` · `PracticeProject`（新增 1 字段，其余保留）· `PracticeEntry`（历史数据保留，停止新写入）· `PracticeDailySummary` · `PracticeGoal` · `PracticeTask` · `PracticeMakeup`

**班级管理**：`ClassAnnouncement` · `HomePoster`

**通知系统**：`NotificationPreference` · `PushSubscription` · `Notification` · `NotificationDispatchLog` · `NotificationRule`

**用户成就**：`UserAchievementUnlock` · `SystemAnnouncement`

**运营支撑**：`AuditLog` · `ErrorLog` · `SystemSetting` · `ContentSeed` · `ContentRelease` · `Experiment` · `ExperimentExposure` · `Feedback` · `OrphanedFile` · `AnalyticsEvent`

---

*本文档为所有决策确认后的最终版，DESIGN_DECISIONS.md 为决策过程记录，两者共同构成完整的设计依据。*
