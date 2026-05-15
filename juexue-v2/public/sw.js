/* 觉学 v2 · Service Worker
 *
 * 策略：
 *   · 静态资源（/app/assets/*）· cache-first（hash 文件名 · immutable · 永不过期）
 *   · index.html / icon / manifest · network-first（保证用户拿到最新引用）
 *   · /api/* · 永不拦截（直接走网络 · 让 fetch retry / 401 refresh 等业务逻辑生效）
 *
 * 升级：改下方 VERSION 即可清掉旧 cache · 旧 SW 会在新 SW activated 时被替换
 *
 * 不在原生壳（iOS/Android Capacitor）注册 · 见 src/lib/sw-register.ts
 */
const VERSION = 'jx-v2-2026-05-13-01';
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_CACHE = `${VERSION}-shell`;

const APP_SHELL = [
  '/app/',
  '/app/index.html',
  '/app/manifest.webmanifest',
  '/app/icon.svg',
  '/app/icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  // 立即激活新 SW · 不等旧 tab 关闭
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // 用 reload 绕开 HTTP cache · 确保 SW install 时拉的是最新 shell
      Promise.all(APP_SHELL.map((url) =>
        fetch(url, { cache: 'reload' })
          .then((res) => res.ok && cache.put(url, res))
          .catch(() => {})
      ))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // 清旧版 cache
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      ),
      // 立刻接管 open 着的页面（防止用户必须刷新一次才生效）
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 只接管同源请求
  if (url.origin !== self.location.origin) return;

  // /api/* · 永不拦截
  if (url.pathname.startsWith('/api/')) return;

  // 不是 /app/ 范围内的请求 · 不接管
  if (!url.pathname.startsWith('/app/')) return;

  // /app/assets/<hash>.{js,css,...} · cache-first（immutable）
  if (url.pathname.startsWith('/app/assets/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 其余 /app/* · 包括 SPA 路由 → 应该返回 index.html · network-first
  // SW 在生产 nginx try_files 之上 · 走 network 时 nginx 会兜底返回 index.html
  event.respondWith(networkFirst(req, SHELL_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    // offline 且无 cache · 抛错让浏览器原生处理
    throw e;
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (_) {
    // 离线 · 用 cache 中最近的 shell 兜底
    const hit = await cache.match(req) || await cache.match('/app/index.html');
    if (hit) return hit;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// 用于业务侧调用 navigator.serviceWorker.controller.postMessage('skipWaiting')
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// ── Push 通知接收 ──────────────────────────────────────────
// 后端 web-push 推送到达 SW · 用 Notification API 显示系统级 banner
// payload 由后端 push/service.ts 生成 · 含 title / body / link / tag / icon / badge

// link 白名单校验 · 防 javascript: / data: / 跨域协议注入
// 接受两种形式:
//   1) /app/... (已带 router base) · 直接用
//   2) /... (in-app 路由 · 如 /practice) · 自动补 /app 前缀
// 其它一律兜底 /app/
// 后端 dispatch 通常输出形式 2 · 见 reminder-queries.ts / announcements/service.ts
function safeLink(link) {
  if (!link || typeof link !== 'string') return '/app/';
  if (link.startsWith('/app/')) return link;
  if (link.startsWith('/')) return '/app' + link;
  return '/app/';
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: '觉学', body: event.data.text() };
  }
  const title = data.title || '觉学';
  const options = {
    body: data.body || '',
    icon: data.icon || '/app/icon-192.png',
    badge: data.badge || '/app/icon-72.png',
    // 同 tag 的后到通知替换前一个 · 防短时刷屏（如 T-30/T-5/T0 三档同事件）
    tag: data.tag,
    // 用户点 banner 时跳转的目标 · 默认 home.html · 校验后写入
    data: { link: safeLink(data.link) },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 用户点 banner → 打开 app · 跳到 link
// 已有 /app/ 路径的 tab 复用并 focus · 否则新开 window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // 再次校验 · 防御性 · 即使 push 时漏过 click 时再拦一次
  const link = safeLink(event.notification.data?.link);
  const url = self.location.origin + link;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 已有 tab → 聚焦 + 导航
      for (const c of clientList) {
        if (c.url.includes('/app/') && 'focus' in c) {
          c.focus();
          if ('navigate' in c) {
            try { c.navigate(url); } catch (_) { /* 不同源会失败 · 忽略 */ }
          }
          return;
        }
      }
      // 没 tab → 新开
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
