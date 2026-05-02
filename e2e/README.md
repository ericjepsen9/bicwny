# 觉学 E2E（Playwright）

跑端到端 smoke test · 验证注册 → 导航 → 登出全流程不挂。

## 一次性安装

```bash
cd e2e
pnpm install
npx playwright install --with-deps chromium
```

## 启动

```bash
# 1) 准备：本地 Postgres 起着，backend 能 prisma db push 通
#    （否则 webServer 启 backend 会失败）
# 2) 跑测试 · 自动启 backend (:3000) + http-server (:5173)
cd e2e
pnpm test
```

完成后报告：`e2e/playwright-report/index.html` · `pnpm report` 在浏览器打开。

## CI 模式

```bash
CI=1 pnpm test
```

`reuseExistingServer=false` · 每次都重新拉服务 · retries=1 · 输出 html + list。

## 写新 spec

```bash
# 录制器（最快上手）：
npx playwright codegen http://localhost:5173/mobile/auth.html

# 写完后保存到 tests/<name>.spec.ts · 直接 pnpm test 跑
```

## 当前覆盖

- `smoke.spec.ts`: 注册 → tab 切换 → 设置 → 登录设备 → 登出 + 再登录

## 后续可加

- 报名法本 + 阅读 + 提交答题
- 错题本流转
- 班级加入
- 设置项（推送 toggle / 字号）
- admin 后台审核
