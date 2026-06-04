# 回归测试剧本 R3：小孙的曲折升学路（R2 修复落地 + 3 个风险点验证）

> 生成日期：2026-06-04
> 裁判角色：对照修复后的设计（DR-94/155/162/168~173）逐点判定
> 重点：规则组合是否撞数据库约束 / 状态死锁；不挖已解决的旧缺口

---

## 背景

- 小孙，健全学员，加行专业
- 因伤走心咒替代（isSubstituted=true），后又撤销
- 升学一波三折：第一次驳回，补足后第二次 approve

---

## T1–T16 判定表

| 时间点 | 系统应有的响应 | 引用依据 | 判定 |
|---|---|---|---|
| **T1** 2024-04 管理员触发小孙加行 S8 预检，系统建 AdvancementCheck(checkId=X) | 系统以 `[userId, programId, semesterNumber, reportNodeIndex]` 为键新建 AdvancementCheck，status=pending；checkResults 按 6 条 conditionType 直接查原始表生成（DR-162）；checkId=X 唯一键首次写入，无冲突 | DR-162（直接查原始表）；DR-169（upsert 键定义）| ✅ |
| **T2** 2024-04 预检显示差共修出勤 1 次，管理员驳回，写 AdvancementRecord(result=rejected, checkId=X) | 驳回时创建 AdvancementRecord：result=rejected、targetProgramId=null（DR-86）、conditionsSnapshot 冻结当时 checkResults（DR-83-B）；advancementCheckId=X 写入 AdvancementRecord，**@unique 槽位首次被占用**；AuditLog 写 actionType=advancement_decision（操作人+reject+时间+note）| DR-86（驳回不填 targetProgramId）；DR-83-B（conditionsSnapshot 冻结）；§3.11 AuditLog | ✅ |
| **T3** 2024-05 小孙补 1 次共修，管理员第二次触发预检，AdvancementCheck upsert 更新 checkId=X | DR-169 明文：重触发 = upsert，以唯一键更新 checkResults / overallPassed / status；不新建行，不违反唯一约束 | DR-169（重触发预检 = upsert）| ✅ |
| **T4 ⭐** 2024-05 管理员看第二次预检全满足，点 approve，要写 AdvancementRecord(result=passed, checkId=X)。T2 已写过 rejected 的 checkId=X，@unique 是否冲突？ | **🔴 冲突。** `AdvancementRecord.advancementCheckId @unique`（DB 级约束）保证"一张预检报告只能出一份升学记录"。T2 已建 AdvancementRecord(result=rejected, checkId=X)，@unique 槽位已占；T4 的 approved record 也需要 checkId=X → **唯一键冲突，INSERT 被数据库拒绝**。DR-169 只定义了 AdvancementCheck 的 upsert 语义，没有处理"已存在 rejected record 时如何再写 passed record"。approve 流程在此卡死 | DR-169（只覆盖 AdvancementCheck，未覆盖 AdvancementRecord）；§3.10 `advancementCheckId @unique`（DB 约束）| 🔴 |
| **T5 ⭐** 2024-05 如果撞约束：approve 流程卡死，小孙升不了。设计有没有定义解法？ | **🔴 无解法，设计缺口。** 可能方案：A) @unique 只约束 result=passed 的记录；B) AdvancementRecord 允许多条（一检多记，取最终）；C) 驳回不写 AdvancementRecord，只写 AuditLog。三个方案均未在 DR-169 或任何 DR 中明文选定。R2 修复总结已标注"需确认"，**但本轮未落地决策** | DR-169（未覆盖）；R2 风险 2（标注"需确认"，未闭合）| 🔴 |
| **T6** 2023-03 小孙因伤顶礼 isSubstituted=true，念心咒替代，目标 200 万 | 管理员在能力 5 代行界面操作：顶礼 UserPracticeVow 置 isSubstituted=true，历史顶礼数值原封不动（DR-94）；新建心咒 UserPracticeVow(targetCount=2,000,000, currentCount=0, substitutionFor=顶礼vow.id)（DR-151）；AuditLog 写 proxy_action（DR-94）| DR-94（替代机制）；DR-151（substitutionFor 字段）| ✅ |
| **T7** 2023-09 小孙心咒念到 50 万 | 心咒 cumulative_count 条件：SUM(PracticeLog WHERE practiceProjectId=心咒 AND userId=小孙 AND ritualCompliant IS NOT FALSE) = 50万 ≥ 10万 → **心咒 10万条件 ✅**（DR-157/DR-164/DR-171）。替代路径：心咒 vow.currentCount=50万 < 200万 → **顶礼+法王祈祷文条件 ❌**（DR-151）。两条判定独立，互不排斥（DR-171）| DR-157（no vowId filter）；DR-164（ritualCompliant 过滤）；DR-151（替代路径）；DR-171（独立判定）| ✅ |
| **T8** 2023-12 小孙伤好，管理员撤销替代：isSubstituted→false，心咒 vow→revoked | DR-155 明文：撤销替代 → 顶礼 vow `isSubstituted=false`；心咒 vow `status=revoked`（不物理删除，D18）；`substitutionFor` 指针保留（历史留档）；预检只取 `status=active` 心咒 vow（故 revoked 心咒 vow 不再参与替代路径预检）| DR-155（撤销流程）；D18（不删除）| ✅ |
| **T9 ⭐** 2023-12 撤销后顶礼判定回到"靠历史打卡聚合"。替代期间顶礼空窗，算不算"倒退"？ | **⚠️ 逻辑正确但未显式成文。** 撤销后 isSubstituted=false → DR-172 的切换条件不成立 → cumulative_count 恢复聚合顶礼 PracticeLog：`SUM(count WHERE practiceProjectId=顶礼 AND ritualCompliant IS NOT FALSE)`；DR-170 无起修日过滤，全量历史顶礼打卡均计入；DR-94 历史数值保留——替代期间念了多少顶礼就有多少。"空窗"不是倒退，是正确反映：替代期间几乎没念顶礼，所以顶礼 count 低。**但"撤销后 isSubstituted=false → cumulative_count 恢复聚合"这个状态转换没有在任何单一 DR 中明文描述，** 只能从 DR-172（isSubstituted=true 时切换）的逆命题推导 | DR-172（isSubstituted=true 时切换，逆命题）；DR-94（历史保留）；DR-170（no date filter）| ⚠️ |
| **T10** 2024-01 撤销后，50万心咒打卡怎么算？① 心咒 10万条件还算达标吗（vow 已 revoked）？② 会倒扣吗？ | **① 仍达标，② 不倒扣。** cumulative_count 聚合查 PracticeLog，**不过滤 vowId、不过滤 vow status**（DR-157：no vowId filter）——心咒 vow 变为 revoked，只影响替代路径判定（DR-155：预检只取 status=active），不影响 cumulative_count 的 PracticeLog 聚合；50万 PracticeLog 记录仍在（D18 不删），仍被 SUM 纳入，**心咒 10万条件继续 ✅**。**⚠️ 此结论由 DR-157（no vowId filter）+ D18（不删）隐式推导，无显式 DR 说明"revoked vow 的打卡继续计入 cumulative_count"** | DR-157（cumulative_count no vowId filter）；DR-155（revoked 只影响替代路径预检）；D18（数据不删除）| ⚠️ |
| **T11** 2024-02 小孙重新念顶礼，预检顶礼条件查的是哪些记录？ | **全量历史顶礼 PracticeLog，含替代期间前后全部**。查询：`SUM(PracticeLog.count WHERE practiceProjectId=顶礼 AND userId=小孙 AND ritualCompliant IS NOT FALSE)`——DR-170 无起修日过滤，DR-94 历史保留，故包含：替代前的顶礼打卡 + 替代期间偶尔念的顶礼 + 撤销后新念的顶礼。vow 状态（active/revoked）不影响聚合（DR-157）。**⚠️ 同 T9/T10，此组合行为无单一 DR 显式声明，依靠多条 DR 逆推** | DR-170（no date filter）；DR-94（历史保留）；DR-157（no vowId filter）| ⚠️ |
| **T12** 2024-05 小孙 approve，conditionsSnapshot 冻结 6 条条件结论 | conditionsSnapshot 在 approve 时刻写入 AdvancementRecord，冻结 6 条件 actual / passed / exempted 值；写入后不可修改（DR-83-B）；值来自当前 AdvancementCheck.checkResults（经 upsert 更新为补足后的最新预检结果）| DR-83-B（冻结）；DR-169（upsert 后 checkResults 为最新）| ✅ |
| **T13** 2024-11 半年后，管理员发现小孙某批顶礼打卡仪轨不合规，标 ritualCompliant=false | ritualCompliant=false 是管理员对 PracticeLog 记录的修正标记（D18：不可删除但可修改）；标记后该批记录被排除在升学聚合之外（DR-164）。此操作本身合法，属能力 5 代行范畴（proxy_action 值域含"修正"语义，DR-94）；D18 允许此类修改操作 | D18（不删除但可修改）；DR-164（ritualCompliant IS NOT FALSE 过滤）；§3.11 proxy_action | ✅ |
| **T14 ⭐** 2024-11 重查原始聚合，cumulative 比当时少。conditionsSnapshot 显示"当时达标"。两者冲突时以哪个为准？审计能说清吗？ | **以 conditionsSnapshot 为准**（DR-173 明文："以 conditionsSnapshot 结论为主，原始数据为辅助佐证"）；conditionsSnapshot 记录的是 approve 时刻的 actual 值，事后标记不改变已批准的升学结论。**⚠️ 审计能力有限**：设计希望 ritualCompliant 标记走 proxy_action AuditLog 留痕，但 §3.11 AuditLog 的 11 类 actionType 中 proxy_action 覆盖"代行/修正/追溯"，ritualCompliant 标记是否明确走此路径**设计文档无显式确认**（TODO-20 仅挂了"仪轨合规标志"待定，未说明操作留痕路径）；若标记无 AuditLog，则无法从审计链直接证明"标记发生在 approve 之后"，conditionsSnapshot vs 当前数据的差异来源无法自解释 | DR-173（conditionsSnapshot 为准）；DR-164（ritualCompliant 过滤）；§3.11（proxy_action 覆盖范围）；TODO-20（ritualCompliant 标记留痕路径未定）| ⚠️ |
| **T15** 验证 T2 修复：小孙加行起修日 2023-01，他 2022 年（起修日前）念的内加行顶礼，算 cumulative_count 吗？ | **算。** DR-170 明文："cumulative_count 聚合不加 loggedAt >= UserPracticeVow.createdAt 过滤，全量历史打卡均计入"——2022 年记录在范围内，直接被 SUM 纳入。DR-170 修复落地 ✅ | DR-170（不过滤起修日）| ✅ |
| **T16** 验证 T5 修复：假设小孙仍在 isSubstituted=true，系统算顶礼 cumulative_count 时，聚合历史顶礼 PracticeLog 吗？ | **不聚合。** DR-172 明文："isSubstituted=true 时顶礼项判定整体切换为替代路径（验证心咒 vow currentCount ≥ 2,000,000），不再聚合顶礼历史 count"——历史 PracticeLog 保留但不参与预检达标判定。DR-172 修复落地 ✅ | DR-172（isSubstituted=true 切换路径，不聚合）| ✅ |

---

## 汇总

| 判定 | 数量 | 时间点 |
|---|---|---|
| ✅ 明确定义，行为正确 | 10 | T1, T2, T3, T6, T7, T8, T12, T13, T15, T16 |
| ⚠️ 逻辑可推导但未显式成文，实现可能出分歧 | 4 | T9, T10, T11, T14 |
| 🔴 数据库约束冲突，approve 流程卡死 | 2 | T4, T5 |
| 🟡 | 0 | — |

---

## 3 个风险点的最终结论

### 风险 2（T4/T5）：upsert 撞 @unique——**🔴 真冲突，approve 流程卡死**

`AdvancementRecord.advancementCheckId @unique` 是 DB 级约束，"一检一记"。设计要求驳回时写 AdvancementRecord(result=rejected)，等于提前占用唯一键槽位。DR-169 引入 AdvancementCheck upsert 后，第二次 approve 试图写 AdvancementRecord(result=passed, checkId=X)，数据库拒绝，approve 卡死。

DR-169 只修复了 AdvancementCheck 层的重触发问题，**没有处理 AdvancementRecord 层的唯一键语义**。R2 修复总结标注"需确认"，但本轮未产出决策。

**需要立即决策，三选一**：

| 选项 | 做什么 | 影响 |
|---|---|---|
| A | @unique 改为只约束 result=passed 的记录（应用层前置检查）| 驳回可有多条，passed 只有一条 |
| B | 去掉 @unique，一检允许多条记录，查询取最终结论 | 最灵活，需应用层防止多条 passed |
| C | 驳回不写 AdvancementRecord，只写 AuditLog(advancement_decision, result=rejected) | AdvancementRecord 仅记录 passed，语义更纯粹 |

---

### 风险 1（T9/T10/T11）：替代撤销后的顶礼空窗——**⚠️ 逻辑正确，部分未显式成文**

撤销替代（DR-155）后的行为由多条 DR 组合隐式覆盖：
- 顶礼判定恢复聚合（DR-172 逆命题 + DR-94 历史保留 + DR-170 no date filter）
- 心咒 PracticeLog 继续计入 cumulative_count（DR-157 no vowId filter + D18 不删）

**没有单一 DR 显式说明"撤销后的状态转换"**——三条 ⚠️ 全靠逆推。实现者若不知道 DR-172 是可逆的（isSubstituted=false 时恢复聚合），或误以为 revoked vow 的打卡不计入 cumulative_count，会出错。

**建议**：补一条 DR 或在 DR-155 中显式声明撤销后各条件的判定行为（顶礼恢复聚合、心咒 PracticeLog 继续计入累计）。

---

### 风险 3（T13/T14）：D18 不删但可改 × conditionsSnapshot——**⚠️ 策略已定，留痕路径未闭合**

"以谁为准"已定义：DR-173 明文 conditionsSnapshot 为权威（T14 结论层面 ✅）。

**但 ritualCompliant=false 标记的 AuditLog 留痕路径未显式确认**：
- §3.11 AuditLog 的 proxy_action 值域覆盖"修正"语义，理论上可承载
- 但 TODO-20"仪轨合规标志"挂待定，未说明操作走哪个 actionType、留什么 payload
- 若标记无 AuditLog，审计时无法证明"标记发生在 approve 之后"，conditionsSnapshot 与当前数据的差异来源无法自解释

**建议**：TODO-20 关闭时明确：ritualCompliant=false 标记走 proxy_action AuditLog，payload 记录操作时刻 + 被标记记录 id，形成可追溯链。

---

### T2/T5 修复（T15/T16）——**✅ 真落地**

- **T15（DR-170）**：cumulative_count 无起修日过滤，2022 年记录计入 ✅
- **T16（DR-172）**：isSubstituted=true 时整体切换替代路径，不聚合历史顶礼 count ✅

---

## 最严重 3 个问题

### 🔴 问题 1（最严重）：T4/T5——approve-after-reject 被 DB 约束硬锁

**影响**：所有经历过"第一次驳回"的学员，第二次 approve 均无法写入 AdvancementRecord，升学流程完全卡死。这不是边缘场景——"初次驳回+补足+再 approve"是正常业务流，被驳回后努力补足的学员全部受影响。

**根因**：DR-169 修复 AdvancementCheck 层 upsert 语义，但未同步修复 AdvancementRecord 层的 @unique 约束语义。两个设计在"驳回是否写 AdvancementRecord"上存在矛盾。

**需要立即产出决策（DR-174 建议）**。

---

### ⚠️ 问题 2：T9/T10/T11——替代撤销后状态无显式 DR，实现有分歧风险

**影响**：实现替代撤销功能时，开发者可能不知道：
1. isSubstituted=false 后顶礼 cumulative_count 恢复聚合（含全量历史）
2. revoked vow 的 PracticeLog 继续计入 cumulative_count

若误理解，会加多余过滤条件，导致撤销后学员顶礼 count 被重置或心咒 count 消失，严重影响升学判定。

**需要补一条 DR 显式覆盖撤销后状态转换**。

---

### ⚠️ 问题 3：T14——ritualCompliant 标记留痕路径未定（TODO-20），审计链不完整

**影响**：半年后审查时，conditionsSnapshot 显示"达标"，当前聚合显示"不达标"，无法从 AuditLog 直接证明"是先 approve 后才标不合规"——审计无法自证清白，需手动核对时间戳。

**需要 TODO-20 关闭时补上 ritualCompliant 标记的 AuditLog 留痕规范**。

---

*R3 完成。风险验证结果：风险 2 🔴 真冲突 · 风险 1 ⚠️ 部分未定义 · 风险 3 ⚠️ 策略已定 / 留痕路径未闭合*
