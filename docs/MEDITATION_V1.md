# 觉学观修引导 v1.0 实施方案 · 2026-05-04

> 状态：✅ 决策定型 · 准备启动
>
> 目标：在闻思修三柱中补齐"修"模块 · 提供视频 + PPT 观修引导 + 班级共修排行
>
> **本文档是 v1.0 实施 spec · 长远设计见 `docs/MEDITATION_PLAN.md`**

---

## 一、v1.0 范围（最小可用集）

### 包含
- ✅ Admin 上传视频（mp4）+ PPT（pdf）
- ✅ 学员播放视频 + 查看 PPT
- ✅ 完成记录（视频 ≥ 80% 自动标完成）
- ✅ 课时阅读页底部 [🧘 观修] 入口
- ✅ 法本目录方案 B（多行 sub-items + 章节级折叠）
- ✅ 班级观修排行榜（极简 · 仅次数 · 月度）
- ✅ OSS 独立服务器架构（129.213.64.152）
- ✅ 用户隐私开关（量化数据对班级是否可见）

### 不做（留 v2+）
- 章节标注 / 时间轴拖动 / AI 辅助
- 强制暂停 + 引导文
- 反思感想填写
- 字幕同步滚动
- 三阶段 UX
- 班级共修推送通知
- 辅导员观修矩阵
- 沉浸 / 勿扰模式
- 多时间维度（仅本月）/ 多排序维度（仅次数）

---

## 二、OSS 架构

### 主服务器 vs OSS 服务器分工

```
┌──────────────────────────────────────────────────┐
│  主服务器                                         │
│  ~/projects/juexue/                              │
│   ├─ backend/    Node.js + Fastify · 3001       │
│   ├─ juexue-v2/  React 前端                     │
│   └─ Postgres                                    │
│                                                  │
│  域名：juexue.caughtalert.com                   │
│  职责：API + 业务 + DB · 不存视频                │
└────────────────┬─────────────────────────────────┘
                 │
                 │ Admin 上传 → /tmp 暂存 → ffmpeg 修复 → scp
                 ↓
┌──────────────────────────────────────────────────┐
│  OSS 服务器（129.213.64.152）                    │
│  ~/oss-uploads/meditations/                      │
│       ├─ videos/  <id>.mp4                       │
│       └─ slides/  <id>.pdf                       │
│                                                  │
│  域名：media.juexue.caughtalert.com              │
│  Cloudflare 代理（橙云）→ 全球 CDN + SSL         │
│  职责：仅 serve 静态文件 · nginx                 │
└──────────────────────────────────────────────────┘
                 ↑
                 │ 用户播放
            用户浏览器
```

### 关键决策

| 项目 | 值 |
|---|---|
| OSS 服务器 | 129.213.64.152（Oracle Cloud Always Free）|
| 公开域名 | media.juexue.caughtalert.com |
| DNS 代理 | **Cloudflare 橙云**（免费 CDN + SSL）|
| 上传方式 | 主 backend → scp → OSS |
| 文件路径 | `/oss-uploads/meditations/{videos,slides}/{id}.{ext}` |
| 容量预期 | v1 用 ~7GB / 上限 40GB · 200 个视频内 |
| 触发迁 R2 | 磁盘 >35GB · 月流量 >8TB · 用户 DAU >1000 |

---

## 三、数据模型

### Meditation（观修内容）

```prisma
model Meditation {
  id          String   @id @default(cuid())
  lessonId    String?           // 关联课时（可空）
  courseId    String?           // 关联法本

  title       String
  description String?

  videoUrl         String                 // https://media.../videos/xx.mp4
  videoDurationSec Int

  slidesPdfUrl     String?

  // v2 预留字段（v1 不读不写 · 建表时一起加避免后续迁库）
  chapters         Json?
  transcriptVtt    String?

  isPublished Boolean  @default(true)
  displayOrder Int     @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  archivedAt  DateTime?

  course   Course?  @relation(fields: [courseId], references: [id], onDelete: SetNull)
  lesson   Lesson?  @relation(fields: [lessonId], references: [id], onDelete: SetNull)
  sessions MeditationSession[]

  @@index([lessonId])
  @@index([courseId])
}
```

### MeditationSession（用户观修记录）

```prisma
model MeditationSession {
  id              String   @id @default(cuid())
  userId          String
  meditationId    String

  startedAt       DateTime @default(now())
  completedAt     DateTime?

  videoWatchedSec Int      @default(0)
  isCompleted     Boolean  @default(false)    // ≥80%

  // v2 预留字段（v1 不用）
  insightNotes    String?
  practiceNotes   String?
  shareScope      String   @default("self")

  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  meditation  Meditation @relation(fields: [meditationId], references: [id], onDelete: Cascade)

  @@index([userId, meditationId])
  @@index([userId, completedAt])
  @@index([completedAt])
  @@index([meditationId, completedAt])
}
```

### User 表新增

```prisma
model User {
  ...
  meditationVisibleToClass Boolean @default(true)
  // 默认对班级同学/辅导员/管理员可见量化数据
  // settings 关闭 → 排行隐藏自己
}
```

### UserCourseEnrollment 新增

```prisma
model UserCourseEnrollment {
  ...
  meditationsCompleted  String[]  @default([])
}
```

---

## 四、API 设计

### 学员端

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/lessons/:id/meditation` | 拉本课观修（如有）|
| GET | `/api/meditations/:id` | 观修详情 + 我的进度 |
| POST | `/api/meditations/:id/sessions` | 开始 session |
| PATCH | `/api/meditations/:id/sessions/:sid` | 上报进度 `{ videoWatchedSec }` |
| POST | `/api/meditations/:id/complete` | 手动标完成 |
| GET | `/api/classes/:id/meditation-ranking?period=month` | 班级排行 |
| PATCH | `/api/my/profile` | 加 `meditationVisibleToClass` 字段 |

### Admin 端

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/admin/meditations` | 列表 |
| POST | `/api/admin/meditations` | 新建（仅元数据）|
| PATCH | `/api/admin/meditations/:id` | 编辑 |
| DELETE | `/api/admin/meditations/:id` | 归档 |
| POST | `/api/admin/meditations/:id/upload-video` | 上传视频 |
| POST | `/api/admin/meditations/:id/upload-slides` | 上传 PDF |

---

## 五、学员端 UI

### A. 法本目录 · 方案 B（多行 sub-items）

**章节级折叠规则**：
- 学过 → 仅展开当前章节
- 没学过 → 展开前 2 章
- 用户手动展开 → session 内记忆 · 离开重置

**当前章节判定**：
- enrollment.currentLessonId 所在章节（用户上次学的）
- 否则第一个未完成 lesson 所在章节
- 兜底 → 第 1 章

**视觉**：

```
[← 返回] 入行论目录

▶ 第 1 章 · 论名礼敬           5/12 · ✓60%
   ↑ chevron · 章名 · 进度

▼ 第 2 章 · 菩提心利益品 [当前]              ← 自动展开
   ───────────────────────
   第 1 课 · 起源
     📖 文章 · 12 分钟        ✓     >
     📝 答题 · 12 题          8/12  >
     🧘 观修 · 35 分钟        ✓     >

   第 2 课 · 戒律
     📖 文章 · 8 分钟         ─     >
                                       ← 没答题 · 没观修 直接不显示该行
   第 3 课 · 自他相换
     📖 文章 · 15 分钟        ─     >
     🧘 观修 · 18 分钟        ─     >
   ───────────────────────

▶ 第 3 章 · 受持菩提心          0/24
▶ 第 4 章 · ...
▶ 第 5 章 · ...
```

**关键规则**：
- 每 lesson 显示 1-3 行 sub-items（按 capability）
- 没有的内容直接不显示行（不显示"暂无答题"灰态）
- sub-item 独立可点 · 跳对应页面：
  - 📖 → 阅读页
  - 📝 → 答题页
  - 🧘 → 观修播放页
- 章节标题点击 → 折叠/展开
- 进入页面自动滚动到当前章节

### B. 课时阅读页底部入口

```
┌──────────────────────────┐
│  [文章正文]              │
│                          │
│  ──────────              │
│  [上一课] [开始答题] [🧘 观修] [下一课]
│                            ↑
│                       本课有观修才显示
└──────────────────────────┘
```

按 capability 自适应：
- 仅阅读 → `[上一课] [完成本课 →] [下一课]`
- 阅读+答题 → `[上一课] [开始答题] [下一课]`
- 阅读+观修 → `[上一课] [🧘 观修] [下一课]`
- 阅读+答题+观修 → `[上一课] [答题] [观修] [下一课]`

### C. 观修播放页 `/meditation/:id`

```
┌──────────────────────────┐
│ ← 返回                    │
│ 入行论 187 · 空性观修     │
│                          │
│  ┌──────────────────┐    │
│  │   [视频]          │    │
│  │   ▶ 12:34/34:35   │    │
│  └──────────────────┘    │
│                          │
│ [视频]  [PPT]             │ ← tab 切换
│                          │
│ (默认视频 tab)            │
│ 标题 + 描述               │
│                          │
│ (PPT tab · 切换时视频暂停) │
│ ┌──────────────────┐     │
│ │   PDF iframe      │     │
│ │   < 5/12 >        │     │
│ └──────────────────┘     │
│                          │
│ [ 完成观修 ✓ ]            │ ← 备用手动标完成按钮
└──────────────────────────┘
```

**关键交互**：
- HTML5 `<video>` + `controls` 原生播放器
- `playsInline` 不强制全屏
- 每 10 秒上报 watchedSec 到后端
- 视频 ≥ 80% 自动标完成
- 切到 PPT tab 自动暂停视频
- 手动 [完成观修 ✓] 按钮兜底

### D. 班级页 · 观修排行 section

班级页加排行 section（不另开 tab）：

```
🎓 大圆满前行精进班
张老师 · 12 名同修

📿 本月观修排行                      [完整 →]
─────────────────────
🥇 学员 A         12 次
🥈 学员 B          8 次
🥉 学员 C          7 次
   ─────
   你（第 5 名）   5 次
─────────────────────
```

简版只显示前 3 + 自己位置。

### E. 完整排行页 `/class/:id/meditations`

```
[← 返回]   班级修学

[ 本月 ]

📿 观修排行
─────────────────────
🥇 学员 A         12 次 · 145 分钟
🥈 学员 B          8 次 ·  98 分钟
🥉 学员 C          7 次 ·  84 分钟
   学员 D          6 次 ·  72 分钟
   你（第 5 名）   5 次 ·  60 分钟    ← 自己高亮
   学员 F          4 次 ·  48 分钟
   ...
```

### F. 用户隐私设置

`/settings → 隐私`

```
观修可见性
☑ 让班级同学看到我的观修记录（次数 / 时长）
   关闭后：所有班级排行不再显示你
```

---

## 六、Admin 端 UI

### 列表页 `/admin/meditations`

```
[Admin → 观修管理]

[ + 新建观修 ]   [ 搜索 ]

观修列表
─────────────────────────
入行论 187 · 空性观修
   关联：入行论 · 第 3 品 第 5 课
   视频：✓ 35 分钟 · PDF：✓ 12 页
   已发布 · [ 编辑 ] [ 归档 ]
```

### 编辑页

```
观修内容编辑

关联课时 · [入行论 · 第 3 品 第 5 课 ▼]   (可选 "无")

标题 · 入行论 187 · 空性观修
描述 · (可选)

📹 视频文件
[ 选择 mp4 文件 ]
   sokho187.mp4 · 35:00 · 已上传到 OSS

📑 PDF 文件
[ 选择 pdf 文件 ]
   sokho187.pdf · 已上传

发布状态 · [☑ 已发布]

[ 保存 ]   [ 取消 ]
```

---

## 七、Backend 核心代码

### `backend/src/lib/oss.ts`

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

const OSS_HOST = process.env.OSS_HOST!;
const OSS_KEY = process.env.OSS_SSH_KEY!;
const OSS_DIR = process.env.OSS_REMOTE_DIR!;
const OSS_URL = process.env.OSS_PUBLIC_URL!;

export async function uploadToOss(localPath: string, ossKey: string): Promise<string> {
  const remotePath = `${OSS_DIR}/${ossKey}`;
  const remoteDir = path.posix.dirname(remotePath);

  await execFileAsync('ssh', [
    '-i', OSS_KEY,
    '-o', 'StrictHostKeyChecking=accept-new',
    OSS_HOST,
    `mkdir -p ${remoteDir}`,
  ]);

  await execFileAsync('scp', [
    '-i', OSS_KEY,
    '-o', 'StrictHostKeyChecking=accept-new',
    localPath,
    `${OSS_HOST}:${remotePath}`,
  ]);

  return `${OSS_URL}/${ossKey}`;
}

export async function deleteFromOss(ossKey: string): Promise<void> {
  await execFileAsync('ssh', [
    '-i', OSS_KEY,
    OSS_HOST,
    `rm -f ${OSS_DIR}/${ossKey}`,
  ]);
}
```

### Admin 视频上传 endpoint

```typescript
app.post('/api/admin/meditations/:id/upload-video', { preHandler: requireAdmin }, async (req) => {
  const { id } = req.params as { id: string };
  const file = await req.file();
  if (!file) throw BadRequest('no file');
  if (!file.filename.endsWith('.mp4')) throw BadRequest('mp4 only');

  const tempPath = `/tmp/${id}-input.mp4`;
  const fixedPath = `/tmp/${id}-fixed.mp4`;

  await pipeline(file.file, fs.createWriteStream(tempPath));

  await execFileAsync('ffmpeg', [
    '-i', tempPath, '-c', 'copy', '-movflags', '+faststart', fixedPath,
  ]);

  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    fixedPath,
  ]);
  const durationSec = Math.floor(parseFloat(stdout));

  const ossKey = `meditations/videos/${id}.mp4`;
  const url = await uploadToOss(fixedPath, ossKey);

  await fs.unlink(tempPath);
  await fs.unlink(fixedPath);

  await prisma.meditation.update({
    where: { id },
    data: { videoUrl: url, videoDurationSec: durationSec },
  });

  return { ok: true, url, durationSec };
});
```

### 班级排行查询（含 5 分钟缓存）

```typescript
app.get('/api/classes/:id/meditation-ranking', async (req) => {
  const { id } = req.params as { id: string };
  const period = (req.query as any).period ?? 'month';

  const cacheKey = `class:${id}:meditation-ranking:${period}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const monthStart = startOfMonth(new Date());

  const ranking = await prisma.$queryRaw`
    SELECT
      cm.user_id,
      u.dharma_name,
      COUNT(ms.id)::int AS cnt,
      COALESCE(SUM(ms.video_watched_sec), 0)::int AS total_sec
    FROM class_members cm
    LEFT JOIN meditation_sessions ms
      ON ms.user_id = cm.user_id
      AND ms.is_completed = true
      AND ms.completed_at >= ${monthStart}
    JOIN users u ON u.id = cm.user_id
    WHERE cm.class_id = ${id}
      AND u.meditation_visible_to_class = true
    GROUP BY cm.user_id, u.dharma_name
    ORDER BY cnt DESC, total_sec DESC
  `;

  await cache.set(cacheKey, ranking, 300);
  return ranking;
});
```

---

## 八、OSS 服务器部署清单

### A. DNS（你做 · 5 分钟）

Cloudflare 加：
```
媒体子域名：media.juexue.caughtalert.com
A 记录 → 129.213.64.152
代理状态：☑ 橙云（已代理）
```

### B. OSS 服务器准备（30 分钟）

```bash
ssh ubuntu@129.213.64.152

sudo apt update
sudo apt install -y nginx fail2ban

mkdir -p ~/oss-uploads/meditations/videos
mkdir -p ~/oss-uploads/meditations/slides
chmod -R 755 ~/oss-uploads

# nginx config（详见上文 Part 八）
sudo nano /etc/nginx/sites-available/media.juexue.caughtalert.com
sudo ln -s /etc/nginx/sites-available/media.juexue.caughtalert.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 安全
sudo nano /etc/ssh/sshd_config
# PasswordAuthentication no · PermitRootLogin no
sudo systemctl restart sshd
sudo systemctl enable --now fail2ban
```

### C. SSH key（10 分钟）

主服务器：
```bash
ssh-keygen -t ed25519 -f ~/.ssh/juexue-oss -N ''
ssh-copy-id -i ~/.ssh/juexue-oss.pub ubuntu@129.213.64.152
ssh -i ~/.ssh/juexue-oss ubuntu@129.213.64.152 'echo OK'
```

主 backend `.env`：
```env
OSS_HOST=ubuntu@129.213.64.152
OSS_SSH_KEY=/home/ubuntu/.ssh/juexue-oss
OSS_REMOTE_DIR=/home/ubuntu/oss-uploads
OSS_PUBLIC_URL=https://media.juexue.caughtalert.com
```

### D. 主服务器装 ffmpeg

```bash
sudo apt install -y ffmpeg
ffmpeg -version
ffprobe -version
```

### E. 验证

```bash
echo "Hello OSS" > ~/oss-uploads/test.txt
curl https://media.juexue.caughtalert.com/test.txt
# 期待：Hello OSS
rm ~/oss-uploads/test.txt
```

---

## 九、落地计划（5-6 天）

### Day 1 · 基础设施 + 数据模型（半天）

**OSS 服务器**：
- [ ] DNS 加 media.juexue.caughtalert.com（Cloudflare 橙云）
- [ ] SSH 上 129 装 nginx · 配 OSS 目录
- [ ] 主 backend 加 ssh key · 配 .env
- [ ] 联调测试上传 / 访问

**Backend**：
- [ ] Prisma schema 加 Meditation + MeditationSession + User 字段
- [ ] 跑 `prisma db push`
- [ ] 主服务器装 ffmpeg

### Day 2 · Backend API（一天）

- [ ] `lib/oss.ts` upload / delete 函数
- [ ] 学员端 7 个 endpoints
- [ ] Admin 端 CRUD + 上传 endpoints
- [ ] 班级排行 endpoint（含 5 分钟缓存）
- [ ] Capability hook（lesson hasMeditation 判定）

### Day 3 · 学员端 UI · 目录 + 阅读页（一天）

- [ ] ScriptureDetailPage 改造为方案 B 多行 sub-items
- [ ] 章节级折叠：当前章自动展开 / 新用户前 2 章 / session 记忆
- [ ] 课时目录 lesson 显示 📖 / 📝 / 🧘 多行
- [ ] sub-item 独立可点跳转
- [ ] ReadingPage 底部 [🧘 观修] button（自适应）

### Day 4 · 学员端 UI · 播放页 + 班级（一天）

- [ ] /meditation/:id 详情 + 播放页
- [ ] 视频 + PPT 两 tab
- [ ] 进度上报（每 10s 一次）
- [ ] 完成判定（≥80% 自动 + 手动按钮）
- [ ] 班级页加排行 section
- [ ] /class/:id/meditations 完整排行页
- [ ] settings 加 meditationVisibleToClass 开关

### Day 5 · Admin 端 + 联调（半天）

- [ ] /admin/meditations 列表页
- [ ] Admin 编辑表单
- [ ] 视频 / PDF 上传 UI（含进度条）
- [ ] 集成测试：上传 demo 视频 → 学员看播放 → 排行更新

### Day 6 · 部署 + 真实 demo（半天）

- [ ] 部署到生产
- [ ] Admin 上传《入行论 187 · 空性观修》真实视频 + PDF
- [ ] 走端到端流程：阅读 → 答题 → 观修 → 完成
- [ ] 班级排行验证刷新
- [ ] bug 修复 + 文档更新

**总工时：约 5-6 天**

---

## 十、风险评估

| 风险 | 缓解 |
|---|---|
| OSS 服务器 45GB 满 | 监控磁盘 · 200 视频内安全 · 之后迁 R2（1 天工作）|
| 跨太平洋台湾用户慢 | Cloudflare 橙云 CDN 自动加速 |
| Oracle 改 Always Free 政策 | 数据可迁 R2 · DB 字段不变只换 URL |
| 大视频上传超时 | 主服务器 limit 500MB · 提示 admin 预压缩 |
| ffmpeg 转码失败 | error log + 不影响其他 · admin 重传 |
| 视频流量挤主 backend | 已隔离 · OSS 服务器独立处理流量 |
| scp 上传失败 | retry 机制 + admin 错误提示 |

---

## 十一、决策定型清单

| # | 决策项 | v1.0 值 |
|---|---|---|
| 1 | 视频存储 | OSS 服务器 129.213.64.152 |
| 2 | OSS 域名 | media.juexue.caughtalert.com（Cloudflare 橙云）|
| 3 | 数据传输 | scp · ssh key 鉴权 |
| 4 | 视频格式 | mp4 H.264 · ffmpeg faststart 修复 |
| 5 | PPT 格式 | PDF · 浏览器原生 iframe |
| 6 | 完成判定 | 视频 ≥ 80% 自动 · 或手动标完成 |
| 7 | 必修 / 选修 | 选修（lesson 完成不要求修 · 修了 = 圆满）|
| 8 | 法本目录展示 | **方案 B** 多行 sub-items |
| 9 | 章节折叠规则 | 当前章自动展开 / 新用户前 2 章 / session 记忆 |
| 10 | 排行维度 | 月度 · 次数（仅）|
| 11 | 班级可见性 | 默认开 · settings 可关 |
| 12 | 反思 / 章节 / 暂停 | v2 加 · 数据模型预留字段 |
| 13 | 视频文件大小 | limit 500MB · admin 预压缩 |
| 14 | 进度上报 | 每 10s 一次 |
| 15 | 排行缓存 | 5 分钟 |

---

## 十二、启动前 checklist

实施前需要确认：

- [ ] 已有视频 + PDF demo 内容（先准备 1-2 节真实素材作 demo）
- [ ] DNS 管理权限（Cloudflare 加 media.juexue.caughtalert.com）
- [ ] OSS 服务器（129）SSH 访问 OK
- [ ] 主 backend 服务器准备 + .env 待加变量

确认 checklist 全 OK 即可启动 Day 1。

---

## 十三、唤起命令

实施时告诉我：「**开始 Day 1 观修 v1**」即可。
