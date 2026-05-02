# 觉学 v2 · React SPA

> Phase 1 骨架 · 与老 MPA 共存 · 后端零改动

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

## 与老版共存

| URL | 内容 | 状态 |
|---|---|---|
| `/` | 302 → `/prototypes/mobile/auth.html` | 老版（Phase 9 切到 `/app/`） |
| `/prototypes/*` | 28 页 MPA | 老版（Phase 9 后下线 30 天） |
| `/app/*` | React SPA（这个项目） | 新版 |
| `/api/*` | Fastify backend | **零改动** |

## Phase 进度

- [x] **Phase 0** 决策 + 计划
- [x] **Phase 1** 骨架（你正在 review）
- [ ] **Phase 2** 核心工具（i18n / api / theme / toast / haptics ...）
- [ ] **Phase 3** 认证流（auth / register / forgot / onboarding）
- [ ] **Phase 4** Tab 主页（home / courses / quiz / profile 真实实现）
- [ ] **Phase 5** 答题阅读核心流（detail / reading / quiz / mistake-detail）
- [ ] **Phase 6** 二级页（mistakes / favorites / sm2 / settings / profile-edit ...）
- [ ] **Phase 7** Coach + Admin
- [ ] **Phase 8** Capacitor 打包（iOS / Android）
- [ ] **Phase 9** 切默认入口 + 老版下线
