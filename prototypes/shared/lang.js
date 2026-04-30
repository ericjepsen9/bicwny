// 语言切换：简体(sc) / 繁体(tc) / 英文(en)
// 在 <head> 末尾引入，IIFE 立即设置 data-lang，避免渲染闪烁
// 同时暴露 JX.lang() / JX.sc(a,b) / JX.t(key,...args) 给页面复用
//
// 兼容历史：JX.sc(sc, tc) 仍然返回 sc 或 tc · en 时回落 sc
//          JX.sc(sc, tc, en) 三参数显式给英文 · 推荐新代码使用
//          JX.t(key) 走 i18n.js 词典 · 主要给 JS 拼接的 UI 字串
(function () {
  var html = document.documentElement;
  var VALID = { sc: 1, tc: 1, en: 1 };

  function safeRead() {
    try {
      var v = localStorage.getItem('jx-lang');
      return VALID[v] ? v : 'sc';
    } catch (_) { return 'sc'; }
  }
  function safeWrite(v) {
    try { localStorage.setItem('jx-lang', v); } catch (_) {}
  }

  var saved = safeRead();
  html.setAttribute('data-lang', saved);

  window.JX = window.JX || {};
  window.JX.lang = function () {
    return html.getAttribute('data-lang') || 'sc';
  };
  window.JX.sc = function (sc, tc, en) {
    var l = html.getAttribute('data-lang');
    if (l === 'tc') return tc != null ? tc : sc;
    if (l === 'en') return en != null ? en : sc;
    return sc;
  };

  function applyPlaceholders(lang) {
    document.querySelectorAll('[data-ph-sc]').forEach(function (el) {
      var ph = el.dataset.phSc;
      if (lang === 'tc' && el.dataset.phTc) ph = el.dataset.phTc;
      else if (lang === 'en' && el.dataset.phEn) ph = el.dataset.phEn;
      el.placeholder = ph;
    });
  }

  // .lang-btn 是 SC↔TC 快捷切换按钮 · en 不参与（在 settings 里走完整 picker）
  function applyBtn(lang) {
    document.querySelectorAll('.lang-btn').forEach(function (el) {
      // EN 模式下也保留显示繁体切换 · 标签按当前语境
      el.textContent = lang === 'sc' ? '繁' : (lang === 'tc' ? '简' : '繁');
    });
  }

  // 设置语言（任意值）· 持久化 + 触发 langchange 事件
  function setLang(target) {
    if (!VALID[target]) return;
    if (html.getAttribute('data-lang') === target) return;
    html.setAttribute('data-lang', target);
    safeWrite(target);
    applyPlaceholders(target);
    applyBtn(target);
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: target } }));
  }
  window.JX.setLang = setLang;

  // 历史 toggleLang · 仅在 sc / tc 之间循环（兼容老页面 .lang-btn）
  window.toggleLang = function () {
    var cur = html.getAttribute('data-lang') || 'sc';
    setLang(cur === 'sc' ? 'tc' : 'sc');
  };

  document.addEventListener('DOMContentLoaded', function () {
    applyPlaceholders(saved);
    applyBtn(saved);
  });
})();
