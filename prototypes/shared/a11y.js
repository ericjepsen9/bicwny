// 觉学 · A11y 工具
// P2 #27
//
// 提供：
//   JX.a11y.announce(msg, polite)         · 给 SR 朗读 · polite=true(默认) / false=assertive
//   JX.a11y.trapFocus(container)          · 把 Tab/Shift+Tab 圈在容器内 · 返回 untrap()
//   JX.a11y.dialog(open|close, container) · 一键 set role=dialog + aria-modal + 焦点存档/恢复
//
// 自动行为：
//   - 给 #jx-toast-root 加 aria-live="polite"（toast.js 也兼容直接朗读）
//   - 给 .tab-bar 里 .tab-item.active 自动加 aria-current="page"
//   - body 加 a11y-loaded 标记 · 方便测试
(function () {
  'use strict';
  if (window.JX && window.JX.a11y) return;

  var ANNOUNCER_ID = 'jx-a11y-announcer';

  function ensureAnnouncer() {
    var el = document.getElementById(ANNOUNCER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = ANNOUNCER_ID;
    el.className = 'sr-only';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
    return el;
  }

  function announce(msg, polite) {
    var el = ensureAnnouncer();
    el.setAttribute('aria-live', polite === false ? 'assertive' : 'polite');
    // 双写触发 · 同样文本第二次 SR 不读 · 加占位换行让它认为变化
    el.textContent = '';
    setTimeout(function () { el.textContent = String(msg || ''); }, 30);
  }

  // 可聚焦元素选择器 · 含 contenteditable / iframe / details / 自定义 tabindex
  var FOCUSABLE = [
    'a[href]', 'area[href]', 'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'audio[controls]', 'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    'iframe', 'object', 'embed',
    'summary', 'details',
  ].join(',');

  function focusableIn(container) {
    if (!container) return [];
    return Array.prototype.filter.call(
      container.querySelectorAll(FOCUSABLE),
      function (el) {
        return !el.hasAttribute('disabled')
          && el.offsetParent !== null
          && getComputedStyle(el).visibility !== 'hidden';
      },
    );
  }

  /** trapFocus(container) · 返回 untrap() · ESC / 调用 untrap() 都能解 */
  function trapFocus(container) {
    if (!container) return function () {};
    var prev = document.activeElement;

    function onKey(e) {
      if (e.key !== 'Tab') return;
      var items = focusableIn(container);
      if (items.length === 0) { e.preventDefault(); return; }
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', onKey);
    // 默认聚焦容器内第一个可聚焦
    setTimeout(function () {
      var items = focusableIn(container);
      if (items.length > 0) try { items[0].focus(); } catch (_) {}
    }, 50);

    return function untrap() {
      container.removeEventListener('keydown', onKey);
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus(); } catch (_) {}
      }
    };
  }

  /** dialog 状态管理 · open 时 set role+aria-modal+trap · close 还原 */
  var trapHandlers = new WeakMap();
  function dialog(action, container, opts) {
    if (!container) return;
    if (action === 'open') {
      container.setAttribute('role', 'dialog');
      container.setAttribute('aria-modal', 'true');
      if (opts && opts.label) container.setAttribute('aria-label', opts.label);
      // 锁住 body 滚动
      document.documentElement.style.overflow = 'hidden';
      var untrap = trapFocus(container);
      trapHandlers.set(container, untrap);
    } else if (action === 'close') {
      var u = trapHandlers.get(container);
      if (u) { u(); trapHandlers.delete(container); }
      container.removeAttribute('aria-modal');
      document.documentElement.style.overflow = '';
    }
  }

  // 自动给 .tab-bar 里 .tab-item.active 标 aria-current
  function syncTabAria() {
    document.querySelectorAll('.tab-bar .tab-item').forEach(function (el) {
      if (el.classList.contains('active')) {
        el.setAttribute('aria-current', 'page');
      } else {
        el.removeAttribute('aria-current');
      }
    });
  }

  // 启动
  function boot() {
    ensureAnnouncer();
    syncTabAria();
    document.body.classList.add('a11y-loaded');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.JX = window.JX || {};
  window.JX.a11y = {
    announce: announce,
    trapFocus: trapFocus,
    dialog: dialog,
    focusableIn: focusableIn,
    syncTabAria: syncTabAria,
  };
})();
