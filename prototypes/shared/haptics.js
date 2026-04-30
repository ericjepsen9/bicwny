// 觉学 · Haptics 触觉反馈
// P1 #19 · 优先 Capacitor Haptics 原生 · 兜底 Web Vibration · 配置项可关
//
// 用法：
//   JX.haptics.tap();          // 轻点（按钮 / tab）
//   JX.haptics.impact('light' | 'medium' | 'heavy');
//   JX.haptics.success();      // 答对 / 收藏 / 复习完成
//   JX.haptics.warning();      // 误操作提示
//   JX.haptics.error();        // 答错 / 提交失败
//   JX.haptics.selection();    // 切换 tab / 滚轮选择
//
// 用户偏好：localStorage['jx-haptics-enabled'] = 'false' 关闭
//
// Capacitor 安装（原生 App）：
//   npm i @capacitor/haptics
//   npx cap sync
//   插件挂在 window.Capacitor.Plugins.Haptics
(function () {
  'use strict';

  var STORAGE_KEY = 'jx-haptics-enabled';

  function isEnabled() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      // 默认开启 · 仅当显式 'false' 才关
      return v !== 'false';
    } catch (_) {
      return true;
    }
  }

  function setEnabled(on) {
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false');
    } catch (_) {}
  }

  function nativePlugin() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
      return window.Capacitor.Plugins.Haptics;
    }
    return null;
  }

  function webVibrate(ms) {
    if (typeof navigator === 'undefined') return;
    if (!navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (_) {}
  }

  // 触发限频 · 防止短时间内连续震动（如快速点击）
  var lastFire = 0;
  function throttle() {
    var now = Date.now();
    if (now - lastFire < 30) return false;
    lastFire = now;
    return true;
  }

  function impact(style) {
    if (!isEnabled()) return;
    if (!throttle()) return;
    var nat = nativePlugin();
    if (nat && nat.impact) {
      // Capacitor: ImpactStyle.Light / Medium / Heavy
      var s = (style || 'light').toLowerCase();
      var map = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };
      try { nat.impact({ style: map[s] || 'LIGHT' }); } catch (_) {}
      return;
    }
    var ms = style === 'heavy' ? 18 : (style === 'medium' ? 12 : 8);
    webVibrate(ms);
  }

  function notification(type) {
    if (!isEnabled()) return;
    if (!throttle()) return;
    var nat = nativePlugin();
    if (nat && nat.notification) {
      var t = (type || 'success').toUpperCase();
      try { nat.notification({ type: t }); } catch (_) {}
      return;
    }
    // SUCCESS · 短-静-短  /  WARNING · 中  /  ERROR · 长-静-长
    if (type === 'error')   webVibrate([20, 60, 20]);
    else if (type === 'warning') webVibrate([15, 40, 15]);
    else                    webVibrate([8, 50, 8]);
  }

  function selection() {
    if (!isEnabled()) return;
    if (!throttle()) return;
    var nat = nativePlugin();
    if (nat && nat.selectionChanged) {
      try { nat.selectionChanged(); } catch (_) {}
      return;
    }
    webVibrate(5);
  }

  function tap()     { impact('light'); }
  function success() { notification('success'); }
  function warning() { notification('warning'); }
  function error()   { notification('error'); }

  window.JX = window.JX || {};
  window.JX.haptics = {
    tap: tap,
    impact: impact,
    notification: notification,
    selection: selection,
    success: success,
    warning: warning,
    error: error,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
  };

  // 全局轻反馈 · 给所有 .haptic 元素或 [data-haptic] 自动绑定
  // data-haptic="tap|selection|success|warning|error|light|medium|heavy"
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var el = t.closest('[data-haptic]');
    if (!el) return;
    var k = el.getAttribute('data-haptic') || 'tap';
    if (k === 'tap') tap();
    else if (k === 'selection') selection();
    else if (k === 'success') success();
    else if (k === 'warning') warning();
    else if (k === 'error') error();
    else if (k === 'light' || k === 'medium' || k === 'heavy') impact(k);
  }, { capture: true, passive: true });
})();
