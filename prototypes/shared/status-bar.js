// Auto-inject the phone status bar (time + lang toggle + system icons SVG)
// into every <div class="status-bar" data-auto></div> on the page.
(function () {
  function inject() {
    var lang = document.documentElement.getAttribute('data-lang') || 'sc';
    var btnText = lang === 'sc' ? '繁' : '简';
    var svg = '<svg width="56" height="12" viewBox="0 0 56 12" fill="#2B2218">' +
      '<rect x="0" y="7" width="3" height="5" rx=".5" opacity=".3"/>' +
      '<rect x="5" y="5" width="3" height="7" rx=".5" opacity=".5"/>' +
      '<rect x="10" y="2" width="3" height="10" rx=".5" opacity=".7"/>' +
      '<rect x="15" y="0" width="3" height="12" rx=".5"/>' +
      '<circle cx="26" cy="11" r="1"/>' +
      '<path d="M23 8a5 5 0 0 1 6 0" stroke="#2B2218" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".6"/>' +
      '<path d="M20.5 5.5a9 9 0 0 1 11 0" stroke="#2B2218" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".3"/>' +
      '<rect x="36" y="2" width="16" height="8" rx="1.5" stroke="#2B2218" stroke-opacity=".35" stroke-width=".8" fill="none"/>' +
      '<rect x="37" y="3" width="11" height="6" rx="1" opacity=".85"/>' +
      '<path d="M53 5v2a1.5 1.5 0 0 0 0-2z" opacity=".4"/>' +
      '</svg>';
    document.querySelectorAll('.status-bar[data-auto]').forEach(function (el) {
      if (el.dataset.injected) return;
      el.dataset.injected = '1';
      el.innerHTML = '<span class="time">9:41</span>' +
        '<div class="status-right">' +
        '<button class="lang-btn" onclick="toggleLang()">' + btnText + '</button>' +
        svg + '</div>';
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
