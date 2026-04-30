/* 觉学 · Skeleton 骨架屏 helper
 * P1 #18 · 替代"加载中…"占位 · 接近原生预览感
 *
 * 用法：
 *   JX.skeleton.list(container, { count: 4, variant: 'thumb' });
 *   JX.skeleton.card(container, 'detail');
 *   JX.skeleton.text(el);          // 单行文字骨架
 *   container.innerHTML = '';      // 数据到位 · 直接替换即可
 */
(function (root) {
  'use strict';

  function rowHtml(variant) {
    if (variant === 'thumb') {
      return '<div class="skel-row">'
        + '<div class="skel skel-thumb"></div>'
        + '<div class="skel-stack">'
          + '<div class="skel skel-line-lg"></div>'
          + '<div class="skel skel-line-sm"></div>'
        + '</div>'
        + '<div class="skel skel-pill"></div>'
      + '</div>';
    }
    if (variant === 'avatar') {
      return '<div class="skel-row">'
        + '<div class="skel skel-avatar"></div>'
        + '<div class="skel-stack">'
          + '<div class="skel skel-line-lg"></div>'
          + '<div class="skel skel-line-sm"></div>'
        + '</div>'
      + '</div>';
    }
    if (variant === 'simple') {
      return '<div class="skel-row">'
        + '<div class="skel-stack">'
          + '<div class="skel skel-line-lg"></div>'
          + '<div class="skel skel-meta"></div>'
        + '</div>'
      + '</div>';
    }
    // default · card
    return '<div class="skel-card">'
      + '<div class="skel skel-title" style="margin-bottom:12px;"></div>'
      + '<div class="skel skel-line" style="margin-bottom:8px;"></div>'
      + '<div class="skel skel-line-sm"></div>'
    + '</div>';
  }

  function list(container, opts) {
    if (!container) return;
    var o = opts || {};
    var count = Math.max(1, Math.min(o.count || 4, 12));
    var variant = o.variant || 'card';
    var tight = !!o.tight;
    var cls = (variant === 'card') ? 'skel-list' : (tight ? 'skel-list-tight' : 'skel-list');
    var html = '<div class="' + cls + '" data-skeleton="1" aria-hidden="true">';
    for (var i = 0; i < count; i++) html += rowHtml(variant);
    html += '</div>';
    container.innerHTML = html;
  }

  function card(container, kind) {
    if (!container) return;
    var html;
    if (kind === 'detail') {
      html = '<div class="skel-card" data-skeleton="1" aria-hidden="true">'
        + '<div class="skel skel-cover" style="margin-bottom:16px;"></div>'
        + '<div class="skel skel-title" style="margin-bottom:12px;"></div>'
        + '<div class="skel skel-line" style="margin-bottom:8px;"></div>'
        + '<div class="skel skel-line" style="margin-bottom:8px;"></div>'
        + '<div class="skel skel-line-sm"></div>'
      + '</div>';
    } else if (kind === 'quiz') {
      html = '<div class="skel-card" data-skeleton="1" aria-hidden="true">'
        + '<div class="skel skel-meta" style="margin-bottom:16px;"></div>'
        + '<div class="skel skel-line-lg" style="margin-bottom:12px;"></div>'
        + '<div class="skel skel-line" style="margin-bottom:20px;"></div>'
        + '<div class="skel skel-line" style="height:44px;margin-bottom:10px;"></div>'
        + '<div class="skel skel-line" style="height:44px;margin-bottom:10px;"></div>'
        + '<div class="skel skel-line" style="height:44px;margin-bottom:10px;"></div>'
        + '<div class="skel skel-line" style="height:44px;"></div>'
      + '</div>';
    } else {
      html = '<div class="skel-card" data-skeleton="1" aria-hidden="true">'
        + '<div class="skel skel-title" style="margin-bottom:12px;"></div>'
        + '<div class="skel skel-line" style="margin-bottom:8px;"></div>'
        + '<div class="skel skel-line-sm"></div>'
      + '</div>';
    }
    container.innerHTML = html;
  }

  function text(el) {
    if (!el) return;
    el.innerHTML = '<span class="skel skel-line-sm" style="display:inline-block;vertical-align:middle;min-width:80px;" aria-hidden="true"></span>';
  }

  root.JX = root.JX || {};
  root.JX.skeleton = { list: list, card: card, text: text, row: rowHtml };
})(window);
