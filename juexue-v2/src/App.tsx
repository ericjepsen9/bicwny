// 觉学 v2 · 应用骨架
//   4 个 tab root + TabBar · Phase 1 用占位组件 · 后续 Phase 替换成真实页面
//   tab 间切换走 React Router · 内存路由 · 0 网络请求 · 没有浏览器进度条
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import TabBar from './components/TabBar';

// lazy 切分 · 进各 tab 才加载对应代码（preload 在 TabBar 上做 prefetch）
const HomePage = lazy(() => import('./pages/HomePage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const QuizCenterPage = lazy(() => import('./pages/QuizCenterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DevTestPage = lazy(() => import('./pages/DevTestPage'));

function PageFallback() {
  // 占位 · Phase 2 接入 Skeleton 组件
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

export default function App() {
  return (
    <div className="phone-wrap" data-app="juexue-v2">
      <div className="phone">
        <main
          className="scroll-area"
          id="main-content"
          tabIndex={-1}
          style={{ paddingBottom: 80 }}
        >
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/quiz" element={<QuizCenterPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/dev-test" element={<DevTestPage />} />
              {/* 兜底 · 未匹配回首页 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <TabBar />
      </div>
    </div>
  );
}
