// PdfViewer · in-app PDF 阅读器（仿 Chrome 内置 viewer · 连续滚动 + 极简）
//
// 设计：
//   - 连续滚动：所有页竖向堆叠 · 像浏览器原生 · 不再点 上一页/下一页
//   - 不要工具栏：清爽 · 用户专注内容
//   - 浏览器原生 pinch-zoom（PWA viewport 支持时）
//   - 加载进度条：让用户知道大文件还在拉
//   - 仅一个全屏按钮 · 移动端建议横屏看
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
  /** inline 嵌入页面 · modal 全屏 · 默认 inline */
  mode?: 'modal' | 'inline';
  onClose?: () => void;
}

export default function PdfViewer({ url, mode = 'modal', onClose }: PdfViewerProps) {
  const { s } = useLang();
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFullscreen = mode === 'modal' || internalFullscreen;

  // 容器宽度自适应
  useEffect(() => {
    function update() {
      const el = containerRef.current;
      if (el) {
        setContainerW(el.clientWidth - 16); // 留点边距
      } else {
        const w = window.innerWidth;
        setContainerW(Math.min(w - 16, isFullscreen ? 1200 : 800));
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isFullscreen]);

  // ESC 退全屏
  useEffect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (mode === 'modal') onClose?.();
        else setInternalFullscreen(false);
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

  // 渲染所有页（连续滚动）
  const pagesEl = numPages > 0 && !loadError ? (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {Array.from({ length: numPages }, (_, i) => (
        <Page
          key={i + 1}
          pageNumber={i + 1}
          width={containerW || undefined}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={null}
        />
      ))}
    </div>
  ) : null;

  const errorEl = loadError ? (
    <div style={{
      color: isFullscreen ? '#fff' : 'var(--crimson)',
      textAlign: 'center', padding: 'var(--sp-5)', font: 'var(--text-body)',
    }}>
      ⚠️ {s('PDF 加载失败', 'PDF 載入失敗', 'PDF load failed')}: {loadError}
    </div>
  ) : null;

  const loadingEl = numPages === 0 && !loadError ? (
    <div style={{
      padding: 'var(--sp-5)',
      color: isFullscreen ? '#fff' : 'var(--ink-3)',
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
    </div>
  ) : null;

  // 极简右上角按钮：全屏 / 退出
  const fsBtn = (
    <button
      type="button"
      onClick={() => {
        if (mode === 'modal') onClose?.();
        else setInternalFullscreen((v) => !v);
      }}
      aria-label={isFullscreen ? s('退出全屏', '退出全屏', 'Exit') : s('全屏', '全屏', 'Fullscreen')}
      style={{
        position: 'absolute', top: 8, right: 8, zIndex: 10,
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(0,0,0,.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: 'none',
        color: '#fff', fontSize: 18, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {isFullscreen ? '✕' : '⤢'}
    </button>
  );

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
      {pagesEl}
    </Document>
  );

  const inner = (
    <>
      {fsBtn}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          background: isFullscreen ? '#1a1410' : '#f5f5f0',
          padding: '12px 8px',
          WebkitOverflowScrolling: 'touch',
          minHeight: isFullscreen ? 0 : 500,
        }}
      >
        {errorEl}
        {loadingEl}
        {!loadError && docEl}
      </div>
    </>
  );

  // inline 卡片
  if (!isFullscreen) {
    return (
      <div style={{
        position: 'relative',
        borderRadius: 'var(--r)',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        height: '70vh',
      }}>
        {inner}
      </div>
    );
  }

  // 全屏
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {inner}
    </div>,
    document.body,
  );
}
