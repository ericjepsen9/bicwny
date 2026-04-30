// 共享 UI 渲染辅助 · 减少 27 个 page 之间重复实现
// 用法：var html = window.JX.components.coverHtml(course, { className: 'book-cover-emoji' });
(function () {
  var escapeHtml = (window.JX && window.JX.util && window.JX.util.escapeHtml) || function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // 法本封面 HTML · 优先用 coverImageUrl · 没图回落 emoji 渲染
  //   opts.emojiClass：emoji span 的 className
  //   opts.imgAlt：alt 文案 · 默认空（装饰性封面）
  //   opts.onErrorFallback：true 时给 img 加 onerror 回落 emoji（仅老格式有效）
  //
  // 新格式（自动检测 -1024.webp 后缀）→ 输出 <picture> + srcset
  //   320 / 640 / 1024 三尺寸 WebP · 浏览器按 viewport + DPR 选最合适
  //   sizes 默认 (max-width: 480px) 33vw, 200px · 调用方可覆盖
  // 老格式（任意单文件）→ 输出 <img> · 兼容历史封面
  function coverHtml(course, opts) {
    opts = opts || {};
    var emojiClass = opts.emojiClass || 'book-cover-emoji';
    var alt = opts.imgAlt == null ? '' : opts.imgAlt;
    var emoji = (course && course.coverEmoji) || '🪷';
    var emojiSpan = '<span class="' + escapeHtml(emojiClass) + '">' + escapeHtml(emoji) + '</span>';
    if (!course || !course.coverImageUrl) return emojiSpan;

    var url = course.coverImageUrl;
    var m = url.match(/^(.*)-1024\.webp$/);
    if (m) {
      // 新格式 multi-variant · <picture> + srcset
      var base = m[1];
      var sizes = opts.sizes || '(max-width: 480px) 33vw, 200px';
      return '<picture>' +
        '<source type="image/webp" srcset="' +
          escapeHtml(base) + '-320.webp 320w, ' +
          escapeHtml(base) + '-640.webp 640w, ' +
          escapeHtml(base) + '-1024.webp 1024w" ' +
          'sizes="' + escapeHtml(sizes) + '">' +
        '<img src="' + escapeHtml(base) + '-640.webp" alt="' + escapeHtml(alt) +
          '" loading="lazy" decoding="async">' +
        '</picture>';
    }
    // 老格式 · 单文件 + onerror 回落 emoji
    var onErr = opts.onErrorFallback
      ? ' onerror="this.parentNode.innerHTML=\'' + emojiSpan.replace(/'/g, "\\'") + '\'"'
      : '';
    return '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) +
           '" loading="lazy" decoding="async"' + onErr + '>';
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
