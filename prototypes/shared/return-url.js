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

  window.JX = window.JX || {};
  window.JX.nav = {
    FROM: FROM,
    toQuiz: toQuiz,
    toReading: toReading,
    toMistakeDetail: toMistakeDetail,
    toScriptureDetail: toScriptureDetail,
    fromQuizReturnUrl: fromQuizReturnUrl,
    fromQuizReturnLabel: fromQuizReturnLabel,
  };
})();
