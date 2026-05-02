# 觉学 v2 · React SPA + Capacitor

> Phase 8 进行中 · React Web + iOS/Android 单源代码 · 后端零改动

## 技术栈

- **React 18** + **TypeScript** + **Vite 5**
- **React Router v7**（BrowserRouter · base `/app`）
- **TanStack React Query**（服务端状态）
- **Zustand**（客户端 UI 状态 · Phase 2 引入）
- **CSS**：直接复用 `prototypes/shared/{tokens,base,components}.css`

## 目录

```
juexue-v2/
├── index.html              # 入口
├── vite.config.ts          # base /app/ · dev proxy /api → 3001
├── tsconfig.{,app,node}.json
├── package.json
├── public/                 # 静态资源（图标 / manifest）
└── src/
    ├── main.tsx            # ReactDOM mount · Provider 链
    ├── App.tsx             # 路由 + TabBar
    ├── styles/             # 直接复制自 prototypes/shared/
    │   ├── tokens.css
    │   ├── base.css
    │   └── components.css
    ├── pages/              # 路由页面（每 tab 一个 · lazy 加载）
    │   ├── HomePage.tsx
    │   ├── CoursesPage.tsx
    │   ├── QuizCenterPage.tsx
    │   └── ProfilePage.tsx
    ├── components/         # 复用组件
    │   └── TabBar.tsx
    └── lib/                # Phase 2 填充：i18n / api / theme / haptics ...
```

## 本地开发

```bash
cd juexue-v2
npm install
npm run dev        # 起 vite dev server · http://localhost:5174/app/
                   # /api 自动反代到 127.0.0.1:3001
```

## 生产构建

```bash
npm run build
# 产物在 dist/ · 部署到服务器对应路径
```

## 部署到服务器

```bash
# 服务器上
cd /home/ubuntu/projects/juexue
git pull
cd juexue-v2
npm install
npm run build
sudo cp deploy/nginx/juexue-v2-app.conf /etc/nginx/conf.d/juexue-v2-app.conf
sudo nginx -t && sudo systemctl reload nginx
# 访问 https://juexue.caughtalert.com/app/
```

## 与老版共存（Phase 9 已切默认入口）

| URL | 内容 | 状态 |
|---|---|---|
| `/` | 302 → `/app/` | **新版 default**（Phase 9 完成） |
| `/app/*` | React SPA（这个项目） | 新版 · 主流量 |
| `/prototypes/*` | 43 页老 MPA | 兜底 · 顶部"试试新版"banner · Phase 10 后下线 |
| `/api/*` | Fastify backend | **零改动** |

> Phase 9 部署 / 灰度 / 回滚步骤：见 [`CUTOVER.md`](./CUTOVER.md)

## 原生壳（iOS / Android · Capacitor 8）

```bash
# 1. 准备 .env.native.local（只在本地，不入库）
cp .env.native.example .env.native.local
# 编辑：VITE_API_BASE=https://juexue.app

# 2. 构建 native 产物（webDir=dist-native · base='/'）
npm run build:native

# 3. 首次：在 macOS / 装好 Android Studio 的机器上加平台
npm run cap:add:ios       # 需 Xcode + CocoaPods
npm run cap:add:android   # 需 Android Studio + JDK 17

# 4. 后续每次改代码
npm run cap:sync          # = build:native + cap sync · 把 dist-native 拷到 ios/android
npm run cap:open:ios      # → 在 Xcode 里 Run
npm run cap:open:android  # → 在 Android Studio 里 Run
```

**双产物对照**

| 维度 | Web (`npm run build`) | Native (`npm run build:native`) |
|---|---|---|
| outDir | `dist/` | `dist-native/` |
| base | `/app/` | `/` |
| Router basename | `/app` | `/` |
| API host | 相对（nginx 反代） | 绝对（`VITE_API_BASE`） |
| Token 存储 | localStorage | iOS Keychain / Android EncryptedSharedPrefs |
| Haptics | `navigator.vibrate` | Taptic Engine / Vibrator |
| Status bar | n/a | 跟随主题 light/dark |
| 物理返回键 | n/a | history.back / minimizeApp |

**关键文件**
- `capacitor.config.ts` — appId / 启动屏 / 状态栏 / 键盘策略
- `src/lib/env.ts` — `isNative()` / `apiUrl()` / `ROUTER_BASENAME`
- `src/lib/native.ts` — Splash hide / Status bar 同步 / Android 返回键

> **不要把 `ios/` 或 `android/` 目录入库** — 由 `cap add` 在本地生成，配置都在 `capacitor.config.ts`。

## Phase 进度

- [x] **Phase 0** 决策 + 计划
- [x] **Phase 1** 骨架
- [x] **Phase 2** 核心工具（i18n / api / theme / toast / haptics ...）
- [x] **Phase 3** 认证流
- [x] **Phase 4** Tab 主页（home / courses / quiz / profile）
- [x] **Phase 5** 答题阅读核心流
- [x] **Phase 6** 二级页 11 个
- [x] **Phase 7** 资料编辑 / 帮助 / 条款 / 隐私 / ErrorBoundary / PWA manifest
- [x] **Phase 8** Capacitor 打包（iOS / Android）
- [x] **Phase 9** 切默认入口（`/` → `/app/`）+ prototypes 顶部 banner + safe-area 适配
- [x] **Phase 10** 辅导员后台 4 页（dashboard / students / questions / courses）+ desktop layout + RequireCoach 守卫
- [ ] **Phase 11** Admin 端 9 页 + 辅导员"新建/LLM/批量"完整迁移 + 老 prototypes 下线 + Service Worker
