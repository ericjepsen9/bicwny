# 三殊胜整合设计 · 决策记录

> 按讨论组顺序记录，每组确认后更新。  
> 业务规则来源：三殊胜测试场景文档（业务语言版）+ 逐组讨论确认。  
> 最终方案文档将基于此文件生成。  
> ✅ 已确认 · ⏸ 延后 · ❌ 不做 · 🔲 待用户确认

---

## 第 1 组：组织架构基础 ✅ 已确认

| 内容 | 决定 | 备注 |
|---|---|---|
| Academy 表 | ❌ 不建 | Program 上预留 `academyId String?` 字段 |
| Program 表 | ✅ 建轻量版 | 字段：id / name / code（唯一）/ description / academyId（可空） |
| ClassAdmin 表 | ✅ 新建 | 字段：classId / userId / role(zhumai\|aixin) / assignedAt / assignedBy |
| 现有 ClassMember.role | 保留字段 | Migration 时将现有 coach 数据迁移到 ClassAdmin 表，role=zhumai |

---

## 第 2 组：班级与成员管理

### 2A · 成员状态机 ✅ 来自测试场景文档

| 状态 | 触发场景 | 决定 |
|---|---|---|
| `active` | 入班默认 / 从 paused 恢复 | ✅ 保留 |
| `paused` | 师兄请假停学（自助，无审批） | ✅ 做 |
| `held_back` | 留级，跟不上当前班 | ✅ 做（含 heldBackCount 计数）|
| `graduated` | 完成科系全部课程 | ✅ 做（含 graduatedAt 时间戳）|
| `left` | 退班（替代现有 removedAt） | ✅ 做 |

**DB 改动**：`ClassMember` 新增 `cohortStatus / heldBackCount / statusChangedAt / statusChangedBy / statusChangeReason / graduatedAt`，`removedAt` 字段保留不删（旧数据兼容）。

### 2B · 主班标识 ✅ 来自测试场景文档

- 一个师兄可同时在多个班（都 active）
- 任一时刻只有一个主班（`isPrimary = true`，应用层保证唯一）
- 换主班：先把旧主班 isPrimary 改为 false，再设新主班 true（事务操作）

**DB 改动**：`ClassMember` 新增 `isPrimary Boolean @default(false)`，不用数据库唯一索引，由应用层保证。

### 2C · 班级时区 ✅ 已确认

- ✅ 有跨时区班级（如北京班、纽约班同时运营）
- **DB 改动**：`Class` 新增 `city String?` + `timezone String?`（IANA 格式，如 `America/New_York`）
- 共修/讲考场次时间按 `Class.timezone` 显示给师兄
- 自学师兄用设备时区，无班级时区约束

### 2D · 学号自动生成 ✅ 来自测试场景文档

- 格式：`{年份4位}{序号3位}`，如 `2026001`
- 新注册：后端自动生成（事务保证序号唯一）
- 老学员批量植入：传入原学号，**系统不覆盖**，保留原值
- **DB 改动**：`User` 新增 `studentId String? @unique`

---

## 第 3 组：双模式学习

### 3A · 三种学习模式 ✅ 来自测试场景文档

| 模式 | 说明 |
|---|---|
| `class` | 跟班学习，进度由班级 startDate + 休息周算法决定 |
| `self_study` | 自学，个人 startDate + 个人休息周，独立进度 |
| `both` | 同时跟班学习某科系 + 自学另一科系 |

**DB 改动**：`User` 新增 `learningMode LearningMode @default(class)`

### 3B · 课程进度算法 ✅ 来自测试场景文档

**核心公式**：`当前课时号 = 自然周数 - 该日期之前的休息周数`

| 验证场景 | 结果 |
|---|---|
| 开班当周 | 第 1 课 |
| +2 周（无休息） | 第 3 课 |
| +8 周（无休息） | 第 9 课 |
| +2 周，中间 1 个休息周 | 第 2 课（休息周后整体后移）|
| +8 周，中间 1 个休息周 | 第 8 课 |
| 休息周之前的进度 | 不受影响 |

**实现**：后端 TypeScript 函数（非 SQL 函数），入参 `(classId, targetDate)`，返回 `lessonNumber`。

### 3C · 班级休息周 ✅

- 新增 `CohortRestWeek` 表（classId / restStartDate / reason / createdBy）
- Admin 在后台增删休息周，前端实时重算当前课时号

### 3D · 自学模式 ✅

- 新增 `UserSelfStudyProgram` 表（userId / programId / startDate / pace / status）
- 新增 `UserSelfStudyRestWeek` 表（个人休息周）
- 自学进度算法与班级算法相同，但用个人 startDate 和个人休息周

---

## 第 4 组：课程内容扩展

### 4A · 密法零痕迹 ✅ 来自测试场景文档（高优先）

- 未授权师兄：**所有查询（列表、搜索、关联）都不返回密法课程**，不是"看到但打不开"
- 后端实现：所有涉及 Course 的查询，若 `isTantric=true` 则验证 TantricAccessGrant，无记录直接过滤
- 授权：Admin 直接在后台 INSERT TantricAccessGrant（无申请、无审批流程）
- **DB 改动**：`Course` 新增 `isTantric Boolean @default(false)` + 新增 `TantricAccessGrant` 表

### 4B · 多讲者结构 ✅

- 新增 `LessonResource` 表（lessonId / speakerName / videoUrl / audioUrl / notes / sortOrder）
- 替代现有 Lesson 上的固定 teacher 槽位，但原有字段**保留不删**（存量数据兼容）

### 4C · 课程法本原文 ✅

- `Lesson` 新增 `sourceText String?`（法本原文正文）
- 现有 `referenceText` 字段**保留不废弃**

### 4D · 排表模板系统 ✅

新增 6 张表：`ProgramSemester / ProgramWeek / ProgramWeekCourse / ProgramWeekPractice / ProgramWeekSelfStudy / ProgramStudyType`

### 4E · 18 本自学读物 ✅

- 新增 `SelfStudyBook` 表（bookNumber / title / author）
- 新增 `SelfStudyRecord` 表（userId / classId? / bookId / status）
- 新增 `ProgramWeekSelfStudy` 表（周 ↔ 书的映射）

### 4F · 观修引导内容 ✅

- 新增 `PracticeGuide` 表（practiceId / contentNumber / title / videoUrl / guideText）
- 92修法打卡**必须**选 contentNumber（practiceGuideId 不可为空）

---

## 第 5 组：闻思打卡系统

### 5A · StudyRecord 统一闻思打卡 ✅

新增 `StudyRecord` 表，studyType 枚举：

| 类型 | 说明 |
|---|---|
| `listen` | 听课 |
| `read_notes` | 读讲记 |
| `speaking_present` | 讲考：主讲 |
| `speaking_question` | 讲考：提问 |
| `speaking_observe` | 讲考：旁听 |
| `group_attend` | 共修：出席 |
| `group_absent` | 共修：缺席 |
| `group_review` | 共修：复习 |
| `group_summary` | 共修：总结 |

讲考 3 种类型互斥（三选一）；共修 attend/absent 互斥（二选一）。

### 5B · 讲考场次 ✅ 来自测试场景文档

- 4 种状态：空白（未参与）/ 主讲 / 提问 / 旁听
- 新增 `SpeakingSession` 表（classId / lessonId / sessionEndAt / createdBy）
- `StudyRecord` 通过 `speakingSessionId` 关联具体场次

### 5C · 共修场次 ✅

- 复用现有 `ClassSession` 表，新增 `lessonId String?` + `sessionEndAt DateTime?` 字段
- 不新建 group_sessions 表

### 5D · 审核态机制 ✅ 来自测试场景文档

- **规则**：打卡默认 `isConfirmed=false`（师兄可随时改/删）
- **主麦确认后**：`isConfirmed=true`，师兄不能再修改
- **适用范围**：`StudyRecord` + `PracticeLog` 各加 3 字段（isConfirmed / confirmedAt / confirmedBy）
- 可取消确认（每次操作写 AuditLog）

---

## 第 6 组：修持系统

### 6A · 修持愿系统（7 态状态机）✅

新增 `UserPracticeVow` 表，7 个状态：
`on_track / slightly_behind / falling_behind / at_risk / will_overdue / completed / paused`

愿的来源（VowSource）：
- `auto`：入班时按班级模板自动创建，主麦可见
- `custom`：师兄自发创建，**主麦不可见**

### 6B · 愿的可见性规则 ✅ 来自测试场景文档

| 场景 | 规则 |
|---|---|
| 师兄看自己的愿 | ✅ 全部可见（auto + custom） |
| 主麦看本班 auto 愿 | ✅ 可见 |
| 主麦看本班 custom 愿 | ❌ 不可见（个人愿对主麦私密）|
| 跨班任何人 | ❌ 不可见 |
| 实现方式 | 应用层中间件（非 RLS） |

### 6C · 到期日变更权限 ✅ 来自测试场景文档

| 操作 | 主麦 | 师兄自己 |
|---|---|---|
| 改 auto 愿到期日 | ✅ 可以（自动写 AuditLog）| ❌ 不行 |
| 改 custom 愿到期日 | ❌ 不行 | ✅ 可以 |
| 改 auto 愿每日目标量（节奏）| ✅ 可以 | ✅ 可以（节奏自主原则）|
| 改 custom 愿每日目标量 | ❌ 不行（无权看 custom 愿）| ✅ 可以 |
| 所有改动 | 自动写 AuditLog | 自动写 AuditLog |

### 6D · 座次计算规则 ✅ 已确认

| 时长 | 座次 |
|---|---|
| ≥ 30 分钟 | 1 座 |
| ≥ 15 分钟（< 30 分钟）| 0.5 座 |
| < 15 分钟 | 0 座 |

> 以 DB_DIFF 阈值为准（30/15 分钟），测试场景文档的 45/20 数值为举例，非阈值。

### 6E · 修持打卡（PracticeLog）✅

- 新增 `PracticeLog` 表，每条打卡必须关联一条愿（vowId 非空）
- 92修法打卡：`practiceGuideId` **必填**（选第几法）
- 同日可多次打卡（sessionAttempt 记录当日第几次）

### 6F · 修持日记（PracticeJournal）✅

- 新增 `PracticeJournal` 表，每人每天最多 1 篇（`@@unique([userId, journalDate])`）
- 与现有 `Note`（课时笔记）并存，用途不同：
  - `Note`：绑定课时的学习笔记
  - `PracticeJournal`：每日修持反思（不绑课时，绑日期）
- 可见性：`private`（默认）/ `visible_to_coach`

### 6G · 愿暂停/恢复 ✅ 来自测试场景文档

- 师兄**自助**暂停愿（无需审批）：`status=paused`，记录 `pausedAt / pausedBy / pausedReason`
- 师兄**自助**恢复：`status=active`，记录 `resumedAt`

### 6H · 修持模板 ✅

- 新增 `PracticeTemplate` 表（admin 管理，班级绑定后自动建愿）
- 新增 `CohortRecommendedTemplate` 表（班级 ↔ 模板绑定）

---

## 第 7 组：集体功能

### 7A · 集体回向 ✅ 来自测试场景文档

**法会回向规则**：
- 多人的愿挂同一法会（eventId）→ 回向总数 = 各人打卡之和
- 参与人数统计正确
- **密法的愿（isTantric=true 的课程对应的愿）不计入集体回向总数**
- 实现：`v_event_dedication_totals` SQL 视图 + `WHERE vow.practiceProject.isTantric = false`

**每周回向**：聚合全班 + 全会层总数，`v_weekly_dedication_totals` SQL 视图。

### 7B · 约修系统 ✅ 来自测试场景文档

- 新增 `PracticeAppointment` 表（发起人 / classId? / 目标量 / 修法）
- **N 人加入 = N 条 custom 愿**（每人各建一条，互不关联）
- 打卡走现有愿系统，累计正确（13k + 13k + 14k = 40k）
- 无审批、无推送、不比先后

### 7C · 三殊胜精神框架 ✅

- `User` 新增 `preferShowFaxin Boolean @default(true)`（打卡前发心语开关）
- 打卡后可选回向（前端 UI，可选，无新增表）
- 集体回向统计：累计修量以"可回向功德"视角展示

### 7D · 打卡报数文本生成 ✅

- 打卡后一键生成今日修持报数文字，复制到 WhatsApp
- 密法不参与生成
- **无新增表**，纯前端功能

---

## 第 8 组：管理功能

### 8A · 思考题参考答案 ✅

- 新增 `QuestionReference` 表（questionId / referenceText / publishedAt / publishedBy）
- 师兄**提交答案后**才能查看参考答案（应用层控制）
- 参考答案全局唯一（`@unique questionId`），仅 admin 可修改
- 师兄修改答案：**无限次，不记次数**（明确原则）

### 8B · 掉队检测 ✅

- 4 级状态：`on_track / slightly_behind / falling_behind / at_risk`（VowStatus 的子集）
- 纯 SQL/应用层规则计算，非 AI
- 状态仅管理者（主麦/爱心）可见，师兄端完全不显示
- 触发逻辑：闻思 ≥4 周无进度 → at_risk；修持指标不足 → at_risk

### 8C · 关怀跟进记录 ✅

- 新增 `CareFollowup` 表（studentId / classId / careWorkerId / contactedAt / summary / followUpStatus）
- 师兄端**完全不可见**（应用层严格过滤）
- 仅爱心师兄（ClassAdmin.role=aixin）可填写

### 8D · 批量补录 ✅

- 师兄可批量勾选多节课的 `listen / read_notes` 类型补录（每学期 2 次机会）
- **仅限闻思类**，修持类不允许补打（原则 6）
- **无新增表**，前端功能 + 后端批量写入 StudyRecord

### 8E · 班级周汇总缓存 ✅

- 新增 `CohortWeeklySummary` 表（classId / weekStartDate / summaryData Json / sharedBy）
- 主麦生成后可复制到 WhatsApp

### 8F · 无障碍标记 ✅ 来自测试场景文档

- `User` 新增 `accessibilityNeeds String[] @default([])`
- 取值约束：`['blind', 'deaf']`（应用层校验）

### 8G · 数据来源标记 ✅

- `User` 新增 `dataSource String @default("self_register")`
- 取值：`self_register / imported / admin_created`

---

## 业务规则约束汇总（来自测试场景文档）

> 这些规则需要在后端实现，不依赖数据库 RLS（我们用应用层中间件）。

### 权限红线（必须在 API 层实现）

| 规则 | 实现位置 |
|---|---|
| 师兄只能看自己的愿 | API 中间件：where userId = currentUser |
| 跨班师兄互不可见愿 | API 中间件：验证 classId 归属 |
| 主麦只能看本班 auto 愿，不能看 custom 愿 | API 中间件：where source=auto AND classId=班级 |
| 主麦不能跨班 | API 中间件：验证 ClassAdmin 记录 |
| 密法完全不出现在未授权师兄的任何查询中 | 所有 Course 查询加 tantric 过滤 |
| 关怀记录对师兄完全不可见 | CareFollowup 路由仅限 aixin 角色 |
| 掉队状态仅管理者可见 | VowStatus 字段在师兄端 API 不返回 |

### 数据完整性约束

| 规则 | 实现位置 |
|---|---|
| 同一时刻只有一个主班 | 应用层事务：更新前先清除旧主班 |
| 92修法打卡必须选第几法 | 后端 Zod schema：practiceGuideId required when practiceType=92修法 |
| 讲考三选一互斥 | 后端校验：同一场次同一人只能有一条 |
| 共修 attend/absent 二选一互斥 | 后端校验：同一场次同一人只能有一条 |
| 每日日记一人一天只能一篇 | DB 唯一索引：@@unique([userId, journalDate]) |
| 学号全局唯一 | DB 唯一索引：studentId @unique |

---

## 改动量汇总（实时更新）

### 数据库改动

| 类型 | 数量 | 内容 |
|---|---|---|
| 新增枚举 | 7 个 | ClassAdminRole / LearningMode / CohortMemberStatus / VowStatus / VowSource / PracticeMeasurement / ProfileStatus |
| 现有表新增字段 | 7 张表 | User(+7) / Class(+4) / ClassMember(+7) / Course(+2) / Lesson(+1) / ClassSession(+2) / UserCourseEnrollment(+3) |
| 新增表 | 29 张 | 见各组 |
| 新增 SQL 视图 | 2 个 | v_event_dedication_totals / v_weekly_dedication_totals |
| 现有表不动 | 50+ 张 | 所有现有功能保留 |

### 新增表清单

| 分类 | 表名 |
|---|---|
| 组织层级 | Program |
| 班级管理员 | ClassAdmin |
| 双模式学习 | CohortRestWeek / UserSelfStudyProgram / UserSelfStudyRestWeek |
| 课程内容 | LessonResource / PracticeGuide |
| 修持愿 | PracticeTemplate / CohortRecommendedTemplate / UserPracticeVow / PracticeLog |
| 闻思打卡 | StudyRecord / SpeakingSession / PracticeJournal |
| 思考题 | QuestionReference |
| 排表模板 | ProgramSemester / ProgramWeek / ProgramWeekCourse / ProgramWeekPractice / ProgramWeekSelfStudy / ProgramStudyType |
| 自学读物 | SelfStudyBook / SelfStudyRecord |
| 集体功能 | Event / PracticeAppointment / CareFollowup |
| 权限控制 | TantricAccessGrant |
| 汇总缓存 | CohortWeeklySummary |

### 无新增表的功能（纯前端/后端逻辑）

| 功能 | 说明 |
|---|---|
| 打卡报数文本生成 | 纯前端 |
| 批量补录 | 前端 + 后端批量写入 |
| 打卡后回向 UI | 纯前端 |
| 掉队检测计算 | 后端定时任务，结果写 VowStatus |
| 发心语开关 | 用 User.preferShowFaxin 字段 |

---

## 一致性核查与冲突决议

> 方案生成后，对照现有 schema 做的整体核查，发现 5 处与现有表的重叠冲突，逐个决议。

### 冲突 1 · 修持系统三轨重叠 ✅ 已决议

**问题**：新建的 `UserPracticeVow / PracticeLog` 与现有 `PracticeTask / PracticeGoal / PracticeEntry / PracticeDailySummary` 高度重叠。

**决议：采用 A 方案（新建独立表），不扩展现有表。**

理由：
1. 现有 `PracticeTask` 在 scope=class 时是"一行管全班"，而 auto 愿需"每人一条 + 独立状态机"，结构性矛盾，扩展无法解决
2. 愿是多场景的（班级/法会/约修/个人），现有 PracticeTask 只有 user/class 两种 scope，根本容不下法会、约修
3. 复用 PracticeEntry 会污染现有排行/streak/日聚合查询（生产数据，回归风险高）
4. 新建表 → 现有功能零回归

**愿的多态设计**：一张 `UserPracticeVow` 表 + `VowContext` 枚举，不拆多表。

```prisma
enum VowContext {
  class        // 班级修学愿
  event        // 法会愿
  appointment  // 约修愿
  personal     // 纯个人愿
}
```

两个正交维度：
- `source`（auto/custom）= 怎么建的
- `context`（class/event/appointment/personal）= 为什么发、挂在哪

按 context 填对应可空外键（classId / eventId / appointmentId），应用层校验。

**可见性矩阵**：

| context | 本人 | 主麦 | 公开聚合 |
|---|---|---|---|
| class（auto）| ✅ | ✅（掉队检测）| ❌ |
| class（custom）| ✅ | ❌ | ❌ |
| event（法会）| ✅ | ❌ 不看个体 | ✅ 只显总量+人数 |
| appointment | ✅ | ❌ | ✅ 约修总量 |
| personal | ✅ | ❌ | ❌ |

**生命周期**：
- class：班级 startDate + 模板 offset，主麦可改到期日
- event：跟 Event.startDate ~ endDate，法会结束愿自动 completed
- appointment：跟约修 scheduledDate
- personal：师兄自管

**法会愿计数模型：模型 1（独立专属发心）** ✅
- 法会愿是单独一笔愿，单独打卡，不与班级愿混算
- `PracticeLog.vowId` 保持单一外键（一条打卡归属一个愿）
- 集体回向 = 挂同一 eventId 的愿之和（密法愿不计入）

**法会愿来源**：以师兄自愿发（custom+event）为主，admin 派发全班（auto+event）能力由 source 维度天然支持，纯功能开关，不影响表结构。

### 冲突 2 · 观修系统双轨 🔲 待讨论

> Meditation/MeditationSession（现有，含班级排行）vs PracticeGuide/PracticeLog（新，92修法打卡）

### 冲突 3 · 自学模式重复 🔲 待讨论

> UserCourseEnrollment 加字段 vs 新建 UserSelfStudyProgram，二选一

### 冲突 4 · 班级绑课 vs 绑科系 🔲 待讨论

> Class.courseId（一班一课）vs Class.programId（一班一科系多门课）

### 冲突 5 · PracticeProject.scope 与愿 🔲 待讨论

> 现有 PracticeProject.scope（user/class）与愿的 classId 概念重叠

---

## 待确认事项

> 8 组讨论已全部确认。冲突核查中：冲突 1 已决议，冲突 2-5 待讨论。
