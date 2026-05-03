// 认证页统一外壳 · 居中卡片 + 品牌底纹
import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** 底部链接行（注册/找回密码 等） */
  footer?: ReactNode;
}

export default function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'var(--sp-5)',
        background: 'var(--bg-scene)',
      }}
    >
      <div
        className="glass-card-thick"
        style={{
          padding: 'var(--sp-6) var(--sp-5)',
          maxWidth: 420,
          width: '100%',
          margin: '0 auto',
          borderRadius: 'var(--r-xl)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '1.5rem',
            color: 'var(--ink)',
            letterSpacing: 4,
            textAlign: 'center',
            marginBottom: 'var(--sp-2)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              font: 'var(--text-caption)',
              color: 'var(--ink-3)',
              letterSpacing: '1.5px',
              textAlign: 'center',
              marginBottom: 'var(--sp-5)',
            }}
          >
            {subtitle}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              marginTop: 'var(--sp-5)',
              paddingTop: 'var(--sp-4)',
              borderTop: '1px solid var(--border-light)',
              textAlign: 'center',
              font: 'var(--text-caption)',
              color: 'var(--ink-3)',
              letterSpacing: '1px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
