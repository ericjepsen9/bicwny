// 法本阅读相关工具函数 · 从 ScriptureReadingPage 拆出来
//   - splitParagraphs: 按段落切分法本原文
//   - renderParaWithHighlights: 把段落 + 高亮 ranges 渲染为 [text, <mark>, ...]
//   - textOffsetWithin: 计算 selection 在段落 textContent 中的字符偏移
//   - HIGHLIGHT_BG: 4 色高亮的背景色 map
import type { Highlight, HighlightColor } from '@/lib/queries';

/**
 * 把闻思原文按段落切 · 优先双换行 · 兜底单换行
 *   - byDouble.length > 1 → 用 \n\n 切
 *   - 否则 byDouble.length === 1 但内部有 \n → 用 \n 切
 *   - 单段不切（直接返回 [text.trim()]）
 */
export function splitParagraphs(text: string): string[] {
  const byDouble = text.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  if (byDouble.length > 1) return byDouble;
  // 单 \n 兜底 · 但每段至少要存在（不限制字数 · 让用户自己控制）
  const bySingle = text.split(/\n/g).map((p) => p.trim()).filter((p) => p.length > 0);
  return bySingle.length > 1 ? bySingle : [text.trim()];
}

/**
 * 4 色高亮 · 浅色背景 + 不影响阅读对比
 */
export const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 220, 80, 0.55)',
  green: 'rgba(120, 200, 130, 0.45)',
  blue: 'rgba(120, 180, 240, 0.45)',
  pink: 'rgba(245, 140, 180, 0.45)',
};

/**
 * 按高亮 ranges 切段落文本 · 渲染为 [text, <mark>, text, <mark>, ...]
 * 点击 <mark> 触发 onDelete · 单段段落级处理 · 不支持嵌套（取后者）
 */
export function renderParaWithHighlights(
  para: string,
  highlights: Highlight[],
  onDelete: (id: string) => void,
): React.ReactNode {
  if (highlights.length === 0) return para;
  // 按 textStart 升序 · 合并重叠的（不支持嵌套 · 取后者）
  const sorted = [...highlights].sort((a, b) => a.textStart - b.textStart);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of sorted) {
    const start = Math.max(h.textStart, cursor);
    const end = Math.min(h.textEnd, para.length);
    if (end <= start) continue;
    if (start > cursor) out.push(para.slice(cursor, start));
    out.push(
      <mark
        key={h.id}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm('删除这条标记？')) onDelete(h.id);
        }}
        style={{
          background: HIGHLIGHT_BG[h.color],
          color: 'inherit',
          padding: '0 1px',
          borderRadius: 2,
          cursor: 'pointer',
        }}
      >
        {para.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < para.length) out.push(para.slice(cursor));
  return out;
}

/**
 * 计算 node + offset 在 root 内的文本字符偏移
 * 用于把 selection 转成段落 textContent 字符 range（高亮 anchor 必需）
 */
export function textOffsetWithin(root: Element, container: Node, offset: number): number {
  let sum = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null = walker.nextNode();
  while (n) {
    if (n === container) return sum + offset;
    sum += (n.textContent ?? '').length;
    n = walker.nextNode();
  }
  return sum;
}
