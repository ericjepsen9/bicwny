// Playwright smoke test 配置
// 跑：npm run test:smoke
// 报告：playwright-report/index.html · nginx /dev/__test-report__/ 反代后可手机访问
//
// 假定：vite dev server 已在 5173 跑 + 后端在 3001 跑
// auth：tests/global-setup.ts 启动时调一次 /api/auth/login 拿 token
//       写到 .auth/admin.json (storageState) · 所有测试通过 storageState 复用
//       优点：不重复登录 · 不撞速率限制

import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/global-setup.ts'],

  // 启动时跑一次（登录 + 保存 storageState）
  globalSetup: './tests/global-setup.ts',

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
    actionTimeout: 8_000,
    navigationTimeout: 12_000,
    ignoreHTTPSErrors: true,
    // 自动加载登录态（globalSetup 写入的）
    storageState: path.resolve(__dirname, '.auth/admin.json'),
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});

