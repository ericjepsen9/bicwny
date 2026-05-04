// ErrorState · 查询失败兜底
//   居中显示 icon + 消息 + 重试按钮 · 用 token · 与全局视觉一致
//
// 用法：
//   {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
//
// 也可作"行内"模式（compact）放在 section 内部 · 不抢全屏
import type { ReactNode } from 'react';
import { useLang } from '@/lib/i18n';

interface Props {
  /** 错误对象 · 优先取 .message · 不传显示通用文案 */
  error?: { message?: string } | null | unknown;
  /** 点击重试 · 不传则不显示重试按钮 */
  onRetry?: () => void;
  /** compact = 适合卡内 / section 内 · 默认 = 占满空间居中 */
  compact?: boolean;
  /** 自定义 children · 替代默认消息 */
  children?: ReactNode;
}

export default function ErrorState({ error, onRetry, compact, children }: Props) {
  const { s } = useLang();
  const msg =
    children ??
    (error && typeof error === 'object' && 'message' in error && (error as { message?: unknown }).message
      ? String((error as { message: unknown }).message)
      : s('加载失败 · 请稍后重试', '載入失敗 · 請稍後重試', 'Failed to load · please retry'));

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-3)',
        padding: compact ? 'var(--sp-5) var(--sp-4)' : 'var(--sp-8) var(--sp-5)',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          borderRadius: '50%',
          background: 'var(--crimson-light)',
          color: 'var(--crimson)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? 18 : 22,
          fontWeight: 700,
        }}
      >
        !
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.5px', maxWidth: 320, lineHeight: 1.5 }}>
        {msg}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-pill"
          style={{
            padding: '8px 18px',
            background: 'var(--glass-thick)',
            color: 'var(--saffron-dark)',
            border: '1px solid var(--saffron-light)',
            font: 'var(--text-caption)',
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          {s('重试', '重試', 'Retry')}
        </button>
      )}
    </div>
  );
}
