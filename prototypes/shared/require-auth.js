// 登录守卫 + 当前用户注入 + 角色门
// 用法：在页面 <head> 依次引入 config.js → api.js → require-auth.js
// 效果：
//   1. 无 access token → 立即跳 auth.html
//   2. <meta name="jx-require-role" content="coach,admin"> 指定受限页面
//      /me 返回后若 role 不在列表中 → 跳 mobile/home.html
//   3. 有 token → 拉 /api/auth/me，把用户信息填进带 data-jx-user="xxx" 的元素
//   4. /me 返回 401（刷新也失败）→ 清 token 跳 auth.html
//
// 支持的占位属性（data-jx-user=...）：
//   dharmaName / email / role / roleLabel / avatarInitial
(function () {
  var api = window.JX && window.JX.api;
  if (!api) {
    console.error('[require-auth] window.JX.api 未初始化；请检查 config.js/api.js 是否已引入');
    return;
  }

  var path = location.pathname.toLowerCase();
  if (/\/auth\.html$/.test(path)) return;
  var isOnboardingPage = /\/onboarding\.html$/.test(path);

  function pathRelative(target) {
    var base = location.pathname.replace(/[^/]*$/, '');
    return base + target;
  }
  // 桌面 / 移动各自有 auth.html · 守卫跳同目录即可，登录页内部按 role 路由
  // 学员端 mobile/auth.html 只接 student；后台 desktop/auth.html 只接 admin/coach
  function redirectToAuth()       { location.replace(pathRelative('auth.html')); }
  function redirectToMobileHome() {
    // 桌面页跳到 ../mobile/home.html；移动页同目录
    if (/\/desktop\//.test(path)) location.replace('../mobile/home.html');
    else location.replace(pathRelative('home.html'));
  }
  function redirectToOnboarding() {
    // 桌面页跳到 ../mobile/onboarding.html；移动页同目录
    if (/\/desktop\//.test(path)) location.replace('../mobile/onboarding.html');
    else location.replace(pathRelative('onboarding.html'));
  }

  if (!api.isAuthed()) { redirectToAuth(); return; }

  // 需要的角色（逗号分隔，留空视作任意登录用户可访问）
  var roleMeta = document.querySelector('meta[name="jx-require-role"]');
  var requiredRoles = roleMeta && roleMeta.content
    ? roleMeta.content.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    : [];

  function pickName(u) {
    if (u.dharmaName) return u.dharmaName;
    if (u.email) return u.email.split('@')[0];
    return '';
  }
  function pickInitial(u) {
    var n = pickName(u);
    for (var i = 0; i < n.length; i++) {
      var c = n.charAt(i);
      if (/\S/.test(c)) return c;
    }
    return '·';
  }
  function localizedRole(role) {
    var lang = (window.JX && window.JX.lang && window.JX.lang()) || 'sc';
    var m = {
      student: ['学员', '學員'],
      coach: ['辅导员', '輔導員'],
      admin: ['管理员', '管理員'],
    };
    return (m[role] || [role || '', role || ''])[lang === 'sc' ? 0 : 1];
  }

  function render(user) {
    var map = {
      dharmaName: pickName(user),
      email: user.email || '',
      role: user.role || '',
      roleLabel: localizedRole(user.role),
      avatarInitial: pickInitial(user),
    };
    document.querySelectorAll('[data-jx-user]').forEach(function (el) {
      var key = el.getAttribute('data-jx-user');
      if (!(key in map)) return;
      el.textContent = map[key];
    });
    window.JX = window.JX || {};
    window.JX.user = user;
    document.dispatchEvent(new CustomEvent('jx:user-ready', { detail: user }));
  }

  api.get('/api/auth/me').then(
    function (user) {
      if (requiredRoles.length && requiredRoles.indexOf(user.role) < 0) {
        redirectToMobileHome();
        return;
      }
      // 首次登录引导守卫：未完成 onboarding 强制跳引导页；已完成进引导页则回首页
      // 仅对 student 生效（coach/admin 不走移动端引导流程）
      if (user.role === 'student') {
        if (!user.hasOnboarded && !isOnboardingPage) { redirectToOnboarding(); return; }
        if (user.hasOnboarded && isOnboardingPage)   { redirectToMobileHome(); return; }
      } else if (isOnboardingPage) {
        // 非 student 误入引导页直接回首页
        redirectToMobileHome();
        return;
      }
      render(user);
    },
    function (err) {
      if (err && err.status === 401) {
        api.clearTokens();
        redirectToAuth();
      } else {
        console.warn('[require-auth] /me 请求失败：', err);
      }
    },
  );
})();
