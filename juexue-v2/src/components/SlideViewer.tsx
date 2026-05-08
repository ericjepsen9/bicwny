// SlideViewer · 幻灯片观修浏览器（图片版 · 性能秒杀 PDF.js）
//
// 设计：
//   - 直接 <img> · 浏览器原生渲染 · 没有 JS 解析 PDF 的开销
//   - 单页 50KB · 横滑翻页 · 懒加载 + 邻页预加载
//   - object-fit: contain · 永远完整显示一页（黑边可接受）
//   - 全屏按钮常驻 · 横屏自动全屏 · 双指 pinch-zoom 浏览器原生
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/i18n';

export interface SlideViewerProps {
  /** 图片 URL 数组 · 按页序 */
  imageUrls: string[];
  title?: string;
  mode?: 'modal' | 'inline';
  onClose?: () => void;
}

export default function SlideViewer({ imageUrls, mode = 'inline', onClose }: SlideViewerProps) {
  const { s } = useLang();
  const [currentPage, setCurrentPage] = useState(1);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFullscreen = mode === 'modal' || internalFullscreen;
  const numPages = imageUrls.length;

  // scroll snap 跟当前页
  useEffect(() => {
    const el = containerRef.current;
    if (!el || numPages === 0) return;
    function onScroll() {
      const w = el!.clientWidth;
      if (w === 0) return;
      const idx = Math.round(el!.scrollLeft / w);
      setCurrentPage(idx + 1);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [numPages]);

  // 横屏自动全屏
  useEffect(() => {
    if (mode === 'modal') return;
    const mq = window.matchMedia('(orientation: landscape)');
    function onChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) setInternalFullscreen(true);
    }
    onChange(mq);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  // 键盘
  useEffect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (mode === 'modal') onClose?.();
        else setInternalFullscreen(false);
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const el = containerRef.current;
        if (!el) return;
        el.scrollBy({ left: el.clientWidth * (e.key === 'ArrowRight' ? 1 : -1), behavior: 'smooth' });
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen, mode, onClose]);

  // body 滚动锁
  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isFullscreen]);

  function handleFullscreenToggle() {
    if (mode === 'modal') onClose?.();
    else setInternalFullscreen((v) => !v);
  }

  const fsBtn = (
    <button
      type="button"
      onClick={handleFullscreenToggle}
      aria-label={isFullscreen ? s('退出', '退出', 'Exit') : s('全屏', '全屏', 'Fullscreen')}
      style={{
        position: 'absolute', top: 12, right: 12, zIndex: 10,
        width: 38, height: 38, borderRadius: '50%',
        background: 'rgba(0,0,0,.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: 'none', color: '#fff', fontSize: 18,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {isFullscreen ? '✕' : '⤢'}
    </button>
  );

  const pageHud = numPages > 1 ? (
    <div style={{
      position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10,
      padding: '6px 16px', borderRadius: 'var(--r-pill)',
      background: 'rgba(0,0,0,.55)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      color: '#fff',
      font: 'var(--text-caption)', letterSpacing: 1.5, fontWeight: 600,
      pointerEvents: 'none',
    }}>
      {currentPage} / {numPages}
    </div>
  ) : null;

  // 邻页预加载策略：当前页 ± 2 页 eager · 其他 lazy
  // 让翻页瞬间无白屏 · 不预先全部下载
  const slides = imageUrls.map((src, i) => {
    const distance = Math.abs(i + 1 - currentPage);
    const eager = distance <= 2;
    return (
      <div
        key={i}
        style={{
          flex: '0 0 100%',
          scrollSnapAlign: 'center',
          height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <img
          src={src}
          alt={`Slide ${i + 1}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          style={{
            // 关键：竖屏完整显示 · 用 max-* 不超容器
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            userSelect: 'none',
          }}
        />
      </div>
    );
  });

  if (numPages === 0) {
    return (
      <div style={{
        position: 'relative', minHeight: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-3)', font: 'var(--text-body)',
        background: 'var(--glass)', borderRadius: 'var(--r)',
      }}>
        {s('（暂无讲义）', '（暫無講義）', '(no slides)')}
      </div>
    );
  }

  const inner = (
    <>
      {fsBtn}
      {pageHud}
      <div
        ref={containerRef}
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'row',
          overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {slides}
      </div>
    </>
  );

  if (!isFullscreen) {
    return (
      <div style={{
        position: 'relative',
        height: '70vh',
        borderRadius: 'var(--r)',
        overflow: 'hidden',
        background: '#000',
      }}>
        {inner}
      </div>
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: '#000',
    }}>
      {inner}
    </div>,
    document.body,
  );
}
