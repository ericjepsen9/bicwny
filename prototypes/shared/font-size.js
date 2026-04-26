// 字体缩放（无障碍）· 4 档：0.9 / 1 / 1.15 / 1.3
// 在 <head> 早期加载，IIFE 立刻读 localStorage 应用 --font-scale，避免刷新闪烁
// 暴露 JX.fontSize.{ get, set, list } 给 settings 页调用
(function () {
  var KEY = 'jx-font-scale';
  var html = document.documentElement;

  var SCALES = [
    { value: 0.9,  labelSc: '小',     labelTc: '小' },
    { value: 1,    labelSc: '标准',   labelTc: '標準' },
    { value: 1.15, labelSc: '大',     labelTc: '大' },
    { value: 1.3,  labelSc: '超大',   labelTc: '超大' },
  ];

  function safeRead() {
    try { return parseFloat(localStorage.getItem(KEY)); } catch (_) { return NaN; }
  }
  function safeWrite(v) {
    try { localStorage.setItem(KEY, String(v)); } catch (_) { /* 隐私模式静默失败 */ }
  }

  function apply(scale) {
    if (typeof scale !== 'number' || isNaN(scale) || scale <= 0) scale = 1;
    html.style.setProperty('--font-scale', String(scale));
  }

  // 启动应用
  var saved = safeRead();
  apply(isNaN(saved) ? 1 : saved);

  window.JX = window.JX || {};
  window.JX.fontSize = {
    get: function () {
      var v = safeRead();
      return isNaN(v) ? 1 : v;
    },
    set: function (scale) {
      apply(scale);
      safeWrite(scale);
      document.dispatchEvent(new CustomEvent('jx:font-size-change', { detail: { scale: scale } }));
    },
    list: function () { return SCALES.slice(); },
  };
})();
