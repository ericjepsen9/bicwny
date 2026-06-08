// 学员端 smoke · 关键 UI 页面渲染 + 无 console error
//
// 设计：每个页面 visit → networkidle → 不跳 /auth → 无 console error
// 动态 ID 路由（/meditation/:id 等）放到 student-flow.spec.ts 里跑（先 API 拿 ID）
//
// 覆盖：HomePage, CoursesPage, QuizCenterPage, ProfilePage, ScriptureDetailPage,
//       QuizPage(practice), MistakesPage, FavoritesPage, Sm2ReviewPage, NotificationPage,
//       AchievementPage, SettingsPage, DevicesPage, AboutPage, JoinClassPage,
//       ProfileEditPage, HelpPage, TermsPage, PrivacyPage
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

// 通用断言：路径未跳 auth · 无 console error
async function expectPageOk(page: Page, errors: string[], allowedPaths: RegExp[] = []) {
  expect(page.url()).not.toContain('/auth');
  // 允许重定向（如 onboarding）
  if (allowedPaths.length) {
    expect(allowedPaths.some((re) => re.test(page.url()))).toBe(true);
  }
  expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
}

test.describe('学员端 · 静态路由 smoke', () => {
  const cases: Array<{ name: string; path: string; expect?: RegExp }> = [
    { name: 'HomePage /app/', path: '/dev/app/' },
    { name: 'CoursesPage /app/courses', path: '/dev/app/courses' },
    { name: 'QuizCenterPage /app/quiz', path: '/dev/app/quiz' },
    { name: 'ProfilePage /app/profile', path: '/dev/app/profile' },
    { name: 'ScriptureDetailPage /app/scripture-detail', path: '/dev/app/scripture-detail' },
    { name: 'QuizPage(practice) /app/practice', path: '/dev/app/practice' },
    { name: 'MistakesPage /app/mistakes', path: '/dev/app/mistakes' },
    { name: 'FavoritesPage /app/favorites', path: '/dev/app/favorites' },
    { name: 'Sm2ReviewPage /app/sm2-review', path: '/dev/app/sm2-review' },
    { name: 'NotificationPage /app/notifications', path: '/dev/app/notifications' },
    { name: 'AchievementPage /app/achievement', path: '/dev/app/achievement' },
    { name: 'SettingsPage /app/settings', path: '/dev/app/settings' },
    { name: 'DevicesPage /app/devices', path: '/dev/app/devices' },
    { name: 'AboutPage /app/about', path: '/dev/app/about' },
    { name: 'JoinClassPage /app/join-class', path: '/dev/app/join-class' },
    { name: 'ProfileEditPage /app/profile/edit', path: '/dev/app/profile/edit' },
    { name: 'HelpPage /app/help', path: '/dev/app/help' },
    { name: 'TermsPage /app/terms', path: '/dev/app/terms' },
    { name: 'PrivacyPage /app/privacy', path: '/dev/app/privacy' },
  ];

  for (const c of cases) {
    test(c.name, async ({ page }) => {
      const errors = attachConsoleAssert(page);
      await page.goto(c.path);
      await page.waitForLoadState('networkidle');
      await expectPageOk(page, errors);
    });
  }
});
