// AdminUsersPage · /admin/users
//   role 过滤 + search + 列表 + 新建 modal + 详情 drawer（改 role / 切活跃）
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { type AdminUser, useAdminUsers } from '@/lib/queries';
import { toast } from '@/lib/toast';

type RoleFilter = 'all' | 'admin' | 'coach' | 'student';

export default function AdminUsersPage() {
  const { s } = useLang();
  const [sp, setSp] = useSearchParams();
  const [role, setRole] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const list = useAdminUsers({
    limit: 50,
    role: role === 'all' ? undefined : role,
    search: search.trim() || undefined,
  });

  const openId = sp.get('id');

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('用户管理', '用戶管理', 'Users')}</h1>
          <p className="page-sub">
            {list.data ? list.data.total + ' ' + s('用户', '用戶', 'users') : s('加载中…', '載入中…', 'Loading…')}
          </p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '8px 16px' }}>
            + {s('新建用户', '新建用戶', 'New user')}
          </button>
        </div>
      </div>

      {/* 过滤 */}
      <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'student', 'coach', 'admin'] as RoleFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRole(k)}
              className="btn btn-pill"
              style={{
                padding: '5px 12px', font: 'var(--text-caption)', fontWeight: 600,
                background: role === k ? 'var(--saffron-pale)' : 'transparent',
                color: role === k ? 'var(--saffron-dark)' : 'var(--ink-3)',
                border: '1px solid ' + (role === k ? 'var(--saffron-light)' : 'transparent'),
              }}
            >
              {k === 'all' ? s('全部', '全部', 'All') : k}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder={s('搜索邮箱 / 法名…', '搜尋郵箱 / 法名…', 'Search email / name')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '6px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border)', background: 'var(--bg-input)', font: 'var(--text-caption)', outline: 'none' }}
        />
      </div>

      {list.isLoading ? (
        <Skeleton.Card />
      ) : !list.data || list.data.items.length === 0 ? (
        <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
          {s('没有匹配的用户', '沒有匹配的用戶', 'No matches')}
        </div>
      ) : (
        <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--glass)', textAlign: 'left' }}>
              <Th>{s('用户', '用戶', 'User')}</Th>
              <Th>{s('角色', '角色', 'Role')}</Th>
              <Th>{s('状态', '狀態', 'Status')}</Th>
              <Th>{s('注册', '註冊', 'Signup')}</Th>
              <Th>{s('上次登录', '上次登入', 'Last seen')}</Th>
            </tr></thead>
            <tbody>
              {list.data.items.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSp({ id: u.id })}
                  style={{ cursor: 'pointer', borderTop: '1px solid var(--border-light)', background: u.id === openId ? 'var(--saffron-pale)' : 'transparent' }}
                >
                  <Td>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)' }}>
                      {u.dharmaName || '—'}
                    </div>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{u.email}</div>
                  </Td>
                  <Td><RolePill role={u.role} /></Td>
                  <Td><StatusPill active={u.isActive} /></Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{new Date(u.createdAt).toLocaleDateString()}</span></Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{u.lastLoginAt ? relTime(u.lastLoginAt) : '—'}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s('新建用户', '新建用戶', 'New user')}>
        <CreateForm onDone={() => setCreateOpen(false)} />
      </Dialog>

      {openId && list.data?.items.find((u) => u.id === openId) && (
        <UserDrawer
          user={list.data.items.find((u) => u.id === openId)!}
          onClose={() => setSp({})}
        />
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: 'var(--sp-3) var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>{children}</td>;
}

function RolePill({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    admin: { bg: 'var(--crimson-light)', color: 'var(--crimson)' },
    coach: { bg: 'var(--saffron-pale)', color: 'var(--saffron-dark)' },
    student: { bg: 'rgba(125,154,108,.15)', color: 'var(--sage-dark)' },
  };
  const m = map[role] ?? map.student!;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: m.bg, color: m.color, font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
      {role}
    </span>
  );
}
function StatusPill({ active }: { active: boolean }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: active ? 'rgba(125,154,108,.15)' : 'var(--crimson-light)', color: active ? 'var(--sage-dark)' : 'var(--crimson)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
      {active ? '✓ active' : '✗ inactive'}
    </span>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const { s } = useLang();
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
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setErr(''); if (pw.length < 6) { setErr(s('密码至少 6 位', '密碼至少 6 位', 'Password ≥ 6')); return; } create.mutate(); }}
      style={{ padding: 'var(--sp-2) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
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
        <button type="button" onClick={onDone} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
          {s('取消', '取消', 'Cancel')}
        </button>
        <button type="submit" disabled={create.isPending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          {create.isPending ? '…' : s('创建', '創建', 'Create')}
        </button>
      </div>
    </form>
  );
}

function UserDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { s } = useLang();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [role, setRole] = useState(user.role);

  const isSelf = me?.id === user.id;

  const changeRole = useMutation({
    mutationFn: (r: 'admin' | 'coach' | 'student') => api.patch(`/api/admin/users/${encodeURIComponent(user.id)}/role`, { role: r }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/users'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/platform-stats'] });
      toast.ok(s('角色已更新', '角色已更新', 'Role updated'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const toggleActive = useMutation({
    mutationFn: () => api.post(`/api/admin/users/${encodeURIComponent(user.id)}/active`, { isActive: !user.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast.ok(user.isActive ? s('已停用', '已停用', 'Disabled') : s('已启用', '已啟用', 'Enabled'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(43,34,24,.35)', zIndex: 200 }} />
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(520px, 100vw)',
          background: 'var(--bg-scene)',
          borderLeft: '1px solid var(--glass-border)',
          boxShadow: '-12px 0 32px rgba(43,34,24,.18)',
          zIndex: 201, overflowY: 'auto', padding: 'var(--sp-5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)', letterSpacing: 2 }}>
            {s('用户详情', '用戶詳情', 'User')}
          </h2>
          <button type="button" onClick={onClose} aria-label={s('关闭', '關閉', 'Close')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '1.4rem', lineHeight: 1 }}>✕</button>
        </div>

        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem' }}>
            {(user.dharmaName || user.email).slice(0, 1)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', fontSize: '1rem', letterSpacing: 1.5 }}>
              {user.dharmaName || s('未填法名', '未填法名', 'No name')}
            </div>
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{user.email}</div>
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
              ID {user.id.slice(0, 8)} · {s('注册', '註冊', 'Joined')} {new Date(user.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        <h3 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-2)' }}>
          {s('角色', '角色', 'Role')}
        </h3>
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
            {(['student', 'coach', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                disabled={changeRole.isPending || (isSelf && r !== 'admin')}
                onClick={() => { setRole(r); if (r !== user.role) changeRole.mutate(r); }}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 'var(--r-pill)',
                  background: role === r ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                  color: role === r ? 'var(--saffron-dark)' : 'var(--ink-3)',
                  border: '1px solid ' + (role === r ? 'var(--saffron-light)' : 'var(--glass-border)'),
                  font: 'var(--text-caption)', fontWeight: 600, letterSpacing: 1,
                  cursor: changeRole.isPending ? 'wait' : 'pointer',
                  opacity: (isSelf && r !== 'admin') ? 0.5 : 1,
                }}
                title={isSelf && r !== 'admin' ? s('不能降低自己的权限', '不能降低自己的權限', "Can't downgrade self") : ''}
              >
                {r}
              </button>
            ))}
          </div>
          {isSelf && (
            <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: '.5px' }}>
              {s('当前是你自己的账户 · 不能降权', '當前是你自己的賬戶 · 不能降權', 'This is your own account · cannot downgrade')}
            </p>
          )}
        </div>

        <h3 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-2)' }}>
          {s('账户状态', '賬戶狀態', 'Status')}
        </h3>
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <StatusPill active={user.isActive} />
            <button
              type="button"
              disabled={toggleActive.isPending || isSelf}
              onClick={() => {
                if (!confirm(user.isActive ? s('停用此账户？', '停用此賬戶？', 'Disable account?') : s('启用此账户？', '啟用此賬戶？', 'Enable account?'))) return;
                toggleActive.mutate();
              }}
              className="btn btn-pill"
              style={{
                marginLeft: 'auto',
                padding: '6px 14px',
                background: user.isActive ? 'transparent' : 'var(--sage-dark)',
                color: user.isActive ? 'var(--crimson)' : '#fff',
                border: user.isActive ? '1px solid rgba(192,57,43,.3)' : 'none',
                opacity: isSelf ? 0.5 : 1,
              }}
              title={isSelf ? s('不能停用自己', '不能停用自己', "Can't disable self") : ''}
            >
              {toggleActive.isPending ? '…' : user.isActive ? s('停用', '停用', 'Disable') : s('启用', '啟用', 'Enable')}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + '分前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + '时前';
  const d = Math.floor(h / 24);
  if (d < 30) return d + '天前';
  return new Date(iso).toLocaleDateString();
}
