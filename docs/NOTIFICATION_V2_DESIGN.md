# 觉学 · 通知系统 v2 完整设计（模块化）

> 状态：📝 设计中 · 与用户讨论同步落档
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
- ❌ recurrence 重复事件（每周三共修 · v2.5 可选）
- ❌ DharmaAssembly 法会模型（v2.5 可选）
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
| M1.Q1 | PWA 引导触发时机？ | A. 首次进入 app 弹一次；B. 用户尝试授权时检测；C. 不引导 · 用户自己装 |
| M1.Q2 | iOS Safari 没装 PWA 怎么办？ | A. 显式提示"请先添加到主屏幕"；B. 隐藏 push toggle |

#### 决策
（待讨论）

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
| M2.Q1 | 系统公告 admin UI 在哪建？ | A. /admin/notification-rules 旁加 tab；B. 单独页 /admin/system-announcements |
| M2.Q2 | 系统公告是单条还是批量？ | A. admin 写一条 · 所有用户都收；B. 可按角色/地域筛 |

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
| M3.Q1 | 放在 HomePage 哪个位置？ | A. 顶部 hero 之下；B. NotificationBell 下；C. 卡片间 |
| M3.Q2 | 卡片有多少 CTA？ | A. 只一个主 CTA；B. 主 CTA + [知道了]；C. 视 severity 而定 |
| M3.Q3 | 多事件时显示几条？ | A. 仅 top-1（已仲裁）；B. top-3 堆叠（仲裁后取前 3）|

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

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M4.Q1 | 个人提醒（19:00 临期等）要不要进首页卡？ | A. 不进 · 仅 push + 通知中心；B. 进 · 但 severity normal |
| M4.Q2 | 同 severity 同时间的 tiebreaker？ | A. kindRank 硬排（公告 > 共修 > 任务 > 成就）；B. createdAt desc（新的在前）|
| M4.Q3 | 仲裁结果缓存吗？ | A. 不缓存 · 每次实时算；B. 短缓存 60s |

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

#### 开放问题

| ID | 问题 | 候选 |
|---|---|---|
| M7.Q1 | 用什么记 push 计数？ | A. DispatchLog 加 `channel` 字段；B. 新增 `PushSendLog` 表；C. 用 Notification + push_sent flag |
| M7.Q2 | critical push 也算上限吗？ | A. 算 · 一视同仁；B. critical 绕过上限 |
| M7.Q3 | 上限默认值 3 · 用户能调吗？ | A. 不能 · 系统硬限；B. 用户偏好可改（1-5） |

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
| M8.Q1 | 公告默认 severity？ | A. normal · 老师勾"重要"才升 urgent；B. 默认 urgent · 公告本身是重要事件 |
| M8.Q2 | 编辑公告（PATCH）触发新 push 吗？ | A. 不触发 · 只触发首发；B. severity 升级时触发；C. 始终触发 |

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
| M9.Q1 | session 改时间是否再发首发通知？ | A. 不发 · 只 T-30/5/0 自然提醒；B. 改时间 → 发"时间已变更"通知；C. severity 升级 → 发 |
| M9.Q2 | session 取消（删除）是否通知？ | A. 不通知 · 学员看不到等于不存在；B. 发"已取消"通知（critical） |

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
| M10.Q1 | daily 模式任务的"日内未完成"提醒 · 走个人提醒系统还是单独发？ | A. 走 v1 个人提醒（已覆盖）；B. 独立 tick |
| M10.Q2 | 截止后任务发"已完成" / "未完成"通知吗？ | A. 不发；B. 仅完成发祝贺；C. 全发 |
| M10.Q3 | severity 默认值？ | A. normal · 老师可升 urgent；B. fixed 模式 endAt - now < 6h 自动 urgent |

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
| M11.Q1 | 成就解锁要不要进首页卡？ | A. 进 · 24h 内未 ack 时；B. 不进 · 仅 push + 通知中心 |
| M11.Q2 | 多个成就同时解锁（比如新用户首日多里程碑）合一发？ | A. 一条一条发；B. 合并成"今日解锁 N 项" |

---

## 4. 数据模型变更汇总

```prisma
// 1. enum 新增
enum Severity {
  normal
  urgent
  critical
}

// 2. ClassSession 加字段
model ClassSession {
  ...
  severity Severity @default(normal)
  // recurrence Json?  // v2.5
  // parentAssemblyId String?  // v2.5
  // status SessionStatus @default(scheduled)  // v2.5
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
| M4 | Q1 | 个人提醒进不进首页卡？ | 待答 |
| M4 | Q2 | 同 severity 同时间 tiebreaker？ | 待答 |
| M4 | Q3 | 仲裁结果缓存吗？ | 待答 |
| M5 | Q1 | severity 手动还是自动？ | 待答 |
| M5 | Q2 | critical 谁能发？ | 待答 |
| M5 | Q3 | T-0/T-5/T-30 算什么 severity？ | 待答 |
| M6 | Q1 | ack 过期吗？ | 待答 |
| M6 | Q2 | 多设备 ack 同步？ | 待答 |
| M7 | Q1 | 用什么记 push 计数？ | 待答 |
| M7 | Q2 | critical push 算上限吗？ | 待答 |
| M7 | Q3 | 上限默认 3 · 用户能调吗？ | 待答 |
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

（空 · 等用户讨论）

---

## 10. 实施流水（按 commit 追踪）

| 模块 | Commit | 备注 |
|---|---|---|
| M2 | 待 | |
| ... | | |

---

## 11. v1 → v2 迁移要点

- v1 个人提醒（临期/日报/周报）逻辑保留 · 不动
- v1 的 ClassSession T-30/5/0 调度保留 · 不动
- v2 新加 dispatch 调用都通过 `dispatchToUsers` 函数 · 不绕过去重
- 上线步骤：`prisma db push`（加字段）→ 后端 build + reload → 前端 build + rsync
