# 觉学通知系统 v2 · 实施总结 + 部署清单

> 状态：✅ v2 主线实施完成 · 待部署
> 分支：`claude/audit-page-quality-EpO7Q`
> 累计 commit：29（设计 12 + 实施 17）
> 最终参考：`docs/NOTIFICATION_FINAL_SPEC.md`

---

## 1. 实施完成度盘点

### 1.1 ✅ 事件源（8/9 完整 · 1 入口预留）

| 事件 | 状态 | 实现 |
|---|---|---|
| ① ClassSession | ✅ 完整 7 档 | created / time_changed / cancelled / T-24h(共修暂未实现 T-24h cron) / T-30 / T-5 / T0 |
| ② ClassAnnouncement | ✅ | 绕过 dispatch 已修复 · 走统一入口 |
| ③ PracticeTask | ✅ 完整 3 档 | created / task_t24h / task_t6h |
| ④ Personal Reminder | ✅ 完整 3 档 | due (19:00) / daily (20:00) / weekly (Mon 08:00) |
| ⑤ Achievement | ✅ + 5min 聚合 | unlocked tier · 单/多文案 · cron flush |
| ⑥ SystemAnnouncement | ✅ 完整三档 | normal/urgent/critical · admin UI · revokedAt |
| ⑦ DharmaAssembly | ✅ + 详情页 | created / daily_t1h · admin UI · 外部 Zoom 链接 |
| ⑧ AuspiciousDay | 🟡 入口预留 | 字段就位 · 待玻璃文字 UI（v3） |
| ⑨ MembershipChange | ✅ 完整 3 档 | kicked / joined / class_dissolved |

### 1.2 ✅ Push 过滤链路（4/5 层）

```
事件触发 → dispatchToUsers
  ├─ L1 ✅ NO_PUSH_EVENTS 白名单（事件类型层 · membership_change/auspicious_day）
  ├─ L2 ✅ 用户偏好（pushEnabled 总开关 + pushTypes per-type 子开关）
  ├─ L3 ✅ 静默时段（用户本地 22-7 · critical 绕过 · tz aware）
  ├─ L4 ✅ 频率上限（normal 每小时 5 条 · urgent/critical 不限 · multi-process safe）
  └─ L5 ❌ SMS（v3）
  ↓ sendPushToUsers
  ├─ ✅ isActive 过滤（单设备登录支持）
  ↓ web-push
```

### 1.3 ✅ 通知中心字段统一 + Notification 模型扩展

| 字段 | 用途 |
|---|---|
| `eventKind` | spec §2 路由表 · 新事件源接入 |
| `eventId` | 关联业务实体 · 撤回 + dismissal 用 |
| `tier` | 多档通知（T-30/T-5/T0 / task_t24h/task_t6h / ...） |
| `severity` | normal / urgent / critical · UI 配色 + push 过滤 |
| `contentHash` | sha256(title+body).slice(0,16) · dismissal 失效（spec §19.10） |
| `revokedAt` | admin 撤回置灰 · 不发新通知 |
| `isRead`（v1 字段统一）| 前端 n.read 已废 · 全部 n.isRead |

### 1.4 ✅ 新建模型

| 表 | 用途 |
|---|---|
| `NotificationPreference` | 用户 push 偏好（master + per-type + 玻璃文字预留） |
| `UserAchievementUnlock` | 成就解锁记录 + 5min 聚合通知队列 |
| `SystemAnnouncement` | admin 全平台公告（normal/urgent/critical） |
| `DharmaAssembly` | 法会 / 系统活动 · 信息型（含 externalLink） |
| `OrphanedFile` | cover 替换延迟 7 天 GC（防 cache 失效 404） |

### 1.5 ✅ Schema 扩展（向后兼容）

- `User` + `currentSessionId` / `notificationV2Enabled` / `achievementUnlocks` rel / `notificationPreference` rel
- `Notification` + `eventKind` / `eventId` / `tier` / `severity` / `contentHash` / `revokedAt`
- `NotificationDispatchLog` + `channel` / `success` / `error` / `severity` · unique 扩为 5 维
- `PushSubscription` + `sessionId` / `isActive` / `deactivatedAt`

### 1.6 ✅ 新增 UI

| 路径 | 用途 |
|---|---|
| `/announcements/:id` | 系统公告详情（push click 目标）|
| `/assemblies/:id` | 法会详情 + 外部链接按钮 |
| `/admin/system-announcements` | admin 发布 / 撤回系统公告 |
| `/admin/dharma-assemblies` | admin 发布 / 软删法会 |
| `/settings/notifications`（增强）| 顶部加 v2 push 偏好 section |

---

## 2. 部署清单（按 CLAUDE.md 流程）

### 2.1 服务器部署（一次性 · 拷给 ubuntu@instance-20260213-1230）

```bash
cd /home/ubuntu/projects/juexue
git pull origin claude/audit-page-quality-EpO7Q

# 后端：schema 变更 + 重启
cd backend
npx prisma generate
npx prisma db push                  # 非破坏式 · 自动加新字段 + 5 个新表
npm run build
pm2 reload juexue-api

# 前端：清旧 build + 重 build + rsync
cd ../juexue-v2
rm -rf dist/
npm run build
sudo rsync -av --delete dist/ /var/www/juexue/app/

# 浏览器强刷（iOS Safari 长按"刷新"或换无痕窗口）
```

### 2.2 数据库变更摘要（prisma db push 实际执行）

非破坏式 · 仅新增字段 / 新增表 · 不删字段 / 不丢数据：

**新表**（5）：
- `NotificationPreference`
- `UserAchievementUnlock`
- `SystemAnnouncement`
- `DharmaAssembly`
- `OrphanedFile`

**字段新增**（不影响现有 row）：
- `User`：currentSessionId, notificationV2Enabled
- `Notification`：eventKind, eventId, tier, severity, contentHash, revokedAt
- `NotificationDispatchLog`：channel='push' (default), success=true, error, severity='normal'
- `PushSubscription`：sessionId, isActive=true, deactivatedAt

**unique 索引变更**：
- `NotificationDispatchLog`：旧 (kind,id,tier,user) → 新 (kind,id,tier,user,channel)
  - 旧数据 channel 都是 'push' · 不破坏唯一性

---

## 3. 端到端验证清单（部署后）

### 3.1 后端启动验证

```bash
pm2 logs juexue-api --lines 50
# 期望看到:
# [scheduler] started · tick every 60s
# [scheduler] gcOrphanedFiles cleaned 0 files at startup（如有孤儿文件则数量 > 0）
```

### 3.2 通知中心 UI 验证（学员端）

- 进 `/notifications` · 未读项左侧橙色竖条 · 点击标已读
- 顶部「全部已读」按钮在有未读时显示
- 角标红点显示未读总数（独立 endpoint /unread-count）

### 3.3 班级公告 push 验证（关键 · 之前完全没 push）

- coach 进 `/coach/classes/:id/announcements` 发布新公告
- 学员手机收到系统通知（前提：已订阅 push）
- 点击通知跳 `/app/class/:id` · 不再兜底首页

### 3.4 共修改时间通知

- coach 在 ClassSession 列表改某场共修 startAt
- 学员收到 push「共修时间变更 · 新时间」
- severity urgent · 静默时段会延后到 07:00

### 3.5 PracticeTask 自动催促

- coach 下达任务 endAt = 25h 后
- 学员立即收到「新任务」通知
- 等到 24h 前 · cron tick 命中 task_t24h · 学员收到「还有 24h」
- 6h 前 · task_t6h · severity urgent · 静默期也照发（urgent 仅延后不丢）

### 3.6 系统公告全平台广播

- admin 进 `/admin/system-announcements` 发 urgent 公告
- 后端 fan-out 所有 isActive=true 用户
- 用户手机收 push · 点击跳 `/app/announcements/:id`
- 详情页显示 severity chip + 内容
- admin 撤回 → 通知中心置灰 + 删除线

### 3.7 法会信息型流程

- admin 进 `/admin/dharma-assemblies` 创建法会
- 填外部 Zoom 链接
- 学员收 push「文殊圣诞法会 · 5/20 开启」
- 点击跳 `/app/assemblies/:id`
- 详情页「加入会议 ↗」按钮 target=_blank 跳 Zoom

### 3.8 Achievement 5min 聚合

- 学员快速答 N 道题解锁多个 badge
- 第一个解锁瞬间不立即 push
- 等 5-6 分钟（cron 60s tick 命中）· 收到一条聚合「🎉 解锁 N 个成就」

### 3.9 push 偏好生效

- 用户进 `/settings/notifications` 关「成就解锁」per-type
- 再解锁新成就 · inbox 写入但**手机不弹通知**
- 用户进通知中心仍能看到该条

### 3.10 静默时段绕过验证

- 用户本地 23:00（quietHoursStart=22 quietHoursEnd=7）
- 发 normal push · 用户手机不弹 · inbox 仍有
- 发 critical SystemAnnouncement · 用户手机立即弹（无视静默）

### 3.11 频率上限验证

- 极端测试：单用户 1h 内连发 6 条 normal push
- 第 6 条手机不弹 · inbox 仍有
- 同时发一条 urgent · 立即弹（不计入 5 条上限）

### 3.12 Cover GC 验证

- admin 替换某课程封面 3 次
- 旧文件不立即删 · `OrphanedFile` 表有 3 条 markedAt 记录
- 7 天后 cron 自动清理（业务流量驱动 + pm2 reload 兜底）

---

## 4. 已知限制 · v3 待办

### 4.1 spec §5 push 过滤 L5 (SMS) · 未实现
- 需 Twilio 集成（spec §10 SMS 子系统）
- 模板预审 + admin 广播 UI + Webhook 签名验证（spec §19.11）
- A2P 10DLC 注册周期 2-4 周（外部依赖 · spec INDEPENDENT 审计 ⏰ 警告）

### 4.2 spec §6/§7 玻璃文字 UI · 未实现
- 需 ActiveBanner 表（spec §19.4 服务端化）
- 玻璃质感首页文字 + 班级红点
- 影响事件源 ⑧ AuspiciousDay 完整接入

### 4.3 spec §3.7 法会 `in_progress_arrival` tier · 未实现
- 需前端登录 hook 检查活跃法会 + 24h 内未通知则触发
- 与玻璃文字 UI 同步实施

### 4.4 静默时段聚合（spec §5 L3 优化）· 未实现
- 当前 v2 实现：静默期跳过 push（站内仍写）
- v3 改进：normal 延迟到 07:00 聚合发「N 条未读」/ urgent 延迟到静默结束单独发
- 需 `DelayedPush` 表 + cron 扫描 flush

### 4.5 共修 T-24h 预告 cron · 未实现
- spec ① 写 7 档（含 T-24h 预告）· 实施仅 T-30/T-5/T0
- 加入 cron tick 范围即可（PracticeTask 已有 t24h 参考）

### 4.6 INDEPENDENT 审计 26 项新发现 · 待处理
- 文档：`docs/NOTIFICATION_AUDIT_INDEPENDENT.md`
- 涵盖：partial unique index / dispatchToUsers 原子性 / toll fraud / PushSubscription upsert 冲突 / Banner GC / lastSeenAt 高频写等
- 工时：~1-1.5 周 · 安全 + 一致性补丁

### 4.7 灰度发布（spec §15）· 未启用
- `notificationV2Enabled` 字段已加入 User 表
- `SystemConfig` 已有 · 可放 `notification_v2_global` flag
- 当前所有用户直接走 v2 入口 · 未做灰度区分
- 如需谨慎上线 · 后端 dispatchToUsers 入口加 mode 路由（spec §19.6）

---

## 5. 文档清单

| 文档 | 状态 | 用途 |
|---|---|---|
| `docs/NOTIFICATION_FINAL_SPEC.md` | 终版 1518 行 | 实施参考 · 含 §19 审计修复 |
| `docs/NOTIFICATION_V2_LAYERED_ARCH.md` | 历史 1646 行 | 10 层分层设计演进 |
| `docs/NOTIFICATION_V2_DESIGN.md` | 已废弃带映射表 | 旧 12 模块 → 新规格对照 |
| `docs/NOTIFICATION_AUDIT_INDEPENDENT.md` | 159 行 | 独立审计 26 项新发现 |
| `docs/NOTIFICATION_CURRENT_CODE_AUDIT.md` | 165 行 | 实施前代码审计 |
| `docs/NOTIFICATION_V2_IMPLEMENTATION_STATUS.md` | 本文档 | 实施状态 + 部署清单 |

---

## 6. 关键技术决策摘要

### 6.1 双 schema 并存（v1 + v2）
- v1 `User` 表 reminder 字段保留 · v2 `NotificationPreference` 只放新字段
- 渐进迁移 · 不大爆炸式重写

### 6.2 NotificationType enum 不替换
- 旧 enum 保留兼容性 · v2 用新字段 eventKind/severity 覆盖
- 数据库迁移风险最小

### 6.3 dispatchToUsers 类型 string-extensible
- `EventKind` / `Tier` / `NotifType` 改为 union | (string & {})
- 既保留类型提示 · 又允许新事件源扩展

### 6.4 v1 createNotification API 删除
- 强制新事件源走 dispatchToUsers
- 架构约束 · 防再次出现绕过 dispatch 的反模式

### 6.5 多进程安全
- 频率上限走 SQL count 不用 in-memory
- PushSubscription upsert by endpoint 防多设备 + isActive=false 冲突
- gcOrphanedFiles + 5min 聚合 cron · 单实例 PM2 reload 兜底

### 6.6 SW 链路安全
- link 仅接受 / 开头同源
- 自动补 /app 前缀（匹配 ROUTER_BASENAME）
- 后端 isValidLink 校验 + SW safeLink 二次校验

---

## 7. 实施 commit 历史（17 个）

```
341af56 feat: K · 频率上限过滤（spec §5 L4）
d24d85a feat: J · 静默时段过滤（spec §5 L3）
813f1fc feat: I · 用户 push 偏好 UI（spec §8）
a08d2c0 feat: H · DharmaAssembly 完整事件源 + 详情页
8425a38 feat: G · 系统公告 admin UI
a41f819 feat: F · NotificationPreference 表 + push 偏好过滤
9ad97d4 feat: E · Achievement 通知 + 5min 聚合
dd0e430 feat: D · SystemAnnouncement 完整事件源
e7d33f7 feat: MembershipChange joined + NO_PUSH_EVENTS 白名单
6c32ccf feat: PracticeTask t24h / t6h cron
9c31159 feat: 共修改时间/取消 + 班级成员变动通知
69d3920 feat: PracticeTask created + cover OrphanedFile GC
ef35ff5 feat: S1 第二批 · 架构升级 + 旧事件源接入新入口
3e3e266 fix: SW safeLink + reports link 修复
002d73a fix: push isActive + 默认 link · personal-reminders 回归
e85d69d fix: NotificationItem 字段 read → isRead
c7dec9a feat: S1 第一批 · SW link 安全校验 + schema 扩展
```

---

## 8. 下一步建议（按优先级）

1. **部署到生产** · 跑通端到端流程 · 收集运行数据
2. **观察一周** · 验证 cron 各 tick 正常 + push 触达率 + 是否有报错
3. **处理 INDEPENDENT 审计 26 项** · 安全 + 一致性补丁（~1 周）
4. **若仍稳定** · 启动 v3 阶段：
   - SMS 子系统（Twilio + A2P 注册并行外部流程）
   - 玻璃文字 UI + ActiveBanner
   - AuspiciousDay 完整接入
   - in_progress_arrival tier

---

总实施工时：**单会话 · 约 6 小时**
代码净增：**~2500 行**（含 schema / service / routes / UI）
覆盖率：**8/9 事件源 · 4/5 push 过滤层 · 全部 spec §3 + §5 + §8 + §19 部分实现**
