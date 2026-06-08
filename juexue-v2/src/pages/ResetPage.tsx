// 凭 ?token=… 重置密码
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '@/components/AuthLayout';
import Field from '@/components/Field';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export default function ResetPage() {
  const { s } = useLang();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<{ pw?: string; pw2?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  if (!token) return <Navigate to="/forgot" replace />;

  function validate(): boolean {
    const e: typeof errors = {};
    if (pw.length < 6) e.pw = s('密码至少 6 位', '密碼至少 6 位', 'Password ≥ 6');
    if (pw !== pw2) e.pw2 = s('两次输入不一致', '兩次輸入不一致', 'Passwords do not match');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/api/auth/reset', { token, newPassword: pw }, { noAuth: true });
      toast.ok(s('密码已重置 · 请用新密码登录',
                  '密碼已重置 · 請用新密碼登入',
                  'Password reset · please sign in'));
      nav('/auth', { replace: true });
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title={s('设置新密码', '設定新密碼', 'Set new password')}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }} noValidate>
        <Field
          label={s('新密码', '新密碼', 'New password')}
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={pw}
          onChange={setPw}
          error={errors.pw}
          required
        />
        <Field
          label={s('再次确认', '再次確認', 'Confirm password')}
          type="password"
          autoComplete="new-password"
          value={pw2}
          onChange={setPw2}
          error={errors.pw2}
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
            : s('确认重置', '確認重置', 'Reset password')}
        </button>
      </form>
    </AuthLayout>
  );
}
