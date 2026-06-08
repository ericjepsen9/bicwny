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
- **服务端化**（见 §19.4）：banner 数据源是 `ActiveBanner` 表 · 不是前端 in-memory · 进 app 时调 `GET /api/me/active-banners` 拉 pending 列表 · critical 未 ack 用户关 app 重开仍能看到

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
  // 安全：仅接受同源相对路径 · 防 javascript: URL 注入（见 §19.1）
  const safe = link && link.startsWith('/') ? link : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(allClients => {
        const appClient = allClients.find(c => c.url.startsWith(self.location.origin));
        if (appClient) {
          appClient.focus();
          appClient.postMessage({ type: 'navigate', link: safe });
        } else {
          clients.openWindow(safe);
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
  link: string,                    // 必须以 / 开头（同源相对路径 · 见 §19.1）
  contentHash?: string,
  scopes: string[],                // 给 SW push invalidate 用
  expiresAt: Date,
}) {
  // 1. 验证 link 格式（防 XSS · §19.1）
  if (!isValidLink(event.link)) throw new Error('invalid link');
  
  // 2. 全局 mode 检查（§19.6 + §19.7）
  const globalMode = await getSystemConfig('notification_v2_global');
  if (globalMode === 'off') {
    // OTP 除外（独立路径 · 不走这里）· 其它业务全 v1
    return await dispatchV1(event);
  }
  if (globalMode === 'shadow') {
    // v1 正常执行（含 push + sms）· v2 仅 inbox 双写做对比 · 不发 push / sms / banner
    await Promise.all([
      dispatchV1(event),
      writeNotificationsV2Shadow(event)
    ]);
    return;
  }
  
  // 3. mode === 'on' · 写幂等日志（per-channel · §19.3）
  await logDispatch(event);

  // 4. 批量 prefetch 用户偏好（5min in-memory cache）
  const prefs = await batchGetPreferences(event.userIds);

  // 5. 进队列异步处理（避免阻塞调用方）
  for (const userId of event.userIds) {
    const user = await getUser(userId);
    if (!user.notificationV2Enabled) {
      // 灰度名单外用户走 v1
      await queue.add('dispatch-v1', { event, userId });
    } else {
      await queue.add('dispatch-user', { event, userId, pref: prefs.get(userId) });
    }
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

## 13. 数据库 schema 汇总（含审计修复）

```prisma
// === 用户 + 偏好 ===
model User {
  ...
  currentSessionId       String?   // 单设备登录
  lastSeenAt             DateTime? // 通知中心横幅用
  notificationV2Enabled  Boolean   @default(false)  // feature flag
  timezone               String    @default("Asia/Shanghai")  // 智能默认（见 §19.13）
  
  phoneNumber       String?   @unique
  phoneCountryCode  String?
  phoneVerifiedAt   DateTime?
  smsEnabled        Boolean   @default(false)
  smsAssemblyAlerts Boolean   @default(false)
  smsLanguage       String    @default("zh-CN")
}

model NotificationPreference {
  id              String   @id @default(cuid())
  userId          String   @unique
  pushEnabled     Boolean  @default(true)
  pushTypes       Json     @default("{}")
  quietStart      String   @default("22:00")
  quietEnd        String   @default("07:00")
  timezone        String   @default("Asia/Shanghai")
  reminderDue     Boolean  @default(true)
  reminderDaily   Boolean  @default(true)
  reminderWeekly  Boolean  @default(true)
  homeCardEnabled    Boolean @default(true)
  auspiciousDayCard  Boolean @default(true)
  user      User     @relation(fields: [userId], references: [id])
  updatedAt DateTime @updatedAt
}

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
  link        String?            // 相对路径 · 见 §19.1
  icon        String?
  contentHash String?            // 见 §19.10
  createdAt   DateTime @default(now())
  readAt      DateTime?
  revokedAt   DateTime?
  deletedAt   DateTime?
  @@index([userId, createdAt])
  @@index([userId, readAt])
}

model NotificationDispatchLog {
  id         String   @id @default(cuid())
  eventKind  String
  eventId    String
  tier       String
  userId     String
  channel    String   // 'inbox' | 'push' | 'sms' | 'banner'  ← 新增 · 用于频率计数 §19.3
  success    Boolean
  error      String?
  createdAt  DateTime @default(now())
  @@unique([eventKind, eventId, tier, userId, channel])    // 含 channel 防四通道幂等冲突
  @@index([userId, channel, createdAt])                    // 频率计数索引 §19.3
  @@index([createdAt])                                     // GC §19.15
}

model PushSubscription {
  // 改造 · 见 §19.2
  id            String    @id @default(cuid())
  userId        String
  sessionId     String                              // 关联当时登录的 session
  endpoint      String    @unique
  keys          Json                                // p256dh + auth
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  deactivatedAt DateTime?
  @@index([userId, isActive])
}

model NotificationCardAck {
  // critical 公告 + 玻璃文字 dismissal 共用
  userId       String
  eventKind    String
  eventId      String
  kind         String           // 'dismissed' | 'acknowledged'
  contentHash  String?          // 见 §19.10
  createdAt    DateTime @default(now())
  @@unique([userId, eventKind, eventId])
}

model ActiveBanner {
  // 新表 · 见 §19.4 · 服务端化 banner 队列
  id          String   @id @default(cuid())
  userId      String
  eventKind   String
  eventId     String
  tier        String
  severity    String           // 'urgent' | 'critical' | 'achievement'
  title       String
  body        String
  link        String
  contentHash String?
  showCount   Int      @default(0)
  ackedAt     DateTime?
  dismissedAt DateTime?
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  @@index([userId, ackedAt, dismissedAt])
  @@index([expiresAt])
}

// === Push 日志（无 cost 字段）===
model PushDeliveryLog {
  id                  String    @id @default(cuid())
  pushSubscriptionId  String
  userId              String
  status              String    // 'sent' | 'failed' | 'expired'
  error               String?
  sentAt              DateTime  @default(now())
  @@index([userId, sentAt])
}

// === SMS 子系统 ===
model SmsDeliveryLog {
  id              String    @id @default(cuid())
  userId          String
  phoneNumber     String
  countryCode     String
  messageBody     String
  templateName    String?
  status          String    // queued/sent/delivered/failed/undelivered
  providerMsgId   String?
  errorCode       String?
  cost            Decimal?  @db.Decimal(8, 4)
  sentAt          DateTime  @default(now())
  deliveredAt     DateTime?
  @@index([userId, sentAt])
  @@index([countryCode, sentAt])
}

model SmsTemplate {
  id          String   @id @default(cuid())
  name        String   @unique
  language    String
  text        String
  parameters  String[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model SmsBroadcast {
  id                String   @id @default(cuid())
  adminUserId       String
  audienceType      String
  audienceData      Json
  templateName      String?
  customTextZh      String?
  customTextEn      String?
  parameters        Json?
  bypassPreferences Boolean  @default(false)
  scheduledAt       DateTime?
  estimatedCount    Int
  actualSent        Int      @default(0)
  actualCost        Decimal? @db.Decimal(8, 4)
  status            String   @default("draft")
  createdAt         DateTime @default(now())
  startedAt         DateTime?
  completedAt       DateTime?
  admin             User     @relation(fields: [adminUserId], references: [id])
  @@index([adminUserId, createdAt])
  @@index([status, scheduledAt])
}

// === 法会 / 系统活动 ===
model DharmaAssembly {
  id            String    @id @default(cuid())
  title         String
  category      String                            // 'assembly' | 'system_session' | 'memorial'
  startAt       DateTime
  endAt         DateTime
  description   String
  coverImage    String?
  coverTheme    String?                           // 'auto-light' | 'auto-dark' | 'manual-light' | 'manual-dark' (§19.14)
  externalLink  String?
  deletedAt     DateTime?                         // 软删除 · §19.8 调度检查用
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

// === SystemAnnouncement ===
model SystemAnnouncement {
  id          String    @id @default(cuid())
  title       String
  body        String
  severity    String                              // 'normal' | 'urgent' | 'critical'
  expiresAt   DateTime                            // 必填 · 默认 +24h (§19.20)
  revokedAt   DateTime?
  contentHash String?                             // §19.10
  createdBy   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// === 班级公告改造 ===
model ClassAnnouncement {
  ...existing...
  contentHash String?                             // §19.10
  revokedAt   DateTime?
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

## 14. 实施排期（含审计修复 · 总 ~8 周）

| Sprint | 内容 | 含审计修复 | 时长 |
|---|---|---|---|
| S1 | P0 基础（OrphanedFile · 单设备 · feature flag）+ dispatchToUsers 入口（含 link 校验 / shadow 路由 / OTP 例外 / 频率上限 DB 计数 / SW handler link 校验）| B1, B3, H1, H2 · §19.1, §19.3, §19.6, §19.7 | 1 周 |
| S2 | P1 旧事件源接入 + shadow 3 天验证 + PushSubscription 改造（sessionId + isActive）+ 时区智能默认 | B2, M1 · §19.2, §19.13 | 1 周 |
| S3 | P2 新事件源（任务/成就/系统公告/法会/成员）+ 灰度 50% + ContentHash + Achievement 聚合 + 法会删除调度清理 + DispatchLog GC + 撤回兜底页 | H3, H4, H5, M3, S5 · §19.8-19.10, §19.15, §19.19 | 1.5 周 |
| S4 | P3 UI（玻璃文字 + 红点 + Banner + 通知中心）+ ActiveBanner 服务端化 + Cover theme 自动检测 + 通知中心 filter + 玻璃文字溢出 + 优先级排序 | B4, M2, S1, S2, S4 · §19.4, §19.14, §19.18, §19.21-22 | 2 周 |
| S5 | P4 旧路径清理 + **SMS 子系统**（Twilio + 模板 + 广播 UI + webhook 签名 + 改号并发处理 + 预算告警 + critical 触达预估）| B5, H6, H7, M5 · §19.5, §19.11-12, §19.17 | 1.5 周 |
| 缓冲 | bug fix + 文案打磨 + critical 公告 expiresAt 必填 | S3 · §19.20 | 1 周 |
| **合计** | | | **~8 周** |

---

## 15. 灰度发布

| 模式 | 行为 | 用户感知 |
|---|---|---|
| `off` | 全平台 v1 · v2 代码不执行 · **OTP 例外**（独立路径不受影响 §19.7）| v1 体验 |
| `shadow` | v1 完整执行（含 push / sms）· v2 仅 inbox 双写做对比 · **不发 push / sms / banner** 避免重复打扰 | v1 体验 · 后台数据对比 |
| `on` | 按 `user.notificationV2Enabled` 路由：白名单走 v2 · 其它走 v1 | 灰度用户体验 v2 |

**回退**：admin 一键 `SystemConfig.notification_v2_global = 'off'` 全平台秒回 v1。

**Shadow 数据对比指标**：
- v1 vs v2 通知数差异（应 < 1%）
- 同 eventId 在两条路径中的 link / title / body 是否一致
- v2 路径的内部错误率
- 通过对比指标后才进入 `on` 模式

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

## 19. 安全与边界细节（审计修复 · 实施必读）

> 这一节是审计后整合的关键边界处理 · 实施时必须按此执行。

### 19.1 安全 · Link 字段校验（B1）

**前提**：恶意 link（如 `javascript:` URL）传到 SW `clients.openWindow()` 会执行任意脚本。

**双重校验**：

```ts
// 后端 dispatchToUsers 入口
function isValidLink(link: string): boolean {
  if (!link) return false;
  if (link.startsWith('/')) return true;                          // 相对路径 OK
  try {
    const url = new URL(link);
    return url.origin === process.env.APP_ORIGIN;                 // 仅同源绝对 URL
  } catch { return false; }
}

if (!isValidLink(event.link)) throw new Error('invalid link');
```

```js
// SW push handler · 再次校验（防御性 · 假设后端可能漏）
self.addEventListener('notificationclick', (event) => {
  const link = event.notification.data.link;
  const safe = link && link.startsWith('/');                      // SW 仅接受相对路径
  event.waitUntil(/* 用 safe ? link : '/' */);
});
```

后端入口生成 link 时**只生成相对路径**（不要 `https://...`）· SW 仅接受 `/` 开头。

### 19.2 单设备登录 · PushSubscription 清理（B2）

**问题**：旧设备 PushSubscription 残留 → 多设备收 push。

**实施**：
```prisma
model PushSubscription {
  id            String   @id @default(cuid())
  userId        String
  sessionId     String   // 关联当时登录的 session
  endpoint      String   @unique
  keys          Json     // p256dh + auth
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  deactivatedAt DateTime?
  @@index([userId, isActive])
}

// 新登录时（auth.service）
async function login(userId) {
  const newSessionId = await createSession();
  // 1. 软删除旧 session 的所有 push subscription
  await prisma.pushSubscription.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false, deactivatedAt: now() }
  });
  // 2. 更新 user.currentSessionId
  await prisma.user.update({ where: { id: userId }, data: { currentSessionId: newSessionId } });
  return newSessionId;
}

// sendWebPush 前
const subs = await prisma.pushSubscription.findMany({
  where: { userId, isActive: true }
});
```

### 19.3 频率上限 · 数据库计数（B3）

**问题**：PM2 cluster 多 worker · in-memory 计数不准。

**实施**：直接走 NotificationDispatchLog 计数 · 不引 Redis。

```ts
async function getHourlyPushCount(userId: string): Promise<number> {
  return await prisma.notificationDispatchLog.count({
    where: {
      userId,
      success: true,
      channel: 'push',
      createdAt: { gt: new Date(Date.now() - 3600_000) }
    }
  });
}
```

需要在 `NotificationDispatchLog` 加 `channel` 字段区分 push / sms / banner。

### 19.4 Banner 服务端化（B4）

**问题**：critical banner 未 ack 时 · 用户关 app 后队列丢失。

**实施**：banner 数据源是服务端 · 不依赖前端 in-memory。

```prisma
model ActiveBanner {
  id          String   @id @default(cuid())
  userId      String
  eventKind   String
  eventId     String
  tier        String
  severity    String   // 'urgent' | 'critical' | 'achievement'
  title       String
  body        String
  link        String
  contentHash String?
  
  showCount   Int      @default(0)        // 已展示次数
  ackedAt     DateTime?                   // critical 用 · ack 后填
  dismissedAt DateTime?                   // 用户手动关
  expiresAt   DateTime?                   // urgent 8s · critical 永久（直到 ack 或 admin 撤回）
  
  createdAt   DateTime @default(now())
  
  @@index([userId, ackedAt, dismissedAt])
}
```

**前端**：
```
进 app → GET /api/me/active-banners
  → 拿到 pending（未 ack / 未 dismiss / 未过期）的 banner 列表
  → 前端按 severity 排序 · 依次显示
SW push 到达 → POST 端写 ActiveBanner + push invalidate → 前端 refetch
critical ack 点击 → POST /api/me/active-banners/:id/ack → ackedAt 写入
```

**Push handler 改造**：
```js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  // 1. 仍可弹系统通知（如果后台）
  // 2. 通知所有窗口 invalidate active-banners + notifications query
  event.waitUntil(
    self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ 
        type: 'invalidate', 
        scopes: data.scopes 
      }));
    })
  );
});
```

### 19.5 Critical SMS 触达预估（B5）

**问题**：admin 发 critical · 不知道多少用户未绑手机。

**实施**：admin 发布 critical SystemAnnouncement 前显示触达预估：

```
admin 点「发布 critical 公告」 → 弹预估对话框：
┌──────────────────────────────╮
│ 目标用户：1000                  │
│                                │
│ 触达分布：                       │
│  Push 可达：920（已授权）        │
│  SMS 可达：300（已绑手机）       │
│  仅站内：80（无 push 无手机）    │
│                                │
│ SMS 预估成本：$22（按国家分布）  │
│                                │
│ [取消]    [确认发布]            │
╰──────────────────────────────╯
```

API：`GET /api/admin/announcements/reachability?userIds=...` 返回分布。

### 19.6 Shadow 模式行为定义（H1）

**问题**：shadow 模式下 push / SMS 双发会重复打扰。

**实施**：dispatchToUsers 入口分发逻辑：

```ts
async function dispatchToUsers(event) {
  const globalMode = await getSystemConfig('notification_v2_global');
  
  if (globalMode === 'off') {
    // 全平台仅 v1 · v2 完全不执行
    return await dispatchV1(event);
  }
  
  if (globalMode === 'shadow') {
    // v1 正常执行（含 push + sms）· v2 仅 inbox 双写做对比
    await Promise.all([
      dispatchV1(event),
      writeNotificationsV2Shadow(event)  // 只写 inbox · 不发 push / sms / banner
    ]);
    return;
  }
  
  // mode === 'on'
  for (const userId of event.userIds) {
    const user = await getUser(userId);
    if (user.notificationV2Enabled) {
      await dispatchV2(event, user);
    } else {
      await dispatchV1(event, user);
    }
  }
}
```

### 19.7 全局 off 时 OTP 例外（H2）

**问题**：`global = 'off'` 时是否禁 OTP？

**实施**：OTP 走独立路径 · 不受 global flag 影响。

```ts
// SMS 服务分两路
async function sendBusinessSms(...) {                              // 受 flag 控制
  if (await getSystemConfig('notification_v2_global') === 'off') return false;
  return await sendTwilioSms(...);
}

async function sendOtpSms(...) {                                   // 不受 flag 控制（安全相关）
  return await sendTwilioSms(...);
}
```

### 19.8 法会删除清理调度 SMS（H3）

**问题**：法会被 admin 删除 · 已调度的 T-24h SMS 仍发。

**实施**：SMS 调度 job 执行前重新 fetch：

```ts
// BullMQ worker
async function processDelayedAssemblySms(jobData) {
  const assembly = await prisma.dharmaAssembly.findUnique({
    where: { id: jobData.assemblyId }
  });
  
  // 法会已删 / 已取消 → 跳过
  if (!assembly || assembly.deletedAt) {
    logger.info('Assembly cancelled, skipping SMS', { id: jobData.assemblyId });
    return;
  }
  
  // 法会改时间 · 与原调度时刻不再是 T-24h → 跳过（业务变了不重发）
  if (Math.abs(assembly.startAt - new Date()) > 25 * 3600_000) return;
  
  await sendBusinessSms(/* ... */);
}
```

同样适用于：共修取消 / 任务删除 / 公告撤回 等场景。

### 19.9 Achievement 5 分钟聚合（H4）

**实施**：
```ts
// 业务事件触发成就解锁
async function onAchievementUnlocked(userId, achievementId) {
  // 检查 5min 内是否有未发的聚合 job
  const pendingJob = await getPendingAchievementJob(userId);
  if (pendingJob) {
    // 加入现有聚合
    await addAchievementToJob(pendingJob, achievementId);
  } else {
    // 创建延迟 job（5 分钟后执行）
    await queue.add('flush-achievements', { userId, achievementIds: [achievementId] }, 
                    { delay: 5 * 60 * 1000 });
  }
}

// Flush job
async function flushAchievements({ userId, achievementIds }) {
  const achievements = await prisma.achievement.findMany({
    where: { id: { in: achievementIds } }
  });
  
  if (achievements.length === 1) {
    // 单条
    await dispatchToUsers({
      kind: 'achievement',
      title: `🎉 解锁成就「${achievements[0].title}」`,
      ...
    });
  } else {
    // 聚合
    const titles = achievements.slice(0, 3).map(a => a.title).join(' · ');
    const more = achievements.length > 3 ? ` 等 ${achievements.length} 个` : '';
    await dispatchToUsers({
      kind: 'achievement',
      title: `🎉 解锁 ${achievements.length} 个成就`,
      body: `${titles}${more}`,
      link: '/profile/achievements',  // 多个不带 highlight
      ...
    });
  }
}
```

### 19.10 ContentHash 实现（H5）

**实施**：
```ts
// utils/content-hash.ts
import { createHash } from 'crypto';

export function computeContentHash(payload: Record<string, any>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// 公告 update 时
async function updateAnnouncement(id, data) {
  const newHash = computeContentHash({ title: data.title, body: data.body });
  await prisma.classAnnouncement.update({
    where: { id },
    data: { ...data, contentHash: newHash }
  });
  // 推 invalidate · 让所有用户重新评估 dismissal
  await pushInvalidate(['announcements', 'home']);
}

// dismissal 检查
async function isDismissed(userId, announcement) {
  const dismissal = await prisma.notificationCardAck.findUnique({
    where: { userId_eventKind_eventId: { ... } }
  });
  if (!dismissal) return false;
  // 内容变化 → dismissal 失效
  return dismissal.contentHash === announcement.contentHash;
}
```

`Notification` 表也存 `contentHash` · 用户在通知中心查看时对比当前内容 · 显示「内容已更新」标记。

### 19.11 Twilio Webhook 签名验证（H6）

```ts
import twilio from 'twilio';

app.post('/api/sms/webhook/twilio-status', (req, res) => {
  const signature = req.headers['x-twilio-signature'] as string;
  const url = `${process.env.API_BASE}/api/sms/webhook/twilio-status`;
  
  const isValid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    req.body
  );
  
  if (!isValid) {
    return res.status(403).send('Invalid signature');
  }
  
  // 处理 webhook ...
});
```

同样应用到 STOP 入站消息 webhook。

### 19.12 改号期间并发 SMS（H7）

**实施**：SMS job 发送前实时 fetch · 不用 job 创建时的快照。

```ts
async function processSmsJob({ userId, eventId, eventKind, tier, templateName, params }) {
  // 实时 fetch · 不用 job 创建时缓存的号码
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user.phoneNumber || !user.phoneVerifiedAt) {
    logger.info('Phone removed/unverified, skipping SMS', { userId });
    return;
  }
  
  await sendTwilioSms(user.phoneNumber, ...);
}

// 用户改号 endpoint
async function changePhone(userId, newPhone) {
  await prisma.$transaction([
    // 1. 先暂时清空号码（防止改号过程中 SMS 发到旧号）
    prisma.user.update({ where: { id: userId }, data: { phoneNumber: null, phoneVerifiedAt: null } }),
    // 2. 取消该用户所有 pending SMS jobs
    cancelPendingSmsJobs(userId),
    // 3. 写新号 + 触发新 OTP
    prisma.user.update({ where: { id: userId }, data: { phoneNumber: newPhone } }),
    sendOtpSms(newPhone, otp),
  ]);
}
```

### 19.13 时区智能默认（M1）

```ts
// 注册 / 手机绑定时
async function getDefaultTimezone(request): string {
  // 1. 优先：Accept-Language 头
  const lang = request.headers['accept-language'];
  if (lang?.startsWith('zh-CN')) return 'Asia/Shanghai';
  if (lang?.startsWith('zh-TW')) return 'Asia/Taipei';
  if (lang?.startsWith('zh-HK')) return 'Asia/Hong_Kong';
  if (lang?.startsWith('en-US')) return 'America/Los_Angeles';
  
  // 2. 次优：IP geolocation（用 Cloudflare CF-IPCountry header 或 MaxMind）
  const country = request.headers['cf-ipcountry'];
  return countryToTimezone(country) || 'Asia/Shanghai';
}
```

设置页醒目显示当前时区 · 配「自动检测」按钮可重新探测。

### 19.14 Cover Theme 自动检测（M2）

```ts
// 上传时 sharp 分析
import sharp from 'sharp';

async function detectCoverTheme(buffer: Buffer): Promise<'light' | 'dark'> {
  const { data } = await sharp(buffer)
    .resize(50, 50)
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  let sum = 0;
  for (let i = 0; i < data.length; i += 3) {
    // RGB → 亮度
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const avgLuminance = sum / (data.length / 3);
  return avgLuminance > 128 ? 'light' : 'dark';
}
```

admin 上传时自动算并存 `theme: 'auto-light' | 'auto-dark' | 'manual-light' | 'manual-dark'` · 允许 admin override。

### 19.15 NotificationDispatchLog GC（M3）

```ts
// 业务驱动 + cron 兜底
async function gcDispatchLogs() {
  const cutoff = new Date(Date.now() - 90 * 24 * 3600_000);
  await prisma.notificationDispatchLog.deleteMany({
    where: { createdAt: { lt: cutoff } }
  });
}

// 触发：
// - juexue-api 启动时（pm2 reload）
// - 每日凌晨 cron（用 @fastify/schedule · 不引独立 cron 进程）
```

### 19.16 Push tag 替换的站内呼应（M4）

**实施**：T-30 / T-5 / T-0 在通知中心仍为独立条目 · 但 UI 加视觉关联：

```
通知中心列表：
─ 共修进行中 · 班级·初心一组（T-0）   ← 最新
└─（点击展开）3 条相关
   ─ 共修即将开始（T-5）              ← 灰色
   ─ 30 分钟后开始（T-30）            ← 灰色

未读数计算：3 条相关算 1 条（避免角标膨胀）
```

实现细节后期 UX 评审 · 默认按 3 条独立显示也 OK。

### 19.17 Critical SMS 预算超额告警（M5）

```ts
async function shouldSendSms(event, user) {
  // critical 不受预算上限
  // 但发送前检查月度成本 · 超 80% 触发告警
  if (event.severity === 'critical') {
    const monthlyCost = await getMonthlyCostUSD();
    if (monthlyCost > MAX_MONTHLY_BUDGET * 0.8) {
      await alertAdmin({
        type: 'sms_budget_warning',
        monthlyCost,
        budget: MAX_MONTHLY_BUDGET,
      });
    }
    if (monthlyCost > MAX_MONTHLY_BUDGET) {
      await alertAdmin({ type: 'sms_budget_exceeded', monthlyCost, budget: MAX_MONTHLY_BUDGET });
      // critical 仍发 · 但记日志
    }
    return await passOtherFilters(event, user);
  }
  // 非 critical · 走标准过滤（含预算上限）
}
```

Admin 后台 `/admin/sms` 实时显示「本月消费 $X / 预算 $Y · 进度条」。

### 19.18 通知中心 filter 参数（S2）

API 扩展：

```ts
GET /api/me/notifications?filter=class_announcement,system_announcement
  &cursor=...
  &limit=30
  &includeRevoked=true            // 默认 true · 撤回的也返回（置灰显示）

// 服务端
const filterKinds = filter?.split(',') ?? null;
const where = {
  userId,
  ...(filterKinds && { eventKind: { in: filterKinds } }),
};
```

### 19.19 撤回内容兜底页（S5）

所有目标页 mount 时统一检查：

```ts
// 通用 hook
export function useEntityOrRevoked(id, fetchFn) {
  const { data, error } = useQuery({ queryKey: [id], queryFn: fetchFn });
  
  if (error?.status === 404) {
    return <NotFoundPage />;
  }
  if (data?.revokedAt) {
    return <RevokedPage entity={data} />;
  }
  if (error?.status === 403) {
    return <ForbiddenPage />;
  }
  return null;  // 渲染正常 UI
}
```

新增页面：
- `/error/not-found` · 「该内容已不存在 · 5 秒后跳首页」
- `/error/forbidden` · 「你没有权限查看」
- `/error/revoked` · 「该内容已被撤回 · `[返回首页]`」

### 19.20 critical 公告 expiresAt 必填 + 默认（S3）

```ts
// admin 后台表单
const expiresAt = formData.expiresAt ?? addHours(new Date(), 24);
```

UI 提示「不填默认 24 小时后失效」+ 强制 validate。

### 19.21 玻璃文字字数溢出（S1）

```css
.glass-info-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
```

移动端 < 480px：字号 12px · 间距收紧。

### 19.22 玻璃文字优先级（S4）

法会期间排序（自上而下）：
1. 🪷 法会进行中（如有）
2. 下次共修（如有）
3. 今日任务（如有）
4. 最新公告（如有）
5. 🪷 藏历加持日（如当日有 · 且用户偏好开）

法会一行优先 · 其它按重要度。每行独立显隐。

---

## 20. 已知限制

1. **不支持多设备同时登录**（产品决策）· 数据全部云端 · 换设备恢复
2. **不支持深色模式**（暂不规划）
3. **SMS 暂不支持国际号码外的语言**（仅 zh-CN + en）
4. **首页玻璃文字暂按单班假设**（多班场景 v2 迭代）
5. **法会无 app 内入口**（信息型 · 外部链接直跳 Zoom 等）

---

文档维护：每次架构变更同步更新此文档 · 同时在 commit message 注明变更点。
