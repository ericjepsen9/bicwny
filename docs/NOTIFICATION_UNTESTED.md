# 觉学通知系统 · 未测试功能清单

> ⚠️ **重要警告**：本会话实施的所有通知和推送功能**全部未做端到端测试**。
> 原因：用户暂未打包成 iOS · 无法在真实 PWA 环境下验证。
>
> 当前状态：所有代码通过 TypeScript typecheck · 但**未在生产环境运行 · 未做功能验证**。
>
> 创建时间：2026-05-15
> 关联：`NOTIFICATION_PROGRESS_SNAPSHOT.md` § 部署清单 · `NOTIFICATION_V2_IMPLEMENTATION_STATUS.md` §3 端到端验证清单

---

## ⚠️ 当前风险等级

**所有 v2 改动 = 未验证状态。** Typecheck 通过不代表运行时正确：
- 数据库 schema 已加字段 / 表 · 但**未跑 prisma db push**
- 后端代码已写 · 但**未在生产 PM2 进程跑过**
- 前端代码已写 · 但**未在浏览器渲染过**
- Service Worker 改动 · 但**未在 PWA 真机验证 push click**

任何一项都可能在真实运行时暴露未发现的 bug。

---

## 一、未测试的事件源 dispatch（11 个全部未测）

| 事件 | 触发 | 风险点 |
|---|---|---|
| ① 共修 T-30 / T-5 / T-0 cron | 时间窗口 ±90s | 改了 link 格式 · 跳转目标新建（详情页）|
| ① 共修 created（辅导员创建时）| 辅导员操作触发 | fire-and-forget · 未验证 |
| ① 共修 time_changed（改时间）| 辅导员操作触发 | 删 DispatchLog + 重新调度 · 时序敏感 |
| ① 共修 cancelled（取消）| 辅导员操作触发 | 删除前抓 members 列表 · 防丢失 |
| ② 班级公告（重写）| 辅导员发布 | 从 createMany 改为 dispatchToUsers · push 是否真到达？|
| ③ 修学任务 created | 辅导员下达 | fire-and-forget · 链接最近改到班级页 |
| ③ 修学任务 t24h / t6h cron | 调度扫描 | 新加 cron tick · 未验证窗口逻辑 |
| ⑤ Achievement 检测 + 5min 聚合 | 答题触发 + cron flush | 复杂状态机 · 聚合逻辑未验证 |
| ⑥ SystemAnnouncement 发布 | admin 操作 | 全平台 fan-out · 用户量大时性能未验证 |
| ⑦ DharmaAssembly created + t1h cron | admin 操作 + 调度 | t1h 窗口逻辑未验证 |
| ⑨ MembershipChange kicked / joined / dissolved | admin / 辅导员操作 | NO_PUSH_EVENTS 仅站内 · 未验证 push 确实被拦 |
| 反馈回复 / 举报审核 | admin 处理 | 改 link 格式 · 详情页跳转 |

---

## 二、未测试的 Push 过滤层（4 层全部未测）

| 层 | 实现 | 验证缺失 |
|---|---|---|
| L1 NO_PUSH_EVENTS 白名单 | dispatch.ts 跳过 | 班级成员变动事件 · 实测是否真不发 push？|
| L2 用户偏好 filterUsersAllowingPush | groupBy 查询 | 用户关 pushTypes per-type · push 实测是否跳过？|
| L3 静默时段 filterUsersOutsideQuietHours | 用户本地 hour 计算 | 跨时区 tz aware 计算 · 实测准确性 |
| L4 频率上限 filterUsersUnderRateLimit | SQL groupBy count | 多进程并发场景下 race condition 未验证 |

---

## 三、未测试的新页面（9 个）

| 路径 | 待验证 |
|---|---|
| `/notifications`（字段统一）| 未读高亮 + 全部已读按钮 + 计数 |
| `/announcements/:id`（系统公告详情）| severity chip 三档 + 撤回置灰 + 过期标记 |
| `/assemblies/:id`（法会详情）| 外部链接按钮 target=_blank + 状态 chip |
| `/class/:id/sessions/:sid`（班级共修详情）| 倒计时五档 + 加入直播按钮 + liveLink 缺失提示 |
| `/events`（综合活动列表）| 分组（进行中/即将开始）+ chip 区分四类活动 |
| `/admin/system-announcements` | 创建表单 + severity 选择 + 撤回二次确认 |
| `/admin/dharma-assemblies` | 创建表单 + category 选择 + 软删 |
| `/settings/notifications`（增强）| 顶部 push 偏好 section + per-type toggle |
| 首页顶栏 EventsButton | 点击跳 /events · icon 显示 |

---

## 四、未测试的后端 API（10+ 个新增）

| Endpoint | 风险点 |
|---|---|
| `POST /api/admin/system-announcements` | 创建 + dispatch 联动 |
| `PATCH /api/admin/system-announcements/:id` | contentHash 自动重算 |
| `POST /api/admin/system-announcements/:id/revoke` | revokedAt + 已发通知联动 |
| `GET /api/admin/system-announcements` | admin 列表分页 |
| `GET /api/announcements/:id` | 公开详情 |
| `GET /api/announcements` | active 列表 |
| `POST /api/admin/dharma-assemblies` | 创建 + 全平台 dispatch |
| `PATCH /api/admin/dharma-assemblies/:id` | 改时间合法性 |
| `DELETE /api/admin/dharma-assemblies/:id` | 软删 + cron 调度联动 |
| `GET /api/admin/dharma-assemblies` | admin 列表 |
| `GET /api/assemblies/:id` | 公开详情 |
| `GET /api/assemblies` | active 列表 |
| `GET /api/classes/:classId/sessions/:sid` | 单场详情 + 班级成员校验 |
| `GET /api/my/push-preferences` | NotificationPreference lazy create |
| `PATCH /api/my/push-preferences` | pushTypes JSON merge 逻辑 |
| `GET /api/my/upcoming-events`（扩展）| 联合查 ClassSession + DharmaAssembly · 时间排序 |

---

## 五、未测试的 Schema 变更（5 表 + 4 字段扩展）

| 变更 | 风险 |
|---|---|
| 新建 `NotificationPreference` 表 | userId unique · lazy create P2002 容错 |
| 新建 `UserAchievementUnlock` 表 | userId+badgeId unique · 并发 skipDuplicates |
| 新建 `SystemAnnouncement` 表 | severity / expiresAt / contentHash 字段 |
| 新建 `DharmaAssembly` 表 | startAt/endAt/category/externalLink/deletedAt |
| 新建 `OrphanedFile` 表 | filePath + variantPaths + markedAt |
| `User` 加 `currentSessionId` / `notificationV2Enabled` | 字段默认值 |
| `Notification` 加 `eventKind` / `eventId` / `tier` / `severity` / `contentHash` / `revokedAt` | 新增 index |
| `NotificationDispatchLog` 加 `channel` / `success` / `error` / `severity` | unique 五维变更 · 旧数据兼容 |
| `PushSubscription` 加 `sessionId` / `isActive` / `deactivatedAt` | isActive=true 默认 |

**`prisma db push` 还没跑** · 实际推送时若失败需手动处理。

---

## 六、未测试的 cron 调度（5 个 tick）

| Tick | 未验证 |
|---|---|
| tickClassSessions（T-30/T-5/T-0）| 改 link 后窗口扫描是否正常 |
| tickPracticeTasks（t24h / t6h）| 新加 · 完全未跑过 |
| tickPersonalReminders（临期/日报/周报）| schema 变更后是否仍工作（已修复 unique key 回归）|
| tickAchievementUnlocks（5min 聚合）| 新加 · 完全未跑过 |
| tickDharmaAssemblies（t1h 法会前）| 新加 · 完全未跑过 |
| gcOrphanedFiles（启动时 + 业务驱动）| 新加 · 完全未跑过 |

---

## 七、未测试的 Service Worker 改动

| 改动 | 验证缺失 |
|---|---|
| safeLink 智能补 /app 前缀 | 真机 PWA push click 跳转是否正确 |
| safeLink 拦截 javascript: / data: | 安全测试 |
| safeLink 拦截外部 URL（如 zoom.us）| 实测是否兜底到 /app/ |
| notificationclick handler 处理 link | 已打开窗口 vs 没打开 · 两种路径 |

---

## 八、未测试的关键场景

### 8.1 跨设备登录互踢 + push 清理
- 用户 A 设备登录 · push 订阅 active
- 用户 A 在 B 设备登录 · 旧 session 应被踢
- B 设备 push 订阅 active · A 设备 isActive=false
- A 设备**不再收 push** 是否真的工作？

### 8.2 单设备登录改造对老用户影响
- v2 之前已有的 PushSubscription（无 sessionId 字段）
- prisma db push 后 sessionId 是 null
- 是否会因 isActive=true 默认而仍接收 push？（应该是）
- 需要验证存量用户体验不被破坏

### 8.3 NotificationType enum 兼容
- 旧 v1 写入用 enum 值（class_announcement / reminder / achievement / system / class_session / class_session_soon）
- v2 dispatch 写入仍用 enum 值 · 但 eventKind 是任意 string
- 旧通知中心查询是否仍能正确 list？

### 8.4 班级共修详情页权限
- 学员看本班共修 ✅
- 学员看非本班共修 → 应返回 403 Forbidden
- 删除班级后访问 → 应 404
- 实际未验证

### 8.5 critical SystemAnnouncement 静默时段绕过
- 用户本地 23:00（静默期）
- admin 发 critical
- L3 filterUsersOutsideQuietHours 应该跳过过滤
- push 应立即发出
- 未验证

### 8.6 频率上限边界
- normal push 1h 内连发 6 条
- 第 6 条应被丢弃
- 同时 urgent push 仍能正常发
- 未验证

### 8.7 Achievement 聚合时序
- 5min 内多次答题 · 解锁 3 个 badge
- 第一个解锁瞬间不立即 push
- 5-6 分钟后 cron tick · 收到一条聚合
- 未验证（且涉及 detectAndPersist 写表 + cron flush 两阶段）

### 8.8 OrphanedFile GC
- 替换 cover · 旧文件写入 OrphanedFile
- 7 天前的行被清理 · 物理文件删除
- 未验证（需等 7 天才能验证 timing）

---

## 九、未测试的回归风险

### 9.1 旧 createNotification API 已删除
- `notifications/service.ts` 的 createNotification 函数已删
- 全文搜索确认无引用 · 但**实际运行时可能有动态调用未发现**
- 删除后任何漏的调用点会运行时 ImportError

### 9.2 announcements / feedback / reports 路径迁移
- 旧 createMany / tx.notification.create 改为 dispatchToUsers
- 行为变化：现在会发 push（之前不会）
- 用户体验：突然收到大量 push（积压公告）· 未评估

### 9.3 ClassSession 改 link 格式
- 旧 link = liveLink 外部 URL
- 新 link = /class/:id/sessions/:sid
- 用户从旧通知中心点已有通知（旧链接） · 仍会跳外部 URL（不影响）
- 但新通知会走详情页 · 行为变化

---

## 十、推荐验证顺序（部署后跑）

### Stage 1 · 基础部署验证（30 分钟）
1. prisma db push 执行成功 · 无错误
2. 后端启动 · 看 pm2 logs · 无 schema 不匹配 error
3. 前端构建成功 · 无 TS error
4. nginx serve 正常 · 浏览器能打开

### Stage 2 · 已有功能不破坏（1 小时）
5. 旧个人提醒三档 cron 仍正常发（schema 变更后）
6. 旧通知中心列表能加载（字段统一后）
7. 旧班级公告流程仍工作（改走 dispatchToUsers 后）
8. 旧 push subscription 用户仍能收到 push（isActive 字段默认）

### Stage 3 · 新事件源端到端（2 小时）
9. admin 发系统公告 → 学员收 push + 站内 + 跳详情页
10. admin 发法会 → 学员收 push + 跳详情页 + 外部链接跳 Zoom
11. 辅导员发班级公告 → 学员收 push（之前没有）
12. 辅导员下达任务 → 学员收 push + 跳班级页
13. 辅导员改共修时间 → 学员收 push「时间变更」
14. 辅导员取消共修 → 学员收 push + 跳班级首页
15. admin 移除学员 → 学员仅站内通知（无 push 弹）

### Stage 4 · 过滤层 + 偏好（1 小时）
16. 用户开 push 偏好「关闭成就」→ 答题解锁成就 · 不收 push
17. 用户在静默时段 → normal push 跳过 / critical 仍发
18. 单用户连发 6 条 normal → 第 6 条被丢弃 · 站内仍有

### Stage 5 · UI 详情页（1 小时）
19. 班级共修详情页倒计时（T-30 → T-5 → T-0）色彩切换
20. 共修「加入直播」按钮 target=_blank 跳 Zoom
21. 法会详情页「加入会议」跳外部
22. `/events` 综合列表显示班级 + 法会两种活动
23. 首页 EventsButton 跳 /events

### Stage 6 · admin 路径（30 分钟）
24. /admin/system-announcements 完整 CRUD
25. /admin/dharma-assemblies 完整 CRUD
26. 撤回二次确认 + 行置灰

### Stage 7 · 边界（1 小时）
27. 跨设备登录互踢 + 旧设备不收 push
28. 法会软删后已调度 cron 跳过
29. 撤回的通知点击显示 toast
30. OrphanedFile 标记（验证写入即可 · 7 天 GC 无法即时验证）

---

## 十一、当遇到 bug 时的回滚预案

### 11.1 数据库回滚
- prisma db push 仅加字段 / 新表 · **非破坏式** · 不需要数据回滚
- 紧急时：保留新表 · 仅停用代码路径

### 11.2 代码回滚
```bash
# 在生产服务器
cd /home/ubuntu/projects/juexue
git log --oneline | head -5  # 看最近 commits
git checkout <上一个稳定 commit>  # 比如部署前的
pm2 reload juexue-api
```

### 11.3 feature flag 紧急停服
当前未实现 SystemConfig.notification_v2_global flag（v3 才做）· 无法用 flag 一键关停。**紧急时只能 git checkout 回滚**。

---

## 十二、永久建议

1. **打包 iOS 后立即按 §10 顺序验证** · 不要拖
2. 每发现一个 bug · 记录到本文档 + 修复 · 然后 commit
3. v3 启动前 · 确保本文档所有项都已 ✅ 或明确「暂不实施」
4. 部署后建议先发 critical SystemAnnouncement「测试公告」给小范围用户 · 验证 push 链路再正式启用

---

## 十三、文档维护

每完成一项验证：
- 在本文档对应项后加 ✅ + 验证日期
- 部分验证 · 加 🟡 + 注明已验证的子项
- 发现 bug · 加 🔴 + 关联 commit 修复

最终目标：本文档所有项变 ✅ · 即可宣告 v2 通知系统**生产就绪**。
