# 09 · API 契约 & 页面/交互设计（SoT 第三层）

> 状态：WIP（2026-06-01 起草）· 本文档是**能力批量推进**，每批与产品负责人核对后追加
> 定位：补齐权威档缺失的「**API 契约层 + 页面/交互层**」——05 战略 / 02 权限 / 06 业务能力 / 08 数据层之后的第三层（报告 04 WP-A 决策点：用户已拍板「补进 SoT」）
> 范围：能力 1-25（与 06 同步）；社交 22-24 / AI 25 / 徽章 38 仅「后台关键部分」契约，不做正式 UI（DR-145）

## 基线来源（三份对齐，不凭空造）
| 来源 | 角色 | 用法 |
|---|---|---|
| `audit/05-api-endpoints.md` | 线上**现状** 139 端点 / 26 模块 | 能复用就复用，标 ✅ |
| `FINAL_DESIGN_SANSUSHENG.md` §三/§四 | **旧设计**（只读参考·早于 08 的 98 轮） | API 模块划分 + 页面路由的起点，需与 08 对齐后标 🔧/🆕 |
| `08-merged-design.md` | **当前权威表设计** | 字段/约束/权限以此为准，凡与旧档冲突以 08 为准 |

## 通用约定

### 1. 守卫角色（对齐 02 / 03 §8，替代旧三元 admin/coach/student）
`super_admin`（平台配置）· `subject_admin`（学科范围）· `class_admin`（班级管理）· `class_tutor`（辅导）· `student`（学员）· `public`（无守卫）
> 现状 42 处 `admin` 守卫按操作性质分流到 super/subject/class（audit/05 改造提示）。

### 2. 标注图例
✅ 复用现状端点/页面 · 🔧 改造（权限或字段变更） · 🆕 新增 · ⏸ 暂缓（建表+后台、不做正式 UI）

### 3. 每能力条目模板
```
## 能力 X · 名称
- 涉及表（08 落点）
- API 契约：| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
- 页面/交互：| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
- 三端可见性（学员 / 辅导员 / admin 各看到什么）
- 大纲 & DR 关联 + 对齐备注（与旧档/现状的差异、报告 03/04 缺口的体现）
```

### 4. 推进批次（待你确认后据此逐批产出）
- 批 1：能力 1-2（专业配置 + 入班）← **本次样例做能力 1**
- 批 2：能力 3/37/39（闻思 + 阅读器 + 音视频）
- 批 3：能力 4/6/7（实修打卡）
- 批 4：能力 8/9（共修 + 报数）
- 批 5：能力 10/11（考试升学 + 留级）
- 批 6：能力 5/12/13/14/15/17/18/19/20（管理·关怀·传承·权限·审计）
- 批 7：能力 21（自学）+ 26-51（净资产层 API/页面盘点）
- 批 8：能力 22-25/38（后台关键部分契约）

---

## 能力 1 · 阶段与专业体系  〔样例·待格式确认〕

### 涉及表（08 落点）
`Program`（§1.1，🆕 线上无）· `ProgramSemester` / `ProgramWeek` / `ProgramStudyType`（复用）· `ProgramAdvancementConfig`（§3.1，升学条件配置）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/admin/programs` | super_admin | `?stage&isActive&cohortYear` | `Program[]`（含 semesters 计数） | 🆕 | 专业列表（现状线上无，旧档 FINAL_DESIGN 有 `/api/programs`） |
| POST | `/api/admin/programs` | super_admin | `{name,code,cohortYear,stage,description?,lag*Threshold?,checkinGraceMinutes?}` | `Program` | 🆕 | 建专业；`@@unique(code,cohortYear)` 冲突→409 |
| PATCH | `/api/admin/programs/:id` | super_admin | 同上可选字段 | `Program` | 🆕 | 改专业；已上线专业的关键配置改动需二次确认（能力1绝对约束3） |
| POST | `/api/admin/programs/:id/deactivate` | super_admin | — | `{isActive:false}` | 🆕 | 停用（**无 delete API**，D18）；停用后禁建关联班级 |
| GET | `/api/admin/programs/:id/advancement-configs` | super_admin / subject_admin | — | `ProgramAdvancementConfig[]` | 🆕 | 读该专业升学条件（6 类） |
| PUT | `/api/admin/programs/:id/advancement-configs` | super_admin / subject_admin | `ProgramAdvancementConfig[]` | 同上 | 🆕 | 配置升学条件（合格线/门槛/弥补量，数据驱动 D3） |
| GET | `/api/programs/mine` | student | — | `Program[]`（学员所属专业精简视图） | 🔧 | 学员只读自己所属专业（名称/阶段/届/课表基准），**不含管理配置** |

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| admin | `/admin/programs` | 科系配置页：专业列表（按 stage/届筛选）+ 新建/编辑/停用 | 停用走二次确认；停用专业灰显不可建班 | 🆕（旧档 admin「科系」页为起点） |
| admin | `/admin/programs/:id` | 专业详情：基础信息 + 学期(ProgramSemester) + 升学条件配置(6 类) + 掉队阈值/签到宽限 | 升学条件按 conditionType 分组编辑；改已上线专业提示影响面 | 🆕 |
| 学员 | （无独立页） | 所属专业信息嵌入「我的」/班级页顶部（专业名·届·本周进度基准） | 只读 | 🔧 |

### 三端可见性
- **学员**：只读自己所属专业的名称/阶段/届/课表基准线；看不到任何配置项、掉队阈值、升学条件数值。
- **辅导员/班级管理员**：只读本班所属专业；class_admin 可读升学条件（用于解释升学预检），不可改。
- **super_admin**：建/改/停用专业、配置升学条件（subject_admin 在本学科范围内可配升学条件）。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **A1**（4 专业×8 学期）、支撑 **F1-F5**（升学条件配置）；D2（两级固定）/D3（可配置）/D12（super_admin 全局）/DR-130（Program 定名）。
- **对齐备注**：① 现状线上 Class 仅 `name` 字符串、无 programs 管理端点 → 全套 🆕；旧档 `/api/programs` CRUD 可作起点，但字段以 08 §1.1 为准（新增 stage/cohortYear/lag 四阈值/checkinGrace）。
- **✅ 决策 A3（2026-06-01 拍板·采纳报告 03 建议）选专业第2学期锁定**：补 `ProgramSemester.isSelectionDeadline`（标记该专业的「选专业截止学期」，默认 S2）。落地两处：① 管理端经 `PUT /api/admin/programs/:id/advancement-configs` 同页配置该字段；② **入班校验在能力 2** 的邀请码加入端点做：若目标专业已过 `isSelectionDeadline` 学期且学员未在该专业有在修记录→拒绝（返 409「已过选专业截止」），可走能力 5 代行豁免。本能力仅负责配置入口，校验逻辑落能力 2（前向引用）。

---

---

## 能力 3 · 闻思学习与圆满判定  〔样例·学员消费型〕

### 涉及表（08 落点）
`Course` / `Lesson`（复用，含 `courseType`）· `LessonCompletion`（🆕 DR-129，type=audio/video/read 三动作完成事件）· `UserAnswer` / `Question`（复用，思考题）· `StudentSpecialStatus`（§3.3，blind/deaf 豁免数据源）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/courses` / `/api/courses/:slug` | public/optional | — | 法本列表/详情+进度 | ✅ | 复用现状（学员侧加 isTantric 过滤）|
| GET | `/api/lessons/:id/questions` | optional | — | 题目（隐藏答案）| ✅ | 复用 |
| POST | `/api/answers` | student | `{questionId,answer}` | 判分结果 | ✅ | 复用（思考题作答=闻思第三动作）|
| POST | `/api/me/lessons/:id/completion` | student | `{type:'audio'\|'video'\|'read'}` | `LessonCompletion` | 🆕 | 标记「听/看」完成事件（DR-129）；幂等（同 user+lesson+type 不重复）|
| GET | `/api/me/lessons/:id/wensi-status` | student | — | `{听:bool,看:bool,答:bool,圆满:bool,judgedBy:身份分支}` | 🆕 | 闻思圆满判定（按 StudentSpecialStatus 走 blind=听2/deaf=看2 分支，DR-92）|
| PATCH | `/api/me/lessons/:id/reading-progress` | student | 心跳 | — | ✅ | 复用（阅读进度，喂"看"维度）|

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/class/:id`（闻思页）| 本周课时列表 + 每课「听/看/答」三勾态 + 圆满 badge | 三动作各自打勾→满足身份分支→圆满；班级进度基准线 | 🔧 改（加三动作分维度）|
| 学员 | `/courses/:slug`（课程详情）/ 阅读页 | 音视频播放 + 法本阅读 + 思考题 | 播放完触发 completion(audio/video)；阅读心跳喂 read | 🔧 改 |

### 三端可见性
- **学员**：自己每课三动作勾态 + 圆满判定；看不到别人。
- **辅导员/班级管理员**：本班学员闻思圆满率（聚合，能力 14 关怀用），可下钻到个人圆满态。
- **admin**：配置课程内容（能力 1 域）；不单独看闻思勾态。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **B1-B4**；DR-92（圆满判定矩阵）/DR-129（LessonCompletion 新建）。
- **对齐备注**：现状用 enrollment progress + reading-progress 记进度，但**「听/看/答」三动作分维度 + 圆满判定是 🆕**（LessonCompletion 线上 grep=0）。**B3 特殊豁免**：blind/deaf 由 admin 经能力 12 认定写 `StudentSpecialStatus`，本能力的 `wensi-status` 端点读身份分支判定——无需学员端额外入口 ✅。

---

## 能力 7 · 日常实修打卡（频率型）  〔样例·学员打卡型〕

### 涉及表（08 落点）
`PracticeLog`（§1.12，🔧 改造自 PracticeEntry）· `UserPracticeVow`（§1.7，发愿层）· `ClassTask`（§3.14，频率目标 daily/weekly）· `PracticeProject`（复用，修法字典）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/practice-logs` | student | `{practiceProjectId,count,durationMinutes?,prayerCount?,source:'in_app'}` | `PracticeLog` | 🔧 | 打卡（改造自 PracticeEntry，source 值域改 in_app/external/ai_assistant，DR-121/144）|
| GET | `/api/me/practice-logs` | student | `?projectId&from&to` | `PracticeLog[]` + 聚合 | 🔧 | 我的打卡记录/统计 |
| GET/POST | `/api/me/vows` | student | 发愿 `{projectId,targetCount,context}` | `UserPracticeVow` | 🆕 | 个人修持承诺（线上无 vow 表，DR-121）|
| GET | `/api/classes/:id/tasks` | student | — | `ClassTask[]`（daily/weekly 目标）| 🆕 | 本班实修任务（频率目标驱动）|

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/practice` | 修持打卡页：今日任务 + 计数器 + 发愿进度 | 打卡→PracticeLog；进度对 ClassTask.dailyTarget/weeklyTarget | 🔧 改（合并修持愿+打卡，旧档已定）|

### 三端可见性
- **学员**：自己打卡+发愿进度；隐私开关控制是否对班可见（能力 49）。
- **辅导员**：开 `practiceVisibleToClass` 的学员打卡（关怀/排行用）。
- **admin**：配置 PracticeProject 字典、ClassTask 模板。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **C3（净土念佛号）/C4（入行论观修·心咒）/C5（学经读经固定功课）**；DR-121/124/144。
- **✅ 决策 C3/C4（2026-06-01 拍板·采纳建议）念佛三选一 / 入行论二选一互斥**：`ClassTask` 增 `selectionMode:'pick_one'\|'any'`（默认 any）+ `selectionGroup`（互斥组键，如 `nianfo`/`xingyou`）。`POST /api/practice-logs` 校验：同 `selectionGroup` 内若 mode=pick_one 且学员本期已对另一项打过卡→拒绝（返 409「本组只报一种」），首次打卡即锁定该组选项。组内锁定可走能力 5 代行调整。
- **✅ 决策 C5（2026-06-01 拍板·采纳建议）学经固定功课 + 自选功课**：① 预置 `PracticeProject` 字典项（心经 / 普贤行愿品等固定功课）；② 自选功课「只记录不判圆满」→ PracticeProject/PracticeLog 增 `countsForAdvancement`（默认 true；自选项置 false），升学聚合（能力 10 预检）只计 `countsForAdvancement=true` 的记录，自选功课入打卡历史但不进升学判定。

---

## 能力 9 · 学期报数  〔样例·跨端结算型·重点接缺口〕

### 涉及表（08 落点）
`SemesterSnapshot`（§3.7，节点快照）· `PracticeLog`/`LessonCompletion`（数据来源）· `ReportConfession`（§3.8，虚报忏悔）· `ProgramSemester`（报数节点配置）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/me/semester-snapshots` | student | `?programId` | `SemesterSnapshot[]`（历期快照）| 🆕 | 学员看本期/历期报数快照（**WP-A 断点：现状无报数端点**）|
| GET | `/api/me/current-period` | student | — | `{节点期,截止日,实时聚合数}` | 🆕 | 当前报数节点 + 实时进度（节点截止前可见）|
| GET | `/api/classes/:id/snapshots` | class_admin | `?period` | 全班 `SemesterSnapshot[]` | 🆕 | 班级管理员汇总核查 |
| PATCH | `/api/snapshots/:id` | class_admin | `{修正字段, reason}` | 同上 | 🆕 | 节点后代行修正（能力 5，写 AuditLog 留痕 D17）|
| POST | `/api/confessions` | student/class_admin | `{snapshotId, text}` | `ReportConfession` | 🆕 | 虚报忏悔提交（能力 9 BR4）|
| POST | `/api/classes/:id/members/:uid/disqualify` | class_admin | `{reason}` | — | 🆕 | 取消虚报资格（职能 #14，cohortStatus 改 + AuditLog）|

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/me/report`（报数页）| 本期报数概览：各维度实时聚合数 + 节点倒计时 + 历期快照 | 节点截止→系统自动快照（学员无需手动提交）；虚报被标→忏悔入口 | 🆕 **（WP-A 断点：旧档/现状均无报数 UI）** |
| 班级管理员 | `/coach/classes/:id/report-summary` | 班级报数汇总：全员各维度 + 逾期未达红标 + 代行修正 + 取消资格 | 节点后核查→修正/标虚报→忏悔流程→取消资格 | 🆕 |

### 三端可见性
- **学员**：自己的快照与实时进度；被标虚报时见忏悔入口。
- **班级管理员**：全班汇总、修正、虚报治理。
- **admin**：报数节点数/截止日由「专业×届」课表配置（能力 1 域）。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **E3（每学期报2次）/E4（虚报→忏悔→取消资格）**；DR-83-B（快照冻结）/DR-84（忏悔）。
- **✅ 接缺口（报告 04·WP-A）**：本能力**补齐了「报数 UI + 报数聚合端点」**——这是 WP-A 标注的最大断点（旧档/现状都没有），现给出学员报数页 + 班级汇总页 + 6 个端点。
- **🔵 接缺口（报告 03·E3）**：自学学员**不做**报数快照（DR-103）——`/api/me/semester-snapshots` 对自学返回空，自学进度走能力 21 独立端点。
- **✅ 接缺口（报告 03·E4）**：虚报链 ReportConfession + disqualify 端点完整。
- **✅ 已决（报告 03·E1/E2）**：「每月≥2 次共修 / 每月 1 次实修共修」频率门槛属**能力 8** 落点（已拍板选 C：app 展示不预警不卡升学）；本报数能力不含频率判定，自学/报数聚合不受其影响。

---

---

## 能力 37 · 法本阅读器与阅读进度  〔批2·学习引擎 A6〕

### 涉及表（08 落点）
`LessonReadingProgress`（✅ 净资产，`@@unique(userId,lessonId)`，scrollPercent/totalSeconds/isCompleted/lastReadAt）· `LessonCompletion`（🆕 type=read，DR-92 看维度数据来源）· `Highlight`/`Note`（复用，阅读页内画线）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| PATCH | `/api/me/lessons/:id/reading-progress` | student | `{scrollPercent,secondsDelta}` | 进度 | 🔧 | 复用心跳，但**语义降级**：仅记续播位置+统计，**不再自动判完成**（DR-143）|
| POST | `/api/me/lessons/:id/completion` | student | `{type:'read'}` | `LessonCompletion` | 🆕 | **手动**点「完成」写一遍 read 事件（与能力 3/39 同端点，DR-143 改纯手动）|
| GET | `/api/me/reading-stats` | student | — | 累计秒数/完成课时数 | ✅ | 复用（喂学修统计页/Profile）|
| GET/POST/DELETE | `/api/lessons/:lessonId/highlights` `/api/highlights[/:id]` | student | 高亮 | — | ✅ | 复用 |

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/scripture/:lessonId`（ScriptureReadingPage）| 沉浸阅读器（Apple 图书风）：工具栏自动隐现 + 目录/笔记/高亮 + 底部「完成本遍」按钮 | 读→心跳存位置；点完成→写 read 事件；离开有实质进度未确认→弹「本遍是否完成？」；app-kill 重进续播+补弹（localStorage）| 🔧 改（完成判定改手动 + 写 LessonCompletion）|

### 三端可见性
- **学员**：自己阅读进度/完成遍数/续播位置。
- **辅导员/班级管理员**：本班「看法本」完成聚合（喂能力 3 闻思圆满率）。
- **admin**：无独立视图（内容配置归能力 1）。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **B2（看法本）**；服务能力 3「看」维度；DR-143（完成改手动）/DR-92/DR-127/TODO-24。
- **🔧 接缺口（DR-127/TODO-24 完成机制统一）**：线上完成写进 `UserCourseEnrollment.lessonsCompleted` 数组（课程级，DR-113 废弃语义）→ **改造为写 `LessonCompletion`**，下游（课程进度/智能练习/学情统计）改读 LessonCompletion 聚合。**这是已知技术债，本能力落地时一并清**（涉 reading/courses/dossier/smart-practice 多模块）。
- **🔧 防刷口径变更（DR-143）**：原「心跳单次≤60s 防伪造 + 双阈值自动达标」**作废**——纯手动后防刷交虚报治理（能力 9）+ 升学审核（能力 10），阅读器不再担防刷义务。

---

## 能力 39 · 音视频学习与分维度完成记录  〔批2·学习引擎 A8〕

### 涉及表（08 落点）
`LessonResource`（✅ 净资产，type=youtube/audio/video+url）· `LessonMediaChapter`（✅ 章节时间戳）· `LessonCompletion`（🆕 type=audio/video，DR-129 §三新建·线上幻影表纠正）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/lessons/:id/resources` | optional | — | `LessonResource[]`+章节 | ✅ | 复用（音视频内容已上线）|
| POST | `/api/me/lessons/:id/completion` | student | `{type:'audio'\|'video'}` | `LessonCompletion` | 🆕 | **手动**确认写一遍听/看事件（DR-143；幂等可累计，一行=一遍供 COUNT）|
| GET | `/api/me/lessons/:id/wensi-status` | student | — | 听/看/答遍数+圆满 | 🆕 | 同能力 3：听=COUNT(audio,video)、看=COUNT(read)，身份分支判定 |

> 采集层（playedSeconds/playedPercent）DR-143 后**纯客户端**只供 localStorage 续播位置，**不再上报判完成**——无独立进度端点（是否持久化为进度表留实现期定，DR-142）。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/scripture/:lessonId`（音视频区，与阅读器同页）| HTML5 `<audio>/<video>`（OSS 直链）/ YouTube IFrame（墙内播不出即自然不达标）+ 章节跳转 + 「完成本遍」按钮 | 听/看完点完成→写事件；未确认离开→弹确认；app-kill 续播+补弹（localStorage）；两种播放源同口径累计 | 🔧 改（加分维度完成事件）|

### 三端可见性
- **学员**：自己听/看完成遍数 + 续播位置。
- **辅导员/班级管理员**：本班听/看完成聚合（喂能力 3 闻思率、能力 14 contentLag 掉队）。
- **admin**：内容配置（能力 1 域）。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **B1（听音视频）**；服务能力 3「听」维度核心数据源、能力 14 掉队、能力 9 报数；DR-129/142/143。
- **🆕 接缺口（DR-129 幻影表纠正）**：`LessonCompletion` 线上 grep=0（08 此前误标「复用」）→ §三 +1（18 张）真新建；线上播放音视频**不记完成**，这是闻思「听」维度的根缺口，本能力补齐。
- **⚠️ 待实现期确认**：YouTube 源面向谁/是否有 OSS 备份（墙内不可达不做特殊兜底，DR-142）——非业务决策，标实现期 TODO。

---

## 能力 4 · 加行观修（座数+时长双维度实修）  〔批3·实修〕

### 涉及表（08 落点）
`PracticeLog`（§1.12，🔧 改造，`{meditationId,durationMinutes,source}`，一行=一座）· `UserPracticeVow`（§1.7，🆕 座数/时长聚合）· `Meditation`/`MeditationSession`（✅ 净资产，视频引导+看视频排行，DR-111 与报数各管各的）· `ProgramAdvancementConfig`（升学聚合读取）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/meditations[/:id]` | optional | — | 92 修法字典+引导视频 | ✅ | 复用净资产内容 |
| POST | `/api/me/practice-logs` | student | `{meditationId,durationMinutes,source:'in_app'}` | `PracticeLog` | 🔧 | **手动点「完成观修」记一座**（DR-111 不自动）；确认时校验 `durationMinutes≥30`（DR-91）否则 422 |
| GET | `/api/me/meditation-progress` | student | `?programId` | `{每修法座数/时长, 总276座/138h 达标态}` | 🆕 | 双维度进度（单修法≥3座且≥90min；总≥276座且≥138h）|
| GET/POST | `/api/me/vows` | student | 发愿 | `UserPracticeVow` | 🆕 | 座数/时长承诺聚合（同能力 7）|

> **app 外申报**（DR-144）：线下打坐经**能力 9 计数模块**申报（选修法+手填时长+≥30min），写 `PracticeLog{...,source:'external'}`，同落点 source 区分——不在本能力开第二入口。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/meditation/:id`（观修页）| 引导视频/PPT + 「完成本座」按钮 + 手填本座时长 + 92 修法进度网格 | 修后点完成→弹手填时长→≥30min 校验→记座；app-kill 续播+未确认会话补弹「上座是否完成」（localStorage，DR-143）| 🔧 改（看视频不再自动记座，改手动提交+手填时长）|

### 三端可见性
- **学员**：自己 92 修法座数/时长进度 + 起修日基准；隐私开关控对班可见。
- **辅导员/班级管理员**：开可见学员观修进度（关怀/报数核查）；可经能力 5 代行豁免/替代/调整。
- **admin**：配置修法字典、起修日（能力 1）。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **C1/C2（加行观修）**；升学硬条件；D14/DR-91/DR-111/DR-143/DR-144。
- **🔧 接缺口（DR-111 录入语义统一）**：线上看视频播放度**自动触发**记录 → 改为**手动点「完成观修」+ 手填时长**（动线上行为）；**不新增 observation_records 表**（座走 PracticeLog），看视频排行（MeditationSession）与升学座数报数口径分离、各管各的。
- **🔵 业务规则落点**：DR-91「短座<30min 不计也不合并」由打卡端点 `durationMinutes≥30` 校验实现；「单座不可拆」无 API 动作（手填即一座）；起修日前不计 → 端点按 `Program.startDate` 过滤聚合。

---

## 能力 6 · 内加行实修（累计计数型）  〔批3·实修〕

### 涉及表（08 落点）
`PracticeLog`（§1.12，🔧 计数型条目，6 项内加行+法王祈祷文）· `UserPracticeVow`（🆕 6 项各 10 万累计 + 法王祈祷文独立累计）· `PracticeSubstitution`（§3.x，🆕 顶礼→200 万金刚萨埵替代，走能力 5）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/me/practice-logs` | student | `{ngondroItem:'prostration'\|...,count,ritualCompliant:bool,source}` | `PracticeLog` | 🔧 | 计数打卡；`ritualCompliant` 必填（仪轨合规一票否决，不合规作废）|
| GET | `/api/me/ngondro-progress` | student | `?programId` | `{6项各累计/10万达标, 法王祈祷文累计/欠X万, 顶礼替代态}` | 🆕 | 6 项进度 + **法王祈祷文独立计数**（不并入顶礼）+ 跨专业共享来源标注 |

> 顶礼替代/豁免/补足走**能力 5 代行**端点（`PATCH /api/admin/.../students/:uid/substitution`），不在学员端开口子。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/practice`（内加行区）| 6 项计数器 + 法王祈祷文独立进度条 + 仪轨合规勾选 + 替代/欠账状态展示 | 打卡填 count+仪轨合规；顶礼区显示「需同步法王祈祷文，已欠 X 万」；替代后该项标「200 万金刚萨埵替代」| 🔧 改（6 项分类+法王配对+合规标志）|

### 三端可见性
- **学员**：自己 6 项累计 + 法王祈祷文欠账 + 替代/跨专业共享来源（「通过 A 专业达成」可追溯）。
- **辅导员/班级管理员**：可见进度；经能力 5 处理替代/豁免/合规作废。
- **admin**：配置内加行字典与目标值（能力 1）。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **C2（内加行 6×10 万 + 法王祈祷文）**；升学硬条件；D14a（跨专业累计共享）/能力 5。
- **🔵 业务规则落点**：① **法王祈祷文独立计数**（绝对约束1）→ `UserPracticeVow` 单列字段，不并入顶礼 count；② **仪轨合规一票否决** → `ritualCompliant=false` 的 count 不进升学聚合（标作废，可走能力 5 豁免）；③ **跨专业共享**（D14a）→ 进度端点按 userId 跨 program 聚合「果」，B 专业满足时回显来源 program。
- **✅ 已决（与能力 8 同类）**：本能力**无月度频率门槛**（纯累计到 S8 前完成）；E1/E2 频率决策（选 C·展示告知）只作用能力 8 出勤展示，不回溯本能力。

---

---

## 能力 8 · 共修与出勤（网络共修为主）  〔批4·运营结算〕

### 涉及表（08 落点）
`ClassSession`（✅ 扩展，实例层，`checkInToken`/`sessionType` online/offline/self_study/`scheduleId`）· `ClassSessionSchedule`（🆕 §1952，课表模板层·双轨发起）· `StudyRecord`（✅ 出勤落点，`@@unique(classSessionId,userId,studyType)` 幂等防重）· `Program.checkinGraceMinutes`（签到窗口配置，DR-89）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET/POST | `/api/coach/classes/:classId/sessions` | class_tutor+ | 排课/临时发起 | `ClassSession` | ✅ | 复用；POST 支持「课表预排」与「临时发起」（scheduleId 有/无）|
| PATCH/DELETE | `/api/coach/sessions/:id` | class_tutor+ | 改/取消 | — | ✅ | 复用；改课表自动通知本班（DR 课表灵活管理）|
| GET/POST/PATCH/DELETE | `/api/coach/classes/:classId/schedules` | class_tutor+ | 课表模板 | `ClassSessionSchedule` | 🆕 | 双轨发起的「课表预排」层（线上无模板表）|
| POST | `/api/sessions/:id/checkin` | student | `{token}` | 出勤记录 | 🆕 | **网络共修自助签到**：点链接→选自己→确认；校验 token 时效（生成时刻起 `checkinGraceMinutes`）+ 幂等（同场同人一次）|
| GET | `/api/sessions/:id/checkin-grid` | student | — | 本班头像网格+已打卡标记 | 🆕 | 「选自己」网格视图 |
| POST | `/api/coach/sessions/:id/attendance` | class_tutor+ | `{userIds[]}` | — | 🆕 | **线下共修批量勾选**到场学员 |
| POST | `/api/coach/sessions/:id/makeup` | class_tutor+ | `{userId,reason?}` | — | 🆕 | **补卡**（学员不可自助，留痕「由 XXX 补卡」）|
| DELETE | `/api/coach/attendance/:recordId` | class_admin+ | `{reason}` | — | 🆕 | **撤销出勤**（限班级管理员+，辅导员不可，留痕）|
| GET | `/api/me/attendance` | student | `?programId` | 出勤累计/各场记录 | 🆕 | 按班级累计（多专业各自独立，DR-103 自学不统计）|

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/checkin/:sessionId`（签到页）| 头像姓名网格 + 选自己 + 确认 | token 有效→选自己→确认→标记；过期→失效提示 | 🆕 |
| 学员 | `/me/attendance` | 我的共修出勤累计 + 各场明细（含「由 XXX 补卡」）| 只读 | 🆕 |
| 辅导员/班级管理员 | `/coach/classes/:id/sessions` | 课表管理（预排/临时发起/改场）+ 线下勾选 + 补卡 + 撤销 | 临时发起→生成 token 复制到 Zoom；线下→勾选网格批量提交 | 🔧 改（加课表模板+签到治理）|

### 三端可见性
- **学员**：自己出勤累计/各场记录 + 即将到来的共修；看不到别人出勤。
- **辅导员**：可发起/改课表、线下勾选、补卡；**不可撤销出勤**。
- **班级管理员+**：辅导员全部 + 撤销出勤 + 异常审查。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **D1-D2（共修出勤）**；升学硬条件（能力 10 读 attendance 达标）；DR-89（签到窗口）/DR-103（自学不统计）。
- **🔧 接缺口**：线上 `ClassSession`+`StudyRecord` 可复用为出勤底座，但「短时效 token 自助签到 + 头像选自己 + 课表模板双轨 + 补卡/撤销治理」均 🆕（线上无）。
- **✅ 决策 E1/E2（2026-06-01 拍板·选 C 折中告知）月度共修频率**：大纲「每月≥2 次共修 / 每月 1 次实修共修」——**app 算并展示，不预警、不卡升学**。落地：`GET /api/me/attendance` 响应增 `monthlyFrequency`（本月共修次数 / 实修共修次数 + 大纲基准值），`/me/attendance` 页面以「本月 X/2 次」纯告知态展示；**不挂能力 44 提醒规则、不进能力 10 升学预检条件**。频率达标与否的判定交辅导员线下掌握。排除 A（避免误伤+省成本）/ B（保留数据价值）。

---

## 能力 10 · 考试与升学  〔批5·结算判定〕

### 涉及表（08 落点）
`Exam`（✅ 扩展 `examType` quiz/advancement + `isOpenBook`）· `ExamGrade`（✅ `@@unique(examId,userId)` upsert）· `ProgramAdvancementConfig`（§3.1，6 类升学条件数据驱动）· `AdvancementCheck`（§3.9，🆕 升学预检报告）· `AdvancementRecord`（§3.10，🆕 升学记录+条件快照）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/coach/classes/:id/exams` | class_tutor / class_admin | `{title,examDate,examType,isOpenBook?}` | `Exam` | 🔧 | **按 examType 分流写权限**：`quiz` 辅导员起（#11a）/ `advancement` 班级管理员起（#11b）|
| PUT | `/api/exams/:id/grades` | class_admin+ | `{userId,score,comment?}` | `ExamGrade` | 🔧 | 成绩录入限班级管理员+（#7，辅导员无权）；upsert + AuditLog 永久留档 |
| GET | `/api/me/advancement-status` | student | `?programId` | 6 类条件逐条满足态 + 缺口 | 🆕 | 学员「升学进度」板块（只读自己，含代行豁免明细 D18）|
| POST | `/api/classes/:id/advancement-checks` | class_admin+ | `{programId,semester}` | `AdvancementCheck[]` | 🆕 | **系统自动预检**：读能力 9 快照逐条算 6 条件（闻思/观修/内加行/出勤/升学考/灌顶），生成预检报告，**不自动升学** |
| GET | `/api/classes/:id/advancement-checks` | class_admin+ | `?semester` | 全班预检报告 | 🆕 | 管理员核查列表（逐项满足/缺口/可豁免标记）|
| POST | `/api/advancement-checks/:id/approve` | class_admin+ | `{decision:'pass'\|'reject',note}` | `AdvancementRecord` | 🆕 | **审核拍板**（#16，直接定不上报）：pass→写升学记录+状态变正科；reject→提示留级（能力 11）|

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/me/advancement`（升学进度）| 6 类硬条件逐条进度条 + 缺口 + 代行豁免明细 | 只读；条件全绿=具备升学资格（仍待管理员审核）| 🆕 |
| 班级管理员 | `/coach/classes/:id/advancement` | 升学预检报告列表 + 逐项确认 + 拍板 pass/reject | 预检自动算→管理员核→拍板；reject 衔接留级入口 | 🆕 |
| 班级管理员/辅导员 | `/coach/classes/:id/exams` | 考试创建（按 examType 分权）+ 成绩录入 | quiz/advancement 分流；成绩 upsert 留档 | 🔧 改 |

### 三端可见性
- **学员**：自己升学进度 6 条 + 考试成绩 + 豁免明细（D18 双方可见）；看不到预检审核流程。
- **辅导员**：起随堂测验、看本班；**不可录成绩、不可起升学考、不可审核**。
- **班级管理员+**：起升学考、录成绩、跑预检、拍板升学/驳回。

### 大纲 & DR 关联 + 对齐备注
- 服务大纲 **F1-F5（升学）**；D3（条件数据驱动）/D13（6 硬条件不可放宽）/D16（多专业独立升学）/D17（豁免留痕）/D18（永久留档）/DR-99（开闭卷合格线分支）。
- **🆕 接缺口**：线上「无考试无结业」已推翻 → `AdvancementCheck`/`AdvancementRecord` 全新建；升学条件经 `ProgramAdvancementConfig` 数据驱动，新增专业/调门槛不动代码。
- **🔵 业务规则落点**：① 6 硬条件（D13）→ 预检端点遍历 ProgramAdvancementConfig 逐条判定，缺一不可；② 开闭卷合格线（DR-99）→ AdvancementCheck 读 `Exam.isOpenBook` 选 params 分支；③ 多专业独立（D16）→ 预检/升学按 programId 隔离；④ **系统不自动升学（绝对约束1）**→ 无自动升学端点，必经 approve 人工拍板。

---

## 能力 11 · 留级、退出、转专业  〔批5·生命周期〕

### 涉及表（08 落点）
`ClassMember.cohortStatus`（✅ active/paused/held_back/graduated/left，DR：退班=改状态非删除）· `EnrollmentStatusHistory`（§2146，🆕 状态变更永久留痕）· `Class.status`（✅ archived，D19 只归档不删）· 邀请码（能力 2，留级/回归入口）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/me/enrollments/:classId/exit` | student | `{confirm:true}` | 状态→left | 🆕 | **学员自主退出**（无需审批）；二次确认；历史记录保留只读（D15）|
| POST | `/api/coach/classes/:newClassId/retain` | class_admin+ | `{userId,fromClassId,reason}` | 状态→held_back+新班 active | 🆕 | **留级手动操作**：经能力 2 把学员加新一届班；旧班记录保留、新班按新届起修日累计 |
| POST | `/api/coach/classes/:id/archive` | class_admin+ | — | `Class.status=archived` | 🆕 | **班级归档**（D19，无 delete）；归档后不收新生/不产课表 |
| GET | `/api/me/enrollment-history` | student | — | `EnrollmentStatusHistory[]` | 🆕 | 学员看自己退出/回归/留级全程（双方可见 D18）|

> 转专业 = 退出当前 + 加入另一（能力 2）**两步走，无平移端点**；两段历史各自独立，跨专业累计共享（D14a）仍生效。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/me/programs` | 专业列表：在修/「已退出」灰显可展开看历史 | 退出二次确认；回归走邀请码（能力 2）记录自动衔接 | 🔧 改（加退出/已退出态）|
| 班级管理员 | `/coach/classes/:id/settings` | 留级入口（升学驳回后提示）+ 班级归档 | reject→留级提示→加新班；本届清空后手动归档 | 🆕 |

### 三端可见性
- **学员**：自己各专业状态（在修/已退出/留级）+ 状态变更史；可退出、可经邀请码回归。
- **辅导员**：可见本班成员状态；**留级/归档限班级管理员+**。
- **班级管理员+**：留级（加新班）、班级归档、状态治理。

### 大纲 & DR 关联 + 对齐备注
- 衔接能力 10（升学驳回触发留级）；D15（退出记录保留）/D18（永久留档）/D19（只归档不删）/D14a（跨专业共享）。
- **🔵 业务规则落点**：① 班级只归档（D19）→ 无 delete API，`Class.status=archived`；② 退出记录保留（D15）→ `cohortStatus=left` 非物理删，历史只读可查；③ 留级手动（绝对约束4）→ 无自动留级，管理员经邀请码加新班；④ 缺席期补卡走能力 5 代行（退出期共修缺场可管理员补卡留痕）。
- **🔵 字段对齐**：06 占位名 `enrollment_status`/`class_status` → 08 实为 `ClassMember.cohortStatus` + `Class.status` + `EnrollmentStatusHistory`，本能力按 08 落点。

---

## 能力 5 · 管理员代行操作（横切能力）  〔批6·管理横切〕

### 涉及表（08 落点）
`AuditLog`（✅ 净资产·DR-118 冲突改造，代行记录统一台账，**永不物理删除**）· 效果写各域**原生字段**：`UserPracticeVow.isSubstituted`（替代）/ `StudyRecord`（补卡行）/ `ExamGrade`（upsert 修正）/ `StudentSpecialStatus`（盲聋认定，能力 12）· 升学豁免由 `AdvancementCheck`（能力 10）按 `conditionKey` 读 AuditLog 应用

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/admin/students/:uid/proxy-actions` | class_admin（本班）/ subject_admin（本学科）/ super_admin（任意）| `{actionType,domain,targetKey,payload,reason*,basis?,scope,notify=true}` | `AuditLog` | 🆕 | **统一代行入口**；`actionType` 五类（见下）；`reason` 必填否则 422；写 AuditLog + 落原生字段；按角色校验作用域（越域 403）|
| GET | `/api/admin/students/:uid/proxy-actions` | class_tutor+（只读）| `?domain` | `AuditLog[]`（含已撤回链）| 🆕 | 学员档案代行史（管理端，辅导员可读供「建议」参考）|
| POST | `/api/admin/proxy-actions/:id/revoke` | 同级或更高 | `{reason*}` | 新 `AuditLog`（type=revoke）| 🆕 | **撤回=新记录**，原记录永不删（绝对约束6）；撤回同步回滚原生字段 |
| POST | `/api/coach/students/:uid/proxy-suggestions` | class_tutor | `{domain,targetKey,suggestion,reason}` | 建议记录 | 🆕 | **辅导员只能「建议」不能执行**（业务规则3），路由给班级管理员处理 |
| GET | `/api/me/proxy-actions` | student | — | 本人档案代行记录（只读全文）| 🆕 | **学员可见权**（绝对约束7·D18 双方可见）|

> **actionType 五类**：`exempt` 豁免（标"已满足"）· `substitute` 替代（如 200万金刚萨埵替10万顶礼→ 写 isSubstituted）· `adjust_target` 调整目标值 · `correct_record` 修正已录数据 · `retroactive_approve` 追溯认可（App 外修持追认）。`domain`/`targetKey` 定位作用对象（如 `domain=ngondro,targetKey=prostration` 或 `domain=advancement,targetKey=exam_s8`）。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 管理员 | （内嵌各管理页）学员档案 / 升学审核 / 出勤 / 实修进度页内「代行」操作区 | 选 actionType→填理由/依据/范围/是否通知→提交 | 提交即写 AuditLog + 落原生字段 + 通知学员；异常频繁→能力 14 关怀打标 | 🆕 |
| 管理员 | 学员档案「代行记录」时间线 | 全部代行历史（含撤回链）逐条全文 | 可撤回（生成新记录）| 🆕 |
| 辅导员 | 学员档案「建议代行」入口 | 提建议（不执行）转管理员 | 路由给班级管理员 | 🆕 |
| 学员 | `/me/profile` 档案内「学修例外记录」 | 只读自己全部代行记录全文 | 只读（设计哲学：豁免不是污点，是学修旅程的一部分）| 🆕 |

### 三端可见性
- **学员**：自己档案上**全部**代行记录的完整内容（理由/依据/操作人/时间/撤回），永久跟随档案（毕业/退出/升学后仍在）。
- **辅导员**：可读本班学员代行史、可「建议」；**不能单独执行任何代行**。
- **班级管理员+**：本班执行（subject_admin 本学科 / super_admin 任意）；可撤回同级或下级记录。

### 大纲 & DR 关联 + 对齐备注
- 横切支撑能力 3/4/6/8/10/11/12 的全部例外口子；D17（代行留痕）/D18（永不删除）/DR-118（AuditLog 冲突改造）。
- **🆕 接缺口**：线上仅举报处理写 AuditLog，无通用代行面 → 五类代行 + 撤回链 + 学员可见 + 辅导员建议全 🆕。
- **🔵 架构落点（关键）**：① **代行效果落地** = 有原生字段的写字段（isSubstituted/StudyRecord 补卡行/ExamGrade upsert）；**升学条件类豁免/调目标无原生字段** → 不建独立 override 表，由 `AdvancementCheck` 预检遍历 ProgramAdvancementConfig 时，对 `isExemptable=true` 的条件**回查 AuditLog 是否有未撤回的 active 代行记录**（match conditionKey），有则该条置满足。② **AuditLog 需改造**（DR-118 已标冲突改造）承载 `targetUserId/actionType/domain/targetKey/reason/basis/scope/notify/revokedBy/revokesId` 字段——此为**数据层改动，挂 08 回填清单**（与前 4 字段一并，暂缓）。
- **🔵 业务规则落点**：理由必填→Zod；学员不能自行豁免→无 student 写端点；撤回=新记录→revoke 端点不 update 原行；作用域隔离→中间件按角色×目标班级校验。

---

## 能力 12 · 特殊身份学员关怀（盲/聋）  〔批6·关怀〕

### 涉及表（08 落点）
`StudentSpecialStatus`（§3.3，认定**过程**留痕 append-only，blind/deaf 仅两类不可扩展，`@@unique(userId,statusType)`）· `User.accessibilityNeeds`（§1.9，当前生效**快照**，闻思判定直读，DR-76 双写）· `CareFollowupRecord`（§2.2，`sourceType=special_status`，辅导员跟进日志·师兄不可见）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/admin/students/:uid/special-status` | class_admin+ | `{statusType:'blind'\|'deaf',note?}` | `StudentSpecialStatus` | 🆕 | **认定**（职能 #13）即时生效；**事务双写**：本表 append + 更新 `User.accessibilityNeeds` 快照（DR-76）|
| POST | `/api/admin/special-status/:id/revoke` | class_admin+ | `{reason}` | status=revoked | 🆕 | 撤销（`status='revoked'` 不物理删 D18）；同步移除快照值；历史按当时身份保留 |
| GET | `/api/admin/students/:uid/special-status` | class_tutor+（只读）| — | 认定/撤销史 | 🆕 | 档案身份留痕 |
| GET | `/api/coach/care/special-students` | class_tutor+ | — | 本班特殊身份学员 + 跟进状态 | 🆕 | 认定后自动入辅导员**关怀跟进列表** |
| GET/POST | `/api/coach/students/:uid/followups` | class_tutor+ | `{contactedAt,summary,studentState,nextPlan?,sourceType:'special_status'}` | `CareFollowupRecord` | 🆕 | 填/看跟进记录（**师兄不可见**·内部工作日志，绝对约束5）；无强制频率 |
| GET | `/api/me/special-status` | student | — | 自己已认定身份（闻思按调整路径）| 🆕 | **只返回身份本身，不返回跟进日志**（绝对约束5）|

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 班级管理员 | 学员档案「特殊身份认定」区 | 认定 blind/deaf + 撤销 | 认定即时生效→闻思路径切换；可撤销恢复普通路径 | 🆕 |
| 辅导员 | `/coach/care`（关怀跟进列表）| 所有特殊身份学员 + 点入填本次跟进（时间/摘要/状态/下次计划）| 认定后自动出现；逐次填记录 | 🆕 |
| 学员 | `/me/profile` | 档案显示已认定特殊身份 + 闻思进度按**调整后路径**展示 | 只读；**跟进日志不展示** | 🔧 改 |

### 三端可见性
- **学员**：自己已认定身份 + 闻思按身份分支判定（盲=听≥2 豁免看/答；聋=看≥2 豁免听/答，DR-92）；**看不到任何关怀跟进日志**。
- **辅导员**：关怀跟进列表 + 填/看跟进记录；**不能认定身份**（限 class_admin+）。
- **班级管理员+**：认定/撤销 + 查跟进史。

### 大纲 & DR 关联 + 对齐备注
- 服务能力 3（闻思圆满身份分支）/ 能力 13（辅助员配对前提）/ 能力 14（特殊身份自动入关怀清单）；职能 #13 / DR-76（双写）/DR-92（判定矩阵）/D18。
- **🔵 架构落点**：① **留痕表+快照**模式——`StudentSpecialStatus` 记过程（谁/何时/撤销史），`User.accessibilityNeeds` 存当前快照供闻思**直读免 join**，认定/撤销事务双写（DR-76）；② **CareFollowupRecord 与能力 14 共用**一张表，`sourceType` 区分（special_status / care_watchlist）。
- **🔵 业务规则落点**：① 仅 blind/deaf 两类（绝对约束1）→ statusType Zod 枚举；其他特殊情况走能力 5；② **双盲聋极罕见无大纲路径** → 不自动判定，走能力 5 个案豁免；③ 身份变更不追溯历史（绝对约束4）→ 闻思判定按当时快照、历史圆满记录不重算；④ 跟进日志师兄不可见 → `/me/*` 端点不返回 CareFollowupRecord。

---

## 能力 13 · 辅助员配对  〔批6·关怀〕

### 涉及表（08 落点）
`AssistantAssignment`（🆕 §线上无，classId+userId+status active/revoked+assignedBy，`@@index(classId,status)`）· 委托权限**不建独立权限表**——由中间件运行时校验 active 配对授予能力 8/9 的班级操作权

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/coach/classes/:id/assistants` | class_tutor+（只读）| — | `AssistantAssignment[]`（active）| 🆕 | 查当前辅助员；辅导员只读权（R，不能授权）|
| POST | `/api/coach/classes/:id/assistants` | class_admin+ | `{userId,note?}` | `AssistantAssignment` | 🆕 | **指定并授权**（职能 #19）；被指定者须本班成员 |
| POST | `/api/coach/assistants/:id/revoke` | class_admin+ | `{reason?}` | status=revoked | 🆕 | **随时收回**立即生效，永久留痕（D17/D18，不物理删）|

> **委托权限边界**：active 辅助员获 ① 发起共修（能力 8 sessions 写权）② 发起班级法会 ③ 发布班级任务（能力 9 ClassTask 写权）④ 监督学习（全班进度**只读**）。**不能**：编辑/删学员数据、认定特殊身份（能力 12 限 class_admin）、审报数、批升学。中间件按 `AssistantAssignment.status=active AND classId 匹配` 放行上述四项。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 班级管理员 | `/coach/classes/:id/settings`（指定辅助员区）| 当前辅助员 + 权限状态 + 指定/收回 | 指定即授四项委托权；收回立即失效 | 🆕 |
| 辅助员 | 班级学修视图（复用辅导员视图子集）| 全班进度只读 + 任务发布 + 共修发起入口 | 操作时中间件校验 active 配对 | 🆕 |

### 三端可见性
- **学员**：不涉及（辅助员是班级管理委托角色，学员端无感）。
- **辅导员**：只读本班辅助员配对；**不能授权/收回**。
- **班级管理员+**：指定/收回辅助员（职能 #19）。

### 大纲 & DR 关联 + 对齐备注
- 服务能力 8（辅助员发起共修）/ 能力 9（辅助员发布任务进报数）/ 能力 14（辅导员全班关怀主责，辅助员协助）；职能 #19 / D17 / D18。
- **🔵 业务规则落点**：① 辅助员**非四大管理角色**，是 class_admin 委托 → 不进 UserRoleAssignment，独立 AssistantAssignment 表（DR-82 曾议并入 §2.1 后回滚为独立表）；② 作用域本班全体（绝对约束1）→ 中间件校验 classId 匹配；③ 不能编辑/删学员数据（绝对约束2）→ 委托权仅含发起/发布/只读，无写学员档案权。

---

## 能力 14 · 学员关怀清单  〔批6·关怀（终端）〕

### 涉及表（08 落点）
`CareWatchlistItem`（§3.4，清单条目·7 类 triggerType·status active/resolved·**partial unique** `WHERE status='active'` DR-78）· `CareFollowupRecord`（§2.2，跟进备注·`sourceType=care_watchlist`·与能力 12 共用）· `CohortLagSnapshot`（§1.5，掉队检测信号源·5 维 LagStatus·`@@unique(classId,studentId)` 一人一行最新）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/coach/classes/:id/care-watchlist` | class_tutor+ | `?triggerType&status` | `CareWatchlistItem[]`（多原因逐条）| 🆕 | 按作用域查本班清单（D8）；一人多触发原因→多条 |
| POST | `/api/coach/care-watchlist` | class_tutor+ | `{userId,classId,reason}` | item（triggerSource=manual）| 🆕 | **手动添加**任意学员 |
| POST | `/api/coach/care-watchlist/:id/resolve` | class_tutor+ / class_admin（虚报）| `{note?}` | status=resolved | 🆕 | 手动解除（`manual` 由添加人/更高级；`false_report` **限管理员**，不自动）|
| GET/POST | `/api/coach/students/:uid/followups` | class_tutor+ | `{...,sourceType:'care_watchlist',watchlistItemId}` | `CareFollowupRecord` | 🆕 | 填跟进备注（**学员不可见**·内部日志）+ 可标「已跟进」（≠问题解决）|
| GET | `/api/coach/classes/:id/lag-snapshot` | class_tutor+ | — | `CohortLagSnapshot[]`（5 维 LagStatus）| 🆕 | 掉队检测名单（出勤/内容/答题/观修/任务）；**学员端完全不可见** |

> **自动触发/解除非端点**：触发条件由各能力事件 / cron 重算写入 CareWatchlistItem（practice_lag/attendance_low/report_overdue/study_lag 自动加→补齐自动 resolve；special_status 跟随能力 12；false_report/manual 手动）。阈值=专业配置（D3，复用 TODO-1，DR-79）。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 辅导员/辅助员 | `/coach/classes/:id/care`（关怀清单 tab）| 待跟进学员（按触发原因分组 / 按学员汇总）+ 掉队五维标 + 填备注 + 标已跟进 | 系统自动汇聚→辅导员联系→填备注→标已跟进；条件解除自动移除 | 🆕 |
| 班级管理员+ | 同上 + 全貌 | 本班清单全貌 + 历史跟进记录 + 虚报手动解除 | 虚报标记仅管理员手动移除 | 🆕 |

### 三端可见性
- **学员**：**完全不可见**——清单、触发原因、跟进备注、掉队快照学员端均无 API 返回（绝对约束2，内部工作日志 D18）。
- **辅导员/辅助员**：按作用域查本班清单 + 填备注 + 标已跟进。
- **班级管理员+**：清单全貌 + 虚报手动解除。

### 大纲 & DR 关联 + 对齐备注
- 终端能力（无下游）；触发信号来自能力 3/7/8/9/12；D3（阈值数据化）/D8（作用域）/D18 / DR-78（partial unique）/DR-79（复用 TODO-1 阈值）/DR-130（CohortLagSnapshot）/DR-143（contentLag 读已确认完成）。
- **🔵 架构落点**：① **「活跃信号 + 留痕」分离**——清单移除走 `status=resolved` 不删行，partial unique 保证同人同类型只一条 active、允许历史多条 resolved（DR-78）；② **CohortLagSnapshot 是检测信号源**（一人一行存最新 5 维结果），关怀清单据此 + 各能力事件汇聚；③ **CareFollowupRecord 与能力 12 共用**，sourceType 区分 special_status / care_watchlist。
- **🔵 业务规则落点**：① 虚报/手动不自动解除（绝对约束4）→ resolve 端点按 triggerType 分权（false_report 限管理员）；② 备注学员不可见（绝对约束2）→ `/me/*` 不返回 CareFollowupRecord/CareWatchlistItem/CohortLagSnapshot；③ 阈值数据化（绝对约束1）→ 挂 08 §十待办（Program 配置表统一处理，复用 TODO-1）。

---

## 能力 15 · 传承管理  〔批6·传承〕

### 涉及表（08 落点）
`TransmissionRecord`（🆕 线上「传承不做」已推翻 D4，`sourceType` course/dharma_event/empowerment · `transmissionKey` 对齐 `ProgramAdvancementConfig.conditionKey` · `isRequired`/`isConfirmed`/`confirmedBy` 升格链 · `tantricGroupId` empowerment 授权密法访问 DR-44 · status active/revoked）· `ProgramAdvancementConfig`（conditionType='transmission' 固定清单）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/me/transmissions` | student | — | 固定/额外分组 `TransmissionRecord[]` | 🆕 | 学员看自己传承（双方可见 D18）|
| POST | `/api/me/transmissions` | student | `{name,sourceType,receivedAt,masterName?}` | record | 🆕 | **自行申报**：默认 `isRequired=false`（额外）+ `entryMethod=self_report` |
| POST | `/api/coach/students/:uid/transmissions` | class_tutor+ | 同上 | record | 🆕 | 管理员/辅导员**代录**（`entryMethod=admin_entry`，默认额外）|
| POST | `/api/admin/transmissions/:id/confirm` | class_admin+ | `{transmissionKey}` | isRequired=true | 🆕 | **升格为固定清单项**（规则3/5：手动录入默认额外，升格需管理员确认）+ `confirmedBy/At` |
| POST | `/api/admin/transmissions/:id/revoke` | class_admin+ | `{reason}` | status=revoked | 🆕 | 撤销（不物理删 D18）|

> **课程自动传承非端点**：专业配置标「含传承」的课程，学员经能力 3 圆满判定通过→系统派生 `entryMethod=auto, entryBy=system, isRequired=true, transmissionKey=<config>`（完成事件本身手动确认 DR-143，派生仍自动）。**升学核查**：能力 10 AdvancementCheck 遍历 conditionType='transmission' 条件，逐 `conditionKey` 查该用户有无 `transmissionKey=key AND isRequired=true AND status=active` 记录。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/me/profile`（传承记录区）| 固定传承 / 额外传承分组展示 + 自行申报入口 | 申报→默认额外→待管理员升格 | 🆕 |
| 班级管理员+ | `/coach/classes/:id/transmissions` | 确认申报（升格）+ 全班固定传承达标情况 | 申报/代录→管理员确认 transmissionKey→升格计入升学 | 🆕 |

### 三端可见性
- **学员**：自己全部传承（固定/额外，含来源/录入人/时间，双方可见 D18）；可申报；看不到升格决策细节外的管理视图。
- **辅导员**：代录（默认额外）；**不能升格为固定项**（confirm 限 class_admin+）。
- **班级管理员+**：确认升格、撤销、查全班达标。

### 大纲 & DR 关联 + 对齐备注
- 服务能力 10（升学核查固定传承）；依赖能力 3（课程触发）/能力 5（额外替代固定）/能力 17（灌顶子类）；D4（传承根基）/D3（固定清单专业配置）/D13（灌顶硬条件）/D17/D18/DR-44。
- **🆕 接缺口**：线上「传承不做」第 10 条已推翻（D4）→ TransmissionRecord 全新建；三来源（课程/法会/灌顶）统一一张表 `sourceType` 区分。
- **🔵 业务规则落点**：① 固定清单由专业配置定义、辅导员不可自加必需项（绝对约束1）→ 升格 confirm 限 class_admin+；② 额外不自动计入升学（绝对约束2）→ 升学核查只认 `isRequired=true AND active`；③ 额外替代固定走能力 5（绝对约束3）→ 不在本能力开替代口子；④ **传承法会作为独立自动批量登记功能 ❌ 不做**（能力 16），手动录入统一走本能力；⑤ 灌顶=`sourceType=empowerment` 同表（能力 17），并作 TantricGroup 密法访问授权来源（DR-44）。

---

## 能力 17 · 灌顶记录  〔批6·传承（特殊子类）〕

### 涉及表（08 落点）
`TransmissionRecord`（**复用·不单独建表**，`sourceType='empowerment'` · `tantricGroupId` 必填=密法授权依据 · 无 `@@unique(userId,tantricGroupId)` 允许同组多次接受 DR-45）· `TantricGroup`（密法组，🔧 删 grants 补 transmissionRecords，DR-73）· 废弃 `TantricAccessGrant`（DR-44，访问控制改 EXISTS 查询）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/me/transmissions` | student | `{sourceType:'empowerment',name,receivedAt,masterName,tantricGroupId}` | record | 🔧 | **复用能力 15 端点 + empowerment 分支**；`tantricGroupId` 必填否则 422（灌顶须关联传承组）|
| POST | `/api/coach/students/:uid/transmissions` | class_tutor+ | 同上 | record | 🔧 | 代录灌顶（复用 15）|
| POST | `/api/admin/transmissions/:id/confirm` | class_admin+ | `{transmissionKey}` | isRequired=true | 🔧 | 升格必需灌顶（复用 15）|
| —（无新端点）密法访问控制 | `GET /api/courses/:slug`（restricted 课）| optional | — | 含/不含正文 | 🔧 | **改 EXISTS 查询**（DR-44/45）：isTantric 法本读取前查 `EXISTS TransmissionRecord(userId,tantricGroupId,sourceType=empowerment,status=active)`，无则挡 |

> **录入方式**：无系统自动触发（与课程传承不同）；学员自行申报或管理员/辅导员代录，默认额外（isRequired=false），升格需管理员确认（同能力 15）。**升学核查**：能力 10 预检对 conditionType='transmission' 且指代灌顶项的 conditionKey，核 `isRequired=true AND active` 灌顶记录。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/me/profile`（传承记录区·灌顶独立标注）| 灌顶在传承列表中独立标记 + 申报入口（选传承组）| 申报→默认额外→管理员升格；申报授予对应密法组访问 | 🔧（复用 15 页面 + 灌顶子视图）|
| 班级管理员+ | `/coach/classes/:id/transmissions` | 升学预检中显示灌顶满足情况 + 代录入口 | 同 15 升格流 | 🔧 |

### 三端可见性
- **学员**：自己灌顶记录（独立标注，双方可见 D18）；申报后获对应 TantricGroup 密法访问权。
- **辅导员**：代录灌顶（默认额外）；不能升格。
- **班级管理员+**：升格必需灌顶、撤销、查全班灌顶达标。

### 大纲 & DR 关联 + 对齐备注
- 服务能力 10（升密硬条件 D13 核查必需灌顶）；依赖能力 15（归属传承体系）/能力 5（不可替代除非代行）；D13/D17/D18/DR-44/DR-45/DR-73。
- **🔵 架构落点（关键）**：① **不单独建表**（绝对约束1）→ 复用 TransmissionRecord `sourceType=empowerment`；② **密法访问控制改 EXISTS**（DR-44/45）→ 废弃旧 TantricAccessGrant，灌顶记录天然承担密法授权，访问查询=`EXISTS TransmissionRecord(empowerment,tantricGroupId,active)`，影响能力 3 restricted 法本读取门禁；③ 无 `@@unique(userId,tantricGroupId)`（DR-45）→ 同人可多次接受同组传承不报错。
- **🔵 业务规则落点**：灌顶不可替代（绝对约束2）→ 升学核查无替代分支，豁免唯一路径走能力 5 代行（留痕 D17）。

---

> **进度**：已产出 **17 条**（能力 1/3/4/5/6/7/8/9/10/11/12/13/14/15/17/37/39）——主干学修闭环 + 横切代行(5) + 关怀簇(12/13/14) + **传承簇(15/17)**。
> **下一批（批6-8）**：关怀/传承/权限/审计（12-20）+ 自学(21) + 净资产层 API/页面盘点(26-51) + 后台关键部分契约(22-25/38)。
> **08 回填清单（暂缓·待 09 产完一次性回填）**：① ProgramSemester.isSelectionDeadline ② ClassTask.selectionMode/selectionGroup ③ PracticeProject/PracticeLog.countsForAdvancement ④ ClassSession/StudyRecord 出勤 monthlyFrequency 聚合（读时算，可能无需建字段）⑤ **AuditLog 代行字段**（targetUserId/actionType/domain/targetKey/reason/basis/scope/notify/revokedBy/revokesId，DR-118 改造）。
> **缺口边设计边接已贯穿（全部已决）**：A3 选专业锁定（能力1 ✅ 建 isSelectionDeadline+入班校验）· C3/C4 互斥（能力7 ✅ selectionMode/selectionGroup）· C5 自选功课（能力7 ✅ countsForAdvancement）· **E1/E2 月度共修频率（能力8 ✅ 选 C·展示不预警不卡升学）** · WP-A 报数UI（能力9 ✅补齐）· DR-127 完成机制统一（能力37 🔧）· DR-129 幻影表（能力39 🆕）· DR-99 开闭卷分支（能力10 🔵）。
> **决策记录（2026-06-01 拍板 3 条）**：① A3=采纳建选专业锁定；② C3/C4/C5=采纳建互斥校验+自选功课标记；③ E1/E2=选 C 折中告知。**注**：这 3 条目前只落在本设计文档；如需进 §五 战略决策 `05-decision-log.md` 分配 DR 编号，告我一声我追加。
