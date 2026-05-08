// SlideViewer · 幻灯片观修浏览器（图片版）
//
// 设计：
//   - 直接 <img> 渲染 · 浏览器原生 · 性能秒杀 PDF.js
//   - 容器自适应 slide 比例：首图加载后 · 测出 ratio · 设置 aspect-ratio CSS
//     竖屏看 16:9 PPT 时 · 容器变成扁的 · 不留大黑边
//   - 全屏按钮带「全屏」文字 · 显眼
//   - 横屏自动全屏（matchMedia orientation）
//   - 单页内可双指 pinch-zoom（浏览器原生）
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/i18n';

export interface SlideViewerProps {
  imageUrls: string[];
  title?: string;
  mode?: 'modal' | 'inline';
  onClose?: () => void;
}

export default function SlideViewer({ imageUrls, mode = 'inline', onClose }: SlideViewerProps) {
  const { s } = useLang();
  const [currentPage, setCurrentPage] = useState(1);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null); // w / h
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

  // 邻页预加载
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
          onLoad={i === 0 ? (e) => {
            // 首图加载后 · 测原始比例 · 设容器 aspect-ratio
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setAspectRatio(img.naturalWidth / img.naturalHeight);
            }
          } : undefined}
          style={{
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

  // 全屏按钮 · 带文字「全屏 / 退出」· 显眼
  const fsBtn = (
    <button
      type="button"
      onClick={handleFullscreenToggle}
      style={{
        position: 'absolute', top: 12, right: 12, zIndex: 10,
        height: 36, padding: '0 14px',
        borderRadius: 'var(--r-pill)',
        background: 'rgba(0,0,0,.7)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,.2)',
        color: '#fff',
        font: 'var(--text-caption)',
        fontWeight: 600,
        letterSpacing: 1,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      <span style={{ fontSize: 16 }}>{isFullscreen ? '✕' : '⤢'}</span>
      <span>{isFullscreen ? s('退出', '退出', 'Exit') : s('全屏', '全屏', 'Fullscreen')}</span>
    </button>
  );

  const pageHud = numPages > 1 ? (
    <div style={{
      position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10,
      padding: '6px 16px', borderRadius: 'var(--r-pill)',
      background: 'rgba(0,0,0,.7)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      color: '#fff',
      font: 'var(--text-caption)', letterSpacing: 1.5, fontWeight: 600,
      pointerEvents: 'none',
    }}>
      {currentPage} / {numPages}
    </div>
  ) : null;

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
    // inline 模式：容器 aspect-ratio 跟首图同比例 · 消除大黑边
    // 加 maxHeight 防超长（罕见的窄高比例 PPT 把屏幕撑爆）
    const containerStyle: React.CSSProperties = aspectRatio
      ? {
          aspectRatio: String(aspectRatio),
          maxHeight: '70vh',
          width: '100%',
        }
      : { height: '50vh' }; // 加载中默认 · 不太占
    return (
      <div style={{
        position: 'relative',
        ...containerStyle,
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
