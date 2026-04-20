# 🚀 在 Claude Code 中继续觉学项目 · 快速开始

## 一分钟启动指南

### 步骤 1：把项目拉到本地

```bash
# 在你想放项目的文件夹里执行
git clone https://github.com/ericjepsen9/bicwny.git juexue
cd juexue
```

### 步骤 2：打开 Claude Code

在项目目录下打开终端，启动 Claude Code：

```bash
claude
```

### 步骤 3：给 Claude 这个开场白

**直接复制粘贴这段话：**

```
我是一个佛法学习 App 项目「觉学（JueXue）」的开发者。
这个项目的所有设计、原型、规范文档都在当前目录里。

请先读取以下文件快速了解项目：

1. HANDOFF.md - 最重要的项目交接文档，涵盖全部决策
2. README.md - 项目索引和文件结构
3. 原型文件（index.html 或 juexue_prototype_v3.html）- 当前 UI 风格

读完告诉我：
- 项目的核心定位是什么
- 当前进度到了哪个阶段
- 下一步 Phase 1 要做什么

我们接下来会一起做开发工作。
```

---

## 常见的下一步工作场景

### 场景 A：继续完善原型（Phase 1）

**告诉 Claude：**
> 我们现在要在 `juexue_prototype_v3.html` 基础上加入两种新题型：
> 1. 判断多选题（multi）
> 2. 开放作答题（open，先做 UI 和模拟评分，不调真实 API）
>
> 参考 `question_types_spec.html` 里的字段定义。
> UI 风格保持一致（克莱因蓝 + 橙色 + 白色卡片）。

### 场景 B：开始做题库编辑器（Phase 2）

**告诉 Claude：**
> 基于 `generate_questions.py` 的逻辑，帮我做一个网页版题库编辑器。
> 需求：
> - 左侧粘贴讲记或思考题
> - 点"AI 生成"调用 MiniMax API（Key 从 .env 读取）
> - 右侧显示生成的题卡，可编辑 / 通过 / 删除
> - 通过的题累积到 JSON，可下载
> - 遵守 question_types_spec.html 的字段规范

### 场景 C：启动后端开发（Phase 3）

**告诉 Claude：**
> 开始为觉学做后端。技术栈：Node.js + Express + PostgreSQL。
> 基于 HANDOFF.md 的数据模型设计，先实现：
> 1. 用户系统（微信登录）
> 2. 班级与邀请码
> 3. 题库 CRUD
> 4. 答题记录与 SM-2 调度
>
> 部署目标：Oracle Cloud（参考 yuanhe.caughtalert.com 的部署方式）

### 场景 D：集成 MiniMax 评分

**告诉 Claude：**
> 实现开放作答题的 AI 评分功能。
> 严格按 `grading_prompt_design.html` 里的 Prompt 模板实现。
> 模型用 MiniMax-M2.7，temperature=0.3。
> 返回 JSON 做容错处理。
> 写一个可独立测试的 Python 函数，先不接前端。

---

## 关键文件速查

```
juexue/
├── HANDOFF.md                          ⭐ 项目全貌
├── README.md                           项目索引
├── index.html                          最新原型
├── spec/
│   ├── v1-spec.html                    V1.0 产品需求
│   ├── question-types.html             ⭐ 题型数据规范
│   └── p0-spec.html                    历史 P0 规格
├── ai/
│   ├── grading-prompt.html             ⭐ AI 评分 Prompt
│   ├── generate-questions.py           题卡生成脚本
│   └── generate-from-qa.py             思考题派生脚本
├── research/
│   └── duolingo-analysis.html          Duolingo 对标
└── archive/
    └── (历史版本文档)
```

---

## 环境配置

### Python 依赖

```bash
pip install openai python-dotenv
```

### .env 文件（放在项目根目录，不要 commit）

```
MINIMAX_API_KEY=你的真实密钥
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
```

### .gitignore 确保包含

```
.env
__pycache__/
*.pyc
node_modules/
.DS_Store
```

---

## 如果 Claude 问"你是新会话，上下文我都不知道"时

就把这段话发给 Claude：

> 你可以读取当前目录的 `HANDOFF.md` 文件获取完整项目上下文。
> 这个文档包含了：产品定位、技术决策、完成度、下一步工作、
> 所有重要设计决策和不变量。
> 读完就能无缝接手这个项目。

---

## 本地开发启动

### 预览原型

```bash
# 在项目目录下启动一个简单的本地服务器
python3 -m http.server 8000

# 浏览器打开 http://localhost:8000
```

### 同步到 GitHub

```bash
git add .
git commit -m "feat: your change description"
git push origin main
```

**GitHub Pages 会自动在 1-3 分钟内更新到 https://ericjepsen9.github.io/bicwny/**

---

## 遇到问题的自救方法

1. **Claude 不理解项目** → 让它读 `HANDOFF.md`
2. **忘了题型字段** → 让它读 `spec/question-types.html`
3. **AI 评分出问题** → 让它读 `ai/grading-prompt.html`
4. **UI 不知道什么风格** → 让它打开 `index.html` 参考
5. **不记得以前为啥那么设计** → 搜索 `HANDOFF.md` 里的"核心产品决策"章节

---

祝开发顺利 🙏
