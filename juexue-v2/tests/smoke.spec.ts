// 觉学 smoke 测试 · 关键路径页面渲染 + 核心交互
//
// auth：playwright.config.ts use.storageState 自动加载已登录态
//       登录由 tests/global-setup.ts 启动一次完成 · 不撞速率限制
//
// 设计原则：
//   - 不创造 / 不删数据（避免污染 dev 环境）
//   - 仅 read + 渲染 / UI 检查
//   - 任何 console error → 测试 fail（已忽略已知 noise）
//   - 失败自动截图 + trace · playwright-report/ 里看

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

function attachConsoleAssert(page: Page, ignoredPatterns: RegExp[] = []): string[] {
  const errors: string[] = [];
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const ignore = [
      /Permissions-Policy header.*Unrecognized feature/,
      /manifest\.webmanifest.*Syntax error/,
      /AbortError: signal is aborted without reason/,
      ...ignoredPatterns,
    ];
    if (ignore.some((re) => re.test(text))) return;
    errors.push(text);
  };
  page.on('console', onConsole);
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  return errors;
}

test.describe('Smoke · 关键页面无 console error + 关键元素可见', () => {
  test('首页 /app/ → 已登录跳到主页', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/auth');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 法本管理页 · 列表加载', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/courses');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '法本管理' })).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 用户管理页 · 列表 + total 显示', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/users');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible({ timeout: 10_000 });
    const userRows = page.locator('tbody tr');
    expect(await userRows.count()).toBeGreaterThan(0);
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 班级管理页 · 列表 + 过滤按钮', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/classes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '班级管理' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '全部' })).toBeVisible();
    await expect(page.getByRole('button', { name: '活跃' })).toBeVisible();
    await expect(page.getByRole('button', { name: '已归档' })).toBeVisible();
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 观修管理页 · 列表加载', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/meditations');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '观修管理' })).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 总览 dashboard · 渲染', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/app/admin');
    expect(page.url()).not.toContain('/auth');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('学员侧 · 法本目录页 · 渲染', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/courses');
    await page.waitForLoadState('networkidle');
    // admin 账号可能没完成 onboarding · 接受 /courses 或 /onboarding 都视作页面正常加载
    // 关键是没退到 /auth · 也没抛 console error
    expect(page.url()).not.toContain('/auth');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 题目审核页 · 列表 / 空态', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/review');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '题目审核' })).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});

test.describe('UI · 关键交互', () => {
  test('班级详情抽屉 · 编辑按钮可见（活跃班级）', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/classes');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '活跃' }).click();
    const firstCard = page.locator('[class*="glass-card"]').filter({ hasText: /[一-龥]/ }).nth(1);
    if (await firstCard.count() > 0) {
      await firstCard.click();
      await expect(page.getByRole('button', { name: '编辑' }).first()).toBeVisible({ timeout: 5_000 });
    }
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('用户管理抽屉 · 重置密码按钮可见', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/users');
    await page.waitForLoadState('networkidle');
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await expect(page.getByRole('button', { name: /重置密码/ })).toBeVisible({ timeout: 5_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});
