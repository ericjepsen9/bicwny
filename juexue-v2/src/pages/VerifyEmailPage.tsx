// 邮箱验证 · /verify-email?token=…
//   - boot 时自动 POST 验证 · 成功跳 / · 失败给重发选项
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '@/components/AuthLayout';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

type State = 'verifying' | 'ok' | 'error';

export default function VerifyEmailPage() {
  const { s } = useLang();
  const { refreshUser } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const [state, setState] = useState<State>('verifying');
  const [errMsg, setErrMsg] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrMsg(s('链接缺少 token', '連結缺少 token', 'Missing token'));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post('/api/auth/verify-email', { token }, { noAuth: true });
        if (cancelled) return;
        setState('ok');
        await refreshUser();
        toast.ok(s('邮箱已验证', '郵箱已驗證', 'Email verified'));
        setTimeout(() => nav('/', { replace: true }), 1200);
      } catch (e) {
        if (cancelled) return;
        setState('error');
        setErrMsg((e as ApiError).message);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function resend() {
    if (resending) return;
    setResending(true);
    try {
      await api.post('/api/auth/resend-verify', {});
      toast.ok(s('重发成功 · 请检查邮箱',
                  '重發成功 · 請檢查郵箱',
                  'Resent · check your inbox'));
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title={
        state === 'ok'
          ? s('验证成功', '驗證成功', 'Verified')
          : state === 'error'
            ? s('验证失败', '驗證失敗', 'Verification failed')
            : s('验证中…', '驗證中…', 'Verifying…')
      }
      footer={
        <Link to="/" style={{ color: 'var(--saffron-dark)' }}>
          {s('回到首页', '回到首頁', 'Back to home')}
        </Link>
      }
    >
      <div style={{ textAlign: 'center', padding: 'var(--sp-5) 0' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: 'var(--sp-3)' }}>
          {state === 'ok' ? '✅' : state === 'error' ? '⚠️' : '⏳'}
        </div>
        {state === 'error' && (
          <>
            <p style={{ color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: 'var(--sp-4)' }}>{errMsg}</p>
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="btn btn-primary btn-pill"
              style={{ padding: '10px 24px' }}
            >
              {resending ? s('发送中…', '發送中…', 'Sending…') : s('重发验证邮件', '重發驗證郵件', 'Resend email')}
            </button>
          </>
        )}
        {state === 'ok' && (
          <p style={{ color: 'var(--sage-dark)', lineHeight: 1.7 }}>
            {s('即将跳转首页…', '即將跳轉首頁…', 'Redirecting to home…')}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
