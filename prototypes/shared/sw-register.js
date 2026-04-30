// Service Worker 注册器 · 在每个 page 自动启动缓存
//   - 仅 HTTPS / localhost 生效（SW 安全要求）
//   - 老浏览器无 'serviceWorker' API → 静默 no-op
//   - 新版可用时（waiting）自动 SKIP_WAITING 立即激活
//   - postMessage 通信防止旧 client 拿到混合资源
(function () {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // SW 要求 secure context · file:// (Capacitor 早期) 也算 · http://localhost 也算
  // 生产 https 域 · 直连 IP 走 http 不会 register · 这是预期行为
  var ok = location.protocol === 'https:' ||
           location.hostname === 'localhost' ||
           location.hostname === '127.0.0.1' ||
           location.protocol === 'capacitor:' ||
           location.protocol === 'file:';
  if (!ok) return;

  // 异步注册 · 不阻塞首屏
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function (reg) {
      // 监听新版本可用 · 自动激活
      reg.addEventListener('updatefound', function () {
        var newSw = reg.installing;
        if (!newSw) return;
        newSw.addEventListener('statechange', function () {
          if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
            // 已有 controller · 这是更新场景 · 旧 client 仍跑老 SW · 让新版立即接管
            newSw.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(function (err) {
      console.warn('[sw] register failed:', err && err.message);
    });

    // controller 切换（新 SW 接管）→ 下次 page boot 用新 shell
    //   不强制 reload · 防止用户填表中被打断 · 让自然导航刷新
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      refreshing = true;
      // 不 reload · 让用户继续 · 下一次 location.replace / 跳页时拿新版
    });
  });
})();
