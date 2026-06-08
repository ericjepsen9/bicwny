#!/usr/bin/env bash
# 前端回滚（审计 5.3）：把 app symlink 切回上一个 release
#
# 配合 frontend-deploy.sh 的版本化 release 目录使用。
# 用法：bash deploy/rollback-frontend.sh
#
# ⚠️ 未在真实服务器验证 · 首次在 staging 跑通再用。

set -euo pipefail

WEB_ROOT=${WEB_ROOT:-/var/www/juexue}
RELEASES="$WEB_ROOT/releases"
CURRENT="$WEB_ROOT/app"

if [ ! -L "$CURRENT" ]; then
  echo "❌ $CURRENT 不是 symlink · 无法用本脚本回滚（见 frontend-deploy.sh 前置）"
  exit 1
fi

cur=$(readlink -f "$CURRENT" || true)

# 按修改时间倒序列出所有 release
mapfile -t rels < <(ls -1dt "$RELEASES"/*/ 2>/dev/null)
if [ "${#rels[@]}" -lt 2 ]; then
  echo "❌ 没有可回滚的上一个 release（当前仅 ${#rels[@]} 个）"
  exit 1
fi

# 找第一个不同于「当前」的 release = 上一个
prev=""
for r in "${rels[@]}"; do
  rr=$(readlink -f "$r")
  if [ "$rr" != "$cur" ]; then prev="$rr"; break; fi
done

if [ -z "$prev" ]; then
  echo "❌ 找不到不同于当前的 release"
  exit 1
fi

echo "▸ 当前：$cur"
echo "▸ 回滚 → $prev"
sudo ln -sfn "$prev" "$CURRENT"
echo "✅ 已回滚 · 浏览器强刷验证"
