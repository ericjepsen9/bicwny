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
| **ISG-2** ✅ **已闭合（DR-159，2026-06-04）** ~~08 §3.1 ProgramAdvancementConfig·conditionType 表·`attendance` 行；`params` 结构节无 `attendance` conditionType 的标准 params 结构~~ → DR-159 在 §3.1 补 attendance 标准 params 结构（`studyType=group_attend`，`classScope=program_all_members`，判定逻辑 COUNT(StudyRecord WHERE studyType='group_attend' AND classId IN ClassMember 本专业) ≥ targetValue）| false-negative / false-positive 两者 | 若算跨届累计，留级后第二届大量历史出勤被混入，可能虚高；若只算当班但没明文，前端/后端实现不一致会导致显示值与预检值不同 | 已闭合（DR-159，2026-06-04）| ISG-6 同源（留级语义，classScope=program_all_members 覆盖）|
| **ISG-3** ✅ **已闭合（DR-160，2026-06-04）** ~~08 §3.1 params 节无 `transmission` conditionType 的标准 params 结构~~ → DR-160 补 transmission params 结构；业务澄清：传承记录仅管理员后台录入，无学员自报路径，`isConfirmed=false` 不会出现，DR-46 原查询条件（isRequired=true AND status=active）已充分，无需 isConfirmed=true 过滤 | false-positive | 开发者若只查 `transmissionKey` 匹配而忘记过滤 `isConfirmed=true`，则学员自报但未经管理员确认的灌顶也会通过预检 | 已闭合（DR-160）；原风险基于"学员可自报"的错误前提，实际上传承记录仅由管理员录入 | DR-46 原描述正确，DR-160 澄清创建主体 |
| **ISG-4** ✅ **已闭合（DR-161，2026-06-04）** ~~08 §3.1 `practice_session` params 判定逻辑无起修日过滤~~ → DR-161 在判定逻辑中补 `AND loggedAt >= :programStartDate`，S1 修量不计入升学预检（能力 4 规则 8） | false-positive | 若不加起修日过滤，S1 补录座数被预检计入，违反"起修日之前不算"硬规则 | 已闭合（DR-161）| G1.3 同源 |
| **ISG-5** ✅ **消解（DR-162，2026-06-04）** ~~SemesterSnapshot snapshotData 各维度聚合口径未说明~~ → DR-162 升学预检改直接查询原始数据，SemesterSnapshot 不参与升学判断，快照口径问题与升学无关，消解 | false-negative / false-positive 两者 | 快照口径不明导致展示值与预检结论不一致 | 消解：快照退出升学判断流程，口径问题不再影响预检结果 | 与 ISG-8 同源（DR-162 同时消解）|
| **ISG-6** ✅ **已闭合（DR-163，2026-06-04）** ~~06 能力 8 业务规则「出勤累计」留级跨届语义歧义~~ → DR-163 明文：`classScope=current_member`，只计当届 `cohortStatus='active'` 班级出勤；留级后历史出勤不自动累入；前届已满足可由管理员通过 DR-85 豁免机制（`exempted=true`）授权豁免，学员只补足缺口；逆转 DR-159 D-A1（`program_all_members`） | false-negative / false-positive 两者 | 算总累计→留级学员可能凭历史出勤轻松达标，稀释了留级的实际约束；算新届起算→若新届出勤门槛是 93 次而学员新班只上了 30 次，误拒绝历史积累的勤奋学员 | 已闭合（DR-163，2026-06-04）：current_member + 豁免机制 | 与 ISG-2 部分重叠，ISG-2 侧重 params 格式缺失，本条侧重留级跨届场景的语义歧义 |
| **ISG-7** ✅ **已闭合（DR-164，2026-06-04）** ~~08 §3.1 cumulative_count 判定逻辑无 `ritualCompliant` 过滤，管理员标记作废的打卡仍计入升学聚合~~ → DR-164：判定逻辑补 `AND ritualCompliant IS NOT FALSE`，只排除显式标为 `false` 的记录；`true` 和 `null` 均计入；法王祈祷文 `SUM(prayerCount)` 同步补相同过滤 | false-positive | 若预检不过滤 `ritualCompliant`，管理员标记作废的 10 万顶礼仍会通过升学预检，违反能力 6 规则 4 | 已闭合（DR-164）| 能力 6 绝对约束 2 要求必填，DR-164 防御性兼容 null |
| **ISG-8** ✅ **消解（DR-162，2026-06-04）** ~~SemesterSnapshot 快照截止时间上界未明文（nodeDeadline vs generatedAt）~~ → DR-162 升学预检改直接查询原始数据，快照截止时间口径问题与升学无关，消解 | false-positive / false-negative 两者 | 截止后录入数据混入快照导致节点约束失效 | 消解：快照退出升学判断流程 | 与 ISG-5 同源（DR-162 同时消解）|
| **ISG-9** | ✅ **已闭合（DR-158，2026-06-04）** ~~06 能力 3 规则 7「不共享、不豁免」；LessonCompletion 无 programId，A 专业闻思记录可满足 B 专业 course_completion 预检~~ → DR-158：(1) LessonCompletion 加 `programId String`（必填）；(2) course_completion 预检加 `AND programId=:pid`；(3) 06 能力 3 规则 7 加 DR-158 引用确认数据层落实 | false-positive | A 专业学完某法本→B 专业升学硬条件被满足，绕过大纲要求 | LessonCompletion +programId（DR-158）| 与 D14b vowId 隔离逻辑同构（DR-157）|
| **ISG-10** ✅ **已闭合（DR-165，2026-06-04）** ~~`practice_session` 预检是否过滤 `source` 字段歧义~~ → DR-165 明文：预检不过滤 `source`，`in_app` 与 `external` 同等计入；"须录完整信息"约束在录入层 Zod 校验（`meditationId` 必填 + `durationMinutes ≥ 30`），非预检层二次过滤；§3.1 practice_session 判定逻辑行内补注 | false-negative / false-positive 两者 | 若过滤 external，线下用功学员全部丢失升学积分；DR-144 承诺 app 外申报可进升学聚合与实现矛盾 | 已闭合（DR-165）| DR-144 app 外申报功能设计同源 |
| **ISG-11** ✅ **已闭合（DR-166，2026-06-04）** ~~法王祈祷文 `prayerCount` 聚合范围未明文是否与 DR-157 对齐~~ → DR-166 明文：全量聚合，不过滤 `programId`/`vowId`，与 DR-157 cumulative_count 口径完全对齐；同步补 `ritualCompliant IS NOT FALSE` 过滤；§1.12 设计意图行内更新 | false-negative / false-positive 两者 | 若仅聚合加行专业 vow，多专业学员真实满足 10 万祈祷文但预检不足（false-negative）；口径与 cumulative_count 不一致导致同一笔打卡两标准 | 已闭合（DR-166）| DR-157 cumulative_count 全量聚合同源 | 08 §1.12：「法王祈祷文独立计数（能力 6 规则 1）：升学预检时，祈祷文达标 = `SUM(prayerCount WHERE practiceProjectId = 顶礼项目 AND userId = :id) ≥ 100,000`」；**但法王祈祷文是否同 cumulative_count 一样不过滤 programId 全量聚合，还是只统计"加行专业对应顶礼 vow"的打卡，未有明文** | **法王祈祷文聚合范围：** 顶礼可能在多个专业场景下录入（A 专业兼修者，顶礼 vow 可能有多个）。`SUM(prayerCount WHERE practiceProjectId=顶礼项目 AND userId=:id)` 是全量聚合（不区分 vow/programId），还是只聚合"加行专业"的 prayerCount？DR-157 解决了 cumulative_count 的范围，但法王祈祷文的聚合范围用了独立的 SUM(prayerCount) 公式，**未明文是否同 DR-157 口径** | false-negative / false-positive 两者 | 若全量聚合，在非加行专业中同时念顶礼（并填了 prayerCount）的学员，其祈祷文数量会超出加行专业本身的念诵量，虚高；若仅聚合加行专业 vow，则多专业学员的共享顶礼打卡（D14a）中的 prayerCount 不被计入，可能导致真实满足 10 万祈祷文但预检不足 | 在 §1.12 设计意图中明文：prayerCount 聚合范围同 cumulative_count DR-157——不过滤 programId/vowId，全量聚合用户该 practiceProjectId 的全部 prayerCount | 与 GAP-1 同源（DR-157 明文了 cumulative_count，但 prayerCount 的聚合公式是独立写法，未同步对齐） |
| **ISG-12** ✅ **已闭合（DR-167，2026-06-04）** ~~`CohortLagSnapshot.taskLag` 达标基准未明文——多专业学员以哪个专业的任务配置为基准~~ → DR-167 明文：基准来自 `classId → Class.programId → Program` 任务配置；快照表无需单存 `programId`（一班唯一归属一专业，DR-1）；多专业学员各专业独立快照，任一专业掉队即触发关怀；§1.5 设计意图行内补注；§十 TODO-1 补 DR-167 范围说明 | 06 能力 14：「日常功课连续未打卡（达阈值）\| 来源：能力 7」；08 §1.5 `taskLag`：「近 2 周班级/课程任务打卡天数达标率」；08 §1.5 注释：「掉队判定阈值…目前散落代码/User 表，按能力 14 应数据化为专业配置项（D3）**本表仅存算出的 LagStatus 结果，阈值属计算逻辑层，不在本表字段范围——挂入 §十 待办清单**」 | **掉队判定阈值（TODO-1 / §十 待办）的查询范围：** 以哪个专业的任务配置（`dailyTarget`）作为"达标基准"？学员并修多专业时，`taskLag` 是针对哪个专业计算？一个班可能有多专业学员，而 CohortLagSnapshot 是 `classId + studentId` 维度，**与 programId 无关联** | false-negative / false-positive 两者 | 多专业学员的掉队判定若误用了另一个专业的任务标准（如净土 5000/天的标准被用于判定加行学员），会导致错误的关怀触发 | 在 CohortLagSnapshot 设计意图或 §十 TODO-1 中明文：`taskLag` 的达标基准来自该班所属 `Program` 的课程任务配置；多专业并修学员的掉队按"各自专业独立计算，任一专业掉队即触发关怀" | §十 TODO-1 已知待办，本条补充"查询范围"维度 |

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
- 其中实现范围空白（本报告新发现）：**12 条**（ISG-1 至 ISG-12）→ **✅ 已闭合 10 条（ISG-1/ISG-2/ISG-3/ISG-4/ISG-6/ISG-7/ISG-9/ISG-10/ISG-11/ISG-12，DR-158~DR-161/DR-163~DR-167）**，**✅ 消解 2 条（ISG-5/ISG-8，DR-162）**，**⏸ 待定 0 条——全部闭合**，待处置 0 条

### 风险分类

| 风险类型 | 数量 | 编号 |
|---|---|---|
| false-negative（真满足但判不满足） | 2 条 | ~~ISG-1~~ ✅, ISG-4 |
| false-positive（真不满足但判满足） | 2 条 | ISG-3, ISG-7 |
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
