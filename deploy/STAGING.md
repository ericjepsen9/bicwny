# 觉学 · Staging 环境

跟生产同一台 VPS · 但完全独立：独立 DB · 独立 pm2 进程 · 独立域名 · 独立 .env。

## 拓扑

```
┌─ VPS（同一台机器）───────────────────────────────────┐
│                                                     │
│  Postgres 16                                        │
│   ├─ juexue          (prod 库)                      │
│   └─ juexue_staging  (staging 库)                   │
│                                                     │
│  pm2                                                │
│   ├─ juexue-api          (.env · :3000 · prod)      │
│   └─ juexue-api-staging  (.env.staging · :3001)     │
│                                                     │
│  nginx                                              │
│   ├─ juexue.caughtalert.com           → :3000      │
│   └─ staging.juexue.caughtalert.com   → :3001      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 一次性搭建

```bash
# 在服务器上
cd /home/ubuntu/projects/juexue

# 1) DNS 加 A 记录 staging.juexue.caughtalert.com → 服务器 IP
#    （手动到 DNS 控制台加 · 等几分钟生效）

# 2) 跑一键脚本
sudo bash deploy/setup-staging.sh

# 脚本做了：
#   - 建 juexue_staging 库
#   - copy backend/.env.staging.example → backend/.env.staging（如果还没）
#   - prisma db push 同步 schema
#   - pm2 start juexue-api-staging --port 3001
#   - 写 nginx vhost · reload

# 3) 编辑 .env.staging 替换占位值
nano backend/.env.staging
# 关键：JWT_SECRET 一定要换成 prod 不一样的
# 推送 / Sentry / CAPTCHA 按需配（staging 通常关掉 CAPTCHA · Sentry 单独项目）

# 4) HTTPS 证书
sudo certbot --nginx -d staging.juexue.caughtalert.com

# 5) pm2 reload 让新 .env 生效
pm2 reload juexue-api-staging --update-env

# 6) 验证
curl -sf https://staging.juexue.caughtalert.com/health
# {"ok":true,"env":"production"}
```

## 日常使用

```bash
# 在 GitHub Actions 部署 staging
Actions → deploy → Run workflow
  target = staging
  branch = claude/xxx       # 或任何分支
  run_db_push = true        # 如果 schema 改了
  ↓ submit

# 验证 staging 上看效果
打开 https://staging.juexue.caughtalert.com/mobile/auth.html

# 验证通过 → 部署 production
Actions → deploy → Run workflow
  target = production
  branch = main
  ...
```

## 数据隔离

- staging 用户和 prod 用户完全独立 · prod 账号在 staging 登不进
- staging 库可以随便清空（`sudo -u postgres psql -c "DROP DATABASE juexue_staging;" && createdb...`）
- 不要从 prod 灌真实数据进 staging（隐私 / 合规）

## 测试种子数据

```bash
# 给 staging 灌种子（demo 账号 / 法本 / LLM 模板）
cd /home/ubuntu/projects/juexue/backend
DATABASE_URL="postgresql://juexue:juexue_dev@localhost:5432/juexue_staging?schema=public" \
  pnpm prisma:seed
```

## Robots / 隐私

`deploy/nginx/staging.conf` 已加 `X-Robots-Tag: noindex, nofollow` · 防搜索引擎收录。

完全私有可在 nginx 模板里打开 basic auth：

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/staging.htpasswd dev
# 编辑 /etc/nginx/sites-available/staging.juexue.caughtalert.com
#   打开 auth_basic 行
sudo nginx -t && sudo systemctl reload nginx
```

## 排错

| 症状 | 排查 |
| --- | --- |
| `502 Bad Gateway` | `pm2 status juexue-api-staging` 看进程 / `pm2 logs juexue-api-staging` 看错 |
| `connect ECONNREFUSED :3001` | pm2 没起 · 跑 `pm2 start dist/server.js --name juexue-api-staging` |
| Prisma 报库不存在 | `.env.staging` 的 DATABASE_URL 指向 `juexue_staging` 库 · 库存在吗 |
| 推送 / sentry / captcha 失效 | staging 默认这些都没配 · 测时灌 staging 自己的 keys |
| GitHub Actions 部署失败 | 检查 GitHub Environments → staging 是否配了 secrets |
