// 觉学 v2 · Toast
// 对应老版 prototypes/shared/toast.js
//
// 用法：
//   import { toast } from '@/lib/toast';
//   toast.ok('保存成功');
//   toast.error('网络异常');
//   toast.info('已复制');
//   toast.warn('操作不可撤销');
//
// 设计：
//   - 单例 store + <ToastContainer> 组件 · 任何地方调 toast.xxx() 都能弹
//   - aria-live polite / error→assertive · 屏幕阅读器友好
//   - haptics 与 toast.kind 自动匹配（lib/haptics 调用）
//   - 默认 ttl 3.5s · error 5s · 点击或 × 立即关
import { useSyncExternalStore } from 'react';
import { triggerHaptics } from './haptics';

export type ToastKind = 'ok' | 'error' | 'warn' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title?: string;
  msg: string;
  ttl: number;
  ts: number;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ToastItem[] {
  return items;
}

function show(kind: ToastKind, title: string | undefined, msg: string): number {
  const id = nextId++;
  const ttl = kind === 'error' ? 5000 : 3500;
  items = [...items, { id, kind, title, msg: msg ?? '', ttl, ts: Date.now() }];
  emit();
  triggerHaptics(kind);
  setTimeout(() => dismiss(id), ttl);
  return id;
}

export function dismiss(id: number) {
  if (!items.some((i) => i.id === id)) return;
  items = items.filter((i) => i.id !== id);
  emit();
}

// 公开 API · 兼容老 JX.toast 的两参数 (title, msg) 与单参数 (msg)
function makeKind(kind: ToastKind) {
  return (title: string, msg?: string) => {
    if (msg === undefined) return show(kind, undefined, title);
    return show(kind, title, msg);
  };
}

export const toast = {
  ok:    makeKind('ok'),
  error: makeKind('error'),
  warn:  makeKind('warn'),
  info:  makeKind('info'),
  show:  (kind: ToastKind, title: string, msg?: string) =>
    msg === undefined ? show(kind, undefined, title) : show(kind, title, msg),
  dismiss,
};

// ── ToastContainer ──
const ICONS: Record<ToastKind, string> = { ok: '✓', error: '✕', warn: '!', info: 'i' };

export function ToastContainer() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const hasError = list.some((t) => t.kind === 'error');
  return (
    <div
      id="jx-toast-root"
      role="status"
      aria-live={hasError ? 'assertive' : 'polite'}
      aria-atomic="false"
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        right: 12,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {list.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          aria-label={(t.title ? t.title + ' · ' : '') + t.msg}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            minWidth: 220,
            maxWidth: 360,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'var(--bg-card)',
            color: 'var(--ink)',
            border: '1px solid var(--border-light)',
            borderLeft: `3px solid var(${kindColor(t.kind)})`,
            boxShadow: 'var(--shadow-3)',
            font: '500 14px/1.5 -apple-system,"Noto Sans SC",sans-serif',
            letterSpacing: '.5px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: `var(${kindColor(t.kind)})`,
            }}
          >
            {ICONS[t.kind]}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            {t.title ? (
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>{t.title}</span>
            ) : null}
            <span style={{ display: 'block', color: 'var(--ink-2)', fontSize: 13 }}>{t.msg}</span>
          </span>
          <span aria-hidden style={{ flexShrink: 0, color: 'var(--ink-4)', fontSize: 16 }}>×</span>
        </button>
      ))}
    </div>
  );
}

function kindColor(k: ToastKind): string {
  switch (k) {
    case 'ok':    return '--sage-dark';
    case 'error': return '--crimson';
    case 'warn':  return '--gold';
    case 'info':  return '--ink-2';
  }
}
