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
| ClassAdmin 表 | ✅ 新建（A3 更新）| RBAC flags 结构，见 A3 节；原 role(zhumai\|aixin) 枚举废弃 |
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

- ✅ 一个师兄可同时在多个班（都 active）
- ✅ 任一时刻只有一个主班（`isPrimary = true`，应用层保证唯一）
- ✅ 换主班：先把旧主班 isPrimary 改为 false，再设新主班 true（事务操作）

**DB 改动**：`ClassMember` 新增 `isPrimary Boolean @default(false)`，不用数据库唯一索引，由应用层保证。

### 2C · 班级时区 ✅ 已确认

- ✅ 有跨时区班级（如北京班、纽约班同时运营）
- ✅ **DB 改动**：`Class` 新增 `city String?` + `timezone String?`（IANA 格式，如 `America/New_York`）
- ✅ 共修/讲考场次时间按 `Class.timezone` 显示给师兄
- ✅ 自学师兄用设备时区，无班级时区约束

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

- ✅ 新增 `LessonResource` 表（lessonId / speakerName / videoUrl / audioUrl / notes / sortOrder）
- ✅ 替代现有 Lesson 上的固定 teacher 槽位，但原有字段**保留不删**（存量数据兼容）

### 4C · 课程法本原文 ✅

- ✅ `Lesson` 新增 `sourceText String?`（法本原文正文）
- ✅ 现有 `referenceText` 字段**保留不废弃**

### 4D · 排表模板系统 ✅

新增 6 张表：`ProgramSemester / ProgramWeek / ProgramWeekCourse / ProgramWeekPractice / ProgramWeekSelfStudy / ProgramStudyType`

### 4E · 18 本自学读物 ✅

- 新增 `SelfStudyBook` 表（bookNumber / title / author）
- 新增 `SelfStudyRecord` 表（userId / classId? / bookId / status）
- 新增 `ProgramWeekSelfStudy` 表（周 ↔ 书的映射）

### 4F · 观修引导内容 ❌ 已被冲突 2 覆盖

> ~~新增 `PracticeGuide` 表（practiceId / contentNumber / title / videoUrl / guideText）~~  
> ~~92修法打卡必须选 contentNumber（practiceGuideId 不可为空）~~
>
> **冲突 2 决议**：删除 PracticeGuide 表，功能并入 `Meditation`（新增 `seriesKey / seriesNumber` 字段）。92修法"第几法"通过 `PracticeLog.meditationId` 关联 Meditation 表。

---

## 第 5 组：闻思打卡系统

### 5A · StudyRecord 统一闻思打卡 ✅

新增 `StudyRecord` 表，studyType 枚举：

| 类型 | 说明 | |
|---|---|---|
| ~~`listen`~~ | ~~听课~~ | ❌ 已移除（新逻辑：轻量完成标记，不走 StudyRecord，见"新逻辑"节）|
| ~~`read_notes`~~ | ~~读讲记~~ | ❌ 已移除（同上）|
| `speaking_present` | 讲考：主讲 | ✅ |
| `speaking_question` | 讲考：提问 | ✅ |
| `speaking_observe` | 讲考：旁听 | ✅ |
| `group_attend` | 共修：出席 | ✅ |
| `group_absent` | 共修：缺席 | ✅ |
| `group_review` | 共修：复习 | ✅ |
| `group_summary` | 共修：总结 | ✅ |

讲考 3 种类型互斥（三选一）；共修 attend/absent 互斥（二选一）。  
**StudyRecord 最终只覆盖讲考 + 共修，内容消费（听/读/观修）走轻量标记，不审核。**

### 5B · 讲考场次 ✅ 来自测试场景文档

- ✅ 4 种状态：空白（未参与）/ 主讲 / 提问 / 旁听
- ✅ 新增 `SpeakingSession` 表（classId / lessonId / sessionEndAt / createdBy）
- ✅ `StudyRecord` 通过 `speakingSessionId` 关联具体场次

### 5C · 共修场次 ✅

- 复用现有 `ClassSession` 表，新增 `lessonId String?` + `sessionEndAt DateTime?` 字段
- ❌ 不新建 group_sessions 表

### 5D · 审核态机制 ✅ 来自测试场景文档

- ✅ **规则**：打卡默认 `isConfirmed=false`（师兄可随时改/删）
- ✅ **主麦确认后**：`isConfirmed=true`，师兄不能再修改
- ✅ **适用范围**：`StudyRecord` + `PracticeLog` 各加 3 字段（isConfirmed / confirmedAt / confirmedBy）
- ✅ 可取消确认（每次操作写 AuditLog）

---

## 第 6 组：修持系统

### 6A · 修持愿系统（7 态状态机）✅

新增 `UserPracticeVow` 表，7 个状态：
`on_track / slightly_behind / falling_behind / at_risk / will_overdue / completed / paused`

**状态触发条件**（B2 补充，打卡后实时重算）：

| 状态 | 触发条件 | 标注 |
|---|---|---|
| `completed` | 累计打卡量 ≥ 愿目标总量 | ✅ |
| `paused` | 师兄手动暂停，不参与计算 | ✅ |
| `on_track` | 当前进度 ≥ 预期进度 90% | ⏸ 阈值上线前可调 |
| `slightly_behind` | 当前进度 70–89% | ⏸ 阈值上线前可调 |
| `falling_behind` | 当前进度 50–69% | ⏸ 阈值上线前可调 |
| `at_risk` | 当前进度 < 50% | ⏸ 阈值上线前可调 |
| `will_overdue` | 按近 7 天日均速度，预计完成日 > 到期日 | ⏸ 时间窗口上线前可调 |

> 预期进度 = `(今日 − 愿开始日) / 愿总天数 × 目标总量`  
> **`will_overdue` 优先级最高**：`UserPracticeVow.status` 为单值字段，同时满足多个条件时，优先级顺序为 `will_overdue > at_risk > falling_behind > slightly_behind > on_track`，条件消失后自动回退。  
> 任何时候加速打卡（包括一天完成全部愿量）→ 下次打卡后立即重算 → 可直接跳 `completed`。

**两套独立系统说明**（避免混淆）：

| 系统 | 计算对象 | 触发方式 | 面向谁 |
|---|---|---|---|
| 愿状态（本节 7 态）| 单条愿的完成进度 | 打卡后实时重算 | 师兄自己 |
| 掉队检测（8B 4 态）| 学员在班级的综合状态 | 每日凌晨定时任务 | 主麦/爱心 |

两者状态名相同（on_track/at_risk 等）但语义不同，互不影响。

**重算触发点**（✅ 全部做）：
- 每次提交 PracticeLog 后
- 主麦修改愿的到期日（6C）后
- 师兄暂停/恢复愿（6G）后
- 补录历史打卡后

**进度计算口径**：
- ✅ 未确认（isConfirmed=false）的打卡**立即计入进度**（乐观计算，不等主麦确认）
- ❌ 不做"仅确认后才计入"逻辑（避免师兄困惑：刚打完进度没动）

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

### 6E · 修持打卡（PracticeLog）✅（部分被冲突 2 覆盖）

- 新增 `PracticeLog` 表
- ~~每条打卡必须关联一条愿（vowId 非空）~~ → **vowId 可空**（冲突 2：支持日常裸打卡 + 随喜参与法会，不强制先发愿）
- ~~92修法打卡：`practiceGuideId` 必填~~ → **改为 `meditationId` 可空**，指向 Meditation.seriesNumber（冲突 2：PracticeGuide 删除）
- 同日可多次打卡（`source` 字段记录 manual/bulk/tap/shake）
- 完整结构见冲突 2 § PracticeLog 自描述模型

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

### 8B · 掉队检测 ✅（阈值上线前确认）

- 4 级状态：`on_track / slightly_behind / falling_behind / at_risk`（VowStatus 的子集）
- 纯 SQL/应用层规则计算，非 AI
- 状态仅管理者（主麦/爱心）可见，师兄端完全不显示
- **检测频率**：每日凌晨定时任务，自动写入（独立于愿状态的实时重算，见 6A）
- **修持达标率**：实际打卡量 / 本班设定目标量（非全局绝对值）

**阈值（默认值，⏸ 上线前可调整）**：

| 状态 | 触发条件 |
|---|---|
| `on_track` | 近 2 周修持达标率 ≥ 70% |
| `slightly_behind` | 近 2 周达标率 50–69% |
| `falling_behind` | 近 3 周达标率 < 50% |
| `at_risk` | ≥ 4 周闻思无进度，或近 2 周修持达标率为 0 |

**可配置性**：admin 后台 + 主麦端可覆盖本班阈值（⏸ 具体 UI 和 DB 字段上线前讨论）。

### 8C · 关怀跟进记录 ✅

- 新增 `CareFollowup` 表（studentId / classId / careWorkerId / contactedAt / summary / followUpStatus）
- 师兄端**完全不可见**（应用层严格过滤）
- 仅 `canCareFollowup=true` 的 ClassAdmin 可填写（A3 更新：原 role=aixin 改为权限 flag）

### 8D · 批量补录 ✅（部分被新逻辑覆盖）

- ~~师兄可批量勾选多节课的 `listen / read_notes` 类型补录（每学期 2 次机会）~~
- **新逻辑覆盖**：`listen / read_notes` 已从 StudyRecord 移除，改为轻量完成标记（随时可点，无审核）
- ✅ 批量补录改为：批量勾选多节课，一次性写入轻量完成标记（`LessonReadingProgress.isCompleted` 等）
- ❌ 每学期 2 次机会限制**不再适用**——轻量标记无审核，无需次数约束
- ✅ **仅限闻思类**，修持类不允许补打（原则保留）
- ✅ **无新增表**，前端 + 后端批量写入轻量完成字段

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
| 新增枚举 | 6 个 | LearningMode / CohortMemberStatus / VowStatus / VowSource / PracticeMeasurement / ProfileStatus（ClassAdminRole 已废弃，改为 flags）|
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
| 课程内容 | LessonResource |
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
- `PracticeLog.vowId` 单一外键，一条打卡最多归属一个愿
  - 注：冲突 2 后细化为**可空**（支持日常裸打卡 + 法会随喜），详见冲突 2 决议
- 集体回向 = 挂同一 eventId 的打卡之和（密法不计入）

**法会愿来源**：以师兄自愿发（custom+event）为主，admin 派发全班（auto+event）能力由 source 维度天然支持，纯功能开关，不影响表结构。

### 冲突 2 · 观修系统双轨 + 打卡统一模型 ✅ 已决议

**问题**：92修法内容用现有 Meditation 还是新建 PracticeGuide？打卡用 MeditationSession 还是 PracticeLog？打卡是否必须挂愿？

**决议拆三部分：**

#### (1) 内容库：扩展 Meditation，删掉 PracticeGuide 表

现有 `Meditation` 已有视频/转图PPT/章节/字幕/发布管理，新建 PracticeGuide 是更弱的平行表。92修法套进 Meditation，只补两个归组字段：

```prisma
model Meditation {
  // ... 现有字段全部保留 ...
  seriesKey    String?  // "92xiufa"，标记属于哪个修法系列
  seriesNumber Int?     // 第几法（1-92）
}
```

→ **新增表清单删除 PracticeGuide（少建 1 张表）。**

#### (2) 打卡记录：统一走 PracticeLog（方案乙）

- `MeditationSession` 是被动判定（看视频≥80%自动完成），**保留原样**用于"看引导视频进度"
- 实际修持打卡（手动补录时长/遍数）走 `PracticeLog`
- **咒语打卡也统一走 PracticeLog**：因为法会回向必须能聚合咒语，而现有 PracticeEntry 没有 vowId/eventId 接不进去；若日常走 PracticeEntry、法会走 PracticeLog 会把同一修法劈成两表
- **迁移策略**：现有 `PracticeEntry` 历史数据原地保留（老统计能读），新打卡一律写 PracticeLog，tap/shake/+10 UI 改写 PracticeLog，PracticeEntry 停止新写入逐步退役（不强删）

#### (3) 打卡不强制挂愿 · PracticeLog 自描述模型

打卡是常态行为（事后手动补录，法会时人在 Zoom/现场数完咒语再填数），不能要求"必须先发愿"。最终 PracticeLog 结构：

```prisma
model PracticeLog {
  id     String @id @default(cuid())
  userId String

  // 修什么（必填，自描述，独立于愿）
  practiceProjectId String
  meditationId      String?  // 92修法第几法（指向 Meditation）

  // 可选关联层
  vowId   String?  // 有目标才挂愿（日常裸打卡为空）
  eventId String?  // 随喜参与法会直接挂，不必发愿
  classId String?  // 班级归属（无愿也能算班级/每周回向）

  // 双计量
  count           Int?      // 遍数（咒语，最常用）
  durationMinutes Int?      // 时长（座次类）
  sessionCount    Decimal?  // 座次：≥30min=1, ≥15min=0.5, <15min=0

  source      String   @default("manual") // manual / bulk / tap / shake
  reflection  String?
  logDate     DateTime // 可补填历史日期

  // 审核态
  isConfirmed Boolean   @default(false)
  confirmedAt DateTime?
  confirmedBy String?

  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  vow  UserPracticeVow? @relation(fields: [vowId], references: [id])
}
```

**三种打卡场景全覆盖：**

| 场景 | vowId | eventId |
|---|---|---|
| 日常裸打卡 | 空 | 空 |
| 发愿修持（含法会发愿）| 有 | 有（法会愿时）|
| 随喜参与法会（不发愿）| 空 | 有 |

发愿者打卡时，把愿的 eventId 复制到打卡上，聚合永远只看 `log.eventId`。

#### (4) 法会发愿 = 挂 eventId 的愿（无独立表）

确认原需求文档设计：**没有独立的法会发愿表**，法会发愿就是 `UserPracticeVow` 的一条记录（`context=event` + `eventId`）。三层结构：

```
Event（法会）→ UserPracticeVow（发愿，挂 eventId，可选）→ PracticeLog（打卡，带 eventId）→ 视图聚合
```

#### (5) 聚合视图全部从 PracticeLog 直接读

| 回向 | 聚合方式 | 密法过滤 |
|---|---|---|
| 法会回向 | `GROUP BY eventId` | 靠 practiceProjectId → isTantric |
| 每周回向 | `GROUP BY 周, classId, practiceProjectId` | 同上 |
| 愿进度 | `GROUP BY vowId` | — |

#### (6) 产品方向 ✅ 已确认

"观修"拆成两件事，分别处理：

| 行为 | 记录表 | 计入修持 | 排行 |
|---|---|---|---|
| 看观修引导视频（被动）| `MeditationSession`（看≥80%自动完成）| ❌ 不计 | ✅ 喂班级观修排行（**保留**，将来不需要再删）|
| 做 92修法（主动修持，手动打卡时长/座次）| `PracticeLog` | ✅ 计入修持 | 不进排行 |

- **班级观修排行**：保留（基于 MeditationSession 看视频完成度，逻辑不变）
- **观修计数反转**：旧注释"观修不做计数"只对"看视频"成立；"做 92修法"计入修持大类，走 PracticeLog

### 新逻辑 · 学习完成 = 轻量手动标记（听/读/观修不审核）✅ 已决议

**背景**：学习常在 App 外发生（纸质书读法本、别处听课）。需要手动「已学完」按钮补录完成。

**决议：三类内容消费统一为轻量完成标记，方案 X（不走 StudyRecord）**

| 行为 | 落点 | 自动 | 手动按钮 | 审核 | 来源区分 |
|---|---|---|---|---|---|
| 读法本 | `LessonReadingProgress.isCompleted`（现有）| 滚动+时长达标 | 「已学习」按钮 | ❌ | ❌ |
| 观修 | `MeditationSession`（现有）| 看≥80% | 已有手动按钮 | ❌ | ❌ |
| 听课 | **新增轻量落点（待定结构）** | 听完音视频 | 「已学完」按钮 | ❌ | ❌ |

- 自动完成与手动声明**同等对待**，不分来源，即时生效，不挂 isConfirmed
- 主麦可查看完成情况（统计），但**不审核**

**连带简化：StudyRecord（审核态）收窄**
- studyType **去掉 `listen` / `read_notes`**
- StudyRecord 只覆盖：`speaking_present/question/observe`（讲考）+ `group_attend/absent/review/summary`（共修）
- 即审核态系统只管"参与类活动"，不管"内容消费"
- 影响原 Group 5A（studyType 枚举精简）/ 5D（审核范围缩小）

**待定**：听课完成的存储结构 🔲（见下方提问）

### 冲突 3 + 冲突 4 · 科系绑定 + 三层课程结构 ✅ 已决议

**判定依据**：三殊胜原设计有 `program_week_courses`（周↔课程映射）+ `get_current_lesson_number(program_id)` 算法 + 8学期×26周，证明是科系绑定（一科系跨多法本按周排）。用户确认。

**三层结构（用小学比喻）：**

| 层级 | 比喻 | 表 | 例子 |
|---|---|---|---|
| 科系 | 小学 | `Program` | 加行系 |
| 科目 | 一年级 | `ProgramSemester`（语义=科目/年级）| 一年级、二年级 |
| 法本 | 课本 | `Course` | 前行第一册、前行第二册 |

```
科系 Program
  └─ 科目 ProgramSemester（最小排课单位，直接到周，无上/下学期）
       └─ 周 ProgramWeek
            └─ ProgramWeekCourse（这周学哪本哪课）
```

**关键决定：**

1. **科目层用 ProgramSemester 承载**，不新增表。语义明确为"科目/年级"。科目是**最小排课单位**，下面直接是周（`ProgramWeek`），不再分上/下学期。

2. **法本（Course）归属到科目**：`Course` 关联 `ProgramSemester`（科目），1:N（一科目多法本）。原计划的 `Course.programId` 改为通过科目派生（或保留 programId 做冗余查询，二选一，倾向只留科目链接保持一致）。

3. **冲突 4 · 班级绑科系**：
   - `Class.programId` = 所属科系（新增，已在方案）
   - `Class.courseId` **保留**，语义变为"当前主修法本"
   - 班级从一年级起逐科目往上读，当前位置 = 当前科目 + 当前法本 + 当前课时（由 startDate + 休息周算法推出，或显式记录）

4. **冲突 3 · 自学 = 科系级**：
   - 用 `UserSelfStudyProgram`（关联 Program），自学师兄选一个科系，按个人 startDate + 个人休息周推进，算法与班级相同
   - **移除** `UserCourseEnrollment` 上原计划的 `selfStudyStartDate / selfStudyPace / selfStudyStatus` 三个字段（重复，废弃）
   - `UserCourseEnrollment` 回归原职责（课程报名/进度），不承载自学时间推进

5. **更换法本管理需求**：
   - **Admin 后台**：管理科系 → 科目 → 法本的整个组成（增删法本、调顺序、排周表）
   - **辅导员/主麦端**：在当前科目的法本里切换本班"当前主修法本"（改 `Class.courseId`）

**连带 schema 调整：**
- `ProgramSemester`：字段语义改为科目（semesterNumber → 科目序号，semesterName → 科目名）；`startsWeek/endsWeek` 作为**科系模板结构**（描述该科目持续多少周），❌ 不做跨班级全局周编号
- `Course`：加 `programSemesterId`（科目归属）；`programId` 改为派生或冗余
- `Class`：`courseId` 语义=当前主修法本（辅导员可改）；`programId`=科系；当前科目从 `courseId → Course.programSemesterId` 派生，❌ 不新增 `currentProgramSemesterId` 字段
- `UserCourseEnrollment`：去掉 selfStudy* 三字段
- 自学走 `UserSelfStudyProgram`（科系级）

**B3 · 周编号与升科目 ✅ 已确认：**
- ✅ 周编号每班独立，从本班 `startDate` 起算，不跨班共享
- ✅ 升科目 = 主麦手动操作（需 `canManageCourse` 权限），❌ 不自动触发

### 冲突 5 · PracticeProject.scope 与愿重叠 ✅ 已决议

**决议：职责分离——项目 = 修什么（无归属）；愿 = 谁为了什么在修（带归属）**

- `PracticeProject` 退回纯粹的"修法类型库"（金刚萨埵心咒就是个咒，不分班不分人）
- `PracticeProject.scope` 字段对新愿系统**不再使用**（现有数据/功能保留，新愿不依赖 scope）
- "属于谁/哪个班/什么场景"完全由 `UserPracticeVow` 表达（context + classId + userId）
- `PracticeLog.practiceProjectId` 引用的 project 视为纯类型，归属看 vow/log 自身字段

→ `PracticeProject.scope` 在新系统里是历史包袱，不影响新逻辑。

---

## 一致性核查总结 ✅ 全部完成

| 冲突 | 决议要点 |
|---|---|
| 1 修持愿三轨 | A 方案新建独立表；多态单表 UserPracticeVow + VowContext；法会愿模型1 |
| 2 观修双轨 | 内容扩展 Meditation（删 PracticeGuide）；打卡统一 PracticeLog（自描述，vowId/eventId 可空）；看视频不计/喂排行，做92修法计入 |
| 新逻辑 学习完成 | 听/读/观修轻量手动标记不审核；StudyRecord 收窄为只覆盖讲考+共修 |
| 3 自学重复 | 自学走 UserSelfStudyProgram（科系级）；去掉 UserCourseEnrollment.selfStudy* |
| 4 班级绑定 | 科系绑定；三层结构 科系/科目/法本；科目用 ProgramSemester；班级 courseId=当前主修法本可切换 |
| 5 scope 重叠 | 职责分离：项目=修什么（无归属），愿=谁为何在修（带归属）|

**新增表净变化**：原 28 张 → 删 PracticeGuide → **27 张**（PracticeGuide 功能并入 Meditation 扩展）。

---

---

## ❌ 明确不做清单（全文汇总）

> 每条都有对应章节，此处集中索引，避免重复建表或重新讨论。

| ❌ 不做 | 原因 / 替代方案 | 出处 |
|---|---|---|
| Academy 表 | 不建，Program 上预留 `academyId String?` | 第 1 组 |
| PracticeGuide 表 | 删除，功能并入 `Meditation.seriesKey/seriesNumber` | 4F / 冲突 2 |
| StudyRecord.listen 类型 | 轻量完成标记替代，不走审核态 | 5A / 新逻辑 |
| StudyRecord.read_notes 类型 | 同上 | 5A / 新逻辑 |
| group_sessions 独立表 | 复用现有 ClassSession，加两字段即可 | 5C |
| 法会发愿独立表 | 法会愿就是 UserPracticeVow（context=event），无需另表 | 冲突 1 |
| PracticeEntry 新写入 | 历史数据保留，新打卡一律走 PracticeLog | 冲突 2 |
| UserCourseEnrollment.selfStudy* 三字段 | 自学走 UserSelfStudyProgram（科系级），字段重复废弃 | 冲突 3 |
| PracticeProject.scope 在新系统使用 | 历史包袱，新愿归属完全由 UserPracticeVow 表达 | 冲突 5 |
| ClassAdminRole 枚举（zhumai/aixin）| 改为 RBAC flags，admin 后台细粒度分配 | A3 |
| 约修审批流 | 无审批、无推送、不比先后 | 7B |
| 打卡报数新增表 | 纯前端生成文字，无 DB | 7D |
| 批量补录新增表 | 前端 + 后端批量写入轻量完成字段，无新表 | 8D |
| 批量补录每学期 2 次限制 | 轻量完成标记无审核，随时可点，无需次数约束 | 8D / 新逻辑 |
| 三殊胜精神框架新增表 | 回向为前端 UI，发心语开关用 User.preferShowFaxin | 7C |

---

## 现有功能去留 ✅ 已确认

### A1 · 现有辅助功能 · 全部保留

| 功能 | 决定 |
|---|---|
| SM-2 间隔复习算法 | ✅ 保留 |
| LLM 评分 | ✅ 保留 |
| 错题本 | ✅ 保留 |
| 收藏 | ✅ 保留 |
| Web Push 通知 | ✅ 保留 |
| 全部通知逻辑 | ✅ 保留 |

### A2 · 题目系统 · 全部保留

- 14 种题型全部保留
- AI 评分全部保留
- 无任何删减

---

## A3 · 角色系统前端重构 ✅ 已确认

### 核心决定：从固定角色 → 细粒度权限 flags

**放弃方案**：固定的 `role: zhumai | aixin` 枚举。  
**采用方案**：Admin 后台直接分配子账号权限，可逐模块授权 + 指定能否编辑/删除。

### ClassAdmin 表（更新，替代第 1 组旧设计）

```prisma
model ClassAdmin {
  id      String @id @default(cuid())
  classId String
  userId  String

  // 模块权限（admin 后台逐项勾选）
  canManageMembers  Boolean @default(false)  // 成员管理
  canManageExams    Boolean @default(false)  // 讲考管理
  canAuditPractice  Boolean @default(false)  // 审核打卡
  canViewStudents   Boolean @default(false)  // 查看学员修行数据
  canCareFollowup   Boolean @default(false)  // 关怀跟进记录
  canEditGoals      Boolean @default(false)  // 编辑每日目标量
  canManageCourse   Boolean @default(false)  // 课程进度/法本切换

  // 操作级权限（全局，作用于已开放的模块）
  canEdit   Boolean @default(true)
  canDelete Boolean @default(false)

  assignedAt DateTime @default(now())
  assignedBy String?

  createdAt DateTime @default(now())
  @@unique([classId, userId])
}
```

**预设含义（参考，无需写进表）：**

| 原概念 | 对应 flags |
|---|---|
| 主麦（全权班管）| 全部 true |
| 爱心（关怀跟进）| canViewStudents + canCareFollowup = true，其余 false |
| 自定义子角色 | admin 后台任意组合 |

同一人在同一班只有一条记录（`@@unique([classId, userId])`）；跨班各自独立一条。

### 前端路由结构

**不拆分路由**：`/coach/*` 维持单一入口，UI 根据 `ClassAdmin` 权限 flags 决定显示/隐藏各模块。

```
/coach/                      落地页：列出此人是管理员的所有班级
/coach/:classId/             班级首页（显示有权限的模块列表）
/coach/:classId/members      需要 canManageMembers
/coach/:classId/exams        需要 canManageExams
/coach/:classId/audit        需要 canAuditPractice
/coach/:classId/students     需要 canViewStudents
/coach/:classId/care         需要 canCareFollowup
/coach/:classId/goals        需要 canEditGoals
/coach/:classId/course       需要 canManageCourse
```

无权限的模块：前端不渲染（隐藏），后端 API 也守卫（双重保障）。

### Admin 后台新增功能

`/admin/classes/:id/admins`：
- 搜索用户 → 加为本班管理员
- 逐模块 checkbox 勾选权限
- 设置 canEdit / canDelete
- 移除管理员

### 影响范围

| 层 | 影响 | 说明 |
|---|---|---|
| DB | 中 | ClassAdmin 结构变更（去枚举，加 9 个 boolean 字段）|
| 后端 | 大 | 所有 `/api/classes/:id/*` 辅导员接口换权限 middleware |
| 前端 | 大 | 所有 `/coach/*` 页面加 permission guard；新增 admin 权限分配 UI |
| 学员端 | 不影响 | 三端分离铁律不变 |

### 连带更新（第 1 组 ClassAdmin + 第 8 组 8C）

- 第 1 组 `ClassAdmin.role(zhumai|aixin)` 字段**废弃**，改为上述 flags 结构
- 第 8 组 `8C 关怀跟进`：访问限制从 `role=aixin` 改为 `canCareFollowup=true`

---

## 待确认事项

> 8 组讨论已全部确认。冲突核查（5处）已全部决议。A1/A2/A3 已全部确认。
>
> **剩余待讨论项：**
> - **B 类（算法细节）**：辍修检测阈值 / 愿 7 态计算阈值 / 跨科目全局周编号
> - **C 类（流程细节）**：批量导入 CSV + 学号保留 / 每学期 2 次补录限制实现 / 四层时区规则 / 精神框架放置位置
> - **听课完成存储结构**：待定（轻量落点，倾向新增 LessonCompletion 表或扩展现有字段，未最终确认）
> - **FINAL_DESIGN_SANSUSHENG.md**：需根据所有决策重新生成（当前版本为冲突决议前的旧版）
