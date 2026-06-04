# 升学模块 DR-149~176 内部一致性自检报告

> 生成日期：2026-06-04
> 检查范围：DR-149~176（共 28 条，全部在 §八 找到）
> 目的：排查补丁之间的内部矛盾，不测新场景
> 方法：逐行读取 §八 DR 表格原文 + 交叉比对 §1.2/§3.9/§3.10 对应区域

---

## 一、DR-149~176 一句话结论清单

| DR | 一句话结论 |
|---|---|
| DR-149 | graduated（时间事件）vs advanced（升学审核通过）语义分离，cohortStatus 5→7 态 |
| DR-150 | 升学落班=邀请码两步走，原预科永久停在 advanced，并行专业不级联 |
| DR-151 | 多正科无上限、主修永不自动改、200万心咒→顶礼+法王祈祷文双豁免（一因两果） |
| DR-152 | disqualified 后三下游：可查历史档案、再入学须 super_admin+忏悔、升学从0重算 |
| DR-153 | 打卡必须携带 vowId 必填字段，多专业时各任务卡片各自持 vowId |
| DR-154 | G1.7-1 学员端显示班级名、G1.7-2 辅导员可查学员所有班级；G1.7-3 已撤销 |
| DR-155 | 撤销替代=顶礼 vow isSubstituted→false、心咒 vow status→revoked；二次替代复用 revoked vow |
| DR-156 | disqualified 再入学忏悔验证=super_admin 书面背书（AuditLog）；从0重算=新 vow+时间窗口隔离 |
| DR-157 | cumulative_count 不过滤 programId/vowId（D14a 跨专业全量）；daily_frequency 按 vowId 过滤 |
| DR-158 | LessonCompletion 加 programId 字段，course_completion 预检加 programId=:pid 隔离 |
| DR-159 | attendance 范围=全专业历史班（program_all_members），studyType=group_attend（已被 DR-163 逆转，有标注） |
| DR-160 | 传承记录仅管理员录入，预检无需加 isConfirmed=true 过滤 |
| DR-161 | practice_session 预检加起修日过滤（loggedAt >= UserPracticeVow.createdAt） |
| DR-162 | 升学预检改直接查原始表，不经 SemesterSnapshot；SemesterSnapshot 保留仅供报数展示 |
| DR-163 | attendance 范围逆转为 current_member（仅当届 active 班），前届出勤可由管理员 DR-85 豁免 |
| DR-164 | cumulative_count 及 prayerCount 聚合补 ritualCompliant IS NOT FALSE 过滤 |
| DR-165 | practice_session 预检不过滤 source（in_app 与 external 同等计入） |
| DR-166 | prayerCount 聚合范围与 DR-157 对齐：全量不过滤 programId/vowId，补 ritualCompliant IS NOT FALSE |
| DR-167 | taskLag 达标基准通过 classId→Class.programId→Program 隐式链，无需在快照表存 programId |
| DR-168 | exam_score 多专业隔离通过 ExamGrade→Exam→Class.programId JOIN 链，不加冗余字段 |
| DR-169 | 重触发预检=upsert（以四字段为 key），不新建版本行 |
| DR-170 | cumulative_count 不过滤起修日，全量历史累计（与 practice_session 的 DR-161 有意不同） |
| DR-171 | 心咒打卡一因多果：既服务 200万豁免路径，也同时计入心咒 cumulative_count |
| DR-172 | isSubstituted=true 时顶礼判定切换替代路径，不再聚合顶礼历史 count |
| DR-173 | conditionsSnapshot 只冻结结论层（actual/passed/exempted），原始数据通过 D18 永久留档供审计 |
| DR-174 | AdvancementRecord 只写 passed；驳回只写 AuditLog(advancement_decision)；DR-86 失效已明文 |
| DR-175 | 撤销替代后：顶礼恢复聚合（DR-172 逆命题）；revoked 心咒 vow 打卡继续计入 cumulative_count |
| DR-176 | ritualCompliant=false 标记强制写 AuditLog(proxy_action)，markedAt 是事后审计的时序凭据 |

---

## 二、主题自洽性分析

### 【替代主题】DR-94 / 151 / 155 / 172 / 175（+ 相关 DR-150 / 174）

**判定：✅ 自洽**

**逻辑链复原：**

1. DR-94 建立替代：顶礼 vow → isSubstituted=true；新建心咒 vow currentCount=0；顶礼历史 currentCount **原封不动**（DR-94 明文"已修的要保存，不改变，独立计算"）
2. DR-151 定义因果链：心咒 vow 上 substitutionFor 指向顶礼 vow.id；预检时 currentCount ≥ 2,000,000 → 顶礼✅ + 法王祈祷文✅（一因两果）
3. DR-172 明文切换语义：isSubstituted=true 时预检**切换**到替代路径，**不再聚合**顶礼历史 count（历史数值原封保留，仅不参与预检判定）
4. DR-155 定义撤销：撤销→顶礼 vow isSubstituted→false；心咒 vow status→revoked（不删除，D18）
5. DR-175 明文逆命题：isSubstituted→false → 顶礼判定**切回** cumulative_count 全量聚合（DR-172 逆命题显式确认）；revoked 心咒 vow 的打卡记录**继续计入**心咒 cumulative_count（DR-157 不过滤 vow status）

**三条核心自洽点：**

- "DR-94 原封不动 ↔ DR-172 不聚合 ↔ DR-175 撤销后恢复聚合"：三条不矛盾。DR-94 说历史数据保留，DR-172 说 isSubstituted=true 期间不参与预检，DR-175 说撤销后重新参与——三条描述不同阶段，无重叠冲突。
- "DR-155 revoked ↔ DR-175 继续计入 cumulative_count"：自洽。DR-175 明文 cumulative_count 不过滤 vow status（引用 DR-157），revoked vow 的打卡是历史事实（D18），不因 vow 状态变更被扣除。
- "DR-151 一因两果 ↔ DR-171 一因多果"：**不是同一件事，而是不同层次的补充**。DR-151 说的是"200万心咒→顶礼✅+法王祈祷文✅"（豁免层面，replace 了两个升学条件）；DR-171 说的是"心咒打卡记录**同时**计入心咒 cumulative_count 升学条件"（累计层面，一笔打卡服务多个累计条件）。DR-171 自己也明文说"仅补明文，业务逻辑本已由 DR-151+DR-95 覆盖"。两条处于不同分析层次，不矛盾。

---

### 【状态机主题】DR-149 / 150 / 152 / 156

**判定：✅ 自洽**（有一处需注意的隐式前提，见下）

**状态转换梳理：**

| 来源 DR | 转换 | 触发条件 |
|---|---|---|
| DR-149 | active → graduated | 管理员手动结业（class_admin+，无实修门槛） |
| DR-149 / DR-150 | graduated → advanced | 升学审核 approve（class_admin+）|
| DR-152 | active → disqualified | 职能#14 取消资格（class_admin+）|
| DR-152 | disqualified → active（再入学）| super_admin 审批 + 书面背书 + 邀请码 |
| DR-156 D1 | （再入学忏悔验证）| AuditLog 书面背书，不依赖 DR-84 gate |
| DR-156 D2 | （再入学从0重算）| 新 ClassMember + 新 vow，vowId 隔离历史 |

**一致性检查：**

- graduated vs advanced 定义：§1.2 写权限（行 82）与 DR-149 完全一致——"active→graduated 管理员手动结业"、"graduated→advanced 升学审核通过时写"，DR-149 为二者的定义来源，§1.2 引用之。
- disqualified 下游：DR-152 列了三个下游（App访问/再入学/历史保留），DR-156 仅补充了 D1+D2 两个子问题的机制细节。DR-152 正文已用 ⚠️ 标注"由 DR-156 D1/D2 补全"，链条清晰。

**需注意的隐式前提（非矛盾，属未明文约束）：**

DR-149 定义 advanced = "毕业且升入正科"（即 graduated→advanced），§1.2 也写了 "graduated→advanced"。但两条 DR 均未明文规定"approve 操作前系统是否强制检查 cohortStatus=graduated"。如果管理员对仍处于 active（未结业）的学员执行 approve，理论上也会写 advanced。这是应用层的 gate 约束问题，两条 DR 未明文。**结论：非矛盾（两条 DR 互相一致），但存在一个未覆盖的防误操作约束。**

---

### 【查询范围主题】DR-157 / 158 / 161 / 164 / 165 / 166 / 170 / 171 / 172

**判定：✅ 自洽**（DR-157 vs DR-172 是特例覆盖关系，文档已明文）

**各 conditionType 口径汇总：**

| conditionType | programId 过滤 | vowId 过滤 | 时间起点过滤 | source 过滤 | ritualCompliant 过滤 |
|---|---|---|---|---|---|
| cumulative_count | ❌ 不过滤（DR-157） | ❌ 不过滤（DR-157） | ❌ 不过滤（DR-170） | N/A | ritualCompliant IS NOT FALSE（DR-164） |
| prayerCount（附属 cumulative_count）| ❌ 不过滤（DR-166） | ❌ 不过滤（DR-166） | 同上 | N/A | ritualCompliant IS NOT FALSE（DR-164/DR-166 对齐）|
| practice_session | N/A | N/A | ≥ vow.createdAt（DR-161）| ❌ 不过滤（DR-165）| N/A |
| course_completion | programId=:pid（DR-158）| N/A | N/A | N/A | N/A |
| attendance | N/A（current_member，DR-163）| N/A | N/A | N/A | N/A |
| exam_score | 通过 JOIN 链（DR-168）| N/A | N/A | N/A | N/A |
| transmission | N/A | N/A | N/A | N/A | N/A |

**三个检查点：**

1. **DR-157（cumulative_count 不过滤 vowId）vs DR-172（isSubstituted=true 时不聚合顶礼历史）：**
   DR-172 是对 DR-157 的**特例覆盖（if-else 分支），不是矛盾**。DR-157 说"正常情况不过滤 vowId"，DR-172 说"当顶礼 vow.isSubstituted=true 时，整条规则切换到替代路径"——即 DR-172 在 isSubstituted=true 条件下整体切换 conditionType 的判定逻辑，DR-157 只在 isSubstituted=false 路径生效。DR-172 正文明文"不再聚合顶礼历史 count"，说明它是有意覆盖。

2. **DR-161（practice_session 过滤起修日）vs DR-170（cumulative_count 不过滤起修日）：**
   **有意不同，文档已明文说清楚**。DR-170 正文说"排除「与 practice_session 对齐、也过滤起修日」：92 修法是座次资格（起修日界定修行起点合理）；内加行是累计遍数（历史已念成的功德不倒扣），两者性质不同"——两条有意不同的理由已内联写明，不是矛盾，是设计差异。

3. **DR-164 vs DR-166 口径对齐：**
   **真正对齐**。DR-164 明文"cumulative_count 判定 SUM(count) 及法王祈祷文 SUM(prayerCount) 均加 ritualCompliant IS NOT FALSE"，DR-166 明文"与 cumulative_count DR-157 口径完全对齐——SUM(prayerCount WHERE ... AND ritualCompliant IS NOT FALSE)"，两条都覆盖了 ritualCompliant IS NOT FALSE 过滤。

---

### 【留证主题】DR-83-B / 162 / 173 / 174 / 176

**判定：✅ 自洽**（各 DR 描述的是同一架构的不同层面）

**留证架构还原：**

```
升学预检（AdvancementCheck）
  → 直接查原始表（DR-162）
  → checkResults = Json（可变，DR-85）
  → conditionsSnapshot（冻结结论层 actual/passed/exempted，DR-83-B / DR-173）

驳回时
  → 只写 AuditLog(advancement_decision, result=rejected)（DR-174）
  → 不写 AdvancementRecord

批准时
  → AdvancementRecord（result=passed，conditionsSnapshot 从 checkResults 复制冻结）（DR-174）

事后标记 ritualCompliant=false
  → 写 AuditLog(proxy_action, markedAt)（DR-176）
  → 证明标记时序晚于 approve 时刻

原始数据表（PracticeLog/ExamGrade 等）永久留档（D18）
  → 审计时可直接查原始表截面（DR-162 + DR-173）
```

**四个检查点：**

1. **DR-83-B 冻结"快照"vs DR-173 说"只需结论层"：**
   不矛盾。DR-83-B 的适用对象是 **SemesterSnapshot**（报数快照），而 conditionsSnapshot 在 AdvancementRecord 里。DR-83-B 确立了"快照不可改"的原则，conditionsSnapshot 借用此原则（§3.10 明文"同 DR-83-B"），DR-173 则补充说"conditionsSnapshot 只需冻结结论层即可，不需要复制原始数据细节"——两条叠加是"冻结 + 深度说明"，方向一致。

2. **DR-162 "直接查原始表"是在 approve 时刻查，还是审计时查：**
   DR-162 描述的是 **AdvancementCheck 预检引擎**的架构——运行预检时直接查原始表生成 checkResults。审计时，DR-173 说"原始数据永久留档（D18），审计时直接查原始表截面"，这是事后审计路径。两条描述的是不同时刻不同动作：预检时直接查（DR-162），审计时仍可查（DR-173 + D18）。不冲突。

3. **DR-162 "直接查原始表"vs DR-173 "D18 留档"的依赖关系：**
   DR-162 说"AdvancementCheck 不依赖 SemesterSnapshot"；DR-173 说"原始数据永久留档（D18）"——DR-173 的成立前提是 D18（不物理删除）而非 DR-162，DR-162 解释了为何快照不再是"唯一留证"。三者是独立支柱，无冲突。

4. **DR-174（驳回走 AuditLog）vs DR-176（标记走 AuditLog）的 actionType：**
   **两者使用不同的 actionType，设计清晰**。DR-174 驳回写 `actionType=advancement_decision`（result=rejected）；DR-176 标记写 `actionType=proxy_action`。两者都写 AuditLog 但语义不同，不产生混淆。

---

## 三、被推翻但未标注的 DR

| DR | 问题描述 | 推翻方 | DR 自身行是否已标注 |
|---|---|---|---|
| DR-86 | 原决策"驳回 targetProgramId=null"。DR-174 决定驳回不写 AdvancementRecord，使 DR-86 的约束适用对象消失，语义失效。 | DR-174 | **已标注** ✅。DR-174 正文明文：「DR-86（驳回 targetProgramId=null）语义失效：驳回不写本表，targetProgramId=null 约束变为不适用，DR-86 历史保留（append-only），本条为后修订说明」。但 **DR-86 自身行无标注**——DR-86 原文里没有"本条后被 DR-174 修订/失效"字样。 |
| DR-159 | 原决策 D-A1"classScope=program_all_members"，留级历史出勤不清零。DR-163 逆转为 current_member。 | DR-163 | **已标注** ✅。DR-159 自身行末尾已有「**后修订（DR-163，2026-06-04）：D-A1 逆转，classScope 改为 current_member**」的内联注记，完整。 |

**小结：**
- DR-159 的推翻标注已完整（DR-159 本行有后修订说明）。
- DR-86 的推翻在推翻方 DR-174 里有说明，但 **DR-86 本行缺失"本条后被 DR-174 失效"的标注**。查阅 DR-86 原文时，读者看不到任何失效提示，必须去 DR-174 才能知道这条规则已过时。属于文档上的不完整，不是逻辑矛盾。

---

## 四、同字段不同规则冲突

| 字段/状态 | DR A | DR A 的规则 | DR B | DR B 的规则 | 性质 |
|---|---|---|---|---|---|
| `AdvancementRecord.result` | DR-85（原封板）| result 字段存在，可为 passed/rejected | DR-174 | result 字段保留，但**恒为 passed**（驳回不写本表，rejected 只进 AuditLog）| **有意收窄**，DR-174 是后续决策，进一步限定了 result 的实际写入值域；DR-174 已明文说"恒为 passed，备扩展"，不是矛盾 |
| `AdvancementCheck.checkResults` | DR-85 | 可变（upsert 豁免时更新）| DR-169 | 重触发预检=upsert，更新 checkResults/overallPassed/status | **完全一致**，DR-169 是对 DR-85"可变"的操作层补充，无冲突 |
| `UserPracticeVow.isSubstituted` | DR-94 | true→新建心咒 vow，历史顶礼 currentCount 不变 | DR-172 | true→预检切替代路径，不聚合顶礼历史 count | **不同层面不矛盾**：DR-94 说字段怎么设、历史数据怎么保留（存储层）；DR-172 说 isSubstituted=true 时预检怎么判（查询层）。两者在不同语境，不冲突 |
| `conditionsSnapshot` 深度 | DR-83-B | 快照冻结、不可改 | DR-173 | conditionsSnapshot 只冻结结论层（actual/passed/exempted），不需要原始数据细节 | **前后补充关系**，DR-83-B 定义"冻结原则"，DR-173 定义"冻结深度"，方向一致，无矛盾 |
| `attendance` classScope | DR-159 | classScope=program_all_members（全专业历史班）| DR-163 | classScope=current_member（仅当届 active 班）| **DR-163 逆转了 DR-159**，DR-159 本行已有"后修订（DR-163）"标注，不是文档矛盾，是有意修订。实施时以 DR-163 为准 |

**无冲突的同字段情况（确认一致）：**
- `prayerCount` 聚合：DR-164（补 ritualCompliant IS NOT FALSE）+ DR-166（与 DR-157 口径对齐）— 两条协同
- `AdvancementCheck.status` 字段：DR-169（upsert 更新 status）与 DR-85（可变）协同，无冲突
- `UserPracticeVow.status=revoked`：DR-155（撤销时写 revoked）与 DR-175（revoked vow 打卡仍计入 cumulative_count）协同

---

## 五、总结论

**DR 体系整体自洽性：✅**

**矛盾数：0 处**

所有表面上看像矛盾的地方，经逐条分析均属于以下情形：
- 特例覆盖（DR-172 对 DR-157 的 if-else 分支）
- 不同层面描述（DR-94 存储层 vs DR-172 查询层）
- 后续决策收窄（DR-174 对 result 字段的值域收窄）
- 前后补充关系（DR-83-B 原则 + DR-173 深度说明）
- 有意不同（DR-161 vs DR-170，已内联说明理由）

**歧义数：1 处（轻微）**

- approve 操作能否对 cohortStatus≠graduated 的学员执行？DR-149 定义 advanced="毕业且升入正科"、§1.2 写 graduated→advanced，但应用层是否强制校验前置状态未在任何 DR 明文。这是实现期需要关注的边界，但不是 DR 之间的文字矛盾。

**被推翻未标注：1 处（DR-86 本行）**

- DR-86 原文里缺失"本条后被 DR-174 失效"的标注。推翻方 DR-174 已有说明，但 DR-86 自身行没有标注，读者直接查阅 DR-86 时会误以为该规则仍然有效（实则 AdvancementRecord 不再写驳回记录，DR-86 的约束对象已不存在）。建议在 DR-86 行补注：「⚠️ 本条后被 DR-174 修订失效：驳回不写 AdvancementRecord，targetProgramId=null 约束不再适用，历史保留」。

---

DR自检完成，共发现矛盾0处，歧义1处，被推翻未标注1处（DR-86）。
