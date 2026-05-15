# 觉学 · 通知系统 v2 完整设计（模块化）· ⚠️ 已被 FINAL_SPEC 取代

> ## 🚨 重要：本文档已被取代 · 仅作历史参考
>
> **实施唯一参考 → `docs/NOTIFICATION_FINAL_SPEC.md`**（2026-05-15 终版 · 含审计修复）
>
> 本文档保留 · 但其中部分模块已被新设计取代。冲突时以 FINAL_SPEC 为准。
>
> ### 模块 → 新规格 映射表
>
> | 旧模块 | 状态 | 取代位置 |
> |---|---|---|
> | M1 · Web Push 通道加固 | ✅ 沿用 + 增强 | FINAL_SPEC §5（Push 5 层过滤）+ §11.7（Twilio webhook 签名）|
> | M2 · 站内 Notification 补全事件源 | ✅ 沿用 | FINAL_SPEC §2 路由表 + §3 tier 调度 |
> | M3 · UpcomingEventCard 前端组件 | ❌ **作废** | 改为 §7 首页玻璃文字（液态玻璃）+ §6 In-app Banner |
> | M4 · 多源仲裁 logic | ❌ **作废** | 不需要仲裁 · §1 4 通道架构精准分工 + §6 banner 队列 |
> | M5 · Severity 字段 + 三档样式 | ✅ 沿用 | FINAL_SPEC §6.4 + §6.5（severity 自动消失 / 背景色）|
> | M6 · NotificationCardAck | 🟡 **缩减** | 只保留 critical SystemAnnouncement ack（§3.6）· 其它 dismissal 同表存（§13）|
> | M7 · 全局每日 3 条 push 上限 | 🟡 **改为每小时 5 条** | FINAL_SPEC §5 第 5 层过滤 |
> | M8 · 班级公告 push 联动 | ✅ 沿用 | FINAL_SPEC §3.2 |
> | M9 · 班级共修首发通知 | ✅ 沿用 + 扩展 | FINAL_SPEC §3.1（含 T-24h 预告档）|
> | M10 · 班级修学任务通知 | ✅ 沿用 | FINAL_SPEC §3.3 |
> | M11 · 成就解锁通知 | ✅ 沿用 + 5min 聚合 | FINAL_SPEC §3.5 + §19.9（聚合实现）|
> | M12 · 排期模式扩展（法会）| 🟡 **改为信息型** | FINAL_SPEC §3.7 + §7（玻璃文字行 · 无 /live 子页）|
> | — · UI 仲裁 / 首页卡 / 4 档窗口 | ❌ **新设计 / 全废** | 改为 §6 banner（仅 severity≥urgent）+ §7 玻璃文字 |
> | — · In-app Banner（新通道）| ❌ **新增** | FINAL_SPEC §1 通道 #3 + §6 全节 |
> | — · SMS 短信通道（新增）| ❌ **新增** | FINAL_SPEC §1 通道 #5 + §11 SMS 子系统 + admin 广播 |
>
> ### 新增的关键设计（FINAL_SPEC 独有）
>
> - 单设备登录 · `User.currentSessionId` + PushSubscription 自动停用（§19.2）
> - 服务端化 banner 队列 · `ActiveBanner` 表（§19.4）
> - SW link 白名单校验（§19.1）
> - Admin SMS 广播功能（受众选择 / 模板 / bypass 二次密码确认）
> - 法会 / 系统活动信息型处理（无 app 内入口 · 外部 Zoom 链接）
> - 首页画报 + 液态玻璃文字（替代「首页卡」概念）
> - 班级卡红点（取代任务级 push 上限）
> - 19 项审计修复（§19 全节）
>
> ### 实施基线
>
> - 总工时：~8 周（FINAL_SPEC §14）
> - 灰度 5 阶段：P0 基础 → P4 清理（FINAL_SPEC §15）
> - Smoke test 19 项（FINAL_SPEC §17）
>
> ---
>
> ## 以下为历史设计文档（保留供回溯）
>
> 关联：`NOTIFICATION_PLAN.md`（v1 框架）· `PERSONAL_REMINDERS_V1.md`（个人提醒 v1 已交付）· `NOTIFICATION_V2_LAYERED_ARCH.md`（10 层分层演进史 · 含本文档→FINAL_SPEC 的决策过程）
>
> 原始状态：✅ 设计已定稿（2026-05-15）· **12 模块 32 个开放问题**全部落决策 · 致命级 schema/排期冲突已修 · 设计缺口已补 · 已加 §2.5 全栈现状基线（与代码库扫描对齐）

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

## 2. 模块清单（12 个 · 每个独立设计）

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
| **M12** | 排期模式扩展（recurring + DharmaAssembly）| 横切 + 事件源 | ❌ 0 | 2 天 |
| **合计** | | | | **~10.5 天**（含横切收口） |

> 详细工期排期见**第 10 节 Phase 表**。

---

## 2.5 全栈现状基线（v2 实施前盘点）

> 基于 2026-05-15 全仓扫描 · 标注哪些已就位 / 哪些缺 / 哪些可复用避免重建。

### 后端 · 已就位的核心基建

| 组件 | 文件 | 现状 |
|---|---|---|
| dispatchToUsers() 核心派发 | `backend/src/modules/scheduler/dispatch.ts:31` | ✅ 完备 · 事务内写 Notification + DispatchLog · 事务外发 push · 失败仅 log 不回滚 |
| sendPushToUsers() | `backend/src/modules/push/service.ts:55` | ✅ 完备 · web-push.sendNotification · 410/404 自动删订阅 · 返回 delivered/invalid/failed 计数 |
| Cron tick 60s | `backend/src/modules/scheduler/cron.ts:112` | ✅ 完备 · CRON_ENABLED env 可禁 · 调用 tickClassSessions + tickPersonalReminders |
| Personal Reminders 三档 | `backend/src/modules/scheduler/personal-reminders.ts:113` | ✅ 完备 · timezone 折算 · 静默时段兜底 · 三档 dispatchToUsers |
| ClassSession T-30/T-5/T-0 调度 | `backend/src/modules/scheduler/cron.ts:73` | ✅ 完备 · ±90s 窗口 · 走 dispatchToUsers |
| NotificationDispatchLog 去重 | `prisma/schema.prisma` | ✅ unique `(eventKind, eventId, tier, userId)` 索引 · 幂等保证 |
| NotificationRule 平台规则表 | `prisma/schema.prisma` | ✅ scope (platform/class/assignment) · triggerType · defaultHour/Weekday/meta · **v2 admin UI 直接复用** |
| Notification 软删字段 | `prisma/schema.prisma` | ✅ `deletedAt` 已存在 · v2 撤回是否新加 `revokedAt` 还是复用见下文决策 |
| Admin 测试触发 | `POST /api/admin/notification-test` | ✅ 已实装 · 绕过时段 |

### 后端 · 事件源接通现状（v2 改造矩阵）

| 模块 | 事件源 | 现状 | v2 工作 |
|---|---|---|---|
| M2 | SystemAnnouncement | ❌ 表不存在 · admin UI 不存在 | 新建表 · 加 admin tab · 接 dispatchToUsers |
| M8 | ClassAnnouncement | 🟡 `notifyClassMembers` 用 `notification.createMany` 直写 · **不走 dispatch · 无 push · 无去重** | 改造为 dispatchToUsers · 加 severity 字段 · 加撤回 |
| M9 | ClassSession 首发 | ❌ createSession 不发通知（只有 T-30 才提醒）· 改时间 / 取消也无通知 | service 层 diff PATCH · tier=created/time_changed/cancelled |
| M10 | PracticeTask | ❌ service 完全无 dispatch 钩子 | 创建时通知 · cron 加 tickTaskDeadlines · tier=task_t24h/t6h/completed |
| M11 | Achievement | ❌ 解锁处无 dispatch 钩子 | 加 onAchievementUnlock · 5 分钟聚合 Map · SIGTERM flush |
| M12 | DharmaAssembly | ❌ 表不存在 | 新建表 · RRULE 展开器 · ClassSession 加 scheduleMode 字段 |

### 前端 · 已就位

| 组件 | 文件 | 现状 |
|---|---|---|
| NotificationBell + 红点 | `src/pages/HomePage.tsx:370-420` | ✅ 来自 useNotifications hook |
| /notifications 中心 | `src/pages/NotificationPage.tsx` | ✅ 6 类筛选 tab · 游标分页 100 · markRead/markAll/delete |
| /settings/notifications 偏好 | `src/pages/SettingsNotificationsPage.tsx` | ✅ 三档 toggle + hour · 静默时段 · timezone · 动态 PATCH 无保存按钮 |
| Push 订阅管理 | `src/lib/push.ts` | ✅ isSupported/status/subscribe/unsubscribe · v2 M1 PWA 引导直接基于此加 |
| Service Worker push handler | `public/sw.js:115-150` | ✅ push event · showNotification · click 复用已开 tab navigate |

### 前端 · v2 缺口

| 组件 | 模块 | 状态 |
|---|---|---|
| UpcomingEventCard | M3 | ❌ 0% · 需新建组件 + 集成 HomePage NotificationBell 下方 |
| useTopHomeCard hook | M3/M4 | ❌ 0% |
| Severity 三档样式 | M5 | ❌ 0% · 玻璃卡 / 金色描边 / crimson 边框 三档 |
| per-type toggle UI（6 个开关）| 6.2 | ❌ 0% · /settings/notifications 加 section |
| PWA 引导 sheet（iOS Safari 检测）| M1 | ❌ 0% |
| 撤回灰显标签 | M2/M8 | ❌ 0% · NotificationPage 渲染加灰色「已撤回」 |
| admin /notification-stats | 6.5 | ❌ 0% · 当日 dispatch 总量 / 失败率 |

### 现状对 v2 设计的关键反馈（doc 需更新点）

1. **撤回字段命名**：Notification 表已有 `deletedAt`（软删 · 用户主动删）· v2 撤回语义不同（事件方撤回 · 学员仍能看到）· **决策：新加 `revokedAt` 区分** · `deletedAt` 仅用户主动删 · `revokedAt` 事件源撤回

2. **NotificationRule 复用**：v2 admin /notification-rules 直接在现有表上加 `triggerType='system_announcement'` 行 · 不重建表

3. **ClassAnnouncement 改造路径**：
   - 现状：`notifyClassMembers` createMany 直写 · 不写 DispatchLog · 不发 push
   - v2：替换为 `dispatchToUsers({ eventKind: 'class_announcement', tier: '-', ... })` · 自动获得 push + 去重
   - 风险：现有公告已发的 Notification 行没有对应 DispatchLog · 不影响（DispatchLog 仅防重发新公告）

4. **SystemAnnouncement vs 复用 Notification**：
   - 候选 A：新建 SystemAnnouncement 表（v2 doc 现方案）· 优势：撤回 / severity / publishedBy 字段独立
   - 候选 B：复用 ClassAnnouncement classId=null（扫描建议）· 优势：少建表 · 复用现有模型
   - **决策：A · 新建表** · 理由：SystemAnnouncement 不属于任何班 · classId nullable 让 ClassAnnouncement 语义混乱 · 字段也不完全重叠

5. **lib/push.ts 已封装**：M1 失败重试逻辑加在 `backend/src/modules/push/service.ts` · 不动前端 lib/push.ts

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

| ID | 决策 |
|---|---|
| M1.Q1 | ✅ B · 按需提示 · 用户点 push toggle 授权时检测 iOS Safari + 未装 PWA → 弹引导 sheet · 不打扰首访 |
| M1.Q2 | ✅ A · 显示提示 · push toggle 仍在但置灰 · 下方 "iOS 需先 [添加到主屏幕] · [查看教程 →]" |
| M1.Q3 | ✅ 失败重试 · 单进程 setTimeout 队列 · 410 删订阅 · 5xx 重试 3 次（2/4/8s）· 不引 BullMQ |

#### 失败重试实现

```ts
async function pushWithRetry(sub, payload, attempt = 0) {
  try {
    await webpush.sendNotification(sub, payload);
  } catch (e: any) {
    if (e.statusCode === 410) return deleteSubscription(sub.id);   // Gone · 退订
    if (e.statusCode >= 500 && attempt < 3) {
      setTimeout(() => pushWithRetry(sub, payload, attempt + 1), 2000 * 2 ** attempt);
    } else {
      log.error({ e, sub: sub.endpoint }, 'push_failed');
    }
  }
}
```

理由：当前栈无 BullMQ · push 本身 best-effort · 进程崩溃极少 · 不引重型队列。SIGTERM 时未到点的 retry 丢失 · 可接受（下次事件触发会重新覆盖）。

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

#### 撤回语义

- 撤回 = `revokedAt = now()` · **不删 Notification 表行**（学员历史可查）
- 通知中心列表展示时 · revoked 项加灰色「已撤回」标签 · 不参与未读计数
- 不发新 push 通知撤回（防风暴）
- 首页卡仲裁 query 自动过滤 `revokedAt IS NOT NULL`
- 撤回后 NotificationCardAck 行保留（无害 · 事件已不在仲裁池）
- admin UI 在历史列表行有 [撤回] 按钮 · 二次确认弹窗 "撤回后学员通知中心仍可看 · 标记为已撤回"

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
| M4.Q2 | 同 severity 同时间 tiebreaker？ | ✅ **kindRank 硬排序** · 班级公告 > 法会 > 共修 > 任务 > 藏历日 > 系统公告 · 可预测稳定 |
| M4.Q3 | 仲裁结果缓存？ | ✅ **不缓存 · 每次实时算** · 接口调用频率受 React Query 60s staleTime 节制 · ack 后立即生效 |
| M4.Q4 | 候选时间窗？ | ✅ **每类事件独立时间窗** · 公告 24h（urgent 48h）· 共修 T-60min 到 endAt · 任务 fixed T-12h 内未完成 · 法会进行中 · 藏历当日 · 系统公告 24h（critical 72h）|

#### kindRank 定义

```ts
const KIND_RANK: Record<EventKind, number> = {
  classAnnouncement: 10,  // 班级公告
  dharmaAssembly:    15,  // 法会进行中（M12）· 高于普通 session
  classSession:      20,  // 共修
  practiceTask:      30,  // 修学任务
  auspiciousDay:     50,  // 藏历加持日
  systemAnnouncement: 60, // 系统公告（admin）
  // achievement 不参与首页卡仲裁（M11.Q1）· 仅 push + 通知中心
};
// 排序：severity desc > startAt asc > kindRank asc（小的赢）
```

#### 候选时间窗（每类事件独立）· M4.Q4 决策

只有"在窗口内"的事件才算合格候选 · 进入仲裁排序。

| 事件类型 | 时间窗 | 备注 |
|---|---|---|
| classAnnouncement | 发布后 24h 内未 ack | severity=urgent 延长到 48h |
| classSession | T-60min ≤ now ≤ endAt | 进行中或即将开始 |
| practiceTask | fixed · T-12h ≤ deadline 且 progress < target | daily 走个人提醒 · 不进卡 |
| dharmaAssembly | startDate ≤ today ≤ endDate | 进行中 + 当日未 ack |
| auspiciousDay | 当日 00:00 - 23:59 | 仅当日 |
| systemAnnouncement | 发布后 24h 内未 ack | severity=critical 延长到 72h |

时间窗外的事件 · 仍可在通知中心查看 · 但不抢首页卡。

#### 完整仲裁伪代码

```ts
async function getTopHomeCard(userId: string): Promise<HomeCard | null> {
  // 1. 各源拉取窗口内候选
  const candidates = [
    ...await loadAnnouncements(userId, { withinHours: 24 }),
    ...await loadSessions(userId, { fromMinBefore: 60 }),
    ...await loadTasks(userId, { fromHourBefore: 12, mode: 'fixed', incomplete: true }),
    ...await loadAssemblies(userId, { ongoing: true }),
    ...await loadAuspiciousDays(userId, { today: true }),
    ...await loadSystemAnnouncements(userId, { withinHours: 24, criticalHours: 72 }),
  ];

  // 2. ack 过滤
  const acks = await prisma.notificationCardAck.findMany({ where: { userId } });
  const filtered = candidates.filter(c => {
    const ack = acks.find(a => a.eventKind === c.kind && a.eventId === c.id);
    if (!ack) return true;
    // 法会按天 ack
    if (c.kind === 'dharmaAssembly') {
      return ack.ackedAt < startOfToday();
    }
    return ack.ackedVersion < c.editVersion;
  });

  if (filtered.length === 0) return null;

  // 3. 三层排序
  filtered.sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sev !== 0) return sev;
    const t = a.startAt.getTime() - b.startAt.getTime();
    if (t !== 0) return t;
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  });

  return filtered[0];
}
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

#### 撤回 API

`DELETE /api/coach/classes/:cid/announcements/:aid` · 软删 · 设 `revokedAt = now()`：

- ClassAnnouncement.revokedAt 写时间戳
- 关联 Notification 行不删 · 加 revokedAt 字段（schema 加）让通知中心展示「已撤回」
- 首页卡仲裁过滤 `revokedAt IS NOT NULL`
- 不发新 push（与 M2 一致）
- 已 ack 的 NotificationCardAck 行保留（无害）

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

#### 触发 endpoint 设计（diff-based · 单一 PATCH）

不开独立 cancel / reschedule endpoint · 统一走 `PATCH /api/coach/sessions/:sid` · service 层做 diff：

```ts
async function patchSession(sid, patch) {
  const before = await prisma.classSession.findUnique({ where: { id: sid } });
  const after = await prisma.classSession.update({ where: { id: sid }, data: patch });

  // 改时间（且未取消）
  if (before.startAt.getTime() !== after.startAt.getTime() && after.status !== 'cancelled') {
    await dispatchToUsers({
      eventKind: 'class_session', eventId: sid, tier: 'time_changed',
      severity: 'urgent', userIds: classMembers,
      title: `《${className}》共修时间调整`,
      body: `${after.title} · 改为 ${formatTime(after.startAt)}`,
      link: `/class/${classId}/sessions`,
    });
    await bumpEditVersion('classSession', sid);  // 让首页卡 ack 失效（M6 + 6.3）
  }

  // 取消
  if (before.status !== 'cancelled' && after.status === 'cancelled') {
    await dispatchToUsers({
      eventKind: 'class_session', eventId: sid, tier: 'cancelled',
      severity: 'critical', userIds: classMembers,
      title: `《${className}》共修取消`,
      body: `原定 ${formatTime(before.startAt)} 的共修已取消`,
      link: `/class/${classId}/sessions`,
    });
  }
}
```

理由：单一 endpoint 简化前端 · diff 逻辑集中 · 易测试。撤回 = status='cancelled' 而非 DELETE · 学员仍能在通知中心看到历史。

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

#### cron 去重 key

复用 `NotificationDispatchLog` 现有 unique `(eventKind, eventId, tier, userId)` 索引：

| tick | tier 值 |
|---|---|
| T-24h | `task_t24h` |
| T-6h | `task_t6h` |
| 完成（progress ≥ target）| `task_completed` |

cron 每 5 分钟扫所有 fixed task · 时间窗匹配的 user 先 `findUnique` log · 没记录才 dispatch + 写 log · 已存在 skip · 避免重复推送。

```ts
async function tickTaskDeadlines() {
  const tasks = await getActiveFixedTasks();
  for (const task of tasks) {
    const hoursUntilDeadline = (task.deadline - Date.now()) / 3_600_000;
    const tier = hoursUntilDeadline < 0 ? null
               : hoursUntilDeadline < 6 ? 'task_t6h'
               : hoursUntilDeadline < 24 ? 'task_t24h' : null;
    if (!tier) continue;
    for (const m of task.classMembers) {
      if (m.progress >= task.target) continue;
      const exists = await prisma.notificationDispatchLog.findUnique({
        where: { eventKind_eventId_tier_userId: { eventKind: 'practice_task', eventId: task.id, tier, userId: m.userId } },
      });
      if (!exists) await dispatchToUsers({ ..., tier });
    }
  }
}
```

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

#### 进程退出 flush（防 PM2 reload 丢成就）

```ts
const pendingMap = new Map<string, { items: string[]; timer: NodeJS.Timeout }>();

async function gracefulShutdown() {
  const tasks: Promise<void>[] = [];
  for (const [userId, { items, timer }] of pendingMap) {
    clearTimeout(timer);
    tasks.push(flushUnlockBatch(userId, items));
  }
  await Promise.allSettled(tasks);
  pendingMap.clear();
}

process.on('SIGTERM', gracefulShutdown);  // pm2 reload 走 SIGTERM
process.on('SIGINT', gracefulShutdown);   // 本地 ctrl+c
```

`pm2 reload juexue-api` 走 graceful shutdown：先发 SIGTERM · 等 `kill_timeout`（默认 1.6s · 可调到 5s）后再 SIGKILL · 此 hook 能赶上。
SIGKILL（OOM / `kill -9`）丢失接受 · 成就推送非必达 · 用户下次开 app 进通知中心仍可见（站内必发）。

部署需在 ecosystem.config.js 加：
```js
module.exports = { apps: [{ name: 'juexue-api', kill_timeout: 5000 }] };
```

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
  byTime: string;            // 'HH:mm' · Asia/Shanghai 本地时间（见时区策略）
  count?: number;            // 共 N 次（与 until 二选一）
  until?: string;            // ISO date
  exceptions?: string[];     // detach 出去的实例日期（不展开）
};
```

#### 时区策略（v2）

- 服务器锁定 `Asia/Shanghai` · 部署设 `process.env.TZ=Asia/Shanghai`（pm2 ecosystem.config.js）
- `master.startAt` 存 UTC（Prisma 默认）
- `byTime 'HH:mm'` 视为 **Asia/Shanghai 本地时间** · 展开时用 `Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' })` 算
- `byDay` 周几按 Asia/Shanghai 算（避免跨 UTC 日界出 bug）
- 个人提醒 / 共修 T-30 等调度复用此 timezone · 与 NOTIFICATION_PLAN 一致
- 跨时区用户（出差 / 海外）行为偏差不在 v2 范围 · 单独 issue 跟踪「i18n + multi-timezone」

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

#### 拆分时 NotificationCardAck 处理

「仅此次」/「此后」拆分时 · **不迁移 ack**：

| 场景 | 老 master ack 行为 | 新事件 ack 行为 |
|---|---|---|
| 仅此次 detach | 保留 · 老 master 截断 exceptions[date] · 该日期不再展开 → ack 自然失效 | 新 detached session 是新 id · 学员重新见到 → 重新 ack |
| 此后拆分 | 保留 · 老 master 加 until = 改动日 - 1 · 截断后实例不再展开 → ack 自然失效 | 新 master 是新 id · 学员重新见到 → 重新 ack |
| 全部改 | bumpEditVersion(master.id) · ack 失效（M6 规则）· 卡片重冒 | 同 master · 学员重新 ack 一次 |

理由：拆分本身就是大改 · ack 重置符合用户感知（"老师改了排期 · 我看到了 · 我 ack"）· 实现简单不易出错。

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

// 2b. 新表 · 法会容器（M12 · 合并 v2.5 字段）
model DharmaAssembly {
  id          String   @id @default(cuid())
  classId     String?  // null = admin 全平台法会
  class       Class?   @relation(fields: [classId], references: [id], onDelete: Cascade)
  title       String
  emoji       String   @default("🪷")
  description String?
  startAt     DateTime
  endAt       DateTime
  dailyWindowStart Int?  // 0-23 · null = 不限当日窗口
  dailyWindowEnd   Int?
  severity    Severity @default(urgent)  // 法会本身重要 · 抢首页卡
  status      String   @default("upcoming")
  // 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
  createdBy   String
  sessions    ClassSession[]  // assembly_child sessions · onDelete: Cascade
  createdAt   DateTime @default(now())
  @@index([classId, startAt])
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

// 8. SystemAnnouncement 撤回字段补
model SystemAnnouncement {
  ...
  revokedAt   DateTime?  // 软删 · 见 M2 撤回语义
}

// 9. ClassAnnouncement 撤回字段补
model ClassAnnouncement {
  ...
  revokedAt   DateTime?  // 软删 · 见 M8 撤回 API
}

// 10. Notification 撤回字段补（让通知中心展示「已撤回」）
// 注：deletedAt 已存在 · 表示「用户主动删」· 与 revokedAt（事件源撤回）语义不同 · 不复用
model Notification {
  ...
  revokedAt   DateTime?  // 关联事件撤回时同步置位 · 灰显但可见
  // deletedAt   DateTime?  // 现有 · 用户主动删 · 不展示
}
```

#### 删除级联（onDelete 规则）

| 主表删除 | 级联行为 | 实现 |
|---|---|---|
| `DharmaAssembly` 删 | 级联删 child sessions | `ClassSession.assembly` relation `onDelete: Cascade` |
| `ClassSession recurring_master` 删 | 级联删 detached children | `ClassSession.recurrenceParent` relation `onDelete: Cascade` |
| `Class` 删 | 级联删本班 announcements / sessions / tasks / assemblies | 现有 |
| `User` 删 | 级联删 NotificationCardAck 行 | NotificationCardAck.userId FK `onDelete: Cascade` |
| 任意事件删 | NotificationCardAck **不级联**（多态 eventKind 无 FK） | 应用层 weekly cron `cleanupOrphanAcks()` 删孤儿 |
| 事件 `revokedAt` 软删 | 站内 Notification 不删 · 加 `revokedAt` 同步 · 通知中心灰显 | service 层 trigger |

---

## 5. API 设计汇总

```
# 学员侧 · 首页卡 + ack
GET    /api/my/top-home-card                   v2 · 多源仲裁 + ack 过滤
POST   /api/my/card-ack                        body: { eventKind, eventId, version }
DELETE /api/my/card-ack/:kind/:id              取消 ack（重新冒出 · 测试用）

# 学员侧 · 偏好（per-type toggle · M2 / 6.2）
GET    /api/my/notification-prefs              当前 toggle / quiet hours / timezone
PATCH  /api/my/notification-prefs              修改任一字段
GET    /api/my/notifications                   通知中心列表（分页 20 · 含 revoked 灰显）
POST   /api/my/notifications/mark-all-read     全部已读
GET    /api/my/notifications/unread-count      badge 数（上限 99+）

# 学员侧 · Web Push 订阅（v1 已有 · 补列）
POST   /api/my/push-subscription               注册端点
DELETE /api/my/push-subscription/:endpoint     退订

# admin · 系统公告
POST   /api/admin/system-announcements         发系统公告
GET    /api/admin/system-announcements         列表
PATCH  /api/admin/system-announcements/:id     改
POST   /api/admin/system-announcements/:id/revoke  撤回（软删 · 见 M2）
DELETE /api/admin/system-announcements/:id     硬删（仅未发布）

# admin · 平台规则 + 监控
GET    /api/admin/notification-rules           平台默认规则
PATCH  /api/admin/notification-rules           改默认
GET    /api/admin/notification-stats           当日 dispatch 总量 / 失败率（见可观测性）

# coach · 班级公告撤回（M8）
DELETE /api/coach/classes/:cid/announcements/:aid   软删 · 设 revokedAt

# coach · session 改/取消（M9 · 单一 PATCH endpoint · diff-based）
PATCH  /api/coach/sessions/:sid                改时间 → urgent · status='cancelled' → critical

# v2.5 · 法会
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

#### 默认值 · 关闭语义

- 新用户注册 · 6 个 toggle **默认全开** · 与 v1 个人提醒一致
- 关掉只影响 push · 站内 Notification 必发（用户能在通知中心补看）
- 关闭 toggle 后 · 已发出去的历史 push 不撤回（自然消化）
- critical severity 事件**绕过 toggle**（紧急情况强制推 · 与静默 / 上限规则一致）

### 6.3 editVersion bump 规则

`editVersion` 用于让 NotificationCardAck 失效（M6）· 但若每次 update 都自动 bump · 会让无关字段改动也触发卡片重冒（如改 description · 学员被打扰）。

**规则**：service 层手动调 helper · 仅在**关键字段**变更时 bump：

```ts
async function bumpEditVersion(model: 'classSession' | 'classAnnouncement' | 'practiceTask', id: string) {
  await prisma[model].update({ where: { id }, data: { editVersion: { increment: 1 } } });
}
```

| 事件源 | 关键字段（变 → bump）| 非关键字段（变 → 不 bump）|
|---|---|---|
| ClassSession | startAt / endAt / title / status / severity | description / link / 内部 metadata |
| ClassAnnouncement | title / body / severity | (基本就这几个) |
| PracticeTask | title / target / deadline / severity | description |

不用 Prisma middleware · 因为 middleware 看不到字段语义 · 易误 bump。

### 6.4 通知中心 UI 规则

- 列表按 createdAt desc · 分页 20 条/页
- 不做 type 筛选（数据量小 · YAGNI · 后续根据用户量再加）
- 每条展示：icon (按 type) / 标题 / 摘要 / 时间相对值 / 未读圆点
- revoked 项灰色标签「已撤回」· 不计入未读
- 顶部 [全部已读] 按钮 · 调 `POST /api/my/notifications/mark-all-read`
- unread badge 上限 99+（超过 99 显示「99+」）

### 6.5 可观测性

- 不接 sentry（v2 范围外）· 用 pm2 log + structured logging
- 后端用 pino · dispatch 失败走 `log.error({ eventKind, eventId, userId, e }, 'dispatch_failed')`
- admin 后台 `/admin/notification-stats` 显示：
  - 当日 dispatch 总量（按 channel 拆 inapp / push）
  - 当日失败率（push 410 / 5xx 各计数）
  - 当日 push 上限触发用户数
  - 各 severity 占比
- 数据来源：NotificationDispatchLog 表 + pino log file 解析（轻量 · 不引 ELK）

---

## 7. 落地分期

> 实施顺序见**第 10 节 Phase 表**（按依赖 + 工期）· 第 7 节 Sprint 表已废弃合并到第 10 节避免双源不一致。

---

## 8. 开放问题汇总（决策清单）

> 32 条全部已落决策 · 详情见各模块章节

| 模块 | ID | 问题 | 决策 |
|---|---|---|---|
| M1 | Q1 | PWA 引导触发时机？ | ✅ 按需提示 · 用户点 push toggle 时检测 |
| M1 | Q2 | iOS 没装 PWA 怎么办？ | ✅ toggle 置灰 + 教程入口 |
| M1 | Q3 | 失败重试方案？ | ✅ setTimeout 队列 · 410 删 / 5xx 重试 3 次 (2/4/8s) |
| M2 | Q1 | 系统公告 admin UI 在哪建？ | ✅ /admin/notification-rules 加 tab |
| M2 | Q2 | 系统公告是单条还是批量？ | ✅ 全员 active · zh-CN 起步 |
| M2 | Q3 | 撤回语义？ | ✅ revokedAt 软删 · 通知中心灰显 · 不发新 push |
| M3 | Q1 | 放 HomePage 哪个位置？ | ✅ NotificationBell 下方 |
| M3 | Q2 | 几个 CTA？ | ✅ 视 severity · normal/urgent 双 CTA · critical 仅 [知道了] |
| M3 | Q3 | 多事件显示几条？ | ✅ 仅 top-1 · 其余走通知中心 |
| M4 | Q1 | 个人提醒进首页卡？ | ✅ 不进 · 仅 push + 通知中心 |
| M4 | Q2 | 同 severity 同时间 tiebreaker？ | ✅ kindRank 硬排序 |
| M4 | Q3 | 仲裁结果缓存？ | ✅ 不缓存 · 每次实时算 |
| M4 | Q4 | 候选时间窗？ | ✅ 每类事件独立窗口 |
| M5 | Q1 | severity 手动还是自动？ | ✅ 混合（默认自动 · 老师可覆盖） |
| M5 | Q2 | critical 谁能发？ | ✅ admin + 班级 coach |
| M5 | Q3 | T-0/T-5/T-30 算什么 severity？ | ✅ T-30 normal · T-5 urgent · T-0 critical |
| M6 | Q1 | ack 过期吗？ | ✅ 事件 editVersion+1 才重冒 · 不时间过期 |
| M6 | Q2 | 多设备 ack 同步？ | ✅ 后端表同步 · 60s refetch |
| M7 | Q1 | 用什么记 push 计数？ | ✅ DispatchLog 加 channel 字段 |
| M7 | Q2 | critical 算上限吗？ | ✅ critical 绕过上限 |
| M7 | Q3 | 用户能调上限吗？ | ✅ 不能 · 系统硬限 3 条 |
| M8 | Q1 | 公告默认 severity？ | ✅ normal · 重要勾选 → urgent |
| M8 | Q2 | 编辑公告触发新 push？ | ✅ 不触发 · editVersion+1 让首页卡重冒即可 |
| M8 | Q3 | 撤回 API？ | ✅ DELETE 软删 · revokedAt 同步 |
| M9 | Q1 | session 改时间再发？ | ✅ urgent 改时间通知 |
| M9 | Q2 | session 取消通知？ | ✅ critical 取消通知 |
| M9 | Q3 | 触发 endpoint 设计？ | ✅ 单一 PATCH · service 层 diff |
| M10 | Q1 | daily 走哪？ | ✅ v1 个人提醒覆盖 · M10 仅 fixed |
| M10 | Q2 | 截止后发？ | ✅ 仅完成发祝贺 · 未完成不发 |
| M10 | Q3 | 任务 severity 默认？ | ✅ 混合 · 默认 normal · T-6h 自动升 urgent |
| M10 | Q4 | cron 去重 key？ | ✅ DispatchLog tier='task_t24h/t6h/completed' |
| M11 | Q1 | 成就进首页卡？ | ✅ 不进 · 仅 push + 通知中心 |
| M11 | Q2 | 多成就合并？ | ✅ 5 分钟窗口聚合 · in-memory Map + SIGTERM flush |
| M12 | Q1 | recurring 怎么存？ | ✅ RRULE 单行 + 按需展开 |
| M12 | Q2 | Assembly ack 颗粒度？ | ✅ 按天 ack · key=`${aid}:${YYYY-MM-DD}` |
| M12 | Q3 | recurring 改单场？ | ✅ 仅此次/此后/全部 三选 |
| M12 | Q4 | 法会 push 频率？ | ✅ 默认聚合 + 老师可勾「场场提醒」 |
| M12 | Q5 | 时区策略？ | ✅ 服务器锁 Asia/Shanghai · byTime 视为本地 |
| M12 | Q6 | 拆分时 ack 迁移？ | ✅ 不迁移 · ack 自然失效 + 重 ack |
| 横切 | - | per-type toggle 默认值？ | ✅ 全开 · critical 绕过 toggle |
| 横切 | - | editVersion bump 谁加？ | ✅ service 层手动 helper · 仅关键字段 |
| 横切 | - | 删除级联策略？ | ✅ DharmaAssembly/master 级联 child · ack 走 cron 清孤儿 |
| 横切 | - | 通知中心 UI？ | ✅ 分页 20 · 全部已读 · badge 99+ |
| 横切 | - | 可观测性？ | ✅ pino + DispatchLog · admin /notification-stats |
| 遗留 | - | 单设备登录政策？ | ⏸ v2 范围外 · 单独 issue 跟踪 |
| 遗留 | - | 跨时区用户？ | ⏸ v2 范围外 · 单独 issue 跟踪 |

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

| 阶段 | 模块 | 工期 | 依赖 | 备注 |
|---|---|---|---|---|
| Phase 1 | **M5** Severity 三档 + **M6** Ack 表 + **M7** channel 字段 + 撤回字段（M2/M8/Notif）+ editVersion 字段 | 1 天 | 仅 schema 变更 | `prisma db push` · 不破坏现状 · 含所有 6.3 字段 |
| Phase 2 | **M2** 系统公告 admin UI + 表 + 撤回 | 1 天 | M5 | admin /notification-rules 加 tab |
| Phase 3a | **M8** 班级公告 push + 撤回 API · **M9** 共修首发/变更/取消（diff PATCH）· **M10** 任务 push + cron tick + 去重 · **M11** 成就 push + SIGTERM flush | 2.5 天 | M5/M6/M7 | 各 service 末尾加 dispatch · cron 加新 tick · 加 bumpEditVersion helper |
| Phase 3b | **M12** 排期模式扩展（recurring + DharmaAssembly + RRULE 展开 + 时区锁定）| 2 天 | M5/M6/M7 | 可与 3a 并行 · 风险高单独评估 |
| Phase 4 | **M4** 多源仲裁 API + kindRank + 时间窗 + ack 过滤 · **M3** UpcomingEventCard 组件 + HomePage 集成（NotificationBell 下方）+ severity 三档样式 | 2 天 | Phase 3a 完成 · 3b 可后接 | UI 终点 |
| Phase 5 | **M1** PWA 引导 sheet + iOS 检测 + 教程页 + retry 队列 | 1 天 | 独立 | 任意时段做 · 真机验证 |
| Phase 6 | per-type toggle UI · 通知中心 UI 完善 · admin /notification-stats · weekly cron cleanupOrphanAcks | 1 天 | Phase 4 | 横切收口 |
| **合计** | | **~10.5 天** | | M12 (3b) 是浮动项 · 不做则 8.5 天 |

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
