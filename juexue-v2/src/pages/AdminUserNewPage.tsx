// AdminUserNewPage · /admin/users/new（决策 5 · 独立页）
//   新建用户（admin only · 仅 AdminAppShell）· 创建后回 /admin/users
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import Field from '@/components/Field';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export default function AdminUserNewPage() {
  const { s } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'coach' | 'admin'>('student');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/users', { email, password: pw, role, dharmaName: name || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/users'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/platform-stats'] });
      toast.ok(s('已创建', '已創建', 'Created'));
      nav('/admin/users');
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('新建用户', '新建用戶', 'New user')}</h1>
          <p className="page-sub">{s('设定邮箱 + 密码 + 角色', '設定郵箱 + 密碼 + 角色', 'Email + password + role')}</p>
        </div>
        <div className="top-actions">
          <Link to="/admin/users" className="btn btn-pill" style={{ padding: '8px 14px', background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
            {s('返回', '返回', 'Back')}
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            if (pw.length < 6) {
              setErr(s('密码至少 6 位', '密碼至少 6 位', 'Password ≥ 6'));
              return;
            }
            create.mutate();
          }}
          className="glass-card-thick"
          style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
        >
          <Field label={s('邮箱', '郵箱', 'Email')} type="email" value={email} onChange={setEmail} required />
          <Field label={s('密码（≥ 6 位）', '密碼（≥ 6 位）', 'Password (≥6)')} type="password" value={pw} onChange={setPw} required />
          <Field label={s('法名（可选）', '法名（可選）', 'Dharma name (optional)')} value={name} onChange={setName} />
          <div>
            <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
              {s('角色', '角色', 'Role')}
            </label>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              {(['student', 'coach', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1, padding: '10px 6px', borderRadius: 'var(--r-pill)',
                    background: role === r ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                    color: role === r ? 'var(--saffron-dark)' : 'var(--ink-3)',
                    border: '1px solid ' + (role === r ? 'var(--saffron-light)' : 'var(--glass-border)'),
                    font: 'var(--text-caption)', fontWeight: 600, letterSpacing: 1, cursor: 'pointer',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Link to="/admin/users" className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center', textDecoration: 'none', textAlign: 'center' }}>
              {s('取消', '取消', 'Cancel')}
            </Link>
            <button type="submit" disabled={create.isPending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
              {create.isPending ? '…' : s('创建', '創建', 'Create')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
