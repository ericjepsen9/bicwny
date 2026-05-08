// PdfViewer · 幻灯片观修浏览器（仿相册体验）
//
// 设计：
//   - 横向滑动翻页（CSS scroll-snap）· 像看相册
//   - 每页 fit-screen 完整显示（不裁不溢）· 短边 fit
//   - 全屏按钮常驻右上角 · 不 auto-hide
//   - 横屏自动全屏（matchMedia orientation 监听）
//   - 单页内可双指放大 / 滚动看大图
//   - 加载进度
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

interface PageDim { w: number; h: number }

export default function PdfViewer({ url, mode = 'modal', onClose }: PdfViewerProps) {
  const { s } = useLang();
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [pageDim, setPageDim] = useState<PageDim | null>(null);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFullscreen = mode === 'modal' || internalFullscreen;

  // 容器尺寸 · 用 ResizeObserver 实时跟踪
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen]);

  // 页比例（首页加载后获取 · 假设所有页同尺寸）
  // react-pdf Page 的 onLoadSuccess 给原始 view{width,height}
  // 然后我们计算 fit 容器的渲染尺寸
  const renderSize: PageDim | null = pageDim && containerSize.w > 0 && containerSize.h > 0
    ? fitInside(pageDim, containerSize.w, containerSize.h)
    : null;

  // 横屏自动全屏
  useEffect(() => {
    if (mode === 'modal') return; // modal 已经全屏 · 不需自动
    const mq = window.matchMedia('(orientation: landscape)');
    function onChange(e: MediaQueryListEvent | MediaQueryList) {
      // 横屏 + 用户在 inline 模式 · 自动进全屏
      if (e.matches) setInternalFullscreen(true);
    }
    onChange(mq); // 初始检测
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  // 当前页 · scroll snap 监听
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

  // ESC 退全屏 · 左右翻页
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

  // 锁 body 滚动
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

  // 渲染单页
  const renderPage = (n: number) => (
    <div
      key={n}
      style={{
        flex: '0 0 100%',
        scrollSnapAlign: 'center',
        height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <Page
        pageNumber={n}
        width={renderSize?.w}
        height={renderSize?.h}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={null}
        onLoadSuccess={n === 1 ? (page) => {
          // 首页加载后 · 拿原始页面尺寸（PDF 内部坐标 · 1pt = 1/72 inch）
          setPageDim({ w: page.width, h: page.height });
        } : undefined}
      />
    </div>
  );

  const errorEl = loadError ? (
    <div style={absCenter('#fff')}>
      ⚠️ {s('加载失败', '載入失敗', 'Failed')}: {loadError}
    </div>
  ) : null;

  const loadingEl = numPages === 0 && !loadError ? (
    <div style={absCenterCol('#fff')}>
      <div style={{ font: 'var(--text-body)' }}>{loadProgress}%</div>
      <div style={{ width: 160, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: loadProgress + '%', background: 'var(--saffron-dark)', transition: 'width .15s' }} />
      </div>
    </div>
  ) : null;

  // 全屏按钮 · 常驻 · 不 auto-hide
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

  // 页码 · 常驻底部
  const pageHud = numPages > 1 && !loadError ? (
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
        }}
      >
        {Array.from({ length: numPages }, (_, i) => renderPage(i + 1))}
      </div>
    </Document>
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
        {fsBtn}
        {pageHud}
        {errorEl}
        {loadingEl}
        {!loadError && docEl}
      </div>
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: '#000',
    }}>
      {fsBtn}
      {pageHud}
      {errorEl}
      {loadingEl}
      {!loadError && docEl}
    </div>,
    document.body,
  );
}

// 计算 fit-inside 渲染尺寸：保留 PDF 原始比例 · 短边 fit 容器
function fitInside(page: PageDim, cw: number, ch: number): PageDim {
  if (cw <= 0 || ch <= 0) return page;
  const ratio = Math.min(cw / page.w, ch / page.h);
  return { w: page.w * ratio, h: page.h * ratio };
}

function absCenter(color: string): React.CSSProperties {
  return {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color, textAlign: 'center', padding: 'var(--sp-4)',
  };
}

function absCenterCol(color: string): React.CSSProperties {
  return {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 12, color,
  };
}
