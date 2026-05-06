// 全局 setup · 登录一次拿 token · 写到 storage 文件
// 所有测试通过 storageState 复用 · 不重复登录 · 不撞速率限制
//
// 启动时 · Playwright 先跑这个 · 输出 .auth/admin.json
// 测试 use: { storageState: '.auth/admin.json' } 自动加载

import { chromium, type FullConfig, request } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup(config: FullConfig) {
  // 加载 .env.test
  const envPath = path.resolve(__dirname, '..', '.env.test');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
    }
  }

  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD 未设置 · 见 docs/SMOKE-TESTS.md');
  }

  const baseURL = config.projects[0]?.use?.baseURL ?? 'https://juexue.caughtalert.com';
  // baseURL 现在是裸域名（无 /dev）· API 直接拼接 /api/...
  const apiBase = baseURL.replace(/\/$/, '');

  // 调登录接口（绕开浏览器 · 避免速率限制因为只跑一次）
  const ctx = await request.newContext();
  const r = await ctx.post(`${apiBase}/api/auth/login`, {
    data: { email, password },
  });
  if (!r.ok()) {
    throw new Error(`全局登录失败 ${r.status()}: ${await r.text()}`);
  }
  const body = await r.json();
  const accessToken = body?.data?.accessToken;
  const refreshToken = body?.data?.refreshToken;
  if (!accessToken) throw new Error('登录响应缺 accessToken');
  await ctx.dispose();

  // 用 chromium 创建一个 page · 写 localStorage · 保存 storageState
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // dev 路径 · 同源 · localStorage 跨 /dev/app/ 和 /app/ 共享
  await page.goto(`${baseURL}/dev/app/auth`);
  await page.evaluate(({ a, r }) => {
    localStorage.setItem('jx-accessToken', a);
    if (r) localStorage.setItem('jx-refreshToken', r);
  }, { a: accessToken, r: refreshToken });

  const stateDir = path.resolve(__dirname, '..', '.auth');
  mkdirSync(stateDir, { recursive: true });
  const statePath = path.join(stateDir, 'admin.json');
  await page.context().storageState({ path: statePath });
  await browser.close();

  // 同时把 token 写到 process.env · 测试 spec 里能读
  // （Playwright globalSetup 只在主进程跑 · 测试 worker 看不到 process.env 的变更
  //  · 所以保存到文件让 spec 显式 import）
  writeFileSync(path.join(stateDir, 'tokens.json'), JSON.stringify({ accessToken, refreshToken }, null, 2));

  console.log('✓ 全局登录成功 · storageState 写到 .auth/admin.json');
}
