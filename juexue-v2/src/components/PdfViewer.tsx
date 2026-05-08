// PdfViewer · 幻灯片观修浏览器（仿相册/幻灯片体验）
//
// 设计：
//   - 横向滑动翻页（CSS scroll-snap · 不是上下滚）· 像看相册
//   - 每页全屏显示 · 默认 fit-screen
//   - 双指 pinch zoom（浏览器原生 · 在 inline 里用 transform · modal 里直接靠 viewport）
//   - 极简 UI：右上角 ⤢/✕ · 底部页码 1/N（auto-hide）
//   - 加载进度条
//
// 不再有：上一页/下一页按钮 · 缩放按钮 · 工具栏
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { useLang } from '@/lib/i18n';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface PdfViewerProps {
  url: string;
  title?: string;
  mode?: 'modal' | 'inline';
  onClose?: () => void;
}

export default function PdfViewer({ url, mode = 'modal', onClose }: PdfViewerProps) {
  const { s } = useLang();
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hudHideRef = useRef<number | null>(null);

  const isFullscreen = mode === 'modal' || internalFullscreen;

  // 容器尺寸（根据 fullscreen 自适应）
  useEffect(() => {
    function update() {
      const el = containerRef.current;
      if (el) {
        setContainerSize({ w: el.clientWidth, h: el.clientHeight });
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isFullscreen]);

  // 当前页 · 监听 scroll snap 切换
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

  // ESC 退全屏
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
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        el.scrollBy({ left: el.clientWidth * dir, behavior: 'smooth' });
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen, mode, onClose]);

  // 锁 body 滚动
  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isFullscreen]);

  // HUD 自动隐藏（点击容器复现）
  function flashHud() {
    setShowHud(true);
    if (hudHideRef.current) window.clearTimeout(hudHideRef.current);
    hudHideRef.current = window.setTimeout(() => setShowHud(false), 2200);
  }
  useEffect(() => {
    flashHud();
    return () => { if (hudHideRef.current) window.clearTimeout(hudHideRef.current); };
  }, [currentPage]);

  function handleFullscreenToggle() {
    if (mode === 'modal') onClose?.();
    else setInternalFullscreen((v) => !v);
  }

  // 单页渲染：fit 容器（保留比例 · 一般 PDF 是竖版 A4 · 配 60-70vh 容器高度刚好）
  // PDF 页比例宽高 = 实际比例 · react-pdf 用 width 自动算高
  const pageRender = (n: number) => (
    <div
      key={n}
      style={{
        flex: '0 0 100%',
        scrollSnapAlign: 'center',
        height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'auto', // 单页内可双指放大滚动
        WebkitOverflowScrolling: 'touch',
      }}
      onClick={flashHud}
    >
      <Page
        pageNumber={n}
        width={containerSize.w || undefined}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={null}
      />
    </div>
  );

  const errorEl = loadError ? (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', textAlign: 'center', padding: 'var(--sp-4)',
    }}>
      ⚠️ {s('加载失败', '載入失敗', 'Failed')}: {loadError}
    </div>
  ) : null;

  const loadingEl = numPages === 0 && !loadError ? (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 12,
      color: '#fff',
    }}>
      <div style={{ font: 'var(--text-body)' }}>{loadProgress}%</div>
      <div style={{ width: 160, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: loadProgress + '%', background: 'var(--saffron-dark)', transition: 'width .15s' }} />
      </div>
    </div>
  ) : null;

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
        opacity: showHud ? 1 : 0,
        transition: 'opacity .25s',
        pointerEvents: showHud ? 'auto' : 'none',
      }}
    >
      {isFullscreen ? '✕' : '⤢'}
    </button>
  );

  const pageHud = numPages > 0 && !loadError ? (
    <div
      style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10,
        padding: '6px 16px', borderRadius: 'var(--r-pill)',
        background: 'rgba(0,0,0,.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: '#fff',
        font: 'var(--text-caption)', letterSpacing: 1.5, fontWeight: 600,
        opacity: showHud ? 1 : 0,
        transition: 'opacity .25s',
        pointerEvents: 'none',
      }}
    >
      {currentPage} / {numPages}
    </div>
  ) : null;

  const docEl = (
    <Document
      file={url}
      onLoadProgress={({ loaded, total }) => {
        setLoadProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
      }}
      onLoadSuccess={({ numPages: n }) => { setNumPages(n); setLoadError(null); setLoadProgress(100); }}
      onLoadError={(e) => setLoadError(e.message)}
      loading={null}
    >
      <div
        ref={containerRef}
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'row',
          overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          background: '#000',
        }}
      >
        {Array.from({ length: numPages }, (_, i) => pageRender(i + 1))}
      </div>
    </Document>
  );

  // ── inline 嵌入页面 ──
  if (!isFullscreen) {
    return (
      <div style={{
        position: 'relative',
        height: '70vh',
        borderRadius: 'var(--r)',
        overflow: 'hidden',
        background: '#000',
      }}>
        {fsBtn}
        {pageHud}
        {errorEl}
        {loadingEl}
        {!loadError && docEl}
      </div>
    );
  }

  // ── 全屏 ──
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
      }}
    >
      {fsBtn}
      {pageHud}
      {errorEl}
      {loadingEl}
      {!loadError && docEl}
    </div>,
    document.body,
  );
}
