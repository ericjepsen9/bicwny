// 觉学 smoke 测试 · 关键路径页面渲染 + 核心交互
//
// auth 策略：
//   测试启动时 · 先调 /api/auth/login 拿 access token · 写到 localStorage
//   每个测试 page 起来后已是登录态（admin）
//
//   admin 凭证从环境变量读：
//     TEST_ADMIN_EMAIL=...
//     TEST_ADMIN_PASSWORD=...
//   写到 juexue-v2/.env.test（gitignored · 见 docs/SMOKE-TESTS.md）
//
// 设计原则：
//   - 不创造 / 不删数据（避免污染 dev 环境）
//   - 仅 read + 渲染 / UI 检查
//   - 任何 console error → 整个测试 fail
//   - 失败自动截图 + trace · playwright-report/ 里看

import { expect, test as base, type ConsoleMessage, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// 加载 .env.test（如果存在）
const envPath = path.resolve(__dirname, '..', '.env.test');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

// ── 自定义 fixture · 自动登录 + 注入 token ──
const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page, baseURL }, use) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD 未设置 · 请创建 juexue-v2/.env.test 见 docs/SMOKE-TESTS.md');
    }

    // 用 fetch 调登录接口拿 token
    const r = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!r.ok) {
      throw new Error(`登录失败 ${r.status}: ${await r.text()}`);
    }
    const { data } = await r.json();
    const accessToken = data?.accessToken;
    const refreshToken = data?.refreshToken;
    if (!accessToken) throw new Error(`登录响应缺 accessToken · 实际 keys: ${Object.keys(data ?? {}).join(',')}`);

    // 进 /app/auth 域 · 写 localStorage（必须先有 origin · 不能在 about:blank 写 localStorage）
    await page.goto('/app/auth');
    await page.evaluate(({ a, r }) => {
      // 跟 frontend tokenStore key 对齐 · 见 src/lib/tokenStore.ts
      localStorage.setItem('jx-accessToken', a);
      if (r) localStorage.setItem('jx-refreshToken', r);
    }, { a: accessToken, r: refreshToken });

    await use(page);
  },
});

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
  test('首页 /app/ → 已登录跳到主页', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 法本管理页 · 列表加载', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/courses');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('法本管理')).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 用户管理页 · 列表 + total 显示', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/users');
    await page.waitForLoadState('networkidle');
    const subtitle = page.locator('.page-sub').first();
    await expect(subtitle).toBeVisible({ timeout: 10_000 });
    const text = await subtitle.textContent();
    expect(text).toMatch(/\d+/);
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 班级管理页 · 列表 + 过滤按钮', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/classes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('班级管理')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '全部' })).toBeVisible();
    await expect(page.getByRole('button', { name: '活跃' })).toBeVisible();
    await expect(page.getByRole('button', { name: '已归档' })).toBeVisible();
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 观修管理页 · 列表加载', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/meditations');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('观修管理')).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 总览 dashboard · 渲染', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.shell .main').first()).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('学员侧 · 法本目录页 · 渲染', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/courses');
    await page.waitForLoadState('networkidle');
    const ok = await page.locator('main, [role="main"], .scroll-area').first().isVisible().catch(() => false);
    expect(ok).toBeTruthy();
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('Admin 题目审核页 · 列表 / 空态', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/review');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/题目审核|无待审/)).toBeVisible({ timeout: 10_000 });
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});

test.describe('UI · 关键交互', () => {
  test('班级详情抽屉 · 编辑按钮可见（活跃班级）', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/classes');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '活跃' }).click();
    const firstCard = page.locator('[class*="glass-card"]').filter({ hasText: /[一-龥]/ }).nth(1);
    if (await firstCard.count() > 0) {
      await firstCard.click();
      await expect(page.getByRole('button', { name: '编辑' }).first()).toBeVisible({ timeout: 5_000 });
    }
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });

  test('用户管理抽屉 · 重置密码按钮可见', async ({ loggedInPage: page }) => {
    const errors = attachConsoleAssert(page);
    await page.goto('/app/admin/users');
    await page.waitForLoadState('networkidle');
    const firstRow = page.locator('tbody tr, [role="row"]').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await expect(page.getByRole('button', { name: /重置密码/ })).toBeVisible({ timeout: 5_000 });
    }
    expect(errors, 'console errors:\n' + errors.join('\n')).toEqual([]);
  });
});
