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

  // ─── 返回按钮策略 ──────────────────────────────────────────
  // 设计决策：mature mobile app 的 ← 应该指向'逻辑父级'，不是浏览器历史栈。
  //   - 浏览器历史会包含 tab 切换、refresh、跨域跳转等噪音
  //   - 用户点 ← 期望的是'回到这条流的上一步'，不是'撤销刚才的导航'
  // 实现：每个页面 nav-back href 写'逻辑父级'路径
  //   - 单入口页面：硬编码（如 settings → profile）
  //   - 多入口页面：?from= 参数决定（如 reading 可能从 home/courses/detail 进）
  //
  // 旧的 attachHistoryBackFallback 保留导出 · 给少数页面（quiz）显式调用 ·
  // 因 quiz 完成页要 await PATCH 后再跳，比单纯 href 复杂
  function attachHistoryBackFallback(el) {
    if (!el) return;
    if (el.dataset.histBackBound === '1') return;
    el.dataset.histBackBound = '1';
    el.addEventListener('click', function (ev) {
      if (history.length > 1) {
        ev.preventDefault();
        history.back();
      }
    });
  }
  window.JX.nav.attachHistoryBackFallback = attachHistoryBackFallback;

  // 移动键盘弹起时输入框被遮挡 · 自动 scrollIntoView
  // 移动浏览器（尤其 Android WebView）虚拟键盘弹出后不自动让焦点元素可见
  // 监听全局 focusin · input / textarea / [contenteditable] 都触发
  // 延迟 250ms 等键盘动画完成 · 然后 scrollIntoView({block:'center'})
  function autoScrollOnFocus() {
    document.addEventListener('focusin', function (ev) {
      var t = ev.target;
      if (!t) return;
      var tag = t.tagName;
      var isField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        t.isContentEditable;
      if (!isField) return;
      // hidden / submit / button 类 input 不需要滚动
      if (tag === 'INPUT' && /^(hidden|submit|button|checkbox|radio)$/i.test(t.type)) return;
      setTimeout(function () {
        try { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      }, 250);
    });
  }

  // 离线状态顶部 banner · 监听 navigator.onLine
  // 移动端常切网络（地铁、电梯）· app 应明确告知离线
  // 离线时显示红条 · 上线时短暂显示绿条后自动消失
  function setupOfflineBanner() {
    var banner = document.createElement('div');
    banner.id = 'jx-net-banner';
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:9999;' +
      'padding:6px 12px;text-align:center;font-size:.75rem;letter-spacing:1px;' +
      'transform:translateY(-100%);transition:transform .25s ease;' +
      'pointer-events:none;color:#FFF;';
    document.body.appendChild(banner);
    function show(online) {
      if (online) {
        banner.style.background = '#7D9A6C';
        banner.textContent = '已恢复网络连接';
        banner.style.transform = 'translateY(0)';
        setTimeout(function () { banner.style.transform = 'translateY(-100%)'; }, 1500);
      } else {
        banner.style.background = '#C0392B';
        banner.textContent = '离线状态 · 部分功能受限';
        banner.style.transform = 'translateY(0)';
      }
    }
    window.addEventListener('online', function () { show(true); });
    window.addEventListener('offline', function () { show(false); });
    // 初始检查
    if (navigator.onLine === false) show(false);
  }

  // Capacitor / 原生 WebView 系统返回按钮拦截
  //   - Android 物理 / 手势返回触发 backButton 事件
  //   - 决策顺序：(1) 关掉打开的 sheet/modal · (2) 走 .nav-back 逻辑父级 ·
  //              (3) tab 根页 · 双击 2s 内退出（mature Android app 标准）·
  //                 第一次显示 toast '再按一次退出' · 第二次 exitApp
  //   - 不再用 history.back() · 与逻辑父级导航策略一致
  //   - 现在 web 环境 window.Capacitor 不存在 = no-op
  function setupCapacitorBackButton() {
    var cap = window.Capacitor;
    if (!cap || !cap.Plugins || !cap.Plugins.App) return;
    var App = cap.Plugins.App;
    if (typeof App.addListener !== 'function') return;
    var lastBackAt = 0;
    var EXIT_WINDOW_MS = 2000;
    App.addListener('backButton', function () {
      // 1) 优先关 modal / sheet · 一般标 .is-open 或 [open]
      var openSheet = document.querySelector(
        '.sheet.is-open, .modal.is-open, dialog[open]'
      );
      if (openSheet) {
        var closeBtn = openSheet.querySelector('[data-close], .sheet-close, .modal-close');
        if (closeBtn) closeBtn.click();
        else {
          openSheet.classList.remove('is-open');
          if (openSheet.tagName === 'DIALOG' && openSheet.close) openSheet.close();
        }
        lastBackAt = 0;
        return;
      }
      // 2) 走逻辑父级（页面顶部 ← 按钮）
      var navBack = document.querySelector('.nav-back, [data-nav-back]');
      if (navBack && navBack.href) {
        location.href = navBack.href;
        lastBackAt = 0;
        return;
      }
      // 3) tab 根页 · 双击退出确认
      var now = Date.now();
      if (now - lastBackAt < EXIT_WINDOW_MS) {
        if (typeof App.exitApp === 'function') App.exitApp();
        return;
      }
      lastBackAt = now;
      // 优先用项目自带 toast · 没有就内联浮层
      var msg = window.JX && window.JX.sc
        ? window.JX.sc('再按一次退出', '再按一次退出')
        : '再按一次退出';
      if (window.JX && window.JX.toast && typeof window.JX.toast.info === 'function') {
        window.JX.toast.info(msg);
      } else {
        showExitToast(msg);
      }
    });
  }

  // 简易浮层 · 仅 Capacitor backButton 的兜底使用
  function showExitToast(text) {
    var t = document.createElement('div');
    t.textContent = text;
    t.style.cssText =
      'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:99999;' +
      'padding:10px 20px;background:rgba(0,0,0,.78);color:#FFF;border-radius:18px;' +
      'font-size:.875rem;letter-spacing:1.5px;pointer-events:none;' +
      'opacity:0;transition:opacity .2s;';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 220);
    }, 1600);
  }

  // tab-bar active 状态自动同步
  //   每个 page hardcode 自己的 active tab · 但 Capacitor restore 状态 / 直接 deep
  //   link 进入时 hardcode 可能错位 · DOM 渲染后按当前 URL 重置一遍
  //   防御性：不依赖 hardcode · 自己根据 location.pathname 决定哪个 active
  function syncTabBarActive() {
    var bar = document.querySelector('.tab-bar');
    if (!bar) return; // 非 tab 根页 · 没 tab-bar · 跳过
    var here = (location.pathname.split('/').pop() || '').toLowerCase();
    if (!here || here === '') here = 'home.html'; // / → home
    var items = bar.querySelectorAll('.tab-item');
    var matched = false;
    items.forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('?')[0].split('#')[0].toLowerCase();
      var hrefName = href.split('/').pop();
      if (hrefName === here) {
        a.classList.add('active');
        matched = true;
      } else {
        a.classList.remove('active');
      }
    });
    // 如果当前页不是 4 个 tab root（比如 quiz / scripture-detail）· 全部移除 active
    //   （但这种页一般没 tab-bar · 上面 early return 已经过滤）
    if (!matched && items.length > 0) {
      // 兜底什么也不干 · 让首个保持高亮反而 confusing · 索性都灭
    }
  }

  function runAutoAttach() {
    autoScrollOnFocus();
    setupOfflineBanner();
    setupCapacitorBackButton();
    syncTabBarActive();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAutoAttach);
  } else {
    runAutoAttach();
  }
})();
