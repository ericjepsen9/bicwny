# 能力8 组合接缝回归测试报告

**测试日期**：2026-06-06
**测试方法**：对照 DR-185~189 + DR-163 + DR-89，逐点判断 DR 交叉场景是否已定义
**测试目标**：不验单点 DR，专撞"几条 DR 组合跑真实学员时接缝处有没有空白"
**测试人**：Claude（设计裁判）

---

## 剧本背景

**小韩**：健全学员，同时在加行班 + 净土班（两个都 cohortStatus='active'）

---

## T1 ~ T14 逐点判定

### 接缝1：平台级场次 × 取消（DR-186 × DR-185）

| 时间点 | 系统应该的响应 | 引用依据 | 判定 |
|---|---|---|---|
| **T1** 2024-03-01 super_admin 发起平台级场次，小韩两班都 active，签到后系统写几条？| 广播写 **2 条** StudyRecord：加行班 classId 写一条 + 净土班 classId 写一条（studyType=group_attend）；DB 唯一约束（classSessionId+userId+studyType+**classId**）各自防重 | DR-186：「查询该学员所有 cohortStatus='active' 的 ClassMember，每条对应写一条 StudyRecord」| ✅ |
| **T2** 小韩已签到（两条 StudyRecord 已写入），super_admin 取消该场次（status=cancelled）。已广播的两条 StudyRecord 怎么处理？| **⚠️ 设计未定义。** DR-185 仅规定"取消操作写 AuditLog，场次记录不物理删除（D18）"；DR-186 仅规定"签到时广播写入"。两条 DR 交叉处——**"取消后已有 StudyRecord 是否回收/失效"**——没有任何一条 DR 给出答案 | DR-185（取消语义）× DR-186（广播写入）**接缝空白** | 🔴 |
| **T3** 如果取消不回收，小韩这次出勤还算数吗？升学预检会计入"已取消场次"的出勤吗？| **⚠️ 设计未定义，且默认会产生问题。** DR-163 attendance predicate 为 `COUNT(StudyRecord WHERE studyType='group_attend' AND classId=...)` ——**不过滤** ClassSession.status。若取消后 StudyRecord 保留，升学预检会把"被取消场次"的出勤计入达标，与"场次已取消"的业务语义矛盾 | DR-163（attendance COUNT）× DR-185（取消语义）**接缝空白（T2 的连锁后果）** | 🔴 |

---

### 接缝2：平台级广播 × paused 成员（DR-186 × paused）

| 时间点 | 系统应该的响应 | 引用依据 | 判定 |
|---|---|---|---|
| **T4** 加行班 active，净土班 paused。平台级场次，小韩签到，写几条？| 写 **1 条**（加行班）。DR-186 查询 `cohortStatus='active'` → 净土班 paused 不在范围 → 不写。幂等约束各自独立 | DR-186：「paused 状态成员不写入」 | ✅ |
| **T5** 小韩看到的是什么？他知道净土班没记出勤吗？paused 期间的平台级出勤，请假结束后能补吗？| 业务规则层清晰：签到广播只写 active 班，paused 班不写，这是有意设计。但 **两处未明文**：①学员侧反馈（是显示"签到成功（加行班）"还是无差别"签到成功"），设计未定义；②paused 期间错过的平台级出勤，是否可事后补录（DR-189 补卡端点存在，但针对"paused 期间未写入"场景无专门约定）| DR-186（广播规则）× UI 反馈层未定义 × DR-189（补卡端点）× paused 补录路径未定义 | ⚠️ |

---

### 接缝3：补卡 × 已取消场次（DR-189 × DR-185）

| 时间点 | 系统应该的响应 | 引用依据 | 判定 |
|---|---|---|---|
| **T6** 加行班普通场次，小韩未签到，场次后被辅导员取消（status=cancelled）。场次本身的状态？| 场次保留（D18 不物理删除），status='cancelled'；学员端显示「本次已取消」标签，不显示签到入口 | DR-185 | ✅ |
| **T7** 管理员想给小韩补卡（DR-189 补卡端点），但场次已 cancelled。能补吗？| **⚠️ 设计未定义。** DR-189 规定补卡端点 `POST /api/coach/sessions/:id/makeup`、理由可选、AuditLog 强制写入；但**未规定"补卡时是否检查 ClassSession.status"**。DR-185 规定取消写 AuditLog、不物理删除；但**未禁止对已取消场次执行补卡**。两条 DR 交叉处——"能否给 cancelled 场次补卡"——没有答案。若实现者不加校验，则可以给取消场次写 StudyRecord，出勤数据被污染 | DR-185（取消语义）× DR-189（补卡端点）**接缝空白** | 🔴 |

---

### 接缝4：平台级广播 × 留级（DR-186 × DR-163）

| 时间点 | 系统应该的响应 | 引用依据 | 判定 |
|---|---|---|---|
| **T8** 小韩加行班留级：旧加行 ClassMember → cohortStatus='held_back'；新加行 ClassMember → cohortStatus='active' | 标准留级状态变更，两条 ClassMember 同时存在，cohortStatus 分别为 held_back / active | DR-163 / 能力 11 | ✅ |
| **T9** 又一个平台级场次，小韩签到。DR-186 广播查 active ClassMember，小韩加行有 held_back + active 两条，写哪个？| 写 **新加行班（active）**，旧加行班（held_back）不写。DR-186 查询条件 `cohortStatus='active'`，held_back 精确被过滤出去。净土班仍 active → 写净土班。合计 2 条（新加行 + 净土）| DR-186：「查询 cohortStatus='active' 的 ClassMember」精确过滤 | ✅ |
| **T10** 验证接缝：平台级广播会不会误写到 held_back 旧班？DR-163"旧班出勤不累入"原则是否被破坏？| **接缝安全。** DR-186 的 `cohortStatus='active'` 过滤器与 DR-163 的 current_member 口径完全一致——两条 DR 在"只看 active 成员"上对齐，平台级广播天然不写 held_back 旧班。不存在误写风险 | DR-186（active 过滤）× DR-163（current_member 口径）**接缝已闭合** | ✅ |

---

### 接缝5：豁免入口 × self_study（DR-188 × DR-187）

| 时间点 | 系统应该的响应 | 引用依据 | 判定 |
|---|---|---|---|
| **T11** 加行专业有 self_study 类型场次，小韩升学预检，出勤条件查 group_attend 记录数 | self_study 场次 → 不生成 checkInToken / 不开放批量勾选端点（DR-187）→ 不产生 StudyRecord(studyType='group_attend') → attendance COUNT 自然为 0 贡献。推论链完整，无需特判 | DR-187（禁止签到路径）→ DR-163（attendance COUNT studyType='group_attend'）| ✅ |
| **T12** 升学预检页，self_study 的场次显示吗？管理员能对 self_study 的"出勤"点豁免按钮吗？| 业务规则链清晰：self_study 无 group_attend 记录 → 不计入 attendance 条件 → 升学预检页面不存在"self_study 场次出勤"这个概念可豁免；豁免按钮是 conditionType 层级（整条 attendance 条件豁免），不是 session 层级。**但页面 UI 层未明文**：升学预检页是否会有 session 维度明细列表（若有，self_study 场次是否出现其中）设计文档未定义。从纯业务逻辑看不会产生问题，但 UI 实现时需注意不要把 self_study 场次暴露在出勤明细里 | DR-187 + DR-188 + DR-163 **业务规则层已闭合；UI 展示层未明文** | ⚠️ |

---

### 验证 A/B 修复落地

| 时间点 | 系统应该的响应 | 引用依据 | 判定 |
|---|---|---|---|
| **T13** 辅导员 10:00 生成 token，checkinGraceMinutes=30。小韩 10:28 / 10:31 各签一次 | 10:28 **成功**（窗口 10:00~10:30，在内）；10:31 **失败**（超出窗口，token 失效）。基准是 token 生成时刻，与 startAt 无关 | DR-89：「签到窗口 = token 生成时刻起，持续 checkinGraceMinutes」| ✅ |
| **T14** 小韩留级后，新加行班升学预检，出勤从几算？前届出勤能豁免吗？入口在哪？| 出勤从 **0** 重算（只计新班 active 期间的 group_attend，cohortStatus='active' 过滤旧班）；若管理员认为前届已满足，可在**升学资格预检页**（class_admin+）对 attendance 条件点「豁免」按钮（isExemptable=true + 理由必填）| DR-163（current_member 重算）+ DR-188（豁免入口在预检页）| ✅ |

---

## 汇总

### 判定计数

| 判定 | 数量 | 时间点 |
|---|---|---|
| ✅ 已定义，接缝安全 | 9 | T1 / T4 / T6 / T8 / T9 / T10 / T11 / T13 / T14 |
| ⚠️ 部分未定义，需明文 | 2 | T5 / T12 |
| 🔴 接缝空白，设计缺口 | 3 | T2 / T3 / T7 |
| 🟡 | 0 | — |

---

### 接缝空白清单（区别于已修复的单点缺口）

以下均不是单条 DR 的问题，是 DR 交叉后没有覆盖到的场景：

#### 空白 S1：取消 × 已广播记录（T2/T3）— 🔴

- **触发条件**：学员已签到（StudyRecord 已广播写入） → 场次事后被取消（status=cancelled）
- **未定义内容**：已写入的 StudyRecord 是否回收/标记失效
- **连锁风险**：DR-163 的 attendance COUNT 不过滤 ClassSession.status，若 StudyRecord 保留，升学预检会把"被取消场次"的出勤计为有效，与取消的业务语义矛盾
- **涉及 DR**：DR-185（取消） × DR-186（广播写入） × DR-163（升学预检 COUNT）
- **建议处理方式**（供决策，不自动修）：选一：① 取消时级联软删/标记 StudyRecord（isValid=false）+ predicate 加过滤；② 取消操作前置检查"已签到人数"，若有签到强制走"撤销出勤"流程而非直接取消；③ 明文规定"已签到记录保留有效，取消只影响后续签到"（若这是有意设计则补入 DR）

#### 空白 S2：补卡 × 已取消场次（T7）— 🔴

- **触发条件**：学员未签到 → 场次事后被取消 → 管理员尝试补卡
- **未定义内容**：补卡端点 POST /api/coach/sessions/:id/makeup 是否检查 ClassSession.status
- **风险**：若不检查，管理员可对已取消场次写 StudyRecord，出勤数据污染
- **涉及 DR**：DR-185（取消） × DR-189（补卡端点）
- **建议处理方式**（供决策，不自动修）：明文规定"补卡端点前置校验 ClassSession.status ≠ cancelled，已取消场次不可补卡，返回 409"，补入 DR-189 约束段或新建子条

---

### 重点接缝结论

**接缝1（平台级取消后已广播记录怎么办）— T2/T3**
> **未定义。** DR-185（取消）和 DR-186（广播写入）各自完整，但"取消后已有记录的处置"是两条 DR 交叉处的空白。默认结果（保留记录）会导致升学预检把取消场次出勤算为有效。这是本报告最高优先级的接缝缺口。

**接缝4（平台级广播会不会误写 held_back 旧班）— T9/T10**
> **安全，无风险。** DR-186 的 `cohortStatus='active'` 过滤器与 DR-163 的 current_member 口径完全对齐，held_back 旧班天然被排除，平台级广播不会破坏留级出勤隔离原则。

**接缝3（能否给已取消场次补卡）— T7**
> **未定义。** DR-189 定义了补卡端点，DR-185 定义了取消语义，但两者交叉后"取消场次可否补卡"没有答案。若实现时不加校验，数据层会被污染。

**接缝5（self_study 在升学预检页怎么显示）— T12**
> **业务规则链清晰，UI 层未明文。** self_study → 无 group_attend → 不计入 attendance 条件 → 不存在可豁免的"self_study 出勤"。业务逻辑已闭合，风险在 UI 实现层——若页面增加 session 维度明细，需注意不要把 self_study 场次混入出勤列表。不阻断设计，实现时注意。

---

### 最严重 3 个问题

1. **🔴 S1（T2/T3）：取消场次 × 已广播 StudyRecord——升学预检数据准确性风险**
   - 学员已签到、场次被取消 → StudyRecord 去留未定义 → DR-163 COUNT 若计入取消场次出勤 → 升学预检虚高
   - 严重度：直接影响学员升学资格判定正确性，且两端（学员/管理员）均不可见地发生

2. **🔴 S2（T7）：补卡端点 × 已取消场次——出勤数据污染风险**
   - 已取消场次仍可被补卡 → 人为写入"不存在的场次出勤" → 升学预检数据失真
   - 严重度：管理员有合理操作路径触达此场景（补漏时查到已取消场次名字），无防护则静默污染

3. **⚠️ S3（T5）：paused 成员平台级出勤的补录路径未定义**
   - paused 期间平台级场次不写出勤（有意设计，DR-186）→ 请假结束后是否可补录无定义
   - 严重度：若 paused 期间错过多场平台级共修，无补录路径可能影响学员升学出勤达标，且学员无感知（签到时看到"成功"但不知净土班没记录）

---

*报告产出：`docs/_handoff/reports/design/03-regression-capability8-seams.md`*
*DR 依据来源：`docs/_handoff/decisions/08-merged-design.md` §八（DR-185/186/187/188/189/163/89 原文）*
