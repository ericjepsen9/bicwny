// 觉学 · desktop-mobile.js
// 桌面后台 (admin / coach) 在窄屏（< 768px）下的响应式行为
//
// 自注入：
//   1. 一个 fixed 汉堡按钮（左上角）
//   2. 一个全屏 backdrop（遮罩 main）
//
// 状态管理：
//   .shell.nav-open  → 侧边栏滑入 + backdrop 显示
//   ESC / 点 backdrop / 点 nav-item / 窗口扩到 ≥ 768px → 自动关闭

(function () {
  function inject() {
    var shell = document.querySelector('.shell');
    if (!shell) return;
    if (document.getElementById('mb-hamburger')) return;  // 已注入

    // 汉堡按钮
    var btn = document.createElement('button');
    btn.id = 'mb-hamburger';
    btn.type = 'button';
    btn.setAttribute('aria-label', '展开菜单');
    btn.className = 'mb-hamburger';
    btn.innerHTML =
      '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" viewBox="0 0 24 24">' +
        '<line x1="3" y1="6" x2="21" y2="6"/>' +
        '<line x1="3" y1="12" x2="21" y2="12"/>' +
        '<line x1="3" y1="18" x2="21" y2="18"/>' +
      '</svg>';

    // backdrop
    var bd = document.createElement('div');
    bd.id = 'mb-backdrop';
    bd.className = 'mb-backdrop';

    document.body.appendChild(btn);
    document.body.appendChild(bd);

    function open() {
      shell.classList.add('nav-open');
      bd.classList.add('open');
      btn.setAttribute('aria-label', '收起菜单');
    }
    function close() {
      shell.classList.remove('nav-open');
      bd.classList.remove('open');
      btn.setAttribute('aria-label', '展开菜单');
    }
    function toggle() {
      shell.classList.contains('nav-open') ? close() : open();
    }

    btn.addEventListener('click', toggle);
    bd.addEventListener('click', close);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && shell.classList.contains('nav-open')) close();
    });

    // 点 nav-item 自动关（移动场景下点完跳页）
    // 用事件委托而非直接 query · admin-nav.js 是异步注入的
    var sideNav = document.querySelector('.side-nav');
    if (sideNav) {
      sideNav.addEventListener('click', function (ev) {
        var a = ev.target.closest('.nav-item');
        if (a) close();
      });
    }

    // 窗口拉宽到桌面尺寸时自动关
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768 && shell.classList.contains('nav-open')) {
        close();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
