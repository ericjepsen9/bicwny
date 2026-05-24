# 班级体系设计方案 · 2026-05-04

> 状态：✅ 决策定型 · 暂未实施
>
> 触发场景：App Store 来的独立学习用户不知道班级功能 · 需要让他们能浏览班级 +
> 主动申请加入；辅导员也可以反向邀请用户。

---

## 一、最终决策

| # | 决策项 | 值 |
|---|---|---|
| 1 | `Class.discoverable` 默认值 | **true**（新建班级自动公开）|
| 2 | 多班级在「我的」页展示形式 | **collapse**（默认显示主班 + 展开按钮）|
| 3 | 辅导员邀请搜索范围 | **全平台注册用户** |
| 4 | 公开目录是否对未登录可见 | **否**（必须登录）|
| 5 | 辅导员不审核策略 | 暂时放着 · 不自动过期 |
| 6 | 学生可加入多班级 | 是（数据模型已支持）|
| 7 | 班级封面 | 加 `coverImageUrl` 字段（同法本封面流程）|

---

## 二、数据模型变更

### 2.1 Class 表新增字段

| 字段 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `discoverable` | boolean | `true` | 是否在公开目录显示 |
| `requireApproval` | boolean | `true` | 是否需要审核（false = 申请直接通过）|
| `maxMembers` | int? | `null` | 容量上限（null = 无限）|
| `coverImageUrl` | string? | `null` | 多尺寸 webp（同法本封面）|
| `description` | string? | `null` | 已有 |

### 2.2 新表 `ClassJoinRequest`（学生申请）

```prisma
model ClassJoinRequest {
  id          String   @id @default(cuid())
  userId      String
  classId     String
  message     String?              // 学生留言
  status      String   @default("pending")  // pending | approved | rejected
  reason      String?              // 辅导员拒绝理由
  createdAt   DateTime @default(now())
  decidedAt   DateTime?
  decidedById String?              // 审核辅导员 id

  user      User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  class     Class @relation(fields: [classId], references: [id], onDelete: Cascade)
  decidedBy User? @relation("DecidedRequests", fields: [decidedById], references: [id])

  @@unique([userId, classId])      // 不能重复申请同班
}
```

### 2.3 新表 `ClassInvitation`（辅导员邀请）

```prisma
model ClassInvitation {
  id          String   @id @default(cuid())
  classId     String
  inviterId   String              // 发邀请的辅导员
  inviteeId   String              // 被邀请的用户
  message     String?
  status      String   @default("pending")  // pending | accepted | declined
  createdAt   DateTime @default(now())
  respondedAt DateTime?

  class   Class @relation(fields: [classId], references: [id], onDelete: Cascade)
  inviter User  @relation("SentInvitations", fields: [inviterId], references: [id])
  invitee User  @relation("ReceivedInvitations", fields: [inviteeId], references: [id], onDelete: Cascade)

  @@unique([classId, inviteeId])  // 不重复邀请同人
}
```

### 2.4 现有 ClassMember 不变
学生可加多个班级（多条 ClassMember 记录）。role: `coach | student`。

---

## 三、API 设计

### 3.1 学生端 `/api/`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/classes/discover?courseId=&search=` | 公开班级目录（仅 `discoverable=true`）|
| GET | `/api/classes/:id` | 班级详情（已有，加 `isApplied / isInvited / isMember` 状态字段）|
| POST | `/api/classes/:id/apply` | 申请加入 `{ message? }` |
| DELETE | `/api/classes/:id/apply` | 撤回未审核的申请 |
| GET | `/api/my/applications` | 我的申请历史 |
| GET | `/api/my/invitations` | 我收到的邀请 |
| POST | `/api/invitations/:id/accept` | 接受邀请 |
| POST | `/api/invitations/:id/decline` | 拒绝邀请 |
| POST | `/api/classes/join` | 邀请码加入（已有 · 兼容保留）|

### 3.2 辅导员端 `/api/coach/`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/coach/classes/:id/applications?status=pending` | 待审核申请列表 |
| PATCH | `/api/coach/applications/:id` | 审核 `{ approve, reason? }` |
| POST | `/api/coach/classes/:id/invite` | 邀请用户 `{ inviteeId, message? }` |
| GET | `/api/coach/classes/:id/invitations?status=pending` | 已发出的邀请 |
| DELETE | `/api/coach/invitations/:id` | 撤回邀请（仅 pending）|
| PATCH | `/api/coach/classes/:id/settings` | 改 discoverable / requireApproval / maxMembers |
| POST | `/api/coach/classes/:id/cover` | 上传封面（同 admin courses cover 流程）|
| GET | `/api/coach/users/search?q=&excludeClassId=` | 搜索可邀请的用户（全平台 + 排除已在班的）|

### 3.3 通知（4 类）
- `class_application_new` → 通知辅导员（学生申请了）
- `class_application_approved` → 通知学生（你被通过了）
- `class_application_rejected` → 通知学生（你被拒了 + 理由）
- `class_invitation_new` → 通知学生（辅导员邀请你）

---

## 四、前端页面

### 4.1 学生端

#### `/class-discover` 公开班级目录（新页）
- 入口：「我的」→ menu「加入班级 📚 [推荐]」
- 顶部搜索 + 法本筛选
- 班级卡：封面 + 名字 + 法本 + 辅导员 + 成员数 + 描述 + CTA
- CTA 状态：申请加入 / 待审核 / 已加入 / 已满
- 底部：「输入邀请码加入私密班级」入口

#### 申请 sheet（点「申请加入」弹出）
- 班级摘要（辅导员 / 法本 / 成员）
- 留言输入框（可选）
- [取消] [确认申请]

#### `/profile/applications` 我的申请记录（新页）
- 三 tab：待审核 / 已通过 / 已拒绝
- 拒绝的可以「再次申请」

#### `/profile/invitations` 收到的邀请（新页）
- 「我的」页 menu 加红点 badge
- 邀请卡：辅导员 + 班级 + 留言
- [接受] [拒绝]

#### 「我的」页改造
- 加入班级行 → 跳 `/class-discover`
- 加入班级行右侧加 saffron chip 「推荐」
- 我的班级行 collapse 模式：默认显示主班 + 展开 (还有 N)
- 收到邀请时菜单加红点 badge

### 4.2 辅导员端

#### `/coach/classes/:id` 班级页改造
- 顶部 tab：班级信息 / 成员 / **待审核 (N)** / **已发邀请**
- N > 0 时红点

#### 待审核申请列表
- 申请人卡：dharmaName + 邮箱状态 + 答题统计 + 留言 + 申请时间
- [拒绝（内联输理由）] [通过]

#### 邀请用户 sheet
- 全平台用户搜索（dharmaName / email）
- 选中 → 留言（可选）→ [发出邀请]
- 已邀请用户列表（pending）+ 撤回按钮

#### 班级设置 sheet
- 公开发现 [开关 · 默认 true]
- 需要审核 [开关 · 默认 true]
- 容量上限 [输入框]
- 班级封面 [点击替换]
- 描述 textarea

---

## 五、首页设计（按用户状态）

### 状态 A · 全新用户（0 班级）
显眼的「加入班级」引导卡（saffron-pale + saffron 描边 CTA）：

```
🎓 一起学习更有动力
✦ 同修打卡互相督促
✦ 辅导员答疑指点
✦ 班级排行良性激励
[ 浏览班级 → ]
```

### 状态 B · 有未读邀请（高优先级）
邀请提示卡置顶（gold-pale 醒目）：
```
🎓 张老师邀请你加入「大圆满前行精进班」
[ 查看详情 → ]   [ 稍后再说 ]
```

### 状态 C · 已加入 1 班（最常见态）
班级卡：
```
🎓 大圆满前行精进班
辅导员: 张老师 · 12 名同修
📊 今日已打卡: 9/12
🔔 1 条未读公告
[ 进入班级 → ]
```

### 状态 D · 已加入多班（>1）
状态 C 基础上加 `[切换 →]` 链接（右上）→ 弹底部 sheet 列出所有班级，
sheet 底部「浏览更多班级」入口顺势引导。

主班级 = localStorage `jx-main-class-id`（与 `jx-main-course-id` 同款本地偏好）。

### 班级卡显示的动态数据（按重要性）
| 数据 | 来源 | 显示条件 |
|---|---|---|
| 今日 N/总人数 已打卡 | 后端聚合 | 总是 |
| 我的班内排名 | 后端聚合 | 班级 ≥ 5 人时 |
| 未读公告数 | unread count | > 0 时 |
| 辅导员名字 | Class.coach.dharmaName | 总是 |
| 总成员数 | Class.memberCount | 总是 |

后端补 `GET /api/my/classes/:id/dashboard`，一次返回这些数据。

---

## 六、视觉/交互细节

### 班级卡（在目录里）
```
┌──────────────────────────────────┐
│ ┌──┐                             │
│ │🪷│ 大圆满前行精进班       12/30 │
│ └──┘ 大圆满前行 · 张老师         │
│ 每周共修两次 · 系统答题精进...    │
│              [ 申请加入 → ]      │
└──────────────────────────────────┘
```
- 封面：60×60 圆角小方图（无图回退到 emoji 大字）
- 状态变体：已加入 / 待审核 / 已满

### 拒绝交互
拒绝按钮点击 → 内联展开「拒绝理由」输入框（可选）→ 确认。

### 邀请通知
学生端通知中心：
```
🎓 张老师邀请你加入
  「大圆满前行精进班」
  "看到你最近答题很积极..."
       [ 查看详情 ]
```

---

## 七、落地分期

### Phase A · MVP 闭环（推荐先做）~2 天
1. Prisma schema 扩展（Class 字段 + 两张新表）
2. 学生端：`/class-discover` 公开目录页 + 申请 sheet + 我的申请记录
3. 辅导员端：班级页加「待审核」tab + 审核交互
4. 通知：申请提交 / 通过 / 拒绝 三类通知
5. 「我的」页改造（推荐 chip + 入口跳目录页）

### Phase B · 双向邀请 ~1 天
6. 辅导员端：邀请用户 sheet（搜索 + 留言 + 发出）
7. 学生端：收到的邀请页 + 接受/拒绝
8. 通知：辅导员邀请通知

### Phase C · 班级管理 + 封面 ~1 天
9. 辅导员班级设置 sheet
10. 班级封面上传（sharp 多尺寸 webp）
11. 公开目录显示封面图
12. ClassDetailPage 展示封面

### Phase D · 体验完善（可选）
- 申请历史 tab 化
- 邀请历史 / 撤回
- 班级满员 UI / waitlist
- 班级"指定本周课时"联动法本卡

---

## 八、首页实现要点

### 班级卡组件抽离
- `<ClassCardCurrent>` — 状态 C/D 用，需要 dashboard 数据
- `<ClassDiscoverCard>` — 状态 A 用，引导加入
- `<InvitationBanner>` — 状态 B 用，邀请提示

### 状态判定逻辑
```ts
const myClasses = useMyClasses();        // 已加入的班级
const invitations = useMyInvitations();  // pending 邀请

if (invitations.length > 0) → 状态 B
else if (myClasses.length === 0) → 状态 A
else if (myClasses.length === 1) → 状态 C
else → 状态 D
```

### 主班级选择
- localStorage `jx-main-class-id`
- 默认 = 最近 lastVisitedAt 那个
- 用户可在 sheet 里改

---

## 九、开始实现命令

需要做的时候说：「开始 Phase A 班级体系」。
