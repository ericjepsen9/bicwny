// 应用根 ErrorBoundary · 渲染期任意未捕获错误的最后防线
//   - lazy()/Suspense 抛错也会被吞进来
//   - reset 按钮：清状态 + 强制重新挂载子树
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  err: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary]', err, info.componentStack);
    }
  }

  reset = () => {
    this.setState({ err: null });
  };

  reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.err) return this.props.children;

    const msg = this.state.err.message || 'Unknown error';
    return (
      <div style={{ padding: 'var(--sp-6) var(--sp-5)', textAlign: 'center', color: 'var(--ink-2)' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: 'var(--sp-3)' }}>🌧</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)', letterSpacing: 2, marginBottom: 'var(--sp-2)' }}>
          页面遇到问题
        </h1>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '.5px', lineHeight: 1.7, marginBottom: 'var(--sp-4)', wordBreak: 'break-word' }}>
          {msg}
        </p>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={this.reset}
            className="btn btn-pill"
            style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            重试
          </button>
          <button
            type="button"
            onClick={this.reload}
            className="btn btn-primary btn-pill"
            style={{ padding: '8px 18px' }}
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }
}
