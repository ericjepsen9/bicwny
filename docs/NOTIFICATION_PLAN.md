# 通知与规则引擎设计方案 · 2026-05-04

> 状态：✅ 决策定型 · 暂未实施
>
> 触发场景：功课截止 / 班级公告 / 共修日 / 长期未活跃 等场景需要主动提醒用户。
> 支持 admin 配置规则 · 多通道触达（推送 / 邮件 / 短信）·严格防骚扰。

> **作用范围**：北美（美国 / 加拿大）+ 台湾市场上线 · **大陆不上线**。
>
> **关联文档**：`docs/ASSIGNMENT_PLAN.md`（功课提醒走本规则系统）。

---

## 一、设计原则

1. **修行 app 反骚扰** —— 佛教用户对"被催"反感度高 · 频率严格限制
2. **用户至上** —— 所有通道默认温和 · 用户随时可全部关闭
3. **多语言** —— sc / tc / en 三套模板（并存兼容侨民 + 当地用户）
4. **多时区** —— 用户本地时间（IANA）判断静默时段
5. **合规** —— 美国 CAN-SPAM / TCPA · 加州 CCPA · 加拿大 CASL · 台湾 PDPA

---

## 二、技术栈（北美 + 台湾市场）

| 通道 | 服务商 | 月成本（1000 用户）| 特点 |
|---|---|---|---|
| **推送** | Capacitor + APNs (iOS) / FCM (Android) | $0 | 已有基础 |
| **邮件** | **Resend** | 免费 < 3K · $20/月 50K | 开发体验好 · 中文支持 OK |
| **短信** | **Twilio** | 美国 $0.0079/条 · 台湾 ~$0.05/条 | 合规 · 不需备案 |

**与中国市场对比**：
- ❌ 不需要 SMS 模板备案（工信部 review）
- ❌ 不需要 ICP 备案
- ❌ 不需要 PIPL 合规（适用更宽松的当地法规）

预算：1000 活跃用户每月通知总成本约 **$25**（5K 邮件 + 200 SMS + 不限推送）。

---

## 三、合规要求

### 美国 + 加拿大

- **CAN-SPAM Act / CASL**（邮件）
  - 必须有 unsubscribe 链接
  - 必须有发送方物理地址
  - 必须 opt-in 才能营销邮件
- **TCPA**（短信）
  - 发送前必须 explicit consent
  - "Reply STOP to opt out" 必加
  - 不能假冒发送方身份
- **CCPA / CPRA**（加州）
  - 用户可查看、删除自己的通知数据
  - 隐私政策需明确说明

### 台湾

- **個人資料保護法（PDPA）**
  - 基础 opt-in
  - 用户可控制权 + 退订
  - 比美国宽松

### Apple App Store

- iOS 推送权限必须明示授权
- Privacy Manifest 声明使用 SDK
- 拒绝推送不能影响 app 核心功能
- 隐私政策页必备

---

## 四、数据模型

```prisma
model NotificationRule {
  id          String   @id @default(cuid())

  // 作用范围
  scope       String                       // platform | class | assignment
  classId     String?
  assignmentId String?

  // 触发条件
  triggerType String                       // before_deadline | progress_behind | inactive_days | custom
  beforeDeadlineHours Int?                 // 24 / 72 / 168
  progressThreshold   Int?                 // 落后 30% 触发
  inactiveDays        Int?                 // 3 天未记录触发

  // 通知渠道（多选）
  channels    String[]                     // ['inapp', 'push', 'email', 'sms']

  // 频率限制
  maxPerWeekPerUser Int      @default(2)
  cooldownHours     Int      @default(24)

  // 时段限制（用户本地时间）
  quietHoursStart  Int?      @default(22)
  quietHoursEnd    Int?      @default(7)

  // 多语言文案模板
  titleTemplateSc  String
  titleTemplateTc  String?
  titleTemplateEn  String?
  bodyTemplateSc   String
  bodyTemplateTc   String?
  bodyTemplateEn   String?
  ctaUrl           String?

  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  logs        NotificationLog[]
}

model NotificationLog {
  id           String   @id @default(cuid())
  ruleId       String?
  userId       String
  assignmentId String?

  channel      String                      // inapp | push | email | sms
  status       String                      // sent | failed | clicked | dismissed
  sentAt       DateTime @default(now())
  error        String?

  // 服务商返回
  providerMsgId String?

  rule    NotificationRule? @relation(fields: [ruleId], references: [id], onDelete: SetNull)
  user    User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, sentAt])
  @@index([assignmentId, channel])
}

// User 表新增字段
model User {
  ...
  timezone           String?  @default("America/Los_Angeles")  // IANA
  notifPushEnabled   Boolean  @default(true)
  notifEmailEnabled  Boolean  @default(false)                  // 默认关
  notifSmsEnabled    Boolean  @default(false)                  // 默认关
  smsConsentAt       DateTime?                                 // SMS opt-in 时间戳（合规）
  emailConsentAt     DateTime?
  phoneE164          String?                                   // 国际格式 +12025550100
}
```

---

## 五、规则引擎执行流

### 调度

```
[Cron · 每 30 分钟]
    ↓
[扫描 active rules]
    ↓
[对每条 rule 评估触发条件]
    - before_deadline: assignments WHERE endDate - now < beforeDeadlineHours
    - progress_behind: 计算用户进度 < threshold
    - inactive_days: 用户最后 record < now - inactiveDays
    ↓
[筛选目标用户]
    - 按 scope 限定
    - 排除已 notif*Enabled=false 的渠道
    - 检查频率限制 (shouldSend)
    - 检查静默时段 (用户本地时间)
    ↓
[按渠道发送]
    - inapp: 写入 Notification 表（已有）
    - push: 调 Capacitor / APNs / FCM
    - email: 调 Resend API
    - sms: 调 Twilio API
    ↓
[写入 NotificationLog]
```

### 频率防御（核心代码）

```ts
async function shouldSend(rule: NotificationRule, user: User): Promise<boolean> {
  // 全局限流：单用户每天最多 3 条 push（不论 rule）
  const todayPush = await prisma.notificationLog.count({
    where: {
      userId: user.id,
      channel: 'push',
      sentAt: { gte: startOfDay() },
    },
  });
  if (todayPush >= 3) return false;

  // rule 级 cooldown
  const last = await prisma.notificationLog.findFirst({
    where: { ruleId: rule.id, userId: user.id },
    orderBy: { sentAt: 'desc' },
  });
  if (last && hoursSince(last.sentAt) < rule.cooldownHours) return false;

  // 周限流
  const weekCount = await prisma.notificationLog.count({
    where: {
      ruleId: rule.id,
      userId: user.id,
      sentAt: { gte: subDays(now(), 7) },
    },
  });
  if (weekCount >= rule.maxPerWeekPerUser) return false;

  // 静默时段（用户本地时间）
  if (inQuietHours(rule, user.timezone)) return false;

  // 用户偏好开关
  if (!user[`notif${capitalize(channel)}Enabled`]) return false;

  return true;
}
```

**全局上限是硬规则**：admin 即使配置 100 条规则，单用户每天 push 不能超 3 条。

---

## 六、Admin 规则配置 UI

### 规则列表

```
通知规则

[ + 新建规则 ]

进行中
═══════════════════════════════════════════
🔔 班级功课截止前 24h 提醒
   作用范围：所有班级功课
   触发：距截止 24h 且进度 < 80%
   渠道：☑ 推送  ☑ 站内消息  ☐ 邮件  ☐ 短信
   频率：每用户每周 ≤ 2 条 · 22:00-7:00 不发
   [ 详情 ]   [ 编辑 ]   [ 暂停 ]

🔔 连续 3 日未打卡轻提醒
   作用范围：所有 daily 功课
   触发：3 天未记录
   渠道：☑ 站内消息  ☐ 推送  ☐ 邮件  ☐ 短信
   频率：每用户每周 ≤ 1 条
   [ 详情 ]   [ 编辑 ]   [ 暂停 ]
```

### 规则编辑表单

```
新建通知规则

作用范围
○ 全平台   ● 班级 [大圆满前行精进班 ▼]   ○ 单功课

触发条件
类型 · [距截止前 ▼]
       距截止前 / 进度落后 / 连续未打卡 / 自定义

距截止 · 24 [小时 ▼]
进度阈值（可选）· 进度低于 80% 才触发

通知渠道
☑ 站内消息   ☑ App 推送    ☐ 邮件    ☐ 短信 ⚠️

频率限制
每用户每周最多   2  条
同规则间隔至少   24  小时
仅在用户本地时间   7:00  -  22:00  发送

文案模板（多语言）
简体 · 标题 [师兄，功课尚未圆满]
       正文 [师兄，您的《{title}》功课，还差 {remaining} {unit} 即可圆满]

繁体 · 标题 [師兄，功課尚未圓滿]
       正文 [師兄，您的《{title}》功課，還差 {remaining} {unit} 即可圓滿]

英文 · 标题 [Practice Reminder]
       正文 [Dear practitioner, your assignment '{title}' has {remaining} {unit} remaining.]

变量参考：{title} {remaining} {total} {unit} {hoursLeft} {dharmaName}

[ 保存 ]   [ 测试发送 ]
```

---

## 七、用户偏好设置

`/settings → 通知` 页：

```
通知偏好

App 推送
☑ 班级公告
☑ 功课提醒
☐ 学习建议
☐ 成就解锁

邮件 (默认关)
☐ 班级公告
☐ 周报摘要（每周日发）
☐ 重要提醒

短信 (默认关 · opt-in)
☐ 我同意接收功课截止提醒短信
   ⚠️ 仅用于关键功课截止前提醒（每月 ≤ 2 条）
   退订：reply STOP to opt out

时区 [America/Los_Angeles ▼]   (自动检测)

免打扰时段 (本地时间)
☑ 22:00 - 7:00 内不接收任何提醒

[ 测试一条提醒 ]   [ 全部关闭 ]
```

**关键**：
- 邮件 / 短信 **默认关闭**（用户主动 opt-in）
- 用户随时可一键 [全部关闭]
- 时区自动检测但可手动改

---

## 八、文案设计（佛教调性）

### 错误示例（焦虑型）

```
❌ "你已 3 天没完成功课，再不完成就赶不上进度了！"
❌ "目标完成度仅 30%，请抓紧时间！"
❌ "明天就要截止了，请立即完成！"
```

### 推荐示例（温和型）

```
✓ 师兄，您的《观音心咒》还差 150 遍即可圆满
✓ 本周共修日临近，让我们一同精进
✓ 师兄，今日是否有时间礼一座观修？
```

**核心**：邀请，不催促。

### 多语言模板示例

```
SC: "师兄，您的《{title}》还差 {remaining} {unit} 即可圆满"
TC: "師兄，您的《{title}》還差 {remaining} {unit} 即可圓滿"
EN: "Dear practitioner, your assignment '{title}' has {remaining} {unit} remaining."
```

---

## 九、时区处理

### 用户表加 timezone 字段

```ts
// 前端 onboarding 自动检测
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
// 上传到注册接口
```

### 静默时段判断

```ts
function inQuietHours(rule: NotificationRule, userTz: string): boolean {
  const localHour = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: userTz,
      hour12: false,
      hour: 'numeric',
    })
  );
  const start = rule.quietHoursStart ?? 22;
  const end   = rule.quietHoursEnd ?? 7;
  if (start < end) {
    return localHour >= start && localHour < end;
  } else {
    // 跨午夜（如 22:00-7:00）
    return localHour >= start || localHour < end;
  }
}
```

### 用户体感

- 加州用户 PT 时间 22:00 = UTC 6:00
- 台湾用户 GMT+8 时间 22:00 = UTC 14:00
- 同一个 cron 时刻，不同时区用户得到的 quietHours 判断不同 · 各自正确

---

## 十、Apple App Store 合规要点

1. **推送权限**
   - iOS 13+ 必须明确授权
   - Capacitor 自动弹权限框
   - 用户拒绝后不能影响 app 功能

2. **Privacy Manifest**（Apple 2024 强制）
   - 声明所有第三方 SDK
   - 列出使用的数据类别
   - Required Reason API 声明

3. **隐私政策页面**
   - 说明邮件 / 短信 / 推送的使用
   - 数据保留期限
   - 第三方分享情况

4. **儿童保护（COPPA）**
   - 13 岁以下用户额外保护
   - 一般佛教 app 不涉及但要核查

---

## 十一、决策定型清单

| # | 决策项 | 值 |
|---|---|---|
| 1 | SMS MVP 包含？ | ❌ Phase 2 加（先用推送 + 邮件验证）|
| 2 | 邮件服务商 | ✓ Resend |
| 3 | SMS 服务商 | ✓ Twilio |
| 4 | 时区处理 | ✓ 用户本地时间（IANA timezone）|
| 5 | 多语言 | ✓ sc / tc / en 三套模板 |
| 6 | 用户全部关闭权 | ✓ 必须（Apple 要求）|
| 7 | 全局每日 push 上限 | ✓ 3 条 |
| 8 | 静默时段默认 | ✓ 22:00 - 7:00 用户本地时间 |
| 9 | 邮件 opt-in 默认 | ✓ 关闭 |
| 10 | 短信 opt-in 默认 | ✓ 关闭 + 显式同意 |
| 11 | 文案审核 | admin 规则强制 review · 辅导员限模板 |
| 12 | 微信公众号通知 | 不做（北美 + 台湾不需要）|

---

## 十二、风险红线

1. **不要让用户感觉被催** —— "邀请"语气而非"催促"
2. **必须能一键关闭所有通道** —— Apple 强制 + 用户体验
3. **频率上限是硬性规则** —— admin 100 条规则也不能突破单用户每日 3 条 push
4. **静默时段是默认开** —— 22:00-7:00 不发，用户除非主动开
5. **SMS 必须显式 opt-in** —— TCPA 法律要求 · 违反会被告

---

## 十三、API 设计

### 用户端

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/my/notifications` | 站内消息列表（已有）|
| PATCH | `/api/my/notification-prefs` | 更新偏好 `{ pushEnabled, emailEnabled, smsEnabled, smsConsent, timezone }` |
| POST | `/api/my/notifications/test` | 发测试通知（验证渠道是否通）|

### 辅导员 + 管理员

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/coach/notification-rules` | 我的班级规则 |
| POST | `/api/coach/notification-rules` | 新建班级规则 |
| PATCH | `/api/coach/notification-rules/:id` | 编辑规则 |
| GET | `/api/admin/notification-rules` | 全平台规则 |
| POST | `/api/admin/notification-rules` | 新建平台规则 |
| GET | `/api/admin/notification-logs?days=7` | 发送日志（审计 + 调试）|

---

## 十四、落地分期

### Tier 1 · MVP 必做（4-5 天）
1. Prisma：NotificationRule + NotificationLog + User 字段扩展
2. 规则引擎：cron 调度 + shouldSend 防御 + 时区处理
3. 推送通道（已有 web push 复用）
4. 邮件通道（接 Resend API）
5. 站内消息复用现有 Notification 系统
6. Admin 规则配置 UI（基础版）
7. 用户偏好设置页

### Tier 2 · Phase 2（2-3 天）
8. SMS 通道（接 Twilio · 含 opt-in 流程）
9. 多语言模板编辑器
10. 测试发送功能（admin 验证）
11. 通知日志审计页

### Tier 3 · 体验完善（按需）
12. 邮件周报模板美化（HTML 设计）
13. Push rich content（图片 / 操作按钮）
14. 触发统计（哪条规则效果好）
15. A/B 测试不同文案

---

## 十五、需要时唤起

实施时告诉我：「**开始 Tier 1 通知系统**」。

如需先做 SMS（提前到 Tier 1），也可以单独说「**Tier 1 + SMS**」。
