# 首页 v2 改版 · 回滚指南

> 这是 2026-05 首页画报日历改版的完整记录 · 任何时候出问题都能照此回滚

## 一、版本定义

| 版本 | Commit | 说明 |
|---|---|---|
| **v1 基线** | `fea883a` | 改版前最后稳定 commit（含 ScriptureDetailPage 重排 + iOS 日历 chip） |
| **v1 代码档案** | `90c1974` | `HomePage.v1.tsx` 保存 v1 完整代码 · 不挂路由 |
| **v2 起点** | `66194da` | 第一个 v2 commit（feat: 画报首页） |
| **v2 当前** | `91a4380` | 最新（fix: tab bar dvh） |

## 二、所有 v2 改动 commit

```
91a4380 fix(home): tab bar 与卡片重叠 · 100vh → 100dvh + margin-bottom
e1836e8 ux(home): 100vh 不滚动 · 4 卡紧凑两排
3c99c39 ux(tabbar): 仅图标模式去掉背景 / 边框
8daaf65 ux(home + profile): TabBar 仅图标 + 4 卡 2×2 + 日期左上小字 + Profile 返回箭头
66194da feat(home): v2 画报日历首页 · 全屏壁纸 + 4 大卡 + admin 上传月度图
```

## 三、修改的文件清单

### 后端
| 文件 | 改动 | v1 状态 |
|---|---|---|
| `backend/prisma/schema.prisma` | + HomePoster model | 不存在 |
| `backend/src/app.ts` | + postersRoutes register | 没这一行 |
| `backend/src/modules/posters/routes.ts` | 新建 | 不存在 |
| `backend/src/modules/posters/service.ts` | 新建 | 不存在 |

### 前端 · 修改
| 文件 | 改动 |
|---|---|
| `juexue-v2/src/App.tsx` | + AdminPostersPage 懒加载 + 路由 |
| `juexue-v2/src/components/AdminShell.tsx` | + 「首页画报」侧栏入口 + IconImage |
| `juexue-v2/src/components/TabBar.tsx` | 4 tab → 3 tab · 去 label · 仅图标 |
| `juexue-v2/src/styles/components.css` | + `.tab-bar-icons-only` 样式 |
| `juexue-v2/src/pages/HomePage.tsx` | 完全重写（v1 在 `HomePage.v1.tsx`） |
| `juexue-v2/src/pages/ProfilePage.tsx` | + 左上返回箭头 |

### 前端 · 新建
| 文件 | 用途 |
|---|---|
| `juexue-v2/src/pages/HomePage.v1.tsx` | v1 完整代码档案 · 不挂路由 |
| `juexue-v2/src/pages/AdminPostersPage.tsx` | admin 画报上传管理页 |

## 四、数据库变更

```sql
-- v2 新增表：
CREATE TABLE "HomePoster" (
  id          TEXT PRIMARY KEY,
  year        INT,
  month       INT,
  imageUrl    TEXT,
  caption     TEXT,
  createdAt   TIMESTAMP,
  updatedAt   TIMESTAMP,
  UNIQUE(year, month)
);
```

回滚时**不必删此表** · 保留不影响 v1 运行 · 只是占少量空间。如要清理：
```sql
DROP TABLE IF EXISTS "HomePoster";
```

`/uploads/posters/` 下的上传文件可以保留或手动删除。

## 五、3 种回滚方式（按推荐度排序）

### 方式 A · 用 v1 备份文件直接还原 ⭐⭐⭐ 最简单

适合：只想还原首页视觉、保留所有后端能力

```bash
cd ~/projects/juexue/juexue-v2/src

# 1. HomePage 还原
cp pages/HomePage.v1.tsx pages/HomePage.tsx

# 2. TabBar 还原为 4 tab + 文字
git checkout fea883a -- components/TabBar.tsx styles/components.css

# 3. ProfilePage 去掉返回箭头（可选 · 保留也没坏处）
git checkout fea883a -- pages/ProfilePage.tsx

# 4. rebuild · 不动后端 · 不动数据库
cd ../..
npm run build
# nginx 自动重读 dist/
```

效果：前端视觉立刻回到 v1 · 后端 HomePoster 表保留 · admin/posters 页面仍能进（但学员侧 HomePage 不再用画报）

### 方式 B · git revert 5 个 v2 commit ⭐⭐ 干净

适合：想保留 git 历史 + 明确 revert 记录

```bash
cd ~/projects/juexue
git revert 91a4380 e1836e8 3c99c39 8daaf65 66194da --no-edit
git push

# 后端不需要任何动作（schema 文件 revert 后用 prisma db push 会保留数据 · 但移除模型）
# 注：如果 prisma db push 报警告 · 选 "accept data loss" 或保留表
cd backend
npx prisma generate
# 不要跑 prisma db push（除非要删表）
npm run build
pm2 restart juexue-api

cd ../juexue-v2
npm run build
```

效果：repo 完全回到 v1 状态 · HomePoster 表仍在但 backend client 不识别 · 不影响其他模块

### 方式 C · 硬重置到 v1 ⭐ 暴力 · 不推荐

适合：v2 期间没有其他改动 · 也愿意丢弃所有改动

```bash
cd ~/projects/juexue
git reset --hard fea883a
git push --force-with-lease   # ⚠️ 需要权限 + 团队协调
```

⚠️ 风险：v2 期间任何其他人 push 的代码也会丢失 · 强制 push 可能被仓库保护规则拒绝

## 六、回滚后验证步骤

```bash
# 1. 后端跑得起
pm2 status juexue-api
curl -s http://localhost:3000/health

# 2. 前端 hash 已更新
curl -s https://juexue.caughtalert.com/app/ | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1

# 3. 首页可访问（应该看到 v1 的卡片化布局 · 不是画报）
# 浏览器强刷 https://juexue.caughtalert.com/app/

# 4. 关键功能跑一遍
# - admin 登录
# - 学员首页正常显示班级 / 法本 / 练习 / 4 图标
# - TabBar 4 个 tab（首页 / 法本 / 复习 / 我的）
```

## 七、保险提醒

**改回 v1 前先做：**
1. 当前 v2 数据库做快照（防止 prisma db push 后表结构错乱）
   ```bash
   sudo docker exec juexue-postgres pg_dump -U juexue juexue > /tmp/v2-snapshot.sql
   ```
2. 当前 commit 打 tag（万一回不来）
   ```bash
   git tag v2-before-rollback
   git push --tags
   ```

---

文档维护：每次重大改版前更新此文件 · 记录新版本与旧版本的差异。
