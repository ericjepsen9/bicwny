# 设计裁判剧本 · 小周的双专业实修（同咒多专业 D14a/D14b 落点）

> 裁判模式·专项剧本：对照设计（05 D14 / 06 能力6&7 / 08 §1.12 PracticeLog / DR-120/153）
> 逐点判断"同一个咒被多个专业要求时，累计型豁免和日常型不豁免如何在数据上并存"。
> 本剧本不测状态机，专测 D14a/D14b 的数据落点。

---

## 背景

小周，健全学员，同时加入加行 + 入行论两个预科专业。
- 加行：内加行有观音心咒**累计 10 万**要求（D14a 累计型）
- 入行论：**每日观音心咒 ≥ 1000 遍**（D14b 日常型）

---

## T1–T10 逐点判定

| 时间点 | 系统应该的响应 | 引用依据 | 判定 |
|---|---|---|---|
| **T1** 2023-03-01 小周同时在两个专业，系统建几个"观音心咒" UserPracticeVow？ | **两个独立 vow**：加行_vow（context=program_task，cohortTemplateId→加行内加行模板，targetCount=100,000）+ 入行论_vow（context=program_task，cohortTemplateId→入行论日常模板，dailyTarget=1000）。加入专业时自动建立，不共享（DR-153：vowId 是多专业分流的唯一依据）。❗ 但"两个 vow 如何支撑 D14a 共享豁免"的数据机制在设计文档中无明文——D14a 的实现逻辑（升学预检是否跨 programId 聚合）未落纸面。 | D14a/D14b；DR-153；08 §1.7（context=program_task 自动建）；06 能力 6 规则 6 | ⚠️ |
| **T2** 2023-03-02 小周念了 1000 遍。这 1000 遍同时算加行累计和入行论当日吗？ | 设计意图推断：用**入行论_vow**录入（从入行论任务卡片上下文，DR-153 前端带 vowId）→ PracticeLog: vowId=入行论_vow, programId=入行论。加行累计预检（D14a）应聚合该用户**全部** PracticeLog WHERE practiceProjectId=观音心咒（无论 programId），从而也计入这条记录。❗ 但这个"跨 programId 聚合"逻辑**没有明文写在任何 SoT 文档**：DR-120 说"programId 跨专业追溯·B 专业满足时溯源 A 专业达成"，暗示可以聚合，但**聚合范围**（全部 programId / 仅本专业 programId）没有定义。DR-153 vowId 必填的排除理由也是为了分流，未说明对 D14a 的影响。**这是本剧本最核心的数据缺口。** | D14a（"念一份功德算多份"）；DR-153（vowId 必填）；DR-120（programId 跨专业追溯）；08 §1.12 PracticeLog 约束 | 🔴 |
| **T3** 2023-03-02 "念一份算两份"（D14a 共享）—— 入行论日常打卡是否自动满足当天？这跟 D14b "日常不豁免"矛盾吗？ | 若接受 T2 的解读（入行论_vow 录入 1000，D14a 聚合让加行累计也增长）：**入行论当日 ✅**（用了入行论_vow，dailyTarget=1000 满足）+ **加行累计 ✅**（D14a 跨程聚合）。两者不矛盾——D14b"不豁免"的语义是"入行论不能因为加行有日常念诵就免除自己每天的要求"，而不是"入行论的每日打卡不能同时贡献加行的累计"。但这个"不矛盾"的推断成立的前提，是 D14a 的跨程聚合机制已明文。目前它依赖 T2 的推断。 | D14a；D14b；DR-120；06 能力 7 绝对约束 1 | ⚠️ |
| **T4** 2023-03-03 小周没念。加行累计不受影响，入行论算缺勤——系统怎么"一边宽容一边严格"？ | 由 ProgramAdvancementConfig.conditionType 区分：加行的观音心咒条件 conditionType=`cumulative_count`——预检只看 SUM(count) ≥ 100,000，不看每日缺勤；入行论的观音心咒条件 conditionType=`daily_frequency`（或 ClassTask dailyTarget=1000 按日达标率）——预检按日统计满足天数/达标率，缺席日标记缺勤。两套查询逻辑由 conditionType 驱动，不需要新字段。概念层清晰，ProgramAdvancementConfig.params Json 可承载不同判定参数（DR-97 已验证）。 | D14a/D14b；ProgramAdvancementConfig.conditionType；DR-97（params 充分性验证）；06 能力 7 规则 7 | ✅ |
| **T5** 2023-06-01 加行累计到 10 万达标。此后入行论每日还需要念 1000 吗？ | **需要**。D14b 明确："日常型跨专业独立打卡，即使要求碰巧相同也不豁免"（06 能力 7 绝对约束 1）。加行累计达标只说明加行的 cumulative_count 条件满足；入行论的 daily_frequency 条件是独立需求，不被加行累计覆盖。两个 conditionType 完全正交，D14b 无豁免路径。 | D14b；06 能力 7 绝对约束 1；D14a 仅适用于同类型累计条件间共享 | ✅ |
| **T6** 2023-06-02 ⭐ 核心：加行累计已达 10 万，入行论日常持续到 S8。数据层怎么表达"同一个咒，加行完成了，入行论还每天念"？ | 概念上自洽：加行 AdvancementCheck 的 cumulative_count 条件 → overallPassed=true；入行论 AdvancementCheck 的 daily_frequency 条件 → 独立按日统计，和加行的结果无关，继续要求每日 ≥ 1000。❗ **数据层如何表达这两套并行逻辑的查询规则，设计文档没有明文**：具体而言——① cumulative_count 条件的预检查询是"跨所有 programId 聚合"还是"只聚合本专业 programId"？② daily_frequency 条件的预检查询用哪个过滤字段（vowId? programId? userId+practiceProjectId+date）？这两条查询规则是 D14a/D14b 数据落点的核心，但 08 §3.9 AdvancementCheck、ProgramAdvancementConfig 的 params 定义中均无此描述。 | D14a/D14b；ProgramAdvancementConfig.conditionType；08 §3.9（预检生成逻辑）；DR-97 | 🔴 |
| **T7** 2023-09-01 小周退出入行论（D15）。观音心咒数据怎么处理？ | D15 明确：中途退出专业，已学记录保留（D15；D18 全数据不删）。入行论 ClassMember.cohortStatus→left；入行论_vow 的 PracticeLog 全部保留（D18）；加行_vow 及其 PracticeLog 完全不受影响，累计继续有效。退出不触发任何 vow 状态变化（08 §1.7 绝对约束"外部事件不触发 vow 状态变化"）。 | D15；D18；08 §1.7 vow 生命周期自治 | ✅ |
| **T8** 2023-09-02 退出入行论后，为入行论念的日常观音心咒，还计入加行累计吗？ | 若 D14a 的实现是"加行预检聚合该用户全部 PracticeLog WHERE practiceProjectId=观音心咒"（不论 programId），则退出后的入行论_vow 打卡记录仍在表中（D18），加行预检时仍能看到并聚合——**计入**。但这依赖 T2/T6 未明文的聚合范围。若实现是"只聚合 programId=加行的 PracticeLog"，则退出后的入行论_vow 打卡**不计入**。设计文档目前两种实现均可能，无明文约束。 | D14a（"通过 A 专业达成"）；D15/D18（记录保留）；DR-120（programId 跨专业追溯）| ⚠️ |
| **T9** 2024-01-01 累计 12 万（超额）。系统怎么显示？超额有意义吗？ | ProgramAdvancementConfig.targetValue=100,000，条件判定 = SUM ≥ 100,000 → **满足**。超额部分无独立业务机制（无积分、无跨期结转、无额外奖励），仅作展示数值。学员端"升学进度"板块显示实际累计值（如"12 万/10 万 ✅"）。设计无超额业务规则，行为清晰。 | ProgramAdvancementConfig.targetValue；06 能力 10 规则；D3（条件数据化）| ✅ |
| **T10** 2024-06-01 ⭐ 验证：加行升学预检，观音心咒这项查什么计数？ | DR-120 说"升学预检按 programId 聚合，B 专业满足时溯源「通过 A 专业达成」"，暗示预检 **CAN** 跨 programId 聚合。但"按 programId 聚合"这句话有歧义：① 聚合后再按 programId 分组溯源（查全量）；② 按本专业 programId 过滤后聚合（只查本专业）。D14a 原则要求前者，但查询逻辑在 08 §3.9 AdvancementCheck 与 ProgramAdvancementConfig 定义中**均未明文**。如果 T2 的录入一律用入行论_vow，则 programId=入行论；若加行预检只查 programId=加行的记录，会出现"累计明明有 10 万但预检算不够"的 false-negative——这与 DR-154 撤销 G1.7-3 时排除 false-negative 的考虑高度相关，但没有在当时一并解决。 | D14a；DR-120（programId 追溯）；08 §3.9（AdvancementCheck 生成逻辑）；DR-153 | 🔴 |

---

## 统计

| 判定 | 数量 |
|---|---|
| ✅ 设计清晰、已定义 | 4（T4 / T5 / T7 / T9）|
| ⚠️ 概念正确、数据机制有缺口 | 3（T1 / T3 / T8）|
| 🔴 明确的设计缺口 | 3（T2 / T6 / T10）|
| 🟡 模糊 | 0 |

**总计：10 点 · ✅4 / ⚠️3 / 🔴3 / 🟡0**

---

## 缺口清单

| 编号 | 缺口描述 | 涉及时间点 | 关联设计位置 |
|---|---|---|---|
| GAP-1 | **D14a 升学预检的聚合范围未明文**：cumulative_count 条件的 AdvancementCheck 查询是"该用户全部 PracticeLog WHERE practiceProjectId=X"（跨所有 programId）还是"WHERE practiceProjectId=X AND programId=本专业"？D14a 语义要求前者，但 08 §3.9 与 ProgramAdvancementConfig 均无此说明 | T2 / T6 / T10 | 08 §3.9 AdvancementCheck 设计意图；ProgramAdvancementConfig.conditionType 判定逻辑说明；DR-120（programId 跨专业追溯条目） |
| GAP-2 | **D14b 日常型预检的过滤字段未明文**：daily_frequency 条件的预检查询用什么字段限定"只算本专业的打卡"？用 vowId=本专业_vow？用 programId=本专业？用 classTaskId/cohortTemplateId？三种选项结论不同，设计没有说明 | T6 / T8 | 08 §3.9；能力 7 绝对约束 1（"跨专业不共享"）的数据层实现 |
| GAP-3 | **录入路由与 D14a 共享的调和机制缺失**：DR-153 规定 vowId 必填（从任务卡片上下文带入），一次打卡只能对应一个 vow（一个专业）。D14a 说"念一份功德算多份"。两者调和的唯一路径是"D14a 预检做跨程聚合"，但这个路径没有明文（GAP-1 的另一面）。若实现时误做"program-specific 聚合"，D14a 在多专业场景下会静默失效 | T2 / T3 | DR-153（vowId 必填理由）；D14a；DR-120 |

---

## "同一个咒在累计型和日常型之间的数据落点"设计清楚了吗？

**概念层 ✅，数据/查询层 ❌。**

D14a（累计共享）和 D14b（日常独立）在业务语言层面定义清晰（05 D14、06 能力 6/7），PracticeLog 也有支撑字段（vowId 分流 DR-153、programId 追溯 DR-120、conditionType 区分 DR-97）。但设计文档**从未明文说明**：当 AdvancementCheck 运行时，cumulative_count 条件查询的聚合范围是"跨 programId 全量"还是"本专业专属"。这一查询规则决定了 D14a 能否真正实现"念一份算多份"，也决定了 D14b 的"不豁免"能否在数据层精确对齐（而不是靠编写预检逻辑的开发者自己猜规则）。三个 🔴 全部指向同一根因：**D14a/D14b 的 conditionType 到 query scope 的映射规则从未落纸面**。

---

## 最严重 3 个问题

### 🥇 GAP-1：D14a 预检聚合范围——设计最关键的静默失效风险（T2/T10）

DR-120 语言暗示跨程聚合，但**没有明文写成查询规则**。开发者实现时若选"只聚合本专业 programId"，D14a 静默失效——学员明明念了 10 万，但升学预检显示"未达标"（false-negative）。这个 false-negative 正是 DR-154 撤销 G1.7-3 时反复提到的危险，却在 D14a 的实现路径上同样存在，且更隐蔽（不会报错，只是数字算少了）。

### 🥈 GAP-3：DR-153 vowId 必填与 D14a "念一份算多份"的调和机制缺失（T2）

DR-153 的设计理由是"多专业时 vowId 是唯一分流依据"，确保日常打卡归属正确（D14b 需要）。但 D14a 要求同一次打卡"算多份"——唯有通过"预检跨程聚合"才能实现，而这个机制没有在 DR-153 决策记录里被提及。两个决策（DR-153 vowId 分流 + D14a 共享）独立封板，但调和点（"cumulative 预检不按 vowId/programId 过滤"）落空。

### 🥉 GAP-2：D14b daily_frequency 的过滤字段未明文（T6）

"跨专业日常不豁免"要求 入行论 daily 预检只数"入行论的打卡"，但数据层靠什么区分"这是入行论的打卡"？vowId（最精确）？programId？两者有细微差异：若用 programId 过滤，则 D14a 跨程录入（入行论_vow → programId=入行论）恰好不会污染加行的 cumulative_count 条件；但若用 vowId 过滤，行为一致但也需要明文。两种选择的含义不同，设计文档既未选也未排除。

---

> 报告生成：2026-06-03 · 裁判剧本 · 专项（D14a/D14b 数据落点）
> 判定统计：✅4 · ⚠️3 · 🔴3 · 🟡0 · 缺口 3 个（GAP-1/2/3，共同根因：D14a/D14b conditionType → query scope 映射规则未落纸面）
