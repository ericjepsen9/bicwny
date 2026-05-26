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
   - 2.3 新增表（45 张，含完整 Prisma schema）
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
| 新增 Prisma 枚举 | 8 个 | 见 2.1（含掉队检测 LagStatus）|
| 现有表字段扩展 | 8 张表 | User / Class / ClassMember / Course / Lesson / ClassSession / Meditation / PracticeProject |
| 新增表 | 45 张 | 见 2.3（自学读物复用 Course 砍 3 张；密法加 TantricGroup +1；掉队检测加 CohortLagSnapshot +1；讲考报名 SpeakingRegistration +1；讲考评分 SpeakingGrade +1 → 净 45）|
| 新增 SQL 视图 | 3 个 | v_event_dedication_totals / v_weekly_dedication_totals / v_practice_daily（物化视图，替代 PracticeDailySummary）|
| 现有表不动 | 50+ 张 | 全部保留，零回归 |
| 新增后端模块 | 25 个 | 见 3.1 |
| 修改后端模块 | 7 个 | 见 3.2 |
| 新增前端页面（学员端）| 6 个 | 含每周回向 + 活动中心 + 法会详情 + 平台场次详情 + 签到链接页（修持愿/打卡合并进 /practice、日记嵌 /calendar、自学读物复用 Course，不单设页）|
| 修改前端页面（学员端）| 10 个 | 首页 + 修学计数页 + 藏历日历页 + 闻思页 + 课程详情 + 课程阅读页 + 打卡记录 + 思考题 + 个人设置 + 「我的」页面（讲考记录入口）|
| 新增前端页面（管理端 /coach/*）| 4 个 | 成员状态/掉队名单/修持愿管理/班级周汇总（打卡审核中心已砍）|
| 新增前端页面（Admin 端）| 8 个 | 科系/修持模板/密法组/班级休息周/参考答案/法会活动/自学师兄/ClassAdmin 权限分配 |

**核心策略说明：**
- 项目处于**开发阶段（无生产数据）**，采用**合并替换**策略：冗余表直接删除，不做并存过渡（见 §十）
- 删除 6 张冗余表：`PracticeTask` · `PracticeGoal` · `PracticeEntry` · `PracticeDailySummary` · `PracticeMakeup` · `DharmaAssembly`；修持系统全走 `UserPracticeVow / PracticeLog`，法会全走 `Event`
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
  paused      // 暂停（学员自助 或 canManageMembers 代操作，可恢复）
  held_back   // 留级（仅标记；转下一届班为手动操作，系统不建班级关联）
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

// 掉队检测状态（独立于 VowStatus —— 这是「学员在班级综合学习」的状态，非单条愿）
// 多维独立：修持/闻思/出勤/日记各维度各自取一个 LagStatus，名单页分列展示，不加权
enum LagStatus {
  on_track        // 跟得上
  slightly_behind // 略微落后
  falling_behind  // 明显落后
  at_risk         // 高风险（连续掉队或长期零打卡）
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
  // 三殊胜框架总开关：false 时跳过发心语和回向 Sheet（适用于所有学修打卡场景）
  // 控制范围：修持打卡（PracticeLog）前的发心语 + 内容完成（LessonCompletion）后的回向 Sheet
  // 个人设置页提供开关；默认开启

  timezone           String?
  // IANA 格式（如 America/New_York），用户设置页选择，自学进度和个人愿打卡时区基准
}
```

#### `Class` 表（+5 个字段）

```prisma
model Class {
  // ... 现有字段保留（joinCode / name / courseId 等）...
  // courseId 保留，语义更新为"当前主修法本"，辅导员可切换

  // 新增
  programId  String?
  // 所属科系（关联 Program）

  startDate  DateTime?
  // 班级起始日期，算法基准：当前周号 = 自然周数 - 休息周数

  city       String?
  // 班级所在城市（北京 / 纽约 / 香港等）

  timezone   String?
  // IANA 时区（如 America/New_York）；共修/讲考场次时间按此时区展示

  currentWeekOverride Int?
  // 辅导员手动覆盖的「本班当前周号」（canManageCourse）。
  // null = 用 startDate 自动算（同科系各班按各自开课日错峰）；
  // 非 null = 本班节奏与排表分叉，锁定为该周号，自动算停用，辅导员后续手动推进/清空恢复自动。
  // 解决「同科系不同班节奏不一」：科系排表给推荐基准，本字段给本班真相。

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
  // 主班：师兄可同属多班（跟班 + 自学多科系），isPrimary 标主班，决定首页默认展示哪个班的进度/排行。
  // 同一时刻一个师兄只有一个主班，应用层事务保证（不用 DB 唯一索引）。
  // 仅 active 成员有意义；主班转非 active 时应用层提示重设主班（或清 isPrimary）。
  heldBackCount      Int                @default(0)
  // 留级累计次数；转 held_back 时 +1。转下一届班为手动操作（辅导员/admin 在目标班手动加新 active 成员）。
  statusChangedAt    DateTime?
  statusChangedBy    String?            // 操作人 userId（学员自助暂停时 = 本人）
  statusChangeReason String?
  graduatedAt        DateTime?
}
```

#### `Course` 表（+5 个字段）

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

  category          String   @default("dharma_text")
  // 内容类别：dharma_text（法本，默认）| self_study_book（自学读物，18本大学演讲系列）
  // 闻思页可据此分组；读物复用 Course 全套（阅读器/报名/进度），不单设表

  tantricGroupId    String?
  // 密法组（灌顶单位）；仅 isTantric=true 时填；授权按组而非按法本（见 TantricGroup）

  programSemester ProgramSemester? @relation(fields: [programSemesterId], references: [id])
  tantricGroup    TantricGroup?    @relation(fields: [tantricGroupId], references: [id])
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

#### `ClassSession` 表（+3 个字段，+1 个字段类型变更）

```prisma
model ClassSession {
  // ... 现有字段保留（classId / title / startAt / durationMin / liveLink 等）...

  // 字段类型变更（兼容平台级共修）
  classId       String?
  // 原为 String 非空；改为可空：null = 平台级共修（admin 发起，全平台学员可参与）
  // 有值 = 班级共修（原有逻辑不变）

  // 新增（扩展 ClassSession 承载共修场次）
  lessonId      String?
  // 本次共修对应哪节课（不新建 group_sessions 表）
  sessionEndAt  DateTime?
  // 结束时刻（签到时间窗口使用）
  checkInToken  String?   @unique
  // 共修签到 token（辅导员/admin 生成，分享链接用）

  lesson        Lesson? @relation(fields: [lessonId], references: [id])
}
```

#### `Meditation` 表（+4 个字段）

```prisma
model Meditation {
  // ... 现有字段全部保留（视频/转图PPT/章节/字幕/发布管理等）...

  // 新增（92修法系列归组；替代已删除的 PracticeGuide 表）
  seriesKey    String?  // 修法系列标识（如 "92xiufa"）
  seriesNumber Int?     // 第几法（92修法为 1-92；其他修法为 null）
  isTantric    Boolean  @default(false)
  // 密法标识：同 Course.isTantric，未授权学员查询全过滤
  tantricGroupId String?  // 密法组（灌顶单位）；仅 isTantric=true 时填；按组授权
  tantricGroup   TantricGroup? @relation(fields: [tantricGroupId], references: [id])

  @@unique([seriesKey, seriesNumber])
}
```

#### `PracticeProject` 表（+2 个字段）

```prisma
model PracticeProject {
  // ... 现有字段保留（含 scope，新系统不依赖 scope，历史数据兼容）...

  // 新增
  isTantric Boolean @default(false)
  // 密法标识：此项目产生的 PracticeLog 在管理端始终可见
  tantricGroupId String?  // 密法组（灌顶单位）；仅 isTantric=true 时填；按组授权
  tantricGroup   TantricGroup? @relation(fields: [tantricGroupId], references: [id])
}
```

---

### 2.3 新增表（45 张）

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
  canViewStudents   Boolean @default(false)  // 查看学员修行数据（愿/打卡/日记）
  canCareFollowup   Boolean @default(false)  // 关怀跟进记录（CareFollowup）
  canEditGoals      Boolean @default(false)  // 编辑愿的每日目标量
  canManageCourse   Boolean @default(false)  // 课程进度/法本切换/升科目
  // 注：原 canAuditPractice 已移除 —— 签到自助免审、修持打卡乐观计入，无审核环节

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
  classId        String?  // 班级愿（仅 source=auto 使用；custom 自建一律 context=personal，不填 classId）
  eventId        String?  // 法会愿
  appointmentId  String?  // 约修愿

  // 发愿标识（合并方案核心：本表同时承载「发愿」和「裸追踪项」）
  isPledged Boolean @default(false)
  // true  = 发愿：有目标 + 进度条 + 生命周期（auto 愿恒为 true）
  // false = 裸追踪项：无目标，仅作「我的修学」快捷打卡列表锚点（target 字段全 null，不算状态）
  //         裸打卡不可补发愿（决策）：要发愿须新建一条 isPledged=true 的愿，历史裸打卡不追溯

  // 可见性（仅适用于 context=personal / context=appointment；共修愿和法会愿不适用此开关）
  isPublic Boolean @default(false)
  // false（默认）：仅自己和管理员可见；true：班级内其他成员可见愿名和进度条

  // 修持内容
  practiceProjectId String   // 修什么（关联现有 PracticeProject）
  customName        String?  // custom 愿自定义名称

  // 目标（isPledged=false 时全部 null）
  // targetPeriod 决定主目标字段（避免多字段语义重叠）：
  //   lifetime → 看 targetCount（进度 = currentCount / targetCount）
  //   daily    → 看 dailyTarget（进度 = 今日 count / dailyTarget）
  //   weekly   → 看 weeklyTarget（进度 = 本周 count / weeklyTarget）
  // 非主目标字段仅作「建议节奏」参考，不参与进度/状态判定
  targetCount       Int?
  targetPeriod      String?  // daily / weekly / lifetime（isPledged=false 时 null）
  dailyTarget       Int?
  weeklyTarget      Int?
  minSessionMinutes Int      @default(30)  // 仅 duration 计量的修法生效；遍数类（念咒）忽略

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
  // ⚠️ 仅 source=auto（班级愿）重算；personal/custom 愿无人管理，跳过重算（留默认值，省 CPU）
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
// 合并方案后的打卡场景：
//   发愿打卡：vowId = isPledged=true 的 vow（带进度条）
//   裸追踪打卡：vowId = isPledged=false 的 vow（我的修学列表锚点，仅累计数）
//   纯临时计数：vowId=null（不进列表的一次性散修，可选保留）
// ⚠️ 法会计数不走此表，走独立的 EventCount 表
// 现有 PracticeEntry 停止新写入（历史数据保留）；新打卡一律走 PracticeLog
model PracticeLog {
  id     String @id @default(cuid())
  userId String

  // 修什么（必填，自描述，独立于愿）
  practiceProjectId String
  meditationId      String?  // 92修法第几法（指向 Meditation.id，seriesNumber 表示第几法）

  // 可选关联层
  vowId   String?  // 挂到 vow（发愿或裸追踪项）；纯临时计数为 null
  eventId String?  // 保留字段（旧数据兼容），新系统法会计数走 EventCount，不再写此字段
  classId String?  // 班级归属（无愿也能算班级/每周回向）

  // 双计量
  count           Int?      // 遍数（咒语）
  durationMinutes Int?      // 时长（座次类）
  sessionCount    Decimal?  // 座次（自动计算：≥30min=1, ≥15min=0.5, <15min=0）

  source        String   @default("manual") // manual / bulk / tap / shake
  // 注：打卡反思字段已移除（决策）；反思统一写入当日 PracticeJournal（藏历日历内）
  logDate       DateTime  // UTC 时间戳；可补填历史日期；显示层按 User.timezone 或 Class.timezone 转换

  // 审核态（字段保留，当前无审核 UI —— 审核中心已砍）
  // 修持打卡乐观计入，isConfirmed 恒 false；字段留作未来可选背书，不影响进度计算
  isConfirmed Boolean   @default(false)
  confirmedAt DateTime?
  confirmedBy String?   // 管理员 userId

  createdAt DateTime @default(now())

  user User             @relation(fields: [userId], references: [id])
  vow  UserPracticeVow? @relation(fields: [vowId], references: [id])
}
```

#### 闻思打卡系统（5 张）

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

  // 审核态（字段保留，无审核 UI）：签到自助打卡置 isConfirmed=true；无需辅导员审核
  isConfirmed Boolean   @default(false)
  confirmedAt DateTime?
  confirmedBy String?   // 管理员 userId（保留字段）

  createdAt DateTime @default(now())

  user   User    @relation(fields: [userId], references: [id])
  lesson Lesson  @relation(fields: [lessonId], references: [id])
}

// 讲考场次
// classId = null → 平台级讲考（admin 发起，全平台学员可参与）
// classId 有值 → 班级讲考（原有逻辑）
model SpeakingSession {
  id            String    @id @default(cuid())
  classId       String?   // 可空：null = 平台级，有值 = 班级级
  lessonId      String
  startAt       DateTime  // 讲考开始时间（签到窗口起点）
  sessionEndAt  DateTime  // 签到窗口截止时间
  checkInToken  String?   @unique
  // 讲考签到 token（辅导员/admin 生成，上课时分享链接）
  notes         String?
  createdBy     String    // 操作人 userId
  createdAt     DateTime  @default(now())

  class         Class?                @relation(fields: [classId], references: [id])
  lesson        Lesson                @relation(fields: [lessonId], references: [id])
  registrations SpeakingRegistration[]
  grades        SpeakingGrade[]

  // @@unique([classId, lessonId]) 已移除：classId 可空时唯一约束失效
  @@index([classId, lessonId])
}

// 讲考报名（学员自主报名）
// 报名后辅导员可见报名名单；报名是签到的前提信息（非强制前置校验，但影响卡片状态显示）
// 截止时间：sessionEndAt（不单设 registrationDeadline，简化逻辑）
model SpeakingRegistration {
  id                String          @id @default(cuid())
  speakingSessionId String
  userId            String
  registeredAt      DateTime        @default(now())

  session SpeakingSession @relation(fields: [speakingSessionId], references: [id])
  user    User            @relation(fields: [userId], references: [id])

  @@unique([speakingSessionId, userId])
}

// 讲考评分（辅导员给自己班参与学员评分 + 文字评语）
// 评分在 sessionEndAt 之后进行；学员可通过通知 + 往期记录查看结果
model SpeakingGrade {
  id                String          @id @default(cuid())
  speakingSessionId String
  userId            String
  classId           String          // 辅导员所在班级（用于权限范围限定）
  score             String          // 取值：pass（通过）/ fail（不通过）/ excellent（优秀）
  comment           String?         // 文字评语（可选）
  gradedBy          String          // 辅导员 userId
  gradedAt          DateTime        @default(now())

  session SpeakingSession @relation(fields: [speakingSessionId], references: [id])
  user    User            @relation(fields: [userId], references: [id])

  @@unique([speakingSessionId, userId])  // 每场每人只有一条评分
}

// 每日修持日记（与现有 Note 课时笔记完全不同：日记绑日期，笔记绑课时）
// UI 入口：嵌入藏历日历页（/calendar）——点某天 → 查看/编写当天日记；不单设 /journals 页
// 唯一反思载体：打卡反思已移除，反思统一写这里
model PracticeJournal {
  id          String   @id @default(cuid())
  userId      String
  classId     String?
  journalDate DateTime // 对应日期（日历所选日 → User.timezone 本地日期）
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

  type        String   // 'read' | 'audio' | 'video' | 'meditation'
  // read        → lessonId，手动点「已读完」
  // audio/video → contentRef=LessonResource.id，手动点「已听完/已看完」
  // meditation  → contentRef=Meditation.id，≥80% 自动 或 手动点「完成观修」
  // 重复确认：upsert 语义，只更新 completedAt（不新增行）
  completedAt DateTime
  durationSec Int?     // 实际消耗时长（audio/video 自动记录；read/meditation 不填）

  // 两条唯一约束覆盖两种内容定位方式
  @@unique([userId, lessonId, type])    // read 场景（lessonId 非空，contentRef 为空）
  @@unique([userId, contentRef, type])  // audio/video/meditation 场景（contentRef 非空）
}
```

**批量补录说明：** 批量勾选多节课 → 一次性写入 `LessonCompletion`（type=read），无次数限制，无审核。

#### 思考题（1 张）

```prisma
// 参考答案独立表（替代 Question.payload.referenceAnswer，payload 字段保留）
// 思考题 = 现有 open 题型，但关闭 AI 评分（payload.noScoring=true）：
//   学员写下思考 → 提交（记 UserAnswer，不打分）→ 立即显示参考答案供自行对照
// 解锁条件：学员对该题已有 UserAnswer 即解锁（不要求 admin 先发布）
//   QuestionReference 不存在时 → 显示「参考答案待整理」
//   publishedAt 仅作元数据（admin 何时定稿），不作解锁门槛
// 答案全局唯一（一题一份，@@unique questionId）；师兄修改自己答案无次数限制
model QuestionReference {
  id            String    @id @default(cuid())
  questionId    String    @unique
  referenceText String
  publishedAt   DateTime?  // admin 定稿时间戳（元数据，不控解锁）
  publishedBy   String?   // admin userId
  updatedAt     DateTime  @updatedAt

  question Question @relation(fields: [questionId], references: [id])
}
```

**思考题与现有 open 题型的关系：**
- 思考题复用 `Question`（type=open），通过 `payload.noScoring=true` 标记（参照 flip 的 noScoring）
- noScoring=true 时：跳过 `gradeOpenWithLlm` AI 评分，UserAnswer 只存答案不存 score/aiGrade
- 参考答案来源：`QuestionReference.referenceText`（学员可见）；普通 open 题的 `payload.referenceAnswer`（AI 评分内部用）两者互不影响
- correctText/wrongText 对思考题可留空（无对错反馈）

#### 排表模板系统（5 张）

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
  courses   ProgramWeekCourse[]   // 周排课程/法本/自学读物（读物 category=self_study_book）
  practices ProgramWeekPractice[]

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

// 注：周 ↔ 自学读物映射不单设表，读物即 Course（category=self_study_book），走 ProgramWeekCourse

// 各科系打卡要求声明（数据驱动，不硬编码）
// 消费方：仅后端掉队检测（CohortLagSnapshot 出勤维度据此判断本科系「应打哪些卡」）。
// 不在学员前端展示（决策）；displayLabel 仅供管理端排表编辑界面识别用。
model ProgramStudyType {
  programId    String
  studyType    String  // speaking_present / group_attend 等
  requirement  String  // required / recommended
  displayOrder Int     @default(0)
  displayLabel String  // 管理端识别名（非学员端展示）

  program Program @relation(fields: [programId], references: [id])

  @@id([programId, studyType])
}
```

#### 自学读物 —— 不新建表，复用 Course

> 决策：18 本《大学演讲系列》既然要 App 内可读、且与法本同在闻思页展示，本质就是法本的一种。
> 不新建 `SelfStudyBook` / `SelfStudyRecord` 表，全部复用现有 Course 基础设施：
> - 18 本读物 = 18 个 Course，标记 `Course.category='self_study_book'`（见 §2.2 Course 字段扩展）
> - 阅读：复用现有阅读器（ScriptureReadingPage）
> - 报名 + 进度：复用 UserCourseEnrollment（lessonsCompleted / currentLessonId）
> - 读后感：复用现有 Note（绑课时），或写当日 PracticeJournal
> - 周排读物：复用 `ProgramWeekCourse`（无需 ProgramWeekSelfStudy）
> - 种子：seed 把 18 本作为 Course 录入（category=self_study_book）

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

```

#### 关怀与掉队检测（2 张）

```prisma
// 关怀跟进记录（仅 canCareFollowup=true 的 ClassAdmin 可填写，师兄端完全不可见）
model CareFollowup {
  id                  String   @id @default(cuid())
  studentId           String   // 被关怀的师兄 userId
  classId             String
  careWorkerId        String   // 关怀人 userId
  contactedAt         DateTime
  summary             String
  followUpStatus      String   @default("pending")
  // pending / resolved / escalated
  lagSnapshotAtContact Json?   // 关怀时该学员各维度掉队状态快照（记录「因何掉队而关怀」）
  // 结构同 CohortLagSnapshot：{ practiceLag, studyLag, attendanceLag, journalLag }
  // 填写时由后端从最新 CohortLagSnapshot 拷贝定格，事后名单变化不影响此历史值
  createdAt           DateTime @default(now())

  student    User  @relation("CareStudent",  fields: [studentId],  references: [id])
  careWorker User  @relation("CareWorker",   fields: [careWorkerId], references: [id])
  class      Class @relation(fields: [classId], references: [id])
}

// 掉队检测快照（每日凌晨定时任务重算；一人一行只存最新，computed state 与成员生命周期表解耦）
// 多维独立：四个维度各取一个 LagStatus，名单页分列展示，不加权汇总
// 仅对 cohortStatus=active 成员计算；paused/held_back/graduated/left 不入表（或定时清理）
// 对学员端完全不可见（无 API 返回）；仅 canViewStudents=true 的 ClassAdmin 可读
model CohortLagSnapshot {
  id            String    @id @default(cuid())
  classId       String
  studentId     String    // 被检测的师兄 userId
  practiceLag   LagStatus @default(on_track)  // 修持维度（近2周 PracticeLog 达标率）
  studyLag      LagStatus @default(on_track)  // 闻思维度（近2周答题 + StudyRecord 达标率）
  attendanceLag LagStatus @default(on_track)  // 出勤维度（近2周讲考/共修签到缺席数）
  journalLag    LagStatus @default(on_track)  // 日记维度（近2周 PracticeJournal 提交天数）
  detail        Json?     // 各维度明细：{ practice:{rate,target}, study:{...}, attendance:{absent}, journal:{days} }
  computedAt    DateTime  @default(now())

  class   Class @relation(fields: [classId], references: [id])
  student User  @relation(fields: [studentId], references: [id])

  @@unique([classId, studentId])  // 一人一行最新
  @@index([classId])              // 名单页按班查询
}
```

#### 班级动态（1 张）

```prisma
// 学修感想 / 班级动态（UI ⏸ 暂缓，DB + API 当前阶段预留）
// 互动：点赞 + 评论 + 站内转发（转发见 ClassPostShare）
// 删除权限：本人 或 ClassAdmin（canManageMembers=true）
// sharedFromId 非空时表示该帖是转发帖，内容来自原帖；UI 渲染时嵌入原帖预览
model ClassPost {
  id           String    @id @default(cuid())
  classId      String
  authorId     String
  content      String
  sharedFromId String?   // 站内转发来源 postId；null 表示原创帖
  isDeleted    Boolean   @default(false)
  deletedBy    String?   // 操作者 userId
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  class      Class              @relation(fields: [classId], references: [id])
  author     User               @relation(fields: [authorId], references: [id])
  sharedFrom ClassPost?         @relation("PostShares", fields: [sharedFromId], references: [id])
  reshares   ClassPost[]        @relation("PostShares")
  reactions  ClassPostReaction[]
  comments   ClassPostComment[]
  shares     ClassPostShare[]
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

// 站内转发记录（决策：站内转发；转发时创建 sharedFromId 非空的新 ClassPost，本表记录行为用于统计）
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

#### 权限控制（2 张）

```prisma
// 密法组（灌顶单位）：一次灌顶覆盖该修法的「法本 + 观修 + 念诵」一整套
// admin 管理；Course/Meditation/PracticeProject 通过 tantricGroupId 归组
model TantricGroup {
  id          String   @id @default(cuid())
  key         String   @unique // "guru_yoga" / "vajrasattva"
  name        String   // "上师瑜伽"
  description String?
  createdBy   String   // admin userId
  createdAt   DateTime @default(now())

  courses          Course[]
  meditations      Meditation[]
  practiceProjects PracticeProject[]
  grants           TantricAccessGrant[]
}

// 密法白名单（admin 直接 INSERT，无申请审批；按修法组授权 = 灌顶单位）
// 作用：控制学员能否访问密法内容（Course/Meditation/PracticeProject.isTantric=true）
// 授权判定：内容.tantricGroupId 在用户的 grants 中 → 可见；否则零痕迹过滤
// 管理端（主麦/辅导员/admin）无需授权即可查看所有密法数据
// 撤销后：历史打卡和愿记录保留，学员失去内容访问权
model TantricAccessGrant {
  id             String   @id @default(cuid())
  userId         String
  tantricGroupId String   // 按组授权（一次灌顶覆盖该组全部内容）
  grantedAt      DateTime @default(now())
  grantedBy      String   // admin userId

  user  User         @relation(fields: [userId], references: [id])
  group TantricGroup @relation(fields: [tantricGroupId], references: [id])

  @@unique([userId, tantricGroupId])
}
```

#### 汇总缓存（1 张）

```prisma
// 班级周修持汇总（每周日凌晨定时自动生成；主麦在管理端复制到 WhatsApp）
model CohortWeeklySummary {
  id            String   @id @default(cuid())
  classId       String
  weekStartDate DateTime // Class.timezone 所在地的周一日期
  weekEndDate   DateTime
  summaryData   Json     // 结构化汇总（见下方 summaryData 结构）
  generatedAt   DateTime @default(now())
  sharedAt      DateTime?  // 主麦点「复制」时写
  sharedBy      String?  // 管理员 userId

  class Class @relation(fields: [classId], references: [id])

  @@unique([classId, weekStartDate])
}
// summaryData JSON 结构：
//   practiceTotals: [{ projectName, totalCount, totalSessions }]  // 本周修持总量（按项目）
//   speakingAttend: Int    // 讲考出席人数
//   groupAttend:    Int    // 共修出席人数
//   currentLesson:  Int    // 本周该学到第几课（getCurrentLessonNumber）
//   activeCount:    Int    // 活跃人数
//   behindCount:    Int    // 掉队人数
//   journalCount:   Int    // 日记提交人数
// 生成方式：每周日凌晨定时任务，按各班 Class.timezone 判断"上一周"已结束后生成
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

-- 每周回向聚合视图（按 class_id 分组）
-- 学员端 /class/:id/dedication 仅消费班级级（WHERE class_id = :id）；全平台聚合 ⏸ 暂缓
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
  lagSnapshots         CohortLagSnapshot[]
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
  speakingRegistrations SpeakingRegistration[]
  speakingGrades       SpeakingGrade[]
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
  lagSnapshots         CohortLagSnapshot[]
  posts                ClassPost[]
  discussions          Discussion[]
  weeklySummaries      CohortWeeklySummary[]
  speakingSessions     SpeakingSession[]
}
```

#### `Lesson` 表新增反向关联

```prisma
model Lesson {
  // ... 现有字段 + 2.2 新增字段 ...
  classSessions        ClassSession[]
  speakingSessions     SpeakingSession[]
  studyRecords         StudyRecord[]
  contentChunks        ContentChunk[]
}
```

#### `Course` 表新增反向关联

```prisma
model Course {
  // ... 现有字段 + 2.2 新增字段（含 tantricGroup TantricGroup? 正向关联）...
  contentChunks        ContentChunk[]
  programWeekCourses   ProgramWeekCourse[]
  discussions          Discussion[]       // courseId? 可空，课时关联讨论
  // 注：密法授权改按修法组（TantricGroup），Course 不再直接持有 TantricAccessGrant[]
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

### 3.1 新增 API 模块（25 个）

| 模块 | 路由前缀 | 主要功能 |
|---|---|---|
| Programs | `/api/programs` | 科系 CRUD + 排表模板嵌套 CRUD（科目 ProgramSemester / 周 ProgramWeek / 周课程 ProgramWeekCourse / 周修法 ProgramWeekPractice / 打卡要求 ProgramStudyType）；admin 专属 |
| PlatformActivities | `/api/activities` | 首页药丸 summary + 活动中心聚合（平台级法会/共修/讲考）|
| CoachContext | `/api/coach/context` | 管理端 bootstrap：返回当前用户管理的班级 + 各班 flag（驱动 /coach 落地页 + 模块可见性 + 路由守卫）。admin → isAdmin=true，列全部班级、flag 全开；ClassAdmin → 列其记录、按 flag；都不是 → classes=[]（前端守卫重定向学员首页）|
| ClassAdmins | `/api/classes/:id/admins` | ClassAdmin RBAC 分配管理；**仅平台 admin**（requireRole('admin')），全权主麦也不能分配（决策：不加 canManageAdmins flag）|
| CohortRestWeeks | `/api/classes/:id/rest-weeks` | 班级休息周管理 |
| CurrentLesson | `/api/classes/:id/current-lesson` | 当前课时号查询（进度算法）|
| VowTemplates | `/api/practice-templates` | 修持模板管理（admin）|
| Vows | `/api/vows` | 修持愿 + 裸追踪项 CRUD（isPledged 区分）+ 状态机（仅 auto 重算）|
| VowLogs | `/api/vows/:id/logs` | 修持打卡（发愿/裸追踪共用；座次自动算）|
| VowPause | `/api/vows/:id/pause` + `/resume` | 愿暂停/恢复（自助，无审批）|
| StudyRecords | `/api/study-records` | 闻思打卡（App 内自助，需登录，校验时间窗口）|
| SpeakingSessions | `/api/classes/:id/speaking-sessions` + `/api/speaking-sessions` | 讲考场次管理（含生成签到 token）+ 学员报名 + 辅导员评分 |
| CheckIn | `/api/checkin/:token` | **公开端点（无需登录）** 签到链接页数据 + 提交；时间窗口校验 |
| PracticeJournals | `/api/journals` | 修持日记 CRUD（UI 嵌藏历日历，upsert 一天一篇）|
| SelfStudy | `/api/self-study` | 自学师兄科系学习管理（UserSelfStudyProgram + 个人休息周 + 自学进度算法）；读物走现有 Course/enrollment 接口 |
| Events | `/api/events` | 法会活动（admin CRUD）+ 学员端列表/详情/集体回向/打卡/发愿 |
| Appointments | `/api/appointments` | 约修创建/加入/关闭 ⏸ 暂缓（Phase 5：后端 API 先做，学员端 UI 暂缓）|
| CohortLag | `/api/classes/:id/lag` | 掉队名单读取（canViewStudents 专属）：返回 CohortLagSnapshot 多维状态，可按维度筛选/排序；学员端零返回 |
| CareFollowups | `/api/care-followups` | 关怀跟进（canCareFollowup=true 专属）：新建时后端从最新 CohortLagSnapshot 拷贝 lagSnapshotAtContact |
| TantricGroups | `/api/admin/tantric-groups` | 密法组 CRUD（灌顶单位，admin 专属）|
| TantricGrants | `/api/admin/tantric-grants` | 密法白名单按组授权 INSERT/DELETE（admin 专属）|
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
  响应：同上 + description + groupTotals（来自 v_event_dedication_totals，
        按 practiceProjectId 分组，字段名改为 groupTotals 对应「共修总量」语义）
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
  响应：EventCount + 更新后的 groupTotals（eventId 维度聚合）
  注：不写 PracticeLog，不影响日常修持愿；回向为法会结束后的纯 UI 仪式，此接口不触发回向

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

#### CheckIn 模块端点明细

```
POST /api/admin/sessions/:id/checkin-token
  生成或刷新本场次的签到 token（辅导员/admin 操作）
  sessionType query param: "speaking" | "group"
  响应：{ token, checkInUrl }

GET  /api/checkin/:token
  公开端点，无需登录
  先校验 token 对应场次时间窗口：
    · startAt > now → { status: 'not_started', startsAt }
    · sessionEndAt < now → { status: 'closed', endedAt }
    · 否则 → { status: 'open', sessionType, title, lessonTitle, isPlatform,
               members: [{id, name, studentId, programName, hasCheckedIn}] }
  成员列表来源：
    · classId 有值 → 该班活跃成员（原有逻辑）
    · classId = null（平台级）→ 全平台活跃学员；前端加搜索框 + 按科系筛选
  query param: ?programId=&search= （平台级场次用，班级场次忽略）

POST /api/checkin/:token
  公开端点，无需登录
  body: { userId }
  校验：
    1. 时间窗口（同上）
    2. 班级场次：userId 属于本班活跃成员
       平台级场次：userId 为任意活跃学员（isActive=true）
    3. 同一 userId 未重复打卡（StudyRecord @@unique 保障）
  写入 StudyRecord：
    · speaking session → studyType='speaking_pass', isConfirmed=true
    · group session    → studyType='group_attend',  isConfirmed=true
  打卡时间 = StudyRecord.createdAt（自动记录）
  响应：{ ok: true, checkedInAt }
```

#### PlatformActivities 模块端点明细

```
GET /api/activities/summary
  用于首页药丸卡片，聚合平台级活动（法会 Event + 平台级 ClassSession/SpeakingSession）
  仅统计 classId=null 的场次 + isActive=true 的法会
  响应：{
    top: { type: 'event'|'group'|'speaking', id, title, status, startAt } | null,
    totalCount,   // 进行中 + 即将开始的平台活动总数（角标用）
    isEmpty       // true 时药丸显示「平台活动」+ 日历图标
  }
  优先级：进行中法会 > 进行中共修/讲考 > 即将开始（按时间近）

GET /api/activities
  活动中心三 Tab 数据，按 type 分组返回
  query: type=event|group|speaking（默认全返回）, status=active|upcoming|past|all
  响应：{
    events:   [...] | undefined,   // 法会（同 GET /api/events）
    groups:   [...] | undefined,   // 平台级 ClassSession（classId=null）
    speakings:[...] | undefined    // 平台级 SpeakingSession（classId=null）
  }
  // 平台级共修/讲考的 App 内签到走 StudyRecords 模块（需登录）；
  // 签到链接（无需登录）走 CheckIn 模块；两者共用 StudyRecord @@unique 防重复
```

#### SpeakingSessions 模块端点明细（报名 + 评分）

```
// 学员报名端点（需登录）
POST /api/speaking-sessions/:id/register
  校验：session 存在 + sessionEndAt > now（未结束）
  写 SpeakingRegistration { speakingSessionId, userId }
  幂等：@@unique 约束，重复报名返回 200（不报错）
  响应：{ registered: true, registeredAt }

DELETE /api/speaking-sessions/:id/register
  取消报名；仅 sessionEndAt > now 时可取消
  删除对应 SpeakingRegistration 行
  响应：{ registered: false }

GET /api/speaking-sessions/:id/my-status
  响应：{ registered: boolean, checkedIn: boolean, grade: SpeakingGrade | null }
  grade 字段仅 sessionEndAt < now 后有值（辅导员已打分才显示）

// 辅导员评分端点（canManageExams 权限）
GET /api/classes/:classId/speaking-sessions/:id/registrations
  返回本班已报名且参与本场次的学员列表（含签到状态）
  仅列 classId 有值时 classId 匹配的班级成员（平台级场次则筛 classId 字段）
  响应：[{ userId, name, studentId, registered, checkedIn, grade }]

POST /api/classes/:classId/speaking-sessions/:id/grade
  body: { userId, score, comment? }
  score 取值：'pass' | 'fail' | 'excellent'
  权限：gradedBy 必须是本班 canManageExams 的 ClassAdmin（或 admin）
  写 SpeakingGrade（upsert：同一 session+user 只保留最新一条评分）
  后置：向被评分学员推送通知（通知模块，站内消息）
  响应：SpeakingGrade

// 学员历史记录端点（需登录）
GET /api/my/speaking-history
  query: page / limit（默认 20）
  返回当前用户参与过的所有讲考记录（含报名、签到、评分状态）
  用于「我的」页面讲考历史列表
  响应：[{ sessionId, title, lessonTitle, startAt, registered, checkedIn, grade }]
```

### 3.2 修改现有模块（7 个）

| 模块 | 改动内容 |
|---|---|
| `users` | 注册时自动生成 studentId；返回 learningMode / preferShowFaxin / timezone；accessibilityNeeds 校验 |
| `classes` | 创建/编辑支持 programId / startDate / city / timezone |
| `class-members` | 状态机操作（changeMemberStatus：pause/resume 学员自助+canManageMembers，held_back/graduate/leave 限 canManageMembers/admin，复活限 admin）；paused↔active 级联 source=auto 愿；isPrimary 切换事务（仅 active）；留级仅标记不转班 |
| `courses` | **所有学员侧查询加 isTantric 过滤**：未授权学员的任何 Course 查询排除密法；管理端不过滤 |
| `lessons` | 返回 sourceText 字段；关联 LessonResource ✅ Admin 端 LessonResource YouTube 管理 UI 已实现（AdminCoursesPage · commit ca0e975）|
| `answering` | open 题 payload.noScoring=true（思考题）时跳过 gradeOpenWithLlm，UserAnswer 只存答案；提交后返回 QuestionReference.referenceText |
| `question-references` | 新接口：admin 管理参考答案（CRUD）；师兄提交答案后解锁查看（GET 校验该题已有 UserAnswer）|

### 3.3 核心业务逻辑

#### 课程进度算法（TS 函数，非 SQL 函数）

```typescript
// 返回「本班当前周号」（effective week number），即排表 ProgramWeek.globalWeekNum 的索引。
// 无排表班：周号在「1周=1课」线性假设下等同当前课时号。
async function getCurrentLessonNumber(
  classId: string,
  targetDate: Date
): Promise<number> {
  const cls = await prisma.class.findUnique({ where: { id: classId } })
  if (!cls?.startDate) return 1

  // 手动覆盖优先：本班节奏与排表分叉时，辅导员锁定的周号直接返回（自动算停用）
  if (cls.currentWeekOverride != null) return cls.currentWeekOverride

  const startMonday = getMonday(cls.startDate)
  const targetMonday = getMonday(targetDate)
  const naturalWeeks = weeksBetween(startMonday, targetMonday) + 1

  // 只计算目标日期之前的休息周（当天及之后不算）—— 班级级临时休息
  const restWeeks = await prisma.cohortRestWeek.count({
    where: {
      classId,
      restStartDate: { lt: targetMonday }
    }
  })

  return Math.max(1, naturalWeeks - restWeeks)
}
// 验证：+2周无休息=第3周 ✓ | 中间1个休息周后+2周=第2周 ✓
// 周编号每班独立，从本班 startDate 起算，不跨班共享
// 升科目 = 主麦手动操作（需 canManageCourse=true），不自动触发
// 两层假期：科系统一假期 = ProgramWeek.isHoliday（排表预设，全科系班共享）；
//          单班临时休息 = CohortRestWeek（仅本班，自动算时减去）
```

#### 本周基准内容（排表驱动 · 新增）

```typescript
// 排表是「本周班级应学什么」的唯一真相源（喂基准线 + 喂掉队检测）；
// 学员实际阅读仍自由（走 LessonCompletion，不被排表锁课，符合「节奏感不强制」）。
async function getCurrentWeekContent(classId: string, targetDate: Date) {
  const cls = await prisma.class.findUnique({ where: { id: classId } })
  if (!cls?.programId || !cls.startDate) return null  // 未排表的班：无基准线，学员端不显示

  const weekNum = await getCurrentLessonNumber(classId, targetDate)  // 本班当前周号（含手动覆盖）

  const week = await prisma.programWeek.findUnique({
    where: { programId_globalWeekNum: { programId: cls.programId, globalWeekNum: weekNum } },
    include: {
      courses:   { include: { course: true }, orderBy: { displayOrder: 'asc' } }, // 本周法本 + 课时
      practices: { orderBy: { displayOrder: 'asc' } },                            // 本周修法
    }
  })
  if (!week) return { weekNum, beyondSchedule: true }   // 超出排表范围（科系排完）：无新基准
  if (week.isHoliday) return { weekNum, isHoliday: true } // 科系统一假期：本周无新内容

  return {
    weekNum,
    isHoliday: false,
    beyondSchedule: false,
    courses:   week.courses,    // 基准线：本周应学法本 + 课时号（学员进度条对照用）
    practices: week.practices,  // 本周应修的修法（92修法第几法等）
  }
}
// 学员端：课程页/阅读页顶部展示 courses[].lessonId 作为「本周班级进度：第 N 课」基准线
// 后端掉队检测：闻思维度「应完成」来自本周 courses；出勤维度「应打哪些卡」来自 ProgramStudyType
```

#### 成员状态机（CohortMemberStatus）

合法转换与发起方（应用层校验，非 DB 约束）：

| 从 → 到 | 发起方 | 数据效果 |
|---|---|---|
| active → paused | 学员自助 **或** canManageMembers | 写 statusChanged*；级联：该成员 source=auto 愿同步 paused（custom 愿不受影响） |
| paused → active | 学员自助 **或** canManageMembers | 写 statusChanged*；级联：source=auto 愿同步恢复 active |
| active/paused → held_back | canManageMembers / admin | heldBackCount+1，写 statusChanged*；历史数据原地保留只读；**转下一届班为手动**（在目标班手动加新 active 成员，系统不建关联） |
| active/paused → graduated | canManageMembers / admin | 写 graduatedAt + statusChanged*；历史只读 |
| active/paused → left | canManageMembers / admin | 写 statusChanged*（removedAt 旧字段兼容可一并写）；历史只读 |
| held_back/graduated/left → active | **仅 admin** | 重新激活（少见）；或更常见走「重新入班 = 新建 ClassMember」 |

```typescript
// 状态转换守卫（伪代码）
async function changeMemberStatus(
  member: ClassMember, to: CohortMemberStatus, actor: User, reason?: string
) {
  // 权限：paused/恢复 允许本人自助；其余需 canManageMembers 或 admin
  const selfServiceOk = (to === 'paused' || (member.cohortStatus === 'paused' && to === 'active'))
                        && actor.id === member.userId
  if (!selfServiceOk && !hasFlag(actor, member.classId, 'canManageMembers') && !isAdmin(actor))
    throw forbidden()
  // active 复活仅 admin
  if (['held_back','graduated','left'].includes(member.cohortStatus) && to === 'active' && !isAdmin(actor))
    throw forbidden()

  await prisma.$transaction(async (tx) => {
    await tx.classMember.update({ where: { id: member.id },
      data: { cohortStatus: to, statusChangedAt: now, statusChangedBy: actor.id,
              statusChangeReason: reason,
              ...(to === 'graduated' ? { graduatedAt: now } : {}),
              ...(to === 'held_back' ? { heldBackCount: { increment: 1 } } : {}) } })
    // 级联：成员 paused ↔ active 时，同步其 source=auto 愿（custom 愿/裸追踪不动）
    if (to === 'paused')
      await tx.userPracticeVow.updateMany({
        where: { userId: member.userId, classId: member.classId, source: 'auto', status: 'active' },
        data: { status: 'paused' } })
    if (to === 'active' && member.cohortStatus === 'paused')
      await tx.userPracticeVow.updateMany({
        where: { userId: member.userId, classId: member.classId, source: 'auto', status: 'paused' },
        data: { status: 'active' } })
  })
}
// 非 active 成员一律排除：掉队检测 / 班级排行 / 周汇总 / auto 愿管理列表
// 留级转下一届：无自动建成员，无 nextClassId 关联（决策：仅标记 + 手动转班）
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

#### Auto Vow 自动建愿（入班事务内调用）

**触发时机**：`POST /api/classes/:id/members` handler 内，与 `ClassMember` 创建在**同一 Prisma 事务**中执行。事务失败则双方同时回滚，保证原子性。

```typescript
// 调用方：class-members 模块的 addMember handler
// 事务保障：ClassMember 建立失败 → 愿不落库；愿建立失败 → ClassMember 回滚
async function createAutoVows(
  tx: PrismaTransaction,
  userId: string,
  classId: string
): Promise<void> {
  // 1. 查班级 startDate（计算愿的起修日期）
  const cls = await tx.class.findUnique({
    where: { id: classId },
    select: { startDate: true }
  })
  const classStart = cls?.startDate ?? new Date()   // 无 startDate 时退化为今天

  // 2. 查该班所有 binding='auto' 的模板绑定，按 displayOrder 排序
  const bindings = await tx.cohortRecommendedTemplate.findMany({
    where: { classId, binding: 'auto' },
    include: { template: true },
    orderBy: { displayOrder: 'asc' }
  })
  if (bindings.length === 0) return   // 无绑定模板：静默跳过，不报错

  // 3. 幂等保护：查已有 auto 愿，跳过已建过的模板（处理退班后重新入班）
  const existing = await tx.userPracticeVow.findMany({
    where: { userId, classId, source: 'auto' },
    select: { templateId: true }
  })
  const existingIds = new Set(existing.map(v => v.templateId).filter(Boolean))
  const toCreate = bindings.filter(b => !existingIds.has(b.templateId))
  if (toCreate.length === 0) return   // 全部已建过（重复入班场景），跳过

  // 4. 按模板字段构造愿数据
  const vowData = toCreate.map(({ template }) => {
    const startDate = addDays(classStart, template.startsOffsetDays ?? 0)
    const endDate   = template.durationDays
      ? addDays(startDate, template.durationDays)
      : null                          // null = 持续性愿（无截止日）
    return {
      userId,
      classId,
      source:            'auto'   as const,
      context:           'class'  as const,
      templateId:        template.id,
      practiceProjectId: template.practiceProjectId ?? undefined,
      isPledged:         true,        // auto 愿默认为正式发愿（非裸追踪）
      targetCount:       template.targetCount ?? undefined,
      targetPeriod:      template.targetPeriod,
      dailyTarget:       template.defaultDailyTarget ?? undefined,
      currentCount:      0,
      currentStatus:     'on_track' as const,
      startDate,
      endDate,
    }
  })

  await tx.userPracticeVow.createMany({ data: vowData })
}
```

**addMember handler 框架**（class-members 模块）：

```typescript
// POST /api/classes/:id/members
async function addMember(req, reply) {
  const { userId, isPrimary } = req.body

  const member = await prisma.$transaction(async (tx) => {
    // 若 isPrimary=true，先把该学员在其他班的 isPrimary 清掉（应用层保证唯一）
    if (isPrimary) {
      await tx.classMember.updateMany({
        where: { userId, isPrimary: true },
        data:  { isPrimary: false }
      })
    }

    // 建 ClassMember
    const member = await tx.classMember.create({
      data: {
        classId:      req.params.id,
        userId,
        cohortStatus: 'active',
        isPrimary:    isPrimary ?? false,
        joinedAt:     new Date(),
      }
    })

    // 同一事务内建 auto 愿（失败则整体回滚）
    await createAutoVows(tx, userId, req.params.id)

    return member
  })

  reply.send(member)
}
```

**边界情况一览**：

| 场景 | 行为 |
|---|---|
| 班级无绑定模板（`binding='auto'` 为空）| 静默跳过，不报错，ClassMember 正常创建 |
| 退班后重新入班（`cohortStatus: left → active`）| 幂等保护：已建过的 templateId 跳过，只为新增模板建愿 |
| 学员同时在多个班 | 每班独立建愿（classId 不同），互不影响 |
| `practiceProjectId` 为空 | 允许（裸追踪模板，修法项目由学员打卡时自选）|
| `createAutoVows` 抛出异常 | 事务整体回滚，ClassMember 不落库，接口返回 500 |
| `startsOffsetDays=null, durationDays=null` | startDate=classStart，endDate=null（持续性愿，最常见）|

> **注意**：`held_back → active`（重新激活）也可触发入班，但一般走「到目标班手动加新 ClassMember」，新成员创建同样会调用 `createAutoVows`，幂等逻辑保障不重复建愿。

#### 修持愿状态机（打卡后实时重算）

**重算触发点**（仅作用于 source=auto 班级愿；其他愿/裸追踪项跳过）：
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

  // ⚠️ 仅班级愿（source=auto）算状态：只有它们有辅导员管理、师兄端也不看此字段
  // personal/custom 愿 + 裸追踪项（isPledged=false）一律跳过，节省每次打卡的重算开销
  if (vow.source !== 'auto') return vow.currentStatus

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

**Event / Appointment 愿的状态生命周期（不走 recalcVowStatus）**：

`recalcVowStatus` 仅覆盖 `source=auto` 的班级愿。Event 和 Appointment 愿（`source='custom'`）使用以下独立规则，由**每日凌晨定时任务**维护：

| 时间条件 | 动作 |
|---|---|
| 现在 < event.startDate | status 保持 `on_track`（预发愿期，不做状态判断）|
| event.startDate ≤ 现在 ≤ event.endDate，且 currentCount ≥ targetCount | 标 `completed` |
| event.endDate < 现在（法会结束），不管是否完成目标 | 标 `completed`（法会已结束，愿自然收官）|
| 约修（context=appointment）endDate < 现在 | 同上：标 `completed` |

**UI 层不依赖 vow.currentStatus 展示法会愿进度**：
- 法会详情页直接读 `SUM(EventCount.count WHERE vowId=x)` 作为已完成量
- `vow.currentStatus` 字段对 event/appointment 愿仅用于辅导员端愿管理列表的状态筛选
- 师兄端不展示 event/appointment 愿的 currentStatus（与班级愿一致，currentStatus 不下发学员端）

**掉队检测**（独立系统，每日凌晨定时任务，写 `CohortLagSnapshot` 表）：
- 计算对象：班级内 `cohortStatus=active` 的每个学员（非单条愿；paused/留级/毕业/退班不计算）
- 存储：`CohortLagSnapshot`（一人一行最新，upsert by `@@unique([classId, studentId])`），与 `VowStatus` 完全独立
- **多维独立**：四个维度各自取一个 `LagStatus`，名单页分列展示，**不加权汇总**（不出"综合掉队分"）
- 状态级别：`on_track` / `slightly_behind` / `falling_behind` / `at_risk`
- 窗口：近 2 周（14 天，按 `Class.timezone` 切日）；阈值 ⏸ 上线前可配置

```typescript
// 每维度统一映射：rate = 实际 / 应达标；越低越掉队
function lagFromRate(rate: number): LagStatus {
  if (rate >= 0.9) return 'on_track'
  if (rate >= 0.7) return 'slightly_behind'
  if (rate >= 0.5) return 'falling_behind'
  return 'at_risk'
}

async function computeLagSnapshot(member: ClassMember): Promise<void> {
  // 排表驱动「应完成什么」：本周基准内容（含闻思应学课时）
  const wk = await getCurrentWeekContent(member.classId, now)  // 排表班才有；无排表班见下方降级
  // 科系打卡要求：本科系应打哪些卡（ProgramStudyType，仅后端消费）
  const studyTypes = await prisma.programStudyType.findMany({
    where: { programId: cls.programId, requirement: 'required' }
  })

  // 维度 1 修持：近2周 PracticeLog 达标天数 / 班级设定应打卡天数
  const practiceRate = practiceDaysHit / practiceDaysExpected
  // 维度 2 闻思：近2周 (答题数 + StudyRecord 数) / 排表本周基准应完成量（wk.courses 关联课时题量）
  //   无排表班降级：用线性「1周=1课」估算应完成量
  const studyRate    = studyDone / studyExpected
  // 维度 3 出勤：仅统计 ProgramStudyType.required 的场次类型（如加行必修讲考、净土必修共修）
  //   应到场次 = 近2周本科系 required 类型的场次数；无该类场次时该维度恒 on_track（rate=1）
  const attendRate   = sessionsExpected > 0 ? (sessionsExpected - absent) / sessionsExpected : 1
  // 维度 4 日记：近2周 PracticeJournal 提交天数 / 14
  const journalRate  = journalDays / 14

  await prisma.cohortLagSnapshot.upsert({
    where: { classId_studentId: { classId: member.classId, studentId: member.userId } },
    create/update: {
      practiceLag:   lagFromRate(practiceRate),
      studyLag:      lagFromRate(studyRate),
      attendanceLag: lagFromRate(attendRate),
      journalLag:    lagFromRate(journalRate),
      detail: { practice:{rate:practiceRate}, study:{rate:studyRate, baselineWeek:wk?.weekNum},
                attendance:{absent, expected:sessionsExpected, requiredTypes:studyTypes.map(t=>t.studyType)},
                journal:{days:journalDays} },
      computedAt: now,
    }
  })
}
// 注：at_risk 额外硬条件 —— 某维度近2周完全零记录时直接置 at_risk（rate 计算已覆盖：0/N=0）
// 注：进度乐观计入，未确认（isConfirmed=false）的打卡同样计入达标
// 注：闻思「应完成量」与出勤「应到场次类型」均来自排表 / ProgramStudyType —— 排表是检测基准源
```

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
  超级用户：role='admin' 直接放行（所有 flag 视为 true，任意班；决策：admin 是超级用户）
  否则验证 ClassAdmin 表中的 classId + userId 关系
  按路由需求检查对应 flag（canManageMembers / canEditGoals / canViewStudents 等）
  无记录或 flag=false → 403
  例外：成员 pause/resume 自身 membership 允许本人自助（不查 flag，见 changeMemberStatus）
  例外：RBAC 分配（ClassAdmins）不走本中间件，改用 requireRole('admin')（仅平台 admin）

tantric-filter.middleware.ts
  学员侧所有 Course / Meditation / PracticeProject 查询：
    isTantric=true 时，校验内容.tantricGroupId 是否在该用户的 TantricAccessGrant 组列表中
    不在 → 直接过滤（零痕迹）；按修法组授权（一次灌顶覆盖该组全部内容）
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

### 4.1 学员端新增页面（6 个）

> 注 1：修持愿与修持打卡**合并进现有 `/practice` 页**（见 §4.2 修学计数页改造），不再单设 `/vows` 独立页。
> 注 2：修持日记**嵌入藏历日历页 `/calendar`**（见 §4.2），不再单设 `/journals` 独立页。
> 注 3：自学读物**复用 Course，在闻思页展示**（见 §4.2 闻思页改造），不再单设 `/books` 独立页。

| 页面 | 路由 | 说明 |
|---|---|---|
| 每周回向 | `/class/:id/dedication` | **班级级**本周修持总量汇总（只显总数，不露个体）；**入口：班级页**；法会专项回向在 `/events/:id` 内展示 |
| 约修 | `/appointments` | 查看班级约修 + 加入 ⏸ 暂缓（Phase 5）|
| 活动中心 | `/events` | 3 Tab：法会 / 共修 / 讲考；每 Tab 内分 进行中 / 即将开始 / 往期；**入口：首页药丸卡片** |
| 法会详情 | `/events/:id` | 见下方详细设计 |
| 平台场次详情 | `/events/sessions/:id` | 平台级共修/讲考场次信息 + App 内签到入口（时间窗口内）|
| 签到链接页 | `/checkin/:token` | **无需登录**；显示场次信息 + 成员列表；学员点名字完成打卡；时间窗口外显示「未开始」或「已关闭」 |

#### 首页活动入口（药丸卡片）⚠️ 布局待定

替代原顶部「活动按钮 + 通知铃」两个圆按钮，合并为一个药丸卡片；通知移入「我的」。

> **设计决策（2026-05-26）**：布局和入口可能继续调整，当前方案暂定。

**布局变化：**
```
现状：[头像→我的]              [活动→/events] [🔔通知→/notifications]
新版：[头像→我的（挂未读红点）]  [═══ 药丸卡片：平台活动（自动轮播）═══]
      通知入口移入「我的」页面
```

**药丸卡片规则（已确认）：**
- 数据源：`GET /api/my/upcoming-events?within=10080`（7 天内，复用现有接口）
  - ⚠️ 待决策：后续是否单独实现 `GET /api/activities/summary` 仅返回平台级活动
- **自动轮播**（方案 A，已确认）：每 3 秒自动切换，文字淡出淡入（opacity 0.25s）
  - 多活动时用户被动感知，无需手动操作
- 优先级排序：进行中法会 > 进行中共修/讲考 > 即将开始（按时间近）
- 角标总数常驻右侧（`·³`），空状态不显示角标
- 空状态（无任何平台活动）：显示「📅 平台活动」，**常驻不隐藏**（点进去是往期列表）
- 点击 → 统一跳 `/events` 活动中心

**各状态显示示例：**
```
进行中法会  → 🪷 极乐法会 · 进行中
进行中共修  → 📿 周日共修 · 进行中
今天有活动  → 📿 共修 · 今天 18:00
未来某天    → 🪷 法会 · 6月1日
无活动      → 📅 平台活动
```

**通知降级补偿（已确认）：**
- 通知入口移入「我的」页面（ProfilePage 已有此入口，无需新增）
- 首页头像挂未读红点 badge（`useUnreadNotifCount`），用户进首页即知有未读

#### 活动中心页（`/events`）

3 个 Tab，平台级活动统一容器（**班级级共修/讲考不在此，仍在班级页「共修安排」卡**）：

| Tab | 数据源 | 卡片动作 |
|---|---|---|
| 法会 | Event + EventCount | 回向计数（见法会详情设计）|
| 共修 | 平台级 ClassSession（classId=null）| 签到出勤 → 场次详情 |
| 讲考 | 平台级 SpeakingSession（classId=null）| 签到出勤 → 场次详情 |

每个 Tab 内三分区：进行中 / 即将开始 / 往期。

**法会 Tab 三分区：**

| 分区 | 数据条件 | 排序 | 卡片内容 |
|---|---|---|---|
| 正在进行 | `startDate ≤ 今天 ≤ endDate` | startDate asc | 封面图 + 标题 + 藏历日期 + 「还剩 N 天」倒计时 + 橙色「参与」按钮 |
| 即将开始 | `startDate > 今天` | startDate asc | 同上，按钮文案改为「预发愿」 |
| 往期法会 | `endDate < 今天` | endDate desc | 折叠态；展开后纯列表：标题 + 日期区间 + 参与人数 |

**共修 Tab 三分区：**

| 分区 | 数据条件 | 排序 | 卡片内容 |
|---|---|---|---|
| 进行中 | `startAt ≤ now ≤ sessionEndAt` | startAt asc | 标题 + 课时 + 时间窗口 + 「去签到」按钮（App 内签到）|
| 即将开始 | `startAt > now` | startAt asc | 标题 + 课时 + 开始时间 + 「设提醒」|
| 往期 | `sessionEndAt < now` | startAt desc | 折叠态；标题 + 日期 + 我的出勤状态 |

**讲考 Tab 三分区（卡片状态机，依赖 `/api/speaking-sessions/:id/my-status`）：**

| 分区 | 数据条件 | 我的状态 | 按钮 |
|---|---|---|---|
| 即将开始 | `startAt > now` | 未报名 | 「报名」（主色按钮）|
| 即将开始 | `startAt > now` | 已报名 | 「已报名 ✓」（次要按钮，可点击取消报名）|
| 进行中 | `startAt ≤ now ≤ sessionEndAt` | 已报名 + 未签到 | 「去签到」（链接或 App 内）|
| 进行中 | `startAt ≤ now ≤ sessionEndAt` | 已签到 | 「已签到 ✓」（不可操作）|
| 进行中 | `startAt ≤ now ≤ sessionEndAt` | 未报名 | 「旁听报名」（次要按钮，报名后可签到）|
| 往期 | `sessionEndAt < now` | 有签到 + 待评分 | 「待评分」（信息 badge，灰色）|
| 往期 | `sessionEndAt < now` | 有评分 | 「查看结果」（可点击，弹 Sheet 展示评分）|
| 往期 | `sessionEndAt < now` | 未签到 | 仅显示日期 + 「未参与」标签 |

**查看结果 Sheet 内容（往期讲考卡片点击触发）：**
- 讲考场次标题 + 日期
- 评分：通过 / 不通过 / 优秀（对应 pass / fail / excellent，大字显示）
- 评语：辅导员文字评语（无评语时不显示此区块）
- 辅导员姓名 + 评分日期（小字）

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

**区块 2：共修总量**
- 按 `practiceProjectId` 分组，每项显示：修法名 + 遍数合计 + 参与人数
- 示例：「上师瑜伽 · 共 12,450 遍 · 38 人参与」
- 数据来源：`v_event_dedication_totals` 视图（只显聚合总量，不透露个人）
- 进行中时 30 秒轮询刷新；已结束时静态展示（最终总量，供回向时参考）

**区块 3：我的参与（状态机）**

| 用户状态 | 区块展示 | 可用操作 |
|---|---|---|
| 法会未开始，无愿 | 「发法会愿」按钮 | 发愿（提前建愿）；打卡按钮不可用 |
| 法会未开始，有愿 | 愿进度条（0 / 目标量）| 同上 |
| 进行中，未提交 | 两个并排按钮 | 「发法会愿」/ 「去打卡」|
| 进行中，有愿 | 愿进度条（已完成 / 目标量）+ 按钮 | 「去打卡」|
| 进行中，无愿 | 「已提交 N 次，合计 X 遍」| 「继续打卡」|
| 已结束，有提交记录 | 我的最终总量：X 遍 | 「回向」按钮（仅法会结束后出现）|
| 已结束，无提交记录 | 「此法会已结束」| 无操作按钮 |

**即将开始时**：「发法会愿」按钮正常可用（`vow.startDate = event.startDate`，提前建愿）；「去打卡」按钮不可用（tooltip 提示）。

**计数提交 Sheet（进行中时，区块 3 内联）：**
- 点击「去打卡」/ 「继续打卡」→ 底部 Sheet 弹出（桌面用 centered Dialog，见 CSS-GOTCHAS.md §7）
- Sheet 内容：
  - 修法项目选择（有法会愿时 pre-fill 愿的 practiceProjectId，可修改）
  - 遍数输入（Int，必填；法会计数以遍数为单位，不记时长/座次）
  - 提交 → 写 `EventCount { eventId, userId, practiceProjectId, count, vowId（自动）}`
  - 提交成功 → Sheet 关闭，区块 2 共修总量实时 +N 动效；**不弹回向**
- ⚠️ 此提交不写 PracticeLog，不影响日常修持愿，与学修计数模块完全隔离

**回向 Sheet（仅法会已结束时，区块 3 内联）：**
- 点击「回向」→ 底部 Sheet 弹出（桌面用 centered Dialog）
- Sheet 内容：
  - 此次法会共修总量展示（来自区块 2 最终数据）
  - 固定回向文字（前端常量）
  - 「完成回向」按钮 → Sheet 关闭
- preferShowFaxin=false 时「回向」按钮不显示（三殊胜框架总开关）
- 回向为纯 UI 仪式，**不写 DB**（计数已在 EventCount，无需新表）

**发愿 Sheet（区块 3 内联）：**
- 点击「发法会愿」→ 底部 Sheet 弹出
- Sheet 内容：
  - 修法项目选择
  - 目标量输入（targetPeriod 固定为 `lifetime`，整个法会期间完成）
  - startDate 只读显示（= event.startDate 或 today，取较大值）
  - 提交 → 写 `UserPracticeVow { context: 'event', eventId, source: 'custom' }`
  - 提交成功 → 状态切换到「有愿」状态

### 4.2 学员端修改页面（10 个）

| 页面 | 改动 |
|---|---|
| 首页 | 顶部「活动按钮 + 通知铃」合并为药丸卡片（显示平台法会/共修/讲考，常驻）；通知入口移入「我的」；头像挂未读红点 badge 补偿；点击药丸跳 `/events` 活动中心 |
| 修学计数页 `/practice` | **改造为统一修学中枢**（合并修持愿 + 修持打卡）；见下方详细设计 |
| 藏历日历页 `/calendar` | **嵌入每日修持日记**（PracticeJournal）；点某天 → 藏历信息 + 当天日记查看/编写；见下方详细设计 |
| 闻思页 `/courses` | 自学读物（Course category=self_study_book）与法本同页展示，可按 category 分组；复用现有阅读器/报名/进度 |
| 课程详情 | 多讲者 LessonResource 展示；按 Class.timezone 显示共修时间；「已学完/已听完/已看完」确认按钮（见下方流程）；**显示班级进度基准线**（见下方）|
| 课程阅读页 | **顶部显示本周班级进度**（"本周该学到第 N 课"，来自 getCurrentWeekContent 排表驱动；假期/超范围则不显示）；自学师兄按个人 startDate 算 |
| 打卡记录 | 讲考 3 选 1 UI；共修出席/缺席 UI；审核锁定状态显示 |
| 思考题 | open 题型关闭 AI 评分（noScoring）；写下思考 → 提交 → 显示参考答案自行对照；双入口：法本课时末尾「思考题」区 + QuizPage 答题流 |
| 个人设置 | 三殊胜框架开关（preferShowFaxin，控制发心语 + 回向 Sheet）；timezone 选择；学习模式（learningMode）；班级学习暂停/恢复自助（cohortStatus active↔paused，级联 auto 愿）|
| 「我的」页面（ProfilePage）| 新增「讲考记录」入口 → 列表页（复用 `/api/my/speaking-history` 数据）；每条显示场次标题 + 日期 + 评分结果 badge；点击展开评语详情 |

#### 班级进度基准线展示（Feature 11 · 双模式学习 + 排表驱动）

```
跟班学员（learningMode=class/both）：
  课程页/阅读页顶部 → "本周班级进度：第 N 课"
  基准来源：getCurrentWeekContent(classId, today)（排表驱动）
    有排表 → courses[].lessonId 即本周应学课时（基准线）+ practices 本周应修
    科系统一假期（week.isHoliday）→ 显示"本周休息"
    超出排表范围（beyondSchedule）/ 未排表班 → 不显示基准线
  周号 N = getCurrentLessonNumber（startDate - 休息周；辅导员手动覆盖优先）
  对比个人 lessonsCompleted → 提示"你在第 M 课"（落后/同步/超前）

自学师兄（learningMode=self_study/both）：
  同一周号算法，但用 UserSelfStudyProgram.startDate + 个人休息周（UserSelfStudyRestWeek）
  排表查询同样按科系 ProgramWeek（自学走个人起修日定位周号）

both 模式：班级科系按班级基准线，自学科系按个人基准线，两条独立展示
进度仅作"节奏感"提示，不强制（排表不锁课，学员可自由超前/落后阅读）
掉队检测在后台（辅导员端，学员不可见状态），基准源同为排表 / ProgramStudyType
```

#### 藏历日历页嵌入日记（`/calendar` · Feature 10）

```
点日历某天
  → 上半：藏历信息（TibetanDay：藏历日期 / 节日 / 吉日，现有）
  → 下半：当天修持日记（PracticeJournal）
      有日记 → 显示内容 + 编辑按钮
      无日记 → 「写今日修持感想」入口
  → 编辑：文本 + 可见性开关（private / visible_to_coach）
  → 保存 → upsert PracticeJournal（@@unique userId+journalDate 保障一天一篇）
journalDate = 所选日历日按 User.timezone 取本地日期
```

- 唯一反思载体：打卡反思已移除，所有修持感想统一写当天日记
- visible_to_coach 的日记 → 辅导员端「学员修行数据」可见（需 canViewStudents）

#### 修学计数页改造（`/practice` 统一中枢 · Feature 9）

合并修持愿与修持打卡为一页，旧 `/practice` 升级，不新设 `/vows`。

**页面结构（上下两区块）：**

```
KPI 卡（今日 / streak / 本周 / 累计）
  实时从 PracticeLog 按 User.timezone 聚合（PracticeDailySummary 停更）

区块 ① 班级修学愿（source=auto）
  - 来源：入班按 PracticeTemplate 自动建愿，用户不可增删
  - 每条：愿名 + 进度条（按 targetPeriod 取主目标）+「去打卡」
  - 用户只能调每日目标量（节奏自主）；到期日由辅导员管（canEditGoals）
  - currentStatus 不下发给师兄端

区块 ② 我的修学（source=custom，用户自建）
  - 列出 isPledged=true（发愿，带进度条）+ isPledged=false（裸追踪项，仅累计数）
  - 「+ 添加修学」按钮见下方创建流程
  - 全部用户自管（增删改）
```

**创建流程（+ 添加修学）：**

```
+ 添加修学
  → 选修法项目（PracticeProject，如金刚萨埵心咒）
  → 计量方式由项目决定（遍数 / 时长座次）
  → [开关] 我要为此发愿？
      关 → 建 UserPracticeVow{ source=custom, context=personal, isPledged=false, target 全 null }
            = 裸追踪项，进我的修学列表，打卡只累计数
      开 → 填主目标（按 targetPeriod：lifetime 填 targetCount / daily 填 dailyTarget / weekly 填 weeklyTarget）
            + 到期日（可选）
            → 建 UserPracticeVow{ source=custom, context=personal, isPledged=true }
            = 发愿，带进度条
  → 保存
```

**打卡流程（点「去打卡」/ 裸追踪项的 + 号）：**

```
preferShowFaxin=true → 先显示发心语

  → practiceProjectId 来源（PracticeLog.practiceProjectId 为 DB 非空约束，必须填入）：
      vow.practiceProjectId 有值 → 预填修法项目（仅展示，不可修改）
      vow.practiceProjectId 为空 → 弹项目选择器（必填，不可跳过提交）

  → 输入遍数 / 时长（座次自动算：≥30min=1, ≥15min=0.5）

  → 提交 → 写 PracticeLog {
        vowId:             vow.id,          // 裸追踪/发愿均填，非 null
        practiceProjectId: <上述规则确定>,  // DB 非空，必填
        count/durationMinutes/sessionCount,
        logDate:           now()            // UTC；显示层按 User.timezone 转换
     }
  → 乐观更新 vow.currentCount / currentSessionCount
  → source=auto 愿才触发 recalcVowStatus

preferShowFaxin=true → 打卡成功弹回向 Sheet
```

> ⚠️ 裸打卡也挂在一条 isPledged=false 的 vow 上（vowId 非 null），与"无锚点的纯 PracticeLog"区别：
> 旧设计 vowId=null 表示日常裸打卡；合并后裸打卡统一有锚点 vow（isPledged=false），
> vowId=null 仅保留给"完全临时、不进列表"的一次性计数（如法会随喜外的散修，可选保留或弃用）。

#### 学修确认完成流程（Feature 6）

```
用户点击确认按钮（已读完 / 已听完 / 已看完 / 完成观修）
  → 后端 upsert LessonCompletion（重复点只更新 completedAt）
  → preferShowFaxin=true：弹回向 Sheet
      内容：固定回向文字（前端常量）+ 「已回向」按钮
      用户点「已回向」→ Sheet 关闭
    preferShowFaxin=false：直接关闭，无 Sheet
  → 回到原页面，现有页面导航接管（例：读法本页面底部「进入观修」入口依然可见）

下一环节推导：沿用现有页面导航设计
  读法本页  → ReadingBottomNav 已有「进入观修」入口（如该课时有关联 Meditation）
  观修页    → MeditationPlayerPage 完成后返回课程
  各页底部  → 思考题入口 + 下一课入口（已有）
  无需新增 next-step API，前端现有导航结构覆盖
```

**观修完成触发说明：**
- 进度 ≥ 80% → 系统自动写 `LessonCompletion(type=meditation)`，触发回向 Sheet（若 preferShowFaxin=true）
- 手动点「完成观修」按钮 → 同上触发（兜底，不依赖进度）
- 两条路径均 upsert，不重复写入

### 4.3 管理端（/coach/*）新增页面（4 个）

```
/coach/                            落地页：此人管理的班级列表
/coach/:classId/                   班级首页（仅显示有权限的模块）
/coach/:classId/members            canManageMembers（留级/毕业/退班 + 代操作暂停/恢复；学员自助暂停在学员端 /profile）
/coach/:classId/exams              canManageExams（讲考场次管理 + 报名名单查看 + 评分录入）
/coach/:classId/students           canViewStudents（学员修行数据 + 掉队名单）
/coach/:classId/care               canCareFollowup（关怀跟进记录）
/coach/:classId/goals              canEditGoals（愿每日目标量）
/coach/:classId/course             canManageCourse（法本切换/升科目/手动设本班当前周 currentWeekOverride，手动操作）
```

无权限的模块：前端不渲染（隐藏），后端 API 也守卫（双重保障，三端分离铁律不变）。

#### /coach/* 架构（路由守卫 + bootstrap + 三端分离）

```
入口（决策：无显式入口）
  学员端无任何「管理」按钮（守护铁律：学员端永远是学员视图）
  ClassAdmin / admin 直接访问 /coach URL 进入；不知道的人看不到入口

bootstrap（进入 /coach/* 时）
  GET /api/coach/context → { isAdmin, classes:[{classId, className, flags{6 个}}] }
  classes 为空（既非 ClassAdmin 也非 admin）→ 前端守卫 redirect 到 /（学员首页）

CoachLayout（包裹所有 /coach/* 路由，与学员端 / Admin 端布局完全隔离）
  路由守卫 RequireCoach：context.classes 为空 → 踢回学员首页
  /coach/        落地页：渲染 context.classes 列表（多班各自卡片，点进切班）
  /coach/:classId/  班级首页：只渲染 flags=true 的模块磁贴（admin → 全开）
  /coach/:classId/:module  进入前校验该班对应 flag；无权 → 隐藏/403

admin 超级用户（决策）
  context.isAdmin=true → classes 列全部班级、6 个 flag 全 true
  后端 class-admin.middleware 对 role='admin' 直接放行（见 §3.4）
  admin 无需被分配 ClassAdmin 记录即可管理任意班

三端分离铁律（CLAUDE.md）
  学员端组件**绝不** import /coach 组件（曾在 ClassDetailPage 泄露管理操作，commit 1507921 清除）
  后端每个 /coach API 挂 class-admin.middleware（按 flag）；双重保障
  辅导员若也是本班学员：学员数据 / 掉队名单**包含其本人**（决策：显示自己）；
    其个人修学在学员端 /practice 照常，两端数据同源不互斥
```

| 页面 | 说明 |
|---|---|
| 成员状态管理 | 批量操作：代操作暂停/恢复 + 留级/毕业/退班 + 原因填写；留级仅标记（heldBackCount+1），转下一届班为手动（到目标班手动加新成员）；需 canManageMembers |
| 掉队名单 | 读 CohortLagSnapshot；四维度（修持/闻思/出勤/日记）分列展示，可按任一维度筛选/排序；查看 detail 明细；一键发起关怀（带入当前快照）；需 canViewStudents |
| 修持愿管理 | 查看本班 auto 愿；修改到期日/每日目标量；需 canEditGoals |
| 班级周汇总 | 展示定时任务自动生成的本周汇总；一键复制到 WhatsApp（写 sharedAt/sharedBy）；需 canViewStudents |

#### 修持愿管理页详细（`/coach/:classId/goals` · Feature 14）

```
可见范围（严格）：
  仅 source=auto 的班级愿（PracticeTemplate 派生）
  ❌ 个人 custom 愿 + 裸追踪项（source=custom）完全不可见，私有

列表：本班学员 × 各自的 auto 愿
  每行：学员名 + 修法项目 + 进度（currentCount/目标）+ currentStatus（7态，仅此页可见）
  可按 currentStatus 筛选/排序（will_overdue / at_risk 优先）

可改字段（canEditGoals）：
  - currentEndDate 到期日 → 改后自动 recalcVowStatus + 写 AuditLog
  - dailyTarget 每日目标量 → 师兄自己也能改（节奏自主），管理员改写 paceHistory + AuditLog
  - statusNote 状态备注（如"出差中，落后正常"，仅管理端可见）

不做：审核打卡（审核中心已砍）；个人愿干预
```

> 打卡审核：已砍。签到自助免审、修持打卡乐观计入，无审核环节（见 §4.3 移除 canAuditPractice）。

### 4.4 Admin 端新增页面（8 个）

| 页面 | 说明 |
|---|---|
| 科系管理 | Program CRUD（code 唯一）+ 科目/周排表（周排课程+修法+假期标记）+ 打卡要求 ProgramStudyType 配置 |
| 修持模板管理 | PracticeTemplate CRUD + 班级绑定 |
| 密法组 + 授权管理 | TantricGroup CRUD（灌顶单位）+ 内容归组 + 按组授权 INSERT/DELETE ⏸ 暂缓（Phase 5：后台先做）|
| 班级休息周 | CohortRestWeek 管理；实时预览课程进度效果 |
| 参考答案管理 | QuestionReference CRUD（一题一份）；师兄提交答案即解锁查看（无需先发布；未整理则显示「待整理」）|
| 法会活动管理 | Event CRUD（法会回向依赖）+ 藏历日期展示字段 |
| 自学师兄管理 | 全局查看自学进度；修改 status |
| ClassAdmin 权限分配 | `/admin/classes/:id/admins`：搜索用户 → 逐 flag 勾选 → 保存 |

### 4.5 无新增表的纯前端/后端逻辑（5 个）

| 功能 | 实现方式 |
|---|---|
| 打卡报数文本生成 | 打卡后从 PracticeLog 组装文字，复制到剪贴板；密法参与报数 |
| 批量补录 | 多选课时 → 批量 POST 写入 LessonCompletion；无次数限制 |
| 三殊胜框架（发心语 + 回向）| preferShowFaxin=true 时：修持打卡（PracticeLog）前显示发心语；内容完成（LessonCompletion read/audio/video/meditation）后弹回向 Sheet；文案配置在前端常量；无新增表 |
| 掉队检测计算 | 后端每日凌晨定时任务，多维独立（修持/闻思/出勤/日记）upsert 写 CohortLagSnapshot（一人一行最新），与 VowStatus 独立 |

---

## 五、业务规则与权限约束

> 使用应用层中间件实现，不依赖数据库 RLS。

### 权限红线（18 条）

| 规则 | 实现 |
|---|---|
| 师兄只能看自己的愿 | API：`where userId = req.user.id` |
| 跨班师兄互不可见愿 | API：验证 classId 归属 |
| 管理员看本班 auto 愿，不看 custom 愿 | API：`where source='auto' AND classId IN (...)` |
| 管理员不能跨班操作 | 中间件：验证 ClassAdmin 记录 |
| 密法零痕迹（学员侧）| 所有学员侧 Course/Meditation/PracticeProject 查询：isTantric=true 且内容.tantricGroupId 不在用户授权组中 → 过滤 |
| 关怀记录对学员不可见 | CareFollowup 路由：仅 canCareFollowup=true 可访问 |
| 掉队状态对学员不可见 | CohortLagSnapshot 无任何学员端入口；CohortLag API 仅 canViewStudents=true 可读；Vow API 学员端响应亦不返回 currentStatus 字段 |
| 法会字段写权限限 admin | 中间件：admin 路由 `requireRole('admin')`；学员侧只有 GET 端点，无 POST/PUT/DELETE |
| 讨论话题创建权限 | 应用层：创建/关闭前查 ClassAdmin 记录（任意 flag）或 role='admin'；投票/评论不做额外校验（班级成员身份由 ClassMember 已保障）|
| 讨论一人一票 | DB：`@@unique([discussionId, userId])`；换投：应用层先删旧票再插新票 |
| 签到时间窗口 | 后端：`now < session.startAt → 403 未开始`；`now > session.sessionEndAt → 403 已关闭`；公开端点同样校验 |
| 签到防重复 | DB：StudyRecord `@@unique([classSessionId, userId, studyType])` 保障；重复提交返回 409 |
| 签到 token 作用域 | 班级场次：userId 须属于本班活跃成员；平台级场次：任意活跃学员均可；token 不过期，由操作人手动刷新 |
| 平台级场次创建权限 | ClassSession / SpeakingSession 的 classId=null 仅 admin 可设；classId 有值时 admin 或 canManageExams 均可 |
| 成员状态转换权限 | 应用层 changeMemberStatus：pause/resume 允许本人自助（actor=member.userId）或 canManageMembers；held_back/graduate/leave 限 canManageMembers/admin；复活（→active）限 admin |
| RBAC 分配仅 admin | ClassAdmins 路由 `requireRole('admin')`；ClassAdmin flag（含全权主麦）均无分配权；不设 canManageAdmins flag |
| /coach 访问守卫 | 前端 RequireCoach：/api/coach/context.classes 为空 → redirect 学员首页；学员端无管理入口（无显式入口） |
| admin 超级用户 | role='admin' 在 class-admin.middleware 直接放行（所有 flag 视为 true、任意班）；CoachContext 对 admin 返回全部班级 + flag 全开 |

### 数据完整性约束（10 条）

| 规则 | 实现 |
|---|---|
| 同一时刻只有一个主班 | 事务：先 `isPrimary=false`（全班），再 `isPrimary=true`（新主班）|
| 92修法打卡建议关联第几法 | Zod schema：meditationId 可空，但 seriesKey='92xiufa' 时建议不为空 |
| 讲考三选一互斥 | DB：`@@unique([classSessionId, userId, studyType])`；应用层校验 studyType 为讲考类之一（speaking_pass/speaking_fail/speaking_absent） |
| 共修出席/缺席二选一 | DB：`@@unique([classSessionId, userId, studyType])`；应用层校验 studyType 为共修类之一（group_attend/group_absent） |
| 每日日记一人一天一篇 | DB：`@@unique([userId, journalDate])` |
| 学号全局唯一 | DB：`studentId @unique` |
| isPublic 仅限 personal/appointment 愿 | Zod schema：context=class 或 context=event 时强制 isPublic=false，忽略传入值 |
| 同一讲考一人只能报名一次 | DB：`SpeakingRegistration @@unique([speakingSessionId, userId])`；幂等写入（重复报名返回 200 不报错）|
| 同一讲考一人只有一条评分 | DB：`SpeakingGrade @@unique([speakingSessionId, userId])`；upsert 语义（辅导员可改分）|
| 讲考报名截止：session 未结束时才可报名/取消 | 应用层：POST/DELETE register 前校验 `sessionEndAt > now`，超时返回 403 |

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
| 未授权该组学员 | ❌ 零痕迹（列表/搜索/关联全过滤）| ❌ | ❌ |
| 已授权该组学员（TantricAccessGrant 含该 tantricGroupId）| ✅ | ✅ 自己的 | ✅ 自己的 |
| 管理员（任何 flag）| ✅ 始终可见 | ✅ 全班 | ✅ 全班 |
| Admin | ✅ 全平台 | ✅ 全平台 | ✅ 全平台 |

**密法计数规则**：
- ✅ 密法打卡计入集体回向
- ✅ 密法打卡参与打卡报数生成
- ✅ 密法打卡计入个人愿进度

---

## 六、Migration 策略

### 原则

- **开发阶段清洁重建**：无生产数据约束，直接删除冗余表，不做"只增不删"保守策略（见 §十）
- **两层分离**：先跑结构 migration（建表 / 删表 / 字段扩展），再跑数据种子脚本
- **按 Phase 顺序跑**：每层 migration 完成后运行 `npx prisma validate` 和现有功能冒烟测试，验证无回归再继续

### 第一层：结构 Migration（按顺序执行）

```
migration_001_lesson_resources.sql    ✅ 已跑 · 建 LessonResource / LessonMediaChapter / LessonTextBlock 3 张表
migration_001_add_enums.sql           新增 8 个枚举（含 LagStatus）
migration_002_extend_user.sql         User 加 6 个字段
migration_003_extend_class.sql        Class 加 5 个字段（programId / startDate / city / timezone / currentWeekOverride）
migration_004_extend_classmember.sql  ClassMember 加 7 个字段
migration_005_extend_course.sql       Course 加 5 个字段（author + isTantric + programSemesterId + category + tantricGroupId）
migration_006_extend_lesson.sql       Lesson 加 1 个字段（sourceText）
migration_007_extend_classsession.sql ClassSession 加 3 个字段（lessonId / sessionEndAt / checkInToken）+ classId 改可空（ALTER COLUMN classId DROP NOT NULL）
                                      ⚠️ 改可空前须全量审计现有 JOIN 查询，将 INNER JOIN classes 改为 LEFT JOIN 或加 WHERE classId IS NOT NULL
migration_008_extend_meditation.sql   Meditation 加 4 个字段（seriesKey/seriesNumber/isTantric/tantricGroupId）
migration_009_extend_practice.sql     PracticeProject 加 3 个字段（isTantric / tantricGroupId / categoryId）
                                      + SpeakingSession 加 startAt / sessionEndAt / checkInToken 字段，classId 改可空
migration_009b_pgvector.sql           启用 pgvector 扩展（CREATE EXTENSION IF NOT EXISTS vector）
                                      ⚠️ 需与 migration_009 分开：pgvector 是 DB 扩展操作，不属于 schema 变更
migration_010_delete_old_tables.sql   DROP 6 张冗余表（开发阶段清洁删除）：
                                        DROP TABLE IF EXISTS "PracticeMakeup" CASCADE;
                                        DROP TABLE IF EXISTS "PracticeDailySummary" CASCADE;
                                        DROP TABLE IF EXISTS "PracticeEntry" CASCADE;
                                        DROP TABLE IF EXISTS "PracticeGoal" CASCADE;
                                        DROP TABLE IF EXISTS "PracticeTask" CASCADE;
                                        DROP TABLE IF EXISTS "DharmaAssembly" CASCADE;
                                      顺序：先删有 FK 依赖的子表（PracticeMakeup → PracticeDailySummary → PracticeEntry），再删父表
                                      CASCADE 处理残余 FK 引用
migration_011_new_tables.sql          建 45 张新表（含 SpeakingRegistration / SpeakingGrade）
                                        · Event 表含 DharmaAssembly 迁入字段：tibetanDate / isGlobal / timezone
                                        · UserPracticeVow 含 endDate DateTime?（区间愿）
                                        · 含 EventCount / CareFollowup / CohortLagSnapshot / ClassPost 系列 /
                                          Discussion 系列 / AI 助手 5 张 / TantricGroup 等
migration_012_views.sql               建 3 个 SQL 视图：
                                        · v_event_dedication_totals（法会回向聚合）
                                        · v_weekly_dedication_totals（每周回向聚合）
                                        · v_practice_daily（物化视图，替代 PracticeDailySummary；含 UNIQUE INDEX）
```

### 第二层：数据 Migration（一次性脚本，按顺序执行）

```
seed_001_programs.ts         录入科系种子数据（加行/净土/入行论等）
seed_002_class_admins.ts     ClassMember.role='coach' 数据 → ClassAdmin（canManageCourse + canViewStudents 等全部 true）
seed_003_self_study_books.ts 18 本《大学演讲系列》录为 Course（category=self_study_book）+ 章节课时
seed_004_student_ids.ts      为现有用户批量生成 studentId（按注册时间排序）
                             ⚠️ 必须在开放新用户注册之前执行
```

### 注意事项

- `removedAt` 字段保留（字段本身不删，不影响 schema），新退班用 `cohortStatus='left'`
- `ClassMember.role='coach'` 字段保留（字段本身不删），但权限管理转移到 `ClassAdmin` 表；字段不再作为任何鉴权判断
- `PracticeEntry` · `PracticeTask` · `PracticeGoal` · `PracticeDailySummary` · `PracticeMakeup`：**全部删除**（migration_010）；新修持系统全走 `UserPracticeVow / PracticeLog`（见 §十）
- `DharmaAssembly`：**删除**（migration_010）；法会功能全走 `Event`（`type='dharma_assembly'`）
- `v_practice_daily` 物化视图需 cron 每 15 分钟刷新（`REFRESH MATERIALIZED VIEW CONCURRENTLY`）；排行榜读视图，今日 KPI 卡读实时 `PracticeLog`
- 密法 migration 不需要额外操作：`isTantric` 默认 `false`，现有数据默认非密法
- `UserCourseEnrollment` 上的 `selfStudyStartDate/selfStudyPace/selfStudyStatus` 三字段**不添加**（自学功能走 `UserSelfStudyProgram`）

---

## 七、分阶段实施计划

### Phase 1 · 基础架构（建议先做）

**目标**：打地基，本阶段完成后现有功能不受影响

| 任务 | 类型 |
|---|---|
| 跑 Migration 第一层（结构，12 个文件：migration_001~012，其中 migration_001_lesson_resources 已跑）| DB |
| 录入科系种子数据（Program）| DB |
| ClassAdmin 数据迁移（coach → RBAC flags 全开）| DB |
| 密法零痕迹中间件（所有学员侧 Course/Meditation 查询加过滤）| 后端 |
| 班级管理：timezone / programId / startDate 字段支持（admin 建班）| 后端+前端 |
| ClassAdmin RBAC 权限分配 UI（/admin/classes/:id/admins）| 前端 Admin |

### Phase 2 · 闻思打卡系统

| 任务 | 类型 |
|---|---|
| StudyRecord API（讲考+共修，App 内自助，含时间窗口校验）| 后端 |
| SpeakingSession API（场次管理 + 生成签到 token）| 后端 |
| SpeakingRegistration / SpeakingGrade 表含在 migration_011_new_tables | DB |
| 讲考报名 API（POST/DELETE `/api/speaking-sessions/:id/register`）| 后端 |
| 讲考评分 API（POST `/api/classes/:id/speaking-sessions/:id/grade`）| 后端 |
| 讲考历史 API（GET `/api/my/speaking-history`）| 后端 |
| CheckIn API（公开端点：GET + POST `/api/checkin/:token`）| 后端 |
| SpeakingSession.startAt / checkInToken 字段，classId 改可空（含在 migration_009）| DB |
| ClassSession.checkInToken 字段，classId 改可空（migration）| DB |
| LessonCompletion API（轻量听/读/观修完成标记，含批量补录）| 后端 |
| 讲考/共修打卡 UI（学员端 App 内）| 前端 |
| 签到链接页（`/checkin/:token`，无需登录）| 前端 |
| 「已学完」轻量按钮（课程详情页）| 前端 |

### Phase 3 · 修持愿系统

| 任务 | 类型 |
|---|---|
| PracticeTemplate API（admin）| 后端 |
| UserPracticeVow API（isPledged 区分发愿/裸追踪）+ 状态机（仅 source=auto 重算）| 后端 |
| PracticeLog API + 座次计算 | 后端 |
| KPI/streak 实时聚合（PracticeLog 按 User.timezone；PracticeDailySummary 停更）| 后端 |
| v_practice_daily 物化视图 + 刷新 cron（每 15 分钟 `REFRESH MATERIALIZED VIEW CONCURRENTLY`；排行榜读视图，KPI 读实时 PracticeLog）| 后端 |
| 愿暂停/恢复 | 后端 |
| 每日定时任务（愿状态重算：will_overdue/at_risk 按日推进，仅 source=auto；event/appointment 愿到期自动标 completed）| 后端 |
| 成员状态机 API（changeMemberStatus：5 态转换 + 权限守卫 + paused↔active 级联 source=auto 愿；留级仅标记）| 后端 |
| CoachContext API（/api/coach/context：管理班级 + flag；admin 超级用户全开）+ class-admin.middleware admin 放行 | 后端 |
| /coach 架构基座（CoachLayout + RequireCoach 守卫 + 落地页切班 + flag 驱动模块磁贴；无显式入口）| 前端 |
| 成员状态管理页（/coach/:classId/members，canManageMembers：代操作暂停/恢复 + 留级/毕业/退班 + 原因）| 前端 |
| 学员自助暂停/恢复（/profile，cohortStatus active↔paused，级联 auto 愿）| 前端 |
| `/practice` 统一中枢改造（班级愿区 + 我的修学区 + 添加修学 + 打卡 Sheet）| 前端 |
| 修持打卡 UI + 发心语 + 回向（合并进 /practice）| 前端 |
| 修持愿管理（管理端）| 前端 |

### Phase 4 · 双模式学习

| 任务 | 类型 |
|---|---|
| 课程进度算法（getCurrentLessonNumber 返回周号，支持 currentWeekOverride 手动覆盖；班级版 + 自学个人版）| 后端 |
| getCurrentWeekContent（排表驱动「本周基准内容」读取：周号 → ProgramWeek → 课程/修法；含假期/超范围降级）| 后端 |
| Class.currentWeekOverride 字段 + 辅导员手动设当前周（/coach course，canManageCourse）| 后端+前端 |
| CurrentLesson API（`/api/classes/:id/current-lesson`，返回周号 + 本周基准内容）| 后端 |
| CohortRestWeek API + UserSelfStudyRestWeek | 后端 |
| UserSelfStudyProgram API（自学科系报名 + 进度）| 后端 |
| Course.category 字段 + 18 本读物录为 Course（seed）| DB |
| learningMode 字段支持（个人设置切换）| 后端+前端 |
| 班级进度基准线展示（课程页/阅读页顶部"本周第 N 课"，排表驱动；排表数据待 Phase 6 录入后生效）| 前端 |
| 闻思页自学读物分组展示（category=self_study_book）| 前端 |
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
| PlatformActivities API（/api/activities summary + 活动中心聚合）| 后端 |
| 平台级共修/讲考场次发起（ClassSession/SpeakingSession classId=null，仅 admin）| 后端 |
| 活动中心页 `/events`（3 Tab：法会/共修/讲考）| 前端 |
| 法会详情页 `/events/:id`（含计数提交 Sheet + 回向 Sheet + 发愿 Sheet）| 前端 |
| 平台场次详情页 `/events/sessions/:id`（App 内签到入口）| 前端 |
| 首页活动药丸卡片 + 通知移入「我的」+ 头像未读红点 | 前端 |
| 每周回向页面 `/class/:id/dedication`（班级级，入口班级页）| 前端 |
| 藏历日历嵌入修持日记 `/calendar` + PracticeJournals API | 前端+后端 |
| CohortLagSnapshot 表（migration_010 含）+ 掉队检测定时任务（每日凌晨，多维独立写快照，仅 active 成员）| 后端 |
| CohortLag API（`/api/classes/:id/lag` 掉队名单读取，canViewStudents 专属，学员端零返回）| 后端 |
| 关怀跟进 API（canCareFollowup 专属；新建时拷贝最新 CohortLagSnapshot 到 lagSnapshotAtContact）| 后端 |
| 约修自动关闭定时任务（每日凌晨，过期 active 约修置 expired + 关联愿 paused）| 后端 |
| 约修 API（创建/加入/关闭）| 后端 |
| 班级周汇总定时生成（每周日凌晨，按班级时区）+ 复制接口（API 规格见下方）| 后端 |
| 关怀跟进页面（管理端，canCareFollowup；可见学员各维度掉队状态 + 历史关怀记录）| 前端 |
| 掉队名单（管理端，canViewStudents；四维度分列展示 + 按维度筛选/排序 → 一键发起关怀）| 前端 |
| 约修页面（学员端）⏸ 暂缓（后续 Phase）| ⏸ |
| TantricGroup + TantricGrants API（密法组 CRUD + 内容归组 + 按组授权）| 后端 |
| 密法组 + 授权管理 Admin 后台 ⏸ 暂缓（Phase 5，后台先做）| ⏸ |

#### 班级周汇总 API 规格

```
GET  /api/classes/:id/weekly-summary
  权限：canViewStudents=true
  行为：返回最新一条 CohortWeeklySummary（weekStartDate 最大的那条）
  响应：{ weekStartDate, weekEndDate, summaryData, sharedAt, sharedBy }

GET  /api/classes/:id/weekly-summary/history
  权限：canViewStudents=true
  行为：返回最近 N 周汇总列表（分页，默认 page=1 size=12）

POST /api/classes/:id/weekly-summary/share
  权限：canViewStudents=true（任意可见数据的管理员均可触发复制）
  行为：更新 sharedAt = now()，sharedBy = req.user.id；返回 copyText（见下方格式）
  响应：{ copyText: string }
```

**copyText 格式（一键复制到 WhatsApp）**：

```
🙏 [班级名] 本周修学汇报（第 N 课 · M月D日-M月D日）

📿 本周修持
  [项目名]：共 X 遍 / X 座
  [项目名]：共 X 遍
  ...（按 practiceTotals 逐项列出）

📚 本周闻思
  共修出席：N 人   讲考出席：N 人

📔 修持日记：N 人提交

活跃师兄：N 人 | 掉队提示：N 人

#觉学 #[班级名]
```

> 格式为前端拼接（后端只返回 summaryData 结构 + weekStartDate/End，前端按固定模板 render copyText）；`POST /share` 写 sharedAt 并返回已 render 好的 copyText，前端直接复制到剪贴板。

### Phase 6 · 内容与排表

| 任务 | 类型 |
|---|---|
| 排表模板录入 CRUD（5 张表，嵌套于 /api/programs：科目/周/周课程/周修法/打卡要求）| 后端 |
| 科系排表编辑 UI（Admin：科系 → 科目 → 周 → 每周排课程+修法+假期标记）| 前端 Admin |
| LessonResource API（YouTube 链接 + audio/video · GET/POST/DELETE）✅ 已实现 | 后端 |
| LessonResource 音频/视频文件上传（OSS · type=audio/video）⏸ 暂缓 | 后端 |
| LessonMediaChapter API（章节标记 · C/D 模式）⏸ 暂缓 | 后端 |
| LessonTextBlock API（段落同步 · B/C 模式）⏸ 暂缓 | 后端 |
| 参考答案 QuestionReference API（admin CRUD + 提交后解锁查看）| 后端 |
| answering 模块改造：open 题 noScoring 跳过 AI 评分 | 后端 |
| 课程详情多讲者展示（学员端）| 前端 |
| 思考题 UI（写思考 → 提交 → 对照参考答案；法本课时末尾 + QuizPage 双入口）| 前端 |
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
| PracticeEntry / PracticeTask / PracticeGoal / PracticeDailySummary / PracticeMakeup 保留 | ✅ **决策逆转（见 §十）**：开发阶段，全部删除；新修持系统全走 UserPracticeVow / PracticeLog |
| 裸打卡补发愿（追溯历史）| 不支持；发愿须新建 isPledged=true 的愿，历史裸打卡不关联 |
| PracticeLog.reflection 打卡反思 | 移除；反思统一写当日 PracticeJournal（藏历日历内），单一载体 |
| 修持日记独立页 /journals | 不单设；嵌入藏历日历页 /calendar |
| UserCourseEnrollment.selfStudy* 三字段 | 自学走 UserSelfStudyProgram（科系级），字段重复废弃 |
| PracticeProject.scope 在新系统使用 | 历史包袱；新愿归属完全由 UserPracticeVow 表达 |
| ClassAdminRole 枚举（zhumai/aixin）| 改为 RBAC flags，admin 后台细粒度分配 |
| 班级间「下一届」关联（nextClassId 等）| 留级仅标记 held_back，转下一届班为手动操作，系统不建班级关联 |
| canManageAdmins flag（主麦分配下级）| RBAC 分配仅平台 admin，全权主麦也不能分配 |
| 留级自动建下一届成员 | 仅标记 + 手动转班（辅导员/admin 在目标班手动加新 active 成员）|
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
| 历史数据强删（PracticeEntry 等）| ✅ **决策逆转（见 §十）**：项目处于开发阶段，无生产数据，冗余表直接删除合并 |

---

## 九、现有功能保留清单

以下所有现有表和功能**保持原样**，不受影响：

**认证与安全**：`AuthSession` · `PasswordResetToken` · `EmailVerificationToken` · `DeletedEmail`

**学习内容**：`Note` · `Highlight` · `NoteReport` · `LessonReadingProgress`（继续记录滚动进度）

**题目系统**（14 种题型全部保留，AI 评分全部保留）：`Sm2Card` · `UserFavorite` · `UserMistakeBook` · `QuestionReport`

**藏历与法会**：`TibetanDay`（`DharmaAssembly` 已并入 `Event` 表，见 §十）

**观修**：`Meditation`（新增 3 字段，其余保留）· `MeditationSession`（保留，继续驱动班级观修排行）

**AI 功能**：`LlmProviderConfig` · `LlmProviderUsage` · `LlmScenarioConfig` · `LlmPromptTemplate` · `LlmCallLog`

**现有修持记录**：`PracticeCategory` · `PracticeProject`（新增 `categoryId` 字段，其余保留）
（`PracticeEntry` · `PracticeDailySummary` · `PracticeGoal` · `PracticeTask` · `PracticeMakeup` 已删除，见 §十）

**班级管理**：`ClassAnnouncement` · `HomePoster`

**通知系统**：`NotificationPreference` · `PushSubscription` · `Notification` · `NotificationDispatchLog` · `NotificationRule`

**用户成就**：`UserAchievementUnlock` · `SystemAnnouncement`

**运营支撑**：`AuditLog` · `ErrorLog` · `SystemSetting` · `ContentSeed` · `ContentRelease` · `Experiment` · `ExperimentExposure` · `Feedback` · `OrphanedFile` · `AnalyticsEvent`

---

## 十、优化方案（开发阶段·合并重构计划）

### 背景与决策依据

项目处于**开发阶段（无生产数据）**。原设计中"扩展不重建 / 保留历史数据 / 旧表并存"策略是为已上线系统制定的迁移安全边界，在开发阶段该约束不成立。

**决策**：对冗余表和功能采用**合并替换**（直接删除 + 迁移）策略，不做并存过渡。

理由：
- 并存方案需在代码层维护两套读写逻辑，技术债大
- 开发阶段可执行清洁 Prisma migration（无需 `migrate resolve`）
- 新功能代码本来就需要重写相关模块，净额外工作量约 20%

---

### 一、Schema 变更摘要

#### 1.1 删除的表（6 张）

| 表名 | 原用途 | 替代方案 |
|---|---|---|
| `PracticeTask` | 固定任务（系统分配） | `UserPracticeVow`（`isPledged=false, source=auto, endDate` 支持区间）|
| `PracticeGoal` | 目标设定（用户自填） | `UserPracticeVow`（`isPledged=true`）|
| `PracticeEntry` | 打卡记录 | `PracticeLog` |
| `PracticeDailySummary` | 日汇总（快速聚合） | 物化视图 `v_practice_daily` + 索引 |
| `PracticeMakeup` | 补签记录 | `PracticeLog`（`source='makeup'`，配额逻辑保留）|
| `DharmaAssembly` | 法会（独立表） | `Event`（`type='dharma_assembly'`）|

#### 1.2 扩展的现有表（字段新增）

| 表名 | 新增字段 | 原因 |
|---|---|---|
| `UserPracticeVow` | `endDate DateTime?` | 支持固定区间愿（如"闭关 7 天持咒 10 万"）|
| `PracticeProject` | `categoryId String?` (FK→PracticeCategory) | 支持按科目筛选排行榜 |
| `ClassSession` | `classId` 改为 `classId String?`（可空）| 法会场次无需绑定班级 |

#### 1.3 保留不动的表

`PracticeCategory` · `PracticeProject` · `MeditationSession` · `LessonReadingProgress` · `ClassAnnouncement` · 认证表 · AI 表 · 题目表 · 通知表 · 成就表 · 运营支撑表（完整列表见 §九）

---

### 二、修持系统功能对接

#### 2.1 连签（streak）计算移植

**旧实现**：读 `PracticeDailySummary.count > 0`，90 天窗口，`PracticeMakeup` 行计入天数。

**新实现**（基于 `PracticeLog`）：

```typescript
// 以 User.timezone 为边界划天，连续有记录（含 source='makeup'）的天数
//
// 规则：
//   · 第一行允许是「今天」或「昨天」—— 今天还没打卡时从昨天算起，不断连
//   · 第一行之后必须严格连续，每行恰好是上一行的前一天（不允许跳过任何一天）
//   · 补签行（source='makeup'）天数自动计入（WHERE 不过滤 source）
async function calcStreak(userId: string, tz: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ logDay: string }[]>`
    SELECT DISTINCT
      (logDate AT TIME ZONE ${tz})::date AS "logDay"
    FROM "PracticeLog"
    WHERE "userId" = ${userId}
    ORDER BY "logDay" DESC
    LIMIT 90
  `
  if (rows.length === 0) return 0

  const todayStr     = toLocalDateStr(new Date(), tz)   // e.g. "2026-05-26"
  const yesterdayStr = dayBefore(todayStr)               // e.g. "2026-05-25"

  // 第一行必须是今天或昨天，否则已断签（streak=0）
  const firstDay = rows[0].logDay
  if (firstDay !== todayStr && firstDay !== yesterdayStr) return 0

  // 从第一行起，往后逐行严格校验：rows[i] 必须恰好是 rows[i-1] 的前一天
  let streak = 1
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].logDay === dayBefore(rows[i - 1].logDay)) {
      streak++
    } else {
      break   // 出现缺口，停止计数
    }
  }
  return streak
}
```

**正确性验证（4 个 case）**：

| 场景 | rows（DESC）| 期望 streak | 算法结果 |
|---|---|---|---|
| 今天已打卡，连续3天 | `[05-26, 05-25, 05-24]` | 3 | ✅ 3 |
| 今天未打卡，昨天连续3天 | `[05-25, 05-24, 05-23]` | 3 | ✅ 3 |
| 中间有缺口（05-24 缺失）| `[05-25, 05-23]` | 1 | ✅ 1（旧算法错误返回 2）|
| 最近一次打卡在2天前 | `[05-24, 05-23]` | 0 | ✅ 0 |

补签行（`source='makeup'`）自动计入，无需特殊处理（`WHERE` 条件不过滤 source）。

#### 2.2 补签配额移植

**旧实现**：`PracticeMakeup` 表，每周 ET 配额 1 次，Serializable 事务防并发。

**新实现**（基于 `PracticeLog`）：

- 补签写入：`PracticeLog.source = 'makeup'`，`logDate` 指向补签**目标日期**（非提交日期）
- 补签窗口：`logDate ≥ today - 7 days`（按 `User.timezone` 计算）
- 配额检查：查当前 ET 周内 `source='makeup'` 的行数 ≥ 1 则拒绝

```typescript
// 补签配额检查（事务内执行，Serializable 隔离级别）
const makeupThisWeek = await tx.practiceLog.count({
  where: {
    userId,
    source: 'makeup',
    createdAt: { gte: startOfEasternWeek() }   // ET 周一 00:00
  }
})
if (makeupThisWeek >= 1) throw new ForbiddenError('本周补签配额已用')
```

#### 2.3 固定区间愿（`UserPracticeVow.endDate`）

| 字段 | 值 | 含义 |
|---|---|---|
| `endDate = null` | 持续性愿 | 无结束时间，愿一直有效 |
| `endDate` 有值 | 区间愿 | 达到 endDate 后 cron 自动标 `status='completed'` |

区间愿进度 = `[vow.startDate, vow.endDate]` 内的 `PracticeLog` 累加。

#### 2.4 科目排行筛选

查询路径：`PracticeLog → PracticeProject.categoryId → PracticeCategory.key`

```sql
-- 按科目 key 过滤排行（?categoryKey= 参数）
SELECT pl."userId", SUM(pl."count") AS total
FROM "PracticeLog" pl
JOIN "PracticeProject" pp ON pp.id = pl."practiceProjectId"
JOIN "PracticeCategory" pc ON pc.id = pp."categoryId"
WHERE pc.key = $1
  AND pl."logDate" >= $2
GROUP BY pl."userId"
ORDER BY total DESC
```

`PracticeProject.categoryId` 字段通过 §一 字段扩展（新增 1 字段）已涵盖。

#### 2.5 O(1) 排行聚合（替代 PracticeDailySummary）

新建物化视图 `v_practice_daily`（通过 migration `$executeRaw` 创建，不是 Prisma 管理的表）：

```sql
CREATE MATERIALIZED VIEW v_practice_daily AS
SELECT
  pl."userId",
  pl."practiceProjectId",
  (pl."logDate" AT TIME ZONE u.timezone)::date AS "logDay",
  SUM(pl."count")           AS "totalCount",
  SUM(pl."durationMinutes") AS "totalMinutes"
FROM "PracticeLog" pl
JOIN "User" u ON u.id = pl."userId"
GROUP BY pl."userId", pl."practiceProjectId", "logDay";

CREATE UNIQUE INDEX ON v_practice_daily ("userId", "practiceProjectId", "logDay");
```

刷新策略：
- 排行榜读视图（允许 15 分钟延迟）
- 今日 KPI 卡读实时 `PracticeLog`（不读视图）
- `REFRESH MATERIALIZED VIEW CONCURRENTLY v_practice_daily` 每 15 分钟 cron 执行

---

### 三、DharmaAssembly → Event 迁移

| 步骤 | 操作 |
|---|---|
| 1 | `EventType` 枚举新增 `dharma_assembly` 值 |
| 2 | `Event` 新增独有字段：`tibetanDate String?` · `timezone String` · `isGlobal Boolean @default(false)` |
| 3 | 后端 `dharma-assemblies/` 模块重写为 `events/` 子路由（`/api/events?type=dharma_assembly`）|
| 4 | 前端 `AssemblyDetailPage` 迁移为 `EventDetailPage`（复用 EventsPage 现有 kind 合并逻辑）|
| 5 | Migration DROP `"DharmaAssembly"` 表 |
| 6 | 删除旧模块目录 `backend/src/modules/dharma-assemblies/` |

> 前端 `EventsPage` 已合并展示 ClassSession + DharmaAssembly（via kind discriminator）。迁移后数据来源从两张表过滤为一张表，改动量小。

---

### 四、Coach RBAC 替换

| 步骤 | 操作 |
|---|---|
| 1 | `ClassAdmin` 表（9 个 flags）替换 `ClassMember.role='coach'` 作为鉴权依据 |
| 2 | 后端所有 `/api/classes/:id/*` coach 路由改用 `ClassAdmin` flags 做 permission check |
| 3 | `seed_002`：将现有 `ClassMember.role='coach'` 数据写入 `ClassAdmin`（默认全部 flags=true）|
| 4 | 前端 `/coach/*` 页面从 `CoachContext` API 读 flags，不再读 `ClassMember.role` |
| 5 | `ClassMember.role` 字段保留不删（历史兼容），但不再作为任何鉴权判断 |

---

### 五、代码影响范围

| 模块 | 操作 | 文件数估算 |
|---|---|---|
| `practice/`（student + makeup + ranking） | 重写 | ~9 文件 |
| `dharma-assemblies/` | 删除，迁至 events/ | ~4 文件 |
| `class-members/` + `classes/` | ClassAdmin flags 接入 | ~3 文件 |
| `classes/sessions/` | classId null guard + 字段扩展 | ~2 文件 |
| 前端 `/coach/*` 页面 | RBAC guard 接入 | ~8 页面 |
| 前端 EventsPage / AssemblyDetailPage | DharmaAssembly 迁移 | ~2 页面 |
| `prisma/schema.prisma` | 删表 + 扩展 + 新 43 张表 | 1 文件 |
| Migrations | 清洁 rebuild | ~15 个 migration 文件 |

**合计**：约 44 个文件，大部分与新功能开发工作重叠，净额外工作量约 20% 增量。

---

### 六、迁移执行策略（开发阶段清洁 rebuild）

开发阶段无需 `prisma migrate resolve --applied` 技巧，直接：

```bash
# 方案 A：重置整库（推荐，开发阶段首选）
npx prisma migrate reset   # 清空所有表 + 重跑全部 migration

# 方案 B：追加 migration（保留现有数据）
npx prisma migrate dev --name "consolidate_practice_tables"
npx prisma migrate dev --name "merge_dharma_assembly_to_event"
npx prisma migrate dev --name "add_vow_end_date_and_project_category"
```

§六 Migration 计划中"旧库首次切换说明"仅适用于上线后追加，开发阶段忽略。

---

*本文档为所有决策确认后的最终版，DESIGN_DECISIONS.md 为决策过程记录，两者共同构成完整的设计依据。*
