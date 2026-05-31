# 觉学 · 交付文档总索引

> 状态：进行中（2026-05-31 创建）
> 用途：本套文档的导航入口。列出每份文档的用途、状态、阅读顺序。
> 新会话开始：先读项目根 `CLAUDE.md` 工作守则，再按下方「推荐阅读顺序」进入。

---

## 一、文档地图

### 📐 最终设计（系统应该是什么样）

| 文档 | 用途 | 状态 |
|---|---|---|
| `decisions/05-decision-log.md` | 战略决策 D1-D20（产品方向权威来源）| 维护中 |
| `decisions/02-roles-and-permissions-v1.md` | 4 角色权限矩阵（23 职能）| ✅ 定稿 |
| `decisions/06-business-capabilities-WIP.md` | 业务能力 1-25（业务层设计）+ 净资产清单 | 1-25 已定稿 |
| `decisions/08-merged-design.md` | 表/字段/DR/Migration/Phase（数据层设计）| 进行中 |
| `decisions/07-integration-plan.md` | 新旧设计融合工作守则 | 维护中 |

### 🔍 现状审计（线上现在是什么样）

| 文档 | 用途 | 状态 |
|---|---|---|
| `audit/01-current-system-audit.md` | schema 层（60 model）现状 vs 新设计差异 + 净资产 + 覆盖度 | ✅ 完成 |
| `audit/02-code-layer-audit.md` | 权限/三端/迁移 代码层现状 | ✅ 完成 |

### 🛠 改造方案（从现状到设计怎么做）

| 文档 | 用途 | 状态 |
|---|---|---|
| `audit/03-modification-plan.md` | **改造执行方案**：实现状态图例 + 能力总览 + 🆕/🔧/✅/⏸/❌ 五类清单 + 权限改造 + 迁移 + Phase | 进行中 |

### 📚 配套参考

| 文档 | 用途 | 状态 |
|---|---|---|
| `audit/04-data-model-overview.md` | 数据模型总图（文字版 ER，分模块）| 待建 |
| `audit/05-api-endpoints.md` | API 端点清单（端点×能力×角色）| 待建 |
| `glossary.md` | 术语表（阶段/专业/升学/传承/座/报数…）| 待建 |
| `acceptance-checklist.md` | 验收清单（每条能力可测试标准）| 待建 |
| `deploy-migration-runbook.md` | 部署 + 迁移 runbook | 待建 |
| `reports/02-product-context.md` | 产品背景 | — |

---

## 二、推荐阅读顺序

1. 项目根 `CLAUDE.md` —— 工作守则（必读）
2. `decisions/05-decision-log.md` —— 战略方向 D1-D20
3. `decisions/02-roles-and-permissions-v1.md` —— 角色权限
4. `decisions/06-business-capabilities` —— 业务能力 1-25
5. `audit/01` + `audit/02` —— 线上现状
6. `audit/03-modification-plan` —— 改造方案（总览主表一屏看全）
7. `decisions/08-merged-design` —— 数据层字段级设计（深入时查）

---

## 三、实现状态图例（全套通用，详见 03 §1）

✅ 已实现·保留 · 🔧 已实现·需改造 · 🆕 未实现·待建 · ⏸ 暂不上线 · ❌ 去掉

---

## 变更记录

| 日期 | 内容 |
|---|---|
| 2026-05-31 | 创建总索引；登记设计/审计/改造方案/配套四类文档 |
