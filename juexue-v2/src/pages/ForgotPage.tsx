// 找回密码 · 给邮箱发 reset token
import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '@/components/AuthLayout';
import Field from '@/components/Field';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export default function ForgotPage() {
  const { s } = useLang();
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailErr(s('请输入合法邮箱', '請輸入合法郵箱', 'Invalid email'));
      return;
    }
    setEmailErr(undefined);
    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot', { email }, { noAuth: true });
      setSent(true);
      toast.ok(s('重置邮件已发送（若邮箱存在）',
                  '重置郵件已發送（若郵箱存在）',
                  'Reset email sent (if account exists)'));
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={s('找回密码', '找回密碼', 'Reset password')}
      subtitle={s('输入注册邮箱 · 我们发送重置链接',
                   '輸入註冊郵箱 · 我們發送重置連結',
                   'Enter your email · we\'ll send a reset link')}
      footer={
        <Link to="/auth" style={{ color: 'var(--saffron-dark)' }}>
          {s('返回登录', '返回登入', '← Back to sign in')}
        </Link>
      }
    >
      {sent ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-5) 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--sp-3)' }}>📧</div>
          <p style={{ color: 'var(--ink-2)', lineHeight: 1.7 }}>
            {s('请检查邮箱（可能在垃圾箱）· 链接 30 分钟内有效',
               '請檢查郵箱（可能在垃圾箱）· 連結 30 分鐘內有效',
               'Check your inbox (possibly spam) · link valid for 30 min')}
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }} noValidate>
          <Field
            label={s('邮箱', '郵箱', 'Email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={setEmail}
            error={emailErr}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary btn-lg btn-pill btn-full"
            style={{ marginTop: 'var(--sp-3)' }}
          >
            {submitting
              ? s('提交中…', '提交中…', 'Submitting…')
              : s('发送重置邮件', '發送重置郵件', 'Send reset email')}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
