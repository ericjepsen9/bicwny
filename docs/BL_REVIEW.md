# 业务逻辑核对文档

> 生成日期：2026-05-27  
> 来源：FINAL_DESIGN_SANSUSHENG.md §三.3 + §五  
> 用途：逐条与产品负责人核对业务逻辑正确性  
> 格式：每条给出白话描述，末尾留「核对结论」栏

---

## 目录

| 编号 | 名称 | 类型 |
|---|---|---|
| BL-01 | 课程进度算法 | 每次请求实时计算 |
| BL-02 | 本周基准内容 | 每次请求实时计算 |
| BL-03 | 座次计算 | 每次打卡调用 |
| BL-04 | 学号自动生成 | 注册事务内 |
| BL-05 | 入班自动派发愿 | 入班事务内 |
| BL-06 | 成员状态机 | API 调用时 |
| BL-07 | 留级转班 | API 调用时 |
| BL-08 | 修持愿状态机（班级愿）| 打卡后实时重算 |
| BL-09 | 法会愿 / 约修愿状态 | 每日凌晨定时任务 |
| BL-10 | 掉队检测 | 每日凌晨定时任务 |
| BL-11 | 约修自动关闭 | 每日凌晨定时任务 |
| BL-12 | 法会边界判断 | 打卡时调用 |
| BL-13 | 权限中间件 | 每个请求 |
| BL-14 | 权限红线（18 条）| 全局约束 |
| BL-15 | 数据完整性约束（16 条）| 全局约束 |
| BL-16 | 到期日与目标量变更权限 | 全局约束 |
| BL-17 | 五层时区规则 | 全局约束 |
| BL-18 | 密法可见性矩阵 | 全局约束 |

---

## BL-01 · 课程进度算法

**白话**：计算一个班「现在应该在学第几周」。

规则优先级（高 → 低）：

1. **无开班日期**（`startDate` 为空）→ 永远返回第 1 周
2. **手动覆盖**（`currentWeekOverride` 有值）→ 跳过自动计算，直接用该值（辅导员/admin 手动锁定节奏）
3. **自动计算** → `(今天所在周 − 开班第一周) + 1 − 已过的单班临时休息周数`，最小值为 1

两层假期区分：
- **科系统一假期**（`ProgramWeek.isHoliday=true`）：排表里预先标好的全科系共享假期；**不减周号**，只影响该周「应完成内容」为空
- **单班临时休息**（`CohortRestWeek`）：本班特有临时暂停；**会减周号**，让班级进度在休息后接续

例：开班第 1 周，中间休息 1 周，今天是第 4 自然周 → 当前周号 = (4-1+1) - 1 = 3

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-02 · 本周基准内容

**白话**：根据 BL-01 算出的周号，从排表里查本周应学什么。

规则：

1. 班级无 `programId`（未绑科系）或无 `startDate` → 返回 null，学员端不显示基准线
2. 周号超出排表范围（科系排完了）→ 返回 `{ beyondSchedule: true }`，学员端提示「排表已结束」
3. 该周是**科系假期**（`isHoliday=true`）→ 返回 `{ isHoliday: true }`，学员端提示「本周休息」
4. 正常周 → 返回本周应学法本/课时列表 + 本周应修修法列表

用途：
- 学员端课程页顶部「本周班级进度：第 N 课」基准线
- 掉队检测 content / quiz / meditation 三维度的分母基准（假期周排除）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-03 · 座次计算

**白话**：把一次打坐的时长（分钟）转换为座次数，用于修持统计。

| 时长 | 座次 |
|---|---|
| ≥ 30 分钟 | 1 座 |
| 15 ~ 29 分钟 | 0.5 座 |
| < 15 分钟 | 0 座 |

适用于所有含时长的修持打卡（`PracticeLog.durationMinutes`）。

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-04 · 学号自动生成

**白话**：用户注册时，系统在同一事务里自动生成学号，格式为「年份 + 三位序号」。

规则：
- 格式：`YYYY + 三位零补序号`，如 `2026001`、`2026002`
- 每年单独计数，从 001 开始
- 并发安全：在事务内查当年最大学号 + 1（Prisma 悲观锁，高并发下偶尔重试）
- ⚠️ 历史数据导入必须在开放注册前完成，否则序号冲突

**注**：昵称（`nickname`）也在同一事务生成，格式「行者XXXX」，规则相同，共享计数器。

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-05 · 入班自动派发愿

**白话**：学员加入班级时，系统自动根据该班的「模板绑定」为学员建好修持愿，省去辅导员逐人手动派发。

触发时机：`POST /api/classes/:id/members` 与建 ClassMember 同一事务。

规则：

1. 查该班所有 `binding='auto'` 的模板绑定（`CohortRecommendedTemplate`）
2. **幂等保护**：跳过学员已有的同模板愿（处理退班后重新入班的场景）
3. 按模板字段建 `UserPracticeVow`：
   - `startDate` = 班级开班日 + 模板 `startsOffsetDays`（偏移天数，默认 0）
   - `endDate` = `startDate` + 模板 `durationDays`；`durationDays=null` 则无截止日（持续性愿）
   - `isPledged=true`（auto 愿默认为正式发愿）
   - `currentCount=0`，`currentStatus='on_track'`
4. 班级无绑定模板 → 静默跳过，学员正常入班

边界情况：
- 班级无 `startDate` → `startDate` 退化为今天
- `practiceProjectId` 为空 → 允许（裸追踪模板，打卡时学员自选修法）
- 任一步骤失败 → 整体事务回滚，ClassMember 不落库

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-06 · 成员状态机

**白话**：学员在班级里的生命周期状态（5 态），各状态之间有谁能发起转换、会触发什么联动。

| 转换 | 谁能操作 | 联动效果 |
|---|---|---|
| active → paused | 学员自助 或 辅导员 | 该学员所有 source=auto 愿同步暂停（custom 愿不动） |
| paused → active（恢复）| 学员自助 或 辅导员 | source=auto 愿同步恢复 active |
| active/paused → held_back（留级）| 辅导员 或 admin | heldBackCount +1；历史数据只读；可选同步转班（见 BL-07）|
| active/paused → graduated（毕业）| 辅导员 或 admin | 写 graduatedAt；历史只读 |
| active/paused → left（退班）| 辅导员 或 admin | 历史只读 |
| held_back/graduated/left → active（复活）| 仅 admin | 重新激活；更常见是直接在目标班新建 ClassMember |

排除规则：非 active 成员不计入掉队检测 / 班级排行 / 周汇总 / auto 愿管理列表。

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-07 · 留级转班

**白话**：留级时可在同一步操作里把学员转到下一届班，并带走修持进度。

两种模式：

**模式 A（仅标记，不转班）**：不填目标班 → 只把当前班 `cohortStatus` 改为 `held_back`，学员愿留在原班

**模式 B（标记 + 转班，原子事务）**：填写目标班 →
1. 当前班：`cohortStatus → held_back`，`heldBackCount +1`
2. 目标班：新建 `cohortStatus=active` 的 ClassMember（**跳过**自动派发愿，因下一步迁移覆盖）
3. 迁移愿：将当前班 `source=auto` 且 `status IN (active, paused)` 的愿，`classId` 改写为目标班（进度、计数全部保留）

注意：
- `expired/completed` 的愿留在原班归档，不迁移
- 目标班若有旧班没有的新模板，需辅导员事后手动补派
- `isPrimary` 不自动切换，由辅导员手动调整

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-08 · 修持愿状态机（班级愿）

**白话**：每次学员打卡后，系统实时重算该愿的进展状态（7 种状态），让辅导员能看到谁快到期还没完成。

**仅适用于 `source=auto` 的班级愿**；`source=custom` 的个人愿、裸追踪项一律跳过（不重算、不管理）。

触发时机：提交打卡 / 提交法会计数 / 修改到期日 / 暂停/恢复愿 / 补录历史打卡。

7 种状态优先级（高 → 低）：

| 状态 | 触发条件 |
|---|---|
| `completed` | 累计量 ≥ 目标量 |
| `will_overdue` | 按近 7 天日均速度预测，来不及在到期日前完成 |
| `at_risk` | 当前实际进度 / 应到进度 < 50% |
| `falling_behind` | 比值 50% ~ 70% |
| `slightly_behind` | 比值 70% ~ 90% |
| `on_track` | 比值 ≥ 90% |
| `paused` | 愿被暂停（`vow.status=paused`）|

进度比值计算：`(已完成量 / 目标量) ÷ (已过天数 / 总天数)`

细节：
- 打卡立即计入（乐观计入，不等辅导员确认）
- 法会愿（`context=event`）计数来源是 `EventCount`，普通愿来源是 `PracticeLog`
- 发愿前已提交的 `EventCount`（`vowId=null`）不回溯关联到后来的愿——有意设计，发愿前随喜只计集体总量

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-09 · 法会愿 / 约修愿状态

**白话**：法会愿和约修愿不走实时重算，由每日凌晨定时任务统一维护状态。

规则（每日跑一次）：

| 条件 | 动作 |
|---|---|
| 现在 < 法会开始日 | 保持 `on_track`（预发愿期，不判断）|
| 法会进行中 且 累计量 ≥ 目标量 | 标 `completed` |
| 法会已结束（`endDate < 今天`）| 不管完没完成，一律标 `completed`（法会收官）|
| 约修到期（`endDate < 今天`）| 同上标 `completed` |

UI 说明：
- 法会详情页的进度条直接读 `SUM(EventCount.count)` 显示，**不用** `currentStatus`
- `currentStatus` 仅供辅导员端愿管理列表筛选用（如筛出「即将到期」的法会愿）
- 学员端不展示任何愿的 `currentStatus`

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-10 · 掉队检测

**白话**：每天凌晨跑一次，算出每个在读学员（`cohortStatus=active`）在五个维度上的掉队程度，存入 `CohortLagSnapshot`，供辅导员查看。

**统一映射**：每维度计算一个 `rate = 实际完成 / 应完成`，再按阈值转换：

| rate | 状态 |
|---|---|
| ≥ 0.9 | `on_track` |
| 0.7 ~ 0.9 | `slightly_behind` |
| 0.5 ~ 0.7 | `falling_behind` |
| < 0.5 | `at_risk` |

**五个维度（近 2 周窗口）**：

| 维度 | 分子（实际）| 分母（应完成）| 无数据降级 |
|---|---|---|---|
| 出勤 | 已签到的必修场次数 | 近 2 周必修场次总数 | 无必修场次 → rate=1（on_track）|
| 闻思内容 | 有 read/audio/video 完成标记的课时数 | 排表应完成课时数（排除假期周）| 无排表 → rate=1 |
| 答题 | 近 2 周提交的 `UserAnswer` 数 | 排表课时关联题目总数（排除假期周）| 无排表 → rate=1 |
| 观修 | 有 meditation 完成标记数 | 排表应完成观修数（排除假期周）| 无排表 → rate=1 |
| 修持任务 | 近 2 周有 source=auto 愿打卡记录的天数 | `Class.lagPracticeDaysExpected`（默认 10，admin 可调）| — |

存储：一人一班一行（upsert），每次覆盖最新快照，不保留历史。  
学员端：完全不可见。  
辅导员端：需 `canViewStudents=true`。

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-11 · 约修自动关闭

**白话**：每天凌晨检查所有进行中的约修，到期的自动关闭，关联修持愿一并暂停。

规则：
- 查 `status=active` 且 `endDate < 今天` 的约修
- 每条约修：写 `status=expired`；同时把该约修下所有 `status=active` 的 `UserPracticeVow` 改为 `paused`
- ⏸ 约修 UI 暂缓（Phase 5），但定时任务本期实现

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-12 · 法会边界判断

**白话**：判断一条修持打卡是否算在法会范围内（用于法会愿进度 + 集体回向统计）。

规则：
- 打卡时间 `logDate` 存的是 UTC
- 先把 UTC 时间转换为**法会所在时区**（`Event.timezone`）的本地日期
- 转换后的本地日期落在 `[event.startDate, event.endDate]` 区间内 → 算入本次法会

典型场景：藏历法会 `timezone=Asia/Shanghai`（UTC+8）  
纽约学员北京时间 00:00 前的打卡（即纽约时间 11:00 前）→ 不算入当天法会  
纽约学员北京时间 00:00 后的打卡（即纽约时间当天下午）→ 算入当天法会

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-13 · 权限中间件

**白话**：四个独立中间件挂在路由上，各自做一类权限校验。

**① class-admin.middleware**（辅导员端路由通用）
- admin 直接放行（超级用户，flag 视为全部 true，任意班）
- 非 admin → 查 `ClassAdmin` 表，验证 classId + userId + 所需 flag
- 无记录或 flag=false → 403
- 例外：学员自助暂停/恢复自己的 membership 不走本中间件

**② tantric-filter.middleware**（学员侧内容查询）
- 所有 `isTantric=true` 的 Course / Meditation / PracticeProject
- 检查 `tantricGroupId` 是否在该用户的 `TantricAccessGrant` 授权组内
- 不在 → 零痕迹过滤（列表不出现，搜索不命中，关联不展示）
- 管理端 API 不挂此中间件

**③ vow-visibility.middleware**（愿相关 API）
- 学员：只能看自己的愿（`where userId = req.user.id`）
- 辅导员（`canViewStudents=true`）：只能看本班 `source=auto` 的愿；`source=custom` 对辅导员不可见
- 跨班禁止

**④ care-followup.middleware**（关怀跟进 API）
- 仅 `ClassAdmin.canCareFollowup=true` 可访问
- 学员端路由不挂载此接口

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-14 · 权限红线（18 条）

每条注明「实现方式」：

| # | 规则 | 实现 |
|---|---|---|
| 1 | 学员只能看自己的愿 | API `where userId = req.user.id` |
| 2 | 跨班师兄互不可见愿 | API 验证 classId 归属 |
| 3 | 辅导员只看本班 auto 愿，不看 custom | `where source='auto' AND classId IN (管理班级)` |
| 4 | 辅导员不能跨班操作 | 中间件验证 ClassAdmin 记录 |
| 5 | 密法零痕迹（学员侧）| 学员侧所有内容查询挂 tantric-filter |
| 6 | 关怀记录对学员不可见 | CareFollowup 路由仅 canCareFollowup=true 可访 |
| 7 | 掉队状态对学员不可见 | CohortLagSnapshot 无学员侧入口；Vow API 学员端不返回 currentStatus |
| 8 | 法会写权限限 admin | `requireRole('admin')`；学员侧只有 GET |
| 9 | 讨论话题创建须管理员 | 应用层查 ClassAdmin 记录（任意 flag）或 admin |
| 10 | 讨论一人一票 | DB `@@unique([discussionId, userId])`；换投先删旧票 |
| 11 | 签到时间窗口 | 后端校验 `startAt < now < sessionEndAt`，否则 403 |
| 12 | 签到防重复 | DB `@@unique([classSessionId, userId, studyType])`；重复返回 409 |
| 13 | 签到 token 作用域 | 班级场次须本班活跃成员；平台级任意活跃学员 |
| 14 | 平台级场次创建须 admin | `classId=null` 仅 admin 可设 |
| 15 | 成员状态转换权限 | pause/resume 本人或辅导员；held_back/graduate/leave 辅导员或 admin；复活仅 admin |
| 16 | RBAC 分配仅 admin | `requireRole('admin')`；全权主麦也不能分配 |
| 17 | /coach 访问守卫 | 前端 RequireCoach：context.classes 空 → redirect 学员首页 |
| 18 | admin 超级用户 | class-admin.middleware 对 admin 直接放行，flag 全开，任意班 |

> 核对结论：⬜ 全部正确 / ⬜ 有问题：_______________

---

## BL-15 · 数据完整性约束（16 条）

| # | 规则 | 实现 |
|---|---|---|
| 1 | 同一时刻每人只有一个主班 | 事务内先清其他班 isPrimary，再设新主班 |
| 2 | 92修法建议关联第几法 | Zod：seriesKey='92xiufa' 时 meditationId 建议非空 |
| 3 | 讲考三选一互斥（到场/被问/旁听）| DB unique + 应用层校验 studyType 为讲考类之一 |
| 4 | 共修出席/缺席二选一 | DB unique + 应用层校验 studyType 为共修类之一 |
| 5 | 每日日记一人一天一篇 | DB `@@unique([userId, journalDate])` |
| 6 | 学号全局唯一 | DB `studentId @unique` |
| 7 | 昵称全局唯一 | DB `nickname @unique`；高并发时后端重试 |
| 8 | 班级愿（auto/event）的 isPublic 强制 false | Zod：context=class 或 event 时忽略传入值，强制 false |
| 9 | 同一讲考一人只能报名一次 | DB `@@unique([speakingSessionId, userId])`；幂等写入返回 200 |
| 10 | 同一讲考一人只有一条评分 | DB `@@unique([speakingSessionId, userId])`；upsert 语义（可改分）|
| 11 | 讲考报名须场次未结束 | 应用层校验 `sessionEndAt > now`，超时返回 403 |
| 12 | 手机号格式 | Zod：非空字符串，phoneRegion 为 ISO 3166-1 白名单 |
| 13 | 入班必填字段（在读学员）| 应用层：class 模式且 hasOnboarded=false 时强制校验 5 字段 |
| 14 | 个人资料字段编辑权限 | 学员本人可改；辅导员只读；admin 任意改 |
| 15 | 昵称不可学员自改 | PATCH /me/profile 中 nickname 字段被忽略；仅 admin 可改 |
| 16 | 日常签到每人每天一次 | 应用层幂等检查 + DB 部分唯一索引（WHERE studyType='self_checkin'）|

> 核对结论：⬜ 全部正确 / ⬜ 有问题：_______________

---

## BL-16 · 到期日与目标量变更权限

**白话**：谁能改愿的到期日、谁能改每日目标量。

| 愿类型 | 改到期日 | 改每日目标量 |
|---|---|---|
| auto 愿（班级派发）| 辅导员（`canEditGoals=true`），自动写 AuditLog | 辅导员 **或** 学员本人 |
| custom 愿（自建）| 学员本人 | 学员本人 |

所有变更自动写 `AuditLog`（变更人 / 变更前后值 / 时间）。

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-17 · 五层时区规则

**白话**：平台涉及多个时区来源，各场景使用不同时区基准。

| 场景 | 用哪个时区 | 说明 |
|---|---|---|
| 班级共修/讲考场次时间显示 | `Class.timezone` | 前端按班级时区转换后显示 |
| 打卡时间戳（`PracticeLog.logDate`）显示 | `User.timezone` 或 `Class.timezone` | 存 UTC，显示时转换 |
| 周汇总边界（每周一）| `Class.timezone` | 「周一」按班级时区的子夜划定 |
| 自学进度计算 | `User.timezone` | 个人节奏用个人时区 |
| 法会日期边界 | `Event.timezone`（通常 `Asia/Shanghai`）| 打卡是否算入法会，按法会时区判断 |

藏历法会说明：法会时区固定为 `Asia/Shanghai`（北京时间 UTC+8），全球参与者的打卡均以北京时间子夜为边界。

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-18 · 密法可见性矩阵

**白话**：密法内容（课程/观修/修法项目）按灌顶授权分组，未授权学员完全看不到。

| 角色 | 密法内容 | 密法愿 | 密法打卡 |
|---|---|---|---|
| 未授权学员 | ❌ 零痕迹（列表/搜索/关联全部过滤）| ❌ | ❌ |
| 已授权学员（TantricAccessGrant 含该组）| ✅ 正常访问 | ✅ 自己的 | ✅ 自己的 |
| 辅导员（任何 flag）| ✅ 始终可见 | ✅ 全班 auto 愿 | ✅ 全班 |
| Admin | ✅ 全平台 | ✅ 全平台 | ✅ 全平台 |

授权粒度：按**修法组**（TantricGroup）授权，一次灌顶覆盖该组全部内容（法本 + 观修 + 念诵项目）。

密法打卡的参与规则：
- ✅ 计入集体回向总量
- ✅ 计入打卡报数文字
- ✅ 计入个人愿进度

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## 核对进度汇总

| 编号 | 名称 | 状态 |
|---|---|---|
| BL-01 | 课程进度算法 | ⬜ 待核对 |
| BL-02 | 本周基准内容 | ⬜ 待核对 |
| BL-03 | 座次计算 | ⬜ 待核对 |
| BL-04 | 学号自动生成 | ⬜ 待核对 |
| BL-05 | 入班自动派发愿 | ⬜ 待核对 |
| BL-06 | 成员状态机 | ⬜ 待核对 |
| BL-07 | 留级转班 | ⬜ 待核对 |
| BL-08 | 修持愿状态机 | ⬜ 待核对 |
| BL-09 | 法会愿/约修愿状态 | ⬜ 待核对 |
| BL-10 | 掉队检测 | ⬜ 待核对 |
| BL-11 | 约修自动关闭 | ⬜ 待核对 |
| BL-12 | 法会边界判断 | ⬜ 待核对 |
| BL-13 | 权限中间件 | ⬜ 待核对 |
| BL-14 | 权限红线 | ⬜ 待核对 |
| BL-15 | 数据完整性约束 | ⬜ 待核对 |
| BL-16 | 到期日与目标量变更权限 | ⬜ 待核对 |
| BL-17 | 五层时区规则 | ⬜ 待核对 |
| BL-18 | 密法可见性矩阵 | ⬜ 待核对 |
