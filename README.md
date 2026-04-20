# 觉学 · JueXue

佛法学习 App · 为佛教团体设计的班级共修学习系统

**在线演示：** [https://ericjepsen9.github.io/bicwny/](https://ericjepsen9.github.io/bicwny/)

---

## 📱 产品简介

觉学是一款独立的佛法学习应用，以《入菩萨行论》为核心课程，支持班级绑定、多题型练习、AI 评分思考题、间隔重复复习等功能，帮助用户与道友共同系统修习佛法。

---

## 📖 文档导航

### 🎯 产品原型

| 文档 | 说明 |
|------|------|
| [index.html](./index.html) | 觉学 v1.0 交互原型（主展示） |
| [prototype-v1.html](./prototype-v1.html) | 早期原型版本（已淘汰） |

### 📋 产品规格

| 文档 | 说明 |
|------|------|
| [spec/v1-spec.html](./spec/v1-spec.html) | 觉学 v1.0 完整产品需求文档 |
| [spec/p0-spec.html](./spec/p0-spec.html) | P0 三模块功能规格（历史版本） |
| [spec/question-types.html](./spec/question-types.html) | 🔥 全 12 种题型数据结构规范 |

### 🤖 AI 集成

| 文档 | 说明 |
|------|------|
| [ai/grading-prompt.html](./ai/grading-prompt.html) | 🔥 开放作答 AI 评分 Prompt 设计 |
| [ai/generate-questions.py](./ai/generate-questions.py) | 基于讲记的题卡生成脚本（MiniMax） |
| [ai/generate-from-qa.py](./ai/generate-from-qa.py) | 基于课后思考题的题卡派生脚本 |

### 🔍 研究

| 文档 | 说明 |
|------|------|
| [research/duolingo-analysis.html](./research/duolingo-analysis.html) | Duolingo 交互模式对标分析 |

### 📦 历史归档

| 文档 | 说明 |
|------|------|
| [archive/buddhist-prd-v1.html](./archive/buddhist-prd-v1.html) | 觉路 PRD v1.0（初代覆盖完整佛法 App） |
| [archive/juelv-prd-v2.html](./archive/juelv-prd-v2.html) | 觉路 PRD v2.0 |
| [archive/juelv-prd-v3.html](./archive/juelv-prd-v3.html) | 觉路 PRD v3.0 |

---

## 🎯 v1.0 核心功能

### 题型（6 种 v1.0 + 6 种未来扩展）

**v1.0 必须实现：**
- ✅ 单选题（single）
- ✅ 填空题（fill）
- ✅ 连线配对（match）
- ✅ 排序题（sort）
- 🆕 判断多选（multi）
- 🆕 开放作答 + AI 评分（open）

**v1.1+ 扩展：**
- 🔜 图片辨识 · 听颂选答 · 卡片翻转
- 🔮 流程拖拽 · 引导分步 · 情境判断

### 班级绑定

- 班级邀请码加入
- 学习进度跟随班级课程表
- 班级公告 · 精进榜 · 道友进度

### 科学记忆

- SM-2 间隔重复算法
- 每日任务 · 连续打卡
- 错题本 · 收藏颂文

---

## 🚀 技术栈规划

- **前端：** HTML / CSS / JavaScript（原型）→ React 或 Vue（正式版）
- **后端：** Node.js / Python
- **AI：** MiniMax API（题卡生成 + 开放作答评分）
- **部署：** Oracle Cloud
- **数据库：** PostgreSQL / MongoDB

---

## 📝 课程内容

**首期课程：《入菩萨行论》十品**

1. 菩提心利益品
2. 忏悔罪业品
3. 受持菩提心品
4. 不放逸品
5. 护正知品
6. 安忍品
7. 精进品
8. 静虑品
9. 智慧品
10. 回向品

---

## 🤝 贡献与反馈

项目目前处于原型设计阶段，欢迎佛教团体辅导员、道友提供内容审核建议。

---

*愿以此功德，普及于一切，我等与众生，皆共成佛道。*
