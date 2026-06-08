// CoachLoginPage · /coach/login
// 辅导员独立登录入口 · 与用户端 / admin 端视觉分离
//   - 暖墨调 + 学士帽图标 · 突出"辅导员区域"
//   - 登录成功 · role 必须是 coach 或 admin（admin 也能管理班级）
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

export default function CoachLoginPage() {
  const { login, status, user } = useAuth();
  const { s } = useLang();
  const nav = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'authed' && (user?.role === 'coach' || user?.role === 'admin')) {
    return <Navigate to="/coach" replace />;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError(s('请填写邮箱和密码', '請填寫郵箱和密碼', 'Email and password required'));
      return;
    }
    setSubmitting(true);
    try {
      const u = await login({ email: email.trim(), password });
      if (u?.role !== 'coach' && u?.role !== 'admin') {
        setError(s('该账号不是辅导员', '該賬號不是輔導員', 'Not a coach account'));
        return;
      }
      toast.ok(s('已登录', '已登入', 'Signed in'));
      nav('/coach', { replace: true });
    } catch (e) {
      setError((e as ApiError).message || s('登录失败', '登入失敗', 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #1F2118 0%, #28291F 60%, #1A1B14 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sp-5)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.10)',
          borderRadius: 'var(--r-xl)',
          padding: 'var(--sp-7) var(--sp-6)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 24px 60px rgba(0,0,0,.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              margin: '0 auto var(--sp-3)',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--sage) 0%, var(--sage-dark) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              boxShadow: '0 8px 22px rgba(125,154,108,.35)',
            }}
          >
            🎓
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '1.375rem',
              letterSpacing: 4,
              color: '#F2EAE0',
              marginBottom: 4,
            }}
          >
            <span className="sc">辅导员登录</span>
            <span className="tc">輔導員登入</span>
            <span className="en">Coach</span>
          </h1>
          <p style={{ font: 'var(--text-caption)', color: '#A89888', letterSpacing: 1 }}>
            {s('班级管理 · 仅限辅导员访问', '班級管理 · 僅限輔導員訪問', 'Coach access only')}
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <label style={{ display: 'block', marginBottom: 'var(--sp-4)' }}>
            <span style={{ display: 'block', font: 'var(--text-caption)', color: '#A89888', letterSpacing: 1.5, marginBottom: 'var(--sp-2)' }}>
              {s('邮箱', '郵箱', 'Email')}
            </span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
            <span style={{ display: 'block', font: 'var(--text-caption)', color: '#A89888', letterSpacing: 1.5, marginBottom: 'var(--sp-2)' }}>
              {s('密码', '密碼', 'Password')}
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              style={inputStyle}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                padding: 'var(--sp-3) var(--sp-4)',
                borderRadius: 'var(--r)',
                background: 'rgba(225,90,76,.18)',
                border: '1px solid rgba(225,90,76,.40)',
                color: '#F0A89C',
                font: 'var(--text-caption)',
                letterSpacing: '.5px',
                marginBottom: 'var(--sp-4)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-pill btn-full"
            style={{
              padding: 14,
              justifyContent: 'center',
              background: 'linear-gradient(135deg, var(--sage) 0%, var(--sage-dark) 100%)',
              color: '#fff',
              border: 'none',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              fontSize: '0.9375rem',
              letterSpacing: 3,
              boxShadow: '0 6px 18px rgba(125,154,108,.38)',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? s('登录中…', '登入中…', 'Signing in…') : s('登录', '登入', 'Sign in')}
          </button>
        </form>

        <div style={{ marginTop: 'var(--sp-6)', textAlign: 'center' }}>
          <Link
            to="/auth"
            style={{
              font: 'var(--text-caption)',
              color: '#786C5E',
              letterSpacing: 1,
              textDecoration: 'none',
            }}
          >
            ← {s('返回用户端', '返回用戶端', 'Back to user app')}
          </Link>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 'var(--r)',
  color: '#F2EAE0',
  fontSize: 16,
  letterSpacing: '.5px',
  outline: 'none',
};
