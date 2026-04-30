// 觉学 E2E · Playwright 配置
//   - 自动启动两个进程：backend (:3000) + 静态 http-server (:5173)
//   - 默认 chromium · iPhone 13 viewport（mobile-first）
//   - 测试根 URL: http://localhost:5173 → 路径如 /mobile/auth.html
//
// 跑：
//   cd e2e && pnpm install
//   npx playwright install --with-deps chromium
//   pnpm test           # 命令行
//   pnpm test:ui        # 交互式
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.JX_E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // 共享 DB · 串行避免冲突
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 8_000,
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  // 自动启动 server · 跑完后 kill
  webServer: [
    {
      command: 'cd ../backend && pnpm dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        // dev 默认值 · 仅 E2E 显式覆盖时改这里
        NODE_ENV: 'development',
      },
    },
    {
      command: 'npx http-server ../prototypes -p 5173 -c-1 --cors -s',
      url: 'http://localhost:5173/mobile/auth.html',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
