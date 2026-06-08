# P0-1：能力39 音视频学习 + 分维度完成 · 设计验证报告

**测试日期**：2026-06-08  
**测试方法**：对照 07-test-plan-capabilities.md P0-1 场景清单，逐项核查设计文档（06 能力39 + 08 §3.1 course_completion predicate + DR-158）  
**测试目标**：验证 LessonCompletion 数据层设计能否支撑能力3闻思圆满判定的全部场景  
**测试人**：Claude（设计裁判）  
**状态**：⚠️ 验证中断，G1 待用户决策

---

## 验证场景逐项判定

| # | 场景 | 判定 | 依据 |
|---|---|---|---|
| T1 | 多专业独立计数——同一课时在专业A和专业B分别记录，互不干扰 | ✅ | DR-158 为 LessonCompletion 加 `programId`（必填）；`course_completion` predicate 过滤 `programId=:pid`，A专业记录不满足B专业升学预检 |
| T2 | 无障碍状态分支——盲学员只需听，聋学员只需读，进度页各自正确展示 | ✅ | 能力39 只管写 `type`（audio/video/read），盲/聋判定逻辑在能力3的 course_completion predicate（blind→COUNT audio/video ≥2，deaf→COUNT read ≥2），两层解耦 |
| T3 | 三维度独立——listen/read/watch 各自独立计数；答题维度独立 | ✅ | audio+video=听，read=看，各自 COUNT 独立；答题维度走 UserAnswer（对应课时全部 passed），两表各管一层，不互相干扰 |
| T4 | 留级后记录处置——留级后新届，旧LessonCompletion是否正确排除 | 🔴 **未明文** | 见空白 G1 |
| T5 | 与能力3数据接口对齐——LessonCompletion写路径包含全部必填字段 | ⚠️ **文档缺引用** | 见空白 G2 |

---

## 空白清单

### G1：留级后 LessonCompletion 处置未明文 — 🔴 待决策

**问题**：DR-181 明文了留级后三类指标规则：

| 指标 | 留级后处置 | DR |
|---|---|---|
| 心咒/顶礼 cumulative_count | 保留 | DR-170/DR-157 |
| 92修法 practice_session | 重算（起修日截断） | DR-161 |
| 共修出勤 attendance | 重算（只计当届） | DR-163 |
| **闻思圆满 LessonCompletion** | **❓ 未列入** | — |

**默认行为**：留级后 programId 不变，旧 LessonCompletion 记录继续有效 → 不需要重新读法本。

**涉及 DR**：DR-181（留级后指标继承规则）× DR-158（LessonCompletion.programId）**接缝空白**

**两个选项**：

| 选项 | 规则 | 理由 |
|---|---|---|
| **A（推荐）** | 留级后闻思圆满记录**保留**，不重算 | 留级=出勤/修量不足须重修，不是书没读；已读的法本不需要重读；与累计型指标（心咒）对齐 |
| **B** | 留级后闻思圆满记录**重算** | 更严格，留级须完整重走全部学习流程 |

**⚠️ 待用户拍板后写入 DR-181 第4类指标 + 06 能力39 绝对约束**

---

### G2：能力39 写路径未引用 programId — ⚠️ 文档缺口

**问题**：能力39 写入描述为「写一条 LessonCompletion，带 `type`（audio/video/read）」，  
但 DR-158 要求 `programId` 为必填字段，该 DR 只出现在能力3的上下文里。

**风险**：实现者读能力39可能遗漏 `programId`，导致多专业隔离失效（T1 场景静默 bug）。

**修复**：能力39「分维度完成记录」规则中补一句：`programId`（写入时从当前学员正在学习的专业上下文带入，必填，DR-158）

**无需用户决策，可直接补文档。**

---

## 汇总

| 判定 | 数量 | 场景 |
|---|---|---|
| ✅ 已定义，接缝安全 | 3 | T1 / T2 / T3 |
| ⚠️ 文档缺口 | 1 | T5（G2）|
| 🔴 待决策 | 1 | T4（G1）|

**验证结论**：能力39 数据层设计主体正确（多专业隔离 ✅、无障碍分支 ✅、三维度独立 ✅），发现两处文档层面的空白：G1 需要用户决策（留级后闻思是否保留），G2 可直接补文档引用。

**下一步**：用户确认 G1 选 A 或 B → 写入 DR-210 → G2 同步补入 → 继续 P0-2 能力3。

---

*报告来源：`docs/_handoff/reports/design/03-regression-p0-1-capability39.md`*  
*DR 依据来源：`docs/_handoff/decisions/08-merged-design.md` §3.1 course_completion + §八 DR-158/DR-181*
