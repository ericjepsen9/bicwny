// 页面巡游 · 一次性截图所有学员/admin/coach 页面 · 输出到 tour-output/
//
// 跑：npm run tour
// 看：https://juexue.caughtalert.com/dev/__tour__/
//
// 不做对比 · 只生成图片 · 你浏览器扫一遍找视觉问题
// 学员页 mobile viewport (390x844) · admin/coach 页桌面 (1280x800)
import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT = path.resolve(__dirname, '..', 'tour-output');

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

async function shoot(page: Page, name: string, fullPage = true) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400); // 等动效
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage });
}

test.describe('Tour · 学员端（mobile）', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const pages: Array<[string, string]> = [
    ['01-home', '/dev/app/'],
    ['02-courses', '/dev/app/courses'],
    ['03-quiz-center', '/dev/app/quiz'],
    ['04-profile', '/dev/app/profile'],
    ['05-scripture-detail', '/dev/app/scripture-detail'],
    ['06-practice', '/dev/app/practice'],
    ['07-mistakes', '/dev/app/mistakes'],
    ['08-favorites', '/dev/app/favorites'],
    ['09-sm2-review', '/dev/app/sm2-review'],
    ['10-notifications', '/dev/app/notifications'],
    ['11-achievement', '/dev/app/achievement'],
    ['12-settings', '/dev/app/settings'],
    ['13-devices', '/dev/app/devices'],
    ['14-about', '/dev/app/about'],
    ['15-join-class', '/dev/app/join-class'],
    ['16-profile-edit', '/dev/app/profile/edit'],
    ['17-help', '/dev/app/help'],
    ['18-terms', '/dev/app/terms'],
    ['19-privacy', '/dev/app/privacy'],
  ];

  for (const [name, url] of pages) {
    test(name, async ({ page }) => {
      await page.goto(url);
      await shoot(page, 'student-' + name);
    });
  }
});

test.describe('Tour · Admin（desktop）', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  const pages: Array<[string, string]> = [
    ['01-dashboard', '/dev/app/admin'],
    ['02-users', '/dev/app/admin/users'],
    ['03-classes', '/dev/app/admin/classes'],
    ['04-courses', '/dev/app/admin/courses'],
    ['05-meditations', '/dev/app/admin/meditations'],
    ['06-review', '/dev/app/admin/review'],
    ['07-reports', '/dev/app/admin/reports'],
    ['08-audit', '/dev/app/admin/audit'],
    ['09-logs', '/dev/app/admin/logs'],
    ['10-llm', '/dev/app/admin/llm'],
  ];

  for (const [name, url] of pages) {
    test(name, async ({ page }) => {
      await page.goto(url);
      await shoot(page, 'admin-' + name);
    });
  }
});

test.describe('Tour · Coach（desktop）', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  const pages: Array<[string, string]> = [
    ['01-dashboard', '/dev/app/coach'],
    ['02-students', '/dev/app/coach/students'],
    ['03-questions', '/dev/app/coach/questions'],
    ['04-question-new', '/dev/app/coach/questions/new'],
    ['05-question-import', '/dev/app/coach/questions/import'],
    ['06-question-generate', '/dev/app/coach/questions/generate'],
    ['07-courses', '/dev/app/coach/courses'],
  ];

  for (const [name, url] of pages) {
    test(name, async ({ page }) => {
      await page.goto(url);
      await shoot(page, 'coach-' + name);
    });
  }
});
