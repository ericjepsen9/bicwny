# 升学 / 毕业模块设计现状（供外部审查）

> 生成日期：2026-06-04
> 分支：claude/keen-hamilton-62SdY
> 适用范围：加行预科升密法正科的完整升学判定与操作流程，含重构后直接查询架构

---

## 一、判定对象

### 1.1 两套判定，含义完全不同

| 状态 | 含义 | 触发条件 | 实修门槛 |
|---|---|---|---|
| `graduated`（毕业）| 第八学期学制走完 | 管理员手动结业 | **无**——时间事件，走完学制即毕业 |
| `advanced`（升密法）| 毕业后升入正科 | 管理员审核通过6条件 | **有**——下方6项硬条件全满足 |

> **关键区分**：法王祈祷文 / 灌顶 / 完整内加行是**升密法门槛，不是毕业门槛**（大纲§651）。欠账学员可以毕业，但不能升密法。

### 1.2 条件清单

**毕业（graduated）**：无条件清单。管理员手动操作，走完第八学期即可结业，无实修门槛。

**升密法（advanced）的6项硬条件**：

| # | conditionType | 业务含义 |
|---|---|---|
| 1 | `course_completion` | 全部法本听 / 看 / 答题圆满 |
| 2 | `practice_session` | 92修法各法各满足座数+时长双维度 |
| 3 | `cumulative_count` | 内加行各项（顶礼、心咒等）各累计10万 |
| 4 | `attendance` | 共修实到课次≥配置门槛（如93次）|
| 5 | `exam_score` | 升学考线下考试合格 |
| 6 | `transmission` | 灌顶传承记录到位 |

---

## 二、计算逻辑（每条怎么算"满足"）

### 2.1 各条件查什么数据、什么范围

#### course_completion（课程闻思圆满）
- **数据源**：`LessonCompletion` 表（听/看/答题完成记录）
- **范围**：**本专业 + 本人**，必须过滤 `programId`——A专业的闻思记录不能满足B专业的升学条件
- **达标标准**：每课时听≥1遍 + 看≥1遍 + 答题全通过（视障免答题只需听≥2遍；听障免答题只需看≥2遍）
- **整体达标**：全部课时100%覆盖，一课时未满足即整体不通过

#### practice_session（92修法）
- **数据源**：`PracticeLog` 表，按修法项目（`meditationId`）分组
- **范围**：**本人全量**，不过滤专业；仅计起修日（`UserPracticeVow.createdAt`）之后的记录
- **达标标准**：92种修法各自满足"座数≥3 + 时长≥90分钟"，且全局总座数≥276、总时长≥8280分钟（双维度独立达标）
- **source不过滤**：app内打卡（`in_app`）与线下申报（`external`）同等计入

#### cumulative_count（内加行各项累计）
- **数据源**：`PracticeLog` 表，按项目 `SUM(count)`
- **范围**：**全量跨专业聚合，不过滤专业/发愿**（见2.2）
- **过滤**：仅排除管理员标记作废（`ritualCompliant=false`）的记录

#### attendance（共修出勤）
- **数据源**：`StudyRecord` 表，`studyType='group_attend'`
- **范围**：**当届班级**（`cohortStatus='active'` 的 ClassMember 对应班级）——留级后历史出勤不自动累入；前届已满足的管理员可以豁免
- **只计实到**：不计补课回看（`group_review`）、总结课（`group_summary`）

#### exam_score（升学考）
- **数据源**：`ExamGrade` 表，由 `subject_admin` 在后台手工录入，不经 app
- **分支逻辑**：出勤≥93次 → 1次≥30分合格；出勤不足 → 开卷≥72分或闭卷≥60分，或2次各≥30分
- **年龄豁免**：60岁以上系统标 `ageEligible=true` 提示，**不自动通过**，管理员手动豁免

#### transmission（灌顶传承）
- **数据源**：`TransmissionRecord` 表，`isRequired=true AND status='active'`
- **说明**：传承记录只由管理员后台录入，无学员自报路径

---

### 2.2 累计型条件的跨专业聚合范围

`cumulative_count`（内加行各项）和法王祈祷文 `prayerCount`：**跨专业全量聚合，不过滤 `programId` 也不过滤 `vowId`**。

依据：大纲精神"念一份算多份"——同一学员在A专业顶礼的10万，在B专业的升学预检里同样计入，功德不因专业归属被拆分。靠 `practiceProjectId + userId` 识别修持项目，不加专业过滤。

> 注意：管理员标记 `ritualCompliant=false`（仪轨不合规/作废）的记录，排除在预检聚合之外。

---

### 2.3 法王祈祷文替代路径（isSubstituted）

**正常路径**：累加 `PracticeLog.prayerCount`（顶礼时同次录入），全量跨专业，≥10万满足。

**替代路径**（心咒代替顶礼，大纲§649）：
- 顶礼 `UserPracticeVow.isSubstituted=true`
- 系统通过 `substitutionFor` 字段找到对应心咒 vow
- 核查该心咒 vow 的 `currentCount ≥ 2,000,000`
- **成立** → 顶礼 ✅ + 法王祈祷文 ✅（一因两果，双豁免，无需再算 prayerCount）
- **不成立** → 两项均 ❌

---

### 2.4 实时查原始数据（不经快照）

管理员触发预检时，系统直接查：
- `PracticeLog`（修持打卡）
- `LessonCompletion`（闻思完成）
- `StudyRecord`（共修出勤）
- `TransmissionRecord`（传承灌顶）
- `ExamGrade`（考试成绩）

**不经过任何快照中间层**（DR-162 重构）。快照表（SemesterSnapshot）保留但只服务报数汇总展示，与升学判断解耦。

---

## 三、管理员操作

### 3.1 手动升班的具体动作（两步走）

**第一步：管理员后台拍板**
- 审核预检报告 → 点 approve
- 系统写入 `AdvancementRecord`
- 原预科 `ClassMember.cohortStatus`：`graduated` → `advanced`
- 写 `EnrollmentStatusHistory` 留痕
- 此刻学员还未进入正科班

**第二步：管理员另发正科班邀请码**
- 学员用邀请码走普通入班流程（能力2），建立正科班 `ClassMember`

> 设计原因：正科班不一定与预科结业同步开班，强制同步会卡流程；与留级走邀请码的机制保持对称。

---

### 3.2 升班后原预科 ClassMember 的状态

原预科 `ClassMember.cohortStatus` 永久停留在 `advanced`，不再变化。原预科班的全部学修记录、升学记录保留（D18不物理删除）。正科班是全新的 `ClassMember`（`cohortStatus=active`），两条记录独立存档。

---

### 3.3 多专业学员——升其中一个专业

其余专业完全不受影响，不级联，各走各的生命周期。"正科密法 + 预科净土跨阶段并存"是合法状态。每个专业的升学条件各自独立判定，各自独立走审核流程。

---

## 四、历史与留证

### 4.1 条件满足情况的永久快照

`AdvancementRecord.conditionsSnapshot`：管理员拍板那一刻，6条条件的满足情况（actual值、passed/exempted状态）完整冻结写入，写入后不可修改（DR-83-B冻结原则）。

半年后即使原始数据变化，这份快照仍忠实记录"当时升学依据是什么"。预检报告（`AdvancementCheck`）本身也永久留档，不物理删除。

---

### 4.2 AuditLog 留痕

| 动作 | actionType | 记录内容 |
|---|---|---|
| 管理员拍板升学/驳回 | `advancement_decision` | 操作人、pass/reject、时间、备注 |
| 管理员豁免某条件 | `proxy_action` | 操作人、豁免原因、被豁免条件 |

豁免动作同时更新 `checkResults` 里该条件的 `exempted=true / exemptedBy / exemptedAt`，与 AuditLog 双重留痕（D17代行留痕要求）。

---

## 五、与旧设计的差异

1. **去掉 SemesterSnapshot 作为升学判断中间层**。旧设计升学预检要先读快照汇总值，现在直接查原始表，少一层不一致风险。快照表保留只服务报数展示，与升学判断解耦（DR-162）。

2. **毕业（graduated）和升密法（advanced）语义分离**。旧设计用同一个 `graduated` 兼表两件事，新设计7态状态机明确区分"走完学制"和"升入正科"，法王祈祷文欠账学员可毕业但不可升密法的场景可以准确表达（DR-149）。

3. **落班机制改为邀请码两步走**。旧设计升学同时建正科 ClassMember，新设计 approve 只写预科侧（→advanced），管理员另发邀请码，开班时间可异步，与留级机制对称（DR-150）。

4. **累计型条件明文跨专业全量聚合，闻思圆满明文按专业隔离**。旧设计两者口径未明文，实现时易混。新设计 LessonCompletion 加 `programId` 字段（必填）实现闻思隔离；cumulative_count 预检明文不过滤 programId（D14a"念一份算多份"落纸面，DR-157/DR-158）。

5. **6个预检查询边界条件全部明文**。起修日过滤（practice_session）、当届出勤口径（attendance）、仪轨合规过滤（cumulative_count / prayerCount）、source不过滤（practice_session）、prayerCount与cumulative_count口径对齐——旧设计这些边界均靠开发者自行理解，存在 false-positive / false-negative 风险（ISG-1~12 扫描，DR-158~DR-167）。

---

## 附：涉及数据表

| 表 | 用途 |
|---|---|
| `ProgramAdvancementConfig` | 6条升学条件配置（conditionType / params / targetValue / isExemptable）|
| `AdvancementCheck` | 系统预检报告（逐条判定结果 checkResults JSON）|
| `AdvancementRecord` | 管理员拍板记录（conditionsSnapshot 冻结快照）|
| `PracticeLog` | 修持打卡（cumulative_count / practice_session 数据源）|
| `LessonCompletion` | 闻思完成（course_completion 数据源）|
| `StudyRecord` | 共修出勤（attendance 数据源）|
| `TransmissionRecord` | 传承灌顶（transmission 数据源）|
| `ExamGrade` | 考试成绩（exam_score 数据源）|
| `AuditLog` | 升学决策 + 豁免操作留痕 |
| `EnrollmentStatusHistory` | cohortStatus 变更链路留痕 |
