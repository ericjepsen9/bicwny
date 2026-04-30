// 学员侧导航 URL 单一合约（H3）
//
// 所有跳 quiz / reading / mistake-detail / scripture-detail 的入口都走这里，
// 集中维护 ?from= 枚举与 query string 拼装。新增入口必须更新 FROM。
//
// 用法：
//   var url = window.JX.nav.toQuiz({ lessonId, courseId, from: 'reading', slug, nextLessonId });
//   location.href = window.JX.nav.toReading({ slug, lessonId });
//
// 完成 quiz 后回哪里：
//   var url = window.JX.nav.fromQuizReturnUrl({ from, slug, lessonId, questionId });
//   var label = window.JX.nav.fromQuizReturnLabel({ from }, sc);
(function () {
  var enc = encodeURIComponent;
  var FROM = Object.freeze({
    HOME:      'home',
    COURSES:   'courses',
    CENTER:    'center',
    DETAIL:    'detail',
    READING:   'reading',
    MISTAKE:   'mistake',
    FAVORITES: 'favorites',
    PROFILE:   'profile',
  });

  function appendIf(url, key, val) {
    if (val == null || val === '') return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + key + '=' + enc(val);
  }

  // ─── builders ────────────────────────────────────────────────
  // 跳答题
  // params: { lessonId*, courseId, from, slug, questionId, nextLessonId }
  function toQuiz(params) {
    if (!params || !params.lessonId) return 'quiz.html';
    var u = 'quiz.html?lessonId=' + enc(params.lessonId);
    u = appendIf(u, 'courseId', params.courseId);
    u = appendIf(u, 'from', params.from);
    u = appendIf(u, 'slug', params.slug);
    u = appendIf(u, 'questionId', params.questionId);
    u = appendIf(u, 'nextLessonId', params.nextLessonId);
    return u;
  }

  // 跳阅读
  // params: { slug*, lessonId, intro, from }
  function toReading(params) {
    if (!params || !params.slug) return 'courses.html';
    var u = 'scripture-reading.html?slug=' + enc(params.slug);
    u = appendIf(u, 'lessonId', params.lessonId);
    if (params.intro) u = appendIf(u, 'intro', '1');
    u = appendIf(u, 'from', params.from);
    return u;
  }

  // 跳错题详情
  // params: { questionId*, from }
  function toMistakeDetail(params) {
    if (!params || !params.questionId) return 'mistakes.html';
    var u = 'mistake-detail.html?questionId=' + enc(params.questionId);
    u = appendIf(u, 'from', params.from);
    return u;
  }

  // 跳法本目录
  // params: { slug*, mode, from }   mode 可选 'quiz' / 'read'（默认）
  function toScriptureDetail(params) {
    if (!params || !params.slug) return 'courses.html';
    var u = 'scripture-detail.html?slug=' + enc(params.slug);
    u = appendIf(u, 'mode', params.mode);
    u = appendIf(u, 'from', params.from);
    return u;
  }

  // ─── return-url after quiz ───────────────────────────────────
  // 入口约定：
  //   reading   → quiz.html?lessonId=X&from=reading&slug=Y           完成回 reading 同课时
  //   detail    → quiz.html?lessonId=X&from=detail&slug=Y            完成回 detail
  //   mistake   → quiz.html?lessonId=X&from=mistake&questionId=Z     完成回 mistake-detail
  //   favorites → quiz.html?lessonId=X&from=favorites                完成回 favorites
  //   center    → quiz.html?lessonId=X&from=center&slug=Y            完成回 quiz-center
  //   default   → home.html
  function fromQuizReturnUrl(params) {
    var from = (params && params.from) || '';
    var slug = (params && params.slug) || '';
    var lessonId = (params && params.lessonId) || '';
    var questionId = (params && params.questionId) || '';
    if (from === FROM.READING && slug) return toReading({ slug: slug, lessonId: lessonId });
    if (from === FROM.DETAIL && slug)  return toScriptureDetail({ slug: slug });
    if (from === FROM.MISTAKE && questionId) return toMistakeDetail({ questionId: questionId });
    if (from === FROM.FAVORITES) return 'favorites.html';
    if (from === FROM.CENTER)    return 'quiz-center.html';
    return 'home.html';
  }

  // 完成页主按钮文案
  // sc(zh-Hans, zh-Hant) 通常来自调用方 · 不强制依赖 lang.js
  function fromQuizReturnLabel(params, sc) {
    var from = (params && params.from) || '';
    if (typeof sc !== 'function') sc = function (a) { return a; };
    var map = {};
    map[FROM.READING]   = sc('继续阅读', '繼續閱讀');
    map[FROM.DETAIL]    = sc('回到目录', '回到目錄');
    map[FROM.MISTAKE]   = sc('回到错题', '回到錯題');
    map[FROM.FAVORITES] = sc('回到收藏', '回到收藏');
    map[FROM.CENTER]    = sc('回到答题', '回到答題');
    return map[from] || sc('返回首页', '返回首頁');
  }

  // ─── return-url for reading / detail nav-back ────────────────
  // reading 顶部 ← 按 ?from= 决定回哪里
  //   detail   → toScriptureDetail({ slug })
  //   home     → home.html
  //   courses  → courses.html (default)
  //   center   → quiz-center.html
  function fromReadingReturnUrl(params) {
    var from = (params && params.from) || '';
    var slug = (params && params.slug) || '';
    if (from === FROM.DETAIL && slug) return toScriptureDetail({ slug: slug });
    if (from === FROM.HOME)    return 'home.html';
    if (from === FROM.CENTER)  return 'quiz-center.html';
    return 'courses.html';
  }

  // detail 顶部 ← 按 ?from= 决定回哪里
  //   reading  → toReading({ slug, lessonId })
  //   home     → home.html
  //   center   → quiz-center.html
  //   courses  → courses.html (default)
  function fromDetailReturnUrl(params) {
    var from = (params && params.from) || '';
    var slug = (params && params.slug) || '';
    var lessonId = (params && params.lessonId) || '';
    if (from === FROM.READING && slug) return toReading({ slug: slug, lessonId: lessonId });
    if (from === FROM.HOME)    return 'home.html';
    if (from === FROM.CENTER)  return 'quiz-center.html';
    return 'courses.html';
  }

  window.JX = window.JX || {};
  window.JX.nav = {
    FROM: FROM,
    toQuiz: toQuiz,
    toReading: toReading,
    toMistakeDetail: toMistakeDetail,
    toScriptureDetail: toScriptureDetail,
    fromQuizReturnUrl: fromQuizReturnUrl,
    fromQuizReturnLabel: fromQuizReturnLabel,
    fromReadingReturnUrl: fromReadingReturnUrl,
    fromDetailReturnUrl: fromDetailReturnUrl,
  };

  // ─── M2 · overlay 客户端缓存 ──────────────────────────────────
  // PATCH /api/enrollments/:courseId/progress 响应里附带最新 overlay。
  // 调用方写到 sessionStorage 后，下一页 reading/detail boot 时优先读。
  // 5 分钟 TTL · 防 PATCH→GET 数据库复制延迟造成的 stale 渲染。
  var OVERLAY_TTL_MS = 5 * 60 * 1000;
  var OVERLAY_PREFIX = 'jx-overlay:';
  // A3: 跨账户隔离 · key 含 userId 防 user1 写、user2 读到的情况
  // 未登录场景（require-auth.js 还没填 JX.user）→ 直接 no-op，等登录后再 cache
  function currentUserId() {
    return (window.JX && window.JX.user && window.JX.user.id) || '';
  }
  var OVERLAY_KEY = function (userId, courseId) {
    return OVERLAY_PREFIX + userId + ':' + courseId;
  };

  function saveOverlayCache(courseId, overlay) {
    var uid = currentUserId();
    if (!uid || !courseId || !overlay) return;
    try {
      sessionStorage.setItem(OVERLAY_KEY(uid, courseId), JSON.stringify({
        patchedAt: Date.now(),
        overlay: overlay,
      }));
    } catch (_) { /* 隐私模式静默失败 */ }
  }

  function readOverlayCache(courseId) {
    var uid = currentUserId();
    if (!uid || !courseId) return null;
    try {
      var key = OVERLAY_KEY(uid, courseId);
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || (Date.now() - (parsed.patchedAt || 0)) > OVERLAY_TTL_MS) {
        sessionStorage.removeItem(key);
        return null;
      }
      return parsed.overlay;
    } catch (_) { return null; }
  }

  // A3: logout / 切账户时调 · 清掉所有 jx-overlay:* 残留
  function clearOverlayCache() {
    try {
      var i = sessionStorage.length;
      while (i-- > 0) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf(OVERLAY_PREFIX) === 0) sessionStorage.removeItem(k);
      }
    } catch (_) { /* 静默 */ }
  }

  // 把 cache 合并进服务端 overlay
  // - completedLessonIds：union 永远安全（更多 = 更新鲜，跨 tab 不冲突）
  // - currentLessonId：B4 不再用 cache 覆盖 · 跨 tab 时 cache 可能是别 tab 写的，
  //   会把当前 tab 的阅读位置推走（user 在 tab1 读 lesson10，tab2 答完 lesson5，
  //   tab1 cache 读到 lesson5 → 下次续读跳错）。改为始终以服务端 overlay 为准。
  //   同 tab 内 PATCH 写完读 cache 没意义（reading boot 才读 · 这时已经 GET 拿到最新）
  function mergeOverlayCache(serverOverlay, cached) {
    if (!cached) return serverOverlay;
    if (!serverOverlay) return cached;
    var merged = Object.assign({}, serverOverlay);
    var srvIds = serverOverlay.completedLessonIds || [];
    var cacheIds = cached.completedLessonIds || [];
    var seen = {};
    var union = [];
    srvIds.concat(cacheIds).forEach(function (id) {
      if (!seen[id]) { seen[id] = 1; union.push(id); }
    });
    merged.completedLessonIds = union;
    // 进度百分比按 union 重算
    if (typeof merged.totalLessons === 'number' && merged.totalLessons > 0) {
      merged.progressPercent = Math.round(union.length / merged.totalLessons * 100);
    }
    return merged;
  }

  window.JX.overlayCache = {
    save: saveOverlayCache,
    read: readOverlayCache,
    merge: mergeOverlayCache,
    clear: clearOverlayCache,
  };

  // ─── A4 · 返回按钮优先用浏览器历史栈 ──────────────────────
  // 多层 from 嵌套（home → reading → detail → reading → detail）下，硬编码
  // fromXxxReturnUrl 容易在两屏间反复横跳。浏览器历史栈天然记录完整链路，
  // 优先 history.back()；只有深链入站（history.length === 1）才退回 href。
  function attachHistoryBackFallback(el) {
    if (!el) return;
    // R9: dataset 防双重绑定 · auto-attach 与显式调用都安全
    if (el.dataset.histBackBound === '1') return;
    el.dataset.histBackBound = '1';
    el.addEventListener('click', function (ev) {
      // history.length > 1 说明本 tab 内有上一页 · 同源默认假设（跨域跳进来的极少）
      if (history.length > 1) {
        ev.preventDefault();
        history.back();
      }
      // 否则让 href 接管（深链 / 新 tab 打开）
    });
  }
  window.JX.nav.attachHistoryBackFallback = attachHistoryBackFallback;

  // R9: 自动给所有 a.nav-back 挂 history.back fallback · 二级页统一行为
  //   - 与显式 attachHistoryBackFallback 调用兼容（dataset 防双绑）
  //   - 只覆盖 anchor 元素 · 自定义 button / 非 .nav-back 不动
  function autoAttachAll() {
    var els = document.querySelectorAll('a.nav-back');
    for (var i = 0; i < els.length; i++) attachHistoryBackFallback(els[i]);
  }

  // tab-bar 切换用 location.replace 不入历史栈
  //   - 用户点 home tab → courses tab → reading → ←，预期回到 courses 而不是 home
  //   - 之前 <a href> 切 tab 每次都 push history · 多 tab 切换后 ← 会反复横跳
  //   - 当前 tab 已 active 时 click 不动（保持原状不刷新）
  //   - 非 tab-bar 的 a 链接不影响（仍用默认 push）
  function autoAttachTabBar() {
    var tabs = document.querySelectorAll('.tab-bar .tab-item');
    for (var i = 0; i < tabs.length; i++) {
      var a = tabs[i];
      if (a.dataset.tabBound === '1') continue;
      a.dataset.tabBound = '1';
      a.addEventListener('click', (function (el) {
        return function (ev) {
          var href = el.getAttribute('href');
          if (!href || href === '#') return;
          ev.preventDefault();
          if (el.classList.contains('active')) return; // 已在该 tab · 不动
          location.replace(href);
        };
      })(a));
    }
  }

  function runAutoAttach() {
    autoAttachAll();
    autoAttachTabBar();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAutoAttach);
  } else {
    runAutoAttach();
  }
})();
