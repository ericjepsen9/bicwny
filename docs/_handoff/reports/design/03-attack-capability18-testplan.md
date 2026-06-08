# 能力18 角色与权限 · 越权测试剧本与验收标准

> **文档用途**：本文是可直接交付给工程/QA 同事执行的越权（权限提升 / 横向越权）测试剧本。
> 每个场景含：前置数据、攻击步骤（精确到 API 端点）、**验收标准（期望系统行为）**、当前设计状态、结果记录列。
> **配套分析报告**：`03-attack-capability18-rbac.md`（红队判定，解释每条为什么是漏洞 / 靠实现 / 明文拦）。
> 生成日期：2026-06-06 · 测试对象：能力18（角色与权限） · 场景数：16（A1–A16）

---

## 一、怎么用这份文档

1. 先按 **§二 测试夹具** 准备测试账号、角色分配、班级、专业（fixtures）。
2. 按 **§四 测试场景** 逐条执行攻击步骤。
3. 对照每条的 **验收标准** 判定 Pass / Fail，填入 **结果** 列。
4. **判定口径**（§三）：系统正确拦截（返回预期的 403/409 等）= **Pass**；攻击成功或行为未定义 = **Fail**。
5. 跑完后汇总到 **§五 结果汇总**，Fail 的对照 **§六 缺口修复验收标准** 跟进。

> ⚠️ **设计状态 ≠ 测试结论**。「当前设计状态」列标的是*设计文档层面*是否定义了拦截（来自配套分析报告）；
> 🔴/🟡 不代表实现一定有漏洞，而是提示**这些条目最可能 Fail，必须实测**。✅ 条目是设计已明文要求拦截、应当 Pass 的基线。

---

## 二、测试夹具（fixtures · 执行前准备）

### 专业与班级

| 实体 | ID | 归属 | 说明 |
|---|---|---|---|
| 专业·加行 | `prog_jiaxing` | — | 测试主专业 |
| 专业·净土 | `prog_jingtu` | — | 跨学科越权用 |
| A班 | `class_A` | 加行 | 主测试班 |
| B班 | `class_B` | 加行 | 作用域混淆用 |
| 净土C班 | `class_C` | 净土 | 跨学科越权目标 |

### 测试账号与角色分配（UserRoleAssignment）

| 账号 | 角色分配（active） | 同时是学员？ | 用于场景 |
|---|---|---|---|
| **小王-T** | A班 class_tutor | ✔ A班 student | A1、A3① |
| **小王-A** | A班 class_admin | ✔ A班 student | A2、A3②③ |
| **小李** | A班 class_tutor(L1) + B班 class_admin(L2) | — | A4、A5、A6 |
| **小赵** | 加行 subject_admin | — | A7、A8 |
| **小钱** | A班 class_tutor | — | A9、A10 |
| **小孙** | 加行 subject_admin | — | A11、A12 |
| **小周** | A班 class_admin | — | A13、A14 |
| **小吴-H** | A班 class_tutor + 学员 cohortStatus=`held_back` | ✔ | A15 |
| **小吴-D** | A班 class_tutor + 学员 cohortStatus=`disqualified` | ✔ | A16 |
| 参照·普通学员 | 无管理角色 | ✔ | 各场景做被操作对象 |

### 涉及端点速查（来自 09 文档）

| 操作 | 端点 | 设计守卫 |
|---|---|---|
| 补卡 | `POST /api/coach/sessions/:id/makeup` | class_tutor+ |
| 撤销出勤 | `DELETE /api/coach/attendance/:recordId` | class_admin+ |
| 升学条件豁免 | `PATCH /api/advancement-checks/:id/exempt` | class_admin+ |
| 升学审核 | 能力10 升学审核端点（approve/reject） | class_admin+ |
| 特殊身份认定 | `POST /api/admin/students/:uid/special-status` | class_admin+ |
| 角色任命 | `POST /api/admin/users/:uid/roles` | 按任命链 |
| 角色撤销 | `POST /api/admin/role-assignments/:id/revoke` | 同级或更高 |
| 平台级场次 | `POST /api/admin/sessions/platform` | super_admin |
| 撤销升学（DR-184）| 能力10 super_admin 受限端点 | super_admin |

---

## 三、Pass / Fail 判定口径

| 结果 | 含义 |
|---|---|
| ✅ **Pass** | 系统按验收标准正确拦截（返回预期错误码，无副作用写入） |
| ❌ **Fail** | 攻击成功（产生了越权写入/读取），**或**系统行为未定义（无明确拒绝、500、静默放行） |
| ⏭ **Blocked** | 因依赖功能未实现无法执行，记录原因 |

> 「行为未定义」一律记 **Fail**——安全测试中"没想到所以没拦"和"被攻破"后果等价。

---

## 四、测试场景（A1–A16）

---

### 攻击组 1：自肥（管理员对自己操作）

---

#### A1 · 辅导员给自己补打卡

- **攻击者**：小王-T（A班 class_tutor + A班 student）
- **前置**：存在一个 A班共修场次 `sess_x`，小王本人未签到。
- **攻击步骤**：以小王-T 身份调
  `POST /api/coach/sessions/sess_x/makeup`，body `{ userId: <小王自己的userId>, reason: "test" }`
- **验收标准（期望系统行为）**：
  系统应**拒绝对操作者本人补卡**，返回 403/409 并提示"不可对自己执行该操作"，不写入 StudyRecord。
- **当前设计状态**：🔴 设计无 `operatorId ≠ targetUserId` 约束（06能力8 补卡规则未限制本人）
- **结果**：☐ Pass ☐ Fail

---

#### A2 · 班级管理员给自己豁免升学条件

- **攻击者**：小王-A（A班 class_admin + A班 student）
- **前置**：小王本人有一条未通过的升学预检条件（`isExemptable=true`）。
- **攻击步骤**：以小王-A 身份调
  `PATCH /api/advancement-checks/<小王自己的checkId>/exempt`，body `{ conditionKey, exempt:true, reason:"test" }`
- **验收标准**：
  系统应**拒绝对操作者本人的升学条件授予豁免**，返回 403，不更新 exempted、不重算 overallPassed。
- **当前设计状态**：🔴 D17/DR-188/能力5 均无 self-operation 禁止 —— **最高危**（直接绕过升学硬条件）
- **结果**：☐ Pass ☐ Fail

---

#### A3 · ⭐组合：身兼 class_admin + 学员，给自己做三类操作

| 子项 | 攻击步骤 | 验收标准 | 设计状态 | 结果 |
|---|---|---|---|:---:|
| **A3①** 自补出勤 | 小王-A 调 `POST /api/coach/sessions/:id/makeup`，userId=自己 | 拒绝（同 A1） | 🔴 无明文 | ☐P ☐F |
| **A3②** 自豁免升学 | 小王-A 调 `PATCH /api/advancement-checks/:id/exempt`，目标=自己 | 拒绝（同 A2） | 🔴 无明文 | ☐P ☐F |
| **A3③** 自改特殊身份 | 小王-A 调 `POST /api/admin/students/<自己>/special-status`，body `{statusType:'blind'}` | 拒绝对本人认定特殊身份 | 🔴 能力12 无明文 | ☐P ☐F |

- **A3 结论要点**：三类操作**设计层均未明文禁止 self-operation**，预期三条全 Fail。其中 A3② 后果最严重。

---

### 攻击组 2：作用域混淆（一人多角色"借位"）

---

#### A4 · A班辅导员借 B班管理员身份，在 A班撤销出勤

- **攻击者**：小李（A班 class_tutor=L1 + B班 class_admin=L2）
- **前置**：A班存在一条出勤记录 `rec_a`（属 A班某学员）。撤销出勤需 class_admin（L2），小李在 A班只有 L1。
- **攻击步骤**：以小李身份调
  `DELETE /api/coach/attendance/rec_a`，body `{reason:"test"}`
- **验收标准**：
  系统鉴权应**只取小李在 A班（目标 classId）的角色等级 = 1**，1 < 2 → 返回 403。
  **不得**因小李在 B班持有 class_admin 而放行 A班操作。
- **当前设计状态**：🟡 设计意图正确（02文档 §二 `rolesInScope(scope)` 伪码），但无独立 DR 硬约束"按目标 classId 取等级、禁止取全局 max"
- **结果**：☐ Pass ☐ Fail

---

#### A5 · ⭐核心验证：鉴权按"目标作用域等级"还是"全局最高等级"？

- **攻击者**：小李（同 A4）
- **目的**：直接验证鉴权算法实现取的是哪个等级。
- **执行方式**：对一组 A班 class_admin 级端点（撤销出勤、升学审核、豁免、邀请码生成）逐个用小李身份调用，观察是否被拦。
- **验收标准**：
  全部返回 403（证明实现按目标 classId=A班 取 L1）。
  **任一放行 = 作用域混淆漏洞确认存在**（证明实现取了全局 max=L2）。
- **当前设计状态**：🟡 —— **本剧本最关键一条**。「按目标 classId 过滤」**没有独立 DR 明文**，仅 02 伪码体现，且 09 文档"取最高有效角色"措辞有歧义。
- **结果**：☐ Pass ☐ Fail

---

#### A6 · 作用域混淆危害范围确认（A4/A5 成立时）

- **前置**：仅当 A5 判定漏洞存在时执行。
- **攻击步骤**：以小李身份在 A班逐一尝试 class_admin 专属 14 项操作。
- **验收标准**：A4/A5 已 Pass（拦截）时本项 N/A；若 A5 Fail，记录小李在 A班实际能越权执行的操作清单。
- **危害清单（14项）**：撤销出勤(#22)、报数审核(#2)、升学审核(#16)、代行豁免(#21)、邀请码生成/撤销(#5)、成绩录入(#7)、特殊身份认定(#13)、取消虚报资格(#14)、批准替代顶礼(#12)、批准自学(#6)、班级共修管理(#4)、出升学考题(#11b)、主动关怀(#3)、配对辅助员(#19)
- **当前设计状态**：🟡（依赖 A4/A5）
- **结果**：☐ Pass ☐ Fail ☐ N/A

---

### 攻击组 3：跨学科越权

---

#### A7 · 加行学科管理员给净土班级任命角色

- **攻击者**：小赵（加行 subject_admin，programId=prog_jiaxing）
- **前置**：净土C班 `class_C` 属 prog_jingtu。
- **攻击步骤**：以小赵身份调
  `POST /api/admin/users/<某用户>/roles`，body `{ role:'class_tutor', classId:'class_C' }`
- **验收标准**：
  系统应校验目标 `class_C` 属于操作者 programId（加行）——不属于 → 返回 403。
  **不得**允许加行 subject_admin 给净土班级任命。
- **当前设计状态**：🟡 任命端点守卫只写"按任命链"，**无明文要求校验目标 classId 属于操作者 programId**
- **结果**：☐ Pass ☐ Fail

---

#### A8 · 加行学科管理员读/改净土班级数据

- **攻击者**：小赵（加行 subject_admin）
- **攻击步骤**：以小赵身份调 subject_admin+ 级的净土班级数据端点（如净土C班学员数据、报数、审计日志查询）。
- **验收标准**：
  返回的数据应**按 programId 过滤，仅限加行**；访问净土数据应被拒或返回空。
  审计查询端点已明文"subject_admin=本学科（按 scope 过滤）"，应正确隔离。
- **当前设计状态**：🟡 审计端点已明文 scope 过滤；**其他 subject_admin+ 端点守卫只写"subject_admin+"，无逐一 programId 过滤明文**
- **结果**：☐ Pass ☐ Fail

---

### 攻击组 4：垂直越权

---

#### A9 · 辅导员直接调 class_admin 级端点

- **攻击者**：小钱（A班 class_tutor，L1）
- **攻击步骤**：以小钱身份调 class_admin 级端点：① 升学审核（能力10 approve）② 撤销出勤 `DELETE /api/coach/attendance/:recordId`
- **验收标准**：均返回 403（L1 < 要求的 L2）。
- **当前设计状态**：✅ 明文拦 —— 06能力18 绝对约束1（等级数值判定）+ 09守卫 `userLevel >= requiredLevel`
- **结果**：☐ Pass ☐ Fail（**应 Pass**——基线）

---

#### A10 · 辅导员调 super_admin 专属端点

- **攻击者**：小钱（A班 class_tutor，L1）
- **攻击步骤**：① 平台级场次 `POST /api/admin/sessions/platform` ② 撤销升学（DR-184 super_admin 受限端点）
- **验收标准**：均返回 403。
- **当前设计状态**：✅ 明文拦 —— DR-190 绝对约束6"仅 super_admin 可执行，class_admin 及以下返回 403"
- **结果**：☐ Pass ☐ Fail（**应 Pass**——基线）

---

### 攻击组 5：任命链越级

---

#### A11 · 学科管理员任命另一个同级学科管理员

- **攻击者**：小孙（加行 subject_admin，L3）
- **攻击步骤**：以小孙身份调
  `POST /api/admin/users/<某用户>/roles`，body `{ role:'subject_admin', programId:'prog_jiaxing' }`
- **验收标准**：
  系统应校验 body.role 在操作者可任命集内——subject_admin 只能任命 class_admin/class_tutor（02文档 §六 `subject_admin ← super_admin`）→ 返回 403。
- **当前设计状态**：🟡 任命链有明文，但**无 DR 明文要求端点校验 body.role 值域**（若实现只验操作者等级≥3 即放行则被攻破）
- **结果**：☐ Pass ☐ Fail

---

#### A12 · 学科管理员给自己升级 super_admin

- **攻击者**：小孙（加行 subject_admin，L3）
- **攻击步骤**：调 `POST /api/admin/users/<自己>/roles`，body `{ role:'super_admin' }`
- **验收标准**：
  返回 403——双重拦截：① body.role=super_admin 超出 subject_admin 可任命集（`super_admin ← super_admin`）；② 自我任命应禁止。
- **当前设计状态**：🟡 同 A11；**自我任命（uid=自己）亦无明文禁止**
- **结果**：☐ Pass ☐ Fail

---

### 攻击组 6：撤角色后的余权

---

#### A13 · 角色撤销与 in-flight 请求的竞态

- **攻击者/对象**：小周（A班 class_admin）
- **攻击步骤**：小周提交一个升学审核请求（处理中）；在同一时刻，super_admin 调 `POST /api/admin/role-assignments/<小周的assignment>/revoke` 撤销其 class_admin。
- **验收标准**：
  设计应明确定义此竞态的处理（事务中止 或 完成后失效），且行为可预期、一致。
- **当前设计状态**：🔴 DR-114"即时生效"仅针对**新请求**鉴权；**in-flight 事务**是否中止**完全未定义**
- **结果**：☐ Pass ☐ Fail（**行为未定义即 Fail**）

---

#### A14 · 撤角色后历史代行记录是否失效

- **对象**：小周（A班 class_admin）
- **前置**：小周此前对多个学员发出过代行豁免（active ProxyAction）。
- **攻击步骤**：撤销小周的 class_admin 角色后，检查其此前发起的 active ProxyAction 是否仍生效（受益学员是否仍享豁免）。
- **验收标准**：
  设计应明确定义"角色撤销 → 该用户 active ProxyAction 的处理策略"（自动失效 / 保留 / 转人工复核），且有留痕。
- **当前设计状态**：🔴 D18/DR-193 均不涉及此联动，**完全未定义**
- **结果**：☐ Pass ☐ Fail（**未定义即 Fail**）

---

### 攻击组 7：状态机 × 权限（学员状态影响管理角色？）

---

#### A15 · 留级学员保留辅导员权限

- **攻击者**：小吴-H（A班 class_tutor + 学员 cohortStatus=`held_back`）
- **攻击步骤**：小吴留级后，以辅导员身份继续操作（补卡、线下勾选、查看全班学员数据）。
- **验收标准**：
  设计应**明文定义**留级（held_back）是否影响其辅导员角色。
  —— 可接受"不影响"（两身份独立），但**必须写明**，不能是未定义的默认行为。
- **当前设计状态**：🔴 ClassMember 与 UserRoleAssignment 独立，P4"身份不互斥"，但**无 DR 明文说 cohortStatus 终态是否联动角色**——边界未定义
- **结果**：☐ Pass ☐ Fail（**未定义即 Fail**）

---

#### A16 · 取消资格学员保留辅导员权限

- **攻击者**：小吴-D（A班 class_tutor + 学员 cohortStatus=`disqualified`）
- **攻击步骤**：小吴被取消资格（DQ，通常因严重违规）后，以辅导员身份继续操作班级。
- **验收标准**：
  设计应**明文定义**：disqualified 时是否自动（或要求手动）撤销其 UserRoleAssignment。
  —— DQ 后仍持辅导员权限几乎可肯定非预期，应有阻断路径。
- **当前设计状态**：🔴 同 A15，且 DQ 比留级更严重，**未定义危害更大**
- **结果**：☐ Pass ☐ Fail（**未定义即 Fail**）

---

## 五、结果汇总（执行后填写）

| 攻击 | 名称 | 设计状态 | 实测结果 | 备注 |
|---|---|:---:|:---:|---|
| A1 | 辅导员自补卡 | 🔴 | ☐P ☐F | |
| A2 | 管理员自豁免升学 | 🔴 | ☐P ☐F | |
| A3① | 自补出勤 | 🔴 | ☐P ☐F | |
| A3② | 自豁免升学 | 🔴 | ☐P ☐F | |
| A3③ | 自改特殊身份 | 🔴 | ☐P ☐F | |
| A4 | 作用域借位撤出勤 | 🟡 | ☐P ☐F | |
| A5 | ⭐目标 vs 全局等级 | 🟡 | ☐P ☐F | |
| A6 | 借位危害范围 | 🟡 | ☐P ☐F ☐NA | |
| A7 | 跨学科任命 | 🟡 | ☐P ☐F | |
| A8 | 跨学科读数据 | 🟡 | ☐P ☐F | |
| A9 | 辅导员调 admin 端点 | ✅ | ☐P ☐F | 基线 |
| A10 | 辅导员调 super 端点 | ✅ | ☐P ☐F | 基线 |
| A11 | 任命同级 subject_admin | 🟡 | ☐P ☐F | |
| A12 | 自升 super_admin | 🟡 | ☐P ☐F | |
| A13 | 撤角色×in-flight 竞态 | 🔴 | ☐P ☐F | |
| A14 | 撤角色后 ProxyAction 余权 | 🔴 | ☐P ☐F | |
| A15 | 留级保留辅导员权 | 🔴 | ☐P ☐F | |
| A16 | DQ 保留辅导员权 | 🔴 | ☐P ☐F | |

**设计层基线**：✅ 明文拦 2（A9/A10，应 Pass） · 🟡 靠实现 7 条目（A4/A5/A6/A7/A8/A11/A12） · 🔴 未定义 8 条目（A1/A2/A3×3/A13/A14/A15/A16）

---

## 六、缺口修复验收标准（Fail 项整改后须满足）

> 给修复方：每条整改后，对应攻击场景须从 Fail 转 Pass，并补齐设计文档明文。

| 缺口 | 修复后验收标准 | 落档位置建议 |
|---|---|---|
| **L1 自操作**（A1/A2/A3）| 所有高权限操作端点应用层校验 `operatorId ≠ targetUserId`，本人为目标时返回 403 | 06能力18 新增绝对约束；各端点（makeup/exempt/special-status）守卫说明 |
| **L4 终态联动**（A16）| 明文定义 disqualified 触发撤销/挂起 UserRoleAssignment 的策略，并留痕 | 06能力18 或 能力11 绝对约束 |
| **H1 作用域算法**（A4/A5）| 新增独立 DR 明文："一人多角色鉴权取**目标作用域内**最高等级，禁止取全局 max"；消除"最高有效角色"歧义 | 08 新 DR + 09能力18 守卫说明 |
| **L3 ProxyAction 余权**（A14）| 明文定义角色撤销时 active ProxyAction 处理策略（失效/保留/复核三选一）| 08 新 DR + 06能力5 |
| **H2 跨学科任命**（A7）| 任命端点守卫补"且目标 classId 须属于操作者 programId" | 09能力18 任命端点说明 |
| **H4 任命值域**（A11/A12）| 任命端点校验 body.role 在操作者可任命集内；禁止自我升级 | 09能力18 任命端点说明 |
| **L4 留级联动**（A15）| 明文定义 held_back 是否影响管理角色（可"不影响"，但须写明）| 06能力18 绝对约束 |
| **L2 in-flight 竞态**（A13）| 定义并发撤销与 in-flight 事务策略（事务完成/分布式锁二选一）| 08 新 DR |

---

## 七、最严重 3 个风险（修复优先级 P0）

1. 🥇 **A2/A3② 自肥豁免升学**：class_admin 兼学员可豁免自己全部升学硬条件，升学关卡形同虚设。
2. 🥈 **A16 DQ 保留辅导员权**：严重违规被取消资格者仍可操作班级，无自动阻断。
3. 🥉 **A4/A5 作用域借位**：实现若取全局最高等级，任意班的 class_admin 可在所有其他班行使 14 项 admin 操作——调正常端点即可越权。

---

*本剧本仅覆盖能力18 角色权限越权面。结果记录后请连同 `03-attack-capability18-rbac.md` 一并归档。*
