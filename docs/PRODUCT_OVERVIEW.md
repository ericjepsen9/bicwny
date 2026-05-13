# 觉学 · 产品功能全景图（PM 交接版）

> 整理日期：2026-05-13
> 用途：给新接手的产品经理快速建立项目认知
> 范围：当前实施状态 + 已设计未做 + 路线图

---

## 状态图例

| 标识 | 含义 |
|---|---|
| ✅ | 已实施 · 生产可用 |
| ◐ | 部分实施 · 有基础但功能不全 |
| 📝 | 设计完成 · 暂未实施 |
| ✗ | 未设计 · 未实施 |

---

## 一、产品定位

**觉学 v2** · 藏传佛教学习平台（北美 + 台湾市场）

**核心价值：**
- 系统化"闻 · 思 · 修"学习路径
- 班级化集体修学（辅导员带领）
- 长期陪伴式学修计数 + 复习巩固
- 殊胜日 / 法会 / 共修等仪式感节点

**用户角色：**
- 学员（student）· 主要用户
- 辅导员（coach）· 班级带领
- 管理员（admin）· 平台管理

**部署：**
- Web App（juexue.caughtalert.com/app）· 主战场
- iOS / Android（Capacitor 包 · 未上线 · v3 范围）

---

## 二、功能矩阵

### 闻 · 法本学习

| 功能 | 状态 | 说明 |
|---|---|---|
| 法本目录（Courses） | ✅ | 网格 · 搜索 · 排序（最近阅读 / 名称 / 类别）· 已加入/未加入筛选 |
| 法本详情页 · TOC | ✅ | 封面 + 标题 + 作者 + 章节课时树 + 继续阅读入口 |
| 课时阅读页 | ✅ | Apple 图书风 · 字号调节 · 段落渲染 · 滚动隐显工具栏 |
| 阅读进度追踪 | ✅ | heartbeat + scroll + visibility · 自动标已读 |
| 段落级笔记 | ✅ | 选段加笔记 · LLM 自动起骨架 · 阅读时显示 💬 锚点 |
| 4 色文本高亮 | ✅ | 黄/绿/蓝/粉 · 选段标记 · 点击删除 |
| 选段工具栏 | ✅ | 拷贝 / 标记 / 加笔记 · 底部固定避让 iOS 原生菜单 |
| 章节进度可视化 | ◐ | 每章显示完成度 % · 圆 badge 仅 100%/<100% 两档 |
| **课时讲法视频** | 📝 | LESSON_MEDIA_PLAN.md · 每课 30min-2h 法师视频 |
| **课时讲法音频** | 📝 | 同上 · 后台播放 · 锁屏控件 · 倍速 |
| **段落级 AI 解释** | ✗ | 选中文字让 AI 解释佛理 · 待规划 |

### 思 · 答题 / 复习

| 功能 | 状态 | 说明 |
|---|---|---|
| 14 种题型 | ✅ | single/multi/fill/open/sort/match/flip/verse/chain/image/listen/flow/guided/scenario |
| 答题反馈 | ✅ | 后端返完整 question · 含 correctText / wrongText |
| SM-2 间隔重复 | ✅ | 自动算下次复习时间 · 错题加权 |
| 错题本 | ✅ | 自动入 / 答对自动出 · 详情可"再练一道" |
| 收藏本 | ✅ | 独立于答题状态 · 用户主动标 |
| 智能练习 | ✅ | SM-2 + 错题 + 已学课时混合抽题 |
| 复习中心 /quiz | ✅ | 3 张磨砂玻璃卡（待复习 / 错题 / 收藏）· 按法本练习 |
| 题目库 admin | ✅ | 手动创建 + 导入 + **LLM 自动生成** |
| 辅导员题目管理 | ✅ | 班级专属题库 · 创建 / 审核 |

### 修 · 观修 / 修学计数

| 功能 | 状态 | 说明 |
|---|---|---|
| 观修视频（Meditation） | ✅ | 30+ 分钟法师引导坐修 · 课时配套 · 反思层 |
| Admin 上传观修 | ✅ | ffmpeg + scp 自动推 OSS · 抽缩略图 |
| 观修完成记录 | ✅ | MeditationSession · 进度 + 完成时间 |
| 班级观修排行 | ✅ | 周/月/全时 · 5 分钟内存缓存 · 隐私 toggle |
| 修学计数（咒诵/修法） | ✅ | PracticeProject · 类目分组 · 每日 PracticeGoal |
| 修学历史曲线 | ✅ | 项目维度 · 时间轴统计 |
| 班级修学排行 | ✅ | 同观修 · 学员可关闭可见性 |
| **老师布置功课** | 📝 | ASSIGNMENT_PLAN.md · 5 类型 / 4 周期 / 3 scope |
| **滚轮计数 UI** | 📝 | 用户在 app 内快速 +N 输入 |
| **班级修学动态（随喜 + 回向）** | ✗ | F5 路线图 · 一键随喜 + 回向动画 |
| **每日修学卡（首页钩子）** | ✗ | F1 路线图 · 整合 SM-2 + 阅读 + 计数 |

### 班级 · 协作

| 功能 | 状态 | 说明 |
|---|---|---|
| 加入班级（邀请码） | ✅ | joinCode 6-8 位 · 学员凭码加入 |
| 班级详情页 | ✅ | hero + 主修法本 + 辅导员卡 + 学员列表 + 公告区 |
| 班级公告 | ✅ | 辅导员发文 · markdown · 多图 · 学员侧 inbox |
| 班级修学统计 | ✅ | 辅导员看学员答题 / 修学情况 |
| 班级观修看板 | ✅ | 辅导员看每个学员完成情况 |
| **公开班级目录** | 📝 | CLASS_DISCOVERY_PLAN.md · 学员浏览班级列表 |
| **申请加入班级** | 📝 | 同上 · 学员提交申请 → 辅导员审批 |
| **辅导员排课** | ✅ | **本周新做** · 共修 / 答疑 / 直播 · 按时间触发提醒 |
| **班级共修排期视图** | ✗ | 学员侧"本周共修日历" · 未做 |

### 笔记 · 个人沉淀

| 功能 | 状态 | 说明 |
|---|---|---|
| 创建 / 编辑 / 删除笔记 | ✅ | 私密 / 班级共享切换 |
| 段落锚点 | ✅ | 从阅读页选段进入 · 自动挂段落 |
| LLM 5 actions | ✅ | 润色 / 摘要 / 标签 / 标题 / 骨架 |
| 标签 + 搜索 | ✅ | 自由 tag · 全文搜索 |
| 置顶 + 归档 | ✅ | 列表第 3 tab"归档"默认隐 |
| 班级共享笔记 | ✅ | visibility=class · 同班可见 · 含 authorName / lessonTitle |
| Markdown 预览 | ✅ | 自写 mdToHtml · 标题/粗体/斜体/列表/引用 |

### 藏历 · 殊胜日

| 功能 | 状态 | 说明 |
|---|---|---|
| 全年藏历数据 | ✅ | 2026 全年录入 · 公历 + 农历 + 藏历 + 闰月 + 善行倍增 + 节日 |
| /calendar 全年视图 | ✅ | 全年月历视图 |
| 首页头部当日 | ✅ | 显示藏历月日 + 节日红色徽章 |
| 殊胜日自动推送 | 📝 | NOTIFICATION_PLAN.md · 每日 00:05 扫描批量推送 |
| **藏历事件 admin 编辑** | ✗ | 目前数据由 admin 手动 import · 没专门 UI |

### 首页 · 仪表盘

| 功能 | 状态 | 说明 |
|---|---|---|
| 画报背景（每月一张） | ✅ | HomePoster 模型 · admin 上传月度图 |
| 顶部 overlay | ✅ | 头像 + 日期 + 藏历 + 节日徽章 + 通知铃 |
| 4 大磨砂玻璃卡 | ✅ | 法本 / 班级 / 练习 / 修学 |
| streak 浮动 | ✅ | 连续学习天数 |
| 3 个 TabBar | ✅ | 首页 / 法本 / 复习 · 文字下划线 |
| **即将事件卡片**（UpcomingEventCard） | ◐ | **本周设计 + 后端 API 完成** · 前端组件未做（v1 步骤 5）|
| **首页钩子整合**（F1 每日修学卡） | ✗ | 路线图待开 |

### 通知 · 推送

| 功能 | 状态 | 说明 |
|---|---|---|
| In-app 通知中心 | ✅ | 红点徽章 · 列表 · 标已读 · 软删 |
| Web Push 基建 | ✅ | VAPID + PushSubscription + sendPushToUsers |
| SW push 事件监听 | ✅ | **本周新做** · 收推送 → showNotification banner |
| SW notificationclick | ✅ | 点 banner → 跳 link |
| **推送授权 UI** | ✗ | /settings 加 toggle · v1 步骤 4 待做 |
| **辅导员排课提醒**（T-30/T-5/T0） | ✅ | **本周新做** · 调度器 60s tick · DispatchLog 去重 |
| **首页提醒卡（UpcomingEventCard）** | ✗ | 后端 API 有 · 前端组件未做 · v1 步骤 5 |
| **班级公告自动接通推送** | ◐ | inbox ✓ · push sendToUsers 待补 |
| **成就解锁推送** | ◐ | inbox ✓ · push 待补 |
| **系统公告推送** | ◐ | inbox ✓ · push 待补 |
| **个人学修提醒**（早晚课定时） | 📝 | NOTIFICATION_PLAN.md · ReminderRule 模型 |
| **用户通知偏好设置** | 📝 | quiet hours / per-type toggle |
| **法会模型 + 长期事件 daily window** | 📝 | NOTIFICATION_PLAN.md |
| **多源仲裁**（admin / coach / 法会 / 藏历卡片竞争） | 📝 | 设计完成 |
| **Severity 字段**（normal / urgent / critical） | 📝 | admin 紧急公告可强制压住 coach |
| **重复事件 recurrence**（每天早晚课 / 每周三共修） | 📝 | ClassSession.recurrence JSON · v2 |
| **SMS 短信通道**（Twilio US） | 📝 | A2P 10DLC 注册 1-2 周 · v3 |
| **自动外呼电话**（Twilio Voice · TCPA 合规） | 📝 | 未接 → SMS 兜底 · v4 |
| 邮件通道 | ◐ | 仅注册验证邮件 · 无业务推送 |

### 个人中心 · 设置

| 功能 | 状态 | 说明 |
|---|---|---|
| /profile · 法名 / 头像 / 班级 / 主修 | ✅ | 入口聚合 |
| /settings · 主题 / 字号 / 语言 | ✅ | 明暗主题 · 65%-150% 字号 · 三语 |
| 隐私设置 | ✅ | 观修 + 修学班级可见性 |
| 多设备管理 | ✅ | /devices · 登出他端 |
| 成就 | ✅ | /achievements · 解锁里程碑 |
| 学习画像 | ✅ | /me/stats · 答题分布 · streak |
| 我的观修 | ✅ | /me/meditations |

### 认证 · 安全

| 功能 | 状态 | 说明 |
|---|---|---|
| 邮箱 / 密码注册 | ✅ | + 邮箱验证 + 密码重置 |
| Onboarding 引导 | ✅ | 首次登录引导加班级 or 自学 |
| 3 种角色 | ✅ | student / coach / admin |
| CAPTCHA | ✅ | Turnstile / hCaptcha / reCAPTCHA 可配 |
| Sentry 错误监控 | ✅ | 前后端独立 DSN |
| **手机号绑定** | 📝 | 加 SMS 通道时一起做（v3） |
| **TCPA opt-in 记录** | 📝 | 加电话时做（v4） |

### LLM · AI

| 功能 | 状态 | 说明 |
|---|---|---|
| LLM Gateway | ✅ | MiniMax + Claude fallback · usage 限额 · prompt 模板 |
| 笔记 LLM 5 actions | ✅ | polish / summarize / tags / title / draft |
| Admin 题目自动生成 | ✅ | 辅导员从法本文本生成题目 |
| **AI 助手**（RAG 法本问答） | 📝 | AI_ASSISTANT_PLAN.md · 469 行设计 · 未实施 |
| **段落级 AI 解释** | ✗ | 选中文本让 AI 解释 · 未规划 |

### Admin · 后台

| 功能 | 状态 | 说明 |
|---|---|---|
| 仪表盘 | ✅ | 全局数据概览 |
| 用户管理 | ✅ | 新建 · 角色 · 班级归属 |
| 班级管理 | ✅ | 新建 · 辅导员指派 · 归档 |
| 法本管理 | ✅ | 章节 · 课时 · 原文 + 封面上传 |
| 法本类别 | ✅ | **本周新做** · 自由文本 · 前端排序分组 |
| 观修视频上传 | ✅ | ffmpeg + scp 自动 OSS |
| 题目导入 / 审核 | ✅ | CSV / 手动 · 可见性 + 状态 |
| LLM 配置 | ✅ | providers / scenarios / templates / usage 看板 |
| 审计日志 | ✅ | admin 行为留痕 |
| 首页画报上传 | ✅ | HomePoster 月度图 + 诗句 caption |
| 修学项目预设 | ✅ | admin 配置平台级修法项目 |
| **法会 / 共修事件管理** | 📝 | NOTIFICATION_PLAN.md DharmaAssembly · 未实施 |
| **辅导员看 admin 紧急通知** | 📝 | 创建公告时显示活跃通知列表 |

### 跨切面基建

| 功能 | 状态 | 说明 |
|---|---|---|
| 主题（明 / 暗 / 跟随系统） | ✅ |
| 字号缩放（a11y · 适老化） | ✅ |
| Pull-to-refresh | ✅ |
| View Transitions API | ✅ | 跨页淡入 |
| Service Worker 缓存 | ✅ | 静态 cache-first · shell network-first |
| Analytics 埋点 | ✅ | 自建轻量 · pageview + 自定义事件 |
| Feedback 收集 | ✅ | 用户反馈表单 · admin 处理 |
| i18n 三语 | ✅ | 简体 / 繁体 / 英文 |

---

## 三、近期重点工作（2026 年 5 月）

### 本周完成（claude/audit-page-quality-EpO7Q 分支）

- 笔记审计 + 归档 UI + markdown 修复
- 4 色文本高亮（Highlight 模型 + 选段工具栏）
- 法本页排序（最近阅读 / 名称 / 类别）+ Course.category 字段
- 首页 v2 画报日历重设计
- 多处 UI 视觉调优（玻璃头像 / stat card / 章节圆等）
- **通知推送 v1 步骤 1-3**（ClassSession 模型 + 辅导员排课页 + 调度器 + SW push handler）

### 推送 v1 待做（继续可闭环）

- 步骤 4：推送授权 UI（/settings 加 toggle）
- 步骤 5：首页 UpcomingEventCard 组件

---

## 四、未决策的产品方向

### G1-G8 待 PM 确认（来自 ROADMAP_2026.md）

| # | 待定项 | 推荐选项 |
|---|---|---|
| G1 | 老师布置功课"不可改"边界 | 锁目标/周期/数量 · 学员可加备注 |
| G2 | 自学用户 admin 可见性 | admin 看个人详情 + 平台聚合 |
| G3 | 滚轮计数范围 | 预设 7 个常用数 + 自定义 |
| G4 | 藏历后台数据格式 | CSV 一次性导入 + 单条增删 |
| G5 | 一键随喜 + 回向动画 | 整班一键 + 单次动画 + 一天 1 次 |
| G6 | 笔记班级共享粒度 | 默认私密 · 主动选公开 |
| G7 | 音频上传细节 | 1 课 N 音频 · 自动转码 · 章节标记 |
| G8 | AI 助手优先级 | Tier 1 功能导航 → Tier 2 法本 RAG |

### 战略问题（来自 ROADMAP_2026.md）

| # | 问题 | 推荐 |
|---|---|---|
| S1 | 14-16 周排法 | Phase 1 完发布 · 后续滚动发版 |
| S2 | 全职 vs 兼职 | 全职 14-16 周 |
| S3 | 真用户邀请节点 | Phase 1 完即邀请 10-30 个种子用户 |

---

## 五、设计文档索引

| 文档 | 状态 | 简介 |
|---|---|---|
| `docs/ROADMAP_2026.md` | 路线图 | 10 大功能 · 4 个 Phase · 14-16 周完整路线 |
| `docs/AI_ASSISTANT_PLAN.md` | 📝 | AI 助手 469 行 · RAG + 功能导航 + 修行咨询 |
| `docs/ASSIGNMENT_PLAN.md` | 📝 | 功课计数 485 行 · 老师布置 / 学员自定义 |
| `docs/CLASS_DISCOVERY_PLAN.md` | 📝 | 公开班级目录 + 申请加入 + 邀请 |
| `docs/NOTIFICATION_PLAN.md` | ◐ | 通知规则引擎 504 行 · v1 进行中 |
| `docs/MEDITATION_PLAN.md` | ✅ | 观修引导 660 行 · 已实施 · 文档状态待更新 |
| `docs/LESSON_MEDIA_PLAN.md` | 📝 | **新增** · 课时 3 种学习模式（阅读/视频/音频）|
| `docs/HOMEPAGE_V2_ROLLBACK.md` | 备份 | 首页 v2 重设计的回滚指南 |
| `docs/CSS-GOTCHAS.md` | 参考 | CSS 踩坑笔记（fixed / picture / dialog 等） |
| `DESIGN_PLAN.md` | 参考 | UI 设计系统 + 跨端实施 |

---

## 六、技术栈速览

### 前端
- React 18 + Vite + TypeScript
- React Router 7 · React Query 5
- 设计：自写 token CSS · 玻璃风 · 三语 i18n
- Service Worker + Web Push API

### 后端
- Node.js + Fastify
- Prisma 6.19 + PostgreSQL
- Zod 校验
- web-push（VAPID）· nodemailer · sharp（图片）· ffmpeg（视频）

### 部署
- 主服务器：juexue.caughtalert.com（前端 + 后端）
- 媒体 OSS：media.juexue.caughtalert.com（独立服务器 · scp 投递）
- PM2 进程管理（juexue-api）
- nginx 反代

### LLM
- 网关 · MiniMax 主 · Claude fallback
- 限额 + 模板 + 用量统计

---

## 七、给 PM 的接手建议

### 第一周
1. 通读 `docs/ROADMAP_2026.md` · 理解 4 个 Phase 节奏
2. 通读本文档（PRODUCT_OVERVIEW.md）· 掌握全景
3. 通读 `docs/CLAUDE.md`（项目根目录）· 项目守则 + 部署细节

### 第二周
4. 体验 admin 后台（创建班级 / 法本 / 题目）· 理解内容生产链路
5. 体验学员 app（加入班级 / 阅读 / 答题 / 观修 / 笔记）· 用户旅程
6. 体验辅导员侧（看学员 / 发公告 / 排课）· 协作场景

### 第三周
7. 决策 G1-G8 + S1-S3（11 个待定项）· 推动 Phase 1 正式开工
8. 确认 `LESSON_MEDIA_PLAN.md` 优先级（视频 / 音频 是否进 Phase 1）
9. 与开发对齐推送 v1 步骤 4-5 的收尾

### 关键关注
- **未实施的 5 个大方案**（AI 助手 / 功课系统 / 班级发现 / 通知规则引擎 / 课时多模态）· 都是 1-3 周大功能
- **iOS / Android 上架**（F10）· 设计文档不完整 · 需评估
- **支付 / 订阅模式** · 当前完全无 · 未来商业化前要规划
- **用户增长策略** · CLASS_DISCOVERY 是冷启动关键

---

## 八、联系 / 进入开发节奏

- 代码仓库：github 同步 · 分支 `claude/audit-page-quality-EpO7Q`（当前开发主线）
- 部署文档：`deploy/REDEPLOY-juexue-caughtalert.md`
- 测试：`backend/TESTING.md` + `e2e/README.md`
- 设计踩坑：`docs/CSS-GOTCHAS.md`

---

> **本文档每次主要功能交付 / 设计文档新增时更新。**
> 最后更新：2026-05-13
