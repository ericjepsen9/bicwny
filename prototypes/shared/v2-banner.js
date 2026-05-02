/* v2-banner.js · 老 prototypes 上的"试试新版"软提示
 *   - 显示一次顶部 banner · 用户可"试试"或"暂不"
 *   - 暂不 → 30 天 localStorage 抑制
 *   - 不动业务代码 · 只在 DOMContentLoaded 后注入
 *
 * 注入方式（在每个 prototypes/*.html <body> 末尾）：
 *   <script src="/prototypes/shared/v2-banner.js" defer></script>
 *
 * Phase 10 老版完整下线后可整体删除。
 */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var KEY = 'jx-v2-banner-dismissed-at';
  var DISMISS_DAYS = 30;
  var DAY = 86_400_000;

  function isDismissed() {
    try {
      var t = +localStorage.getItem(KEY);
      return Number.isFinite(t) && (Date.now() - t) < DISMISS_DAYS * DAY;
    } catch (_) { return false; }
  }
  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (_) {}
  }

  function mount() {
    if (isDismissed()) return;
    if (document.querySelector('.jx-v2-banner')) return;

    var lang = (document.documentElement.getAttribute('data-lang') || 'sc').toLowerCase();
    var TEXT = {
      sc: { tip: '觉学新版已上线 · 更快更稳', try: '试试新版', no: '暂不' },
      tc: { tip: '覺學新版已上線 · 更快更穩', try: '試試新版', no: '暫不' },
      en: { tip: 'New version available · faster & smoother', try: 'Try new', no: 'Later' },
    };
    var t = TEXT[lang] || TEXT.sc;

    var bar = document.createElement('div');
    bar.className = 'jx-v2-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'New version notice');
    bar.style.cssText = [
      'position:sticky', 'top:0', 'z-index:9999',
      'display:flex', 'align-items:center', 'gap:8px',
      'padding:8px 12px',
      'background:linear-gradient(135deg,#FFE9D6,#FBD3B0)',
      'border-bottom:1px solid rgba(193,95,61,.25)',
      'color:#2B2218', 'font:13px/1.4 -apple-system,sans-serif',
      'letter-spacing:.5px',
      'box-shadow:0 2px 8px rgba(193,95,61,.08)',
    ].join(';');

    var txt = document.createElement('span');
    txt.textContent = '✨ ' + t.tip;
    txt.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    var go = document.createElement('a');
    go.href = '/app/';
    go.textContent = t.try;
    go.style.cssText = [
      'flex:0 0 auto', 'padding:6px 14px',
      'background:#C55F3D', 'color:#fff',
      'border-radius:999px', 'text-decoration:none',
      'font-weight:700', 'letter-spacing:1px',
    ].join(';');

    var no = document.createElement('button');
    no.type = 'button';
    no.textContent = t.no;
    no.style.cssText = [
      'flex:0 0 auto', 'background:transparent', 'border:none',
      'color:#857360', 'cursor:pointer', 'padding:6px 4px',
      'font:inherit', 'letter-spacing:1px',
    ].join(';');
    no.addEventListener('click', function () {
      dismiss();
      bar.remove();
    });

    bar.appendChild(txt);
    bar.appendChild(go);
    bar.appendChild(no);

    if (document.body.firstChild) document.body.insertBefore(bar, document.body.firstChild);
    else document.body.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
