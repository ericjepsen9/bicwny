// 觉学 · A/B 实验 · 客户端
// P2 #23
//
// 用法：
//   const v = await JX.experiments.assign('home_cta_v1');
//   if (v === 'treatment') { /* 显示新 CTA */ } else { /* control */ }
//
//   // 已知拿过一次后纯本地读：
//   JX.experiments.getCached('home_cta_v1');  // → 'treatment' | 'control' | null
//
// 所有 variant 都是 server 抽签 · localStorage 7 天缓存 · 实验改 / 归档前不重抽
// 自动给后续 analytics 事件附加 properties.experiment + .variant 维度（仅当前页）
// 算转化时只用 server 端的 ExperimentExposure 名单 · 不依赖前端事件去重
(function () {
  'use strict';

  var STORE_KEY = 'jx-exp-cache';
  var TTL_MS = 7 * 24 * 3600 * 1000;
  var EXPS_ON_PAGE = []; // 当前页激活的 (key, variant) · analytics 自动带

  function readCache() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : {};
    } catch (_) {
      return {};
    }
  }
  function writeCache(o) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(o)); } catch (_) {}
  }
  function setCached(key, variant) {
    var c = readCache();
    c[key] = { v: variant, t: Date.now() };
    writeCache(c);
  }
  function getCached(key) {
    var c = readCache();
    var row = c[key];
    if (!row) return null;
    if (Date.now() - row.t > TTL_MS) return null;
    return row.v;
  }

  function tagOnPage(key, variant) {
    if (!key || !variant) return;
    var found = EXPS_ON_PAGE.find(function (e) { return e.key === key; });
    if (found) found.variant = variant;
    else EXPS_ON_PAGE.push({ key: key, variant: variant });
  }

  /** assign(key, opts?) → Promise<string> · 同 user/session 永远同 variant */
  async function assign(key, opts) {
    if (!key) throw new Error('assign: key required');
    var cached = getCached(key);
    if (cached) {
      tagOnPage(key, cached);
      return cached;
    }
    if (!window.JX || !window.JX.api) {
      // 没 api · 默认 control
      tagOnPage(key, 'control');
      return 'control';
    }
    var sessionId = (opts && opts.sessionId) ||
      (window.JX.analytics && window.JX.analytics.sessionId) || null;
    try {
      var res = await window.JX.api.post('/api/experiments/' + encodeURIComponent(key) + '/assign', {
        sessionId: sessionId || undefined,
      });
      var variant = (res && res.variant) || 'control';
      setCached(key, variant);
      tagOnPage(key, variant);
      return variant;
    } catch (_) {
      tagOnPage(key, 'control');
      return 'control';
    }
  }

  /** 给 analytics.track 用 · 把当前页激活的实验维度附加进 properties */
  function tagsForAnalytics() {
    if (EXPS_ON_PAGE.length === 0) return null;
    if (EXPS_ON_PAGE.length === 1) {
      var e = EXPS_ON_PAGE[0];
      return { experiment: e.key, variant: e.variant };
    }
    return {
      experiments: EXPS_ON_PAGE.map(function (e) { return e.key + ':' + e.variant; }).join(','),
    };
  }

  function clear() {
    try { localStorage.removeItem(STORE_KEY); } catch (_) {}
    EXPS_ON_PAGE.length = 0;
  }

  window.JX = window.JX || {};
  window.JX.experiments = {
    assign: assign,
    getCached: getCached,
    tagsForAnalytics: tagsForAnalytics,
    clear: clear,
  };
})();
