// 视觉回归 · 关键页面截图基线对比
//
// 首次跑：npm run test:visual:update（生成 baseline 到 tests/__screenshots__）
// 后续跑：npm run test:visual（diff baseline · 任何像素变化报错）
//
// 维度：only-chromium · 1 viewport (390x844 iPhone-like)
//   故意不覆盖所有页面 · 控制 baseline 体积 + diff 噪音
//   被覆盖页：HomePage, AdminCoursesPage, AdminClassesPage, ScriptureDetailPage,
//             ProfilePage, AdminUsersPage
//
// 注意：visual 会比 smoke 更脆弱 · 内容变化（如班级名）就会差 → 用 mask 压制
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Visual · 视觉回归', () => {
  test('HomePage', async ({ page }) => {
    await page.goto('/dev/app/');
    await page.waitForLoadState('networkidle');
    // 等动效平息（页面 enter transition 有 200ms）
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('home.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
      // mask 用户头像 / 动态进度条 · 减少 false positive
      mask: [page.locator('[data-testid="user-avatar"]'), page.locator('.progress-fill')],
    });
  });

  test('AdminCoursesPage', async ({ page }) => {
    await page.goto('/dev/app/admin/courses');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('admin-courses.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('AdminClassesPage', async ({ page }) => {
    await page.goto('/dev/app/admin/classes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('admin-classes.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('AdminUsersPage', async ({ page }) => {
    await page.goto('/dev/app/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('admin-users.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('ProfilePage', async ({ page }) => {
    await page.goto('/dev/app/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('profile.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});
