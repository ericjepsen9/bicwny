// 推送订阅工具 · Web Push API · Capacitor WebView 也通用
//   使用：
//     await JX.push.subscribe()    // 请求权限 + 上报订阅 · 返回 'granted'|'denied'|'unsupported'
//     await JX.push.unsubscribe()  // 取消订阅 + 通知后端
//     JX.push.isSupported()        // 仅特性检测 · 不发请求
//     await JX.push.status()       // 'subscribed' | 'denied' | 'default' | 'unsupported'
(function () {
  function isSupported() {
    return typeof navigator !== 'undefined' &&
           'serviceWorker' in navigator &&
           'PushManager' in window &&
           'Notification' in window;
  }

  // base64url → Uint8Array · Web Push API subscribe 要求二进制格式 applicationServerKey
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function getRegistration() {
    if (!isSupported()) return null;
    var reg = await navigator.serviceWorker.ready;
    return reg;
  }

  async function status() {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'default') return 'default';
    var reg = await getRegistration();
    if (!reg) return 'unsupported';
    var sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'default';
  }

  async function subscribe() {
    if (!isSupported()) return 'unsupported';

    // 请求通知权限（如果还没决定）
    if (Notification.permission === 'default') {
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') return perm; // 'denied'
    }
    if (Notification.permission !== 'granted') return Notification.permission;

    var reg = await getRegistration();
    if (!reg) return 'unsupported';

    // 已订阅 → 复用 · 同时同步给后端（防丢失）
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // 拿 VAPID 公钥
      var keyResp = await window.JX.api.get('/api/push/vapid-public-key');
      var pubKey = keyResp && keyResp.key;
      if (!pubKey) {
        console.warn('[push] VAPID 公钥缺失 · 后端未配置');
        return 'unsupported';
      }
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pubKey),
      });
    }

    // 上报后端
    var json = sub.toJSON();
    await window.JX.api.post('/api/push/subscribe', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      platform: detectPlatform(),
      userAgent: (navigator.userAgent || '').slice(0, 500),
    });
    return 'granted';
  }

  async function unsubscribe() {
    var reg = await getRegistration();
    if (!reg) return;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    var endpoint = sub.endpoint;
    // 通知后端 · 失败不影响本地取消
    window.JX.api.del('/api/push/subscribe', { endpoint: endpoint }).catch(function () {});
    await sub.unsubscribe();
  }

  function detectPlatform() {
    if (window.Capacitor && window.Capacitor.getPlatform) {
      var p = window.Capacitor.getPlatform();
      if (p === 'ios') return 'capacitor-ios';
      if (p === 'android') return 'capacitor-android';
    }
    return 'web';
  }

  window.JX = window.JX || {};
  window.JX.push = {
    isSupported: isSupported,
    status: status,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
  };
})();
