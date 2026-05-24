# Phase 9 · 切默认入口（cutover）

> 把 `/` 从老 prototypes 改到新 React SPA · 老 prototypes 保留 30 天兜底

## 背景

| URL | Phase 8 之前 | Phase 9 之后 |
|---|---|---|
| `/` | 302 → `/prototypes/mobile/auth.html` | **302 → `/app/`** |
| `/app/*` | React SPA | 不变 |
| `/prototypes/*` | 老 MPA · 默认入口 | 老 MPA · 仅可主动访问 + 顶部 banner 软提示 |
| `/api/*` | 后端 | 不变 |

## 部署

> 必须先把 `juexue-v2/dist/` 推到服务器（部署位置同 Phase 1～8），再切 nginx。

```bash
# 1. 服务器上拉最新 + 构建 web 产物
cd /home/ubuntu/projects/juexue
git pull
cd juexue-v2
npm ci
npm run build

# 2. 同步产物（路径按你的实际部署位置）
sudo rsync -a --delete dist/ /home/ubuntu/projects/juexue/juexue-v2/dist/

# 3. nginx：默认入口已在 deploy/nginx/juexue.conf 改为 `return 302 /app/`
sudo cp deploy/nginx/juexue.conf /etc/nginx/sites-available/juexue
# 注意：第一次部署需把模板里 root / 端口替换成你的真实路径
sudo nginx -t && sudo systemctl reload nginx
```

## 灰度发布建议

如果不放心一次切干净，可以分阶段：

1. **Day 0** — 仅部署 React SPA 到 `/app/`，不动默认入口。让内部 / 邀请用户访问 `/app/` 直接体验。
2. **Day 3-7** — 在老 prototypes 上启用"试试新版" banner（已在 Phase 9 commit · 注入到 43 个页面），让用户自助迁移。
3. **Day 10+** — 把 `/` 重定向切到 `/app/`（本文档第二步）。
4. **Day 30** — 老 prototypes 下线（Phase 10 完成）。

## 验证

```bash
# 默认入口已切
curl -sI https://your-domain/ | grep -i location
# Location: /app/

# /app/ 仍能拉到 SPA
curl -s https://your-domain/app/ | grep -o '<title>[^<]*'
# <title>觉学

# /api 仍可达
curl -sI https://your-domain/api/health
# 200

# /prototypes 仍可访问（兜底）
curl -sI https://your-domain/prototypes/mobile/auth.html
# 200
```

## 回滚（任何时刻可秒退）

> 老 prototypes 没动过 · 切回去就行

```bash
# 1. 改回默认入口（一行 sed）
sudo sed -i 's|return 302 /app/|return 302 /prototypes/mobile/auth.html|' \
  /etc/nginx/sites-available/juexue

# 2. 改回 index 文件名
sudo sed -i 's|index app/index.html|index prototypes/mobile/auth.html|' \
  /etc/nginx/sites-available/juexue

# 3. reload
sudo nginx -t && sudo systemctl reload nginx
```

回滚后：
- `/` 重新落到老 MPA · 用户体验完全恢复
- 已发布的 React SPA 仍可独立通过 `/app/` 访问 · 不影响测试
- "试试新版" banner 仍在 prototypes 顶部 · 想撤掉的话回退此 commit 中 `prototypes/**/*.html` 末尾的 `<script src="/prototypes/shared/v2-banner.js" defer></script>` 注入即可

## 前后端版本依赖

| 组件 | 最低版本 | 备注 |
|---|---|---|
| backend (Fastify) | 不限（零改动） | Phase 1～9 全程没动后端 |
| Postgres schema | 不限（零改动） | Prisma migrations 没新加 |
| nginx | ≥ 1.18 | `try_files`、`location ~* `、`alias` |
| Node (build) | ≥ 18 | Vite 5 / TS 5 / Capacitor 8 都最低 18 |

## Phase 10 候选

- 老 `/prototypes/*` 整体下线（保留 30 天后）
- Coach 端（4 页：courses / questions / students / dashboard）
- Admin 端（9 页：users / courses / classes / review / audit / logs / reports / llm / settings）
- Service Worker（offline shell + background sync）
- 错题/收藏/通知 cursor 分页（`useInfiniteQuery` + IntersectionObserver）
