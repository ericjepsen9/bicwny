// 学员端 · 动态 ID 路由 smoke
//   /class/:id · /class/:id/meditations · /meditation/:id
//   /read/:slug/:lessonId · /quiz/:lessonId · /mistake/:questionId
//
// 策略：先 API 拿真实 ID（用 globalSetup 存的 token）· 再 goto 页面
// 没数据时 test.skip，不让空环境失败
import { expect, test, type ConsoleMessage, type Page, type APIRequestContext } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadToken(): string {
  const p = path.resolve(__dirname, '..', '.auth', 'tokens.json');
  if (!existsSync(p)) throw new Error('.auth/tokens.json 缺失 · 检查 global-setup');
  const j = JSON.parse(readFileSync(p, 'utf8'));
  if (!j?.accessToken) throw new Error('tokens.json 缺 accessToken');
  return j.accessToken as string;
}

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

async function apiGet<T = unknown>(req: APIRequestContext, p: string, token: string): Promise<T | null> {
  const r = await req.get('https://juexue.caughtalert.com' + p, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!r.ok()) return null;
  const body = await r.json();
  return (body?.data ?? body) as T;
}

test.describe('学员端 · 动态 ID 路由', () => {
  test('ClassDetailPage /class/:id', async ({ page, request }) => {
    const token = loadToken();
    const classes = await apiGet<Array<{ id: string }>>(request, '/api/admin/classes', token);
    test.skip(!classes || classes.length === 0, '无班级数据');
    const id = classes![0]!.id;
    const errors = attachConsoleAssert(page);
    await page.goto(`/dev/app/class/${id}`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/auth');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('ClassMeditationRankingPage /class/:id/meditations', async ({ page, request }) => {
    const token = loadToken();
    const classes = await apiGet<Array<{ id: string }>>(request, '/api/admin/classes', token);
    test.skip(!classes || classes.length === 0, '无班级数据');
    const id = classes![0]!.id;
    const errors = attachConsoleAssert(page);
    await page.goto(`/dev/app/class/${id}/meditations`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/auth');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('MeditationPlayerPage /meditation/:id', async ({ page, request }) => {
    const token = loadToken();
    const meds = await apiGet<Array<{ id: string }>>(request, '/api/admin/meditations', token);
    test.skip(!meds || meds.length === 0, '无观修数据');
    const id = meds![0]!.id;
    const errors = attachConsoleAssert(page);
    await page.goto(`/dev/app/meditation/${id}`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/auth');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('ScriptureReadingPage /read/:slug/:lessonId', async ({ page, request }) => {
    const token = loadToken();
    const courses = await apiGet<Array<{ id: string; slug: string }>>(request, '/api/admin/courses', token);
    test.skip(!courses || courses.length === 0, '无法本数据');
    // 找第一个有 lesson 的法本
    let slug = '';
    let lessonId = '';
    for (const c of courses!) {
      const detail = await apiGet<{ chapters?: Array<{ lessons?: Array<{ id: string }> }> }>(
        request,
        `/api/admin/courses/${encodeURIComponent(c.id)}`,
        token,
      );
      const lid = detail?.chapters?.flatMap((ch) => ch.lessons ?? [])[0]?.id;
      if (lid) { slug = c.slug; lessonId = lid; break; }
    }
    test.skip(!slug || !lessonId, '无 lesson 数据');
    const errors = attachConsoleAssert(page);
    await page.goto(`/dev/app/read/${slug}/${lessonId}`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/auth');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('QuizPage /quiz/:lessonId', async ({ page, request }) => {
    const token = loadToken();
    const courses = await apiGet<Array<{ id: string }>>(request, '/api/admin/courses', token);
    test.skip(!courses || courses.length === 0, '无法本数据');
    let lessonId = '';
    for (const c of courses!) {
      const detail = await apiGet<{ chapters?: Array<{ lessons?: Array<{ id: string }> }> }>(
        request,
        `/api/admin/courses/${encodeURIComponent(c.id)}`,
        token,
      );
      const lid = detail?.chapters?.flatMap((ch) => ch.lessons ?? [])[0]?.id;
      if (lid) { lessonId = lid; break; }
    }
    test.skip(!lessonId, '无 lesson 数据');
    const errors = attachConsoleAssert(page);
    await page.goto(`/dev/app/quiz/${lessonId}`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/auth');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('MistakeDetailPage /mistake/:questionId', async ({ page, request }) => {
    const token = loadToken();
    const mistakes = await apiGet<Array<{ questionId: string }>>(request, '/api/mistakes', token);
    test.skip(!mistakes || mistakes.length === 0, '无错题数据');
    const qid = mistakes![0]!.questionId;
    const errors = attachConsoleAssert(page);
    await page.goto(`/dev/app/mistake/${qid}`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/auth');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});
