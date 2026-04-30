// 共享 UI 渲染辅助 · 减少 27 个 page 之间重复实现
// 用法：var html = window.JX.components.coverHtml(course, { className: 'book-cover-emoji' });
(function () {
  var escapeHtml = (window.JX && window.JX.util && window.JX.util.escapeHtml) || function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // 法本封面 HTML · 优先用 coverImageUrl · 没图回落 emoji 渲染
  //   opts.emojiClass：emoji span 的 className · 各页面卡片样式不同
  //   opts.imgAlt：alt 文案 · 默认空（封面图片是装饰性的）
  //   opts.onErrorFallback：true 时给 img 加 onerror · 加载失败回落到 emoji span
  //     注意 onerror 内嵌 inline JS · 调用方需保证父节点能直接放 emoji span
  function coverHtml(course, opts) {
    opts = opts || {};
    var emojiClass = opts.emojiClass || 'book-cover-emoji';
    var alt = opts.imgAlt == null ? '' : opts.imgAlt;
    var emoji = (course && course.coverEmoji) || '🪷';
    var emojiSpan = '<span class="' + escapeHtml(emojiClass) + '">' + escapeHtml(emoji) + '</span>';
    if (course && course.coverImageUrl) {
      var onErr = opts.onErrorFallback
        ? ' onerror="this.parentNode.innerHTML=\'' + emojiSpan.replace(/'/g, "\\'") + '\'"'
        : '';
      return '<img src="' + escapeHtml(course.coverImageUrl) + '" alt="' + escapeHtml(alt) +
             '" loading="lazy" decoding="async"' + onErr + '>';
    }
    return emojiSpan;
  }

  // sc/tc 自适应法本标题 · titleTraditional 缺则回落 title
  function courseTitle(course) {
    if (!course) return '';
    var sc = window.JX && window.JX.sc;
    if (typeof sc !== 'function') return course.title || '';
    return sc(course.title, course.titleTraditional || course.title);
  }

  window.JX = window.JX || {};
  window.JX.components = {
    coverHtml: coverHtml,
    courseTitle: courseTitle,
  };
})();
