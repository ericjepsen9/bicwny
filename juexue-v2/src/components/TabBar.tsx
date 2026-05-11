// TabBar · 3 个 tab root 切换（v2 · 我的 改成首页左上头像入口）
//   - NavLink 自带 active 状态
//   - 切 tab 走 React Router · 不触发浏览器导航
//   - 仅 3 个 tab root（/, /courses, /quiz）显示 · 二级及以下隐藏
import { NavLink, useLocation } from 'react-router-dom';

interface TabDef {
  to: string;
  label: { sc: string; tc: string; en: string };
  icon: JSX.Element;
}

const HomeIcon = (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const CoursesIcon = (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
const QuizIcon = (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const TABS: TabDef[] = [
  { to: '/',        label: { sc: '首页', tc: '首頁', en: 'Home' },     icon: HomeIcon },
  { to: '/courses', label: { sc: '法本', tc: '法本', en: 'Texts' },    icon: CoursesIcon },
  { to: '/quiz',    label: { sc: '复习', tc: '複習', en: 'Review' },   icon: QuizIcon },
];

const ROOT_PATHS = new Set(TABS.map((t) => t.to));

export function shouldShowTabBar(pathname: string): boolean {
  // /quiz 是 root · /quiz/:lessonId 是详情页（不显示）
  return ROOT_PATHS.has(pathname);
}

export default function TabBar() {
  const { pathname } = useLocation();
  if (!shouldShowTabBar(pathname)) return null;
  return (
    <nav className="tab-bar tab-bar-icons-only" aria-label="主导航">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}
          aria-label={t.label.sc}
          title={t.label.sc}
        >
          <span style={{ display: 'inline-flex' }}>{t.icon}</span>
        </NavLink>
      ))}
    </nav>
  );
}

