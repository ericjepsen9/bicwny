# 觉学 · 验收清单（能力可测试标准）

> 状态：进行中（2026-05-31 创建）
> 用途：每条能力的可测试验收标准，来源 = `decisions/06` 各能力「绝对约束」+ 关键 DR。
> 用法：实现某能力后逐条勾验；⏸ 暂不上线项验收延后。

---

## 能力 1 阶段与专业体系 🆕
- [ ] 阶段仅 preke/zhengke，代码层常量不可增第三级
- [ ] 专业为数据，super_admin 后台新增即时生效，不改代码
- [ ] 同专业不同届可有不同规则

## 能力 2 学员加入专业 🔧
- [ ] 凭邀请码入班即归属该班专业；可加多班 = 多专业并行
- [ ] 邀请码过期/撤销后不可用（见能力 19）

## 能力 3 闻思学习与圆满 🔧
- [ ] 圆满 = 听（音/视频任一）≥1 + 看 ≥1 + 答题，应用层聚合
- [ ] 盲走纯听≥2、聋走纯看≥2 分支（StudentSpecialStatus）
- [ ] 课程 courseType（entry/formal/restricted）与 category 正交

## 能力 4 加行观修 ✅+🆕
- [ ] 视频/PPT 引导页面保留，看视频排行（count/totalSec）不变
- [ ] 「完成观修」按钮提交座时间 → 写 PracticeLog（手动，不自动）
- [ ] 单座 <30 分钟不计、不合并；座数 COUNT + 时长 SUM 双维度
- [ ] 单修法 ≥3 座且 ≥90 分钟；总计 ≥276 座且 ≥138 小时
- [ ] AdvancementCheck 按 meditationId 分组判 92 修法逐法达标

## 能力 5 管理员代行 🔧
- [ ] class_admin+ 可豁免/替代/调整/修正学员档案
- [ ] 每次代行写 AuditLog（operator/target/reason），学员+管理员双方可见
- [ ] 代行记录永不物理删除（D18）

## 能力 6 内加行实修 🔧
- [ ] 6 项各 10 万累计；跨专业共享豁免（D14a）
- [ ] 法王祈祷文独立计数（prayerCount），SUM ≥100,000 即满足
- [ ] 心咒代顶礼时顶礼 vow 标 isSubstituted，预检跳过改查心咒

## 能力 7 日常实修打卡 🔧
- [ ] 频率型（daily/weekly）；跨专业独立打卡不豁免（D14b）
- [ ] 多专业录入须明确归属专业，不擅自归并

## 能力 8 共修与出勤 🆕
- [ ] 签到窗口以 token 生成时刻为基准 + checkinGraceMinutes
- [ ] 学员自助选自己出勤；请假 approved 期间不计入掉队窗口

## 能力 9 学期报数 🆕
- [ ] 节点快照 SemesterSnapshot 冻结不可改，更正走 AuditLog
- [ ] 虚报须先走忏悔（ReportConfession）才能取消资格

## 能力 10 考试与升学 🆕
- [ ] 升学条件 ProgramAdvancementConfig 数据化，6 类 conditionType
- [ ] 考试线下进行，成绩 subject_admin 后台录入 ExamGrade
- [ ] 升学硬条件不放宽（D13）；预检逐条可豁免 + 留痕
- [ ] 多专业可独立升学（各自满足条件）

## 能力 11 留级/退出/转专业 🔧
- [ ] 状态机 active/paused/held_back/graduated/left
- [ ] 退出记录保留可查（D15）；班级只归档不删（D19）
- [ ] 每次状态变更写 EnrollmentStatusHistory（append-only）

## 能力 12-14 特殊身份/辅助员/关怀清单 🆕
- [ ] StudentSpecialStatus：同人同类型仅一条 active（@@unique）
- [ ] AssistantAssignment：辅助员独立表，固定权限集 + 禁区
- [ ] CareWatchlistItem：同人同类型仅一条 active（partial unique）

## 能力 15/17 传承/灌顶 🆕
- [ ] TransmissionRecord 记传承；密法访问改 EXISTS on TransmissionRecord
- [ ] 升密法前灌顶可追溯（D4）

## 能力 16 传承法会 ❌
- [ ] 不做（功能取消）

## 能力 18 角色与权限 🔧+🆕
- [ ] 4 角色 + 等级继承（canDo 等级比较）
- [ ] UserRoleAssignment 多角色 + 作用域；任命写 RoleAssignmentHistory
- [ ] 265 处 requireRole 全部迁到等级判定，无遗漏误拒

## 能力 19 班级邀请码 🔧
- [ ] ClassInviteCode 带 expiresAt/maxUses/status；expired 实时算
- [ ] 校验：active AND now≤expiresAt AND (maxUses null OR used<max)

## 能力 20 决策审计日志 🔧
- [ ] 11 类高权限操作全覆盖；AuditLog 裸 String 无 FK，自包含

## 能力 21 自学模式 🆕（DR-145 转必做）
- [ ] subject_admin+ 开通自学（学员不可自助）；无班级、不走邀请码
- [ ] 进度=纯完成量，独立班级（无截止/掉队/休息周/补足）
- [ ] 不触发报数快照（能力 9）、不进升学预检（能力 10）、不进关怀清单（能力 14）
- [ ] 状态机 active/paused/completed（自动）/abandoned；记录不物理删（D18）

## 能力 22-24 社交三件套（班级动态/讨论/约修）⏸（DR-145 后台 only·验收延后）
- [ ] 建表+后台逻辑封板，不做正式前端 UI；验收延后

## 能力 25 AI 助手 🔧+🆕+⏸
- [ ] LLM 调用复用既有网关（dharma_qa/feature_nav 两场景）
- [ ] AiUsage 不新建，限流/成本走 LlmCallLog/LlmProviderUsage
- [ ] 25.A 法义必带 RAG 引用；25.B 写操作强制确认 + source=ai_assistant
- [ ] 25.C 笔记加工严禁碰法义、仅本人笔记
- [ ] 整体暂不作正式功能上线（验收延后，仅后台必要部分）

---

## 横切验收
- [ ] 三端分离：学员端纯消费，管理走 /coach、/admin
- [ ] D18：所有关键事件 append-only，无物理删除（对话历史为明确例外）
- [ ] 净资产（题库/SM2/通知/成就/藏历/笔记…）改造后仍可用

---

## 变更记录
| 日期 | 内容 |
|---|---|
| 2026-05-31 | 创建验收清单，覆盖能力 1-25 + 横切，来源 06 绝对约束 + 关键 DR |
