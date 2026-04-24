// 语言切换：简体(sc) / 繁体(tc)
// 在 <head> 末尾引入，IIFE 立即设置 data-lang，避免渲染闪烁
// 同时暴露 JX.lang() / JX.sc(a,b) 给页面复用，避免每个页面重复定义
(function () {
  const html = document.documentElement;

  // localStorage 在隐私 / 无痕 / 跨站策略下会抛 SecurityError，兜底到 'sc'
  function safeRead() {
    try { return localStorage.getItem('jx-lang') || 'sc'; }
    catch (_) { return 'sc'; }
  }
  function safeWrite(v) {
    try { localStorage.setItem('jx-lang', v); } catch (_) { /* 读得到就记得住；读不到就算了 */ }
  }

  const saved = safeRead();
  html.setAttribute('data-lang', saved);

  window.JX = window.JX || {};
  window.JX.lang = function () {
    return html.getAttribute('data-lang') || 'sc';
  };
  window.JX.sc = function (a, b) {
    return html.getAttribute('data-lang') === 'tc' ? b : a;
  };

  function applyPlaceholders(lang) {
    document.querySelectorAll('[data-ph-sc]').forEach(el => {
      el.placeholder = lang === 'sc' ? el.dataset.phSc : (el.dataset.phTc || el.dataset.phSc);
    });
  }

  function applyBtn(lang) {
    document.querySelectorAll('.lang-btn').forEach(el => {
      el.textContent = lang === 'sc' ? '繁' : '简';
    });
  }

  window.toggleLang = function () {
    const cur  = html.getAttribute('data-lang') || 'sc';
    const next = cur === 'sc' ? 'tc' : 'sc';
    html.setAttribute('data-lang', next);
    safeWrite(next);
    applyPlaceholders(next);
    applyBtn(next);
    // 通知各页面动态内容更新
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: next } }));
  };

  document.addEventListener('DOMContentLoaded', function () {
    applyPlaceholders(saved);
    applyBtn(saved);
  });
})();
