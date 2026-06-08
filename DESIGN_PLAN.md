# 觉学 · UI 设计系统 + 实施计划

> 本文件整合已锁定的视觉规范 + 跨端（Web / 原型 / iOS / Android）实施路线。
> 每项变更都可独立验收 · 单文件 ≤ 500 行 · 性能与架构优先。

---

## 一 · 已锁定设计系统

### 1.1 Color Tokens

```css
/* 主品牌 · Saffron 藏红 */
--saffron:       #E07856   /* CTA · 主强调 · 进度 */
--saffron-dark:  #C55F3D   /* hover · 渐变深端 */
--saffron-light: #FBE5DA   /* 徽章底 · pill */
--saffron-pale:  #FDF4EE   /* 图标底 · wash */

/* 成功 · Sage 竹叶绿 */
--sage:          #A8BC9A
--sage-dark:     #7D9A6C
--sage-light:    #E5EFDF

/* 错题 · Crimson 深绛红 */
--crimson:       #A13C2E
--crimson-dark:  #822E21
--crimson-light: #F5D9D3

/* 等级 · Gold 禅金 */
--gold:          #D4A574
--gold-dark:     #B88956
--gold-light:    #F5E3CE
--gold-pale:     #FBF3E8

/* 中性 · Ink 暖墨 */
--ink:           #2B2218
--ink-2:         #55463A
--ink-3:         #857360
--ink-4:         #B5A99A

/* 背景 L2 */
--bg-scene: linear-gradient(135deg,
            #FFFAF4 0%, #FDF1E5 40%,
            #FAE8D8 75%, #F6DFCA 100%);

/* 玻璃系统 */
--glass:         rgba(255,255,255,.55)
--glass-thick:   rgba(255,255,255,.78)
--glass-border:  rgba(255,255,255,.88)
--glass-shadow:  0 6px 22px rgba(160,100,60,.1)
--blur:          blur(20px) saturate(140%)
```

### 1.2 Typography

| Role | Font | 字号 rem | letter-spacing | 用途 |
|---|---|---|---|---|
| display | Noto Serif SC 700 | 2.0 | 6px | 页面大标题 |
| h1 | Noto Serif SC 700 | 1.5 | 4px | 卡片主标 |
| h2 | Noto Serif SC 600 | 1.25 | 3px | 章节标题 |
| h3 | Noto Serif SC 700 | 1.0 | 2px | 列表标题 |
| body-serif | Noto Serif SC 400 | 0.9375 | 1.5px | 经文/引语 |
| body | Noto Sans SC 400 | 0.875 | 0.5px | 正文 |
| meta | Noto Sans SC 500 | 0.75 | 1–2px | 元信息/标签 |
| caption | Noto Sans SC 400 | 0.6875 | 0.5px | 脚注 |

### 1.3 Spacing / Radius / Shadow

```css
--sp-1: 4px;   --sp-2: 8px;   --sp-3: 12px;
--sp-4: 16px;  --sp-5: 20px;  --sp-6: 24px;
--sp-8: 32px;  --sp-10: 40px; --sp-12: 48px;

--r-sm: 8px;  --r: 12px;  --r-lg: 16px;
--r-xl: 20px; --r-pill: 9999px;

/* 阴影极简 · 深色场景 alpha 倍增 */
--shadow-1: 0 1px 2px rgba(160,100,60,.05);
--shadow-2: 0 4px 14px rgba(160,100,60,.08);
--shadow-3: 0 8px 28px rgba(160,100,60,.12);
```

### 1.4 组件基准

| 组件 | 规格 |
|---|---|
| **Glass Card** | `background:var(--glass)` + `backdrop-filter:var(--blur)` + 1px `--glass-border` + radius `--r-lg` |
| **Primary Button** | saffron 渐变 · `--r` · 阴影 `0 6px 18px rgba(224,120,86,.38)` · 衬线 letter-spacing 4px |
| **Ghost Button** | 玻璃底 + `--ink` 字 |
| **Ink Button** | `#2B2218` 底 + 白字 |
| **Tag** | `padding:3px 9px` · `--r-sm` · 语义 light 底 + dark 字 |
| **Icon** | SVG 线性 · `viewBox 0 0 24` · `stroke-width 1.8` · `round caps/joins` · `fill:none` |
| **Input** | 半透明白底 `rgba(255,255,255,.7)` · focus 藏红 3px 环 |

### 1.5 图标库（SVG · 线性统一）

已定义 8 枚核心图标：`book` `redo` `star` `medal` `home` `user` `check` `x`
下阶段扩充到 30+ · 统一放 `assets/icons.svg` 使用 `<use>` 引用。

---

## 二 · 架构决策

### 2.1 目录结构

```
觉学/
├── design-system/              # 🎨 设计源 · 单一真相
│   ├── tokens.json             # 颜色/字号/间距/阴影（跨端源）
│   ├── icons/                  # SVG 图标库（30+）
│   │   └── sprite.svg          # 合并 sprite
│   └── DESIGN_PLAN.md          # 本文件
│
├── prototypes/                 # 📱 HTML 原型（本阶段重点）
│   ├── shared/
│   │   ├── tokens.css          # 由 tokens.json 生成
│   │   ├── base.css            # reset + typography + utilities
│   │   ├── components.css      # glass-card / btn / tag / input
│   │   └── icons.svg
│   ├── mobile/                 # 学员手机 mockup · 拆分文件
│   │   ├── home.html           # 首页（300 行以内）
│   │   ├── scripture.html      # 法本+阅读
│   │   ├── quiz.html           # 答题流
│   │   ├── mistakes.html       # 错题本
│   │   ├── achievement.html    # 成就
│   │   ├── profile.html        # 我的+设置
│   │   └── auth.html           # 登录+注册
│   ├── desktop/                # 桌面后台
│   │   ├── coach.html          # 辅导员
│   │   └── admin.html          # 管理员
│   └── index.html              # 落地页
│
├── web/                        # 🌐 Next.js 14 真前端（Phase 4）
│   ├── app/                    # App Router
│   ├── components/             # React 组件库
│   │   ├── ui/                 # GlassCard / Button / Tag / Icon
│   │   └── features/           # 业务组件
│   ├── styles/
│   │   └── tokens.css          # ← 复用 prototypes/shared/tokens.css
│   └── lib/api/                # 调后端
│
├── mobile/                     # 📱 React Native（Phase 5）
│   ├── ios/
│   ├── android/
│   └── src/
│       ├── theme/              # 由 tokens.json 生成 TS 常量
│       ├── components/         # RN 组件 · 同 UI 语义
│       └── screens/
│
└── backend/                    # 🔧 已跑通
```

### 2.2 单一设计源 · Token Pipeline

```
tokens.json  →  [build]  →  tokens.css       (Web/原型)
                          →  tokens.ts        (React Native)
                          →  Colors.swift     (iOS 备用)
                          →  Tokens.kt        (Android 备用)
```

**工具：** Style Dictionary（轻）或 Terrazzo/Tokens Studio。
**好处：** 改一处 · 全端自动同步 · 避免 4 份 hex 写死。

### 2.3 单文件代码量控制

| 类型 | 上限 | 超限处理 |
|---|---|---|
| HTML 单页 | **500 行** | 拆为多 page · 共享 CSS 复用 |
| CSS 单文件 | **400 行** | 按职责切：tokens / base / components / utilities |
| JS/TS 组件 | **250 行** | 提 hook · 提子组件 |
| SVG 图标 | 合并 **sprite** | 按需 `<use>` |

**当前超标：**
- `admin.html` 2296 行 🔴 → 拆 9 文件
- `student.html` 2672 行 🔴 → 拆 7 文件
- `coach.html` 622 行 🟡 → 按页再拆

### 2.4 性能要求

| 指标 | 目标 | 策略 |
|---|---|---|
| **FCP** | < 1.2s (本地原型) | 内联关键 CSS · 字体 preload |
| **LCP** | < 2.0s | 图片懒加载 · 字体 font-display:swap |
| **CLS** | < 0.05 | 图标 fixed 尺寸 · 字体 fallback 匹配 |
| **Total CSS** | < 60KB gzipped | 去未用 · 合并重复 |
| **Total JS** | < 100KB | 原型阶段零 JS · 仅深色切换 |
| **Glass effect** | 60fps | limit `backdrop-filter` 到容器级 · 避免子孙层叠 |
| **Web 字体** | 中文仅加载实际字符 | subset 或 Google Fonts text= |

**原型阶段禁用：**
- 大 JS 框架（原型要手动 HTML）
- 全站动画（只在交互关键处加）
- 非必要渐变叠加（glass 已够炫）

---

## 三 · 多端策略

### 3.1 Web（两条线）

#### 3.1.A 原型 · 纯 HTML + CSS（本阶段）
- 4 文件重构为 10 文件 · 共享 `tokens.css` + `components.css`
- 无构建工具 · 直接浏览器打开
- 目的：设计定稿 · 用户验收

#### 3.1.B 真应用 · Next.js 14（Phase 4）
- App Router · Server Components 默认
- Tailwind + CSS 变量（`tokens.css` 作为 `:root`）
- 响应式断点：`sm 640` `md 768` `lg 1024` `xl 1280`
- 部署：Vercel / Cloudflare Pages
- SEO：静态 landing · SSG · metadata

### 3.2 iOS

```
SwiftUI（iOS 15+）
├── Colors.swift           # 对应 tokens.json
├── Typography.swift       # Noto Serif SC + 动态字体
├── Components/
│   ├── GlassCard.swift    # UIBlurEffect + VariableBlurView
│   ├── SaffronButton.swift
│   └── Tag.swift
└── Screens/
```

**平台适配要点：**
- Safe area · Dynamic Island（iPhone 14 Pro+）
- SF Symbols 降级 fallback · 关键图标仍用 SVG
- UIBlurEffect(.systemUltraThinMaterialLight) ≈ web 玻璃
- Haptic feedback on CTA
- 中文 SF + Noto Serif SC `NSAttributedString`

### 3.3 Android

```
Jetpack Compose（Min API 26）
├── theme/
│   ├── Color.kt           # 对应 tokens.json
│   ├── Type.kt            # Noto Serif SC resource
│   └── Theme.kt           # Material 3 色方案
├── components/
│   ├── GlassCard.kt       # Modifier.blur + graphicsLayer
│   ├── SaffronButton.kt
│   └── Tag.kt
└── screens/
```

**平台适配要点：**
- Edge-to-edge · `WindowCompat.setDecorFitsSystemWindows(false)`
- `RenderEffect.createBlurEffect` (API 31+) · 低端机降级纯色
- Material You 可选但**不跟随系统色** · 我们有自己色板
- Predictive back gesture（Android 14+）
- 图标 ImageVector 手绘 or SVG → VectorDrawable

### 3.4 跨端共享 · 复用策略

| 层 | 复用 | 不复用 |
|---|---|---|
| **设计 Token** | ✅ JSON 单源 | — |
| **SVG 图标** | ✅ 同一套 | — |
| **业务逻辑** | TS/Kotlin 各写 | — |
| **组件实现** | ❌ 各平台原生 | 仅名称/语义一致 |
| **页面布局** | ❌ 各平台惯例 | 但视觉语言一致 |

**不考虑：** React Native / Flutter 跨端。理由：
- 玻璃毛效果跨端难统一（RN 要三方库）
- 中文排版原生控件更好
- 性能原生优势明显
- 项目阶段短期重点是 Web + 原型

---

## 四 · 实施计划

### 🔵 Phase Z · HTML 原型重构（当前）

> 目标：把已锁定设计落到 4 个真原型文件 · 可作为所有端的视觉参考。
> 单步 ≤ 300 行 · 每步独立 commit · 每步可视 demo 验收。

| 步 | 内容 | 估行 | 产出验收 |
|---|---|---|---|
| **Z.1** | `tokens.json` + `tokens.css` 生成 | 200 | devtools 注入 · 所有颜色可用 |
| **Z.2** | `base.css` · reset + typography + utilities | 150 | 字体/间距系统生效 |
| **Z.3** | `components.css` · glass/btn/tag/input/list | 300 | 对照 preview 组件一致 |
| **Z.4** | `icons.svg` · 30 枚线性图标 sprite | 150 | 示例页调 `<use>` 正常 |
| **Z.5** | `index.html` · landing 重做 | 200 | 浏览器打开视觉过 |
| **Z.6** | `student/home.html` · 首页 | 280 | 对照 preview-style.html |
| **Z.7** | `student/quiz.html` · 答题流 3 态 | 300 | 选项/答对/答错三态 |
| **Z.8** | `student/scripture.html` · 法本+阅读 | 280 | 二级+三级 |
| **Z.9** | `student/mistakes.html` · 错题本+详情 | 260 | 列表+详情 |
| **Z.10** | `student/achievement.html` · 成就 | 220 | 等级环 + 勋章墙 |
| **Z.11** | `student/profile.html` · 我的+设置 | 240 | profile + 菜单 |
| **Z.12** | `student/auth.html` · 登录+注册+找回 | 260 | 3 屏表单 |
| **Z.13** | `desktop/coach.html` · 辅导员 · 5 页 | 500 | 桌面响应式 |
| **Z.14** | `desktop/admin.html` · 管理员 · 9 页 | 500 | 桌面响应式 |
| **Z.15** | 收尾：导航整合 · index 跳转 · 性能扫 | 150 | Lighthouse > 90 |

**小计 ≈ 4,200 行 · 15 commit · 预计 3-4 个工作段**

### 🟢 Phase W · Web 真应用（Next.js）

| 步 | 内容 |
|---|---|
| W.1 | Next.js 14 App Router 骨架 + Tailwind + tokens.css 接入 |
| W.2 | UI 基础组件：GlassCard / Button / Tag / Input / Icon |
| W.3 | Auth 流（login / register / forgot） |
| W.4 | 学员端 pages · 对接后端 API |
| W.5 | 辅导员端 |
| W.6 | 管理员端 |
| W.7 | 响应式 · PWA · 部署 Vercel |

**预估：** 15-20 工作段

### 🟡 Phase I · iOS（SwiftUI）

| 步 | 内容 |
|---|---|
| I.1 | Xcode 项目 · Colors/Typography/Theme |
| I.2 | 基础组件：GlassCard + SaffronButton + Tag + IconView |
| I.3 | 导航：TabBar + NavigationStack |
| I.4 | 学员端屏幕 |
| I.5 | 离线缓存 · Core Data |
| I.6 | App Store 上架准备 |

### 🟠 Phase A · Android（Compose）

| 步 | 内容 |
|---|---|
| A.1 | Compose 项目 · Color/Type/Theme |
| A.2 | 基础组件 |
| A.3 | Navigation Compose 路由 |
| A.4 | 学员端屏幕 |
| A.5 | Room DB 缓存 |
| A.6 | Play Store 上架准备 |

---

## 五 · 下一步

**立即开始 · Z.1**：
1. 创建 `design-system/tokens.json`
2. 生成 `prototypes/shared/tokens.css`
3. 新目录结构先搭骨架，老文件（shared.css / student.html 等）先不动，确认 Z.1 通过再进 Z.2

**分支策略：**
- 当前分支 `claude/refine-prototype-design-Wginr` 继续跑 Phase Z
- 每步一个 commit · 末尾打 tag `proto-z.1` / `proto-z.2` ...
- Phase Z 全完后开新分支 `feat/web-nextjs-skeleton` 启动 W.1

**文件清理节奏：**
- Z.6-Z.12 完成 → 老 `student.html` 标记废弃（保留至 Phase Z 结束）
- Z.13-Z.14 完成 → 老 `coach.html` `admin.html` 同上
- Phase Z 收尾 → 删除 `preview-*.html`（已完成使命）+ 老大文件 → 一次性 `chore: cleanup`

---

## 六 · 待决策

用户最后确认后才启动 Z.1：

1. ✅ 色板锁定 · 无异议
2. ✅ 字号/间距系统 · 采用上表
3. ⬜ **目录结构** · 接受本文档的 `prototypes/shared + mobile + desktop` 拆分？
4. ⬜ **Token 工具** · Style Dictionary 现在就接入？还是先手写 tokens.css 延后？
5. ⬜ **多端优先级** · Z → W → I → A 还是 Z → W → (I ‖ A)？
6. ⬜ **废弃清理** · Phase Z 完成后是否真删老 `student.html` / `admin.html` / `coach.html`？

请逐条回复或只回编号确认，我启动 **Z.1**。
