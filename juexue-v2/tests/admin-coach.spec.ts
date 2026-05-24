// Admin + Coach 端 smoke · 剩余页面（基础 smoke 已在 smoke.spec.ts）
//   补全 Admin: LLM, Reports, Audit, Logs
//   全 Coach: Dashboard, Students, Questions, QuestionNew, QuestionImport, QuestionGenerate, Courses
//
// 不覆盖 *Login 页（带 storageState 后会被重定向到 dashboard · 不构成 smoke 价值）
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

test.describe('Admin · 补全 smoke', () => {
  const cases: Array<{ name: string; path: string; heading: string }> = [
    { name: 'AdminLlmPage /admin/llm', path: '/dev/app/admin/llm', heading: 'LLM 管理' },
    { name: 'AdminReportsPage /admin/reports', path: '/dev/app/admin/reports', heading: '举报处理' },
    { name: 'AdminAuditPage /admin/audit', path: '/dev/app/admin/audit', heading: '审计日志' },
    { name: 'AdminLogsPage /admin/logs', path: '/dev/app/admin/logs', heading: '运行日志' },
  ];

  for (const c of cases) {
    test(c.name, async ({ page }) => {
      const errors = attachConsoleAssert(page);
      await page.goto(c.path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: c.heading })).toBeVisible({ timeout: 10_000 });
      expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
    });
  }
});

test.describe('Coach · 全 smoke', () => {
  const cases: Array<{ name: string; path: string; heading: string }> = [
    { name: 'CoachDashboardPage /coach', path: '/dev/app/coach', heading: '总览' },
    { name: 'CoachStudentsPage /coach/students', path: '/dev/app/coach/students', heading: '班级学员' },
    { name: 'CoachQuestionsPage /coach/questions', path: '/dev/app/coach/questions', heading: '题库' },
    { name: 'CoachQuestionNewPage /coach/questions/new', path: '/dev/app/coach/questions/new', heading: '新建题目' },
    { name: 'CoachQuestionImportPage /coach/questions/import', path: '/dev/app/coach/questions/import', heading: '批量导入' },
    { name: 'CoachQuestionGeneratePage /coach/questions/generate', path: '/dev/app/coach/questions/generate', heading: 'LLM 生成题目' },
    { name: 'CoachCoursesPage /coach/courses', path: '/dev/app/coach/courses', heading: '法本浏览' },
  ];

  for (const c of cases) {
    test(c.name, async ({ page }) => {
      const errors = attachConsoleAssert(page);
      await page.goto(c.path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: c.heading })).toBeVisible({ timeout: 10_000 });
      expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
    });
  }
});
