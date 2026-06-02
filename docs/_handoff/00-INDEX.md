# 觉学 · 交付文档总索引

> 状态：维护中（2026-05-31 创建 · 2026-06-02 更新）
> 用途：本套文档的导航入口。列出每份文档的用途、状态、阅读顺序。
> 新会话开始：先读项目根 `CLAUDE.md` 工作守则，再按下方「推荐阅读顺序」进入。
> 🆕 **新 PM 对接先看**：`OPEN-DECISIONS.md`（待决策交接单·仍需产品拍板的开放项一页看全）。

---

## 一、文档地图

### 📐 最终设计（系统应该是什么样）

| 文档 | 用途 | 状态 |
|---|---|---|
| `decisions/05-decision-log.md` | 战略决策 D1-D20（产品方向权威来源）| 维护中 |
| `decisions/02-roles-and-permissions-v1.md` | 4 角色权限矩阵（23 职能）| ✅ 定稿 |
| `decisions/06-business-capabilities-WIP.md` | 业务能力 1-25（业务层设计）+ 净资产清单 | 1-25 已定稿 |
| `decisions/08-merged-design.md` | 表/字段/DR/Migration/Phase（数据层设计）· DR 编号档 | 维护中·封板至 DR-148 |
| `decisions/09-api-and-pages-design.md` | **API 契约 + 页面/交互（SoT 第三层）· 全 51 能力** | 首轮完整·已过一致性检查 |
| `decisions/07-integration-plan.md` | 新旧设计融合工作守则（注：§表标签清单部分已被 DR-145 部分覆盖）| 半历史·维护中 |

### 🔍 现状审计（线上现在是什么样）

| 文档 | 用途 | 状态 |
|---|---|---|
| `audit/01-current-system-audit.md` | schema 层（60 model）现状 vs 新设计差异 + 净资产 + 覆盖度 | ✅ 完成 |
| `audit/02-code-layer-audit.md` | 权限/三端/迁移 代码层现状 | ✅ 完成 |

### 🛠 改造方案（从现状到设计怎么做）

| 文档 | 用途 | 状态 |
|---|---|---|
| `audit/03-modification-plan.md` | **改造执行方案**：实现状态图例 + 能力总览 + 🆕/🔧/✅/⏸/❌ 五类清单 + 权限改造 + 迁移 + Phase | 进行中 |
| `audit/06-schema-gap-现状对目标.md` | **Schema 现状↔目标逐表差异**：线上 60 model 分 复用48/扩展5/改造4/废弃3 + 要新建 40+（排期依据）| 🆕 6-02 |

### 📚 配套参考

| 文档 | 用途 | 状态 |
|---|---|---|
| `audit/04-data-model-overview.md` | 数据模型总图（61 model / 23 enum 分 12 域 + 文字版 ER）| ✅ 完成 |
| `audit/05-api-endpoints.md` | API 端点清单（139 端点 / 26 模块 × 守卫）| ✅ 完成 |
| `glossary.md` | 术语表（阶段/专业/升学/传承/座/报数…）| ✅ 完成 |
| `acceptance-checklist.md` | 验收清单（能力 1-25 可测试标准）| ✅ 完成 |
| `deploy-migration-runbook.md` | 部署 + 迁移 runbook | ✅ 完成 |
| `reports/02-product-context.md` | 产品背景 | — |

### 🩺 诊断报告（缺口与对齐状态，需读不可漏）

| 文档 | 用途 | 状态 |
|---|---|---|
| `reports/03-大纲符合性验收报告.md` | 设计 vs 大纲符合性：2 处 P0 缺口（A3 选专业锁定→已待定；F7.2 留级次数分专业→未决）+ 5 处需补强 | 2026-06-01 |
| `reports/04-设计完整性与app需求验收.md` | 设计完整性诊断：WP-A「API/页面层缺位」→ 已补 09 | 2026-06-01 |

---

## 二、推荐阅读顺序

0. `OPEN-DECISIONS.md` —— **待决策交接单**（新 PM 先看：仍需产品拍板的开放项 F7.2/A3/F2/F3.7/A5）
1. 项目根 `CLAUDE.md` —— 工作守则（必读）
2. `decisions/05-decision-log.md` —— 战略方向 D1-D20
3. `decisions/02-roles-and-permissions-v1.md` —— 角色权限
4. `decisions/06-business-capabilities` —— 业务能力 1-25
5. `audit/01` + `audit/02` —— 线上现状
6. `audit/03-modification-plan` —— 改造方案（总览主表一屏看全）
7. `decisions/08-merged-design` —— 数据层字段级设计（深入时查）
8. `decisions/09-api-and-pages-design` —— API 契约 + 页面/交互层（全 51 能力，端点/路由/三端可见性）
9. `reports/03` + `reports/04` —— 诊断报告（已知缺口与待决策项）

---

## 三、实现状态图例（全套通用，详见 03 §1）

✅ 已实现·保留 · 🔧 已实现·需改造 · 🆕 未实现·待建 · ⏸ 暂不上线 · ❌ 去掉

---

## 变更记录

| 日期 | 内容 |
|---|---|
| 2026-05-31 | 创建总索引；登记设计/审计/改造方案/配套四类文档 |
| 2026-06-02 | 收录 09（API/页面层·SoT 第三层）+ reports/03/04（诊断报告）；阅读顺序补 8/9；08 状态更新至 DR-148；标注 07 §表标签部分已被 DR-145 覆盖。新 PM 对接前导航层同步（决策 DR-146/147/148 已落，A3/F7.2 为开放产品缺口） |
| 2026-06-02 | 新增 `OPEN-DECISIONS.md` 待决策交接单（5 条开放项 F7.2/A3/F2/F3.7/A5），登记入索引头部 + 阅读顺序第 0 步 |
