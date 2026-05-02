// 觉学 v2 · Dialog · 可复用模态容器
//   - role="dialog" + aria-modal + aria-label
//   - 焦点陷阱（useFocusTrap）· Esc 关闭 · 点 backdrop 关闭
//   - 锁住 body 滚动
//   - 入场动画（slideUp 从底部 · 与原 sheet 一致风格）
//
// 用法：
//   <Dialog open={open} onClose={() => setOpen(false)} title="搜索">
//     <input ... />
//   </Dialog>
import { useEffect, useRef, type ReactNode } from 'react';
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
  /** 'sheet' = 底部 sheet 弹起 · 'overlay' = 全屏覆盖（搜索浮层用） */
  variant?: 'sheet' | 'overlay';
  /** 隐藏关闭按钮（少用 · 一般要给用户出口） */
  hideClose?: boolean;
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
          position: 'absolute',
          inset: 0,
          maxWidth: 480,
          margin: '0 auto',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100vh',
          height: '100vh',
        }
      : {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 480,
          margin: '0 auto',
          background: 'var(--bg-card)',
          borderRadius: '18px 18px 0 0',
          padding: 16,
          maxHeight: '85vh',
          overflowY: 'auto',
          animation: 'slideUp .25s var(--ease) both',
        };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: 9000 }}
    >
      <div
        onClick={onClose}
        aria-hidden
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }}
      />
      <div ref={panelRef} style={panelStyle}>
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
    </div>
  );
}
