# 现有项目审计 · 代码层（权限 / 三端 / 迁移）

> 状态：进行中（2026-05-31）
> 接续 `01-current-system-audit.md`（schema 层）。本篇下钻**代码逻辑层**：后端权限实现、前端三端分离、数据迁移可行性。
> 铁律：纯只读审计，不改代码。
> 方法：schema 通读 + 两个 Explore agent 并行探查（后端权限 / 前端三端）+ 迁移基础设施核查。

---

## 一、后端权限与角色判断现状

### 1.1 鉴权架构（单一入口，架构良好）
- 核心：`backend/src/lib/auth.ts`
  - `jwtOptional`：全局 onRequest 钩子，验 JWT，挂 `req.user`（app.ts:212）
  - `requireRole(...roles)`：路由级守卫工厂，检查 `JWT payload.role ∈ roles`
  - `getUserRole()` / `requireUserId()`：读角色 / 强制登录
- **JWT payload.role 是单值**（admin/coach/student）——这是改造的关键约束点

### 1.2 角色判断的散布规模
| 维度 | 现状 |
|---|---|
| `requireRole(...)` 调用 | **265 次**，分散在 ~143 个路由文件（多为 `requireRole('coach','admin')`）|
| 硬编码角色判断 | ~15 处（class service 8 处 + notes/announcements/practice 各 1-2 处 + auth 1 处）|
| admin 全局 bypass | ~16 处（`if (role==='admin') return` 散落，无统一框架）|

### 1.3 班级级权限（已有作用域雏形）
- `assertIsCoachOfClass(userId, classId)`（class/service.ts:853）：查 `ClassMember{classId,userId,role=coach,removedAt=null}`，被调用 17 次
- `assertMemberOfClass(classId, userId)`：任意成员校验
- **作用域雏形**：`PracticeProject.scope`（user/class）+ classId 匹配——coach 只能操作本班 scope=class 的项目
- **判断模型** = (User.role + ClassMember.role) × classId 匹配，但未系统化

### 1.4 与新设计差异
| 新设计要素 | 现状 | 动作 |
|---|---|---|
| 4 角色 + 等级继承 | 三元单值 role，无继承 | 🔧 重构 requireRole + 🆕 permissions.ts 继承库 |
| UserRoleAssignment 作用域表 | JWT 单 role，ClassMember.role 班级内 | 🆕 新建表；JWT 改带 assignments 或改查库 |
| class_tutor / class_admin 分离 | coach 合一 | 🔧 coach 拆两级，班级内权限分化（17 处断言点 + 班级模块）|
| subject_admin 学科级 | 无此层 | 🆕 全新作用域类型（major_id）|
| super_admin 统一超权 | admin bypass 散 16 处 | 🔧 收敛为统一等级判定 |

### 1.5 改造要点（agent 评估）
- ✅ **可集中改造**：`auth.ts` 的 requireRole 工厂 + 新增 `permissions.ts`（继承+作用域交集）+ class service 断言函数（3 处核心）
- ❌ **须逐点/分批**：265 处 requireRole 调用 + 16 处 admin bypass 重新表达 + 班级内 coach→tutor/admin 权限语义明确
- **工作量级别**：中偏高。agent 推测分三阶段（地基→批量改调用点→测试灰度），实际取决于团队规模与测试覆盖，此处仅记**量级**不作工期承诺
- **风险**：265 处若有遗漏 → 误拒；迁移期 coach 误降 student（需迁移状态机）；JWT 单 role 改造影响所有已签发 token

---

## 二、前端三端分离现状

### 2.1 结论：三端分离已基本达标（~85-90%）
新设计「学员端纯消费 / `/coach/*` / `/admin/*` 严格分离」的铁律，**线上前端已落实**。

### 2.2 路由与守卫（双层，完整）
| 端 | 容器 | 外层守卫（登录）| 内层守卫（角色）| 文件 |
|---|---|---|---|---|
| 学员 | AppShell（手机壳+TabBar）| RequireAuth | — | App.tsx:144 |
| 辅导员 | CoachAppShell（桌面侧栏）| RequireCoachAuth | RequireCoach（coach\|admin）| App.tsx:210 |
| admin | AdminAppShell（桌面侧栏）| RequireAdminAuth | RequireAdmin（仅 admin）| App.tsx:255 |

- 学员直接访问 `/coach`、`/admin` → 被外层守卫拦截重定向登录页
- 守卫组件齐全：`components/RequireAuth|RequireCoach|RequireCoachAuth|RequireAdmin|RequireAdminAuth.tsx`

### 2.3 学员端已清理干净
- ClassDetailPage（注释明确「学员端纯展示·管理走 /coach 和 /admin」，CLAUDE.md commit 1507921 事故已修）/ ProfilePage / HomePage 均无管理操作混入
- 共享页面示范：CoachClassSessionsPage 用 `isManageRoute = pathname.startsWith('/coach'|'/admin')` 控制学员只读

### 2.4 页面规模
- 学员 ~40 页 / coach ~12 页 / admin ~21 页 / 公开 6 页（认证引导）

### 2.5 与新设计差异
| 项 | 现状 | 动作 |
|---|---|---|
| 三端路由物理隔离 | ✅ 已达标 | ✅ 复用 |
| 学员端纯消费 | ✅ 已达标 | ✅ 复用 |
| 共享页面前端分权 | 🟡 部分（AdminCoursesPage/MeditationsPage 缺 isManageRoute，靠后端兜底）| 🔧 补防线（非阻塞）|
| coach 端拆 class_tutor/class_admin | coach 合一 | 🔧 将来在 `/coach` 容器内按两级细分页面权限 |

**意义**：三端框架是现成净资产，新设计**不用重建**，只需将来在 `/coach` 内做 tutor/admin 两级细分。

---

## 三、数据迁移可行性（基于 schema 分析）

### 3.1 迁移基础设施
- Prisma migrations 仅 **2 个**（0_init + 1_lesson_resources）——历史以 `db push` 为主，CLAUDE.md 审计 5.4 已切 `migrate deploy`
- 有 seed/脚本（content-seed/llm scenario seed 等），无大规模数据迁移脚本先例
- 新设计大量新表/改字段，Prisma migrate 可承载，但需新建一批 migration

### 3.2 迁移难度分级
| 迁移项 | 难度 | 说明 |
|---|---|---|
| **角色迁移** | 🟡 中（可脚本化）| admin→super_admin(global)；ClassMember.role=coach→class_tutor+class_admin(scope=classId)；student 隐含。**但 JWT 单 role 需改**，已签发 token 全失效需重登 |
| **专业体系归属** | 🔴 难（数据缺维度）| 现有 Class 直绑 courseId，**无专业×届归属**。迁移需先建 Program，再把每个现存 Class 归入某 Program——系统不知道哪个班属哪专业哪届，**需运营人工补 programId** |
| **enrollment 升专业级** | 🟡 中 | UserCourseEnrollment（课程级）→ 派生 major_enrollment，依赖 Program 先建 |
| **打卡数据保留** | 🟢 易 | PracticeEntry/DailySummary 等保留，补专业归属维度字段即可 |
| **题库/答题/SM2/笔记** | 🟢 易 | 结构稳定，基本零迁移（净资产直接复用）|
| **升学/传承/出勤/报数** | 🟢 易（无存量）| 全新表，无存量数据要迁，纯新建 |

### 3.3 迁移关键路径
```
1. 建 Program 体系（专业×届）          ← 地基，无存量
2. 运营补：每个现存 Class → programId   ← 人工，数据缺维度（最大不确定性）
3. 建 UserRoleAssignment + 角色迁移脚本  ← admin/coach 映射，可自动
4. enrollment 派生专业级               ← 依赖 1/2
5. 打卡等补专业维度                     ← 依赖 1/2
6. 升学/传承/出勤等新表                 ← 独立，随 Phase 推进
```

**最大不确定性**：第 2 步——现有班级缺「专业×届」维度，迁移需运营介入人工归类，无法纯自动。

---

## 四、代码层审计综合结论

1. **净资产被印证**：前端三端框架 + 后端单一鉴权入口 + 题库/笔记/通知 = 改造的良好底座，**不推倒重来**
2. **改造主战场 = 权限体系**：三元→4 角色+作用域，265 处调用点 + JWT 结构是工作量集中区，但有统一改造点（auth.ts + permissions.ts）可降复杂度
3. **迁移最大卡点 = 专业归属**：现有数据缺「专业×届」维度，需运营人工补，建议**改造启动前先确立专业×届映射规则**
4. **三端框架可复用**：仅需 coach 端将来按 class_tutor/class_admin 细分

---

## 五、补充待修订设计清单（接 01 文档 §九，暂不执行）

> 注：原 01 §九 #6「迁移映射」已 ✅ 处理（2026-05-31，DR-113 / 检查轮次 60）：coach→仅 class_tutor（人工补 class_admin）、admin→全 super_admin 后人工降级、UserCourseEnrollment 彻底迁专业级。

7. **JWT 结构修订**：单 role → 带 assignments（或改查库），影响 token 体系（块一）—— ✅ **已处理（2026-05-31，DR-114 / 检查轮次 61）**：选**方案 B**（token 只留 sub/sid，权限每请求查 UserRoleAssignment + 短 TTL 缓存，角色变更即时生效）
8. **专业×届映射规则**：改造前须先定「现有班级如何归入专业×届」的运营规则（块三，迁移前置）—— ✅ **已处理（2026-05-31，DR-115 / 检查轮次 62）**：code+cohortYear 全运营逐班人工填，无占位专业，未归类班级不能上线（P1→P2 阻断式硬门槛）
9. **权限改造统一点**：明确 auth.ts requireRole + permissions.ts 为集中改造入口（块一）

---

## 变更记录
| 日期 | 内容 |
|---|---|
| 2026-05-31 | 创建代码层审计；后端权限（265 处 requireRole+作用域雏形）、前端三端（~85-90% 达标）、数据迁移（专业归属是最大卡点）三块完成 |
