# 能力18 · 越权攻击测试报告（红队 × 安全裁判）

> 生成日期：2026-06-06
> 测试范围：A1–A16，共 16 个攻击场景
> 判定标准：**明文 = 有 DR 编号 / 端点守卫文字 / 绝对约束编号可引用**；仅有设计意图/伪码/说明注记 = 不算明文，标 🟡 或 🔴

---

## 一、攻击判定总表

| 攻击 | 场景摘要 | 设计层能否拦截 | 明文依据 / 漏洞定性 | 判定 |
|---|---|---|---|:---:|
| **A1** | 辅导员给自己补打卡（makeup userId=自己） | ❌ 不能 | 无任何文档写 `operatorId ≠ targetUserId` 约束；06 能力8 补卡规则只说"辅导员/管理员可任何时候补卡·选定学员"，未限制"不含自己" | 🔴 |
| **A2** | class_admin 对自己发代行豁免（升学条件） | ❌ 不能 | 06 能力5 绝对约束1-7 无 self-operation 禁止；D17 只说"班级管理员及以上可对学员档案做豁免"，未限制操作者≠被操作者 | 🔴 |
| **A3①** | 给自己补出勤 | ❌ 不能 | 同 A1；无明文 | 🔴 |
| **A3②** | 给自己豁免升学条件 | ❌ 不能 | 同 A2；无明文 | 🔴 |
| **A3③** | 给自己改特殊身份认证（职能#13） | ❌ 不能 | 06 能力12（特殊身份认定）无 self-operation 禁止；职能#13 只限 class_admin W，无法人不能是被认证者约束 | 🔴 |
| **A4** | A班辅导员用B班 class_admin "借位"撤销A班出勤 | 设计意图能拦，无明文 DR | 02文档 §二 canDo 伪码明示 `rolesInScope(scope)` 取值（非全局 max）；09文档 DR-191 路由守卫 `classId=:id AND roleLevel>=1 AND status=active` 隐含按目标班过滤；但"一人多角色取满足该操作的最高有效角色"措辞有歧义，无独立 DR 明文约束"必须按目标 classId 取等级，禁止取全局 max" | 🟡 |
| **A5** | ⭐"按目标 classId 过滤"的明文依据在哪？ | 无单独 DR，有设计意图 | **最接近明文**：02文档 §二 `canDo(user, permission, scope)` 伪码——`max(user.rolesInScope(scope).map(r=>ROLE_LEVEL[r]))` 明示 scope 参数决定取哪些 assignments；09文档 DR-191 路由守卫格式补充印证。**但：** 这是设计意图伪码，不是编号 DR 约束；09文档同一处又说"一人多角色取**满足该操作的最高有效角色**"，未显式排除"全局 max"解读。无单独 DR 明文写"禁止取全局最高等级" | 🟡 |
| **A6** | A4漏洞存在时的危害范围 | — | 若作用域混淆，A班辅导员可在A班行使 class_admin 全部 14 项专有操作：撤销出勤(#22)、报数审核(#2)、升学审核(#16)、代行豁免(#21)、邀请码生成/撤销(#5)、成绩录入(#7)、特殊身份认定(#13)、取消虚报资格(#14)、批准替代顶礼(#12)、批准自学(#6)、班级共修管理(#4)、出升学考题(#11b)、主动学员关怀(#3)、配对辅助员(#19)——实质上等于完全绕过 class_admin 授权 | 🟡（依赖A4） |
| **A7** | 加行 subject_admin 给净土班级任命 class_tutor | 设计意图能拦，无明文 | 09文档 能力18 API 守卫写"**按任命链**"，仅校验**谁能任命哪个层级**（任命链），未明文写"还须校验目标 classId 属于操作者 programId"；DR-191 有通用注记"subject_admin 在其 programId 范围内可操作该学科全部班级"，但该注记在路由守卫说明里，不是任命端点的硬约束；无 DR 明文说任命时 programId 跨学科须 403 | 🟡 |
| **A8** | 加行 subject_admin 读/改净土班级数据 | 部分明文，部分靠意图 | **已明文**：09文档 `GET /api/admin/audit-logs` 守卫注记明写"subject_admin=本学科（按 scope 过滤，能力18）"；**未明文**：其他 subject_admin 可见端点守卫只写"subject_admin+"，无 programId 过滤注记；总体依赖 DR-191 通用注记兜底，非全端点逐一明文 | 🟡 |
| **A9** | 辅导员(level1)直接调 class_admin 级端点（升学审核、撤销出勤） | ✅ 能拦 | **明文依据**：06 能力18 绝对约束1（"权限判定必须基于角色等级数值"）+ 09文档 能力18 守卫说明（"中间件按角色等级数值比较 `userLevel >= requiredLevel` 放行"）；class_admin 级端点 requiredLevel=2，辅导员 userLevel=1，1<2 → 403 | ✅ |
| **A10** | 辅导员调 super_admin 专属端点（撤销升学 DR-184、平台级场次 DR-186） | ✅ 能拦 | **明文依据**：06 能力18 绝对约束6（DR-190）"以下操作仅 super_admin 可执行，**class_admin 及以下调用须返回 403**"，两项操作均在 DR-190 六项清单内；09文档 `POST /api/admin/sessions/platform` 守卫明写 "super_admin" | ✅ |
| **A11** | subject_admin 调任命端点 body.role="subject_admin"（造同级） | 设计意图能拦，无独立 DR | **任命链明文**：02文档 §六 "subject_admin ← super_admin"（仅 super_admin 可任命 subject_admin），09文档 API "任命链校验：subject←super"；**漏洞缺口**：无 DR 明文写"任命端点须校验 body.role 不超出操作者可任命的角色集"，仅说守卫"按任命链"——若实现只校验操作者等级(≥3 即放行)而不校验 body.role 值域，攻击成功 | 🟡 |
| **A12** | subject_admin 给自己升级成 super_admin | 设计意图能拦，无独立 DR | 同 A11；"super_admin ← super_admin" 链明文（02文档 §六），subject_admin level=3 < super_admin level=99，若实现正确校验 body.role 的任命链 → 403；但同样无 DR 明文约束 body.role 值域校验逻辑；额外风险：**自我任命**（uid=自己）本身也无明文禁止 | 🟡 |
| **A13** | class_admin 提交升学审核请求进行中，同时被撤销角色，请求完成还是中止？ | ❌ 未定义 | DR-114 明文"角色变更/撤销须即时生效"，但这针对**新请求**的鉴权（查库 + 缓存）；**in-flight 事务**（已通过鉴权、正在执行 DB 写入的请求）是否因并发撤销而中止，设计文档完全未定义；无任何 DR 定义"撤销触发已进入事务的操作回滚" | 🔴 |
| **A14** | 角色被撤后，数据库中 active 的 ProxyAction 记录是否自动失效？ | ❌ 未定义 | D18 规定数据永不物理删除；DR-193 只定义多层代行撤回时的原生字段回滚逻辑；无任何 DR 定义"UserRoleAssignment 撤销 → 该用户发起的 active ProxyAction 自动标失效"；撤销角色后其历史代行记录（豁免/替代）继续有效，受益学员不受影响 | 🔴 |
| **A15** | held_back 学员同时是辅导员，留级影响辅导员权限吗？ | ❌ 未定义 | ClassMember.cohortStatus 和 UserRoleAssignment 是独立表；P4 明言"身份不互斥"；08文档 ClassMember 设计意图说"管理角色叠加在 UserRoleAssignment 上，ClassMember 只表达属于这个班"；但**无任何 DR 明文说 cohortStatus 变更不触发 UserRoleAssignment 联动**，也没有说"该联动"——边界完全未定义，held_back 后辅导员权限实际保持不变（因为表不联动），设计是否接受此行为未作答 | 🔴 |
| **A16** | disqualified 学员同时是辅导员，取消资格影响辅导员权限吗？ | ❌ 未定义 | 同 A15；disqualified 是终态（DR-182），再入学须新建 ClassMember（DR-152）；但 UserRoleAssignment 不联动，辅导员权限保持 active；设计未定义"disqualified 时须自动撤销 UserRoleAssignment"；**disqualified 比 held_back 更严重**：DQ 通常是严重违规（虚报忏悔等），该用户仍保有辅导员权限极大不合理 | 🔴 |

---

## 二、统计

| 判定 | 数量 | 攻击编号 |
|---|:---:|---|
| ✅ 设计明文拦截 | 2 | A9、A10 |
| 🟡 设计意图对但靠实现层保证 | 6 | A4、A5、A6（条件成立）、A7、A8、A11、A12 |
| 🔴 设计层完全未定义拦截 | 8 | A1、A2、A3(①②③)、A13、A14、A15、A16 |

> A3 含3个子操作，独立计数则 🔴 总计 10 个判定单元；以攻击编号计共 8 个 🔴。

---

## 三、🔴 漏洞清单（设计层完全未定义拦截）

### L1：管理员自操作——无 `operatorId ≠ targetUserId` 约束（A1/A2/A3）

**影响操作**：补打卡（class_tutor，职能#23）、代行豁免（class_admin，职能#21）、特殊身份认定（class_admin，职能#13）

**根因**：所有高权限操作端点的设计只检查"操作者角色等级"，不检查"操作者是否是被操作目标学员"。D17、DR-189、06能力5/8/12全部没有写 `operatorId ≠ targetUserId`。

**严重性**：A2/A3② 最高——class_admin 兼学员可给自己豁免升学条件，直接绕过升学预检的全部6个硬条件。

---

### L2：in-flight 请求×角色撤销——事务中操作不回滚（A13）

**根因**：DR-114 定义的"即时生效"是基于 JWT 鉴权机制（每请求查库），但对已通过鉴权、进入 DB 事务执行的请求，无任何设计定义是否中止。

**严重性**：中。窗口极短（毫秒级），但理论上升学审核/代行豁免等高影响操作可在撤销瞬间完成。

---

### L3：角色撤销不级联失效 ProxyAction（A14）

**根因**：D18（永不物理删除）+ DR-193（撤回逻辑）均不提"角色撤销 → ProxyAction 失效"。设计完全没有定义此联动。

**严重性**：中高。如果 class_admin 在离职/被撤前对多个学员发出了豁免，这些豁免继续生效。

---

### L4：学员 cohortStatus 终态不联动 UserRoleAssignment（A15/A16）

**根因**：ClassMember（学员籍贯状态）和 UserRoleAssignment（管理角色）是独立表，P4 设计不互斥，但没有定义"当 cohortStatus 变为终态（held_back/disqualified）时，是否应触发 UserRoleAssignment 的处理"。

**A16 (disqualified) 严重性更高**：取消资格通常因严重违规（虚报），DQ 后该用户仍持有辅导员权限可继续操作班级——这几乎可以肯定不是设计意图，但设计文档没有定义任何阻断路径。

---

## 四、🟡 实现层高危清单（设计意图正确但无明文约束）

### H1：作用域 classId 过滤算法歧义（A4/A5）

**最接近明文的依据**：02文档 §二 canDo 伪码 `rolesInScope(scope)` + 09文档 DR-191 路由守卫格式

**歧义点**：09文档同一处"一人多角色取满足该操作的**最高有效角色**"措辞未显式排除"取全局 max 再检查作用域"的解读。若实现者取全局 max，A班辅导员因B班 class_admin 而在A班获得 level2 权限——危害见 A6。

**无明文的缺口**：无独立 DR 写"必须按目标 classId 取等级、禁止取全局 max"。

---

### H2：subject_admin 跨学科任命——任命端点缺 programId 校验（A7）

**最接近明文的依据**：09文档 DR-191 通用注记"subject_admin 在其 programId 范围内可操作该学科全部班级"

**缺口**：任命端点 `POST /api/admin/users/:uid/roles` 守卫描述只写"按任命链"，未写"并且目标 classId 须属于操作者 programId"。任命链只验证操作者等级，不验证目标 class 的归属学科。

---

### H3：subject_admin 数据访问边界——非全端点明文（A8）

**已明文**：审计日志查询端点有"按 scope 过滤"注记。

**未明文**：其他 subject_admin 端点守卫只写"subject_admin+"，无 programId 过滤硬约束。

---

### H4：任命端点 body.role 值域校验（A11/A12）

**最接近明文的依据**：02文档 §六 任命链图（"class_admin·class_tutor←subject_admin 或 super"）

**缺口**：无 DR 明文写"任命端点须校验 body.role 值不超出操作者被允许任命的角色集"。若实现只校验操作者等级（subject_admin=3 >= 1 即放行）而不校验 body.role 值，subject_admin 可以发出任命 subject_admin 的 assignment。

---

## 五、重点问题逐条回答

### ⭐ A5：按目标 classId 过滤，有没有明文 DR？

**结论：没有单独 DR，有设计意图伪码，有歧义措辞。**

最强证据：02文档 §二 代码实现思路伪码
```typescript
function canDo(user, permission, scope) {
  const userMaxLevel = max(user.rolesInScope(scope).map(r => ROLE_LEVEL[r]));
  return userMaxLevel >= PERMISSION_REQUIREMENTS[permission];
}
```
`rolesInScope(scope)` 明示"只取与 scope 匹配的 assignments 的等级"，而非全局 max。这是目前能找到的最接近明文的依据。

但三个问题使它不算"硬约束明文"：
1. 它是"代码实现思路"伪码，非编号 DR 约束
2. 09文档同一处"一人多角色取满足该操作的**最高有效角色**"措辞模糊
3. 无单独 DR 专门定义"一人多角色场景下的 scope 过滤算法"

**判定**：🟡。设计意图是正确的（scope-based），但没有 DR 级别的强约束，实现层有分歧可能。

---

### A3：管理员 self-operation，三种操作哪些明文禁止了？

| 操作 | 明文禁止？ | 来源 |
|---|---|---|
| ① 补出勤（职能#23，class_tutor W） | ❌ 无 | 06能力8 补卡规则未限"操作者≠学员本人" |
| ② 豁免升学条件（职能#21，class_admin W） | ❌ 无 | D17、06能力5、DR-188 均未写 self-operation 禁止 |
| ③ 改特殊身份认证（职能#13，class_admin W） | ❌ 无 | 06能力12 未写 self-operation 禁止 |

**全部三项均无明文禁止**。三者均标 🔴。其中②最危险（直接绕过升学硬条件）。

---

### A7：subject_admin 跨学科任命，有没有 programId 校验明文？

**结论：没有。**

任命端点 `POST /api/admin/users/:uid/roles` 的守卫描述（09文档）：

> 守卫：**按任命链**；任命链校验：super←super / subject←super / class_admin·class_tutor←subject_admin 或 super；作用域字段按 role 必填

"作用域字段按 role 必填"只要求入参里填 classId，不要求校验该 classId 是否属于操作者的 programId。

09文档 DR-191 通用注记"subject_admin 在其 programId 范围内"是路由守卫的一般性说明，不是任命端点的硬约束。

**判定**：🟡。programId 跨学科任命的守卫有设计意图但无该端点的明文校验要求。

---

### A15/A16：学员 cohortStatus（留级/取消资格）和管理角色，是否独立？设计想过吗？

**是独立的——但设计没有明文说这个独立是有意的，且没有定义边界。**

两表（ClassMember 与 UserRoleAssignment）独立存在是设计事实。P4 说"身份不互斥"，08文档 ClassMember 说"管理角色叠加在 UserRoleAssignment 上"。但文档没有写：

- "cohortStatus 变化不触发 UserRoleAssignment 变化"（没说独立的下限）
- "cohortStatus=disqualified 时应自动撤销 UserRoleAssignment"（没说应该联动）

两个边界都没定义。**设计没想过这个交叉场景**。

实际效果：disqualified 学员的辅导员权限保持 active，直到有人手动撤销 UserRoleAssignment。这在运营上几乎可以肯定是非预期行为。标 🔴。

---

## 六、最严重3个越权风险

### 🥇 第1：A2/A3②——class_admin 给自己豁免升学条件（自肥型越权）

**等级**：🔴 严重

升学预检（能力10）是整个学修体系的核心关卡，有6项硬条件。一个 class_admin 兼学员，若发现自己某条件不达标，可直接调豁免端点 `PATCH /api/advancement-checks/:id/exempt`，body 里 conditionKey 指向自己的条件，exempt=true——系统目前设计无法区分。

后果：升学硬条件完全形同虚设。理论上该角色可以全部豁免自己的升学条件，在无任何达标的情况下完成"升学"。

---

### 🥈 第2：A16——disqualified（取消资格）学员保留辅导员权限

**等级**：🔴 严重

取消资格的触发场景通常是严重违规（虚报忏悔、DQ）。DQ 是终态（DR-182），该学员的 ClassMember 进入终止状态。但 UserRoleAssignment 独立，仍 active——该用户继续以辅导员身份：
- 给其他学员补打卡（职能#23）
- 操作班级共修（职能#4 R）
- 查看全班学员数据（职能#8 R）

对平台的信任危害极大，且无自动阻断机制。

---

### 🥉 第3：A4/A5——作用域混淆（一人多角色借位）

**等级**：🟡 高危（实现层）

若实现者取"全局最高等级"而非"目标班等级"，一个在任意班持有 class_admin 的用户，可以在其**所有其他班**（哪怕只是辅导员）行使 class_admin 级全部14项操作。这不需要额外调用任何"越权"接口——直接调正常端点即可绕过。

危害范围见 A6：覆盖升学审核、代行豁免、撤销出勤、成绩录入等最高敏感操作。

---

## 七、推荐闭合优先级

| 优先级 | 问题 | 修复方向 |
|---|---|---|
| P0 | L1（A1/A2/A3）self-operation | 对所有高权限端点加应用层校验：`operatorId ≠ targetUserId`；写入 06 能力18 绝对约束 + 各端点守卫说明 |
| P0 | L4（A16 disqualified）| 明文定义：cohortStatus=disqualified 触发（或要求手动）撤销 UserRoleAssignment；写入 06 能力18 或 能力11 的绝对约束 |
| P1 | H1（A4/A5）算法歧义 | 新增独立 DR：明文写"一人多角色鉴权取目标作用域内的最高等级，禁止取全局 max"；消除"最高有效角色"措辞歧义 |
| P1 | L3（A14）ProxyAction 不失效 | 明文定义：角色撤销时 active ProxyAction 的处理策略（自动标失效/保留/人工审核选一个） |
| P2 | H2（A7）跨学科任命 | 任命端点守卫补"且目标 classId 须属于操作者 programId"约束，写入 09 端点说明 |
| P2 | H4（A11/A12）body.role 值域 | 09 任命端点说明补"body.role 须在操作者被允许任命的角色集内"约束 |
| P3 | L4（A15 held_back）| 明文定义：held_back 是否影响管理角色（可接受"不影响"，但必须写明） |
| P3 | L2（A13）in-flight 事务 | 定义：并发撤销与 in-flight 事务的处理策略（接受事务完成/加分布式锁选一个） |

---

*本报告仅判定设计层，不涉及代码实现。实现层漏洞需另行代码审查。*
