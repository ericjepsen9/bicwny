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
      // CI 用 pnpm start（dist · 启动快）· 本地 pnpm dev（tsx watch · 改动即热重载）
      command: `cd ../backend && ${process.env.BACKEND_START_CMD || 'pnpm dev'}`,
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development', // localhost 走开发模式 · CORS 全开
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
