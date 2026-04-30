// 觉学 · 全站搜索浮层
// P2 #24
//
// 用法：
//   <button class="jx-search-trigger">搜索</button>
//   或代码触发 JX.search.open()
//
// 行为：
//   - 点击触发 → 全屏覆盖搜索框
//   - 输入 250ms 防抖后调 /api/search
//   - 结果按 type 分组（法本 / 课时 / 题目）· 点击跳到对应页
//   - ESC / 点空白 / 顶部 × 关闭
//   - 命中关键词 <mark> 高亮
//
// 不依赖 lang.js · 占位符与提示走 sc/tc/en 内联
(function () {
  'use strict';
  if (window.JX && window.JX.search) return;

  var STYLE_ID = 'jx-search-style';
  var ROOT_ID = 'jx-search-root';
  var DEBOUNCE_MS = 250;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#jx-search-root { position:fixed; inset:0; z-index:9000; display:none; }' +
      '#jx-search-root.open { display:block; }' +
      '#jx-search-root .jxs-bg { position:absolute; inset:0; background:rgba(0,0,0,.45); }' +
      '#jx-search-root .jxs-panel {' +
        ' position:absolute; top:0; left:0; right:0;' +
        ' background:var(--bg-card,#fff);' +
        ' max-width:480px; margin:0 auto;' +
        ' display:flex; flex-direction:column;' +
        ' max-height:100vh; height:100vh;' +
      '}' +
      '#jx-search-root .jxs-head {' +
        ' display:flex; align-items:center; gap:8px; padding:12px 12px 8px;' +
        ' border-bottom:1px solid var(--border-light,rgba(0,0,0,.06));' +
      '}' +
      '#jx-search-root .jxs-input {' +
        ' flex:1; padding:10px 12px; border:1px solid var(--border,rgba(0,0,0,.1));' +
        ' border-radius:10px; background:var(--bg-input,#fff); color:var(--ink,#2B2218);' +
        ' font:14px/1.4 -apple-system,"Noto Sans SC",sans-serif; outline:none;' +
      '}' +
      '#jx-search-root .jxs-input:focus { border-color:var(--saffron,#E07856); }' +
      '#jx-search-root .jxs-close {' +
        ' width:38px; height:38px; border-radius:8px; flex-shrink:0; cursor:pointer;' +
        ' display:flex; align-items:center; justify-content:center; background:transparent;' +
        ' color:var(--ink-3,#857360); font-size:18px; border:none;' +
      '}' +
      '#jx-search-root .jxs-results { flex:1; overflow-y:auto; padding:8px 12px 16px; }' +
      '#jx-search-root .jxs-empty {' +
        ' text-align:center; padding:40px 20px; color:var(--ink-3,#857360); font-size:13px;' +
      '}' +
      '#jx-search-root .jxs-group-head {' +
        ' font:600 11px/1.4 -apple-system,"Noto Sans SC",sans-serif;' +
        ' color:var(--ink-3,#857360); letter-spacing:1.5px; padding:14px 4px 8px;' +
      '}' +
      '#jx-search-root .jxs-hit {' +
        ' display:block; padding:10px 12px; margin-bottom:6px; cursor:pointer;' +
        ' border-radius:8px; background:var(--glass-thick,rgba(0,0,0,.02));' +
        ' border:1px solid var(--border-light,rgba(0,0,0,.04));' +
        ' text-decoration:none; color:inherit;' +
      '}' +
      '#jx-search-root .jxs-hit:hover { border-color:var(--saffron-light,rgba(224,120,86,.3)); }' +
      '#jx-search-root .jxs-title {' +
        ' font:600 14px/1.4 -apple-system,"Noto Sans SC",sans-serif;' +
        ' color:var(--ink,#2B2218); margin-bottom:3px;' +
      '}' +
      '#jx-search-root .jxs-meta {' +
        ' font:11px/1.4 -apple-system,"Noto Sans SC",sans-serif;' +
        ' color:var(--ink-3,#857360); letter-spacing:.5px;' +
      '}' +
      '#jx-search-root mark {' +
        ' background:var(--saffron-pale,rgba(224,120,86,.15));' +
        ' color:var(--saffron-dark,#C55F3D); padding:0 2px; border-radius:2px;' +
      '}';
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  var debounceTimer = null;
  var lastQ = '';
  var inflightCtrl = null;

  function getRoot() {
    var r = document.getElementById(ROOT_ID);
    if (r) return r;
    r = document.createElement('div');
    r.id = ROOT_ID;
    r.innerHTML =
      '<div class="jxs-bg"></div>' +
      '<div class="jxs-panel">' +
        '<div class="jxs-head">' +
          '<input type="search" class="jxs-input" placeholder="搜索…" autocomplete="off"/>' +
          '<button type="button" class="jxs-close" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="jxs-results"></div>' +
      '</div>';
    document.body.appendChild(r);
    var input = r.querySelector('.jxs-input');
    var lang = (window.JX && window.JX.lang && window.JX.lang()) || 'sc';
    input.placeholder = lang === 'en' ? 'Search…' : (lang === 'tc' ? '搜尋…' : '搜索…');
    r.querySelector('.jxs-bg').addEventListener('click', close);
    r.querySelector('.jxs-close').addEventListener('click', close);
    input.addEventListener('input', onInput);
    r.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    return r;
  }

  function open(initialQ) {
    injectStyle();
    var r = getRoot();
    r.classList.add('open');
    var input = r.querySelector('.jxs-input');
    input.value = initialQ || '';
    setTimeout(function () { try { input.focus(); } catch (_) {} }, 50);
    if (input.value) onInput();
    else r.querySelector('.jxs-results').innerHTML = renderEmpty('hint');
    if (window.JX && window.JX.haptics) window.JX.haptics.tap();
  }

  function close() {
    var r = document.getElementById(ROOT_ID);
    if (r) r.classList.remove('open');
    if (inflightCtrl) inflightCtrl.abort();
  }

  function onInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, DEBOUNCE_MS);
  }

  async function run() {
    var r = getRoot();
    var q = r.querySelector('.jxs-input').value.trim();
    if (q === lastQ) return;
    lastQ = q;
    var box = r.querySelector('.jxs-results');
    if (!q) { box.innerHTML = renderEmpty('hint'); return; }
    if (inflightCtrl) inflightCtrl.abort();
    inflightCtrl = new AbortController();
    box.innerHTML = renderEmpty('loading');
    try {
      var url = '/api/search?q=' + encodeURIComponent(q) + '&limit=30';
      // 优先用 JX.api（带鉴权 + 错误处理）· 退化到 fetch
      var data;
      if (window.JX && window.JX.api) {
        data = await window.JX.api.get('/api/search?q=' + encodeURIComponent(q) + '&limit=30', {
          signal: inflightCtrl.signal,
        });
      } else {
        var res = await fetch(url, { signal: inflightCtrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        var json = await res.json();
        data = json.data || json;
      }
      if (q !== lastQ) return; // 后来还有更新
      box.innerHTML = renderHits(data, q);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      box.innerHTML = renderEmpty('error');
    }
  }

  function renderEmpty(kind) {
    var lang = (window.JX && window.JX.lang && window.JX.lang()) || 'sc';
    var msgs = {
      hint: { sc: '输入关键词搜索法本、课时、题目', tc: '輸入關鍵字搜尋法本、課時、題目', en: 'Type to search texts, lessons, questions' },
      loading: { sc: '搜索中…', tc: '搜尋中…', en: 'Searching…' },
      error: { sc: '搜索出错 · 请稍后重试', tc: '搜尋出錯 · 請稍後重試', en: 'Search failed · please retry' },
      noresult: { sc: '没有找到匹配项', tc: '沒有找到匹配項', en: 'No results' },
    };
    return '<div class="jxs-empty">' + (msgs[kind][lang] || msgs[kind].sc) + '</div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  function highlight(s, q) {
    if (!s || !q) return escapeHtml(s || '');
    var safe = escapeHtml(s);
    var qSafe = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(qSafe, 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
  }

  function renderHits(data, q) {
    var hits = (data && data.hits) || [];
    if (hits.length === 0) return renderEmpty('noresult');
    var lang = (window.JX && window.JX.lang && window.JX.lang()) || 'sc';
    var L = {
      course:   { sc: '法本',   tc: '法本',   en: 'Texts' },
      lesson:   { sc: '课时',   tc: '課時',   en: 'Lessons' },
      question: { sc: '题目',   tc: '題目',   en: 'Questions' },
    };
    var groups = { course: [], lesson: [], question: [] };
    hits.forEach(function (h) { (groups[h.type] || (groups[h.type] = [])).push(h); });

    var html = '';
    ['course', 'lesson', 'question'].forEach(function (k) {
      var g = groups[k];
      if (!g || g.length === 0) return;
      html += '<div class="jxs-group-head">' + (L[k][lang] || L[k].sc) + ' · ' + g.length + '</div>';
      html += g.map(function (h) { return renderHit(h, q); }).join('');
    });
    return html;
  }

  function renderHit(h, q) {
    if (h.type === 'course') {
      return '<a class="jxs-hit" href="scripture-detail.html?slug=' + encodeURIComponent(h.slug) + '">' +
        '<div class="jxs-title">' + (h.coverEmoji || '') + ' ' + highlight(h.title, q) + '</div>' +
        (h.author ? '<div class="jxs-meta">' + highlight(h.author, q) + '</div>' : '') +
        '</a>';
    }
    if (h.type === 'lesson') {
      return '<a class="jxs-hit" href="scripture-reading.html?slug=' + encodeURIComponent(h.courseSlug) +
        '&lessonId=' + encodeURIComponent(h.id) + '">' +
        '<div class="jxs-title">' + highlight(h.title, q) + '</div>' +
        '<div class="jxs-meta">' + escapeHtml(h.courseTitle) + ' · 第 ' + h.order + ' 课</div>' +
        '</a>';
    }
    if (h.type === 'question') {
      return '<a class="jxs-hit" href="quiz.html?lessonId=' + encodeURIComponent(h.lessonId) +
        '&from=search">' +
        '<div class="jxs-title">' + highlight(h.questionTextPreview, q) + '</div>' +
        (h.source ? '<div class="jxs-meta">' + escapeHtml(h.source) + '</div>' : '') +
        '</a>';
    }
    return '';
  }

  function bindTriggers() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var el = t.closest('.jx-search-trigger, [data-jx-search]');
      if (!el) return;
      ev.preventDefault();
      open();
    }, false);
  }

  window.JX = window.JX || {};
  window.JX.search = { open: open, close: close };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTriggers);
  } else {
    bindTriggers();
  }
})();
