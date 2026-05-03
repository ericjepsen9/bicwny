// ConfirmDialog · 取代 window.confirm() 的统一玻璃风确认弹窗
//
// 用法（async/await）：
//   const ok = await confirmAsync({ title: '确定退出班级？', body: '...', danger: true });
//   if (!ok) return;
//
// 或者作为受控组件嵌进页面：
//   <ConfirmDialog open={open} onClose={...} title="..." onConfirm={...} />
//
// 单例 host 由 <ConfirmHost /> 在 main.tsx 渲染 · confirmAsync 通过事件总线触发
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/lib/a11y';

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  /** 主按钮 */
  okLabel?: string;
  /** 副按钮 */
  cancelLabel?: string;
  /** true 时主按钮变 crimson 红色（破坏性操作）*/
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

let listener: ((p: PendingConfirm) => void) | null = null;
let nextId = 1;

/** 全局 promise 风格 confirm · 替代 window.confirm */
export function confirmAsync(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      // ConfirmHost 还没挂载 · fallback 到原生
      // eslint-disable-next-line no-alert
      resolve(window.confirm(opts.title + (opts.body ? '\n\n' + (typeof opts.body === 'string' ? opts.body : '') : '')));
      return;
    }
    listener({ ...opts, id: nextId++, resolve });
  });
}

/** 在 main.tsx 渲染一次 · 监听 confirmAsync 的调用并显示 dialog */
export function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    listener = (p) => setPending(p);
    return () => { listener = null; };
  }, []);

  function close(ok: boolean) {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  }

  if (!pending) return null;

  return (
    <ConfirmDialog
      open
      title={pending.title}
      body={pending.body}
      okLabel={pending.okLabel}
      cancelLabel={pending.cancelLabel}
      danger={pending.danger}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  );
}

interface DialogProps extends ConfirmOptions {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  open, title, body, okLabel, cancelLabel, danger, onCancel, onConfirm,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onConfirm();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  // Portal 到 body · 同 Dialog 原因
  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: 9500 }}
    >
      <div
        onClick={onCancel}
        aria-hidden
        style={{ position: 'absolute', inset: 0, background: 'rgba(43, 34, 24, 0.5)', backdropFilter: 'blur(2px)' }}
      />
      <div
        ref={panelRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(360px, calc(100vw - 32px))',
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 20px 60px rgba(43, 34, 24, 0.3)',
          padding: 'var(--sp-5)',
          animation: 'slideUp .2s var(--ease)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '1.0625rem',
            color: 'var(--ink)',
            letterSpacing: 2,
            marginBottom: body ? 'var(--sp-3)' : 'var(--sp-4)',
            lineHeight: 1.5,
          }}
        >
          {title}
        </h2>
        {body && (
          <div style={{ font: 'var(--text-body)', color: 'var(--ink-2)', letterSpacing: 1, lineHeight: 1.6, marginBottom: 'var(--sp-4)' }}>
            {body}
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-pill"
            style={{
              flex: 1,
              padding: 12,
              background: 'transparent',
              color: 'var(--ink-3)',
              border: '1px solid var(--border)',
              justifyContent: 'center',
            }}
          >
            {cancelLabel ?? '取消'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-pill"
            autoFocus
            style={{
              flex: 1,
              padding: 12,
              justifyContent: 'center',
              background: danger
                ? 'var(--crimson)'
                : 'linear-gradient(135deg, var(--saffron) 0%, var(--saffron-dark) 100%)',
              color: '#fff',
              border: 'none',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              boxShadow: danger
                ? '0 6px 18px rgba(192, 57, 43, 0.3)'
                : '0 6px 18px rgba(224, 120, 86, 0.38)',
            }}
          >
            {okLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
