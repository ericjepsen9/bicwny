// ─────────────────────────────────────────────────────────
// admin-nav.js · 后台侧边栏 canonical 菜单
//
// 所有 admin-*.html 页面共用一份菜单，避免各页手写导致数量 / 顺序不一致。
//
// 用法：在每个 admin 页面：
//   <nav class="nav-list" id="admin-nav"></nav>
//   <script src="../shared/admin-nav.js"></script>
//
// 当前页高亮：按文件名匹配 (location.pathname.split('/').pop())
// ─────────────────────────────────────────────────────────

(function () {
  var ICONS = {
    grid:    '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    clock:   '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    cpu:     '<path d="M12 2a9 9 0 1 0 9 9"/><path d="M12 2v9l7 5"/>',
    check:   '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    users:   '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
    'user-plus': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    book:    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    phone:   '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/>',
  };

  // canonical 菜单 · 改这里即一次性改所有后台页
  var ITEMS = [
    { section: { sc: '数据', tc: '數據' } },
    { href: 'admin.html',         label: { sc: '数据总览',   tc: '數據總覽'   }, icon: 'grid'    },
    { href: 'admin-audit.html',   label: { sc: '审计日志',   tc: '審計日誌'   }, icon: 'clock'   },
    { href: 'admin-logs.html',    label: { sc: '运行日志',   tc: '運行日誌'   }, icon: 'warning' },
    { href: 'admin-llm.html',     label: { sc: 'LLM 管理',   tc: 'LLM 管理'   }, icon: 'cpu'     },
    { section: { sc: '管理', tc: '管理' } },
    { href: 'admin-review.html',  label: { sc: '题目审核',   tc: '題目審核'   }, icon: 'check'   },
    { href: 'admin-reports.html', label: { sc: '举报处理',   tc: '舉報處理'   }, icon: 'warning' },
    { href: 'admin-users.html',   label: { sc: '用户管理',   tc: '用戶管理'   }, icon: 'users'   },
    { href: 'admin-classes.html', label: { sc: '班级管理',   tc: '班級管理'   }, icon: 'user-plus' },
    { href: 'admin-courses.html', label: { sc: '法本管理',   tc: '法本管理'   }, icon: 'book'    },
    { section: { sc: '系统', tc: '系統' } },
    { href: 'coach.html',          label: { sc: '辅导员视图', tc: '輔導員視圖' }, icon: 'settings' },
    { href: '../mobile/home.html', label: { sc: '学生端预览', tc: '學生端預覽' }, icon: 'phone'    },
  ];

  function svg(key) {
    return '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' +
      (ICONS[key] || '') + '</svg>';
  }

  function render() {
    var here = (location.pathname.split('/').pop() || 'admin.html').toLowerCase();
    var target = document.getElementById('admin-nav');
    if (!target) return;

    var html = ITEMS.map(function (it) {
      if (it.section) {
        return '<div class="nav-section">' +
          '<span class="sc">' + it.section.sc + '</span>' +
          '<span class="tc">' + it.section.tc + '</span>' +
          '</div>';
      }
      var file = it.href.split('/').pop().toLowerCase();
      var active = file === here ? ' active' : '';
      return '<a class="nav-item' + active + '" href="' + it.href + '">' +
        svg(it.icon) +
        '<span>' +
          '<span class="sc">' + it.label.sc + '</span>' +
          '<span class="tc">' + it.label.tc + '</span>' +
        '</span>' +
        '</a>';
    }).join('');

    target.innerHTML = html;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
