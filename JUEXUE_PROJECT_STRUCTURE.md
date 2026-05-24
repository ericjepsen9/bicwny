# 觉学（JueXue）项目完整结构文档

> 生成日期：2026-05-24  
> 技术栈：React 18 + Vite + TypeScript（前端）· Fastify + Prisma + PostgreSQL（后端）

---

## 目录

1. [技术栈总览](#技术栈总览)
2. [数据库模型（Prisma Schema）](#数据库模型)
   - [枚举类型](#枚举类型)
   - [用户与认证](#用户与认证)
   - [班级系统](#班级系统)
   - [课程体系](#课程体系)
   - [题目与答题](#题目与答题)
   - [SM-2 间隔复习](#sm-2-间隔复习)
   - [观修系统](#观修系统)
   - [修行记录](#修行记录)
   - [笔记与高亮](#笔记与高亮)
   - [通知系统](#通知系统)
   - [LLM 网关](#llm-网关)
   - [管理员与系统](#管理员与系统)
   - [藏历系统](#藏历系统)
   - [其他功能表](#其他功能表)
3. [后端模块结构](#后端模块结构)
4. [API 路由总览](#api-路由总览)
5. [前端页面结构](#前端页面结构)
6. [前端组件库](#前端组件库)
7. [前端工具库](#前端工具库)
8. [依赖清单](#依赖清单)

---

## 技术栈总览

| 层 | 技术 |
|---|---|
| 前端框架 | React 18 + Vite 5 + TypeScript 5 |
| 路由 | React Router v7 |
| 状态/请求 | TanStack Query v5 + Zustand v5 |
| 移动端壳 | Capacitor 8（iOS/Android） |
| 后端框架 | Fastify 5 |
| ORM | Prisma 6 |
| 数据库 | PostgreSQL（localhost:5433，库名 juexue） |
| 认证 | JWT（@fastify/jwt）+ 自建 AuthSession + RefreshToken 轮换 |
| 文件处理 | sharp（图片）· mammoth（docx）· pdf-parse |
| 推送通知 | Web Push（VAPID，web-push 库） |
| LLM | 自建多 Provider 网关（Claude · MiniMax 等） |
| 监控 | Sentry（@sentry/node） |
| 部署 | PM2（进程名 juexue-api）+ nginx 反代 |

---

## 数据库模型

### 枚举类型

```prisma
enum UserRole           { admin, coach, student }
enum ClassMemberRole    { coach, student }
enum QuestionType       { single, fill, multi, open, sort, match, verse,
                          chain, flip, image, listen, flow, guided, scenario }
enum Visibility         { public, class_private, draft }
enum ReviewStatus       { pending, approved, rejected }
enum NotificationType   { system, class_announcement, class_session,
                          class_session_soon, achievement, reminder }
enum Sm2Status          { new, learning, review, mastered }
enum ReportReason       { wrong_answer, sensitive, doctrine_error, typo, other }
enum ReportStatus       { pending, accepted, rejected }
enum ProviderRole       { primary, fallback, disabled }
enum HealthStatus       { healthy, degraded, down, quota_exceeded }
enum OveragePolicy      { stop, pay_as_you_go, fallback }
enum PeriodType         { year, month, day, hour, minute }
enum PracticeProjectScope { user, class }
enum PracticeTaskScope  { self, class }
enum PracticeTaskMode   { daily, fixed }
enum FeedbackKind       { suggestion, bug, praise, other }
enum FeedbackStatus     { open, triaged, resolved, wontfix }
enum LogKind            { error, slow_request, slow_query }
```

---

### 用户与认证

#### `User`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | 主键 |
| email | String (unique) | 登录邮箱 |
| emailVerifiedAt | DateTime? | 邮箱验证时间 |
| passwordHash | String? | bcrypt 密码哈希 |
| role | UserRole | admin / coach / student |
| isActive | Boolean | 是否启用 |
| lastLoginAt | DateTime? | 最后登录 |
| dharmaName | String? | 法名 |
| avatar | String? | 头像 URL |
| timezone | String | 时区（默认 Asia/Shanghai） |
| locale | String | 语言（默认 zh-Hans） |
| hasOnboarded | Boolean | 是否完成引导 |
| contentCohort | String? | 内容实验分组 |
| meditationVisibleToClass | Boolean | 观修打卡班级可见 |
| practiceVisibleToClass | Boolean | 修行记录班级可见 |
| eveningReminderEnabled | Boolean | 晚间提醒开关 |
| eveningReminderHour | Int | 提醒小时（默认 21） |
| dailyDigestEnabled | Boolean | 日报开关 |
| dailyDigestHour | Int | 日报小时（默认 8） |
| weeklyReportEnabled | Boolean | 周报开关 |
| weeklyReportWeekday | Int | 周报星期几 |
| weeklyReportHour | Int | 周报小时 |
| quietHoursStart | Int? | 免打扰开始小时 |
| quietHoursEnd | Int? | 免打扰结束小时 |
| currentSessionId | String? | 当前 session ID |
| notificationV2Enabled | Boolean | 通知 V2 开关 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### `AuthSession`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| refreshTokenHash | String |
| userAgent | String? |
| ipAddress | String? |
| issuedAt | DateTime |
| expiresAt | DateTime |
| revokedAt | DateTime? |

#### `PasswordResetToken`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| tokenHash | String |
| expiresAt | DateTime |
| usedAt | DateTime? |
| requestedAt | DateTime |
| requestIp | String? |

#### `EmailVerificationToken`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| tokenHash | String |
| expiresAt | DateTime |
| usedAt | DateTime? |
| requestedAt | DateTime |

#### `DeletedEmail`
| 字段 | 类型 |
|---|---|
| email | String (主键) |
| deletedAt | DateTime |

---

### 班级系统

#### `Class`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | 主键 |
| name | String | 班级名 |
| description | String? | 描述 |
| joinCode | String (unique) | 加入码 |
| coverEmoji | String? | 封面 emoji |
| courseId | String? (FK) | 绑定法本 |
| isActive | Boolean | 是否活跃 |
| archivedAt | DateTime? | 归档时间 |
| createdAt / updatedAt | DateTime | |

#### `ClassMember`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| classId | String (FK) |
| userId | String (FK) |
| role | ClassMemberRole |
| joinedAt | DateTime |
| removedAt | DateTime? |

#### `ClassSession`（班级共修课）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| classId | String (FK) |
| title | String |
| description | String? |
| startAt | DateTime |
| durationMin | Int |
| liveLink | String? |
| editVersion | Int |
| createdBy | String (FK → User) |
| createdAt / updatedAt | DateTime |

#### `ClassAnnouncement`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| classId | String (FK) |
| authorId | String (FK → User) |
| title | String |
| body | String |
| imageUrls | String[] |
| pinnedAt | DateTime? |
| archivedAt | DateTime? |
| createdAt / updatedAt | DateTime |

---

### 课程体系

#### `Course`（法本）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| slug | String (unique) | URL 标识 |
| title | String | 简体标题 |
| titleTraditional | String? | 繁体标题 |
| author | String? | 作者 |
| authorInfo | String? | 作者简介 |
| description | String? | |
| coverEmoji | String? | |
| coverImageUrl | String? | |
| category | String? | 分类 |
| displayOrder | Int | 排序 |
| isPublished | Boolean | |
| licenseInfo | String? | 版权 |
| lastImportClientToken | String? | 导入标识 |
| lastImportSummary | Json? | 导入摘要 |
| archivedAt | DateTime? | |
| contentVersion | Int | 内容版本号 |
| createdAt / updatedAt | DateTime | |

#### `Chapter`（章节）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| courseId | String (FK) |
| order | Int |
| title | String |
| titleTraditional | String? |

#### `Lesson`（课时）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| chapterId | String (FK) | |
| order | Int | |
| title | String | |
| titleTraditional | String? | |
| referenceText | String? | 法本正文（Markdown） |
| teachingSummary | String? | 教学要点 |

#### `UserCourseEnrollment`（选课记录）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| userId | String (FK) | |
| courseId | String (FK) | |
| source | String | 'class' 或 'self'（自学） |
| enrolledViaClassId | String? (FK) | 通过哪个班加入 |
| enrolledAt | DateTime | |
| lastStudiedAt | DateTime? | |
| completedAt | DateTime? | |
| currentLessonId | String? (FK) | 当前进度 |
| lessonsCompleted | String[] | 已完成课时 ID 列表 |
| meditationsCompleted | String[] | 已完成观修 ID 列表 |

#### `LessonReadingProgress`（阅读进度）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| lessonId | String (FK) |
| courseId | String (FK) |
| scrollPercent | Float |
| totalSeconds | Int |
| isCompleted | Boolean |
| startedAt | DateTime |
| completedAt | DateTime? |
| lastReadAt | DateTime |

---

### 题目与答题

#### `Question`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| type | QuestionType | 14 种题型 |
| courseId | String? (FK) | |
| chapterId | String? (FK) | |
| lessonId | String? (FK) | |
| difficulty | Int? | 1-5 |
| tags | String[] | |
| questionText | String | 题干 |
| correctText | String? | 答对反馈 |
| wrongText | String? | 答错反馈 |
| source | String? | 来源说明 |
| payload | Json | 题型特定数据（含 referenceAnswer / keyPoints） |
| visibility | Visibility | public / class_private / draft |
| ownerClassId | String? (FK) | 班级私有时的归属班 |
| reviewStatus | ReviewStatus | 审核状态 |
| cohort | String? | 内容分组 |
| contentVersion | Int | |
| createdByUserId | String? (FK) | |
| reviewed | Boolean | |
| createdAt / updatedAt | DateTime | |

> **问答题评分**：`payload.referenceAnswer`（参考答案）+ `payload.keyPoints`（评分要点数组）由 LLM 网关对照学员答案评分，降级时走 mock 子串匹配。

#### `UserAnswer`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| questionId | String (FK) |
| answer | Json |
| isCorrect | Boolean? |
| score | Int? |
| aiGrade | Json? |
| timeSpentMs | Int? |
| classId | String? (FK) |
| requestId | String? |
| answeredAt | DateTime |

#### `UserFavorite`（收藏）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| questionId | String (FK) |
| createdAt | DateTime |

#### `UserMistakeBook`（错题本）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| questionId | String (FK) |
| lastWrongAt | DateTime |
| wrongCount | Int |
| removedAt | DateTime? |

#### `QuestionReport`（题目举报）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| questionId | String (FK) |
| reason | ReportReason |
| details | String? |
| status | ReportStatus |
| createdAt | DateTime |
| handledByUserId | String? |
| handledAt | DateTime? |
| note | String? |
| acceptAction | String? |

---

### SM-2 间隔复习

#### `Sm2Card`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| userId | String (FK) | |
| questionId | String (FK) | |
| courseId | String? (FK) | |
| easeFactor | Float | SM-2 难度因子（默认 2.5） |
| interval | Int | 复习间隔天数 |
| repetitions | Int | 已复习次数 |
| dueDate | DateTime | 下次复习日期 |
| lastReviewed | DateTime? | |
| lastRating | Int? | 0-5 评分 |
| status | Sm2Status | new/learning/review/mastered |

---

### 观修系统

#### `Meditation`（观修视频）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| lessonId | String? (FK) | 关联课时 |
| courseId | String (FK) | 关联法本 |
| title | String | |
| titleTraditional | String? | |
| description | String? | |
| videoUrl | String? | OSS 视频 URL |
| videoDurationSec | Int? | |
| slideImageUrls | String[] | 幻灯片图片 |
| slidesPdfUrl | String? | |
| chapters | Json? | 视频章节点 |
| transcriptVtt | String? | 字幕 VTT |
| isPublished | Boolean | |
| displayOrder | Int | |
| authorName | String? | |
| createdAt / updatedAt / archivedAt | DateTime | |

#### `MeditationSession`（观修记录）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| meditationId | String (FK) |
| startedAt | DateTime |
| completedAt | DateTime? |
| videoWatchedSec | Int |
| isCompleted | Boolean |
| insightNotes | String? |
| practiceNotes | String? |
| shareScope | String |

---

### 修行记录

#### `PracticeCategory`（修行分类）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| key | String (unique) |
| name | String |
| emoji | String |
| displayOrder | Int |

#### `PracticeProject`（修行项目）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| categoryId | String (FK) | |
| name | String | |
| emoji | String? | |
| scope | PracticeProjectScope | user / class |
| classId | String? (FK) | 班级项目时的归属 |
| ownerId | String? (FK) | |
| isBuiltin | Boolean | 系统内置 |
| archivedAt | DateTime? | |
| displayOrder | Int | |
| createdAt / updatedAt | DateTime | |

#### `PracticeEntry`（修行打卡）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| categoryId | String (FK) |
| projectId | String (FK) |
| count | Int |
| source | String? |
| note | String? |
| createdAt | DateTime |

#### `PracticeDailySummary`（每日汇总）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| categoryId | String (FK) |
| projectId | String (FK) |
| date | DateTime |
| count | Int |

#### `PracticeGoal`（修行目标）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| projectId | String (FK) |
| dailyTarget | Int |
| createdAt / updatedAt | DateTime |

#### `PracticeTask`（修行任务）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| scope | PracticeTaskScope | self / class |
| mode | PracticeTaskMode | daily / fixed |
| ownerId | String (FK) | 创建者 |
| classId | String? (FK) | |
| userId | String? (FK) | |
| projectId | String (FK) | |
| title | String | |
| target | Int | 目标次数 |
| startAt | DateTime | |
| endAt | DateTime? | |
| archivedAt | DateTime? | |
| createdAt / updatedAt | DateTime | |

#### `PracticeMakeup`（补打卡）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| date | DateTime |
| createdAt | DateTime |

---

### 笔记与高亮

#### `Note`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| userId | String (FK) | |
| lessonId | String? (FK) | |
| courseId | String? (FK) | |
| title | String? | |
| body | String | 笔记内容（Markdown） |
| tags | String[] | |
| visibility | Visibility | |
| anchorText | String? | 关联的法本原文片段 |
| anchorIndex | Int? | |
| pinnedAt | DateTime? | |
| archivedAt | DateTime? | |
| createdAt / updatedAt | DateTime | |

#### `NoteReport`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| noteId | String (FK) |
| reporterId | String (FK) |
| reason | String |
| status | String |
| createdAt | DateTime |
| handledById | String? |
| handledAt | DateTime? |

#### `Highlight`（划线高亮）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| lessonId | String (FK) |
| paragraphIndex | Int |
| textStart | Int |
| textEnd | Int |
| anchorText | String |
| color | String |
| createdAt | DateTime |

---

### 通知系统

#### `Notification`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| userId | String (FK) | |
| type | NotificationType | |
| title | String | |
| body | String | |
| link | String? | |
| isRead | Boolean | |
| createdAt / readAt / deletedAt | DateTime | |
| eventKind | String? | 事件类型 |
| eventId | String? | 事件 ID（去重用） |
| tier | String? | 优先级层级 |
| severity | String? | |
| contentHash | String? | 内容去重哈希 |
| revokedAt | DateTime? | |

#### `PushSubscription`（Web Push 订阅）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| endpoint | String |
| p256dh | String |
| auth | String |
| platform | String? |
| userAgent | String? |
| createdAt / lastSeenAt | DateTime |
| sessionId | String? |
| isActive | Boolean |
| deactivatedAt | DateTime? |

#### `NotificationDispatchLog`（推送分发日志）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| eventKind | String |
| eventId | String |
| tier | String |
| userId | String (FK) |
| notificationId | String? |
| pushedAt | DateTime |
| channel | String |
| success | Boolean |
| error | String? |
| severity | String? |

#### `NotificationRule`（通知规则）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| scope | String |
| classId | String? |
| assignmentId | String? |
| triggerType | String |
| defaultHour | Int |
| defaultWeekday | Int? |
| meta | Json? |
| isActive | Boolean |
| createdAt / updatedAt | DateTime |

#### `NotificationPreference`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| pushEnabled | Boolean |
| pushTypes | String[] |
| homeCardEnabled | Boolean |
| auspiciousDayCard | Boolean |
| updatedAt | DateTime |

---

### LLM 网关

#### `LlmProviderConfig`（Provider 配置）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| name | String (unique) | 内部标识 |
| displayName | String | |
| baseUrl | String | API 地址 |
| apiKeyEnv | String | 环境变量名 |
| defaultModel | String | |
| isEnabled | Boolean | |
| role | ProviderRole | primary/fallback/disabled |
| priority | Int | 路由优先级 |
| yearlyTokenQuota | BigInt? | 年配额 |
| monthlyTokenQuota | BigInt? | 月配额 |
| dailyRequestQuota | Int? | 日请求配额 |
| rpmLimit | Int? | 每分钟请求限制 |
| concurrencyLimit | Int? | 并发限制 |
| reservePercent | Int | 预留百分比 |
| enabledFrom / enabledUntil | DateTime? | 时间窗口 |
| overagePolicy | OveragePolicy | 超额策略 |
| healthStatus | HealthStatus | 健康状态 |
| consecutiveErrors | Int | 连续错误计数 |
| circuitOpenUntil | DateTime? | 熔断截止时间 |
| lastErrorAt / lastSuccessAt | DateTime? | |
| inputCostPer1k / outputCostPer1k | Float | 单价 |
| updatedAt / createdAt | DateTime | |

#### `LlmProviderUsage`（用量统计）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| providerId | String (FK) |
| periodType | PeriodType |
| periodKey | String |
| tokenCount | BigInt |
| inputTokens / outputTokens | BigInt |
| requestCount / errorCount | Int |
| cost | Float |
| updatedAt / createdAt | DateTime |

#### `LlmScenarioConfig`（场景配置）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| scenario | String (unique) | 如 open_grading |
| primaryProviderId | String (FK) | |
| primaryModel | String | |
| fallbackProviderId | String? (FK) | |
| fallbackModel | String? | |
| temperature | Float | |
| maxTokens | Int | |
| promptTemplateId | String? (FK) | |
| estimatedTokensPerCall | Int? | 用于配额预估 |
| updatedAt / createdAt | DateTime | |

#### `LlmPromptTemplate`（Prompt 模板）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| scenario | String |
| version | Int |
| content | String |
| isActive | Boolean |
| createdAt | DateTime |
| createdByAdminId | String (FK) |

#### `LlmCallLog`（调用日志）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| requestId | String | |
| scenario | String | |
| userId | String? | |
| coachId | String? | |
| providerUsed | String | 实际使用的 provider |
| providerTried | String[] | 尝试过的 providers |
| switched | Boolean | 是否切换过 |
| switchReason | String? | |
| model | String | |
| inputTokens / outputTokens | Int | |
| cost | Float | |
| latencyMs | Int | |
| success | Boolean | |
| errorCode / errorMessage | String? | |
| promptHash | String? | |
| timestamp | DateTime | |

---

### 管理员与系统

#### `AuditLog`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| adminId | String (FK → User) |
| action | String |
| targetType | String |
| targetId | String? |
| before / after | Json? |
| timestamp | DateTime |

#### `ErrorLog`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| kind | LogKind |
| message | String |
| stack | String? |
| context | Json? |
| userId | String? |
| requestId | String? |
| createdAt | DateTime |

#### `SystemSetting`
| 字段 | 类型 |
|---|---|
| key | String (主键) |
| value | Json |
| updatedAt | DateTime |
| updatedBy | String? |

#### `SystemAnnouncement`（系统公告）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| title | String |
| body | String |
| severity | String |
| expiresAt | DateTime? |
| revokedAt | DateTime? |
| contentHash | String |
| createdBy | String (FK) |
| createdAt / updatedAt | DateTime |

#### `ContentSeed` / `ContentRelease`（内容版本管理）
| 字段 | 类型 |
|---|---|
| ContentSeed.id | String (cuid) |
| ContentSeed.name | String |
| ContentSeed.hash | String |
| ContentSeed.appliedAt | DateTime |
| ContentSeed.appliedBy | String |
| ContentSeed.notes | String? |
| ContentRelease.id | String (cuid) |
| ContentRelease.entity | String |
| ContentRelease.entityId | String |
| ContentRelease.change | String |
| ContentRelease.oldVersion / newVersion | Int |
| ContentRelease.diff | Json? |
| ContentRelease.byUserId / bySeed | String? |
| ContentRelease.createdAt | DateTime |

#### `Experiment` / `ExperimentExposure`（A/B 测试）
| 字段 | 类型 |
|---|---|
| Experiment.id | String (cuid) |
| Experiment.key | String (unique) |
| Experiment.description | String? |
| Experiment.variants | Json |
| Experiment.goalEvent | String? |
| Experiment.isActive | Boolean |
| Experiment.startedAt / archivedAt | DateTime? |
| Experiment.createdBy | String (FK) |
| ExperimentExposure.id | String (cuid) |
| ExperimentExposure.experimentKey | String |
| ExperimentExposure.userId | String |
| ExperimentExposure.sessionId | String? |
| ExperimentExposure.variant | String |
| ExperimentExposure.firstSeenAt | DateTime |

#### `Feedback`（用户反馈）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String? (FK) |
| kind | FeedbackKind |
| status | FeedbackStatus |
| message | String |
| contactEmail | String? |
| page | String? |
| userAgent | String? |
| appVersion | String? |
| sessionId | String? |
| handledByUserId | String? |
| handledAt | DateTime? |
| response | String? |
| createdAt | DateTime |

#### `AnalyticsEvent`
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String? |
| sessionId | String? |
| event | String |
| properties | Json? |
| page | String? |
| referrer | String? |
| userAgent | String? |
| createdAt | DateTime |

#### `OrphanedFile`（孤立文件 GC）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| filePath | String |
| variantPaths | String[] |
| markedAt | DateTime |

---

### 藏历系统

#### `TibetanDay`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | |
| date | DateTime (unique) | 公历日期 |
| lunar | String? | 农历 |
| tibetan | String? | 藏历日期描述 |
| tibetanMonth | String? | 藏历月份 |
| isIntercalary | Boolean | 是否闰月 |
| tags | String[] | 特殊标签 |
| auspicious | Json? | 吉祥信息 |
| events | Json[] | 节日事件 |
| publicHoliday | String? | 公历节假日 |
| createdAt / updatedAt | DateTime | |

---

### 其他功能表

#### `HomePoster`（首页海报）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| year / month | Int |
| imageUrl | String |
| caption | String? |
| createdAt / updatedAt | DateTime |

#### `DharmaAssembly`（法会活动）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| title | String |
| category | String? |
| startAt / endAt | DateTime |
| description | String? |
| coverImage | String? |
| externalLink | String? |
| deletedAt | DateTime? |
| createdBy | String (FK) |
| createdAt / updatedAt | DateTime |

#### `UserAchievementUnlock`（成就解锁）
| 字段 | 类型 |
|---|---|
| id | String (cuid) |
| userId | String (FK) |
| badgeId | String |
| unlockedAt | DateTime |
| notifiedAt | DateTime? |

---

## 后端模块结构

```
backend/src/
├── app.ts              # Fastify 应用工厂（CORS/Helmet/JWT/Rate-limit/Swagger）
├── server.ts           # 服务入口
└── modules/
    ├── achievements/   # 成就系统
    │   ├── routes.ts
    │   └── service.ts
    ├── admin/          # 管理员后台
    │   ├── audit.routes.ts
    │   ├── content.routes.ts
    │   ├── learning.service.ts
    │   ├── logs.routes.ts
    │   ├── platform-stats.service.ts
    │   ├── routes.ts
    │   ├── system-settings.routes.ts
    │   ├── system-settings.service.ts
    │   └── users.service.ts
    ├── analytics/      # 埋点事件
    │   └── routes.ts
    ├── announcements/  # 班级公告
    │   ├── routes.ts
    │   └── service.ts
    ├── answering/      # 答题与评分
    │   ├── grading.flip.ts       # 翻转题评分
    │   ├── grading.mockGuided.ts # 引导题 mock
    │   ├── grading.mockOpen.ts   # 问答题 mock（关键词匹配）
    │   ├── grading.objective.ts  # 客观题评分
    │   ├── grading.open.ts       # 问答题（LLM + 降级）
    │   ├── grading.strategy.ts   # 评分策略接口
    │   ├── grading.ts            # 评分入口
    │   ├── mistakes.routes.ts
    │   ├── mistakes.ts
    │   ├── progress.service.ts
    │   ├── publicView.ts
    │   ├── routes.ts
    │   └── service.ts
    ├── auth/           # 认证
    │   ├── email-verify.service.ts
    │   ├── export.service.ts
    │   ├── hash.ts
    │   ├── password-reset.service.ts
    │   ├── routes.ts
    │   ├── service.helpers.ts
    │   ├── service.ts
    │   ├── sessions.routes.ts
    │   └── tokens.ts
    ├── class/          # 班级管理
    │   ├── admin.routes.ts
    │   ├── coach.routes.ts
    │   ├── service.ts
    │   └── student.routes.ts
    ├── classes/sessions/ # 共修课
    │   ├── routes.ts
    │   └── service.ts
    ├── coach/          # 辅导员功能
    │   ├── routes.ts
    │   ├── stats.service.ts
    │   ├── stats.types.ts
    │   ├── student.service.ts
    │   └── student.types.ts
    ├── courses/        # 法本管理
    │   ├── admin.routes.ts
    │   ├── admin.service.ts
    │   ├── cover.routes.ts
    │   ├── cover.service.ts
    │   ├── import.routes.ts
    │   ├── import.service.ts
    │   └── service.ts
    ├── dharma-assemblies/ # 法会活动
    │   ├── routes.ts
    │   └── service.ts
    ├── dossier/        # 学习档案
    │   ├── dashboard.service.ts
    │   ├── routes.ts
    │   └── service.ts
    ├── enrollment/     # 选课（含自学）
    │   └── service.ts
    ├── experiments/    # A/B 测试
    │   └── routes.ts
    ├── favorites/      # 收藏
    │   ├── routes.ts
    │   └── service.ts
    ├── feedback/       # 用户反馈
    │   ├── routes.ts
    │   └── service.ts
    ├── health/         # 健康检查
    │   └── routes.ts
    ├── highlights/     # 划线高亮
    │   ├── routes.ts
    │   └── service.ts
    ├── learning/       # 学习进度
    │   └── routes.ts
    ├── llm/            # LLM 多 Provider 网关
    │   ├── admin.routes.ts
    │   ├── admin.service.ts
    │   ├── admin.service.helpers.ts
    │   ├── admin.service.types.ts
    │   ├── circuit.ts            # 熔断器
    │   ├── gateway.ts            # 路由入口
    │   ├── gateway.helpers.ts
    │   ├── period.ts             # 时间周期工具
    │   ├── prompt.ts             # Prompt 模板加载
    │   ├── quota.ts              # 配额管理
    │   ├── scenario.admin.routes.ts
    │   ├── scenario.admin.ts
    │   ├── usage.admin.ts
    │   ├── usage.ts
    │   └── providers/
    │       ├── claude.ts
    │       ├── http.ts
    │       ├── index.ts
    │       ├── minimax.ts
    │       ├── minimax-m27.ts
    │       └── types.ts
    ├── meditations/    # 观修
    │   ├── admin.routes.ts
    │   ├── admin.service.ts
    │   ├── ranking.routes.ts
    │   ├── student.routes.ts
    │   └── student.service.ts
    ├── notes/          # 笔记
    │   ├── llm-assist.service.ts # AI 辅助笔记
    │   ├── routes.ts
    │   └── service.ts
    ├── notifications/  # 通知
    │   ├── prefs.routes.ts
    │   ├── push-prefs.service.ts
    │   ├── routes.ts
    │   └── service.ts
    ├── posters/        # 首页海报
    │   ├── routes.ts
    │   └── service.ts
    ├── practice/       # 修行记录
    │   ├── admin.routes.ts
    │   ├── coach.routes.ts
    │   ├── makeup.ts
    │   ├── migration.ts
    │   ├── ranking.routes.ts
    │   ├── student.routes.ts
    │   ├── student.service.ts
    │   ├── study-ranking.routes.ts
    │   └── utils.ts
    ├── push/           # Web Push 订阅
    │   ├── routes.ts
    │   └── service.ts
    ├── questions/      # 题目管理
    │   ├── admin.routes.ts
    │   ├── batch.service.ts
    │   ├── coach.routes.ts
    │   ├── create.service.ts
    │   ├── delete.service.ts
    │   ├── generate.parser.ts    # LLM 生题解析
    │   ├── generate.service.ts   # LLM 生题
    │   ├── list.service.ts
    │   ├── review.service.ts
    │   ├── smart-practice.service.ts
    │   └── update.service.ts
    ├── reading/        # 阅读进度
    │   ├── routes.ts
    │   └── service.ts
    ├── reports/        # 举报
    │   ├── routes.ts
    │   └── service.ts
    ├── scheduler/      # 定时任务
    │   ├── cron.ts
    │   ├── dispatch.ts
    │   ├── personal-reminders.ts
    │   ├── reminder-queries.ts
    │   └── time-utils.ts
    ├── search/         # 搜索
    │   └── routes.ts
    ├── sm2/            # SM-2 间隔复习
    │   ├── algorithm.ts
    │   ├── routes.ts
    │   └── service.ts
    ├── system-announcements/ # 系统公告
    │   ├── routes.ts
    │   └── service.ts
    └── tibetan/        # 藏历
        ├── routes.ts
        ├── service.ts
        └── types.ts
```

---

## API 路由总览

### 认证（/api/auth）
- `POST /api/auth/register` — 注册
- `POST /api/auth/login` — 登录
- `POST /api/auth/refresh` — 刷新 Token
- `POST /api/auth/logout` — 登出
- `GET /api/auth/me` — 当前用户信息
- `PATCH /api/auth/me` — 更新个人信息
- `POST /api/auth/send-verify-email` — 发送验证邮件
- `POST /api/auth/verify-email` — 验证邮箱
- `POST /api/auth/forgot-password` — 忘记密码
- `POST /api/auth/reset-password` — 重置密码
- `GET /api/auth/sessions` — 获取会话列表
- `DELETE /api/auth/sessions/:id` — 撤销会话

### 法本/课程（/api/courses）
- `GET /api/courses` — 课程列表
- `GET /api/courses/:id` — 课程详情
- `GET /api/courses/:id/chapters` — 章节列表
- `GET /api/courses/:id/lessons` — 课时列表
- `GET /api/lessons/:id` — 课时详情
- `POST /api/admin/courses` — 创建法本
- `PATCH /api/admin/courses/:id` — 更新法本
- `POST /api/admin/courses/:id/import` — 导入内容
- `POST /api/admin/courses/:id/cover` — 上传封面

### 选课/进度（/api/enrollment, /api/learning）
- `POST /api/enrollment` — 选课
- `GET /api/learning/progress` — 学习进度
- `PATCH /api/learning/progress/:lessonId` — 更新进度

### 题目（/api/questions）
- `GET /api/questions` — 题目列表（含过滤）
- `GET /api/questions/:id` — 题目详情
- `POST /api/coach/questions` — 创建题目
- `PATCH /api/coach/questions/:id` — 更新题目
- `DELETE /api/coach/questions/:id` — 删除题目
- `POST /api/coach/questions/import` — 批量导入
- `POST /api/coach/questions/generate` — LLM 生题
- `GET /api/admin/questions/review` — 审核队列
- `POST /api/admin/questions/:id/review` — 审核

### 答题（/api/answers）
- `POST /api/answers` — 提交答案（含 LLM 评分）
- `GET /api/answers/mistakes` — 错题本
- `DELETE /api/answers/mistakes/:questionId` — 删除错题
- `GET /api/answers/favorites` — 收藏列表
- `POST /api/answers/favorites/:questionId` — 收藏题目
- `DELETE /api/answers/favorites/:questionId` — 取消收藏

### SM-2 复习（/api/sm2）
- `GET /api/sm2/due` — 今日待复习
- `POST /api/sm2/review` — 提交复习评分
- `GET /api/sm2/stats` — 复习统计

### 观修（/api/meditations）
- `GET /api/meditations` — 观修列表
- `GET /api/meditations/:id` — 观修详情
- `POST /api/meditations/:id/session` — 开始观修
- `PATCH /api/meditations/:id/session` — 更新进度
- `GET /api/classes/:id/meditation-ranking` — 班级排行（5 分钟缓存）
- `POST /api/admin/meditations` — 创建观修
- `PATCH /api/admin/meditations/:id` — 更新观修

### 修行记录（/api/practice）
- `GET /api/practice/categories` — 分类列表
- `GET /api/practice/projects` — 项目列表
- `POST /api/practice/entries` — 打卡
- `GET /api/practice/summary` — 统计汇总
- `GET /api/practice/ranking` — 排行榜
- `POST /api/practice/makeup` — 补打卡
- `GET /api/classes/:id/practice-ranking` — 班级修行排行

### 班级（/api/classes）
- `GET /api/classes/mine` — 我的班级
- `POST /api/classes/join` — 加入班级
- `GET /api/classes/:id` — 班级详情
- `GET /api/classes/:id/members` — 成员列表
- `POST /api/coach/classes` — 创建班级
- `PATCH /api/coach/classes/:id` — 更新班级
- `POST /api/coach/classes/:id/members` — 添加成员
- `DELETE /api/coach/classes/:id/members/:uid` — 移除成员

### 阅读进度（/api/reading）
- `POST /api/reading/progress` — 更新阅读进度
- `GET /api/reading/progress/:lessonId` — 获取进度

### 笔记（/api/notes）
- `GET /api/notes` — 笔记列表
- `POST /api/notes` — 创建笔记
- `PATCH /api/notes/:id` — 更新笔记
- `DELETE /api/notes/:id` — 删除笔记
- `POST /api/notes/:id/ai-assist` — AI 辅助

### 高亮（/api/highlights）
- `GET /api/highlights/:lessonId` — 获取高亮
- `POST /api/highlights` — 创建高亮
- `DELETE /api/highlights/:id` — 删除高亮

### 通知（/api/notifications）
- `GET /api/notifications` — 通知列表
- `PATCH /api/notifications/:id/read` — 标为已读
- `POST /api/push/subscribe` — 注册 Push 订阅
- `DELETE /api/push/subscribe` — 取消订阅
- `GET /api/notifications/prefs` — 通知偏好
- `PATCH /api/notifications/prefs` — 更新偏好

### 管理员（/api/admin）
- `GET /api/admin/users` — 用户列表
- `POST /api/admin/users` — 创建用户
- `PATCH /api/admin/users/:id` — 更新用户
- `GET /api/admin/stats` — 平台统计
- `GET /api/admin/audit` — 审计日志
- `GET /api/admin/logs` — 错误日志
- `GET /api/admin/system-settings` — 系统设置
- `PATCH /api/admin/system-settings` — 更新设置
- `GET /api/admin/llm/providers` — LLM Provider 列表
- `PATCH /api/admin/llm/providers/:id` — 更新 Provider
- `GET /api/admin/llm/logs` — LLM 调用日志

### 其他
- `GET /api/tibetan/today` — 今日藏历
- `GET /api/tibetan/month` — 当月藏历
- `GET /api/dharma-assemblies` — 法会列表
- `GET /api/posters/current` — 当前海报
- `POST /api/feedback` — 提交反馈
- `GET /api/health` — 健康检查

---

## 前端页面结构

### 学员端（主 TabBar）

| 路径 | 页面文件 | 说明 |
|---|---|---|
| `/` | HomePage.tsx | 首页（课程进度、今日藏历、公告） |
| `/courses` | CoursesPage.tsx | 法本列表 |
| `/scripture-detail` | ScriptureDetailPage.tsx | 法本详情 |
| `/read/:slug/:lessonId` | ScriptureReadingPage.tsx | 法本阅读 |
| `/meditation/:id` | MeditationPlayerPage.tsx | 观修播放 |
| `/meditations` | MeditationsPage.tsx | 观修列表 |
| `/me/meditations` | MyMeditationsPage.tsx | 我的观修记录 |
| `/quiz` | QuizCenterPage.tsx | 练习中心 |
| `/quiz-practice` | QuizPage.tsx | 智能练习 |
| `/quiz/:lessonId` | QuizPage.tsx | 课时测验 |
| `/practice` | PracticePage.tsx | 修行打卡 |
| `/practice/history` | PracticeHistoryPage.tsx | 打卡历史 |
| `/practice/:categoryKey` | PracticeCategoryPage.tsx | 分类打卡 |
| `/practice/project/:id` | PracticeProjectPage.tsx | 项目详情 |
| `/profile` | ProfilePage.tsx | 个人主页 |
| `/profile/edit` | ProfileEditPage.tsx | 编辑资料 |
| `/settings` | SettingsPage.tsx | 设置 |
| `/settings/notifications` | SettingsNotificationsPage.tsx | 通知设置 |
| `/devices` | DevicesPage.tsx | 设备管理 |

### 学员端（二级页面）

| 路径 | 页面文件 |
|---|---|
| `/mistakes` | MistakesPage.tsx |
| `/mistake/:questionId` | MistakeDetailPage.tsx |
| `/favorites` | FavoritesPage.tsx |
| `/sm2-review` | Sm2ReviewPage.tsx |
| `/class/:id` | ClassDetailPage.tsx |
| `/class/:id/sessions/:sid` | ClassSessionDetailPage.tsx |
| `/class/:id/meditations` | ClassMeditationRankingPage.tsx |
| `/class/:id/practice-ranking` | ClassPracticeRankingPage.tsx |
| `/class/:id/ranking` | ClassRankingPage.tsx |
| `/join-class` | JoinClassPage.tsx |
| `/notes` | NotesPage.tsx |
| `/notes/new` | NoteEditPage.tsx |
| `/notes/:id` | NoteEditPage.tsx |
| `/me/stats` | DossierPage.tsx |
| `/calendar` | CalendarPage.tsx |
| `/notifications` | NotificationPage.tsx |
| `/achievement` | AchievementPage.tsx |
| `/events` | EventsPage.tsx |
| `/announcements/:id` | AnnouncementDetailPage.tsx |
| `/assemblies/:id` | AssemblyDetailPage.tsx |
| `/about` | AboutPage.tsx |
| `/help` | HelpPage.tsx |
| `/terms` | TermsPage.tsx |
| `/privacy` | PrivacyPage.tsx |

### 认证页面

| 路径 | 页面文件 |
|---|---|
| `/auth` | AuthPage.tsx |
| `/forgot` | ForgotPage.tsx |
| `/reset` | ResetPage.tsx |
| `/verify-email` | VerifyEmailPage.tsx |
| `/onboarding` | OnboardingPage.tsx |

### 辅导员端（/coach/*）

| 路径 | 页面文件 |
|---|---|
| `/coach/` | CoachDashboardPage.tsx |
| `/coach/students` | CoachStudentsPage.tsx |
| `/coach/questions` | CoachQuestionsPage.tsx |
| `/coach/questions/new` | CoachQuestionNewPage.tsx |
| `/coach/questions/import` | CoachQuestionImportPage.tsx |
| `/coach/questions/generate` | CoachQuestionGeneratePage.tsx |
| `/coach/courses` | CoachCoursesPage.tsx |
| `/coach/courses/browse` | AdminCoursesPage.tsx |
| `/coach/classes` | AdminClassesPage.tsx |
| `/coach/classes/new` | ClassNewPage.tsx |
| `/coach/classes/:id/dashboard` | CoachClassDashboardPage.tsx |
| `/coach/classes/:id/practice` | CoachClassPracticePage.tsx |
| `/coach/classes/:id/announcements` | CoachClassAnnouncementsPage.tsx |
| `/coach/classes/:id/sessions` | CoachClassSessionsPage.tsx |
| `/coach/calendar` | CalendarPage.tsx |
| `/coach/review` | AdminReviewPage.tsx |
| `/coach/note-reports` | AdminNoteReportsPage.tsx |
| `/coach/meditations` | MeditationsPage.tsx |

### 管理员端（/admin/*）

| 路径 | 页面文件 |
|---|---|
| `/admin/` | AdminDashboardPage.tsx |
| `/admin/users` | AdminUsersPage.tsx |
| `/admin/users/new` | AdminUserNewPage.tsx |
| `/admin/users/:uid/stats` | DossierPage.tsx |
| `/admin/classes` | AdminClassesPage.tsx |
| `/admin/classes/new` | ClassNewPage.tsx |
| `/admin/classes/:id/dashboard` | CoachClassDashboardPage.tsx |
| `/admin/classes/:id/practice` | CoachClassPracticePage.tsx |
| `/admin/classes/:id/announcements` | CoachClassAnnouncementsPage.tsx |
| `/admin/classes/:id/sessions` | CoachClassSessionsPage.tsx |
| `/admin/courses` | AdminCoursesPage.tsx |
| `/admin/meditations` | MeditationsPage.tsx |
| `/admin/practice` | AdminPracticePage.tsx |
| `/admin/questions` | CoachQuestionsPage.tsx |
| `/admin/questions/new` | CoachQuestionNewPage.tsx |
| `/admin/questions/import` | CoachQuestionImportPage.tsx |
| `/admin/questions/generate` | CoachQuestionGeneratePage.tsx |
| `/admin/review` | AdminReviewPage.tsx |
| `/admin/reports` | AdminReportsPage.tsx |
| `/admin/note-reports` | AdminNoteReportsPage.tsx |
| `/admin/audit` | AdminAuditPage.tsx |
| `/admin/logs` | AdminLogsPage.tsx |
| `/admin/notification-rules` | AdminNotificationRulesPage.tsx |
| `/admin/system-announcements` | AdminSystemAnnouncementsPage.tsx |
| `/admin/dharma-assemblies` | AdminDharmaAssembliesPage.tsx |
| `/admin/llm` | AdminLlmPage.tsx |
| `/admin/calendar` | AdminCalendarPage.tsx |
| `/admin/calendar/year/:year` | AdminCalendarYearPage.tsx |
| `/admin/posters` | AdminPostersPage.tsx |

---

## 前端组件库

### 布局/Shell
| 文件 | 说明 |
|---|---|
| AdminShell.tsx | 管理员侧边栏布局 |
| CoachShell.tsx | 辅导员侧边栏布局 |
| AuthLayout.tsx | 认证页布局 |
| TopNav.tsx | 顶部导航栏 |
| TabBar.tsx | 底部 Tab 导航 |
| SideNavSettings.tsx | 设置侧边导航 |

### 权限守卫
| 文件 | 说明 |
|---|---|
| RequireAuth.tsx | 需要登录 |
| RequireAdminAuth.tsx | 需要 admin 角色（含登录） |
| RequireCoachAuth.tsx | 需要 coach 角色（含登录） |
| RequireAdmin.tsx | admin 角色检查 |
| RequireCoach.tsx | coach 角色检查 |

### 题目组件（components/quiz/）
| 文件 | 题型 |
|---|---|
| SingleChoice.tsx | 单选 |
| MultiChoice.tsx | 多选 |
| Fill.tsx | 填空 |
| Open.tsx | 问答 |
| Sort.tsx | 排序 |
| Match.tsx | 匹配 |
| Verse.tsx | 偈颂 |
| Chain.tsx | 连锁 |
| Flip.tsx | 翻转卡 |
| index.tsx | 题型工厂 |

### 阅读组件（components/reading/）
- ReadingArticle.tsx, ReadingBottomNav.tsx, ReadingNotesFab.tsx
- ReadingSelectionToolbar.tsx, ReadingTocSheet.tsx, ReadingTopBar.tsx

### 藏历组件
- TibetanClassWeekStrip.tsx, TibetanPracticeBanner.tsx
- TibetanTodayChip.tsx, TibetanYearTransitionBanner.tsx

### 通用 UI
| 文件 | 说明 |
|---|---|
| Dialog.tsx | 对话框 |
| ConfirmDialog.tsx | 确认对话框 |
| Field.tsx | 表单字段 |
| Skeleton.tsx | 加载骨架屏 |
| EmptyState.tsx | 空状态 |
| ErrorState.tsx | 错误状态 |
| ErrorBoundary.tsx | 错误边界 |
| CourseCover.tsx | 法本封面 |
| DailyBarChart.tsx | 每日柱状图 |
| StreakDots.tsx | 连续打卡点 |
| WheelPicker.tsx | 滚轮选择器 |
| FilterChip.tsx | 筛选标签 |
| MakeupCard.tsx | 补打卡卡片 |
| ChapterProgressGrid.tsx | 章节进度格 |

### 其他
- PushSync.tsx — Push 订阅同步
- SlideViewer.tsx — 幻灯片查看器
- CourseImportDialog.tsx — 法本导入对话框
- MeditationAdmin.tsx — 观修管理组件
- NotesDrawer.tsx — 笔记抽屉
- QuestionAdminInline.tsx — 题目内联管理

---

## 前端工具库（src/lib/）

| 文件 | 说明 |
|---|---|
| api.ts | API 请求客户端（含 Token 注入） |
| auth.tsx | Auth Context + hooks（useAuth） |
| queries.ts | React Query key 工厂 + 公共 hooks |
| tokenStore.ts | JWT Token 本地持久化 |
| env.ts | 环境变量封装 |
| push.ts | Web Push 订阅客户端 |
| sw-register.ts | Service Worker 注册 |
| payloadHelpers.ts | Question payload 解析工具 |
| questionText.ts | 题目文本格式化 |
| practiceBatch.ts | 修行批量提交 |
| practiceLimit.ts | 修行频率限制 |
| readingTracker.ts | 阅读进度追踪 |
| reading-utils.tsx | 阅读工具函数 |
| mainCourse.ts | 主修法本追踪 |
| relTime.ts | 相对时间格式化 |
| haptics.ts | 震动反馈（Capacitor） |
| native.ts | 原生能力封装（Capacitor） |
| a11y.tsx | 无障碍工具 |
| fontSize.tsx | 字号 Context |
| i18n.tsx | 国际化 Context |
| pullToRefresh.tsx | 下拉刷新 Context |
| readMode.tsx | 阅读模式 Context |
| theme.tsx | 主题 Context |
| toast.tsx | Toast 通知 Context |

---

## 依赖清单

### 后端（backend/package.json）

**运行时依赖**
| 包 | 版本 | 用途 |
|---|---|---|
| fastify | ^5.2.0 | HTTP 框架 |
| @fastify/jwt | ^10.1.0 | JWT 认证 |
| @fastify/cors | ^10.0.1 | 跨域 |
| @fastify/helmet | ^12.0.1 | 安全头 |
| @fastify/multipart | ^9.0.1 | 文件上传 |
| @fastify/rate-limit | ^10.2.2 | 限流 |
| @fastify/swagger | ^9.7.0 | OpenAPI 文档 |
| @fastify/swagger-ui | ^5.2.6 | Swagger UI |
| @prisma/client | ^6.1.0 | ORM 客户端 |
| @sentry/node | ^8.55.2 | 错误监控 |
| zod | ^3.24.1 | Schema 校验 |
| zod-to-json-schema | ^3.25.2 | Zod → JSON Schema |
| sharp | ^0.33.5 | 图片处理 |
| web-push | ^3.6.7 | Web Push (VAPID) |
| undici | ^6.21.0 | HTTP 客户端 |
| mammoth | ^1.8.0 | Word 文档解析 |
| pdf-parse | ^1.1.1 | PDF 解析 |
| cheerio | ^1.0.0 | HTML 解析 |
| dotenv | ^16.4.7 | 环境变量 |

**开发依赖**
- typescript ^5.7.2, tsx ^4.19.2, prisma ^6.1.0, vitest ^2.1.8

### 前端（juexue-v2/package.json）

**运行时依赖**
| 包 | 版本 | 用途 |
|---|---|---|
| react | ^18.3.1 | UI 框架 |
| react-dom | ^18.3.1 | DOM 渲染 |
| react-router-dom | ^7.0.0 | 路由 |
| @tanstack/react-query | ^5.59.0 | 服务端状态管理 |
| zustand | ^5.0.0 | 客户端状态 |
| @capacitor/core | ^8.3.1 | 移动端壳 |
| @capacitor/app | ^8.1.0 | App 生命周期 |
| @capacitor/haptics | ^8.0.2 | 震动 |
| @capacitor/keyboard | ^8.0.3 | 键盘 |
| @capacitor/preferences | ^8.0.1 | 本地存储 |
| @capacitor/splash-screen | ^8.1.0 | 启动屏 |
| @capacitor/status-bar | ^8.0.2 | 状态栏 |

**开发依赖**
- vite ^5.4.10, typescript ^5.6.3, eslint ^9.39.4
- @playwright/test ^1.59.1（E2E 测试）
- @capacitor/cli ^8.3.1

---

## 数据库统计

| 指标 | 数值 |
|---|---|
| Prisma 模型总数 | 57 |
| 枚举总数 | 18 |
| 后端模块目录 | 34 |
| 后端源文件 | ~120 |
| API 路由估计 | 100+ |
| 前端页面 | 90+ |
| 前端组件 | 57 |
| 前端工具库文件 | 24 |
| 题目类型 | 14 种 |
| LLM Provider 支持 | Claude, MiniMax（可扩展） |
