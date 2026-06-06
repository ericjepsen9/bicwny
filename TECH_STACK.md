# 觉学 (JueXue) · 完整技术栈

> 本文档由实际代码库核对生成（package.json / schema.prisma / 源码目录），非凭印象。
> 更新日期：2026-06-06

## 整体结构（Monorepo）

```
bicwny/
├── backend/        Fastify API + LLM 网关
├── juexue-v2/      React SPA（+ Capacitor 原生端）
├── asia-relay/     法本抓取亚洲中转节点（独立 Node 服务）
├── e2e/            Playwright 端到端测试
├── deploy/         nginx + 部署脚本
└── docs/           五层 SoT 设计文档
```

---

## 一、前端（`juexue-v2/`）

| 分类 | 技术 | 版本 |
|---|---|---|
| 框架 | **React** | 18.3 |
| 构建 | **Vite** | 5.4 |
| 语言 | **TypeScript** | 5.6 |
| 服务端状态 | **TanStack React Query** | 5.59 |
| 客户端状态 | **Zustand** | 5.0 |
| 路由 | **React Router DOM** | 7.0 |
| Lint | ESLint 9 + typescript-eslint 8 + react-hooks 插件 | — |
| 测试 | **Playwright**（smoke / visual / tour / flows） | 1.59 |

### 原生化
- **Capacitor 8**（iOS / Android）—— `app` / `haptics` / `keyboard` / `preferences` / `splash-screen` / `status-bar`
- `build:native` 模式 + `cap sync / open / add`

---

## 二、后端（`backend/`）

| 分类 | 技术 | 版本 |
|---|---|---|
| 框架 | **Fastify** | 5.2 |
| 语言 | TypeScript 5.7（ESM，`"type":"module"`） | — |
| 运行 | **tsx**（dev watch）/ node（prod，`dist/`） | — |
| ORM | **Prisma** | 6.1 |
| 数据库 | **PostgreSQL**（生产 `localhost:5433`，db `juexue`） | — |
| 校验 | **Zod** 3.24 + `zod-to-json-schema` | — |
| 认证 | `@fastify/jwt`（JWT，DR-114 token 不烤 role） | 10.1 |
| 安全 | `@fastify/helmet` / `@fastify/cors` / `@fastify/rate-limit` | — |
| 文件上传 | `@fastify/multipart` | 9.0 |
| API 文档 | `@fastify/swagger` + `swagger-ui` | — |
| 监控 | **Sentry** (`@sentry/node`) | 8.55 |
| HTTP 客户端 | **undici** | 6.21 |
| 测试 | **Vitest**（unit + integration 分离） | 2.1 |

### Fastify 业务模块（35 个域）
`answering`（答题）/ `auth`（认证）/ `class(es)`（班级）/ `coach`（辅导员）/ `courses`（课程）/ `admin`（后台）/ `llm`（LLM 网关）/ `meditations`（观修）/ `practice`（日常打卡）/ `reading`（法本阅读）/ `questions`（题库）/ `sm2`（间隔复习算法）/ `search`（搜索）/ `reports`（报数）/ `notifications`（通知）/ `push`（推送）/ `dossier`（学员档案）/ `enrollment`（入班）/ `dharma-assemblies`（法会）/ `achievements`（成就）/ `analytics`（分析）/ `experiments`（A/B 实验）/ `tibetan`（藏文）等

### 辅助库
- **sharp** 0.33 —— 图片处理（封面 `fit:'inside'` 保留原比例）
- **mammoth**（docx）/ **pdf-parse** / **cheerio** —— 法本内容导入
- **web-push** 3.6 —— Web Push 推送通知
- 自研 lib：`ttl-cache` / `ranking-cache` / `circuit`（熔断器）/ `period` / `timezone` / `oss`

### 全文搜索
- **PostgreSQL `tsvector`**（原生全文检索，不依赖 ES / Meilisearch 等外部引擎）
- 向量检索（pgvector / embedding）**未使用**

---

## 三、LLM 网关（`backend/src/modules/llm/`）

自研多 Provider 网关：

| 要素 | 内容 |
|---|---|
| Provider | **Claude**（Anthropic）· **MiniMax**（`minimax` + `minimax-m27` = MiniMax-M2.7）|
| 配置模型 | `claude-haiku-4-5` / MiniMax `abab6.5` |
| 功能模块 | `gateway`（路由）/ `circuit`（熔断）/ `quota`（配额）/ `usage`（用量统计）/ `scenario`（场景路由）/ `prompt`（提示管理）|
| 用途 | 答题批改与反馈、AI 助手问答 |

---

## 四、亚洲中转节点（`asia-relay/`）

- **纯 Node 标准库**（零 npm 依赖）独立服务 `relay.mjs`
- 用途：美国后端被法本站点封 IP 时，切换香港/东京/新加坡节点抓取
- **Caddy**（反向代理）+ **systemd** 常驻守护
- 安全机制：Bearer token 认证 · 域名白名单 · SSRF 防御（拒绝内网/链路本地/回环 IP）· 全局速率限制 · HTML 上限 5MB · 超时 15s

---

## 五、基础设施 / 部署（`deploy/`）

| 要素 | 内容 |
|---|---|
| 进程管理 | **PM2**（进程名 `juexue-api`，`pm2 reload` 零停机优雅重启）|
| Web 服务器 | **nginx**（前端静态 `/var/www/juexue/app/` + 后端反代）|
| 生产服务器 | `instance-20260213-1230`（backend + nginx）|
| OSS | 独立服务器 `129.213.64.152`，nginx 静态服务，ssh + scp + ffmpeg 投递视频 |
| 域名 | `juexue.caughtalert.com`（前端 `/app/`）· `media.juexue.caughtalert.com`（OSS）|
| 数据库备份 | `db-backup.sh` + cron + `db-restore-verify.sh` |
| 迁移 | `prisma migrate deploy`（有版本历史，可回滚）|

---

## 六、CI/CD（`.github/workflows/`）

- **`test.yml`** —— 自动化测试
- **`deploy.yml`** —— 自动化部署
- 包管理器：**npm**（backend 同时存在 `pnpm-lock.yaml`）

---

## 一句话总结

> **React 18 + Vite + TypeScript（+ Capacitor 原生）** 前端，**Fastify 5 + Prisma 6 + PostgreSQL + Zod** 后端，**Claude / MiniMax 双 Provider LLM 网关**（含熔断 + 配额），**PG tsvector 原生全文检索**，**PM2 + nginx** 生产部署，独立 **asia-relay**（纯 Node）法本中转，测试覆盖 **Vitest + Playwright**，监控用 **Sentry**。
