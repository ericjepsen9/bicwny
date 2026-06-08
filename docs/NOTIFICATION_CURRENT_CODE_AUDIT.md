# 觉学通知系统 · 现有代码审计（v2 实施前盘点）

> 状态：2026-05-15
> 范围：后端 8 个模块 + 前端 6 个目录 · 找阻塞 / 垃圾 / 重构清单
> 目的：清场 · 为 v2 实施铺路（不污染 v2 设计的同时利用现有可复用骨架）

---

## 1. 总览

**评估：半残 · 局部能用 · 距离 v2 需大改但有可复用骨架。**

- 现状只覆盖 9 类事件源中的 **2.5 类**（① 共修 T-30/T-5/T0 · ② 班级公告 · ④ 个人三档提醒）
- ② 班级公告**完全绕过 dispatchToUsers**（无幂等无 push · 学员从不收到推送）
- `NotificationType` enum 只有 6 个旧值 · 不支持 v2 severity / contentHash / revokedAt（schema 加了字段但 service / routes 全没用）
- PushSubscription 软删字段已加但 send 路径没过滤 → 单设备登录改造无效
- 前后端字段不一致（`isRead` vs `read`）现有页面靠 bug 共存

**可复用骨架**：
- `dispatch.ts` 幂等结构
- `push/service.ts` 410 清理逻辑
- `scheduler/cron.ts` 60s tick + 重入锁
- `personal-reminders.ts` 时区窗口算法
- `sw.js` 整体（仅微调 safeLink）

---

## 2. 阻塞级问题（7 项 · 必修才能进 v2）

| # | 文件 | 问题 |
|---|---|---|
| 🚨 1 | `juexue-v2/src/pages/NotificationPage.tsx:54-164` | 前端读 `n.read` · 后端返 `n.isRead` · 所有未读高亮 / hasUnread / counts.unread 全错（header 红点反而对的因为走独立 endpoint）。**v2 做未读分组前必须先统一。** |
| 🚨 2 | `backend/src/modules/announcements/service.ts:88-103` | `notifyClassMembers` 直接 `prisma.notification.createMany` · 完全绕过 dispatchToUsers：无 DispatchLog 幂等（重复发布会重发）/ 无 web-push 推送 / 无 severity contentHash · v2 撤回 + dismissal 无法实现 |
| 🚨 3 | `backend/src/modules/feedback/service.ts:121` | 反馈处理 `tx.notification.create` 直写 · 同上 |
| 🚨 4 | `backend/src/modules/reports/service.ts:244-258` | 用旧 `createNotification` + `sendPushToUsers` 分两步 · 无 DispatchLog · link 写 `'notification.html'`（旧 prototype 路径）SW 校验后兜底跳 `/app/` 丢上下文 |
| 🚨 5 | `juexue-v2/public/sw.js:120-124` | `safeLink` 只接受 `/app/` 前缀 · 但后端 dispatch.ts:64 link 形如 `/class/${classId}`（无 `/app/`）· **所有 push click 兜底跳首页**（spec §19.1 要求接受所有 `/` 开头同源） |
| 🚨 6 | `backend/prisma/schema.prisma:215-222` | `NotificationType` enum 写死 6 值 · 不含 v2 需要的 `practice_task` / `dharma_assembly` / `membership_change` / `system_announcement` · 也没 severity 列。enum 改动需 migration · 建议改为 `String` + `eventKind/tier/severity` 三列 |
| 🚨 7 | `backend/src/modules/push/service.ts:50,63` | `findMany` 没过滤 `isActive: true` · schema 加了软删字段但发送路径没用 · 单设备登录改造后旧设备仍会收 push |

---

## 3. 高优问题（6 项）

| # | 文件 | 问题 |
|---|---|---|
| ⚠️ 8 | `backend/src/modules/scheduler/dispatch.ts:7` | `EventKind / Tier / NotifType` 写死 4/4/3 枚举值 · v2 要扩到 9 类事件 + 多 tier · 调用方加新事件会编译失败。**改 `string` + 运行时校验** |
| ⚠️ 9 | `backend/src/modules/scheduler/dispatch.ts:31-121` | 不接收 `severity` / `contentHash` / `link 校验` / `channel` 参数 · 现有版本只写 inbox + push 两通道无独立 channel 字段 · 必须扩参数（spec §12 入口完整） |
| ⚠️ 10 | `backend/src/modules/scheduler/cron.ts:11-23` | 只有 T-30/T-5/T0 三档 · spec ① 要 created/time_changed/cancelled/t24h/t30/t5/t0 七档 · 且 time_changed/cancelled 是事件驱动不是 cron 驱动。**需补「事件即时分发」入口**（CRUD hook） |
| ⚠️ 11 | `backend/src/modules/classes/sessions/service.ts:94-102` | 改 startAt/title 时 `deleteMany` 整个事件的 DispatchLog · 删了审计 + 删了未来 T-30/T-5/T0 去重 · 但**没发 time_changed 通知**（spec 要 urgent push） |
| ⚠️ 12 | `backend/src/modules/notifications/prefs.routes.ts:62-75` | `NotificationRule` 表只为三档个人提醒服务 · spec §8 要 `NotificationPreference` 独立表（pushTypes Json / home glass card / sms 子开关）。**当前 prefs 写在 `User` 表 8 字段 · 需迁移** |
| ⚠️ 13 | `juexue-v2/src/lib/queries.ts:319` | `NotificationItem.read` 应为 `isRead` · 类型与后端一致后才能消除 #1 bug |

---

## 4. 中优 + 低（7 项 · 不阻塞）

| # | 文件 | 问题 |
|---|---|---|
| 💡 14 | `backend/src/modules/scheduler/personal-reminders.ts:159-278` | `runEveningDue` / `runDailyDigest` / `runWeeklyReport` 三个函数 90% 重复 · 重构为 generic runner（净减 ~80 行）|
| 💡 15 | `backend/src/modules/scheduler/dispatch.ts:55-104` | P2002 fallback 块完全重复事务体（17 行 dup）· 抽内部 `insertOneSafe(tx, uid)` |
| 💡 16 | `backend/src/modules/courses/cover.service.ts:170-192` | 直接 `unlink` · S1 要改为 `OrphanedFile` 标记 7 天后 GC（v2 阻塞工作之一）|
| 💡 17 | `backend/src/modules/notifications/service.ts:90-110` | `createNotification` 是 v1 旧 API · 仅被 reports 用 · 应该退役 |
| 💡 18 | `juexue-v2/src/lib/sw-register.ts:17` | `import.meta.env.DEV` 时不注册 SW · dev mode 完全无法测 push / banner · spec §6 §10 大量 SW 逻辑无法本地验 |
| 📝 19 | `backend/src/modules/scheduler/cron.ts:115` | `config.CRON_ENABLED` 检查 + `timer/running` 模块级变量没法切单元测试（重入态泄漏）|
| 📝 20 | `backend/prisma/schema.prisma:343` | `NotificationDispatchLog.channel` 默认 `"push"` · 但 v1 写 inbox+push 同一行 · 把 inbox 和 push 混算频率上限。spec §19.3 要求按 channel 分计 |

---

## 5. 垃圾代码清单（可直接删 · 总计 ~150 行净减）

| 文件 / 函数 | 行数 | 删除理由 |
|---|---|---|
| `backend/src/modules/notifications/service.ts:90-110` `createNotification` | 21 | v1 遗留 · 仅 reports 用 · 迁后删 |
| `backend/src/modules/announcements/service.ts:88-103` `notifyClassMembers` | 16 | 必须重写 · 旧版直接删 |
| `backend/src/modules/push/routes.ts:86-97` `/api/push/test` | 12 | admin 测试用 · 接入 `/admin/notification-test` 后冗余（保留 dev · prod 限 admin） |
| `backend/src/modules/scheduler/personal-reminders.ts:159-278` 三 runner | ~80 | 合并 generic runner 后净减 |
| `juexue-v2/src/lib/queries.ts:319` `data?: Record<string, unknown>` | 1 | 字段从未被后端返回 |
| `docs/NOTIFICATION_PLAN.md` + `NOTIFICATION_V2_LAYERED_ARCH.md` + `NOTIFICATION_V2_DESIGN.md` | — | 已被 spec 取代 · 建议移到 `docs/archive/` |

---

## 6. v2 实施前 · 重构优先级（按对推进的影响）

| 序 | 任务 | 阻塞性 | 工时 |
|---|---|---|---|
| 1 | 修 `n.read / n.isRead` 字段不一致 | 阻塞所有未读 UI | **5 分钟** |
| 2 | `NotificationType` enum → `String` + `eventKind/tier/severity` 列（schema migration）| 阻塞所有后续 | 0.5 天 |
| 3 | 扩 `dispatchToUsers` 入口：加 `severity` / `link 校验`（§19.1）/ `channel` / `eventKind: string` · 按 channel 分别写 DispatchLog（§19.3）| 阻塞所有事件源接入 | 1 天 |
| 4 | `announcements/service.ts` `notifyClassMembers` 重写走 dispatch（顺带获得 push + 幂等）| 第一个旧迁移 | 0.5 天 |
| 5 | `push/service.ts` 加 `isActive: true` 过滤（§19.2 实施前置 · 否则单设备登录无意义）| 阻塞单设备登录 | 1 行改 |
| 6 | `sw.js` `safeLink` 改为只要 `/` 开头同源就放行（§19.1）+ 后端 `dispatch.ts` 统一 link 输出格式（去 `home.html` / `notification.html` 等旧路径）| 解决所有 push click 跳兜底问题 | 0.5 天 |
| 7 | `User` 表 8 个 reminder 字段迁移到 `NotificationPreference` 独立表 | 阻塞 push 子开关 / homeCard 开关 | 1 天 |
| 8 | `reports/service.ts` + `feedback/service.ts` 改用 dispatchToUsers · 删 v1 `createNotification` | 收尾 v1 旧路径 | 0.5 天 |
| 9 | `courses/cover.service.ts` 接 `OrphanedFile` GC（S1 任务）| 与通知并行 | 0.5 天 |
| 10 | `scheduler/cron.ts` 抽 generic runner + 准备事件即时分发钩子（time_changed / cancelled 路径）| 多 tier 事件源接入 | 1 天 |

**总计准备工时 ~6 天** · 完成后进入 v2 主线（S1-S5 总 ~8 周）。

---

## 7. 整体推荐策略

### 渐进式 · 保留骨架 · 替换关键路径。

**保留**：
- `dispatch.ts` 幂等结构 + `NotificationDispatchLog`（已有 channel 字段 · 扩参即可）
- `push/service.ts` 整个发送 + 410 清理逻辑
- `scheduler/cron.ts` 60s tick 框架 + `running` 重入锁
- `personal-reminders.ts` 时区窗口算法 + `time-utils.ts`
- `sw.js` 整体（仅改 `safeLink`）
- `prefs.routes.ts` 平台规则部分（admin 后台 UI 可继续用）

**重写**：
- `NotificationType` enum（schema 迁移 · 一次性）
- `announcements/service.ts` 通知路径
- `feedback/service.ts` + `reports/service.ts` 通知路径
- 前端 `NotificationPage.tsx` 字段名 + 增加 severity / revokedAt 显示
- `User` 表 reminder 字段 → 独立 `NotificationPreference` 表（含 backfill）

**新建**（不在现有代码上 patch）：
- 5 个新事件源 service：PracticeTask / Achievement / SystemAnnouncement / DharmaAssembly / MembershipChange
- `ActiveBanner` 表 + `/api/me/active-banners` 路由 + 前端 BannerHost 组件
- `OrphanedFile` GC cron
- 首页 `GET /api/me/home-summary` 单接口（§7.4）
- SMS 整套（Twilio + 模板 + Broadcast）— 最后做

**不要做的事**：
- ❌ 不要 v2 旁路重建 Notification 表 · spec §15 shadow 模式是同表双写 + global mode 字段切换 · 不需要双表
- ❌ 不要先动 UI · 数据层 / 入口层不稳前端无意义
- ❌ 不要一次推全套 · 按优先级分 commit · 每个独立可回滚

---

## 8. 关键文件路径汇总

### 后端
- `backend/src/modules/notifications/service.ts` · `routes.ts` · `prefs.routes.ts`
- `backend/src/modules/push/service.ts` · `routes.ts`
- `backend/src/modules/scheduler/dispatch.ts` · `cron.ts` · `personal-reminders.ts`
- `backend/src/modules/announcements/service.ts`
- `backend/src/modules/classes/sessions/service.ts`
- `backend/src/modules/reports/service.ts`
- `backend/src/modules/feedback/service.ts`
- `backend/src/modules/courses/cover.service.ts`
- `backend/prisma/schema.prisma`

### 前端
- `juexue-v2/src/lib/push.ts` · `sw-register.ts` · `queries.ts`
- `juexue-v2/src/pages/NotificationPage.tsx`
- `juexue-v2/src/pages/SettingsNotificationsPage.tsx`
- `juexue-v2/src/pages/AdminNotificationRulesPage.tsx`
- `juexue-v2/public/sw.js`

---

## 9. 与 FINAL_SPEC 的衔接

本审计聚焦「现状能不能直接进 v2」· 答案是：**先做 6 天准备工作 · 再进 v2 主线**。

准备工作清单已映射到 spec §14 排期：
- 准备 1-6 → S1 第一周（基础设施 · schema migration · dispatch 入口）
- 准备 7-8 → S2（接入旧事件源时一并迁）
- 准备 9-10 → 与 S1 / S2 并行

总工时：6 天准备 + 8 周 v2 主线 = **~9 周**（加独立审计的 1-1.5 周 · 总 ~10.5 周）。
