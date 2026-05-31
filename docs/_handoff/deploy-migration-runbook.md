# 觉学 · 部署 + 数据迁移 Runbook

> 状态：进行中（2026-05-31 创建）
> 用途：上线部署步骤 + 改造数据迁移顺序。部署细节源 `CLAUDE.md`；迁移源 `audit/02 §三` + `08 §十一 Migration`。
> ⚠️ 本文是操作手册，迁移脚本须实现时编写并测试，本文只定**顺序与卡点**。

---

## 一、生产环境（来自 CLAUDE.md，权威）

| 项 | 值 |
|---|---|
| 项目根 | `/home/ubuntu/projects/juexue` |
| 后端进程 | PM2 `juexue-api` · `pm2 reload juexue-api`（零停机）|
| 前端静态目录 | `/var/www/juexue/app/` |
| 数据库 | PostgreSQL · `localhost:5433` · db `juexue` |
| OSS | 129.213.64.152，nginx 静态 + ssh/scp 投递视频 |
| 域名 | `juexue.caughtalert.com`（前端 /app/）· `media.juexue.caughtalert.com` |

## 二、常规部署流程（来自 CLAUDE.md）

```bash
# 1. 拉代码
cd /home/ubuntu/projects/juexue && git pull origin <branch>

# 2. 后端（schema/后端代码变动时）
cd backend
npx prisma generate
npx prisma migrate deploy        # 应用 migrations（非 db push，可回滚）
npm run build
pm2 reload juexue-api            # 零停机优雅重启

# 3. 前端（juexue-v2 任何改动）
cd ../juexue-v2
rm -rf dist/ && npm run build
sudo rsync -av --delete dist/ /var/www/juexue/app/

# 4. 浏览器强刷 / 无痕窗口验证
```

提交前自检（CLAUDE.md 铁律）：`juexue-v2` 跑 `npm run typecheck && npm run lint && npm run build`，后端动了再跑 `backend npm run build`，三步全过才提交。

## 三、改造数据迁移顺序（来自 audit 02 §三）

```
1. 建 Program 体系（专业×届）          ← 地基，无存量数据
2. 运营补：每个现存 Class → programId   ← 🔴 人工，数据缺维度（最大卡点）
3. UserRoleAssignment + 角色迁移脚本    ← admin→super_admin(后人工降级) / coach→class_tutor(scope=classId)（DR-113）
4. enrollment 彻底迁专业级             ← 依赖 1/2；课程级数据迁走，废课程语义（DR-113）
5. 打卡数据补专业维度                   ← 依赖 1/2
6. 升学/传承/出勤/报数等新表            ← 独立，随 Phase 推进
7. 人工补任命                          ← coach 补 class_admin、admin 降 subject_admin（DR-113）
```

### 难度与卡点

| 迁移项 | 难度 | 关键 |
|---|---|---|
| 角色迁移 | 🟡 | admin→super_admin / coach→class_tutor 可脚本化；JWT 单 role → assignments，**token 全失效需全员重登**（#7）；**过渡期需人工补任命**（DR-113）|
| **专业×届归属** | 🔴 | 现有 Class 无此维度，**须运营人工补 programId**；改造启动前先定映射规则（待修订 #8）|
| **enrollment 迁专业级** | 🔴 | **彻底迁走课程级**：进度数据（completedLessons 等）迁入专业级，课程语义废弃；依赖 Program 先建（DR-113）|
| 打卡数据 | 🟢 | 保留 + 补专业字段 |
| 题库/SM2/笔记/通知 | 🟢 | 净资产，近零迁移 |
| 升学/传承/出勤 | 🟢 | 全新表无存量 |

### 角色迁移过渡期须知（DR-113）
- **辅导员**：迁移当天仅 class_tutor，报数审核/邀请码/关怀等行政功能**待 subject_admin 补 class_admin 后恢复**——上线前须备好补任命名单与时间窗。
- **管理员**：原 admin 先全升 super_admin，降级前为**全局最高权限**，须尽快人工 review 把学科级管理者降为 subject_admin。

### 迁移基础设施现状（audit 02）
- Prisma migrations 仅 2 个（0_init + 1_lesson_resources），历史以 db push 为主，已切 migrate deploy
- 旧 db-push 库首次切换：先 `npx prisma migrate resolve --applied 0_init`（CLAUDE.md）
- 新设计大量新表/改字段，须新建一批 migration（见 08 §十一 M1-M8）

## 四、迁移前置检查清单

- [ ] 专业×届映射规则已确立（待修订 #8）
- [ ] Program 体系 migration 就绪（M1）
- [ ] 角色迁移脚本测试通过（admin/coach 映射 + scope）
- [ ] JWT 改造方案确定，全员重登通知预案（待修订 #7）
- [ ] 净资产表零改动验证（题库/SM2/通知/笔记）
- [ ] migrate deploy 在预发库演练通过 + 回滚预案
- [ ] OSS 视频/封面投递链路不受影响

## 五、上线策略建议（audit 02）
- 权限改造（265 处 requireRole + JWT）建议分三阶段：地基（auth.ts/permissions.ts）→ 批量改调用点 → 测试灰度
- AI 模块（M8）依赖 pgvector，独立推进，暂不上线（DR-109）

---

## 变更记录
| 日期 | 内容 |
|---|---|
| 2026-05-31 | 创建部署+迁移 runbook；部署源 CLAUDE.md，迁移顺序/卡点源 audit 02 §三 + 08 Migration |
