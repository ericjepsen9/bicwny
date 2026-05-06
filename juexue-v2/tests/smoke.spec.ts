// 觉学 smoke 测试 · 关键路径页面渲染 + 核心交互
//
// 设计原则：
//   - 不创造 / 不删数据（避免污染 dev 环境）
//   - 仅 read + 渲染 / UI 检查
//   - 任何 console error → 整个测试 fail
//   - 失败自动截图 + trace · playwright-report/ 里看
//
// auth：依赖 DEV_FAKE_USER_ID（已在 .env · 当前是 user_admin_001）
//       backend 自动把无 token 的请求绑定到该用户

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

// 关键页面渲染必须无 console error
function attachConsoleAssert(page: Page, ignoredPatterns: RegExp[] = []): string[] {
  const errors: string[] = [];
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // 忽略已知 noise（浏览器扩展 / PWA manifest 等）
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
  test('首页 /app/ → 重定向到 auth 或 home', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/');
    // 等到 React 渲染完
    await page.waitForLoadState('networkidle');
    // 应该见到 auth 表单的 email 输入 OR 已登录的主页内容
    const isAuthOrHome = await page.locator('input[type="email"], main, [role="main"]').first().isVisible().catch(() => false);
    expect(isAuthOrHome).toBeTruthy();
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 法本管理页 · 列表加载', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/courses');
    await page.waitForLoadState('networkidle');
    // 顶部标题应可见
    await expect(page.getByText('法本管理')).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 用户管理页 · 列表 + total 显示', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/users');
    await page.waitForLoadState('networkidle');
    // 顶部「N 用户」格式 · total 必须 > 0（DEV_FAKE_USER 至少自己 1 条）
    const subtitle = page.locator('.page-sub').first();
    await expect(subtitle).toBeVisible({ timeout: 10_000 });
    const text = await subtitle.textContent();
    expect(text).toMatch(/\d+/);  // 至少含数字
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 班级管理页 · 列表 + 过滤按钮', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/classes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('班级管理')).toBeVisible({ timeout: 10_000 });
    // 三个状态过滤按钮
    await expect(page.getByRole('button', { name: '全部' })).toBeVisible();
    await expect(page.getByRole('button', { name: '活跃' })).toBeVisible();
    await expect(page.getByRole('button', { name: '已归档' })).toBeVisible();
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 观修管理页 · 列表加载', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/meditations');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('观修管理')).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 总览 dashboard · 渲染', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.shell .main').first()).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('学员侧 · 法本目录页 · 课时行', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    // dev_user 应该已加入至少 1 个法本 · 用 /courses 开始
    await page.goto('/app/courses');
    await page.waitForLoadState('networkidle');
    // 应能看到法本卡片或空态文案
    const ok = await page.locator('main, [role="main"], .scroll-area').first().isVisible().catch(() => false);
    expect(ok).toBeTruthy();
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 题目审核页 · 列表 / 空态', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/review');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/题目审核|无待审/)).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});

test.describe('UI · 关键交互', () => {
  test('班级详情抽屉 · 编辑按钮可见（活跃班级）', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/classes');
    await page.waitForLoadState('networkidle');
    // 切到「活跃」过滤
    await page.getByRole('button', { name: '活跃' }).click();
    // 找第一个班级卡片 · 点开
    const firstCard = page.locator('[class*="glass-card"]').filter({ hasText: /[一-龥]/ }).nth(1);
    if (await firstCard.count() > 0) {
      await firstCard.click();
      // 抽屉应打开 · 「编辑」按钮可见
      await expect(page.getByRole('button', { name: '编辑' }).first()).toBeVisible({ timeout: 5_000 });
    }
    // 班级数据 0 时不报错也算通过
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('用户管理抽屉 · 重置密码按钮可见', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/users');
    await page.waitForLoadState('networkidle');
    // 点第一行用户
    const firstRow = page.locator('tbody tr, [role="row"]').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      // 抽屉应包含「重置密码」按钮
      await expect(page.getByRole('button', { name: /重置密码/ })).toBeVisible({ timeout: 5_000 });
    }
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});
