// 前端 API 客户端 · Bearer JWT + 自动刷新 + 错误归一
// 依赖：shared/config.js 先加载（提供 window.JX.API_BASE）
//
// 暴露：window.JX.api
//   api.get(path, opts?)
//   api.post(path, body?, opts?)
//   api.patch(path, body?, opts?)
//   api.del(path, opts?)
//   api.setTokens({accessToken, refreshToken})
//   api.clearTokens()
//   api.getAccessToken()
//   api.getRefreshToken()
//   api.logout()  // 调用 /api/auth/logout 再清 token
//   api.isAuthed()
//
// 401 处理策略：
//   1. 收到 401 → 若有 refreshToken → 调 /api/auth/refresh 拿新 access
//   2. 用新 access 重试原请求一次
//   3. 再失败 → 清 token → 抛 ApiError(401)，调用方负责跳登录
(function () {
  var API = (window.JX && window.JX.API_BASE) || '';

  // Token 存储抽象 · token-store.js 提供同步 cache + Capacitor Preferences 异步持久化
  // 浏览器场景下行为与之前 localStorage 一致 · Capacitor 场景下 token 进 native keychain
  function getStore() {
    return (window.JX && window.JX.tokenStore) || null;
  }
  function getAccessToken() {
    var s = getStore();
    return s ? s.getAccess() : null;
  }
  function getRefreshToken() {
    var s = getStore();
    return s ? s.getRefresh() : null;
  }
  function setTokens(t) {
    var s = getStore();
    if (s) s.setTokens(t);
  }
  function clearTokens() {
    var s = getStore();
    if (s) s.clear();
    else if (window.JX && window.JX.overlayCache && window.JX.overlayCache.clear) {
      window.JX.overlayCache.clear();
    }
  }
  function isAuthed() { return !!getAccessToken(); }

  function ApiError(status, code, message, details) {
    var e = new Error(message || code || ('HTTP ' + status));
    e.name = 'ApiError';
    e.status = status;
    e.code = code;
    e.details = details;
    return e;
  }

  function buildUrl(path) {
    if (/^https?:/i.test(path)) return path;
    var p = path.charAt(0) === '/' ? path : '/' + path;
    return API + p;
  }

  // 单例飞行中的 refresh，并发 401 只触发一次
  // `refreshing` 直到整条链（成功 setTokens 或失败 clear）完全结束才清空，
  // 避免早于最终态的并发 401 再次发起 refresh 请求
  var refreshing = null;
  function refreshOnce() {
    if (refreshing) return refreshing;
    var rt = getRefreshToken();
    if (!rt) return Promise.reject(ApiError(401, 'NO_REFRESH', '未登录或会话已过期'));
    var p = fetch(buildUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then(function (res) {
        if (!res.ok) {
          clearTokens();
          throw ApiError(res.status, 'REFRESH_FAILED', '会话刷新失败');
        }
        return res.json();
      })
      .then(function (json) {
        var d = json && json.data;
        if (!d || !d.accessToken) {
          clearTokens();
          throw ApiError(500, 'REFRESH_BAD_RESPONSE', '会话刷新响应异常');
        }
        setTokens(d);
        return d.accessToken;
      });
    // 只在整条 promise 完结后（无论成功失败）才解锁单飞状态
    refreshing = p.finally(function () { refreshing = null; });
    return refreshing;
  }

  // 5xx / 网络抖动指数退避重试
  //   - GET 默认重试 2 次（间隔 300ms · 800ms）· 写操作不重试（防重复 enroll/quiz 提交）
  //   - 仅 5xx + AbortError(timeout) + TypeError(fetch network err) 触发重试
  //   - 4xx（401/403/404/422 等）业务错误直接 throw · 重试也无意义
  //   - 调用方 opts.retry=0 显式关闭 · opts.retry=N 自定义次数
  function shouldRetry(method, errOrStatus, attempt, max) {
    if (attempt >= max) return false;
    // 写操作（非幂等）默认不重试 · 防止双扣 / 重复评分等副作用
    if (method !== 'GET' && method !== 'HEAD') return false;
    // 5xx HTTP 错
    if (typeof errOrStatus === 'number') return errOrStatus >= 500 && errOrStatus < 600;
    // network err / abort
    var err = errOrStatus;
    if (err && err.name === 'AbortError') return true;
    if (err && err.name === 'TypeError') return true; // fetch failed
    return false;
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function request(method, path, body, opts) {
    opts = opts || {};
    var maxRetry = opts.retry == null
      ? (method === 'GET' || method === 'HEAD' ? 2 : 0)
      : opts.retry;
    var attempt = 0;

    function exec() {
      var headers = Object.assign(
        { 'Accept': 'application/json' },
        body !== undefined ? { 'Content-Type': 'application/json' } : {},
        opts.headers || {},
      );
      var token = getAccessToken();
      if (token && !opts.noAuth) headers['Authorization'] = 'Bearer ' + token;

      // 超时兜底 · 默认 15s · 防止后端无响应让前端永远 'loading…'
      // opts.timeoutMs=0 显式禁用 · 大文件上传等长请求需主动覆盖
      var timeoutMs = opts.timeoutMs == null ? 15000 : opts.timeoutMs;
      var ctrl = (timeoutMs && typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;

      var init = {
        method: method,
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
      };
      // opts.fresh=true · 绕过 HTTP cache · 用于 mutation 后 reload 场景
      //   Cache-Control: max-age=60 让浏览器复用缓存 · 刚 DELETE 后 GET 可能拿到旧数据
      //   显式 cache:'reload' 强制走网络 · 不走任何缓存
      if (opts.fresh) init.cache = 'reload';

      return fetch(buildUrl(path), init).then(function (res) {
        if (timer) clearTimeout(timer);
        if (res.status === 401 && !opts.noAuth && !opts._retried && getRefreshToken()) {
          return refreshOnce().then(
            function () {
              return request(method, path, body, Object.assign({}, opts, { _retried: true }));
            },
            function (e) { throw e; },
          );
        }
        var ct = res.headers.get('content-type') || '';
        var asJson = ct.indexOf('application/json') >= 0;
        return (asJson ? res.json() : res.text()).then(function (payload) {
          if (!res.ok) {
            // 5xx 触发重试 · 4xx 直接 throw
            if (shouldRetry(method, res.status, attempt, maxRetry)) {
              attempt++;
              return delay(200 * Math.pow(2, attempt)).then(exec); // 400ms · 800ms · 1600ms
            }
            var err = typeof payload === 'object' && payload
              ? ApiError(res.status, payload.error, payload.message, payload.details)
              : ApiError(res.status, 'HTTP_' + res.status, String(payload).slice(0, 200));
            throw err;
          }
          // 后端统一返回 { data: ... }；原样返回 data，若无 data 字段返回整个 body
          if (asJson && payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
            return payload.data;
          }
          return payload;
        });
      }, function (err) {
        if (timer) clearTimeout(timer);
        // AbortError → 可能是 timeout · 也可能是真挂了 · GET 重试一次
        if (shouldRetry(method, err, attempt, maxRetry)) {
          attempt++;
          return delay(200 * Math.pow(2, attempt)).then(exec);
        }
        if (err && err.name === 'AbortError') {
          throw ApiError(0, 'TIMEOUT', '请求超时（' + Math.round(timeoutMs / 1000) + 's），请检查网络');
        }
        // 离线队列 · opts.offlineQueue=true 时网络错（TypeError）入队
        //   仅写操作 · 仅 navigator.onLine===false 时入队 · 防把可达但 5xx 也入队
        //   入队后返回特殊响应让调用方知道 · 不抛错
        if (opts.offlineQueue && method !== 'GET' && method !== 'HEAD' &&
            err && err.name === 'TypeError' &&
            typeof navigator !== 'undefined' && navigator.onLine === false &&
            window.JX && window.JX.offlineQueue) {
          var rid = (body && body.requestId) || (window.crypto && crypto.randomUUID
            ? crypto.randomUUID()
            : 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2));
          window.JX.offlineQueue.enqueue({
            method: method, path: path, body: body, requestId: rid,
          }).catch(function () {});
          return { __queued: true, requestId: rid };
        }
        throw err;
      });
    }

    return exec();
  }

  function logout() {
    var rt = getRefreshToken();
    if (!rt) { clearTokens(); return Promise.resolve(); }
    // AU10: 先调后端吊销 refresh，成功 / 失败都通过 finally 清本地
    //   - 之前先清本地再发请求 · 网络失败时 backend session 仍 active 直到 TTL
    //   - keepalive=true：用户立刻关 tab 时浏览器仍会把请求发出去
    //   - .catch 静默吞错 · .finally 兜底清 token 防用户卡在'未登出'状态
    return fetch(buildUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
      keepalive: true,
    }).catch(function () { /* 网络失败 · backend 等 TTL 自然过期 */ })
      .finally(clearTokens);
  }

  // ── 辅助 util ────────────────────────────────
  function queryParam(name) {
    var m = location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  // "2 天前" / "今日 14:32" —— 相对日期中文呈现
  function relativeTime(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var now = Date.now();
    var deltaMin = Math.round((now - t) / 60000);
    var lang = document.documentElement.getAttribute('data-lang') || 'sc';
    if (deltaMin < 1) return lang === 'sc' ? '刚刚' : '剛剛';
    if (deltaMin < 60) return deltaMin + (lang === 'sc' ? ' 分钟前' : ' 分鐘前');
    var deltaHour = Math.floor(deltaMin / 60);
    if (deltaHour < 24) {
      var dt = new Date(iso);
      return (lang === 'sc' ? '今日 ' : '今日 ')
        + String(dt.getHours()).padStart(2, '0') + ':'
        + String(dt.getMinutes()).padStart(2, '0');
    }
    var deltaDay = Math.floor(deltaHour / 24);
    if (deltaDay === 1) return lang === 'sc' ? '昨日' : '昨日';
    if (deltaDay < 30) return deltaDay + (lang === 'sc' ? ' 天前' : ' 天前');
    var deltaMon = Math.floor(deltaDay / 30);
    if (deltaMon < 12) return deltaMon + (lang === 'sc' ? ' 个月前' : ' 個月前');
    return Math.floor(deltaMon / 12) + (lang === 'sc' ? ' 年前' : ' 年前');
  }

  window.JX = window.JX || {};
  window.JX.api = {
    get:   function (p, o)    { return request('GET',    p, undefined, o); },
    post:  function (p, b, o) { return request('POST',   p, b || {},   o); },
    patch: function (p, b, o) { return request('PATCH',  p, b || {},   o); },
    // 可带 body（用于二次确认）；路径-only 调用 body 为 undefined = 不发 body
    del: function (p, b, o) { return request('DELETE', p, b, o); },
    setTokens: setTokens,
    clearTokens: clearTokens,
    getAccessToken: getAccessToken,
    getRefreshToken: getRefreshToken,
    isAuthed: isAuthed,
    logout: logout,
  };
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 双击防抖 · 用法：JX.util.once(btn, function(){ return api.post(...); })
  //   - 触发瞬间 disabled + data-loading=1 + 文本替换为 '加载中...'（可自定义）
  //   - Promise 完成（成功/失败）后自动恢复
  //   - 同一 btn 重复点击在 promise 未完成期间一律忽略（不会再发请求）
  //   - 失败时 promise reject 让调用方仍能感知
  // 注意：传入的 fn 必须返回 Promise · 同步函数请用 once(btn, ()=>Promise.resolve(syncCall()))
  function once(btn, fn, opts) {
    if (!btn || typeof fn !== 'function') return Promise.reject(new Error('once: bad args'));
    if (btn.dataset && btn.dataset.loading === '1') {
      return Promise.reject(new Error('LOADING'));
    }
    var loadingText = (opts && opts.loadingText) || '';
    var origText = btn.innerHTML;
    var origDisabled = btn.disabled;
    if (btn.dataset) btn.dataset.loading = '1';
    btn.disabled = true;
    if (loadingText) btn.textContent = loadingText;
    var p;
    try {
      p = Promise.resolve(fn());
    } catch (e) {
      p = Promise.reject(e);
    }
    return p.then(function (v) {
      btn.disabled = origDisabled;
      if (btn.dataset) btn.dataset.loading = '';
      if (loadingText) btn.innerHTML = origText;
      return v;
    }, function (e) {
      btn.disabled = origDisabled;
      if (btn.dataset) btn.dataset.loading = '';
      if (loadingText) btn.innerHTML = origText;
      throw e;
    });
  }

  // Boot 守卫 · 5s 内 promise 没解决 → 把 container 内容换成'网络慢 · 重试'
  //   - container：装载内容的 DOM 元素（通常显示 '加载中…' 的容器）
  //   - promise：boot 主流程
  //   - opts.timeoutMs：超时阈值 · 默认 5000ms
  //   - opts.containsText：用于判断'是否还在 loading 状态'的字符串 · 默认 '加载中'
  // 用法：
  //   JX.util.bootGuard(box, fetchAndRender(), { timeoutMs: 8000 })
  function bootGuard(container, promise, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs == null ? 5000 : opts.timeoutMs;
    var containsText = opts.containsText || '加载中';
    var timer = setTimeout(function () {
      if (container && container.innerHTML &&
          container.innerHTML.indexOf(containsText) >= 0) {
        container.innerHTML =
          '<div style="text-align:center;padding:24px 16px;color:var(--ink-3);font-size:.875rem;">' +
            '<p style="margin-bottom:12px;">' +
              '<span class="sc">网络慢，加载中…</span>' +
              '<span class="tc">網絡慢，載入中…</span>' +
            '</p>' +
            '<a href="javascript:location.reload()" ' +
              'style="color:var(--saffron-dark);text-decoration:underline;font-weight:600;">' +
              '<span class="sc">点此刷新</span>' +
              '<span class="tc">點此刷新</span>' +
            '</a>' +
          '</div>';
      }
    }, timeoutMs);
    var done = function () { clearTimeout(timer); };
    return Promise.resolve(promise).then(function (v) { done(); return v; },
                                          function (e) { done(); throw e; });
  }

  window.JX.util = {
    queryParam: queryParam,
    relativeTime: relativeTime,
    escapeHtml: escapeHtml,
    once: once,
    bootGuard: bootGuard,
  };
})();
