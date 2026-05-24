# 观修引导功能设计方案 · 2026-05-04

> 状态：✅ 决策定型 · 暂未实施
>
> 触发场景：闻思修中"修"模块缺失 · 法本和答题已有 · 需要观修引导让初学者
> 真正落到实修。基于现有素材（导师讲解视频 + PPT + 同步字幕）做产品化包装。

---

## 一、整体定位

### 闻思修在产品中的映射

| 三学 | 行为 | 当前状态 | 计划 |
|---|---|---|---|
| 闻 | 接受教法 | 法本阅读 ✓ | — |
| 思 | 思维抉择 | 答题练习 ✓ | — |
| **修** | **实修体悟** | ❌ 缺失 | **本方案** |

### 现有素材

每课观修内容包括：
1. **观修视频**（约 30+ 分钟）· 法师讲解 + 文字滚动同步 + 自然背景画面
2. **观修 PPT** · 独立的经文/要点幻灯片（PDF）
3. **字幕** · VTT/SRT 格式

视频结构（基于 Gemini 分析的真实样本《入行论广解 187 观修》）：
- 前行（调身 → 排浊气 → 皈依发心 → 上师瑜伽）≈ 25%
- 正行（主题观修 · 随文入观）≈ 65%
- 结行（大悲心 + 回向）≈ 10%

---

## 二、核心设计思路：「视频 + 陪修层」

**不切碎视频** —— 老师录的完整观修流程保留 · 在原视频上叠加产品化的"陪修层"：

| 现有视频 | 产品需补 |
|---|---|
| ✓ 完整流程引导 | ❌ 进度可视化 · 用户不知修到哪 |
| ✓ 文字随讲解出现 | ❌ 章节跳转 · 想复修某段做不到 |
| ✓ 简短"安住片刻"留白 | ❌ 强制暂停 + 倒计时（建议加 1-2 分钟空白）|
| ✓ 同步字幕（视频内）| ❌ 同屏可滚动文字稿（visible after video pause）|
| ✓ PPT 嵌入视频 | ❌ PPT 独立可查（视频里 PPT 一闪即过）|
| ✓ 完整观修体验 | ❌ 修后反思记录 · 关掉 app 没沉淀 |

---

## 三、数据模型

```prisma
model Meditation {
  id          String   @id @default(cuid())
  lessonId    String?            // 绑定课时（null = 通用基础修）
  courseId    String?            // 仅绑定法本不绑定课时
  title       String
  titleTraditional String?
  description String?

  // 主视频
  videoUrl         String
  videoDurationSec Int

  // 章节标注（admin 在原视频时间线打点）
  chapters    Json
  /* 示例：
  [
    { "type": "video", "startSec": 0,    "endSec": 85,   "title": "调身（毗卢七法）" },
    { "type": "video", "startSec": 85,   "endSec": 180,  "title": "排浊气" },
    { "type": "video", "startSec": 180,  "endSec": 358,  "title": "皈依发心" },
    { "type": "video", "startSec": 358,  "endSec": 491,  "title": "上师瑜伽" },
    { "type": "pause", "pauseSec": 60,
      "title": "上师融心 · 安住", "prompt": "心与上师无二无别 · 安住片刻" },
    { "type": "video", "startSec": 511,  "endSec": 1361, "title": "空性观修" },
    { "type": "pause", "pauseSec": 90,
      "title": "深观如虚空", "prompt": "万法如虚空 · 寻找爱与所爱者" },
    { "type": "video", "startSec": 1361, "endSec": 2075, "title": "大悲与回向" }
  ]
  */

  // 配套素材
  slidesPdfUrl     String?       // PPT/PDF
  slidesPageCount  Int?
  transcriptVtt    String?       // 同步文字稿（VTT 格式）

  category    String             // 慈悲观 | 无常观 | 空性 | 安住 | 念诵 | 自由
  tags        String[]   @default([])

  // 元数据
  authorName    String?
  difficulty    Int        @default(1)
  isPublished   Boolean    @default(true)
  displayOrder  Int        @default(0)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  archivedAt    DateTime?

  course   Course?  @relation(fields: [courseId], references: [id], onDelete: SetNull)
  lesson   Lesson?  @relation(fields: [lessonId], references: [id], onDelete: SetNull)
  sessions MeditationSession[]

  @@index([lessonId])
  @@index([courseId])
  @@index([category])
}

model MeditationSession {
  id              String   @id @default(cuid())
  userId          String
  meditationId    String

  startedAt       DateTime @default(now())
  completedAt     DateTime?

  videoWatchedSec Int      @default(0)        // 累计观看秒数
  videoCompleted  Boolean  @default(false)    // ≥80%

  slidesViewedPages Int    @default(0)
  slidesCompleted   Boolean @default(false)

  isCompleted Boolean @default(false)         // 视频或 PPT 任一达标
  isFulfilled Boolean @default(false)         // 完成 + 写感想

  // 反思记录
  insightNotes  String?     // "本次最深的体悟"
  practiceNotes String?     // "如何在生活中践行"

  // 公开设置
  shareToClass  Boolean @default(false)       // 是否分享给班级辅导员

  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  meditation  Meditation @relation(fields: [meditationId], references: [id], onDelete: Cascade)

  @@index([userId, completedAt])
  @@index([userId, meditationId, isCompleted])
  @@index([meditationId, completedAt])
}
```

UserCourseEnrollment 新增：
```
meditationsCompleted  String[]  @default([])
```

---

## 四、用户播放页设计

### 整体布局（竖屏 / 手机优先）

```
┌──────────────────────────────────┐
│ ← 返回   入行论 187 · 空性观修      │
│                                  │
│ ┌──────────────────────────────┐ │
│ │       [原视频区]              │ │
│ │                              │ │
│ │  ▶ 12:34 / 34:35             │ │
│ └──────────────────────────────┘ │
│                                  │
│ 修行进度                  4/8 ▼  │
│ ✓ 调身                            │
│ ✓ 排浊气                          │
│ ✓ 皈依发心                        │
│ ▶ 上师瑜伽 [当前]                  │
│ ⏸ 上师融心 · 安住                  │
│ ○ 空性观修                        │
│ ⏸ 深观如虚空                      │
│ ○ 大悲与回向                      │
│                                  │
│ [视频字稿] [PPT] [章节]            │
│ ─────────────                    │
│  上一段                          │
│ ▍ 当前段（高亮 · 自动滚动）         │
│  下一段                          │
└──────────────────────────────────┘
```

### 强制暂停页（章节切换插入）

视频播到 chapter pause 节点时自动暂停 · 全屏弹出：

```
┌────────────────────────────────┐
│       📿 安住片刻               │
│                                │
│   心与上师无二无别              │
│   安住于此境界                  │
│                                │
│   ⏱  60 秒                      │
│   ━━━━━━━━━━━━━ 25 / 60         │
│   ●○○○○○○○ 呼吸节拍              │
│                                │
│   [ 跳过 ]      [ 继续 ]       │
└────────────────────────────────┘
```

倒计时结束自动继续视频 · 用户可主动跳过（记录 `pauseSkipped: true`）。

### 视频结束 → 反思页

```
┌────────────────────────────┐
│  ✓ 观修圆满                 │
│  今天修行 35 分钟           │
│                            │
│  本次最深的体悟？           │
│  ┌────────────────────────┐│
│  │                        ││
│  └────────────────────────┘│
│                            │
│  生活中如何践行？           │
│  ┌────────────────────────┐│
│  │                        ││
│  └────────────────────────┘│
│                            │
│  ☐ 分享给班级辅导员         │
│                            │
│  [ 跳过 ]    [ 提交感想 ]   │
└────────────────────────────┘
```

写感想 = `isFulfilled = true`（圆满）· 跳过 = `isCompleted = true`（完成）。

### 完成判定

```ts
isCompleted = (
  videoWatchedSec >= 0.8 * videoDurationSec
  OR
  slidesViewedPages >= slidesPageCount
)

isFulfilled = isCompleted && (insightNotes || practiceNotes)
```

---

## 五、Admin 上传与编排

### 编辑表单

```
观修内容编辑

类型 · video_with_slides
标题 · 入行论 187 · 空性观修
关联课时 · 入行论 · 第 187 课

📹 视频文件 [选择 mp4]    sokho187.mp4 · 34:35
📑 PPT 文件 [选择 pdf]    sokho187.pdf · 12 页
📝 字幕文件 [选择 vtt]    sokho187.vtt · 可选

── 章节标注 ──

[ 🤖 用 AI 标注章节（推荐）]   [ 手动添加 ]

(展开后见下文 AI 辅助流程)

── 章节列表 ──

✓ 0:00 - 1:25  调身（毗卢七法）
✓ 1:25 - 3:00  排浊气
✓ 3:00 - 5:58  皈依发心
✓ 5:58 - 8:11  上师瑜伽
⏸ 暂停 60s · 上师融心 · 安住片刻
✓ 8:31 - 22:40 空性观修
⏸ 暂停 90s · 深观如虚空
✓ 22:41 - 34:35 大悲与回向

[ + 添加章节 ]   [ + 添加暂停 ]

[ 保存草稿 ]   [ 发布 ]
```

### AI 辅助章节标注（零 API 成本方案）

利用 Gemini 免费 Web 应用做视频分析 · admin 复制粘贴 JSON 完成标注：

```
工作流：

1. admin 上传视频（同时把视频发到 YouTube · 内部账号）
2. 点 [🤖 AI 标注章节]
   弹出 prompt 模板（一键复制）+ JSON 粘贴 textarea
3. admin 切到 Gemini chat（gemini.google.com）
   粘贴 prompt + 视频 URL · 等待响应
4. 复制 Gemini 返回的 JSON
5. 回觉学 admin · 粘贴到 textarea · 点 [解析 JSON 导入]
6. 章节列表自动填充 · admin review · 微调 · 保存

时间：5-8 分钟/视频（vs 手动拖时间轴 30 分钟）
成本：零（不用 API · 用 Gemini 免费 Web 应用）
```

#### Prompt 模板（前端写死字符串）

```
请分析这个佛教观修视频，严格按以下 JSON 输出（不要任何额外文字）：

{
  "title": "视频标题",
  "totalDurationSec": 视频总秒数,
  "chapters": [
    {"type": "video", "startSec": 0, "endSec": 85, "title": "章节标题"},
    {"type": "pause", "afterTitle": "上一章节名", "pauseSec": 60, "prompt": "引导文"}
  ]
}

要求：
- 按"前行/正行/结行"传统结构识别章节边界
- title 简洁 4-8 字
- 在适合静修的转换处建议插入 type=pause 节点（pauseSec 60-90）
- pause prompt 用 10-20 字描述应观修的内容

视频：[此处替换为 URL]
```

#### JSON 解析容错

- 自动找首个 `{...}` 抓 JSON · 忽略前后噪音
- 时间码超出视频长度时给警告（不直接崩）
- pause 节点 `afterTitle` 找不到对应 video chapter → warning · 让 admin 手动选位置

---

## 六、内容齐全适配机制

并非每课都有答题/观修 · UI 自适应：

### Lesson Capability 推断

```ts
interface LessonCapability {
  hasReading: boolean;      // referenceText 不空
  hasQuestions: boolean;    // questions 表存在该 lessonId
  hasMeditation: boolean;   // meditations 表存在该 lessonId
}
```

运行时 query 派生 · 不存字段。

### 阅读页底部 action bar 自适应

| 本课内容 | 底部按钮 |
|---|---|
| 仅阅读 | `[上一课] [完成本课 →] [下一课]` |
| 阅读+答题 | `[上一课] [开始答题] [下一课]` |
| 阅读+观修 | `[上一课] [🧘 观修] [下一课]` |
| 阅读+答题+观修 | `[上一课] [答题] [观修] [下一课]` |

### 完成判定按可用内容算

```ts
function isLessonCompleted(lesson, userProgress) {
  const required = [];
  if (lesson.hasReading)    required.push(userProgress.read);
  if (lesson.hasQuestions)  required.push(userProgress.quizPassed);
  if (lesson.hasMeditation) required.push(userProgress.meditationDone);
  return required.length > 0 && required.every(Boolean);
}
```

### 法本元信息披露

法本详情页 hero 区下方：
```
《入菩萨行论》
寂天菩萨 · 索达吉堪布 译

📖 187 课 · 📝 142 课有答题 · 🧘 28 课有观修
```

让用户提前知道法本配套深度。

### Admin 内容覆盖率 dashboard

`/admin/courses` 列表加列：
```
法本                  课数  答题覆盖   观修覆盖
入菩萨行论            187   142/187    28/187
                            76%        15%
```

---

## 七、用户触点 / 入口位置

### 6 大入口

| 入口 | 位置 | 触发条件 |
|---|---|---|
| **A** ⭐ | 阅读页底部 [🧘观修] 按钮 | 本课有观修 |
| **B** ⭐⭐ | 答题完成页 primary 推荐"现在去观修" | 本课有观修 |
| **C** | 法本目录 课时下方 🧘 子项（方案 B 折叠样式）| 本课有观修 |
| **D** | 复习页「修学」区 顶部"今日观修"卡 | 总是 |
| **E** | 首页"今日观修" section | 仅有未完成观修时 |
| **F** | 班级页 "本周观修" 卡（辅导员推送）| 已加入班级 |

### 4 类提醒机制

| 提醒类型 | 触发 | 默认 |
|---|---|---|
| 学完即修 | 答题完成页 primary 推荐 | 总是显示 |
| 用户自设晨修/晚修 | 用户在 `/settings → 提醒` 配置时间 | 默认关 |
| 长期未修温和 banner | 连续 3 天打开 app 但没观修 | 默认开 · 一次性 |
| 班级共修日通知 | 辅导员在班级设"本周共修日" | 默认开 |

**绝对不做**：
- ❌ 高频系统通知（修行需要安静）
- ❌ 弹窗 / Modal 强推

---

## 八、法本目录 · 折叠设计（方案 B）

### 整体规则

```
✓ 章节折叠/展开（多展开模式 · 用户可同时打开多章）
✓ 自动展开「当前学习章节」
✓ 章节折叠时显示 课数/总数 + 完成度百分比
✓ 顶部按钮 [全部折叠]
✓ 章节内显示 lesson 多行展开（📖 / 📝 / 🧘）
✓ 进入页面自动滚动到当前章节
✓ session 内记忆用户手动展开的章节（离开重置回 auto）
✓ 新用户默认展开前 2 章
```

### 视觉

```
[ 全部折叠 ]                              ← 顶部 toggle

▶ 第 1 章 · 菩提心利益品              5/12 · 60%
  ↑ chevron                            ↑ 进度

▼ 第 2 章 · 持戒品                              ← 当前章节自动展开
   ──────────────────
   第 1 课 · 起源
     📖 文章 · 12 分钟       ✓     >
     📝 答题 · 12 题         8/12  >
     🧘 观修 · 12 分钟       ✓     >

   第 2 课 · 戒律
     📖 文章 · 8 分钟        ─     >

   第 3 课 · ...
   ──────────────────

▶ 第 3 章 · 安忍品                    0/8 · 0%
▶ 第 4 章 · ...
```

### 「当前章节」判定算法

复用现有"继续阅读"逻辑：

```ts
function getCurrentChapter(course, enrollment) {
  // 优先级：
  // 1. enrollment.currentLessonId 所在章节（用户上次学的位置）
  // 2. 第一个未完成 lesson 所在章节
  // 3. 第 1 章（兜底，新用户）
}
```

### 状态记忆策略

- **默认 auto**：每次进入页面自动展开当前章节
- **session 记忆**：用户手动展开/折叠在本次 session 内有效
- **离开重置**：跳出页面再回来 → 重新 auto，不持久化用户操作

### 滚动定位

```ts
useEffect(() => {
  const currentChapter = chapters.find(c => c.id === currentChapterId);
  if (currentChapter) {
    document.querySelector(`#chapter-${currentChapter.id}`)
      ?.scrollIntoView({ block: 'start' });
  }
}, []);  // 仅 mount 触发
```

### 新用户特殊处理

- `enrollment.currentLessonId === null`（从未开始）→ 展开**前 2 章**
- 让初学者感受法本厚度，不会因为只展开第 1 章而误判内容少

---

## 九、辅导员端 · 班级观修情况

### 班级页加 [🧘 观修] tab

`/coach/classes/:id/meditations`

```
[班级信息] [成员] [📥 待审核] [🧘 观修]   ← 新 tab

班级观修情况

法本: 大圆满前行 · 共 12 课 · 9 课有观修

按课时矩阵
                第1课  第2课  第3课  第4课  ...
学员 A          ✓      ✓      ✓      ✓
学员 B          ✓      ✓      ✗      ─
学员 C          ✓      ─      ─      ─
学员 D          ─      ─      ─      ─

✓ = 完成 · ─ = 未观修 · ✗ = 部分观看（< 80%）

完成率
第1课  ███████████░ 89%
第2课  █████░░░░░░░ 42%
...
```

### 单学员 drill-down

点矩阵某格 → 该学员某课观修详情：
```
学员 A · 大圆满前行 · 第 3 课
死亡观（导师讲）

观修历史
2026-05-04 18:30  完成 12/12 分钟  ✓  圆满
2026-04-28 09:15  完成 8/12 分钟   ✗  未圆满
2026-04-20 14:22  完成 12/12 分钟  ✓  圆满

总累计：32 分钟 · 3 次

修后感想（仅显示 shareToClass=true 的）
"对死亡有了新的认识，..."（2026-05-04）
"今天观察自己每一念..."（2026-04-20）
```

### 班级观修日报（辅导员首页置顶）

```
🧘 今日班级观修 · 5 月 4 日
12 名同学 · 5 人已观修 · 7 人未修

[ 提醒未修同学 ]   [ 查看详情 → ]
```

"提醒未修同学" → 一键发站内信。

---

## 十、落地分期

### Phase 1 · MVP 闭环 (3-4 天)

**目标**：让用户能完整走通"闻 → 思 → 修"流程。

1. Prisma：Meditation + MeditationSession 表（含 chapters JSON）
2. Admin：观修内容 CRUD（type=video_with_slides 一种）
   - 视频上传
   - PDF 上传
   - VTT 字幕上传（可选）
   - 章节标注（手动模式 · AI 辅助下个 phase 加）
3. 学生端 `/meditation/:id` 详情页 + `/meditation/:id/play` 播放页
4. 播放页：视频 + 章节列表 + 章节切换 + 强制暂停 + 反思页
5. 课时阅读页底部 [🧘 观修] 入口（自适应）
6. 答题完成页 primary 推荐观修
7. 法本目录 课时下方 🧘 子项（lesson capability）

### Phase 2 · AI 辅助 + 法本目录 (2 天)

8. AI 辅助章节标注（Gemini chat → JSON paste 流程）
9. 法本目录折叠改造（方案 B + 自动展开当前章）
10. 法本元信息披露（顶部章数/答题/观修覆盖）

### Phase 3 · 辅导员端 + 班级共修 (2 天)

11. 班级 [🧘 观修] tab + 矩阵视图
12. 单学员 drill-down + 修后感想查看
13. 班级观修日报卡（辅导员首页）
14. 辅导员"本周观修"推送（班级页面）

### Phase 4 · 体验完善 (按需)

15. 字幕同步滚动（VTT 解析 + timeupdate 高亮）
16. 视频 + PPT 时间戳同步翻页
17. 视频 HLS 多码率
18. 用户自设晨修/晚修提醒
19. 长期未修温和 banner
20. 学习统计页观修维度
21. 观修类成就徽章

### Phase 5 · 内容扩展（远期）

- type=text 文字引导
- type=analytical 思维引导（带反思输入）
- type=timer 静修计时器
- type=scenario 主题观修（慈悲观/无常观系列）
- 通用基础观修库（独立于法本）

---

## 十一、技术风险点

1. **视频文件大小**
   - 34 分钟 720p mp4 ≈ 100MB
   - 100 个观修 ≈ 10GB · 服务器可承受
   - 上量后再迁 CDN（阿里云 VOD / 腾讯云）

2. **视频转码**
   - 后端用 ffmpeg 转 HLS（多码率）
   - 异步处理 · 上传后通知 admin 转码完成

3. **PDF 转 webp 页**
   - 用 pdf2pic / pdftoppm
   - 多分辨率（320 / 640 / 1024）
   - 前端按页加载

4. **Capacitor 原生 app 后台播放**
   - iOS audio 锁屏播放需配置 background-mode capability

5. **跨设备 session 同步**
   - 用户 PWA + 原生 app 切换
   - watchedSec 定时上报（每 10s + 离开页面 final）

---

## 十二、决策定型清单

| # | 决策项 | 值 |
|---|---|---|
| 1 | 视频不切碎 · 在原视频叠加陪修层 | ✓ |
| 2 | 章节标注用 Gemini Web 应用（非 API）| ✓ |
| 3 | 强制暂停时长 | 60-90s · 用户可调 30/60/120 |
| 4 | 暂停可跳过 · 但记录"未完整观修" | ✓ |
| 5 | 修后感想选填（写=圆满 · 跳过=完成）| ✓ |
| 6 | 修中途退出记录断点 · 下次接续 | ✓ |
| 7 | 法本目录用方案 B（多行展开）| ✓ |
| 8 | 自动展开当前章节 + session 记忆 | ✓ |
| 9 | 新用户默认展开前 2 章 | ✓ |
| 10 | 章节折叠时显示进度（X/Y · %）| ✓ |
| 11 | 答题完成 primary 推荐观修 | ✓ |
| 12 | 系统 push 通知默认关 | ✓ |
| 13 | 班级共修日通知默认开 | ✓ |
| 14 | 修后感想默认私密 · 用户可选分享班级 | ✓ |
| 15 | 班级观修矩阵 · 单学员 drill-down | ✓ |
| 16 | Phase 1 内容覆盖：阅读页入口 + 答题完成推荐 + 法本目录子项 | ✓ |

---

## 十三、需要时唤起

实施时告诉我：「**开始 Phase 1 观修引导**」。

如果想要更紧凑的版本，可以先做核心 4 件事（约 2 天）：
1. Meditation 数据模型
2. Admin 上传 + 手动章节标注
3. 用户播放页（视频 + 章节 + 暂停 + 反思）
4. 阅读页底部入口 + 法本目录 🧘 子项
