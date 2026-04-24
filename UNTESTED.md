# 觉学 · 未测试项目清单

> 本文件按步骤列出**尚未验证**的内容，每步独立可执行。
> 每步执行完后把前面的 `[ ]` 改成 `[x]` 即可，失败的写下错误原因。
> 路径基准：服务器 `/home/ubuntu/projects/juexue` · 本地浏览器访问 `https://juexue.caughtalert.com`。
> 代码基准：`claude/continue-refine-work-n8kIg` 分支的 `6459d70` HEAD。

---

## Phase A · 服务器部署验证（4 步 · 必做）

### A.1 · 拉取最新代码

```bash
cd /home/ubuntu/projects/juexue
git pull origin claude/continue-refine-work-n8kIg
git log --oneline -5
```

- [ ] `git log` 顶部是 `6459d70 chore(nav): 原型导航同步 Batch 3 新增 2 页`
- [ ] 无 merge 冲突 / 未提交改动

**失败处理**：`git status` 看冲突；若 docroot 有本地改动，`git stash` 后再 pull。

---

### A.2 · 跑 prisma migrate（含 Batch 0.3 + 2.1 所有 schema 改动）

```bash
cd /home/ubuntu/projects/juexue/backend
npx prisma generate
npx prisma migrate dev --name batch_0_to_3
```

- [ ] 无 `ForeignKeyConstraint` / `P1002` 错误
- [ ] 生成的 migration SQL 包含：
  - `CREATE TABLE "PasswordResetToken"`
  - `ALTER TABLE "Question" ADD CONSTRAINT ... FOREIGN KEY ("chapterId")`
  - `ALTER TABLE "QuestionReport" ADD CONSTRAINT ... FOREIGN KEY ("questionId") ... ON DELETE CASCADE`
  - 3 个新 `CREATE INDEX`

**失败处理**：
- P1002 advisory lock → `docker compose restart postgres` 或服务器的 Postgres 容器
- 旧数据违反新 FK（如 QuestionReport 指向已删 question）→ 手动清：
  ```sql
  DELETE FROM "QuestionReport" WHERE "questionId" NOT IN (SELECT id FROM "Question");
  ```

---

### A.3 · 重启后端 pm2 进程

```bash
pm2 list
pm2 restart juexue-backend   # 或你的进程名
pm2 logs juexue-backend --lines 30
```

- [ ] 启动日志显示 `listening on 0.0.0.0:3000`
- [ ] 无 `Cannot find module` 或 Prisma schema 报错
- [ ] curl 测一下新端点存在：
  ```bash
  curl -sI https://juexue.caughtalert.com/api/auth/forgot -X POST -H 'content-type: application/json' -d '{"email":"test@x.com"}'
  # 期望：200 · 不应 404
  ```

---

### A.4 · 跑新写的集成测试（admin + password-reset）

```bash
cd /home/ubuntu/projects/juexue/backend
# 需要先确保 DATABASE_URL 指向 test 库（避免清生产数据）
# 临时导出：export DATABASE_URL=postgresql://xxx/juexue_test

npm test -- tests/integration/admin.test.ts tests/integration/password-reset.test.ts
```

- [ ] admin.test.ts 18 条全绿
- [ ] password-reset.test.ts 11 条全绿
- [ ] 若跑全量 `npm test`：44 + 18 + 11 = **73 条全绿**

**失败处理**：贴错给我。最常见是测试库未建 → `npx prisma migrate deploy` 到测试库。

---

## Phase B · 浏览器手动流程（7 步 · 真机过一遍）

> 浏览器 **Ctrl+Shift+R** 硬刷新避免缓存。Safari / Chrome 手机版各跑一遍更稳。

### B.1 · 未登录打开 `/` 直达登录页

- [ ] 访问 `https://juexue.caughtalert.com/`
- [ ] 自动跳 `prototypes/mobile/home.html` → `require-auth.js` 检无 token → 再跳 `auth.html`
- [ ] 登录页全屏铺满（无假手机壳 · 无假 9:41 状态栏）

---

### B.2 · 密码找回完整链路

- [ ] auth.html 点"忘记密码"
- [ ] 输入已注册邮箱 · 点"发送重置链接"
- [ ] 看到"已发送重置链接..." 的绿色 info 提示
- [ ] 下方出现 `[dev] 直接进入重置页 →` 链接（dev / staging 环境才有）
- [ ] 点 dev 链接 → 进 `reset-confirm.html?token=xxx`
- [ ] 输入新密码 + 确认 → 点"确认重置"
- [ ] 切到"密码已重置 ✓"成功态
- [ ] 点"去登录"回 auth.html
- [ ] 用**新密码**能登上
- [ ] 再次点击同一个 dev 链接 → 显示"链接已失效"错误态（token 单次消费）

**边界**：
- [ ] 不存在的邮箱调 forgot → 仍返回"已发送"（防枚举 · 无 devToken）
- [ ] 6 位以下新密码 → 400

---

### B.3 · 加入班级

- [ ] 新注册一个学员账号
- [ ] 登录后 home.html 顶部显示 `+ 加入班级` 引导卡（非班级信息）
- [ ] 点卡 → `join-class.html`
- [ ] 试无效码 `ABCXYZ` → 红色"邀请码无效或班级已归档"
- [ ] 输入 admin 给的真实班级码（先在 admin 端建一个测试班）
- [ ] 成功后页面内显示绿色预览卡 + 按钮文案改"进入班级 →"
- [ ] 点进 `class-detail.html` 能看到自己已是成员
- [ ] 回 home.html：引导卡消失 · 班级名卡显示

---

### B.4 · SM-2 间隔复习

- [ ] 用一个有答题记录的账号登录
- [ ] home 顶部若有待复习题，会显示金色"今日待复习 N 题"卡片
- [ ] 点卡进 `sm2-review.html`
- [ ] 看到题干 + "显示答案"按钮
- [ ] 点"显示答案" → 绿框显示参考答案 + 红框显示常见误区
- [ ] 下方出现 4 个评分按钮（重来 / 困难 / 良好 / 简单）· 每个下方有预估间隔
- [ ] 点"良好" → 进下一题 · 进度条前进
- [ ] 点"重来" → 本题被追加到队尾 · 本轮会再次见到
- [ ] 全部评完 → 显示"本轮复习已完成 + 共复习 N 题"

**桌面键盘**（仅桌面浏览器）：
- [ ] 空格键 = 显示答案
- [ ] 1/2/3/4 = 四档评分

**空态**：
- [ ] 清新账号无到期题 → 显示"今日已复习完毕"

---

### B.5 · 收藏系统

- [ ] 进 `quiz.html?lessonId=xxx` 开始答题
- [ ] 题卡右上角灰色星形按钮
- [ ] 点击 → 变金色填充态
- [ ] 继续答完题
- [ ] 回 home → 快速入口"收藏"不再是 soon 灰色 · 点击进 `favorites.html`
- [ ] 列表里能看到刚收藏的题
- [ ] 点"取消收藏" → 条目消失 · 若为最后一条显示空态
- [ ] 重新进 quiz 看这题 → 星应是灰色（已取消）

---

### B.6 · 法律 / 帮助页

- [ ] 登录后进 profile → 设置 → 关于 section
- [ ] 4 个 row 都是 `<a>` 链接：
  - [ ] 关于觉学 → about.html 加载正常
  - [ ] 帮助与反馈 → help.html 加载正常
  - [ ] 用户协议 → terms.html 加载正常
  - [ ] 隐私政策 → privacy.html 加载正常
- [ ] terms / privacy 顶部有 `⚠️ 本文档为上线前占位模板` 警示
- [ ] 每页返回按钮都能回 settings.html

---

### B.7 · 响应式铺满验证

- [ ] 桌面浏览器（> 480px 宽）：内容居中成 480px 列 · 两侧米色背景 · 无圆角手机壳
- [ ] 手机浏览器：内容铺满整屏 · 无 480 限宽 · 无假 iOS 状态栏
- [ ] 任意页面控制台运行 `document.body.classList.add('prototype-frame')` → 回到样机视觉（375×812 + 圆角 + 阴影）
- [ ] 刷新后 `prototype-frame` 不会自动加回（仅临时切换）

---

## Phase C · 后端端点覆盖缺口（8 步 · 需补自动化测试）

> 这些端点**存在但零集成测试**。建议按模块一个一个补。每步产出一个新 `tests/integration/xxx.test.ts`。

- [ ] **C.1** · Classes 模块 · `/api/classes/join` + `/api/classes/:id/leave` + `/api/my/classes` · 覆盖幂等 join / 重复 join / leave 软删 / 越权
- [ ] **C.2** · SM-2 · `/api/sm2/due`(验证新 answerReveal 字段)+ `/api/sm2/review` 写回 + `/api/sm2/stats` 聚合
- [ ] **C.3** · Favorites · POST / DELETE / GET · 幂等 add · 不存在题的 404 · 越权
- [ ] **C.4** · Mistakes · list + detail + 答对后从错题移除 · 越权
- [ ] **C.5** · Reports · 学员报题 · coach review 流
- [ ] **C.6** · Enrollments · `/api/my/enrollments` · `/api/courses/:slug` overlay
- [ ] **C.7** · Admin audit · `/api/admin/audit?adminId=&action=&targetType=` 过滤 + 游标
- [ ] **C.8** · Admin LLM · 供应商切换 · 熔断触发 · 配额溢出

---

## Phase D · 从未跑过的产品 / 安全场景（6 步）

- [ ] **D.1** · 真 LLM 调用 · 上 MiniMax API key → 开放作答题走 AI 评分 → 故意写错误答案看是否低分
- [ ] **D.2** · LLM 兜底切换 · 故意拿掉 MiniMax key 或注入错误 → 验证 Claude 接替 · response 含 `switched=true`
- [ ] **D.3** · 班级壁垒越权 · coach A 用 token 调 `/api/coach/classes/<classB_id>/students` → 期望 403
- [ ] **D.4** · 改密 / 重置密码 Session 吊销 · 浏览器 X 登录,浏览器 Y 也登录同账号,在 Y 改密,X 下次请求应 401
- [ ] **D.5** · 注销账号数据保留 · 注销后 `SELECT * FROM "UserAnswer" WHERE "userId"=?` 仍应有记录(脱敏但保留)
- [ ] **D.6** · 并发 refresh race · 2 个 tab 同一账号 · 同时触发 401 → 只应发一个 `/api/auth/refresh` 请求(fix in `00a31ba`)

---

## Phase E · 非功能项(5 步 · 上生产前必过)

- [ ] **E.1** · nginx 强制 HTTPS + HSTS 头 · curl `-I http://juexue...` 应 301 到 https
- [ ] **E.2** · `CORS_ORIGINS` 白名单 · 非白名单域调 API 应被浏览器 preflight 拒绝
- [ ] **E.3** · 限流(目前**完全未实现**)· 决定是否在上线前补 `@fastify/rate-limit` · 否则注册 / forgot / login 可被轰炸
- [ ] **E.4** · SMTP 邮件服务(目前**完全未实现**)· 忘记密码 token 目前只打 dev 日志 · 生产前必须接 SendGrid / 阿里云邮件推送 / 腾讯云 SES
- [ ] **E.5** · 数据库连接池压测 · ab / k6 打 100 QPS 5 分钟 · 看是否 leak connection 或 502

---

## Appendix · 已知没做的功能(不算未测试 · 不在本清单内)

这些是**功能没实现**，不是"实现了没测"，请勿归入测试任务：

- 5 个题型渲染器 sort / match / flip / flow / guided(留给 Batch 1)
- Onboarding 3 屏 · admin audit 查看页 · admin LLM 面板(留给 Batch 5)
- Toast 组件统一 · 骨架屏 · 空状态插画 · 下拉刷新(留给 Batch 4/6)
- 月份数组 i18n(留给 Batch 4)
- 笔记系统 · 搜索 · 离线下载(Wave 3)
- VerseFavorite 经句收藏(scripture-reading 的"笔记"按钮现在仍是 soon 占位)
- 退班入口 · `/api/classes/:id/leave` 冷端点(可挂 class-detail 页底)

---

## 执行建议

1. **先做 Phase A 全部 4 步** · 这是部署是否成功的门槛 · 任何一步卡住都别碰后面
2. 再做 **Phase B.1 + B.2** · 是最小冒烟测试 · 30 分钟
3. 剩下 B.3-B.7 按用户场景优先级挑
4. Phase C / D / E 可以并行交给同事或留到 QA 阶段 · 跟下一次 code push 捆绑

**每步完成后把前面的 `[ ]` 改成 `[x]`。卡住的贴错给我。**
