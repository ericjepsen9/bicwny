# 能力11场景剧本测试：小马的曲折学修路

> 生成日期：2026-06-05
> 裁判角色：对照能力11设计 + DR-149~176 + cohortStatus 状态机逐点判定
> 重点：规则组合的隐藏交叉点 + 已知缺口验证

---

## 背景

小马，健全学员，加行专业。经历留级（两次）、转专业（加行→净土）、退出再加入等多重波折。剧本覆盖：升学预检驳回 → 留级 → 验证三类指标口径差异 → 留级上限 → 留级次数洗白漏洞 → 转专业 → 转专业继承规则 → 已升学者被误操作 → 全退出 → 回归。

---

## T1-T17 判定表

| 时间点 | 系统应有的响应 | 引用依据 | 判定 |
|---|---|---|---|
| T1：2024-04，小马加行S8升学预检，差出勤（差5次），管理员驳回 | 管理员核查 AdvancementCheck（overallPassed=false，出勤条件 passed=false）→ 直接驳回，只写 AuditLog(advancement_decision, result=rejected)，**不写** AdvancementRecord。小马 cohortStatus 仍为 `active`（驳回不改状态，状态变更在留级操作时才发生）。 | DR-174（驳回不写 AdvancementRecord，只写 AuditLog）；能力 10 规则 6（管理员直接拍板，无需上报）；DR-163（出勤=current_member，93次门槛差5次即未通过） | ✅ |
| T2：2024-04，管理员发新一届邀请码，小马加入新届，旧ClassMember→held_back，heldBackCount+1 | 小马用邀请码加入新届班级（能力 2），系统创建新 ClassMember（active）；同时管理员手动将旧班 ClassMember.cohortStatus 改为 `held_back`，heldBackCount 从 0 变为 1，写 EnrollmentStatusHistory。两条 ClassMember 记录各自独立存档（D18）。 | 能力 11 规则 1（留级手动操作，走邀请码加入新届）；08 §1.2 ClassMember.heldBackCount（转 held_back 时 +1）；DR-149（7态状态机）；D18（不物理删除） | ✅ |
| T3 ⭐：2024-04，留级后三项指标各自变成什么（心咒12万、92修法200座、出勤88次）| **心咒12万**：全量历史聚合（DR-170 不过滤起修日，DR-157 不过滤 programId/vowId），留级后进新届，旧打卡记录依然被 cumulative_count 聚合计入。小马新届预检时心咒仍显示 ≥12万。**92修法200座**：practice_session 以 `loggedAt >= UserPracticeVow.createdAt`（新 vow 起修日）过滤（DR-161），留级进新届后系统为小马建立新 vow，起修日=新入班日；旧的200座打卡 loggedAt < 新 vow.createdAt，**全部不计入**新届预检，实质重算为0座。**出勤88次**：classScope=current_member（DR-163），只统计 cohortStatus='active' 当届班级，旧届已是 held_back，**88次全部不计入**新届预检，实质重算为0次。 | DR-170（cumulative_count 不过滤起修日）；DR-157（不过滤 programId/vowId）；DR-161（practice_session 起修日过滤）；DR-163（attendance current_member）；08 §3.1 各 conditionType 判定逻辑 | ✅（三项口径各自按设计行为，但设计文档未集中成文"留级后的差别对待"） |
| T4：2024-05，小马新届第一天看自己进度，系统显示什么 | **心咒**：显示12万（全量历史聚合，DR-170/DR-157）。**92修法**：显示0座（新vow起修日后无打卡，DR-161）。**出勤**：显示0次（当届active班级无历史，DR-163）。学员能否理解"为什么心咒还在、但92修法和出勤清零"——**设计无任何说明文字或UI提示**，学员需要自己意识到这个差别，设计文档没有要求前端对此做解释。 | DR-170、DR-161、DR-163；能力11（无"转班提示"UI规范） | ⚠️（数据行为有依据，但"三类口径差别"没有面向学员的解释机制，可能引发困惑） |
| T5 ⭐：2024-06，不公平潜在问题——小马心咒10万留下但出勤/92修法重来，vs 小羊没留级三样都顺利满足 | **设计的有意选择**：cumulative_count（心咒）= 终身累计遍数，"念成的功德不因留级倒扣"（DR-170 原文 WHY 说明）；practice_session（92修法）= 修行起点，"起修日界定修行起点合理"（DR-161 原文）；attendance（出勤）= 当届班级归属，留级换班自然重算（DR-163）。三类口径的差别是**明确的有意设计**，但只分散写在各自 DR 里，**没有一处统一成文**"留级后三类指标的差别对待规则"。**钻空子场景**：小马心咒10万省了重念，相对小羊有"优势"，但 practice_session 和 attendance 仍需重来，没有真正绕过升学门槛，不构成破坏性漏洞。DR-170 明确这是设计选择，属于可接受的不对称。 | DR-170（设计原文 WHY）；DR-161（设计原文 WHY）；DR-163 | ⚠️（有意设计但缺少统一成文的"留级规则汇总说明"，实现时易出分歧） |
| T6：2024-09，小马新届又没过，第二次留级，heldBackCount=2 | 与T2同样流程：管理员将当前活跃 ClassMember.cohortStatus→held_back，heldBackCount 从 1 变为 2，写 EnrollmentStatusHistory；管理员发邀请码，小马加入第三届，新 ClassMember（active，heldBackCount=0）。 | 能力 11 规则 1；08 §1.2 heldBackCount；D18 | ✅ |
| T7 ⭐：2024-09，F7.2"加行留级上限2次"——小马已2次，第3次还能留吗？系统会拦吗？ | **设计文档完全没有"留级次数上限"规则**。搜遍 06-business-capabilities-WIP.md、08-merged-design.md，能力 11 的"绝对约束"和"业务规则"里无任何关于 `heldBackCount` 上限的限制，也无"F7.2"定义。08 §1.2 heldBackCount 字段定义只说"转 held_back 时 +1"，没有上限约束。系统**不会拦截**第3次留级，管理员可以无限留级操作。 | 08 §1.2 ClassMember（无上限约束）；能力 11 绝对约束（无上限条款）；全文无"F7.2"定义 | 🔴（"F7.2留级上限"是题目假设，**设计文档从未拍板**，系统无拦截，属明确设计缺口） |
| T8 ⭐：2024-10，小马留级2次后退出加行（left），再用新邀请码重新加入加行。新ClassMember的heldBackCount从0开始？"2次留级"被洗白了？ | **是的，heldBackCount 从0开始**。根据 08 §1.2：`@@unique([classId, userId])` 保证同一个人在同一个班只有一条记录（回归走 left→active 复活）。但"退出加行 + 用**新班邀请码**加入"会创建**新的 ClassMember 行**（不同 classId）——该行 heldBackCount 默认 0。旧的2次 held_back 历史存在旧的 ClassMember 行（EnrollmentStatusHistory 里，D18 保留），但新 ClassMember.heldBackCount=0，没有任何机制把跨 ClassMember 的 heldBackCount 累加。留级次数跟的是 **ClassMember 行**，不是 userId。 | 08 §1.2（heldBackCount 字段，ClassMember 级别）；@@unique([classId,userId])；D18（历史保留，但新行从0）；能力11规则2（回归走邀请码重进） | 🔴（heldBackCount 是 ClassMember 级字段，退出+换班重进即归零，是可被利用的洗白路径） |
| T9 ⭐：2024-10，如果 heldBackCount 跟 ClassMember（退出重进归0），那F7.2的"留级2次上限"能被"退出再进"绕过吗？ | **完全可以绕过**。逻辑链：① T7 已确认 F7.2 根本没有拍板，系统无拦截；② T8 确认 heldBackCount 跟 ClassMember，退出重进即归零；③ 即便未来拍板 F7.2，靠 ClassMember.heldBackCount 字段根本防不住"退出+重新入班"的绕过路径——除非加"userId 维度跨 ClassMember 的历史累计留级次数"查询，但这个机制**设计中完全不存在**。双重缺口：F7.2 本身未拍板 + heldBackCount 维度错误。 | 08 §1.2（heldBackCount ClassMember 级）；能力11（无 userId 维度留级次数限制）；T7分析 | 🔴（若 F7.2 要实现，现有数据模型无法支撑；需要 userId 维度的历史统计或新字段） |
| T10：2025-01，小马退出加行（left）+ 邀请码加入净土专业 | 退出加行：学员自助操作，加行 ClassMember.cohortStatus→left，写 EnrollmentStatusHistory（能力 11 规则 2）。加入净土：用邀请码走能力 2，创建净土 ClassMember（active）。两个 ClassMember 各自独立，不级联（D9/D16，DR-150）。 | 能力 11 规则 2、3（退出=left，转专业两步走）；D15；D9/D16；DR-150 | ✅ |
| T11 ⭐：2025-01，小马加行期间念的心咒12万，转净土后，净土的内加行升学条件里算吗？ | **算**。cumulative_count 预检聚合不过滤 programId、不过滤 vowId（DR-157/DR-170），全量历史打卡均计入。小马在加行期间通过加行 vow 录入的12万心咒 PracticeLog，会被净土的 cumulative_count 条件同等聚合（D14a"念一份功德算多份"）。净土若配置了相同观音心咒累计条件，小马12万直接计入。 | DR-157（不过滤 programId/vowId）；DR-170（不过滤起修日）；D14a；08 §3.1 cumulative_count 判定逻辑 | ✅ |
| T12：2025-01，小马加行期间的92修法200座，转净土后算吗？ | **不算**。净土若有 practice_session 类条件，判定逻辑是 `loggedAt >= UserPracticeVow.createdAt`（DR-161），createdAt 为净土新 vow 建立时刻（加入净土班当日）。小马加行期间的200座 loggedAt 均早于净土 vow.createdAt，**全部不计入**净土预检。两段历史各自独立（能力 11 规则 3 绝对约束）。 | DR-161（起修日过滤）；能力 11 规则 3（两段历史各自独立）；08 §3.1 practice_session 判定逻辑 | ✅ |
| T13 ⭐：2025-01，转专业"部分继承"对学员有提示吗？ | **没有任何提示机制**。设计文档全文（06/08/09）无任何"转专业前提示学员哪些记录保留/清零"的 UI/UX 规范，也无"转专业确认弹窗说明规则"的要求。能力 11 §可能的呈现方式只提到"专业列表里已退出专业灰显可展开查看历史；退出操作有二次确认"，**无内容说明心咒带走、92修法不带走**。学员在退出加行前无从知晓"累计型功德保留，座次类要重修"这个设计差别。 | 能力 11 §可能的呈现方式；08 全文（无转专业规则提示要求）；DR-157/DR-161（规则存在于数据层，无 UI 层映射要求） | 🔴（UI/UX 层的设计缺口：转专业时"部分继承"规则对学员不透明，容易引发投诉） |
| T14：2025-06，假设小马加行升学成功（advanced），在正科密法班。某管理员误操作，想给他"留级" | 管理员进入小马的加行 ClassMember（cohortStatus=advanced）。按 DR-149 定义，advanced = 原预科 ClassMember 永久终态，不再改变（"原专业终态：原预科 ClassMember 升学后永久停留在 advanced"）。但"永久停留"的约束是应用层约束，**没有 DB 级别的硬拦截**。 | DR-149（"原预科 ClassMember 升学后永久停留在 advanced，不再改变"）；08 §1.2（状态机合法转移=应用层校验） | ⚠️（永久终态由应用层保证，依赖代码正确实现，无 DB 硬约束） |
| T15 ⭐：2025-06，系统允许 advanced→held_back 吗？若允许，小马这个"已升正科的人被留级"，留到哪个班？ | **设计文档没有明文禁止 advanced→held_back 这条转换路径**。08 §1.2 约束表写的是"状态机合法转移，应用层校验"，但**没有列出合法转移的完整枚举表**——只有部分转移路径有描述（如 active→graduated、graduated→advanced），**advanced 之后的合法转换完全没有说明**。DR-149 说"永久停留在 advanced，不再改变"，但这是设计意图描述，不是穷举的状态机图。实现层若没有明确拦截 advanced→held_back，管理员误操作可写入，造成"已升正科的人重新出现在预科班留级队列"的数据混乱。"留到哪个班"——advanced 对应的是预科 ClassMember，held_back 也是预科 ClassMember，操作上会改原预科行的状态，但正科 ClassMember（active）不受影响，只是预科记录出现了矛盾状态。 | DR-149（"永久停留"=应用层意图，非 DB 约束）；08 §1.2（状态机合法转移=应用层，无枚举表）；全文无 advanced 后合法转换说明 | 🔴（设计缺口：advanced 是声明为终态但无强制手段的状态，合法转换路径未枚举，advanced→held_back 无明文禁止，误操作可写入） |
| T16：2025-08，小马彻底退出所有专业（全部 left）。还能登录 App 吗？看到什么？ | **可以正常登录 App**。退出（left）≠ 取消资格（disqualified）。Left 状态下：学员仍有 User 账户，可登录；可只读查看历史档案（D15；能力 11 规则 2"退出后所有历史记录保留且学员仍可查看"）；班级主页、课程内容、报数等班级活动无法参与（无 active ClassMember）。App 呈现：所有专业在专业列表里灰显"已退出"，可展开历史；无活跃班级功能入口。 | D15（退出后记录保留可查）；能力 11 规则 2；DR-149/DR-152（left ≠ disqualified，left 无额外限制）；能力 11 §可能的呈现方式 | ✅ |
| T17：2025-09，小马想回来，重新加入加行。之前记录能接续吗？D15"回来可继续累加"怎么个累加法？ | **可以回来，通过邀请码加入新届加行班（能力 2）**，创建新 ClassMember（active）。"继续累加"的具体口径：**心咒（cumulative_count）**：全量历史打卡继续被聚合，小马历史念的12万一分不少（DR-170/DR-157，全量无过滤）。**92修法（practice_session）**：新 vow 建立，起修日=新入班日，历史座次**不延续**——这与 D15"不重置"有表面矛盾，但 DR-161 明确起修日过滤是有意设计，D15 说的是"记录保留"不是"计入升学"，两者需要区分。**出勤（attendance）**：current_member（DR-163），只计新届 active 班级出勤，历史出勤记录保留可查但**不计入**新届升学预检。**heldBackCount**：新 ClassMember 行默认0（T8 分析，旧行历史保留在 EnrollmentStatusHistory）。综合判断：D15 所说的"继续累加"在数据保留层面正确，但在升学预检口径上，三类指标有不同的实际效果，设计文档**没有在能力11里对此统一说明**。 | D15（记录保留，回来可继续累加）；DR-170/DR-157（cumulative_count 全量）；DR-161（practice_session 起修日过滤）；DR-163（attendance current_member）；能力11规则2 | ⚠️（D15"继续累加"与 DR-161 起修日过滤的表面矛盾没有统一说明，实现时可能出分歧） |

---

## 汇总

| 判定 | 数量 | 时间点 |
|---|---|---|
| ✅ 设计明文覆盖，行为清晰 | 7 | T1、T2、T3、T6、T10、T11、T12 |
| ⚠️ 逻辑可推导但未显式成文，实现可能出分歧 | 4 | T4、T5、T14、T17 |
| 🔴 设计缺口或规则冲突，需要决策 | 4 | T7、T8、T9、T13、T15 |

> 注：T7/T8/T9 三条问题相互关联（同一个"留级次数洗白"缺口的不同角度），T15 独立。🔴 实为 5 条（T7+T8+T9+T13+T15），⚠️ 为 4 条（T4+T5+T14+T17）。

---

## 重点结论

### 留级后"心咒保留/出勤92修法重算"的不一致——有意设计还是漏洞？(T3/T5)

**有意设计，但缺少统一成文说明。**

三类口径在设计文档中各自有明确的 WHY 说明，分别写在对应 DR 里：

- **cumulative_count（心咒）**：DR-170 明文说"内加行是终身修持的累计遍数，历史念成的功德不因立誓时间晚而倒扣（D14a的时间维度延伸）"——留级、换班、甚至换专业，都不影响聚合。
- **practice_session（92修法）**：DR-161 明文说"起修日界定修行起点合理——92修法讲的是完整修完一轮的座次资格，起修日界定修行起点合理"——留级后新 vow 建立，历史座次不计入，实质重算。
- **attendance（出勤）**：DR-163 明文说"只计当届 ClassMember 对应班级出勤（cohortStatus='active'），留级后历史出勤不自动累入"——换班即换统计窗口。

**设计缺口在于**：这三条规则分散在三个不同 DR 里，任何一处都没有集中说明"留级后这三类指标的差别对待"。能力 11 的业务规则里完全没有提到这个不一致（只说"原班级学修记录完整保留，新班级继续累计"，含糊不清）。实现工程师如果只看能力 11，不深入读 §3.1 各 conditionType 的判定逻辑，**极易将三类指标全部实现为"留级不清零"**（与 DR-159 changelog 描述冲突，见下方）。

**已验证：DR-159 与 DR-163 文档处理正确**：§七 changelog 行 DR-163 条目明文写"DR-159 出勤范围逆转"；§八 DR-159 本行有 🔻后修订标注，指向 DR-163。文档以 append-only 方式正确记录了逆转历史，**不存在冲突**，以 DR-163（current_member）为准。

---

### 留级次数 heldBackCount 跟 userId 还是 ClassMember？能被退出重进洗白吗？(T8/T9)

**heldBackCount 跟 ClassMember，退出重进可归零，洗白路径完全畅通。**

根据 08 §1.2，`ClassMember.heldBackCount` 是 ClassMember 行的字段（`Int, 默认 0, 转 held_back 时 +1`）。ClassMember 以 `@@unique([classId, userId])` 为主键——同一 userId 在同一 classId 只有一行（回归走 left→active 复活）。

洗白路径：userId A 在加行 S8班 留级2次 → heldBackCount=2 → 退出加行（left）→ 用新邀请码加入加行 S9班 → **新 ClassMember 行（S9 classId + userId A）heldBackCount=0**。旧的2次留级历史存在于 EnrollmentStatusHistory 和旧 ClassMember 行（D18 保留），但没有任何机制将"历史跨 ClassMember 的 heldBackCount"汇总到 userId 维度。

**若要实现"用户层面的留级上限"（假设 F7.2 未来拍板），现有数据模型无法支撑**，需要新增：
- 要么在 User 表或专业维度新增 `totalHeldBackCount` 字段；
- 要么管理员操作时查询 `EnrollmentStatusHistory WHERE userId=X AND toStatus='held_back'` 做应用层统计。
现有 ClassMember.heldBackCount 只能防"同班留级次数"，跨班跨届防不了。

---

### 转专业"部分继承"对学员有提示吗？(T13)

**没有任何提示机制，这是 UI/UX 层的设计缺口。**

设计文档全文（06/08/09）没有要求在"退出专业"操作时向学员展示"哪些记录会保留/哪些会重算"的说明。能力 11 §可能的呈现方式只说"退出操作有二次确认"，没有要求二次确认弹窗里说明规则。

实际情况是：
- 心咒（cumulative_count）：转专业后继续累计，学员不必重念（有利）
- 92修法（practice_session）：新 vow 起算，历史座次清零（不利）
- 出勤（attendance）：新届重算（不利）
- 闻思圆满（course_completion）：programId 隔离，需重新完成（不利）

学员在退出加行前无法从系统获知这个差别，可能误以为"所有进度都带得走"或"所有进度都要重来"，两个误解都会导致错误决策。这是一个有实际投诉风险的设计缺口。

---

### advanced→held_back 荒谬路径——明文禁止了吗？(T15)

**没有明文禁止，是状态机的设计空白。**

08 §1.2 的约束表写"状态机合法转移，应用层校验"，但**合法转移路径的完整枚举从未被写出**。DR-149 说"原预科 ClassMember 升学后永久停留在 advanced，不再改变"，这是设计意图，不是被代码强制的 DB 约束或明文的状态机跃迁禁止表。

如果实现层应用代码里没有显式地对"fromStatus=advanced 的转移"做 guard（"如果当前状态是 advanced，则所有状态变更请求均拒绝"），管理员误操作可以写入 advanced→held_back，造成：

1. 预科 ClassMember 状态变为 held_back（前置条件：正科 ClassMember 仍为 active，两条记录并存但预科逻辑混乱）
2. 升学记录（AdvancementRecord）依然存在，指向该 ClassMember 已升学，但状态显示为 held_back，数据语义冲突
3. 没有"留到哪个班"的问题（held_back 只改状态位，不移动 ClassMember 到其他班），但会导致"已升学的人重新出现在预科升学判定路径上"的业务歧义

**直接表现**：这是实现风险而非数据模型缺陷，但因为设计文档没有提供合法转移枚举表（谁能转谁、谁禁止转谁），开发人员只能靠理解业务意图来防范，没有可对照的明文规范。

---

## 最严重 3 个问题

### 🔴 问题1（最严重）：留级次数 heldBackCount 维度错误，用户层面无法有效限制留级次数（T7/T8/T9 三联）

**现象**：ClassMember.heldBackCount 是班级成员行的字段，退出+重新入班即归零，跨班跨届无汇总机制。若 F7.2"留级上限"未来被拍板，现有数据模型根本无法支撑实现，必须在设计层补充"userId 维度留级次数"统计方案。即便 F7.2 永不拍板，当前设计下留级次数形同虚设（无上限 + 可洗白），这个隐患需要明确决策。

**需要决策的问题**：
1. F7.2（留级次数上限）是否拍板？
2. 如果拍板，heldBackCount 统计维度是否需要从 ClassMember 升级到 userId 维度？

---

### 🔴 问题2：advanced 是声明为终态但无机制保证的状态，合法转移路径未枚举（T15）

**现象**：DR-149 声明 advanced=永久终态，但应用层约束没有对应的状态机跃迁禁止表。实现层若无显式 guard，管理员误操作可写入 advanced→held_back，造成数据语义冲突（升学记录 + held_back 状态并存）。

**次级问题**：状态机的完整合法转移枚举（哪个状态可以转到哪个状态、谁有权限操作）从未被系统地写出，能力 11 绝对约束里只有"留级必须手动操作"等原则性说明，没有可对照的状态机跃迁图表。

---

### 🔴 问题3：转专业"部分继承"无 UI 提示，学员投诉风险（T13）

虽然数据行为有设计依据，但用户体验层的信息不透明（"心咒带走、座次重算、出勤重算"），在转专业这个高决策成本的操作上，没有任何提示机制，属于运营风险。

---

*能力11完成，缺口9个（🔴5个 + ⚠️4个）*

> 注：🔴 计为5个：T7（F7.2未拍板）、T8（heldBackCount洗白）、T9（F7.2无法实现）、T13（转专业无提示）、T15（advanced终态无保障）；⚠️ 计为4个：T4（三类口径无解释）、T5（有意设计但缺统一成文）、T14（advanced终态无DB约束）、T17（D15与DR-161表面矛盾无说明）。DR-159 vs DR-163：已确认文档处理正确（§七 DR-163 条目 + §八 DR-159 后修订标注），非冲突。
