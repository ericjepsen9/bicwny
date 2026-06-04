# 设计文档实现范围空白全文扫描报告

> 扫描员：Claude Code（全文扫描模式）
> 扫描日期：2026-06-04
> 扫描基线：08-merged-design.md 封板至 DR-157；05/06/09 同步；GAP-1/2/3 已在 DR-157 闭合
> 报告定位：发现"概念清楚、但判定/查询的实现范围未落纸面"的业务规则缺口

---

## 一、已闭合缺口（不重复报，仅列清作为基准对比）

| 编号 | 缺口 | 闭合状态 |
|---|---|---|
| GAP-1 | `cumulative_count` 预检聚合范围（不过滤 programId/vowId，全量聚合） | ✅ DR-157 已明文 |
| GAP-2 | `daily_frequency` 过滤字段（vowId IN 本专业所有 active/revoked vow） | ✅ DR-157 已明文 |
| GAP-3 | DR-153 vowId 必填与 D14a"念一份算多份"的调和机制 | ✅ DR-157 已明文 |

---

## 二、新发现的实现范围空白

### 主表格

| 编号 | 规则位置 | 规则原文摘录 | 实现范围缺什么 | 风险类型 | 若选错会怎样 | 参考解法 | 备注 |
|---|---|---|---|---|---|---|---|
| **ISG-1** | ✅ **已闭合（DR-158，2026-06-04）** ~~08 §3.1 ProgramAdvancementConfig·conditionType 表·course_completion 行；params 结构节只列了 practice_session/exam_score/cumulative_count，无 course_completion 的 params 结构~~ → DR-158 在 §3.1 补 course_completion 标准 params 结构（`courseTypes: [entry,formal]` + 判定逻辑明文，含 blind/deaf 路径，过滤条件包含 `programId=:pid`）| false-negative | 若过滤范围太窄，学员明明学完但预检报未达标 | 已闭合（与 ISG-9 DR-158 一同处理）| ISG-9 同源（DR-158 同时解决）|
| **ISG-2** | 08 §3.1 ProgramAdvancementConfig·conditionType 表·`attendance` 行；08 §3.1「各 conditionType 标准 params 结构」节 | "共修出勤达标 \| 能力 8"；`params` 结构节**无 `attendance` conditionType 的标准 params 结构**，无判定逻辑说明 | **① 出勤统计范围：** 计学员在"本班（classId）"的出勤还是"本专业所有班"的出勤（留级学员可能跨届在多个班）？ **② 时间范围：** 算"本专业整个历史累计"还是"本届（本 ClassMember 入班后至今）"？ **③ 出勤类型过滤：** `StudyRecord.studyType` 中的 `group_attend`/`group_absent`/`group_review`/`group_summary` 哪些算入"出勤次数"？ | false-negative / false-positive 两者 | 若算跨届累计，留级后第二届大量历史出勤被混入，可能虚高；若只算当班但没明文，前端/后端实现不一致会导致显示值与预检值不同 | 补 `attendance` 的标准 params 结构：`{ "countType": "group_attend", "classScope": "current_member" }`（或 "program_all_active_classes"），并说明留级学员按新 ClassMember 对应的 classId 独立计算 | 06 能力 8「出勤累计」仅说"按学员所在班级累计 / 多专业各自独立"，但"所在班"在留级场景下有歧义 |
| **ISG-3** | ✅ **已闭合（DR-159，2026-06-04）** ~~transmission conditionType 的完整过滤条件未在 §3.1 明文；§2.3 预检缺 isConfirmed=true~~ → DR-159：(1) §2.3 设计意图 admin 流程 + 预检描述补 `isConfirmed=true`；(2) DR-46 预检描述补全；(3) §3.1 新增 transmission 标准 params 结构（完整 4 条过滤：transmissionKey/isRequired/isConfirmed/status=active） | false-positive | 学员自报未确认灌顶通过预检，密法升学硬条件被绕过 | §2.3 + DR-46 + §3.1 三处对齐（DR-159）| DR-46/DR-47 已有部分描述，属"散落未汇总+预检遗漏 isConfirmed"型缺口 |
| **ISG-4** | 08 §3.9 AdvancementCheck 设计意图；08 §1.12 PracticeLog 约束表「vowId 必填」；09 §能力 4 大纲 & DR 注记 | 09 能力 4：「起修日前不计 → 端点按 `Program.startDate` 过滤聚合」；08 §3.1 `practice_session` params 判定逻辑：`GROUP BY meditationId WHERE userId=:id`——**无起修日过滤条件** | **时间范围：** `practice_session` conditionType 的预检聚合是否应加 `PracticeLog.loggedAt >= Program.startDate`（起修日）过滤？06 能力 4 规则 8 明文"起修日之前不算"，但 §3.1 params 节的判定逻辑中**没有起修日过滤字段** | false-positive | 若不加起修日过滤，学员在 S1（起修日前）通过能力 5 代行补录或 source=external 申报的座数会被预检计入，违反"起修日之前不算"硬规则（06 能力 4 规则 8） | 在 practice_session params 判定逻辑中补：`WHERE userId=:id AND loggedAt >= ProgramSemester[S2].startDate`（起修日为 Program 中 S2 开始时间）；或在 §3.9 设计意图中注明预检前先确认时间范围过滤 | 06 能力 4 规则 7/8 明文（G1.3 已闭合的结论是"S1 修量须管理员走能力 5 代行补录"），但 §3.1 的具体 SQL 判定逻辑未同步此约束 |
| **ISG-5** | 08 §3.7 SemesterSnapshot·snapshotData JSON 结构；06 能力 9 规则 7「多专业各自独立报数」 | 08 §3.7：`snapshotData` 字段定义为：`{ "lessonCompletion":{...}, "meditationStats":{...}, "innerPractice":[...], "dailyPractice":[...], "attendance":{...}, "taskCompletion":[...] }`；06 能力 9 绝对约束 2：「多专业必须各自独立，不可合并汇总」 | **聚合范围未在快照中标注：** `snapshotData` 中的各项数值（如 `meditationStats`、`innerPractice`、`attendance`）是按"本专业本班"聚合还是"全用户全专业"聚合？快照已有 `programId` 字段，但 **JSON 内各维度的过滤口径（是否过滤 programId、vowId、classId、时间范围）无文档说明**。不同维度过滤标准不同（cumulative_count 不过滤 programId，daily_frequency 按 vowId 过滤），快照若口径不明，会产生快照值与预检判定值不一致 | false-negative / false-positive 两者 | 管理员看到的快照数字（如内加行 8 万）与升学预检结果（满足/未满足）不一致；管理员依据快照误判，信任数字但预检结论不同，造成沟通混乱和管理风险 | 在 §3.7 设计意图中补一张表：列出 snapshotData 每个维度的聚合口径（如 `innerPractice`: 不过滤 programId，全量聚合，同 DR-157 cumulative_count；`dailyPractice`: 按 vowId IN 本专业 vow 过滤，同 DR-157 daily_frequency；`attendance`: 按 classId 过滤，当前 ClassMember 入班日后至今） | 与 GAP-1/2 同源（DR-157 解决了预检查询范围，但未同步到快照生成口径） |
| **ISG-6** | 06 能力 8 业务规则「出勤累计」；08 §1.2 ClassMember；升学硬条件（06 能力 10 规则 4）| 06 能力 8：「出勤按学员所在班级累计 / 多专业各自独立（A 班的不算 B 班）」；06 能力 10 规则 4：「共修出勤达标（门槛由专业配置）」——但**门槛是"本届"累计还是"从入学至今所有届"累计，两文件均未明文** | **时间边界：** 留级学员跨届后，出勤门槛（如 93 次）算"总累计"还是"新届起算"？06 能力 11 规则 1 说"新班继续累计"但这针对记录保留；升学条件判定时的具体聚合范围（`StudyRecord WHERE classId IN 本学员历届加行班`）未落纸面 | false-negative / false-positive 两者 | 算总累计→留级学员可能凭历史出勤轻松达标，稀释了留级的实际约束；算新届起算→若新届出勤门槛是 93 次而学员新班只上了 30 次，误拒绝历史积累的勤奋学员 | 在 08 §3.1 `attendance` conditionType 说明或 06 能力 10/11 中明文：出勤聚合范围是"学员在本专业当前活跃 ClassMember（`cohortStatus=active`）所在班级的全历史出勤"（即按 programId 聚合本专业所有 ClassMember 行对应班的出勤），留级不重置累计 | 与 ISG-2 部分重叠，ISG-2 侧重 params 格式缺失，本条侧重留级跨届场景的语义歧义 |
| **ISG-7** | 06 能力 6 规则 6「跨专业累计共享」；08 §3.1 `cumulative_count` params 判定逻辑 | 08 §3.1 cumulative_count 判定：「`SUM(PracticeLog.count WHERE practiceProjectId=:id AND userId=:id) ≥ targetValue`」；06 能力 6 绝对约束 4：「跨专业共享需可追溯（B 专业满足时显示"通过 A 专业达成"）」 | **仪轨合规过滤：** PracticeLog 有 `ritualCompliant` 字段（能力 6 规则 4，09 能力 6 API 入参）。cumulative_count 判定逻辑中**未说明是否应过滤 `ritualCompliant=true`**——不合规的打卡是否参与累计预检？ | false-positive | 若预检不过滤 `ritualCompliant`，学员录入仪轨不合规的 10 万顶礼（被管理员标记作废）仍会通过升学预检，违反"不合规修量作废"的硬规则（06 能力 6 规则 4） | 在 cumulative_count 判定逻辑补：`AND (ritualCompliant=true OR ritualCompliant IS NULL)`；或明文说明 ritualCompliant=false 的记录通过 AuditLog 代行"作废"后在 PracticeLog 上的表示方式，使预检能正确排除 | 06 能力 6 绝对约束 2「仪轨合规标志必填」只说必填，未说明预检时如何使用此字段 |
| **ISG-8** | 06 能力 9 规则 4「学员随时录入，节点截止汇总」；08 §3.7 SemesterSnapshot；08 §3.9 AdvancementCheck | 08 §3.7 约束：`@@unique([userId, programId, semesterNumber, reportNodeIndex])`；08 §3.9：「报数节点截止 → 系统读 SemesterSnapshot + ProgramAdvancementConfig 自动跑 6 类条件预判」——但**快照生成时刻与"截止时间点之前的数据"之间的边界没有明文** | **快照截止时间口径：** 系统生成快照时，聚合 PracticeLog/LessonCompletion/StudyRecord 等数据的时间上界是`nodeDeadline`（节点截止时刻）还是"快照生成时刻（`generatedAt`）"？若学员在 nodeDeadline 后、generatedAt 前仍录入了数据，这些数据是否进入本期快照？ | false-positive / false-negative 两者 | 若上界是 generatedAt（快照生成时刻），截止后录入的数据会混入快照，节点约束失效；若上界是 nodeDeadline，实现时须在聚合 SQL 中明确加 `loggedAt <= nodeDeadline`，但设计文档未要求此字段 | 在 §3.7 设计意图中明文：快照聚合数据的时间上界为 `nodeDeadline`，聚合时所有行源表均加 `AND (createdAt/loggedAt/studyDate) <= nodeDeadline` 过滤 | 与 ISG-5 同源（快照的生成口径整体未说清楚） |
| **ISG-9** | ✅ **已闭合（DR-158，2026-06-04）** ~~06 能力 3 规则 7「不共享、不豁免」；LessonCompletion 无 programId，A 专业闻思记录可满足 B 专业 course_completion 预检~~ → DR-158：(1) LessonCompletion 加 `programId String`（必填）；(2) course_completion 预检加 `AND programId=:pid`；(3) 06 能力 3 规则 7 加 DR-158 引用确认数据层落实 | false-positive | A 专业学完某法本→B 专业升学硬条件被满足，绕过大纲要求 | LessonCompletion +programId（DR-158）| 与 D14b vowId 隔离逻辑同构（DR-157）|
| **ISG-10** | 09 §能力 4 注记；06 能力 4 规则 10c「app 外申报」；08 §1.12 PracticeLog | 09 能力 4：「`app 外申报（DR-144）：线下打坐经能力 9 计数模块申报（选修法+手填时长+≥30min），写 `PracticeLog{meditationId, durationMinutes, source='external'}`，须录完整信息才能进升学聚合 DR-98」；但**"须录完整信息"的校验时机（打卡录入时？还是预检聚合时？）和具体完整性定义无明文** | **source=external 的升学资格：** `practice_session` 预检是否过滤 `source`？若是，external 的打卡不进升学聚合，则"app 外申报"功能承诺（"可进升学聚合 DR-98"）与实现矛盾；若否，则预检按 source 盲聚合，但 09 说"须录完整信息才能进升学聚合"暗示有过滤 | false-negative / false-positive 两者 | 若设计意图是 external 可进升学但须完整信息，而实现时开发者直接按 source 过滤排除 external，则线下用功的学员全部丢失升学积分（false-negative）；若设计意图是 external 默认不进升学，则 09 的"须录完整信息才能进升学聚合"描述误导性很强 | 在 §3.1 practice_session 判定逻辑中明文是否过滤 `source`；建议：`source` 不过滤（两者同等），"须录完整信息"的含义是"durationMinutes 必须 ≥30"（已在录入校验中把关），不是预检时再次过滤 source | 与 DR-144 的描述有轻微歧义，建议一并统一 |
| **ISG-11** | 06 能力 6 规则 3「法王祈祷文：未念法王祈祷文 → 系统记录'欠 X 万'」；08 §1.12 PracticeLog `prayerCount` 字段说明 | 08 §1.12：「法王祈祷文独立计数（能力 6 规则 1）：升学预检时，祈祷文达标 = `SUM(prayerCount WHERE practiceProjectId = 顶礼项目 AND userId = :id) ≥ 100,000`」；**但法王祈祷文是否同 cumulative_count 一样不过滤 programId 全量聚合，还是只统计"加行专业对应顶礼 vow"的打卡，未有明文** | **法王祈祷文聚合范围：** 顶礼可能在多个专业场景下录入（A 专业兼修者，顶礼 vow 可能有多个）。`SUM(prayerCount WHERE practiceProjectId=顶礼项目 AND userId=:id)` 是全量聚合（不区分 vow/programId），还是只聚合"加行专业"的 prayerCount？DR-157 解决了 cumulative_count 的范围，但法王祈祷文的聚合范围用了独立的 SUM(prayerCount) 公式，**未明文是否同 DR-157 口径** | false-negative / false-positive 两者 | 若全量聚合，在非加行专业中同时念顶礼（并填了 prayerCount）的学员，其祈祷文数量会超出加行专业本身的念诵量，虚高；若仅聚合加行专业 vow，则多专业学员的共享顶礼打卡（D14a）中的 prayerCount 不被计入，可能导致真实满足 10 万祈祷文但预检不足 | 在 §1.12 设计意图中明文：prayerCount 聚合范围同 cumulative_count DR-157——不过滤 programId/vowId，全量聚合用户该 practiceProjectId 的全部 prayerCount | 与 GAP-1 同源（DR-157 明文了 cumulative_count，但 prayerCount 的聚合公式是独立写法，未同步对齐） |
| **ISG-12** | 06 能力 14 业务规则 1「日常功课连续未打卡（达阈值）」触发关怀；08 §1.5 CohortLagSnapshot；能力 1 绝对约束 4「每个专业独立维护学期时钟」 | 06 能力 14：「日常功课连续未打卡（达阈值）\| 来源：能力 7」；08 §1.5 `taskLag`：「近 2 周班级/课程任务打卡天数达标率」；08 §1.5 注释：「掉队判定阈值…目前散落代码/User 表，按能力 14 应数据化为专业配置项（D3）**本表仅存算出的 LagStatus 结果，阈值属计算逻辑层，不在本表字段范围——挂入 §十 待办清单**」 | **掉队判定阈值（TODO-1 / §十 待办）的查询范围：** 以哪个专业的任务配置（`dailyTarget`）作为"达标基准"？学员并修多专业时，`taskLag` 是针对哪个专业计算？一个班可能有多专业学员，而 CohortLagSnapshot 是 `classId + studentId` 维度，**与 programId 无关联** | false-negative / false-positive 两者 | 多专业学员的掉队判定若误用了另一个专业的任务标准（如净土 5000/天的标准被用于判定加行学员），会导致错误的关怀触发 | 在 CohortLagSnapshot 设计意图或 §十 TODO-1 中明文：`taskLag` 的达标基准来自该班所属 `Program` 的课程任务配置；多专业并修学员的掉队按"各自专业独立计算，任一专业掉队即触发关怀" | §十 TODO-1 已知待办，本条补充"查询范围"维度 |

---

## 三、各扫描重点 8 项覆盖情况

| 扫描重点 | 覆盖结果 | 对应 ISG 编号 |
|---|---|---|
| 1. 累计型达标判定（内加行各 10 万、观音心咒等）查全量还是本专业 | ✅ GAP-1（已闭合）+ ISG-7（仪轨合规过滤）+ ISG-11（prayerCount 聚合范围） | ISG-7, ISG-11 |
| 2. 日常型打卡判定过滤字段 | ✅ GAP-2（已闭合），基准对比明确 | 已闭合 |
| 3. 升学预检每个 conditionKey 的查询范围 | ✅ ISG-1（course_completion 无 params）、ISG-2（attendance 无 params）、ISG-3（transmission 无明文查询组合）、ISG-4（practice_session 无起修日）、ISG-7（cumulative_count 仪轨合规过滤）、ISG-10（source=external 是否过滤） | ISG-1/2/3/4/7/10 |
| 4. 共修出勤累计——本班还是全部班，留级跨届 | ✅ ISG-2（attendance params 无 classScope 定义）+ ISG-6（留级跨届语义歧义） | ISG-2, ISG-6 |
| 5. 闻思圆满判定——按专业课程过滤，同一门课多专业共享 | ✅ ISG-1（course_completion 无 params/判定范围）+ ISG-9（跨专业课程圆满复用） | ISG-1, ISG-9 |
| 6. 跨专业/跨阶段/跨班级/跨届统计 | ✅ ISG-6（出勤跨届）、ISG-9（闻思跨专业）、ISG-11（prayerCount 跨专业）、ISG-5（快照口径多专业） | ISG-5/6/9/11 |
| 7. 报数节点数据范围——本专业本学期，靠什么界定 | ✅ ISG-8（快照截止时间上界未明文）+ ISG-5（快照各维度聚合口径） | ISG-5, ISG-8 |
| 8. SemesterSnapshot 快照——快照的是"哪个范围"的数据 | ✅ ISG-5（多维度聚合口径未说明）+ ISG-8（节点截止时间上界） | ISG-5, ISG-8 |

---

## 四、统计摘要

### 扫描数量

- 扫描的"判定型"规则总计：约 **28 条**（包含 6 个 conditionType 各自的判定规则、快照生成口径、3 种实修类型的时间范围、跨专业共享规则等）
- 其中实现范围明确的：**7 条**（GAP-1/2/3 已闭合 3 条 + 其余 4 条有明文说明）
- 其中实现范围空白（本报告新发现）：**12 条**（ISG-1 至 ISG-12）→ **已闭合 3 条（ISG-1/ISG-3/ISG-9，DR-158/159，2026-06-04）**，待处置 9 条

### 风险分类

| 风险类型 | 数量 | 编号 |
|---|---|---|
| false-negative（真满足但判不满足） | 2 条 | ~~ISG-1~~ ✅, ISG-4 |
| false-positive（真不满足但判满足） | 2 条 | ~~ISG-3~~ ✅, ISG-7 |
| 两者兼有（实现方向选错则各自出一种）| 8 条 | ISG-2, ISG-5, ISG-6, ISG-8, ISG-9, ISG-10, ISG-11, ISG-12 |

### 统一解法归类

这 12 个洞可归到 **3 个统一解法**下：

**解法 A：补全 §3.1 各 conditionType 标准 params 结构**
- 覆盖：ISG-1（course_completion）、ISG-2（attendance）、ISG-3（transmission）
- 操作：照 DR-97 的格式，在 ProgramAdvancementConfig §3.1 的「各 conditionType 标准 params 结构」节中补齐剩余 3 个 conditionType 的 params JSON 结构 + 判定逻辑说明（含过滤字段的明文表达）

**解法 B：在 §3.9 AdvancementCheck 设计意图中补充各条件的查询 Query Scope 完整表格**
- 覆盖：ISG-4（起修日过滤）、ISG-7（仪轨合规过滤）、ISG-10（source=external 过滤）、ISG-11（prayerCount 聚合范围与 DR-157 对齐）
- 操作：在 §3.9 设计意图末尾加一张表，逐行列出每个 conditionType 的完整 WHERE 子句（含时间范围、状态过滤、来源过滤等），与 DR-157 同格式

**解法 C：补充 §3.7 SemesterSnapshot 各维度聚合口径说明表，并明文快照时间上界**
- 覆盖：ISG-5（快照口径多专业）、ISG-8（快照截止时间上界）
- 操作：在 §3.7 设计意图中补一张表，列 snapshotData 各键对应的聚合口径（是否过滤 programId/vowId/classId）+ 时间上界说明（均为 `nodeDeadline`）

**附属解法 D：决策/补字段**（小规模）
- ISG-6：明文留级学员出勤累计"当前活跃 ClassMember 对应班全历史"（在 06 能力 11 或 §3.1 attendance params 中补一句）
- ISG-9：决策"同一门法本的 LessonCompletion 是否跨专业共享"，并视决策在 LessonCompletion 加 programId 字段或在 course_completion 判定中限定课程集合
- ISG-12：在 §十 TODO-1（掉队阈值数据化）中补"查询范围：各专业独立计算"的说明

---

## 五、最危险的 3 条（最可能伤害真实学员）

### 🥇 ISG-9：闻思圆满跨专业课程复用（false-positive）

**位置**：06 能力 3 规则 7 + 08 §3.1 course_completion + LessonCompletion 无 programId 字段

**原文**：06 能力 3 规则 7：「多专业并行下课程独立：不共享、不豁免（各自完成）」；但 LessonCompletion（08 §三 DR-129）无 programId 字段，且 course_completion 的 params 结构未定义课程过滤范围。

**为什么最危险**：这是唯一可能让"升密法 6 项硬条件之一"（全部正式课程闻思圆满）被错误满足的漏洞。如果 A 专业的学习记录被 B 专业预检计入，学员理论上可以通过仅修一个专业来满足另一个专业的 course_completion 条件，绕过大纲要求的完整闻思。数据库层目前没有 programId 字段在 LessonCompletion 上作为隔离手段，实现者必须通过课程集合过滤，但这个过滤逻辑从未落纸面。

### 🥈 ISG-3：transmission 预检查询条件不完整（false-positive）

**位置**：08 §3.1 conditionType=transmission 行；08 §2.3 TransmissionRecord 约束 DR-46

**原文**：08 §3.1 conditionType 表：「灌顶（已接受传承）\| 能力 17」（无 params 结构）；08 §2.3 DR-46 分散描述：「升学预检查 `transmissionKey=conditionKey AND isRequired=true AND status='active'`」但**未要求 `isConfirmed=true`**；08 §2.3 字段说明仅在一处提及 `isConfirmed`。

**为什么第二危险**：灌顶是升密法的硬条件（D13 不可放宽）。学员自行申报灌顶（`entryMethod=self_report`，`isConfirmed=false` 默认）若因查询条件不完整而通过预检，则升密法门槛被绕过。且不同开发者看 §3.1（无条件说明）vs 看 §2.3（有 isConfirmed 字段说明）会实现不同结果，分散性导致不一致风险极高。

### 🥉 ISG-7：仪轨合规过滤缺失（false-positive）

**位置**：06 能力 6 规则 4「不合规的修量作废」；08 §3.1 cumulative_count 判定逻辑

**原文**：08 §3.1 cumulative_count 判定：「`SUM(PracticeLog.count WHERE practiceProjectId=:id AND userId=:id) ≥ targetValue`」——**无 `ritualCompliant` 过滤**；06 能力 6 规则 4：「不合规的修量作废」。

**为什么第三危险**：内加行 6×10 万也是升密法硬条件之一。仪轨不合规（不按《开显解脱道》仪轨念诵等）的修量在预检中被全部聚合，使"作废"的判决形同虚设。学员可通过大量不合规录入达到 10 万门槛，而预检无法识别。这个漏洞在现有 params 定义中完全不可见，开发者不会主动补充。

---

## 六、自检清单确认

| 检查项 | 结果 |
|---|---|
| 每条都有原文引用（文件+§节/段落）？ | ✅ 每条 ISG 的「规则位置」和「规则原文摘录」均给出文件名+章节，引用准确 |
| 有没有把"其实写清楚了的"误报成模糊？ | ✅ GAP-1/2/3 均标为已闭合不重复报；DR-157 的两条明文规则确认无误后才报其余；ISG-3 中 DR-46 确实分散、不完整，非误报 |
| 扫描重点 8 项是否全覆盖？ | ✅ 见第三节表格，8 项全部对应至少一个 ISG 编号 |

---

> 报告生成：2026-06-04 · 全文扫描模式
> 扫描范围：05-decision-log.md（D1-D20）/ 06-business-capabilities-WIP.md（能力 1-31）/ 08-merged-design.md（至 DR-157）/ 09-api-and-pages-design.md / 03-scenario-shared-mantra.md
> 发现新缺口：ISG-1 至 ISG-12（共 12 条）· 已闭合对照：GAP-1/2/3（3 条）
