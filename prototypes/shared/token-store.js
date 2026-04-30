// Token 存储抽象 · Capacitor Preferences (native keychain) 优先 · 否则 localStorage 回落
//   - native（iOS keychain / Android EncryptedSharedPreferences）异步 API
//   - 浏览器 localStorage 同步 API
//   - 通过内存 cache + boot init 让上层 api.js 可继续同步读
//
// 使用：
//   await JX.tokenStore.init();              // boot 时调一次 · 完成内存 cache
//   var t = JX.tokenStore.getAccess();       // 同步读 · 给现有 api.js 用
//   JX.tokenStore.setTokens({accessToken, refreshToken});  // 同步缓存 + 异步持久化
//   JX.tokenStore.clear();                   // 退出登录
//
// Capacitor 集成：
//   1) 在 Capacitor 项目里 npm install @capacitor/preferences
//   2) npx cap sync
//   3) WebView 里 window.Capacitor.Plugins.Preferences 自动可用 · 本模块自动切到 native
//   4) 浏览器开发不受影响（自动降级到 localStorage）
(function () {
  if (typeof window === 'undefined') return;
  if (window.__JX_TOKEN_STORE_INITED__) return;
  window.__JX_TOKEN_STORE_INITED__ = true;

  var KEY_A = 'jx-accessToken';
  var KEY_R = 'jx-refreshToken';

  // 内存 cache · 同步读的来源
  var cache = { access: null, refresh: null };
  var inited = false;
  var initPromise = null;

  function getCapacitorPreferences() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
      return window.Capacitor.Plugins.Preferences;
    }
    return null;
  }
  function getLocalStorage() {
    try { return window.localStorage; } catch (_) { return null; }
  }
  function inCapacitor() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  // boot · 加载 token 进 cache
  //   Capacitor: 异步从 keychain 读 · 同步迁移 localStorage 旧 token（首次包后）
  //   浏览器: 同步从 localStorage 读
  async function init() {
    if (inited) return;
    if (initPromise) return initPromise;
    initPromise = (async function () {
      var Pref = getCapacitorPreferences();
      var ls = getLocalStorage();
      if (Pref && inCapacitor()) {
        // native：先看 keychain
        try {
          var a = await Pref.get({ key: KEY_A });
          var r = await Pref.get({ key: KEY_R });
          cache.access = (a && a.value) || null;
          cache.refresh = (r && r.value) || null;
          // 一次性迁移：localStorage 残留 token（旧版本 webview 包）→ 写 keychain + 清
          if (!cache.access && ls && ls.getItem(KEY_A)) {
            cache.access = ls.getItem(KEY_A);
            cache.refresh = ls.getItem(KEY_R);
            await Pref.set({ key: KEY_A, value: cache.access || '' });
            if (cache.refresh) await Pref.set({ key: KEY_R, value: cache.refresh });
            ls.removeItem(KEY_A);
            ls.removeItem(KEY_R);
          }
        } catch (e) {
          // Pref 调用失败 · 退到 localStorage
          if (ls) {
            cache.access = ls.getItem(KEY_A);
            cache.refresh = ls.getItem(KEY_R);
          }
        }
      } else if (ls) {
        cache.access = ls.getItem(KEY_A);
        cache.refresh = ls.getItem(KEY_R);
      }
      inited = true;
    })();
    return initPromise;
  }

  function getAccess() { return cache.access; }
  function getRefresh() { return cache.refresh; }

  // 同步缓存 + 异步持久化（不 await · 调用者继续）
  // 持久化失败也 OK · 内存 cache 仍生效到本次会话结束
  function setTokens(t) {
    if (!t) return;
    if (t.accessToken)  cache.access = t.accessToken;
    if (t.refreshToken) cache.refresh = t.refreshToken;
    persist();
  }
  function setAccess(token) { cache.access = token || null; persist(); }
  function setRefresh(token) { cache.refresh = token || null; persist(); }

  function persist() {
    var Pref = getCapacitorPreferences();
    var ls = getLocalStorage();
    if (Pref && inCapacitor()) {
      // 异步写 keychain · 同时清 localStorage 残留
      Pref.set({ key: KEY_A, value: cache.access || '' }).catch(function () {});
      if (cache.refresh) {
        Pref.set({ key: KEY_R, value: cache.refresh }).catch(function () {});
      } else {
        Pref.remove({ key: KEY_R }).catch(function () {});
      }
      if (ls) {
        try { ls.removeItem(KEY_A); ls.removeItem(KEY_R); } catch (_) {}
      }
    } else if (ls) {
      try {
        if (cache.access) ls.setItem(KEY_A, cache.access);
        else ls.removeItem(KEY_A);
        if (cache.refresh) ls.setItem(KEY_R, cache.refresh);
        else ls.removeItem(KEY_R);
      } catch (_) {}
    }
  }

  function clear() {
    cache.access = null;
    cache.refresh = null;
    var Pref = getCapacitorPreferences();
    var ls = getLocalStorage();
    if (Pref && inCapacitor()) {
      Pref.remove({ key: KEY_A }).catch(function () {});
      Pref.remove({ key: KEY_R }).catch(function () {});
    }
    if (ls) {
      try { ls.removeItem(KEY_A); ls.removeItem(KEY_R); } catch (_) {}
    }
    if (window.JX && window.JX.overlayCache && window.JX.overlayCache.clear) {
      window.JX.overlayCache.clear();
    }
  }

  function isInited() { return inited; }

  window.JX = window.JX || {};
  window.JX.tokenStore = {
    init: init,
    getAccess: getAccess,
    getRefresh: getRefresh,
    setTokens: setTokens,
    setAccess: setAccess,
    setRefresh: setRefresh,
    clear: clear,
    isInited: isInited,
    inCapacitor: inCapacitor,
  };

  // 立即触发 init · 浏览器场景同步完成 · Capacitor 场景几十 ms
  init();
})();
