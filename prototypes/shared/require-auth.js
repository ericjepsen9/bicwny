// 登录守卫 + 当前用户注入
// 用法：在页面 <head> 依次引入 config.js → api.js → require-auth.js
// 效果：
//   1. 无 access token → 立即跳 auth.html
//   2. 有 token → 后台拉 /api/auth/me，把用户信息填进带 data-jx-user="xxx" 的元素
//   3. me 返回 401（token 失效且刷新也失败）→ 清 token 跳 auth.html
//
// 支持的占位属性：
//   data-jx-user="dharmaName"    → textContent = user.dharmaName || email 前缀
//   data-jx-user="email"         → textContent = user.email
//   data-jx-user="role"          → textContent = user.role
//   data-jx-user="avatarInitial" → textContent = 名字/邮箱首字（单字符）
(function () {
  var api = window.JX && window.JX.api;
  if (!api) {
    // 严重错误：api.js 未加载
    console.error('[require-auth] window.JX.api 未初始化；请检查 config.js/api.js 是否已引入');
    return;
  }

  // 登录页自身不守卫
  var path = location.pathname.toLowerCase();
  if (/\/auth\.html$/.test(path)) return;

  function redirectToAuth() {
    // 使用 replace 避免返回键回到未授权页
    var base = location.pathname.replace(/[^/]*$/, '');
    location.replace(base + 'auth.html');
  }

  if (!api.isAuthed()) {
    redirectToAuth();
    return;
  }

  function pickName(u) {
    if (u.dharmaName) return u.dharmaName;
    if (u.email) return u.email.split('@')[0];
    return '';
  }
  function pickInitial(u) {
    var n = pickName(u);
    // 取第一个可见字符（支持中英文）
    for (var i = 0; i < n.length; i++) {
      var c = n.charAt(i);
      if (/\S/.test(c)) return c;
    }
    return '·';
  }

  function render(user) {
    var map = {
      dharmaName: pickName(user),
      email: user.email || '',
      role: user.role || '',
      avatarInitial: pickInitial(user),
    };
    document.querySelectorAll('[data-jx-user]').forEach(function (el) {
      var key = el.getAttribute('data-jx-user');
      if (!(key in map)) return;
      el.textContent = map[key];
    });
    // 把完整 user 挂到 window 供页面按需读取
    window.JX = window.JX || {};
    window.JX.user = user;
    document.dispatchEvent(new CustomEvent('jx:user-ready', { detail: user }));
  }

  api.get('/api/auth/me').then(
    function (user) { render(user); },
    function (err) {
      if (err && err.status === 401) {
        api.clearTokens();
        redirectToAuth();
      } else {
        // 网络问题不强跳登录；保留 UI 默认文案即可
        console.warn('[require-auth] /me 请求失败：', err);
      }
    },
  );
})();
