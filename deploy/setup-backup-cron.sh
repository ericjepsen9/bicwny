#!/usr/bin/env bash
# 觉学 · 一键安装备份 cron
#   - 03:00 daily · db-backup.sh
#   - 04:00 Sunday · db-restore-verify.sh
#   - 失败 cron 通过 MAILTO 邮件告警（前提：服务器配了 sendmail / postfix）
#   - 重复执行幂等 · 自动覆盖旧 entry
#
# 用法（root 或 juexue 用户都行 · 推荐 root 让备份目录权限简单）：
#   sudo bash deploy/setup-backup-cron.sh

set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_SH="$REPO_DIR/deploy/db-backup.sh"
VERIFY_SH="$REPO_DIR/deploy/db-restore-verify.sh"
ENV_FILE="${ENV_FILE:-$REPO_DIR/backend/.env}"

if [ ! -f "$BACKUP_SH" ] || [ ! -f "$VERIFY_SH" ]; then
  echo "ERROR: 找不到 $BACKUP_SH 或 $VERIFY_SH"
  exit 1
fi
chmod +x "$BACKUP_SH" "$VERIFY_SH"

# cron 不带 .env · 用 wrapper 把环境变量灌进来
WRAPPER_DIR="${WRAPPER_DIR:-/etc/juexue}"
mkdir -p "$WRAPPER_DIR"

# 从 .env 提取 Postgres 连接配置 · 转成 cron 用的环境变量
#   假设 DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DB?...
DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)
if [ -z "$DB_URL" ]; then
  echo "WARN: 没读到 DATABASE_URL · 后续 cron 跑会用脚本默认值（juexue/juexue@localhost:5432）"
fi
PARSE_PY=$(cat <<'PY'
import os, sys, urllib.parse
u = sys.argv[1]
if not u.startswith('postgres'):
    sys.exit(0)
p = urllib.parse.urlparse(u)
print(f"DB_USER={p.username or 'juexue'}")
print(f"PGPASSWORD={p.password or ''}")
print(f"DB_HOST={p.hostname or 'localhost'}")
print(f"DB_PORT={p.port or 5432}")
print(f"DB_NAME={(p.path or '/juexue').lstrip('/').split('?')[0]}")
PY
)
ENV_EXPORT=$(python3 -c "$PARSE_PY" "$DB_URL" 2>/dev/null || true)

cat > "$WRAPPER_DIR/backup-env.sh" <<EOF
#!/usr/bin/env bash
# 自动生成 by setup-backup-cron.sh · cron 任务读取
$ENV_EXPORT
export DB_USER PGPASSWORD DB_HOST DB_PORT DB_NAME
export BACKUP_DIR=/var/backups/juexue
export KEEP_DAYS=30
export LOG_FILE=/var/log/juexue-backup.log
EOF
chmod 600 "$WRAPPER_DIR/backup-env.sh"
echo "已写入 $WRAPPER_DIR/backup-env.sh（含 PGPASSWORD · 权限 600）"

# 备份目录 + 日志预创建
mkdir -p /var/backups/juexue
touch /var/log/juexue-backup.log
chmod 644 /var/log/juexue-backup.log 2>/dev/null || true

# 写 cron 文件 · 放到 /etc/cron.d/juexue-backup · 不污染用户 crontab
CRON_FILE="/etc/cron.d/juexue-backup"
CURRENT_USER=$(id -un)
cat > "$CRON_FILE" <<EOF
# 觉学 · 自动备份与验证 · 由 setup-backup-cron.sh 维护
# 失败时邮件告警（需服务器配 MTA · 可在此覆盖 MAILTO）
MAILTO=root
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# 每日 03:00 备份
0 3 * * * $CURRENT_USER source $WRAPPER_DIR/backup-env.sh && $BACKUP_SH

# 每周日 04:00 验证最新备份能恢复（备份能 dump 不等于能 restore）
0 4 * * 0 $CURRENT_USER source $WRAPPER_DIR/backup-env.sh && $VERIFY_SH
EOF
chmod 644 "$CRON_FILE"
echo "已写入 cron $CRON_FILE"
echo
echo "✅ 安装完成 · 备份 03:00 · 验证 周日 04:00"
echo "立即测试备份：source $WRAPPER_DIR/backup-env.sh && $BACKUP_SH"
echo "查看日志：tail -f /var/log/juexue-backup.log"
