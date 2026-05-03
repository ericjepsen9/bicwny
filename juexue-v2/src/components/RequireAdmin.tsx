// RequireAdmin · 角色守卫 · 限 admin 访问
//   学员/辅导员访问 → 友好拒绝页（不跳走）
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { s } = useLang();

  if ((user?.role ?? 'student') === 'admin') return <>{children}</>;

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-5)' }}>
      <div style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: 'var(--sp-3)' }}>🛡️</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: 2, marginBottom: 'var(--sp-2)' }}>
          {s('管理员区域', '管理員區域', 'Admin area')}
        </h1>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 'var(--sp-4)' }}>
          {s('需要管理员权限才能访问', '需要管理員權限才能訪問', 'Admin permission required')}
        </p>
        <Link to="/" className="btn btn-primary btn-pill" style={{ padding: '8px 18px' }}>
          {s('返回首页', '返回首頁', 'Back home')}
        </Link>
      </div>
    </div>
  );
}
