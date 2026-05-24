# 觉学法本抓取 · 亚洲中转节点

部署在亚洲 VPS（香港 / 东京 / 新加坡）的轻量 HTTP 中转服务。
当美国主服务器被源站（如 mingguang.im）封 IP 时，admin 后台一键切到 `asia` 出口，
法本导入流程经此节点 fetch HTML，本机解析照常。

## 它做什么 / 不做什么

| ✅ 做 | ❌ 不做 |
|---|---|
| 鉴权 + 域名白名单 | HTML 解析（解析在主后台跑，避免重复维护） |
| SSRF 防护（拒绝内网 IP） | 长期缓存 / 数据库 |
| 跟随重定向（最多 5 跳） | 调用主后台任何端点（单向） |
| 全局 1 req/s 速率限制 | 用户登录 / 多租户 |
| HTML 5 MB 上限 + 15 s 超时 | JS 渲染（SPA） |

## 架构

```
[美国主后台]                              [亚洲 VPS]
  fetchHtml(target)
    └─ getSetting('scraper.fetchVia') = 'asia'
        ↓ HTTPS POST /fetch
        Bearer ASIA_RELAY_TOKEN              relay.mjs (Node 18+)
                                              ├ 域名白名单
                                              ├ SSRF 检查
                                              ├ fetch + redirects
                                              └ 速率限制
        ← { status, finalUrl, html, contentType }
    └─ extractMainText() / splitToChapters()  本机解析
```

## 部署

### 0. 准备 VPS

最低 1 核 / 512 MB / 5 GB · Ubuntu 22.04+ · Node 18+。
推荐位置：香港 / 东京 / 新加坡（国内访问也快）。

### 1. 装依赖

```bash
sudo apt update
sudo apt install -y nodejs caddy
node --version  # 必须 ≥ 18，自带 fetch
```

### 2. 创建用户 + 目录

```bash
sudo useradd -r -s /usr/sbin/nologin asia-relay
sudo mkdir -p /opt/asia-relay /etc/asia-relay
sudo cp relay.mjs /opt/asia-relay/
sudo chown -R asia-relay:asia-relay /opt/asia-relay
```

### 3. 配置环境变量

```bash
sudo cp systemd/asia-relay.env.example /etc/asia-relay/asia-relay.env
sudo chmod 600 /etc/asia-relay/asia-relay.env
sudo chown root:root /etc/asia-relay/asia-relay.env

# 生成强 token（32 字节 base64 ≈ 43 字符）
openssl rand -base64 32
# 把上面输出粘到 /etc/asia-relay/asia-relay.env 的 RELAY_TOKEN=...
sudo nano /etc/asia-relay/asia-relay.env
```

**关键字段**：
- `RELAY_TOKEN`：随机字符串，必须 ≥ 32 字符。**这个值要同步到主后台 `.env` 的 `ASIA_RELAY_TOKEN`**
- `ALLOWED_HOSTS`：允许抓取的域名，逗号分隔。例：`mingguang.im,buli.page`
- `RATE_LIMIT_PER_SECOND`：默认 1，被封后调小到 0.5 或 0.2

### 4. 启动 systemd 服务

```bash
sudo cp systemd/asia-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now asia-relay
sudo systemctl status asia-relay
sudo journalctl -u asia-relay -f
```

### 5. Caddy HTTPS 反代

先在域名 DNS 上加 A 记录 `asia-relay.your-domain.com → 本机公网 IP`，
然后：

```bash
sudo cp Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile  # 改成你的真实域名
sudo systemctl reload caddy
```

Caddy 会自动签发 Let's Encrypt。验证：

```bash
curl https://asia-relay.your-domain.com/healthz
# {"ok":true,"allowedHosts":["mingguang.im"],"ratePerSec":1}
```

### 6. 主后台配置 + 切换

在美国主后台（`backend/.env`）：

```env
ASIA_RELAY_URL=https://asia-relay.your-domain.com
ASIA_RELAY_TOKEN=<和 relay 端一致的 token>
```

重启主后台。然后：

1. admin 登录后台
2. 法本管理 → 导入法本模态框 → 顶部出口选择切到「亚洲中转节点」
3. 输入 URL → 点抓取，正常预览即可

后台开关写在 DB 表 `SystemSetting`（key=`scraper.fetchVia`）；
切回 `local` 立即生效，无需重启。

## 排错

| 现象 | 排查 |
|---|---|
| 主后台报 "亚洲节点未配置" | `.env` 里 `ASIA_RELAY_URL/TOKEN` 没设或为空 |
| 主后台报 "HTTP 401" | token 不一致，比对两端 |
| 主后台报 "HTTP 403 域名不在白名单" | relay 的 `ALLOWED_HOSTS` 没加这个域名 |
| 主后台报 "HTTP 429" | 速率超限 · 调大 `RATE_LIMIT_PER_SECOND` 或拉慢上层批量节奏 |
| 主后台报 "HTTP 502 抓取超时" | relay 自己也连不上源站 → 这台 IP 也被封了 / 域名 DNS 故障 |
| `journalctl -u asia-relay` 看不到日志 | `systemctl status asia-relay` 看进程状态、配置文件路径 |

## 安全提示

- **token 必须保密**。泄露相当于把 VPS 变成你账户下的开放代理（虽然有域名白名单，仍可被滥用）。
- 域名白名单**必须设置**，否则 relay 拒绝启动。永远不要写 `*` / 空。
- 公网防火墙：只开放 80/443（Caddy）；8080 只监听 127.0.0.1，不开放公网。
- 定期 rotate token：每季度换一次，主后台 `.env` 同步更新。
- 审计：journalctl + Caddy access log 可看每次抓取的源 IP / 时间 / 目标 URL。
