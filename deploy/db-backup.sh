#!/usr/bin/env bash
# 觉学 · 数据库备份脚本
#   每日 cron 执行 · 流程：pg_dump → gzip → 落盘 → 旋转
#
# 配置（可通过 env 覆盖）：
#   DB_NAME           Postgres 库名 · 默认 juexue
#   DB_USER           Postgres 角色 · 默认 juexue
#   DB_HOST           主机 · 默认 localhost
#   DB_PORT           端口 · 默认 5432
#   PGPASSWORD        密码 · 若用 ~/.pgpass 可不设
#   BACKUP_DIR        本地备份目录 · 默认 /var/backups/juexue
#   KEEP_DAYS         保留天数 · 默认 30
#   REMOTE_DEST       可选 · rsync 目的地（如 user@host:/backup/）
#                     设了就额外推一份到远端
#
# 退出码：0=成功 · 非 0=失败（cron MAILTO 会邮件告警）

set -euo pipefail

DB_NAME="${DB_NAME:-juexue}"
DB_USER="${DB_USER:-juexue}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/juexue}"
KEEP_DAYS="${KEEP_DAYS:-30}"
REMOTE_DEST="${REMOTE_DEST:-}"

LOG_FILE="${LOG_FILE:-/var/log/juexue-backup.log}"
TS=$(date +%Y%m%d-%H%M%S)
DATE=$(date +%Y-%m-%d)
DUMP_FILE="$BACKUP_DIR/juexue-$TS.sql.gz"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

mkdir -p "$BACKUP_DIR"
touch "$LOG_FILE" 2>/dev/null || true

log "=== backup start · DB=$DB_NAME → $DUMP_FILE ==="

# pg_dump · custom format 更紧凑且支持并行恢复 · 但 plain SQL 更可调试
# 用 plain + gzip · 体积接近 · 任何工具都能 zcat 看
if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-privileges --clean --if-exists \
    | gzip -9 > "$DUMP_FILE.tmp"; then
  log "ERROR: pg_dump 失败"
  rm -f "$DUMP_FILE.tmp"
  exit 1
fi

# 验证 dump 完整性 · 文件能解压 + 含 -- PostgreSQL database dump 头
if ! gzip -t "$DUMP_FILE.tmp" 2>/dev/null; then
  log "ERROR: 备份文件压缩损坏"
  rm -f "$DUMP_FILE.tmp"
  exit 2
fi
HEADER=$(zcat "$DUMP_FILE.tmp" 2>/dev/null | head -3 || true)
if ! echo "$HEADER" | grep -q "PostgreSQL database dump"; then
  log "ERROR: 备份文件格式异常 · 头部不含 'PostgreSQL database dump'"
  rm -f "$DUMP_FILE.tmp"
  exit 3
fi

mv "$DUMP_FILE.tmp" "$DUMP_FILE"
SIZE=$(du -h "$DUMP_FILE" | cut -f1)
log "OK: 写入 $DUMP_FILE ($SIZE)"

# 远端 rsync（可选）· 失败仅告警 · 不让本地备份成功被否决
if [ -n "$REMOTE_DEST" ]; then
  log "推送远端 $REMOTE_DEST..."
  if rsync -az --partial --timeout=300 "$DUMP_FILE" "$REMOTE_DEST"; then
    log "OK: 远端推送完成"
  else
    log "WARN: 远端推送失败 · 本地备份仍有效"
  fi
fi

# 旋转：删 KEEP_DAYS 之前的本地文件
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -name 'juexue-*.sql.gz' -mtime +"$KEEP_DAYS" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  log "旋转：删除 $DELETED 个超过 $KEEP_DAYS 天的旧备份"
fi

# 把 latest 软链 → 最新文件 · 方便 verify 脚本固定路径访问
ln -sfn "$(basename "$DUMP_FILE")" "$BACKUP_DIR/latest.sql.gz"
log "=== backup done ==="
