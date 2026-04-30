// CAPTCHA 前端包装 · 多 provider 自适应
//   JX.captcha.config()                 拉 /api/config/public · 缓存 promise
//   JX.captcha.render(containerId, cb)  渲染 widget · token 就绪时 cb(token)
//   JX.captcha.reset(widgetId)          重置 widget（提交失败后）
//   JX.captcha.isEnabled()              false 时调用方应跳过 captchaToken 字段
//
// provider='none' 时所有方法 no-op · render 返 null widgetId · 让前端代码统一写法
//
// 集成 provider：
//   turnstile  https://challenges.cloudflare.com/turnstile/v0/api.js
//   hcaptcha   https://js.hcaptcha.com/1/api.js
//   recaptcha  https://www.google.com/recaptcha/api.js
(function () {
  if (typeof window === 'undefined') return;
  if (window.__JX_CAPTCHA_INITED__) return;
  window.__JX_CAPTCHA_INITED__ = true;

  var configCache = null; // { provider, siteKey } | null=disabled
  var configPromise = null;

  var SCRIPT_URLS = {
    turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__jxCaptchaReady',
    hcaptcha:  'https://js.hcaptcha.com/1/api.js?onload=__jxCaptchaReady&render=explicit',
    recaptcha: 'https://www.google.com/recaptcha/api.js?onload=__jxCaptchaReady&render=explicit',
  };
  var GLOBAL_NAMES = {
    turnstile: 'turnstile',
    hcaptcha:  'hcaptcha',
    recaptcha: 'grecaptcha',
  };

  var sdkLoadPromise = null;
  function loadSDK(provider) {
    if (sdkLoadPromise) return sdkLoadPromise;
    sdkLoadPromise = new Promise(function (resolve) {
      window.__jxCaptchaReady = function () { resolve(window[GLOBAL_NAMES[provider]]); };
      var s = document.createElement('script');
      s.src = SCRIPT_URLS[provider];
      s.async = true;
      s.defer = true;
      s.onerror = function () {
        console.warn('[captcha] SDK 加载失败 · provider=' + provider);
        resolve(null);
      };
      document.head.appendChild(s);
    });
    return sdkLoadPromise;
  }

  function fetchConfig() {
    if (configPromise) return configPromise;
    configPromise = fetch('/api/config/public', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (resp) {
        var d = resp && resp.data;
        if (!d || d.captchaProvider === 'none' || !d.captchaSiteKey) {
          configCache = null;
          return null;
        }
        configCache = { provider: d.captchaProvider, siteKey: d.captchaSiteKey };
        return configCache;
      })
      .catch(function () { configCache = null; return null; });
    return configPromise;
  }

  function isEnabled() { return !!configCache; }

  /**
   * 渲染 captcha widget · 异步加载 SDK
   * @param container  DOM 节点或 id
   * @param onToken    function(token) · token 就绪时调
   * @returns Promise<widgetId|null>  · null 表示 provider=none 或加载失败
   */
  async function render(container, onToken) {
    var cfg = await fetchConfig();
    if (!cfg) return null;
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return null;
    var sdk = await loadSDK(cfg.provider);
    if (!sdk) return null;
    var opts = {
      sitekey: cfg.siteKey,
      callback: function (token) { if (onToken) onToken(token); },
      'error-callback': function () {
        console.warn('[captcha] error');
        if (onToken) onToken(null);
      },
      'expired-callback': function () { if (onToken) onToken(null); },
      theme: 'light',
    };
    try {
      return sdk.render(el, opts);
    } catch (e) {
      console.warn('[captcha] render 失败:', e && e.message);
      return null;
    }
  }

  function reset(widgetId) {
    if (!configCache) return;
    var sdk = window[GLOBAL_NAMES[configCache.provider]];
    if (sdk && typeof sdk.reset === 'function') {
      try { sdk.reset(widgetId); } catch (_) {}
    }
  }

  // 启动时预拉 config（不等待 · UI 需要时再 await）
  fetchConfig();

  window.JX = window.JX || {};
  window.JX.captcha = {
    isEnabled: isEnabled,
    render: render,
    reset: reset,
    config: fetchConfig,
  };
})();
