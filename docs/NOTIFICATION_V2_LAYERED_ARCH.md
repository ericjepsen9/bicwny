# 觉学 · 通知系统 v2 · 分层架构决策（本次会话产出）

> 状态：🟡 进行中（2026-05-15）· 已完成第 1-2 层 + 数据新鲜度 + 单设备策略 · 待续第 3 层（三通道路由）
>
> 关联：`NOTIFICATION_V2_DESIGN.md`（模块化总图 · 1498 行）· `NOTIFICATION_PLAN.md`（v1 框架）· `PERSONAL_REMINDERS_V1.md`
>
> 这份文档是从「事件流」视角重新组织 v2 决策 · 与原 12 模块文档**互补不冲突**。若两份冲突 · 以本文档（更新日期更近）为准。

---

## 第 1 层 · 事件源（9 类 · 谁产生通知）

所有事件源通过统一入口 `dispatchToUsers({ eventKind, eventId, tier, userIds, severity, title, body, link, scopes, notificationType })` 进入下游通道。

| # | 事件源 | 触发时机 | severity 决策 | 通道 | 当前实现 |
|---|---|---|---|---|---|
| ① | ClassSession 共修 | 创建 / 改时间 / 取消 / T-24h 预告 / T-30 / T-5 / T-0 | T-30 normal · T-5 urgent · T-0 critical · 改/取消 urgent/critical | 站内 + push + 首页卡 | T-30/5/0 ✅ |
| ② | ClassAnnouncement 班级公告 | 辅导员发 / 撤回 | normal · 老师可手动升 urgent | 站内 + push + 首页卡 | 站内 ✅（createMany 需改 dispatchToUsers）· push ❌ |
| ③ | PracticeTask 修学任务 | 创建 / T-24h 未完成 / T-6h 未完成 / 完成 | 默认 normal · T-6h 自动升 urgent | 站内 + push（仅 fixed 模式）+ 首页卡 | ❌ |
| ④ | Personal Reminder 个人提醒 | 临期 19:00 / 日报 20:00 / 周报周一 08:00 | normal | 站内 + push（不进首页卡）| ✅ v1 已通 |
| ⑤ | Achievement 成就 | 用户解锁 · 5 分钟窗口聚合 | normal | 站内 + push（不进首页卡）| ❌ |
| ⑥ | SystemAnnouncement 系统公告 | admin 发布 / admin 撤回 | normal / urgent / critical 三选 | 站内 + push + 首页卡 | ❌ · 需新建表 |
| ⑦ | DharmaAssembly 法会（M12）| 法会创建 / 每日首场前聚合 / 进行中卡片 | 默认 urgent | 站内 + push + 首页卡 | ❌ |
| ⑧ | AuspiciousDay 藏历加持日 | 当日 00:00 - 23:59 | normal | **仅首页卡（不发 push）** | 数据已有 · 未接通 |
| ⑨ | MembershipChange 班级成员变动 | 被踢出 / 加入新班 / 班级解散 | 被踢/解散 urgent · 加入 normal | **仅站内铃铛（不发 push · 不进首页卡）** | ❌ |

### 关键设计点

**A. tier 语义**（同一 eventId 多 tier 各发一次 · 不撞 unique 索引）：
- 共修：`created` / `time_changed` / `cancelled` / `t24h` / `t30` / `t5` / `t0`
- 任务：`created` / `task_t24h` / `task_t6h` / `task_completed`
- 公告：`-`（单 tier · 不重发）
- 成员：`kicked` / `joined` / `class_dissolved`

**B. severity 自动+手动混合**：
- 系统按规则自动定 default（如 T-6h 未完成自动升 urgent）
- 老师在创建 UI 可手动覆盖（dropdown）
- 系统仅「自动加严」· 不自动降级

**C. 不进首页卡的事件源**（M4.Q1 决策）：
- 个人提醒（④）：「自己提醒自己」会喧宾夺主
- 成就（⑤）：被动事件 · 用户主动来看
- 班级成员变动（⑨）：身份变动只在铃铛留记录 · 不打扰

**D. 不发 push 的事件源**：
- 藏历加持日（⑧）：一天一次 · 不打扰
- 班级成员变动（⑨）：身份变动不算时效性事件

---

## 第 2 层 · 首页卡仲裁（单槽位竞争）

### A. 核心原则

**没事 = 没卡**。首页卡只有 1 个槽位 · 没有活跃事件时区域完全塌缩 · 不渲染 DOM。**卡 = 用户需要注意 / 行动的东西**。

### B. 4 档窗口结构（以共修为例 · 任务/法会类似）

| 档 | 触发 | severity | 文案 | 可关闭 |
|---|---|---|---|---|
| **预告档** | 共修开始前 24h（前一晚 19:00 起）| normal | 明日 19:00 · 周共修 | ✅（dismiss 到 T-30 重现）|
| **临近档** | T-30 → T-5 | normal | 30 分钟后开始 | ❌ |
| **倒数档** | T-5 → T-0 | urgent | 即将开始 · 准备就绪 | ❌ |
| **进行中** | T-0 → end | critical | 共修进行中 · 进入直播间 | ❌ |

PracticeTask 用 2 档：T-24h 预告 + T-6h 紧急。
DharmaAssembly 用 2 档：T-24h 预告 + 进行中。

### C. 优先级表（分越高越优先）

| 分 | 事件 | 窗口 | 可关闭 |
|---|---|---|---|
| 1000 | critical SystemAnnouncement | 发布 → expiresAt | ❌ |
| 950 | ClassSession 进行中 (T-0) | start → start+duration | ❌ |
| 920 | DharmaAssembly 进行中 | start → end | ❌ |
| 900 | ClassSession T-5 倒数 | start-5min → start | ❌ |
| 800 | ClassSession T-30 临近 | start-30min → start-5min | ❌ |
| 700 | urgent SystemAnnouncement | 发布 → expiresAt | ✅ |
| 650 | urgent ClassAnnouncement（未读）| 发布 → 24h or 已读 | ✅ |
| 600 | PracticeTask T-6h（auto-urgent）| 截止前 6h → 截止 | ❌ |
| 550 | DharmaAssembly 今日未开始 | 当日 00:00 → start | ✅ |
| 500 | ClassSession 预告档 (T-24h) | 前一晚 19:00 → T-30 | ✅ |
| 400 | normal ClassAnnouncement（未读）| 发布 → 24h or 已读 | ✅ |
| 350 | PracticeTask T-24h | 截止前 24h → 截止前 6h | ✅ |
| 300 | normal SystemAnnouncement | 发布 → expiresAt | ✅ |
| 200 | AuspiciousDay | 当日全天 | ✅ |
| **无** | 没有任何活跃事件 → 不渲染卡 · 区域塌缩 | — | — |

**并列规则**：分相同 → 取 `createdAt` 最新 → 再相同取 `eventId` 大者（确定性）。

### D. 关键决策

- **critical 系统公告 > 进行中共修**：critical 是 admin 主动按下的红色按钮（如「平台 22:00 停服维护」）· 不能被任何用户场景压住
- **进行中 (T-0) > T-5 > T-30**：共修紧迫度单调上升 · T-5 起任何事都不能抢（除 critical）· 保证学员临场专注
- **PracticeTask T-6h 不可关闭**：和 T-5 同等紧迫感 · 关掉会让用户错过 deadline · 反对用户短期偏好的取舍

### E. dismissal 模型

```prisma
model HomeCardDismissal {
  id           String   @id @default(cuid())
  userId       String
  eventKind    String   // 'class_session' / 'announcement' / ...
  eventId      String
  contentHash  String?  // 公告等内容可变的事件 · 内容变 → dismissal 失效
  dismissedAt  DateTime @default(now())
  
  @@unique([userId, eventKind, eventId])
  @@index([userId])
}
```

- 只压制**同一 eventId**的卡
- 内容更新（contentHash 变）→ dismissal 自动失效 · 用户再次看到
- dismissal 只影响首页卡 · 站内铃铛仍保留
- **存数据库**（不走 localStorage）· 支持「换设备数据恢复」

### F. 仲裁刷新时机

| 触发 | 动作 |
|---|---|
| 用户进首页 / 切 tab 回前台 | 重新拉 `/api/home/active-card`（focus refetch）|
| 卡上的 countdown 跨阈值 | 前端本地推进 · 不重拉 |
| 新通知 push 到达前端 | SW invalidate ['home'] |
| TTL 窗口过期 | 前端 setTimeout 触发 invalidate |
| 用户 dismiss | 乐观更新 + 后台写 dismissal · 重算赢家 |

### G. API 返回结构

```ts
GET /api/home/active-card → {
  card: {
    eventKind: 'class_session' | 'class_announcement' | ...,
    eventId: string,
    tier: string,
    priority: number,        // 调试用
    severity: 'normal' | 'urgent' | 'critical',
    title: string,
    body: string,
    cta: { label: string, link: string } | null,
    dismissible: boolean,
    expiresAt: string,       // ISO · 前端用来 setTimeout
  } | null
  // card 为 null 时前端不渲染卡 · 区域塌缩
}
```

---

## 第 2.5 层 · 卡片自动消失（3 条规则）

### A. 三条规则（互斥 · 不重叠）

| # | 规则 | 触发依据 | 例子 |
|---|---|---|---|
| **A** | **窗口结束** | 到 `expiresAt` | 共修结束 / 公告满 24h / 任务截止 |
| **B** | **已应答** | 用户做出卡片期望的动作 | 公告点开 / 任务完成 / 进入直播间 |
| **C** | **静默衰减** | 长时间无交互（仅 normal 适用）| 周四 19:00 上「明日共修」· 周五 03:00 自动隐 · 到 T-30 再现 |

### B. 每事件源明细

| 事件 / 档位 | A 窗口结束 | B 已应答 | C 静默衰减 |
|---|---|---|---|
| 共修 T-24h 预告 | 切到 T-30 时档位升级 | 点「设置提醒」→ T-30 重现 | 8h |
| 共修 T-30 临近 | 切到 T-5 | — | ❌ |
| 共修 T-5 倒数 | 切到 T-0 | — | ❌ |
| 共修进行中 | 实际结束时间 | 进入直播间 → 缩成右下角徽章 | ❌ |
| 任务 T-24h | 切到 T-6h | 标记完成 → 消失 | 8h |
| 任务 T-6h | 截止时间到 | 标记完成 → 消失 | ❌ |
| 班级公告 normal | 发布 + 24h | 点开标记已读 → 消失 | 8h |
| 班级公告 urgent | 发布 + 72h | 点开标记已读 → 消失 | ❌ |
| 法会预告 | 法会开始时切档 | 点「了解详情」→ dismiss | 24h |
| 法会进行中 | 法会结束时间 | 进入参与页 → 缩成徽章 | ❌ |
| 藏历加持日 | 当日 23:59 | 点开了解 → dismiss | ❌ |
| 系统公告 normal | expiresAt | 点「我知道了」→ dismiss | 8h |
| 系统公告 urgent | expiresAt | 点「我知道了」→ dismiss | ❌ |
| 系统公告 critical | expiresAt 或 admin 撤回 | **不可应答 · 不可关闭** | ❌ |

### C. 关键澄清

- **「档位升级」≠ 消失**：同一 eventId 不同 tier · 前端体验是「卡片内容自动变化」带 200ms 过渡 · 不闪烁重建
- **静默衰减后不会永久消失**：到下一档窗口（T-30 / T-6h）会重新评估出现 · 用户绝不会因衰减错过共修开始
- **已应答 vs 已 dismiss**：
  - 已应答 = 完成卡片期望任务 → 该 eventId 永久不再出现
  - 已 dismiss = 主动赶走当前档但任务未做 → 同 eventId 在下一档可重新出现

### D. 边界场景

1. **任务被辅导员退回**：状态由 done → pending · eventId 复用 · 卡片重新出现
2. **共修开始后被取消**：进行中卡立即消失 · 改写一条「已取消」通知入铃铛 · 不上首页卡
3. **离线时窗口已过**：上线后后端按当前时间过滤 · 不返回过期卡
4. **dismiss 后老师改了公告内容**（contentHash 变化）→ dismissal 失效 · 卡重新出现

### E. 后端实现（一行 SQL 思路）

```ts
// /api/home/active-card 查询时过滤
where: {
  expiresAt: { gt: now },                                  // 规则 A
  NOT: { answeredByUser: { has: userId } },                // 规则 B
  OR: [                                                    // 规则 C
    { severity: { in: ['urgent', 'critical'] } },
    { createdAt: { gt: now - 8h } },
    { interactedBy: { has: userId } }
  ]
}
```

---

## 第 2.6 层 · 液态玻璃「本周安排」入口

### A. 设计原则

首页 hero 画报区域右下角浮动玻璃 pill · 完全透明背景 + 模糊 · 不打断画报美感 · 给用户「主动查看排期」的入口（替代「默认卡」给确认感）。

### B. CSS 规格

```css
.schedule-glass-pill {
  position: absolute;
  right: 16px;
  bottom: 16px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 0.5px solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
```

### C. 5 个交付细节

1. **底图深浅自适应**：画报可能换浅色 cover。在 cover meta 标注 `theme: 'light' | 'dark'` · 浅底切换为 `rgba(0,0,0,0.15)` 背景 + 深色文字
2. **iOS 兼容**：iOS < 15 不支持 backdrop-filter saturate · 但 blur 都支持 · 直接用。Android Chrome OK
3. **首页有 active card 时**：按钮移到 card 内右下角（或暂时隐藏）· 不重叠
4. **点击反馈**：iOS 风格 0.95 scale + 80ms 过渡 · 不要涟漪
5. **不占文档流**：absolute 定位 · 不影响下方内容布局

### D. 塌缩动画

切换有卡 ↔ 无卡：`framer-motion` AnimatePresence · 卡片高度 + opacity 同步过渡 200ms。

---

## 第 X 层 · 单设备登录 + 数据云端同步

### A. 策略

- **不支持多端登录**：新登录强制踢旧 session
- **所有数据云端存**：换设备登录可恢复全部状态（通知 / dismiss / 任务进度 / 偏好）

### B. 实现

```prisma
// User 表加字段
model User {
  ...
  currentSessionId String?   // 登录时覆写
  currentSessionAt DateTime? // 时间戳
}
```

中间件每次校验 · 不匹配则 401 + 强登出。

### C. 简化效果

| 原本要考虑 | 简化后 |
|---|---|
| 跨设备 dismissal 同步 | ❌ 删 |
| 多 push token 管理 | 一用户一 token · 新登录覆盖 |
| (userId, deviceId) 复合维度 | 全部退化为 userId |
| 通知 read 状态去重 | (userId, notificationId) 单一来源 |

---

## 第 Y 层 · 数据新鲜度（首页内容延迟）

### A. 现状（已确认 · 不需改造）

**PWA / Push 链路完整存在**：
- `juexue-v2/public/sw.js` 注册 + push 事件
- `juexue-v2/src/lib/push.ts` 订阅
- `backend/src/modules/push/` web-push + VAPID
- `PushSubscription` 表已存在

**Cover 文件名天然带 hash**：
- 命名 `${courseId}-${randomBytes(8).toString('hex')}-1024.webp`
- 每次上传新 random hex → 新 URL → 浏览器必拉新图
- **不需要加 imageHash 字段** · 不需要改上传逻辑
- nginx 7 天缓存配置安全（URL 永不重复）

### B. 旧 cover 文件 · 业务逻辑驱动的「被动 GC」

```prisma
model OrphanedFile {
  id           String   @id @default(cuid())
  filePath     String
  variantPaths String[] // 同时记 320/640/1024 三个尺寸
  markedAt     DateTime @default(now())
  
  @@index([markedAt])
}
```

替换 cover 时：
1. 不立即 unlink · 而是写一条 OrphanedFile 记录
2. 同事务里跑 `gcOrphanedFiles`（删 markedAt < now - 7d 的）
3. `juexue-api` 进程启动时再跑一次（pm2 reload 即兜底）

**优点**：零额外进程 · 零独立 cron · 流量驱动。

### C. 首页新鲜度三层（砍轮询）

| 层 | 实现 | 延迟 | 服务器压力 |
|---|---|---|---|
| 1. **Push invalidate** | SW 收到业务 push → postMessage → 前端 invalidate query | 1-3 秒 | 零额外（复用业务 push）|
| 2. **Focus refetch** | React Query refetchOnWindowFocus | 切回前台立即 | 极低 |
| 3. **轮询** | **不开**（决策：砍）| — | 零 |

兜底：用户主动下拉刷新。

### D. Push payload 自带 scopes（解耦后端 / 前端）

后端只暴露**业务域** · 不耦合 React Query key 实现：

```ts
// 后端发 push
sendPush({
  title, body, link,
  scopes: ['home', 'class:123:announcements']  // 业务域
});

// 前端 SW message handler
const scopeToKeys: Record<string, QueryKey[]> = {
  'home': [['home', 'active-card']],
  'class:*:announcements': [['classes', classId, 'announcements'], ['notifications']],
  'tasks': [['tasks'], ['home', 'active-card']],
};
```

**事件 → scopes 自动映射表**（后端 dispatchToUsers 内部维护）：

| 事件 | scopes |
|---|---|
| ClassSession created/changed | `['home', 'class:N:sessions']` |
| ClassAnnouncement | `['home', 'class:N:announcements', 'notifications']` |
| PracticeTask | `['home', 'class:N:tasks', 'tasks']` |
| Achievement | `['notifications', 'achievements']` |
| SystemAnnouncement | `['home', 'notifications']` |
| MembershipChange | `['notifications', 'classes']`（不带 home）|

### E. SW push handler 改造

```js
// sw.js · push 事件
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  // 现有：显示通知
  event.waitUntil(
    self.registration.showNotification(data.title, { body, tag, data: { link } })
  );
  
  // 新增：postMessage 给所有窗口 invalidate
  event.waitUntil(
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'invalidate', scopes: data.scopes || ['home'] });
      });
    })
  );
});
```

前端 AppShell 监听：
```ts
navigator.serviceWorker.addEventListener('message', (e) => {
  if (e.data?.type === 'invalidate') {
    const keys = e.data.scopes.flatMap(s => scopeToKeys[s] ?? []);
    keys.forEach(k => queryClient.invalidateQueries({ queryKey: k }));
  }
});
```

### F. React Query 配置（首页 query）

```ts
useQuery({
  queryKey: ['home', 'active-card'],
  queryFn: fetchActiveCard,
  staleTime: 30_000,           // 30s 内不主动 refetch
  refetchInterval: false,      // ❌ 不开轮询
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
})
```

---

## 第 3 层 · 三通道路由（站内 / Push / 首页卡）

### A. 通道职责

| 通道 | 性质 | 打扰度 | 触达方式 |
|---|---|---|---|
| **站内（铃铛）** | 永久存储 · 主动查看 | 零 | 用户进消息页 |
| **Push** | 一次性弹窗 · 可锁屏 | 高 | 系统通知 |
| **首页卡** | 仲裁后展示 · pull 模式 | 中 | 用户进首页 |

### B. 站内通道 · 几乎不抑制

- 默认所有事件都写 Notification 表
- 唯一例外：**藏历加持日不写**（仅首页卡浮现 · 写铃铛=噪音）
- 撤回处理：`notification.revokedAt = now()` · 前端置灰不删除
- 站内是「最终事实」· Push/首页卡是即时通道副本

### C. Push 通道 · 5 层过滤（顺序执行）

```ts
async function shouldSendPush(event, user) {
  // L1: 事件源不发 push（藏历日 / 班级成员变动）
  if (NO_PUSH_EVENTS.includes(event.kind)) return false;

  // L2: 用户偏好
  if ((await getPreference(user.id, event.kind)).push === 'off') return false;

  // L3: 幂等去重
  if (await wasAlreadySent(event.kind, event.id, event.tier, user.id)) return false;

  // L4: 静默时段（severity-aware）
  if (isInQuietHours(user) && event.severity !== 'critical') {
    const delayTo = event.severity === 'urgent' ? quietHoursEnd : nextDayMorning7am;
    await scheduleDelayed(event, user, delayTo);
    return false;
  }

  // L5: 频率上限（每小时 5 条 normal · urgent/critical 不计入）
  if (event.severity === 'normal' && await getHourlyPushCount(user.id) >= 5) return false;

  return true;
}
```

### D. 静默时段 × severity 矩阵

| severity | 静默期内行为 |
|---|---|
| normal | 延迟到次日早 07:00 · 多条**聚合成 1 条**「你有 N 条未读消息 · 包含 X / Y」|
| urgent | 延迟到静默结束（默认 07:00）· 单条发送 |
| critical | **立即发送 · 无视静默** |

### E. 频率上限设计

- normal：每小时 5 条
- urgent / critical：不限制
- **超限的 normal 仅丢弃 push · 仍写站内 + 进首页卡仲裁**

### F. 首页卡通道 · 4 层过滤

（已在第 2 层定义 · 这里整合）

```ts
async function shouldShowOnHomeCard(event, user) {
  // L1: 事件源不进首页卡（个人提醒/成就/班级成员变动）
  if (NO_HOMECARD_EVENTS.includes(event.kind)) return false;
  // L2: dismiss 且 contentHash 未变
  if (await isDismissed(user.id, event)) return false;
  // L3: 已应答
  if (await hasAnswered(user.id, event)) return false;
  // L4: 静默衰减（normal + 8h 无交互）
  if (event.severity === 'normal' && event.createdAt < now() - 8h
      && !await hasInteracted(user.id, event.id)) return false;
  return true;
}
```

### G. 三通道事件路由总表

| 事件 | 站内 | Push | 首页卡 |
|---|---|---|---|
| ① ClassSession | ✅ | ✅（可关）| ✅ |
| ② ClassAnnouncement | ✅ | ✅（可关）| ✅ |
| ③ PracticeTask | ✅ | ✅（可关 · fixed 模式）| ✅ |
| ④ Personal Reminder | ✅ | ✅（可关）| ❌ |
| ⑤ Achievement | ✅ | ✅（可关）| ❌ |
| ⑥ SystemAnnouncement | ✅ | ✅（critical 不可关）| ✅ |
| ⑦ DharmaAssembly | ✅ | ✅（可关）| ✅ |
| ⑧ AuspiciousDay | ❌ | ❌ | ✅（仅此通道）|
| ⑨ MembershipChange | ✅ | ❌（强制）| ❌（强制）|

### H. 三通道写入容错策略

**「最佳努力」模式**：dispatchToUsers 中三个通道并行 await · 失败一个不阻塞其它。每个失败记 log（含 userId / channel / error）· 后续可补偿重试或人工排查。理由：站内是最终事实 · 用户即使 push 失败也能在铃铛找到。

### I. dispatchToUsers() 终极入口（伪代码）

```ts
async function dispatchToUsers(event: {
  kind: EventKind, id: string, tier: string,
  userIds: string[], severity: Severity,
  title: string, body: string, link: string,
  contentHash?: string, scopes: string[],
  expiresAt: Date,
}) {
  await logDispatch(event);  // 幂等

  for (const userId of event.userIds) {
    await Promise.allSettled([     // ← 最佳努力 · 不阻塞
      shouldWriteInbox(event) && writeNotification({ userId, ...event }),
      shouldSendPush(event, await getUser(userId)) && sendWebPush(userId, {
        title, body, link, scopes,
        tag: `${event.kind}:${event.id}`,   // 同 tag 自动替换 · 防堆叠
      }),
      shouldShowOnHomeCard(event, await getUser(userId)) 
        && upsertHomeCardCandidate(event),
    ]);
  }
}
```

---

## 第 4 层 · 用户偏好

### A. 偏好 5 维度

| # | 维度 | 默认 | 可改 |
|---|---|---|---|
| 1 | Push 总开关（master）| on | ✅ |
| 2 | Per-type push toggle（9 类）| 全部 on | 部分（critical 强制 on）|
| 3 | 静默时段 | 22:00 - 07:00 · Asia/Shanghai | ✅ |
| 4 | 个人提醒细分（v1 已有）| 三档全 on | ✅ |
| 5 | 首页卡偏好 | 启用 / 8h 衰减 / 显示藏历日 | ✅ |

### B. 默认 on 原则

新用户最需被引导 · 默认全开。强制规则：
- `system_announcement.critical`：**不可关** · UI 灰锁图标
- `membership_change` / `auspicious_day`：**无 push toggle**（本就不发 push）
- `auspicious_day`：有「首页卡显示开关」

### C. Prisma schema

```prisma
model NotificationPreference {
  id            String   @id @default(cuid())
  userId        String   @unique
  
  pushEnabled   Boolean  @default(true)
  pushTypes     Json     @default("{}")  // 仅记关闭项 · 缺省键=on · 加类型不用 migration
  
  quietStart    String   @default("22:00")
  quietEnd      String   @default("07:00")
  timezone      String   @default("Asia/Shanghai")
  
  decayHours    Int      @default(8)       // 6/8/12/24
  
  reminderDue    Boolean @default(true)
  reminderDaily  Boolean @default(true)
  reminderWeekly Boolean @default(true)
  
  homeCardEnabled    Boolean @default(true)
  auspiciousDayCard  Boolean @default(true)
  
  user      User     @relation(fields: [userId], references: [id])
  updatedAt DateTime @updatedAt
}
```

**用 JSON 不用关系表**：加新事件类型不需 migration · 仅记关闭项节省存储 · 大多数 row 几 bytes。

### D. Push 授权时机分层（避免冷启动 deny）

| 时机 | 触发 | 文案 |
|---|---|---|
| 1 | 首次进第一节共修详情 | 「开启通知 · 不错过下次共修开始」|
| 2 | 首次被加入新班 | 「老师发公告会即时提醒你」|
| 3 | 用户主动开总开关 | 直接弹 permission |

授权失败时引导浏览器设置手动开（文字指引）。

### E. 偏好查询性能

批量 dispatch 时一次性 prefetch + **in-memory Map cache 5 分钟**（不引入 Redis）：

```ts
const prefs = await prisma.notificationPreference.findMany({
  where: { userId: { in: userIds } }
});
const prefMap = new Map(prefs.map(p => [p.userId, p]));
```

cache 失效：用户改偏好时主动 invalidate 该 user entry。

### F. 偏好变更生效

- 立即生效 · 下一次 dispatch 按新值过滤
- **历史不补发**（站内已有 · 无需重复打扰）
- 关 master ≠ 删 PushSubscription · subscription 保留 · 仅过滤

### G. API

```
GET   /api/me/notification-preferences
PATCH /api/me/notification-preferences        // 部分更新
POST  /api/me/notification-preferences/reset  // 恢复默认
```

响应仅含缺省值 + 差异：
```ts
{
  pushEnabled: true,
  pushTypes: { achievement: false },  // 仅记关闭项
  quietStart: '22:00', quietEnd: '07:00', timezone: 'Asia/Shanghai',
  decayHours: 8,
  reminders: { due: true, daily: true, weekly: false },
  homeCardEnabled: true,
  auspiciousDayCard: true,
}
```

---

## 第 5 层 · 通知中心 UI（铃铛 / 消息页）

### A. 入口

顶栏铃铛常驻：
- 未读 = 0：纯灰图标 · 无角标
- 1 ≤ 未读 ≤ 9：白底蓝点 + 数字
- > 9：「9+」· > 99：「99+」+ 顶部「自上次登录 N 条新消息」横幅
- 上次登录时间：`User.lastSeenAt`（每次 API 调用更新）

### B. 列表布局

按日期分组（今天 / 昨天 / N 天前 / 上周 / 更早）· 组内 `createdAt desc`。**同事件多 tier 不合并**（T-30/T-5/T-0 各一条）。

### C. 视觉规范

| 状态 | 样式 |
|---|---|
| 未读 | 左侧 3px 竖色条（severity 配色）+ 白底 + 标题 600 字重 |
| 已读 | 无竖条 + 灰底 #FAFAFA + 标题 400 |
| 撤回 | 50% 透明 + 删除线 + 灰色「已撤回」徽章 + 不可点 |

severity icon：normal 🔵 / urgent 🟡 / critical 🔴

时间：`<1h`「N 分钟前」/ `1-24h`「N 小时前」/ `1-7d`「N 天前」/ `>7d`「MM/DD」

### D. 交互

| 动作 | 结果 |
|---|---|
| 点击未读 | 标 readAt + 乐观更新 + 跳 link |
| 点击已读 | 跳 link |
| 点击撤回 | 不响应 · toast「该内容已被撤回」|
| 「全部已读」 | 批量标记 |
| 滚动到底 | infinite scroll 30 条/页 |
| 下拉刷新（移动）| 重拉 |

**不提供删除按钮 · 已读即归档**。

### E. 撤回处理

admin / 老师撤回 → 写 `revokedAt` · **不发新通知** · 推 invalidate `['notifications']` 触发列表 refetch · 该条目变样。

### F. 实时刷新

SW push invalidate + focus refetch + mount 时一次 · **无轮询**。

### G. API

```ts
GET   /api/me/notifications?cursor=...&limit=30
PATCH /api/me/notifications/:id  { read: true }
POST  /api/me/notifications/read-all
GET   /api/me/notifications/unread-count   // 独立 endpoint · 角标用 · staleTime 30s
```

响应：
```ts
{
  items: [{
    id, eventKind, eventId, severity,
    title, body, link, icon,
    createdAt, readAt, revokedAt,
  }],
  nextCursor, unreadCount,
}
```

### H. 空状态 + 边界

- 0 条：「暂无消息 · 安心修学」
- Link 跳目标已删：兜底页 + toast「内容已不存在」
- 长时间离线回来：顶部「自上次登录 N 条新消息」+「全部已读」捷径

### I. 清理策略（业务驱动 GC）

- 已读 + 30 天前 → 软删除 `deletedAt`
- 软删除 + 30 天 → 物理删除
- 总保留期 60 天
- 触发：`juexue-api` 启动时 + 大批量通知写入时顺带扫一次

### J. 移动端 PWA

- 原生 overflow + `-webkit-overflow-scrolling: touch`
- > 100 条用 `react-window` 虚拟滚动
- iOS 安全区 `env(safe-area-inset-top/bottom)`

### K. 通知项点击跳转表

| eventKind | 跳转 |
|---|---|
| class_session | `/classes/:id/sessions/:sid` |
| class_announcement | `/classes/:id/announcements/:aid` |
| practice_task | `/classes/:id/tasks/:tid` |
| personal_reminder | `/profile/practice` |
| achievement | `/profile/achievements` |
| system_announcement | `/announcements/:id` **（新增页面）** |
| dharma_assembly | `/assemblies/:id` |
| membership_change(kicked/dissolved) | `/classes` |
| membership_change(joined) | `/classes/:id` |

---

## 第 6 层 · 首页卡 UI 细节

### A. 通用结构

```
[icon] severity-badge        [×]?
TITLE · 18px / 600
body · 13px / 400
[⏱ countdown / progress]?
[Primary CTA]  [Secondary CTA]?
```

max-width 480px · 圆角 16px · 阴影 `0 2px 12px rgba(0,0,0,.08)` · 内距 20px。

### B. severity 背景

| severity | 卡背景 | accent | 动效 |
|---|---|---|---|
| normal | #FFF | 蓝 3px | 无 |
| urgent | #FFFBEB | 橙 4px | 无 |
| critical | #FEF2F2 | 红 5px | 红光晕 2.4s 呼吸 |

### C. 9 类卡形（要点）

- **共修预告 T-24h**：「明日周五 19:00」+ `[开启通知] [查看详情]`
- **共修临近 T-30**：30 分钟倒计时 + `[进入等候室]` · 不可关
- **共修倒数 T-5**：倒计时字号放大 24px 橙色 pulse · 不可关
- **共修进行中 T-0**：critical · 红光晕 + `[进入直播间]` · 进入后**缩成右下角 48px 圆形浮动徽章** · 点击重新展开
- **班级公告**：`[查看公告]` · 可关
- **任务 T-24h**：progress bar `▓▓▓░░ 5/10 题` + 截止时间 + `[继续答题]` · 可关
- **任务 T-6h**：红色倒计时 `5h 23m 剩余` + `[继续答题]` · 不可关
- **系统公告 critical**：纯告知 + **「我知道了」按钮 · 点击 ack 后消失** · 无 X
- **法会**：法会主题图 30% 透明叠底 + `[了解详情] [设置提醒]`
- **藏历日**：「农历 X 月 X 日 · XX 加持日」+ `[了解更多]` · 可关

### D. 倒计时规则

| 阶段 | 格式 | 颜色 | 动效 |
|---|---|---|---|
| T-30 → T-5 | `MM:SS` | 蓝 #3B82F6 | 无 |
| T-5 → T-0 | `MM:SS` | 橙 #F59E0B | 数字 scale 1→1.05→1 pulse |
| T-0 → end | 「已开始 X 分钟」 | 红 #EF4444 | 红圆点呼吸 |

`useEffect + setInterval(1000)` · 后端不参与 tick · `expiresAt` 决定 invalidate 时机。

### E. 档位切换动画

`framer-motion` · 同 eventId tier 升级时**卡片不卸载** · 内容用 motion 平滑过渡 200ms：

```tsx
<motion.div layoutId={`card-${eventId}`}>
  <AnimatePresence mode="wait">
    <motion.div
      key={`${eventId}-${tier}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >...</motion.div>
  </AnimatePresence>
</motion.div>
```

不同事件切换：整卡 fade + scale · 300ms。

### F. dismiss / ack 交互

| 类型 | UI | 行为 |
|---|---|---|
| 可关闭（normal/urgent · 部分）| 右上角 [×] 24px tap target | 立即 fade out + 后台 `POST /api/home/dismiss` · 失败回滚 |
| 不可关闭（T-30 / T-5 / T-0 / T-6h / DharmaAssembly 进行中）| 无 [×] | — |
| **critical SystemAnnouncement** | **底部「我知道了」按钮** | **点击 POST /api/home/ack · 卡片消失** |

ack 与 dismiss 后端共用 `NotificationCardAck` 表（区分 `kind: 'dismissed' | 'acknowledged'`）。critical 系统公告**全平台用户都得 ack 一次** · 不能跨用户共享。

### G. 状态机

```
NULL ─fetch─→ HIDDEN (no card)
              │ 后端有 card
              ↓
          MOUNTED ─┬─ USER CLICK   → NAVIGATE
                   ├─ TIER UP      → 内容渐变（keep card）
                   ├─ EXPIRED      → refetch · 可能 UNMOUNT
                   ├─ DISMISSED    → refetch · 可能换 winner
                   └─ ACKED        → refetch · 可能换 winner
```

### H. 无障碍

- `<section aria-live="polite" aria-label="首页提醒卡">`
- 倒计时 `aria-label="距离开始还有 N 分 N 秒"` · 每 30s 更新（不是每秒）
- critical 卡 `role="alert"` 让阅读器立即播报
- [×] / 「我知道了」`aria-label` 明确

### I. 响应式

| 屏宽 | 卡宽 | 字号 |
|---|---|---|
| < 480 | 100% - 32 margin | title 16 / body 13 |
| 480-768 | 100% - 48 margin | title 18 / body 14 |
| > 768 | max 480 居中 | title 18 / body 14 |

### J. 玻璃 pill 与卡片协调

- **无卡时**：pill 浮在 hero 画报右下
- **有卡时**：pill **整体隐藏**（更克制 · 不与卡并存）
- pill 与卡片共享 `useActiveCardQuery` hook · 状态联动

### K. 暂不考虑 dark mode（项目当前无此规划）

---

## 第 7 层 · 可观测性 + 灰度发布 + 实施排期

### A. 关键指标（10 个）

| # | 指标 | 公式 | 告警阈值 |
|---|---|---|---|
| 1 | 通知送达率 | `notifications_written / events_dispatched` | < 99% |
| 2 | Push 成功率 | `push_delivered / push_sent` | < 95% |
| 3 | Push 授权率 | `granted / active_users` | 跟踪 |
| 4 | 静默时段命中率 | `quiet_hours_delayed / push_sent` | 跟踪 |
| 5 | 频率上限丢弃率 | `rate_limit_dropped / push_sent` | > 5% |
| 6 | 首页卡 impression | `card_shown / home_visits` | 跟踪 |
| 7 | 首页卡 CTR | `card_click / card_shown` | < 5% 异常 |
| 8 | dismiss 率 | `card_dismissed / card_shown` | > 50% 查文案 |
| 9 | API p95 延迟 | active-card / unread-count | > 200ms |
| 10 | 单用户日 push 数 | `push_count / user / day` | > 30 |

### B. 日志表新增 3 个

```prisma
model PushDeliveryLog {
  id                  String @id @default(cuid())
  pushSubscriptionId  String
  userId              String
  status              String   // 'sent' | 'failed' | 'expired'
  error               String?
  sentAt              DateTime @default(now())
  @@index([userId, sentAt])
}

model HomeCardEvent {
  id        String   @id @default(cuid())
  userId    String
  eventKind String
  eventId   String
  tier      String
  action    String   // 'shown' | 'click' | 'dismiss' | 'ack'
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
  @@index([eventKind, action, createdAt])
}

model NotificationCardAck {
  userId       String
  eventKind    String
  eventId      String
  kind         String   // 'dismissed' | 'acknowledged'
  contentHash  String?
  createdAt    DateTime @default(now())
  @@unique([userId, eventKind, eventId])
}
```

### C. Feature Flag

user-level + 全平台 kill switch：

```prisma
model User {
  ...
  notificationV2Enabled Boolean @default(false)
}

// SystemConfig.notification_v2_global: 'off' | 'shadow' | 'on'
// shadow = v1 + v2 双发对比 · 用户仍看 v1
```

```ts
async function dispatchToUsers(event) {
  const mode = await getSystemConfig('notification_v2_global');
  if (mode === 'off') return dispatchV1(event);
  
  for (const userId of event.userIds) {
    const user = await getUser(userId);
    if (mode === 'on' && user.notificationV2Enabled) {
      await dispatchV2(event, user);
    } else if (mode === 'shadow') {
      await Promise.allSettled([dispatchV1(event, user), dispatchV2Shadow(event, user)]);
    } else {
      await dispatchV1(event, user);
    }
  }
}
```

### D. 灰度 4 阶段

| 阶段 | 内容 | 覆盖 | 验收 |
|---|---|---|---|
| P0 基础 | OrphanedFile · 单设备 · lastSeenAt | 0%（透明）| smoke 全过 |
| P1 后端切换 | dispatchToUsers · 5 类旧事件 · shadow 3 天 | shadow 100% | v1/v2 diff < 1% |
| P2 新事件源 | 任务/成就/系统公告/法会/成员变动 | 5→20→50% | 灰度 1 周观察 |
| P3 UI 上线 | active-card · 通知中心 · 玻璃 pill · 卡片 | 20→100% | smoke + 用户反馈 |
| P4 清理 | 删 dispatchV1 · 删 createMany · flag 保留 30 天 | 100% | 旧路径 0 调用 1 周 |

### E. Admin 灰度页 `/admin/notification-v2`

- 全平台模式切换：off / shadow / on
- 启用人数 + 随机加 N / 指定加入 / 清空
- 事件源细粒度开关
- 实时指标仪表盘（24h 滚动）

### F. 5 个关键风险

| 风险 | 缓解 |
|---|---|
| Push 链路单点故障 | 站内是最终事实 · push 失败不影响功能 · 监控告警 |
| 首页卡 API 慢查询 | 预入 HomeCardCandidate 表 · active-card 仅读 · staleTime 30s |
| 聚合 push 早 7:00 cron 漏跑 | DelayedPush 表保留 · cron 健康检查 · 重启扫未发 |
| Ack 表爆炸 | (userId, eventId) 唯一索引 · 90 天 GC |
| v2 严重 UX 问题难回退 | flag 保留 6 月 · admin 一键回退个人/全平台 |

### G. 实施排期（7.5 周）

| Sprint | 内容 | 时长 |
|---|---|---|
| S1 | P0 基础 · dispatchToUsers · feature flag · OrphanedFile GC | 1 周 |
| S2 | P1 旧事件源接入 + shadow 3 天 | 1 周 |
| S3 | 监控 · P2 新事件源 · 灰度 50% | 1.5 周 |
| S4 | P3 UI（active-card + 通知中心 + 玻璃 pill + 卡片）+ 100% | 2 周 |
| S5 | P4 旧路径移除 · flag 观察 | 1 周 |
| 缓冲 | bug fix + 文案 | 1 周 |
| **合计** | | **~7.5 周** |

### H. 上线前 smoke test（14 项）

1. 9 类事件源各发 1 条 · 三通道全到位
2. 静默时段 + critical 绕过 + 聚合发送（早 7:00 「N 条未读」）
3. 首页卡仲裁优先级（5 候选竞争）
4. 共修 T-30 → T-5 → T-0 档位升级 · 卡片不卸载
5. 公告 dismiss · 老师改内容 → contentHash 变 → 卡重现
6. critical SystemAnnouncement ack 后消失 · 全平台每人独立 ack
7. 进行中卡缩成右下角徽章
8. 撤回公告：列表置灰 + invalidate
9. 跨设备登录：旧设备 401 强登出
10. Cover 替换：7 天后旧文件 GC
11. 频率上限：第 6 条 normal push 被丢 · 站内仍有
12. 用户偏好关 push 类型 → 仅站内
13. 99+ 横幅 + lastSeenAt 显示
14. 60 天后已读物理删除

### I. 监控通道

- PM2 logs + SystemAlert 表
- 关键告警转 admin（Slack / 邮件 · 可选）
- /admin/notification-v2 实时仪表盘

### J. 灰度回退预案

| 情况 | 操作 |
|---|---|
| 个别用户报问题 | `user.notificationV2Enabled = false` |
| 某事件源 bug | 灰度页关掉该事件源 v2 开关 |
| 全局严重问题 | `SystemConfig.notification_v2_global = 'off'` |
| 数据库灾难 | 备份恢复 + flag off + DispatchLog 重放 |

---

## 第 8 层 · 简化决策（B 方案 · 替代第 2 / 6 层 + 补 In-app Banner + 系统活动信息型）

> 状态：✅ 设计最终版 · 2026-05-15
> 取代关系：本层落地后 · 第 2 层（首页卡仲裁）和第 6 层（首页卡 UI）**作废** · 仅保留供历史参考。

### A. 核心决策

放弃「首页卡 + 仲裁优先级表 + 4 档窗口 + 自动消失 3 规则 + dismissal / contentHash」的复杂方案。改为：

**通道架构由 4 改 3 · 新增第 4 个轻量通道 In-app Banner**：

| # | 通道 | 角色 | 用户场景 |
|---|---|---|---|
| 1 | 站内（铃铛） | 历史记录 | 用户主动查 |
| 2 | Push（Web Push）| 强触达 | 用户**不在 app** 时唯一 |
| 3 | **In-app Banner** | 临场提醒（前台）| 用户在 app 但不在首页 |
| 4 | **首页玻璃文字 + 班级卡红点**（非通知系统 · 是首页 UI）| 静态概览 | 用户在首页 |

### B. 首页玻璃文字（非通知系统组件 · 但承担「卡片」职责）

```
[Cover Hero 画报]
  ╭─ 玻璃 ─╮  下次共修 · 周五 19:00
  ╭─ 玻璃 ─╮  今日任务 · 5/10 题
  ╭─ 玻璃 ─╮  最新公告 · 3 条未读
  
  ╭─ 玻璃 pill ─╮  本周安排 ›
```

**特性**：
- 液态玻璃质感 · 与画报融合 · backdrop-filter blur
- 仅文字 · 无图标 / 进度条 / 倒计时
- 静态展示 · 任何 tier 都保持平静（临场感由 banner 承担）
- 没数据时整行隐藏（无下次共修 → 这行消失）
- 三行全空 → 整组隐藏 · 只剩玻璃 pill
- 主题自适应：浅色画报用深字 + 浅白底 · 深色画报用浅字 + 深底
- 单班假设：所有玻璃文字直指那个班 · 无聚合歧义

**点击跳转**：
- 下次共修 → `/classes/:id/sessions/:sid`
- 今日任务 → `/classes/:id/tasks/:tid`（当前未完成的那条）
- 最新公告 → `/notifications?filter=announcement`（通知中心 + 公告 tab）

### C. 班级卡红点

- 红点 = 该班有未处理事件（共修 / 任务 / 公告任一）
- **不显示数字** · **不区分类型**
- 红点消失：进入过共修详情 / 任务完成或截止 / 公告全部已读
- 单班场景：唯一一张班级卡可能有红点

### D. In-app Banner（第 3 通道详设）

**触发条件**：
- `severity >= urgent` AND 事件属于「临场行动类」
- 用户在 app 前台（`document.visibilityState === 'visible'`）

**事件触发表**：

| 事件 | banner 触发 |
|---|---|
| ClassSession T-5 / T-0 / 进行中 | ✅ |
| critical SystemAnnouncement | ✅（不自动消失 · 必须 ack）|
| urgent SystemAnnouncement | ✅（8 秒自动消失）|
| DharmaAssembly 进行中（每日首次进 app）| ✅ |
| Achievement 解锁 | ✅（金色庆祝样式）|
| ClassAnnouncement urgent | ✅ |
| 其它 normal 事件 | ❌ |

**UI 规范**：
```
[safe-area-inset-top]
╭──────────────────────────────────╮
│ 🧘 共修即将开始 · ⏱ 4:32     [×] │
│ 班级·初心 一组  ·  [立即进入]    │
╰──────────────────────────────────╯
```

- z-index 9999 · 浮于所有页面之上
- 高度 64-72px · 圆角 12px · 距顶 8px
- 玻璃质感（backdrop-filter blur）
- 背景按 severity（urgent 浅黄 / critical 浅红）
- 滑入 300ms · 滑出 200ms · framer-motion
- 整条点击 = 主 CTA（除右上角 [×]）
- 自动消失：normal 不触发 / urgent 8 秒 / critical 永不（须 ack）

**Banner 与系统 Push 互斥**：
- App 前台时跳过系统 push · 走 banner
- SW push handler 检测 `clients.matchAll({type:'window'})` 是否有 visible client
- 有 → postMessage 给前端走 banner
- 无 → showNotification 走系统通知栏

**Banner 队列**：
- 同时只显示 1 条
- 队列按 severity 排序（critical > urgent > normal）
- 用户点击 → navigate + 关当前 + 1 秒后显示下一条
- 用户 dismiss → 关当前 + 立即显示下一条
- 新到 banner 优先级更高 → 推开当前（当前回队列首位）

**Achievement 庆祝样式**（特殊）：
```
╭──────────────────────────────────╮
│ 🎉 解锁成就「坚持修学 7 天」   [×] │  ← 金色边
│    [查看]                          │
╰──────────────────────────────────╯
```
金色渐变背景 + 光晕呼吸 · 5 秒后自动消失 · 不进队列优先级。

### E. 4 类事件源最终路由

| 事件 | 站内 | Push | Banner | 首页玻璃文字 | 红点 |
|---|---|---|---|---|---|
| ① ClassSession 共修 | ✅ | ✅ | T-5/T-0/进行中 | 下次共修 行 | ✅ |
| ② ClassAnnouncement normal | ✅ | ✅ | ❌ | 「N 条未读」| ✅ |
| ② ClassAnnouncement urgent | ✅ | ✅ | ✅ | 同上 | ✅ |
| ③ PracticeTask | ✅ | ✅ | ❌ | 今日任务 行 | ✅ |
| ④ Personal Reminder | ✅ | ✅ | ❌ | ❌（被「今日任务」覆盖）| ❌ |
| ⑤ Achievement | ✅ | ✅ | ✅（庆祝样式）| ❌ | ❌ |
| ⑥ SystemAnnouncement normal | ✅ | ✅ | ❌ | ❌ | ❌ |
| ⑥ SystemAnnouncement urgent | ✅ | ✅ | ✅ | ❌ | ❌ |
| ⑥ SystemAnnouncement critical | ✅ | ✅（无视静默）| ✅（须 ack）| ❌ | ❌ |
| ⑦ DharmaAssembly 法会 | ✅ | ✅ | 进行中（每日首次进 app）| 进行中持续显示 | ❌ |
| ⑧ AuspiciousDay 藏历加持日 | ❌ | ❌ | ❌ | 可选独立行 | ❌ |
| ⑨ MembershipChange | ✅ | ❌ | ❌ | ❌ | ❌ |

### F. 法会 / 系统共修 · 信息型处理（方案 A · 模型合并）

**关键认知**：平台发布的活动（法会 / 系统共修）**没有 app 内入口** · 用户线下 / 外部渠道参与 · app 仅展示信息。

**模型合并**：把「系统共修」视为「法会」的子集 · 同一事件源 `DharmaAssembly`：

```prisma
model DharmaAssembly {
  id          String   @id @default(cuid())
  title       String
  category    String   // 'assembly' | 'system_session' | 'memorial' | ...
  startAt     DateTime
  endAt       DateTime
  description String   @db.Text
  coverImage  String?
  externalLink String? // 外部直播链接（如 Zoom · 可空）
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**跳转调整**：
- `DharmaAssembly` 跳转改为 `/assemblies/:id` · **不存在 `/live` 子页**
- 班级共修 ClassSession 不变 · 仍有 `/live` 直播间

### G. 详情页 `/assemblies/:id`

```
[封面图]

🪷 文殊菩萨圣诞法会
农历四月初四 - 初六
2026/5/20 - 5/22

─── 主题 ───
共发菩提心 · 同诵文殊心咒

─── 参与方式 ───
• 自行持诵文殊心咒 100 遍/日
• 法本《文殊真实名经》同步学习
• 外部直播链接：[加入 Zoom 会议] ←可点击跳转

─── 主办方 ───
觉学平台 · 智悲法洲

─── 介绍 ───
[长文内容 · 法会缘起 / 仪轨 / ...]
```

**移除评论区**（用户决策）。

**外部链接跳转**（用户决策 · 直接跳转）：

```tsx
<a 
  href={externalLink} 
  target="_blank" 
  rel="noopener noreferrer"
  className="external-link-button"
>
  加入 Zoom 会议 ↗
</a>
```

- 直接 `<a>` 跳转 · 浏览器自动 hand off 给 Zoom app（如安装）· 否则浏览器打开 Zoom Web Client
- 同理支持腾讯会议 / 钉钉 / 任意 https 链接
- 如 `externalLink` 为空 · 整个按钮不显示

**不做「关注此活动」按钮**（用户决策）。

### H. 法会 / 系统活动文案调整

通知文案去掉「立即进入」「进入直播间」等暗示 app 内入口的引导 · 换为信息感：

| tier | 文案 | CTA |
|---|---|---|
| created | 「文殊圣诞法会 · 5/20-5/22 即将开启」 | 查看详情 |
| 每日首场前 1h | 「法会今日 19:00 开始 · 参与方式见详情」 | 查看详情 |
| 进行中（每日首次进 app）| 「法会进行中 · 与全球同修共发心」 | 查看详情 |

玻璃文字「🪷 文殊圣诞法会 · 进行中」点击同样跳详情页。

### I. 完整跳转矩阵

| 事件 / tier | 跳转 link |
|---|---|
| ClassSession 预告 / 临近 / 倒数 | `/classes/:id/sessions/:sid` |
| ClassSession 进行中 (t0) | `/classes/:id/sessions/:sid/live` |
| ClassSession 结束 | `/classes/:id/sessions/:sid`（回放）|
| ClassAnnouncement | `/classes/:id/announcements/:aid` |
| PracticeTask | `/classes/:id/tasks/:tid` |
| Personal Reminder | `/profile/practice` |
| Achievement | `/profile/achievements?highlight=:id` |
| SystemAnnouncement | `/announcements/:id` |
| **DharmaAssembly（所有 tier）** | `/assemblies/:id`（无 /live）|
| MembershipChange kicked / dissolved | `/classes` |
| MembershipChange joined | `/classes/:id` |

### J. 三入口跳转实现

**B.1 系统 Push 点击（用户在 app 外）**：
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

**B.2 In-app Banner 点击**：
```ts
<button onClick={() => {
  router.navigate(banner.link);
  closeBanner(banner.id);
}}>
```

**B.3 通知中心列表点击**：标 readAt（乐观）+ navigate。

### K. 跳转边界处理

| 场景 | 处理 |
|---|---|
| 目标已删除 (404) | 兜底页「该内容已不存在」+ 「返回首页」+ 5 秒自动跳 |
| 权限不足 (403) | 兜底页「你没有权限查看」 |
| 未登录（PWA 点 push）| `sessionStorage.setItem('pendingDeepLink', link)` · 登录后读取并跳 |
| App 未启动（push 唤起）| 同上 · sessionStorage 中转 |
| App 前台已在目标页 | refetch + scroll to top + 高亮 |
| App 后台 → 前台 | focus refetch + 如有 pendingDeepLink 自动跳 |
| Link 解析失败 | console.warn + 跳首页 |

### L. 共修 Push tag 替换（避免堆叠 3 条通知）

```ts
sendPush({
  tag: `class_session:${sessionId}`,
  title, body, link,
});
```

- 共修 T-30 / T-5 / T-0 共用同 tag · 系统通知栏自动替换前一条
- 用户系统通知栏始终只看到「这场共修」的最新状态
- 链接按当前 tier 决定（T-0 起跳 /live · 之前跳详情）

### M. 简化后效果总结

| 维度 | 原 7 层方案 | 第 8 层简化方案 |
|---|---|---|
| 通道数 | 4（含 banner） | 4（站内 + push + banner + 首页 UI 元素）|
| 首页卡仲裁逻辑 | 14 行优先级表 + 4 档窗口 | ❌ 全部砍 |
| 自动消失规则 | 3 条复杂规则 | 玻璃文字按业务状态自然显示 / 隐藏 |
| dismissal / contentHash 模型 | 全套 | 仅 critical SystemAnnouncement ack |
| 后端表新增 | 4 个 | 2 个（PushDeliveryLog · NotificationCardAck）|
| 实施工时 | 7.5 周 | **~4.5 周** |
| 维护成本 | 高 | 低 |
| 视觉密度 | 中 | 低（画报为主）|

---

## 第 9 层 · 端到端流程（按事件源 · 发布 → 用户 → 跳转）

> 这一层是**实施参考手册** · 列出 9 类事件每一类的发布方 / 入口路径 / 字段 / tier 调度 / 三通道文案 / 跳转目标 / 撤回方式。

### ① ClassSession · 班级共修

**发布**：辅导员 · `/coach/classes/:id/sessions` → 「+ 新建共修」
**字段**：标题 / 开始时间 / 时长（分钟）/ 内部直播链接 / 备注

| Tier | 触发 | severity | 站内文案 | Push 文案 | Banner 文案 |
|---|---|---|---|---|---|
| created | 创建瞬间 | normal | 辅导员安排了周五 19:00 共修 | 周五 19:00 共修已安排 | — |
| time_changed | 改时间 | urgent | 共修时间已改 · 周六 20:00 | 共修时间变更 · 周六 20:00 | — |
| cancelled | 取消 | urgent | 周五共修已取消 | 周五共修已取消 | — |
| t24h | 开始前 24h | normal | 明日 19:00 周共修 | 明日 19:00 周共修 | — |
| t30 | 前 30 分钟 | normal | 30 分钟后开始 | 30 分钟后开始 · 准备就绪 | — |
| t5 | 前 5 分钟 | urgent | 共修即将开始 | 即将开始 · ⏱ 5:00 | 共修即将开始 · ⏱ 4:32 · `[立即进入]` |
| t0 | 准时开始 | critical | 共修进行中 | 立即进入 | 共修进行中 · `[进入直播间]` |

**Push tag 替换**：T-30/T-5/T-0 共用 `tag = class_session:{sid}` · 通知栏只显示最新一条。

**跳转**：
- Tier ≤ t5 → `/classes/:id/sessions/:sid`（等候室）
- Tier = t0 → `/classes/:id/sessions/:sid/live`（直播间）
- Tier = end → `/classes/:id/sessions/:sid`（回放）

### ② ClassAnnouncement · 班级公告

**发布**：辅导员 · `/coach/classes/:id/announcements` → 「+ 新建公告」
**字段**：标题 / 内容（富文本）/ severity（normal 默认 · urgent 手选）

| severity | 站内 | Push | Banner |
|---|---|---|---|
| normal | 辅导员发布「本周任务安排」 | 班级公告 · 本周任务安排 | — |
| urgent | 🔴 重要公告 | 重要 · 周日调休安排 | 重要 · 周日调休 · `[查看公告]` |

**跳转**：所有入口 → `/classes/:id/announcements/:aid`
**撤回**：辅导员点撤回 → 写 `revokedAt` · 不发新通知 · 通知中心置灰 + 删除线

### ③ PracticeTask · 修学任务

**发布**：辅导员 · `/coach/classes/:id/tasks` → 「+ 新建任务」
**字段**：标题 / 关联法本 / 截止时间 / 题数 / 提醒模式（fixed / loose）

| Tier | 触发 | severity | 站内 | Push |
|---|---|---|---|---|
| created | 创建瞬间 | normal | 新任务 · 完成《XXX》| 新任务 · 完成《XXX》|
| task_t24h | 截止前 24h 未完成 | normal | 还有 24h 完成 | 任务剩 24h |
| task_t6h | 截止前 6h 未完成 | urgent | ⚠️ 6h 后截止 | 即将截止 · 仅剩 6h |
| task_completed | 学员完成 | normal | 你完成了《XXX》任务 | —（仅站内）|

**跳转**：所有入口 → `/classes/:id/tasks/:tid`

### ④ Personal Reminder · 个人提醒

**发布**：系统 cron 自动 · 用户在 `/settings/notifications` 开关

| Tier | 时机 | 站内 | Push |
|---|---|---|---|
| due | 每日 19:00 · 当日未修学 | 今天还没修学哦 | 临期提醒 · 你今天还没修学 |
| daily | 每日 20:00 | 今日修学回顾 · 完成 2/3 任务 | 今日小结 · 完成 2/3 |
| weekly | 周一 08:00 | 上周共修 X 次 · 任务 X/Y | 上周回顾来了 |

**跳转**：所有入口 → `/profile/practice`

### ⑤ Achievement · 成就解锁

**发布**：系统业务事件触发 · 5 分钟窗口聚合

**Banner 庆祝样式**（仅成就）：金色渐变 + 光晕呼吸 · 5 秒自动消失 · 不进队列优先级。

| 站内 | Push | Banner |
|---|---|---|
| 🎉 解锁成就「坚持修学 7 天」 | 新成就 · 坚持修学 7 天 | 🎉 解锁成就「坚持修学 7 天」`[查看]` |

**跳转**：所有入口 → `/profile/achievements?highlight=:id`

### ⑥ SystemAnnouncement · 系统公告

**发布**：admin · `/admin/announcements` → 「+ 新建系统公告」
**字段**：标题 / 内容 / severity（normal / urgent / critical 三选）/ expiresAt

| severity | 站内 | Push | Banner |
|---|---|---|---|
| normal | 平台公告 · 新增功能上线 | 平台公告 · 新增功能上线 | — |
| urgent | 重要 · 数据迁移即将开始 | 重要 · 数据迁移 22:00 开始 | 重要 · 数据迁移 22:00 开始 · `[查看详情]` |
| critical | ⚠️ 紧急 · 平台 22:00 维护 30 分钟 | 紧急 · 22:00 维护 30 分钟（无视静默）| ⚠️ 平台 22:00 维护 30 分钟 · `[我知道了]` |

**critical 特殊**：
- Push 无视静默时段
- Banner 永不自动消失 · 必须 ack
- 未 ack 时每次进 app 重浮（直到 ack 或 expiresAt）

**跳转**：所有入口 → `/announcements/:id`（新增页面）
**撤回**：admin 撤回 → 写 `revokedAt` · 通知中心置灰 · 已显示 banner 立即关

### ⑦ DharmaAssembly · 法会 / 系统活动（信息型）

**发布**：admin · `/admin/assemblies` → 「+ 新建法会」
**字段**：标题 / category（assembly / system_session / memorial）/ 起止时间 / 介绍 / 主题 / 参与方式 / 封面图 / externalLink（Zoom 等 · 可空）

| Tier | 触发 | 站内 | Push | Banner |
|---|---|---|---|---|
| created | 创建瞬间 | 即将开启 · 文殊圣诞法会 5/20-5/22 | 文殊圣诞法会 5/20 开启 | — |
| daily_t1h | 每日首场前 1h | 法会今日 19:00 开始 | 法会今日 19:00 开始 | — |
| in_progress_arrival | 法会期间每日首次进 app | 法会进行中 · 与全球同修共发心 | — | 🪷 法会进行中 · `[查看详情]` |

**首页玻璃文字**（法会期间持续）：「🪷 文殊圣诞法会 · 进行中」

**跳转**：所有入口 → `/assemblies/:id`（详情页 · **无 /live 子页**）

**详情页**：
- 封面 / 主题 / 参与方式 / 主办方 / 介绍
- 外部链接：`<a target="_blank">加入 Zoom 会议 ↗</a>` 直接跳转
- **无评论区**

### ⑧ AuspiciousDay · 藏历加持日

**发布**：系统数据预置 · admin 在 `/admin/auspicious-days` 可编辑文案
**通道**：仅首页玻璃文字 · 不写站内 / 不发 push / 不触发 banner
**玻璃文字**（当日 0:00-23:59）：「🪷 今日加持日 · 农历四月十五 · 释迦牟尼吉祥日」
**跳转**：点击 → `/auspicious/:date`（介绍页）

### ⑨ MembershipChange · 班级成员变动

**发布**：
- 辅导员 · `/coach/classes/:id/members` → 列表项 `[移除]` / `[邀请]`
- admin · `/admin/classes/:id/members`

**通道**：仅站内（不发 push · 不触发 banner · 不进玻璃文字）

| Tier | severity | 文案 | 跳转 |
|---|---|---|---|
| kicked | urgent | 你已被移出「班级·初心」 · 如有疑问请联系辅导员 | `/classes`（不能跳已踢班）|
| joined | normal | 你已加入「班级·研修」 · 开始你的修学之旅 | `/classes/:id` |
| class_dissolved | urgent | 「班级·初心」已解散 · 感谢同行 | `/classes` |

**隐私原则**：不暴露操作人是谁。

### 全局规则汇总

**Push 5 层过滤**：事件源允许 → 用户偏好 → 幂等去重 → 静默时段 → 频率上限。
**Banner 触发**：`severity >= urgent AND 临场行动类 AND 前台 AND 不在目标页`。
**跳转边界**：404 / 403 / 未登录 / 已在目标页 / pendingDeepLink 中转。
**撤回行为**：写 `revokedAt` · 通知中心置灰 + 删除线 · 不发新通知。

### 总流程图

```
[发布方]                   [后端]                    [用户端]
辅导员 → /coach/...          ↓                    ┌──→ 站内（铃铛）
admin → /admin/...    → dispatchToUsers()  ───→  ├──→ Push（不在 app 时）
系统 cron / 业务事件         ↓                    ├──→ Banner（在 app 时）
                       NotificationDispatchLog     └──→ 首页玻璃文字 / 班级红点
                       PushDeliveryLog                  （前端 query 主动拉）
                            ↓
                       Web Push 协议
                            ↓
                       SW push handler
                            ↓
                     ┌──无窗口──→ openWindow(link)
                     └──有窗口──→ focus + postMessage navigate
                            ↓
                    React Router navigate(link)
                            ↓
                       目标页（同 URL · 不论来自 push / banner / 通知中心）
```

---

## 待续

- **第 10 层**：SMS 短信提醒（兜底通道 · 国内运营商 / 模板备案 / 成本控制）
