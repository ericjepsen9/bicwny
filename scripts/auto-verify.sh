#!/bin/bash
# 自动验测 · cron 每 5 分钟跑一次
#   任务：检查 origin 是否有新 commit · 有就 pull + 跑 smoke · 写日志
#   日志：~/logs/juexue-tests.log（超过 5MB 自动截断保留尾 2MB）
#   锁：/tmp/juexue-verify.lock 防并发
#
# 安装：
#   ln -sf /home/ubuntu/projects/juexue/scripts/auto-verify.sh /home/ubuntu/scripts/auto-verify.sh
#   chmod +x /home/ubuntu/projects/juexue/scripts/auto-verify.sh
#   crontab -e
#     */5 * * * * /home/ubuntu/scripts/auto-verify.sh
#
# 看日志：tail -f ~/logs/juexue-tests.log

REPO=/home/ubuntu/projects/juexue
PROJ=$REPO/juexue-v2
BRANCH=claude/audit-page-quality-EpO7Q
LOG_DIR=$HOME/logs
LOG=$LOG_DIR/juexue-tests.log
LOCK=/tmp/juexue-verify.lock

mkdir -p "$LOG_DIR"

# 锁防并发
exec 200>"$LOCK"
flock -n 200 || { echo "[$(date -Is)] skip · 上一次还没跑完" >> "$LOG"; exit 0; }

cd "$REPO" || { echo "[$(date -Is)] ✗ 无法 cd $REPO" >> "$LOG"; exit 1; }

# 用 ssh remote 时需要 ssh agent / 已配 key · 见 docs/SMOKE-TESTS.md
git fetch origin "$BRANCH" --quiet 2>>"$LOG" || {
  echo "[$(date -Is)] ✗ git fetch 失败" >> "$LOG"
  exit 1
}

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
if [ "$LOCAL" = "$REMOTE" ]; then
  # 无变化 · 静默退出
  exit 0
fi

{
  echo ""
  echo "════════════════════════════════════════════"
  echo "[$(date -Is)] 新 commit ${LOCAL:0:8} → ${REMOTE:0:8}"
  echo "────────────────────────────────────────────"
} >> "$LOG"

git pull origin "$BRANCH" --quiet >> "$LOG" 2>&1

cd "$PROJ" || { echo "[$(date -Is)] ✗ 无法 cd $PROJ" >> "$LOG"; exit 1; }

# 跑 smoke（含交互 · 不含 visual · 跑 ~1.5 分钟）
npm run test:smoke >> "$LOG" 2>&1
EXIT=$?

if [ $EXIT -eq 0 ]; then
  echo "[$(date -Is)] ✓ 全过" >> "$LOG"
else
  echo "[$(date -Is)] ✗ 失败 exit=$EXIT · 看报告 https://juexue.caughtalert.com/dev/__test-report__/" >> "$LOG"
fi

# 日志超过 5MB → 截断保留尾 2MB
SIZE=$(stat -c%s "$LOG" 2>/dev/null || echo 0)
if [ "$SIZE" -gt 5242880 ]; then
  tail -c 2M "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  echo "[$(date -Is)] (日志已截断 · 保留尾 2MB)" >> "$LOG"
fi
