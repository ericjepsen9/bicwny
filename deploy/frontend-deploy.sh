#!/usr/bin/env bash
# 前端原子部署（审计 5.3）
#   build → 时间戳 release 目录 → symlink 原子切换 → 保留最近 N 个
#
# 解决的问题：
#   原流程 `rsync -av --delete dist/ /var/www/juexue/app/` 是就地覆盖，
#   拷贝过程中用户会拿到半新半旧的资源（chunk hash 对不上 → 白屏/报错）；
#   且无法即时回滚。改为「新目录就绪后一次 symlink 切换」= 原子、可回滚。
#
# ⚠️ 一次性前置（把 app 改成 symlink · 需 sudo · 仅首次 · 之后本脚本自动维护）：
#   sudo mkdir -p /var/www/juexue/releases
#   sudo mv /var/www/juexue/app /var/www/juexue/releases/legacy   # 保留现有内容
#   sudo ln -sfn /var/www/juexue/releases/legacy /var/www/juexue/app
#   nginx root 仍指向 /var/www/juexue/app（现在是 symlink）· 无需改 nginx
#
# 用法：
#   bash deploy/frontend-deploy.sh
#
# ⚠️ 未在真实服务器验证 · 首次务必在 staging 跑通再上 prod。

set -euo pipefail

WEB_ROOT=${WEB_ROOT:-/var/www/juexue}
RELEASES="$WEB_ROOT/releases"
CURRENT="$WEB_ROOT/app"
KEEP=${KEEP:-5}
PROJECT_DIR=${PROJECT_DIR:-/home/ubuntu/projects/juexue}

if [ ! -L "$CURRENT" ] && [ -d "$CURRENT" ]; then
  echo "❌ $CURRENT 还不是 symlink · 请先按脚本头部「一次性前置」改造后再用本脚本"
  exit 1
fi

cd "$PROJECT_DIR/juexue-v2"
echo "▸ build（清旧 dist 防 vite 增量缓存）"
rm -rf dist
npm run build

TS=$(date +%Y%m%d-%H%M%S)
REL="$RELEASES/$TS"
echo "▸ 拷到新 release：$REL"
sudo mkdir -p "$REL"
sudo rsync -a --delete dist/ "$REL/"

echo "▸ 原子切换 symlink → $TS"
sudo ln -sfn "$REL" "$CURRENT"

echo "▸ 清理旧 release（保留最近 $KEEP 个 · 供回滚）"
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r sudo rm -rf

echo "✅ 前端已原子切到 $TS"
echo "    回滚：bash deploy/rollback-frontend.sh"
echo "    浏览器强刷（iOS Safari 长按刷新 / 无痕窗口）验证"
