# 三殊胜整合设计 · 决策记录

> 按讨论组顺序记录，每组确认后更新。  
> 最终方案文档将基于此文件生成。

---

## 第 1 组：组织架构基础 ✅ 已确认

| 内容 | 决定 | 备注 |
|---|---|---|
| Academy 表 | ❌ 不建 | Program 上预留 `academyId String?` 字段，将来需要时再建 |
| Program 表 | ✅ 建轻量版 | 字段：id / name / code（唯一） / description / academyId（可空） |
| ClassAdmin 表 | ✅ 新建 | 字段：classId / userId / role(zhumai\|aixin) / assignedAt / assignedBy |
| 现有 ClassMember.role | 保留字段 | Migration 时将 coach → zhumai，数据迁移到 ClassAdmin 表 |

---

## 第 2 组：班级与成员管理 🔲 讨论中

> 待用户确认以下问题：
> - 2A 成员状态机 5 态：哪些在实际业务中会用到？
> - 2B isPrimary：师兄是否存在多班场景？
> - 2C 时区：是否有跨时区班级？
> - 2D 学号：是否需要自动生成？

---

## 第 3 组：双模式学习 🔲 待讨论

---

## 第 4 组：课程内容扩展 🔲 待讨论

---

## 第 5 组：闻思打卡系统 🔲 待讨论

---

## 第 6 组：修持系统 🔲 待讨论

---

## 第 7 组：集体功能 🔲 待讨论

---

## 第 8 组：管理功能 🔲 待讨论
