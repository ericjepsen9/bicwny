# CSS / 布局 · 踩过的坑速查表

> 写 CSS / 布局类代码前，**先看一遍**这个清单。每条都是真实事故。
>
> 大多数视觉 bug 不是 CSS 难、是有些规则反直觉。这里记录我们项目栈里**实际栽过**的。

---

## 🔴 1. `position: fixed` 被祖先 `transform` 干掉

### 表现
- bottom toolbar / banner / floating button 应该贴视口底，结果定位到**页面底**（视口外）
- 用户进页面看不到、滚动也找不到

### 原因
CSS 规范：祖先元素只要有 **非空 transform / filter / backdrop-filter / contain** 中任一项，就成为 `fixed` 子元素的 **containing block**（替代视口）。

我们项目里这些会触发：
- `.page-enter { animation: fadeInPage }` 用了 `transform: translateY` ← **路由切换包装器**
- `.glass` 系列的 `backdrop-filter: var(--blur)` ← **侧边栏 / 卡片**
- 任何带 `transform: scale(...)` 的卡片悬停效果

### 正确做法
fixed 子元素**用 createPortal 渲到 document.body**，绕开任何祖先：

```tsx
import { createPortal } from 'react-dom';

return (
  <>
    <div>正常 in-flow 内容</div>
    {createPortal(
      <div style={{ position: 'fixed', bottom: 0, ... }}>
        贴视口底的工具栏
      </div>,
      document.body,
    )}
  </>
);
```

`Dialog.tsx` 已经用这个模式，所以 dialog 不出问题。其他 fixed UI 也照搬。

### 历史事故
- `8c2da1a` ScriptureReadingPage 底部工具栏 + 观修 banner

---

## 🔴 2. `<picture>` 默认 inline · 撑不满 flex 容器

### 表现
封面图被居中**缩小**显示，容器背景透出 → 看起来像「没铺满」、「留白」

### 原因
- `<picture>` 默认 `display: inline`
- 父容器 `display: flex; align-items: center; justify-content: center`
- inline 元素在 flex 容器里**不会自动撑满**
- 内层 `<img>` 的 `width: 100%; height: 100%` 是**相对 picture 自身**（content 大小）· 不是相对父容器

### 正确做法
显式给 picture **`display: block` + 宽高 100%**：

```tsx
<div style={{ display: 'flex', ... }}>
  <picture style={{ display: 'block', width: '100%', height: '100%' }}>
    <source srcSet={...} />
    <img style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  </picture>
</div>
```

### 历史事故
- `3c9d0ff` CourseCover 法本封面

---

## 🟡 3. `objectFit` 三选一 · 没有「全占满 + 不裁切」

| `objectFit` | 行为 | 用于 |
|---|---|---|
| `cover` | 填满容器 · 不留白 · **裁切超出部分** | 列表卡片缩略图（容器固定 · 接受裁切）|
| `contain` | 完整显示 · **不裁切但可能留白** | 详情页大图（看得清整张图）|
| `fill` | 拉伸到容器尺寸 · **变形** | 几乎不用（除非接受变形）|

### 用户期待「不裁切 + 不留白」？
**唯一办法：让容器的宽高比匹配图片真实宽高比**。

要么：
- 后端存图片尺寸 · 前端读出来设容器 aspect-ratio
- 或者前端不强制容器高度 · 让图片自身决定（`max-width / max-height + height: auto`）

### 历史事故
- `7e8f088` 详情页封面用 `<img>` 直渲 + `max-width/max-height` 让图自己决定大小
- `9532e66` 后端 sharp 改 `fit: 'inside'` 不强制裁正方形

---

## 🟡 4. zod `.optional()` 不接受 `null`

### 表现
前端送 `field: null` · 后端 zod 直接 400 「参数不合法」

### 原因
- `z.string().optional()` = `string | undefined`
- 想接受 `null` 必须 `z.string().nullable().optional()` = `string | null | undefined`

### 项目里的约定
所有 update body schema 都用 `.nullable().optional()` · 让前端能用 `null` 显式清空字段。
所有 create body 也跟进这个约定（以前曾不一致 · 已统一）。

### 历史事故
- `0500162` create courses/chapters/lessons 全改 nullable

---

## 🟡 5. React Query `invalidateQueries` 默认前缀匹配 · 不要重复调

### 表现
连续两次 `qc.invalidateQueries({ queryKey: ['/api/admin/courses'] })` + `qc.invalidateQueries({ queryKey: ['/api/admin/courses', courseId] })` 会让第二次取消第一次的 refetch · 控制台冒 `AbortError`。

### 原因
React Query 默认 `exact: false` 前缀匹配 · `['/api/admin/courses']` 已经覆盖所有 `[..., xxx]` 子查询。第二个调用是多余 · 而且会让正在 refetch 的 promise abort。

### 正确做法
**只 invalidate 最浅前缀**：
```ts
qc.invalidateQueries({ queryKey: ['/api/admin/courses'] }); // 这一条已经覆盖所有子查询
// 不要再写 qc.invalidateQueries({ queryKey: ['/api/admin/courses', id] }); 了
```

### 历史事故
- `3da14ab` AdminCoursesPage CoverEditor + ChapterForm

---

## 🟡 6. fetch 主动 abort 不要进 retry

### 表现
组件卸载 / 路由切换 / dialog 关闭时 · 已发出的 GET fetch 被 abort · 我们的重试逻辑触发 4 次相同 `AbortError` 刷屏。

### 正确做法
catch 里区分「调用方主动 abort」vs「网络错」：
```ts
} catch (e) {
  if (opts.signal?.aborted) {
    throw e; // 用户取消 · 直接抛 · 不重试
  }
  // 真网络错才重试
  if (attempt < RETRY_DELAYS.length && method === 'GET') { ... }
}
```

### 历史事故
- `0d62f0a` api.ts

---

## 🟡 7. Dialog 的 sheet variant 在桌面会贴底显示

### 表现
admin 桌面页面用默认 Dialog（sheet 风格）· 弹窗变成手机底部 sheet 模式 · 在桌面端**贴在屏底窄长条**显示 · 看起来错位。

### 正确做法
桌面 admin 页面用 `variant="centered"`：
```tsx
<Dialog open={...} onClose={...} title="..." variant="centered">
```

`sheet` 给手机用、`overlay` 给搜索浮层、`centered` 给桌面 modal。

### 历史事故
- `78c5b4f` Dialog.tsx 加 centered variant + AdminCoursesPage 全部 Dialog 切到 centered

---

## 🟢 8. 操作前先描述视觉 · 防止改完才发现方向不对

### 流程
做视觉改动前 · 先**用文字描述给用户**：
- 改成什么布局
- 哪些元素改大小 / 颜色 / 位置
- 状态机（empty / loading / 已完成 等）

用户回 OK 才动手。**比改完截图来回返工省一半时间**。

### 反例
* Step 3 改详情页课时行 · 一上来就把布局重做 · 用户说「不对 · 阅读 pill 要保留」· 又要回滚一半工作

### 正例
* 这次写 CSS-GOTCHAS.md · 先把目录给用户看 · 没异议才写正文

---

## 🟢 9. 提交前自检 checklist

```
□ npm run typecheck 干净
□ npm run lint 0 errors（warnings 不阻塞）
□ 视觉改动 · 已用文字描述确认方向
□ fixed 元素 · 已 createPortal 或确认无祖先 transform
□ objectFit / aspectRatio · 已确认裁切 vs 留白哪种语义
□ zod schema · create 和 update 一致接受 null
□ invalidateQueries · 只 invalidate 最浅前缀
```

漏一项就有概率重蹈覆辙。
