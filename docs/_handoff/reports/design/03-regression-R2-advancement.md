# 回归测试剧本 R2：小周的多专业升学（交叉点验证）

> 生成日期：2026-06-04
> 裁判角色：对照新升学设计（06能力10、08 §3.1/§3.9/§3.10、DR-149~167）逐点判定
> 重点：规则交叉点是否已定义；不挖已解决的旧缺口

---

## 背景

- 小周，健全学员
- 2022-06 加入净土专业（净土起修日 2022-06）
- 2023-01 加入加行专业（加行起修日 2023-01）
- 加行因伤走「心咒替代顶礼」路径（isSubstituted=true）

---

## T1–T14 判定表

| 时间点 | 系统应有的响应 | 引用依据 | 判定 |
|---|---|---|---|
| **T1** 2023-01 净土期间(2022-06~2023-01)念的观音心咒，算不算加行 cumulative_count? | **算。** cumulative_count 预检 SQL = `SUM(PracticeLog.count WHERE practiceProjectId=观音心咒 AND userId=小周 AND ritualCompliant IS NOT FALSE)`，不加 programId / vowId 过滤；净土期间的打卡记录同样命中此查询，自然计入加行累计型升学条件 | DR-157（全量跨专业聚合，D14a"念一份算多份"）；§3.1 cumulative_count 判定逻辑；DR-164（ritualCompliant 过滤）| ✅ |
| **T2 ⭐** cumulative 全量不过滤 programId；practice_session 只计起修日之后。cumulative_count 到底过不过滤起修日？两条规则口径一致吗？ | **设计未明文此差异是否故意。** practice_session 明文 `loggedAt >= UserPracticeVow.createdAt`（DR-161，根因：S1 修量不算，能力4规则8）；cumulative_count 的 SUM 查询无任何日期过滤（DR-157/DR-164 均无提及）。业务意图推测：累计型是"终身功德"，practice_session 是"起修后的系统性修法"，两者口径有意不同——但**设计文档从未明文说明「cumulative_count 有意不设起修日下界」**。实现者可能独立加上过滤，导致与设计意图相悖 | §3.1 practice_session（DR-161 起修日过滤）；§3.1 cumulative_count（DR-157/DR-164，无日期过滤）；两者对比无明文 | 🔴 |
| **T3** 2023-03 加行顶礼 isSubstituted=true，开始念心咒替代，目标 200 万 | 顶礼 vow 打 `isSubstituted=true`；新建心咒 vow，`substitutionFor` = 顶礼 vow.id；顶礼 vow 历史数值保留但不再参与加行升学预检顶礼条件判定；预检改走：查心咒 vow.currentCount ≥ 200万 | DR-94（替代机制）；DR-151（substitutionFor 字段 + 双豁免因果链）；DR-155（撤销时心咒 vow→revoked）| ✅ |
| **T4** 2023-06 心咒累计 15 万。① 算内加行观音心咒 10 万达标？② 算替代顶礼 200 万进度？③ 同一批心咒能同时满足两处？ | ① **满足**：cumulative_count 查 `SUM(PracticeLog.count WHERE practiceProjectId=观音心咒) = 15万 ≥ 10万`，通过。② **未满足**：心咒 vow.currentCount=15万 < 200万，替代顶礼条件未达标。③ **逻辑上可同时计入**：cumulative_count 不过滤 vowId，替代 vow 下的打卡记录同样被 SUM 纳入，PracticeLog 同一批数据同时贡献两个指标——但**设计文档未明文说明"替代 vow 的打卡是否同时算 cumulative_count"**，实现时可能出现"替代 vow 记录被从 cumulative 里排除"的理解 | DR-157（cumulative 全量，不过滤 vowId）；DR-151（替代路径）；DR-153（"一次打卡同时满足两个条件"——但原文仅覆盖 D14a/D14b 场景，未覆盖替代+累计并存场景）| ⚠️ |
| **T5 ⭐** §2.2（内加行心咒 10 万）和 §2.3（替代心咒 200 万）都涉及心咒，交叉点定义了吗？ | **未明文定义此交叉点。** 设计现状：① cumulative_count 查 `SUM(PracticeLog.count WHERE practiceProjectId=观音心咒)`，不过滤 vowId，替代 vow 的打卡被纳入。② 替代路径查 `UserPracticeVow.currentCount`（由相同 PracticeLog 累加而来）。两者共享同一批 PracticeLog 数据，逻辑推导下同一批心咒可同时满足两处。DR-153 的"一次打卡同时满足两个条件"覆盖 D14a/D14b（累计型+日频型），**未覆盖"替代路径 vow 的打卡 vs 累计型条件"这一交叉场景**。实现者若认为替代 vow 应专用于顶礼替代、不应泄入 cumulative，会做排除过滤，导致与隐式设计意图相悖 | §3.1 cumulative_count；§1.12 isSubstituted 豁免路径；DR-151；DR-153（未覆盖此场景）| ⚠️ |
| **T6** 2024-06 加行 S8 走完，管理员手动结业，cohortStatus → graduated | 管理员手动操作（class_admin+）；系统不自动触发；cohortStatus: active→graduated；写 EnrollmentStatusHistory 留痕；**无实修门槛检查**（graduated = 时间事件，不检查 6 条件）；净土 ClassMember 不受影响 | DR-149（graduated vs advanced 语义分离）；能力11 规则1；能力10 绝对约束4「无自动」| ✅ |
| **T7** 2024-06 心咒念了 200 万（替代达标），法王祈祷文从没单独念过。系统算"法王祈祷文条件"满足吗？ | **满足。** 替代路径：isSubstituted=true + 心咒 vow.currentCount ≥ 200万 → 预检走替代分支 → 顶礼 ✅ + 法王祈祷文 ✅（双豁免，一因两果）；无需聚合 prayerCount，prayerCount=0 不影响结果 | DR-151（双豁免因果链，大纲§649）；§1.12 isSubstituted 豁免路径说明；DR-94/DR-95 协同 | ✅ |
| **T8 ⭐** 2024-07 管理员看加行升密法预检。小周同时有加行班+净土班 active。attendance 算哪个班的出勤？ | **只算加行班。** attendance 预检 SQL = `classId = (SELECT classId FROM ClassMember WHERE userId=小周 AND programId=加行pid AND cohortStatus='active')`；`programId=:pid` 由预检绑定加行专业，查出加行 ClassMember → 加行班级 → 只统计加行班的 `StudyRecord(studyType='group_attend')`；净土出勤记录不被纳入。多专业预检完全独立，各专业各自用自己的 programId 跑 | §3.1 attendance params（classScope=current_member，DR-163）；DR-162（预检直接查原始表，以 programId=:pid 为锚）；能力10 绝对约束5（多专业预检独立）| ✅ |
| **T9** 2024-07 管理员驳回（差1次共修）。驳回留痕吗？conditionsSnapshot 此时写不写？ | **留痕，conditionsSnapshot 写入。** approve 端点对 decision='reject' 同样创建 AdvancementRecord（result=rejected，targetProgramId=null，note=驳回理由），conditionsSnapshot 冻结当时的 checkResults；AuditLog 写 actionType=`advancement_decision`（操作人+reject+时间+note）；AdvancementCheck.status 更新为 reviewed | §3.10 AdvancementRecord（result=passed/rejected 均建记录）；§4.2 AuditLog（advancement_decision）；09 能力10 API POST /approve 说明 | ✅ |
| **T10** 2024-08 小周补1次共修，管理员第二次看预检。AdvancementCheck 新生成还是覆盖？第一次差1次、第二次补足，可追溯吗？ | **设计未定义"同节点重新预检"流程。** AdvancementCheck 有唯一约束 `@@unique([userId, programId, semesterNumber, reportNodeIndex])`，同一（学员+专业+学期+节点）只能存在一张预检报告。驳回后第一张已关联 AdvancementRecord(result=rejected)，若管理员想重新预检：① 新建会被唯一约束阻断（同 reportNodeIndex）；② 覆盖更新现有 AdvancementCheck 会让第一次的预检数据丢失；③ 用 reportNodeIndex+1 新建可绕过约束，但语义上属于"新节点"而非"同节点重算"。**"补足后重算"路径无明文设计，第一次差1次的历史数据与第二次的追溯关系未定义** | §3.9 AdvancementCheck（唯一约束）；§3.10 AdvancementRecord（一检一记）；无 re-run 流程文档 | 🔴 |
| **T11** 2024-08 管理员 approve，写 AdvancementRecord + conditionsSnapshot。"心咒替代"这个事实记进去了吗？半年后看得出"顶礼是替代的"吗？ | **conditionsSnapshot 只记录判定结论，不记录判定路径。** 冻结的 checkResults 记录：`{"conditionKey":"prostration_10w","passed":true,"actual":...,"exempted":false}`——只知道顶礼条件=通过，**不记录是走替代路径（isSubstituted=true）还是直接计数**。半年后要还原替代事实，需交叉查 `UserPracticeVow.isSubstituted`（D18 保留）+ 心咒 vow.`substitutionFor`；原始数据存在，但 conditionsSnapshot 本身无法单独呈现"替代"这一判定原因 | §3.10 conditionsSnapshot（DR-83-B 冻结原则，仅存结论）；§1.12 isSubstituted 路径（存于 UserPracticeVow，非 AdvancementCheck）；D18（原始数据永久保留）| ⚠️ |
| **T12** 2024-08 加行→advanced，发正科密法邀请码，小周用码加入正科班 | approve 后：加行 ClassMember cohortStatus→advanced；AdvancementRecord 落档；管理员另发正科班邀请码；小周用邀请码走能力2入班，建正科 ClassMember（active）；净土 ClassMember 不受影响（D9/D16 不级联）| DR-150（邀请码两步走，不自动建正科 ClassMember）；DR-149（advanced = 等待加入正科的过渡态）；能力10 绝对约束5（多专业不级联）| ✅ |
| **T13 ⭐** 2024-09 小周现在：正科密法(active)+预科净土(active)。净土升学考怎么跟加行升学考区分？ExamGrade 靠什么字段标"这是哪个专业的考试"？ | **设计缺直接字段，区分依赖间接推断。** ExamGrade 表结构：`examId → Exam`；Exam 字段：`classId String?`（可空）、`examType`（quiz/advancement）。多专业区分链路为：`ExamGrade.examId → Exam.classId → Class.programId`——仅当考试绑定了具体班级（classId 非空）时才能推断专业归属。**Exam 表无 programId 字段；exam_score params 结构（§3.1）也无 examId/programId 引用**；预检时如何找到"净土专业的升学考 ExamGrade"，设计文档无明文查询路径。若同一学员有加行升学考+净土升学考，precheck 如何选择正确的 ExamGrade 条目，存在实现歧义 | §3.1 exam_score params（无 programId/examId 字段）；08 §1.4 Exam 表（classId 可空，无 programId）；09 能力10 API（无 exam-program 关联端点）| 🔴 |
| **T14** 2025-01 半年后管理员核查"小周加行升学是否合规"。查 conditionsSnapshot 能还原全貌吗？还是要重查原始数据？ | **两者结合才能完整还原，conditionsSnapshot 单独不够。** conditionsSnapshot（AdvancementRecord）：可还原"当时每条条件的判定结论"（actual值、passed/exempted）——这是核查的主要依据，且不受事后数据变化影响（冻结）。无法从快照单独还原：① 顶礼是否走替代路径（需查 UserPracticeVow.isSubstituted）；② 各条件的底层打卡明细。原始数据（D18 永久保留）：可辅助核查，但半年后原始数据可能增加（不能减少），重跑预检结果可能与当时不同。**审计底线**：conditionsSnapshot 能证明"当时判通过"，原始数据能证明"替代路径存在"，组合可还原完整合规依据；但需要查两处，快照本身不完整 | §4.1 conditionsSnapshot（DR-83-B 冻结，写入后不变）；D18（原始数据永久保留）；T11 同源缺口（替代路径未被快照捕获）| ⚠️ |

---

## 汇总

| 判定 | 数量 | 时间点 |
|---|---|---|
| ✅ 明确定义，无问题 | 7 | T1, T3, T6, T7, T8, T9, T12 |
| ⚠️ 设计未明文该交叉点，实现时可能出分歧 | 4 | T4, T5, T11, T14 |
| 🔴 规则冲突或明显缺失，必须决策 | 3 | T2, T10, T13 |
| 🟡 | 0 | — |

**交叉点问题共 7 个**（⚠️ 4 + 🔴 3）

---

## 4 个关键交叉点的专项回答

### T2：起修日口径（cumulative_count vs practice_session）

**结论：🔴 未定义**

两条规则口径确实不一致：
- `practice_session` 明文 `loggedAt >= UserPracticeVow.createdAt`（DR-161，S1修量不算）
- `cumulative_count` 的 SUM 查询无任何日期下界过滤（DR-157/DR-164）

业务推断上可能是故意的：累计型是"终身功德"（D14a跨专业共享，本就跨时空聚合），practice_session 是"系统性修法，起修后才算"。但**设计文档从未明文确认「cumulative_count 有意不设起修日下界」**，也未说明两种 conditionType 在时间过滤上口径不同的理由。

**风险**：实现者可能给 cumulative_count 加上起修日过滤（"对齐" practice_session 逻辑），导致净土期间的心咒不计入加行升学——与隐式设计意图相悖。

---

### T5：心咒双重计入（替代路径 vs 累计型条件）

**结论：⚠️ 可推导但未明文**

逻辑推导链：
1. 替代 vow 下的心咒打卡写入 `PracticeLog`（practiceProjectId=观音心咒）
2. cumulative_count 查 `SUM(PracticeLog.count WHERE practiceProjectId=观音心咒)`，不过滤 vowId
3. 因此，同一批打卡隐式地同时计入：累计型 10万条件 + 替代路径 200万进度

DR-153 的"一次打卡同时满足两个条件"覆盖 D14a/D14b（累计型+日频型），**未覆盖"替代 vow 打卡 vs 累计型条件"交叉场景**。

**风险**：实现者若认为"替代 vow 专用于顶礼替代，其打卡不应泄入通用 cumulative_count"，会加 `AND vowId NOT IN (替代vow)` 过滤，导致 小周 cumulative 10万 条件还需另外专门记录，与隐式设计相悖。

---

### T8：多专业出勤范围

**结论：✅ 已明确定义**

attendance 预检以 `programId=:pid` 为锚，SQL 查 `ClassMember WHERE userId=:uid AND programId=加行pid AND cohortStatus='active'`，只返回加行班。净土出勤完全隔离。多专业预检各自绑定自己的 programId，互不干扰。设计文档明文（§3.1 attendance params，DR-163），无歧义。

---

### T13：多专业升学考区分

**结论：🔴 未定义**

`Exam` 表无 `programId` 字段；`exam_score` 的 params 结构无 `examId` 引用；唯一可用的间接路径是 `Exam.classId → Class.programId`，但：
- classId 可为 null（平台级考试）
- 多专业学员有多个班级，各班可能各有升学考，precheck 需要知道"该用哪个班的考试"
- 设计文档无任何关于"exam_score 预检如何定位正确 ExamGrade"的说明

**风险**：在实现 exam_score 条件预检时，开发者无法从设计文档中找到"小周净土升学考"与"小周加行升学考"的区分依据，必须自行决策（按班级筛、按时间取最新、或要求 exam_score params 携带 examId），各自实现可能不一致。

---

## 最严重 3 个问题

### 🔴 问题1（最严重）：T13——ExamGrade 无 programId，多专业升学考区分无字段支撑

**影响**：多专业学员（如小周）同时有加行+净土升学考时，`exam_score` 预检无法通过设计文档确定该取哪个 ExamGrade。Exam 表只有 `classId`（间接关联 programId），若考试为平台级（classId=null）则完全无法区分。这是一个实现时必须决策的字段级缺口，可能导致错取对方专业的成绩。

**需要决策**：① Exam 是否加 `programId` 字段；或 ② `exam_score` params 是否改为携带 `conditionExamId` 直接指定；或 ③ 升学考强制绑班级（classId 非空），依赖间接链路。

---

### 🔴 问题2：T10——AdvancementCheck 唯一约束阻止同节点重新预检，无"补足后重算"流程

**影响**：管理员驳回后，学员补足缺口，管理员需要重新看预检。但 `@@unique([userId, programId, semesterNumber, reportNodeIndex])` 使得同节点无法新建第二张预检报告；覆盖现有记录会破坏驳回历史；用 reportNodeIndex+1 语义上不对（属于新节点）。实际操作中管理员无路可走，或被迫破坏历史记录。

**需要决策**：① 允许同节点多次预检（取消或放宽唯一约束，以时间戳区分）；或 ② 定义"重新预检"为同一 AdvancementCheck 的重算更新（但已关联的 rejected AdvancementRecord 如何处理需说明）。

---

### 🔴 问题3：T2——cumulative_count 是否有起修日下界，设计未明文

**影响**：若实现者给 cumulative_count 加起修日过滤（对齐 practice_session 的 DR-161），则小周 2022-06~2023-01 净土期间的心咒不计入加行升学，与 D14a"全量聚合"隐式意图冲突，累计型条件门槛实质性抬高。这是一个一行 SQL 的差距，却可能导致学员明明在 app 里看到"累计10万"却在预检里"未达标"的矛盾。

**需要决策**：明文在 §3.1 cumulative_count 说明：「不设起修日下界，全量终身聚合；与 practice_session 有意不同，因累计型修量属终身功德积累而非阶段性系统修法」。

---

*R2 完成，规则交叉点问题 7 个（🔴×3 必须决策，⚠️×4 建议明文）*
