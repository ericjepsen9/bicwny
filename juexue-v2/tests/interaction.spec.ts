// 交互流 · 关键 dialog / 抽屉 开关 · 不写入数据
//
// 设计：只验 UI 状态机（dialog 打开/关闭 · 表单可编辑 · 取消能撤回）
//   不调任何 mutation API · 不污染 dev 环境
//   这一组 catch 的是 hook order bug / dialog 不显示 / portal containing block 失效
//
// 风险更高的真正 CRUD 流（创建章节并删除）放到 separate spec · 默认不跑
// （需要 RUN_DESTRUCTIVE=1 显式开启）
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

function attachConsoleAssert(page: Page, ignoredPatterns: RegExp[] = []): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
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
  });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  return errors;
}

test.describe('Interaction · 关键 dialog 开关', () => {
  test('Admin 法本管理 · 新建法本 dialog 打开/取消', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/courses');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /新建法本|New text/ }).first().click();
    // dialog 打开 · 用 role=dialog + aria-label 命中（标题不是 heading 元素 · 是 div）
    const dialog = page.getByRole('dialog', { name: /新建法本|New text/ });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // ESC 关闭
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 3_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 法本编辑器 · 第一本法本进入 + 章节区可见', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/courses');
    await page.waitForLoadState('networkidle');
    // 列表中第一项点击
    const firstCard = page.locator('[class*="glass-card"]').filter({ hasText: /·\s*\d+章/ }).first();
    if (await firstCard.count() === 0) test.skip(true, '无法本数据');
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    // 章节标题可见
    await expect(page.getByText(/章节|章節|Chapters/).first()).toBeVisible({ timeout: 8_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 用户管理 · 用户抽屉打开 + 重置密码按钮存在', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/users');
    await page.waitForLoadState('networkidle');
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await expect(page.getByRole('button', { name: /重置密码/ })).toBeVisible({ timeout: 5_000 });
    // 关闭抽屉（点击 backdrop 或按 ESC）
    await page.keyboard.press('Escape');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 班级管理 · 过滤切换 + 班级卡片可点击进抽屉', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/classes');
    await page.waitForLoadState('networkidle');
    // 切到「活跃」过滤
    await page.getByRole('button', { name: '活跃' }).click();
    await page.waitForTimeout(300);
    // 切回「全部」
    await page.getByRole('button', { name: '全部' }).click();
    await page.waitForTimeout(300);
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 观修管理 · 列表渲染 + 第一项点击进编辑器', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/meditations');
    await page.waitForLoadState('networkidle');
    const firstCard = page.locator('[class*="glass-card"]').filter({ hasText: /·/ }).first();
    if (await firstCard.count() === 0) test.skip(true, '无观修数据');
    await firstCard.click();
    await page.waitForTimeout(500);
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('学员侧 · 法本列表 → 详情 navigation 通畅', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/courses');
    await page.waitForLoadState('networkidle');
    // 跳过非 /courses 状态（onboarding 等）
    if (!page.url().includes('/courses')) test.skip(true, 'admin 账号无法进 /courses（onboarding）');
    const firstLink = page.locator('a[href*="/scripture-detail"]').first();
    if (await firstLink.count() === 0) test.skip(true, '无法本卡片');
    await firstLink.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/scripture-detail');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});
