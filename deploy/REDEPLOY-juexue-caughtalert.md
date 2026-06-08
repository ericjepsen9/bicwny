# 觉学 · juexue.caughtalert.com 服务器部署手册

> 这是为本台服务器（`instance-20260213-1230`）量身写的重新部署 / 升级 runbook。
> 通用部署指南见 `DEPLOYMENT.md`。
>
> 这份手册的所有命令都可以**直接复制粘贴**，无需任何替换。

## 服务器实参（不要混改通用模板）

| 项 | 值 |
|---|---|
| 操作系统 | Ubuntu 22.04+ |
| 项目路径 | `/home/ubuntu/projects/juexue` |
| 项目所有者 | `ubuntu:ubuntu` |
| 后端端口 | **3001**（NOT 默认 3000，与服务器上其他进程错开） |
| 后端进程管理 | pm2 · `juexue-api` (id 12) |
| 前端 URL 约定 | `https://juexue.caughtalert.com/prototypes/...` |
| 域名 | `juexue.caughtalert.com` |
| HTTPS 证书 | Let's Encrypt（certbot 自动续签） |
| nginx 配置 | `/etc/nginx/sites-enabled/juexue`（symlink 到 sites-available） |
| 数据库 | PostgreSQL（容器或本机，端口 5433） |
| Node 版本 | ≥ 18（自带 fetch） |
| 包管理 | pnpm |
| 仓库分支 | `claude/general-session-RTDyG` |

## 重新部署 / 升级（最常用）

### 场景 A：拉新代码 + 重启（最多 90 秒）

```bash
cd /home/ubuntu/projects/juexue
git pull origin claude/general-session-RTDyG
cd backend
pnpm install                           # 有新依赖才装
pnpm prisma generate                   # schema 有改动必跑
pnpm prisma db push                    # schema 有改动必跑
pnpm build
pm2 restart juexue-api --update-env
pm2 logs juexue-api --lines 10 --nostream
```

成功标志：日志最后看到 `Server listening at http://127.0.0.1:3001`。

### 🔴 如果本次升级横跨 AU3（邮箱验证）· 必跑一次性 SQL

判断方法：`grep -q emailVerifiedAt backend/prisma/schema.prisma && echo "需要"`

```bash
PGPASSWORD=juexue_dev psql -h localhost -p 5433 -U juexue -d juexue \
  -c 'UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;'
```

理由：R1 修复后 `forgotPassword` 拒绝 `emailVerifiedAt=null` 的邮箱。
AU3 之前注册的老用户全部为 null · 不跑该 SQL → 老用户无法'忘记密码'。
SQL 幂等可重跑 · 仅影响 NULL 行 · 新注册用户走正常 verify 流程不受影响。

### 🟡 如果本次升级横跨 AD5（封面上传）· 确保 uploads 目录存在

```bash
sudo mkdir -p /home/ubuntu/projects/juexue/uploads/courses
sudo chown -R ubuntu:ubuntu /home/ubuntu/projects/juexue/uploads
sudo chmod -R 755 /home/ubuntu/projects/juexue/uploads
```

cover.service 默认写入 `{项目根}/uploads/courses/<courseId>-<random>.<ext>`。
nginx 已配置 `/uploads/` location 反代静态文件 · 7 天 cache · 见下方'nginx
配置基线'章节。需自定义路径时设 `UPLOAD_DIR=/绝对路径` 到 backend/.env。

### 场景 B：项目目录被破坏 / 全新 clone

```bash
# 0. 备份 .env（最重要）
cp /home/ubuntu/projects/juexue/backend/.env /home/ubuntu/.env.juexue.backup 2>/dev/null

# 1. 重新 clone
cd /home/ubuntu/projects
mv juexue juexue.bak.$(date +%s) 2>/dev/null
git clone -b claude/general-session-RTDyG https://github.com/ericjepsen9/bicwny.git juexue

# 2. 恢复 .env
cp /home/ubuntu/.env.juexue.backup /home/ubuntu/projects/juexue/backend/.env

# 3. 装依赖 + 编译
cd /home/ubuntu/projects/juexue/backend
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm build

# 4. 重启
pm2 restart juexue-api --update-env || pm2 start dist/server.js --name juexue-api --time
pm2 save
pm2 logs juexue-api --lines 10 --nostream
```

## `.env` 必填项（`backend/.env`）

```env
NODE_ENV=production
PORT=3001                                      # ⚠️ 必须是 3001
HOST=127.0.0.1                                 # 只绑定本机，nginx 反代

DATABASE_URL="postgresql://juexue:juexue_dev@localhost:5433/juexue?schema=public"

JWT_SECRET=<openssl rand -base64 48 生成的强随机串>

CORS_ORIGINS=https://juexue.caughtalert.com    # 生产必填

# LLM（选填，造题才需要）
MINIMAX_API_KEY=
ANTHROPIC_API_KEY=

# 亚洲中转（选填，需要时再填）
ASIA_RELAY_URL=
ASIA_RELAY_TOKEN=

# 上传目录（选填，默认 {项目根}/uploads ⇒ /home/ubuntu/projects/juexue/uploads）
# 仅在需要把 admin 法本封面图存到别的盘位时填绝对路径
# nginx 已配置 /uploads/ 反代到此目录 · 改路径需同步 nginx root
UPLOAD_DIR=
```

> ⚠️ **`JWT_SECRET` 必须 ≥ 32 字符**，否则 production 模式启动失败。
> ⚠️ **空字符串会被自动当作未设置**（`config.ts` 已处理），不必删行。

## nginx 配置（已部署，正常情况下不要改）

存在路径：`/etc/nginx/sites-enabled/juexue`

关键参数（**改坏过的请按此对照**）：

```nginx
server {
  server_name juexue.caughtalert.com;

  root /home/ubuntu/projects/juexue;             # ← 项目根，不带 /prototypes
  index prototypes/mobile/auth.html;

  client_max_body_size 25M;                       # ← 防 1MB 默认上限触发 413

  location / {
    try_files $uri $uri/ =404;
    location = / { return 302 /prototypes/mobile/auth.html; }
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001;             # ← 必须 3001 不是 3000
    # ... 各种 X-Forwarded-* + 120s 超时 + proxy_request_buffering off
  }

  location = /health { proxy_pass http://127.0.0.1:3001/health; }
  location /docs     { proxy_pass http://127.0.0.1:3001/docs; }
  location /openapi.json { proxy_pass http://127.0.0.1:3001/openapi.json; }

  listen 443 ssl;                                 # ← certbot 加的
  ssl_certificate /etc/letsencrypt/live/juexue.caughtalert.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/juexue.caughtalert.com/privkey.pem;
}

server {
  if ($host = juexue.caughtalert.com) { return 301 https://$host$request_uri; }
  listen 80;
  server_name juexue.caughtalert.com;
  return 404;
}
```

### 如果要从模板重置 nginx 配置

⚠️ **每次 `cp deploy/nginx/juexue.conf` 之后必须跑这三条 sed**，不然会回到坑里：

```bash
sudo cp deploy/nginx/juexue.conf /etc/nginx/sites-available/juexue

# ① 域名
sudo sed -i 's|app.juexue.example|juexue.caughtalert.com|g' /etc/nginx/sites-available/juexue

# ② 项目路径（替换占位符）
sudo sed -i 's|/PATH/TO/juexue|/home/ubuntu/projects/juexue|g' /etc/nginx/sites-available/juexue

# ③ 后端端口（默认 3000 → 改成 3001）
sudo sed -i 's|127.0.0.1:3000|127.0.0.1:3001|g' /etc/nginx/sites-available/juexue

sudo ln -sf /etc/nginx/sites-available/juexue /etc/nginx/sites-enabled/juexue
sudo nginx -t && sudo systemctl reload nginx

# ④ 重新塞 SSL 块（cp 会冲掉 certbot 加的 listen 443 ssl）
sudo certbot --nginx -d juexue.caughtalert.com
# 选 1 (reinstall) · 选 2 (redirect HTTP→HTTPS)
```

## 健康验证（部署后必跑）

```bash
echo "=== 1. 后端进程在 3001 ==="
curl -s http://127.0.0.1:3001/health
echo ""

echo "=== 2. HTTPS 静态文件 ==="
curl -sI https://juexue.caughtalert.com/prototypes/desktop/admin-courses.html | head -3

echo "=== 3. HTTPS API ==="
curl -sI -X POST https://juexue.caughtalert.com/api/admin/courses/import-file/preview \
  -H "Authorization: Bearer fake" | head -5

echo "=== 4. 大文件上传不再 413 ==="
curl -X POST -H "Authorization: Bearer fake" -F "file=@/dev/zero;filename=t.docx" \
  --max-filesize 2000000 https://juexue.caughtalert.com/api/admin/courses/import-file/preview \
  -s -o /dev/null -w "HTTP: %{http_code}\n"
```

期待全部通过：

| 检查 | 期待 |
|---|---|
| /health | `{"ok":true,...}` |
| 静态 admin-courses.html | `HTTP/1.1 200 OK` |
| API POST | `HTTP/1.1 401` + `Content-Type: application/json` |
| 大 body | `HTTP: 401`（不是 413） |

## 踩过的坑速查表

| 现象 | 真因 | 一行修复 |
|---|---|---|
| 上传 docx → `Unexpected token '<', "<html>...` | nginx `client_max_body_size` 默认 1 MB | `sudo sed -i '/server_name/a \    client_max_body_size 25M;' /etc/nginx/sites-enabled/juexue && sudo systemctl reload nginx` |
| 网页 404 + 路径含 `/prototypes/prototypes/...` | nginx root 末尾误带 `/prototypes` | `sudo sed -i 's|root /home/ubuntu/projects/juexue/prototypes;|root /home/ubuntu/projects/juexue;|' /etc/nginx/sites-enabled/juexue && sudo systemctl reload nginx` |
| HTTPS 通了但 API 返回 HTML 404 | nginx `proxy_pass` 端口 3000 而后端在 3001 | `sudo sed -i 's|127.0.0.1:3000|127.0.0.1:3001|g' /etc/nginx/sites-enabled/juexue && sudo systemctl reload nginx` |
| HTTPS 域名 404 / 连接到默认站 | nginx 配置丢了 `listen 443 ssl` | `sudo certbot --nginx -d juexue.caughtalert.com`（选 1 reinstall） |
| pm2 启动报 `Invalid url` / `must be ≥ 16 characters` | `.env` 里 `ASIA_RELAY_URL=` 等空字符串失效 `.optional()` | 已修复（commit `0256c32`），拉最新代码即可 |
| `pnpm prisma db push` 卡住 | DATABASE_URL 不通 | `pg_isready -h localhost -p 5433 -U juexue` |
| `pm2 logs` 看到 `Cannot find module ...settings.routes...` | 没跑 `pnpm build` | `pnpm build && pm2 restart juexue-api` |
| `git pull` 报 `not a git repository` | 项目目录被手动复制，没带 `.git/` | 走场景 B 重新 clone |

## 亚洲中转节点（可选 · 法本抓取被站方封 IP 时切换出口）

部署在**单独的亚洲 VPS** 上（香港 / 东京 / 新加坡），步骤详见 `asia-relay/README.md`。

部署后在主后台 `.env` 加：

```env
ASIA_RELAY_URL=https://你的-asia-relay.example.com
ASIA_RELAY_TOKEN=与亚洲端一致的强随机串
```

`pm2 restart juexue-api --update-env` 后，admin 登录后台 → 法本管理 → 导入法本 → 顶部 radio 切到「亚洲中转节点」即可。

## 常用运维命令

```bash
# 看后端日志（实时）
pm2 logs juexue-api

# 看最近 50 行（不实时）
pm2 logs juexue-api --lines 50 --nostream

# 看 nginx 错误
sudo tail -50 /var/log/nginx/error.log

# 看 nginx 访问
sudo tail -50 /var/log/nginx/access.log | grep -v "/health\|/openapi"

# 看 Postgres 连接
pg_isready -h localhost -p 5433 -U juexue

# 看 SSL 证书还剩多少天
sudo certbot certificates

# 强制续签 SSL
sudo certbot renew --force-renewal
```
