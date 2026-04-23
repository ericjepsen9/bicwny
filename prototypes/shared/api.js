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
  var KEY_A = 'jx-accessToken';
  var KEY_R = 'jx-refreshToken';

  function storage() {
    try { return window.localStorage; } catch (_) { return null; }
  }

  function getAccessToken() {
    var s = storage(); return s ? s.getItem(KEY_A) : null;
  }
  function getRefreshToken() {
    var s = storage(); return s ? s.getItem(KEY_R) : null;
  }
  function setTokens(t) {
    var s = storage(); if (!s) return;
    if (t && t.accessToken)  s.setItem(KEY_A, t.accessToken);
    if (t && t.refreshToken) s.setItem(KEY_R, t.refreshToken);
  }
  function clearTokens() {
    var s = storage(); if (!s) return;
    s.removeItem(KEY_A);
    s.removeItem(KEY_R);
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

  function request(method, path, body, opts) {
    opts = opts || {};
    var headers = Object.assign(
      { 'Accept': 'application/json' },
      body !== undefined ? { 'Content-Type': 'application/json' } : {},
      opts.headers || {},
    );
    var token = getAccessToken();
    if (token && !opts.noAuth) headers['Authorization'] = 'Bearer ' + token;

    var init = {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    };

    return fetch(buildUrl(path), init).then(function (res) {
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
    });
  }

  function logout() {
    var rt = getRefreshToken();
    var p = rt
      ? fetch(buildUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        }).catch(function () { /* 幂等，忽略 */ })
      : Promise.resolve();
    return p.then(function () { clearTokens(); });
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

  window.JX.util = {
    queryParam: queryParam,
    relativeTime: relativeTime,
    escapeHtml: escapeHtml,
  };
})();
