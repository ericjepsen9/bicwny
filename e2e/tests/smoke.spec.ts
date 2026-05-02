// 觉学 E2E smoke · 注册 → 主流程导航 → 登出
//
// 验收：
//   1. 打开 auth.html · 切到注册屏 · 提交 → 跳到 onboarding 或 home
//   2. 在 home / courses / quiz-center / profile tab 间切换无 JS 错
//   3. profile → settings → 登录设备 · 看到至少 1 条
//   4. 退出登录 → 回到 auth
import { expect, test } from '@playwright/test';

const TS = Date.now();
const TEST_EMAIL = `e2e-${TS}@itest.app`;
const TEST_PASSWORD = 'testpass123';
const TEST_DHARMA = 'E2E 同学';

test.beforeEach(async ({ page }) => {
  // 收集 console error · 任一非预期 error 直接 fail
  page.on('pageerror', (err) => {
    throw new Error(`page JS error: ${err.message}`);
  });
});

test('register → tab navigation → settings devices → logout', async ({ page }) => {
  // 1. 注册
  await page.goto('/mobile/auth.html');
  await expect(page.locator('h2, p').filter({ hasText: /欢迎回来|歡迎回來/ }).first()).toBeVisible();
  await page.locator('text=没有账号？注册, text=沒有帳號？註冊').first().click();
  await expect(page.locator('text=创建账号, text=建立帳號').first()).toBeVisible();
  await page.locator('#reg-dharma').fill(TEST_DHARMA);
  await page.locator('#reg-email').fill(TEST_EMAIL);
  await page.locator('#reg-password').fill(TEST_PASSWORD);
  await page.locator('#screen-register button[type="submit"]').click();

  // 2. 注册成功 → onboarding 或 home（账号默认 hasOnboarded=false → onboarding）
  await page.waitForURL(/(onboarding|home)\.html/, { timeout: 15_000 });
  // 如果在 onboarding · skip 它
  if (page.url().includes('onboarding')) {
    await page.locator('text=跳过, text=略過, text=完成').first().click({ trial: false }).catch(() => {});
    await page.waitForURL(/home\.html/, { timeout: 10_000 });
  }

  // 3. tab 切换
  await expect(page.locator('.tab-bar')).toBeVisible();
  for (const tab of ['法本', '答题', '我的']) {
    await page.locator(`.tab-bar a:has-text("${tab}")`).first().click();
    await page.waitForLoadState('domcontentloaded');
  }

  // 4. 进设置 · 看到登录设备入口
  // profile.html 上点 "设置" 入口
  await page.locator('a:has-text("设置"), a:has-text("設定")').first().click({ timeout: 5_000 }).catch(() => {});
  if (!page.url().includes('settings.html')) {
    await page.goto('/mobile/settings.html');
  }
  await page.locator('a:has-text("登录设备"), a:has-text("登入裝置")').first().click();
  await page.waitForURL(/devices\.html/);
  // 至少 1 个设备 · 标记当前
  await expect(page.locator('.device-card.current')).toBeVisible({ timeout: 10_000 });

  // 5. 登出
  await page.goto('/mobile/settings.html');
  page.on('dialog', (d) => d.accept()); // confirm 自动通过
  await page.locator('#btn-logout').click();
  await page.waitForURL(/auth\.html/, { timeout: 10_000 });
  await expect(page.locator('text=欢迎回来, text=歡迎回來').first()).toBeVisible();
});

test('login flow with existing user', async ({ page }) => {
  // 第一个测试已注册 · 这次直接登录
  await page.goto('/mobile/auth.html');
  await page.locator('#login-email').fill(TEST_EMAIL);
  await page.locator('#login-password').fill(TEST_PASSWORD);
  await page.locator('#screen-login button[type="submit"]').click();
  await page.waitForURL(/home\.html|onboarding\.html/, { timeout: 10_000 });
  await expect(page.locator('.tab-bar')).toBeVisible();
});
