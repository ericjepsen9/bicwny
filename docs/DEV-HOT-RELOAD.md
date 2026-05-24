# 开发热重载模式 · 提速视觉迭代

> 当前迭代视觉 bug：每次「我改 → push → 你 git pull → npm build → rsync → 强刷 → 截图」≈ 5-10 分钟一轮。
>
> 用 vite dev mode 后：「我 push → 你 git pull → 自动热重载 → 截图」≈ **30 秒一轮**。

---

## 一次性设置（5 分钟）

### 1. 在主后端服务器开 Vite dev server

```bash
cd /home/ubuntu/projects/juexue/juexue-v2

# 后台启动 vite · 监听所有网卡 · 端口 5173
npm run dev -- --host 0.0.0.0 --port 5173 &

# 看是否起来了
sleep 2
curl -s http://localhost:5173 | head -5
```

期望看到 React 入口的 HTML（含 `<script type="module" src="/@vite/client"></script>` 等）。

### 2. nginx 加临时反代（让 vite 走你已有的域名 + SSL）

编辑 `/etc/nginx/sites-enabled/juexue` · 在 `server { ... }` 里加：

```nginx
# Dev hot-reload · 临时入口 · 上线前删掉
location /dev/ {
  proxy_pass http://127.0.0.1:5173/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header Upgrade $http_upgrade;        # vite hmr 用 websocket
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 86400;
}

# vite 内部资源（/@vite/* /@react-refresh /node_modules/.vite/* 等）
location ~ ^/(@vite|@react-refresh|@id|node_modules|src) {
  proxy_pass http://127.0.0.1:5173;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

reload nginx：
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 3. 浏览器访问

打开：`https://juexue.caughtalert.com/dev/`

应该看到与 prod 一样的 UI · 但**改完代码自动刷新**。

---

## 日常使用

### 我这边
正常 push 代码（不需要 build）。

### 你这边
```bash
cd /home/ubuntu/projects/juexue/juexue-v2
git pull origin claude/audit-page-quality-EpO7Q
# vite 监听文件变化 · 自动 HMR 推送到你浏览器
# 不需要 npm run build · 不需要 rsync · 不需要强刷
```

浏览器画面**自动更新**（一般 1-2 秒）。

---

## vite dev 跟 prod build 的差异

⚠️ 不是所有 bug 在 dev mode 都能复现：

| 场景 | dev 能否复现 |
|---|---|
| 视觉布局 / CSS | ✅ 能 |
| React 错误 / hooks bug | ✅ 能 |
| API 调用 / 数据问题 | ✅ 能（API 走同一后端）|
| Service worker 缓存 | ❌ dev 没 SW |
| Tree-shaking / minification 引发的 bug | ❌ 只 prod 有 |
| capacitor 原生 webview 行为 | ❌ 需真机 |

**所以**：UI / 视觉 bug 用 dev 验完后 · 仍要 build + rsync 到 prod 做最终确认。

---

## 上线 / 关闭 dev mode

测完后建议关掉 dev 入口（避免泄露开发产物）：

```bash
# 停 vite
pkill -f "vite.*5173"

# 删 nginx 的 /dev/ 反代块
sudo nano /etc/nginx/sites-enabled/juexue   # 手动删
sudo nginx -t && sudo systemctl reload nginx
```

如果想**长期保留** dev 入口（你自己访问）· 加一层 IP 白名单：

```nginx
location /dev/ {
  allow 你的家 IP;
  deny all;
  proxy_pass http://127.0.0.1:5173/;
  ...
}
```

---

## 故障排查

**症状：访问 /dev/ 报 502**
- vite 没起来 → `ps aux | grep vite` 看是否进程在
- 端口冲突 → `sudo lsof -i :5173`

**症状：页面打开但 HMR 不生效（改代码不刷新）**
- WebSocket 没通 → nginx 是否加了 `Upgrade` header
- 防火墙是否拦了 5173 → `sudo iptables -L | grep 5173`（不需要外网开 5173 · 只内部反代）

**症状：API 请求 404**
- vite dev 默认不代理 `/api/*` → 我们在 `vite.config.ts` 里没配 proxy · 因为 prod 同源 · dev 也走同一 nginx 反代到 backend · 所以 OK
- 如果发现是 404 · 跟我说 · 配 vite proxy 一下

---

## 我的承诺

启用 dev mode 后 · **视觉改动我承诺**：
1. 改完先用文字描述新布局给你确认
2. 实现后 push
3. 你浏览器自动刷新看效果
4. 一轮 30 秒以内
5. 视觉确认 OK · 我才发起 prod build + rsync

应该能省掉之前 70-80% 的来回时间。
