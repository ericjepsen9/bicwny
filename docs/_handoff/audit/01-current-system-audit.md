# 现有项目审计 · 现状 vs 新设计差异清单

> 状态：进行中（2026-05-31 启动）
> 目的：判断线上现有项目实况，对照新设计（06 业务能力 1-25 / 08 融合设计）的差异，作为**后续按新设计为准进行改造**的依据。
> 铁律：**纯只读审计，不修改任何代码**。审计全部完成后再统一修订设计文档（06/08）。
> 数据源：`backend/prisma/schema.prisma`（60 model / 19 enum）、`backend/src/modules/*`（36 模块）、`juexue-v2/src`。

---

## 〇、审计方法与符号

每个审计块格式：**现状** → **与新设计差异** → **按新设计的动作**。

动作符号：
- ✅ **复用**：线上已有，新设计可直接用或基本对齐
- 🔧 **改造**：线上有基础，需扩展字段/改语义以满足新设计
- 🆕 **新建**：线上完全没有，新设计需从零建
- ⚠️ **冲突**：线上语义与新设计相悖，需决策如何处置

---

## 一、现状总览与核心结论

### 1.1 规模
- 后端：Fastify + Prisma + PostgreSQL，**60 model / 19 enum**，36 个业务模块
- 前端：React + Vite + TS（juexue-v2）
- 已是**成熟生产系统**，非空白起点

### 1.2 核心结论（重心错位）

| | 线上现有系统 | 新设计（06/08）|
|---|---|---|
| **重心** | 学员**学习体验** | 学修**体系硬规则** |
| 强项 | 题库/SM2 间隔重复/AI 判分/笔记/通用打卡/通知/成就/藏历 | 专业×届/升学/传承/报数快照/出勤/4 角色作用域 |
| 缺口 | 几乎无「升学体系」相关结构 | 缺学员体验向的精细功能 |

**一句话**：线上把「学得好不好」（答题、复习、打卡、激励）做得很深；新设计要的「修学体系怎么管」（专业进阶、升密法硬条件、传承、报数结算、多级管理）线上**几乎是空白**。改造是「在成熟学习 App 上**加装一套学修管理体系**」，不是推倒重来。

### 1.3 重大结构性缺口（线上完全无、新设计核心）
1. **专业×届体系**（Program/Major）——D2/D3 的地基，线上 Class 直绑单一 Course
2. **4 角色 + 作用域 + 权限继承**——线上是 admin/coach/student 三元，无作用域
3. **升学体系**——Exam/AdvancementCheck/AdvancementRecord 全无（能力 10）
4. **传承/灌顶**——TransmissionRecord 全无（能力 15/17）
5. **共修出勤打卡**——ClassSession 只有日程，无 attendance 记录（能力 8）
6. **报数节点快照**——SemesterSnapshot/ReportConfession 全无（能力 9）
7. **关怀/特殊身份/请假/辅助员**——CareWatchlist/StudentSpecialStatus/LeaveRequest/AssistantAssignment 全无（能力 12/13/14）

---

## 二、块②：用户 / 角色 / 权限

### 现状
- `enum UserRole { admin, coach, student }`（全局三元角色，User.role 单值）
- `enum ClassMemberRole { coach, student }`（班级内二元）
- `ClassMember`：classId + userId + role + joinedAt + removedAt（软删）
- `Class`：joinCode（**无时效**）、courseId（**直绑单一法本**）、isActive + archivedAt（**已有归档**）
- `AuthSession`（refresh token 白名单）、邮箱验证、密码重置、单设备登录 —— 基础设施完善
- `AuditLog`：已存在但简化版（adminId/action/targetType/before/after），列名 adminId

### 与新设计差异
| 新设计要素 | 现状 | 动作 |
|---|---|---|
| 4 角色 class_tutor/class_admin/subject_admin/super_admin | 仅 admin/coach/student | 🔧 角色枚举扩展；coach→拆 tutor+admin（02 文档迁移说明已预见），admin→super_admin |
| UserRoleAssignment（多角色+作用域） | User.role 单值，无作用域表 | 🆕 新建 UserRoleAssignment（role+scope+granted*+expires*） |
| 作用域（class_id / major_id） | 无 | 🆕 随上表 |
| 权限继承（等级数值比较） | coach/admin 硬判断散落各模块 | 🔧 引入 ROLE_LEVEL，逐处审查「是不是 coach/admin」改等级判定（02 文档已警示） |
| RoleAssignmentHistory（任命留痕） | 无 | 🆕 新建 |
| subject_admin（学科级跨班） | 无此层级 | 🆕 全新角色层 |
| AuditLog 完整版（能力 20，11 类操作）| 简化版（adminId 单列）| 🔧 扩展字段（operator/scope/reason 等），语义对齐 |

### 关键判断
- 线上 **coach = class_tutor + class_admin 合体**（02 文档迁移说明已写明），改造时按新设计拆为双角色或映射等级
- Class.archivedAt 已满足 D19 归档原则（无需新建，🔧 微调对齐 status 字段）

---

## 三、块③：专业体系 与 学修核心（闻思）

### 现状
- `Course`/`Chapter`/`Lesson`/`LessonResource`（youtube/audio/video）/`LessonMediaChapter`/`LessonTextBlock` —— 法本内容体系**完善**
- `UserCourseEnrollment`：**课程级**报名（source self/class + enrolledViaClassId），非专业级
- `LessonReadingProgress`：阅读进度（滚动+停留+完成），≈ 闻思「看」维度
- `Question`（14 题型含 open AI 判分）/`UserAnswer`（aiGrade）/`Sm2Card`（SM-2 间隔重复）—— 答题体系**很深**
- `Meditation`/`MeditationSession`：观修=**看视频引导**（注释明确「观修不做计数」）

### 与新设计差异
| 新设计要素 | 现状 | 动作 |
|---|---|---|
| Program（专业×届，D2/D3） | **无**，Class 直绑单 Course | 🆕 新建 Program 体系（地基） |
| Lesson.courseType（entry/formal/restricted，DR-93） | 无 | 🔧 Lesson 加字段 |
| 闻思圆满判定（听≥1+看≥1+答题，能力 3） | 有阅读进度+答题，**无「听音频≥N 遍」计数判定** | 🔧 LessonCompletion 统一圆满表 + 听/看/答题聚合 |
| 身份分支路径（盲听≥2/聋看≥2，能力 3/12） | 无身份分支 | 🆕 StudentSpecialStatus + 判定分支 |
| 课程级 vs 专业级报名 | UserCourseEnrollment 课程级 | 🔧 引入专业归属（major_enrollment 语义） |
| 跨专业不豁免/共享（D14a/b） | 无专业概念故无此逻辑 | 🆕 随专业体系 |

### 关键判断
- 法本内容（Course/Lesson）、题库（Question/UserAnswer/Sm2）、阅读进度 → **大面积 ✅ 复用**，是新设计能力 3 的现成底座
- 但「圆满判定」「专业归属」「听音频计数」「身份分支」是 🆕/🔧
- 观修语义冲突见块④

---

## 四、块④：实修 / 观修 / 出勤 / 报数 / 升学（新设计核心，线上最薄弱）

### 现状
- `PracticeCategory`/`PracticeProject`/`PracticeEntry`/`PracticeDailySummary`/`PracticeGoal`/`PracticeTask`/`PracticeMakeup` —— **通用计数打卡**体系（持咒/礼拜/诵经/供曼扎），scope user/class，有日聚合+streak+补签+班级任务
- `Meditation`/`MeditationSession` —— 看视频引导（**非打坐座数统计**）
- `ClassSession` —— 共修**排课/日程**（startAt/liveLink/editVersion ack 通知），**无 attendance**
- 升学 / 传承 / 关怀 / 请假 / 辅助员 / 报数快照 —— **全部无对应 model**

### 与新设计差异
| 新设计能力 | 现状 | 动作 |
|---|---|---|
| 能力 4 加行观修（92 修法，276 座+138h 双维度，DR-91）| Meditation 是看视频，⚠️ 语义完全不同 | 🆕 打坐座数+时长统计（不能复用 MeditationSession）|
| 能力 6 内加行 6 项 10 万 + 法王祈祷文独立计数（DR-95 prayerCount）| PracticeProject/Entry 通用计数可作底层 | 🔧 扩展：6 项分类、仪轨合规、prayerCount、跨专业共享 |
| 能力 7 日常打卡（频率型，跨专业不豁免）| PracticeEntry/DailySummary 已有 | 🔧 加频率类型/路径选择/专业归属 |
| 能力 8 共修出勤（链接时效+自助选自己）| ClassSession 仅日程，⚠️ **无 attendance 表** | 🆕 出勤打卡（session_instance + attendance）|
| 能力 9 报数节点快照 + 忏悔 | 无 | 🆕 SemesterSnapshot + ReportConfession；PracticeTask ≈ 辅导员布置任务（部分复用）|
| 能力 10 考试与升学 | **完全无** | 🆕 Exam/ExamGrade/AdvancementCheck/AdvancementRecord/ProgramAdvancementConfig |
| 能力 11 留级/退出/转专业 | 有退班（removeMember 软删）| 🔧 扩展 enrollment status + 历史留痕 |
| 能力 12 特殊身份 + 关怀跟进 | 无 | 🆕 StudentSpecialStatus + CareFollowupRecord |
| 能力 13 辅助员 | 无 | 🆕 AssistantAssignment |
| 能力 14 关怀清单 | 无 | 🆕 CareWatchlistItem |
| 能力 15/17 传承/灌顶 | **完全无** | 🆕 TransmissionRecord |
| 能力 19 邀请码时效 | Class.joinCode 无时效 | 🔧 新建 ClassInviteCode（expiresAt/maxUses/status，DR-80/81）|
| 请假（DR-90）| 无 | 🆕 LeaveRequest |

### 关键判断
- **这一块是改造主战场**：新设计能力 4/8/9/10/12/13/14/15/17 几乎全 🆕
- 通用打卡体系（Practice*）是能力 6/7 的可用底座（🔧 扩展），但能力 4 观修打坐**不能复用** Meditation（语义冲突，需新建）
- ⚠️ **观修语义决策点**：线上 Meditation=看视频（已上线、有用户数据），新设计能力 4=打坐座数统计。两者是否并存？看视频观修要不要保留？→ **待修订设计时决策**

---

## 五、块①：AI / LLM / 笔记（详见审计发现 #1，此处归档）

### 现状（线上已有完整 LLM 基础设施）
- `LlmProviderConfig`（多 provider minimax/claude/deepseek + 配额 + 熔断 + 成本 + 自动切兜底）
- `LlmScenarioConfig`（场景化：已有 open_grading 判分 / question_gen 出题）
- `LlmPromptTemplate`（prompt 版本管理）、`LlmProviderUsage`/`LlmCallLog`（用量+调用日志）
- `gateway.ts`/`circuit.ts`/`quota.ts` + AdminLlmPage 后台
- `notes/llm-assist.service.ts`：笔记 5 action（polish/summarize/tags/title/draft），严约束「不解释法义」

### 与新设计差异
| 新设计（能力 25）| 现状 | 动作 |
|---|---|---|
| DR-74「独立 AI 模块、从零建」假设 | ⚠️ 推翻——已有成熟 LLM 网关 | 🔧 能力 25 实现应**对接既有 gateway**（加 dharma_qa/feature_nav scenario）|
| AiUsage 用量统计 | LlmProviderUsage + LlmCallLog（更完善）| ✅ 复用 |
| 成本上限/rate limit/降级 | quota.ts + circuit.ts + overagePolicy | ✅ 复用 |
| super_admin 配置 LLM | LlmProviderConfig/ScenarioConfig + AdminLlmPage | ✅ 复用 |
| system prompt 严约束 | LlmPromptTemplate 版本管理 | ✅ 复用 |
| 25.A RAG 法义问答 | **无**（无 ContentChunk/pgvector/向量检索）| 🆕 |
| 25.B AI 代操作 | 无 | 🆕 |
| 笔记 AI 加工（第三类，TODO-AI-1）| **已上线** llm-assist 5 action | 🆕 **反向补记**：能力 25 漏了这类，建议补子能力 25.C |
| AiConversation/AiMessage 对话历史 | 无（笔记加工是无状态调用）| 🆕 |

### 关键判断（修订设计建议，待审计后统一处理）
1. **DR-74 需修订**：从「独立从零模块」改为「对接既有 LLM 网关基础设施」
2. **补能力 25.C**：笔记 AI 文本加工（已上线，反向补记）
3. **能力 25 表重估**：AiUsage 可不新建（复用 Llm*Usage/CallLog）；真正新增的只有「对话历史」+「向量索引 ContentChunk/pgvector」+「功能目录 FeatureEntry」

---

## 六、块⑤：社交 / 通知 / 附加功能

### 现状
- `ClassAnnouncement`：班级公告（**单向**，辅导员发→学员读）
- `Notification` 体系：v2 多通道（inbox/push/sms/banner）+ 频率上限 + 静默时段 + 派发去重 + 偏好 —— **非常完善**
- `Feedback`/`QuestionReport`/`NoteReport`：UGC 审核闭环
- `UserAchievementUnlock`（成就）/`Sm2Card`（复习）/`UserFavorite`（收藏）/`UserMistakeBook`（错题）/`TibetanDay`（藏历）/`DharmaAssembly`（法会信息）/`HomePoster`（画报）/`SystemAnnouncement`（系统公告）

### 与新设计差异
| 新设计能力 | 现状 | 动作 |
|---|---|---|
| 能力 22 班级动态（双向社交：发帖/评论/点赞/转发）| 仅 ClassAnnouncement 单向公告 | 🆕 ClassPost 家族 |
| 能力 23 班级讨论（话题投票）| 无 | 🆕 Discussion 家族 |
| 能力 24 约修（集体修持目标）| 无 | 🆕 PracticeAppointment（可关联现有 PracticeProject）|
| 通知体系 | 完善 | ✅ 复用（新设计未细化通知，线上更强）|
| 法会 DharmaAssembly | 信息型活动 | ✅ 复用（≈ 能力 15 法会传承录入的展示侧）|

### 关键判断
- **新设计 06/08 完全没提的「附加功能」**（成就/SM2/错题/收藏/藏历/画报/系统公告/通知体系）是线上**净资产**，新设计应**保留复用**，不应因聚焦学修体系而遗漏
- 社交三件套（能力 22/23/24）线上无，全 🆕

---

## 七、按 06 能力 1-25 的覆盖度总表

| 能力 | 线上覆盖 | 主要动作 |
|---|---|---|
| 1 阶段与专业体系 | ❌ 无 | 🆕 Program 体系（地基）|
| 2 学员加入专业 | 🟡 课程级 enrollment | 🔧 升专业级 + 🆕 邀请码时效 |
| 3 闻思学习与圆满 | 🟡 阅读+答题有，圆满判定无 | 🔧 LessonCompletion + 听计数 + courseType |
| 4 加行观修 | ⚠️ Meditation 看视频≠打坐统计 | 🆕 座数+时长（语义冲突待决）|
| 5 管理员代行 | 🟡 AuditLog 简化版 | 🔧 扩展为代行留痕体系 |
| 6 内加行 10 万 | 🟡 通用打卡可作底层 | 🔧 6 项+仪轨+prayerCount+跨专业 |
| 7 日常打卡 | ✅ Practice* 较完整 | 🔧 频率类型+专业归属 |
| 8 共修出勤 | ⚠️ ClassSession 仅日程无 attendance | 🆕 出勤打卡 |
| 9 学期报数 | 🟡 PracticeTask 部分 | 🆕 节点快照+忏悔 |
| 10 考试与升学 | ❌ 无 | 🆕 全套升学体系 |
| 11 留级/退出/转专业 | 🟡 退班软删 | 🔧 status+历史留痕 |
| 12 特殊身份关怀 | ❌ 无 | 🆕 |
| 13 辅助员 | ❌ 无 | 🆕 |
| 14 关怀清单 | ❌ 无 | 🆕 |
| 15 传承管理 | ❌ 无 | 🆕 |
| 16 传承法会 | ❌ 不做 | — |
| 17 灌顶记录 | ❌ 无 | 🆕（并入 15）|
| 18 角色与权限 | 🟡 三元角色无作用域 | 🔧 4 角色+作用域+继承 + 🆕 RoleAssignment |
| 19 班级邀请码 | 🟡 joinCode 无时效 | 🔧 ClassInviteCode |
| 20 决策审计日志 | 🟡 AuditLog 简化版 | 🔧 扩展 11 类操作 |
| 21 自学模式 | 🟡 UserCourseEnrollment.source=self | 🔧 对齐自学独立进度（DR-103/104）|
| 22 班级动态 | ❌ 仅单向公告 | 🆕 |
| 23 班级讨论 | ❌ 无 | 🆕 |
| 24 约修 | ❌ 无 | 🆕 |
| 25 AI 助手 | 🟡 LLM 网关+笔记加工已有，RAG/对话/代操作无 | 🔧 对接网关 + 🆕 RAG/对话 + 补 25.C |

统计：✅ 基本复用 ~2 · 🟡 部分（需 🔧 改造）~11 · ❌/🆕 全新 ~11 · ⚠️ 语义冲突 2（观修、AI 模块定位）

---

## 八、净资产清单（线上有、新设计未提，应保留复用）

新设计 06/08 聚焦学修体系，**遗漏了线上这些成熟功能**，改造时务必保留：
- 题库 14 题型 + open 题 AI 判分 + SM-2 间隔重复
- 通知体系 v2（多通道/频率上限/静默/去重/偏好）
- 成就解锁、收藏、错题本、笔记 + AI 加工、文本高亮
- 藏历 TibetanDay、法会信息 DharmaAssembly、首页画报、系统公告
- LLM 网关基础设施（多 provider/熔断/配额/用量/成本）
- 邮箱验证/密码重置/单设备登录/UGC 举报审核闭环

---

## 九、待修订设计的清单（审计完成后统一处理，暂不改 06/08）

> 以下是审计发现的「设计需对照实况修订」点，**先登记不执行**，全部审计块完成后统一修订 06/08。

1. **DR-74 修订**：AI 从「独立从零模块」→「对接既有 LLM 网关」（块①/⑤）
2. **补能力 25.C**：笔记 AI 文本加工（已上线，反向补记）（块①）
3. **能力 25 表重估**：AiUsage 复用 Llm*Usage/CallLog，仅新增对话历史+ContentChunk+FeatureEntry（块①）
4. **观修语义决策**：线上 Meditation 看视频 vs 能力 4 打坐统计，是否并存（块④）
5. **净资产纳入**：06 应增补「附加功能保留」说明，避免改造时遗漏（块⑤/八）
6. **迁移映射补充**：coach→tutor+admin、admin→super_admin、UserCourseEnrollment→专业级 的具体迁移路径（块②/③）

---

## 十、审计进度

| 块 | 范围 | 状态 |
|---|---|---|
| ① AI/LLM/笔记 | LLM 网关 + 笔记加工 | ✅ 完成（§五）|
| ② 用户/角色/权限 | 角色/班级/会话 | ✅ 完成（§二）|
| ③ 专业/学修核心 | Course/Lesson/Question/观修 | ✅ 完成（§三）|
| ④ 实修/出勤/报数/升学 | Practice*/ClassSession/升学传承 | ✅ 完成（§四）|
| ⑤ 社交/通知/附加 | 公告/通知/成就/藏历等 | ✅ 完成（§六）|

**Schema 层审计（60 model）已完成。** 代码层审计见 `02-code-layer-audit.md`：
- 后端权限：265 处 requireRole + 作用域雏形（PracticeProject.scope），统一改造入口 auth.ts/permissions.ts
- 前端三端：~85-90% 已达标，框架可复用，仅需 coach 端将来拆 tutor/admin
- 数据迁移：最大卡点是「专业×届归属」——现有班级缺此维度，需运营人工补

剩余可下钻（按需）：各模块更细的业务逻辑、前端组件级、具体迁移脚本设计。

---

## 变更记录

| 日期 | 内容 |
|---|---|
| 2026-05-31 | 创建审计文档；完成 schema 层全 60 model 审计（块①-⑤）；产出能力 1-25 覆盖度总表、净资产清单、待修订设计清单 |
