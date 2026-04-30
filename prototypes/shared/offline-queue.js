// 离线队列 · IndexedDB 持久化 · 网络断开时缓存 mutation · 联网后自动重试
//
// 设计：
//   - mutation 必须自带 requestId（UUID）· 后端按它幂等去重 · 防双重提交
//   - 仅 POST/PATCH/PUT/DELETE 进队列 · GET 不进
//   - 单条 entry 最多重试 5 次 · 失败超过一定次数（比如 7 天）自动 drop · 防卡死
//   - 不存 access token · 重试时用当前最新 token · 但需 user 仍登录
//     未登录场景（注册/登录请求）禁止入队 · 调用方传 noOffline:true 跳过
//
// 用法：
//   await JX.offlineQueue.enqueue({ method:'POST', path:'/api/answers', body, requestId });
//   JX.offlineQueue.drain();          // 立即触发一次 drain · 通常自动触发
//   JX.offlineQueue.size();           // 当前待发数
//   JX.offlineQueue.subscribe(fn);    // 监听 size 变化 · 用于 UI badge
(function () {
  if (typeof window === 'undefined') return;
  if (window.__JX_OFFLINE_QUEUE_INITED__) return;
  window.__JX_OFFLINE_QUEUE_INITED__ = true;

  var DB_NAME = 'jx-offline-v1';
  var STORE = 'queue';
  var MAX_RETRY = 5;
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天 · 老于此 drop
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    if (!('indexedDB' in window)) {
      dbPromise = Promise.reject(new Error('NO_INDEXEDDB'));
      return dbPromise;
    }
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function withStore(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var store = tx.objectStore(STORE);
        var result;
        try { result = fn(store); } catch (e) { reject(e); return; }
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function genRequestId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  // 入队 · 返回 entry id
  async function enqueue(entry) {
    if (!entry || !entry.method || !entry.path) throw new Error('enqueue: bad entry');
    var record = {
      method: entry.method,
      path: entry.path,
      body: entry.body || null,
      requestId: entry.requestId || genRequestId(),
      retries: 0,
      createdAt: Date.now(),
      lastTriedAt: null,
      lastError: null,
    };
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.add(record);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    }).then(function (id) {
      notifySize();
      return id;
    });
  }

  async function listAll() {
    return withStore('readonly', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  async function update(id, patch) {
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var get = store.get(id);
        get.onsuccess = function () {
          var rec = get.result;
          if (!rec) { resolve(false); return; }
          Object.assign(rec, patch);
          var put = store.put(rec);
          put.onsuccess = function () { resolve(true); };
          put.onerror = function () { reject(put.error); };
        };
        get.onerror = function () { reject(get.error); };
      });
    });
  }

  async function remove(id) {
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.delete(id);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error); };
      });
    }).then(function (r) { notifySize(); return r; });
  }

  async function size() {
    return withStore('readonly', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.count();
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  var subs = [];
  function subscribe(fn) { subs.push(fn); return function () { subs = subs.filter(function (s) { return s !== fn; }); }; }
  function notifySize() {
    size().then(function (n) {
      subs.forEach(function (fn) { try { fn(n); } catch (_) {} });
    }).catch(function () {});
  }

  // 直接发一条 · 用 api.js 的鉴权 + token 刷新逻辑
  async function sendOne(rec) {
    if (!window.JX || !window.JX.api) throw new Error('JX.api 未就绪');
    var fn = window.JX.api[rec.method.toLowerCase()];
    if (!fn) throw new Error('未知 method: ' + rec.method);
    var body = rec.body || {};
    if (rec.requestId && typeof body === 'object') body = Object.assign({ requestId: rec.requestId }, body);
    if (rec.method === 'GET' || rec.method === 'DELETE') {
      return fn(rec.path, rec.body || undefined);
    }
    return fn(rec.path, body);
  }

  // drain · 单飞 · 串行发 · 防一次涌出大量请求
  var draining = false;
  async function drain() {
    if (draining) return;
    if (!navigator.onLine) return;
    draining = true;
    try {
      var items = await listAll();
      // 最老的先发 · 保留时序
      items.sort(function (a, b) { return a.createdAt - b.createdAt; });
      for (var i = 0; i < items.length; i++) {
        var rec = items[i];
        // 太老 → drop · 防卡死
        if (Date.now() - rec.createdAt > MAX_AGE_MS) {
          await remove(rec.id);
          continue;
        }
        // 重试上限 → drop
        if (rec.retries >= MAX_RETRY) {
          await remove(rec.id);
          continue;
        }
        try {
          await sendOne(rec);
          await remove(rec.id);
        } catch (err) {
          var e = err || {};
          // 4xx 业务错（401 除外） · 不再重试 · drop · 防 invalid 请求挂在队列
          //   401 留给 api.js refresh 单飞处理 · 这里看到 401 只增重试计数
          if (e.status && e.status >= 400 && e.status < 500 && e.status !== 401) {
            await remove(rec.id);
            continue;
          }
          // 网络错 / 5xx · 增重试计数
          await update(rec.id, {
            retries: (rec.retries || 0) + 1,
            lastTriedAt: Date.now(),
            lastError: (e.message || String(e)).slice(0, 200),
          });
          // 单条失败 break · 不继续后面（可能同一个网络问题）
          break;
        }
      }
    } finally {
      draining = false;
    }
  }

  // 网络恢复 / 页面回到前台时自动 drain
  function setupAutoDrain() {
    window.addEventListener('online', function () { drain(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') drain();
    });
    // 启动时也尝试一次
    if (navigator.onLine) drain();
  }

  window.JX = window.JX || {};
  window.JX.offlineQueue = {
    enqueue: enqueue,
    drain: drain,
    size: size,
    subscribe: subscribe,
    listAll: listAll, // 调试 / UI 显示
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoDrain);
  } else {
    setupAutoDrain();
  }
})();
