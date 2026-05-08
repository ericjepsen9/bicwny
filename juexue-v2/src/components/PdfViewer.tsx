// PdfViewer · in-app PDF 阅读器
//
// 用法：
//   inline 嵌入页面（默认 mode='inline'）：<PdfViewer url={pdfUrl} title="讲义" />
//   modal 全屏（点工具栏 ⤢ 按钮自动切到 modal）
//
// 功能：
//   - canvas 渲染 · 不跳出 app · iOS Safari + Chromium 兼容
//   - 工具栏：缩放 +/- · 全屏切换 · 翻页
//   - 加载进度条（解决用户感受的「卡死」问题）
//   - 浏览器双指 pinch 缩放仍工作（passive scroll）
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useLang } from '@/lib/i18n';

// PDF.js worker · vite 静态 import · 不依赖 CDN
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface PdfViewerProps {
  url: string;
  title?: string;
  /** inline 嵌入页面（默认）· modal 全屏弹窗 */
  mode?: 'modal' | 'inline';
  onClose?: () => void;
}

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

export default function PdfViewer({ url, title, mode = 'modal', onClose }: PdfViewerProps) {
  const { s } = useLang();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNum, setPageNum] = useState<number>(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<number>(0); // 0-100
  const [containerW, setContainerW] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);  // 1.0 = fit-width 默认
  const [internalFullscreen, setInternalFullscreen] = useState(false);

  // 实际渲染模式：传入 modal · 或 inline 状态下用户点了全屏
  const effectiveMode: 'modal' | 'inline' = mode === 'modal' || internalFullscreen ? 'modal' : 'inline';
  const isFullscreen = effectiveMode === 'modal';

  // 容器宽度自适应
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      // modal 模式占满 · inline 模式留 32px padding · 桌面限 1200
      const max = isFullscreen ? 1200 : 800;
      setContainerW(Math.min(w - (isFullscreen ? 16 : 32), max));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isFullscreen]);

  // 键盘控制
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isFullscreen && e.key === 'Escape') {
        if (mode === 'modal' && onClose) onClose();
        else setInternalFullscreen(false);
      }
      if (e.key === 'ArrowLeft' && pageNum > 1) setPageNum(pageNum - 1);
      if (e.key === 'ArrowRight' && pageNum < numPages) setPageNum(pageNum + 1);
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-' || e.key === '_') zoomOut();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, numPages, isFullscreen, mode, onClose]);

  // 锁 body 滚动 · 仅 fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isFullscreen]);

  function zoomIn() {
    setZoom((z) => {
      const idx = ZOOM_STEPS.findIndex((s) => s > z);
      return idx === -1 ? z : ZOOM_STEPS[idx]!;
    });
  }
  function zoomOut() {
    setZoom((z) => {
      const reversed = [...ZOOM_STEPS].reverse();
      const idx = reversed.findIndex((s) => s < z);
      return idx === -1 ? z : reversed[idx]!;
    });
  }
  function resetZoom() {
    setZoom(1);
  }

  // 渲染宽度 = 容器宽 × zoom · 超出容器时水平滚动
  const pageWidth = containerW > 0 ? containerW * zoom : 0;

  function handleFullscreenToggle() {
    if (mode === 'modal') {
      // 已经是 modal · 关闭
      onClose?.();
    } else {
      setInternalFullscreen((v) => !v);
    }
  }

  // ── 渲染：按 effectiveMode 输出 inline 卡片 / modal 全屏 ──
  const documentEl = (
    <Document
      file={url}
      onLoadProgress={({ loaded, total }) => {
        setLoadProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
      }}
      onLoadSuccess={({ numPages: n }) => { setNumPages(n); setLoadError(null); setLoadProgress(100); }}
      onLoadError={(e) => setLoadError(e.message)}
      loading={null}
    >
      <Page
        pageNumber={pageNum}
        width={pageWidth || undefined}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={null}
      />
    </Document>
  );

  const isLoading = numPages === 0 && !loadError;

  const errorEl = loadError ? (
    <div style={{ color: isFullscreen ? '#fff' : 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-4)' }}>
      ⚠️ {s('PDF 加载失败', 'PDF 載入失敗', 'PDF load failed')}: {loadError}
    </div>
  ) : null;

  const loadingEl = isLoading ? (
    <div style={{
      padding: 'var(--sp-4)', color: isFullscreen ? '#fff' : 'var(--ink-3)',
      textAlign: 'center', minHeight: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 'var(--sp-3)',
    }}>
      <div style={{ font: 'var(--text-body)' }}>
        {s('加载中', '載入中', 'Loading')} · {loadProgress}%
      </div>
      <div style={{
        width: 200, height: 4, borderRadius: 2,
        background: isFullscreen ? 'rgba(255,255,255,.2)' : 'var(--glass)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: loadProgress + '%',
          background: 'var(--saffron-dark)',
          transition: 'width .15s',
        }} />
      </div>
      <div style={{ font: 'var(--text-caption)', opacity: 0.7 }}>
        {s('大文件首次加载较慢 · 后续翻页会瞬间', '大檔案首次載入較慢 · 後續翻頁會瞬間', 'Large files load slowly first time · subsequent pages are instant')}
      </div>
    </div>
  ) : null;

  // 工具栏（统一：inline 和 modal 都用）
  const toolbar = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
      padding: 'var(--sp-2) var(--sp-3)',
      background: isFullscreen ? 'rgba(0,0,0,.5)' : 'var(--glass)',
      borderBottom: isFullscreen ? 'none' : '1px solid var(--border-light)',
      color: isFullscreen ? '#fff' : 'var(--ink-3)',
      font: 'var(--text-caption)', letterSpacing: 1,
      flexShrink: 0,
    }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        📄 {title ?? s('讲义', '講義', 'Slides')}
      </span>

      {/* 缩放 */}
      <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_STEPS[0]!} style={btnStyle(isFullscreen)}>−</button>
      <button type="button" onClick={resetZoom} style={{ ...btnStyle(isFullscreen), minWidth: 56 }}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]!} style={btnStyle(isFullscreen)}>+</button>

      {/* 全屏 / 关闭 */}
      <button
        type="button"
        onClick={handleFullscreenToggle}
        aria-label={isFullscreen ? s('退出全屏', '退出全屏', 'Exit fullscreen') : s('全屏', '全屏', 'Fullscreen')}
        style={btnStyle(isFullscreen)}
      >
        {isFullscreen ? '✕' : '⤢'}
      </button>
    </div>
  );

  // 翻页条
  const pageBar = numPages > 1 && !loadError ? (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--sp-2) var(--sp-3)',
      background: isFullscreen ? 'rgba(0,0,0,.5)' : 'var(--glass)',
      borderTop: isFullscreen ? 'none' : '1px solid var(--border-light)',
      flexShrink: 0,
      paddingBottom: isFullscreen ? 'calc(var(--sp-2) + env(safe-area-inset-bottom, 0px))' : 'var(--sp-2)',
    }}>
      <button
        type="button"
        disabled={pageNum <= 1}
        onClick={() => setPageNum(pageNum - 1)}
        style={pageBtn(isFullscreen, pageNum <= 1)}
      >← {s('上一页', '上一頁', 'Prev')}</button>
      <span style={{
        font: 'var(--text-caption)',
        color: isFullscreen ? '#fff' : 'var(--ink-3)',
        letterSpacing: 1,
      }}>
        {pageNum} / {numPages}
      </span>
      <button
        type="button"
        disabled={pageNum >= numPages}
        onClick={() => setPageNum(pageNum + 1)}
        style={pageBtn(isFullscreen, pageNum >= numPages)}
      >{s('下一页', '下一頁', 'Next')} →</button>
    </div>
  ) : null;

  // 内容区
  const content = (
    <div style={{
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'var(--sp-3)',
      background: isFullscreen ? 'rgba(43,34,24,.95)' : '#fff',
      WebkitOverflowScrolling: 'touch',
      minHeight: isFullscreen ? 0 : 400,
    }}>
      {errorEl}
      {loadingEl}
      {!loadError && documentEl}
    </div>
  );

  // ── inline 模式 ──
  if (!isFullscreen) {
    return (
      <div style={{
        background: 'rgba(43,34,24,.04)',
        borderRadius: 'var(--r)',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {toolbar}
        {content}
        {pageBar}
      </div>
    );
  }

  // ── modal 模式（全屏）──
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? s('讲义', '講義', 'Slides')}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(43,34,24,.98)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {toolbar}
      {content}
      {pageBar}
    </div>,
    document.body,
  );
}

// ── 共用样式 ──
function btnStyle(fs: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 'var(--r-sm)',
    background: fs ? 'rgba(255,255,255,.15)' : 'var(--bg-input)',
    border: '1px solid ' + (fs ? 'rgba(255,255,255,.2)' : 'var(--border)'),
    color: fs ? '#fff' : 'var(--ink-2)',
    cursor: 'pointer', font: 'var(--text-caption)', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  };
}

function pageBtn(fs: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 'var(--r-pill)',
    background: fs
      ? (disabled ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.2)')
      : 'transparent',
    border: '1px solid ' + (fs ? 'rgba(255,255,255,.15)' : 'var(--border)'),
    color: fs ? '#fff' : (disabled ? 'var(--ink-4)' : 'var(--ink-2)'),
    font: 'var(--text-caption)', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
