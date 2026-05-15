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

## 待续

- **第 3 层**：三通道路由（站内 + push + 首页卡的具体路由规则、静默时段、用户偏好叠加）
- **第 4 层**：用户偏好层（per-type toggle、静默时段、push 频率上限）
- **第 5 层**：UI / 通知中心改造
- **第 6 层**：可观测性 + 灰度发布
