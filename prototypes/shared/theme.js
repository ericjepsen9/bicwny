// 觉学 · Theme 主题切换
// P1 #20 · auto / light / dark · 启动时立即应用避免 FOUC
//
// 必须早于其它脚本 head 内同步加载（在 lang.js 之前），不允许 defer。
//
// 用法：
//   JX.theme.get();              // 'auto' | 'light' | 'dark'
//   JX.theme.set('dark');        // 立即生效 + 持久化
//   JX.theme.cycle();            // auto → light → dark → auto
//   JX.theme.effective();        // 当前实际生效（'light' | 'dark'）
//
// 存储：localStorage['jx-theme'] = 'auto' | 'light' | 'dark'
// 默认 'auto' 跟随系统 prefers-color-scheme。
(function () {
  'use strict';
  var KEY = 'jx-theme';
  var VALID = { auto: 1, light: 1, dark: 1 };
  var listeners = [];

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return VALID[v] ? v : 'auto';
    } catch (_) { return 'auto'; }
  }

  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (_) {}
  }

  function systemPrefersDark() {
    return typeof matchMedia === 'function'
      && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function effective() {
    var v = read();
    if (v === 'dark') return 'dark';
    if (v === 'light') return 'light';
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function apply() {
    var v = read();
    var root = document.documentElement;
    root.setAttribute('data-theme', v);
    // auto 模式给一个反映系统状态的属性，CSS :where 可吃到
    if (v === 'auto') {
      root.setAttribute('data-theme-system', systemPrefersDark() ? 'dark' : 'light');
    } else {
      root.removeAttribute('data-theme-system');
    }
    // theme-color meta · 移动浏览器顶栏跟着变
    syncThemeColorMeta(effective());
    listeners.forEach(function (fn) { try { fn(effective()); } catch (_) {} });
  }

  function syncThemeColorMeta(eff) {
    var el = document.querySelector('meta[name="theme-color"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'theme-color');
      (document.head || document.documentElement).appendChild(el);
    }
    el.setAttribute('content', eff === 'dark' ? '#1A1410' : '#FFFAF4');
  }

  function set(v) {
    if (!VALID[v]) return;
    write(v);
    apply();
  }

  function cycle() {
    var v = read();
    set(v === 'auto' ? 'light' : v === 'light' ? 'dark' : 'auto');
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  // 监听系统切换 · auto 模式下需要实时响应
  if (typeof matchMedia === 'function') {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var handler = function () { if (read() === 'auto') apply(); };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  // 跨标签页同步
  window.addEventListener('storage', function (e) {
    if (e && e.key === KEY) apply();
  });

  // 立即应用 · 阻塞渲染前
  apply();

  window.JX = window.JX || {};
  window.JX.theme = {
    get: read,
    set: set,
    cycle: cycle,
    effective: effective,
    onChange: onChange,
    apply: apply,
  };
})();
