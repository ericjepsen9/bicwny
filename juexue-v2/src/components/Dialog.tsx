// 觉学 v2 · Dialog · 可复用模态容器
//   - role="dialog" + aria-modal + aria-label
//   - 焦点陷阱（useFocusTrap）· Esc 关闭 · 点 backdrop 关闭
//   - 锁住 body 滚动
//   - 入场动画（slideUp 从底部 · 与原 sheet 一致风格）
//   - createPortal 到 document.body 避免任何 ancestor stacking context /
//     transform 干扰 fixed 定位（之前用户截图遇到 sheet 错位即此）
//
// 用法：
//   <Dialog open={open} onClose={() => setOpen(false)} title="搜索">
//     <input ... />
//   </Dialog>
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/lib/a11y';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** 用于 aria-label */
  title?: string;
  /** 显示在头部的标题节点 · 不传则不显示头部 */
  header?: ReactNode;
  /** 显示在底部的操作区 · 不传则不显示底部 */
  footer?: ReactNode;
  children: ReactNode;
  /** 'sheet' = 底部 sheet 弹起 · 'overlay' = 全屏覆盖（搜索浮层用）· 'centered' = 桌面居中模态 */
  variant?: 'sheet' | 'overlay' | 'centered';
  /** 隐藏关闭按钮（少用 · 一般要给用户出口） */
  hideClose?: boolean;
  /** centered 模式宽度（默认 560 · 内容密集详情用 720 / 880） */
  width?: number;
}

export default function Dialog({
  open,
  onClose,
  title,
  header,
  footer,
  children,
  variant = 'sheet',
  hideClose = false,
  width = 560,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, open);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panelStyle: React.CSSProperties =
    variant === 'overlay'
      ? {
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100vh',
          height: '100vh',
        }
      : variant === 'centered'
      ? {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `min(${width}px, calc(100vw - 32px))`,
          background: 'var(--bg-card)',
          borderRadius: 'var(--r-md)',
          padding: 16,
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
          animation: 'fadeInPage .2s var(--ease) both',
          boxShadow: '0 12px 40px rgba(0,0,0,.18)',
        }
      : {
          position: 'fixed',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg-card)',
          borderRadius: '18px 18px 0 0',
          padding: 16,
          maxHeight: '85vh',
          overflowY: 'auto',
          animation: 'slideUp .25s var(--ease) both',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        };

  // Portal 到 body · 避免任何祖先 transform / overflow / contain 影响 fixed
  // centered 模式用 flex 居中（比 transform 对滚动条 / 不同 DPR 更稳）
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={
        variant === 'centered'
          ? { position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
          : { position: 'fixed', inset: 0, zIndex: 9000 }
      }
    >
      <div
        onClick={onClose}
        aria-hidden
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)' }}
      />
      <div
        ref={panelRef}
        style={variant === 'centered'
          ? {
              position: 'relative',
              width: `min(${width}px, 100%)`,
              background: 'var(--bg-card)',
              borderRadius: 'var(--r-md)',
              padding: 16,
              maxHeight: '100%',
              overflowY: 'auto',
              animation: 'fadeInPage .2s var(--ease) both',
              boxShadow: '0 12px 40px rgba(0,0,0,.18)',
            }
          : panelStyle}
      >
        {(header || title || !hideClose) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: variant === 'sheet' ? '4px 4px 12px' : '12px 12px 8px',
              borderBottom: '1px solid var(--border-light)',
            }}
          >
            <div
              style={{
                font: '700 16px/1.4 -apple-system,"Noto Sans SC",sans-serif',
                color: 'var(--ink)',
                letterSpacing: '1.5px',
              }}
            >
              {header ?? title ?? ''}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink-3)',
                  fontSize: 20,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
        {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
