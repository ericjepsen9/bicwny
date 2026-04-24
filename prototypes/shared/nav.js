// 返回按钮：所有 .nav-back / .back-btn 点击后执行 history.back()
// preventDefault 拦截 <a href> 的默认跳转，否则 href 指向的页面会盖掉 history.back()
// 无 history（直链/refresh）→ fallback 到 data-fallback（如 'home.html'）或元素自身的 href
document.querySelectorAll('.nav-back, .back-btn').forEach(function (el) {
  el.addEventListener('click', function (e) {
    e.preventDefault();
    if (history.length > 1) {
      history.back();
      return;
    }
    var fallback = el.getAttribute('data-fallback') || el.getAttribute('href') || 'home.html';
    location.replace(fallback);
  });
});
