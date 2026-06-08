# 觉学通知系统 · 独立设计审计报告

> 状态：2026-05-15 独立审计完成
> 审计者：fresh agent · 无设计演进历史 · 仅读 FINAL_SPEC.md
> 目标：找出 §19 已有 19 项修复**未覆盖**的新问题

---

## 🚨 阻塞级（3 个 · 上线前必修）

### A1. ActiveBanner critical 公告与 v1 灰度并存漏洞
**位置**：§19.4 + §19.6
**问题**：critical 系统公告 10000 用户 → ActiveBanner 一次性插 10000 行。同时灰度内（v2）用户走 ActiveBanner；灰度外（v1）用户**不会**写 ActiveBanner → critical 未 ack 重浮机制对 v1 用户失效。
**修复**：critical 公告期间禁止灰度并存；或 critical 路径强制走 v2 · 不论 feature flag。

### A2. SmsBroadcast audienceData 未限制大小
**位置**：§13
**问题**：`audienceData: Json` 无校验 · admin 误把 audience type 设为 user 并贴入超大 userIds 数组 → jsonb 字段可吞数 MB · 后续展开发短信瞬间烧光预算。
**修复**：audienceData userIds 数组 ≤ 5000 强校验 + 服务端拒绝；`estimatedCount > 2000` 需二次审批。

### A3. NotificationDispatchLog 唯一索引让补发永远失败
**位置**：§13, §19.3
**问题**：`@@unique([eventKind, eventId, tier, userId, channel])` 失败也占用唯一键。场景：T-5 push 失败（endpoint 410 deactivate）→ 用户重新订阅 → T-0 重发因唯一约束被静默跳过 · GC 又只删 90 天前 → 此 event 永久卡死。
**修复**：改 Postgres partial unique index：`@@unique([...], where: { success: true })` · 或唯一键加 `pushSubscriptionId`。

---

## ⚠️ 高优先级（7 个）

### B1. eventId 命名空间规约缺失
**位置**：§13 NotificationCardAck
**问题**：`@@unique([userId, eventKind, eventId])` OK · 但未明确 eventId 必须是 model.id 直引（不是 `class-123:ann-456` 复合 ID）· 跨 kind 风险。
**修复**：文档加一节「eventId 命名空间规约」+ 校验。

### B2. dispatchToUsers 非原子 · 中途崩溃丢消息
**位置**：§12
**问题**：先写 `logDispatch` 再 `Promise.allSettled` 4 通道。worker OOM 重启后 BullMQ 再 enqueue · 但 dispatch log 已存 → 用户永久丢消息。
**修复**：`logDispatch` 改通道粒度 · 每通道成功后单写一行。schema 已有 channel 字段 · 但 §19.3 仅描述计数 · 未明确「写时机」。

### B3. critical SMS 无熔断 · toll fraud
**位置**：§19.17
**问题**：critical 绕过预算 · 攻击者拿 admin 账号连发 50 条 critical → 即便 alert · 5 万条 SMS 已出去。
**修复**：critical 也加硬上限（月 $500 cap）+ 单次广播 > 2000 人需双 admin 审批 + 1 小时冷静期。

### B4. PushSubscription endpoint 唯一约束 vs isActive=false
**位置**：§19.2
**问题**：用户登出再登入 · SW 返回同一 endpoint（浏览器复用）→ 与旧 `isActive=false` 行的 `endpoint @unique` 冲突 · upsert 报错。
**修复**：upsert 用 `where: endpoint` · 更新 `isActive=true, sessionId=newSid, deactivatedAt=null` · 不插新行。

### B5. Critical Banner 重浮无幂等 · 永浮死循环
**位置**：§3 §6
**问题**：「未 ack 时每次进 app 重浮」+ 撤回时关闭 banner。若 admin 撤回但 `revokedAt` 写入失败 / 用户 cache 未 refetch → banner 永远重浮。
**修复**：`GET /api/me/active-banners` 服务端 join SystemAnnouncement · 校验 `revokedAt IS NULL AND expiresAt > now()`。

### B6. 玻璃文字数据陈旧 · 共修开始后仍显「下次共修」
**位置**：§7
**问题**：home-summary 客户端缓存。用户 18:55 打开 · 19:01 重前台 · React Query staleTime 内不 refetch → 仍显「下次 19:00」（已过）。
**修复**：动态过期 timer 基于 `nextSession.startAt` · visibilitychange 强制 refetch。

### B7. ActiveBanner 缺 GC · 表无限增长
**位置**：§13
**问题**：critical 永久型 banner 只增不减直至 ack。索引有 expiresAt 但**无 cron 清理**。
**修复**：每日 cron 删 `ackedAt OR dismissedAt OR expiresAt < now() - 7d`。

---

## 💡 中优先级（8 个）

### C1. Banner CTR 统计基础缺
**位置**：§16
**问题**：监控指标有「CTR / dismiss 率」 · ActiveBanner 只有 `showCount` · 无 `clickedAt` 区分点击 vs ×。
**修复**：加 `clickedAt DateTime?` 字段。

### C2. SMS 国际号码合规漏洞
**位置**：§11.7
**问题**：Geo Permissions 白名单未覆盖印度 DLT / 欧盟 GDPR consent / 巴西 RNC。
**修复**：加 `smsConsent` 字段 · 绑手机时记 IP + UA + 时间戳。

### C3. 时区改动后已 schedule 通知不重算
**位置**：§11.2 步骤 5
**问题**：用户 22:30 上海时间触发 normal push 延迟到次日 07:00 上海 · 用户改时区到 LA → 推送时机错位 6 小时。
**修复**：静默时段在**发送瞬间**重新评估 · 不在 enqueue 时锁定。

### C4. lastSeenAt 高频写放大
**位置**：§9.1
**问题**：home-summary 每分钟 poll → User.lastSeenAt 每分钟 update · 所有用户 PG write 风暴。
**修复**：节流到 5 分钟一次（conditional update `WHERE lastSeenAt < now()-5min`）。

### C5. Push 静默聚合无去重 contentHash
**位置**：§5 步骤 4
**问题**：静默期同事件 T-30/T-5 各 1 条 → 07:00 聚合发「2 条未读」· 用户点开发现同一共修。
**修复**：聚合按 (kind, eventId) 折叠 · 显示「1 条共修提醒」。

### C6. AuspiciousDay 编辑并发未定义
**位置**：§2 ⑧
**问题**：文档没说 schema · admin 编辑文案同时玻璃文字正读 → 半新半旧。
**修复**：admin 编辑后 push invalidate。

### C7. Achievement 聚合 job 用户已删号
**位置**：§19.9
**问题**：用户被删号 · flush job 仍执行 → query 失败 BullMQ 重试 N 次。
**修复**：flush job 开头检查 user 存在性。

### C8. dispatchV1 vs writeNotificationsV2Shadow 双写 Notification 表
**位置**：§19.6
**问题**：两条路径都往 Notification 写 · (userId, eventKind, eventId, tier) 若有 unique 会冲突；若无 · 出现两份相同记录。
**修复**：shadow 写入 separate table `NotificationShadow` · 不污染正表。

---

## 📝 小问题（7 个）

| ID | 问题 | 位置 |
|---|---|---|
| D1 | coverTheme 字段类型不一致：§7.1 用 `light/dark` · §19.14 用 `auto-light/manual-light` 四值 · §13 schema 用 `String?` · 前端消费哪个？ | §7.1 / §19.14 / §13 |
| D2 | expiresAt 必填仅说 critical · urgent / normal 公告无过期 → 玻璃文字「N 条未读」可能含 1 年前公告 | §19.20 |
| D3 | 共修 t0 severity=critical · 但 §6.3 自动消失表格未列共修 t0 → banner 是否要 ack？文档矛盾 | §3 ① vs §6.3 |
| D4 | 8 周排期未包含 i18n（UI 文案多语言未提）· 若支持英文用户工时未预留 | §14 |
| D5 | SmsDeliveryLog 含 messageBody 明文存手机号 + 内容 · GDPR 删号清理路径未在文档 | §13 |
| D6 | `/api/me/active-banners` 无 pagination · admin 误连发 critical 时可能上百行 | §6 |
| D7 | PushSubscription.keys 是 Json · 未声明是否加密。endpoint 是用户可定位资产 · 泄露后可推送攻击 | §13 |

---

## ⏰ 排期风险

**S5（1.5 周）SMS 子系统被显著低估**：
- Twilio A2P 10DLC 注册周期通常 2-4 周（运营商审批）· 不是工程工时
- 建议把 SMS 注册流程**提前到 S1 并行启动** · 否则会卡在末期
- 中国短信 Chinese Carrier Approved Sender 申请也需提前

---

## 修复优先级建议

| Sprint | 加入任务 |
|---|---|
| **S0** | 并行启动 Twilio A2P + Chinese Carrier 注册流程（非工程） |
| **S1** | A3 partial unique index · B2 dispatchToUsers 通道粒度 logDispatch · B4 PushSubscription upsert by endpoint |
| **S2** | A1 critical 路径强制 v2 · B6 玻璃文字 visibilitychange refetch · C4 lastSeenAt 节流 |
| **S3** | B1 eventId 规约 · C3 静默时段发送瞬间评估 · C5 聚合去重 · C7 Achievement flush 检查用户 · C8 NotificationShadow 表 |
| **S4** | B5 active-banners 服务端 join 校验 · B7 ActiveBanner GC cron · C1 clickedAt 字段 · D1-D3 文档不一致修正 |
| **S5** | A2 SmsBroadcast 大小校验 · B3 critical SMS 硬上限 · C2 smsConsent 字段 · D5 SMS GDPR 删除路径 · D7 keys 加密 |
| **缓冲** | D2/D4/D6 收尾 |

整体工时增加约 **1-1.5 周** · 总 ~9.5 周。

---

## 总结

第一轮审计（§19）覆盖了主要的逻辑闭环 + 并发 + 安全基础。
本轮独立审计补全了：
- **schema 层细节**（partial unique · audienceData 大小 · clickedAt · keys 加密）
- **时序一致性**（dispatchToUsers 原子性 · 静默时段重算 · 玻璃文字陈旧）
- **熔断与合规**（toll fraud 防御 · GDPR 删号路径 · 跨国 consent）
- **排期外部依赖**（Twilio 注册周期）

合计 **45 个修复点**（19 + 26）覆盖了通知系统的设计闭环。建议在 S1 启动前再做一轮「设计 walk-through」让全队过一遍 · 然后进入实施。
