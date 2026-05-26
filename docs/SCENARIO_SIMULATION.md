# 觉学 · 场景模拟文档

> 基于 FINAL_DESIGN_SANSUSHENG.md（最终版，2026-05-25）
> 覆盖所有角色的所有功能流程，用于验证设计完整性与实施状态
> 生成日期：2026-05-26

**实施状态图例**

| 标记 | 含义 |
|---|---|
| ✅ 已实现 | DB + 后端 API + 前端 UI 均已落地 |
| 🔵 已设计未实现 | 设计完整，尚未编码 |
| ⚠️ 设计有缺口 | 设计存在未决策 / 冲突 / 边缘情况未覆盖 |

---

## 目录

- [第一部分：学员端 (Student)](#第一部分学员端-student)
- [第二部分：辅导员端 (Coach)](#第二部分辅导员端-coach)
- [第三部分：Admin 端](#第三部分admin-端)
- [第四部分：公开端点](#第四部分公开端点)

---

## 第一部分：学员端 (Student)

### 1.1 首次使用 / 注册 / 加入班级

---

#### S-001 新学员注册账号 🔵 已设计未实现（注册简化 + studentId/nickname 自动生成）

> 决策 FE-4（2026-05-26）：注册只填邮箱 + 密码，昵称自动生成，姓名移到入班时收集。

**触发**：新学员访问 `/auth` 或收到邀请链接。

**AuthPage（注册表单）**
- 🖥️ 看到：邮箱输入框 + 密码输入框，「注册」按钮（无姓名输入框）
- 👆 可以做：填写邮箱 + 密码，提交注册
- ➡️ 之后（后端事务内，原子完成）：
  1. 生成 `studentId`（格式：`{年份4位}{序号3位}`，如 `2026001`）
  2. 生成 `nickname`（格式：「行者」+ 4位零补序号，如「行者0001`」，序号与 studentId 共享）
  3. `User.learningMode` 默认 `class`，`User.preferShowFaxin` 默认 `true`
  4. 跳转 `/onboarding` 引导页
- ⚠️ 边缘情况：
  - 邮箱已被注册 → 提示「此邮箱已注册」
  - nickname 唯一冲突（极低概率）→ 与 studentId 一样用重试机制处理
  - studentId / nickname 序号生成依赖事务内 `SELECT ... FOR UPDATE`，高并发须 Serializable 隔离
  - ⚠️ **历史数据导入必须在开放注册前完成**（seed_004_student_ids.ts），否则序号冲突

---

#### S-002 加入班级 ✅ 邀请码逻辑已实现 / 🔵 完善信息步骤 + 自动建愿未实现

> 决策 FE-5（2026-05-26）：输入邀请码成功后增加「完善个人信息」步骤。

**触发**：学员在 OnboardingPage 选择「加入班级」。

**屏幕 1 · 邀请码输入（OnboardingPage · class 分支）**
- 🖥️ 看到：邀请码输入框（6-8 位字母数字），提示「向辅导员索取邀请码」
- 邀请码来源：辅导员在 `/coach/:classId/settings` 看到 `Class.joinCode`；admin 在 `/admin/classes` 看到
- 👆 可以做：输入邀请码 → 「确认加入」
- ➡️ 之后：
  - `POST /api/classes/join { joinCode }` → 后端创建 `ClassMember`（cohortStatus=active）+ 自动建愿
  - 跳转「完善个人信息」表单（不直接进首页）

**屏幕 2 · 完善个人信息（新增步骤）**
- 🖥️ 看到：标题「完善个人信息」+ 以下表单项：
  - 姓名 \*（文本输入，必填）
  - 手机号 \*（国家/地区选择 + 号码输入，默认 🇺🇸 美国 +1，必填）
  - 法名（文本输入，选填）
  - 皈依情况 \*（单选：已皈依 / 未皈依 / 不确定，必填）
  - 所在城市 \*（文本输入，必填）
  - 修行背景（多行文本，选填）
- 👆 可以做：填写上述信息 → 「提交」
- ➡️ 之后：
  1. `PATCH /api/users/me/profile` 保存 6 个字段
  2. `POST /api/auth/onboarding-done`
  3. 进入首页 `/`
- ⚠️ 边缘情况：
  - 必填项未填 → 前端校验阻止提交，标红对应字段
  - 手机号格式不合法 → Zod 校验报错
  - 班级无绑定 `binding='auto'` 模板 → 静默跳过建愿，ClassMember 正常创建
  - 退班后重新入班 → 幂等保护：已有 templateId 的愿跳过，仅为新模板建愿
  - 班级有密法模板且学员无授权 → 密法愿不建（`tantricFilter` 过滤）
  - 自学学员（选「自由学习」）→ 跳过屏幕 2，所有新字段可为空

---

#### S-003 学员已在多班（both 模式） 🔵 已设计未实现

**触发**：学员 learningMode=both，同时属于跟班 + 自学科系。

**主班切换（SettingsPage）**
- 🖥️ 看到：当前主班 + 所有班级列表
- 👆 可以做：点击「设为主班」
- ➡️ 之后：事务保证：旧主班 `isPrimary=false`，新主班 `isPrimary=true`（同一时刻仅一个主班）
- ⚠️ 边缘情况：主班转非 active 时，应用层提示重设主班（或清 isPrimary）

---

### 1.2 首页 + 药丸卡片

---

#### S-004 首页展示（有平台活动） 🔵 已设计未实现

> 布局决策 D4（2026-05-26）：保留原 4 卡样式，4 卡上方新增全宽「今日修学卡」；5-Tab 导航已定型。

**触发**：学员打开 App，进入 `/`（HomePage）。

**HomePage**
- 🖥️ 看到（从上到下）：
  - 全屏画报背景（月度图 / 主题色渐变兜底）
  - 顶部：左侧头像（→ 我的 Tab `/me`）+ 藏历日期区域 + 右侧药丸卡片
  - streak 徽章（🔥 N 天）
  - **今日修学卡**（全宽，磨砂玻璃）：当日闻思进度 + 今日修持遍数 + 签到按钮
  - **4 大功能卡**（2×2 网格，磨砂玻璃）：闻思 / 班级 / 练习 / 修学
- 👆 可以做：
  - 点击头像 → 我的 Tab（`/me`）
  - 点击药丸卡片 → 班级 Tab（`/class`）
  - 点击今日修学卡签到按钮 → 原地签到（不跳页），已签到变灰态「✓ 已签到」
- ➡️ 药丸卡片行为（数据来源：复用 `GET /api/my/upcoming-events?within=10080`）：
  - 多平台活动时：每 3 秒自动轮播（opacity 淡入淡出 0.25s）
  - 进行中法会 → `🪷 极乐法会 · 进行中`
  - 进行中共修 → `📿 周日共修 · 进行中`
  - 今天有活动 → `📿 共修 · 今天 18:00`
  - 未来某天 → `🪷 法会 · 6月1日`
  - 无活动 → `📅 平台活动`（常驻不隐藏）
  - 右侧角标：进行中 + 即将开始活动总数（`·³`）；空状态不显示角标
- ⚠️ 边缘情况：
  - 通知入口已移入「我的」Tab 右上角；头像 badge 保留作补偿提示
  - 未签到且已过当日 23:59 → 签到按钮自动失效（见 §五 规则16）

---

#### S-005 首页展示（无平台活动） 🔵 已设计未实现

**触发**：平台无任何进行中 / 即将开始活动。

**HomePage 药丸卡片**
- 🖥️ 看到：`📅 平台活动` + 日历图标，无角标
- 👆 可以做：点击 → 跳 班级 Tab（`/class`），法会 / 共修区块均显示空态 + 往期折叠列表
- ➡️ 之后：`/class` 页法会区块显示「暂无进行中活动」，往期部分可展开查看历史法会

---

### 1.3 修持系统（愿 + 记数 + 记录）

> 文案决策 FE-6（2026-05-26）：修持遍数类操作按钮改为「记数」，时长类改为「记录」，
> 避免与签到打卡（签到）产生歧义。技术层（DB / API）仍用 PracticeLog / vow logs。

---

#### S-006 查看修持愿列表（/practice 统一中枢） 🔵 已设计未实现

**触发**：学员点击底部导航「修学」或直接访问 `/practice`。

**PracticePage（改造后）**
- 🖥️ 看到：
  - 顶部 KPI 卡：今日遍数 / 连签天数 (streak) / 本周总量 / 累计总量
  - **区块①「班级修学愿」**（source=auto）：入班时按 PracticeTemplate 自动建
    - 每条：愿名 + 进度条（按 targetPeriod 主目标）+ 「记数」按钮（遍数类）/ 「记录」按钮（时长类）
    - 进度条：`currentCount / targetCount`（lifetime）或今日 / 本周记录量
  - **区块②「我的修学」**（source=custom）：用户自建
    - isPledged=true（发愿）：有进度条 + 目标量
    - isPledged=false（裸追踪项）：仅累计数 + `+` 快捷记数
    - `+ 添加修学` 按钮
- 👆 可以做：
  - 点「记数」/「记录」→ 触发记录流程（S-007）
  - 点「+ 添加修学」→ 触发创建流程（S-009）
  - 点裸追踪项 `+` → 直接进入记数
  - 点愿的进度条 → 展开愿详情（含历史记录）
- ⚠️ 边缘情况：
  - KPI 卡数据来源：实时读 `PracticeLog`（按 `User.timezone` 聚合），`PracticeDailySummary` 已停更
  - 班级愿 `currentStatus` 字段**不下发**给学员端（仅辅导员端可见）
  - 已暂停的愿（`status='paused'`）单独展示或灰色处理，不计入进度

---

#### S-007 修持记录（遍数记数 / 时长记录） 🔵 已设计未实现

**触发**：在 PracticePage 点击任意愿的「记数」（遍数类）或「记录」（时长类）。

**步骤 1：发心语（preferShowFaxin=true 时）**
- 🖥️ 看到：发心语文本（前端常量）+ 「确认发心」按钮
- 👆 可以做：阅读后点确认
- ➡️ 之后：进入计数输入界面

**步骤 2：计数输入 Sheet（遍数类）**
- 🖥️ 看到：
  - 修法项目（`vow.practiceProjectId` 有值时预填+锁定仅展示；为空时弹项目选择器，必填）
  - **遍数滚轮**（WheelPicker）：预设常用遍数（1 · 7 · 21 · 27 · 49 · 108 · 1080 · 10800 等），iOS 风 scroll-snap，中间槽位高亮
  - 不显示「今日已记」（决策 FE-7）
- 👆 可以做：滑动滚轮选遍数，点「提交」

**步骤 2：记录输入 Sheet（时长类，如禅修）**
- 🖥️ 看到：
  - 修法项目（同上）
  - **双滚轮**：左轮 小时（0–4）/ 右轮 分钟（0·5·10·…·55），自动计算座次显示在轮下方「座次：X 座」（≥30min=1, ≥15min=0.5, <15min=0）
  - 不显示「今日已记」

- ➡️ 两种类型提交后：
  1. `POST /api/vows/:id/logs` 写 `PracticeLog { vowId, practiceProjectId, count / durationMinutes / sessionCount, logDate=now() }`
  2. 乐观更新：`vow.currentCount` 立即刷新（未等后端 recalc）
  3. source=auto 愿：触发 `recalcVowStatus`（后端异步）
  4. preferShowFaxin=true → 进入步骤 3

**步骤 3：回向 Sheet（preferShowFaxin=true 时）**
- 🖥️ 看到：固定回向文字（前端常量）+ 「已回向」按钮
- 👆 可以做：点「已回向」
- ➡️ 之后：Sheet 关闭，返回 PracticePage，进度条已更新
- ⚠️ 边缘情况：
  - `practiceProjectId` 为空且用户未选项目 → 提交按钮 disabled，提示必填
  - 补录：`source='makeup'`，`logDate` 指向目标历史日期（非 now）；同周补录配额 1 次（`Serializable` 事务内检查）
  - preferShowFaxin=false：跳过发心语和回向，直接提交后返回

---

#### S-008 查看修持历史 ✅ 已实现（基础）/ 🔵 新字段未实现

**触发**：在 PracticePage 点击愿条目或顶部右侧「📊 历史」入口。

**PracticeHistoryPage**
- 🖥️ 看到：按日期倒序的修持记录列表，含修法项目名 / 遍数 / 时长 / 座次 / 来源（manual/makeup 等）
- 👆 可以做：按日期/项目筛选
- ⚠️ 边缘情况：`PracticeEntry` 旧表已删除，历史记录需已迁移至 `PracticeLog`

---

#### S-009 创建自定义修学（+ 添加修学） 🔵 已设计未实现

> 全局 UX 规范（决策 FE-9）：多字段操作均采用分步 Sheet，先确认意图再展示详情。

**触发**：修持 Tab → 「我的修学」区块 → `[ + 添加修学 ]`

**步骤 1 · 选修法项目**
- 🖥️ 看到：PracticeProject 列表（密法项目已按授权过滤），每项显示项目名 + 计量类型标注（遍数 / 时长）
- 👆 可以做：点选修法（如「金刚萨埵心咒」）
- ➡️ 进入步骤 2

**步骤 2 · 是否发愿（意图确认，不展示详情）**
- 🖥️ 看到：
  ```
  为「金刚萨埵心咒」发愿吗？

  发愿：设定修习目标，追踪完成进度
  只记录：累积记数，不设目标

  [ 发 愿 ]       [ 只记录 ]
  ```
- 选「只记录」→ 直接建 `UserPracticeVow{ isPledged=false }`，完成，返回修持 Tab
- 选「发愿」→ 进入步骤 3

**步骤 3 · 填写发愿目标（仅选「发愿」时展示）**

> 决策 FE-10（2026-05-26）：目标量使用双轮 TargetCountPicker（基数 × 单位）。

- 🖥️ 看到：
  ```
  设定修愿目标

  目标类型   [ 总量 ][ 每日 ][ 每周 ]   ← 三选一

  ┌──────────┬──────────┐
  │    108   │   百遍   │  ← 双轮并排（基数 × 单位）
  └──────────┴──────────┘
             = 10,800 遍    ← 实时预览（千位分隔符）

  到期日     [ 可选 · 点击选日期 ]

  [ 确认发愿 ]
  ```
- 轮 1 基数预设：1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 21 · 27 · 49 · 108
- 轮 2 单位预设：遍(×1) · 十遍(×10) · 百遍(×100) · 千遍(×1000) · 万遍(×10000) · 十万遍(×100000)
- 默认值：108 × 百遍 = 10,800 遍
- ➡️ 提交：建 `UserPracticeVow{ source=custom, context=personal, isPledged=true, targetCount/dailyTarget/weeklyTarget, endDate }`
- 返回修持 Tab，新条目出现在「我的修学」区块，显示进度条

- ⚠️ 边缘情况：
  - 「只记录」的条目之后不可改为发愿（有意设计）；要发愿须新建一条，历史记录不追溯
  - 到期日不填：愿为持续型，无截止状态（`endDate=null`）
  - 目标类型选「每日」或「每周」时，`dailyTarget` / `weeklyTarget` 使用同一双轮输入，totalCount 不填

---

#### S-010 暂停修学愿（自助） 🔵 已设计未实现

**触发**：学员在 SettingsPage 或愿详情页点「暂停学习」。

**暂停流程**
- 🖥️ 看到：确认弹窗「暂停后愿进度暂停计算，随时可恢复」
- 👆 可以做：确认暂停（填原因可选）
- ➡️ 之后：
  1. `PATCH /api/vows/:id/pause` → 愿 `status='paused'`
  2. 如果是成员状态暂停（cohortStatus→paused）：所有 source=auto 愿同步暂停
  3. KPI 卡暂停愿不计入本班进度对比
- ⚠️ 边缘情况：custom 愿不受成员状态联动影响（仅 source=auto 愿级联）

---

#### S-011 SM-2 间隔复习 ✅ 已实现

**触发**：学员进入 `/sm2/review`（Sm2ReviewPage 已存在）。

**Sm2ReviewPage**
- 🖥️ 看到：待复习的题目卡片（Sm2Card 队列）
- 👆 可以做：标记记得 / 不记得，间隔算法自动调度下次复习时间
- ➡️ 之后：答对间隔拉长，答错间隔缩短
- ⚠️ 边缘情况：`sm2` 模块已存在，无需三殊胜框架触发

---

### 1.4 法会参与全流程

---

#### S-012 法会活动中心（法会区块） 🔵 已设计未实现

> 导航变更（5-Tab 决策 D，2026-05-26）：法会入口从独立 `/events` 路由整合进班级 Tab。
> 首页药丸点击 → 班级 Tab（`/class`）；法会列表 `/events` 仍作为班级 Tab 下的二级路由存在。

**触发**：学员点击底部 Tab「班级」→ `/class`，或从首页药丸卡片跳至 `/class`。

**ClassPage（`/class`）法会 / 共修区块**
- 🖥️ 看到（法会区块）：
  - **正在进行**：封面图 + 标题 + 藏历日期 + 「还剩 N 天」倒计时 + 「查看」按钮
  - **即将开始**：同上，状态 badge 改为「即将开始」
  - 「查看更多」链接 → `/events`（法会列表页，全平台 + 往期）
- 👆 可以做：点「查看」→ `/events/:id` 法会详情页；点「查看更多」→ `/events` 完整列表
- ⚠️ 边缘情况：
  - `/class` 只展示当前进行中 + 最近一个即将开始的法会（最多 2 条）；更多由 `/events` 承载
  - 往期法会默认折叠，只在 `/events` 列表页展示

---

#### S-013 法会详情 + 集体回向 🔵 已设计未实现

**触发**：点击法会卡片进入 `/events/:id`。

**EventDetailPage（新建）**

**区块 1：法会基本信息**
- 🖥️ 看到：
  - 封面图（全宽 16:9；无图用主题色占位块）
  - 标题（大字）+ 藏历日期（`tibetanDate`）+ 公历日期区间
  - 时区说明（timezone=Asia/Shanghai 时显示「以北京时间为准」）
  - 活动描述（>3 行折叠，点击展开）
  - 状态 badge：`即将开始` / `进行中` / `已结束`
  - 入口按钮（按状态 + 字段控制）：
    - 进行中 + liveStreamUrl 有值 → `进入直播`（主色，prominent）
    - 已结束 + recordingUrl 有值 → `观看回放`
    - 即将开始 + liveStreamUrl 有值 → `直播链接`（次要样式）
    - 其余情况 → 不显示按钮

**区块 2：共修总量（实时）**
- 🖥️ 看到：标签由 `Event.classId` 决定（决策 FE-2）：
  - 平台级（classId=null）→ `全平台 · 阿弥陀佛心咒 · 共 892,340 遍 · 138 人参与`
  - 班级级（classId 有值）→ `本班 · 阿弥陀佛心咒 · 共 12,450 遍 · 38 人参与`
- 进行中时：30 秒轮询刷新 + 新增时动效
- 已结束时：静态最终总量（供回向参考）

**区块 3：我的参与（状态机）**

| 用户状态 | 展示 | 操作 |
|---|---|---|
| 法会未开始，无愿 | `发法会愿` 按钮 | 触发发愿 Sheet（S-014）|
| 法会未开始，有愿 | 愿进度条（0 / 目标量）| 调整愿；记数不可用 |
| 进行中，无愿无提交 | 两个并排按钮 | `发法会愿` / `记数` |
| 进行中，有愿有提交 | 愿进度条（已完成 / 目标量）| `记数` / `回向`（决策 FE-1）|
| 进行中，有愿无提交 | 愿进度条（0 / 目标量）| `记数` |
| 进行中，无愿有提交 | 已提交 N 次，合计 X 遍 | `继续记数` / `回向`（决策 FE-1）|
| 已结束，有提交 | 我的最终总量：X 遍 | `回向`（触发 S-016）|
| 已结束，无提交 | 「此法会已结束」 | 无操作按钮 |

- ⚠️ 边缘情况：
  - 即将开始时「记数」按钮不可用（tooltip 提示），「发法会愿」正常可用
  - `preferShowFaxin=false` 时「回向」按钮不显示
  - 法会愿 `vow.currentStatus` 不在学员端展示

---

#### S-014 发法会愿 🔵 已设计未实现

> 决策 FE-9（2026-05-26）：所有多字段 Sheet 采用分步骤交互。发法会愿分两步：先确认发愿意向 + 选项目，再填目标量。

**触发**：法会详情页点「发法会愿」按钮。

**发愿 Sheet · 步骤 1 · 选择修法项目**
- 🖥️ 看到：Sheet 标题「为此法会发愿」+ 修法项目选择列表（法会绑定的项目，可选多个中的一个）+ 「下一步」按钮
- 👆 可以做：选择修法项目，点「下一步」
- ⚠️ 法会只绑定一个修法项目时，自动预选，步骤 1 可快速跳过（仍展示确认界面，不完全跳过）

**发愿 Sheet · 步骤 2 · 填写目标量**

> 决策 FE-10（2026-05-26）：目标量使用双轮 TargetCountPicker（基数 × 单位），覆盖百万量级。

- 🖥️ 看到：Sheet 标题「设定目标」+ 已选项目（只读）+
  ```
  ┌──────────┬──────────┐
  │    108   │   百遍   │  ← 双轮并排（基数 × 单位）
  └──────────┴──────────┘
             = 10,800 遍    ← 实时预览（千位分隔符）
  ```
  + 起始日只读（= event.startDate 或 today，取较大值；按 event.timezone 计算）+ 「确认发愿」按钮
- 👆 可以做：调整目标量，点「确认发愿」
- ➡️ 之后：`POST /api/events/:id/vow` 写 `UserPracticeVow{ context='event', eventId, source='custom', startDate=max(event.startDate, today) }`；区块 3 切换到「有愿」状态；Sheet 关闭
- ⚠️ 边缘情况：
  - 同一事件重复发愿 → 后端检查已有愿，返回 409，前端提示「您已发过此法会愿，如需修改请点击愿进度条」
  - today 按 `event.timezone` 计算，跨时区用户显示其本地日期

---

#### S-015 法会记数（提交计数） 🔵 已设计未实现

**触发**：法会详情页点「记数」/「继续记数」。

**计数提交 Sheet**（单字段，无需 FE-9 分步 · 直接提交）
- 🖥️ 看到：修法项目选择（有愿时预填；有愿 + 单项目时自动锁定，不可修改）+ WheelPicker 遍数（预设：1·7·21·27·49·108·1080·10800；法会计数不记时长/座次）
- 👆 可以做：选项目（如需），拨动 WheelPicker 选遍数，点「确认」提交
- ➡️ 之后：
  1. `POST /api/events/:id/count` 写 `EventCount{ eventId, userId, practiceProjectId, count, vowId（自动查询）}`
  2. 若有法会愿，后端更新 `UserPracticeVow.currentCount`
  3. 区块 2 共修总量实时 +N 动效
  4. Sheet 关闭，**不弹回向 Sheet**（法会记数不触发三殊胜回向）
- ⚠️ 边缘情况：
  - `today > event.endDate`（按 event.timezone）→ 403，页面只读，禁止提交
  - 此提交**不写 PracticeLog**，不影响日常修持愿
  - 发愿前提交的 EventCount（vowId=null）不回溯关联愿（有意设计）

---

#### S-016 法会回向仪式 🔵 已设计未实现

**触发**：区块 3 有提交记录即可点「回向」（法会进行中或已结束均可，决策 FE-1）。

**回向 Sheet**
- 🖥️ 看到：
  - 此次法会共修总量（进行中时为实时值，已结束时为最终值）
  - 固定回向文字（前端常量）
  - 「完成回向」按钮
- 👆 可以做：点「完成回向」
- ➡️ 之后：Sheet 关闭，**不写 DB**（纯 UI 仪式，可重复点击）
- ⚠️ 边缘情况：`preferShowFaxin=false` → 「回向」按钮不渲染（三殊胜总开关）

---

### 1.5 共修参与全流程（App 内签到 + 链接签到）

---

#### S-017 班级 Tab 共修区块 🔵 已设计未实现

> 导航变更（5-Tab 决策，2026-05-26）：共修入口整合进班级 Tab（`/class`），平台级共修亦在此聚合展示。

**触发**：学员点击底部 Tab「班级」→ `/class`，或从首页药丸跳至 `/class`。

**ClassPage（`/class`）共修区块**
- 🖥️ 看到（共修区块，三分区）：
  - **进行中**（`startAt ≤ now ≤ sessionEndAt`）：标题 + 课时 + 时间窗口 + 「去签到」按钮（App 内）
  - **即将开始**（`startAt > now`，最近一条）：标题 + 课时 + 开始时间 + 「设提醒」
  - **往期**（折叠，点「查看全部」→ `/assemblies` 列表页）：标题 + 日期 + 我的出勤状态
- 👆 可以做：点「去签到」→ App 内签到（S-018）/ 或点链接签到（S-019）
- ⚠️ 边缘情况：
  - `/class` 页聚合展示平台级（classId=null）+ 该学员主班的班级级共修
  - 完整历史记录由 `/assemblies` 列表页承载

---

#### S-018 班级共修签到（App 内） 🔵 已设计未实现

**触发**：共修进行中，学员在 App 内点「去签到」（需登录）。

**ClassSessionDetailPage / 平台场次详情页**
- 🖥️ 看到：场次标题 + 课时名 + 时间窗口 + 出勤/缺席按钮
- 👆 可以做：点「已出席」或「缺席」
- ➡️ 之后：`POST /api/study-records` 写 `StudyRecord{ studyType='group_attend'/'group_absent', classSessionId, isConfirmed=true }`
- ⚠️ 边缘情况：
  - 时间窗口未到 → 按钮 disabled
  - 时间窗口已过 → 按钮 disabled（`sessionEndAt < now`）
  - 重复签到 → `@@unique([classSessionId, userId, studyType])` 返回 409

---

#### S-019 签到链接页（无需登录） 🔵 已设计未实现

**触发**：辅导员/admin 生成签到 token → 分享链接 `/checkin/:token`（可通过微信/WhatsApp 分享）。

详见 **第四部分 S-037（公开端点）**。

---

### 1.6 讲考参与全流程（报名→签到→成绩）

---

#### S-020 讲考 + 报名 🔵 已设计未实现

> 导航变更（5-Tab）：讲考入口从旧 EventsPage「讲考」Tab 移至班级详情页 `/class/:id`。

**触发**：班级 Tab → `/class` → 「进入班级详情」→ `/class/:id` → 讲考区块。

**ClassDetailPage（`/class/:id`）讲考区块**
- 🖥️ 看到（状态机驱动卡片）：

| 场次状态 | 我的状态 | 卡片按钮 |
|---|---|---|
| 即将开始（startAt > now）| 未报名 | 「报名」（主色）|
| 即将开始 | 已报名 | 「已报名 ✓」（次要，可取消）|
| 进行中 | 已报名 + 未签到 | 「去签到」|
| 进行中 | 已签到 | 「已签到 ✓」（不可操作）|
| 进行中 | 未报名 | 「旁听报名」（次要）|
| 往期 | 有签到 + 待评分 | 「待评分」（灰色 badge）|
| 往期 | 有评分 | 「查看结果」（可点击，弹 Sheet）|
| 往期 | 未签到 | 「未参与」标签 |

- 👆 可以做：点「报名」→ 报名（S-021）；点「查看结果」→ 成绩 Sheet（S-023）
- ⚠️ 边缘情况：状态数据来源 `GET /api/speaking-sessions/:id/my-status`

---

#### S-021 讲考报名 🔵 已设计未实现

**触发**：讲考 Tab 点「报名」按钮。

**报名动作**
- 👆 可以做：点「报名」
- ➡️ 之后：`POST /api/speaking-sessions/:id/register` 写 `SpeakingRegistration`，幂等（重复报名返回 200）
- 取消报名：`DELETE /api/speaking-sessions/:id/register`（仅 sessionEndAt > now 时可取消）
- ⚠️ 边缘情况：session 已结束 → 403，不可报名/取消

---

#### S-022 讲考签到（App 内 / 链接） 🔵 已设计未实现

**触发**：讲考进行中，点「去签到」。

- App 内签到：`POST /api/study-records`（需登录）写 `StudyRecord{ studyType='speaking_present', speakingSessionId }`
- 链接签到：走 `/checkin/:token` 公开端点（S-037）
- ⚠️ 边缘情况：两路径共用 `StudyRecord @@unique` 防重复签到

---

#### S-023 查看讲考成绩 Sheet 🔵 已设计未实现

**触发**：往期讲考卡片点「查看结果」。

**成绩 Sheet**
- 🖥️ 看到：
  - 讲考场次标题 + 日期
  - 评分大字：通过 / 不通过 / 优秀（pass / fail / excellent）
  - 评语（无评语时此区块不显示）
  - 辅导员姓名 + 评分日期（小字）
- 👆 可以做：阅读后关闭
- ⚠️ 边缘情况：辅导员未评分时「待评分」badge 显示，成绩 Sheet 不弹

---

#### S-024 讲考历史统计页（/my/speaking-history） 🔵 已设计未实现

**触发**：我的 Tab（`/me`）→ 学修记录区块 → 点「讲考记录」（入口旁显示通过率 badge；graded=0 时隐藏）。

**SpeakingHistoryPage（新建）**
- 🖥️ 看到：
  - 顶部统计概览：参与场次数 / 完成签到数 / 通过率 + 成绩分布（excellent/pass/fail 占比）
  - 历次讲考列表（按 startAt 倒序）：场次标题 + 日期 + 报名状态 + 签到状态 + 评分（可展开评语）
- 数据来源：`GET /api/my/speaking-history` + `GET /api/my/speaking-stats`
- ⚠️ 边缘情况：graded=0 时 passRate=null，显示「暂无评分数据」

---

### 1.7 闻思学习（法本→课时→阅读→题目→参考答案→观修）

---

#### S-025 闻思页（法本 + 自学读物） ✅ 已实现（基础）/ 🔵 读物分组未实现

**触发**：点底部导航「闻思」进入 `/courses`（CoursesPage）。

**CoursesPage**
- 🖥️ 看到：
  - 法本列表（category=dharma_text）
  - 自学读物列表（category=self_study_book，如 18 本大学演讲系列）
  - 可按 category 分组展示（Tab 或分段）
  - 密法法本：未授权学员完全不显示（零痕迹）
- 👆 可以做：点法本 → ScriptureDetailPage；点读物 → 同样走课程详情（复用）
- ⚠️ 边缘情况：`isTantric=true` 且无授权 → 列表/搜索/关联全过滤，学员不知道该法本存在

---

#### S-026 课程详情页（多讲者 + 班级进度基准线） 🔵 已设计未实现（排表基准）

**触发**：点击法本进入 ScriptureDetailPage。

**ScriptureDetailPage**
- 🖥️ 看到：
  - 法本基本信息（名称 / 作者 / 封面）
  - **班级进度基准线**（排表驱动）：「本周班级进度：第 N 课」（来自 `getCurrentWeekContent`）
    - 科系统一假期（isHoliday）→ 显示「本周休息」
    - 超出排表范围 / 未排表班 → 不显示基准线
  - 课时列表（各课时含完成状态：未读 / 进行中 / 已完成）
  - 多讲者 LessonResource 展示（YouTube 链接等）
- 🔵 班级进度基准线显示逻辑：
  - 跟班学员：按 `Class.startDate - 休息周`（`getCurrentLessonNumber`）算周号
  - 自学师兄：按 `UserSelfStudyProgram.startDate - 个人休息周` 算周号
  - `currentWeekOverride` 有值时直接使用（辅导员手动覆盖优先）
- ⚠️ 边缘情况：
  - 无 `programId`（班级未关联科系）→ 不显示基准线
  - learningMode=both → 班级科系 + 自学科系各自独立展示

---

#### S-027 课时阅读（阅读器 + 已读确认） ✅ 已实现（基础）/ 🔵 三殊胜 + 完成标记未实现

**触发**：点课时 → ScriptureReadingPage。

**ScriptureReadingPage**
- 🖥️ 看到：
  - 顶部：本周班级进度提示（「本周该学到第 N 课」）
  - 法本正文（sourceText）+ 讲义（referenceText）可切换
  - 底部：「已读完」确认按钮 + 「进入观修」入口（有关联 Meditation 时）
- 👆 可以做：
  - 滚动阅读 → 自动更新 `LessonReadingProgress`（已有功能）
  - 点「已读完」→ 触发完成标记流程（S-028）
  - 点「进入观修」→ MeditationPlayerPage
- ⚠️ 边缘情况：
  - `sourceText` 为空时只显示 referenceText
  - 已完成的课时再次点「已读完」→ upsert 语义，只更新 completedAt

---

#### S-028 学修确认完成（三殊胜框架） 🔵 已设计未实现

**触发**：点「已读完」/「已听完」/「已看完」/「完成观修」。

**步骤 1：写入完成标记**
- ➡️ 后端 `POST /api/lesson-completions`（upsert）写 `LessonCompletion{ type='read'/'audio'/'video'/'meditation', ... }`
- 重复点仅更新 `completedAt`，不新增行

**步骤 2：回向 Sheet（preferShowFaxin=true）**
- 🖥️ 看到：固定回向文字 + 「已回向」按钮
- 👆 可以做：点「已回向」
- ➡️ 之后：Sheet 关闭，返回原页面；现有底部导航（「进入观修」等）依然可见
- preferShowFaxin=false：直接完成，无 Sheet

**观修触发特殊说明**：
- 观修进度 ≥ 80% → 系统自动写 `LessonCompletion(type=meditation)`，触发回向
- 手动点「完成观修」按钮 → 同触发（兜底）
- 两路径均 upsert，不重复写入

---

#### S-029 思考题（写思考 → 参考答案） 🔵 已设计未实现

**触发**：课时末尾「思考题」区 或 QuizPage 答题流中遇到 open 题（noScoring=true）。

**思考题流程**
- 🖥️ 看到：题目描述 + 文本输入框（无字数限制）+ 「提交」按钮
- 👆 可以做：写下思考，提交
- ➡️ 之后：
  1. 写 `UserAnswer`（不打 AI 分，因 payload.noScoring=true 跳过 gradeOpenWithLlm）
  2. 立即显示 `QuestionReference.referenceText`（参考答案）供对照
  3. `QuestionReference` 不存在时 → 显示「参考答案待整理」
- ⚠️ 边缘情况：
  - `publishedAt` 仅为 admin 元数据，不控解锁；有 UserAnswer 即解锁
  - 普通 open 题（无 noScoring）仍走 AI 评分，不受影响

---

#### S-030 观修播放（92修法） ✅ 已实现（基础）/ 🔵 系列标记未实现

**触发**：点「进入观修」→ MeditationPlayerPage。

**MeditationPlayerPage**
- 🖥️ 看到：视频播放器 + 字幕 + 进度 + 系列信息（seriesKey='92xiufa' 时显示「第 N 法」）
- 👆 可以做：播放 / 暂停 / 进度拖动
- ➡️ 进度 ≥ 80% → 自动写 `LessonCompletion(type=meditation)` + 触发回向（S-028）
- ⚠️ 边缘情况：
  - 密法观修（`isTantric=true`）→ 未授权学员不显示（零痕迹）
  - `seriesKey='92xiufa'` + `seriesNumber` 驱动系列导航

---

#### S-031 批量补录学习进度 🔵 已设计未实现

**触发**：学员进入「批量补录」功能（课程页或专属入口）。

**批量补录**
- 🖥️ 看到：课时列表 + 多选框
- 👆 可以做：勾选多节课时，点「批量确认已读」
- ➡️ 之后：批量 `POST /api/lesson-completions`，写多条 `LessonCompletion(type='read')`，无次数限制
- ⚠️ 边缘情况：已完成的课时不重复计数（upsert）

---

### 1.8 活动中心

---

#### S-032 平台场次详情页 🔵 已设计未实现

**触发**：班级 Tab `/class` 共修区块 → 点「去签到」→ `/assemblies/:id`（平台级场次详情，新建页）。

**PlatformSessionDetailPage（新建）**
- 🖥️ 看到：场次标题 + 课时名 + 时间窗口 + 签到状态
- 进行中时：「去签到（App 内）」按钮（需登录）
- 到期后：仅展示信息，我的出勤状态
- 👆 可以做：App 内签到 → 写 StudyRecord（S-018）
- ⚠️ 边缘情况：平台级场次（classId=null）任意活跃学员均可签到

---

### 1.9 「我的」页面（讲考记录/考试成绩/设置/暂停）

---

#### S-033 我的 Tab 根页（`/me`） 🔵 已设计未实现

> 导航变更（5-Tab，2026-05-26）：「我的」Tab 根页从 `/profile` 改为 `/me`（新建页）；`/profile` 重定向至 `/me`。

**触发**：点底部导航「我的」→ `/me`。

**MePage（新建）**
- 🖥️ 看到：
  - 顶部：头像 + 昵称（行者0001）+ 姓名 / 法名 / 城市 + 已皈依 · 学员 2026001
  - 「编辑个人信息」按钮 → `/profile`（原有页面复用）
  - 学修记录区块：
    - 「讲考记录」→ `/my/speaking-history`（旁边显示通过率 badge；graded=0 时 badge 隐藏）
    - 「考试成绩」→ `/my/exam-grades`（旁边显示最近一次分数；无成绩时隐藏）
    - 「法会记录」→ `/my/event-history`
    - 「打卡历史」→ `/practice/history`
  - 右上角通知铃（`🔔`）+ 未读红点（从首页移入；`useUnreadNotifCount`）
  - 账号区块：设置 / 隐私 / 帮助 / 退出登录
- ⚠️ 边缘情况：无讲考记录时通过率 badge 不显示，不显示「0%」

---

#### S-034 考试成绩页（/my/exam-grades） 🔵 已设计未实现

**触发**：我的 Tab（`/me`）→ 学修记录区块 → 点「考试成绩」。

**ExamGradesPage（新建）**
- 🖥️ 看到：所有考试成绩列表（按 examDate 倒序）
- 每条：考试名称 / 日期 / 关联法本（courseTitle?）/ 百分制分数 / 评语
- 数据来源：`GET /api/my/exam-grades`（page/limit 分页，默认 20）
- ⚠️ 边缘情况：无成绩记录 → 空态提示「暂无考试成绩」

---

#### S-035 个人设置（三殊胜开关 + 时区 + 暂停） 🔵 已设计未实现（新字段）

**触发**：我的 Tab（`/me`）→ 账号区块 → 「设置」→ `/settings`（SettingsPage）。

**SettingsPage（修改后）**
- 🖥️ 看到（新增设置项）：
  - 「三殊胜框架」开关（`preferShowFaxin`）：关闭后跳过修持打卡前的发心语 + 内容完成后的回向 Sheet
  - 时区选择（`timezone`）：IANA 格式，如 America/New_York
  - 学习模式（`learningMode`）：跟班 / 自学 / 混合
  - **班级学习暂停/恢复**（学员自助）：`cohortStatus active↔paused`，级联所有 source=auto 愿
- 👆 可以做：点「暂停学习」→ 确认 → `cohortStatus=paused`，所有 auto 愿同步暂停
- ⚠️ 边缘情况：暂停期间掉队检测不计算该学员（cohortStatus≠active 跳过）

---

### 1.10 藏历日历 + 日记

---

#### S-036 藏历日历 + 修持日记（嵌入） 🔵 已设计未实现（日记部分）

**触发**：首页顶部藏历日期区域 → 点击 → `/calendar`（CalendarPage）。（5-Tab 设计中日历无独立 Tab，入口在首页顶部）

**CalendarPage（修改后）**
- 🖥️ 看到：月视图 / 周视图藏历日历（已有）+ 打卡标记
- 👆 可以做：点某天 → 展开日日详情

**展开后（上下两区块）**：

**上半：藏历信息**（已有功能）
- 🖥️ 看到：藏历日期 / 节日 / 吉日提示

**下半：当天修持日记**（新增）
- 有日记：显示内容 + 「编辑」按钮
- 无日记：「写今日修持感想」入口

**日记编辑（编辑/新建 Sheet）**
- 🖥️ 看到：文本输入框 + 可见性开关（私密 / 辅导员可见）
- 👆 可以做：写内容，设可见性，保存
- ➡️ 之后：`POST /api/journals` → upsert `PracticeJournal( @@unique [userId, journalDate] )`
  - `journalDate` = 所选日历日按 `User.timezone` 取本地日期
- ⚠️ 边缘情况：
  - 一天只有一篇日记（upsert），重复保存覆盖
  - `visible_to_coach=true` → 辅导员端「学员修行数据」可见（需 canViewStudents）
  - 打卡反思已移除，日记是唯一反思载体

---

## 第二部分：辅导员端 (Coach)

### 2.1 入口 + 班级切换

---

#### S-038 进入辅导员端 🔵 已设计未实现（CoachContext API）

**触发**：ClassAdmin 或 admin 直接访问 `/coach`（无学员端入口，三端分离铁律）。

**CoachDashboard（落地页）**
- 🖥️ 看到：此人管理的班级列表（每个班卡片 + 可见模块磁贴）
- 数据来源：`GET /api/coach/context` → `{ isAdmin, classes:[{classId, className, flags{6 个}}] }`
- 👆 可以做：点班级卡片 → 进入 `/coach/:classId/` 班级首页
- ➡️ 路由守卫 `RequireCoach`：`context.classes 为空` → redirect 到学员首页 `/`
- ⚠️ 边缘情况：
  - admin（role='admin'）→ `isAdmin=true`，列全部班级、flag 全开
  - ClassAdmin → 列其有记录的班级，按 flag 显示
  - 普通学员访问 `/coach` → 踢回学员首页

---

#### S-039 班级首页（模块磁贴） 🔵 已设计未实现

**触发**：点班级卡片进入 `/coach/:classId/`。

**CoachClassDashboard**
- 🖥️ 看到：仅渲染 `flags=true` 的模块磁贴：
  - canManageMembers → 「成员管理」
  - canManageExams → 「讲考 + 考试」
  - canViewStudents → 「学员数据 + 掉队名单 + 班级周汇总」
  - canCareFollowup → 「关怀跟进」
  - canEditGoals → 「修持愿管理」
  - canManageCourse → 「课程进度」
- ⚠️ 边缘情况：无任何 flag 的 ClassAdmin → 空磁贴页（无实际内容），后端 API 仍守卫

---

### 2.2 成员管理（状态机操作）

---

#### S-040 成员状态管理页 🔵 已设计未实现

**触发**：有 canManageMembers 权限，点「成员管理」磁贴 → `/coach/:classId/members`。

**CoachMembersPage（新建）**
- 🖥️ 看到：班级活跃成员列表（姓名 / 学号 / 入班日 / 当前状态 / 操作列）
- 👆 可以做（批量或单人）：
  - 代操作暂停：`active → paused`（canManageMembers 可代操作）
  - 代操作恢复：`paused → active`
  - 留级：`active/paused → held_back`（`heldBackCount+1`，仅标记不转班）
  - 毕业：`active/paused → graduated`（写 `graduatedAt`）
  - 退班：`active/paused → left`
  - 填写原因（可选）
- ➡️ 状态机执行（`changeMemberStatus`）：
  - paused：级联所有 source=auto 愿同步 paused（custom 愿不动）
  - active（恢复）：级联 source=auto 愿同步恢复 active
  - held_back：`heldBackCount+1`，历史数据只读；**转下一届班为手动**（到目标班手动加新成员）
  - graduated：写 `graduatedAt`
- ⚠️ 边缘情况：
  - `held_back/graduated/left → active`（复活）仅 admin 可执行
  - 暂停的成员在掉队检测、班级排行、周汇总中排除

---

### 2.3 共修场次管理（创建/签到码/出勤查看）

---

#### S-041 共修场次管理 ✅ 已实现（基础）/ 🔵 签到 token 未实现

**触发**：有 canManageExams 权限（或 admin）→ `/coach/:classId/sessions`（CoachClassSessionsPage）。

**CoachClassSessionsPage**
- 🖥️ 看到：共修场次列表（标题 / 开始时间 / 结束时间 / 出勤数 / 签到码状态）
- 👆 可以做：
  - 新建场次：标题 + 课时关联（lessonId）+ 开始 / 结束时间（按 Class.timezone）
  - 生成签到 token：`POST /api/admin/sessions/:id/checkin-token?sessionType=group`
  - 查看出勤名单：StudyRecord 列表（group_attend / group_absent）
- 🔵 生成签到 token 后：
  - 🖥️ 看到：`checkInUrl`（可复制分享）
  - 学员通过链接签到 → S-037

---

### 2.4 讲考管理（创建场次/报名名单/评分）

---

#### S-042 讲考管理（/coach/:classId/exams Tab 1） 🔵 已设计未实现

**触发**：有 canManageExams 权限 → `/coach/:classId/exams`（Tab 1「讲考」）。

**CoachExamsPage Tab 1**
- 🖥️ 看到：
  - 班级讲考汇总统计：各场次出勤率 / 通过率 / 成绩分布卡片 + 学员维度汇总表（数据来源：`GET /api/classes/:classId/speaking-stats`）
  - 讲考场次列表（按 startAt 倒序）
- 👆 可以做：
  - 新建讲考场次：`POST /api/classes/:id/speaking-sessions`（课时 + 开始/结束时间 + 备注）
  - 生成签到 token → 分享链接
  - 查看报名名单：`GET /api/classes/:classId/speaking-sessions/:id/registrations`（已报名 + 签到状态）
  - 评分录入（S-043）

---

#### S-043 讲考评分录入 🔵 已设计未实现

**触发**：讲考结束后（sessionEndAt 已过），点「评分」进入评分界面。

**评分界面**
- 🖥️ 看到：本班参与名单（已报名 + 已签到学员）
- 👆 可以做：对每位学员选择评分（通过 / 不通过 / 优秀）+ 可选填文字评语
- ➡️ 之后：`POST /api/classes/:classId/speaking-sessions/:id/grade` 写 `SpeakingGrade`（upsert）
  - 辅导员可改分（upsert 覆盖旧评分）
  - 后置：向被评分学员推送站内通知
- ⚠️ 边缘情况：
  - 仅可录入本班活跃成员成绩（`classId` 归属校验）
  - 未签到的学员也可评分（辅导员自行判断是否到场）

---

### 2.5 考试成绩录入

---

#### S-044 考试成绩录入（/coach/:classId/exams Tab 2） 🔵 已设计未实现

**触发**：有 canManageExams 权限 → `/coach/:classId/exams`（Tab 2「考试成绩」）。

**CoachExamsPage Tab 2**
- 🖥️ 看到：本班相关考试列表（班级级 + 平台级）+ 每场汇总均分
- 👆 可以做：
  - 选择某场考试 → inline 录入表格（用户名行 × 分数列）
  - 输入 0-100 整数分数 + 可选评语
  - 批量提交：`POST /api/classes/:classId/exams/:examId/grades`（批量 upsert）
- ⚠️ 边缘情况：
  - 重复录入 → upsert 覆盖旧值（`@@unique([examId, userId])`）
  - 非本班学员成绩不可录入（校验 userId 属于本班活跃成员）
  - 平台级考试（classId=null）同样可在此录本班成绩

---

### 2.6 学员学习数据 + 掉队名单

---

#### S-045 学员修行数据页 🔵 已设计未实现

**触发**：有 canViewStudents 权限 → `/coach/:classId/students`（CoachStudentsPage 改造）。

**CoachStudentsPage**
- 🖥️ 看到：
  - 每位学员：姓名 + 学号 + 近期修持打卡统计 + auto 愿进度（currentStatus 可见）
  - 日记：visible_to_coach=true 的 PracticeJournal 条目
- 👆 可以做：点学员 → 展开详情 / 发起关怀

---

#### S-046 掉队名单（四维度） 🔵 已设计未实现

**触发**：有 canViewStudents 权限 → 掉队名单入口。

**掉队名单**
- 🖥️ 看到：CohortLagSnapshot 多维表格（每人一行）

| 学员 | 修持 | 闻思 | 出勤 | 日记 |
|---|---|---|---|---|
| 张三 | 🔴 at_risk | 🟡 slightly_behind | ✅ on_track | ✅ on_track |

- 👆 可以做：
  - 按任一维度筛选/排序（如按修持维度 at_risk 排序）
  - 点「detail」→ 查看该学员明细数据（practiceRate / studyRate / absent 数等）
  - 点「发起关怀」→ 触发关怀流程（S-047），自动带入当前快照
- ⚠️ 边缘情况：
  - 每日凌晨定时任务重算，实时性延迟约 24h
  - 仅 `cohortStatus=active` 成员显示；paused/graduated/left 不入表
  - 掉队状态对学员端完全不可见（无 API 返回）

---

### 2.7 关怀跟进记录

---

#### S-047 关怀跟进（新建记录） 🔵 已设计未实现

**触发**：有 canCareFollowup 权限 → `/coach/:classId/care`（关怀跟进页）。

**关怀跟进页**
- 🖥️ 看到：本班关怀记录列表（含学员姓名 / 联系时间 / 跟进状态 / 结果）
- 👆 可以做：
  - 新建关怀记录：
    - 选学员
    - 填联系时间（contactedAt）
    - 填关怀摘要（summary）
    - 跟进状态（pending / resolved / escalated）
    - 后端自动从最新 CohortLagSnapshot 拷贝 `lagSnapshotAtContact`（定格掉队快照，事后名单变化不影响）
  - 编辑旧记录状态（resolved / escalated）
- ⚠️ 边缘情况：
  - 关怀记录对学员端完全不可见
  - `lagSnapshotAtContact` 定格为关怀创建时的快照，历史不可变

---

### 2.8 修持愿管理

---

#### S-048 修持愿管理（canEditGoals） 🔵 已设计未实现

**触发**：有 canEditGoals 权限 → `/coach/:classId/goals`。

**VowManagementPage（新建）**
- 🖥️ 看到：本班学员 × 各自 auto 愿 表格
  - 每行：学员名 + 修法项目 + 进度（currentCount / 目标）+ **currentStatus（7 态，仅此页可见）**
  - 可按 currentStatus 筛选（will_overdue / at_risk 优先）
- 👆 可以做：
  - 修改 `currentEndDate`（到期日）→ 后端触发 `recalcVowStatus` + 写 `AuditLog`
  - 修改 `dailyTarget`（每日目标量）→ 写 `paceHistory` + `AuditLog`
  - 填 `statusNote`（状态备注，如「出差中，落后属正常」）→ 仅管理端可见
- ⚠️ 边缘情况：
  - custom 愿（source=custom）完全不可见（私有）
  - 师兄自己也能修改 `dailyTarget`（节奏自主原则）；管理端改会写 AuditLog

---

### 2.9 班级周汇总

---

#### S-049 班级周汇总（WhatsApp 一键复制） 🔵 已设计未实现

**触发**：有 canViewStudents 权限 → 班级周汇总入口。

**WeeklySummaryPage**
- 🖥️ 看到：最新一周汇总（自动生成，每周日凌晨定时任务）：
  - 本周修持总量（按项目分列）
  - 讲考出席人数 + 共修出席人数
  - 当前课时号
  - 活跃人数 + 掉队人数 + 日记提交人数
  - 历史汇总（最近 N 周，分页）
- 👆 可以做：点「复制 WhatsApp 消息」
- ➡️ 之后：
  1. `POST /api/classes/:id/weekly-summary/share` → 写 `sharedAt/sharedBy`，返回 `copyText`
  2. 前端写剪贴板（navigator.clipboard）
  3. copyText 格式：`🙏 [班级名] 本周修学汇报（第 N 课 · M月D日-M月D日）...`
- ⚠️ 边缘情况：
  - 若定时任务当周尚未运行（班级时区内周日未到）→ 显示上周汇总
  - copyText 由前端拼接模板，后端只返回 summaryData 结构

---

## 第三部分：Admin 端

### 3.1 法本/课时/题目/参考答案管理

---

#### S-050 法本管理（Admin 后台） ✅ 已实现（基础）/ 🔵 新字段未实现

**触发**：Admin 进入 `/admin/courses`（AdminCoursesPage）。

**AdminCoursesPage**
- ✅ 已实现：法本 CRUD / 课时 CRUD / 题目 CRUD / 观修管理 / LessonResource YouTube 管理
- 🔵 新增字段待实现：
  - `Course.author`（造论者）
  - `Course.isTantric`（密法标识）+ `Course.tantricGroupId`（归组）
  - `Course.category`（dharma_text / self_study_book）
  - `Course.programSemesterId`（科目归属）
  - `Lesson.sourceText`（法本原文正文）
  - `Meditation.seriesKey/seriesNumber`（92修法系列）

---

#### S-051 参考答案管理 🔵 已设计未实现

**触发**：Admin 进入参考答案管理页（新建）。

**QuestionReferencePage（新建）**
- 🖥️ 看到：题目列表 + 参考答案状态（已录入 / 待整理）
- 👆 可以做：
  - 为 open 题创建/编辑 `QuestionReference`（一题一份）
  - 标记 `publishedAt`（定稿时间，元数据，不控解锁）
- ⚠️ 边缘情况：
  - 学员有 UserAnswer 即解锁参考答案（不依赖 publishedAt）
  - `QuestionReference` 不存在 → 学员看到「参考答案待整理」

---

### 3.2 班级管理 + ClassAdmin 权限分配

---

#### S-052 班级管理（新增字段） 🔵 已设计未实现（新字段）

**触发**：Admin 进入 `/admin/classes`（AdminClassesPage）。

**AdminClassesPage（修改后）**
- 🔵 新增字段支持：
  - `Class.programId`（关联科系）
  - `Class.startDate`（起始日，进度算法基准）
  - `Class.city`（所在城市）
  - `Class.timezone`（IANA 时区）
  - `Class.currentWeekOverride`（手动覆盖当前周号，admin 也可操作）

---

#### S-053 ClassAdmin 权限分配 🔵 已设计未实现

**触发**：Admin 进入 `/admin/classes/:id/admins`（新建）。

**ClassAdminPage（新建）**
- 🖥️ 看到：当前班级的 ClassAdmin 列表（用户名 / 6 个 flag 状态）
- 👆 可以做：
  - 搜索用户 → 添加为 ClassAdmin
  - 逐 flag 勾选（canManageMembers / canManageExams / canViewStudents / canCareFollowup / canEditGoals / canManageCourse）
  - 保存：写/更新 `ClassAdmin` 记录（`@@unique([classId, userId])`）
  - 删除 ClassAdmin 记录
- ⚠️ 边缘情况：
  - RBAC 分配仅 admin 可执行（`requireRole('admin')`）
  - ClassAdmin（含全权主麦）不能分配其他人（无 canManageAdmins flag）
  - 同一人同一班只有一条 ClassAdmin 记录

---

### 3.3 法会活动管理（创建/编辑/发布）

---

#### S-054 法会活动管理 🔵 已设计未实现

**触发**：Admin 进入法会活动管理页（AdminDharmaAssembliesPage 迁移为 EventDetailAdmin）。

**Admin 法会管理**
- 🖥️ 看到：所有 Event（type=puja/dharma_assembly/weekly）列表
- 👆 可以做（管理端专属 API）：
  - 新建法会：`POST /api/admin/events`
    - 填写：title / eventType / coverImageUrl / startDate / endDate / timezone（必填 IANA）/ tibetanDate（展示文字）/ description / liveStreamUrl / recordingUrl / isActive
  - 编辑：`PUT /api/admin/events/:id`（法会结束后补填 recordingUrl）
  - 软删除：`DELETE /api/admin/events/:id`（`isActive=false`）
- ⚠️ 边缘情况：
  - `timezone` 必填；藏历法会固定填 `Asia/Shanghai`
  - 法会边界判断：`PracticeLog.logDate`（UTC）转为 `event.timezone` 本地日期后与事件日期比较
  - `recordingUrl` 可在法会结束后补填

---

### 3.4 考试管理（创建/成绩录入）

---

#### S-055 考试管理（Admin） 🔵 已设计未实现

**触发**：Admin 进入 `/admin/exams`（新建）。

**AdminExamsPage（新建）**
- 🖥️ 看到：考试列表（可按班级 / 法本 / 日期筛选）+ 每场成绩摘要
- 👆 可以做：
  - 新建考试：`POST /api/admin/exams`（title / examDate / classId?（null=平台级）/ courseId?）
  - 编辑：`PUT /api/admin/exams/:id`（不允许修改 classId）
  - 删除：`DELETE /api/admin/exams/:id`（级联删所有 ExamGrade）
  - 成绩录入：`GET /api/admin/exams/:id/grades` 查看全部学员成绩
  - 批量 upsert：`POST /api/admin/exams/:id/grades`（`[{ userId, classId, score, comment? }]`，upsert 覆盖）
- ⚠️ 边缘情况：
  - 平台级考试（classId=null）可录入任意学员成绩
  - 班级级考试辅导员也可录入（需 canManageExams 权限）

---

### 3.5 讲考统计

---

#### S-056 Admin 讲考统计 🔵 已设计未实现

**触发**：Admin 进入 `/admin/speaking-stats`（新建）。

**AdminSpeakingStatsPage（新建）**
- 🖥️ 看到：
  - 平台汇总：总场次 / 总报名 / 总签到 / 整体通过率 / 成绩分布（excellent/pass/fail）
  - 场次列表（可按日期范围筛选）：每场概览（场次 ID / 标题 / 班级 / 时间 / 报名数 / 通过率）
- 👆 可以做：
  - 按日期范围筛选（`from?/to?`）
  - 点某场次 → 展开单场详情（复用 `GET /api/speaking-sessions/:id/stats`）：签到人数 / 通过率 / 成绩分布 / 出席率

---

### 3.6 科系/排表管理

---

#### S-057 科系管理 🔵 已设计未实现

**触发**：Admin 进入科系管理页（新建）。

**AdminProgramsPage（新建）**
- 🖥️ 看到：科系列表（Program：加行 / 净土 / 入行论 / 基础等）
- 👆 可以做：新建/编辑 Program（name / code / description）

---

#### S-058 排表编辑（科系→科目→周→内容） 🔵 已设计未实现

**触发**：点某科系 → 进入排表编辑器。

**排表编辑器（嵌套结构）**
- 🖥️ 看到：科系 → 科目（ProgramSemester）→ 周（ProgramWeek）→ 每周内容
- 👆 可以做：
  - 新建/编辑科目（ProgramSemester：名称 / 开始周 / 结束周）
  - 新建/编辑周（ProgramWeek：周号 / 是否假期 / 备注）
  - 周排课程（ProgramWeekCourse：关联 Course + Lesson）
  - 周排修法（ProgramWeekPractice：关联 PracticeProject + Meditation）
  - 打卡要求配置（ProgramStudyType：studyType / required/recommended）
- ⚠️ 边缘情况：
  - 排表是「本周基准内容」的唯一真相源（喂基准线 + 喂掉队检测）
  - 学员实际阅读自由（不被排表锁课）
  - 同科系各班按各自 startDate 错峰使用同一排表

---

### 3.7 修持模板管理

---

#### S-059 修持模板管理 🔵 已设计未实现

**触发**：Admin 进入修持模板管理页（新建）。

**AdminPracticeTemplatePage（新建）**
- 🖥️ 看到：模板列表（名称 / 修法项目 / 目标 / 适用科系 / 是否必修）
- 👆 可以做：
  - 新建/编辑 PracticeTemplate：name / practiceProjectId / targetCount / targetPeriod / defaultDailyTarget / appliesToPrograms / isRequiredForPromotion
  - 班级绑定：`CohortRecommendedTemplate`（auto / recommended）+ 排序
- ⚠️ 边缘情况：
  - `binding='auto'` → 新学员入班时自动建愿
  - `isRequiredForPromotion=true` → 此愿为升科目必修条件

---

### 3.8 密法组管理

---

#### S-060 密法组管理 ⏸ 暂缓（Phase 5，后台先做）

**触发**：Admin 进入密法组管理页（新建）。

**AdminTantricGroupPage（新建）**
- 🖥️ 看到：密法组列表（TantricGroup：key / name / description）
- 👆 可以做：
  - 新建/编辑密法组（`POST/PUT /api/admin/tantric-groups`）
  - 将法本/观修/修法项目归组（设置 `tantricGroupId`）
  - 按组授权学员：`POST /api/admin/tantric-grants`（`{ userId, tantricGroupId }`，admin 直接 INSERT，无审批）
  - 撤销授权：`DELETE /api/admin/tantric-grants`
- ⚠️ 边缘情况：
  - 授权按修法组（一次灌顶覆盖该组全部内容：法本 + 观修 + 念诵）
  - 撤销后：历史打卡和愿记录保留，学员失去内容访问权（零痕迹过滤）
  - 密法授权矩阵：
    - 未授权学员：零痕迹（列表/搜索/关联全过滤）
    - 已授权学员：正常访问
    - 管理端（任何 ClassAdmin）：始终可见（不过滤）
    - Admin：全平台可见

---

## 第四部分：公开端点

### 4.1 签到链接页（无需登录）

---

#### S-037 签到链接页（/checkin/:token） 🔵 已设计未实现

**触发**：辅导员/admin 生成签到 token → 通过微信/WhatsApp 分享链接给学员。

**生成流程（管理端）**
- `POST /api/admin/sessions/:id/checkin-token?sessionType=speaking|group`
- 响应：`{ token, checkInUrl }`（checkInUrl = `/checkin/:token`）

**CheckInPage（新建 · 无需登录）**

**状态机一：场次未开始**
- 🖥️ 看到：场次标题 + 「签到未开始，将于 XX:XX 开始」
- 👆 可以做：等待，刷新页面
- ➡️ `startAt > now` → `{ status: 'not_started', startsAt }`

**状态机二：签到窗口已关闭**
- 🖥️ 看到：「签到已关闭，结束于 XX:XX」
- 👆 可以做：仅查看信息，无操作
- ➡️ `sessionEndAt < now` → `{ status: 'closed', endedAt }`

**状态机三：签到进行中（open）**
- 🖥️ 看到：
  - 场次信息（标题 / 课时 / 时间窗口 / 是否平台级）
  - 成员列表（姓名 / 学号 / 程序归属 / 已签到状态）
    - 班级场次：该班活跃成员
    - 平台级场次（isPlatform=true）：搜索框 + 按科系筛选（全平台学员列表）
- 👆 可以做：
  - 学员找到自己的名字 → 点名字完成签到
  - 平台级场次可用搜索框找人（`?search=&programId=`）
- ➡️ 之后：`POST /api/checkin/:token`（body: `{ userId }`）
  - 校验：时间窗口 + userId 归属（班级场次：本班成员；平台级：任意活跃学员）
  - 防重复：`StudyRecord @@unique` 返回 409（已签到）
  - 写 `StudyRecord{ studyType='speaking_present'/'group_attend', isConfirmed=true }`
  - 响应：`{ ok: true, checkedInAt }`
  - 页面更新：该学员名字旁显示「✓ 已签到」

- ⚠️ 边缘情况：
  - token 无效（不存在）→ 404
  - 重复签到 → 409，提示「您已签到」
  - 场次为讲考（SpeakingSession）→ `studyType='speaking_present'`
  - 场次为共修（ClassSession）→ `studyType='group_attend'`
  - token 不过期，由操作人手动刷新（`POST /api/admin/sessions/:id/checkin-token` 再次调用）

---

## 附录：约修（⏸ 暂缓 Phase 5）

---

#### S-A01 约修创建与参与 ⏸ 暂缓（Phase 5）

**触发**：班级成员访问 `/appointments`（学员端 UI 暂缓）。

**设计摘要**（DB + 后端 API 当前阶段预留，UI 暂缓）：
- 任意班级成员可创建约修：`PracticeAppointment{ classId, totalTarget, startDate, endDate }`
- 参与：加入约修后自动建 `UserPracticeVow{ context='appointment', appointmentId }`
- 自动关闭：每日凌晨定时任务检查 `endDate < now`（expired）或 `currentTotal ≥ totalTarget`（completed）→ 约修关联愿置 paused
- 可见性：仅本班成员（classId 必填，不跨班）
- ❌ 无审批流 / 无推送通知 / 无个人指标
- ⚠️ 边缘情况：约修愿 `currentStatus` 用于辅导员端状态筛选，师兄端不展示

---

## 附录：班级动态 / 讨论（⏸ 暂缓）

---

#### S-A02 班级动态（ClassPost）⏸ 暂缓（UI 暂缓，DB + API 当前阶段预留）

- 功能：发帖 / 点赞 / 评论 / 站内转发
- 删除权限：本人 或 `canManageMembers=true` 的 ClassAdmin
- 站内转发：创建 `ClassPost{ sharedFromId=原帖 }` + 记录 `ClassPostShare`

#### S-A03 班级讨论（Discussion）⏸ 暂缓（UI 暂缓，DB + API 当前阶段预留）

- 功能：话题创建（ClassAdmin 或 admin）/ 观点投票（一人一票，DB 唯一约束）/ 评论（支持一级回复）
- 话题可关联课时 / 法本

---

## 附录：AI 助手（⏸ 暂缓）

---

#### S-A04 AI 助手（全部 ⏸ 暂缓）

**设计分层（4 Tier，均暂缓）**：
- Tier 1：法本 RAG 检索（ContentChunk + pgvector embedding）
- Tier 2：功能导航（FeatureEntry catalog + 意图分类）
- Tier 3：课时内联助手 / 辅导员洞察
- Tier 4：个性化 / 语音

**依赖**：需先启用 pgvector 扩展（`migration_009b_pgvector.sql`）
**表**：AiConversation / AiMessage / AiUsage / ContentChunk / FeatureEntry

---

## 设计缺口汇总

| 编号 | 位置 | 缺口描述 |
|---|---|---|
| G-001 | S-004 药丸卡片 | ✅ 已解决（2026-05-26）：复用 `GET /api/my/upcoming-events?within=10080`，不新建端点 |
| G-002 | S-004 药丸卡片 | ✅ 已解决（2026-05-26）：5-Tab 定型，药丸点击 → `/class` 班级 Tab；布局 D4 确认保留原 4 卡 + 今日修学卡 |
| G-003 | S-014 发法会愿 | ✅ 已解决（2026-05-26）：重复发愿返回 409，前端提示「已发过此法会愿，如需修改点愿进度条」|
| G-004 | S-022 讲考签到 | ✅ 已解决（2026-05-26）：统一用 `speaking_present`；CheckIn API + §5 规则均已修正 |
| G-005 | S-040 成员留级 | 留级后「转下一届班」完全手动，系统无引导 UI；辅导员需要离开此页面到目标班手动加成员 |
| G-006 | S-046 掉队检测 | 「应打卡天数」阈值未在设计文档中固定（「上线前可配置」），初始值需决策 |
| G-007 | S-058 排表管理 | 排表编辑器 UI 复杂度高（多层嵌套：科系→科目→周→课程/修法），分页/交互设计未详述 |
| G-008 | 全局 | ✅ 已解决（2026-05-26）：同 G-004，统一为 `speaking_present`（见 §2.3 枚举定义）|
| G-009 | S-020 讲考入口 | ✅ 已解决（2026-05-26）：讲考入口改为 `/class/:id` 班级详情页，不在 EventsPage Tab |

---

*文档覆盖 FINAL_DESIGN_SANSUSHENG.md 全部功能，按角色分四部分组织，含所有场景号 S-001 到 S-060 及附录场景 S-A01 到 S-A04。*
