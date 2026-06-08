// RequireCoach · 角色守卫 · 限 coach / admin 访问
//   - 必须先经过 RequireAuth（外层）· 这里只检角色
//   - 学员访问 → 友好拒绝页（不跳走）· 让用户知道为何拒
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';

export default function RequireCoach({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { s } = useLang();

  const role = user?.role ?? 'student';
  if (role === 'coach' || role === 'admin') return <>{children}</>;

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-5)' }}>
      <div style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: 'var(--sp-3)' }}>🚧</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: 2, marginBottom: 'var(--sp-2)' }}>
          {s('辅导员区域', '輔導員區域', 'Coach area')}
        </h1>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 'var(--sp-4)' }}>
          {s('需要辅导员权限才能访问', '需要輔導員權限才能訪問', 'Coach permission required')}
        </p>
        <Link to="/" className="btn btn-primary btn-pill" style={{ padding: '8px 18px' }}>
          {s('返回首页', '返回首頁', 'Back home')}
        </Link>
      </div>
    </div>
  );
}
