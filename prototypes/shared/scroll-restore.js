// 滚动位置保留 · 跨 page 导航
//   - pagehide 时存当前页 scrollY 到 sessionStorage（按 URL key）
//   - 新页 boot 时若 URL 有匹配 entry · 等内容渲染完恢复 scrollY
//   - 30 分钟内有效 · 老条目自动清理 · 防 sessionStorage 膨胀
//
// 异步内容场景：列表通过 API 加载 · 简单的 DOMContentLoaded 时高度 = 0
// 不能立刻恢复。提供两种恢复时机：
//   1) 自动：MutationObserver 监听主滚动容器 · 高度变化达到 saved scrollY 就恢复
//   2) 手动：JX.scrollRestore.markReady() · 业务在数据加载完后显式调
(function () {
  if (typeof window === 'undefined') return;
  if (window.__JX_SCROLL_RESTORE_INITED__) return;
  window.__JX_SCROLL_RESTORE_INITED__ = true;

  var KEY = 'jx-scroll-v1';
  var TTL_MS = 30 * 60 * 1000;
  var MAX_ENTRIES = 30;

  // 让浏览器 history.scrollRestoration = manual · 防止它"自动"恢复造成冲突
  // 我们的 location.replace 导航 · 浏览器 auto 不一定生效 · 我们自己来
  if ('scrollRestoration' in history) {
    try { history.scrollRestoration = 'manual'; } catch (_) {}
  }

  function pageKey() {
    return location.pathname + location.search;
  }

  function loadStore() {
    try {
      var raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function saveStore(s) {
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
  }

  // 找主滚动容器 · 优先 .scroll-area · 否则 documentElement
  function getScrollEl() {
    return document.querySelector('.scroll-area') || document.scrollingElement || document.documentElement;
  }

  function getY() {
    var el = getScrollEl();
    if (el === document.scrollingElement || el === document.documentElement) {
      return window.scrollY || el.scrollTop || 0;
    }
    return el.scrollTop || 0;
  }

  function setY(y) {
    var el = getScrollEl();
    if (el === document.scrollingElement || el === document.documentElement) {
      window.scrollTo({ top: y, behavior: 'instant' });
    } else {
      el.scrollTop = y;
    }
  }

  function save() {
    var y = getY();
    if (y < 50) return; // 没真滚就不存 · 省 storage
    var store = loadStore();
    store[pageKey()] = { y: y, ts: Date.now() };
    // 清过期 + 上限
    var keys = Object.keys(store);
    var now = Date.now();
    keys.forEach(function (k) {
      if (now - store[k].ts > TTL_MS) delete store[k];
    });
    keys = Object.keys(store);
    if (keys.length > MAX_ENTRIES) {
      // 留最新 MAX_ENTRIES 条
      keys.sort(function (a, b) { return store[b].ts - store[a].ts; });
      keys.slice(MAX_ENTRIES).forEach(function (k) { delete store[k]; });
    }
    saveStore(store);
  }

  function clear() {
    var store = loadStore();
    delete store[pageKey()];
    saveStore(store);
  }

  // 尝试恢复 · 若内容高度还不够 saved.y · 等
  var pendingY = null;
  var observer = null;
  var giveUpTimer = null;

  function tryRestore() {
    var store = loadStore();
    var entry = store[pageKey()];
    if (!entry) return false;
    if (Date.now() - entry.ts > TTL_MS) {
      clear();
      return false;
    }
    pendingY = entry.y;
    return doRestore();
  }

  function doRestore() {
    if (pendingY == null) return true;
    var el = getScrollEl();
    var contentHeight = el.scrollHeight;
    var viewportHeight = el.clientHeight || window.innerHeight;
    // 高度够 · 立即设
    if (contentHeight >= pendingY + viewportHeight - 10) {
      setY(pendingY);
      pendingY = null;
      stopWatch();
      return true;
    }
    // 高度不够 · 等
    startWatch();
    return false;
  }

  function startWatch() {
    if (observer) return;
    observer = new MutationObserver(function () {
      if (pendingY != null) doRestore();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });
    // 5s 超时放弃 · 内容确实加载不出
    if (giveUpTimer) clearTimeout(giveUpTimer);
    giveUpTimer = setTimeout(function () {
      pendingY = null;
      stopWatch();
    }, 5000);
  }

  function stopWatch() {
    if (observer) { observer.disconnect(); observer = null; }
    if (giveUpTimer) { clearTimeout(giveUpTimer); giveUpTimer = null; }
  }

  // 业务方法 · 数据加载完调一下 · 立刻尝试恢复
  function markReady() {
    if (pendingY != null) doRestore();
  }

  // pagehide 比 beforeunload 在移动端更可靠（bfcache）
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', save);
  // visibilitychange→hidden 也算（移动端切 tab）
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') save();
  });

  // 初次尝试恢复 · DOMContentLoaded 之后
  function init() {
    tryRestore();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.JX = window.JX || {};
  window.JX.scrollRestore = {
    save: save,
    clear: clear,
    tryRestore: tryRestore,
    markReady: markReady,
  };
})();
