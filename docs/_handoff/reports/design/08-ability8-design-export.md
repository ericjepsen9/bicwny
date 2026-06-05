# 能力8（共修与出勤）设计现状导出

> 供外部审查出测试场景。生成日期：2026-06-05。

---

## 一、共修类型

**1. 共修分几类？**

3类，由 `ClassSession.sessionType` 字段区分：

| 类型 | 中文名 | 打卡方式 |
|---|---|---|
| `online` | 网络共修（默认）| 学员自助：点时效链接 → 看头像网格 → 选自己 → 确认 |
| `offline` | 线下共修 | 管理员/辅导员活动结束后进打卡页，勾选到场学员，批量提交 |
| `self_study` | 自学 | 不打卡，由专业配置决定是否安排此类型 |

**2. 升学预检"出勤达标"算哪几类？自修算不算？**

`online` 和 `offline` 同权，都计入出勤（绝对约束5）。

`self_study` 类型场次不生成出勤记录，不计入。

**⚠️ 缺口**：设计文档没有明文写「self_study 类型 session 是否完全跳过升学预检的出勤累计」，只说「自学学员（能力21）不统计」（DR-103），但 self_study 类型 session 与「自学模式学员」的关系没有明确区分。

---

## 二、签到机制

**3. 线上共修怎么签到？时效链接是什么机制？链接多久过期？**

辅导员/老师在实际开课时手动触发「生成签到 token」，系统生成一次性 `checkInToken`（全局唯一，存在 ClassSession 表）。学员点链接 → 看到本班所有学员的头像+姓名网格 → 点自己 → 确认完成。

**签到窗口 = token 生成时刻起，持续 `Program.checkinGraceMinutes`（默认30分钟）**，到期自动失效（DR-89）。`startAt` 字段只用于展示，不参与窗口计算。

**4. 迟到窗口：开始后多久内还能签？超过怎样？**

从 token 生成时刻起30分钟内可签（可按专业/班级配置）。超过窗口后 token 失效，链接点开显示「已过期」，学员无法再自助签到。

**⚠️ 文档不一致**：能力8原文业务规则写的是「提前10分钟激活 + 整个共修时段 + 结束后30分钟宽限期」，但 DR-89 已改为「token 生成时刻起 checkinGraceMinutes」，两者机制不同。**能力8原文没有同步 DR-89**。以 DR-89 为准。

**5. 签到链接过期后，学员还能补签吗？谁能补？**

学员不可自助补签（绝对约束7）。辅导员及以上可随时补卡，选定「学员 + 场次 + 理由（可选）」，系统记录「由XXX补卡」，写入 AuditLog，学员档案可见。API：`POST /api/coach/sessions/:id/makeup`（class_tutor+）。

**6. 同一场共修，学员重复签到会怎样？**

幂等。DB 唯一约束：`@@unique([classSessionId, userId, studyType])`，重复请求被数据库拒绝，不产生重复记录。

---

## 三、出勤计数

**7. 出勤怎么累计？按什么单位？**

按场次累计。每次签到写一条 StudyRecord（studyType = `group_attend`），升学预检统计 `group_attend` 记录数。

**8. 多专业学员：同一场共修，两个专业的出勤怎么记？**

各自独立。ClassSession 绑定 classId（班级），专业A的班有自己的 ClassSession，专业B的班也有自己的。学员在两个班各自签到，生成两条独立 StudyRecord，升学预检按 programId 各自计算（绝对约束4）。

**✅ 已闭合（DR-186，2026-06-05）**：平台级场次（classId=null）签到后，系统对学员所有 `cohortStatus='active'` ClassMember 广播写入，每个 active 班各生成一条 StudyRecord（classId=各班）。升学预检无需改动，各专业各自计入。StudyRecord 唯一约束从 `@@unique([classSessionId, userId, studyType])` 扩展为含 classId，支持多条不冲突。

**9. 自学模式学员参加共修，算不算出勤？**

自学模式学员（能力21）无班级、无共修，不做出勤统计（DR-103）。如果自学学员用邀请码加入了正式班级（能力2），则以正式班级成员身份参与，出勤正常计入该班。升学预检：自学模式本身无升学流程，此问不适用。

**10. 出勤达标的门槛是什么？谁配置？**

门槛在专业配置中定义（能力1，ProgramAdvancementConfig，conditionKey=attendance），不写死代码。加行示例：93次。由 class_admin+ 在专业配置页设定。

---

## 四、与升学/留级的交叉

**11. 出勤数据怎么喂给升学预检？**

升学预检（能力10，AdvancementCheck）读 `classScope = current_member`：只统计当届 ClassMember 对应班级的 StudyRecord（cohortStatus='active' 的班级）。前届出勤不自动累入（DR-85/DR-163）。管理员可授予 `exempted=true` 豁免（见第13条）。

**12. 留级后，旧班出勤怎么处理？DR-181一致吗？**

DR-163 定义：只计新届 ClassMember 对应班级出勤（cohortStatus='active'），留级后历史出勤不自动累入。DR-181 能力11汇总表引用了 DR-163，两者一致。

**⚠️ 严重文档不一致**：能力8自身的业务规则里写着「**留级期间正常累计**」——这句话与 DR-163/DR-181「只计新届active班级」直接矛盾。能力8文本没有被 DR-181 的结论更新过。以 DR-163/DR-181 为权威，能力8原文这句话是错的，需要修正。

**13. 前届出勤如管理员认为满足，能豁免吗？**

可以。DR-85：AdvancementCheck 有 `exempted=true` 字段，管理员可通过能力5代行路径授予豁免，AuditLog留痕。这是升学预检里的出勤条件豁免，不修改 StudyRecord 本身。

---

## 五、补卡/撤销

**14. 管理员能补卡吗？给谁补？留痕吗？**

可以，任何时候。辅导员（class_tutor+）可补卡，选定学员+场次，理由可选。写 StudyRecord（createdBy=管理员userId）+ AuditLog，学员出勤详情页显示「由XXX补卡」。

**15. 能撤销已签到的出勤吗？谁能撤？留痕吗？**

可以，限班级管理员及以上（class_admin+），辅导员无权撤销。API：`DELETE /api/coach/attendance/:recordId`，需要填理由，写 AuditLog，出勤记录不物理删除（D18）。

**16. 学员能自助补卡吗？**

不能（绝对约束7）。

---

## 六、状态与字段

**17. 出勤相关的主要数据表/字段**

| 表 | 关键字段 | 说明 |
|---|---|---|
| ClassSession | sessionType / checkInToken / scheduleId / startAt / sessionEndAt | 单次场次；online类型有token，offline无 |
| ClassSessionSchedule | recurrenceRule / isActive / sessionType | 课表模板，循环规则生成场次 |
| StudyRecord | studyType / classSessionId / userId / classId / createdBy | 出勤落点；group_attend=出席 |
| Program | checkinGraceMinutes | 签到窗口时长配置（默认30分钟，DR-89）|

studyType 取值（共修相关）：`group_attend`（出席）/ `group_absent`（缺席）/ `group_review`（复习）/ `group_summary`（总结）

**18. 共修活动本身有状态吗？**

**✅ 已闭合（DR-185，2026-06-05）**：ClassSession 新增 `status String @default("scheduled")`，取值 `scheduled`（排期中）/ `cancelled`（已取消）；`ended` 靠 sessionEndAt+checkinGraceMinutes 推算，不入库。取消操作 PATCH status=cancelled，写 AuditLog（actionType=session_cancelled，操作人+原因可选），记录不物理删除（D18）。学员端已取消场次显示「本次已取消」标签，不显示签到入口；操作权限 class_tutor+。ClassSessionSchedule 的 `isActive=false` 继续表示课表模板停用（影响全部后续场次），与单次 session 取消语义分离。

---

## 七、与升学迭代的一致性

**19. DR-149~184 的出勤改动，能力8同步了吗？**

| DR | 内容 | 08-merged-design同步 | 能力8文本（06）同步 |
|---|---|---|---|
| DR-89 | 签到窗口改为token生成时刻基准 | ✅ ClassSession设计意图里有 | ❌ 能力8原文仍写「提前10分钟激活」旧机制 |
| DR-163 | 留级后出勤只计新届active班级 | ✅ DR-163有记录 | ❌ 能力8原文写「留级期间正常累计」，直接矛盾 |
| DR-181 | 留级后三类指标汇总（出勤=重算）| ✅ 能力11有callout框 | ❌ 能力8自身文本未更新 |
| DR-85 | 升学预检出勤豁免（exempted字段）| ✅ DR-85有记录 | ⚠️ 能力8提到「管理员代行」，但未说明豁免具体路径 |

**结论**：能力8（06文档）在两处关键规则上没有同步升学迭代的结论，文档权威性已下降，设计验证前必须先修这两处。

---

## 八、已知缺口

**20. 能力8设计里哪些还待定或不完整？**

| # | 缺口 | 严重度 | 状态 |
|---|---|---|---|
| A | 能力8原文「留级期间正常累计」与DR-163/181矛盾 | 🔴 严重 | ✅ 已修（2026-06-05）|
| B | 能力8原文签到时效（「提前10分钟激活」）与DR-89矛盾 | 🔴 严重 | ✅ 已修（2026-06-05）|
| C' | 方案1课表预排描述「在共修时段激活」与DR-89矛盾 | 🔴 严重 | ✅ 已修（2026-06-05）|
| C | ClassSession 无 status 字段，单次取消流程未定义 | 🟡 中 | ✅ 已闭合 DR-185（2026-06-05）|
| D | 平台级 session（classId=null）多专业出勤归属未定义 | 🟡 中 | ✅ 已闭合 DR-186（2026-06-05）|
| E | self_study 类型 session 是否计入升学预检出勤未明文 | 🟡 中 | 需确认 |
| F | DR-85 豁免的操作入口（哪个页面、谁发起）能力8未描述 | 🟡 中 | 实现缺口 |
| G | 补卡理由是否必填（能力8文本说「可选」）未与DR-177留级场景对齐 | 🟢 低 | 一致性确认 |

---

> **更新（2026-06-05）**：A、B、C'、C 已全部修复，剩余 D/E/F/G 可按优先级依次讨论决策。
