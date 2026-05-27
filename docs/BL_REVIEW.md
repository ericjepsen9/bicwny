# 业务逻辑核对文档（全量版）

> 生成日期：2026-05-27  
> 来源：FINAL_DESIGN_SANSUSHENG.md + SCENARIO_SIMULATION.md（S-001–S-060 + 附录）  
> 用途：逐条与产品负责人核对所有页面、交互、算法、约束的正确性  
> 格式：每条给出白话描述，末尾留「核对结论」栏

---

## 目录

| 编号 | 名称 |
|---|---|
| **第一章：注册与入班** | |
| UI-01 | 新学员注册 |
| UI-02 | 加入班级（邀请码 + 完善信息）|
| UI-03 | 多班管理（主班切换）|
| **第二章：首页与导航** | |
| UI-04 | 首页展示（Today 卡 + 药丸卡片）|
| UI-05 | 药丸卡片轮播逻辑 |
| **第三章：修持系统** | |
| UI-06 | 修持页（PracticePage）展示逻辑 |
| UI-07 | 修持记数（遍数类）|
| UI-08 | 修持记录（时长类，禅修）|
| UI-09 | 创建自定义修学 |
| UI-10 | 暂停 / 恢复修学愿 |
| UI-11 | 查看修持历史 |
| **第四章：法会参与** | |
| UI-12 | 班级 Tab 法会区块 |
| UI-13 | 法会详情页状态机 |
| UI-14 | 发法会愿 |
| UI-15 | 法会记数 |
| UI-16 | 法会回向仪式 |
| **第五章：共修签到** | |
| UI-17 | 班级 Tab 共修区块 |
| UI-18 | App 内共修签到 |
| UI-19 | 签到链接页（公开端点）|
| **第六章：讲考全流程** | |
| UI-20 | 讲考入口与状态机卡片 |
| UI-21 | 讲考报名 / 取消 |
| UI-22 | 讲考签到（App 内 + 链接）|
| UI-23 | 查看讲考成绩 |
| UI-24 | 讲考历史统计页 |
| **第七章：闻思学习** | |
| UI-25 | 闻思页（法本 + 自学读物列表）|
| UI-26 | 课程详情页（基准线）|
| UI-27 | 课时阅读与完成确认 |
| UI-28 | 三殊胜框架（发心语 + 回向）|
| UI-29 | 思考题与参考答案解锁 |
| UI-30 | 观修播放（92修法）|
| UI-31 | 批量补录学习进度 |
| UI-32 | SM-2 间隔复习 |
| **第八章：我的页面** | |
| UI-33 | 我的 Tab 根页（/me）|
| UI-34 | 考试成绩页 |
| UI-35 | 个人设置（时区 / 三殊胜 / 暂停）|
| UI-36 | 藏历日历 + 修持日记 |
| **第九章：辅导员端** | |
| UI-37 | 辅导员端入口与权限守卫 |
| UI-38 | 班级首页磁贴逻辑 |
| UI-39 | 成员管理与状态机操作 |
| UI-40 | 共修场次管理 |
| UI-41 | 讲考管理与评分录入 |
| UI-42 | 考试成绩录入 |
| UI-43 | 学员修行数据页 |
| UI-44 | 掉队名单（五维度）|
| UI-45 | 关怀跟进记录 |
| UI-46 | 修持愿管理 |
| UI-47 | 班级周汇总（WhatsApp 复制）|
| **第十章：Admin 端** | |
| UI-48 | 法本 / 课时 / 题目管理 |
| UI-49 | 参考答案管理 |
| UI-50 | 班级管理（字段扩展）|
| UI-51 | ClassAdmin 权限分配 |
| UI-52 | 法会活动管理 |
| UI-53 | 考试管理 |
| UI-54 | 讲考统计（Admin）|
| UI-55 | 科系管理 |
| UI-56 | 排表编辑器 |
| UI-57 | 修持模板管理 |
| UI-58 | 密法组管理 |
| **第十一章：后台定时任务** | |
| BG-01 | 掉队检测（每日凌晨）|
| BG-02 | 修持愿状态更新（每日凌晨）|
| BG-03 | 约修自动关闭（每日凌晨）|
| BG-04 | 班级周汇总生成（每周日凌晨）|
| **第十二章：业务算法** | |
| BL-01 | 课程进度算法 |
| BL-02 | 本周基准内容 |
| BL-03 | 座次计算 |
| BL-04 | 学号自动生成 |
| BL-05 | 入班自动派发愿 |
| BL-06 | 成员状态机 |
| BL-07 | 留级转班 |
| BL-08 | 修持愿状态机（班级愿）|
| BL-09 | 法会愿 / 约修愿状态 |
| BL-10 | 掉队检测算法 |
| BL-11 | 约修自动关闭逻辑 |
| BL-12 | 法会边界判断 |
| BL-13 | 权限中间件（四层）|
| BL-14 | 权限红线（18 条）|
| BL-15 | 数据完整性约束（16 条）|
| BL-16 | 到期日与目标量变更权限 |
| BL-17 | 五层时区规则 |
| BL-18 | 密法可见性矩阵 |

---

# 第一章：注册与入班

## UI-01 · 新学员注册

**白话**：学员访问 `/auth`，只填邮箱 + 密码即可注册，昵称和学号由系统在同一事务里自动生成。

规则：
1. 注册表单只有邮箱 + 密码两个字段（无姓名输入框）
2. 提交后后端事务内自动生成：
   - `studentId`：`{年份4位}{序号3位}`，如 `2026001`，每年从 001 重新计数
   - `nickname`：`行者{序号4位}`，如 `行者0001`，序号与 studentId 共享同一计数器
3. `User.learningMode` 默认 `class`；`User.preferShowFaxin` 默认 `true`
4. 注册成功后跳转 `/onboarding` 引导页（不进首页）

边缘情况：
- 邮箱已注册 → 提示「此邮箱已注册」
- nickname 唯一冲突（极低概率）→ 与 studentId 同样用重试机制处理
- studentId / nickname 生成依赖事务内 `SELECT ... FOR UPDATE`（Serializable 隔离）
- ⚠️ 历史数据导入必须在开放注册前完成，否则序号冲突

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-02 · 加入班级（邀请码 + 完善信息）

**白话**：学员在引导页输入邀请码加班，随即填写个人信息（5个必填字段），完成后进首页。

两步流程：

**步骤 1：邀请码输入**
- 表单：邀请码（6-8 位字母数字）
- 提交：`POST /api/classes/join { joinCode }` → 创建 `ClassMember(cohortStatus=active)` + 自动建愿（BL-05）
- 邀请码来源：辅导员在 `/coach/:classId/settings` 查看；admin 在 `/admin/classes` 查看

**步骤 2：完善个人信息**
- 必填：姓名 / 手机号（含国家代码，默认🇺🇸+1）/ 皈依情况（已皈依/未皈依/不确定）/ 所在城市
- 选填：法名 / 修行背景
- 提交：`PATCH /api/users/me/profile` + `POST /api/auth/onboarding-done` → 进首页 `/`

边缘情况：
- 班级无 `binding='auto'` 模板 → 静默跳过建愿，ClassMember 正常创建
- 退班后重新入班 → 幂等：已有 templateId 的愿跳过，仅为新模板建愿
- 班级有密法模板且学员无授权 → 密法愿不建（tantricFilter 过滤）
- 自学学员（选「自由学习」）→ 跳过步骤 2，所有字段可为空

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-03 · 多班管理（主班切换）

**白话**：同时在多班的学员，可在设置页切换「主班」，任意时刻只有一个主班。

规则：
- 学员 `learningMode=both` 时可同时属于跟班 + 自学科系
- 设置页显示当前主班 + 所有班级列表
- 点「设为主班」→ 事务保证：旧主班 `isPrimary=false`，新主班 `isPrimary=true`

边缘情况：
- 主班转为非 active 时，应用层提示重设主班（或清 isPrimary）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第二章：首页与导航

## UI-04 · 首页展示（Today 卡 + 药丸卡片）

**白话**：首页从上到下分四层：背景画报 → 顶部栏（头像 + 藏历 + 药丸）→ 今日修学卡 → 4大功能卡（2×2网格）。

布局规则（Layout D4）：
1. 全屏画报背景（月度图 / 主题色渐变兜底）
2. 顶部：左侧头像（→ 我的 Tab `/me`）+ 藏历日期区域 + 右侧药丸卡片
3. streak 徽章（🔥 N 天连签）
4. **今日修学卡**（全宽磨砂玻璃）：当日闻思进度 + 今日修持遍数 + 签到按钮
5. **4大功能卡**（2×2网格磨砂玻璃）：闻思 / 班级 / 练习 / 修学

交互：
- 点头像 → 我的 Tab（`/me`）
- 点药丸 → 班级 Tab（`/class`）
- 点今日修学卡签到按钮 → 原地签到（不跳页），已签到变灰态「✓ 已签到」

边缘情况：
- 通知入口已移入「我的」Tab 右上角（不再在首页独立展示）
- 未签到且已过当日 23:59 → 签到按钮自动失效

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-05 · 药丸卡片轮播逻辑

**白话**：首页右上角药丸卡片展示平台活动状态，多活动时每3秒轮播，无活动时显示常驻占位文案。

显示逻辑（数据来源：`GET /api/my/upcoming-events?within=10080`）：
- 多活动 → 每 3 秒自动轮播（opacity 淡入淡出 0.25s）
- 进行中法会 → `🪷 极乐法会 · 进行中`
- 进行中共修 → `📿 周日共修 · 进行中`
- 今天有活动 → `📿 共修 · 今天 18:00`
- 未来某天 → `🪷 法会 · 6月1日`
- 无活动 → `📅 平台活动`（常驻，不隐藏）
- 右侧角标：进行中 + 即将开始活动总数（如 `·³`）；空状态不显示角标

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第三章：修持系统

## UI-06 · 修持页（PracticePage）展示逻辑

**白话**：修持 Tab 是修持的统一中枢，分两个区块：班级修学愿（auto）和我的修学（custom）。

展示规则：
1. **顶部 KPI 卡**：今日遍数 / 连签天数（streak）/ 本周总量 / 累计总量（实时读 `PracticeLog`，按 `User.timezone` 聚合）
2. **区块①「班级修学愿」**（source=auto）：
   - 每条：愿名 + 进度条（按 targetPeriod 主目标）+ 「记数」按钮（遍数类）或「记录」按钮（时长类）
   - 进度条：`currentCount / targetCount`（lifetime 总量）或今日/本周记录量
3. **区块②「我的修学」**（source=custom）：
   - `isPledged=true`（发愿）：有进度条 + 目标量
   - `isPledged=false`（裸追踪项）：仅累计数 + `+` 快捷记数
   - 底部 `+ 添加修学` 按钮

边缘情况：
- 班级愿 `currentStatus` 字段**不下发**给学员端（仅辅导员端可见）
- 已暂停的愿（`status='paused'`）单独展示或灰色处理，不计入进度
- `PracticeDailySummary` 已停更，KPI 数据直接从 `PracticeLog` 聚合

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-07 · 修持记数（遍数类）

**白话**：点「记数」按钮，按 preferShowFaxin 开关决定是否显示发心语和回向，中间是 WheelPicker 选遍数。

三步流程（preferShowFaxin=true）：
1. **发心语 Sheet**：固定文本 + 「确认发心」按钮
2. **计数输入 Sheet**：
   - 修法项目：有绑定时预填+锁定；无绑定时必选（不选则提交 disabled）
   - WheelPicker 预设：1 · 7 · 21 · 27 · 49 · 108 · 1080 · 10800 遍（iOS scroll-snap）
   - 不显示「今日已记」（决策 FE-7）
   - 提交：`POST /api/vows/:id/logs` 写 `PracticeLog { count, logDate=now() }`
   - source=auto 愿：触发后端异步 `recalcVowStatus`
3. **回向 Sheet**：固定回向文字 + 「已回向」按钮 → Sheet 关闭，返回修持页

preferShowFaxin=false：直接进入步骤 2，无步骤 1/3。

边缘情况：
- 补录模式：`source='makeup'`，`logDate` 指向历史日期；同周补录配额 1 次（事务内检查）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-08 · 修持记录（时长类，禅修）

**白话**：时长类修法（如禅修）用双滚轮选小时+分钟，系统自动计算并展示座次。

步骤 2 输入界面（不同于遍数类）：
- 修法项目（同遍数类）
- **双滚轮**：左轮 小时（0–4）/ 右轮 分钟（0·5·10·…·55）
- 轮下方实时显示：`座次：X 座`（≥30min=1座，≥15min=0.5座，<15min=0座）
- 提交：写 `PracticeLog { durationMinutes, sessionCount }`

规则和边缘情况同 UI-07。

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-09 · 创建自定义修学（+ 添加修学）

**白话**：学员可在「我的修学」区块添加自定义修法条目，分三步：选项目 → 确认发愿或只记录 → 填写目标（仅发愿时）。

三步流程：

**步骤 1：选修法项目**
- 列表按授权过滤（密法项目对未授权学员不可见）
- 每项显示项目名 + 计量类型（遍数/时长）

**步骤 2：意图确认**
- 「发愿」→ 设定目标 + 追踪进度 → 进入步骤 3
- 「只记录」→ 直接建 `UserPracticeVow{ isPledged=false }` → 完成

**步骤 3：填写目标量（仅发愿时）**
- 目标类型三选一：总量 / 每日 / 每周
- **双轮 TargetCountPicker**（决策 FE-10）：
  - 轮 1 基数：1·2·3·4·5·6·7·8·9·10·21·27·49·108
  - 轮 2 单位：遍(×1) / 十遍(×10) / 百遍(×100) / 千遍(×1000) / 万遍(×10000) / 十万遍(×100000)
  - 默认：108 × 百遍 = 10,800 遍；实时预览千位分隔符
- 到期日（选填，不填为持续型愿，无截止）
- 提交：建 `UserPracticeVow{ source=custom, context=personal, isPledged=true }`

边缘情况：
- 「只记录」之后不可改为发愿（有意设计）；要发愿须新建一条
- 「每日」/「每周」目标类型：同一双轮输入，不填 totalCount

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-10 · 暂停 / 恢复修学愿

**白话**：学员自助暂停学习，或辅导员代操作，会联动对应的修持愿。

自助暂停（从 SettingsPage 或愿详情）：
- 确认弹窗 → `PATCH /api/vows/:id/pause` → 愿 `status='paused'`
- 如果是**成员状态暂停**（`cohortStatus → paused`）→ 所有 `source=auto` 愿同步暂停（custom 愿不动）

恢复：
- `cohortStatus → active` → 所有 `source=auto` 愿同步恢复 active

边缘情况：
- 暂停期间 KPI 卡暂停愿不计入本班进度对比
- custom 愿不受成员状态联动影响

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-11 · 查看修持历史

**白话**：按日期倒序展示修持记录，可按日期/项目筛选。

- 数据来源：`PracticeLog`（旧 `PracticeEntry` 表已删除，需已迁移）
- 展示字段：修法项目名 / 遍数 / 时长 / 座次 / 来源（manual/makeup）
- 入口：PracticePage 顶部「📊 历史」或点愿条目

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第四章：法会参与

## UI-12 · 班级 Tab 法会区块

**白话**：法会入口整合进班级 Tab（`/class`），展示进行中 + 最近一个即将开始，「查看更多」跳 `/events`。

展示规则：
- **进行中**：封面图 + 标题 + 藏历日期 + 「还剩 N 天」+ 「查看」按钮
- **即将开始**：同上，badge 改为「即将开始」
- **往期**：默认折叠，只在 `/events` 完整列表页展示
- `/class` 最多展示 2 条（1 进行中 + 1 即将开始）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-13 · 法会详情页状态机

**白话**：法会详情页有三个区块，其中「我的参与」区块根据用户状态展示不同内容和操作按钮。

**区块 1：基本信息**
- 封面图（全宽 16:9；无图用主题色占位块）
- 标题 + 藏历日期 + 公历区间 + 时区说明（Asia/Shanghai → 显示「以北京时间为准」）
- 状态 badge：即将开始 / 进行中 / 已结束
- 入口按钮：进行中+有直播URL → `进入直播`；已结束+有回放URL → `观看回放`；即将开始+有URL → `直播链接`；其余不显示

**区块 2：共修总量（实时）**
- 平台级（classId=null）→ `全平台 · 阿弥陀佛心咒 · 共 N 遍 · N 人参与`
- 班级级（classId 有值）→ `本班 · X · 共 N 遍 · N 人参与`
- 进行中：30 秒轮询 + 新增动效；已结束：静态最终总量

**区块 3：我的参与（状态机）**

| 用户状态 | 展示 | 操作 |
|---|---|---|
| 法会未开始，无愿 | `发法会愿` 按钮 | 触发发愿 Sheet |
| 法会未开始，有愿 | 愿进度条（0 / 目标量）| 调整愿；记数不可用 |
| 进行中，无愿无提交 | 两并排按钮 | `发法会愿` / `记数` |
| 进行中，有愿有提交 | 愿进度条（已完成 / 目标）| `记数` / `回向` |
| 进行中，有愿无提交 | 愿进度条（0 / 目标）| `记数` |
| 进行中，无愿有提交 | 已提交 N 次，合计 X 遍 | `继续记数` / `回向` |
| 已结束，有提交 | 我的最终总量：X 遍 | `回向` |
| 已结束，无提交 | 此法会已结束 | 无操作 |

边缘情况：
- 即将开始时「记数」按钮不可用（tooltip 提示），「发法会愿」正常可用
- `preferShowFaxin=false` → 「回向」按钮不渲染
- 法会愿 `currentStatus` 不在学员端展示

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-14 · 发法会愿

**白话**：法会详情页发愿分两步：先选修法项目，再用双轮选目标量。

步骤 1：选修法项目（法会绑定项目列表；单项目时自动预选但仍展示确认界面）

步骤 2：填写目标量
- **双轮 TargetCountPicker**（同 UI-09，基数 × 单位，默认 108×百遍=10,800）
- 起始日只读（= max(event.startDate, today)，按 event.timezone 计算）
- 提交：`POST /api/events/:id/vow` 建 `UserPracticeVow{ context='event', source='custom' }`

边缘情况：
- 重复发愿 → 后端返回 409，提示「您已发过此法会愿，如需修改请点击愿进度条」
- today 按 `event.timezone` 计算，跨时区用户显示其本地日期

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-15 · 法会记数

**白话**：法会进行中点「记数」，用 WheelPicker 选遍数，提交后不弹回向 Sheet（法会记数不触发三殊胜）。

规则：
- 有愿+单项目 → 项目自动锁定；有愿+多项目或无愿 → 需选项目
- WheelPicker 预设：1·7·21·27·49·108·1080·10800（法会不记时长/座次）
- 提交：`POST /api/events/:id/count` 写 `EventCount{ eventId, userId, practiceProjectId, count, vowId（自动查询）}`
- 若有法会愿 → 更新 `UserPracticeVow.currentCount`
- 区块 2 共修总量实时 +N 动效
- **不写 `PracticeLog`，不触发三殊胜回向**

边缘情况：
- `today > event.endDate`（按 event.timezone）→ 403，禁止提交
- 发愿前提交的 EventCount（vowId=null）不回溯关联愿（有意设计）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-16 · 法会回向仪式

**白话**：有提交记录即可点「回向」，纯 UI 仪式，不写 DB，可重复点击。

规则：
- 触发时机：法会进行中或已结束均可（有提交记录）
- 展示：本次法会共修总量 + 固定回向文字
- 提交：点「完成回向」→ Sheet 关闭，**不写 DB**
- `preferShowFaxin=false` → 「回向」按钮不渲染

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第五章：共修签到

## UI-17 · 班级 Tab 共修区块

**白话**：班级 Tab 聚合展示该学员主班 + 平台级共修，分进行中/即将开始/往期三栏。

展示规则：
- **进行中**（`startAt ≤ now ≤ sessionEndAt`）：标题 + 课时 + 时间窗口 + 「去签到」按钮
- **即将开始**（最近一条）：标题 + 课时 + 开始时间 + 「设提醒」
- **往期**：折叠，点「查看全部」→ `/assemblies` 完整历史
- 聚合范围：平台级（classId=null）+ 主班班级级共修

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-18 · App 内共修签到

**白话**：共修进行中，学员在 App 内点「去签到」，选择出席或缺席，一次记录一条。

规则：
- 出席：`POST /api/study-records` 写 `StudyRecord{ studyType='group_attend', classSessionId, isConfirmed=true }`
- 缺席：同上，`studyType='group_absent'`
- 时间窗口校验：后端验证 `startAt < now < sessionEndAt`，超时 403
- 防重复：`@@unique([classSessionId, userId, studyType])` 返回 409

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-19 · 签到链接页（公开端点）

**白话**：辅导员生成签到 token 后分享链接 `/checkin/:token`，学员无需登录即可通过链接签到。

**生成签到 token（管理端）**：
- `POST /api/admin/sessions/:id/checkin-token?sessionType=speaking|group`
- 响应：`{ token, checkInUrl }`
- token 不过期，通过再次调用手动刷新

**签到页状态机**：

| 状态 | 展示 | 操作 |
|---|---|---|
| 场次未开始 | 「签到未开始，将于 XX:XX 开始」| 等待刷新 |
| 签到已关闭 | 「签到已关闭，结束于 XX:XX」| 仅查看 |
| 签到进行中 | 成员名单 + 签到状态 | 点名字完成签到 |

**进行中逻辑**：
- 班级场次：展示本班活跃成员列表（姓名/学号/程序归属/已签到状态）
- 平台级场次（isPlatform=true）：搜索框 + 按科系筛选（全平台学员）
- 签到：`POST /api/checkin/:token { userId }` → 写 `StudyRecord`，页面更新「✓ 已签到」

边缘情况：
- token 无效 → 404
- 重复签到 → 409，提示「您已签到」
- 讲考场次 → `studyType='speaking_present'`；共修场次 → `studyType='group_attend'`

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第六章：讲考全流程

## UI-20 · 讲考入口与状态机卡片

**白话**：讲考入口在班级详情页 `/class/:id`，卡片按「场次状态 × 我的状态」二维状态机显示不同按钮。

入口路径：班级 Tab → `/class` → 「进入班级详情」→ `/class/:id` → 讲考区块

状态机（数据来源：`GET /api/speaking-sessions/:id/my-status`）：

| 场次状态 | 我的状态 | 卡片按钮 |
|---|---|---|
| 即将开始 | 未报名 | 「报名」（主色）|
| 即将开始 | 已报名 | 「已报名 ✓」（可取消）|
| 进行中 | 已报名+未签到 | 「去签到」|
| 进行中 | 已签到 | 「已签到 ✓」（不可操作）|
| 进行中 | 未报名 | 「旁听报名」（次要）|
| 往期 | 有签到+待评分 | 「待评分」badge |
| 往期 | 有评分 | 「查看结果」|
| 往期 | 未签到 | 「未参与」标签 |

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-21 · 讲考报名 / 取消

**白话**：报名幂等（重复返回 200），取消只能在场次未结束时操作。

- 报名：`POST /api/speaking-sessions/:id/register` → 写 `SpeakingRegistration`（幂等）
- 取消：`DELETE /api/speaking-sessions/:id/register`（仅 sessionEndAt > now 时可取消）
- 场次已结束 → 403，不可报名/取消

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-22 · 讲考签到（App 内 + 链接）

**白话**：讲考签到与共修签到走同一套机制，studyType 固定为 `speaking_present`。

- App 内：`POST /api/study-records` 写 `StudyRecord{ studyType='speaking_present', speakingSessionId }`（需登录）
- 链接签到：走 `/checkin/:token` 公开端点（UI-19）
- 两路径共用 `StudyRecord @@unique` 防重复签到

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-23 · 查看讲考成绩

**白话**：往期讲考卡片点「查看结果」弹出成绩 Sheet，展示评分 + 评语。

展示：
- 讲考场次标题 + 日期
- 评分大字：通过 / 不通过 / 优秀（pass / fail / excellent）
- 评语（无评语时此区块不显示）
- 辅导员姓名 + 评分日期（小字）

边缘情况：
- 辅导员未评分 → 卡片显示「待评分」badge，不弹成绩 Sheet

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-24 · 讲考历史统计页

**白话**：我的 Tab → 学修记录 → 「讲考记录」进入，显示历次讲考统计概览 + 详细列表。

展示：
- 顶部概览：参与场次数 / 完成签到数 / 通过率 + 成绩分布（excellent/pass/fail 占比）
- 列表（按 startAt 倒序）：场次标题 + 日期 + 报名/签到/评分状态 + 可展开评语
- 入口旁显示通过率 badge；`graded=0` 时 badge 隐藏（不显示「0%」）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第七章：闻思学习

## UI-25 · 闻思页（法本 + 自学读物列表）

**白话**：闻思 Tab 展示法本列表 + 自学读物列表，密法内容对未授权学员零痕迹过滤。

规则：
- `category=dharma_text` → 法本列表
- `category=self_study_book` → 自学读物列表（如 18 本大学演讲系列）
- 可按 category 分组（Tab 或分段）
- `isTantric=true` 且无授权 → 列表/搜索/关联全过滤，学员不知道该法本存在

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-26 · 课程详情页（基准线）

**白话**：点击法本进入课程详情，顶部显示「本周班级进度：第 N 课」基准线（排表驱动）。

基准线计算逻辑：
- 跟班学员：`getCurrentLessonNumber` → 按 `Class.startDate - 休息周` 算周号
- 自学学员：按 `UserSelfStudyProgram.startDate - 个人休息周` 算周号
- `currentWeekOverride` 有值 → 直接使用（辅导员手动覆盖优先）

基准线显示状态：
- 科系统一假期（isHoliday=true）→「本周休息」
- 超出排表范围 → 不显示基准线
- 班级无 `programId` → 不显示基准线
- `learningMode=both` → 班级科系 + 自学科系各自独立展示

其余展示：法本基本信息 / 课时列表（含完成状态）/ 多讲者 LessonResource

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-27 · 课时阅读与完成确认

**白话**：课时阅读页底部有「已读完」按钮，滚动会自动更新阅读进度，点按钮触发完成标记。

功能：
- 滚动阅读 → 自动更新 `LessonReadingProgress`
- 法本正文（sourceText）+ 讲义（referenceText）可切换；sourceText 为空时只显示 referenceText
- 「已读完」→ `POST /api/lesson-completions`（upsert）写 `LessonCompletion{ type='read' }`
- 「进入观修」入口（有关联 Meditation 时显示）→ MeditationPlayerPage

边缘情况：
- 已完成的课时再次点「已读完」→ upsert 语义，仅更新 completedAt

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-28 · 三殊胜框架（发心语 + 回向）

**白话**：当 `User.preferShowFaxin=true` 时，内容完成后弹回向 Sheet；修持记数前后加发心语+回向。

触发时机与规则：
- 触发：点「已读完」/「已听完」/「已看完」/「完成观修」
- 步骤 1：写入完成标记（`POST /api/lesson-completions`，upsert）
- 步骤 2（preferShowFaxin=true）：弹回向 Sheet → 「已回向」→ Sheet 关闭
- preferShowFaxin=false：直接完成，无 Sheet

观修特殊：
- 进度 ≥ 80% → 系统**自动**写 `LessonCompletion(type=meditation)` + 触发回向
- 手动点「完成观修」→ 同触发（兜底）
- 两路径均 upsert，不重复写入

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-29 · 思考题与参考答案解锁

**白话**：open 题（noScoring=true）提交后立即显示参考答案，不走 AI 评分，不依赖 publishedAt。

规则：
- 题目描述 + 文本输入（无字数限制）→ 提交
- 写 `UserAnswer`（因 `payload.noScoring=true` 跳过 gradeOpenWithLlm）
- 立即显示 `QuestionReference.referenceText`
- `QuestionReference` 不存在 → 显示「参考答案待整理」
- `publishedAt` 仅为 admin 元数据，不控解锁（有 UserAnswer 即解锁）

边缘情况：
- 普通 open 题（无 noScoring）仍走 AI 评分，不受影响

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-30 · 观修播放（92修法）

**白话**：点「进入观修」进入 MeditationPlayerPage，进度 ≥ 80% 自动完成并触发回向。

规则：
- 展示：视频播放器 + 字幕 + 进度 + 系列信息（seriesKey='92xiufa' 时显示「第 N 法」）
- 进度 ≥ 80% → 自动写 `LessonCompletion(type=meditation)` + 触发回向（UI-28）
- 密法观修（isTantric=true）→ 未授权学员不显示（零痕迹）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-31 · 批量补录学习进度

**白话**：学员可批量勾选多节课时，一次性确认已读，upsert 语义不重复计数。

- 多选课时 → 「批量确认已读」→ 批量 `POST /api/lesson-completions`，写多条 `LessonCompletion(type='read')`
- 已完成的课时不重复计数（upsert）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-32 · SM-2 间隔复习

**白话**：已有实现，`/sm2/review` 页面展示待复习题目队列，答对间隔拉长，答错间隔缩短。

- 无三殊胜框架触发
- 算法已实现，无需新增逻辑

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第八章：我的页面

## UI-33 · 我的 Tab 根页（/me）

**白话**：「我的」Tab 根页从 `/profile` 改为 `/me`，集中展示用户信息、学修记录入口、通知铃、账号管理。

展示内容：
- 顶部：头像 + 昵称（行者0001）+ 姓名/法名/城市 + 已皈依标签 + 学员号
- 「编辑个人信息」→ `/profile`（原有页面）
- 学修记录区块：
  - 「讲考记录」→ `/my/speaking-history`（旁边显示通过率 badge；graded=0 时隐藏）
  - 「考试成绩」→ `/my/exam-grades`（旁边显示最近分数；无成绩时隐藏）
  - 「法会记录」→ `/my/event-history`
  - 「打卡历史」→ `/practice/history`
- 右上角通知铃（🔔）+ 未读红点（`useUnreadNotifCount`，从首页移入）
- 账号区块：设置 / 隐私 / 帮助 / 退出登录

边缘情况：
- `/profile` 重定向至 `/me`

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-34 · 考试成绩页

**白话**：显示所有考试成绩列表，按 examDate 倒序分页，无成绩时空态提示。

- 数据来源：`GET /api/my/exam-grades`（page/limit 分页，默认 20）
- 展示：考试名称 / 日期 / 关联法本 / 百分制分数 / 评语
- 无成绩 → 空态「暂无考试成绩」

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-35 · 个人设置

**白话**：SettingsPage 包含三殊胜开关、时区、学习模式、学习暂停/恢复四类设置。

设置项：
1. **三殊胜框架**开关（`preferShowFaxin`）：关闭后跳过发心语 + 内容完成回向
2. **时区**（`timezone`）：IANA 格式，如 America/New_York
3. **学习模式**（`learningMode`）：跟班 / 自学 / 混合
4. **班级学习暂停/恢复**（自助）：`cohortStatus active↔paused`，级联 source=auto 愿

边缘情况：
- 暂停期间掉队检测不计算该学员（cohortStatus≠active 跳过）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-36 · 藏历日历 + 修持日记

**白话**：首页顶部藏历日期点击进入 `/calendar`，选某天展开上半（藏历信息）+ 下半（修持日记）。

日记逻辑：
- 有日记 → 显示内容 + 「编辑」
- 无日记 → 「写今日修持感想」
- 保存：`POST /api/journals` → upsert `PracticeJournal( @@unique [userId, journalDate] )`
- `journalDate` = 所选日历日按 `User.timezone` 取本地日期
- 可见性开关：私密 / 辅导员可见（`visible_to_coach=true` → 辅导员端可见）

边缘情况：
- 一天只有一篇日记（upsert），重复保存覆盖
- 「打卡反思」功能已移除，日记是唯一反思载体

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第九章：辅导员端

## UI-37 · 辅导员端入口与权限守卫

**白话**：`/coach` 路径对学员不可见（三端分离），有 ClassAdmin 记录才能进入，空记录学员被踢回首页。

规则：
- 路由守卫 `RequireCoach`：`context.classes 为空` → redirect `/`（学员首页）
- 数据来源：`GET /api/coach/context` → `{ isAdmin, classes:[{classId, className, flags{6个}}] }`
- admin（role='admin'）→ `isAdmin=true`，列全部班级，flag 全开，任意班
- ClassAdmin → 列其有记录的班级，按 flag 显示可用模块

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-38 · 班级首页磁贴逻辑

**白话**：进入某班的辅导员后台，只渲染该辅导员实际拥有的 flag 对应的模块磁贴。

磁贴与 flag 对应关系：
- `canManageMembers` → 「成员管理」
- `canManageExams` → 「讲考 + 考试」
- `canViewStudents` → 「学员数据 + 掉队名单 + 班级周汇总」
- `canCareFollowup` → 「关怀跟进」
- `canEditGoals` → 「修持愿管理」
- `canManageCourse` → 「课程进度」

边缘情况：
- 无任何 flag 的 ClassAdmin → 空磁贴页；但后端 API 仍守卫，无 flag 则 403

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-39 · 成员管理与状态机操作

**白话**：辅导员可对成员执行状态变更（暂停/恢复/留级/毕业/退班），留级支持可选的原子转班操作。

页面展示：
- 班级活跃成员列表（姓名/学号/入班日/当前状态/操作列）

操作与联动：
- **暂停**（active → paused）：级联所有 source=auto 愿同步 paused（custom 愿不动）
- **恢复**（paused → active）：级联 source=auto 愿同步恢复 active
- **留级**（active/paused → held_back）：弹二步 Sheet
  - 步骤一：确认留级意图
  - 步骤二：选填目标班（同科系 active 班级下拉）+ 原因（选填）
  - 无目标班：仅标记 `held_back`，`heldBackCount+1`
  - 有目标班：`POST .../held-back-transfer` 原子事务（见 BL-07）
- **毕业**（active/paused → graduated）：写 `graduatedAt`
- **退班**（active/paused → left）

边缘情况：
- `held_back/graduated/left → active`（复活）仅 admin 可执行
- 暂停成员排除在掉队检测 / 排行榜 / 周汇总之外
- 转班后 `isPrimary` 需辅导员手动切换（系统不自动推断）
- 目标班新模板绑定需辅导员手动补派

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-40 · 共修场次管理

**白话**：辅导员创建共修场次，生成签到 token 分享，可查出勤名单。

- 需 `canManageExams` 或 admin
- 新建场次：标题 + 课时关联 + 开始/结束时间（按 Class.timezone）
- 生成签到 token → 分享 checkInUrl
- 查看出勤名单：StudyRecord 列表（group_attend / group_absent）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-41 · 讲考管理与评分录入

**白话**：辅导员端讲考 Tab 分两子 Tab：讲考管理（含评分）和考试成绩录入。

讲考子 Tab：
- 班级讲考汇总统计（各场次出勤率/通过率/成绩分布）
- 讲考场次列表（新建 + 生成 token + 查报名名单）
- 评分录入：场次结束后，对每位学员选 pass/fail/excellent + 可选评语
- 辅导员可改分（upsert 覆盖）
- 评分后向被评分学员推送站内通知

边缘情况：
- 仅可录入本班活跃成员成绩（classId 归属校验）
- 未签到的学员也可被评分（辅导员判断）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-42 · 考试成绩录入

**白话**：考试成绩子 Tab 以 inline 表格形式录入，批量 upsert，重录覆盖。

- 选择某场考试 → inline 录入表格（用户名行 × 分数列）
- 输入 0-100 整数分数 + 可选评语
- 批量提交：`POST /api/classes/:classId/exams/:examId/grades`（批量 upsert）
- 平台级考试（classId=null）同样可在此录本班成绩

边缘情况：
- 重复录入 → upsert 覆盖（`@@unique([examId, userId])`）
- 非本班学员不可录入（校验 userId 属于本班活跃成员）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-43 · 学员修行数据页

**白话**：有 canViewStudents 权限才能访问，展示每位学员的修持打卡 + auto 愿进度 + 日记（可见部分）。

展示：
- 每位学员：姓名 + 学号 + 近期修持打卡统计 + auto 愿进度（currentStatus 在此可见）
- `visible_to_coach=true` 的 PracticeJournal 日记条目

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-44 · 掉队名单（五维度）

**白话**：辅导员可看到每位活跃学员在五个维度上的掉队状态，按维度筛选/排序，点「发起关怀」触发关怀流程。

展示：多维表格，每人一行，五列：出勤 / 闻思内容 / 答题 / 观修 / 修持任务

五维度说明：
- **出勤**：近2周必修场次签到率（无排表必修场次 → 恒 on_track）
- **闻思内容**：近2周法本 read/audio/video 完成率（无排表 → 恒 on_track）
- **答题**：近2周排表课时关联题目完成率（无排表 → 恒 on_track）
- **观修**：近2周观修完成率（无排表 → 恒 on_track）
- **修持任务**：近2周有打卡天数 / `lagPracticeDaysExpected`（默认 10，admin 可按班调）

操作：
- 按任一维度筛选/排序
- 点「detail」→ 各维度 done/expected 明细
- 点「发起关怀」→ 触发 UI-45，自动带入当前快照

边缘情况：
- 每日凌晨定时任务重算，实时性延迟约 24h
- 仅 `cohortStatus=active` 成员显示
- 掉队状态对学员端完全不可见

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-45 · 关怀跟进记录

**白话**：辅导员记录对掉队学员的联系与跟进，快照自动定格，历史不可变。

新建关怀记录：
- 选学员 + 填联系时间（contactedAt）+ 填摘要（summary）+ 跟进状态
- 跟进状态：pending / resolved / escalated
- 后端自动从最新 `CohortLagSnapshot` 拷贝 `lagSnapshotAtContact`（定格快照）

编辑：可修改跟进状态（resolved/escalated）

边缘情况：
- 关怀记录对学员端完全不可见
- `lagSnapshotAtContact` 定格后不随名单后续变化而改变

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-46 · 修持愿管理

**白话**：有 canEditGoals 权限才能访问，可查看全班 auto 愿进度与状态，可改到期日和每日目标量。

展示：
- 学员 × auto 愿 表格，每行：学员名 + 修法项目 + 进度 + **currentStatus（7态，仅此页可见）**
- 可按 currentStatus 筛选（will_overdue / at_risk 优先）

操作：
- 改 `currentEndDate` → 触发 `recalcVowStatus` + 写 `AuditLog`
- 改 `dailyTarget` → 写 `paceHistory` + `AuditLog`
- 填 `statusNote`（状态备注，仅管理端可见）

边缘情况：
- `source=custom` 愿完全不可见（私有）
- 学员本人也能改 `dailyTarget`（节奏自主）；管理端改写 AuditLog

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-47 · 班级周汇总（WhatsApp 复制）

**白话**：辅导员查看自动生成的周汇总，一键复制为格式化文本发送到 WhatsApp。

展示：
- 本周汇总：修持总量（按项目）/ 讲考出席数 / 共修出席数 / 当前课时号 / 活跃人数 / 掉队人数 / 日记提交人数
- 历史汇总（最近 N 周，分页）

操作：
1. `POST /api/classes/:id/weekly-summary/share` → 后端生成 `copyText`，写 `sharedAt/sharedBy`
2. 前端写剪贴板（navigator.clipboard）
3. copyText 格式：`🙏 [班级名] 本周修学汇报（第 N 课 · M月D日-M月D日）...`

边缘情况：
- 定时任务当周尚未运行（班级时区周日未到）→ 显示上周汇总
- copyText 由后端生成（非前端拼接）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第十章：Admin 端

## UI-48 · 法本 / 课时 / 题目管理

**白话**：admin 管理法本、课时、题目的 CRUD，含新字段的写入支持。

已实现：法本 CRUD / 课时 CRUD / 题目 CRUD / 观修管理 / LessonResource（YouTube）管理

新增字段（待实现）：
- `Course.author`（造论者）
- `Course.isTantric` + `Course.tantricGroupId`（密法归组）
- `Course.category`（dharma_text / self_study_book）
- `Course.programSemesterId`（科目归属）
- `Lesson.sourceText`（法本原文）
- `Meditation.seriesKey / seriesNumber`（92修法系列）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-49 · 参考答案管理

**白话**：admin 为 open 题录入参考答案，学员有答案即可看到，不依赖 publishedAt。

- 题目列表 + 参考答案状态（已录入/待整理）
- 创建/编辑 `QuestionReference`（一题一份）+ 标记 `publishedAt`（元数据）
- 解锁规则：学员有 UserAnswer 即解锁（不依赖 publishedAt）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-50 · 班级管理（字段扩展）

**白话**：admin 管理班级时新增多个字段，其中 lagPracticeDaysExpected 影响掉队检测阈值。

新增字段：
- `programId`（关联科系）
- `startDate`（起始日，进度算法基准）
- `city`（所在城市）
- `timezone`（IANA 时区）
- `currentWeekOverride`（手动覆盖当前周号）
- `lagPracticeDaysExpected`（修持任务掉队阈值，默认 10；密集班可设 14，轻松班可设 6）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-51 · ClassAdmin 权限分配

**白话**：admin 为班级分配辅导员角色，逐 flag 配置权限，同班同人只有一条记录。

操作：
- 搜索用户 → 添加为 ClassAdmin
- 勾选 6 个 flag（canManageMembers / canManageExams / canViewStudents / canCareFollowup / canEditGoals / canManageCourse）
- 保存：写/更新 `ClassAdmin`（`@@unique([classId, userId])`）
- 删除 ClassAdmin 记录

边缘情况：
- RBAC 分配仅 admin 可执行
- ClassAdmin（含全权主麦）不能分配其他人（无 canManageAdmins flag）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-52 · 法会活动管理

**白话**：admin 创建/编辑法会（Event），timezone 必填，法会结束后可补填回放 URL。

字段：title / eventType / coverImageUrl / startDate / endDate / timezone / tibetanDate / description / liveStreamUrl / recordingUrl / isActive

规则：
- `timezone` 必填；藏历法会固定填 `Asia/Shanghai`
- 法会结束后可补填 `recordingUrl`（编辑接口支持）
- 软删除：`isActive=false`（不物理删除）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-53 · 考试管理

**白话**：admin 创建平台级或班级级考试，可录入任意学员成绩，辅导员也可录本班成绩。

操作：
- 新建：title / examDate / classId?（null=平台级）/ courseId?
- 不允许修改 classId
- 删除：级联删所有 ExamGrade
- 成绩录入：批量 upsert `[{ userId, classId, score, comment? }]`

边缘情况：
- 平台级（classId=null）：可录任意学员
- 班级级：辅导员也可录（需 canManageExams）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-54 · 讲考统计（Admin）

**白话**：admin 查看全平台讲考汇总统计，可按日期范围筛选，展开单场详情。

展示：
- 平台汇总：总场次 / 总报名 / 总签到 / 整体通过率 / 成绩分布
- 场次列表（可筛日期）：每场概览 + 展开单场详情（复用 speaking-sessions/:id/stats）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-55 · 科系管理

**白话**：admin 管理 Program（科系），新建/编辑科系基本信息。

- 科系列表（加行 / 净土 / 入行论 / 基础等）
- 新建/编辑：name / code / description

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-56 · 排表编辑器

**白话**：admin 编辑某科系的学习排表，左栏树形导航 + 右区双状态（打卡要求配置 / 周内容编辑器）。

**左栏（树形导航）**：
- 科系根节点：点击 → 右区切换为「打卡要求配置」
- ProgramSemester 节点：展开/折叠，可 inline 编辑名称/起止周
- ProgramWeek 节点：点击 → 右区切换为「周内容编辑器」；假期周显示灰色
- 操作：「+ 新建科目」/ 右键「+ 新建周」/「重命名」/「删除」

**右区状态①：打卡要求配置（选中科系根节点）**
- 各打卡类型（speaking_present / group_attend / self_checkin / group_session_absent）× required / recommended / 不要求
- 保存 → 写/更新 `ProgramStudyType`
- ⚠️ 此配置是掉队检测出勤维度基准源（仅 required 类型计入「应到场次」）

**右区状态②：周内容编辑器（选中某 ProgramWeek）**
- 课程排表区：本周已排课时列表，「+ 添加课时」→ 选法本+课时 → 保存 `ProgramWeekCourse`
- 修法排表区：本周已排修法，「+ 添加修法」→ 选修法项目+观修（选填）→ 保存 `ProgramWeekPractice`
- 假期周切换：`ProgramWeek.isHoliday`（假期周时掉队检测跳过该周 content/quiz/meditation 计算）
- 备注：`ProgramWeek.note`

边缘情况：
- 排表是「本周基准内容」的唯一真相源（同时喂基准线 + 掉队检测）
- 学员实际阅读自由（不被排表锁课）
- 同科系各班按各自 startDate 错峰使用同一排表

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-57 · 修持模板管理

**白话**：admin 管理 PracticeTemplate，配置班级自动派发愿的模板，可绑定到班级（auto / recommended）。

字段：name / practiceProjectId / targetCount / targetPeriod / defaultDailyTarget / appliesToPrograms / isRequiredForPromotion

班级绑定：`CohortRecommendedTemplate`（binding=auto / recommended）+ 排序

规则：
- `binding='auto'` → 新学员入班时自动建愿
- `isRequiredForPromotion=true` → 此愿为升科目必修条件

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## UI-58 · 密法组管理（⏸ 暂缓 Phase 5）

**白话**：admin 管理密法组（TantricGroup），将内容归组，按组给学员授权（无审批流）。

操作：
- 新建/编辑密法组（key / name / description）
- 将法本/观修/修法项目归组（设置 tantricGroupId）
- 按组授权：`POST /api/admin/tantric-grants { userId, tantricGroupId }`（admin 直接 INSERT）
- 撤销：`DELETE /api/admin/tantric-grants`

边缘情况：
- 授权粒度：按组（一次覆盖该组全部内容：法本+观修+念诵）
- 撤销后：历史打卡和愿记录保留，但学员失去内容访问权（零痕迹过滤）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第十一章：后台定时任务

## BG-01 · 掉队检测（每日凌晨）

**白话**：每天凌晨跑，对所有 cohortStatus=active 成员重算五维度掉队快照，upsert 进 CohortLagSnapshot。

规则：
- 遍历所有 `cohortStatus=active` 的 ClassMember
- 每人每班调用 `computeLagSnapshot`（五维度，见 BL-10）
- 结果 upsert `CohortLagSnapshot`（一人一班一行，覆盖旧快照，不保留历史）
- 假期周（isHoliday=true）排除出 content/quiz/meditation 分母

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BG-02 · 修持愿状态更新（每日凌晨）

**白话**：法会愿和约修愿不走实时重算，由每日任务统一处理到期 / 收官状态。

规则（见 BL-09）：
- 法会进行中 且 累计量 ≥ 目标量 → `completed`
- 法会已结束（endDate < 今天）→ 一律 `completed`（不管完没完成）
- 约修到期 → 同上标 `completed`
- 法会未开始 → 保持 `on_track`

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BG-03 · 约修自动关闭（每日凌晨）

**白话**：检查所有进行中约修，到期的关闭，关联修持愿一并暂停。

规则：
- 查 `status=active` 且 `endDate < 今天` 的约修
- 写 `status=expired`
- 同时把该约修下所有 `status=active` 的 `UserPracticeVow` 改为 `paused`
- ⏸ 约修 UI 暂缓（Phase 5），但定时任务本期实现

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BG-04 · 班级周汇总生成（每周日凌晨）

**白话**：每周日凌晨按班级时区生成本周汇总快照，供辅导员查看和一键 WhatsApp 分享。

规则：
- 按班级 `timezone` 判断「周日子夜」触发（不同时区异步跑）
- 生成内容：修持总量（按项目）/ 讲考出席数 / 共修出席数 / 当前课时号 / 活跃人数 / 掉队人数 / 日记提交人数
- 存入 `CoachWeeklySummary`

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

# 第十二章：业务算法

## BL-01 · 课程进度算法

**白话**：计算班级「现在应该在第几周」，三级优先级：无开班日 → 手动覆盖 → 自动计算。

规则优先级：
1. **无 startDate** → 永远返回第 1 周
2. **currentWeekOverride 有值** → 直接用该值（辅导员/admin 手动锁定）
3. **自动计算** → `(今天所在周 − 开班第一周) + 1 − 已过单班休息周数`，最小值 1

两层假期区分：
- **科系统一假期**（`ProgramWeek.isHoliday=true`）：**不减周号**，只影响该周应完成内容为空
- **单班临时休息**（`CohortRestWeek`）：**会减周号**，让进度在休息后接续

例：开班第1周，中间休息1周，今天是第4自然周 → 当前周号 = (4-1+1) - 1 = 3

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-02 · 本周基准内容

**白话**：根据 BL-01 的周号，从排表里查本周应学什么，喂给基准线 + 掉队检测。

规则：
1. 无 programId 或无 startDate → null（不显示基准线）
2. 周号超出排表范围 → `{ beyondSchedule: true }`，提示「排表已结束」
3. isHoliday=true → `{ isHoliday: true }`，提示「本周休息」
4. 正常周 → 本周应学法本/课时列表 + 应修修法列表

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-03 · 座次计算

**白话**：把打坐时长（分钟）转换为座次数。

| 时长 | 座次 |
|---|---|
| ≥ 30 分钟 | 1 座 |
| 15 ~ 29 分钟 | 0.5 座 |
| < 15 分钟 | 0 座 |

适用于所有含 durationMinutes 的修持打卡。

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-04 · 学号自动生成

**白话**：注册事务内自动生成「年份+三位序号」格式学号，每年从 001 重新计数，并发安全。

规则：
- 格式：`YYYY + 三位零补序号`（如 2026001、2026002）
- 事务内查当年最大学号 + 1（悲观锁，高并发偶尔重试）
- nickname「行者XXXX」序号与 studentId 共享同一计数器
- ⚠️ 历史数据导入必须在开放注册前完成

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-05 · 入班自动派发愿

**白话**：加入班级时，系统在同一事务内按模板自动建好修持愿，幂等（重入班不重复建）。

触发：`POST /api/classes/:id/members` 与 ClassMember 同事务

规则：
1. 查该班所有 `binding='auto'` 的 `CohortRecommendedTemplate`
2. 幂等：跳过已有同 templateId 的愿
3. 按模板建 `UserPracticeVow`：
   - `startDate` = 班级开班日 + `startsOffsetDays`（默认 0）
   - `endDate` = startDate + `durationDays`；null 则无截止（持续型）
   - `isPledged=true`，`currentCount=0`，`currentStatus='on_track'`
4. 无模板绑定 → 静默跳过，ClassMember 正常创建
5. 任一步骤失败 → 整体回滚

边缘情况：
- 无 startDate → startDate 退化为今天
- practiceProjectId 为空 → 允许（裸追踪模板）
- 密法模板无授权 → tantricFilter 过滤不建

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-06 · 成员状态机

**白话**：学员在班级里有 5 种状态，各状态转换有权限限制，部分转换联动修持愿。

| 转换 | 谁能操作 | 联动效果 |
|---|---|---|
| active → paused | 学员自助 或 辅导员 | source=auto 愿同步暂停（custom 不动）|
| paused → active | 学员自助 或 辅导员 | source=auto 愿同步恢复 active |
| active/paused → held_back | 辅导员 或 admin | heldBackCount+1；可选转班（BL-07）|
| active/paused → graduated | 辅导员 或 admin | 写 graduatedAt |
| active/paused → left | 辅导员 或 admin | 历史只读 |
| held_back/graduated/left → active | 仅 admin | 复活 |

排除规则：非 active 成员不计入掉队检测 / 排行榜 / 周汇总 / auto 愿管理。

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-07 · 留级转班

**白话**：留级时可选填目标班，选了则原子事务完成：留级标记 + 新班成员 + 修持愿迁移（带进度）。

模式 A（仅标记）：不填目标班 → 仅 `cohortStatus → held_back`，`heldBackCount+1`

模式 B（标记 + 转班，原子事务）：
1. 当前班：`cohortStatus → held_back`，`heldBackCount+1`
2. 目标班：新建 `cohortStatus=active` 的 ClassMember（**跳过**自动派发愿）
3. 迁移：当前班 `source=auto` 且 `status IN (active, paused)` 的愿，`classId` 改写为目标班（进度保留）

注意：
- `expired/completed` 的愿留原班归档，不迁移
- 目标班新模板绑定需辅导员事后手动补派
- `isPrimary` 不自动切换

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-08 · 修持愿状态机（班级愿）

**白话**：每次打卡后，系统实时重算 source=auto 愿的状态（7 种），priority 高→低。

仅适用于 `source=auto` 愿；`source=custom` 愿一律跳过。

触发时机：提交打卡 / 提交法会计数 / 修改到期日 / 暂停恢复 / 补录。

7 种状态（优先级高→低）：
| 状态 | 触发条件 |
|---|---|
| `completed` | 累计量 ≥ 目标量 |
| `will_overdue` | 按近7天日均速度预测，来不及在到期日前完成 |
| `at_risk` | 实际进度 / 应到进度 < 50% |
| `falling_behind` | 比值 50%–70% |
| `slightly_behind` | 比值 70%–90% |
| `on_track` | 比值 ≥ 90% |
| `paused` | 愿 `status=paused` |

进度比值：`(已完成量 / 目标量) ÷ (已过天数 / 总天数)`

其他：
- 打卡乐观计入（不等后端 recalc）
- 法会愿计数来源是 EventCount；普通愿来源是 PracticeLog

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-09 · 法会愿 / 约修愿状态

**白话**：法会愿和约修愿由每日定时任务维护状态，不走实时重算。

| 条件 | 动作 |
|---|---|
| 法会未开始 | 保持 on_track |
| 法会进行中 且 累计量 ≥ 目标量 | 标 completed |
| 法会已结束（endDate < 今天）| 一律 completed（不管完没完成）|
| 约修到期 | 标 completed |

注意：
- 法会详情页进度条直接读 `SUM(EventCount.count)`，不用 currentStatus
- currentStatus 仅供辅导员端愿管理列表筛选
- 学员端不展示任何愿的 currentStatus

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-10 · 掉队检测算法

**白话**：每维度算 rate=实际/应完成，rate 映射到 4 档状态；近 2 周窗口；无数据默认 on_track。

统一映射：
| rate | 状态 |
|---|---|
| ≥ 0.9 | on_track |
| 0.7–0.9 | slightly_behind |
| 0.5–0.7 | falling_behind |
| < 0.5 | at_risk |

五维度（近 2 周窗口）：
| 维度 | 分子 | 分母 | 无数据 |
|---|---|---|---|
| 出勤 | 已签到的必修场次数 | 近2周必修场次总数 | rate=1 |
| 闻思内容 | read/audio/video 完成课时数 | 排表应完成课时数（排除假期周）| rate=1 |
| 答题 | 提交的 UserAnswer 数 | 排表课时题目总数（排除假期周）| rate=1 |
| 观修 | meditation 完成数 | 排表应完成观修数（排除假期周）| rate=1 |
| 修持任务 | 有打卡记录的天数 | `lagPracticeDaysExpected`（默认 10）| — |

存储：一人一班一行 upsert（不保留历史）

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-11 · 约修自动关闭

**白话**：每日凌晨检查到期约修，自动关闭并暂停关联愿。

- 查 `status=active` 且 `endDate < 今天` 的约修
- 写 `status=expired`
- 该约修下所有 `status=active` 的 `UserPracticeVow` 改为 `paused`

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-12 · 法会边界判断

**白话**：判断打卡是否算入法会范围，用法会时区换算，全球参与者统一以法会所在地时间为准。

规则：
- 打卡时间 `logDate` 存 UTC
- 转换为 `Event.timezone` 本地日期
- 转换后日期落在 `[event.startDate, event.endDate]` 内 → 算入

示例（藏历法会，timezone=Asia/Shanghai）：
- 纽约学员北京时间 00:00 前打卡（纽约时间下午 11:00 前）→ 不算入当天
- 纽约学员北京时间 00:00 后打卡 → 算入当天

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-13 · 权限中间件（四层）

**白话**：四个独立中间件挂在不同路由上，各司其职。

**① class-admin.middleware**（辅导员端路由通用）
- admin → 直接放行（flag 全开，任意班）
- 非 admin → 查 ClassAdmin 表验证 classId + userId + 所需 flag
- 无记录或 flag=false → 403

**② tantric-filter.middleware**（学员侧内容查询）
- isTantric=true 内容 → 检查 TantricAccessGrant
- 无授权 → 零痕迹过滤（列表/搜索/关联全过滤）
- 管理端 API 不挂此中间件

**③ vow-visibility.middleware**（愿相关 API）
- 学员：只看自己的愿（`where userId = req.user.id`）
- 辅导员（canViewStudents=true）：只看本班 source=auto 愿；custom 愿不可见
- 跨班禁止

**④ care-followup.middleware**（关怀跟进 API）
- 仅 `ClassAdmin.canCareFollowup=true` 可访问
- 学员端路由不挂载此接口

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-14 · 权限红线（18 条）

| # | 规则 | 实现 |
|---|---|---|
| 1 | 学员只能看自己的愿 | API `where userId = req.user.id` |
| 2 | 跨班师兄互不可见愿 | API 验证 classId 归属 |
| 3 | 辅导员只看本班 auto 愿，不看 custom | `where source='auto' AND classId IN (管理班级)` |
| 4 | 辅导员不能跨班操作 | 中间件验证 ClassAdmin 记录 |
| 5 | 密法零痕迹（学员侧）| 学员侧所有内容查询挂 tantric-filter |
| 6 | 关怀记录对学员不可见 | CareFollowup 路由仅 canCareFollowup=true 可访 |
| 7 | 掉队状态对学员不可见 | CohortLagSnapshot 无学员侧入口；Vow API 不返回 currentStatus |
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
| 8 | 班级愿（auto/event）isPublic 强制 false | Zod：context=class 或 event 时强制 false |
| 9 | 同一讲考一人只能报名一次 | DB `@@unique([speakingSessionId, userId])`；幂等写入返回 200 |
| 10 | 同一讲考一人只有一条评分 | DB `@@unique([speakingSessionId, userId])`；upsert（可改分）|
| 11 | 讲考报名须场次未结束 | 应用层校验 `sessionEndAt > now`，超时 403 |
| 12 | 手机号格式 | Zod：非空字符串，phoneRegion 为 ISO 3166-1 白名单 |
| 13 | 入班必填字段 | 应用层：class 模式且 hasOnboarded=false 时强制 5 字段 |
| 14 | 个人资料编辑权限 | 学员本人可改；辅导员只读；admin 任意改 |
| 15 | 昵称不可学员自改 | `PATCH /me/profile` 中 nickname 字段被忽略；仅 admin 可改 |
| 16 | 日常签到每人每天一次 | 应用层幂等检查 + DB 部分唯一索引（WHERE studyType='self_checkin'）|

> 核对结论：⬜ 全部正确 / ⬜ 有问题：_______________

---

## BL-16 · 到期日与目标量变更权限

**白话**：谁能改愿的到期日，谁能改每日目标量，所有变更写 AuditLog。

| 愿类型 | 改到期日 | 改每日目标量 |
|---|---|---|
| auto 愿（班级派发）| 辅导员（canEditGoals=true），自动写 AuditLog | 辅导员 **或** 学员本人 |
| custom 愿（自建）| 学员本人 | 学员本人 |

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-17 · 五层时区规则

**白话**：不同场景使用不同时区基准，防止跨时区用户的日期判断错误。

| 场景 | 时区 | 说明 |
|---|---|---|
| 班级共修/讲考场次时间显示 | `Class.timezone` | 前端按班级时区转换显示 |
| 打卡时间戳显示 | `User.timezone` 或 `Class.timezone` | 存 UTC，显示时转换 |
| 周汇总边界（每周一）| `Class.timezone` | 「周一」按班级时区子夜划定 |
| 自学进度计算 | `User.timezone` | 个人节奏用个人时区 |
| 法会日期边界 | `Event.timezone`（通常 Asia/Shanghai）| 打卡是否算入法会，按法会时区判断 |

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## BL-18 · 密法可见性矩阵

**白话**：密法内容按授权组隔离，未授权学员完全看不到，辅导员和 admin 始终可见。

| 角色 | 密法内容 | 密法愿 | 密法打卡 |
|---|---|---|---|
| 未授权学员 | ❌ 零痕迹 | ❌ | ❌ |
| 已授权学员 | ✅ 正常访问 | ✅ 自己的 | ✅ 自己的 |
| 辅导员（任何 flag）| ✅ 始终可见 | ✅ 全班 auto 愿 | ✅ 全班 |
| Admin | ✅ 全平台 | ✅ 全平台 | ✅ 全平台 |

授权粒度：按修法组（TantricGroup），一次灌顶覆盖该组全部内容（法本+观修+念诵项目）

密法打卡规则：✅ 计入集体回向总量 ✅ 计入打卡报数 ✅ 计入个人愿进度

> 核对结论：⬜ 正确 / ⬜ 有问题：_______________

---

## 核对进度汇总

| 编号 | 名称 | 状态 |
|---|---|---|
| **第一章** | | |
| UI-01 | 新学员注册 | ⬜ 待核对 |
| UI-02 | 加入班级 | ⬜ 待核对 |
| UI-03 | 多班管理 | ⬜ 待核对 |
| **第二章** | | |
| UI-04 | 首页展示 | ⬜ 待核对 |
| UI-05 | 药丸卡片轮播 | ⬜ 待核对 |
| **第三章** | | |
| UI-06 | 修持页展示逻辑 | ⬜ 待核对 |
| UI-07 | 修持记数（遍数）| ⬜ 待核对 |
| UI-08 | 修持记录（时长）| ⬜ 待核对 |
| UI-09 | 创建自定义修学 | ⬜ 待核对 |
| UI-10 | 暂停/恢复愿 | ⬜ 待核对 |
| UI-11 | 修持历史 | ⬜ 待核对 |
| **第四章** | | |
| UI-12 | 法会区块 | ⬜ 待核对 |
| UI-13 | 法会详情状态机 | ⬜ 待核对 |
| UI-14 | 发法会愿 | ⬜ 待核对 |
| UI-15 | 法会记数 | ⬜ 待核对 |
| UI-16 | 法会回向 | ⬜ 待核对 |
| **第五章** | | |
| UI-17 | 共修区块 | ⬜ 待核对 |
| UI-18 | App 内签到 | ⬜ 待核对 |
| UI-19 | 签到链接页 | ⬜ 待核对 |
| **第六章** | | |
| UI-20 | 讲考状态机卡片 | ⬜ 待核对 |
| UI-21 | 讲考报名/取消 | ⬜ 待核对 |
| UI-22 | 讲考签到 | ⬜ 待核对 |
| UI-23 | 查看讲考成绩 | ⬜ 待核对 |
| UI-24 | 讲考历史统计 | ⬜ 待核对 |
| **第七章** | | |
| UI-25 | 闻思页列表 | ⬜ 待核对 |
| UI-26 | 课程详情基准线 | ⬜ 待核对 |
| UI-27 | 课时阅读完成 | ⬜ 待核对 |
| UI-28 | 三殊胜框架 | ⬜ 待核对 |
| UI-29 | 思考题参考答案 | ⬜ 待核对 |
| UI-30 | 观修播放 | ⬜ 待核对 |
| UI-31 | 批量补录 | ⬜ 待核对 |
| UI-32 | SM-2 复习 | ⬜ 待核对 |
| **第八章** | | |
| UI-33 | 我的 Tab 根页 | ⬜ 待核对 |
| UI-34 | 考试成绩页 | ⬜ 待核对 |
| UI-35 | 个人设置 | ⬜ 待核对 |
| UI-36 | 日历与日记 | ⬜ 待核对 |
| **第九章** | | |
| UI-37 | 辅导员端入口 | ⬜ 待核对 |
| UI-38 | 班级磁贴逻辑 | ⬜ 待核对 |
| UI-39 | 成员管理 | ⬜ 待核对 |
| UI-40 | 共修场次管理 | ⬜ 待核对 |
| UI-41 | 讲考评分 | ⬜ 待核对 |
| UI-42 | 考试成绩录入 | ⬜ 待核对 |
| UI-43 | 学员修行数据 | ⬜ 待核对 |
| UI-44 | 掉队名单 | ⬜ 待核对 |
| UI-45 | 关怀跟进 | ⬜ 待核对 |
| UI-46 | 修持愿管理 | ⬜ 待核对 |
| UI-47 | 班级周汇总 | ⬜ 待核对 |
| **第十章** | | |
| UI-48 | 法本/课时/题目 | ⬜ 待核对 |
| UI-49 | 参考答案管理 | ⬜ 待核对 |
| UI-50 | 班级管理 | ⬜ 待核对 |
| UI-51 | 权限分配 | ⬜ 待核对 |
| UI-52 | 法会活动管理 | ⬜ 待核对 |
| UI-53 | 考试管理 | ⬜ 待核对 |
| UI-54 | 讲考统计 Admin | ⬜ 待核对 |
| UI-55 | 科系管理 | ⬜ 待核对 |
| UI-56 | 排表编辑器 | ⬜ 待核对 |
| UI-57 | 修持模板管理 | ⬜ 待核对 |
| UI-58 | 密法组管理 | ⬜ 待核对 |
| **第十一章** | | |
| BG-01 | 掉队检测定时任务 | ⬜ 待核对 |
| BG-02 | 愿状态更新定时任务 | ⬜ 待核对 |
| BG-03 | 约修关闭定时任务 | ⬜ 待核对 |
| BG-04 | 周汇总生成定时任务 | ⬜ 待核对 |
| **第十二章** | | |
| BL-01 | 课程进度算法 | ⬜ 待核对 |
| BL-02 | 本周基准内容 | ⬜ 待核对 |
| BL-03 | 座次计算 | ⬜ 待核对 |
| BL-04 | 学号自动生成 | ⬜ 待核对 |
| BL-05 | 入班自动派发愿 | ⬜ 待核对 |
| BL-06 | 成员状态机 | ⬜ 待核对 |
| BL-07 | 留级转班 | ⬜ 待核对 |
| BL-08 | 修持愿状态机 | ⬜ 待核对 |
| BL-09 | 法会愿/约修愿状态 | ⬜ 待核对 |
| BL-10 | 掉队检测算法 | ⬜ 待核对 |
| BL-11 | 约修自动关闭 | ⬜ 待核对 |
| BL-12 | 法会边界判断 | ⬜ 待核对 |
| BL-13 | 权限中间件 | ⬜ 待核对 |
| BL-14 | 权限红线 | ⬜ 待核对 |
| BL-15 | 数据完整性约束 | ⬜ 待核对 |
| BL-16 | 到期日与目标量权限 | ⬜ 待核对 |
| BL-17 | 五层时区规则 | ⬜ 待核对 |
| BL-18 | 密法可见性矩阵 | ⬜ 待核对 |
