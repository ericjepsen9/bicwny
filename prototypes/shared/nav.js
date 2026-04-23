// 返回按钮：所有 .nav-back / .back-btn 点击后执行 history.back()
document.querySelectorAll('.nav-back, .back-btn').forEach(el => {
  el.addEventListener('click', () => history.length > 1 ? history.back() : location.href = 'home.html');
});
