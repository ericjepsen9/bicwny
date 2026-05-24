# 课时多模态学习功能设计方案 · LessonMedia · 2026-05-13

> 状态：📝 设计中 · 等用户 review

## 一、产品定位

每个课时（Lesson）支持 3 种学习模式：
- 📖 **阅读** · 法本原文（现有 `referenceText`）
- 🎬 **视频** · 法师讲法视频（新）· 30 分钟 - 2 小时
- 🎧 **音频** · 法师讲法音频（新）· 30 分钟 - 2 小时

3 种模式互补 · 用户根据场景选：

| 场景 | 推荐模式 |
|---|---|
| 通勤 / 散步 / 厨房 | 音频（后台播放 · 锁屏控制 · 倍速） |
| 晚上专注 / 复习 | 视频（影音 + 字幕同步） |
| 想做笔记 / 引用 | 阅读（段落锚点 · 高亮 · 笔记） |

**任一完成 → 课时算"已学"**（不强制三种都看）。

## 二、与 Meditation 的边界

| 模块 | 内容 | 时长 | 数据流 |
|---|---|---|---|
| **Lesson 阅读** | 法本原文 | — | 文字 |
| **Lesson 视频**（新） | 法师讲法（讲解 lesson 内容） | 0.5-2h | 视频 |
| **Lesson 音频**（新） | 法师讲法（同上 · 听觉版） | 0.5-2h | 音频 |
| **Meditation 观修**（现有） | 法师引导坐修 + 字幕滚动 | 30-60 min | 视频 · 含反思层 |

**关键区别：** 讲法 = 老师**讲**给你听 / 看 · 观修 = 老师**带**你坐修。两者并存 · 各自独立。

## 三、数据模型

### 新增 `LessonMedia`

```prisma
enum LessonMediaKind {
  video    // 讲法视频
  audio    // 讲法音频
}

model LessonMedia {
  id          String          @id @default(cuid())
  lessonId    String
  kind        LessonMediaKind
  // 元信息
  title       String          // 如 "第 1 课 · 法师讲解上"（一课可多个媒体时区分）
  description String?         @db.Text
  order       Int             @default(0) // 同 kind 内排序
  // 媒体本体
  url         String          // OSS URL · 同 Meditation 走 ffmpeg + scp
  durationSec Int             // 时长（必填 · 上传时由后端探测填入）
  thumbnailUrl String?        // 视频缩略图 · admin 上传时自动抽帧
  fileSize    Int?            // 字节数 · 仅展示用
  // 章节标记（可选 · v1 不强制）
  // [{ timeSec: 0, title: "开篇" }, { timeSec: 600, title: "第二段释义" }]
  chapters    Json?
  // 发布状态
  isPublished Boolean         @default(false)
  publishedAt DateTime?
  createdBy   String          // admin userId
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  lesson      Lesson          @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  sessions    LessonMediaSession[]

  @@index([lessonId, kind])
  @@index([lessonId, kind, order])
}
```

### 新增 `LessonMediaSession`（学员消费记录）

```prisma
model LessonMediaSession {
  id            String      @id @default(cuid())
  userId        String
  mediaId       String
  // 进度
  watchedSec    Int         @default(0)   // 已观看/收听秒数
  lastPosition  Int         @default(0)   // 上次离开时的位置（断点续播）
  completedAt   DateTime?                 // 看完 / 听完时间（≥ 90% 时长算完成）
  // 元
  startedAt     DateTime    @default(now())
  lastSeenAt    DateTime    @updatedAt

  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  media         LessonMedia @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@unique([userId, mediaId])
  @@index([userId, lastSeenAt])
  @@index([mediaId, completedAt])
}
```

### `Lesson` 加关系

```prisma
model Lesson {
  // ...已有
  medias        LessonMedia[]
}
```

### `User` 加关系

```prisma
model User {
  // ...已有
  mediaSessions LessonMediaSession[]
}
```

## 四、UserCourseEnrollment 的"已学"逻辑变更

现有 `lessonsCompleted: String[]` 数组保留 · 但触发条件扩展：

**满足任一即添加 lessonId 到 lessonsCompleted：**
1. 阅读：`LessonReadingProgress` heartbeat 满足完成阈值（现有）
2. 视频：`LessonMediaSession` 中该 lesson 任一 video 类完成（≥ 90%）
3. 音频：`LessonMediaSession` 中该 lesson 任一 audio 类完成（≥ 90%）
4. （手动 · admin 标记）

后端写 `reading/service.ts` + 新 `lessonMedia/service.ts` · 在 completion 触发时统一调 `markLessonCompleted(userId, lessonId)`。

## 五、上传流程

复用 Meditation 上传管线：
- Admin 后台 `/admin/courses` → 课时编辑 → "添加视频" / "添加音频"
- 文件 ≤ 500MB · ffmpeg 探测时长 + 抽视频缩略图
- scp 推到 OSS（`media.juexue.caughtalert.com`）
- DB 写 LessonMedia 行 · isPublished 默认 false（admin 勾选发布）

音频不需 transcoding · 直接传 mp3/m4a。视频走现有 mp4 H.264 流程。

## 六、学员端 UI

### 6.1 阅读页（现有）改造

`/read/:slug/:lessonId` 顶部加 tab 切换：

```
┌────────────────────────────────────────┐
│ ← [返回]   课时标题      [A-] [A+] [☰] │
├────────────────────────────────────────┤
│  ┌──────┬──────┬──────┐                │
│  │📖阅读│🎬视频│🎧音频│   ← 仅当有对应媒体时显示 tab
│  └──────┴──────┴──────┘                │
│                                        │
│  当前模式内容...                        │
└────────────────────────────────────────┘
```

- 📖 阅读 tab：现有 referenceText + 高亮 + 笔记锚点（不动）
- 🎬 视频 tab：内嵌视频播放器 · 字幕开关 · 倍速
- 🎧 音频 tab：音频播放器 + 进度条 + 倍速 + 锁屏控件

切 tab 不丢进度（每种模式独立 LessonMediaSession 记录）。

### 6.2 视频播放器（kind=video）

- 内嵌 `<video controls>` · 全屏支持
- 字幕：如有 .vtt 文件则展示开关（v2 加）
- 倍速：0.75 / 1.0 / 1.25 / 1.5 / 2.0
- 章节标记：若 LessonMedia.chapters 非空 · 进度条下显示锚点列表 · 点击跳章
- 断点续播：进入时从 lastPosition 开始（首次 = 0）
- 完成判定：watchedSec ≥ 90% durationSec → completedAt = now + 触发 lesson 标已学

### 6.3 音频播放器（kind=audio）★ 重点

- **Media Session API**（iOS 锁屏 / Android 通知栏控件）
  - 标题：法本名 · 课时名
  - 缩略图：课时封面 / 法本封面
  - 操作：play / pause / seek 15s / next / prev
- **后台播放**：`<audio>` + `audioContext` + Service Worker 兼容
- 倍速：同视频
- 断点续播 + 完成判定：同视频
- iOS PWA 需 `manifest.json` 加 `"display": "standalone"` 才能锁屏控件（已有）

### 6.4 法本详情页（TOC）课时行

每行右侧 icon 显示该 lesson 可用的模式：

```
1  前行之重要性          📖🎬🎧  阅读 →
2  前行广释 1             📖🎧            阅读 →   ← 这课没视频
3  前行广释 2             📖              阅读 →   ← 只有文字
```

小图标表示存在某模式。

### 6.5 复习页（QuizCenterPage）"按法本练习"

按法本下钻保持现状 · 但每个法本卡可显示"视频/音频/文字"3 个 chip 统计：

```
🪷 大圆满前行     📖 14 章 · 🎬 28 个视频 · 🎧 28 个音频
   抽 10 题练习 →
```

## 七、Admin 端 UI

### 7.1 课时编辑加"媒体"区

```
[课时编辑]
  标题: ___________________
  原文: textarea (referenceText)
  讲法摘要: ___________________

  ── 媒体 ──
  
  🎬 视频
  ┌─────────────────────────────┐
  │ [+] 上传视频                  │
  │ ─────                         │
  │ • 法师讲解上 (45 min) ✓ 已发布│
  │ • 法师讲解下 (38 min) ⚪ 草稿 │
  └─────────────────────────────┘
  
  🎧 音频
  ┌─────────────────────────────┐
  │ [+] 上传音频                  │
  │ ─────                         │
  │ • 法师讲解（音频版）(83 min) ✓│
  └─────────────────────────────┘
```

- 每个媒体行：编辑 / 删除 / 发布切换 / 重新上传
- 章节标记编辑器：v2 加（v1 仅支持纯播放）
- 拖拽排序：v2 加（v1 用 order 字段手填）

### 7.2 数据看板

`/admin/courses/:id/media-stats`：
- 各课时媒体齐全度（红/黄/绿 · 仅文 / 有部分 / 三全）
- 学员消费分布（看视频 / 听音频 / 仅文字 各占比）
- 完成率（每个媒体的"看完 90% 用户数"）

## 八、API 设计

### 学员侧

```
GET    /api/lessons/:lessonId/medias              该课时所有媒体（已发布）
GET    /api/lessons/:lessonId/medias/:mediaId     单媒体详情
POST   /api/lesson-media/:mediaId/progress        更新进度（节流 · 10s / 次）
                                                   body: { watchedSec, lastPosition }
POST   /api/lesson-media/:mediaId/complete        显式标完成（用户手动 · 可选）
```

### Admin 侧

```
GET    /api/admin/lessons/:lessonId/medias        含未发布
POST   /api/admin/lesson-media                    创建（含上传 multipart）
PATCH  /api/admin/lesson-media/:id                编辑
DELETE /api/admin/lesson-media/:id                删除（OSS 文件随删）
POST   /api/admin/lesson-media/:id/publish        发布
POST   /api/admin/lesson-media/:id/unpublish      取消发布
```

## 九、技术挑战

### 9.1 音频后台播放（iOS Safari）

- 需要用户手动加 PWA 到主屏（standalone 模式）才能锁屏控件
- 普通浏览器内打开：tab 切走/锁屏时音频自动暂停（iOS 安全策略）
- 解决：明显引导用户"添加到主屏幕" + 设置 `<meta name="apple-mobile-web-app-capable" content="yes">`

### 9.2 移动数据消耗

- 1 小时音频 ~ 30-50 MB（MP3 128kbps）
- 1 小时视频 ~ 500MB-1GB（H.264 720p）
- 设置项：默认仅 WiFi 自动播放 / 移动数据需手动确认（v2）

### 9.3 进度上报频率

- 节流 10 秒 / 次（不能每秒都 POST · 服务端压力）
- 离线缓存：navigator.online === false 时本地累计 · 上线后批量上报

### 9.4 章节标记编辑

- v1 不做 admin 编辑器 · 用 JSON 直接填
- v2 加可视化时间轴 · 点击进度条加锚点

## 十、落地分期

### v1（2 周）
- LessonMedia + LessonMediaSession 模型
- 上传 / CRUD API
- Admin 课时编辑加媒体区
- 学员阅读页 3 tab 切换
- 视频播放器（HTML5 video · 全屏 + 倍速）
- 音频播放器（HTML5 audio · Media Session API）
- 进度追踪 + 任一完成标"已学"
- 法本详情课时行 icon 标识

### v2（1 周）
- 章节标记可视化编辑
- 字幕（.vtt）支持
- 数据看板（admin）
- 拖拽排序
- 移动数据消耗设置

### v3+
- 视频转码到多分辨率（HLS / DASH）
- CDN 加速
- 离线下载（PWA Cache API · iOS 限制大）

## 十一、与现有模块的协同

### Note 模块
- 视频 / 音频内做笔记 · `anchorIndex` 字段可复用为 timestamp（秒数）
- v2 加：笔记标 "@视频 12:34" 跳到该时刻

### Highlight 模块
- 不在视频/音频上做（无文本可标）· 阅读模式专属

### Reading Progress
- 仅追踪阅读 · 不动
- 视频/音频走独立 LessonMediaSession

### Practice / 答题
- 答题题目可挂"该题源自视频 @12:34" 链接（v2）

## 十二、决策定型清单

| # | 决策 | 选择 |
|---|---|---|
| 1 | 数据模型 | ✅ 独立 LessonMedia 表（一课多媒体）|
| 2 | 与 Meditation 关系 | ✅ 完全独立 |
| 3 | 进度判定 | ✅ 任一完成即"已学" |
| 4 | 完成阈值 | 默认 90% 时长（可配） |
| 5 | 上传管线 | ✅ 复用 Meditation 现有 ffmpeg + scp |
| 6 | 章节标记 v1 | ✅ 仅 JSON 支持 · 不做编辑器 |
| 7 | 字幕 | v2 加 .vtt |
| 8 | 离线下载 | v3+ |
| 9 | 后台播放 | iOS 需 PWA standalone · 引导用户加主屏 |

## 十三、风险红线

- **版权 / 上传许可** —— 法师讲法视频/音频是否有公开传播授权？admin 上传前需 license 字段记录来源
- **带宽成本** —— 长音频 / 视频流量大 · 需 OSS 计费监控
- **iOS PWA 后台播放限制** —— 比 Android 复杂 · 用户教育成本
- **跨设备进度同步** —— 多设备同时播放同一媒体 · 取最大 watchedSec（v1 简单做）

## 十四、需要时唤起

> 想开干 LessonMedia 模块时·跟我说"实施 LessonMedia v1" · 我会按"十、落地分期"v1 清单顺序开干。

> 想改决策（如音频后台播放策略 / 完成阈值等）跟我说具体哪条·我更新此文档再继续。
