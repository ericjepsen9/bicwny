// 觉学 Service Worker · 缓存 app shell + 智能策略
//   - shell（HTML/CSS/JS）：stale-while-revalidate · 后台更新 · 永远秒开
//   - 字体（Google Fonts）：cache-first · 一年不变
//   - 图片：cache-first · 法本封面等
//   - API：network-first 兜底 cache · 后端挂时仍能展示上次数据
//
// 部署版本号（每次发版改）：bump VERSION 触发 activate 清旧缓存
//   实际部署时可由 build script 注入 git commit hash · 当前手动 bump
const VERSION = 'v2026-04-30-01';
const SHELL_CACHE = 'shell-' + VERSION;
const RUNTIME_CACHE = 'runtime-' + VERSION;

// 安装阶段预缓存 · 关键 shell 资源
//   不预缓存所有页 · 用户访问到的页通过 SWR 自动入缓存 · 启动开销小
const PRECACHE = [
  '/mobile/home.html',
  '/mobile/courses.html',
  '/mobile/quiz-center.html',
  '/mobile/profile.html',
  '/shared/tokens.css',
  '/shared/base.css',
  '/shared/components.css',
  '/shared/lang.js',
  '/shared/return-url.js',
  '/shared/font-size.js',
  '/shared/status-bar.js',
  '/shared/config.js',
  '/shared/api.js',
  '/shared/components.js',
  '/shared/require-auth.js',
  '/shared/nav.js',
  '/shared/toast.js',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // addAll 任一失败整体失败 · 用 Promise.allSettled 容忍单个 404
      return Promise.allSettled(PRECACHE.map(function (url) {
        return cache.add(url).catch(function (err) {
          console.warn('[sw] precache miss:', url, err.message);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys
      .filter(function (k) { return k.indexOf(VERSION) < 0; })
      .map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

// 同源 GET 请求统一拦截 · 按 path 分流
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) {
    // Google Fonts CDN 跨域 · 单独 cache-first
    if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
      event.respondWith(cacheFirst(req));
    }
    return;
  }
  var path = url.pathname;
  // API：network-first 兜底 cache · 离线时返回上次数据
  if (path.indexOf('/api/') === 0) {
    event.respondWith(networkFirst(req));
    return;
  }
  // shell HTML/JS/CSS：stale-while-revalidate
  if (/\.(html|js|css)$/.test(path) || path === '/' || path === '/mobile/' || path === '/index.html') {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  // 图片字体：cache-first
  if (/\.(png|jpg|jpeg|webp|svg|gif|avif|ico|woff2?|ttf)$/.test(path)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  // 其他：透传
});

async function staleWhileRevalidate(req) {
  var cache = await caches.open(SHELL_CACHE);
  var cached = await cache.match(req);
  var fetchPromise = fetch(req).then(function (resp) {
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  }).catch(function () { return cached; });
  return cached || fetchPromise;
}

async function cacheFirst(req) {
  var cache = await caches.open(RUNTIME_CACHE);
  var cached = await cache.match(req);
  if (cached) return cached;
  var resp = await fetch(req);
  if (resp && resp.ok) cache.put(req, resp.clone());
  return resp;
}

async function networkFirst(req) {
  var cache = await caches.open(RUNTIME_CACHE);
  try {
    var resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    var cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

// 强制刷新指令 · 客户端 postMessage('SKIP_WAITING') 立即激活新版
self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
