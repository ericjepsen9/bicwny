// 登录 + 注册 · 一页双 tab
//   ?next=/path 登录后跳回
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '@/components/AuthLayout';
import Field from '@/components/Field';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const { login, register } = useAuth();
  const { s } = useLang();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dharmaName, setDharmaName] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; dharmaName?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const e: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = s('请输入合法邮箱', '請輸入合法郵箱', 'Invalid email');
    }
    if (password.length < (mode === 'register' ? 6 : 1)) {
      e.password = mode === 'register'
        ? s('密码至少 6 位', '密碼至少 6 位', 'Password ≥ 6 characters')
        : s('请输入密码', '請輸入密碼', 'Password required');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({
          email,
          password,
          dharmaName: dharmaName.trim() || undefined,
        });
      }
      toast.ok(mode === 'login'
        ? s('登录成功', '登入成功', 'Signed in')
        : s('注册成功 · 欢迎', '註冊成功 · 歡迎', 'Welcome!'));
      // 让路由在 status==='authed' 后自然 navigate · 但这里 push 一下省一拍
      nav(next, { replace: true });
    } catch (e) {
      const ae = e as ApiError;
      const msg = ae.message || s('请求失败', '請求失敗', 'Request failed');
      if (ae.status === 401 || ae.status === 403) {
        toast.error(s('账号或密码错误', '帳號或密碼錯誤', 'Wrong email or password'));
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={mode === 'login'
        ? s('欢迎回来', '歡迎回來', 'Welcome back')
        : s('创建账号', '建立帳號', 'Create account')}
      subtitle={s('觉学 · 闻思修证', '覺學 · 聞思修證', 'Juexue · Study Buddhism')}
      footer={
        <span>
          {mode === 'login' ? (
            <>
              <button
                type="button"
                onClick={() => { setMode('register'); setErrors({}); }}
                style={linkBtn}
              >
                {s('注册新账号', '註冊新帳號', 'Register')}
              </button>
              <span style={{ margin: '0 8px', color: 'var(--ink-4)' }}>·</span>
              <Link to="/forgot" style={linkA}>
                {s('忘记密码', '忘記密碼', 'Forgot password')}
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setMode('login'); setErrors({}); }}
              style={linkBtn}
            >
              {s('已有账号 · 登录', '已有帳號 · 登入', 'Have an account? Sign in')}
            </button>
          )}
        </span>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }} noValidate>
        <Field
          label={s('邮箱', '郵箱', 'Email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          required
        />
        <Field
          label={s('密码', '密碼', 'Password')}
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={mode === 'register' ? 6 : undefined}
          value={password}
          onChange={setPassword}
          error={errors.password}
          required
        />
        {mode === 'register' && (
          <Field
            label={s('法名（可选）', '法名（可選）', 'Dharma name (optional)')}
            autoComplete="name"
            value={dharmaName}
            onChange={setDharmaName}
            maxLength={64}
          />
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary btn-lg btn-pill btn-full"
          style={{ marginTop: 'var(--sp-3)' }}
        >
          {submitting
            ? s('提交中…', '提交中…', 'Submitting…')
            : mode === 'login'
              ? s('登录', '登入', 'Sign in')
              : s('注册', '註冊', 'Register')}
        </button>
      </form>
    </AuthLayout>
  );
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--saffron-dark)',
  font: 'var(--text-caption)',
  letterSpacing: '1px',
  cursor: 'pointer',
  padding: 0,
};
const linkA: React.CSSProperties = {
  color: 'var(--saffron-dark)',
  font: 'var(--text-caption)',
  letterSpacing: '1px',
};
