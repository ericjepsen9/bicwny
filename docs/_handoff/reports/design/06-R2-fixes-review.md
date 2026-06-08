# 升学模块 R2 后修复内容（供外部审查重新出测试场景）

> 生成日期：2026-06-04
> 分支：claude/keen-hamilton-62SdY
> 适用范围：R2 回归测试（多专业升学交叉点验证）发现的 7 个问题，本轮全部处理完毕（DR-168～DR-173）

---

## 一、本轮处理的问题清单（R2 发现的 7 个交叉点）

| # | 问题描述 | 严重度 | 处理结果 |
|---|---|---|---|
| T13 | 多专业学员有加行+净土两场升学考，`exam_score` 预检没有说明靠什么字段区分"这是哪个专业的考试" | 🔴 必须决策 | ✅ 闭合（DR-168）|
| T10 | 管理员驳回后学员补足条件，再次预检时 `AdvancementCheck` 的唯一约束会冲突，"补足后重算"路径无设计 | 🔴 必须决策 | ✅ 闭合（DR-169）|
| T2 | `cumulative_count` 有没有起修日下界？与 `practice_session` 有意不同还是遗漏？文档未说 | 🔴 必须决策 | ✅ 闭合（DR-170）|
| T4 | 心咒打卡同时计入"心咒项 10 万"和"替代顶礼进度"，是不是双重计入？文档未明文确认 | ⚠️ 需明文 | ✅ 闭合（DR-171）|
| T5 | `isSubstituted=true` 时，顶礼项的历史打卡和替代路径两条判定逻辑，是并行还是切换？未明文 | ⚠️ 需明文 | ✅ 闭合（DR-172）|
| T11 | `conditionsSnapshot` 只记结论不记路径，半年后看不出顶礼是走了替代路径 | ⚠️ 需明文 | ✅ 消解（DR-173）|
| T14 | `conditionsSnapshot` 不含考试分、出勤数等底层数据，审计依赖需说明 | ⚠️ 需明文 | ✅ 消解（DR-173）|

> **消解 vs 闭合**：消解 = 问题依赖的假设被架构变更（DR-162 直接查原始表）推翻，问题自然不成立；闭合 = 明文新增规则解决。

---

## 二、每个问题的修复详情

### T13 → DR-168：exam_score 多专业隔离

**修复前**：`Exam` 表无 `programId` 字段，`exam_score` 预检文档里没有说明多专业学员如何取"对应专业的升学考成绩"，开发者只能自行决策。

**修复后**：明文规定预检查询路径为 `ExamGrade → Exam（examType='advancement'）→ Class.programId = :pid`，三表 JOIN 过滤，只取目标专业班级创建的升学考。`ExamGrade` 不加冗余 `programId` 字段，隔离靠 JOIN 链隐式保证。

**涉及文档**：`08-merged-design.md` §3.1 exam_score 小节 + §七 + §八 DR-168。

---

### T10 → DR-169：重触发预检语义

**修复前**：`AdvancementCheck` 有唯一约束 `[userId, programId, semesterNumber, reportNodeIndex]`，驳回后想重新预检会被唯一键拦截，文档没有"重算"语义。

**修复后**：明文规定重触发预检 = **upsert**，以唯一键更新 `checkResults / overallPassed / status`，不新建行。历史留证靠 `AdvancementRecord`（每次管理员拍板一条，不可变）+ `AuditLog`（豁免留痕），不靠 `AdvancementCheck` 堆版本。实现层必须用 upsert，不允许 create。

**涉及文档**：§3.9 节标题 + 约束表 + 设计意图段首 + §七 + §八 DR-169。

---

### T2 → DR-170：cumulative_count 不过滤起修日

**修复前**：`cumulative_count` 聚合查询无日期过滤，`practice_session` 有起修日过滤（DR-161），两者差异无解释，文档没说是故意的。

**修复后**：明文确认 `cumulative_count` **有意不过滤起修日**，全量历史打卡累计。理由：内加行是终身功德积累（D14a"念一份算多份"的时间维度延伸），历史遍数已念成，不因立誓时间晚而倒扣；与 `practice_session` 的区别是**有意设计**（92 修法讲"起修后完整修完一轮"，口径不同合理）。

**涉及文档**：§3.1 cumulative_count 小节标题 + 补注 + §七 + §八 DR-170。

---

### T4 → DR-171：心咒打卡一因多果

**修复前**：心咒打卡同时贡献"心咒项 cumulative_count 10 万"和"替代顶礼进度 200 万"，DR-153 的一次打卡双计仅覆盖 D14a/D14b 场景，未覆盖替代路径这个场景，开发者可能误判为 bug 而加过滤。

**修复后**：明文确认这是**有意设计**——顶礼、法王祈祷文、心咒三者本为同时进行的修持，一笔打卡服务多个升学条件，并非重复计算错误。正常路径顶礼打卡同时产生 `prayerCount` 计入法王祈祷文条件，同理替代路径心咒打卡同时计入心咒 `cumulative_count` 条件，两者独立判定、互不排斥。

**涉及文档**：§1.12 PracticeLog 设计意图 isSubstituted 段补注 + §七 + §八 DR-171。

---

### T5 → DR-172：isSubstituted=true 切换路径，不叠加

**修复前**：`isSubstituted=true` 时，顶礼历史打卡还在 `PracticeLog` 里（DR-94 明文保留），是否仍参与 `cumulative_count` 聚合，文档没说。

**修复后**：明文确认 `isSubstituted=true` 时顶礼项判定**整体切换为替代路径**（验证心咒 vow `currentCount ≥ 2,000,000`），不再聚合顶礼历史 `count`。历史数值原封保留（DR-94），仅不参与本次预检达标判定。两路互斥，不叠加。

**涉及文档**：§3.1 cumulative_count 小节补注 + §七 + §八 DR-172。

---

### T11 + T14 → DR-173：消解（非修复）

**原担忧**：`conditionsSnapshot` 只记判定结论（passed/exempted/actual），不记替代路径细节或原始数据，审计可能不完整。

**评估结论**：T11/T14 基于"快照是唯一留证"的旧假设。DR-162 重构后预检直接查原始表，PracticeLog / ExamGrade 等原始表永久留档（D18 不物理删除），审计细节直接查原始表即可；`AdvancementCheck.checkResults` 也永久留档（D18）。两个问题是 DR-162 架构变更的副作用，旧假设不成立后问题自然消解，无需在 `conditionsSnapshot` 加字段。

**涉及文档**：§3.10 设计意图补注 + §七 + §八 DR-173。

---

## 三、4 个交叉点的最终结论

### Q2：cumulative_count 过不过滤起修日？与 practice_session 一致吗？

**不过滤**（DR-170）。两者**有意不同**：

| | 起修日过滤 | 理由 |
|---|---|---|
| `practice_session`（92 修法）| ✅ 过滤，只计起修日之后 | 系统性修法，起修后才进入"修满一轮"的统计范围 |
| `cumulative_count`（内加行累计）| ❌ 不过滤，全量历史 | 终身功德积累，历史遍数已念成，不倒扣 |

---

### Q3：观音心咒"内加行 10 万"和"替代顶礼 200 万"——同一批算两处？

**同一批打卡两处都算**（DR-171）。

顶礼、法王祈祷文、心咒三件事是同时进行的修持，一笔 `PracticeLog` 记录同时贡献：
- 心咒项 `cumulative_count`（10 万条件）
- 替代顶礼 vow 的 `currentCount`（200 万条件）

**但两个条件独立判定**，互不抵消：心咒念了 15 万 → 10 万条件 ✅，200 万条件仍是 ❌（差 185 万）。

**前提限制**（DR-172）：一旦 `isSubstituted=true`，顶礼项的判定整体切换为替代路径，历史顶礼打卡不再参与顶礼 `cumulative_count` 聚合；心咒打卡仍同时计入心咒 `cumulative_count`。

---

### Q4：多专业学员的 attendance，升某专业时算哪个班的出勤？

只算**该专业当前 active 班级**的出勤（DR-163）。

查询路径：`ClassMember WHERE userId=:uid AND programId=:pid AND cohortStatus='active'` → 取出该专业当前班级 → 只统计该班的 `StudyRecord(studyType='group_attend')`。

净土出勤不进加行升学预检，反之亦然。多专业预检各自绑定自己的 `programId`，完全隔离。

---

### Q5：多专业学员的 exam_score，怎么区分哪个专业的升学考？

通过 JOIN 链区分（DR-168）：`ExamGrade → Exam（examType='advancement'）→ Class.programId = :pid`。

升学考在创建时必须绑定班级（`Exam.classId` 非空），通过班级归属确定专业。预检只取 `Class.programId` 等于目标专业的升学考成绩。

---

## 四、本轮新增/修改的字段或状态

**本轮（DR-168～DR-173）无新增数据库字段、无新表、无新枚举值、无新 migration。**

全部 6 条 DR 均为：补充查询路径说明、明文业务规则、或标注已有设计的语义边界。改动仅限设计文档，不涉及 schema 变更。

---

## 五、可能影响已封板设计的风险点

### 风险 1：DR-172 切换语义 × 替代被撤销后（建议 R3 覆盖）

DR-172 规定 `isSubstituted=true` 时顶礼 `cumulative_count` 切换为替代路径，不再聚合历史打卡。如果替代后来被撤销（`isSubstituted` → false，心咒 vow → revoked，DR-155），学员回到"靠顶礼打卡计数"路径，历史顶礼打卡数值一直保留（DR-94），可以重新被聚合。

两条 DR 理论上不矛盾，但"替代→撤销→重新升学"的完整状态转换路径尚无回归测试场景覆盖，建议 R3 加入。

### 风险 2：DR-169 upsert × AdvancementRecord `advancementCheckId @unique`（需确认）

`AdvancementRecord` 上有 `advancementCheckId @unique`（一检一记）。upsert 后同一 `AdvancementCheck` 最终被 approve，会产生第二条 `AdvancementRecord(result=passed)`，但第一条 `AdvancementRecord(result=rejected)` 也指向同一个 `advancementCheckId`——@unique 约束下两条指向同一 check 的记录是否允许？需验证约束是否只约束 `result=passed` 的记录，或改为允许多条（一检多记，取最终结论）。

### 风险 3：DR-173 消解依赖 D18 原始数据永久性（审计局限性，已知）

DR-173 依赖"原始数据永久留档（D18）"支撑审计完整性。D18 承诺不物理删除，但不承诺不修改（如 `ritualCompliant=false` 可被管理员后打标）。半年后查原始数据时，部分记录可能已被标记失效，重新聚合的结果可能与当时预检不同。

这不是新问题，DR-162 设计时已知晓，属于审计局限性上限。建议在 `05-advancement-graduation-review.md` 留证章节补一句说明："原始数据不可删除但可被标记失效，审计时以 `conditionsSnapshot` 结论为主，原始数据为辅助佐证"。

---

## 附：本轮 DR 编号索引

| DR | 问题 | 类型 |
|---|---|---|
| DR-168 | exam_score 预检通过 JOIN 链区分多专业升学考 | 闭合 |
| DR-169 | AdvancementCheck 重触发预检 = upsert 语义 | 闭合 |
| DR-170 | cumulative_count 有意不过滤起修日 | 闭合 |
| DR-171 | 心咒打卡一因多果（顶礼/法王祈祷文/心咒同时修持）| 闭合 |
| DR-172 | isSubstituted=true 时顶礼 cumulative_count 整体切换替代路径 | 闭合 |
| DR-173 | conditionsSnapshot 深度由 DR-162 直接查原始表架构消解 | 消解 |
