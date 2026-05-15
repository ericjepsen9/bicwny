# 觉学 · 通知与短信系统 · 终版规格

> 状态：✅ 设计封顶（2026-05-15）
> 这份文档是**实施唯一参考** · 单一信息源。讨论历史见 `NOTIFICATION_V2_LAYERED_ARCH.md`（10 层演进）和 `NOTIFICATION_V2_DESIGN.md`（原 12 模块设计 · 已合并 / 部分作废）。
> 若与历史文档冲突 · 以本文档为准。

---

## 0. 系统目标

1. **用户绝不错过重要事件**（共修临场 / 任务截止 / 紧急公告 / 法会开启）
2. **多通道精准分工**（站内 / Push / Banner / 首页 UI / SMS）· 不重复打扰
3. **用户掌控**（每类通道 / 类型可关 · 默认 on 引导 · SMS 默认 off opt-in）
4. **成本可控**（SMS 月预算 $100 · push / 站内零成本）
5. **可观测可回退**（feature flag + admin 实时仪表盘 + 灰度发布）

---

## 1. 5 通道架构

| # | 通道 | 触达场景 | 性质 | 成本 |
|---|---|---|---|---|
| 1 | **站内（铃铛 + /notifications）** | 用户主动查记录 | 永久存储 · 零打扰 | 零 |
| 2 | **Push（Web Push · PWA）** | 用户**不在 app** | 系统通知 · 强打扰 | 零（已有 VAPID）|
| 3 | **In-app Banner** | 用户**在 app 但不在首页** | 顶部浮动 · 中等打扰 | 零 |
| 4 | **首页玻璃文字 + 班级红点** | 用户**在首页** | 静态展示 · 零打扰 | 零 |
| 5 | **SMS（Twilio）** | 兜底 · 重要事件 | 强触达 · 跨平台 | $60-100/月 |

**互斥规则**：
- Push 和 Banner **互斥**（app 前台用 banner · 后台用 push · 同一事件不重复打扰）
- SMS 永远是「前期提醒」· 不与 Banner 同时（共修 T-5 banner / 法会 T-24h SMS）
- 首页玻璃文字**不是通知系统** · 是首页 UI 元素 · 按业务状态自然显隐

---

## 2. 9 类事件源 · 全路由表

| # | 事件 | 发布方 | 入口 | 站内 | Push | Banner | 玻璃文字 | 班级红点 | SMS |
|---|---|---|---|---|---|---|---|---|---|
| ① | ClassSession 共修 | 辅导员 | `/coach/classes/:id/sessions` | ✅ | ✅ | T-5/T-0/进行中 | 「下次共修」行 | ✅ | ❌ |
| ② | ClassAnnouncement normal | 辅导员 | `/coach/classes/:id/announcements` | ✅ | ✅ | ❌ | 「N 条未读」 | ✅ | ❌ |
| ② | ClassAnnouncement urgent | 辅导员 | 同上（手动升）| ✅ | ✅ | ✅ | 同上 | ✅ | ❌ |
| ③ | PracticeTask 修学任务 | 辅导员 | `/coach/classes/:id/tasks` | ✅ | ✅ | ❌ | 「今日任务」行 | ✅ | ❌ |
| ④ | Personal Reminder | 系统 cron | 用户在 `/settings/notifications` 开关 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ⑤ | Achievement 成就 | 系统业务事件 | 业务触发 · 5min 聚合 | ✅ | ✅ | ✅（金色庆祝）| ❌ | ❌ | ❌ |
| ⑥ | SystemAnnouncement normal | admin | `/admin/announcements` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ⑥ | SystemAnnouncement urgent | admin | 同上 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| ⑥ | SystemAnnouncement critical | admin | 同上 | ✅ | ✅（无视静默）| ✅（须 ack）| ❌ | ❌ | ✅（强制）|
| ⑦ | DharmaAssembly 法会 / 系统活动 | admin | `/admin/assemblies` | ✅ | ✅ | 进行中（每日首次进 app）| 进行中持续显示 | ❌ | T-24h（可选）|
| ⑧ | AuspiciousDay 藏历加持日 | 数据预置 | `/admin/auspicious-days` 编辑文案 | ❌ | ❌ | ❌ | 可选行 | ❌ | ❌ |
| ⑨ | MembershipChange | 辅导员 / admin | `/coach/classes/:id/members` 或 `/admin/...` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 3. 各事件源的 tier 调度

### ① ClassSession 共修

| Tier | 触发时机 | severity | 站内文案 | Push 文案 | Banner 文案 |
|---|---|---|---|---|---|
| created | 辅导员创建 | normal | 辅导员安排了周五 19:00 共修 | 周五 19:00 共修已安排 | — |
| time_changed | 改时间 | urgent | 共修时间已改 · 周六 20:00 | 共修时间变更 · 周六 20:00 | — |
| cancelled | 取消 | urgent | 周五共修已取消 | 周五共修已取消 | — |
| t24h | 前 24h | normal | 明日 19:00 周共修 | 明日 19:00 周共修 | — |
| t30 | 前 30 分钟 | normal | 30 分钟后开始 | 30 分钟后开始 | — |
| t5 | 前 5 分钟 | urgent | 共修即将开始 | 即将开始 · ⏱ 5:00 | 共修即将开始 · ⏱ 4:32 · `[立即进入]` |
| t0 | 准时开始 | critical | 共修进行中 | 立即进入 | 共修进行中 · `[进入直播间]` |

**Push tag 替换**：`tag = class_session:{sid}` · T-30/T-5/T-0 共用 · 系统通知栏自动覆盖前一条。

### ② ClassAnnouncement 班级公告

| severity | 站内 | Push | Banner |
|---|---|---|---|
| normal | 辅导员发布「本周任务安排」 | 班级公告 · 本周任务安排 | — |
| urgent | 🔴 重要公告 | 重要 · 周日调休安排 | 重要 · 周日调休 · `[查看公告]` |

### ③ PracticeTask 修学任务

| Tier | 触发 | severity | 站内 | Push |
|---|---|---|---|---|
| created | 创建 | normal | 新任务 · 完成《XXX》 | 新任务 · 完成《XXX》 |
| task_t24h | 截止前 24h | normal | 还有 24h 完成 | 任务剩 24h |
| task_t6h | 截止前 6h | urgent | ⚠️ 6h 后截止 | 即将截止 · 仅剩 6h |
| task_completed | 完成 | normal | 你完成了《XXX》| —（仅站内）|

### ④ Personal Reminder 个人提醒

| Tier | 时机 | 站内 | Push |
|---|---|---|---|
| due | 每日 19:00 · 当日未修学 | 今天还没修学哦 | 临期提醒 |
| daily | 每日 20:00 | 今日修学回顾 · 完成 2/3 | 今日小结 |
| weekly | 周一 08:00 | 上周共修 X 次 · 任务 X/Y | 上周回顾来了 |

### ⑤ Achievement 成就

5 分钟窗口聚合 · 多个解锁合并为 1 条「解锁 N 个成就」。

Banner **金色庆祝样式**：金色渐变 + 光晕呼吸 · 5 秒自动消失 · 不进队列优先级。

### ⑥ SystemAnnouncement 系统公告

| severity | 站内 | Push | Banner | SMS |
|---|---|---|---|---|
| normal | 平台公告 · 新增功能 | 平台公告 · 新增功能 | — | ❌ |
| urgent | 重要 · 数据迁移 | 重要 · 数据迁移 22:00 开始 | 重要 · 数据迁移 · `[查看详情]` | ❌ |
| critical | ⚠️ 紧急 · 平台 22:00 维护 30 分钟 | 紧急 · 22:00 维护（无视静默）| ⚠️ 平台 22:00 维护 · `[我知道了]` | ✅ 强制 |

**critical 特殊**：
- Push 无视用户静默时段
- Banner 永不自动消失 · 必须 ack
- 未 ack 时每次进 app 重浮（直到 ack 或 expiresAt）
- 强制 SMS（绕过用户偏好 · 但仅 phoneVerified 用户）

### ⑦ DharmaAssembly 法会 / 系统活动（信息型）

| Tier | 触发 | 站内 | Push | Banner | SMS |
|---|---|---|---|---|---|
| created | 创建 | 即将开启 · 文殊圣诞法会 5/20-5/22 | 文殊圣诞法会 5/20 开启 | — | ❌ |
| t24h | 开始前 24h | 法会明日 ${startTime} 开始 | 法会明日 ${startTime} 开始 | — | ✅（可选 · 用户子开关）|
| daily_t1h | 每日首场前 1h | 法会今日 19:00 开始 | 法会今日 19:00 开始 | — | ❌ |
| in_progress_arrival | 法会期间每日首次进 app | 法会进行中 | — | 🪷 法会进行中 · `[查看详情]` | ❌ |

**首页玻璃文字**（法会期间持续）：「🪷 文殊圣诞法会 · 进行中」

**模型字段**（含 system_session 子类）：
```prisma
model DharmaAssembly {
  id           String @id @default(cuid())
  title        String
  category     String   // 'assembly' | 'system_session' | 'memorial'
  startAt      DateTime
  endAt        DateTime
  description  String
  coverImage   String?
  externalLink String?  // Zoom 等 · 可空
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**详情页 `/assemblies/:id`**：信息展示型 · 无 `/live` 子页 · 外部链接直接 `<a target="_blank">` 跳转 · 无评论区。

### ⑧ AuspiciousDay 藏历加持日

仅首页玻璃文字 · 无其它通道。

玻璃文字（当日 0:00-23:59）：「🪷 今日加持日 · 农历四月十五 · 释迦牟尼吉祥日」点击 → `/auspicious/:date`。

### ⑨ MembershipChange 班级成员变动

| Tier | severity | 文案 | 跳转 |
|---|---|---|---|
| kicked | urgent | 你已被移出「${className}」 · 如有疑问请联系辅导员 | `/classes`（兜底）|
| joined | normal | 你已加入「${className}」 · 开始你的修学之旅 | `/classes/:id` |
| class_dissolved | urgent | 「${className}」已解散 · 感谢同行 | `/classes` |

仅站内 · 不发 push · 不进 banner · 不进玻璃文字。**隐私原则**：不暴露操作人。

---

## 4. 跳转目标矩阵

| 事件 / tier | 跳转 link |
|---|---|
| ClassSession 预告 / 临近 / 倒数 | `/classes/:id/sessions/:sid` |
| ClassSession 进行中 (t0) | `/classes/:id/sessions/:sid/live` |
| ClassSession 结束 | `/classes/:id/sessions/:sid`（回放）|
| ClassAnnouncement | `/classes/:id/announcements/:aid` |
| PracticeTask | `/classes/:id/tasks/:tid` |
| Personal Reminder | `/profile/practice` |
| Achievement | `/profile/achievements?highlight=:id` |
| SystemAnnouncement | `/announcements/:id` **（新页面）** |
| DharmaAssembly | `/assemblies/:id` · **无 /live** |
| MembershipChange kicked/dissolved | `/classes`（兜底）|
| MembershipChange joined | `/classes/:id` |
| AuspiciousDay | `/auspicious/:date` |

---

## 5. Push 通道 5 层过滤

```
1. 事件源允许 push？（藏历日 / 班级成员变动 → 跳过）
2. 用户偏好该类型 push 开启？
3. 幂等去重（NotificationDispatchLog · 同 event + tier 已发过？）
4. 静默时段（22:00-07:00 默认 · 按用户时区）：
   - normal → 延迟次日 07:00 · 聚合为 1 条「你有 N 条未读」
   - urgent → 延迟到静默结束（07:00）单独发
   - critical → 立即发 · 无视静默
5. 频率上限：
   - normal · 每小时 5 条 · 超限丢弃（仍写站内）
   - urgent / critical · 不限
```

---

## 6. In-app Banner 详设

### 6.1 触发条件

```
severity >= urgent
AND 事件类型 ∈ {ClassSession T-5/T-0/进行中, Achievement, 
              urgent/critical SystemAnnouncement, urgent ClassAnnouncement, 
              DharmaAssembly 进行中}
AND document.visibilityState === 'visible'（app 前台）
AND window.location.pathname !== link（不在目标页 · 否则仅 refetch）
```

### 6.2 UI 规范

- z-index 9999 · 浮于所有页面之上
- 高度 64-72px · 圆角 12px · 距顶 8px（避开 safe-area-inset-top）
- 玻璃质感（backdrop-filter blur）
- 背景按 severity（urgent 浅黄 / critical 浅红 / achievement 金色）
- 滑入 300ms · 滑出 200ms · framer-motion
- 整条点击 = 主 CTA（除右上角 [×]）

### 6.3 自动消失

| severity | 行为 |
|---|---|
| normal | 不触发 banner |
| urgent | 8 秒后自动消失 |
| critical | **永不自动消失 · 必须用户点「我知道了」ack** |
| Achievement | 金色样式 · 5 秒自动消失 |

### 6.4 队列管理

- 同时只显示 1 条
- 按 severity 排序（critical > urgent > normal）
- 用户点击 → navigate + 关当前 + 1 秒后显示下一条
- 用户 dismiss → 立即关 + 显示下一条
- 新到 banner 优先级更高 → 推开当前（当前入队首位）
- **队列项过期检查**：banner 数据带 expiresAt · 队列循环时剔除过期

### 6.5 与 Push 的互斥

```
SW push handler
  ↓
clients.matchAll({type:'window'})
  ├─ 有 visible client → postMessage banner（不弹系统通知）
  └─ 无 → showNotification（不通知前端）
```

---

## 7. 首页玻璃文字 + 班级红点

### 7.1 玻璃文字（液态玻璃质感）

```
[Cover 画报]
  ╭─玻璃─╮ 下次共修 · 周五 19:00
  ╭─玻璃─╮ 今日任务 · 5/10 题
  ╭─玻璃─╮ 最新公告 · 3 条未读
  ╭─玻璃─╮ 🪷 文殊圣诞法会 · 进行中  ← 法会期间额外一行
  
  ╭─玻璃 pill─╮ 本周安排 ›  ← 浮于右下
```

**规则**：
- 仅文字 · 无图标 / 倒计时 / 进度条 / 颜色变化
- 任何 tier 都保持平静（临场感由 banner 承担）
- 单行无数据 → 整行隐藏
- 全空 → 整组隐藏 · 仅留玻璃 pill
- 主题自适应：Cover 表加 `theme: 'light' | 'dark'` 字段 · admin 上传时手选

**CSS**：
```css
.glass-info-line {
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(16px);
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  font-size: 13px;
  font-weight: 500;
}
.cover-light .glass-info-line {
  background: rgba(0, 0, 0, 0.12);
  color: rgba(0, 0, 0, 0.85);
}
```

### 7.2 班级红点

- 该班有未处理事件 → 红点（无数字 · 无颜色区分）
- 消失条件：所有事件均处理完
  - 共修：进入过详情 / 已结束
  - 任务：完成 / 截止
  - 公告：全部已读

### 7.3 玻璃文字点击跳转

| 行 | 跳转 |
|---|---|
| 下次共修 | `/classes/:id/sessions/:sid`（最近一场）|
| 今日任务 | `/classes/:id/tasks/:tid`（进度最低的）|
| 最新公告 | `/notifications?filter=announcement` |
| 法会进行中 | `/assemblies/:id` |
| 藏历加持日 | `/auspicious/:date` |
| 玻璃 pill「本周安排」| `/classes/:id/schedule` |

### 7.4 数据获取

单一 endpoint 一次拉全：
```
GET /api/me/home-summary
→ {
  nextSession: { id, classId, sessionId, startAt, className } | null,
  todayTasks: { id, classId, taskId, title, progress: '5/10' } | null,
  unreadAnnouncementsCount: number,
  activeAssembly: { id, title } | null,
  todayAuspicious: { date, title } | null,
  classes: [{ id, name, hasUnprocessed: boolean }],  // 班级红点状态
  homeTheme: 'light' | 'dark',
}
```

避免多接口并发。

---

## 8. 用户偏好（全部维度）

```prisma
model NotificationPreference {
  id            String   @id @default(cuid())
  userId        String   @unique
  
  // Push
  pushEnabled   Boolean  @default(true)
  pushTypes     Json     @default("{}")   // 仅记关闭项
  
  quietStart    String   @default("22:00")
  quietEnd      String   @default("07:00")
  timezone      String   @default("Asia/Shanghai")
  
  reminderDue    Boolean @default(true)
  reminderDaily  Boolean @default(true)
  reminderWeekly Boolean @default(true)
  
  homeCardEnabled    Boolean @default(true)   // 首页玻璃文字总开关
  auspiciousDayCard  Boolean @default(true)
  
  user      User     @relation(fields: [userId], references: [id])
  updatedAt DateTime @updatedAt
}

// SMS 偏好在 User 表（不放 NotificationPreference 因为还有手机号字段）
model User {
  ...
  phoneNumber       String?   @unique     // E.164
  phoneCountryCode  String?
  phoneVerifiedAt   DateTime?
  smsEnabled        Boolean   @default(false)        // 默认关
  smsAssemblyAlerts Boolean   @default(false)        // 默认关
  smsLanguage       String    @default("zh-CN")
}
```

**默认值策略**：
- Push 全开（push 免费 · 默认引导）
- SMS 全关（SMS 收费 · 用户主动 opt-in）

**强制规则**：
- critical SystemAnnouncement push 不可关
- critical SystemAnnouncement SMS 强制（仅 phoneVerified 用户）
- membership_change / auspicious_day 无 push toggle（本就不发）

---

## 9. 通知中心（铃铛 + /notifications）

### 9.1 铃铛角标

- 未读 = 0：纯灰 · 无角标
- 1-9：白底蓝点 + 数字
- > 9：「9+」
- > 99：「99+」+ 顶部「自上次登录 N 条新消息」横幅
- lastSeenAt 时间从 `User.lastSeenAt`（每次 API 调用更新）

### 9.2 列表

- 按日期分组：今天 / 昨天 / N 天前 / 上周 / 更早
- 组内 createdAt desc
- **同事件多 tier 不合并**（T-30/T-5/T-0 各一条）
- 三态：未读 / 已读 / 撤回
- **不提供删除按钮 · 已读即归档**
- 60 天后软删除 · 90 天后物理删除

### 9.3 交互

| 动作 | 结果 |
|---|---|
| 点击未读 | 标 readAt + 乐观更新 + 跳 link |
| 点击已读 | 跳 link |
| 点击撤回 | 不响应 + toast「该内容已被撤回」|
| 顶部「全部已读」 | 批量标记 |
| 滚动到底 | infinite scroll 30 条/页 |
| 下拉刷新 | 重拉 |

### 9.4 撤回处理

- admin / 老师撤回 → 写 `revokedAt` · **不发新通知**
- 推 invalidate `['notifications']` 触发列表 refetch
- 该条目变样（置灰 + 删除线 + 「已撤回」徽章）
- 已显示的 critical banner 立即关闭

### 9.5 API

```
GET   /api/me/notifications?cursor=...&limit=30&filter=announcement
PATCH /api/me/notifications/:id  { read: true }
POST  /api/me/notifications/read-all
GET   /api/me/notifications/unread-count   // 独立 endpoint · 角标用 · staleTime 30s
```

---

## 10. 跳转流程（push / banner / 通知中心）

### 10.1 三入口

**Push 点击（用户在 app 外）**：
```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data.link;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(allClients => {
        const appClient = allClients.find(c => c.url.startsWith(self.location.origin));
        if (appClient) {
          appClient.focus();
          appClient.postMessage({ type: 'navigate', link });
        } else {
          clients.openWindow(link);
        }
      })
  );
});
```

**Banner 点击**：`router.navigate(link) + closeBanner()`
**通知中心**：`patchRead() + router.navigate(link)`

### 10.2 边界处理

| 场景 | 处理 |
|---|---|
| 目标已删除 (404) | 兜底页「该内容已不存在」+ 「返回首页」+ 5 秒自动跳 |
| 权限不足 (403) | 兜底页「你没有权限查看」|
| 未登录（PWA 点 push）| `sessionStorage.setItem('pendingDeepLink', link)` · 登录后读取并跳 |
| App 未启动 push 唤起 | 同上 |
| App 已在目标页 | refetch + scroll top · 不重复 navigate |
| Link 格式异常（如 javascript: URL）| 后端拒绝 / 前端拦截 · 跳首页兜底 |

### 10.3 撤回但已在跳转中

- 用户点 push → 跳目标页 · 同时事件被撤回
- 目标页 mount 时 fetch 数据返回 revokedAt != null
- 显示「该内容已被撤回」兜底 + 返回按钮

---

## 11. SMS 子系统

### 11.1 触发路径（2 条）

**自动触发**：
- ⑥ critical SystemAnnouncement → 强制（仅 phoneVerified 用户）
- ⑦ DharmaAssembly T-24h → 可选（用户子开关）

**Admin 手动广播**：`/admin/sms/broadcast`

### 11.2 7 层过滤（自动 SMS）

```
1. 手机号已验证（phoneVerifiedAt != null）
2. 总开关 smsEnabled（critical 绕过）
3. 事件类型 + tier 白名单（仅 3 种 · 其它一律不发）
4. 子开关 smsAssemblyAlerts（仅法会查）
5. 静默时段（按用户时区 · critical 绕过）
6. 频率上限：日 2 条 + 月度 $100 预算
7. 幂等去重（SmsDeliveryLog）
```

### 11.3 Admin 广播

**受众**：全平台 / 指定班级（多选）/ 指定用户（搜索 · 多选）
**内容**：预设模板 或 自定义文案（≤ 80 字 · 双语）
**bypass 偏好**：勾选 + 二次密码确认 + 审计日志
**时机**：立即 / 定时
**预估**：实时显示目标人数 / 实际发送 / 按国家分布的成本

### 11.4 4 个核心模板

```
1. critical 系统公告（强制 · 双语）
   zh: [觉学] 重要 · ${body}  ${appLink}
   en: [JueXue] Important: ${body}  ${appLink}

2. 法会 T-24h（可选 · 双语）
   zh: [觉学]「${title}」明日 ${startTime} 开启 · ${appLink}  回 STOP 退订
   en: [JueXue] "${title}" begins tomorrow at ${startTime}. ${appLink}  Reply STOP

3. Admin 广播自定义（自动追加前缀 + 退订）

4. OTP（独立 · 不计业务上限）
   zh: [觉学] 验证码 ${code} · 5 分钟内有效
   en: [JueXue] Code: ${code}. Valid 5 min
```

### 11.5 手机号绑定

```
/settings/phone:
1. 选国家区号（用 libphonenumber-js 验证 + format）
2. 输入号码 → E.164 normalize
3. 后端发 OTP（专用模板 · 60s 冷却 · 24h 5 次上限 · IP 限流）
4. 输入 OTP → 5 分钟有效 · 5 次错误锁 1h
5. 验证通过 → user.phoneVerifiedAt = now
```

### 11.6 退订（双通道）

- App 内：`/settings/notifications/sms` 关总开关
- STOP 关键字：Twilio 自动处理 + webhook 同步状态

### 11.7 服务商 Twilio

- A2P 10DLC（美国注册）+ Chinese Carrier Approved Sender（中国到达）
- Geo Permissions 白名单（防 toll fraud）
- 投递回调 webhook（更新 SmsDeliveryLog.deliveredAt）
- 失败重试 3 次（指数退避 1s / 2s / 4s）

### 11.8 月成本

| 场景 | 月触发数 | 成本 |
|---|---|---|
| critical 公告（全员）| 1000 | $40 |
| 法会 T-24h（10% 开启）| 100 | $4 |
| Admin 广播（月 2 次 · 200 人均）| 400 | $16 |
| **合计** | ~1500 | **~$60/月** |

预算上限 $100/月。

---

## 12. dispatchToUsers 终极入口

```ts
async function dispatchToUsers(event: {
  kind: EventKind,
  id: string,
  tier: string,
  userIds: string[],
  severity: 'normal' | 'urgent' | 'critical',
  title: string,
  body: string,
  link: string,                    // 必须以 https:// 或 / 开头
  contentHash?: string,
  scopes: string[],                // 给 SW push invalidate 用
  expiresAt: Date,
}) {
  // 1. 验证 link 格式（防 XSS）
  if (!isValidLink(event.link)) throw new Error('invalid link');
  
  // 2. 写幂等日志
  await logDispatch(event);

  // 3. 批量 prefetch 用户偏好（5min in-memory cache）
  const prefs = await batchGetPreferences(event.userIds);

  // 4. 进队列异步处理（避免阻塞调用方）
  for (const userId of event.userIds) {
    await queue.add('dispatch-user', {
      event, userId, pref: prefs.get(userId)
    });
  }
}

// 队列 worker
async function processDispatchUser({ event, userId, pref }) {
  await Promise.allSettled([
    shouldWriteInbox(event) && writeNotification({ userId, ...event }),
    shouldSendPush(event, pref) && sendWebPush(userId, {
      title: event.title, body: event.body, link: event.link,
      scopes: event.scopes,
      tag: `${event.kind}:${event.id}`,
    }),
    shouldShowBanner(event, pref) && upsertBannerCandidate(userId, event),
    shouldSendSms(event, pref) && sendSmsWithRetry(userId, event),
  ]);
}
```

**最佳努力策略**：4 个通道并行 `Promise.allSettled` · 失败一个不阻塞其它。

---

## 13. 数据库 schema 汇总

```prisma
// === 用户 + 偏好 ===
model User {
  ...
  currentSessionId       String?   // 单设备登录
  lastSeenAt             DateTime? // 通知中心横幅用
  notificationV2Enabled  Boolean   @default(false)  // feature flag
  
  phoneNumber       String?   @unique
  phoneCountryCode  String?
  phoneVerifiedAt   DateTime?
  smsEnabled        Boolean   @default(false)
  smsAssemblyAlerts Boolean   @default(false)
  smsLanguage       String    @default("zh-CN")
}

model NotificationPreference { ... }  // 见 §8

// === 通知 ===
model Notification {
  id          String   @id @default(cuid())
  userId      String
  eventKind   String
  eventId     String
  tier        String
  severity    String
  title       String
  body        String
  link        String?
  icon        String?
  contentHash String?
  createdAt   DateTime @default(now())
  readAt      DateTime?
  revokedAt   DateTime?
  deletedAt   DateTime?
  @@index([userId, createdAt])
  @@index([userId, readAt])
}

model NotificationDispatchLog {
  // 幂等去重 · 已有
  eventKind  String
  eventId    String
  tier       String
  userId     String
  success    Boolean
  error      String?
  createdAt  DateTime @default(now())
  @@unique([eventKind, eventId, tier, userId])
}

model PushSubscription { ... }  // 已有

model NotificationCardAck {
  // critical 系统公告 ack
  userId       String
  eventKind    String
  eventId      String
  kind         String   // 'dismissed' | 'acknowledged'
  contentHash  String?
  createdAt    DateTime @default(now())
  @@unique([userId, eventKind, eventId])
}

// === Push 日志（无 cost 字段）===
model PushDeliveryLog {
  id                  String   @id @default(cuid())
  pushSubscriptionId  String
  userId              String
  status              String   // 'sent' | 'failed' | 'expired'
  error               String?
  sentAt              DateTime @default(now())
  @@index([userId, sentAt])
}

// === SMS 子系统 ===
model SmsDeliveryLog { ... }  // 见 §11
model SmsTemplate { ... }
model SmsBroadcast { ... }

// === 法会 / 系统活动 ===
model DharmaAssembly {
  id           String @id @default(cuid())
  title        String
  category     String   // 'assembly' | 'system_session' | 'memorial'
  startAt      DateTime
  endAt        DateTime
  description  String
  coverImage   String?
  externalLink String?
  createdAt    DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// === 文件 GC ===
model OrphanedFile {
  id           String   @id @default(cuid())
  filePath     String
  variantPaths String[]
  markedAt     DateTime @default(now())
  @@index([markedAt])
}
```

---

## 14. 实施排期（含 SMS · 总 6.5-7 周）

| Sprint | 内容 | 时长 |
|---|---|---|
| S1 | P0 基础（OrphanedFile · 单设备 · feature flag）+ dispatchToUsers 入口 | 1 周 |
| S2 | P1 旧事件源接入 + shadow 3 天验证 | 1 周 |
| S3 | P2 新事件源（任务 / 成就 / 系统公告 / 法会 / 成员）+ 灰度 50% | 1.5 周 |
| S4 | P3 UI 上线（玻璃文字 + 红点 + Banner + 通知中心）+ 灰度 100% | 2 周 |
| S5 | P4 旧路径清理 + **SMS 子系统**（Twilio + 模板 + 广播 UI）| 1.5 周 |
| 缓冲 | bug fix + 文案打磨 | 1 周 |

---

## 15. 灰度发布

| 模式 | 行为 |
|---|---|
| `off` | 全平台走 v1 dispatch · v2 代码不执行 |
| `shadow` | v1 + v2 双发对比 · 但 SMS / Push 仅 v1 发 · v2 仅写 inbox 对比数据 |
| `on` | 仅 `user.notificationV2Enabled = true` 的用户走 v2 |

**回退**：admin 一键 `SystemConfig.notification_v2_global = 'off'` 全平台秒回 v1。

---

## 16. 监控指标

| 指标 | 公式 | 阈值 |
|---|---|---|
| 通知送达率 | `notifications_written / events_dispatched` | < 99% 告警 |
| Push 成功率 | `delivered / sent` | < 95% |
| SMS 成功率 | `delivered / sent` | < 90% |
| Push 授权率 | `granted / active_users` | 跟踪 |
| SMS opt-in 率 | `smsEnabled=true / total` | 跟踪 |
| 静默命中率 | `quiet_delayed / push_sent` | 跟踪 |
| 频率上限丢弃率 | `dropped / sent` | > 5% 告警 |
| Banner CTR | `click / shown` | < 5% 异常 |
| Banner dismiss 率 | `dismissed / shown` | > 50% 查文案 |
| API p95 延迟 | `/api/me/*` | > 200ms 告警 |
| 单用户日 push | `count / user / day` | > 30 告警 |
| SMS 月度成本 | $/month | > $80 告警（80% 预算）|

---

## 17. 上线前 smoke test（19 项）

1. 9 类事件源各发 1 条 · 多通道全到位
2. 静默时段 + critical 绕过 + normal 聚合
3. 共修 T-30/T-5/T-0 push tag 替换（通知栏只显示最新）
4. 共修 tier 升级 · banner 不卸载平滑过渡
5. 公告 dismiss · 老师改内容 → contentHash 变 → 重现
6. critical SystemAnnouncement ack 后消失 · 全平台每人独立 ack
7. 进行中卡缩成右下角徽章
8. 撤回公告：列表置灰 + invalidate
9. 单设备登录：旧设备 401 强登出 + push subscription 清理
10. Cover 替换：7 天后旧文件 GC
11. 频率上限：第 6 条 normal push 被丢 · 站内仍有
12. 用户偏好关 push 类型 → 仅站内
13. 99+ 横幅 + lastSeenAt 显示
14. 60+30 天后通知物理删除
15. 玻璃文字数据为空时整行隐藏
16. 法会进行中玻璃文字多出一行 · 法会结束后消失
17. SMS 手机号绑定 OTP 全流程
18. SMS critical 强制（绕过用户偏好）+ 法会 T-24h opt-in
19. Admin 广播：受众解析 + 成本预估 + bypass 二次密码确认

---

## 18. 已知限制

1. **不支持多设备同时登录**（产品决策）· 数据全部云端 · 换设备恢复
2. **不支持深色模式**（暂不规划）
3. **SMS 暂不支持国际号码外的语言**（仅 zh-CN + en）
4. **首页玻璃文字暂按单班假设**（多班场景 v2 迭代）
5. **法会无 app 内入口**（信息型 · 外部链接直跳 Zoom 等）

---

文档维护：每次架构变更同步更新此文档 · 同时在 commit message 注明变更点。
