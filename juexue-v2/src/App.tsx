// 觉学 v2 · 路由
//   /auth /register /forgot /reset /verify-email · 公开
//   /onboarding · 已登录但未引导（RequireAuth 自动跳）
//   / /courses /quiz /profile · 已登录（含 onboarding 完）
//   /dev-test · 公开 · 自测页（Phase 4 完后删）
import { Suspense, lazy } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import AdminShell from './components/AdminShell';
import CoachShell from './components/CoachShell';
import RequireAdmin from './components/RequireAdmin';
import RequireAdminAuth from './components/RequireAdminAuth';
import RequireAuth from './components/RequireAuth';
import RequireCoach from './components/RequireCoach';
import RequireCoachAuth from './components/RequireCoachAuth';
import TabBar, { shouldShowTabBar } from './components/TabBar';
import { useAuth } from './lib/auth';

// lazy 切分 · 进各页才加载对应代码
const HomePage = lazy(() => import('./pages/HomePage'));
const PracticePage = lazy(() => import('./pages/PracticePage'));
const PracticeCategoryPage = lazy(() => import('./pages/PracticeCategoryPage'));
const PracticeProjectPage = lazy(() => import('./pages/PracticeProjectPage'));
const PracticeHistoryPage = lazy(() => import('./pages/PracticeHistoryPage'));
const MyMeditationsPage = lazy(() => import('./pages/MyMeditationsPage'));
const DossierPage = lazy(() => import('./pages/DossierPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const NoteEditPage = lazy(() => import('./pages/NoteEditPage'));
const CoachClassPracticePage = lazy(() => import('./pages/CoachClassPracticePage'));
const CoachClassAnnouncementsPage = lazy(() => import('./pages/CoachClassAnnouncementsPage'));
const CoachClassDashboardPage = lazy(() => import('./pages/CoachClassDashboardPage'));
const CoachClassSessionsPage = lazy(() => import('./pages/CoachClassSessionsPage'));
const AdminPracticePage = lazy(() => import('./pages/AdminPracticePage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const QuizCenterPage = lazy(() => import('./pages/QuizCenterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DevTestPage = lazy(() => import('./pages/DevTestPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const CoachLoginPage = lazy(() => import('./pages/CoachLoginPage'));
const ForgotPage = lazy(() => import('./pages/ForgotPage'));
const ResetPage = lazy(() => import('./pages/ResetPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const ScriptureDetailPage = lazy(() => import('./pages/ScriptureDetailPage'));
const ScriptureReadingPage = lazy(() => import('./pages/ScriptureReadingPage'));
const MeditationPlayerPage = lazy(() => import('./pages/MeditationPlayerPage'));
const ClassMeditationRankingPage = lazy(() => import('./pages/ClassMeditationRankingPage'));
const ClassPracticeRankingPage = lazy(() => import('./pages/ClassPracticeRankingPage'));
const ClassRankingPage = lazy(() => import('./pages/ClassRankingPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const MistakeDetailPage = lazy(() => import('./pages/MistakeDetailPage'));
const MistakesPage = lazy(() => import('./pages/MistakesPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const Sm2ReviewPage = lazy(() => import('./pages/Sm2ReviewPage'));
const NotificationPage = lazy(() => import('./pages/NotificationPage'));
const AchievementPage = lazy(() => import('./pages/AchievementPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SettingsNotificationsPage = lazy(() => import('./pages/SettingsNotificationsPage'));
const DevicesPage = lazy(() => import('./pages/DevicesPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ClassDetailPage = lazy(() => import('./pages/ClassDetailPage'));
const JoinClassPage = lazy(() => import('./pages/JoinClassPage'));
const ProfileEditPage = lazy(() => import('./pages/ProfileEditPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const CoachDashboardPage = lazy(() => import('./pages/CoachDashboardPage'));
const CoachCoursesPage = lazy(() => import('./pages/CoachCoursesPage'));
const CoachStudentsPage = lazy(() => import('./pages/CoachStudentsPage'));
const CoachQuestionsPage = lazy(() => import('./pages/CoachQuestionsPage'));
const CoachQuestionNewPage = lazy(() => import('./pages/CoachQuestionNewPage'));
const CoachQuestionImportPage = lazy(() => import('./pages/CoachQuestionImportPage'));
const CoachQuestionGeneratePage = lazy(() => import('./pages/CoachQuestionGeneratePage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminUserNewPage = lazy(() => import('./pages/AdminUserNewPage'));
const AdminClassesPage = lazy(() => import('./pages/AdminClassesPage'));
const ClassNewPage = lazy(() => import('./pages/ClassNewPage'));
const AdminCoursesPage = lazy(() => import('./pages/AdminCoursesPage'));
const MeditationsPage = lazy(() => import('./pages/MeditationsPage'));
const AdminReviewPage = lazy(() => import('./pages/AdminReviewPage'));
const AdminAuditPage = lazy(() => import('./pages/AdminAuditPage'));
const AdminLogsPage = lazy(() => import('./pages/AdminLogsPage'));
const AdminNotificationRulesPage = lazy(() => import('./pages/AdminNotificationRulesPage'));
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'));
const AdminLlmPage = lazy(() => import('./pages/AdminLlmPage'));
const AdminCalendarPage = lazy(() => import('./pages/AdminCalendarPage'));
const AdminCalendarYearPage = lazy(() => import('./pages/AdminCalendarYearPage'));
const AdminPostersPage = lazy(() => import('./pages/AdminPostersPage'));

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

/** 已登录 layout · phone 容器 + scroll-area + TabBar
 *  TabBar 仅在 4 个 tab root 显示 · 二级/三级页面隐藏（沉浸式 app 体验）
 *  对应 paddingBottom 也跟着变 · 二级页给 0（safe-area 兜底）· root 给 80px
 */
function AppShell() {
  const { pathname } = useLocation();
  const tabVisible = shouldShowTabBar(pathname);
  return (
    <div className="phone-wrap" data-app="juexue-v2">
      <div className="phone">
        <main
          className="scroll-area"
          id="main-content"
          tabIndex={-1}
          style={{
            paddingBottom: tabVisible
              ? 'calc(80px + env(safe-area-inset-bottom, 0px))'
              : 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <Suspense fallback={<PageFallback />}>
            {/* 页面切换动画 · key=pathname 让 wrapper 在路由变化时 remount
                CSS .page-enter 触发 fadeInPage（淡入 + translateY 4px → 0）·
                prefers-reduced-motion 自动降级为 0.01ms */}
            <div key={pathname} className="page-enter">
            <Routes>
              <Route element={<RequireAuth />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/quiz" element={<QuizCenterPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/scripture-detail" element={<ScriptureDetailPage />} />
                <Route path="/read/:slug/:lessonId" element={<ScriptureReadingPage />} />
                <Route path="/meditation/:id" element={<MeditationPlayerPage />} />
                <Route path="/class/:id/meditations" element={<ClassMeditationRankingPage />} />
                <Route path="/class/:id/practice-ranking" element={<ClassPracticeRankingPage />} />
                <Route path="/class/:id/ranking" element={<ClassRankingPage />} />
                {/* /quiz-practice = 智能练习（QuizPage）· 与修学计数 /practice 区分 */}
                <Route path="/quiz-practice" element={<QuizPage />} />
                <Route path="/quiz/:lessonId" element={<QuizPage />} />
                <Route path="/mistake/:questionId" element={<MistakeDetailPage />} />
                <Route path="/mistakes" element={<MistakesPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/sm2-review" element={<Sm2ReviewPage />} />
                <Route path="/practice" element={<PracticePage />} />
                <Route path="/practice/history" element={<PracticeHistoryPage />} />
                <Route path="/me/meditations" element={<MyMeditationsPage />} />
                <Route path="/me/stats" element={<DossierPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                {/* 学员域 · 共修安排只读 · 复用 CoachClassSessionsPage · 内部按角色 hide 增改删 */}
                <Route path="/class/:id/sessions" element={<CoachClassSessionsPage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/notes/new" element={<NoteEditPage />} />
                <Route path="/notes/:id" element={<NoteEditPage />} />
                <Route path="/practice/project/:id" element={<PracticeProjectPage />} />
                <Route path="/practice/:categoryKey" element={<PracticeCategoryPage />} />
                <Route path="/notifications" element={<NotificationPage />} />
                <Route path="/achievement" element={<AchievementPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/notifications" element={<SettingsNotificationsPage />} />
                <Route path="/devices" element={<DevicesPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/class/:id" element={<ClassDetailPage />} />
                <Route path="/join-class" element={<JoinClassPage />} />
                <Route path="/profile/edit" element={<ProfileEditPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
              </Route>
              {/* 兜底 · 未匹配回首页（再走 RequireAuth 决定跳哪） */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </div>
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

/** 辅导员后台壳 · 桌面侧栏 + main · 不进 phone-wrap */
function CoachAppShell() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* 独立登录页 · 在守卫之外 · 公开访问 */}
        <Route path="/login" element={<CoachLoginPage />} />
        <Route element={<RequireCoachAuth />}>
          <Route element={<CoachOnly />}>
            <Route element={<CoachShell />}>
              <Route path="/" element={<CoachDashboardPage />} />
              <Route path="/students" element={<CoachStudentsPage />} />
              <Route path="/classes/:id/students/:uid/stats" element={<DossierPage />} />
              <Route path="/questions" element={<CoachQuestionsPage />} />
              <Route path="/questions/new" element={<CoachQuestionNewPage />} />
              <Route path="/questions/import" element={<CoachQuestionImportPage />} />
              <Route path="/questions/generate" element={<CoachQuestionGeneratePage />} />
              {/* 闻思管理 · 复用 admin 页 · coach 也能 CRUD（决策 1 · 后端 coachGuard 已开） */}
              <Route path="/courses" element={<AdminCoursesPage />} />
              <Route path="/courses/browse" element={<CoachCoursesPage />} />
              {/* 班级管理 · coach 给自己班加/移除学员（决策 3） */}
              <Route path="/classes" element={<AdminClassesPage />} />
              <Route path="/classes/new" element={<ClassNewPage />} />
              <Route path="/classes/:id/practice" element={<CoachClassPracticePage />} />
              <Route path="/classes/:id/announcements" element={<CoachClassAnnouncementsPage />} />
              <Route path="/classes/:id/dashboard" element={<CoachClassDashboardPage />} />
              <Route path="/classes/:id/sessions" element={<CoachClassSessionsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              {/* 题目审核 · coach 也能进审核队列（决策 2） */}
              <Route path="/review" element={<AdminReviewPage />} />
              {/* 观修管理 · 复用 admin 页 · 后端权限已放权 coach */}
              <Route path="/meditations" element={<MeditationsPage />} />
              <Route path="*" element={<Navigate to="/coach" replace />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
function CoachOnly() {
  return <RequireCoach><Outlet /></RequireCoach>;
}

/** 管理员后台壳 · 桌面侧栏 + main · 不进 phone-wrap */
function AdminAppShell() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* 独立登录页 · 在守卫之外 · 公开访问 */}
        <Route path="/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdminAuth />}>
          <Route element={<AdminOnly />}>
            <Route element={<AdminShell />}>
              <Route path="/" element={<AdminDashboardPage />} />
              <Route path="/users" element={<AdminUsersPage />} />
              <Route path="/users/:uid/stats" element={<DossierPage />} />
              <Route path="/users/new" element={<AdminUserNewPage />} />
              <Route path="/classes" element={<AdminClassesPage />} />
              <Route path="/classes/new" element={<ClassNewPage />} />
              <Route path="/classes/:id/practice" element={<CoachClassPracticePage />} />
              <Route path="/classes/:id/announcements" element={<CoachClassAnnouncementsPage />} />
              <Route path="/classes/:id/dashboard" element={<CoachClassDashboardPage />} />
              <Route path="/classes/:id/sessions" element={<CoachClassSessionsPage />} />
              <Route path="/courses" element={<AdminCoursesPage />} />
              <Route path="/meditations" element={<MeditationsPage />} />
              <Route path="/practice" element={<AdminPracticePage />} />
              {/* 题库 · 决策 11 a+b · admin 用自己账号 + 跨 shell 复用 Coach* 页面（页面 base 自动适配） */}
              <Route path="/questions" element={<CoachQuestionsPage />} />
              <Route path="/questions/new" element={<CoachQuestionNewPage />} />
              <Route path="/questions/import" element={<CoachQuestionImportPage />} />
              <Route path="/questions/generate" element={<CoachQuestionGeneratePage />} />
              <Route path="/review" element={<AdminReviewPage />} />
              <Route path="/reports" element={<AdminReportsPage />} />
              <Route path="/audit" element={<AdminAuditPage />} />
              <Route path="/logs" element={<AdminLogsPage />} />
              <Route path="/notification-rules" element={<AdminNotificationRulesPage />} />
              <Route path="/llm" element={<AdminLlmPage />} />
              <Route path="/calendar" element={<AdminCalendarPage />} />
              <Route path="/calendar/year/:year" element={<AdminCalendarYearPage />} />
              <Route path="/posters" element={<AdminPostersPage />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
function AdminOnly() {
  return <RequireAdmin><Outlet /></RequireAdmin>;
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

      {/* 辅导员后台 · 桌面布局 */}
      <Route path="/coach/*" element={<CoachAppShell />} />
      {/* 管理员后台 · 桌面布局 */}
      <Route path="/admin/*" element={<AdminAppShell />} />

      {/* 主壳 · 包含 4 个 tab + 后续详情页 */}
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}
