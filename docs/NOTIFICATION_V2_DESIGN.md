# 觉学 · 通知系统 v2 完整设计（模块化）

> 状态：✅ 设计已定稿（2026-05-14）· **9 模块 28 个开放问题**全部落决策 · 待进入实施排期
>
> 关联：`NOTIFICATION_PLAN.md`（v1 框架）· `PERSONAL_REMINDERS_V1.md`（个人提醒 v1 已交付）
>
> 维护规则：每次和用户讨论一个模块 · 落定即更新对应章节的"决策"段 · 未决问题记在"开放问题"段。

---

## 0. 背景 · 为什么有 v2

### 0.1 v1 已交付（commit `280cfaf` 及后续）

- 个人提醒三档（19:00 临期 / 20:00 日报 / 周一 08:00 周报）
- Web Push 基础设施（VAPID + PushSubscription + SW）
- 站内 Notification 表 + 通知中心 UI
- 三层时段配置（user / platform / 代码）
- 静默时段（默认 22:00 - 07:00）
- NotificationDispatchLog 去重幂等
- ClassSession T-30/T-5/T0 调度推送
- 班级公告写 Notification 表

### 0.2 v1 漏什么 → v2 要补

- ❌ 首页 UpcomingEventCard 前端组件
- ❌ 多源仲裁（公告/共修/法会/成就/藏历日 谁该上首页卡）
- ❌ Severity 三档（normal / urgent / critical）
- ❌ 班级公告 push 通道（只写了站内 · 没推送）
- ❌ 班级修学任务 0 通知（连站内都没写）
- ❌ 班级共修首次创建 0 通知（只有 T-30 后才提醒）
- ❌ 成就解锁 0 通知（既没站内也没 push）
- ❌ 全局每日 push 上限 3 条（NOTIFICATION_PLAN 决策 #7）
- ❌ 多设备协调（一台 ack 其他同步）
- ❌ NotificationCardAck 表（用户已读 · 卡片不重复冒）
- ❌ recurrence 重复事件（每周三共修）→ **v2 M12 已纳入**
- ❌ DharmaAssembly 法会模型 → **v2 M12 已纳入**
- ❌ iOS Safari Web Push 真机验证
- ❌ PWA 安装引导

### 0.3 不在 v2 范围（独立 Phase）

- Email 通道（Resend）→ Phase 2
- SMS（Twilio）→ Phase 3 · TCPA opt-in 流程独立
- Voice Call → v4 远期
- Coach 周报 → v2 后再说
- AI 文案 / 行为驱动触发 → v3 智能化方向（不在本设计范围）

---

## 1. 架构分层（v2 目标态）

```
┌─ 事件源（Event Source）· 8 类 ──────────────────┐
│  ① ClassSession（共修）创建 / 改时 / T-30/5/0 调度  │
│  ② ClassAnnouncement（班级公告）                    │
│  ③ PracticeTask（班级修学任务）创建 / 截止          │
│  ④ Personal Reminder（临期/日报/周报）· v1 已通     │
│  ⑤ Achievement（成就解锁）                          │
│  ⑥ SystemAnnouncement（admin 全平台公告）          │
│  ⑦ DharmaAssembly（法会 · v2.5）                   │
│  ⑧ AuspiciousDay（藏历加持日）                     │
└────────────┬────────────────────────────────────┘
             ↓
   ┌─ 仲裁层（Arbitration）─────────────┐
   │ Severity: critical > urgent > normal│
   │ 时间近 > 时间远（同 severity 内）   │
   │ NotificationCardAck 过滤已读        │
   └────────┬───────────────────────────┘
            ↓
   ┌─ 通道层（Channels）─────────────────┐
   │ ✅ 站内 Notification（默认必发）    │
   │ ✅ Web Push（按 severity + 静默 + 全局上限路由）│
   │ ✅ 首页 UpcomingEventCard（仲裁后 top-1）│
   │ ⏸ Email（Phase 2）                  │
   │ ⏸ SMS（Phase 3）                    │
   └────────┬───────────────────────────┘
            ↓
   ┌─ 用户层 ────────────────────────────┐
   │ /settings/notifications 偏好（per-type toggle + quiet hours + timezone）│
   │ /admin/notification-rules 平台默认 │
   └─────────────────────────────────────┘
```

---

## 2. 模块清单（11 个 · 每个独立设计）

| # | 模块 | 类型 | 当前状态 | 工期估 |
|---|---|---|---|---|
| **M1** | Web Push 通道加固 | 通道 | 🟡 基建就位 · 缺护栏 | 1 天 |
| **M2** | 站内 Notification 补全事件源 | 通道 + 事件 | 🟡 部分通 | 1.5 天 |
| **M3** | UpcomingEventCard 前端组件 | UI | ❌ 0% | 1 天 |
| **M4** | 多源仲裁 logic | 横切 | 🟡 接口在 · logic v1 占位 | 1 天 |
| **M5** | Severity 字段 + 三档样式 | 横切 | ❌ | 1 天 |
| **M6** | NotificationCardAck（已读 / 不重冒） | 横切 | ❌ | 0.5 天 |
| **M7** | 全局每日 3 条 push 上限 | 横切 | ❌ | 0.5 天 |
| **M8** | 班级公告 push 联动 | 事件源 | 🟡 站内通 · push 未接 | 0.5 天 |
| **M9** | 班级共修首发通知 | 事件源 | ❌ createSession 不发通知 | 0.5 天 |
| **M10** | 班级修学任务通知 | 事件源 | ❌ 完全 0 | 0.5 天 |
| **M11** | 成就解锁通知 | 事件源 | ❌ 完全 0 | 0.5 天 |
| **合计** | | | | **~9 天** |

> **v2.5（可选 · 看用户量决定）**：M12 重复事件 recurrence + M13 DharmaAssembly 法会 = ~5 天

---

## 3. 模块详细设计（discussion 落档）

> 每个模块章节结构：现状 / 目标 / 设计 / 开放问题 / 决策

---

### M1 · Web Push 通道加固

#### 现状
- VAPID + PushSubscription 表 ✅
- `sendPushToUsers(userIds, payload)` ✅
- SW 收到 push → `showNotification` ✅
- `/settings` PushToggle ✅

#### 目标
- 真上线就绪（iOS 真机测过 / 失败重试 / 退订自愈）
- PWA 引导用户安装 + 授权

#### 设计
- 失败 410 (Gone) 自动删除 PushSubscription · 已实现 ✓
- 失败 5xx 重试 3 次（每次间隔 2 / 4 / 8s）· **待加**
- iOS Safari 16.4+：要求"添加到主屏幕"后才能收到 web push · 引导文案 + 设备检测 · **待加**
- 桌面 Chrome / Edge：直接走 web push · 不需要 PWA · 现有 OK

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M1.Q1 | PWA 引导触发时机？ | ✅ **B · 按需提示** · 用户点 push toggle 授权时 · 检测 iOS Safari + 未装 PWA → 弹引导 sheet · 不打扰首访体验 |
| M1.Q2 | iOS Safari 没装 PWA 怎么办？ | ✅ **A · 显示提示** · push toggle 仍在但置灰 · 下方提示 "iOS 需先 [添加到主屏幕] · [查看教程 →]" · 不隐藏可能性 |

#### 决策

#### 检测逻辑

```ts
function isIosSafariWithoutPwa(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
  return isIos && isSafari && !isStandalone;
}
```

#### 引导 sheet 内容（zh-CN）

> **iOS 接收推送 · 需添加到主屏幕**
> 1. 点底部分享按钮 ⬆️
> 2. 选「添加到主屏幕」
> 3. 从主屏幕图标打开觉学
> 4. 再次开启推送即可
>
> [我知道了] · [跳过]

#### 桌面 fallback

桌面 Chrome / Edge：直接 PushManager.subscribe() · 不需要 PWA · 现有方案已 OK · 不动。

---

### M2 · 站内 Notification 补全事件源

#### 现状
- Notification 表 ✅
- /notifications 通知中心 ✅
- 6 种 type：system / class_announcement / class_session / class_session_soon / achievement / reminder
- 实际接通：班级公告 ✅ / 共修调度 ✅ / 个人提醒 ✅
- 未接通：班级任务 ❌ / 共修首次创建 ❌ / 成就 ❌ / 系统公告（admin UI 没有）❌

#### 目标
所有 8 类事件源都写 Notification（用户至少能在通知中心看到）。

#### 设计
- 不改 Notification 表结构 · 仅在事件源 service 末尾调 `dispatchToUsers`
- 复用现有 `dispatch.ts` · 给每事件源选合适 `eventKind` + type
- fire-and-forget · 不阻塞主创建 · 失败仅 log

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M2.Q1 | 系统公告 admin UI 在哪建？ | ✅ **A · /admin/notification-rules 加 tab "系统公告"** · UI 集中 · 与推送规则同页 |
| M2.Q2 | 系统公告是单条还是批量？ | ✅ **A · 全员 active 用户** · v2 起步不做筛选 · 跨语言文案先以 zh-CN 为主 + 后续可加 i18n 字段 |

#### admin tab 实现

```tsx
// /admin/notification-rules 页加 tab
<Tabs defaultValue="rules">
  <TabsList>
    <TabsTrigger value="rules">推送规则</TabsTrigger>
    <TabsTrigger value="announcements">系统公告</TabsTrigger>
  </TabsList>
  <TabsContent value="announcements">
    <SystemAnnouncementForm />  {/* 标题 + 正文 + severity + [发布] */}
    <SystemAnnouncementList />   {/* 历史发布记录 + 撤回 */}
  </TabsContent>
</Tabs>
```

新表（轻量 · 不复用 ClassAnnouncement）：
```prisma
model SystemAnnouncement {
  id        String   @id @default(cuid())
  title     String
  body      String
  severity  Severity @default(normal)
  publishedAt DateTime @default(now())
  publishedBy String
  revokedAt DateTime?
  @@index([publishedAt])
}
```

发布动作：写表 → dispatchToUsers(全员 active) → eventKind: 'system_announcement'。

---

### M3 · UpcomingEventCard 前端组件

#### 现状
- 后端 `/api/my/top-home-card` ✅
- 前端 hook `useTopHomeCard` ✅
- 组件 ❌
- HomePage 集成 ❌

#### 目标
学员进首页 · 顶部看到当下最重要的事件 / 提醒（仅 1 张卡 · 已仲裁）。

#### 设计

视觉规格三态：

```
[normal · 默认]
┌────────────────────────────────┐
│ 📅 前行 1 班 · 周三晚共修       │
│ 30 分钟后开始 · 19:00           │
│ [ 进入直播 ]    [ 知道了 ]      │
└────────────────────────────────┘
样式：默认玻璃卡 · 主色 saffron

[urgent · 加亮]
┌────────────────────────────────┐
│ ⚡ 莲师荟供日 · 功德 ×九亿倍   │
│ 上修一座 + 念诵 21 遍最佳       │
│ [ 去念诵 ]                      │
└────────────────────────────────┘
样式：金色背景 + saffron 描边

[critical · 警示]
┌════════════════════════════════┐
║ ⚠️ 临时通知                    ║
║ 今晚 8 点共修因风暴取消        ║
║ [ 知道了 ]                      ║
└════════════════════════════════┘
样式：crimson 边框 + 浅红背景
```

行为：
- 60s 自动 refetch
- 点 [知道了] → ack API → 卡片消失（直到下一个事件命中）
- 点主 CTA（进入直播 / 去念诵 / 知道了）→ 跳详情页 · 自动 ack
- 无事件 → 整个组件不渲染（不占空间）

放在 HomePage 哪里：
- 候选 A：顶部 hero 下面 · 优先级最高
- 候选 B：NotificationBell 下方
- 候选 C：4 大卡片之间

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M3.Q1 | 放在 HomePage 哪个位置？ | ✅ **B · NotificationBell 下** · 浮在画报上方 · 不遮主体 |
| M3.Q2 | 卡片有多少 CTA？ | ✅ **C · 视 severity 而定** · normal/urgent: 主 CTA + [知道了] · critical: 仅 [知道了]（防误点）|
| M3.Q3 | 多事件时显示几条？ | ✅ **A · 仅 top-1** · 其余走通知中心 · 首页保持画报禅意 |

#### CTA 细则

| severity | 主 CTA | 次 CTA | ack 时机 |
|---|---|---|---|
| normal | [进入直播] / [去念诵] / [去做题] | [知道了] | 点任意按钮 |
| urgent | 同上 · 金色描边 | [知道了] | 点任意按钮 |
| critical | ❌ 无主 CTA | [知道了] | 仅次 CTA · 防误触跳走 |

#### 集成位置（实施细节）

```tsx
// HomePage.tsx · NotificationBell 下方插入
<NotificationBell unread={unreadNotifs} />
<UpcomingEventCard />   // 无事件时返回 null · 不占空间
```

样式上限：占首页画报顶部 ≤ 25% 高度 · maxWidth 与 4 大卡对齐 · 自带退出动画（ack 后 fade out 200ms）。

---

### M4 · 多源仲裁 logic

#### 现状
- `getMyTopHomeCard` 接口已埋
- 内部 logic 是 v1 占位（仅 ClassSession · 时间近的赢）

#### 目标
真正多源仲裁 · 输入 8 类事件源 · 输出 top-1（或 top-N）。

#### 设计

```ts
// 伪代码
async function getMyTopHomeCard(userId) {
  const candidates = [
    ...getActiveClassSessions(userId),       // 共修
    ...getActiveAnnouncements(userId),       // 班级公告
    ...getActivePracticeTasks(userId),       // 班级任务（截止前 24h）
    ...getActiveAchievements(userId),        // 成就（24h 内解锁未 ack）
    ...getActiveAuspiciousDays(userId),      // 藏历加持日（今日）
    ...getActiveAssemblies(userId),          // 法会 daily window (v2.5)
    ...getActiveSystemAnnouncements(userId), // admin 系统公告
    // 个人提醒不进首页卡（仅 push + 通知中心）· 见决策
  ];
  
  // 过滤已 ack（editVersion / ackVersion 匹配的）
  const filtered = candidates.filter(c => !isAcked(c, userId));
  if (filtered.length === 0) return null;
  
  // 排序
  filtered.sort((a, b) => {
    if (severityRank(a) !== severityRank(b))
      return severityRank(b) - severityRank(a);  // critical > urgent > normal
    if (a.startAt && b.startAt)
      return a.startAt - b.startAt;              // 时间近优先
    return kindRank(a) - kindRank(b);            // fallback
  });
  
  return filtered[0];
}
```

#### 决策

| ID | 问题 | 结论 |
|---|---|---|
| M4.Q1 | 个人提醒进首页卡？ | ✅ **不进** · 个人提醒仅走 push + 通知中心 · 首页卡只留给老师/班级事件 · 避免被动事件占领首页 |
| M4.Q2 | 同 severity 同时间 tiebreaker？ | ✅ **kindRank 硬排序** · 班级公告 > 共修 > 任务 > 成就 > 藏历日 > 系统公告 · 可预测稳定 |
| M4.Q3 | 仲裁结果缓存？ | ✅ **不缓存 · 每次实时算** · 接口调用频率受 React Query 60s staleTime 节制 · ack 后立即生效 |

#### kindRank 定义

```ts
const KIND_RANK: Record<EventKind, number> = {
  classAnnouncement: 10,  // 班级公告
  dharmaAssembly:    15,  // 法会进行中（M12）· 高于普通 session
  classSession:      20,  // 共修
  practiceTask:      30,  // 修学任务
  achievement:       40,  // 成就解锁
  auspiciousDay:     50,  // 藏历加持日
  systemAnnouncement: 60, // 系统公告（admin）
};
// 排序：severity desc > startAt asc > kindRank asc（小的赢）
```

---

### M5 · Severity 字段 + 三档样式

#### 现状
- ❌ 没有 severity 字段
- 共修 T-0 / T-5 / T-30 三档其实是隐式 severity

#### 目标
所有事件源加 severity 字段 · UI 按 severity 染色。

#### 设计

schema 加 enum：
```prisma
enum Severity {
  normal     // 默认
  urgent     // 重要 · 加亮
  critical   // 紧急 · 警示
}
```

每个事件源加 `severity Severity @default(normal)` 字段：
- ClassSession
- ClassAnnouncement
- PracticeTask
- DharmaAssembly（v2.5）
- SystemAnnouncement

成就 / 藏历日 / 个人提醒固定 normal · 不加字段。

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M5.Q1 | severity 是辅导员手动勾选还是系统判定？ | A. 都手动；B. 都自动（如 endAt < 24h → urgent）；C. 混合 |
| M5.Q2 | critical 谁能发？ | A. 仅 admin；B. admin + 班级 coach；C. 全员（不限制 · 滥用问题靠教育）|
| M5.Q3 | 共修 T-0 / T-5 / T-30 算什么 severity？ | A. T-0 → critical / T-5 → urgent / T-30 → normal；B. 全部 normal · 时间近自然排前 |

---

### M6 · NotificationCardAck（已读 / 不重冒）

#### 现状
- ❌ 没有 ack 表
- 现有 ClassSession.editVersion ✅（基础设施埋好但客户端没真存 ack）

#### 目标
用户点 [知道了] 后该事件不再上卡片 · 直到事件改动（editVersion+1）后重新冒出。

#### 设计

新表：
```prisma
model NotificationCardAck {
  id           String   @id @default(cuid())
  userId       String
  eventKind    String   // 'class_session' | 'announcement' | 'task' | 'achievement' | ...
  eventId      String
  ackedVersion Int      @default(1)  // 对应事件的 editVersion
  ackedAt      DateTime @default(now())
  
  @@unique([userId, eventKind, eventId])
  @@index([userId, ackedAt])
}
```

API：
- `POST /api/my/card-ack` body: `{ eventKind, eventId, version }`
- 仲裁 query 时 LEFT JOIN ack · 过滤 `ack.version === event.version` 的

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M6.Q1 | ack 过期吗？ | A. 不过期 · 永久；B. 30 天后过期重新冒；C. 事件结束后 ack 自动清 |
| M6.Q2 | 多设备 ack 同步？ | A. 后端表自然同步（任一设备 ack 全部失效）；B. 每端独立 ack |

---

### M7 · 全局每日 3 条 push 上限

#### 现状
- ❌ 仅 DispatchLog 单事件去重 · 无全局限流

#### 目标
单用户单日 push 总数 ≤ 3 · 防风暴 · NOTIFICATION_PLAN 决策 #7。

#### 设计

dispatch 前查：
```ts
async function canSendPush(userId): Promise<boolean> {
  const todayStart = startOfLocalDay(userId);
  const count = await prisma.notificationDispatchLog.count({
    where: {
      userId,
      pushedAt: { gte: todayStart },
      // 仅算真发 push 的（注：DispatchLog 不区分 push vs inapp · 需加字段）
    },
  });
  return count < 3;
}
```

注意：当前 DispatchLog 不区分通道（push 还是 inapp）· 要么改表加字段 `channel`，要么用其他表（NotificationLog）专门记 push 送达。

#### 决策

| ID | 问题 | 结论 |
|---|---|---|
| M7.Q1 | 用什么记 push 计数？ | ✅ **DispatchLog 加 `channel` 字段** · 'inapp' / 'push' / 'email' / 'sms' · 不新增表 · count where channel='push' |
| M7.Q2 | critical 算上限吗？ | ✅ **critical 绕过上限** · 与 M5 决策一致 · critical = 真紧急 · 静默 + 上限都不拦 |
| M7.Q3 | 用户能调上限吗？ | ✅ **不能 · 系统硬限 3 条** · 保底产品级约束 · NOTIFICATION_PLAN #7 原话 · 不给偏好页 slider |

#### 字段 migration

```prisma
model NotificationDispatchLog {
  // ... 现有字段
  channel String @default("inapp") // 'inapp' | 'push' | 'email' | 'sms'
  @@index([userId, channel, pushedAt])  // 查 daily push count 用
}
```

`canSendPush` 内仅 count `channel='push' AND severity != 'critical'` (或允许 critical 总是 return true · 不查表)。

---

### M8 · 班级公告 push 联动

#### 现状
- 写 Notification ✅
- 调 sendPushToUsers ❌

#### 目标
辅导员发公告 → 班级学员收到 push（受 severity / 静默 / 上限约束）。

#### 设计

在 `announcements/service.ts` 的 `notifyClassMembers` 末尾加 push dispatch：
```ts
async function notifyClassMembers(classId, className, title, announcementId, severity = 'normal') {
  // ... 现有写 Notification 逻辑
  
  // v2 新加：dispatch push
  await dispatchToUsers({
    prisma, eventKind: 'class_announcement', eventId: announcementId,
    tier: '-', userIds, severity,
    title: `《${className}》新公告`,
    body: title,
    link: `/class/${classId}`,
    notificationType: 'class_announcement',
  });
}
```

dispatchToUsers 内部按 severity 决定要不要绕过静默 / 是否走全局上限。

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M8.Q1 | 公告默认 severity？ | ✅ **A · normal + 重要勾选 → urgent** · critical 由 admin 通道走系统公告 · 不开放给 coach |
| M8.Q2 | 编辑公告触发新 push 吗？ | ✅ **A · 不触发 · 仅首发推** · editVersion+1 让首页卡重新冒（已 ack 失效）· 但不发 push · 防风暴 |

#### 重要事故场景

**公告写错了怎么补救？** 老师有三条路径：
1. 撤回原公告 + 发新公告（语义清晰 · 学员看到 "已撤回"）
2. 编辑文本 + 在班级群口头通知（依赖班级群运营 · 不依赖 push）
3. 删公告后另发 · 影响小

---

### M9 · 班级共修首发通知

#### 现状
- ✅ T-30/T-5/T0 调度 push
- ❌ createSession 时无任何通知（学员要等 T-30 后才知道有共修）

#### 目标
辅导员排一场共修 → 班里学员立刻收到通知（"老师排了周三晚共修"）。

#### 设计

`createSession` 末尾加：
```ts
await dispatchToUsers({
  eventKind: 'class_session', eventId: session.id,
  tier: 'created',  // 区别于 T-30/T-5/T0 的调度推送
  userIds: classMembers,
  severity: 'normal',
  title: `《${className}》新共修`,
  body: `${session.title} · ${formatTime(session.startAt)}`,
  link: `/class/${classId}/sessions`,
  notificationType: 'class_session',
});
```

注意：tier 用 `'created'` 区分 · 防止和 T-30 等去重撞 unique 索引。

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M9.Q1 | session 改时间是否再发？ | ✅ **B · 发变更通知 · severity 上调 urgent** · 文案 "《XX 班》共修时间调整为 YY" · 走 push（绕静默不绕上限）|
| M9.Q2 | session 取消是否通知？ | ✅ **B · 发 critical 取消通知** · 绕静默 + 绕上限 · 文案 "《XX 班》今晚共修取消" · 防学员白跑 |

#### tier 分桶（防 dispatch_log unique 撞）

| tier | 用途 |
|---|---|
| `created` | 首发 · session 排出来时 |
| `time_changed` | 改时间触发 |
| `cancelled` | 取消触发 |
| `t30` / `t5` / `t0` | 调度提醒（现有）|

unique 索引 `(eventKind, eventId, tier, userId)` 保证每个 tier 每用户只发一次。

---

### M10 · 班级修学任务通知

#### 现状
- ❌ createPracticeTask 时无任何通知
- ❌ 截止前提醒（虽然个人提醒 v1 临期 push 会扫到，但语义不同）

#### 目标
- 辅导员下达任务 → 班级学员收到（"老师布置了《XX心咒》100 遍 · 周日截止"）
- 截止前 24h / 6h / 0h 学员有进度提醒（fixed 模式）

#### 设计

A. **创建时通知**（同 M9 套路）：
```ts
await dispatchToUsers({
  eventKind: 'practice_task', eventId: task.id, tier: 'created',
  userIds: classMembers,
  severity: 'normal',
  title: `《${className}》新修学任务`,
  body: `${task.title || task.project.name} · 目标 ${task.target}`,
  link: `/practice/project/${task.projectId}`,
});
```

B. **截止前调度**（cron 加新 tick）：
- T-24h：fixed 任务且 progress < target · 发 "明日截止 · 还差 X"
- T-6h：fixed 任务且 progress < target · 发 "6 小时后截止"
- T-0：fixed 任务到期 · 发"任务结束 · 完成度 X%"

复用 `personal-reminders.ts` 的 cron 框架 · 加 `tickTaskDeadlines()`。

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M10.Q1 | daily 模式未完成提醒走哪？ | ✅ **A · v1 个人提醒覆盖** · M10 仅做 fixed 截止 tick · 责任清晰 不双推 |
| M10.Q2 | 截止后发结果通知吗？ | ✅ **B · 仅完成发祝贺** · "🌟《XX 心咒》圆满 · 共 N 遍" · 未完成不发 · 学法不该被罚 |
| M10.Q3 | severity 默认值？ | ✅ **混合** · 默认 normal · 老师可手勾 urgent · T-6h 系统自动升 urgent · T-0 维持 normal（完成发祝贺）|

#### tick 表（cron）

| tick | 条件 | severity | 文案 |
|---|---|---|---|
| T-24h | fixed · progress < target | normal | 明日截止 · 还差 N |
| T-6h | fixed · progress < target | urgent | 6h 后截止 · 还差 N |
| T-0 完成 | progress ≥ target | normal | 🌟 圆满 · 共 N 遍 |
| T-0 未完成 | progress < target | ❌ 不发 | — |

---

### M11 · 成就解锁通知

#### 现状
- Notification.type 枚举有 `achievement`
- ❌ 解锁时不写通知 · 不推 push

#### 目标
用户解锁新成就 → 站内 + push 推送祝贺。

#### 设计

找到成就解锁的代码点（应该在 PracticeEntry 写入后 / SM2 复习后 / 阅读完成后等）· 末尾加 dispatch：

```ts
await dispatchToUsers({
  eventKind: 'achievement', eventId: achievement.id, tier: '-',
  userIds: [userId],
  severity: 'normal',
  title: `🎉 ${achievement.name}`,
  body: achievement.description,
  link: '/achievement',
});
```

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M11.Q1 | 成就要不要进首页卡？ | ✅ **B · 仅 push + 通知中心** · 与 M4.Q1 一致 · 成就是被动事件 · 首页保持画报禅意 |
| M11.Q2 | 多成就合并？ | ✅ **合并** · 5 分钟窗口内多成就合并为 "今日解锁 N 项 · 包括 XX、YY..." · 点击跳 /achievement · 防新用户首日 7 连震 |

#### 合并实现（事件触发链）

```ts
// achievement/service.ts
async function onAchievementUnlock(userId: string, achievementId: string) {
  // 1. 同一窗口聚合 · key = `unlock:${userId}`
  const window = await redis.get(`unlock:${userId}`);
  if (window) {
    // 已有窗口 · 加入 list · 不立刻发
    await redis.rpush(`unlock:${userId}:items`, achievementId);
    return;
  }
  // 2. 开新窗口 · 5 分钟后冲刷
  await redis.setex(`unlock:${userId}`, 300, '1');
  await redis.rpush(`unlock:${userId}:items`, achievementId);
  setTimeout(() => flushUnlockBatch(userId), 300_000);
}
```

> 备注：当前栈无 Redis · 用 in-memory `Map<userId, { items: string[]; timer: NodeJS.Timeout }>` 起步 · 多进程时迁 Redis（参考 NOTIFICATION_PLAN 决策 #12 静默判定缓存策略）。

---

### M12 · 排期模式扩展（recurring + 法会）

#### 现状
- ❌ 仅支持 one_time 单次共修
- ❌ 老师要排"每周三 19:00"持续 8 周 → 必须手工建 8 条
- ❌ 法会（如莲师 7 日 · 每天 2-4 场）无法表达"同一法会主题"
- ❌ ack 颗粒度对法会场景失效（一次 ack 整组都静音）

#### 目标
辅导员 / admin 创建时可选 4 种排期模式：
1. **单次共修** · 一次性
2. **每周重复** · 周X + 时间 + 持续 N 周
3. **每日连开** · 起止日 + 每日时间（可多个）
4. **自定义法会** · 法会容器 + 任意场次时间

每种模式都能正确触发通知 + 上首页卡 + 不爆 push 上限。

#### 决策

| ID | 问题 | 结论 |
|---|---|---|
| M12.Q1 | recurring 怎么存？ | ✅ **RRULE 单行 + 按需展开** · ClassSession.recurrence Json · 查询时展开 N 个虚拟实例 · 改单场触发 detach 为独立行 |
| M12.Q2 | Assembly 法会首页卡 ack 颗粒度？ | ✅ **按天 ack** · ack key = `${assemblyId}:${YYYY-MM-DD}` · 第 2 天卡片自动重冒 |
| M12.Q3 | recurring 中改单场时间？ | ✅ **「仅此次 / 此后 / 全部」三选** · Google Calendar 风 · 「仅此次」生成 detach instance · 「此后」拆分新 master · 「全部」直接改 master |
| M12.Q4 | 法会 push 频率控制？ | ✅ **默认聚合 + 老师可勾「场场提醒」** · 默认每日 1 条聚合 + 首场 T-30 · 老师勾选后每场 T-30 都推（绕日上限 · 但显式开关）|

#### 数据模型

```prisma
// ClassSession 加 schedule 字段（详见上文 M12 schema 块）
scheduleMode    String  // 'one_time' | 'recurring_master' | 'recurring_detached' | 'assembly_child'
recurrence      Json?   // RRULE 子集
recurrenceParentId String?
parentAssemblyId String?
remindEachOccurrence Boolean @default(false)

// 新表 DharmaAssembly · 详见数据模型汇总
```

#### RRULE 子集（不引第三方库 · 自实现）

```ts
type Recurrence = {
  freq: 'DAILY' | 'WEEKLY';
  interval: number;          // 每隔几天/周（默认 1）
  byDay?: number[];          // 0-6 · 周几（仅 WEEKLY）· 0=周日
  byTime: string;            // 'HH:mm' · 默认场次开始时间
  count?: number;            // 共 N 次（与 until 二选一）
  until?: string;            // ISO date
  exceptions?: string[];     // detach 出去的实例日期（不展开）
};
```

#### 展开函数

```ts
function expandRecurrence(master: ClassSession, from: Date, to: Date): VirtualSession[] {
  const r = master.recurrence as Recurrence;
  const out: VirtualSession[] = [];
  let cur = new Date(master.startAt);
  let n = 0;
  while (cur <= to && (!r.count || n < r.count) && (!r.until || cur <= new Date(r.until))) {
    if (cur >= from && !r.exceptions?.includes(cur.toISOString().slice(0, 10))) {
      out.push({ ...master, startAt: cur, isVirtual: true });
    }
    cur = nextOccurrence(cur, r);
    n++;
  }
  return out;
}
```

#### 改单场三选实现

| 选项 | 行为 |
|---|---|
| **仅此次** | 在 master.recurrence.exceptions 加该日期 · 创建独立 ClassSession（scheduleMode=`recurring_detached`, recurrenceParentId=master.id）· 修改它 |
| **此后** | 当前及之后从 master 切出新 master · 老 master 加 until = 改动日 - 1 · 新 master 复制旧的 + 改字段 |
| **全部** | 直接改 master 的 startAt / recurrence · 所有未 detach 实例自动跟随 |

#### Assembly 法会首页卡

进行中（startDate ≤ today ≤ endDate）时 · 抢占 kindRank=15（高于普通 session=20 · 低于 announcement=10）· 卡片样式：

```
🪷 莲师 7 日荟供 · 进行中第 3 / 7 天
今日还有 2 场 · 14:00 / 19:00
[ 查看法会 ]   [ 知道了今日 ]
```

ack key = `${assemblyId}:${YYYY-MM-DD}` · 当天点 [知道了今日] 后卡片消失 · 次日 00:00 后自动重冒。

#### push 频率控制（防风暴）

| 场景 | 默认推送 | 老师勾「场场提醒」时 |
|---|---|---|
| 法会创建 | 1 条 "🪷 法会即将开始 · 共 N 场" | 同 |
| 每日首场前 | 1 条聚合 "今日 9/14/19 三场" | 1 条聚合 + 每场 T-30 |
| 每场 T-0 | ❌ 不推（避免 21 条/周）| 推（每场）|

「场场提醒」绕过日 3 条上限（显式 opt-in · 老师勾选时弹确认 "学员将收到每场提醒 · 可能超出每日 3 条上限 · 是否继续？"）。

#### 老师创建 UI

```
[+ 新建共修 / 法会]
  ◯ 单次共修      → startAt + endAt + 标题 + severity
  ◯ 每周重复      → 周X(多选) + 时间 + 持续 N 周（或截止日）
  ◯ 每日连开      → 起止日 + 每日时间(可加多个) + 标题
  ◯ 自定义法会    → 起止日 + 法会名 + [+ 添加场次] × N
                     [ ] 场场提醒（默认聚合）
```

#### 与 v1 兼容

- 现有所有 ClassSession 行：`scheduleMode='one_time'` · `recurrence=null` · `parentAssemblyId=null` · 行为不变
- 现有 T-30/T-5/T-0 调度：仅对 one_time 与 recurring 展开后实例触发 · 法会 assembly_child 由 M12 新调度器处理

---

## 4. 数据模型变更汇总

```prisma
// 1. enum 新增
enum Severity {
  normal
  urgent
  critical
}

// 2. ClassSession 加字段（含 M12 排期模式）
model ClassSession {
  ...
  severity           Severity @default(normal)
  scheduleMode       String   @default("one_time")
  // 'one_time' | 'recurring_master' | 'recurring_detached' | 'assembly_child'
  recurrence         Json?    // recurring_master 用：{freq, interval, count, until, byDay, byTime}
  recurrenceParentId String?  // recurring_detached 指回 master
  parentAssemblyId   String?  // assembly_child 用
  status             String   @default("scheduled")
  // 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  remindEachOccurrence Boolean @default(false)  // 老师勾「场场提醒」时 true
}

// 2b. 新表 · 法会容器（M12）
model DharmaAssembly {
  id          String   @id @default(cuid())
  classId     String
  class       Class    @relation(fields: [classId], references: [id])
  title       String
  description String?
  startDate   DateTime
  endDate     DateTime
  severity    Severity @default(urgent)
  status      String   @default("upcoming")
  // 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
  createdBy   String
  sessions    ClassSession[]
  @@index([classId, startDate])
}

// 3. ClassAnnouncement 加字段
model ClassAnnouncement {
  ...
  severity Severity @default(normal)
}

// 4. PracticeTask 加字段
model PracticeTask {
  ...
  severity Severity @default(normal)
}

// 5. NotificationDispatchLog 加 channel 字段（用于 push 上限）
model NotificationDispatchLog {
  ...
  channel String @default("inapp")  // 'inapp' | 'push' | 'email' | 'sms'
}

// 6. 新表 · 用户卡片 ack
model NotificationCardAck {
  id           String   @id @default(cuid())
  userId       String
  eventKind    String
  eventId      String
  ackedVersion Int      @default(1)
  ackedAt      DateTime @default(now())
  
  @@unique([userId, eventKind, eventId])
  @@index([userId, ackedAt])
}

// 7. 新表 · 系统公告（admin 全平台）
model SystemAnnouncement {
  id        String   @id @default(cuid())
  title     String
  body      String
  severity  Severity @default(normal)
  startAt   DateTime @default(now())
  endAt     DateTime?
  createdBy String
  createdAt DateTime @default(now())
}

// 8. v2.5 · 法会模型
model DharmaAssembly {
  id          String   @id @default(cuid())
  name        String
  emoji       String   @default("🪷")
  description String?
  startAt     DateTime
  endAt       DateTime
  dailyWindowStart Int?   // 0-23 · null = 单次
  dailyWindowEnd   Int?
  severity    Severity @default(normal)
  classId     String?  // null = 全平台
  createdBy   String
  createdAt   DateTime @default(now())
}
```

---

## 5. API 设计汇总

```
# 学员侧
GET    /api/my/top-home-card                   v2 · 多源仲裁 + ack 过滤
POST   /api/my/card-ack                        body: { eventKind, eventId, version }
DELETE /api/my/card-ack/:kind/:id              取消 ack（重新冒出 · 测试用）

# admin
POST   /api/admin/system-announcements         发系统公告
GET    /api/admin/system-announcements         列表
PATCH  /api/admin/system-announcements/:id     改
DELETE /api/admin/system-announcements/:id     删

# v2.5
POST   /api/coach/classes/:cid/assemblies      创建法会
PATCH  /api/coach/assemblies/:aid              编辑
GET    /api/my/assemblies                      学员看自己班的法会
```

---

## 6. 横切设计

### 6.1 Severity 路由策略

| Severity | Push | 静默时段 | 全局上限 | 首页卡 | 站内 |
|---|---|---|---|---|---|
| **critical** | 必推 | **绕过** | **绕过** | 红边样式 · 置顶 | 必发 |
| **urgent** | 推 | 守静默 | **绕过** | 加亮样式 | 必发 |
| **normal** | 推 | 守静默 | 守上限 | 默认样式 | 必发 |

### 6.2 用户偏好（per-type toggle）

`/settings/notifications` 已有的 · 加 per-type 子开关：

```
✅ 班级公告 push
✅ 共修开始前 push
✅ 修学任务 push
✅ 成就解锁 push
✅ 个人提醒（v1 已存在）
✅ 系统公告 push
```

每类一个开关 · 关掉只影响 push · 站内仍发（让用户能补看）。

---

## 7. 落地分期（4 Sprint · 9 天）

| Sprint | 模块 | 内容 | 工期 |
|---|---|---|---|
| **A · 事件全通** | M2 + M8 + M9 + M10 + M11 | 所有事件源至少写 Notification + push | 2 天 |
| **B · 首页卡** | M3 + M4 + M5 + M6 | UpcomingEventCard + 多源仲裁 + Severity + Ack | 3 天 |
| **C · 全局护栏** | M7 + per-type toggle UI | 每日 3 条上限 + 偏好细化 | 1 天 |
| **D · iOS / PWA 验证** | M1 | 真机测 + 引导授权 + 失败重试 | 1.5 天 |
| **E · v2.5 可选** | recurrence + DharmaAssembly | 看用户量决定 | +5 天 |

---

## 8. 开放问题汇总（讨论清单）

> 用户每答一条 · 我把"决策"段填上 · 再继续下一题

| 模块 | ID | 问题 | 状态 |
|---|---|---|---|
| M1 | Q1 | PWA 引导触发时机？ | 待答 |
| M1 | Q2 | iOS 没装 PWA 怎么办？ | 待答 |
| M2 | Q1 | 系统公告 admin UI 在哪建？ | 待答 |
| M2 | Q2 | 系统公告是单条还是批量？ | 待答 |
| M3 | Q1 | UpcomingEventCard 放 HomePage 哪个位置？ | 待答 |
| M3 | Q2 | 卡片几个 CTA？ | 待答 |
| M3 | Q3 | 多事件显示几条？ | 待答 |
| M4 | Q1 | 个人提醒进不进首页卡？ | ✅ 不进 · 仅 push + 通知中心 |
| M4 | Q2 | 同 severity 同时间 tiebreaker？ | ✅ kindRank 硬排序 |
| M4 | Q3 | 仲裁结果缓存吗？ | ✅ 不缓存 · 每次实时算 |
| M5 | Q1 | severity 手动还是自动？ | ✅ 混合（默认自动 · 老师可覆盖） |
| M5 | Q2 | critical 谁能发？ | ✅ admin + 班级 coach |
| M5 | Q3 | T-0/T-5/T-30 算什么 severity？ | ✅ T-30 normal · T-5 urgent · T-0 critical |
| M6 | Q1 | ack 过期吗？ | ✅ 事件改动才重冲（editVersion 失效触发） |
| M6 | Q2 | 多设备 ack 同步？ | ✅ 后端表同步（用户声明：不允许多设备登录 · 政策依据 ack 后端） |
| M7 | Q1 | 用什么记 push 计数？ | ✅ DispatchLog 加 channel 字段 |
| M7 | Q2 | critical push 算上限吗？ | ✅ critical 绕过上限 |
| M7 | Q3 | 上限默认 3 · 用户能调吗？ | ✅ 不能 · 系统硬限 3 条 |
| M8 | Q1 | 公告默认 severity？ | 待答 |
| M8 | Q2 | 编辑公告触发新 push？ | 待答 |
| M9 | Q1 | session 改时间再发首发通知？ | 待答 |
| M9 | Q2 | session 取消通知？ | 待答 |
| M10 | Q1 | daily 任务未完成走个人提醒还是独立？ | 待答 |
| M10 | Q2 | 截止后发完成 / 未完成？ | 待答 |
| M10 | Q3 | 任务 severity 默认？ | 待答 |
| M11 | Q1 | 成就解锁进首页卡？ | 待答 |
| M11 | Q2 | 多成就同时解锁合并？ | 待答 |

---

## 9. 决策记录（每个模块定型后填）

### M5 Severity 三档 · 已定型

**Q1 标记方式：混合（默认自动 · 老师可覆盖）**
- 系统默认按规则给 severity：
  - 公告 / 任务 / 共修创建 → 默认 `normal`
  - fixed 任务 `endAt - now < 24h` → 自动升 `urgent`
  - 共修 T-30 → `normal` · T-5 → `urgent` · T-0 → `critical`
- 老师在 coach 创建 / 编辑 UI 上**可手动覆盖默认值**（dropdown 选 normal / urgent / critical）
- 系统升级仅"自动加严"· 不自动降级（避免老师标了 urgent 被系统降回 normal）

**Q2 critical 权限：admin + 班级 coach 均可发**
- admin 全平台 critical（系统公告 / 紧急维护）
- coach 仅本班 critical（紧急取消 / 调时间）
- 平台后续监控 critical 滥用率 · 必要时收口到仅 admin

**Q3 共修调度 severity：T-30 normal · T-5 urgent · T-0 critical**
- T-0 (现在开始) 绕过静默时段 · 保证用户收到
- 用户报名共修 = 自愿被在该时刻叫醒 · 即便深夜也合理
- 全局每日 3 条上限 critical 是否绕过 → 见 M7 决策

---

### M6 NotificationCardAck · 已定型

**Q1 重冲条件：事件改动 (editVersion+1) 才重冲**
- 表 `NotificationCardAck` 记 `(userId, eventKind, eventId, ackedVersion)`
- 仲裁过滤逻辑：`event.editVersion > ack.ackedVersion` 才上卡片
- 老师改共修时间 / 改公告内容 / 调任务目标 → 自动 editVersion+1 → 用户重新看到
- 不做时间过期（30 天等）· 不主动清 ack · 表行随事件删除一起 CASCADE

**Q2 多设备同步：后端表统一**
- 用户政策：**不允许多设备同时登录**（注：当前 AuthSession 表 schema 支持多设备 · `/devices` 页有"退出其他设备" 入口 · **后续将单独评估是否收口到单设备**）
- 即便有多端 · ack 落后端表 · 60s refetch 自然同步 · 不再设计 localStorage 端缓存
- 决策推论：ack 设计**与设备数无关** · 任何设备 ack 都改后端

**附注 · 多设备登录政策**：用户在 M6.Q2 提到"不允许多设备登录" · 但当前实际是支持多设备的（AuthSession + DevicesPage）· 这条政策若要真正落地需要：
1. 登录时检测已有 active session → 顶掉旧端
2. /devices 页改为只能"登出本设备"
此项不在 v2 通知系统范围 · 单独议题（建一个 issue 跟踪）

---

## 10. 实施流水（按 commit 追踪）

### 推荐实施顺序（由底向上 · 先基础设施 · 再事件源 · 再 UI）

| 阶段 | 模块 | 工作量 | 依赖 | 备注 |
|---|---|---|---|---|
| Phase 1 | **M5** Severity 三档 + **M6** Ack 表 + **M7** channel 字段 | 中 | 仅 schema 变更 | `prisma db push` · 不破坏现状 |
| Phase 2 | **M2** 系统公告 admin UI + 表 | 中 | M5 | admin /notification-rules 加 tab |
| Phase 3 | **M8** 班级公告 push · **M9** 共修首发/变更/取消 · **M10** 任务 push + cron · **M11** 成就 push · **M12** 排期模式（recurring + assembly） | 大 | M5/M6/M7 | 各 service 末尾加 dispatch · cron 加新 tick · M12 加 RRULE 展开器 + DharmaAssembly 表 |
| Phase 4 | **M4** 多源仲裁 API + kindRank · **M3** UpcomingEventCard 组件 + HomePage 集成 | 大 | Phase 3 全部完成 | UI 终点 |
| Phase 5 | **M1** PWA 引导 sheet + iOS 检测 + 教程页 | 小 | 独立 | 任意时段做 |

### Commit 表

| 模块 | Commit | 备注 |
|---|---|---|
| M2 | 待 | |
| M3 | 待 | |
| M4 | 待 | |
| M5 | 待 | |
| M6 | 待 | |
| M7 | 待 | |
| M8 | 待 | |
| M9 | 待 | |
| M10 | 待 | |
| M11 | 待 | |
| M12 | 待 | |
| M1 | 待 | |

---

## 11. v1 → v2 迁移要点

- v1 个人提醒（临期/日报/周报）逻辑保留 · 不动
- v1 的 ClassSession T-30/5/0 调度保留 · 不动
- v2 新加 dispatch 调用都通过 `dispatchToUsers` 函数 · 不绕过去重
- 上线步骤：`prisma db push`（加字段）→ 后端 build + reload → 前端 build + rsync
