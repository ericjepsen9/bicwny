# 觉学通知系统 · 已废弃设计清单

> ⚠️ 这里列出**所有曾经讨论 / 设计过 · 但已决定不实施**的功能。
> 用途：防止后续 AI / 开发者误以为这些是「待实施」任务。
>
> 创建时间：2026-05-15
> 状态：所有列项**永久作废** · 除非有重大业务变更覆盖该决策。

---

## 一、首页通知卡片 · 整套作废（最重要）

### 1.1 单槽位首页卡（HomeCard）❌
- **来源**：`NOTIFICATION_V2_LAYERED_ARCH.md` 第 2 层
- **作废原因**：B 方案简化 · 不需要单槽位仲裁
- **替代方案**：
  - 临场紧迫感 → In-app Banner（v3 实施）
  - 静态信息概览 → 首页玻璃文字（v3 实施）
  - 单事件详情 → 各自详情页（已实施）

### 1.2 优先级仲裁表（14 行评分）❌
- **来源**：第 2 层 · 表格列了 critical 系统公告 1000 / 共修 T-0 950 / ... 等 14 个评分
- **作废原因**：仅 1 个槽位的设计本身废了 · 仲裁表也无意义
- **替代方案**：Banner 队列按 severity 简单排序（critical > urgent > normal）

### 1.3 4 档窗口结构（预告 / 临近 / 倒数 / 进行中）❌
- **来源**：第 2 层 + 第 6 层 · 共修 T-24h 预告档 / T-30 临近档 / T-5 倒数档 / T-0 进行中
- **作废原因**：「档」是「卡片状态机」概念 · 卡片废了档也废
- **替代方案**：
  - T-30 / T-5 / T-0 是 push tier · 不是 UI 档（继续使用）
  - 卡片视觉切换 → 改为「班级共修详情页」内的颜色 + 倒计时 变化（已实施）

### 1.4 HomeCardDismissal 表 ❌
- **来源**：第 2 层 schema 设计
- **作废原因**：没有「卡片」概念也不需要 dismiss
- **替代方案**：critical 系统公告 ack → 未来 `NotificationCardAck` 表（v3 Banner 实施时建）

### 1.5 contentHash 失效首页卡 ❌
- **来源**：第 2 层 · 用 contentHash 判定 dismissal 是否失效
- **作废原因**：场景没了
- **保留范围**：contentHash 字段仍在 Notification 表 + SystemAnnouncement / ClassAnnouncement 表 · 用于「内容修改后通知中心显示更新提示」（保留 · 不作废）

### 1.6 首页卡自动消失 3 条规则 ❌
- **来源**：第 2.5 层「窗口结束 / 已应答 / 静默衰减」
- **作废原因**：卡片废了
- **替代方案**：Banner UI（v3）有自己的消失规则（severity 三档）· 详情页按业务状态自然展示

### 1.7 9 类事件源「卡形草图」❌
- **来源**：第 6 层（共修预告卡 / 共修临近卡 / 共修倒数卡 / ...）
- **作废原因**：所有卡形都不实施
- **替代方案**：见 FINAL_SPEC §3（每事件 tier 文案）+ 各详情页设计

---

## 二、UpcomingEventCard 前端组件 · 作废

### 2.1 UpcomingEventCard ❌
- **来源**：`NOTIFICATION_V2_DESIGN.md` 旧模块 M3
- **作废原因**：与首页卡同源
- **替代方案**：
  - 首页玻璃文字（v3）
  - `/events` 综合活动列表（已实施 · v2 收尾）
  - 班级页「共修安排紧凑卡」（保留 · 已有）

---

## 三、多源仲裁逻辑 · 作废

### 3.1 多事件源同时活跃的仲裁 ❌
- **来源**：旧模块 M4
- **作废原因**：单槽位卡片废了 · 不需要仲裁
- **替代方案**：
  - Banner 队列（v3）· 按 severity 排序 · 同时只显示 1 条
  - 玻璃文字（v3）· 多行展示 · 不互相竞争

---

## 四、NotificationRule 多 scope 设计 · 部分作废

### 4.1 class / assignment scope 规则 ❌
- **来源**：旧 NotificationRule 表 `scope` 字段支持 'platform' | 'class' | 'assignment'
- **作废原因**：只用 'platform' scope · 班级 / 任务级规则未实施且无需求
- **保留范围**：'platform' scope（个人提醒三档 cron 默认时段）继续工作
- **状态**：表保留 · 仅用 platform scope

---

## 五、共修期间「档位 UI 切换动画」· 简化

### 5.1 同 eventId tier 升级的 framer-motion 卡片内容渐变 ❌
- **来源**：第 6 层 E. 档位切换动画
- **作废原因**：没有卡片 · 改为详情页内的状态色 + 倒计时变化
- **替代方案**：班级共修详情页 useCountdown hook + phaseConfig 颜色切换（已实施）

---

## 六、其它废弃细节

### 6.1 进行中卡片缩成右下角徽章 ❌
- **来源**：第 6 层 C.4
- **作废原因**：没有卡片
- **替代方案**：用户进直播间后浏览器跳走（target=_blank Zoom）· app 不参与「直播中状态」

### 6.2 「点击卡片 X 按钮关闭」交互 ❌
- **来源**：第 6 层 F. dismiss / ack 交互
- **作废原因**：没有卡片
- **保留**：critical 系统公告「我知道了」按钮（v3 Banner 实施）

### 6.3 首页卡的 dark mode ❌
- **来源**：第 6 层 J
- **作废原因**：项目暂不支持深色模式（已记入「已知限制」）· 卡片也废了

---

## 七、确认仍要实施的（未废弃）

为防混淆 · 这些是**仍要实施**的（v3）：

| 项 | 状态 | 文档 |
|---|---|---|
| ✅ In-app Banner UI | v3 待实施 | FINAL_SPEC §6 |
| ✅ 首页玻璃文字 | v3 待实施 | FINAL_SPEC §7 |
| ✅ 班级红点 | v3 待实施 | FINAL_SPEC §7.2 |
| ✅ ActiveBanner 表 | v3 待实施 | FINAL_SPEC §19.4 |
| ✅ critical 系统公告 ack | v3 Banner 实施时 | FINAL_SPEC §3.6 |
| ✅ Achievement 金色庆祝 Banner | v3 Banner 实施时 | FINAL_SPEC §3.5 |
| ✅ SMS 子系统（含模板 / 广播）| v3 待实施 | FINAL_SPEC §11 |
| ✅ 法会 in_progress_arrival tier | v3 待实施 | FINAL_SPEC §3.7 |
| ✅ 藏历加持日玻璃文字 | v3 待实施 | FINAL_SPEC §3.8 |
| ✅ 静默时段聚合 push（DelayedPush）| v3 待实施 | FINAL_SPEC §5 L3 优化 |
| ✅ 共修 T-24h 预告 cron | v3 待实施 | FINAL_SPEC §3.1 |
| ✅ 灰度发布机制 | v3 待实施 | FINAL_SPEC §15 |
| ✅ 独立审计 26 项修复 | 阶段 3 待实施 | AUDIT_INDEPENDENT |

完整待办见 `NOTIFICATION_PROGRESS_SNAPSHOT.md` §2。

---

## 八、文档导航（哪些是历史 · 哪些是实施依据）

| 文档 | 当前用途 |
|---|---|
| `NOTIFICATION_FINAL_SPEC.md` | ✅ **实施依据**（终版 · 含审计修复）|
| `NOTIFICATION_PROGRESS_SNAPSHOT.md` | ✅ **当前进度 + 剩余清单** |
| `NOTIFICATION_V2_IMPLEMENTATION_STATUS.md` | ✅ v2 实施状态 + 部署清单 |
| `NOTIFICATION_V3_ROADMAP.md` | ✅ 阶段 3 + v3 路线图 |
| `NOTIFICATION_AUDIT_INDEPENDENT.md` | ✅ 独立审计 26 项 |
| `NOTIFICATION_CURRENT_CODE_AUDIT.md` | 📜 实施前代码审计（历史）|
| `NOTIFICATION_V2_LAYERED_ARCH.md` | 📜 **10 层演进史 · 第 2 / 6 层已标作废 · 仅作历史参考** |
| `NOTIFICATION_V2_DESIGN.md` | 📜 旧 12 模块设计 · 头部已标 deprecated + 映射表 |
| **`NOTIFICATION_DEPRECATED_DESIGNS.md`**（本文档）| ✅ **废弃清单 · 防误判** |

**实施时优先读**：FINAL_SPEC + PROGRESS_SNAPSHOT + V3_ROADMAP
**遇到「未实施」之物**：先查本文档 · 看是否已废弃
