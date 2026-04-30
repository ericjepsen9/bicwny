// 觉学 · 应用内反馈浮层
// P2 #30
//
// 触发：
//   <button class="jx-feedback-trigger">反馈</button>
//   或 JX.feedback.open({ kind: 'bug' });
//
// 行为：
//   - kind picker (建议/bug/赞/其他) · message textarea · contactEmail input（仅未登录时显示）
//   - 自动附加 page / userAgent / appVersion / sessionId
//   - 提交 → POST /api/feedback · 成功 toast + 关闭 · 5/小时限速错误明示
//   - 走 a11y dialog · 焦点陷阱 + role=dialog
(function () {
  'use strict';
  if (window.JX && window.JX.feedback) return;

  var STYLE_ID = 'jx-feedback-style';
  var ROOT_ID = 'jx-feedback-root';
  var APP_VERSION = '1.0.0'; // 与构建/CHANGELOG 同步 · 反馈记录"哪个版本反馈的"

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#jx-feedback-root { position:fixed; inset:0; z-index:9100; display:none; }' +
      '#jx-feedback-root.open { display:block; }' +
      '#jx-feedback-root .jxfb-bg { position:absolute; inset:0; background:rgba(0,0,0,.4); }' +
      '#jx-feedback-root .jxfb-panel {' +
        ' position:absolute; left:0; right:0; bottom:0;' +
        ' max-width:480px; margin:0 auto;' +
        ' background:var(--bg-card,#fff);' +
        ' border-radius:18px 18px 0 0;' +
        ' padding:16px; max-height:90vh; overflow-y:auto;' +
        ' transform:translateY(100%); transition:transform .25s var(--ease,ease);' +
      '}' +
      '#jx-feedback-root.open .jxfb-panel { transform:translateY(0); }' +
      '#jx-feedback-root .jxfb-head {' +
        ' display:flex; align-items:center; justify-content:space-between;' +
        ' padding:4px 4px 12px; border-bottom:1px solid var(--border-light,rgba(0,0,0,.06));' +
      '}' +
      '#jx-feedback-root .jxfb-title {' +
        ' font:700 16px/1.4 -apple-system,"Noto Sans SC",sans-serif;' +
        ' color:var(--ink,#2B2218); letter-spacing:1.5px;' +
      '}' +
      '#jx-feedback-root .jxfb-close {' +
        ' width:36px; height:36px; border-radius:8px; cursor:pointer;' +
        ' display:flex; align-items:center; justify-content:center;' +
        ' background:transparent; border:none; color:var(--ink-3,#857360); font-size:20px;' +
      '}' +
      '#jx-feedback-root .jxfb-section { margin:14px 0; }' +
      '#jx-feedback-root .jxfb-label {' +
        ' display:block; font:600 12px/1.4 -apple-system,"Noto Sans SC",sans-serif;' +
        ' color:var(--ink-3,#857360); letter-spacing:1px; margin-bottom:6px;' +
      '}' +
      '#jx-feedback-root .jxfb-kinds { display:flex; gap:8px; flex-wrap:wrap; }' +
      '#jx-feedback-root .jxfb-kind {' +
        ' padding:6px 14px; border-radius:99px;' +
        ' font:500 13px/1.4 -apple-system,"Noto Sans SC",sans-serif;' +
        ' background:var(--bg-input,rgba(0,0,0,.04));' +
        ' border:1px solid var(--border,rgba(0,0,0,.08));' +
        ' color:var(--ink-2,#55463A); cursor:pointer;' +
      '}' +
      '#jx-feedback-root .jxfb-kind.active {' +
        ' background:var(--saffron-pale,rgba(224,120,86,.12));' +
        ' border-color:var(--saffron,#E07856); color:var(--saffron-dark,#C55F3D);' +
      '}' +
      '#jx-feedback-root .jxfb-textarea, #jx-feedback-root .jxfb-input {' +
        ' width:100%; padding:10px 12px;' +
        ' border:1px solid var(--border,rgba(0,0,0,.1));' +
        ' border-radius:10px; background:var(--bg-input,#fff);' +
        ' color:var(--ink,#2B2218); resize:vertical;' +
        ' font:14px/1.5 -apple-system,"Noto Sans SC",sans-serif; outline:none;' +
        ' box-sizing:border-box;' +
      '}' +
      '#jx-feedback-root .jxfb-textarea { min-height:120px; }' +
      '#jx-feedback-root .jxfb-textarea:focus, #jx-feedback-root .jxfb-input:focus {' +
        ' border-color:var(--saffron,#E07856);' +
      '}' +
      '#jx-feedback-root .jxfb-counter {' +
        ' text-align:right; font:11px/1.4 -apple-system,"Noto Sans SC",sans-serif;' +
        ' color:var(--ink-4,#A89888); margin-top:4px;' +
      '}' +
      '#jx-feedback-root .jxfb-meta {' +
        ' background:var(--bg-input,rgba(0,0,0,.03)); border-radius:8px;' +
        ' padding:10px 12px; font:11px/1.5 -apple-system,monospace;' +
        ' color:var(--ink-3,#857360); word-break:break-all;' +
      '}' +
      '#jx-feedback-root .jxfb-actions {' +
        ' display:flex; gap:8px; margin-top:14px;' +
      '}' +
      '#jx-feedback-root .jxfb-btn {' +
        ' flex:1; padding:12px; border-radius:10px; cursor:pointer;' +
        ' font:600 14px/1.4 -apple-system,"Noto Sans SC",sans-serif;' +
        ' letter-spacing:2px; border:none;' +
      '}' +
      '#jx-feedback-root .jxfb-btn-primary {' +
        ' background:var(--saffron,#E07856); color:#fff;' +
      '}' +
      '#jx-feedback-root .jxfb-btn-primary:disabled { opacity:.5; cursor:wait; }' +
      '#jx-feedback-root .jxfb-btn-ghost {' +
        ' background:transparent; color:var(--ink-2,#55463A);' +
        ' border:1px solid var(--border,rgba(0,0,0,.1));' +
      '}';
    var s = document.createElement('style');
    s.id = STYLE_ID; s.textContent = css;
    document.head.appendChild(s);
  }

  function getRoot() {
    var r = document.getElementById(ROOT_ID);
    if (r) return r;
    r = document.createElement('div');
    r.id = ROOT_ID;
    r.innerHTML =
      '<div class="jxfb-bg"></div>' +
      '<div class="jxfb-panel">' +
        '<div class="jxfb-head">' +
          '<div class="jxfb-title">反馈</div>' +
          '<button type="button" class="jxfb-close" aria-label="关闭">×</button>' +
        '</div>' +
        '<form class="jxfb-form">' +
          '<div class="jxfb-section">' +
            '<label class="jxfb-label">类型</label>' +
            '<div class="jxfb-kinds" role="radiogroup" aria-label="反馈类型"></div>' +
          '</div>' +
          '<div class="jxfb-section">' +
            '<label class="jxfb-label" for="jxfb-message">内容（必填）</label>' +
            '<textarea id="jxfb-message" class="jxfb-textarea" maxlength="4000" required></textarea>' +
            '<div class="jxfb-counter"><span class="jxfb-cnt">0</span> / 4000</div>' +
          '</div>' +
          '<div class="jxfb-section jxfb-email-row" style="display:none;">' +
            '<label class="jxfb-label" for="jxfb-email">联系邮箱（匿名提交必填）</label>' +
            '<input id="jxfb-email" class="jxfb-input" type="email" maxlength="200">' +
          '</div>' +
          '<div class="jxfb-section">' +
            '<label class="jxfb-label">环境信息（自动附加）</label>' +
            '<div class="jxfb-meta"></div>' +
          '</div>' +
          '<div class="jxfb-actions">' +
            '<button type="button" class="jxfb-btn jxfb-btn-ghost jxfb-cancel">取消</button>' +
            '<button type="submit" class="jxfb-btn jxfb-btn-primary jxfb-submit">提交</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(r);
    bindHandlers(r);
    return r;
  }

  var KINDS = [
    { key: 'suggestion', sc: '建议', tc: '建議',  en: 'Suggestion' },
    { key: 'bug',        sc: 'Bug', tc: 'Bug',   en: 'Bug' },
    { key: 'praise',     sc: '点赞', tc: '點讚',  en: 'Praise' },
    { key: 'other',      sc: '其他', tc: '其他',  en: 'Other' },
  ];

  var state = { kind: 'suggestion' };

  function lang() {
    return (window.JX && window.JX.lang && window.JX.lang()) || 'sc';
  }

  function applyI18n(r) {
    var l = lang();
    r.querySelector('.jxfb-title').textContent =
      l === 'en' ? 'Feedback' : (l === 'tc' ? '回饋' : '反馈');
    var labels = {
      type:    { sc:'类型', tc:'類型', en:'Kind' },
      message: { sc:'内容（必填）', tc:'內容（必填）', en:'Message (required)' },
      email:   { sc:'联系邮箱（匿名提交必填）', tc:'聯絡郵箱（匿名提交必填）', en:'Contact email (required if not signed in)' },
      env:     { sc:'环境信息（自动附加）', tc:'環境資訊（自動附加）', en:'Environment (auto-attached)' },
      cancel:  { sc:'取消', tc:'取消', en:'Cancel' },
      submit:  { sc:'提交', tc:'提交', en:'Submit' },
      msgPh:   { sc:'请描述具体问题或建议…', tc:'請描述具體問題或建議…', en:'Describe the issue or suggestion…' },
    };
    var qs = r.querySelectorAll('.jxfb-label');
    if (qs[0]) qs[0].textContent = labels.type[l] || labels.type.sc;
    if (qs[1]) qs[1].textContent = labels.message[l] || labels.message.sc;
    var emailLabel = r.querySelector('.jxfb-email-row .jxfb-label');
    if (emailLabel) emailLabel.textContent = labels.email[l] || labels.email.sc;
    var envLabel = r.querySelector('.jxfb-meta');
    if (envLabel && envLabel.previousElementSibling)
      envLabel.previousElementSibling.textContent = labels.env[l] || labels.env.sc;
    r.querySelector('.jxfb-cancel').textContent = labels.cancel[l] || labels.cancel.sc;
    r.querySelector('.jxfb-submit').textContent = labels.submit[l] || labels.submit.sc;
    r.querySelector('#jxfb-message').placeholder = labels.msgPh[l] || labels.msgPh.sc;

    // kinds chips
    var kindsBox = r.querySelector('.jxfb-kinds');
    kindsBox.innerHTML = KINDS.map(function (k) {
      var label = k[l] || k.sc;
      return '<button type="button" class="jxfb-kind' +
        (k.key === state.kind ? ' active' : '') +
        '" role="radio" aria-checked="' + (k.key === state.kind) +
        '" data-kind="' + k.key + '">' + label + '</button>';
    }).join('');
  }

  function fillMeta(r) {
    var meta = {
      page: (location.pathname.split('/').pop() || '').toLowerCase(),
      ua:   (navigator.userAgent || '').slice(0, 120) + (navigator.userAgent.length > 120 ? '…' : ''),
      ver:  APP_VERSION,
      session: (window.JX && window.JX.analytics && window.JX.analytics.sessionId) || '',
      lang: lang(),
    };
    var lines = [
      'page: ' + meta.page,
      'version: ' + meta.ver,
      'lang: ' + meta.lang,
      'ua: ' + meta.ua,
    ];
    if (meta.session) lines.push('session: ' + meta.session);
    r.querySelector('.jxfb-meta').textContent = lines.join('\n');
  }

  function showEmailIfNeeded(r) {
    var loggedIn = !!(window.JX && window.JX.tokenStore && window.JX.tokenStore.getAccess());
    r.querySelector('.jxfb-email-row').style.display = loggedIn ? 'none' : 'block';
  }

  function bindHandlers(r) {
    r.querySelector('.jxfb-bg').addEventListener('click', close);
    r.querySelector('.jxfb-close').addEventListener('click', close);
    r.querySelector('.jxfb-cancel').addEventListener('click', close);
    r.querySelector('.jxfb-kinds').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b) return;
      state.kind = b.getAttribute('data-kind');
      r.querySelectorAll('.jxfb-kind').forEach(function (el) {
        var on = el.getAttribute('data-kind') === state.kind;
        el.classList.toggle('active', on);
        el.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      if (window.JX.haptics) window.JX.haptics.selection();
    });
    var msg = r.querySelector('#jxfb-message');
    var cnt = r.querySelector('.jxfb-cnt');
    msg.addEventListener('input', function () {
      cnt.textContent = String(msg.value.length);
    });
    r.querySelector('.jxfb-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submit(r);
    });
    r.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  function submit(r) {
    var sc = (window.JX && window.JX.sc) || function (a){return a;};
    var btn = r.querySelector('.jxfb-submit');
    var msg = r.querySelector('#jxfb-message').value.trim();
    if (msg.length < 2) {
      window.JX.toast && window.JX.toast.warn(sc('请填写反馈内容', '請填寫回饋內容'));
      return;
    }
    var emailField = r.querySelector('#jxfb-email');
    var loggedIn = !!(window.JX && window.JX.tokenStore && window.JX.tokenStore.getAccess());
    var email = loggedIn ? null : (emailField && emailField.value.trim()) || '';
    if (!loggedIn && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      window.JX.toast && window.JX.toast.warn(sc('请填写联系邮箱', '請填寫聯絡郵箱'));
      return;
    }

    btn.disabled = true;
    var body = {
      kind: state.kind,
      message: msg,
      page: (location.pathname.split('/').pop() || '').toLowerCase(),
      appVersion: APP_VERSION,
      sessionId: (window.JX.analytics && window.JX.analytics.sessionId) || undefined,
    };
    if (!loggedIn && email) body.contactEmail = email;

    var p = window.JX.api
      ? window.JX.api.post('/api/feedback', body)
      : fetch('/api/feedback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }).then(function (res) {
          if (!res.ok) return res.json().then(function (j) {
            throw new Error((j && j.error && j.error.message) || ('HTTP ' + res.status));
          });
          return res.json().then(function (j) { return j.data || j; });
        });

    p.then(function () {
      window.JX.haptics && window.JX.haptics.success();
      window.JX.toast && window.JX.toast.ok(sc('已提交 · 感谢反馈', '已提交 · 感謝回饋'));
      r.querySelector('#jxfb-message').value = '';
      r.querySelector('.jxfb-cnt').textContent = '0';
      close();
    }).catch(function (e) {
      window.JX.toast && window.JX.toast.error(
        sc('提交失败：', '提交失敗：') + (e.message || e),
      );
    }).finally(function () {
      btn.disabled = false;
    });
  }

  function open(opts) {
    injectStyle();
    var r = getRoot();
    if (opts && opts.kind) state.kind = opts.kind;
    applyI18n(r);
    fillMeta(r);
    showEmailIfNeeded(r);
    r.classList.add('open');
    if (window.JX.a11y) {
      window.JX.a11y.dialog('open', r, {
        label: lang() === 'en' ? 'Feedback' : '反馈',
      });
    }
    setTimeout(function () {
      try { r.querySelector('#jxfb-message').focus(); } catch (_) {}
    }, 100);
  }

  function close() {
    var r = document.getElementById(ROOT_ID);
    if (!r) return;
    r.classList.remove('open');
    if (window.JX.a11y) window.JX.a11y.dialog('close', r);
  }

  function bindTriggers() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var el = t.closest('.jx-feedback-trigger, [data-jx-feedback]');
      if (!el) return;
      e.preventDefault();
      open({ kind: el.getAttribute('data-jx-feedback') || 'suggestion' });
    }, false);
  }

  window.JX = window.JX || {};
  window.JX.feedback = { open: open, close: close };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTriggers);
  } else {
    bindTriggers();
  }
})();
