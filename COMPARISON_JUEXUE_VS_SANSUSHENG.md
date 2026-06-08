# 觉学 vs 三殊胜 · 功能与数据库完整对比

> 生成日期：2026-05-24  
> 来源：三殊胜 5 份设计文档（架构决定 #170-187 · PRD v4.1 · 原则文档 · 技术栈文档 · 术语表）  
> 说明：两个项目技术栈不同（觉学 = React Web + Fastify + Prisma；三殊胜 = React Native + Supabase），本文档聚焦业务功能与数据模型的差异，不含框架迁移细节。

---

## 目录

1. [新增功能](#一新增功能)
2. [修改功能](#二修改功能)
3. [数据库改动](#三数据库改动)
   - [新增表（37张）](#新增表)
   - [需修改的现有表](#需修改的现有表)
   - [废弃的表](#废弃的表)
   - [新增函数与触发器](#新增函数与触发器)
4. [目前项目有、新项目不做的功能](#四目前项目有新项目不做的功能)

---

# 一、新增功能

## 1. 双模式学习系统

目前项目的自学只是 `UserCourseEnrollment.source='self'`，新项目是独立的系统。

- **班级模式**：跟 cohort 学，start_date + 班级休息周，算法实时算"本周第 N 课"
- **自学模式**：完全独立，个人 start_date + 个人休息周，无共修/讲考/主麦关怀
- **混合模式**：同时跟班 + 自学不同科系
- 新增 `profiles.learning_mode` 字段（class / self_study / both）
- 新增 3 张表：`cohort_rest_weeks`、`user_self_study_rest_weeks`、`user_self_study_programs`
- 新增 SQL 函数 `get_current_lesson_number()`（算法跳过休息周）

---

## 2. 修持愿系统（7 状态机）

目前项目 `PracticeEntry` 是简单打卡记录（无目标/无状态机）。新项目是完整的发愿-执行-审计体系：

- **`user_practice_vows`**：发愿表，含 target_count / start_date / current_end_date / pace_history / 7 状态机
- **7 个状态**：on_track / slightly_behind / falling_behind / at_risk / will_overdue / completed / paused
- **三套算法**：weekly 类 / daily 类 / 有截止日类（自动切换）
- **暂停机制**：paused_at / paused_by / paused_reason / resumed_at（师兄自助，无审批）
- **节奏历史**：`pace_history jsonb`（每次调整自动记录）
- **Auto 愿**：入班按模板自动建；**Custom 愿**：完全自定义
- **班级模板库**：`practice_templates` + `cohort_recommended_templates` 两张表
- Trigger：主麦改 `current_end_date` 自动写 audit_logs

---

## 3. 打卡审核态机制

目前项目打卡无锁定机制。新项目：

- `study_records` + `practice_logs` 各加 3 字段：`is_confirmed` / `confirmed_at` / `confirmed_by`
- 未确认 = 师兄随时可改/删；主麦确认后锁定
- **study_records**：每周审一次；**practice_logs**：每半学期审一次
- 新增 **A9 审核中心屏**（主麦端，批量确认）
- 可取消确认，每次操作写 audit_logs

---

## 4. 每日修持日记

- 新增 `daily_practice_journals` 表（每人每天最多 1 篇）
- 可见性：private / visible_to_zhumai
- 与 `practice_logs.reflection`（每座即时记）双层独立，S14 屏查看时聚合显示

---

## 5. 集体回向系统（S20）

- **法会回向**：某次法会，各自发愿（愿挂 event_id），结束后总和回向，只看总数
- **每周回向**：每周汇集全班 + 全会层总数回向，只看总数不显个人
- 复用 `events` 表 + 新增 2 个聚合视图（`v_event_dedication_totals` / `v_weekly_dedication_totals`）
- 每周回向直接聚合 `practice_logs`，不经过愿层

---

## 6. 约修系统（S21）

- 新增 `practice_appointments` 表（师兄发起约修）
- 加入约修 = 系统自动建一条 custom 愿（含 `appointment_id`）
- 打卡走现有愿系统，无审批、无推送、不比先后
- 形态待定（文档标注 TODO）

---

## 7. 打卡报数文本生成（S22）

- 打卡后一键生成今日修持报数文字
- 复制到 WhatsApp 群（仅文本，非自动发送）
- 密法不参与生成
- 无新增表，纯前端功能

---

## 8. 班级周观修建议

- 新增 `program_week_practices` 表（哪周建议修哪个法）
- 涵盖 92 修法 / 上师瑜伽 / 其他 weekly 类
- admin 在 M4 排表导入时设定；师兄端 S11 屏默认选中第一个建议，可改

---

## 9. 掉队检测状态机

- 4 级状态：on_track / slightly_behind / falling_behind / at_risk（纯 SQL 规则，非 AI）
- 触发：闻思 ≥4 周无进度 → at_risk；修行指标 <8 天 → at_risk
- 爱心师兄 C1 关怀名单按 at_risk 优先级排序
- 师兄端完全不可见，仅管理者可见

---

## 10. 讲考场次系统

- 新增 `speaking_sessions` 表（班级讲考场次）
- 3 种打卡类型：speaking_present（主讲）/ speaking_question（提问）/ speaking_observe（旁听）
- 3 选 1 互斥（部分唯一索引保证）
- 审核态（每周审一次）

---

## 11. 共修场次系统

- 新增 `group_sessions` 表（班级共修场次，含 scheduled_at / session_end_at）
- 打卡类型：group_attend / group_absent（2 选 1 互斥）+ group_review / group_summary（可选）
- 审核态（每周审一次）
- 升密法 93 次共修出勤硬指标依赖此表

---

## 12. 18 本自学读物系统

- 新增 `self_study_books` 表（18 本《大学演讲系列》种子数据）
- 新增 `self_study_records` 表（打卡：not_started / reading / completed）
- 新增 `program_week_self_study` 表（周 ↔ 书的映射）
- S18 自学读物屏（新前端页面）
- 班级师兄必读（限制性学修）；自学师兄可选参考

---

## 13. 批量补录模式

- S6/S7 屏加批量补录功能，一次性勾选多节课的 listen / read_notes
- 每学期 2 次报数用途
- 仅适用于闻思类，修持类不允许补打（原则 6）
- 无新增表，前端功能

---

## 14. 关怀跟进记录

- 新增 `care_followups` 表（爱心师兄填写电话跟进记录）
- RLS 严格：师兄完全不可见
- 包含：contacted_at / summary / follow_up_status

---

## 15. 三殊胜精神框架

- **发心语**：打卡/学修前一句轻量发心语（可关闭，用户偏好字段）
- **收尾回向**：打卡后可选回向（前端 UI，可选）
- **功德回向统计**：S13 屏改名，累计修量以"可回向功德"视角展示

---

## 16. 学号自动生成

- `profiles.student_id` 字段：格式 `{加入年份}{3位顺序}`（如 2026001）
- Trigger 在 profiles INSERT 时自动生成
- 批量植入老学员时沿用 Sheets 原学号

---

## 17. 密宗白名单直接管理（无申请流程）

- `tantric_access_grants` 表：admin 在 M7 屏直接 INSERT/DELETE
- 未授权师兄访问密法课 → API 返回 404（0 痕迹）
- 退班不联动密法权限
- 每次操作自动写 audit_logs

---

## 18. 班级休息周管理（M9 屏）+ 自学师兄管理（M10 屏）

- M9：admin 加/删班级休息周，全班算法自动调整
- M10：全局查看自学师兄进度、状态，可改 status

---

## 19. 课程多讲者结构

- 新增 `lesson_resources` 表（一节课挂任意多条讲解，每条含讲者名+视频+音频+讲记+排序）
- 新增 `practice_guides` 表（观修引导：practice_id / content_number / video_url / guide_text / 排序）
- `course_lessons` 加 `source_text` 字段（法本原文正文）
- 无"讲者角色"字段，尊称直接写进讲者名

---

## 20. 四层时区策略

- `cohorts` 表加 `city` + `timezone` 字段（IANA 标准，如 America/New_York）
- 班级集体活动按 `cohort.timezone` 显示
- 藏历殊胜日固定 UTC+8
- 个人打卡跟手机时区
- admin 创建班级时选城市（8 个预设）

---

## 21. 排表模板系统

目前项目无课程排表概念，新项目有完整模板体系：

- `program_semesters`（学期模板）
- `program_weeks`（周模板，含课程内容序号 + is_holiday）
- `program_week_courses`（周 ↔ 课程）
- `program_study_types`（各系打卡要求声明，数据驱动）
- M4 Excel 排表导入功能

---

## 22. OTP 认证 + 批量植入老学员

- 认证改为 Supabase Auth OTP（邮箱验证码，无密码）
- M8 屏批量植入老学员（CSV 导入，预激活邮箱）
- `profiles.data_source` 字段（self_register / imported / admin_created）
- Trigger：auth.users 新建时自动建 profile

---

## 23. 组织层级新增

目前项目无 Academy（学会）和 Program（科系）层级：

- 新增 `academies` 表（学会层）
- 新增 `programs` 表（科系层，如加行/净土/入行论）
- `cohorts` 表（届，比现有 Class 表更完整）

---

## 24. 修法内容库

- 新增 `practice_contents` 表（92 修法等观察修的内容列表）
- 92 修法打卡必须选 `practice_content_id`（第几法）

---

## 25. 法会活动

- 新增 `events` 表（法会活动，含 event_type / start_date / end_date / is_active）
- 与集体回向系统结合使用
- 目前项目的 `DharmaAssembly` 是类似概念但用途不同

---

# 二、修改功能

## 1. 角色系统重构

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| 角色数 | 3（admin / coach / student） | 4（admin / 主麦zhumai / 爱心aixin / 师兄） |
| coach 拆分 | 单一 coach | 主麦（班级管理+讲考）+ 爱心师兄（关怀跟进） |
| admin 入口 | /admin/* 独立 Shell | 末学 Tab → 系统管理 → admin dashboard |
| 班级管理员 | ClassMember.role='coach' | 独立 `class_admins` 表 |

---

## 2. 题目系统大幅简化

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| 题型数量 | 14 种 | **1 种（文字简答）** |
| 参考答案 | `Question.payload.referenceAnswer`（内嵌 JSON） | `question_references` 独立表（全局唯一，仅 admin 改） |
| 解锁机制 | 无 | 师兄**提交答案后**才解锁参考答案（RLS 强制） |
| AI 评分 | 支持（LLM 网关） | v1.0 无，v2.0+ 评估 |
| 修改次数 | 无限制（无记录） | 无限制，不记次数（明确原则） |

---

## 3. 课程结构重构

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| 层级 | Course → Chapter → Lesson | Academy → Program → (Course → CourseLesson) + Cohort（届） |
| 课程归属 | 可绑定班级 | **全局固定，不绑班/届**（原则 13） |
| 章节 | Chapter 表 | **删除章节层**，改为 lesson_number 排序 |
| 讲者 | teacher_1/teacher_2/guru_* 固定槽位 | **lesson_resources 多讲者**（无角色，无上限） |
| 作者 | authorInfo（字符串） | `courses.author`（造论者，明确语义） |
| 法本原文 | `Lesson.referenceText` | `course_lessons.source_text`（字段重命名+语义明确） |

---

## 4. 修行打卡系统升级

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| 核心模型 | PracticeEntry（简单计数，无目标） | user_practice_vows（发愿+状态机+目标） |
| 目标管理 | 无 | target_count + current_end_date（有截止日） |
| 状态机 | 无 | 7 态（on_track → at_risk 等） |
| 暂停 | 无 | paused_at/resumed_at（自助，无审批） |
| 节奏调整 | 无 | pace_history jsonb（自动记录每次调整） |
| 分类层级 | PracticeCategory → PracticeProject | practices（类型库）→ user_practice_vows（实例） |

---

## 5. 自学系统升级

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| 实现方式 | `UserCourseEnrollment.source='self'` | `user_self_study_programs` 独立表 |
| 时间模型 | 完成度模型（无时间轴） | 时间推进模型（start_date + pace + rest_weeks） |
| 独立程度 | 共享课程结构，无独立日历 | 完全独立（个人 start_date + 个人休息周） |
| 与班级关系 | 同为 enrollment 记录 | 完全分离，互不影响 |

---

## 6. 藏历系统

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| 表数 | 1 张（TibetanDay，527 条） | 2 张（tibetan_calendar + buddhist_days） |
| 殊胜日功能 | 含 tags / auspicious / events 等字段 | 单独 buddhist_days 表，**只展示不催修**（删 multiplier） |
| 时区 | 未明确 | 固定 UTC+8 |

---

## 7. 班级管理扩展

| 字段 | 目前项目 | 新项目 |
|---|---|---|
| 班级表 | Class（含 joinCode） | cohorts（含 start_date / city / timezone / code） |
| 加入方式 | joinCode | OTP 注册直接绑定（无 joinCode） |
| 成员状态 | 仅 removedAt | 5 状态：active/paused/held_back/graduated/left |
| 主班标识 | 无 | `is_primary` 字段（UNIQUE 索引保证唯一） |
| 留级计数 | 无 | `held_back_count` |

---

## 8. 通知系统降级

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| v1.0 | 完整 Web Push 系统（5张表） | **无通知系统** |
| v1.5+ | — | expo-notifications（届时实现） |
| 推送策略 | 多类型推送 + 调度规则 | 明确原则：App 不催师兄，依赖人工关怀 |

---

## 9. 认证系统简化

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| 方式 | 邮箱 + 密码（bcrypt） | **OTP 验证码**（无密码） |
| Token 管理 | 自建 AuthSession + RefreshToken | Supabase Auth 托管 |
| 相关表 | 4 张（AuthSession/PasswordResetToken/EmailVerificationToken/DeletedEmail） | **全部废弃**（Supabase 处理） |

---

## 10. 观修系统改造

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| 视频内容 | `Meditation` 表（含 videoUrl / slideImageUrls 等） | `practice_guides` 表（观修引导） |
| 打卡记录 | `MeditationSession` 表 | `practice_logs` 表（统一修持打卡） |
| 排行榜 | 班级观修排行 | 无排行（原则：不排名） |

---

# 三、数据库改动

> 说明：以下以"在现有觉学数据库基础上需要做的改动"为视角。新项目使用 Supabase + RLS，技术层面需重建；业务层面的增删改如下。

---

## 新增表

### 组织层级（3 张）

| 表名 | 用途 |
|---|---|
| `academies` | 学会层（最高组织层） |
| `programs` | 科系层（加行/净土/入行论/学经/基础等） |
| `cohort_rest_weeks` | 班级休息周（admin 管，算法自动跳过） |

### 自学系统（2 张）

| 表名 | 用途 |
|---|---|
| `user_self_study_programs` | 自学记录（含 start_date / pace / status） |
| `user_self_study_rest_weeks` | 自学师兄个人休息周 |

### 课程内容（2 张）

| 表名 | 用途 |
|---|---|
| `lesson_resources` | 多讲者讲解资源（替代固定 teacher 槽位） |
| `practice_guides` | 观修引导内容（视频+文字，与 practice_contents 关联） |

### 修持系统（5 张）

| 表名 | 用途 |
|---|---|
| `user_practice_vows` | 修持愿（7 状态机核心表） |
| `practice_templates` | 修持模板库 |
| `cohort_recommended_templates` | 班级推荐/自动模板绑定 |
| `practice_logs` | 修持打卡记录（替代 PracticeEntry） |
| `practice_contents` | 修法内容库（92 修法第 1-92 法等） |

### 班级活动（4 张）

| 表名 | 用途 |
|---|---|
| `group_sessions` | 共修场次（含 scheduled_at / session_end_at） |
| `speaking_sessions` | 讲考场次 |
| `cohort_announcements` | 班级公告（替代 ClassAnnouncement） |
| `cohort_weekly_practice_summaries` | 班级周修持汇总缓存 |

### 学修记录（2 张）

| 表名 | 用途 |
|---|---|
| `study_records` | 闻思类打卡（听课/讲考/共修，含审核态） |
| `daily_practice_journals` | 每日修持日记（每人每天 1 篇） |

### 自学读物（3 张）

| 表名 | 用途 |
|---|---|
| `self_study_books` | 18 本《大学演讲系列》 |
| `self_study_records` | 读物打卡（not_started/reading/completed） |
| `program_week_self_study` | 周 ↔ 读物映射 |

### 排表模板（5 张）

| 表名 | 用途 |
|---|---|
| `program_semesters` | 学期模板 |
| `program_weeks` | 周模板（含课程序号 + is_holiday） |
| `program_week_courses` | 周 ↔ 课程映射 |
| `program_week_practices` | 周 ↔ 修法建议 |
| `program_study_types` | 各系打卡要求（数据驱动） |

### 思考题（1 张）

| 表名 | 用途 |
|---|---|
| `question_references` | 参考答案（全局唯一，仅 admin 改，替代 Question.payload） |

### 集体功能（3 张）

| 表名 | 用途 |
|---|---|
| `practice_appointments` | 约修（师兄发起共修邀约） |
| `events` | 法会活动（法会回向依赖此表） |
| `care_followups` | 爱心师兄关怀跟进记录 |

### 权限控制（3 张）

| 表名 | 用途 |
|---|---|
| `tantric_access_grants` | 密法白名单（admin 直接 INSERT，无申请流程） |
| `class_admins` | 班级管理员（主麦/爱心，从 ClassMember 独立） |
| `system_admins` | 系统管理员 |

### 辅助（2 张）

| 表名 | 用途 |
|---|---|
| `tibetan_calendar` | 藏历（从 TibetanDay 拆分） |
| `buddhist_days` | 殊胜日（从 TibetanDay 拆分，只展示） |

**新增表合计：35 张**

---

## 需修改的现有表

### `User` → `profiles`

| 操作 | 字段 | 说明 |
|---|---|---|
| 新增 | `student_id text UNIQUE` | 学号，trigger 自动生成 |
| 新增 | `accessibility_needs text[]` | 视力/听力障碍（blind/deaf） |
| 新增 | `data_source text` | self_register / imported / admin_created |
| 新增 | `learning_mode text` | class / self_study / both |
| 新增 | `primary_cohort_id uuid` | 主班 ID |
| 修改 | `status` 枚举 | 去掉 pending，改为 active/suspended/inactive/graduated |
| 保留 | dharmaName, avatar, timezone, locale 等 | 功能一致 |
| 废弃 | passwordHash | OTP 无需密码 |
| 废弃 | 所有 notification 偏好字段 | v1.0 无推送 |
| 废弃 | currentSessionId | Supabase Auth 托管 |

### `Class` → `cohorts`

| 操作 | 字段 | 说明 |
|---|---|---|
| 新增 | `program_id uuid` | 关联科系 |
| 新增 | `start_date date NOT NULL` | 班级开始日期 |
| 新增 | `city text` | 班级所在城市 |
| 新增 | `timezone text` | IANA 时区（如 America/New_York） |
| 新增 | `code text UNIQUE` | 班级代码 |
| 废弃 | `joinCode` | 改为 OTP 直接注册 |
| 废弃 | `courseId` | 课程全局，不绑班级 |

### `ClassMember` → `class_members`

| 操作 | 字段 | 说明 |
|---|---|---|
| 新增 | `status text` | active/paused/held_back/graduated/left |
| 新增 | `is_primary boolean` | 主班标识（UNIQUE 索引） |
| 新增 | `held_back_count int` | 留级次数 |
| 新增 | `status_changed_at` / `status_changed_by` / `status_change_reason` | 状态变更追溯 |
| 新增 | `graduated_at` | 毕业时间 |
| 废弃 | `removedAt` | 改为 status='left' |
| 废弃 | `role` | 管理员移至独立 class_admins 表 |

### `Course` → `courses`

| 操作 | 字段 | 说明 |
|---|---|---|
| 新增 | `program_id uuid` | 关联科系 |
| 新增 | `author text` | 造论者（华智仁波切等） |
| 新增 | `is_tantric boolean` | 密法课程标识 |
| 新增 | `is_required boolean` | 限制性学修 vs 可选 |
| 废弃 | `slug` | 新项目无 URL slug 概念 |
| 废弃 | `authorInfo` | 合并入 author |
| 废弃 | `category` | 改由 program_id 归类 |
| 废弃 | `coverEmoji` / `coverImageUrl` | 可选保留 |

### `Lesson` → `course_lessons`

| 操作 | 字段 | 说明 |
|---|---|---|
| 新增 | `source_text text` | 法本原文正文 |
| 修改 | `referenceText` → `source_text` | 字段重命名+语义明确 |
| 废弃 | `teachingSummary` 等固定槽位 | 移至 lesson_resources |
| 废弃 | `chapterId` | 删除章节层，改为 lesson_number 排序 |

### `Question` → `questions`

| 操作 | 字段 | 说明 |
|---|---|---|
| 废弃 | `type` 枚举（保留 open/text） | 其余 13 种题型废弃 |
| 废弃 | `payload` JSON | referenceAnswer 移至 question_references 表 |
| 废弃 | `correctText` / `wrongText` | 新项目无对错反馈 |
| 废弃 | `visibility` / `ownerClassId` | 新项目题目全局共用 |
| 废弃 | `tags` / `difficulty` / `cohort` | 简化 |

### `UserAnswer` → `question_responses`

| 操作 | 字段 | 说明 |
|---|---|---|
| 简化 | `answer` → `answer_text text` | 只存文字答案 |
| 废弃 | `isCorrect` / `score` / `aiGrade` | 无 AI 评分 |
| 废弃 | `timeSpentMs` | 不计时 |
| 保留 | `cohort_id` | 多班并行，各班答案独立 |

### `PracticeCategory` / `PracticeProject` → `practices`

| 操作 | 说明 |
|---|---|
| 合并重构 | PracticeCategory + PracticeProject 合并为 practices 类型库 |
| 新增字段 | `measurement`（count/duration）/ `unit` / `category` |
| 废弃 | `scope`（user/class）区分 | 新项目通过愿的 cohort_id 控制 |

---

## 废弃的表

以下表在新项目中不需要，或被新设计替代：

| 废弃表 | 原因 |
|---|---|
| `AuthSession` | Supabase Auth 托管 |
| `PasswordResetToken` | OTP 无密码，无需重置 |
| `EmailVerificationToken` | Supabase Auth 处理 |
| `DeletedEmail` | Supabase Auth 处理 |
| `Sm2Card` | 新项目无间隔复习 |
| `UserFavorite` | 新项目无收藏功能 |
| `UserMistakeBook` | 新项目无错题本 |
| `Note` / `Highlight` | 新项目无笔记/高亮 |
| `NoteReport` / `QuestionReport` | 新项目 v1.0 无举报 |
| `Notification` | v1.0 无通知系统 |
| `PushSubscription` | v1.0 无推送 |
| `NotificationDispatchLog` | v1.0 无推送 |
| `NotificationRule` | v1.0 无推送 |
| `NotificationPreference` | v1.0 无推送 |
| `LlmProviderConfig` | v1.0 无 LLM |
| `LlmProviderUsage` | v1.0 无 LLM |
| `LlmScenarioConfig` | v1.0 无 LLM |
| `LlmPromptTemplate` | v1.0 无 LLM |
| `LlmCallLog` | v1.0 无 LLM |
| `Experiment` / `ExperimentExposure` | 新项目无 A/B 测试 |
| `Feedback` | 新项目 v1.0 无反馈系统 |
| `HomePoster` | 新项目无首页海报 |
| `ContentSeed` / `ContentRelease` | 新项目内容版本管理方式不同 |
| `OrphanedFile` | Supabase Storage 管理文件 |
| `UserCourseEnrollment` | 拆分为 class_members + user_self_study_programs |
| `Meditation` | 替换为 practice_guides |
| `MeditationSession` | 合并入 practice_logs |
| `LessonReadingProgress` | 新项目简化为 study_records 中 read_notes 类型 |
| `PracticeEntry` | 替换为 practice_logs（含愿关联） |
| `PracticeDailySummary` | 由聚合视图替代 |
| `PracticeGoal` | 合并入 user_practice_vows |
| `PracticeTask` | 合并入约修(practice_appointments)和愿系统 |
| `PracticeMakeup` | 新项目无补打卡（原则 6） |
| `UserAchievementUnlock` | v1.0 无成就系统 |
| `AnalyticsEvent` | 新项目无埋点 |
| `Chapter` | 删除章节层，改为 lesson_number 排序 |

**废弃表合计：约 35 张**

---

## 新增函数与触发器

| 名称 | 类型 | 用途 |
|---|---|---|
| `get_current_lesson_number(user_id, program_id, today)` | SQL 函数 | 算师兄本周第 N 课（跳过休息周） |
| `handle_new_auth_user()` | Trigger（SECURITY DEFINER） | auth.users 新建时自动建 profile |
| `generate_student_id()` | Trigger | profiles INSERT 时自动生成学号 |
| `self_register_class_member()` | SECURITY DEFINER 函数 | 师兄自助注册时加入班级 |
| `switch_primary_cohort()` | SECURITY DEFINER 函数 | 切换主班（事务保证 + 写 audit_logs） |
| `vow_due_date_audit()` | Trigger | 主麦改 due_date 时自动写 audit_logs |
| `vows_protect_status()` | Trigger（SECURITY DEFINER） | 锁定师兄不能改 auto 愿的 due_date |

---

## 新增视图

| 名称 | 用途 |
|---|---|
| `v_event_dedication_totals` | 法会回向聚合视图 |
| `v_weekly_dedication_totals` | 每周回向聚合视图（班级层+全会层） |

---

# 四、目前项目有、新项目不做的功能

| 功能 | 目前项目 | 新项目 |
|---|---|---|
| SM-2 间隔复习 | ✅ 完整系统（Sm2Card 表） | ❌ 不做 |
| LLM 多 Provider 网关 | ✅ 5 张表 + 熔断器 + 配额 | ❌ v1.0 不做（v2.0+ 评估 AI 评分） |
| 14 种题型 | ✅ single/fill/multi/open 等 | ❌ 只保留文字简答 |
| 错题本 | ✅ UserMistakeBook | ❌ 不做 |
| 收藏 | ✅ UserFavorite | ❌ 不做 |
| 笔记与高亮 | ✅ Note + Highlight | ❌ 不做（只有每日修持日记） |
| Web Push 通知 | ✅ 完整系统（5 张表） | ❌ v1.0 不做（v1.5+ expo-notifications） |
| A/B 测试 | ✅ Experiment 框架 | ❌ 不做 |
| 用户反馈 | ✅ Feedback 表 | ❌ 不做 |
| 首页海报 | ✅ HomePoster | ❌ 不做 |
| 内容版本管理 | ✅ ContentSeed/ContentRelease | ❌ 不做 |
| 观修视频排行榜 | ✅ 班级观修排行 | ❌ 不做（原则：不排名） |
| App 内私信 | ❌ 无 | ❌ 明确不做（依赖 WhatsApp/电话） |

---

## 数量汇总

| 维度 | 目前项目 | 新项目 |
|---|---|---|
| 数据库表数 | 57 张 | 46 张（含 2 视图）|
| 新增表（对比当前） | — | +35 张 |
| 废弃表（对比当前） | — | ~35 张 |
| 净改动 | — | 约 25 张表为全新设计 |
| 题型数 | 14 种 | 1 种 |
| 用户角色 | 3 个 | 4 个 |
| 前端页面 | 90+ | 40 屏 |

---

🙏 一切吉祥。
