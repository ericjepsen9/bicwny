// RequireAdminAuth · 管理员后台路由守卫
//   未登录 → 跳 /admin/login（不跳用户端 /auth）· 区别于 RequireAuth
//   已登录但 role 不是 admin → 由内层 RequireAdmin 显示拒绝页
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import Skeleton from './Skeleton';

export default function RequireAdminAuth() {
  const { status } = useAuth();
  const loc = useLocation();

  if (status === 'loading') {
    return <div style={{ padding: 'var(--sp-5)' }}><Skeleton.Card /></div>;
  }
  if (status === 'guest') {
    const next = loc.pathname + loc.search;
    return <Navigate to={`/admin/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
