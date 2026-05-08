// PdfViewer · 全屏 PDF 阅读器（in-app · 不跳出去）
//
// 用法：
//   <PdfViewer url={pdfUrl} title="讲义" onClose={() => setOpen(false)} />
//
// 实现：
//   - react-pdf (基于 pdfjs-dist) · canvas 渲染 · 完全在 app 内
//   - 上下翻页 · 双指缩放 (浏览器原生) · 错误兜底
//   - iOS Safari + Chromium 都验证可用 · 不会触发系统 PDF 打开
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useLang } from '@/lib/i18n';

// PDF.js worker · 用 vite 静态 import · 不依赖 CDN
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface PdfViewerProps {
  url: string;
  title?: string;
  /** 'modal' 全屏弹窗（默认 · 带关闭）· 'inline' 嵌入页面（无关闭 · 高度自适应） */
  mode?: 'modal' | 'inline';
  onClose?: () => void;
}

export default function PdfViewer({ url, title, mode = 'modal', onClose }: PdfViewerProps) {
  const { s } = useLang();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNum, setPageNum] = useState<number>(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(0);

  // 容器宽度自适应（iPhone 竖屏 / 横屏）
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      // 留 16px padding · 桌面限制最大 800px
      setPageWidth(Math.min(w - 32, 800));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 键盘左右翻页 · ESC 关闭（仅 modal 模式）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (mode === 'modal' && e.key === 'Escape' && onClose) onClose();
      if (e.key === 'ArrowLeft' && pageNum > 1) setPageNum(pageNum - 1);
      if (e.key === 'ArrowRight' && pageNum < numPages) setPageNum(pageNum + 1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pageNum, numPages, onClose, mode]);

  // 锁 body 滚动 · 仅 modal
  useEffect(() => {
    if (mode !== 'modal') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mode]);

  // ── inline 模式 · 嵌入页面 · 没有 portal / overlay / 关闭按钮 ──
  if (mode === 'inline') {
    return (
      <div style={{
        background: 'rgba(43,34,24,.04)',
        borderRadius: 'var(--r)',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--sp-2) var(--sp-3)',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--glass)',
          font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.2,
        }}>
          <span>📄 {title ?? s('讲义', '講義', 'Slides')}</span>
          {numPages > 0 && <span>{pageNum} / {numPages}</span>}
        </div>
        <div style={{
          minHeight: 400, padding: 'var(--sp-3)',
          display: 'flex', justifyContent: 'center',
          background: '#fff',
        }}>
          {loadError ? (
            <div style={{ color: 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-4)' }}>
              ⚠️ {s('PDF 加载失败', 'PDF 載入失敗', 'PDF load failed')}: {loadError}
            </div>
          ) : (
            <Document
              file={url}
              onLoadSuccess={({ numPages: n }) => { setNumPages(n); setLoadError(null); }}
              onLoadError={(e) => setLoadError(e.message)}
              loading={
                <div style={{ color: 'var(--ink-3)', font: 'var(--text-body)', padding: 'var(--sp-4)' }}>
                  {s('加载 PDF 中…', '載入 PDF 中…', 'Loading PDF…')}
                </div>
              }
            >
              <Page
                pageNumber={pageNum}
                width={pageWidth || undefined}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={null}
              />
            </Document>
          )}
        </div>
        {numPages > 1 && !loadError && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'var(--sp-2) var(--sp-3)',
            borderTop: '1px solid var(--border-light)',
            background: 'var(--glass)',
          }}>
            <button
              type="button"
              disabled={pageNum <= 1}
              onClick={() => setPageNum(pageNum - 1)}
              className="btn btn-pill"
              style={{
                padding: '6px 14px', font: 'var(--text-caption)',
                background: 'transparent', border: '1px solid var(--border)',
                color: pageNum <= 1 ? 'var(--ink-4)' : 'var(--ink-2)',
                opacity: pageNum <= 1 ? 0.5 : 1,
              }}
            >← {s('上一页', '上一頁', 'Prev')}</button>
            <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
              {pageNum} / {numPages}
            </span>
            <button
              type="button"
              disabled={pageNum >= numPages}
              onClick={() => setPageNum(pageNum + 1)}
              className="btn btn-pill"
              style={{
                padding: '6px 14px', font: 'var(--text-caption)',
                background: 'transparent', border: '1px solid var(--border)',
                color: pageNum >= numPages ? 'var(--ink-4)' : 'var(--ink-2)',
                opacity: pageNum >= numPages ? 0.5 : 1,
              }}
            >{s('下一页', '下一頁', 'Next')} →</button>
          </div>
        )}
      </div>
    );
  }

  // ── modal 模式 · 全屏弹窗 ──
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? s('讲义', '講義', 'Slides')}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(43,34,24,.95)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* 头部 · 标题 + 关闭 */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'rgba(0,0,0,.4)',
        color: '#fff',
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label={s('关闭', '關閉', 'Close')}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,.15)',
            border: 'none', color: '#fff',
            fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
        <div style={{
          flex: 1,
          textAlign: 'center',
          font: 'var(--text-body)',
          letterSpacing: 1.5,
          marginRight: 36, // 抵消左侧关闭按钮
        }}>
          {title ?? s('讲义', '講義', 'Slides')}
          {numPages > 0 && (
            <span style={{ marginLeft: 8, opacity: 0.7, fontSize: '0.875rem' }}>
              {pageNum} / {numPages}
            </span>
          )}
        </div>
      </div>

      {/* 内容区 · PDF 渲染 */}
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: 'var(--sp-3)',
        WebkitOverflowScrolling: 'touch',
      }}>
        {loadError ? (
          <div style={{
            color: '#fff', textAlign: 'center', marginTop: '20vh',
            font: 'var(--text-body)', lineHeight: 1.7,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--sp-3)' }}>⚠️</div>
            <p>{s('PDF 加载失败', 'PDF 載入失敗', 'PDF load failed')}</p>
            <p style={{ font: 'var(--text-caption)', opacity: 0.7, marginTop: 8 }}>
              {loadError}
            </p>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => { setNumPages(n); setLoadError(null); }}
            onLoadError={(e) => setLoadError(e.message)}
            loading={
              <div style={{ color: '#fff', marginTop: '20vh', font: 'var(--text-body)' }}>
                {s('加载 PDF 中…', '載入 PDF 中…', 'Loading PDF…')}
              </div>
            }
          >
            <Page
              pageNumber={pageNum}
              width={pageWidth || undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={null}
            />
          </Document>
        )}
      </div>

      {/* 底部翻页条 */}
      {numPages > 1 && !loadError && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'rgba(0,0,0,.4)',
          flexShrink: 0,
          paddingBottom: 'calc(var(--sp-3) + env(safe-area-inset-bottom, 0px))',
        }}>
          <button
            type="button"
            disabled={pageNum <= 1}
            onClick={() => setPageNum(pageNum - 1)}
            className="btn btn-pill"
            style={{
              padding: '8px 18px',
              background: pageNum <= 1 ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.2)',
              color: '#fff', border: 'none',
              opacity: pageNum <= 1 ? 0.4 : 1,
            }}
          >
            ← {s('上一页', '上一頁', 'Prev')}
          </button>
          <span style={{ color: '#fff', font: 'var(--text-caption)', letterSpacing: 1 }}>
            {pageNum} / {numPages}
          </span>
          <button
            type="button"
            disabled={pageNum >= numPages}
            onClick={() => setPageNum(pageNum + 1)}
            className="btn btn-pill"
            style={{
              padding: '8px 18px',
              background: pageNum >= numPages ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.2)',
              color: '#fff', border: 'none',
              opacity: pageNum >= numPages ? 0.4 : 1,
            }}
          >
            {s('下一页', '下一頁', 'Next')} →
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
