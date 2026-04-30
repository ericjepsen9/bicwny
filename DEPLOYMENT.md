# 觉学 · 部署指南（v1.0）

v1.0 上线标准：用户可以注册、登录、浏览 home/profile/settings，前后端打通跑通认证闭环。
v2.0 题型的前端 UI、题目编辑后台 UI 暂未上线，后端 API 已就绪。

## 一、架构总览

```
┌──────────────────────────────────────────────┐
│  单台服务器（Oracle Cloud ARM / 任意 VPS）    │
│                                              │
│  nginx :443/:80                              │
│   ├── /         → 静态文件 (prototypes/)      │
│   └── /api/     → 反代 127.0.0.1:3000 (node) │
│                                              │
│  PM2 / systemd → node backend (:3000)        │
│  PostgreSQL 16 (:5432)                       │
└──────────────────────────────────────────────┘
```

- **静态前端**和 **Node API** 同域（nginx 反代）→ 天然同源，无需 CORS
- 想分域部署也行：前端填 `CORS_ORIGINS=https://app.example.com`

## 二、本地开发（一次性）

```bash
# 1) Postgres
sudo pg_ctlcluster 16 main start       # 或 docker-compose -f backend/docker-compose.yml up -d
sudo -u postgres createuser juexue -P   # 密码：juexue_dev（或随意）
sudo -u postgres createdb -O juexue juexue

# 2) 后端依赖 + schema + 种子
cd backend
cp .env.example .env                    # 按需改 DATABASE_URL / JWT_SECRET
pnpm install
pnpm prisma generate
pnpm prisma db push                     # 非破坏式同步 schema（首次）
pnpm prisma:seed                        # 写入法本 / 3 个 demo 账号 / LLM 模板

# 3) 同时开两个进程
pnpm dev                                # backend → :3000
python3 -m http.server 5173 --directory ../prototypes   # 静态 → :5173

# 4) 浏览器打开 http://localhost:5173/mobile/auth.html
#    - 注册 → 自动跳 home.html
#    - 刷新应保持登录；退出登录 → 跳回 auth.html
```

### 演示账号（seed 自动写入）

| 角色    | 邮箱                  | 密码        |
| ------- | --------------------- | ----------- |
| admin   | admin@juexue.app      | admin123    |
| coach   | coach@juexue.app      | coach123    |
| student | student@juexue.app    | student123  |

## 三、生产部署（Oracle Cloud ARM 示例）

假设域名 `app.juexue.example`，代码放在 `/opt/juexue`。

### 1. 系统依赖

```bash
# Ubuntu 22.04 / 24.04
sudo apt update
sudo apt install -y nodejs npm postgresql-16 nginx
sudo npm install -g pnpm pm2
```

### 2. 拉取代码

```bash
sudo mkdir -p /opt/juexue && sudo chown $USER /opt/juexue
git clone <repo-url> /opt/juexue
cd /opt/juexue/backend
pnpm install --prod=false
pnpm build         # tsc → dist/
```

### 3. 数据库

```bash
sudo -u postgres psql <<EOF
CREATE USER juexue WITH PASSWORD '<强密码>';
CREATE DATABASE juexue OWNER juexue;
EOF
```

### 4. 环境变量 `/opt/juexue/backend/.env`

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1                # 只绑定 loopback，nginx 反代访问

DATABASE_URL="postgresql://juexue:<强密码>@localhost:5432/juexue?schema=public"
JWT_SECRET=<openssl rand -hex 48 输出的 96 字符>

CORS_ORIGINS=                 # 同源部署留空；跨域时填前端域名

MINIMAX_API_KEY=<...>         # 不用 LLM 造题可留空
MINIMAX_GROUP_ID=<...>
ANTHROPIC_API_KEY=<...>
```

### 5. 首次 schema + seed

```bash
cd /opt/juexue/backend
pnpm prisma migrate deploy   # 若日后加了 migrations/
# 或首次部署：
pnpm prisma db push
pnpm prisma:seed
```

### 6. PM2 常驻

```bash
cd /opt/juexue/backend
pm2 start dist/server.js --name juexue-api --time
pm2 save
pm2 startup systemd           # 跟着按提示跑一条 sudo 命令
```

### 7. nginx 配置 `/etc/nginx/sites-available/juexue`

```nginx
server {
  listen 80;
  server_name app.juexue.example;

  # certbot 会自动加 SSL，这里先写 HTTP；跑 certbot --nginx 后自动 HTTPS
  root /opt/juexue/prototypes;
  index mobile/auth.html index.html;

  # 文件上传上限：
  #   后端 multipart 上限 20 MB（src/app.ts），nginx 留 5 MB 余量
  #   不设这个 → 默认 1 MB，admin 上传法本 PDF/DOCX 立刻 413
  client_max_body_size 25M;

  # 1. 静态资源
  location / {
    try_files $uri $uri/ =404;
    # 根访问默认进入登录页
    location = / { return 302 /mobile/auth.html; }
  }

  # 2. API 反代 —— 保留 Authorization header
  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization     $http_authorization;
    # 大文件上传 + LLM 长任务 → 留足超时
    proxy_read_timeout    120s;
    proxy_send_timeout    120s;
    proxy_connect_timeout  30s;
    client_body_timeout   120s;
  }

  # 3. 健康检查
  location = /health { proxy_pass http://127.0.0.1:3000/health; }
}
```

> 完整模板见 `deploy/nginx/juexue.conf`。

```bash
# 推荐：直接用仓库里的模板（含 client_max_body_size 等已校准的参数）
sudo cp /opt/juexue/deploy/nginx/juexue.conf /etc/nginx/sites-available/juexue
sudo sed -i 's/app.juexue.example/你的真实域名/g' /etc/nginx/sites-available/juexue
sudo ln -sf /etc/nginx/sites-available/juexue /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d 你的真实域名   # 自动签 HTTPS
```

#### 已部署的服务器：单独追加 `client_max_body_size`（避免 413）

如果你之前按旧版文档部署、没有 `client_max_body_size`，**热修复**一行：

```bash
sudo sed -i '/server_name/a \    client_max_body_size 25M;' /etc/nginx/sites-enabled/juexue
sudo nginx -t && sudo systemctl reload nginx
```

### 8. 防火墙

Oracle Cloud ARM 默认只开 22。要在控制台的 Security List 放行 80/443；本机再：

```bash
sudo ufw allow 80,443/tcp
sudo ufw enable
```

## 四、前端配置 API 地址

前端默认策略：
- `localhost`/`127.0.0.1` → `http://localhost:3000`（本地 dev 自动）
- 其它域名 → 同源（`/api/...`），由 nginx 反代 → 生产零配置

如需手动覆盖（比如前端托在 Oracle Cloud Object Storage、后端在另一台服务器）：

```html
<!-- 在 prototypes 里每个 .html <head> 的 config.js 之前加一行： -->
<meta name="jx-api-base" content="https://api.juexue.example">
```

或运行时改：`localStorage.setItem('jx-api-base', 'https://api.juexue.example')`

## 五、升级流程

```bash
cd /opt/juexue
git pull
cd backend
pnpm install --prod=false
pnpm prisma generate
pnpm prisma migrate deploy   # 有新迁移时
pnpm build
pm2 reload juexue-api        # 零停机重启
```

前端是纯静态，`git pull` 就生效。

## 六、数据库备份与恢复验证

**必装** · 任何上线项目都要有自动备份 + 定期"演练"恢复 · 否则真出事时
才发现备份坏掉就是灾难。

### 一键安装

```bash
cd /home/ubuntu/projects/juexue
sudo bash deploy/setup-backup-cron.sh
```

脚本做了：
- 从 `backend/.env` 读 `DATABASE_URL` · 解析出连接信息写到 `/etc/juexue/backup-env.sh`（权限 600）
- 写 cron 文件 `/etc/cron.d/juexue-backup`：
  - **每日 03:00** 执行 `db-backup.sh`：`pg_dump | gzip` → `/var/backups/juexue/` · 保留 30 天
  - **每周日 04:00** 执行 `db-restore-verify.sh`：把最新备份恢复到临时库 `juexue_verify` · 检查 User/Course/Question/AuditLog 表能 SELECT · 跑完 drop 临时库
- 失败时 cron 通过 `MAILTO=root` 邮件告警（前提：服务器装了 sendmail/postfix）

### 立即测试

```bash
source /etc/juexue/backup-env.sh && bash deploy/db-backup.sh
ls -lh /var/backups/juexue/                       # 应看到 juexue-YYYYMMDD-HHMMSS.sql.gz
source /etc/juexue/backup-env.sh && bash deploy/db-restore-verify.sh
tail /var/log/juexue-backup.log                   # 应看到 verify PASS
```

### 手动恢复（真出事故时）

```bash
# 1) 停后端避免有写入
pm2 stop juexue-api

# 2) drop + recreate 主库（会清空所有数据 · 确认你真的要这么做）
sudo -u postgres psql -c "DROP DATABASE juexue;"
sudo -u postgres psql -c "CREATE DATABASE juexue OWNER juexue;"

# 3) 解压并恢复
zcat /var/backups/juexue/juexue-YYYYMMDD-HHMMSS.sql.gz | \
  PGPASSWORD=<你的密码> psql -U juexue -h localhost -d juexue

# 4) Prisma client 不需要重新 generate（schema 没变）· 直接重启
pm2 restart juexue-api
```

### 异地备份（强烈建议）

单机备份还在同一台机器 · 机器爆了就一起没。配置 `REMOTE_DEST` 推送到另一台 / 对象存储：

```bash
# /etc/juexue/backup-env.sh 末尾加
export REMOTE_DEST="user@backup-host:/srv/juexue-backups/"
# 或用 rclone 推 S3 / B2 / 阿里云 OSS：
# 先 rclone config 配 remote · 再 export REMOTE_DEST="rclone:juexue-backup:/"
# 改 db-backup.sh 调 rclone copy 替代 rsync（如需）
```

### 配置项

环境变量（覆盖默认）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DB_NAME` | `juexue` | 数据库名 |
| `DB_USER` | `juexue` | Postgres 角色 |
| `DB_HOST` | `localhost` | 主机 |
| `DB_PORT` | `5432` | 端口 |
| `PGPASSWORD` | （空） | 密码 · 也可写 `~/.pgpass` |
| `BACKUP_DIR` | `/var/backups/juexue` | 备份目录 |
| `KEEP_DAYS` | `30` | 本地保留天数 |
| `REMOTE_DEST` | （空） | rsync 目的地 · 设了就推一份到远端 |
| `VERIFY_DB` | `juexue_verify` | 验证用临时库名 |
| `MIN_USER_COUNT` | `1` | User 表至少行数 · 低于报错 |
| `LOG_FILE` | `/var/log/juexue-backup.log` | 日志路径 |

## 七、常见排错

| 症状 | 排查 |
| ---- | ---- |
| 前端打开空白 | 浏览器 Console 看有没有 404；检查 `prototypes/shared/*.js` 是否 200 |
| 注册/登录按钮没反应 | Network 看 `/api/auth/login` 请求；大概率 CORS 或 DATABASE_URL |
| 401 循环跳登录 | `JWT_SECRET` 变更了导致老 token 失效；让用户清 localStorage 重登 |
| `ECONNREFUSED 127.0.0.1:3000` | `pm2 status` 看 juexue-api 是否 online；`pm2 logs juexue-api` |
| Prisma `P1001` | DATABASE_URL 对吗、Postgres 起来了吗 |
| LLM 造题 503 | `.env` 里的 API key 为空或错误；或 MiniMax 配额耗尽 |

## 八、还没上线的功能（v1.0 范围外）

1. 前端 v2.0 题型（flip/image/listen/flow/guided/scenario）UI
2. Coach 后台 UI（造题表单、批量导入、LLM 造题向导）
3. Admin 后台 UI（审核队列）
4. 找回密码（需邮件发送 provider）
5. CDN 上传签名 URL（image/listen 资源）
6. image/listen 题所需的对象存储

这些后端都已就绪（见 `backend/docs/v2-question-types.md` 和 `question-editor-and-generation.md`），
等前端 UI 跟上即可激活。
