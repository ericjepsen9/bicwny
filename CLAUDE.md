# 觉学 · Claude 工作守则

> 这份守则是从我（Claude）反复犯的错里总结出来的工作流。每次新会话开始前，先读这份。

## 项目概况

- 前端：`juexue-v2/`（React + Vite + TypeScript · React Query · React Router）
- 后端：`backend/`（Fastify + Prisma + PostgreSQL · Zod schema 校验）
- OSS：独立服务器（129.213.64.152）跑 nginx 静态服务 · 通过 ssh + scp 投递视频
- 部署：主后端服务器（instance-20260213-1230）跑 backend + nginx 反代前端
- 域名：`juexue.caughtalert.com`（前端在 `/app/` 路径）· `media.juexue.caughtalert.com`（OSS）

## 生产服务器路径 / 进程名（别再问用户）

| 用途 | 值 |
|---|---|
| 项目根目录 | `/home/ubuntu/projects/juexue` |
| 后端 PM2 进程名 | **`juexue-api`** · `pm2 reload juexue-api` 重启 |
| 前端静态目录（nginx 指向） | `/var/www/juexue/app/` |
| 数据库 | PostgreSQL · `localhost:5433` · db 名 `juexue` |
| 默认登录用户 | `ubuntu` |
| 服务器主机名 | `instance-20260213-1230` |

### 一键部署流程（拷给用户跑）

```bash
# 1. 拉代码
cd /home/ubuntu/projects/juexue
git pull origin <branch>

# 2. 后端 · 仅在 schema 或后端代码变动时跑
cd backend
npx prisma generate
npx prisma db push          # 非破坏式 · 不删字段不丢数据
npm run build
pm2 reload juexue-api

# 3. 前端 · 任何 juexue-v2/ 文件改动都要跑
cd ../juexue-v2
rm -rf dist/                # 清旧 build · 防 vite 增量缓存
npm run build
sudo rsync -av --delete dist/ /var/www/juexue/app/

# 4. 浏览器强刷（iOS Safari 长按"刷新" · 或换无痕窗口）
```

## 三端分离铁律（学员 / 辅导员 / admin）

- **学员端** (`/`、`/class/:id`、`/profile` 等)：**纯消费视图** · 即便辅导员或 admin 登入也看不到管理操作
- **辅导员端** (`/coach/*`)：辅导员管理自己的班 · 学员被路由守卫挡掉
- **admin 后台** (`/admin/*`)：管理员管理平台 · 限 admin role

**规则**：不管谁登进学员端 · 看到的 UI 都和普通学员一致。想管理 → 切到 `/coach/*` 或 `/admin/*`。

栽过的事故：曾在 ClassDetailPage 加"+ 去发布" / "+ 下达任务" / 辅导员快捷区 · 给 admin 看到了。后来全部清除（commit `1507921`）。**新增任何 section 前先问自己：这个按钮该出现在学员端吗？**

## 关键规则

### 提交前自检（按顺序跑 · 不要跳）

```bash
cd juexue-v2
npm run typecheck   # tsc · 必须 0 errors
npm run lint        # eslint · 必须 0 errors（warnings 不阻塞）
npm run build       # vite · 验证 bundle 能产出
```

后端动了：
```bash
cd backend
npm run build       # tsc · 必须干净
```

**这三步全过才能 git commit。** 不要靠 `tsc --noEmit` 单一信号 · 我栽过：tsc 过 lint 报错（hooks 顺序）。

### 视觉改动协议

做 UI / CSS / 布局改动**前**：
1. 用文字描述新布局给用户：哪里加什么 · 哪里删什么 · 状态机怎么走
2. 等用户「OK」/ 调整意见
3. 实现 · 单元小步提交
4. 部署或让用户 dev mode 验

**反例**（不要做）：直接重写整个组件 · 提交后用户说「不对 · 阅读按钮要保留」· 一半工作白做。

### 触雷必查 `docs/CSS-GOTCHAS.md`

每次写：
- `position: fixed` → 查 1（祖先 transform 问题 · 用 createPortal）
- `objectFit` / `<picture>` → 查 2、3（picture 要 display block · cover/contain 三选一）
- 上传 / 表单 → 查 4（zod nullable + optional）
- 数据 invalidate → 查 5（前缀匹配 · 不重复调）
- Dialog → 查 7（桌面用 centered variant）
- 新 API hook / 改后端 zod → 查 10（前后端值域不对齐 · 静默 400）

### 提速反馈循环

视觉 bug 不要走「我 push → 用户 build → rsync → 强刷」的慢循环。

启用 vite dev hot-reload（一次性配置 · 见 `docs/DEV-HOT-RELOAD.md`）：
- 我 push · 用户 git pull
- 浏览器自动刷新
- 一轮 30 秒

prod build 仅在视觉确认 OK 后做最终验证。

## 常见任务

### 加新观修视频
1. admin 后台 `/app/admin/courses` → 选法本 → 课时 → 「+ 添加观修」
2. 上传视频（mp4 ≤ 500MB · ffmpeg + scp 自动处理）
3. 勾选「已发布」+ 保存

### 给学员加新法本
1. admin 后台 `/app/admin/courses` → 「+ 新建法本」
2. slug 必须唯一 · 归档时 slug 自动改名释放
3. 上传封面（任意宽高比 · 后端 fit:'inside' 保留原比例）
4. 章节 → 课时 → 课时下编辑题目 / 观修

### 答题反馈显示
后端 `/api/answers` 返回完整 question（含 correctText / wrongText）。
前端 QuizPage 根据 `grade.isCorrect` 选 correctText 或 wrongText 显示。
若都没填 fallback 到「请参考法本原文」。

### 班级观修排行
后端 `/api/classes/:id/meditation-ranking?period=week|month|all`
- 5 分钟 in-memory cache
- 过滤 `isActive: true` + `meditationVisibleToClass: true` 的成员
- 按 count desc → totalSec desc 排序

学员可在 `/app/settings` 隐私 toggle 关闭可见性。

## 我已经栽过的事故 · 别重蹈覆辙

按 commit 反查：

| Commit | 事故 |
|---|---|
| `ea0fa6f` | MeditationPlayerPage React #310（hooks 顺序）→ ESLint 现在能挡 |
| `0d62f0a` | aborted fetch 进 retry 刷屏 |
| `3da14ab` | invalidateQueries 重复调 |
| `78c5b4f` | Dialog sheet variant 桌面贴底 |
| `0500162` | zod create body 不接 null |
| `9532e66` | sharp 强裁正方形丢图 |
| `8c2da1a` | .page-enter transform 让 fixed 失效 |
| `3c9d0ff` | picture inline 撑不满 flex |
| `7e8f088` | 容器固定宽高 → 图片留白（用户期待铺满）|
| `5b1a320` | upcoming-events 前后端 zod 值域不对齐 → 静默 400 |

每条都有详情写在 `docs/CSS-GOTCHAS.md`。
