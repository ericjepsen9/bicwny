// EmptyState · 空态兜底
//   居中 emoji icon + 主文案 + 可选副文案 + 可选 CTA · 与 ErrorState 视觉成对
//
// 用法：
//   <EmptyState icon="🌿" title="暂无错题" hint="太棒了" />
//   <EmptyState icon="📚" title="暂无闻思" cta={<Link to="...">去找一本</Link>} />
//
// compact = 适合 section 内 · 默认 = 占满空间居中
import type { ReactNode } from 'react';

interface Props {
  /** emoji 或单字符图标 · 不传时用通用 🌿 */
  icon?: ReactNode;
  /** 主文案 · 必填 */
  title: ReactNode;
  /** 副文案 · 可选 · 一般给上下文提示（"太棒了" / "继续答题解锁"）*/
  hint?: ReactNode;
  /** CTA 按钮 / 链接 · 引导用户做下一步 */
  cta?: ReactNode;
  /** compact = 适合卡内 / section 内 · 默认 = 占满空间居中 */
  compact?: boolean;
}

export default function EmptyState({ icon = '🌿', title, hint, cta, compact }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 'var(--sp-2)' : 'var(--sp-3)',
        padding: compact ? 'var(--sp-5) var(--sp-4)' : 'var(--sp-8) var(--sp-5)',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          fontSize: compact ? '1.8rem' : '2.4rem',
          lineHeight: 1,
          opacity: 0.85,
        }}
      >
        {icon}
      </div>
      <div style={{ font: 'var(--text-body)', color: 'var(--ink-2)', letterSpacing: '1px', maxWidth: 320, lineHeight: 1.5 }}>
        {title}
      </div>
      {hint && (
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '.5px', maxWidth: 320, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
      {cta && <div style={{ marginTop: 'var(--sp-2)' }}>{cta}</div>}
    </div>
  );
}
