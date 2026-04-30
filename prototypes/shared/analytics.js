// 觉学 · 前端埋点
//   - JX.analytics.track(event, properties?)        手工埋点
//   - JX.analytics.page(name?)                       手工 page_view（页面 boot 自动调一次）
//   - JX.analytics.identify(userId)                  登录后绑定 user · 之后事件都带 userId
//
// 数据流：track() → 队列 → 每 10s flush 或 page hide 时立即 flush →
//         POST /api/analytics/events 批量上报
//
// 自动埋点：
//   - DOMContentLoaded 自动 page_view（带 path / referrer）
//   - 任何带 data-track="event_name" 的元素 click 自动 track
//   - data-track-* 属性映射到 properties · 例：
//     <button data-track="enroll_click" data-track-course="xx">加入</button>
(function () {
  if (typeof window === 'undefined') return;
  if (window.__JX_ANALYTICS_INITED__) return;
  window.__JX_ANALYTICS_INITED__ = true;

  var QUEUE_KEY = 'jx-analytics-queue-v1';
  var SESSION_KEY = 'jx-analytics-session';
  var FLUSH_INTERVAL_MS = 10 * 1000;
  var MAX_BATCH = 50;

  // sessionId · 关闭 tab 重置 · 用来串联同一会话的事件
  var sessionId = '';
  try {
    sessionId = sessionStorage.getItem(SESSION_KEY) || '';
  } catch (_) {}
  if (!sessionId) {
    sessionId = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    try { sessionStorage.setItem(SESSION_KEY, sessionId); } catch (_) {}
  }

  // 队列持久化（localStorage）· 网络断开 / 页面崩溃也不丢
  // 但单条事件 < 1KB · 满 20KB 就丢最旧（防 localStorage 限额溢出）
  function loadQueue() {
    try {
      var raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }
  function saveQueue(q) {
    try {
      var s = JSON.stringify(q);
      if (s.length > 20 * 1024) {
        // 太长 · 截掉前面的（保留最新）
        q = q.slice(-MAX_BATCH);
        s = JSON.stringify(q);
      }
      localStorage.setItem(QUEUE_KEY, s);
    } catch (_) {}
  }

  var queue = loadQueue();
  var flushing = false;

  function enqueue(ev) {
    queue.push(ev);
    saveQueue(queue);
    if (queue.length >= MAX_BATCH) flush();
  }

  function flush() {
    if (flushing || queue.length === 0) return;
    flushing = true;
    var batch = queue.slice(0, MAX_BATCH);
    var rest = queue.slice(MAX_BATCH);
    fetch('/api/analytics/events', {
      method: 'POST',
      credentials: 'include',
      headers: (function () {
        var h = { 'Content-Type': 'application/json' };
        try {
          var token = localStorage.getItem('jx-access-token');
          if (token) h['Authorization'] = 'Bearer ' + token;
        } catch (_) {}
        return h;
      })(),
      body: JSON.stringify({ events: batch }),
      keepalive: true, // page hide 时也确保发完
    }).then(function (r) {
      if (r.ok || r.status === 202) {
        queue = rest;
        saveQueue(queue);
      } else if (r.status === 429) {
        // 限频 · 保留事件 · 等下个周期
      }
      // 4xx/5xx 也保留 · 下次重试 · 队列上限会丢旧的
    }).catch(function () {
      // 网络挂 · 保留 · 等待下次
    }).finally(function () {
      flushing = false;
    });
  }

  // 10s 周期 flush
  setInterval(flush, FLUSH_INTERVAL_MS);
  // 页面隐藏 / 关闭时 flush · keepalive=true 保证请求发出
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  // 网络恢复时立即 flush
  window.addEventListener('online', flush);
  // visibility hidden 也算（移动端 tab 切换）
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  // 公开 API
  function track(event, properties) {
    enqueue({
      event: String(event).slice(0, 60),
      properties: properties || {},
      page: (location.pathname.split('/').pop() || '').toLowerCase(),
      sessionId: sessionId,
      ts: Date.now(),
    });
  }
  function page(pageName) {
    track('page_view', {
      path: location.pathname,
      pageName: pageName || (location.pathname.split('/').pop() || '').toLowerCase(),
      referrer: document.referrer || '',
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }
  function identify(userId, traits) {
    if (!userId) return;
    track('identify', { userId: userId, traits: traits || {} });
  }

  window.JX = window.JX || {};
  window.JX.analytics = {
    track: track,
    page: page,
    identify: identify,
    flush: flush,
    sessionId: sessionId,
  };

  // 自动 page_view · DOMContentLoaded
  function bootPageView() { page(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPageView);
  } else {
    bootPageView();
  }

  // user-ready 事件 · 自动 identify
  document.addEventListener('jx:user-ready', function () {
    var u = window.JX && window.JX.user;
    if (u && u.id) identify(u.id, {
      role: u.role,
      hasClass: !!u.classId,
    });
  });

  // 自动 click 埋点 · data-track="event_name" + data-track-*
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-track]');
    if (!el) return;
    var name = el.getAttribute('data-track');
    if (!name) return;
    var props = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name.indexOf('data-track-') === 0 && a.name !== 'data-track') {
        props[a.name.slice('data-track-'.length)] = a.value;
      }
    }
    track(name, props);
  }, true);
})();
