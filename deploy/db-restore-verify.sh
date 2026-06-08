#!/usr/bin/env bash
# 觉学 · 备份恢复验证脚本
#   把最新备份恢复到一个临时库 · 跑健康检查 · 然后 drop · 验证完整链路可用
#   备份能 dump 不等于能 restore · 真出事故时才发现备份坏 → 灾难
#   Cron 每周跑一次 · 失败直接告警 · 不要等真灾难才知道
#
# 配置（可通过 env 覆盖）：
#   DB_USER, DB_HOST, DB_PORT, PGPASSWORD  同 db-backup.sh
#   BACKUP_DIR              · 默认 /var/backups/juexue
#   VERIFY_DB               临时验证库名 · 默认 juexue_verify
#   BACKUP_FILE             指定文件 · 默认 latest.sql.gz
#   MIN_USER_COUNT          User 表至少行数 · 低于报错（防数据丢失）· 默认 1
#
# 退出码：0=备份可恢复 · 非 0=验证失败（应立即告警）

set -euo pipefail

DB_USER="${DB_USER:-juexue}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/juexue}"
VERIFY_DB="${VERIFY_DB:-juexue_verify}"
BACKUP_FILE="${BACKUP_FILE:-$BACKUP_DIR/latest.sql.gz}"
MIN_USER_COUNT="${MIN_USER_COUNT:-1}"

LOG_FILE="${LOG_FILE:-/var/log/juexue-backup.log}"
log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] [verify] $*" | tee -a "$LOG_FILE"; }

if [ ! -f "$BACKUP_FILE" ]; then
  # latest 软链可能解析为相对路径 · 验文件本身或软链是否存在
  if [ ! -L "$BACKUP_FILE" ]; then
    log "ERROR: 备份文件不存在 $BACKUP_FILE"
    exit 1
  fi
fi
RESOLVED=$(readlink -f "$BACKUP_FILE" 2>/dev/null || echo "$BACKUP_FILE")
log "=== verify start · 文件 $RESOLVED → 临时库 $VERIFY_DB ==="

# 确保临时库不存在（旧的 verify 残留要清掉）
PSQL_OPTS="-h $DB_HOST -p $DB_PORT -U $DB_USER -v ON_ERROR_STOP=1 -X -q"
log "drop 旧 $VERIFY_DB（若有）"
psql $PSQL_OPTS -d postgres -c "DROP DATABASE IF EXISTS $VERIFY_DB;" || {
  log "ERROR: drop 旧库失败 · 可能有连接占用"
  exit 2
}
log "create 新 $VERIFY_DB"
psql $PSQL_OPTS -d postgres -c "CREATE DATABASE $VERIFY_DB;" || {
  log "ERROR: create 新库失败"
  exit 3
}

# 恢复 · zcat → psql · 失败立即停（ON_ERROR_STOP）
log "restore 中..."
if ! zcat "$RESOLVED" | psql $PSQL_OPTS -d "$VERIFY_DB" >/dev/null 2>&1; then
  log "ERROR: restore 失败 · 备份可能损坏"
  psql $PSQL_OPTS -d postgres -c "DROP DATABASE IF EXISTS $VERIFY_DB;" || true
  exit 4
fi
log "OK: restore 完成"

# 健康检查 · 至少要满足：
#   1) "User" 表存在且 count >= MIN_USER_COUNT
#   2) 关键表都能 SELECT（schema 没破）
SAFE_TABLES=("User" "Course" "Question" "AuditLog")
ALL_OK=1
for tbl in "${SAFE_TABLES[@]}"; do
  CNT=$(psql $PSQL_OPTS -d "$VERIFY_DB" -t -c "SELECT count(*) FROM \"$tbl\";" 2>/dev/null | tr -d ' \n' || echo "ERROR")
  if [ "$CNT" = "ERROR" ] || [ -z "$CNT" ]; then
    log "ERROR: 表 $tbl 无法查询"
    ALL_OK=0
  else
    log "OK: $tbl count=$CNT"
    if [ "$tbl" = "User" ] && [ "$CNT" -lt "$MIN_USER_COUNT" ]; then
      log "ERROR: User 表行数 $CNT < $MIN_USER_COUNT · 备份可能不完整"
      ALL_OK=0
    fi
  fi
done

# 清理临时库
log "drop 临时 $VERIFY_DB"
psql $PSQL_OPTS -d postgres -c "DROP DATABASE IF EXISTS $VERIFY_DB;" || true

if [ "$ALL_OK" = "1" ]; then
  log "=== verify PASS · 备份 $RESOLVED 可恢复 ==="
  exit 0
else
  log "=== verify FAIL · 备份 $RESOLVED 健康检查未通过 ==="
  exit 5
fi
