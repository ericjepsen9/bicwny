# 觉学 · 数据模型总图（文字版 ER）

> 状态：现状快照（2026-05-31）
> 用途：线上 Prisma schema 的分域总览，一眼看清 61 model / 23 enum 怎么分布、怎么连。
> 数据源：`backend/prisma/schema.prisma`（直接清点 **61 model / 23 enum**；审计 01 记 60/19 为早期约数，以本表为准）。
> 实现状态见 `03-modification-plan §5`（绝大多数为 ✅ 净资产保留）。

---

## 一、分域模型清单（12 域）

### ① 用户/账户/角色
| Model | 用途 | 关键关联 |
|---|---|---|
| User | 账户核心：邮箱/密码/角色/时区/通知偏好 | →众多子表（answers/memberships/sessions/notes…）|
| AuthSession | 刷新令牌白名单 · 单设备登录 | →User |
| PasswordResetToken | 密码重置令牌（30 分钟一次性）| →User |
| EmailVerificationToken | 邮箱验证令牌 | →User |
| DeletedEmail | 注销冷却（30 天禁重注）| — |
| NotificationPreference | v2 通知偏好（push 总开关 + 子开关）| →User |

枚举：`UserRole`(admin/coach/student)

### ② 班级/成员
| Model | 用途 | 关键关联 |
|---|---|---|
| Class | 班级：加入码 + 关联法本 + 软删归档 | →course/members/sessions/announcements |
| ClassMember | 成员：学员/辅导员 · 软删 removedAt | →class/user |
| ClassSession | 排课：共修/答疑/直播 + 推送时机 | →class |
| ClassAnnouncement | 班级公告（单向）| →class |

枚举：`ClassMemberRole`(coach/student)

### ③ 法本内容
| Model | 用途 | 关键关联 |
|---|---|---|
| Course | 法本：分类/封面/发布/内容版本 | →chapters/questions/classes/meditations |
| Chapter | 章节 | →course/lessons |
| Lesson | 课时：大纲/参考文 | →chapter/resources/textBlocks/notes/highlights |
| LessonResource | 课时资源（YouTube/音频/视频）| →lesson/mediaChapters |
| LessonMediaChapter | 媒体时间戳标注 | →lessonResource |
| LessonTextBlock | 文字段落块（音频对齐，Phase 3 预留）| →lesson |
| UserCourseEnrollment | 课程报名（自学/班级来源 + 进度）| →user/course |
| LessonReadingProgress | 阅读进度（滚动/停留/完成）| →user/lesson |

### ④ 题库/答题/复习
| Model | 用途 | 关键关联 |
|---|---|---|
| Question | 题目：14 题型 + payload + 可见性/cohort/版本 | →course/chapter/lesson/createdBy |
| UserAnswer | 答题记录：分数/AI 评分/幂等/班级域 | →user/question/class |
| Sm2Card | SM-2 间隔重复卡 | →user/question/course |
| UserFavorite | 收藏 | →user/question |
| UserMistakeBook | 错题本（软删）| →user/question |
| QuestionReport | 题目举报 | →user/question |

枚举：`QuestionType`(14 值) `Visibility` `ReviewStatus` `Sm2Status` `ReportReason` `ReportStatus`

### ⑤ 观修（DR-111：看视频引导，保留）
| Model | 用途 | 关键关联 |
|---|---|---|
| Meditation | 观修引导视频/PPT（可绑课时/法本）| →course/lesson/sessions |
| MeditationSession | 观修会话：播放进度 + 完成(≥80%) | →user/meditation |

> ⚠️ 升学打坐统计**不在此**，走 PracticeLog/UserPracticeVow（DR-91/111）。

### ⑥ 修学打卡
| Model | 用途 | 关键关联 |
|---|---|---|
| PracticeCategory | 大类预置（持咒/礼拜/诵经…）| →projects |
| PracticeProject | 子项（user/class 作用域）| →category/class/owner/entries |
| PracticeEntry | 单次计数明细（tap/shake/bulk）| →user/project |
| PracticeDailySummary | 日聚合（O(1) 排行）| →user/project |
| PracticeGoal | 日目标 | →user/project |
| PracticeTask | 任务（个人/班级 · daily/fixed）| →project/class |
| PracticeMakeup | 补签（7 天内每周 1 次）| →user |

> ⚠️ 设计文档用名 **PracticeLog**，线上实际表为 **PracticeEntry**（命名对齐属迁移层，见 03 §9 / 待修订 #6）。

枚举：`PracticeProjectScope` `PracticeTaskScope` `PracticeTaskMode`

### ⑦ 通知体系 v2
| Model | 用途 |
|---|---|
| Notification | 统一通知（4 类 + 事件系统 + 软删/撤回）|
| PushSubscription | Web Push 订阅（多设备 + sessionId）|
| NotificationDispatchLog | 派发去重日志（幂等 + 频率）|
| NotificationRule | 平台/班级/任务级规则 |
| AnalyticsEvent | 埋点（匿名/登录，高频写）|

枚举：`NotificationType`

### ⑧ LLM 网关（AI 复用底座，DR-108/110）
| Model | 用途 |
|---|---|
| LlmProviderConfig | 供应商配置（端点/额度/限流/健康/成本）|
| LlmProviderUsage | 用量（年/月/日/时/分粒度，tokens/成本）|
| LlmScenarioConfig | 场景配置（主/兜底 + 温度 + 模板）|
| LlmPromptTemplate | 提示词模板（场景/版本/激活）|
| LlmCallLog | 调用流水（token/成本/错误/promptHash）|

枚举：`ProviderRole` `HealthStatus` `OveragePolicy` `PeriodType`

### ⑨ 审计/日志/系统
| Model | 用途 |
|---|---|
| AuditLog | 管理员审计（特权操作 before/after）—— 能力 20 待扩展 |
| ErrorLog | 运行日志（error/slow_request/slow_query）|
| SystemSetting | KV 全局配置 |

枚举：`LogKind`

### ⑩ 内容发布/实验
| Model | 用途 |
|---|---|
| ContentSeed | seed 注册表（hash 防误重写）|
| ContentRelease | 内容变更审计流水 |
| Experiment | A/B 实验定义 |
| ExperimentExposure | 实验曝光快照（一次写入）|

### ⑪ 笔记/高亮/反馈
| Model | 用途 | 关联 |
|---|---|---|
| Note | 笔记（挂课时 · 私有/班级 · markdown · 锚点）| →user/lesson/reports |
| NoteReport | 笔记举报（班级共享审核）| →note/reporter |
| Highlight | 课时高亮（4 色 · 段落+字符锚点）| →user/lesson |
| Feedback | 应用内反馈（suggestion/bug/praise · admin 回复）| →user |

枚举：`FeedbackKind` `FeedbackStatus`

### ⑫ 其他（藏历/法会/画报/成就/公告）
| Model | 用途 |
|---|---|
| TibetanDay | 藏历对照（功德日/法会标签）|
| HomePoster | 首页月度画报 |
| DharmaAssembly | 法会/系统活动（≈能力 15 展示侧）|
| UserAchievementUnlock | 成就解锁记录 |
| SystemAnnouncement | 系统公告（severity/撤回/指纹/dismissal）|
| OrphanedFile | 孤儿文件回收（7 天延迟物理删）|

---

## 二、新设计将新增的表（不在上表，见 08 §三 / 03 §3）
Program 体系 · ProgramAdvancementConfig · UserRoleAssignment · RoleAssignmentHistory · TransmissionRecord · StudentSpecialStatus · CareWatchlistItem · ClassInviteCode · AssistantAssignment · SemesterSnapshot · ReportConfession · AdvancementCheck · AdvancementRecord · EnrollmentStatusHistory · ClassSessionSchedule · ClassTask · LeaveRequest · 出勤 attendance · AI 4 张(⏸)。

---

## 三、统计
- 现状：**61 model · 23 enum**
- 新设计新增：§三新建区 15 张 + 出勤机制 + AI 4 张(⏸)
- 详细字段级设计见 `decisions/08-merged-design`

---

## 变更记录
| 日期 | 内容 |
|---|---|
| 2026-05-31 | 创建数据模型总图；61 model 分 12 域 + 23 enum；标注 PracticeLog/PracticeEntry 命名差异、观修双轨 |
