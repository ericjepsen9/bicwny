// 觉学 v2 · A11y 工具
// 对应老版 prototypes/shared/a11y.js
//
// 提供：
//   - <Announcer> 单例 · 全局 aria-live polite/assertive announcer
//   - announce(msg, polite?) · 任何地方调用让 SR 朗读
//   - useFocusTrap(ref, active) · 给 Dialog 用 · Tab/Shift+Tab 圈在容器内
import { useEffect, type RefObject } from 'react';

let announcerEl: HTMLDivElement | null = null;

function ensureAnnouncer(): HTMLDivElement {
  if (announcerEl) return announcerEl;
  const el = document.createElement('div');
  el.id = 'jx-a11y-announcer';
  el.className = 'sr-only';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);
  announcerEl = el;
  return el;
}

export function announce(msg: string, polite = true): void {
  const el = ensureAnnouncer();
  el.setAttribute('aria-live', polite ? 'polite' : 'assertive');
  // 双写触发 · 同样文本第二次 SR 不读 · 加占位换行让它认为变化
  el.textContent = '';
  setTimeout(() => { el.textContent = String(msg ?? ''); }, 30);
}

const FOCUSABLE_SEL = [
  'a[href]', 'area[href]', 'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]', 'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  'iframe', 'summary', 'details',
].join(',');

export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.offsetParent === null) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  });
}

/**
 * 焦点陷阱 hook · ref 指向 modal 容器 · active=true 时启用
 *   - 进入时 focus 第一个可聚焦
 *   - Tab/Shift+Tab 圈在容器内
 *   - 退出时还原焦点到打开者
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const items = focusableIn(container);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', onKey);
    // 默认聚焦容器内第一个可聚焦 · setTimeout 避开 render 后立即 focus 的渲染冲突
    const tid = window.setTimeout(() => {
      const items = focusableIn(container);
      items[0]?.focus();
    }, 50);

    // 锁住 body 滚动
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    return () => {
      container.removeEventListener('keydown', onKey);
      window.clearTimeout(tid);
      document.documentElement.style.overflow = prevOverflow;
      try { prevFocus?.focus(); } catch { /* ignore */ }
    };
  }, [active, ref]);
}
