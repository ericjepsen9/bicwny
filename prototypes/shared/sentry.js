// Sentry 错误监控 · 前端
//   - boot 时 fetch /api/config/public 拿 DSN · 没配置则完全 no-op
//   - 动态从 CDN 加载 Sentry browser SDK · 不阻塞首屏
//   - 自动捕获未捕获异常 + Promise rejection
//   - 用户登录后绑定 user.id / dharmaName
//   - 4xx 业务错通过 api.js 抛 ApiError 不上报 · 5xx + JS 异常上报
(function () {
  if (typeof window === 'undefined') return;

  // 防多次加载
  if (window.__JX_SENTRY_INITED__) return;
  window.__JX_SENTRY_INITED__ = true;

  // 早期阶段：缓存未捕获异常 · 等 Sentry 加载完成再 capture
  // 防止 Sentry 还没 ready 时丢失错误
  var earlyErrors = [];
  function earlyHandler(ev) {
    earlyErrors.push({
      type: 'error',
      msg: ev.message,
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
      error: ev.error,
    });
  }
  function earlyRejectionHandler(ev) {
    earlyErrors.push({ type: 'rejection', reason: ev.reason });
  }
  window.addEventListener('error', earlyHandler);
  window.addEventListener('unhandledrejection', earlyRejectionHandler);

  // 异步加载 · 不阻塞 boot
  function loadSentry(dsn, env, release) {
    var s = document.createElement('script');
    s.src = 'https://browser.sentry-cdn.com/8.41.0/bundle.tracing.min.js';
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'strict-origin';
    // SRI 留给后续 · 当前 CDN 自己签 TLS · 中间人篡改风险已被 HTTPS 阻断
    s.onload = function () {
      if (!window.Sentry) return;
      window.Sentry.init({
        dsn: dsn,
        environment: env || 'web',
        release: release || 'dev',
        // PWA / Capacitor / 浏览器 web 共用 · 区分用 tag
        initialScope: {
          tags: {
            platform: detectPlatform(),
            page: (location.pathname.split('/').pop() || '').toLowerCase(),
          },
        },
        // 0.1 = 10% 性能采样 · 高流量调更低
        tracesSampleRate: 0.1,
        // 抑制 Cancel / Network errors（不可控的网络抖动）· 不上报
        ignoreErrors: [
          'AbortError',
          'NetworkError',
          'Failed to fetch',
          'Load failed',
          'TIMEOUT', // 我们 api.js 抛的 ApiError code
          'LOADING',  // util.once 抛的重复点击
        ],
      });
      // 把 user 上下文挂上（如果已登录）
      var u = window.JX && window.JX.user;
      if (u && u.id) {
        window.Sentry.setUser({
          id: u.id,
          username: u.dharmaName || u.email || undefined,
        });
      }
      // user-ready 事件后再补绑（首次刷新 lang.js 早 · user 还没 hydrate）
      document.addEventListener('jx:user-ready', function () {
        var u2 = window.JX && window.JX.user;
        if (u2 && u2.id) {
          window.Sentry.setUser({
            id: u2.id,
            username: u2.dharmaName || u2.email || undefined,
          });
        }
      });
      // 把缓存的早期错误 flush 出去
      try {
        earlyErrors.forEach(function (e) {
          if (e.type === 'rejection') window.Sentry.captureException(e.reason);
          else if (e.error) window.Sentry.captureException(e.error);
          else window.Sentry.captureMessage(e.msg);
        });
      } catch (_) { /* 静默 */ }
      earlyErrors = [];
      window.removeEventListener('error', earlyHandler);
      window.removeEventListener('unhandledrejection', earlyRejectionHandler);
    };
    s.onerror = function () {
      console.warn('[sentry] CDN 加载失败 · 错误监控离线');
    };
    document.head.appendChild(s);
  }

  function detectPlatform() {
    if (window.Capacitor && window.Capacitor.getPlatform) {
      return 'capacitor-' + window.Capacitor.getPlatform();
    }
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return 'ios-web';
    if (/Android/.test(navigator.userAgent)) return 'android-web';
    return 'web';
  }

  // 拉公开配置 · 用 fetch 直接调（这时 window.JX.api 可能还没初始化）
  // 失败 = 后端没起 / 没配 DSN · 静默 · 错误监控离线
  function bootSentry() {
    fetch('/api/config/public', {
      method: 'GET',
      credentials: 'omit',
      cache: 'force-cache', // 配置极少变 · 浏览器 cache 即可
    }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (resp) {
      var cfg = resp && resp.data;
      if (!cfg || !cfg.sentryDsn) {
        // 没配 DSN · 移除早期 handler 防内存泄漏
        window.removeEventListener('error', earlyHandler);
        window.removeEventListener('unhandledrejection', earlyRejectionHandler);
        earlyErrors = [];
        return;
      }
      loadSentry(cfg.sentryDsn, cfg.sentryEnv, cfg.sentryRelease);
    }).catch(function () {
      // 后端挂 · 安静处理
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSentry);
  } else {
    bootSentry();
  }
})();
