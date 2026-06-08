# 个人提醒系统 v1 · 部署与冒烟测试

> 状态：✅ 实施完成（branch `claude/audit-page-quality-EpO7Q`）
>
> 关联：`docs/NOTIFICATION_PLAN.md`（总体设计 · 三档时段 + 静默 + 偏好）

---

## 一、新增功能一览

### 后端

| 文件 | 作用 |
|---|---|
| `backend/prisma/schema.prisma` | User 加 8 个字段 + NotificationRule 新模型 |
| `backend/src/modules/scheduler/time-utils.ts` | 时区折算（user-local hour / ISO week / 静默判断） |
| `backend/src/modules/scheduler/reminder-queries.ts` | 三档数据评估（buildPayload）|
| `backend/src/modules/scheduler/personal-reminders.ts` | tickPersonalReminders + manual trigger |
| `backend/src/modules/scheduler/cron.ts` | 主 tick 接入 |
| `backend/src/modules/scheduler/dispatch.ts` | EventKind 扩展 |
| `backend/src/modules/notifications/prefs.routes.ts` | 学员 + admin API |

### 前端

| 文件 | 路由 | 受众 |
|---|---|---|
| `juexue-v2/src/pages/SettingsNotificationsPage.tsx` | `/settings/notifications` | 学员 |
| `juexue-v2/src/pages/AdminNotificationRulesPage.tsx` | `/admin/notification-rules` | admin |
| `juexue-v2/src/pages/SettingsPage.tsx` | 加链接到 `/settings/notifications` | 学员 |
| `juexue-v2/src/components/AdminShell.tsx` | nav 加"通知规则"入口 | admin |

---

## 二、部署步骤

### 1. 后端

```bash
cd backend
pnpm prisma generate
pnpm prisma db push        # 非破坏式同步 schema（加 User 字段 + NotificationRule 表）
pnpm build
# pm2 restart juexue-backend  ← 或你的 process manager
```

### 2. 前端

```bash
cd juexue-v2
npm run build
sudo rsync -av --delete dist/ /var/www/juexue/app/
```

### 3. 验证 scheduler

后端进程启动日志应有：

```
[scheduler] started · tick every 60s
```

tick 命中后输出（仅当真发了）：

```
[scheduler] dispatched session=xxx tier=T-30 ...
```

个人提醒没有专门的日志输出（用 DispatchLog 表查）· 见下方测试。

---

## 三、冒烟测试

### 测试 1 · 学员偏好读写

1. 学员登录 → `/settings` → 点"通知偏好"
2. 看到三档卡片 + 静默时段 + 时区
3. 切换"临期提醒" toggle off → 后端 `User.eveningReminderEnabled = false`
4. 改临期时段为 "自定义 21:00" → `User.eveningReminderHour = 21`
5. 改静默时段 22 → 23 → `User.quietHoursStart = 23`

验证：`SELECT * FROM "User" WHERE id = 'xxx';` 字段被更新。

### 测试 2 · admin 配平台默认

1. admin → `/admin/notification-rules`
2. 把"临期提醒"时段改成 18 → 点保存
3. `SELECT * FROM "NotificationRule" WHERE "triggerType" = 'evening-due';` 应有一条 `defaultHour = 18`
4. 学员侧 `/settings/notifications` 临期 row 显示"自动 18:00"（如果学员没自定义）

### 测试 3 · 手工触发周报

1. admin → `/admin/notification-rules` → 滚到底部"手工触发测试"
2. 输入自己的 userId（用 `SELECT id FROM "User" WHERE email = 'admin@...'` 拿）
3. 选"周报" → 点"触发"
4. 看 toast：
   - "已发送" = 后端跑通 + 写了 Notification + 尝试 push
   - "未发送：no-payload" = 用户上周 0 修学（这是预期 · 跳过）
   - "未发送：user-not-found" = userId 错
5. 学员侧右上角铃铛 → 看通知中心 → 应该有一条"师兄 · 上周共修学 X 次"
6. 如果浏览器开了 push 权限 → 应该收到系统 push

### 测试 4 · DispatchLog 幂等

1. 同一用户重复触发"日报" → 第二次也"已发送"（因为 eventId 用 `manual-{timestamp}` 不撞）
2. 真正的 cron tick 重复发同一用户同一天日报：
   - 手动 `INSERT INTO "NotificationDispatchLog" ...` 模拟已发
   - 或者改用户时段 → 等待自然触发 → 触发一次 → 重启 cron → 不会再发

### 测试 5 · 静默时段拦截

1. 学员把临期改为 23:00 · 静默 22:00-07:00
2. 23 点本地时间 cron tick · 应跳过（静默命中）
3. DispatchLog 该日 'evening-due' 行不存在
4. 改静默为 22:00-22:30（仅 30 分钟）· 改临期 22:30 → 应能发

---

## 四、运行时观察

### 看 DispatchLog 验证发了哪些

```sql
SELECT
  "eventKind",
  "eventId",
  COUNT(*) AS user_count,
  MAX("pushedAt") AS last
FROM "NotificationDispatchLog"
WHERE "pushedAt" > NOW() - INTERVAL '7 days'
GROUP BY "eventKind", "eventId"
ORDER BY last DESC;
```

### 看用户偏好分布

```sql
SELECT
  COUNT(*) FILTER (WHERE "eveningReminderEnabled") AS evening_on,
  COUNT(*) FILTER (WHERE "dailyDigestEnabled") AS daily_on,
  COUNT(*) FILTER (WHERE "weeklyReportEnabled") AS weekly_on,
  COUNT(*) FILTER (WHERE "eveningReminderHour" IS NOT NULL) AS evening_custom,
  COUNT(*) AS total
FROM "User"
WHERE "isActive" = TRUE;
```

### 看推送送达率

```sql
-- DispatchLog 写了行 = 站内 Notification 写了
-- web push 实际送达率看进程日志 [dispatch] sendPushToUsers 输出
```

---

## 五、已知限制

| 限制 | 说明 | 后续 |
|---|---|---|
| 全用户全表扫描 | 每分钟拉所有 isActive user · 1000 用户/min 约 50ms · 万人级要分桶 | Phase 2 按 tz 分桶 |
| 周报班级排名简化 | 仅按"上周 7 天 PracticeEntry 总数"算 · 与 `/study-ranking` 综合积分不完全一致 | 等用户反馈 |
| 文案不可改 | sc/tc/en 写死代码 · 改文案要发版 | 故意为之（产品调性 DNA）|
| 邮件 / SMS | 未实施 · 仅 web push + 站内 | Phase 2 接 Resend / Twilio |
| Coach 周报 | 未实施 | Phase 2 |
| 全局每日 3 条 push 上限 | 未实施（只有 DispatchLog 单事件去重）| Phase 2 加 `notif*Count today` 限流 |

---

## 六、回滚

如需快速关闭：

```bash
# 后端：环境变量
CRON_ENABLED=false  # 整个 scheduler 不跑（class-session 提醒也会停）

# 或：每个用户单独关
UPDATE "User" SET
  "eveningReminderEnabled" = FALSE,
  "dailyDigestEnabled" = FALSE,
  "weeklyReportEnabled" = FALSE;
```

UI 路由可以保留 · 数据不丢。

---

## 七、跟踪指标（v1 后观察 2 周）

1. 三档发送量（DispatchLog count）
2. 用户关掉 toggle 的比例（`enabled = false` 计数）
3. Push CTR：从 Notification 点击进 link 的 vs 单纯 in-app 看的
4. 周报 ↔ 学员留存：发周报当周 7 日 DAU vs 不发的

如果周报 CTR > 30% · 个人提醒就跑通了，下一步做 Coach 周报。
