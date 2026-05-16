# 觉学通知系统 · 阶段 3 + v3 实施路线图

> 状态：📋 待启动
> 前置：v2 已完成（`docs/NOTIFICATION_V2_IMPLEMENTATION_STATUS.md`）+ 部署 + 一周观察
> 总工时：阶段 3（~1 周）+ v3 主线（~5-6 周）= **~7 周**
> 关联文档：
> - `docs/NOTIFICATION_FINAL_SPEC.md`（设计参考 · spec §X.Y）
> - `docs/NOTIFICATION_AUDIT_INDEPENDENT.md`（审计 26 项来源）

---

# 阶段 3 · INDEPENDENT 审计补丁（~1 周）

## 3.0 排序原则

按「上线风险 + 数据完整性 + 安全性」三维评估 · 分四批：
1. 阻塞批（A1-A3）· 必修才能稳定运行
2. 高优批（B1-B7）· 影响功能正确性
3. 中优批（C1-C8）· 性能 + 可维护性
4. 小问题批（D1-D7 + 排期）· 收尾打磨

## 3.1 🚨 阻塞批（3 项 · 1.5 天）

### A1. critical 系统公告灰度并存漏洞
**来源**：§19.4 + §19.6 · 灰度模式下 critical 公告 v1 用户错过 ack 重浮机制
**实施步骤**：
1. dispatchToUsers 入口加 critical 检测
2. 若 `severity === 'critical'` AND `globalMode !== 'on'` · 强制走 v2 路径（不论 user.notificationV2Enabled）
3. 或：admin 创建 critical 公告时锁定全平台 v2 模式

**验证**：灰度名单外用户也能收到 critical · banner 重浮逻辑生效
**工时**：0.5 天

### A2. SmsBroadcast audienceData 未限制大小
**来源**：§13 · 未来 SMS 实施时 audienceData JSON 可吞数 MB
**实施步骤**（v3 实施时一起做）：
1. zod schema 校验 userIds 数组 `.max(5000)`
2. 服务端二次校验 audienceData 大小 ≤ 100KB
3. estimatedCount > 2000 触发二次审批
4. admin 前端预览时显示「将发给 N 人 · 预估 $X」

**注**：v3 SMS 实施前不会真触发 · 但代码就位防误用
**工时**：v3 子任务 · 现阶段不单独做

### A3. NotificationDispatchLog 唯一索引让补发永远失败
**来源**：§13 + §19.3 · success=false 也占用 unique 键 · 用户重订阅后无法补发
**实施步骤**：
1. 改 unique 为 partial unique index（Postgres）：
   ```prisma
   // schema.prisma 改造
   @@unique([eventKind, eventId, tier, userId, channel])
   // SQL: CREATE UNIQUE INDEX ... WHERE success = true
   // Prisma 不直接支持 partial index · 需 raw migration
   ```
2. 或：在 dispatchToUsers 写 log 前先 delete 旧的 success=false 同键 row
3. 推荐路径 2（简单 · 不依赖 raw migration）

**验证**：模拟 push 失败（endpoint 410）· 用户重新订阅 · 再 dispatch 同 event/tier 能成功投递
**工时**：1 天（含测试）

---

## 3.2 ⚠️ 高优批（7 项 · 3 天）

### B1. eventId 命名空间规约
**来源**：§13 NotificationCardAck · 跨 kind eventId 冲突风险
**实施**：
- 文档加「eventId 命名空间规约」一节
- 校验：所有 dispatchToUsers 入口的 eventId 必须是 model.id 直引（非复合 ID）
- 例外：MembershipChange 用 `${classId}:${userId}` 已经 namespaced · 改为 `mem-${classId}-${userId}` 防与其他 model.id 冲突
- 单元测试：所有 dispatchToUsers 调用点检查 eventId 格式

**工时**：0.5 天

### B2. dispatchToUsers 非原子 · OOM 丢消息
**来源**：§12 · logDispatch 在 4 通道前写 · 中途崩溃用户永久丢消息
**实施**：
- 改为通道粒度写 log · 每通道成功后单写一行
- 当前 schema 已有 channel 字段（不破坏）
- 重构 dispatchToUsers step 2 · 把单一 log 拆为 4 个 channel-level log
- 失败时该 channel 的 log 不写 · 下次重试时不会被 dedup 跳过

**风险**：unique 索引扩展（已含 channel）· 数据兼容 OK
**工时**：1 天

### B3. critical SMS 无熔断 · toll fraud 风险
**来源**：§19.17 · admin 误操作或被攻击可烧光预算
**实施**（v3 SMS 实施时）：
1. critical SMS 也加月度硬上限（$500 cap）
2. 单次广播 > 2000 人需双 admin 二次审批
3. 1 小时冷静期（同一 admin 连续 critical 触发抑制）
4. 异常模式触发图形验证码

**工时**：v3 子任务 · 现阶段记入待办

### B4. PushSubscription endpoint 冲突
**来源**：§19.2 · isActive=false 旧记录 vs unique endpoint
**实施**：
- push subscription 入口改用 upsert（findUnique by endpoint）
- 命中已存在记录时 update `isActive=true, sessionId=newSid, deactivatedAt=null`
- 不插新行 · 防 unique 冲突

**验证**：用户登出再登入同浏览器 · push 订阅复用同一 row · isActive 切换正常
**工时**：0.5 天

### B5. Critical Banner 重浮死循环
**来源**：§19.4 · revokedAt 写入失败 / cache 未 refetch → banner 永留
**实施**（v3 玻璃文字 / banner 实施时）：
- `GET /api/me/active-banners` 服务端 join 关联表
- 校验 `SystemAnnouncement.revokedAt IS NULL AND expiresAt > now()` 而非仅看 ActiveBanner 字段
- 防止 revokedAt 单边写入失败导致 banner 永浮

**工时**：v3 子任务

### B6. 玻璃文字数据陈旧
**来源**：§7 · home-summary 客户端缓存 · 共修开始后仍显「下次共修」
**实施**（v3 玻璃文字实施时）：
- React Query staleTime 设为基于 `nextSession.startAt` 的动态过期 timer
- visibilitychange 事件触发强制 refetch
- 共修开始时刻自动从「下次」滚到「进行中」

**工时**：v3 子任务

### B7. ActiveBanner GC 缺失
**来源**：§13 · critical 永久型 banner 只增不减
**实施**（v3 ActiveBanner 实施时）：
- 加每日 cron `tickActiveBannerGC`（与 OrphanedFile 类似业务驱动）
- 删 `(ackedAt IS NOT NULL OR dismissedAt IS NOT NULL OR expiresAt < now()) AND createdAt < now() - 7d`
- 总保留期 7 天 · 历史审计另存（如需）

**工时**：v3 子任务

---

## 3.3 💡 中优批（8 项 · 3 天）

### C1. Banner CTR 统计缺基础（v3 子任务）
- ActiveBanner 加 `clickedAt DateTime?` 字段
- 区分点击 vs × 关闭 vs 自动过期

### C2. SMS 国际号码合规（v3 SMS 子任务）
- 加 `smsConsent` 字段记录用户同意：IP + UA + 时间戳
- 印度 DLT / 欧盟 GDPR consent / 巴西 RNC 合规

### C3. 时区改动后已 schedule 通知重算
**来源**：§11.2 · 用户改时区后 enqueue 的延迟 push 时刻错位
**实施**：
- 静默时段判断改为「发送瞬间」重新评估 user.timezone
- 不在 enqueue 时锁定时刻
- 当前 v2 实现已经是发送时刻读取 user.timezone · 已正确（再 verify 即可）

**工时**：0.5 天（仅 verify + 测试）

### C4. lastSeenAt 高频写放大
**来源**：§9.1 · 每个 API 调用 update User.lastSeenAt
**实施**：
- 节流到 5 分钟一次：`WHERE lastSeenAt < now() - 5min` conditional update
- 或：用 Redis NX 锁（项目无 Redis · 用 DB conditional）

**工时**：0.5 天

### C5. Push 静默聚合无 contentHash 去重（v3 子任务）
- 静默期同事件 T-30/T-5 聚合时按 (kind, eventId) 折叠
- 显示「1 条共修提醒」而非「2 条未读」

### C6. AuspiciousDay 编辑并发（v3 子任务）
- admin 编辑文案后 push invalidate

### C7. Achievement 聚合 job 用户已删号
**来源**：§19.9 · flush job 执行时 user 已删 · query 失败 BullMQ 重试
**实施**：
- tickAchievementUnlocks 开头检查 user 存在性 + isActive
- 用户已删 → 直接标 notifiedAt 防 stuck

**工时**：0.5 天

### C8. dispatchV1 vs Shadow 双写冲突
**来源**：§19.6 · 灰度 shadow 模式两路径都写 Notification 表
**实施**：
- 当前 v2 未实施灰度 · 直接用 v2 · 无双写冲突
- 若未来启用灰度 shadow 模式 · 新建 `NotificationShadow` 表存 v2 路径
- 不污染主表 · 对比验证

**工时**：未实施 shadow 时不需要

---

## 3.4 📝 小问题批（7 项 · 1 天）

### D1. coverTheme 字段类型不一致
- 统一为 `coverTheme: 'light' | 'dark' | null`（null = 待自动检测）
- 文档 §7.1 / §13 / §19.14 同步更新

### D2. expiresAt 必填仅 critical SystemAnnouncement
- urgent / normal 公告也加默认过期（30d）防玻璃文字老旧条
- 后端 zod schema 加 default

### D3. 共修 t0 severity=critical 但 banner 自动消失表格未列
- 文档 §6.3 补全：共修 t0 critical 不自动消失 · 进入直播间后缩成徽章
- 与 critical SystemAnnouncement 严格区分（后者必须 ack）

### D4. 8 周排期未含 i18n
- v3 阶段加入英文 UI 工时（如有海外用户需求）

### D5. SmsDeliveryLog GDPR 删号路径
- 用户删号时级联软删 SmsDeliveryLog（保留 30 天审计后物理删）
- 已在 spec §11 implied · 需明确实现

### D6. /api/me/active-banners 无 pagination（v3 子任务）
- ActiveBanner 列表 cursor 分页
- critical 期间 admin 误连发不会一次拉百行

### D7. PushSubscription.keys 加密存储
**来源**：§13 · endpoint 是用户可定位资产 · 应用层加密
**实施**：
- 用 `lib/crypto.ts` 加密存储 `p256dh` + `auth`（已存在则改造）
- 或：列加密扩展（pgcrypto）
- 防数据库泄露后 push 被攻击

**工时**：0.5 天

---

## 3.5 阶段 3 总工时与排期

| 批次 | 任务 | 工时 | 优先级 |
|---|---|---|---|
| 阻塞批 | A1 + A3 | 1.5 天 | 立即 |
| 高优批 | B1 + B2 + B4 | 2 天 | 第一周 |
| 中优批 | C3 + C4 + C7 | 1.5 天 | 第一周 |
| 小问题批 | D1 + D2 + D3 + D5 + D7 | 1 天 | 收尾 |
| **合计可在 v3 启动前完成** | | **~6 天** | |

剩余项（A2 / B3 / B5-B7 / C1-C2 / C5-C6 / C8 / D4 / D6）合并到 v3 主线相应模块中实施。

---

# v3 主线 · ~5-6 周

## 4.0 v3 核心目标

完成 spec 剩余的 3 大模块：
1. SMS 子系统（spec §10 + §11）
2. 玻璃文字 UI + ActiveBanner（spec §6 + §7）
3. AuspiciousDay 完整接入（依赖玻璃文字）

附加：
- 法会 in_progress_arrival tier（spec §3.7）
- 静默时段聚合 push（spec §5 L3 优化）
- 共修 T-24h 预告 cron
- 灰度发布机制（spec §15）

---

## 4.1 SMS 子系统（spec §10 + §11）· ~2 周

### 4.1.1 外部依赖（S0 提前启动 · 2-4 周外部周期）
**关键警告**（spec INDEPENDENT 审计排期警告）：
- Twilio A2P 10DLC 美国注册 · 2-4 周
- Twilio Chinese Carrier Approved Sender 申请 · 1-3 周
- **必须在工程实施前并行启动** · 否则会卡末期

**任务清单**：
- [ ] 注册 Twilio 商业账号 + 充值
- [ ] A2P 10DLC 注册（美国号码）
- [ ] Chinese Carrier Approved Sender 申请（中国号码到达率）
- [ ] 模板预审：assembly_t24h / system_critical / OTP（中英双语 4 份）
- [ ] Webhook URL 配置（投递状态 + 入站 STOP）

### 4.1.2 后端实施（~1 周）

**Schema**（已在 spec §13 设计）：
- `SmsDeliveryLog`：投递记录 + cost + Twilio SID
- `SmsTemplate`：模板备案记录（多语言）
- `SmsBroadcast`：admin 广播历史
- `User` 加 SMS 偏好字段（phoneNumber / phoneCountryCode / phoneVerifiedAt / smsEnabled / smsAssemblyAlerts / smsLanguage）

**Service**：
- `sendOtpSms` · OTP 验证码独立路径（spec §19.7 不受 global flag 影响）
- `sendBusinessSms` · 业务 SMS（受 global flag 控制）
- `filterUsersForSms`（spec §11.2 7 层过滤）：
  - L1 手机号已验证
  - L2 总开关 smsEnabled
  - L3 事件类型 + tier 白名单
  - L4 子开关 smsAssemblyAlerts
  - L5 静默时段（critical 绕过）
  - L6 频率上限（日 2 + 月度预算 $100）
  - L7 幂等去重
- Twilio 投递回调 · 签名验证（spec §19.11）
- STOP 入站处理 · 同步用户偏好

**Routes**：
- 用户：`GET/PATCH /api/my/sms-preferences`
- 用户：`POST /api/my/phone/bind` · `POST /api/my/phone/verify` OTP
- admin：`POST /api/admin/sms/broadcast` + audienceData 大小校验（A2 在此实施）
- Webhook：`POST /api/sms/webhook/twilio-status` + `POST /api/sms/webhook/twilio-inbound`

**dispatchToUsers 集成 L5**：
- SMS 是第 5 通道 · 并行其它通道
- 仅 `critical SystemAnnouncement` / `dharma_assembly t24h`（用户子开关开）触发
- 静默时段 / 频率上限独立计算（与 push 不共享）

### 4.1.3 前端实施（~3 天）

- `/settings/sms` 手机绑定 + OTP 验证 + 偏好（总开关 + 法会子开关 + 语言）
- `/admin/sms` admin 监控（消费 / 国家分布 / 失败率 / 紧急停服开关）
- `/admin/sms/broadcast` admin 广播 UI（受众选择 + 模板 + bypass 二次密码确认）

### 4.1.4 风险与缓解
- Toll fraud（高价号段欺诈）→ Geo Permissions 白名单
- TCPA 合规 → 强制 opt-in + STOP 关键字 + 仅事务性短信
- 账户被封 → 严格 spam policy + 留 opt-in 证据
- 中国到达率 → Approved Sender + 备 Vonage fallback

### 4.1.5 月预算
- 默认 $100/月（约 2000 中国 + 12500 美国 + 2500 其它号码）
- admin 后台 80% / 100% 双告警

---

## 4.2 玻璃文字 UI + ActiveBanner（spec §6 + §7）· ~2 周

### 4.2.1 ActiveBanner 表 + 队列管理（~3 天）

**Schema**（spec §19.4）：
```prisma
model ActiveBanner {
  id          String   @id @default(cuid())
  userId      String
  eventKind   String
  eventId     String
  tier        String
  severity    String      // 'urgent' | 'critical' | 'achievement'
  title       String
  body        String
  link        String
  contentHash String?
  showCount   Int      @default(0)
  clickedAt   DateTime?   // C1 修复
  ackedAt     DateTime?
  dismissedAt DateTime?
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  @@index([userId, ackedAt, dismissedAt])
  @@index([expiresAt])
}
```

**服务端**：
- dispatchToUsers 触发条件满足时 upsert ActiveBanner row
  - `severity >= urgent` AND 临场行动类
- `GET /api/me/active-banners` · 服务端 join SystemAnnouncement 校验 revokedAt（B5 修复）
- `POST /api/me/active-banners/:id/ack` · critical 公告 ack
- `POST /api/me/active-banners/:id/dismiss` · 用户主动关
- `POST /api/me/active-banners/:id/clicked` · CTR 统计
- cron tickActiveBannerGC（B7 修复）

### 4.2.2 前端 Banner UI（~4 天）

**组件**：
- `<InAppBannerProvider>` 全局 Provider
- portal 渲染 · z-index 9999 · 玻璃质感 + framer-motion 滑入
- 队列管理（in-memory · 数据源是服务端）
- Achievement 金色样式特例（spec §3.5）

**触发**：
- SW push handler 检测 app 前台 → postMessage banner data
- App focus 时拉 `/api/me/active-banners` 初始化队列
- visibilitychange 重新检查（B6 修复）

### 4.2.3 首页玻璃文字（~3 天）

**API**：
- `GET /api/me/home-summary` 单接口聚合（spec §7.4）
- 返回 nextSession / todayTasks / unreadAnnouncementsCount / activeAssembly / todayAuspicious / classes(red dot)

**前端**：
- Hero 区域玻璃文字 · 文字优先级排序（spec §19.22）
- 班级卡红点（无数字 · 仅 has unprocessed events）
- React Query dynamic staleTime 基于 nextSession.startAt（B6 修复）
- 点击跳转矩阵（spec §7.3）

### 4.2.4 Banner 队列 + 玻璃文字协调（~1 天）

- Banner 显示中 · 玻璃文字保持平静（不展示倒计时）
- Banner ack/dismiss 后 invalidate home-summary

---

## 4.3 AuspiciousDay 完整接入 · ~3 天

依赖：玻璃文字 UI 完成

**实施**：
- AuspiciousDay 已有 TibetanDay 表 · 加文案 / 修法建议字段
- 首页玻璃文字加「🪷 今日加持日 · 农历 X 月 X 日 · YY 吉祥日」一行
- 点击跳 `/auspicious/:date` 介绍页
- admin 在 `/admin/calendar` 编辑文案（已有 admin 后台 · 加字段即可）
- push invalidate（C6 修复）

---

## 4.4 法会 in_progress_arrival tier · ~2 天

依赖：玻璃文字 UI · banner 服务端化

**实施**：
- 前端 AppShell 登录后检查活跃法会
- 检查最近 24h 内是否 dispatch 过 in_progress_arrival
- 未通知则触发 `POST /api/me/assembly-arrival/:id` 让后端 dispatch
- 一天一次（per user per assembly）

---

## 4.5 静默时段聚合 push（spec §5 L3 优化）· ~3 天

**Schema**：
```prisma
model DelayedPush {
  id        String   @id @default(cuid())
  userId    String
  eventKind String
  eventId   String
  tier      String
  title     String
  body      String
  link      String
  severity  String
  scheduledFor DateTime
  sentAt    DateTime?
  cancelledAt DateTime?
  @@index([scheduledFor, sentAt])
}
```

**实施**：
- dispatchToUsers L3 静默期 normal/urgent · 不直接跳过 push · 改为写 DelayedPush
- cron tickDelayedPush 60s 扫 scheduledFor < now AND sentAt = null
- 同用户 normal 多条聚合为「N 条未读」(C5 修复)
- urgent 单独发

---

## 4.6 共修 T-24h 预告 cron · ~1 天

**实施**：
- scheduler/cron.ts tickClassSessions 加 T-24h 档（已有 T-30/T-5/T0）
- offset = 24h
- severity normal · body 「明日 19:00 周共修」
- 沿用现有窗口 ±90s 模式

---

## 4.7 灰度发布机制（spec §15）· ~2 天

**实施**：
- SystemSetting 加 `notification_v2_global` key（'off' | 'shadow' | 'on'）
- dispatchToUsers 入口路由（spec §19.6）：
  - off → 全平台 v1（OTP 例外 §19.7）
  - shadow → v1 完整 + v2 仅 inbox 双写（不发 push/sms）
  - on → 按 user.notificationV2Enabled 路由
- admin 后台开关 + 灰度名单管理 UI
- A1 修复：critical 强制走 v2

---

## 4.8 v3 总工时

| 模块 | 工时 |
|---|---|
| SMS 子系统（含 S0 外部依赖并行）| 2 周 |
| 玻璃文字 + ActiveBanner | 2 周 |
| AuspiciousDay 完整接入 | 3 天 |
| 法会 in_progress_arrival | 2 天 |
| 静默时段聚合 push | 3 天 |
| 共修 T-24h 预告 | 1 天 |
| 灰度发布机制 | 2 天 |
| 缓冲（bug fix + 文案）| 3 天 |
| **合计** | **~6 周** |

---

# 总览 · 阶段 3 + v3 排期

```
[当前] v2 实施完成 + 部署 + 一周观察
   │
   ├─ Week 1: 阶段 3 阻塞 + 高优 + 中优批（A + B + C 子集）
   ├─ Week 2: 阶段 3 小问题批 + 收尾
   │
   ├─ Week 3: v3 启动 · Twilio 注册 + SMS 后端
   ├─ Week 4: SMS 子系统完整 + 前端
   │
   ├─ Week 5: ActiveBanner 表 + Banner UI
   ├─ Week 6: 玻璃文字 + AuspiciousDay 完整接入
   │
   ├─ Week 7: 法会 in_progress + 静默聚合 + T-24h
   ├─ Week 8: 灰度发布机制 + 缓冲
   │
[完成] v3 全部交付 · 5 通道架构完整
```

**总周期：~7 周**（阶段 3 1 周 + v3 6 周）

---

# 部署节奏

- 阶段 3 完成后部署一次（重点安全 + 一致性补丁）
- SMS 子系统完成后单独部署（外部依赖就位才能上线）
- 玻璃文字 + ActiveBanner 部署一次（影响首页 UI · 用户感知最强）
- 法会 in_progress + 静默聚合 + T-24h + 灰度 一并部署
- 总计 4 次部署

---

# 风险监控

| 风险 | 缓解 |
|---|---|
| Twilio A2P 注册延期 | S0 提前 4 周启动 · 与工程实施并行 |
| 玻璃文字 UI 不符审美 | 设计评审 + iOS 真机验证 |
| 灰度切换数据漂移 | shadow 模式 v1/v2 双发对比验证 ≥ 3 天 |
| critical SMS 月预算超 | admin 实时仪表盘 + 80% 告警 |
| 多设备登录漏推送 | PushSubscription isActive 已就位 + B4 修复 |

---

## 下一步

1. 部署 v2 + 一周观察（参考 `NOTIFICATION_V2_IMPLEMENTATION_STATUS.md` 部署清单）
2. 启动阶段 3 阻塞批（A1 + A3）· 1.5 天
3. 同步启动 Twilio 注册流程（外部 2-4 周）
4. 阶段 3 完成后进入 v3 主线

文档维护：每完成一批 · 在本文档对应章节标 ✅ + commit ref · 同步更新 `NOTIFICATION_V2_IMPLEMENTATION_STATUS.md`。
