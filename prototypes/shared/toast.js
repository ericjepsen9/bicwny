// 觉学 Toast · 轻量单例
// 用法（任何引入了本文件的页面）：
//   JX.toast.ok('保存成功');
//   JX.toast.error('网络异常', '请检查连接');
//   JX.toast.info('已复制');
//   JX.toast.warn('操作不可撤销');
//
// 生产级替代 alert()：
//   alert(msg)            → JX.toast.error(msg)
//   alert('成功')          → JX.toast.ok('成功')
//   alert('提示')          → JX.toast.info('提示')
//
// 特性：
//   · 单例 · 自动堆叠多条 · 每条独立淡出（默认 3.5s，error 5s）
//   · 固定右上角（桌面）/ 顶部居中（手机 < 480px）
//   · 点击关闭按钮 / 点 toast 本体立即消失
//   · 零依赖，纯 DOM，挂 window.JX.toast
(function () {
  if (window.JX && window.JX.toast) return; // 已加载，防重复

  var STYLE_ID = 'jx-toast-style';
  var ROOT_ID  = 'jx-toast-root';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#jx-toast-root {' +
        'position:fixed; top:20px; right:20px; z-index:10000;' +
        'display:flex; flex-direction:column; gap:10px;' +
        'pointer-events:none;' +
      '}' +
      '@media (max-width:480px){' +
        '#jx-toast-root { top:12px; right:12px; left:12px; align-items:center; }' +
      '}' +
      '.jx-toast {' +
        'pointer-events:auto; cursor:pointer;' +
        'display:flex; align-items:flex-start; gap:10px;' +
        'min-width:220px; max-width:360px;' +
        'padding:12px 14px; border-radius:10px;' +
        'background:#fff; color:#2B2218;' +
        'box-shadow:0 10px 32px rgba(43,34,24,.16), 0 2px 8px rgba(43,34,24,.08);' +
        'border-left:3px solid #E07856;' +
        'font:500 14px/1.5 -apple-system,"Noto Sans SC",sans-serif;' +
        'letter-spacing:.5px;' +
        'opacity:0; transform:translateY(-8px) scale(.96);' +
        'transition:opacity .2s ease, transform .2s ease;' +
      '}' +
      '.jx-toast.show { opacity:1; transform:none; }' +
      '.jx-toast.ok    { border-left-color:#7D9A6C; }' +
      '.jx-toast.error { border-left-color:#C0392B; }' +
      '.jx-toast.warn  { border-left-color:#D4A574; }' +
      '.jx-toast.info  { border-left-color:#55463A; }' +
      '.jx-toast .jxt-ico { flex-shrink:0; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; line-height:1; }' +
      '.jx-toast.ok    .jxt-ico { color:#7D9A6C; }' +
      '.jx-toast.error .jxt-ico { color:#C0392B; }' +
      '.jx-toast.warn  .jxt-ico { color:#B88956; }' +
      '.jx-toast.info  .jxt-ico { color:#55463A; }' +
      '.jx-toast .jxt-body { flex:1; min-width:0; }' +
      '.jx-toast .jxt-title { font-weight:600; color:#2B2218; letter-spacing:1px; margin-bottom:2px; }' +
      '.jx-toast .jxt-msg { color:#55463A; font-size:13px; word-break:break-word; }' +
      '.jx-toast .jxt-x { flex-shrink:0; color:#B5A99A; font-size:16px; line-height:1; padding:0 0 0 4px; }';
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function getRoot() {
    var r = document.getElementById(ROOT_ID);
    if (r) return r;
    r = document.createElement('div');
    r.id = ROOT_ID;
    document.body.appendChild(r);
    return r;
  }

  var ICONS = { ok: '✓', error: '✕', warn: '!', info: 'i' };

  function show(kind, title, msg) {
    injectStyle();
    // 允许单参数：show(kind, msg) ⇒ 只显示 msg，无 title
    if (msg === undefined) { msg = title; title = null; }

    // 触觉反馈 · ok→success / error→error / warn→warning / info→tap
    if (window.JX && window.JX.haptics) {
      var h = window.JX.haptics;
      if      (kind === 'ok')    h.success();
      else if (kind === 'error') h.error();
      else if (kind === 'warn')  h.warning();
      else if (kind === 'info')  h.tap();
    }

    var root = getRoot();
    var t = document.createElement('div');
    t.className = 'jx-toast ' + kind;
    t.innerHTML =
      '<div class="jxt-ico">' + (ICONS[kind] || '') + '</div>' +
      '<div class="jxt-body">' +
        (title ? '<div class="jxt-title"></div>' : '') +
        '<div class="jxt-msg"></div>' +
      '</div>' +
      '<div class="jxt-x">×</div>';
    if (title) t.querySelector('.jxt-title').textContent = title;
    t.querySelector('.jxt-msg').textContent = msg == null ? '' : String(msg);
    root.appendChild(t);

    // 下一帧触发动画
    requestAnimationFrame(function () { t.classList.add('show'); });

    var ttl = (kind === 'error') ? 5000 : 3500;
    var timer = setTimeout(dismiss, ttl);
    function dismiss() {
      clearTimeout(timer);
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
    }
    t.addEventListener('click', dismiss);
    return dismiss; // 返回手动关闭句柄
  }

  window.JX = window.JX || {};
  window.JX.toast = {
    ok:    function (title, msg) { return show('ok',    title, msg); },
    error: function (title, msg) { return show('error', title, msg); },
    warn:  function (title, msg) { return show('warn',  title, msg); },
    info:  function (title, msg) { return show('info',  title, msg); },
    show:  show,
  };
})();
