# 觉学 · 改造修改方案（现状 → 最终设计）

> 状态：进行中（2026-05-31 创建）
> 定位：**从线上现状到最终设计的动作清单**。每项标实现状态 + 改动 + Phase + 关联 DR/表。
> 三方索引：
> - **最终设计** = `decisions/06-business-capabilities`（业务能力）+ `decisions/08-merged-design`（表/字段/DR/Migration/Phase）+ `decisions/02-roles-and-permissions`（角色权限）+ `decisions/05-decision-log`（D1-D20）
> - **线上现状** = `audit/01-current-system-audit`（schema 层 60 model）+ `audit/02-code-layer-audit`（权限/三端/迁移）
> - **本文** = 二者之间的改造执行方案
> 铁律：本文是规划文档，**不直接改代码**；所有业务决策以 06/08/05/02 为准。

---

## §1 实现状态图例（全套文档通用）

| 标签 | 含义 |
|---|---|
| ✅ 已实现·保留 | 线上已有，改造保留复用，不动或仅微调 |
| 🔧 已实现·需改造 | 线上已有，需扩展字段 / 改语义 |
| 🆕 未实现·待建 | 线上完全没有，新设计需新建 |
| ⏸ 暂不上线 | 已建或将建，但暂不作为正式用户功能 |
| ❌ 去掉 | 废弃 / 永久不做 |

---

## §2 总览主表（能力 1-25 × 现状 × 动作 × 实现状态）

| 能力 | 线上现状 | 改造动作 | 实现状态 | Phase | 关联 |
|---|---|---|:---:|:---:|---|
| 1 阶段与专业体系 | 无，Class 直绑单 Course | 新建 Program 体系（地基）| 🆕 | P1 | 08 §1.1 / D2/D3 |
| 2 学员加入专业 | 课程级 enrollment | 升专业级 + 邀请码时效 | 🔧 | P2 | 能力 19 |
| 3 闻思学习与圆满 | 阅读+答题有，圆满判定无 | LessonCompletion + 听计数 + courseType | 🔧 | P3 | DR-92/93 |
| 4 加行观修 | 视频引导（不计数）| 视频引导保留 + 打坐统计待建 | ✅+🆕 | P3 | DR-91/111 |
| 5 管理员代行 | AuditLog 简化版 | 扩展为代行留痕体系 | 🔧 | P5 | D17 |
| 6 内加行 10 万 | 通用打卡可作底层 | 6 项 + 仪轨 + prayerCount + 跨专业 | 🔧 | P4 | DR-94/95 |
| 7 日常实修打卡 | Practice* 较完整 | 频率类型 + 专业归属 | 🔧 | P4 | D14b |
| 8 共修与出勤 | ClassSession 仅日程，无 attendance | 出勤打卡（session_instance + attendance）| 🆕 | P4 | DR-89 |
| 9 学期报数 | PracticeTask 部分 | 节点快照 + 忏悔 | 🆕 | P5 | DR-83/84 |
| 10 考试与升学 | 完全无 | 全套升学体系 | 🆕 | P2 | DR-97~101 |
| 11 留级/退出/转专业 | 退班软删 | status + 历史留痕 | 🔧 | P2 | D15/D19 |
| 12 特殊身份关怀 | 无 | StudentSpecialStatus + 关怀跟进 | 🆕 | P5 | DR-76/77 |
| 13 辅助员配对 | 无 | AssistantAssignment | 🆕 | P5 | DR-82 |
| 14 学员关怀清单 | 无 | CareWatchlistItem | 🆕 | P5 | DR-78/79 |
| 15 传承管理 | 完全无 | TransmissionRecord | 🆕 | P5 | D4/DR-44 |
| 16 传承法会 | 不做 | — | ❌ | — | 职能 #15 |
| 17 灌顶记录 | 无 | 并入 15（TransmissionRecord）| 🆕 | P5 | DR-73 |
| 18 角色与权限 | 三元角色无作用域 | 4 角色 + 作用域 + 继承 + RoleAssignment | 🔧+🆕 | P1 | 02 文档 / DR-75 |
| 19 班级邀请码 | joinCode 无时效 | ClassInviteCode（时效/次数/撤销）| 🔧 | P2 | DR-80/81 |
| 20 决策审计日志 | AuditLog 简化版 | 扩展 11 类高权限操作 | 🔧 | P5 | DR-87 |
| 21 自学模式 | source=self | 对齐独立进度 | 🔧+⏸ | P7 | DR-103/104 |
| 22 班级动态 | 仅单向公告 | ClassPost 家族 | 🆕+⏸ | P6 | DR-50~52 |
| 23 班级讨论 | 无 | Discussion 家族 | 🆕+⏸ | P6 | DR-53~56 |
| 24 约修 | 无 | PracticeAppointment | 🆕+⏸ | P6 | DR-57~60 |
| 25 AI 助手 | LLM 网关 + 笔记加工有，RAG/对话无 | 对接网关 + RAG/对话 + 笔记加工(25.C) | 🔧+🆕+⏸ | P8 | DR-74/106/107/108/109/110 |

> 一句话：✅ 基本复用约 2 · 🔧 需改造约 11 · 🆕 待建约 11 · ⏸ 暂不上线 5（21-25）· ❌ 去掉 1（16）。改造是「在成熟学习 App 上加装学修管理体系」。

---

## §3 🆕 未实现·待建（新表 / 新能力）

线上完全没有、新设计 §三新建区 **15 张表** + 出勤机制：

| 新表 | 服务能力 | 说明 | DR |
|---|---|---|---|
| Program 体系（Program 等）| 1 | 专业×届地基，扩展区 §1.1 | D2/D3 |
| ProgramAdvancementConfig | 10 | 升学条件数据化（params Json）| DR-97 |
| UserRoleAssignment | 18 | 多角色 + 作用域（替 ClassAdmin）| 02 文档 |
| RoleAssignmentHistory | 18 | 角色变更留痕（冗余存当时值）| DR-75 |
| TransmissionRecord | 15/17 | 传承/灌顶（整合 TantricAccessGrant）| DR-44/73 |
| StudentSpecialStatus | 12 | 盲/聋特殊身份（+ User 快照双写）| DR-76/77 |
| CareWatchlistItem | 14 | 关怀清单（partial unique active）| DR-78/79 |
| ClassInviteCode | 19 | 邀请码时效（expiresAt/maxUses）| DR-80/81 |
| AssistantAssignment | 13 | 辅助员配对（独立表）| DR-82 |
| SemesterSnapshot | 9 | 报数节点快照（snapshotData Json，冻结）| DR-83 |
| ReportConfession | 9 | 虚报忏悔（submitted/acknowledged）| DR-84 |
| AdvancementCheck | 10 | 升学预检报告（checkResults Json，逐条豁免）| DR-85 |
| AdvancementRecord | 10 | 升学记录（驳回 targetProgramId=null）| DR-86 |
| AuditLog（扩展版）| 20 | 决策审计（裸 String，无 FK）| DR-87 |
| EnrollmentStatusHistory | 11 | 入学状态变更留痕（append-only）| DR-75 对称 |
| ClassSessionSchedule | 8 | 共修课表模板（双轨发起）| §3.15 |
| ClassTask | 9 | 辅导员布置班级任务 | §3.16 |
| LeaveRequest | 11 | 请假审批（expired 实时算）| DR-90 |
| 出勤 attendance | 8 | 共修出勤打卡（token 基准签到窗口）| DR-89 |
| 打坐观修统计 | 4 | 走 PracticeLog + UserPracticeVow（非新表）| DR-91/111 |

---

## §4 🔧 已实现·需改造（扩展字段 / 改语义）

| 表 / 模块 | 改动 | DR |
|---|---|---|
| UserRole enum | admin/coach/student → 4 角色；coach 拆 tutor+admin，admin→super_admin | 02 文档 |
| User | 新增 birthDate（60 岁免考资格）| DR-70 |
| Class | 新增 programId + 归档三件套 status/archivedAt/archivedBy | DR-71 |
| Course | 新增 courseType（entry/formal/restricted），与 category 正交 | DR-93 |
| Lesson | 圆满判定（听/看/答题聚合）相关 | DR-92 |
| Exam | 新增 examType（随堂/升学考）+ isOpenBook | DR-99 |
| PracticeLog | 新增 prayerCount（法王祈祷文）+ durationMinutes（观修座）| DR-95 |
| UserPracticeVow | currentSessionCount 改 Int + 新增 currentSessionMinutes | DR-91 |
| UserCourseEnrollment | **彻底迁专业级**（课程级进度数据迁走，课程语义废弃，DR-113）| 迁移 |
| AuditLog | 简化版 → 扩展 operator/scope/reason + 11 类操作 | DR-87 |
| 能力 4 录入 | 「完成观修」按钮：标记完成 → 提交座时间写 PracticeLog | DR-111 |
| LLM 网关 | 新增 dharma_qa / feature_nav 两场景（复用，不重建）| DR-108 |

---

## §5 ✅ 已实现·保留（净资产清单 — 改造务必保留复用）

线上已有、不在 1-25 能力内（或被能力间接引用），改造时不得误删：

| 分组 | 净资产（model）| 状态 |
|---|---|:---:|
| 学习/复习引擎 | 题库 14 题型 + open AI 判分（Question/UserAnswer）、SM-2（Sm2Card）、错题本（UserMistakeBook）、收藏（UserFavorite）| ✅ |
| 激励/运营 | 成就（UserAchievementUnlock）、藏历（TibetanDay）、法会信息（DharmaAssembly）、首页画报（HomePoster）、系统公告（SystemAnnouncement）| ✅ |
| 通知体系 v2 | 多通道 + 频率上限 + 静默 + 去重 + 偏好（Notification/NotificationRule/NotificationDispatchLog/NotificationPreference/PushSubscription）| ✅ |
| LLM 网关 | 多 provider/熔断/配额/用量/成本（LlmProviderConfig/ScenarioConfig/PromptTemplate/ProviderUsage/CallLog）—— AI 复用底座 | ✅ |
| 账户/安全/UGC | 邮箱验证、密码重置、单设备登录（AuthSession/EmailVerificationToken/PasswordResetToken）、举报闭环（Feedback/QuestionReport/NoteReport）| ✅ |
| 内容/笔记 | 笔记 + 高亮（Note/Highlight）、阅读进度（LessonReadingProgress）、观修视频/PPT 引导（Meditation/MeditationSession）| ✅ |

> 详见审计 01 §八。观修视频引导保留依据 DR-111（与升学打坐报数各管各的）。

---

## §6 ⏸ 暂不上线（已建/将建，暂不作正式用户功能）

| 项 | 范围 | DR |
|---|---|---|
| AI 模块（能力 25）| 25.A 问答 / 25.B 代操作 / 25.C 笔记加工；4 张新建表（ContentChunk/FeatureEntry/AiConversation/AiMessage）+ AiUsage 复用；只做后台必要部分 | DR-74/108/109/110 |
| 社交三件套 | 能力 22 班级动态 / 23 讨论 / 24 约修（§5.1/5.2/5.3 已封板设计）| DR-105 |
| 自学模式 | 能力 21（UserSelfStudyProgram，纯完成量）| DR-103/104 |
| 正科学修管理 | 06 独立专题，暂缓 | 06 §暂缓 |
| 管理端设计 | 06 独立专题；CohortWeeklySummary 等 | 06 §暂缓 |

> 注：⏸ 暂不上线 ≠ 不设计。设计已落实/封板，仅实现与上线延后。

---

## §7 ❌ 去掉（废弃 / 不做）

| 项 | 原因 | DR |
|---|---|---|
| 能力 16 传承法会（批量登记）| 传承法会功能取消，职能 #15 不做 | 02 文档 / 06 |
| TantricAccessGrant | 整合入 TransmissionRecord，删悬空 grants | DR-44/73 |
| 0.5 座制（观修 ≥15min=0.5）| 违反大纲「30 分钟以下不能单独计数」绝对约束 | DR-91 |
| 观修短座合并 | 废弃合并便利，每座 ≥30 分钟直接计（比大纲更严格）| DR-91/111 |
| UserSelfStudyRestWeek | 自学进度独立无周次时钟，休息周失去意义 | DR-104 |
| 旧 Class.joinCode（生成新码）| 无时效不满足 D11；字段保留兼容但不再生成新码 | DR-81 |
| observation_records 表 | 从未建；观修座走 PracticeLog | DR-111 |
| 转功德会建表 | 跨系统流程，超出觉学范围 | DR-68 |

---

## §8 权限体系改造（改造主战场，来自审计 02）

- **现状**：JWT payload.role 单值（admin/coach/student）；`requireRole(...)` 调用 **44 处**（实测 grep，审计 02 早期记 265 偏大，DR-117 校准）；admin 全局 bypass ~16 处；班级级断言 `assertIsCoachOfClass`（class/service.ts:853）+ `assertMemberOfClass`（:866）。
- **目标**：4 角色 + 等级继承（class_tutor 1 / class_admin 2 / subject_admin 3 / super_admin 99）+ 作用域（class_id / major_id）。
- **统一改造入口（DR-117 钉死，3 个点）**：① `auth.ts` requireRole 工厂（改内核为查 assignments + 等级判定，44 处调用点签名尽量不变）② 新建 `permissions.ts`（ROLE_LEVEL + canDo 继承+作用域交集 + assignments 查库缓存，DR-114）③ `class/service.ts` 断言 2 处（改用 permissions.ts 作用域判定）。
- **须逐点/分批**：44 处 requireRole 调用（多数随工厂内核变、零改动）+ 16 处 admin bypass 重表达为 super_admin 等级 + coach→class_tutor 语义。
- **分阶段**：①建 permissions.ts 地基 → ②切 requireRole/断言内核 → ③逐点改 bypass + 测试。
- **JWT 结构修订**（#7，DR-114）：**方案 B——token 只留 sub/sid，权限每请求查 UserRoleAssignment + 短 TTL 内存缓存**；角色变更/撤销即时生效（满足 D17 代行/撤销硬要求）；token 去 role 致已签发全失效，需全员重登（并入 DR-113 迁移重登）。
- **风险**：265 处遗漏 → 误拒；迁移期 coach 仅 class_tutor、行政功能需补任命才恢复（DR-113）；admin 降级前全局超权窗口期；token 体系影响全量。

---

## §9 数据迁移路径（来自审计 02 §三）

> ⏸ **开发期不适用（DR-116，2026-05-31）**：本项目开发中、无客户、无生产数据库，**本章「数据迁移」不成立**——改造=直接按目标设计建/演进 schema。以下迁移步骤、过渡期、token 重登、归类硬门槛均 **N.A.**，**保留备未来若进入有真实数据的运营期时参考**。其中「目标角色映射（coach→class_tutor / admin→super_admin / enrollment 专业级）」「Program 归属约束（每班必属 Program）」作为**设计设定/约束仍有效**，开发期建数据时直接满足。

**角色映射规则（DR-113，用户决策 2026-05-31）：**
- `admin` → **全部 super_admin**（全局），再**人工 review 降级**该降的为 subject_admin（窗口期所有原 admin 暂为最高权限）
- `coach` → **只给 class_tutor**（scope=classId）；**不自动给 class_admin**，行政权由 subject_admin 逐个手动补（过渡期辅导员暂无报数审核/邀请码/关怀等行政操作）
- `student` → 不变

```
1. 建 Program 体系（专业×届）          ← 地基，无存量
2. 运营补：每个现存 Class → programId   ← 🔴 阻断式硬门槛（DR-115）：code+cohortYear 全人工填，无占位专业，未归类不能上线
3. 建 UserRoleAssignment + 角色迁移脚本  ← admin→super_admin(后人工降级)/coach→class_tutor(scope=classId)，可脚本化（DR-113）
4. enrollment 彻底迁专业级             ← 依赖 1/2；课程级数据迁走，废 UserCourseEnrollment 课程语义
5. 打卡等补专业维度                     ← 依赖 1/2
6. 升学/传承/出勤等新表                 ← 独立，随 Phase 推进
7. 人工补任命                          ← coach 补 class_admin、admin 降 subject_admin
```

| 迁移项 | 难度 | 说明 |
|---|---|---|
| 角色迁移 | 🟡 中 | 可脚本化（admin→super_admin / coach→class_tutor）；JWT 单 role 需改、token 全失效（#7）；**过渡期需人工补任命**（DR-113）|
| **专业×届归属** | 🔴 难 | 现有 Class 无此维度；**code+cohortYear 全运营逐班人工填，无占位专业，未归类班级不能上线（阻断式硬门槛，DR-115）**——P1→P2 强制闸门 |
| **enrollment 迁专业级** | 🔴 难 | **彻底迁走课程级**（非派生）：课程级进度数据（completedLessons 等）迁入专业级结构，UserCourseEnrollment 课程语义废弃；依赖 Program 先建（DR-113）|
| 打卡数据 | 🟢 易 | 保留 + 补专业归属字段 |
| 题库/答题/SM2/笔记 | 🟢 易 | 净资产直接复用，近零迁移 |
| 升学/传承/出勤/报数 | 🟢 易 | 全新表无存量 |

**前置闸门（DR-115，#8 已定）**：迁移上线前，运营须把**所有存量 Class 逐班定 code+cohortYear → 建 Program → 回填 programId**，无占位专业，未归类不放行。迁移脚本校验「无 programId=null 的存量 Class」方可继续。
**过渡期须知（DR-113）**：(1) 辅导员迁移当天仅 class_tutor，行政功能待 subject_admin 补 class_admin 后恢复；(2) 原 admin 降级前为全局 super_admin，须尽快人工 review。

---

## §10 实施 Phase（链接 08 §十二）

| Phase | 内容 | 依赖 |
|---|---|---|
| P1 | 地基：Program 体系 + 4 角色权限（auth.ts/permissions.ts）| — |
| P2 | 加入专业 + 邀请码 + 升学体系 + 留级退出 | P1 |
| P3 | 闻思圆满 + 加行观修（打坐统计）| P1 |
| P4 | 内加行/日常打卡改造 + 共修出勤 | P1 |
| P5 | 报数 + 代行/审计 + 特殊身份/关怀/辅助员 + 传承 | P2 |
| P6 | 社交三件套 ⏸ | P1 |
| P7 | 自学模式 ⏸ | P1 |
| P8 | AI 助手 ⏸（依赖 pgvector）| 独立 |

详见 08 §十一 Migration（M1-M8）+ §十二 Phase。

---

## §11 待修订设计清单进度（审计 01 §九 + 02 §五，共 9 条）

| # | 项目 | 状态 |
|---|---|:---:|
| 1 | DR-74 → 复用 LLM 网关 | ✅ DR-108 |
| 2 | 补 25.C 笔记加工 + AI 暂不上线 | ✅ DR-109 |
| 3 | 能力 25 表重估（AiUsage 复用）| ✅ DR-110 |
| 4 | 观修语义并存 | ✅ DR-111 |
| 5 | 净资产纳入（本文 §5）| ✅ DR-112 |
| 6 | 迁移映射（coach→class_tutor / admin→super_admin 后降级 / enrollment 彻底迁专业级）| ✅ DR-113 |
| 7 | JWT 结构修订（方案 B 查库+缓存）| ✅ DR-114 |
| 8 | 专业×届映射规则（全人工填+硬门槛）| ✅ DR-115 |
| 9 | 权限改造统一点（auth.ts+permissions.ts 三入口，requireRole 校准 44）| ✅ DR-117 |

> **9 条待修订全部闭合（2026-05-31）**：#1-#9 + 追加阶段澄清（DR-116）。详见 08 §八 DR-108~117 + §九 检查轮次 55~64。

---

## 变更记录

| 日期 | 内容 |
|---|---|
| 2026-05-31 | 创建独立修改方案文档；汇编审计 01/02 + 08 DR/Migration/Phase；实现状态图例 + 能力 1-25 总览主表 + 🆕/🔧/✅/⏸/❌ 五类清单 + 权限改造 + 迁移路径 + Phase |
