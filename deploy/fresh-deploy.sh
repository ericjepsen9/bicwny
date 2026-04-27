#!/usr/bin/env bash
# 觉学 · 一键全量部署 / 修复脚本
#
# 跑这个脚本会：
#   1. 备份当前 .env
#   2. 清空 juexue/，重新 git clone（含所有最新修复）
#   3. 还原 .env
#   4. 装依赖 + 同步 schema + 编译
#   5. 重启 pm2
#   6. 校验所有关键修复是否生效
#
# 用法：
#   bash deploy/fresh-deploy.sh
#
# 安全：
#   · 数据库不在项目目录里，不受影响
#   · 旧目录会被重命名为 juexue.bak.<时间戳>，不会真删

set -euo pipefail

PROJECT_PARENT=/home/ubuntu/projects
PROJECT_NAME=juexue
PROJECT_DIR=$PROJECT_PARENT/$PROJECT_NAME
BRANCH=claude/general-session-RTDyG
REPO=https://github.com/ericjepsen9/bicwny.git
ENV_BACKUP=/tmp/.env.juexue.deploy-backup

echo "═══════════════════════════════════════════════════"
echo "  觉学一键部署 · $(date)"
echo "═══════════════════════════════════════════════════"

# ── 1. 备份 .env ─────────────────────────────────
if [[ -f "$PROJECT_DIR/backend/.env" ]]; then
  cp "$PROJECT_DIR/backend/.env" "$ENV_BACKUP"
  echo "✅ [1/6] .env 已备份到 $ENV_BACKUP"
else
  # 也试试找最新的 .bak
  LATEST_BAK=$(ls -td $PROJECT_PARENT/$PROJECT_NAME.bak.* 2>/dev/null | head -1)
  if [[ -n "$LATEST_BAK" && -f "$LATEST_BAK/backend/.env" ]]; then
    cp "$LATEST_BAK/backend/.env" "$ENV_BACKUP"
    echo "✅ [1/6] .env 从 $LATEST_BAK 抢救备份"
  else
    echo "⚠️  [1/6] 没找到 .env，下面会用 .env.example 兜底（但你必须手动填值）"
  fi
fi

# ── 2. 重置项目目录 ─────────────────────────────────
if [[ -d "$PROJECT_DIR" ]]; then
  TS=$(date +%s)
  mv "$PROJECT_DIR" "$PROJECT_DIR.bak.$TS"
  echo "✅ [2/6] 旧目录 → $PROJECT_DIR.bak.$TS"
fi

# ── 3. clone 最新代码 ─────────────────────────────────
cd "$PROJECT_PARENT"
git clone -b "$BRANCH" "$REPO" "$PROJECT_NAME"
echo "✅ [3/6] git clone 完成 · 最新 commit: $(cd $PROJECT_DIR && git log --oneline -1)"

# ── 4. 还原 .env ─────────────────────────────────
if [[ -f "$ENV_BACKUP" ]]; then
  cp "$ENV_BACKUP" "$PROJECT_DIR/backend/.env"
  echo "✅ [4/6] .env 已还原"
else
  cp "$PROJECT_DIR/backend/.env.example" "$PROJECT_DIR/backend/.env"
  echo "⚠️  [4/6] 用 .env.example 兜底，请编辑 $PROJECT_DIR/backend/.env"
fi

# ── 5. 装依赖 + 编译 + 重启 ─────────────────────────────────
cd "$PROJECT_DIR/backend"
echo "    [5/6] 装依赖（pnpm install）..."
pnpm install --silent
echo "    [5/6] 同步 Prisma schema..."
pnpm prisma generate >/dev/null
pnpm prisma db push --skip-generate
echo "    [5/6] 编译..."
pnpm build
echo "    [5/6] 重启 pm2..."
pm2 restart juexue-api --update-env || pm2 start dist/server.js --name juexue-api --time
pm2 save
echo "✅ [5/6] 部署完成"

# ── 6. 自检 ─────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  自检 [6/6]"
echo "═══════════════════════════════════════════════════"

PASS=0; FAIL=0
check() {
  local name="$1" cmd="$2" expect="$3"
  local out
  out=$(eval "$cmd" 2>&1)
  if echo "$out" | grep -q "$expect"; then
    echo "  ✅ $name"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name → $out"
    FAIL=$((FAIL+1))
  fi
}

ADM=$PROJECT_DIR/prototypes/desktop/admin-courses.html
APP=$PROJECT_DIR/backend/src/app.ts
IMP=$PROJECT_DIR/backend/src/modules/courses/import.routes.ts

check "前端文件存在"          "test -f $ADM && echo OK"                                   "OK"
# 抽出 inline JS 用 node --check · 报错则输出 SyntaxError，下面用否定匹配
check "前端 inline JS 语法"   "python3 -c \"import re; print(''.join(re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>(.*?)</script>', open('$ADM').read(), re.DOTALL)))\" > /tmp/_jx.js 2>/dev/null && (node --check /tmp/_jx.js 2>&1 | grep -q SyntaxError && echo SYNTAX_ERR || echo SYNTAX_OK); rm -f /tmp/_jx.js" "SYNTAX_OK"
check "slug pattern 转义"     "grep -E 'pattern=\"\\[a-z0-9.\\-\\]\\+\"' $ADM | head -1"   "pattern"
check "autoGenSlug 函数"      "grep -c 'function autoGenSlug' $ADM"                       "1"
check "preview 限流 ≥ 120"    "grep -E 'max: (12|3)0[0-9]?,' $IMP | head -1"              "max:"
check "全局限流 ≥ 600"        "grep 'max: 600' $APP"                                       "max: 600"
check "Fastify bodyLimit"     "grep 'bodyLimit' $APP"                                      "bodyLimit"
check "后端 /health"          "curl -s --max-time 5 http://127.0.0.1:3001/health"          "ok"
check "HTTPS 静态文件 200"    "curl -sI https://juexue.caughtalert.com/prototypes/desktop/admin-courses.html | head -1" "200"
check "HTTPS API 401"         "curl -sI -X POST https://juexue.caughtalert.com/api/admin/courses/import-file/preview -H 'Authorization: Bearer fake' | head -1" "401"

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "🎉 全部 $PASS 项通过 · 可以正常使用"
  echo "    → 浏览器强制刷新 Ctrl+Shift+R · F12 console 应该没有 regex 报错"
else
  echo "❌ $FAIL 项失败 · 把上面输出贴回来排查"
  exit 1
fi
