# 功课计数体系设计方案 · 2026-05-04

> 状态：✅ 决策定型 · 暂未实施
>
> 触发场景：管理员/辅导员给学员布置功课（如观音心咒 1000 遍 / 每周观修 3 座），
> 学员在 app 填写完成情况，部分功课可与观修/阅读/答题数据自动联动。

> **依赖文档**：通知规则引擎见 `docs/NOTIFICATION_PLAN.md`（功课截止提醒走该规则系统）。

---

## 一、产品定位

| 受众 | 价值 |
|---|---|
| 学员 | 每日打开 app 知道"今天该做什么"·记一笔即完成·培养修行习惯 |
| 辅导员 | 给班级布置功课·看完成度矩阵·针对性指导落后学员 |
| 管理员 | 平台级功课·关联法本·运营级引导 |

---

## 二、功课的 5 大形态

| 类型 | 单位 | 数据源 | 例子 |
|---|---|---|---|
| 念诵计数 | 遍 | 手动 | 观音心咒 1000 遍 |
| 观修次数 | 座 | **自动**（观修方案落地后）| 每周观修 3 座 |
| 阅读 | 课/章 | **自动** | 本周读完第 5 章 |
| 答题 | 题 | **自动** | 完成 50 道题 |
| 自由打卡 | 自定义 | 手动 | 大礼拜 100 个 / 念佛 30 分钟 / 行善 1 件 |

---

## 三、3 种周期模式

| frequency | 重置规则 |
|---|---|
| `once` | 累计到目标即完成·不重置 |
| `daily` | 每日 24:00 重置 |
| `weekly` | 每周日 23:59 重置 |
| `monthly` | 每月末重置 |
| `custom` | 指定 startDate / endDate 范围 |

---

## 四、3 类布置者（scope）

| scope | 谁布置 | 谁能看到 |
|---|---|---|
| `platform` | 管理员 | 全平台用户 / 加入特定法本者 |
| `class` | 辅导员 | 该班级成员 |
| `personal` | 用户自己 | 仅自己（self-discipline）|

---

## 五、数据模型

```prisma
model Assignment {
  id          String   @id @default(cuid())

  // 布置方
  assignerId  String
  scope       String                      // platform | class | personal
  classId     String?

  // 关联（限定接收者）
  courseId    String?                     // 仅加入此法本者收到
  lessonId    String?                     // 关联具体课时

  // 内容
  title       String
  titleTraditional String?
  description String?

  // 类型 + 计量
  taskType    String                      // mantra | meditation | reading | quiz | custom
  unit        String                      // 遍 | 座 | 课 | 题 | 次 | 分钟（展示用）
  targetCount Int                         // 目标数

  // 周期
  frequency   String                      // once | daily | weekly | monthly | custom
  startDate   DateTime  @default(now())
  endDate     DateTime?

  // 自动数据源
  autoSource  String?                     // null | meditation | reading | quiz
  autoFilter  Json?                       // { courseId, lessonId, minDuration } 等过滤

  // 元数据
  isPublished Boolean  @default(true)
  isMandatory Boolean  @default(false)
  displayOrder Int @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  archivedAt  DateTime?

  records     AssignmentRecord[]
  assigner    User      @relation("AssignedBy", fields: [assignerId], references: [id])
  class       Class?    @relation(fields: [classId], references: [id], onDelete: Cascade)
  course      Course?   @relation(fields: [courseId], references: [id])

  @@index([classId])
  @@index([assignerId])
  @@index([scope, isPublished])
}

model AssignmentRecord {
  id           String   @id @default(cuid())
  assignmentId String
  userId       String

  count        Int                       // 本次记录数量
  recordDate   DateTime                  // 归属哪一天（精度日）
  notes        String?

  source       String   @default("manual")  // manual | auto
  sourceRef    String?                   // 如 meditation_session_id

  createdAt    DateTime  @default(now())

  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  assignment  Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  @@index([userId, assignmentId, recordDate])
  @@index([assignmentId, recordDate])
}
```

---

## 六、学生端 UI

### 入口位置

| 位置 | 显示条件 | 内容 |
|---|---|---|
| **首页** 顶部置顶 | 有未完成功课 | "今日功课"卡 · 进度概览 · 限 3 条 |
| **班级页** | 已加入班级 | "班级功课"卡 · 辅导员布置的 |
| **我的** 菜单 | 总是 | 「我的功课」入口 + 红点 |
| **复习页 / 修学页** | 总是 | 自由设定的个人目标区 |

### 「我的功课」总览页 `/assignments`

```
[← 返回]   我的功课

[ 进行中 (5) ] [ 已完成 ] [ 全部 ]

═══ 班级功课 (来自 张老师) ═══

🪷 本周观修 3 座
weekly · 周二 - 周日
●●● ░░░ 1/3
       [+1]   或   [手动记录]

🌸 观音心咒 1000 遍
once · 5/1 - 5/31
█████████░ 850/1000
              [ +1 ] [ +10 ] [ +50 ] [ +108 ]

═══ 法本功课 ═══

📿 每日念诵《入行论》偈颂 30 遍
daily · 已发布 12 天
今日 ░░░░░░░░░░░ 0/30
                   [ + 记录 ]
本周累计 180 遍 / 目标 210 遍

═══ 我的目标（自定义）═══

🪞 每日礼拜 21 个
daily
今日 ████████░░░ 18/21
[ + 记录 ]   [ 编辑 ]

[ + 添加我的功课 ]
```

### 功课详情页 `/assignments/:id`

- 大标题 + 描述 + 布置方
- 进度可视化（累计 X/目标 + 百分比 + 周期）
- "记一笔" + 快捷按钮（+1 / +10 / +50 / +108 / 自定义）
- 历史记录列表（当日内可改 · 自动 record 标记 🔒 不可改）
- 自动数据源标识（"3 次观修自动计入"）
- 月趋势柱状图

### 「记一笔」交互

```
+ 记录
┌───────────────────────────────┐
│  +1   +10   +50   +108        │
│                               │
│  [自定义数量 ____]            │
│                               │
│  日期：今天  [改]              │
│  备注：(选填)                  │
│                               │
│  [ 取消 ]  [ 确认 ]            │
└───────────────────────────────┘
```

---

## 七、辅导员端 UI

### 班级功课列表 `/coach/classes/:id/assignments`

```
[班级信息] [成员] [📥 待审核] [📋 功课]   ← 新 tab

[ + 新建功课 ]

进行中
🌸 观音心咒 1000 遍 · 5/1 - 5/31
   完成度：8/12 学员达标 · 4 人未完成
   平均完成 78% · [ 详情 ] [ 编辑 ]

🪷 本周观修 3 座 · 自动计入
   完成度：5/12 学员达标 · 周日重置
   [ 详情 ] [ 编辑 ]
```

### 新建功课表单

字段：
- 类型（念诵/观修/阅读/答题/自定义）
- 标题 + 单位 + 目标数
- 周期（once/daily/weekly/monthly/custom）+ 起止日期
- 关联法本/课时（可选）
- 自动计入开关 + 数据源
- 描述（可选）
- 必修/选修标记

### 班级功课进度详情

```
观音心咒 1000 遍 · 5/1 - 5/31

班级总进度
█████████░ 89% (累计 10670 / 12000 班级目标)

成员进度
学员 A   ██████████ 1000/1000 ✓
学员 B   █████████░ 920/1000
学员 C   █████████░ 850/1000
学员 D   █░░░░░░░░░ 100/1000  落后
学员 E   ░░░░░░░░░░ 0/1000    未开始

[ 提醒未完成的学员 ]   ← 触发 NOTIFICATION_PLAN 中的规则
```

点单学员 → drill-down 看 ta 的每日记录详情。

---

## 八、管理员端 UI

类似辅导员 · 作用域为**全平台 / 法本级**：

```
/admin/assignments

平台功课
🌸 入行论 · 每位学员完成全本阅读
   关联：入行论 · 加入此法本者全员收到
   完成：234/580 用户  · [ 详情 ]

🪷 大圆满前行 · 共修打卡每日 1 次
   关联：大圆满前行 · 周期：daily
   今日完成：145/420  · [ 详情 ]
```

---

## 九、自动数据源对接

### 触发流程

```ts
// 观修完成时
async function onMeditationCompleted(session: MeditationSession) {
  const matching = await prisma.assignment.findMany({
    where: {
      autoSource: 'meditation',
      // 用户匹配（按 scope）
      OR: [
        { scope: 'platform' },
        { scope: 'class', class: { members: { some: { userId: session.userId } } } },
        { scope: 'personal', assignerId: session.userId },
      ],
      isPublished: true,
      startDate: { lte: new Date() },
      OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      ...autoFilterToWhere(autoFilter, session),
    },
  });

  for (const a of matching) {
    await prisma.assignmentRecord.create({
      data: {
        assignmentId: a.id,
        userId: session.userId,
        count: 1,
        recordDate: startOfDayUserTz(),
        source: 'auto',
        sourceRef: session.id,
      },
    });
  }
}
```

### 类似 hook 的位置

| 触发点 | 自动 +1 的功课 |
|---|---|
| MeditationSession 完成 | autoSource=meditation 且 filter 匹配 |
| 课时阅读完成（lessonsCompleted 新增）| autoSource=reading 且 filter 匹配 |
| 答题 isCompleted=true | autoSource=quiz 且 filter 匹配 |

### autoFilter 灵活规则

```json
{
  "courseId": "xxx",        // 仅这个法本
  "lessonId": "yyy",        // 仅这个课时
  "minDuration": 600        // 至少 10 分钟才算一座
}
```

---

## 十、首页 / 班级页 功课卡

### 首页置顶（有未完成时）

```
📋 今日功课                  3/5 已完成

🌸 观音心咒 1000 遍   ████████░░ 80%
🪷 本周观修 3 座      ███░░░ 1/3
📿 每日礼拜 21 个     ███████ 18/21

[ 全部 → ]
```

### 班级页

```
🎓 大圆满前行精进班

📋 班级功课
观音心咒 1000 遍   ████████░░ 850/1000  ← 你的进度
本周观修 3 座      ●●○                  ← 你 1/3 · 班级 5/12

[ 班级排行 → ]   [ 我的全部 → ]
```

### 班级排行（可选 · 班级设置可关）

```
📋 班级排行 · 观音心咒 1000 遍

🥇 学员 A     1000/1000 ✓
🥈 学员 B      950/1000
🥉 学员 C      900/1000
你（第 5）     820/1000
学员 D         750/1000
```

---

## 十一、API 设计

### 学生端

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/my/assignments?status=active` | 我的功课 |
| GET | `/api/assignments/:id` | 功课详情 + 我的进度 + 历史 |
| POST | `/api/assignments/:id/records` | 记一笔 |
| PATCH | `/api/records/:id` | 编辑当日记录 |
| DELETE | `/api/records/:id` | 删除记录 |
| POST | `/api/assignments` | 创建个人功课 (scope=personal) |

### 辅导员端

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/coach/classes/:id/assignments` | 班级功课列表 |
| POST | `/api/coach/classes/:id/assignments` | 新建班级功课 |
| PATCH | `/api/coach/assignments/:id` | 编辑功课 |
| DELETE | `/api/coach/assignments/:id` | 撤回功课 |
| GET | `/api/coach/assignments/:id/progress` | 班级完成情况矩阵 |
| GET | `/api/coach/assignments/:id/users/:userId` | 单学员详情 |
| POST | `/api/coach/assignments/:id/notify-incomplete` | 触发未完成提醒（走 notification 规则）|

### 管理员端

类似 coach · 路径 `/api/admin/assignments` · scope=platform。

---

## 十二、与观修方案协同

观修 Phase 1 落地后：
- 创建功课时可选 `autoSource=meditation`
- 用户每观修一次自动 +1 座
- 班级"每周观修 3 座"完全自动化

观修未实现前：
- 功课依然能用（手动模式）
- 观修类型 disabled · 显示"待观修功能上线后启用"

---

## 十三、决策定型清单

| # | 决策项 | 值 |
|---|---|---|
| 1 | 个人功课（自设目标）| ✓ 允许 |
| 2 | 班级排行默认 | ✓ 默认开 · 班级设置可关 |
| 3 | 自动计入功能默认 | ✓ 默认开 · 用户可关 |
| 4 | 历史记录可编辑窗口 | 当日内 |
| 5 | 必修功课未完成 | 仅显示提醒 / 排行末尾 · 不惩罚 |
| 6 | 图片证明上传 | Phase 2 加 · MVP 纯数字 |
| 7 | 功课提醒推送 | ✓ 走 NOTIFICATION_PLAN 规则系统 |
| 8 | 视觉风格 | 进度条 + 数字 · 念珠图标作辅助装饰 |

---

## 十四、技术风险

1. **Records 数据量**
   - 1000 用户 × 5 功课 × 每日 = 1500/天 = 50万/年
   - 必备：(userId, assignmentId, recordDate) 复合索引
   - 历史归档：>1 年记录可压缩存

2. **自动 vs 手动冲突**
   - 自动 record 用 sourceRef 唯一标识 · 防重复
   - 手动 record 不限次数
   - 计算总数按 record 数量加和

3. **时区问题**
   - recordDate 按**用户本地日期**（user.timezone IANA 格式）
   - 前端发送日期串而非 UTC
   - 详见 NOTIFICATION_PLAN

4. **班级排行性能**
   - 100+ 人班级聚合 SUM 慢
   - 缓存 5 分钟
   - 或者维护 `class_assignment_progress` 物化视图

---

## 十五、落地分期

### Phase 1 · MVP 闭环（3-4 天）
1. Prisma：Assignment + AssignmentRecord
2. 学生端：`/assignments` 列表 + 详情 + 记一笔
3. 辅导员端：班级 [📋 功课] tab + 新建 + 进度矩阵
4. API：学生 + 辅导员两端 CRUD
5. 首页 / 班级页"今日功课"卡

### Phase 2 · 自动化 + 增强（2 天）
6. 自动数据源对接 hook（阅读/答题完成时触发）
7. 观修 autoSource（依赖观修方案 Phase 1）
8. 班级排行
9. 功课提醒推送（走 NOTIFICATION_PLAN）

### Phase 3 · 深度（按需）
10. 管理员平台级功课
11. 图片证明上传
12. 趋势图表
13. 功课模板（一键创建常见功课）
14. 功课成就徽章

---

## 十六、需要时唤起

实施时告诉我：「**开始 Phase 1 功课计数**」。
