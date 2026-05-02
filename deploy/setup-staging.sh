#!/usr/bin/env bash
# 觉学 · Staging 环境一键搭建
#   同一台 VPS 跑两个 pm2 进程：
#     juexue-api          :3000  (prod)
#     juexue-api-staging  :3001  (staging)
#   独立 Postgres 库 juexue_staging · 独立 .env.staging
#   nginx 双 vhost：juexue.caughtalert.com / staging.juexue.caughtalert.com
#
# 用法（root 或 sudo）：
#   sudo bash deploy/setup-staging.sh
#
# 前提：prod 已经按 DEPLOYMENT.md 装好（Postgres / Node / pnpm / pm2 / nginx）
# 配套文件：
#   deploy/nginx/staging.conf  · vhost 模板
#   backend/.env.staging.example · env 模板
#
# 退出码：0=成功 · 非 0 = 某步失败

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/projects/juexue}"
STAGING_DOMAIN="${STAGING_DOMAIN:-staging.juexue.caughtalert.com}"
STAGING_PORT="${STAGING_PORT:-3001}"
STAGING_DB="${STAGING_DB:-juexue_staging}"
STAGING_DB_USER="${STAGING_DB_USER:-juexue}" # 复用 prod role · 简化
STAGING_PM2_NAME="${STAGING_PM2_NAME:-juexue-api-staging}"

log() { echo "[$(date +'%H:%M:%S')] $*"; }

if [ ! -d "$PROJECT_DIR" ]; then
  echo "ERROR: 找不到项目目录 $PROJECT_DIR · 请先按 DEPLOYMENT.md 部署 prod"
  exit 1
fi

# 1. 建 staging 库（如果不存在）
log "▸ 建库 $STAGING_DB"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$STAGING_DB'" | grep -q 1; then
  log "  $STAGING_DB 已存在 · 跳过 createdb"
else
  sudo -u postgres createdb -O "$STAGING_DB_USER" "$STAGING_DB"
  log "  ✓ 建库完成"
fi

# 2. 写 .env.staging（如果还没）
ENV_FILE="$PROJECT_DIR/backend/.env.staging"
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$PROJECT_DIR/backend/.env.staging.example" ]; then
    cp "$PROJECT_DIR/backend/.env.staging.example" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log "▸ 已 copy .env.staging.example → $ENV_FILE"
    log "  ⚠️  请打开此文件 · 按需替换 JWT_SECRET / VAPID / Sentry DSN 等"
  else
    log "WARN: 没找到 backend/.env.staging.example · 跳过"
  fi
else
  log "▸ $ENV_FILE 已存在 · 不覆盖"
fi

# 3. Prisma 同步 schema 到 staging 库
log "▸ Prisma db push 到 $STAGING_DB"
cd "$PROJECT_DIR/backend"
# 临时用 staging 的 DATABASE_URL 跑 db push
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
if [ -z "$DATABASE_URL" ]; then
  log "  ⚠️  $ENV_FILE 没 DATABASE_URL · 跳过 db push · 请手动跑"
else
  DATABASE_URL="$DATABASE_URL" pnpm prisma db push --skip-generate
  log "  ✓ schema 已同步"
fi

# 4. pm2 启 staging 进程
log "▸ pm2 start $STAGING_PM2_NAME · 端口 $STAGING_PORT"
cd "$PROJECT_DIR/backend"
# 确保 dist 已 build
[ -f "dist/server.js" ] || pnpm build
# 已存在 → reload · 否则 start
if pm2 list | grep -q "$STAGING_PM2_NAME"; then
  PORT="$STAGING_PORT" pm2 reload "$STAGING_PM2_NAME" --update-env
  log "  ✓ reload"
else
  PORT="$STAGING_PORT" \
  pm2 start dist/server.js \
    --name "$STAGING_PM2_NAME" \
    --time \
    --env-file "$ENV_FILE"
  pm2 save
  log "  ✓ start + save"
fi

# 5. nginx vhost
NGINX_AVAIL="/etc/nginx/sites-available/${STAGING_DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${STAGING_DOMAIN}"
if [ ! -f "$NGINX_AVAIL" ]; then
  if [ -f "$PROJECT_DIR/deploy/nginx/staging.conf" ]; then
    cp "$PROJECT_DIR/deploy/nginx/staging.conf" "$NGINX_AVAIL"
    sed -i "s/__STAGING_DOMAIN__/$STAGING_DOMAIN/g" "$NGINX_AVAIL"
    sed -i "s/__STAGING_PORT__/$STAGING_PORT/g" "$NGINX_AVAIL"
    sed -i "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$NGINX_AVAIL"
    log "▸ 写入 $NGINX_AVAIL"
  else
    log "WARN: 没 nginx 模板 · 跳过 vhost 配置"
  fi
fi
[ ! -L "$NGINX_ENABLED" ] && [ -f "$NGINX_AVAIL" ] && ln -s "$NGINX_AVAIL" "$NGINX_ENABLED"
nginx -t && systemctl reload nginx
log "  ✓ nginx reload"

log ""
log "═══════════════════════════════════════════════"
log "✅ Staging 环境就绪"
log "  域名      $STAGING_DOMAIN"
log "  pm2       $STAGING_PM2_NAME (:$STAGING_PORT)"
log "  数据库    $STAGING_DB"
log "  env       $ENV_FILE"
log ""
log "下一步：申请 SSL · sudo certbot --nginx -d $STAGING_DOMAIN"
log "测试：    curl -sf https://$STAGING_DOMAIN/health"
log "═══════════════════════════════════════════════"
