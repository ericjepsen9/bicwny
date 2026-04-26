// 觉学 · 法本抓取亚洲中转节点
//
// 部署在亚洲 VPS（香港 / 东京 / 新加坡）· 美国后台被站方封 IP 时切到这里。
//
// 端点：
//   POST /fetch
//     header: Authorization: Bearer <RELAY_TOKEN>
//     body : { "url": "https://mingguang.im/xxx" }
//     resp : { status, finalUrl, html, contentType }
//   GET /healthz                  无鉴权 · liveness
//
// 安全：
//   - 强 token 鉴权（至少 32 字符随机串）
//   - 域名白名单（ALLOWED_HOSTS 环境变量，逗号分隔）
//   - SSRF 拒绝内网 / 链路本地 / 多播 / loopback IP（相同规则与后台 isPrivateIp 一致）
//   - HTML 上限 5 MB · fetch 超时 15 s · 最多 5 跳重定向
//   - 全局速率限制（默认 1 req/s · 由 RATE_LIMIT_PER_SECOND 调）
//
// 不依赖 npm 包：纯 Node 标准库（http / fetch（Node ≥ 18）/ dns）
// 启动：node relay.mjs   （由 systemd 守护，详见 systemd/asia-relay.service）

import http from 'node:http';
import { lookup } from 'node:dns/promises';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '127.0.0.1'; // Caddy 反代到 127.0.0.1
const TOKEN = process.env.RELAY_TOKEN;
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const RATE_PER_SEC = parseFloat(process.env.RATE_LIMIT_PER_SECOND || '1');
const FETCH_TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || '15000', 10);
const MAX_HTML_BYTES = parseInt(process.env.MAX_HTML_BYTES || String(5 * 1024 * 1024), 10);
const MAX_REDIRECTS = 5;
const USER_AGENT = process.env.USER_AGENT
  || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

if (!TOKEN || TOKEN.length < 32) {
  console.error('FATAL: RELAY_TOKEN 必须设置且 ≥ 32 字符');
  process.exit(1);
}
if (ALLOWED_HOSTS.length === 0) {
  console.error('FATAL: ALLOWED_HOSTS 必须设置（逗号分隔的域名白名单），如 "mingguang.im"');
  process.exit(1);
}

// ── 全局速率限制（token bucket，简化版）──
let bucket = 1;
const refillIntervalMs = 1000 / RATE_PER_SEC;
setInterval(() => { if (bucket < 1) bucket = 1; }, refillIntervalMs).unref();

function takeToken() {
  if (bucket >= 1) { bucket -= 1; return true; }
  return false;
}

// ── SSRF 防护 ──
function isPrivateIp(ip) {
  if (ip === '::1' || /^fe80:/i.test(ip) || /^fc[0-9a-f]{2}:/i.test(ip) || /^fd[0-9a-f]{2}:/i.test(ip)) return true;
  const v4 = ip.replace(/^::ffff:/i, '');
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(v4);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isHostAllowed(host) {
  const h = host.toLowerCase();
  return ALLOWED_HOSTS.some(d => h === d || h.endsWith('.' + d));
}

async function assertSafeUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw new Error('URL 格式不合法'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('仅允许 http / https 协议');
  const host = u.hostname.toLowerCase();
  if (!isHostAllowed(host)) throw new Error(`域名不在白名单：${host}`);
  // 字面 IP
  if (/^[0-9.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw new Error('禁止抓取内网地址');
    return u;
  }
  let records;
  try { records = await lookup(host, { all: true }); } catch (e) { throw new Error('无法解析域名：' + (e.message || host)); }
  if (!records.length) throw new Error('域名无 A/AAAA 记录');
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error('域名解析到内网地址，禁止抓取');
  }
  return u;
}

// ── 抓取 + 跟随重定向 ──
async function fetchWithRedirects(initialUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = initialUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        redirect: 'manual',
        signal: controller.signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) throw new Error(`重定向 ${res.status} 缺 Location 头`);
        if (hop === MAX_REDIRECTS) throw new Error(`重定向超过 ${MAX_REDIRECTS} 跳`);
        const nextRaw = new URL(loc, current).toString();
        // 每跳重 SSRF 校验（防重定向到内网 / 白名单外域名）
        current = await assertSafeUrl(nextRaw);
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      // 不强制 HTML 类型 · 让上游（美国后台）决定如何处理；但仍限 size
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_HTML_BYTES) {
        throw new Error(`HTML 超过 ${MAX_HTML_BYTES / 1024 / 1024} MB 上限`);
      }
      const html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      return { status: res.status, finalUrl: String(current), html, contentType };
    }
    throw new Error('重定向循环（不应到这里）');
  } finally {
    clearTimeout(timer);
  }
}

// ── HTTP server ──
function readJsonBody(req, max = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > max) { req.destroy(); reject(new Error('body 过大')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('JSON 解析失败')); }
    });
    req.on('error', reject);
  });
}

function send(res, code, obj, headers = {}) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': typeof obj === 'string' ? 'text/plain; charset=utf-8' : 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  // healthz：无鉴权
  if (req.method === 'GET' && req.url === '/healthz') {
    return send(res, 200, { ok: true, allowedHosts: ALLOWED_HOSTS, ratePerSec: RATE_PER_SEC });
  }

  // /fetch · 鉴权
  if (req.method === 'POST' && req.url === '/fetch') {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${TOKEN}`) {
      return send(res, 401, { error: '鉴权失败' });
    }
    if (!takeToken()) {
      return send(res, 429, { error: '速率超限，请稍后重试' });
    }
    let body;
    try { body = await readJsonBody(req); } catch (e) {
      return send(res, 400, { error: e.message });
    }
    const url = (body && typeof body.url === 'string') ? body.url : '';
    if (!url) return send(res, 400, { error: '缺 url' });

    let safe;
    try { safe = await assertSafeUrl(url); } catch (e) {
      return send(res, 403, { error: e.message });
    }
    try {
      const out = await fetchWithRedirects(safe);
      return send(res, 200, out);
    } catch (e) {
      const msg = e.name === 'AbortError' ? `抓取超时 (>${FETCH_TIMEOUT_MS / 1000} s)` : (e.message || String(e));
      return send(res, 502, { error: msg });
    }
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`asia-relay listening on ${HOST}:${PORT} · allowed=${ALLOWED_HOSTS.join(',')} · rate=${RATE_PER_SEC}/s`);
});

// 优雅退出
function shutdown(signal) {
  console.log(`收到 ${signal} · 关闭中`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
