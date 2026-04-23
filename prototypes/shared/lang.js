// 语言切换：简体(sc) / 繁体(tc) — 持久化至 localStorage
(function () {
  const html = document.documentElement;
  const saved = localStorage.getItem('jx-lang') || 'sc';
  html.setAttribute('data-lang', saved);   // 立即设置，避免闪烁

  function applyPlaceholders(lang) {
    document.querySelectorAll('[data-ph-sc]').forEach(el => {
      el.placeholder = lang === 'sc' ? el.dataset.phSc : (el.dataset.phTc || el.dataset.phSc);
    });
  }

  function applyLangBtn(lang) {
    document.querySelectorAll('.lang-btn').forEach(el => {
      el.textContent = lang === 'sc' ? '繁' : '简';
      el.setAttribute('aria-label', lang === 'sc' ? '切換繁體' : '切换简体');
    });
  }

  window.toggleLang = function () {
    const cur = html.getAttribute('data-lang') || 'sc';
    const next = cur === 'sc' ? 'tc' : 'sc';
    html.setAttribute('data-lang', next);
    localStorage.setItem('jx-lang', next);
    applyPlaceholders(next);
    applyLangBtn(next);
  };

  document.addEventListener('DOMContentLoaded', function () {
    applyPlaceholders(saved);
    applyLangBtn(saved);
  });
})();
