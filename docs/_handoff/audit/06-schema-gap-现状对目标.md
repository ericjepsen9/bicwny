# 06 · Schema 现状↔目标 逐表差异清单

> 生成：2026-06-02
> 现状源：`backend/prisma/schema.prisma`（`grep -c "^model"` = **60 model / 19 enum**）
> 目标源：`decisions/08-merged-design.md`（设计 69 张表）
> 依据：DR-130（幻影表全量体检）/DR-118/119（反向核对净资产）/DR-122（实修域改造映射）
> 用途：给开发/新 PM 看「哪些线上已有、哪些要建、哪些幻影、哪些废弃」，比文档口径更直接指导排期。

---

## 一、线上 60 表的命运（现状 → 目标）

### A · 复用净资产（48 张·字段基本不改，新设计直接沿用）

> 线上目前是轻量「法本学习+答题+打卡」App，大半表是成熟净资产，新设计保留。

| 域 | 表（线上已有，沿用）|
|---|---|
| 学习引擎（16）| Chapter · Lesson · LessonTextBlock · LessonMediaChapter · LessonResource · LessonReadingProgress · Question · UserAnswer · Sm2Card · UserFavorite · UserMistakeBook · UserAchievementUnlock · Note · NoteReport · Highlight · QuestionReport |
| 观修/打卡字典（4）| Meditation · PracticeProject · PracticeCategory · PracticeMakeup |
| 账户/会话（3）| AuthSession · EmailVerificationToken · PasswordResetToken |
| 通知（5）| Notification · NotificationDispatchLog · NotificationPreference · NotificationRule · PushSubscription |
| 运营内容（4）| TibetanDay · HomePoster · DharmaAssembly · SystemAnnouncement |
| LLM 网关（5）| LlmCallLog · LlmProviderUsage · LlmPromptTemplate · LlmProviderConfig · LlmScenarioConfig |
| 平台/运维（10）| AnalyticsEvent · ErrorLog · SystemSetting · OrphanedFile · DeletedEmail · ContentSeed · ContentRelease · Experiment · ExperimentExposure · Feedback |
| 班级公告（1）| ClassAnnouncement（单向公告，与能力 22 双向社交并存，DR-119）|

### B · 扩展（5 张·线上已有，加字段）

| 表 | 加什么 | DR |
|---|---|---|
| `User` | birthDate（60 岁豁免）/ gender / phone（短信）/ primaryProgramId（主修偏好）| DR-120/132/136 |
| `Class` | 归档三件套 status/archivedAt/archivedBy（D19）| — |
| `Course` | courseType（entry/formal/restricted）| DR-93 |
| `ClassMember` | cohortStatus（active/paused/held_back/graduated/left）等 | — |
| `ClassSession` | sessionType（online/offline/self_study）/ scheduleId（课表关联）| DR-21 拆两层 |

### C · 改造（4 张·线上已有，重构/语义变）

| 表 | 改造 | DR |
|---|---|---|
| `PracticeEntry` → **`PracticeLog`** | rename + 加列（vowId/durationMinutes/meditationId/prayerCount/programId/taskSourceType；source 值域 tap/shake/bulk → in_app/external/ai_assistant）| DR-121/122/144 |
| `UserCourseEnrollment` | 课程级完成语义**废弃**，完成记录迁 LessonCompletion（机制统一，TODO-24）| DR-113/127 |
| `AuditLog` | 扩展为统一高权限操作台账（operatorId/actionType×11/targetType/payload/scope…，已 §3.11 封板）| DR-118 |
| `MeditationSession` | 看视频排行保留，但观修计入升学改走 PracticeLog（口径分离）| DR-111 |

### D · 废弃（3 张·折叠/归并/删除，不入目标 schema）

| 表 | 去向 | DR |
|---|---|---|
| `PracticeGoal` | 折叠进 UserPracticeVow（dailyTarget/weeklyTarget）| DR-122 |
| `PracticeTask` | 改造归并进 ClassTask（班级任务体系）| DR-122 |
| `PracticeDailySummary` | 废（班级排行改 PracticeLog 实时算+缓存）| DR-122 |

> 小计：**48 复用 + 5 扩展 + 4 改造 + 3 废弃 = 60**（全部线上 model 有归宿）。

---

## 二、要新建的表（线上没有·从零建——这是真实工作量）

> ⚠️ **DR-130 核心真相**：08 早期把很多表标「复用」，grep 线上发现是**幻影表**（线上根本没有）。下列即"线上 0、要从零建"的表，**远多于 08「新建区 20 张」的表象**。佛学院学修管理的**主体**（专业/讲考/升学/报数/关怀/传承/角色/周排课）线上全无。

| 域 | 要新建的表 | 来源 |
|---|---|---|
| 专业体系 | Program · ProgramSemester · ProgramWeek · ProgramWeekCourse · ProgramWeekPractice · ProgramStudyType · ProgramAdvancementConfig | §三 + DR-130 幻影 |
| 角色权限 | UserRoleAssignment · RoleAssignmentHistory · AssistantAssignment | §二替换 + §三 |
| 升学/报数 | AdvancementCheck · AdvancementRecord · SemesterSnapshot · ReportConfession | §三 |
| 考试/讲考 | Exam · ExamGrade · SpeakingSession · SpeakingRegistration · SpeakingGrade | DR-130 幻影 |
| 入班/留级 | ClassInviteCode · EnrollmentStatusHistory · LeaveRequest | §三 |
| 关怀/特殊 | StudentSpecialStatus · CareWatchlistItem · CareFollowupRecord · CohortLagSnapshot | §二替换 + §三 |
| 传承 | TransmissionRecord | §二替换 |
| 排课/任务 | ClassSessionSchedule · ClassTask · StudyRecord（出勤）· CohortRestWeek · CohortWeeklySummary · CohortRecommendedTemplate | §三 + DR-130 幻影 |
| 实修（改造新建）| UserPracticeVow · PracticeLog · PracticeTemplate | DR-121/123 |
| 闻思/课程 | LessonCompletion · QuestionReference | DR-129 + 幻影 |
| 短信 | SmsLog | DR-139 |
| 自学 | UserSelfStudyProgram | DR-145（转必做）|
| 社交 ⏸（建表+后台·不做 UI）| ClassPost · ClassPostReaction · ClassPostComment · ClassPostShare · Discussion · DiscussionViewpoint · DiscussionVote · DiscussionComment · PracticeAppointment · PracticeAppointmentParticipant | §五暂缓 10 |
| AI ⏸ | ContentChunk · FeatureEntry · AiConversation · AiMessage | M8 |

> 精确清单与字段以 `08-merged-design.md` §一~§五 为准；本表是分域汇总。

---

## 三、数字总结

| 口径 | 数 |
|---|---|
| 线上现状 model | **60** |
| 　├ 复用净资产（沿用）| 48 |
| 　├ 扩展（加字段）| 5 |
| 　├ 改造（重构）| 4 |
| 　└ 废弃（不入目标）| 3 |
| 目标设计表（08）| **≈69**（正式 55 + 暂缓 14）|
| **要从零新建/重写的表** | **≈40+**（专业/升学/报数/关怀/传承/角色/排课主体 + 实修改造 + 社交 + AI）|

**一句话**：线上 60 表里 48 张是可直接沿用的成熟净资产；新设计的**学修管理主体约 40+ 张表线上全无、要从零建**——文档「新建 20」严重低估实现量（DR-130 已钉死此认知），排期须按 40+ 估。

---

## 变更记录
| 日期 | 内容 |
|---|---|
| 2026-06-02 | 创建：对照 schema.prisma 60 model × 08 设计，逐表分 复用48/扩展5/改造4/废弃3 + 新建 40+；依据 DR-130/118/119/122 |
