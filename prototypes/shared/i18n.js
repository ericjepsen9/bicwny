// 觉学 · i18n 词典 · key-based · 给 JS 拼接 UI 用
// P2 #21 · 三语言（sc / tc / en）
//
// 用法：
//   JX.t('common.confirm');          // 当前语言下取
//   JX.t('quiz.scoreSummary', n);    // 占位 {0} {1} 替换
//
// 历史 JX.sc(sc, tc, en) 仍然可用（推荐内联同步翻译时使用）
// 词典适合：toast 文案、按钮态文字、错误提示、计数标签
//
// 加 key 时记得三语都填 · 缺 en 会自动 fallback sc
(function () {
  'use strict';

  var DICT = {
    // ── 通用 ──
    'common.confirm':     ['确定', '確定', 'Confirm'],
    'common.cancel':      ['取消', '取消', 'Cancel'],
    'common.save':        ['保存', '保存', 'Save'],
    'common.delete':      ['删除', '刪除', 'Delete'],
    'common.edit':        ['编辑', '編輯', 'Edit'],
    'common.retry':       ['重试', '重試', 'Retry'],
    'common.refresh':     ['刷新', '刷新', 'Refresh'],
    'common.loading':     ['加载中…', '載入中…', 'Loading…'],
    'common.empty':       ['暂无数据', '暫無資料', 'No data'],
    'common.error':       ['出错了', '出錯了', 'Something went wrong'],
    'common.success':     ['成功', '成功', 'Success'],
    'common.networkErr':  ['网络异常', '網絡異常', 'Network error'],
    'common.offlineSaved':['已保存 · 联网后自动同步', '已儲存 · 聯網後自動同步', 'Saved · will sync when online'],
    'common.back':        ['返回', '返回', 'Back'],
    'common.close':       ['关闭', '關閉', 'Close'],
    'common.search':      ['搜索', '搜尋', 'Search'],
    'common.more':        ['更多', '更多', 'More'],

    // ── Tab 栏 ──
    'tab.home':     ['首页', '首頁', 'Home'],
    'tab.courses':  ['法本', '法本', 'Texts'],
    'tab.quiz':     ['答题', '答題', 'Quiz'],
    'tab.profile':  ['我的', '我的', 'Profile'],

    // ── 设置页 ──
    'settings.title':        ['设置', '設定', 'Settings'],
    'settings.account':      ['账号与安全', '帳號與安全', 'Account & Security'],
    'settings.language':     ['语言', '語言', 'Language'],
    'settings.appearance':   ['外观', '外觀', 'Appearance'],
    'settings.fontSize':     ['字体大小', '字體大小', 'Font Size'],
    'settings.notifications':['通知偏好', '通知偏好', 'Notifications'],
    'settings.haptics':      ['交互反馈', '交互回饋', 'Haptics'],
    'settings.privacy':      ['隐私', '隱私', 'Privacy'],
    'settings.storage':      ['存储', '儲存', 'Storage'],
    'settings.about':        ['关于', '關於', 'About'],
    'settings.theme':        ['主题', '主題', 'Theme'],
    'settings.themeAuto':    ['跟随系统', '跟隨系統', 'System'],
    'settings.themeLight':   ['浅色',   '淺色',   'Light'],
    'settings.themeDark':    ['深色',   '深色',   'Dark'],
    'settings.logout':       ['退出登录', '退出登入', 'Sign out'],

    // ── 答题 ──
    'quiz.correct':    ['✓ 回答正确！', '✓ 回答正確！', '✓ Correct!'],
    'quiz.wrong':      ['✗ 回答有误', '✗ 回答有誤', '✗ Incorrect'],
    'quiz.skip':       ['跳过', '跳過', 'Skip'],
    'quiz.skipped':    ['已跳过', '已跳過', 'Skipped'],
    'quiz.submit':     ['提交', '提交', 'Submit'],
    'quiz.next':       ['下一题', '下一題', 'Next'],
    'quiz.finish':     ['完成', '完成', 'Finish'],
    'quiz.refSource':  ['请参考法本原文', '請參考法本原文', 'Refer to the source text'],

    // ── 法本/课程 ──
    'course.allBooks':    ['全部法本', '全部法本', 'All Texts'],
    'course.enrolled':    ['已加入',  '已加入',  'Enrolled'],
    'course.available':   ['未加入',  '未加入',  'Available'],
    'course.progress':    ['学习进度', '學習進度', 'Progress'],
    'course.chapters':    ['章节', '章節', 'Chapters'],
    'course.lessons':     ['课时', '課時', 'Lessons'],

    // ── 错题 / 收藏 ──
    'mistakes.title':   ['错题本', '錯題本', 'Mistakes'],
    'mistakes.empty':   ['暂无错题', '暫無錯題', 'No mistakes yet'],
    'mistakes.removed': ['已从错题本移除', '已從錯題本移除', 'Removed from mistakes'],
    'fav.title':        ['收藏', '收藏', 'Favorites'],
    'fav.empty':        ['还没有收藏', '還沒有收藏', 'No favorites yet'],
    'fav.removed':      ['已取消收藏', '已取消收藏', 'Unfavorited'],

    // ── SM-2 复习 ──
    'sm2.title':       ['间隔复习', '間隔複習', 'Spaced Review'],
    'sm2.again':       ['重来', '重來', 'Again'],
    'sm2.hard':        ['困难', '困難', 'Hard'],
    'sm2.good':        ['合格', '合格', 'Good'],
    'sm2.easy':        ['容易', '容易', 'Easy'],
    'sm2.allDone':     ['今日已复习完毕', '今日已複習完畢', 'All done for today'],
  };

  function get(key) {
    var row = DICT[key];
    if (!row) return key;
    var lang = (window.JX && window.JX.lang && window.JX.lang()) || 'sc';
    var i = lang === 'tc' ? 1 : (lang === 'en' ? 2 : 0);
    return row[i] != null ? row[i] : row[0];
  }

  // {0} {1} 占位替换 · args 任意个
  function t(key) {
    var s = get(key);
    if (arguments.length <= 1) return s;
    var args = Array.prototype.slice.call(arguments, 1);
    return s.replace(/\{(\d+)\}/g, function (m, idx) {
      var v = args[+idx];
      return v == null ? '' : String(v);
    });
  }

  // 注册自定义 key（页面级补充翻译）
  function register(map) {
    if (!map || typeof map !== 'object') return;
    Object.keys(map).forEach(function (k) {
      var v = map[k];
      if (Array.isArray(v) && v.length >= 2) DICT[k] = v;
    });
  }

  window.JX = window.JX || {};
  window.JX.t = t;
  window.JX.i18n = { register: register, get: get, dict: DICT };
})();
