// 觉学 v2 · 路由
//   /auth /register /forgot /reset /verify-email · 公开
//   /onboarding · 已登录但未引导（RequireAuth 自动跳）
//   / /courses /quiz /profile · 已登录（含 onboarding 完）
//   /dev-test · 公开 · 自测页（Phase 4 完后删）
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './components/RequireAuth';
import TabBar from './components/TabBar';
import { useAuth } from './lib/auth';

// lazy 切分 · 进各页才加载对应代码
const HomePage = lazy(() => import('./pages/HomePage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const QuizCenterPage = lazy(() => import('./pages/QuizCenterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DevTestPage = lazy(() => import('./pages/DevTestPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const ForgotPage = lazy(() => import('./pages/ForgotPage'));
const ResetPage = lazy(() => import('./pages/ResetPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

function PageFallback() {
  return (
    <div
      style={{
        height: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-3)',
        fontSize: '0.875rem',
        letterSpacing: '1px',
      }}
    >
      …
    </div>
  );
}

/** 已登录 layout · phone 容器 + scroll-area + TabBar */
function AppShell() {
  return (
    <div className="phone-wrap" data-app="juexue-v2">
      <div className="phone">
        <main className="scroll-area" id="main-content" tabIndex={-1} style={{ paddingBottom: 80 }}>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route element={<RequireAuth />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/quiz" element={<QuizCenterPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              {/* 兜底 · 未匹配回首页（再走 RequireAuth 决定跳哪） */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <TabBar />
      </div>
    </div>
  );
}

/** 公开页（auth/register/forgot/reset/verify-email/onboarding/dev-test）· 不显示 TabBar · 无 phone 容器 */
function PublicShell({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  // 允许已登录用户访问 /auth 时直接重定向到 home（避免登录后打开 /auth）
  const { status } = useAuth();

  return (
    <Routes>
      {/* 公开 */}
      <Route
        path="/auth"
        element={
          status === 'authed' ? <Navigate to="/" replace /> : <PublicShell><AuthPage /></PublicShell>
        }
      />
      <Route path="/forgot" element={<PublicShell><ForgotPage /></PublicShell>} />
      <Route path="/reset" element={<PublicShell><ResetPage /></PublicShell>} />
      <Route path="/verify-email" element={<PublicShell><VerifyEmailPage /></PublicShell>} />
      <Route path="/dev-test" element={<PublicShell><DevTestPage /></PublicShell>} />

      {/* 需要登录 + onboarding · 但 onboarding 本身豁免 onboarding-redirect */}
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<PublicShell><OnboardingPage /></PublicShell>} />
      </Route>

      {/* 主壳 · 包含 4 个 tab + 后续详情页 */}
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}
