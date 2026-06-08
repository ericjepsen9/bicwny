# Smoke Tests · Playwright 自动化

> 跑一条命令 · 浏览器自动跑过 8-10 个关键页面 · 1-2 分钟出报告（含截图 + console 错误）。

---

## 一次性设置（5 分钟）

### 1. 装 Chromium（约 300MB）

```bash
cd /home/ubuntu/projects/juexue/juexue-v2
npx playwright install chromium
```

如果报 `Failed to install browsers · Permission denied` · 用 sudo · 或 `--with-deps` 跳过系统库（如果之前已经装过 nginx / certbot 等通常已经够了）。

### 2. nginx 加测试报告反代（让你手机能看 HTML 报告）

```bash
sudo tee /etc/nginx/snippets/juexue-test-report.conf > /dev/null <<'EOF'
# Smoke test 报告 · 仅 dev 用 · 上线前删
location /dev/__test-report__/ {
  alias /home/ubuntu/projects/juexue/juexue-v2/playwright-report/;
  index index.html;
  autoindex on;
}
EOF
```

把 `include /etc/nginx/snippets/juexue-test-report.conf;` 加到 `/etc/nginx/sites-enabled/juexue` 的 `server { ... }` 块里 · `nginx -t && systemctl reload nginx`。

或者手动加这一段也行（功能等价）。

---

## 日常使用

### 跑测试

```bash
cd /home/ubuntu/projects/juexue/juexue-v2

# 完整流程：拉新代码 + 跑测试（不含 visual · 默认）
npm run verify

# 仅跑 smoke + 交互（52 tests · 不含 visual）
npm run test:smoke

# 仅跑 visual 回归（5 tests · 与 baseline 比对）
npm run test:visual

# 视觉变化预期 / 首次设置 baseline · 更新 snapshot
npm run test:visual:update

# 全跑（含 visual · 57 tests）
npm run test:all
```

**预期输出**：
```
> playwright test --reporter=list

Running 10 tests using 1 worker
  ✓ 首页 /app/ → 重定向到 auth 或 home (1.2s)
  ✓ Admin 法本管理页 · 列表加载 (0.8s)
  ✓ Admin 用户管理页 · 列表 + total 显示 (1.1s)
  ✓ Admin 班级管理页 · 列表 + 过滤按钮 (0.9s)
  ✗ Admin 观修管理页 · 列表加载 (timed out)
  ...

  9 passed, 1 failed (12.3s)

  Serving HTML report at http://localhost:9323
```

### 看报告（手机）

打开浏览器：

```
https://juexue.caughtalert.com/dev/__test-report__/
```

每个测试一行 · 失败的可点开看：
- 截图（失败前最后一帧）
- console 错误日志
- network 请求历史
- trace（完整重播）

---

## 测试覆盖范围

按文件划分（共 57 tests · 6 spec 文件）：

**`smoke.spec.ts`** · 10 个核心 admin smoke
- 首页 · admin 总览 / 法本 / 用户 / 班级 / 观修 / 题目审核 · 学员法本目录
- 班级抽屉编辑按钮 · 用户抽屉重置密码

**`student.spec.ts`** · 19 个学员端静态路由
- HomePage / CoursesPage / QuizCenterPage / ProfilePage / ScriptureDetailPage
- QuizPage(practice) / MistakesPage / FavoritesPage / Sm2ReviewPage
- NotificationPage / AchievementPage / SettingsPage / DevicesPage
- AboutPage / JoinClassPage / ProfileEditPage / HelpPage / TermsPage / PrivacyPage

**`student-flow.spec.ts`** · 6 个学员端动态 ID 路由
- /class/:id · /class/:id/meditations · /meditation/:id
- /read/:slug/:lessonId · /quiz/:lessonId · /mistake/:questionId
- 先调 API 拿真实 ID · 没数据 test.skip

**`admin-coach.spec.ts`** · 11 个 admin/coach 补全
- Admin: LLM / Reports / Audit / Logs
- Coach: Dashboard / Students / Questions / QuestionNew / QuestionImport / QuestionGenerate / Courses

**`interaction.spec.ts`** · 6 个交互流（仅 UI 状态机 · 不写入数据）
- 新建法本 dialog 开/关 · 法本编辑器进入 · 用户抽屉打开
- 班级过滤切换 · 观修编辑器进入 · 法本目录 → 详情 navigation

**`visual.spec.ts`** · 5 个视觉回归（默认不跑 · `npm run test:visual` 显式触发）
- HomePage / AdminCoursesPage / AdminClassesPage / AdminUsersPage / ProfilePage

**所有测试都做的事**：
- 加载页面
- 等 networkidle
- 验关键元素可见
- **检查 console 无 error（已忽略已知 noise · 浏览器扩展 / PWA manifest 等）**
- 失败自动截图

**所有测试都不做**：
- 不创建数据
- 不删除数据
- 不修改数据
- 仅 read-only · 防污染 dev 环境

---

## auth · 怎么登录的

测试需要 admin 凭证 · 写到 `juexue-v2/.env.test`（已 gitignored · 不会提交）：

```bash
cd /home/ubuntu/projects/juexue/juexue-v2
cat > .env.test <<EOF
TEST_ADMIN_EMAIL=你的admin邮箱
TEST_ADMIN_PASSWORD=你的admin密码
EOF
chmod 600 .env.test
```

测试启动时会自动调 `/api/auth/login` 拿真 access token · 写到浏览器 localStorage 模拟登录态。

**注意**：不要把这个文件提交到 git · `.gitignore` 已忽略。

---

## 升级到全自动（可选）

如果想**我每次 push 自动验证**（不用你跑命令）· 加 cron 5 分钟轮询：

```bash
# 写脚本
sudo tee /home/ubuntu/scripts/auto-verify.sh > /dev/null <<'EOF'
#!/bin/bash
cd /home/ubuntu/projects/juexue/juexue-v2 || exit 1
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/claude/audit-page-quality-EpO7Q)
if [ "$LOCAL" = "$REMOTE" ]; then exit 0; fi
git pull origin claude/audit-page-quality-EpO7Q
npx playwright test --reporter=list >> /var/log/juexue-tests.log 2>&1
EOF
chmod +x /home/ubuntu/scripts/auto-verify.sh

# 加 cron
crontab -e
# 加一行：
# */5 * * * * /home/ubuntu/scripts/auto-verify.sh
```

之后我每次 push · 5 分钟内你 `/dev/__test-report__/` 自动更新。看 `tail -f /var/log/juexue-tests.log` 实时 log。

---

## 故障排查

**`npx playwright install chromium` 卡在下载**
- 网络问题 · 重试
- 用国内镜像：`PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright npx playwright install chromium`

**测试都失败 · 报「target closed」/ 「browser disconnected」**
- 服务器内存不足 · `free -h` 看一下 · vite + chromium 可能要 2GB+
- 关掉其他 pm2 进程腾内存 · 或加 swap

**报告 404**
- 没装 nginx 反代 · 或 `playwright-report/` 目录还没生成（先跑 test 才会生成）
- 也可以本机 ssh tunnel：`ssh -L 9323:localhost:9323 user@server` · 然后浏览器 localhost:9323

**console error 太多 · 不知道哪些是真错**
- 看 `tests/smoke.spec.ts:14` 的 `ignore` 数组 · 把已知 noise 加进去

---

## 让你不用手动跑这条命令的最低门槛

你可以把这一行加到 .bashrc · 起一个短别名：

```bash
echo "alias jv='cd /home/ubuntu/projects/juexue/juexue-v2 && npm run verify'" >> ~/.bashrc
source ~/.bashrc
```

之后任何时候 ssh 进服务器 · 输入 `jv` · 一键 pull + test。
