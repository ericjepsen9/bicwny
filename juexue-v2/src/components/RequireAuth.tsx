// 路由守卫 · 包裹需要登录的子路由
//   - status='loading' 时显示骨架（不闪到 /auth）
//   - status='guest' 时跳 /auth · 带 from 参数登录后回原路径
//   - status='authed' 但 hasOnboarded=false 时跳 /onboarding（除已经在 onboarding）
//   - 邮箱未验证不强制跳转（只是首页 banner 提示 · 与老版一致）
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import Skeleton from './Skeleton';

export default function RequireAuth() {
  const { status, user } = useAuth();
  const loc = useLocation();

  if (status === 'loading') {
    return (
      <div style={{ padding: 'var(--sp-5)' }}>
        <Skeleton.Card />
      </div>
    );
  }

  if (status === 'guest') {
    const next = loc.pathname + loc.search;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  // authed 但还没 onboarding · 强制走完
  if (user && !user.hasOnboarded && loc.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
