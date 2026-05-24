// 流程录像 · 真实用户路径走一遍 · 录视频 + trace · 失败/成功都能回放
//
// 跑：npm run flows
// 看：playwright-report/index.html → 任一 case → Trace Viewer / Video
//
// 设计：
//   - 大多 read-only · 不污染 dev 数据
//   - admin CRUD 流（建/删）只在 RUN_DESTRUCTIVE=1 时跑
//   - 每条流都做 console error 检测
//   - 视频 + trace always on（不只失败时）
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

// 录像/trace 强制全开
test.use({ video: 'on', trace: 'on' });

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

test.describe('Journey · 学员日常路径', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('学员首页 → 个人 → 设置 三跳', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/');
    await page.waitForLoadState('networkidle');

    // 进个人页（通过底部 nav 或头像）
    await page.goto('/dev/app/profile');
    await page.waitForLoadState('networkidle');

    // 进设置
    await page.getByRole('link', { name: /设置|Settings/ }).first().click().catch(async () => {
      await page.goto('/dev/app/settings');
    });
    await page.waitForLoadState('networkidle');

    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('学员选法本 → 详情 → 阅读', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/courses');
    await page.waitForLoadState('networkidle');

    // 找第一个法本卡片点进去
    const link = page.locator('a[href*="/scripture-detail"]').first();
    if (await link.count() === 0) test.skip(true, '无法本数据');
    await link.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/scripture-detail');

    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('学员错题流：错题列表 → 详情', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/mistakes');
    await page.waitForLoadState('networkidle');

    // today filter 切换
    const todayBtn = page.getByRole('button', { name: /今日|Today/ });
    if (await todayBtn.count() > 0) {
      await todayBtn.first().click();
      await page.waitForTimeout(300);
    }

    // 切回全部
    const allBtn = page.getByRole('button', { name: /^全部$|All/ });
    if (await allBtn.count() > 0) {
      await allBtn.first().click();
      await page.waitForTimeout(300);
    }

    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('学员 SM-2 复习入口', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/sm2-review');
    await page.waitForLoadState('networkidle');

    // 有卡 → 显示「显示答案」按钮 / 没卡 → 显示「无待复习」
    const hasCards = await page.getByRole('button', { name: /显示答案|Show answer/ }).count() > 0;
    const isEmpty = await page.getByText(/今日已无待复习|No cards due/).count() > 0;
    expect(hasCards || isEmpty).toBeTruthy();

    if (hasCards) {
      await page.getByRole('button', { name: /显示答案|Show answer/ }).first().click();
      await page.waitForTimeout(400);
      // 应该看到 4 档评分按钮
      await expect(page.getByRole('button', { name: /^良好|^Good/ })).toBeVisible({ timeout: 3_000 });
    }

    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});

test.describe('Journey · Admin 关键路径', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Admin 法本编辑器 · 进入 → 章节区可见 → 关闭', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/courses');
    await page.waitForLoadState('networkidle');

    const firstCard = page.locator('[class*="glass-card"]').filter({ hasText: /·\s*\d+章/ }).first();
    if (await firstCard.count() === 0) test.skip(true, '无法本数据');

    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/章节|章節|Chapters/).first()).toBeVisible({ timeout: 8_000 });

    // 找返回按钮
    const back = page.getByRole('button', { name: /返回|Back/ }).first();
    if (await back.count() > 0) await back.click();

    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 用户抽屉 · 打开 → 检查所有 tab 按钮 → 关闭', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/users');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    // 确认抽屉里关键按钮可见
    await expect(page.getByRole('button', { name: /重置密码/ })).toBeVisible({ timeout: 5_000 });

    // ESC 关闭
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 班级 · 过滤 + 卡片点击进抽屉 + 切回', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/admin/classes');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '活跃' }).click();
    await page.waitForTimeout(300);

    const card = page.locator('[class*="glass-card"]').filter({ hasText: /[一-龥]/ }).nth(1);
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    await page.getByRole('button', { name: '全部' }).click();
    await page.waitForTimeout(300);

    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});

test.describe('Journey · Coach 关键路径', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Coach 题库 → 题目抽屉', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/coach/questions');
    await page.waitForLoadState('networkidle');

    // 找第一行题目
    const row = page.locator('tbody tr').first();
    if (await row.count() === 0) {
      // 卡片视图 fallback
      const card = page.locator('[class*="glass-card"]').first();
      if (await card.count() > 0) await card.click();
    } else {
      await row.click();
    }
    await page.waitForTimeout(500);

    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Coach 新题表单 · 渲染 + 字段交互', async ({ page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/dev/app/coach/questions/new');
    await page.waitForLoadState('networkidle');

    // 找题干输入框
    const textArea = page.locator('textarea').first();
    if (await textArea.count() > 0) {
      await textArea.click();
      await textArea.fill('测试题干 · 测试模式不会真提交');
      await page.waitForTimeout(200);
      await textArea.clear();
    }

    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});
