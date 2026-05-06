// Playwright smoke test 配置
// 跑：npm run test:smoke
// 报告：playwright-report/index.html · nginx /dev/__test-report__/ 反代后可手机访问
//
// 假定：vite dev server 已在 5173 跑 + 后端在 3001 跑
// auth：依赖 backend .env 的 DEV_FAKE_USER_ID 自动绑定 user_admin_001（admin 角色）

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // 整个测试套超时 60s · 单个 test 超时 15s
  timeout: 15_000,
  expect: { timeout: 5_000 },

  // 失败时重试 1 次（dev server 偶尔慢）
  retries: 1,

  // 单个 worker 跑 · 共享 vite 端口避免冲突
  workers: 1,
  fullyParallel: false,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    // dev mode 通过 nginx /dev/ 反代访问 · 让浏览器看到的 base 跟用户实际一致
    baseURL: 'https://juexue.caughtalert.com/dev',
    headless: true,
    // 失败时截图 + trace · 报告里能看到出错时的页面
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // 把每个 step 都加日志（行内打印）
    actionTimeout: 8_000,
    navigationTimeout: 12_000,
    // 本地自签证书 OK
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
