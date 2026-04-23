// 前端 API 基址配置
// ── 解析顺序 ────────────────────────────────────────────────
//   1. window.JX_API_BASE（页面内 <script> 预注入）
//   2. <meta name="jx-api-base" content="...">
//   3. localStorage['jx-api-base']（调试时在 DevTools 手改）
//   4. 生产默认：同源（即 nginx 反代 /api 到后端）
//   5. 开发默认：http://localhost:3000
// ──────────────────────────────────────────────────────────
(function () {
  function pickBase() {
    if (typeof window.JX_API_BASE === 'string' && window.JX_API_BASE) {
      return window.JX_API_BASE;
    }
    var meta = document.querySelector('meta[name="jx-api-base"]');
    if (meta && meta.content) return meta.content;
    try {
      var ls = localStorage.getItem('jx-api-base');
      if (ls) return ls;
    } catch (_) { /* incognito/禁用 */ }

    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      // 纯文件协议（file://）或本地静态服务 → 指向本地 dev 后端
      return 'http://localhost:3000';
    }
    // 生产：假设 nginx 把 /api 同源反代到后端，无需跨域
    return '';
  }

  window.JX = window.JX || {};
  window.JX.API_BASE = pickBase();
})();
