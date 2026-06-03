# 09 · API 契约 & 页面/交互设计（SoT 第三层）

> 状态：首轮完整（2026-06-02）· 全 51 能力骨架已覆盖（1-25 正式契约，16=❌不做，22-25=⏸后台契约；26-51 净资产盘点；学习引擎 37/38/39）· 已过全文一致性检查、与 08/06 对齐无漂移 · 决策：DR-146/147/148 已落 + A3 ⚠️待定
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
- **⏸ 待定 A3（2026-06-02·用户决定暂缓，2026-06-03 确认继续待定）选专业第2学期锁定**：大纲 PAGE 2 明文「第1学期末选定、第2学期起不得调整专业」（报告03 §缺口2·P0）。**业务理由**：升学体系按专业走、累计型硬条件从起修日攒，中途转专业会打乱固定路径。**落点已厘清但暂不实施**——大纲统一截止=S2（常量），技术上**零新字段可实现**（入班校验比较当前专业周次 ≥ ProgramSemester(S2).startsWeek 且学员无在修记录→驳回）；08 无需加字段。**另：⚠️ A3「不得调整专业」是否也锁「新增并行专业」尚未决策**（G1.1：若 A3 包含新增，D9 多专业 S2 后无法扩展；若只锁切换，两条规则相容）——待 A3 整体决策时一并处理。待后续专项处理。

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
| POST | `/api/practice-logs` | student | `{vowId,practiceProjectId,count,durationMinutes?,prayerCount?,source:'in_app'}` | `PracticeLog` | 🔧 | 打卡（改造自 PracticeEntry，source 值域改 in_app/external/ai_assistant，DR-121/144）；`vowId` 必填，多专业分流必须（DR-153）|
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
- **✅ 决策 G1.4（2026-06-03·DR-153）多专业报数分流**：`POST /api/practice-logs` 入参增加 `vowId`（必填）；前端从专业任务卡片上下文自动带入，后端校验该 vow 属于当前用户+当前活跃学期；多专业并修时各专业卡片各自独立、点哪张归哪个专业；❌ 不做「提交时下拉选专业」（入口已在卡片上下文内，冗余选择器增加认知负担）。
- **✅ 决策 C3/C4（2026-06-02·DR-148·config 驱动零新字段）念佛三选一 / 入行论二选一互斥**：互斥规则写进 `ProgramAdvancementConfig.params`（§3.1 已是 Json 额外参数，如 `{selectionGroup:'nianfo', selectionMode:'pick_one'}`），**无需给 ClassTask 加字段**。`POST /api/practice-logs` 校验时读对应 config 的 params：同组 `pick_one` 且学员本期已对另一项打过卡→拒绝（409「本组只报一种」），首次打卡锁定该组选项。组内锁定可走能力 5 代行调整。
- **✅ 决策 C5（2026-06-02·DR-148·config 驱动零新字段）学经固定功课 + 自选功课**：① 预置 `PracticeProject` 字典项（心经/普贤行愿品等固定功课）；② **自选功课「不计入升学」靠 config 引用判定**——升学预检（能力 10 AdvancementCheck）只认 `ProgramAdvancementConfig` 引用的功课条件，自选功课不在任何 advancement config 中 → 天然不进升学聚合（贴合 08 D3 数据驱动），**无需给 PracticeProject/PracticeLog 加 countsForAdvancement 字段**。自选功课正常入 PracticeLog 历史、不进升学判定。

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
- **✅ 已决（报告 03·E1/E2·DR-146）**：「每月≥2 次共修 / 每月 1 次实修共修」频率门槛属**能力 8** 落点（已拍板：**不记录，走建课时课表配置**，app 不追踪频率）；本报数能力不含频率判定，自学/报数聚合不受其影响。

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
| POST | `/api/me/practice-logs` | student | `{vowId,meditationId,durationMinutes,source:'in_app'}` | `PracticeLog` | 🔧 | **手动点「完成观修」记一座**（DR-111 不自动）；确认时校验 `durationMinutes≥30`（DR-91）否则 422；`vowId` 必填（DR-153 多专业分流）|
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
`PracticeLog`（§1.12，🔧 计数型条目，6 项内加行+法王祈祷文）· `UserPracticeVow`（🆕 6 项各 10 万累计 + 法王祈祷文独立累计；`isSubstituted`+`substitutionFor` 字段承载顶礼→200 万替代因果链，❌ 无独立 `PracticeSubstitution` 表，见 DR-151）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/me/practice-logs` | student | `{vowId,ngondroItem:'prostration'\|...,count,ritualCompliant:bool,source}` | `PracticeLog` | 🔧 | 计数打卡；`ritualCompliant` 必填（仪轨合规一票否决，不合规作废）；`vowId` 必填（DR-153 多专业分流）|
| GET | `/api/me/ngondro-progress` | student | `?programId` | `{6项各累计/10万达标, 法王祈祷文累计/欠X万, 顶礼替代态}` | 🆕 | 6 项进度 + **法王祈祷文独立计数**（不并入顶礼）+ 跨专业共享来源标注 |

> 顶礼替代/豁免/补足走**能力 5 代行**端点（`PATCH /api/admin/.../students/:uid/substitution`）；⏸ **学员申请入口待定**——当前替代由管理员在能力 5 代行界面主动发起，学员无自助申请入口；入口设计待后续讨论。

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
- **✅ 已决（与能力 8 同类）**：本能力**无月度频率门槛**（纯累计到 S8 前完成）；E1/E2 频率决策（DR-146：不记录·走建课课表配置）只作用能力 8 排课，不回溯本能力。

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
- **✅ 决策 E1/E2（2026-06-02 拍板·不记录·走建课配置·DR-146）月度共修频率**：大纲「每月≥2 次共修 / 每月 1 次实修共修」**不作为 app 追踪/展示/校验的运行指标**，而是**建课时课表配置的内在排程要求**——管理员/辅导员创建课程/共修课表（能力 1 课程配置 + 能力 8 `ClassSessionSchedule`）时按大纲排足每月≥2 次共修（及每月 1 次实修共修），频率由课表结构本身保证。**app 无 `monthlyFrequency` 字段/展示/预警/升学校验**（`GET /api/me/attendance` 不加该字段）。定位：频率是『配置期』约束（建课排足）、非『运行期』指标。排除 原拟 C 展示 / A 预警卡升学 / B 完全不提，见 DR-146。

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
| POST | `/api/advancement-checks/:id/approve` | class_admin+ | `{decision:'pass'\|'reject',note}` | `AdvancementRecord` | 🆕 | **审核拍板**（#16，直接定不上报）：pass→写 AdvancementRecord + 原预科成员 cohortStatus `graduated→advanced` + EnrollmentStatusHistory；**不建正科 ClassMember**（落班机制=邀请码两步走，DR-150；管理员另发邀请码学员走能力 2 加入）；并行专业 ClassMember 不受影响（D9/D16）；reject→提示留级（能力 11）|

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
`ClassMember.cohortStatus`（✅ active/paused/held_back/graduated/advanced/disqualified/left，DR-149 扩 7 态；退班=改状态非删除）· `EnrollmentStatusHistory`（§2146，🆕 状态变更永久留痕）· `Class.status`（✅ archived，D19 只归档不删）· `LeaveRequest`（§3.15，🆕 请假审批，DR-90）· 邀请码（能力 2，留级/回归入口）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/me/enrollments/:classId/exit` | student | `{confirm:true}` | 状态→left | 🆕 | **学员自主退出**（无需审批）；二次确认；历史记录保留只读（D15）|
| POST | `/api/coach/classes/:newClassId/retain` | class_admin+ | `{userId,fromClassId,reason}` | 状态→held_back+新班 active | 🆕 | **留级手动操作**：经能力 2 把学员加新一届班；旧班记录保留、新班按新届起修日累计 |
| POST | `/api/coach/classes/:id/graduate` | class_admin+ | `{confirm:true}` | 全班 active→graduated | 🆕 | **批量结业**（第八学期结束，DR-149）：本班所有 active 成员 cohortStatus→graduated + 各记 EnrollmentStatusHistory；**无实修门槛**（毕业=时间事件非达标）；二次确认；毕业去向（升学/留级/转预科）另走对应能力 |
| POST | `/api/coach/classes/:id/archive` | class_admin+ | — | `Class.status=archived` | 🆕 | **班级归档**（D19，无 delete）；归档后不收新生/不产课表 |
| GET | `/api/me/enrollment-history` | student | — | `EnrollmentStatusHistory[]` | 🆕 | 学员看自己退出/回归/留级全程（双方可见 D18）|
| POST | `/api/me/leave-requests` | student | `{classId,startDate,endDate,reason}` | `LeaveRequest` | 🆕 | **学员提交请假申请**；pending 态，待辅导员审批 |
| GET | `/api/me/leave-requests` | student | — | `LeaveRequest[]` | 🆕 | 学员查自己所有请假记录（含历史）|
| GET | `/api/coach/classes/:id/leave-requests` | class_tutor+ | `?status=pending` | `LeaveRequest[]` | 🆕 | 辅导员查本班请假列表，默认过滤 pending |
| POST | `/api/coach/leave-requests/:id/approve` | class_tutor+ | — | LeaveRequest→approved + cohortStatus→paused | 🆕 | **批准请假**（原子）：LeaveRequest.status=approved + ClassMember.cohortStatus=paused + EnrollmentStatusHistory 新记录 |
| POST | `/api/coach/leave-requests/:id/reject` | class_tutor+ | `{reason}` | LeaveRequest→rejected | 🆕 | **拒绝请假**；cohortStatus 不变 |
| POST | `/api/coach/leave-requests/:id/end` | class_tutor+ | — | cohortStatus→active | 🆕 | **结束请假**（提前或到期落库）：cohortStatus=active + EnrollmentStatusHistory 新记录；endDate 实时推算到期后辅导员确认落库（DR-90-A 模式）|

> 转专业 = 退出当前 + 加入另一（能力 2）**两步走，无平移端点**；两段历史各自独立，跨专业累计共享（D14a）仍生效。
> `paused` 独占语义：cohortStatus=paused 当且仅当有一条 status=approved 且 endDate≥today 的 LeaveRequest；无其他触发路径。endDate < today 时 paused 视为逻辑到期（实时推算），DB 字段由 `/end` 端点落库。
> **毕业（graduated）vs 升正科（advanced）**（DR-149）：`graduated`=第八学期学制走完（管理员手动批量结业、无实修门槛，大纲§573）；`advanced`=毕业且升学成功（能力 10 approve）。法王祈祷文/灌顶/完整内加行是升密法门槛、非毕业门槛（大纲§651）→ 欠账可 graduated 不可 advanced。毕业去向：升学（→advanced，能力10）/ 留级（→held_back）/ 转预科（退出+加入）/ 转功德会（❌ DR-68）。落班机制=邀请码两步走（DR-150）：approve 不建正科 ClassMember，管理员另发邀请码；`advanced` 为原预科成员永久终态；并行专业不级联（D9/D16）。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/me/programs` | 专业列表：在修/「已退出」灰显可展开看历史 | 退出二次确认；回归走邀请码（能力 2）记录自动衔接 | 🔧 改（加退出/已退出态）|
| 班级管理员 | `/coach/classes/:id/settings` | 留级入口（升学驳回后提示）+ 批量结业 + 班级归档 | reject→留级提示→加新班；第八学期末批量结业（全班→graduated）；本届清空后手动归档 | 🆕 |
| 学员 | `/me/leave-requests` | 我的请假记录（提交新请假 + 查历史）| 提交后等待审批；显示 pending/approved/rejected 状态 | 🆕 |
| 辅导员 | `/coach/classes/:id/leave-requests` | 本班请假审批队列 | 批准→学员进 paused；拒绝附原因；可提前结束请假 | 🆕 |

### 三端可见性
- **学员**：自己各专业状态（在修/已退出/留级/请假中/已毕业/已升正科）+ 状态变更史；可退出、可提交请假申请、可经邀请码回归。
- **辅导员**：可见本班成员状态；审批请假（批准/拒绝/结束）；**留级/归档限班级管理员+**。
- **班级管理员+**：留级（加新班）、班级归档、状态治理（含请假审批）。

### 大纲 & DR 关联 + 对齐备注
- 衔接能力 10（升学驳回触发留级）；D15（退出记录保留）/D18（永久留档）/D19（只归档不删）/D14a（跨专业共享）/DR-90-A（expired 实时推算）/DR-90-B（approved 期间不计入掉队窗口）/DR-102（能力 3/9 截止日顺延）/DR-149（毕业=时间事件、graduated≠advanced）。
- **🔵 业务规则落点**：① 班级只归档（D19）→ 无 delete API，`Class.status=archived`；② 退出记录保留（D15）→ `cohortStatus=left` 非物理删，历史只读可查；③ 留级手动（绝对约束4）→ 无自动留级，管理员经邀请码加新班；④ 缺席期补卡走能力 5 代行（退出期共修缺场可管理员补卡留痕）；⑤ **请假批准原子写 paused**（DR-90）→ `/approve` 端点同时写 LeaveRequest.status=approved + cohortStatus=paused + EnrollmentStatusHistory，三表同事务；⑥ **paused 独占语义**（08 §1.2）→ paused 当且仅当有效 approved LeaveRequest 存在，无其他触发路径；⑦ **到期实时推算**（DR-90-A 模式）→ endDate < today 时系统计算 paused 已到期，DB 落库由辅导员点"/end"确认；⑧ **毕业≠升密法**（DR-149）→ `active→graduated` 第八学期手动批量结业（无实修门槛，大纲§573）、`graduated→advanced` 升学审核通过（能力 10）；法王祈祷文/灌顶/完整内加行卡 advanced 不卡 graduated（大纲§651），二状态分离表达「达标未升学」与「升学成功」。
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
- **🔵 架构落点（关键）**：① **代行效果落地** = 有原生字段的写字段（isSubstituted/StudyRecord 补卡行/ExamGrade upsert）；**升学条件类豁免/调目标无原生字段** → 不建独立 override 表，由 `AdvancementCheck` 预检遍历 ProgramAdvancementConfig 时，对 `isExemptable=true` 的条件**回查 AuditLog 是否有未撤回的 active 代行记录**（match conditionKey），有则该条置满足。② **AuditLog 字段已就位**（08 §3.11 已封板：`operatorId`/`operatedAt`/`actionType`（含 `proxy_action`）/`targetType`/`targetId`/`payload`/`reason`/`classId`/`programId`）——代行的 `domain`/`targetKey`/依据 `basis`/撤回链 `revokesId` 归入 `payload` Json（`{before,after,domain,targetKey,basis,revokesId}`），**无需改 08 schema**（08 回填核对结论）。
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

## 能力 18 · 角色与权限  〔批6·权限（横切根基）〕

> 权威矩阵见 `02-roles-and-permissions-v1.md`；本能力是其 API 落地。

### 涉及表（08 落点）
`UserRoleAssignment`（🆕 线上无·替代旧 User.role 单值，`role` 四值 · `classId`/`programId` 作用域 · `@@unique(userId,role,classId,programId)` 一人多角色）· `RoleAssignmentHistory`（🆕 变更留痕 D18）· 旧 `User.role` 单字段 → 🔧 迁移（DR-113）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/admin/users/:uid/roles` | subject_admin+ | — | `UserRoleAssignment[]`（active）| 🆕 | 查某用户全部角色分配（一人多角色各条独立）|
| POST | `/api/admin/users/:uid/roles` | **按任命链** | `{role,classId?\|programId?}` | assignment | 🆕 | 任命；**任命链校验**：super←super / subject←super / class_admin·class_tutor←subject_admin 或 super；作用域字段按 role 必填 |
| POST | `/api/admin/role-assignments/:id/revoke` | 同级或更高 | `{reason}` | status=revoked | 🆕 | 撤销（不物理删 D18）；写 RoleAssignmentHistory |
| GET | `/api/admin/users/:uid/role-history` | subject_admin+ | — | `RoleAssignmentHistory[]` | 🆕 | 角色变更留痕 |
| ~~PATCH~~ | ~~`/api/admin/users/:id/role`~~ | admin | 单值改角色 | — | 🔧 | 线上单值 role 端点→**改造为多 assignment 体系**（DR-113 迁移：coach→class_tutor、admin→super_admin 后人工降级）|

> **权限判定核心（绝对约束1）**：中间件按**角色等级数值**比较（class_tutor=1/class_admin=2/subject_admin=3/super_admin=99），`userLevel >= requiredLevel` 放行，**不硬编码角色名**；同时校验作用域（classId/programId 匹配操作目标）。一人多角色取**满足该操作的最高有效角色**。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| super_admin / subject_admin | `/admin/users/:uid/roles`（角色管理）| 用户当前角色 + 任命/撤销 + 变更史 | 按任命链限制可授角色；撤销立即失效留痕 | 🆕 |

### 三端可见性
- **学员**：不涉及角色任命视图（student 非管理角色，P4 不强制互斥——学员可同时持管理角色，按角色进对应端）。
- **辅导员（class_tutor）**：**不能授权他人**（绝对约束4）；只在被授作用域内行使下级权限。
- **subject_admin / super_admin**：按任命链任命/撤销。

### 大纲 & DR 关联 + 对齐备注
- 被所有能力依赖（权限根基）；权威矩阵 02 文档；P4（身份不互斥）/D18 / DR-113（线上角色迁移）。
- **🔧 接缺口（DR-113 迁移）**：线上 `User.role` 单值 + 42 处 `admin` 守卫 → 改造为 UserRoleAssignment 多角色 + 作用域 + 等级判定；coach→class_tutor（**不自动给行政权**，过渡期辅导员暂无报数审核/邀请码/关怀），admin→super_admin 后人工降级 subject_admin。
- **✅ 决策（2026-06-01 拍板·选 B 废规则）角色无自动过期**：经核 06 规则 7「角色可设过期时间」与 08 `UserRoleAssignment`（只有 revoke、无 `expiresAt`）冲突——**确认废 06 规则 7**：角色不设自动过期，**仅手动 revoke**（status='revoked'），历史永久留痕（D18）。08 模型无需加 expiresAt；06 规则 7 已同步标废弃。

---

## 能力 19 · 班级邀请码  〔批6·入班〕

### 涉及表（08 落点）
`ClassInviteCode`（🆕 取代旧 `Class.joinCode` DR-81，`code` 唯一 · `status` 仅 active/revoked（**expired 实时算不入库** DR-80）· `expiresAt` 必填 · `maxUses`/`usedCount`）· 旧 `Class.joinCode`（🔧 保留兼容·不再生成新码）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/coach/classes/:id/invite-codes` | class_tutor+（只读）| — | 码列表（三态合成）| 🆕 | 辅导员只读（职能 #5 生成限 class_admin+）|
| POST | `/api/coach/classes/:id/invite-codes` | class_admin+ | `{expiresAt,maxUses?}` | `ClassInviteCode` | 🆕 | 生成；**expiresAt 必填**（D11 禁永久码，绝对约束1）|
| POST | `/api/coach/invite-codes/:id/revoke` | class_admin+ | — | status=revoked | 🆕 | 撤销立即生效，**不影响已加入学员**（绝对约束2）；留痕 D18 |

> **有效性校验（DR-80）**：`status='active' AND now() <= expiresAt AND (maxUses IS NULL OR usedCount < maxUses)`——三态（active/expired/revoked）展示层合成，expired 不持久化、不靠定时任务。码不可复用（绝对约束·过期/撤销需重新生成）。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 班级管理员+ | `/coach/classes/:id/settings`（邀请码区，与能力 2 同页）| 生成（设 expiresAt/maxUses）+ 列表（三态）+ 撤销 | 生成→复制码；撤销→status=revoked，已加入学员不受影响 | 🆕 |

### 三端可见性
- **学员**：不直接管理邀请码；用码加入见能力 2。
- **辅导员（class_tutor）**：只读本班邀请码列表（职能 #5，生成限 class_admin+）。
- **班级管理员+**：生成/撤销邀请码、查三态有效状态。

### 大纲 & DR 关联 + 对齐备注
- D11（邀请码唯一入口·必带时效）/DR-80（三态实时算）/DR-81（取代 joinCode）；被依赖：能力 2（加入唯一入口）、能力 11（留级/回归重新加入）。
- **🔵 业务规则落点**：① 必带 expiresAt（绝对约束1）→ 生成端点 Zod 强制；② 撤销/过期/超次只影响新加入（绝对约束2/3）→ 校验只在 join 时跑，不回溯已加入；③ 码不可复用 → 无「重新激活」端点，需重新生成。

---

## 能力 2 · 学员加入专业  〔批1 补·入班〕

### 涉及表（08 落点）
`ClassMember`（✅ 入班记录，`cohortStatus`/`joinedAt`/`isPrimary` 主班）· `User.primaryProgramId`（🆕 主修偏好·UI 级 DR-120，区别于主班 isPrimary）· `Program`（班级隶属「专业×届」，加入即归属）· `ProgramSemester.startsWeek`（A3 校验数据源·若启用，⚠️ 待定）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/enrollments/join` | student | `{code}` | `ClassMember` | 🔧 | 用邀请码加入：校验有效性（能力 19）→ **A3 选专业锁定校验 ⚠️ 待定（暂不含）**→ 写 ClassMember + usedCount++ + 归属 program；**幂等**（同人同班一条有效 enrollment，重复用码不重建，绝对约束4）|
| GET | `/api/me/enrollments` | student | — | 我的班级/专业列表 | 🔧 | 复用现状 `/api/my/enrollments`，叠加 program 归属 |
| PATCH | `/api/me/primary-program` | student | `{programId\|null}` | — | 🆕 | 设主修偏好（**仅 UI 默认视图/提醒，不影响任何业务规则**，绝对约束3）；可空 |

> **A3 选专业锁定校验 ⚠️ 待定**：大纲要求「第2学期起禁新选专业」（报告03 P0）。落点已厘清——可在本 join 端点零新字段实现（当前专业周次 ≥ ProgramSemester(S2).startsWeek 且无在修记录→409），可走能力 5 豁免。**用户决定暂缓，当前 join 不含此校验**。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/join`（输入/扫码加入）| 输入邀请码 → 校验 → 入班 | 无效码/过期/超次 → 对应错误提示（A3 选专业截止校验 ⚠️ 待定，暂不含）| 🆕 |
| 学员 | `/me/programs` | 我的专业列表（多专业平等）+ 设主修 | 设主修仅切默认视图 | 🔧 改（接能力 11 已退出态）|
| 班级管理员 | `/coach/classes/:id/settings`（邀请码区）| 生成/撤销/列表（三态）| 见能力 19 | 🆕 |

### 三端可见性
- **学员**：用码加入；查自己班级/专业（多专业完全平等）；设主修偏好。
- **辅导员**：只读邀请码（**不能生成**，职能 #5 限 class_admin+）。
- **班级管理员+**：生成/撤销邀请码。

### 大纲 & DR 关联 + 对齐备注
- D11（邀请码唯一入口）/P4（身份不互斥）/DR-80（三态）/DR-81（取代 joinCode）/DR-120（primaryProgramId）；被依赖：几乎所有学员侧能力、能力 11（留级/回归同走邀请码）。
- **🔧 接缺口**：线上 `Class.joinCode` 无时效 → ClassInviteCode 带 expiresAt/maxUses 取代（旧字段保留兼容不再生码 DR-81）。
- **🔵 业务规则落点**：① 加入后专业归属不可单方改（绝对约束1）→ 只能退出（能力 11），无「转专业平移」端点；② 多专业并行（绝对约束2）→ 一人多 ClassMember/program 各自独立；③ 主修可空且仅 UI（绝对约束3）→ primaryProgramId 不参与任何业务判定（DR-120：区别于主班 isPrimary）；④ **A3 锁定校验落本能力 join 端点**（能力 1 决策）。

---

## 能力 20 · 决策审计日志  〔批6·审计（基础设施）〕

### 涉及表（08 落点）
`AuditLog`（✅ 净资产·DR-118 改造，统一记录高权限操作：`operatorId`/`operatedAt`/`actionType`/`targetType`+`targetId`/前后快照/`reason`/`scope` class_id·major_id · **永不删不可编辑** D18）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| GET | `/api/admin/audit-logs` | subject_admin+ | `?actionType&targetId&from&to` | `AuditLog[]` | 🆕 | 平台/学科级查询；**super=全平台、subject_admin=本学科**（按 scope 过滤，能力 18）|
| GET | `/api/coach/classes/:id/audit-logs` | class_admin+ | `?actionType` | 本班 `AuditLog[]` | 🆕 | **class_admin 限本班**（绝对约束3 不可越权查他班）|
| GET | `/api/me/audit-logs` | student | — | 与自己相关条目 | 🆕 | **学员只查 targetId=自己**的代行/身份变更/成绩录入等（绝对约束4，不能查他人）|

> **写入非端点**（绝对约束·能力 20 规则6）：审计日志是**写入基础设施**——能力 5/8/9/10/11/12/15/17/18/19 执行高权限操作时**各自主动写入**（含前后快照 + reason），审计模块只提供读取面，不主动拉取。覆盖 11 类操作（代行/角色任命/成绩录入/升学审核/撤销出勤/补卡/身份认定/取消虚报资格/邀请码生成撤销/班级归档/传承灌顶代录）。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/me/profile`（学修例外记录·复用能力 5 视图）| 与自己相关的审计条目全文 | 只读（与能力 5 代行记录同源 AuditLog）| 🆕 |
| 班级管理员+ | `/admin/audit-logs` 或班级审计 tab | 审计日志列表（按作用域 + actionType 过滤）| 只读、不可编辑/删除 | 🆕 |

### 三端可见性
- **学员**：仅与自己相关条目（targetId=self），不能查他人。
- **辅导员**：通常无审计读权（高权限操作非其职责）；班级审计限 class_admin+。
- **班级管理员/subject_admin/super_admin**：按作用域逐级放大（本班 / 本学科 / 全平台）。

### 大纲 & DR 关联 + 对齐备注
- D18（全数据保留）底层基础设施；依赖能力 18（scope 过滤）；被能力 5/8/9/10/11/12/15/17/18/19 依赖。
- **🆕 接缺口**：线上仅举报处理写 AuditLog、无统一读取面 → 三级作用域读端点 + 学员自查全 🆕；AuditLog 字段集（operatorId/operatedAt/actionType/targetType/targetId/payload 前后快照/reason/classId/programId）**已在 08 §3.11 封板**，无需补（DR-118 冲突改造已落地）。
- **🔵 业务规则落点**：① 永不删不可编辑（绝对约束1）→ 无 delete/update 端点，修正走 upsert+新 AuditLog；② 作用域过滤（绝对约束3）→ 查询中间件按角色等级 + class_id/major_id 限定；③ 写入基础设施（规则6）→ 不在本能力建写端点，各能力操作内联写。

---

## 能力 21 · 自学模式  〔批7·自学〕

> ✅ 必做正式功能（DR-145，原 ⏸ 暂缓转必做，移入 §三实施·新 P6）。

### 涉及表（08 落点）
`UserSelfStudyProgram`（🆕 DR-145，`status` active/paused/completed/abandoned · `@@unique(userId,programId)` 一人一科系一条）· `Program`（科系，🔧 补 selfStudy 反向 TODO-5）· `PracticeLog`/`LessonCompletion`（复用·纯个人追踪，**不触发报数快照/升学**）

### API 契约
| 方法 | 路径 | 守卫 | 入参 | 出参 | 状态 | 说明 |
|---|---|---|---|---|---|---|
| POST | `/api/admin/students/:uid/self-study` | subject_admin+ | `{programId}` | `UserSelfStudyProgram` | 🆕 | **开通限科系级**（绝对约束2，学员不可自助）；无班级、不走邀请码 |
| GET | `/api/me/self-study` | student | — | 自学科系 + **纯完成量进度**（完成课时数/累计学修量）| 🆕 | 独立于班级：无截止/无掉队/无休息周 |
| PATCH | `/api/me/self-study/:id` | student | `{status:'paused'\|'active'}` | — | 🆕 | 学员自己暂停/恢复（仅 active↔paused）|
| POST | `/api/admin/self-study/:id/abandon` | subject_admin+ | `{reason?}` | status=abandoned | 🆕 | 标记放弃（科系级）；completed 由系统自动（全部课时完成）|

> **学修量录入复用既有**：念诵/观修走能力 7 `POST /api/me/practice-logs`、闻思完成走能力 3/37/39 `LessonCompletion`——**纯个人追踪，不生成升学报数节点快照（能力 9 不触发）、不进升学预检（能力 10）**。

### 页面/交互
| 端 | 路由 | 说明 | 关键交互/状态机 | 状态 |
|---|---|---|---|---|
| 学员 | `/me/self-study`（自学进度页）| 完成量进度 + 个人学修量录入 | 暂停/恢复；完成多少算多少，自定快慢 | 🆕 |
| subject_admin+ | `/admin/self-study` | 自学师兄开通/管理 | 开通/标记放弃 | 🆕 |

### 三端可见性
- **学员**：自己自学进度 + 录学修量 + 暂停/恢复；自学是「自我学习」、不通向升学。
- **辅导员**：不涉及（自学无班级）。
- **subject_admin+**：开通/放弃/管理本学科自学师兄。

### 大纲 & DR 关联 + 对齐备注
- DR-145（转必做·新 P6）/TODO-5（Program.selfStudy 反向）/DR-103（自学不统计共修）/D18；依赖能力 1/5/7；**不依赖** 能力 8/9/10/14。
- **🔵 业务规则落点（边界即设计）**：① 不升学（绝对约束1）→ 升学须先经能力 2 入正式班级，自学端点不接 AdvancementCheck；② 进度纯完成量、系统不判落后（绝对约束3）→ 无掉队/截止/休息周/补足逻辑，CohortLagSnapshot 不覆盖自学；③ 不报数（规则6）→ `/api/me/semester-snapshots`（能力 9）对自学返回空，进度只走本能力端点；④ 不进关怀清单（规则7）→ CareWatchlistItem 不为自学触发。

---

# 批 8 · 后台关键部分契约（⏸ 不做正式 UI · DR-145）

> 以下能力均 **⏸ 只做后台关键部分**（建表 + 后台逻辑），**不做正式前端 UI**。本批为盘点式契约——登记表 + 关键后台端点 + 状态，留作后台/将来参考。社交三件（22/23/24）属 P7 顺延群；AI（25）/ 徽章（38）后台保留不扩展。

## 能力 22 · 班级动态（班级内社交）  ⏸
- **涉及表**：`ClassPost`/`ClassPostReaction`/`ClassPostComment`/`ClassPostShare`（08 §5.1，⏸ 暂缓区）
- **后台契约**：发帖/评论/点赞/转发/删——CRUD 端点 🆕（暂不暴露正式 UI）。`student`（active 成员）发帖评论；删=作者或 class_admin+ **软删**（D18）；点赞 toggle **物理删行**（DR-50 明确例外）；**内容仅本班可见**。
- **可见性/约束**：仅本班；帖/评软删、点赞例外物删；依赖能力 2（成员）+ 18（越权删判定）。

## 能力 23 · 班级讨论（话题投票）  ⏸
- **涉及表**：`Discussion`/`DiscussionViewpoint`/`DiscussionVote`/`DiscussionComment`（08 §5.2，⏸）
- **后台契约**：创建话题（class_tutor+）/ 投票 / 评论 / 关闭 / 删评。**投票选项创建后不可增删**；**一人一票不可换投**（DR-53）；投票/评论限 `open` 话题；关闭=发起人或 class_admin+。
- **约束**：一人一票不可换投、选项不可事后改、投票评论不物删（D18）。

## 能力 24 · 约修（集体修持目标）  ⏸
- **涉及表**：`PracticeAppointment`/`PracticeAppointmentParticipant`（08 §5.3，⏸），关联 `PracticeProject`（修什么法）
- **后台契约**：创建（**任意 active 成员** DR-58）/ 加入 / 贡献打卡（`personalTotal+=n`→`currentTotal`）/ 取消（创建者或 class_admin+）/ 退出（`isActive=false` 不物删 DR-59）；达标→completed、到期→expired 自动关闭。**贡献打卡复用能力 4/6/7 PracticeLog 落点**（DR-144 app 外申报亦走此）。
- **约束**：仅本班；取消走 cancelled、退出走 isActive=false 均不物删（D18）。

## 能力 25 · AI 助手（25.A 问答 / 25.B 代操作 / 25.C 笔记加工）  ⏸
> AI 模块整体 ⏸（DR-109）：只做后台必要部分，暂不作正式用户功能；25.C 虽线上运行亦维持现状不扩展。
- **涉及表**：`AiConversation`/`AiMessage`（对话，25.B 扩展 `toolCall`/`actionResult` TODO-AI-2）· `ContentChunk`（法本向量索引）· `FeatureEntry`（功能导航目录）；用量**复用 `LlmCallLog`/`LlmProviderUsage`**（不新建 AiUsage，DR-110）。
- **25.A 问答（只读）后台契约**：RAG 检索全部已索引法本（DR-106，不限报名）→ LLM 带 `[n]` 引用；无依据**不 hallucinate**→导向辅导员；Rate Limit 30/日；PII 不出网；对话历史可**物理清空**（UI 工具记录·D18 例外）；辅导员「班级问答洞察」只聚合问题文本**不露姓名**；super_admin AI 配置中心（职能 #20·成本上限默认 $20/日·超额降级仅导航）。
- **25.B 代操作五铁律（DR-107·提前设计）**：① 权限不放大（只代用户本人有权操作，**管理员/辅导员高权操作永不代做**）② 只碰本人数据 ③ 写操作前**强制结构化确认卡** ④ 多专业必问归属（D14b 不豁免）⑤ 来源 `source=ai_assistant` 留痕。首批=录入类写（打卡 7/内加行 6/观修 4/约修 24/笔记）+ 全部只读查询；纠错沿用能力 9（落库后不可自改，走能力 5 修正）。**禁区**：代行豁免 5/升学审核·成绩 10/角色 18/撤销出勤·取消资格 8·9/邀请码 19/归档 11/状态变更/报数快照。**不进 AuditLog**（本质是用户本人操作非管理员代行），靠 source 标记 + AiMessage toolCall 追溯。
- **25.C 笔记加工**：✅ 线上运行（`/api/notes/llm-assist` 5 action），⏸ 维持现状不扩展。

## 能力 38 · 成就徽章  ⏸
- **涉及表**：`BADGES`（service.ts 代码常量·5 类 activity/streak/accuracy/mastery/breadth）+ `UserAchievementUnlock`（净资产·每用户每徽章一次）
- **现状（保留不扩展·DR-128）**：徽章定义无 DB 表（门槛函数派生）；进度从 UserAnswer/SM-2/streak 实时派生；`detectAndPersistNewUnlocks` 写解锁。cron 后台保留，**不作正式用户功能**（同 AI 调子）。

---

# 批 7 · 净资产层盘点（能力 26-51 · 多为 ✅ 已实现）

> 净资产=线上已实现、纳入设计的能力（DR-126）。本批盘点式登记：现有端点（audit/05）+ 表 + 状态。✅ 复用 / 🔧 改造（标 DR）/ 🆕 新建 / ⏸ 暂缓。**正式页面均已上线或为现状**，不重述交互。

### A 组 · 学习引擎（32-36，✅ 已上线）
| 能力 | 现有端点 | 状态 |
|---|---|---|
| 32 题库答题 | `/api/lessons/:id/questions` · `/api/answers` · `/api/questions/:id` | ✅ |
| 33 SM-2 复习 | `/api/sm2/due` `/stats` `/review` | ✅ |
| 34 错题本 | `/api/quiz/smart-practice`（错题维度）| ✅ |
| 35 收藏夹 | `/api/favorites[/count]` | ✅ |
| 36 笔记与高亮 | `/api/notes[/*]` · `/api/lessons/:id/highlights` | ✅（37 阅读器已详述衔接）|

### 运营内容（40/41/46，✅ 已上线 · 42 见通知组）
| 能力 | 现有端点 | 状态 |
|---|---|---|
| 40 藏历日历 | `/api/calendar/*` · `/api/admin/calendar/:date` | ✅ |
| 41 月度画报 | `/api/posters/*` · `/api/admin/posters/*` | ✅ |
| 46 法会展示+发愿 | `/api/assemblies[/:id]` · `/api/admin/dharma-assemblies[/:id]` | 🔧 DR-134（统一 DharmaAssembly 废 Event/EventCount）|

### 通知与触达（D 组 42-45 + 29/30）
| 能力 | 现有端点 | 状态 |
|---|---|---|
| 42 系统公告（B3）| `/api/system-announcements[/:id]` · `/api/admin/system-announcements[/*]`（含 revoke）| ✅ |
| 43 通知中心与派发（D1）| `/api/notifications[/*]` · `/api/push/*`（VAPID/subscribe）| ✅（合站内信/WebPush/偏好）|
| 44 定时通知规则（D2）| scheduler/cron（**9 条新规则** DR-131/133）| 🆕 [^44] |
| 45 短信通道（D3）| 短信发送层 + dispatch 第3通道 · `SmsLog` | 🆕 DR-132/139 [^45] |
| 29 个人智能提醒 | 复用 43 通知 + scheduler（按时区时段）| 🔧 |
| 30 成就解锁通知聚合 | 延迟聚合 cron（随徽章 38）| ⏸ DR-128（后台保留不做正式）|

### 账户与安全（C 组 47-49 + 28）
| 能力 | 现有端点 | 状态 |
|---|---|---|
| 47 账户体系（C3）| `/api/auth/*`（register/login/refresh/logout…）| 🔧 DR-135（加 Google 登录 + 硬单设备）|
| 48 个人档案（C4）| `/api/auth/me` · `PATCH /api/auth/me` | 🔧 DR-136（暴露 birthDate/phone/city + 新增 gender；birthDate=60 岁豁免源）|
| 49 设置与隐私（C5）| 设置/隐私 toggle · `DELETE /api/auth/me`（软删）| 🔧 DR-137（注销软删符合 D18，仅清登录凭证不删档案）|
| 28 设备与会话管理 | 会话列表 + 主动登出其他设备 | 🆕 DR-135（配合硬单设备策略）|

### 举报与反馈（50/51）+ 学习辅助（26/27/31）
| 能力 | 现有端点 | 状态 |
|---|---|---|
| 50 内容举报闭环 | `/api/reports` · `/api/notes/reports[/*]` · `/api/admin/reports/*` | ✅（QuestionReport/NoteReport）|
| 51 用户反馈 | `/api/feedback` · `/api/me/feedback` · `/api/admin/feedback` | ✅ DR-138（bug/建议统一一表 kind 区分）|
| 26 综合修学积分排行 | `/api/classes/:id/meditation-ranking`（现状单维）| 🔧 [^26] |
| 27 综合活动列表 | `/api/my/upcoming-events` · `/api/my/top-home-card` | ✅（聚合共修/法会/纪念日）|
| 31 辅导员 AI 出题与批量导入 | 批量导入 ✅ / AI 出题 ⏸（随 AI 25 暂缓 DR-109）| 🔧/⏸ |

[^44]: 9 条规则=①进度落后 ②未完成班级任务 ③未完成个人任务 ④班级放假/休息周 ⑤闻思未圆满 ⑥复习到期 ⑦讲考/考试临近 ⑧升学/关怀结果 ⑨上课迟到（推送+短信）。数据源跨能力 3/14/33/8/10。
[^45]: 唯一新建净资产；User+phone 体系 + 短信发送层 + dispatch 第3通道；用途=兜底+关键学修提醒；⚠️ 服务商选型挂 TODO-SMS（实现期定，非业务决策）。
[^26]: 现状仅观修单维排行；能力 26 要多维加权（综合/念诵/观修 × 周/月/全部），需扩展聚合端点 `/api/classes/:id/ranking?dim=&period=`。

---

# 09 收官 · 全 51 能力覆盖完毕

> **覆盖**：能力 1-25 正式契约（16=❌不做，22-25=⏸后台契约）+ 26-51 净资产盘点 + 学习引擎 37/38/39。**API 契约层 + 页面/交互层（SoT 第三层）首轮完整**。
>
> **决策记录**：①A3 选专业锁定 → **⚠️ 待定**（2026-06-02 用户暂缓，报告03 P0 仍 open）②C3/C4/C5 互斥+自选功课 → **config 驱动·零新字段**（DR-148）③E1/E2 → **不记录·走建课课表配置**（DR-146）④角色无 expiresAt 选 B（DR-147·已回写 06）。
>
> **08 回填结论（2026-06-02 执行·核对完毕）：本轮 08 无 schema 改动**。逐项核对：① A3 → ⚠️ 待定（用户暂缓，且实现可零新字段）；②③ C3/C4/C5 → 走 `ProgramAdvancementConfig.params`（已 Json）+ config 引用判定，**零新字段**；④ AuditLog 代行/审计字段 → 08 §3.11 早已封板，代行细节归 `payload` Json，**无需补**；primaryProgramId 已在 08。**结论：08 维持现状，仅 09 措辞对齐既有结构（本次提交）。**
>
> **缺口边设计边接（汇总）**：A3 选专业锁定（能力1 ⚠️ 待定·零字段可实现）· C3/C4 互斥（能力7 ✅ ProgramAdvancementConfig.params·零字段）· C5 自选功课（能力7 ✅ config 引用判定·零字段）· **E1/E2 月度共修频率（能力8 ✅ 不记录·走建课课表配置·DR-146）** · WP-A 报数UI（能力9 ✅补齐）· DR-127 完成机制统一（能力37 🔧）· DR-129 幻影表（能力39 🆕）· DR-99 开闭卷分支（能力10 🔵）。
>
> **下一步候选**：① 给已拍板决策（E1E2 选C / 角色废 expiresAt·已回写06 / C3C4C5 config 驱动）进 `05-decision-log` 分配 DR 编号；② A3 待定项专项处理（报告03 P0）；③ 回头精修任一能力契约。待你定。
