// RequireCoachAuth · 辅导员后台路由守卫
//   未登录 → 跳 /coach/login · 区别于 RequireAuth
//   已登录但 role 不是 coach/admin → 由内层 RequireCoach 显示拒绝页
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import Skeleton from './Skeleton';

export default function RequireCoachAuth() {
  const { status } = useAuth();
  const loc = useLocation();

  if (status === 'loading') {
    return <div style={{ padding: 'var(--sp-5)' }}><Skeleton.Card /></div>;
  }
  if (status === 'guest') {
    const next = loc.pathname + loc.search;
    return <Navigate to={`/coach/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
