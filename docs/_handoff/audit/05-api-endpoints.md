# 觉学 · API 端点清单（现状）

> 状态：现状快照（2026-05-31）
> 用途：线上后端全部 HTTP 端点 × 权限守卫 × 用途。改造时逐个对照权限重构（4 角色，待修订 #7/#9）。
> 数据源：`backend/src/modules/*/routes.ts`。共 **139 端点 / 26 模块**。
> ⚠️ 守卫现状是三元角色（admin/coach/student）；改造目标见 03 §8（4 角色 + 作用域）。

---

## 守卫类型统计

| 守卫 | 数量 | 改造方向 |
|---|---|---|
| `requireRole('admin')` | 42 | → super_admin / subject_admin（按操作分级）|
| `requireUserId`（登录即可）| 63 | 多数不变（本人数据）|
| `requireRole('coach','admin')` | 12 | → class_tutor / class_admin 分级 + 作用域 |
| Optional auth / Public | 17 | 不变 |
| `requireRole('coach')` | 1 | → class_tutor |
| jwtOptional（隐式 getUserId）| 3 | 不变 |
| 无守卫（public）| 1 | 不变 |

---

## 一、Auth（账户）
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| POST | `/api/auth/register` | Public | 注册 |
| POST | `/api/auth/login` | Public | 登录 |
| POST | `/api/auth/refresh` | Public | 刷新 token |
| POST | `/api/auth/logout` | Public | 登出（幂等）|
| POST | `/api/auth/forgot` | Public | 忘记密码（发重置链接）|
| POST | `/api/auth/reset` | Public | 重置密码 |
| POST | `/api/auth/verify-email` | Public | 邮箱验证 |
| POST | `/api/auth/resend-verify` | requireUserId | 重发验证 |
| GET | `/api/auth/me` | requireUserId | 当前用户 |
| POST | `/api/auth/onboarding-done` | requireUserId | 标记引导完成 |
| PATCH | `/api/auth/me` | requireUserId | 改资料 |
| POST | `/api/auth/change-password` | requireUserId | 改密码（吊销全会话）|
| GET | `/api/auth/me/data-export` | requireUserId | 导出数据（5 分钟冷却）|
| DELETE | `/api/auth/me` | requireUserId | 注销（软删）|

## 二、Admin
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET/POST | `/api/admin/users` | admin | 用户列表 / 创建 |
| PATCH | `/api/admin/users/:id/role` | admin | 改角色（防自降）|
| POST | `/api/admin/users/:id/reset-password` | admin | 重置密码 |
| POST | `/api/admin/users/:id/active` | admin | 启用/停用 |
| GET | `/api/admin/platform-stats` | admin | 平台看板 |
| GET | `/api/admin/users/:id/learning` | admin | 单用户学习档案 |
| GET | `/api/admin/analytics/summary` | admin | 分析摘要 |
| GET | `/api/admin/analytics/funnel` | admin | 漏斗留存 |
| GET/PATCH | `/api/admin/feedback[/:id]` | admin | 反馈列表 / 处理 |
| GET/POST/PATCH | `/api/admin/experiments[/:key]` | admin | 实验 CRUD |
| GET | `/api/admin/experiments/:key/results` | admin | 实验结果 |
| GET | `/api/admin/reports/pending` | admin | 待审举报 |
| POST | `/api/admin/reports/:id/handle` | admin | 处理举报 + AuditLog |

## 三、Coach（辅导员）
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET | `/api/coach/classes/:id/stats` | coach,admin | 班级聚合统计 |
| GET | `/api/coach/classes/:id/students/:uid` | coach,admin | 单学员详情（本班）|
| GET | `/api/coach/llm-calls` | coach,admin | 自己的 LLM 调用日志 |

## 四、班级公告 Announcements
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET/POST | `/api/coach/classes/:id/announcements` | coach,admin | 公告列表/发布（自动通知）|
| PATCH | `/api/coach/announcements/:aid` | coach,admin | 改/归档（coach 限本人）|
| POST | `/api/coach/announcements/upload-image` | coach,admin | 上传图 |
| GET | `/api/classes/:id/announcements` | requireUserId | 学员查看（仅 active）|
| GET | `/api/announcements/:aid` | requireUserId | 公告详情（须本班成员）|

## 五、ClassSessions（共修排课）
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET/POST | `/api/coach/classes/:classId/sessions` | coach,admin | 列表/创建 |
| PATCH/DELETE | `/api/coach/sessions/:id` | coach,admin | 编辑/删除 |
| GET | `/api/classes/:classId/sessions/:sid` | requireUserId | 学员查看（带 liveLink）|
| GET | `/api/my/upcoming-events` | requireUserId | 即将到来事件 |
| GET | `/api/my/top-home-card` | requireUserId | 首页顶部提醒卡 |

## 六、Learning（法本/报名/练习）
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET | `/api/courses` | Public | 已发布法本列表 |
| GET | `/api/courses/:slug` | Optional | 法本详情 + 进度叠加 |
| GET | `/api/lessons/:id/questions` | Optional | 课时题目（隐藏答案）|
| GET | `/api/quiz/smart-practice` | requireUserId | 智能练习（SM-2 + 错题 + 随机）|
| GET/POST/DELETE | `/api/my/enrollments` `/api/enrollments[/:courseId]` | requireUserId | 报名/退课 |
| PATCH | `/api/enrollments/:courseId/progress` | requireUserId | 更新进度 |
| GET | `/api/my/progress` | requireUserId | 学习进度 |

## 七、答题/复习/收藏/错题
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET | `/api/questions/:id` | Optional | 题目公开视图 |
| POST | `/api/answers` | requireUserId | 提交答案→判分→落库 |
| GET | `/api/sm2/due` `/api/sm2/stats` | requireUserId | 复习队列/面板 |
| POST | `/api/sm2/review` | requireUserId | 自评复习 |
| POST/DELETE | `/api/favorites/:questionId` | requireUserId | 收藏/取消 |
| GET | `/api/favorites[/count]` | requireUserId | 收藏列表/计数 |
| POST | `/api/reports` | requireUserId | 提交题目举报 |
| GET | `/api/achievements` | requireUserId | 成就墙 |

## 八、笔记/高亮/阅读
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET/POST | `/api/notes` | requireUserId | 笔记列表/创建 |
| GET | `/api/notes/shared` | requireUserId | 班级共享笔记 |
| GET/PATCH/DELETE | `/api/notes/:id` | requireUserId | 详情/改/删 |
| POST | `/api/notes/:id/report` | requireUserId | 举报共享笔记 |
| GET/POST | `/api/notes/reports[/:id/action]` | coach/admin | 举报审核 |
| POST | `/api/notes/llm-assist` | requireUserId | **笔记 AI 加工（25.C，5 action）⏸ 暂不上线扩展** |
| GET/POST/DELETE | `/api/lessons/:lessonId/highlights` `/api/highlights[/:id]` | requireUserId | 高亮 |
| PATCH | `/api/me/lessons/:id/reading-progress` | requireUserId | 阅读心跳 |
| GET | `/api/me/reading-stats` | requireUserId | 阅读统计 |

## 九、Dossier（学情档案）
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET | `/api/me/stats` | requireUserId | 我的学情（4 维）|
| GET | `/api/admin/users/:uid/stats` | admin | 任意学员档案 |
| GET | `/api/coach/classes/:id/dashboard[.csv]` | coach,admin | 班级看板 / CSV |
| GET | `/api/coach/classes/:id/students/:uid/stats` | coach,admin | 学员档案（本班）|

## 十、通知/推送
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET | `/api/notifications[/unread-count]` | requireUserId | 通知列表/未读数 |
| POST | `/api/notifications/:id/read` `/read-all` `/read-by-event` | requireUserId | 标记已读 |
| DELETE | `/api/notifications/:id` | requireUserId | 删通知 |
| GET | `/api/push/vapid-public-key` | Public | VAPID 公钥 |
| POST/DELETE | `/api/push/subscribe` | requireUserId | 订阅/退订 |
| POST | `/api/push/test` | requireUserId | 测试推送 |

## 十一、运营内容（藏历/画报/法会/系统公告）
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| GET | `/api/calendar/today` `/upcoming` `/month/:ym` `/day/:date` | Optional | 藏历查询 |
| PUT/DELETE | `/api/admin/calendar/:date` | admin | 藏历维护 |
| GET | `/api/posters/current` | Optional | 当月画报 |
| GET/PUT/DELETE | `/api/admin/posters/:year[/:month]` | admin | 画报维护 |
| POST | `/api/admin/posters/upload-image` | admin | 上传画报图 |
| GET/POST/PATCH/DELETE | `/api/admin/dharma-assemblies[/:id]` | admin | 法会 CRUD |
| GET | `/api/assemblies[/:id]` | requireUserId | 法会列表/详情 |
| POST/GET/PATCH | `/api/admin/system-announcements[/:id]` | admin | 系统公告 CRUD |
| POST | `/api/admin/system-announcements/:id/revoke` | admin | 撤回 |
| GET | `/api/system-announcements[/:id]` | requireUserId | 公告列表/详情 |

## 十二、反馈/实验/分析/搜索/健康
| 方法 | 路径 | 守卫 | 用途 |
|---|---|---|---|
| POST | `/api/feedback` | Optional | 提交反馈（5/时）|
| GET | `/api/me/feedback` | requireUserId | 反馈历史 |
| POST | `/api/analytics/events` | Optional | 埋点批量上报 |
| POST | `/api/experiments/:key/assign` | Optional | 分配实验变体 |
| GET | `/api/search` | Optional | 全文搜索 |
| GET | `/health` `/health/detailed` `/api/config/public` | Public | 健康检查/前端配置 |

---

## 改造提示
- **42 处 admin 守卫**：改造时按操作性质分流到 super_admin（平台配置）/ subject_admin（学科）/ class_admin（班级），不再一刀切 admin。
- **13 处 coach/coach,admin**：拆 class_tutor（教学）/ class_admin（行政）+ 作用域校验（本班）。
- 详见 03 §8 权限体系改造（统一入口 auth.ts + permissions.ts）。
- 新设计新增能力（升学/传承/报数/出勤/角色任命…）的端点尚未存在，属 🆕 待建。

---

## 变更记录
| 日期 | 内容 |
|---|---|
| 2026-05-31 | 创建 API 端点清单；139 端点 / 26 模块 / 7 类守卫；标注笔记 AI(25.C)、改造分流方向 |
