# 觉学通知系统 · 当前进度快照（含收尾清单）

> 更新时间：2026-05-15
> 分支：`claude/audit-page-quality-EpO7Q`
> 累计 commits：**34**（设计 12 + 实施 22）
> 前置文档：
> - `NOTIFICATION_FINAL_SPEC.md`（设计参考）
> - `NOTIFICATION_V3_ROADMAP.md`（远期路线）

---

## 一、已完成（v2 全部交付 · 待部署）

### 1.1 通知路径已建立 · 9 类事件源

| 事件 | 触发方 | 跳转目标 | 状态 |
|---|---|---|---|
| ① 班级共修 created | 辅导员发布 | 班级共修详情页 | ✅ |
| ① 班级共修 T-30 | 系统调度 30 分钟前 | 班级共修详情页（蓝倒计时）| ✅ |
| ① 班级共修 T-5 | 系统调度 5 分钟前 | 班级共修详情页（橙倒计时 pulse）| ✅ |
| ① 班级共修 T-0 | 系统调度准时 | 班级共修详情页（红色 + 进入直播按钮）| ✅ |
| ① 班级共修 time_changed | 辅导员改时间 | 班级共修详情页（新时间）| ✅ |
| ① 班级共修 cancelled | 辅导员取消 | 班级首页（兜底）| ✅ |
| ② 班级公告 | 辅导员发布 | 班级公告详情页 | ✅ |
| ③ 修学任务 created | 辅导员下达 | 班级首页（含任务卡）| ✅ |
| ③ 修学任务 T-24h | 系统调度 | 班级首页 | ✅ |
| ③ 修学任务 T-6h | 系统调度 | 班级首页 | ✅ |
| ④ 个人提醒 临期 | cron 19:00 | 个人修学页 | ✅ |
| ④ 个人提醒 日报 | cron 20:00 | 个人修学页 | ✅ |
| ④ 个人提醒 周报 | cron 周一 8:00 | 个人修学页 | ✅ |
| ⑤ 成就解锁 | 答题触发 + 5 分钟聚合 | 成就页 | ✅ |
| ⑥ 系统公告 normal | admin 后台 | 系统公告详情页 | ✅ |
| ⑥ 系统公告 urgent | admin 后台 | 系统公告详情页 | ✅ |
| ⑥ 系统公告 critical | admin 后台 | 系统公告详情页（无视静默）| ✅ |
| ⑦ 法会创建 | admin 后台 | 法会详情页 | ✅ |
| ⑦ 法会 1h 前 | 系统调度 | 法会详情页 | ✅ |
| ⑨ 被踢出班级 | 辅导员/admin 操作 | 首页（仅站内）| ✅ |
| ⑨ 加入新班 | admin 加成员 | 班级首页（仅站内）| ✅ |
| ⑨ 班级解散 | admin 归档 | 首页（仅站内）| ✅ |
| ⑦ 反馈回复 | admin 处理 | 通知中心 | ✅ |
| ⑦ 举报审核 | admin 处理 | 通知中心 | ✅ |

### 1.2 Push 过滤完整链路（4/5 层）

```
事件 → dispatchToUsers
  ├─ L1 ✅ 事件类型白名单（班级成员变动 / 藏历日不发 push）
  ├─ L2 ✅ 用户偏好（push 总开关 + per-type 子开关 · UI 已上）
  ├─ L3 ✅ 静默时段（用户本地 22-7 · critical 绕过）
  ├─ L4 ✅ 频率上限（normal 每小时 5 条 · urgent/critical 不限）
  └─ L5 ❌ SMS 子系统（v3）
  ↓
sendPushToUsers
  ├─ ✅ isActive 过滤（单设备登录改造已就位）
  ↓
web-push
```

### 1.3 入口已建立

| 入口位置 | 目标 |
|---|---|
| 首页顶栏 · 📅 活动按钮 | /events 综合活动列表 |
| 首页顶栏 · 🔔 通知铃铛 | 通知中心 |
| 通知中心 · 点击单条 | 各事件对应详情页 |
| 班级首页 · 共修安排紧凑卡 | 共修列表 → 单场详情 |
| 班级首页 · 修学任务区域 | 修学计数 / 任务详情 |
| 班级首页 · 公告列表 | 公告详情 |
| /events 列表 · 进行中 + 即将开始分组 | 各事件详情页 |
| /admin/system-announcements | admin 发布系统公告 |
| /admin/dharma-assemblies | admin 发布法会 |
| /coach/classes/:id/sessions | 辅导员管理班级共修 |
| /coach/classes/:id/announcements | 辅导员管理班级公告 |
| /coach/classes/:id/practice-tasks | 辅导员下达修学任务 |

### 1.4 新建页面（学员可访问）

| 路径 | 用途 |
|---|---|
| `/notifications` | 通知中心（v1 已有 · v2 字段统一）|
| `/announcements/:id` | 系统公告详情 |
| `/assemblies/:id` | 法会 / 系统共修详情 |
| `/class/:id/sessions/:sid` | 班级共修详情（含倒计时 + 加入直播按钮）|
| `/events` | 综合活动列表 |
| `/settings/notifications`（增强）| 顶部加 push 偏好 section |

### 1.5 admin 新建页面

| 路径 | 用途 |
|---|---|
| `/admin/system-announcements` | 系统公告发布 / 撤回 |
| `/admin/dharma-assemblies` | 法会 / 系统共修发布 / 软删 |

### 1.6 后端数据模型变更

**新增表（5）**：
- `NotificationPreference` 用户 push 偏好
- `UserAchievementUnlock` 成就解锁记录
- `SystemAnnouncement` 系统公告
- `DharmaAssembly` 法会 / 系统活动
- `OrphanedFile` 旧 cover 文件 GC

**字段扩展**：
- `User` + `currentSessionId` / `notificationV2Enabled` / `achievementUnlocks` / `notificationPreference` 关系
- `Notification` + `eventKind` / `eventId` / `tier` / `severity` / `contentHash` / `revokedAt`
- `NotificationDispatchLog` + `channel` / `success` / `error` / `severity` · unique 五维
- `PushSubscription` + `sessionId` / `isActive` / `deactivatedAt`

---

## 二、剩余收尾清单（按优先级）

### 🔴 P1 · 必须 v3 才能做（玻璃文字 + Banner 依赖）

#### 2.1 In-app Banner UI（spec §6）
- 当前：无 Banner UI · 用户在 app 内时不会浮窗（只有站内角标）
- 待做：
  - `ActiveBanner` 表 · 服务端持久化队列（spec §19.4）
  - 全局 `<InAppBannerProvider>` + portal
  - 玻璃质感 · framer-motion 滑入
  - severity 三档配色
  - critical 必须 ack 才消失
  - Achievement 金色庆祝样式
  - 队列管理（同时一条 + 优先级 + 推开当前）
- 工时：~2 周

#### 2.2 首页玻璃文字 + 班级红点（spec §7）
- 当前：首页没有「下次共修 / 今日任务 / 未读公告」概览
- 待做：
  - `/api/me/home-summary` 单接口聚合
  - 首页 Hero 区域玻璃文字 3 行
  - 班级卡红点（有未处理事件）
  - 主题自适应（深浅画报）
  - 动态过期 timer（B6 修复）
- 工时：~1 周

#### 2.3 藏历加持日完整接入
- 当前：仅入口预留 · 不发通知 · 不在首页显示
- 待做：依赖玻璃文字 UI（一行「🪷 今日加持日」）
- 工时：3 天

#### 2.4 法会 in_progress_arrival tier
- 当前：未实现
- 待做：前端登录 hook 检查活跃法会 + 24h 内未通知则触发
- 工时：2 天

---

### 🟡 P2 · SMS 子系统（v3 · 含外部依赖）

#### 2.5 Twilio 注册（外部 2-4 周）
- **S0 必须提前启动** · 否则会卡末期
- A2P 10DLC 注册（美国号码）
- Chinese Carrier Approved Sender（中国号码到达率）
- 模板预审（中英双语 4 份）

#### 2.6 SMS 后端服务（~1 周）
- 4 个新模型：SmsDeliveryLog / SmsTemplate / SmsBroadcast + User SMS 字段
- 7 层 SMS 过滤
- Twilio 集成 + webhook（投递 + STOP · 签名验证）
- OTP 手机号验证流程

#### 2.7 SMS 触发范围（最终）
| 事件 | 是否发 SMS | 说明 |
|---|---|---|
| critical 系统公告 | ✅ 强制 | 紧急维护必触达 · 无视用户偏好 |
| 法会 T-24h 提醒 | ✅ 用户可选 | 子开关默认关 |
| **共修 T-5 / T-0**（urgent / critical）| ❌ **不发** | 高频事件 · SMS 成本不划算 |
| 班级公告 urgent | ❌ 不发 | Push + 站内已足够 |
| 任何 normal 事件 | ❌ 不发 | 一律不发 |
| 班级成员变动 | ❌ 不发 | 仅站内（隐私）|

#### 2.8 admin SMS 广播 UI（~3 天）
- `/admin/sms/broadcast`
- 受众选择（全平台 / 班级 / 指定用户）
- 模板 + 自定义文案
- bypass 用户偏好（二次密码确认）
- 实时成本预估

#### 2.9 用户 SMS 偏好 UI（~1 天）
- `/settings/sms` 手机绑定 + OTP 验证
- 总开关 + 法会子开关 + 语言

---

### 🟢 P3 · 独立审计修复（26 项 · 见 NOTIFICATION_AUDIT_INDEPENDENT.md）

按 ROADMAP §3 排序：

#### 阻塞批（3 项 · 1.5 天）
- A1 critical 公告灰度并存漏洞
- A2 SmsBroadcast 大小限制（与 SMS 实施一起）
- A3 NotificationDispatchLog unique 让补发失败

#### 高优批（7 项 · 3 天）
- B1 eventId 命名空间规约
- B2 dispatchToUsers 非原子 · OOM 丢消息
- B3 critical SMS 无熔断 toll fraud（与 SMS 实施一起）
- B4 PushSubscription upsert 冲突
- B5 critical Banner 重浮死循环（Banner 实施时）
- B6 玻璃文字数据陈旧（玻璃文字实施时）
- B7 ActiveBanner GC（Banner 实施时）

#### 中优批（8 项）+ 小问题批（7 项）+ 排期警告（1 项）
详见 ROADMAP §3.3-3.4。

---

### 🔵 P4 · 用户体验增强（小改动 · 可立即做）

#### 2.10 Banner 双按钮设计（v3 实施 Banner 时考虑）
- Banner UI 加「立即进入直播」CTA 按钮
- 数据从前端 query 取 liveLink · 不经 SW push payload
- 缩短共修临场体验「2 步 → 1 步」
- 工时：v3 子任务（半天）

#### 2.11 灰度发布机制
- `SystemConfig.notification_v2_global` flag
- shadow 模式双发对比
- admin 后台开关 + 灰度名单管理
- 工时：~2 天

#### 2.12 共修 T-24h 预告 cron
- 当前实现仅 T-30/T-5/T-0
- spec §3.1 有 T-24h 档（预告）
- 加入 cron tick 范围即可
- 工时：1 天

#### 2.13 静默时段聚合（spec §5 L3 优化）
- 当前：静默期跳过 push（站内仍写）
- v3 优化：normal 延迟到次日 07:00 聚合发「N 条未读」
- 需 `DelayedPush` 表 + cron flush
- 工时：3 天

---

## 三、剩余功能完整路线图

### Phase 1 · 立即（部署 v2 + 一周观察）
不做新功能 · 验证 v2 稳定性。

### Phase 2 · 阶段 3 审计修复（1 周）
按 ROADMAP §3.5 的批次顺序处理 · 同时启动 Twilio 注册（外部 2-4 周）。

### Phase 3 · v3 主线（~6 周）
按 ROADMAP §4 路线图：
- Week 1-2：SMS 子系统
- Week 3-4：Banner + 玻璃文字 + 藏历日
- Week 5：法会 in_progress + 静默聚合 + T-24h
- Week 6：灰度机制 + 缓冲

### Phase 4 · 验证 + 部署（1 周）
- 完整端到端测试（19 项 smoke test · 见 STATUS §3）
- 4 次分阶段部署

**总周期：约 8-9 周完成全套 spec**

---

## 四、本会话累计 commits（34 个）

### 设计文档（13 个）
- 通知系统 v2 分层设计（10 层演进）
- 独立审计 + 现有代码审计
- FINAL_SPEC 集成（19 项修复）
- 实施状态文档
- v3 路线图

### 实施 fix（4 个）
- NotificationItem 字段统一（n.isRead）
- push isActive 过滤 + 默认 link
- SW safeLink 智能补 /app 前缀
- reports 旧路径修复

### 实施 feat（17 个）
- S1 第一批：SW 安全 + Schema 扩展
- S1 第二批：架构升级 + 旧事件源
- PracticeTask + Cover GC
- 共修改时间 / 取消 + 班级成员变动
- PracticeTask cron + 多档
- MembershipChange joined + NO_PUSH_EVENTS
- SystemAnnouncement 完整 + admin UI
- Achievement + 5min 聚合
- NotificationPreference + push 偏好过滤
- DharmaAssembly 完整 + 详情 + admin UI
- 用户 push 偏好 UI
- 静默时段过滤
- 频率上限过滤
- 班级共修详情页 + 活动综合入口
- PracticeTask link 改班级页

---

## 五、关键文档矩阵

| 文档 | 行数 | 用途 |
|---|---|---|
| `NOTIFICATION_FINAL_SPEC.md` | 1518 | 设计参考 |
| `NOTIFICATION_V2_LAYERED_ARCH.md` | 1646 | 10 层演进史 |
| `NOTIFICATION_V2_DESIGN.md` | 1538 | 旧 12 模块（已映射）|
| `NOTIFICATION_AUDIT_INDEPENDENT.md` | 159 | 独立审计 26 项 |
| `NOTIFICATION_CURRENT_CODE_AUDIT.md` | 165 | 实施前代码审计 |
| `NOTIFICATION_V2_IMPLEMENTATION_STATUS.md` | 332 | v2 实施状态 + 部署清单 |
| `NOTIFICATION_V3_ROADMAP.md` | 536 | 阶段 3 + v3 路线图 |
| **`NOTIFICATION_PROGRESS_SNAPSHOT.md`**（本文档）| **TBD** | **当前进度快照**（新）|

---

## 六、部署一行命令（待执行）

```bash
cd /home/ubuntu/projects/juexue && git pull origin claude/audit-page-quality-EpO7Q && \
cd backend && npx prisma generate && npx prisma db push && npm run build && pm2 reload juexue-api && \
cd ../juexue-v2 && rm -rf dist/ && npm run build && \
sudo rsync -av --delete dist/ /var/www/juexue/app/
```

---

## 七、即将开始的最优顺序

```
本周（部署 + 观察）
  ↓
[1] 部署 v2 到生产
[2] 跑通 19 项 smoke test
[3] 收集用户反馈一周

下周开始（阶段 3 + Twilio 启动）
  ↓
[4] 并行启动 Twilio 注册（外部 2-4 周）
[5] 阶段 3 阻塞批（A1 + A3）· 1.5 天
[6] 阶段 3 高优批（B1+B2+B4）· 2 天
[7] 阶段 3 中优批（C3+C4+C7）· 1.5 天
[8] 阶段 3 小问题批 · 1 天
[9] 阶段 3 部署 · 验证一周

v3 启动（约 3-4 周后 · Twilio 就位）
  ↓
[10] v3 Week 1-2: SMS 子系统
[11] v3 Week 3-4: Banner + 玻璃文字 + 藏历日
[12] v3 Week 5: 法会 in_progress + 静默聚合
[13] v3 Week 6: 灰度 + 缓冲
[14] v3 整体部署 · 完成
```

整套实施 · 约 8-9 周完整收尾。

---

## 八、关键技术资产保留

### 后端可复用模式
- `dispatchToUsers` 统一入口 · 所有新事件源走此路
- `filterUsers*` 过滤链 · 5 层架构 · 多进程安全
- `OrphanedFile` 延迟 GC · 业务流量驱动
- 5min 聚合（Achievement 模式）· 可复用到其它聚合场景

### 前端可复用模式
- SW safeLink 智能补全 · 安全 + 友好
- AssemblyDetailPage / ClassSessionDetailPage 详情页模式
- /events 综合列表模式
- ConfirmDialog danger 二次确认（撤回类操作）

### Schema 模式
- v1/v2 双写过渡（不破坏旧逻辑）
- contentHash 通用模型（dismissal 失效）
- channel 维度 NotificationDispatchLog（频率上限统计）

---

## 九、风险监控

| 风险 | 当前状态 | 缓解 |
|---|---|---|
| Twilio A2P 注册延期 | 未启动 · 影响 v3 末期 | 立即提前 2-4 周启动 |
| 玻璃文字 UI 不符审美 | 设计待评审 | iOS 真机验证 + 设计师把关 |
| 灰度切换数据漂移 | 未实施 | shadow 模式 3 天双发对比 |
| critical SMS 月预算超 | 未实施 | admin 实时仪表盘 + 80% 告警 |
| 多设备登录漏推送 | isActive 已就位 | B4 修复 endpoint 冲突 |
| 独立审计 26 项遗留 | 待处理 | 阶段 3 系统化修复 |

---

完整路径地图就绪 · 待执行。
