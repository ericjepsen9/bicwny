// TabBar · 3 个 tab root 切换（v2 · 我的 改成首页左上头像入口）
//   - NavLink 自带 active 状态
//   - 切 tab 走 React Router · 不触发浏览器导航
//   - 仅 3 个 tab root（/, /courses, /quiz）显示 · 二级及以下隐藏
//   - 仅显示文字 · active 加下划线 · 透明背景 · 不挡画报
import { NavLink, useLocation } from 'react-router-dom';

interface TabDef {
  to: string;
  label: { sc: string; tc: string; en: string };
}

const TABS: TabDef[] = [
  { to: '/',        label: { sc: '首页', tc: '首頁', en: 'Home' } },
  { to: '/courses', label: { sc: '闻思', tc: '聞思', en: 'Texts' } },
  { to: '/quiz',    label: { sc: '复习', tc: '複習', en: 'Review' } },
];

const ROOT_PATHS = new Set(TABS.map((t) => t.to));

export function shouldShowTabBar(pathname: string): boolean {
  return ROOT_PATHS.has(pathname);
}

export default function TabBar() {
  const { pathname } = useLocation();
  if (!shouldShowTabBar(pathname)) return null;
  return (
    <nav className="tab-bar tab-bar-text-only" aria-label="主导航">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}
          aria-label={t.label.sc}
        >
          <span className="sc">{t.label.sc}</span>
          <span className="tc">{t.label.tc}</span>
          <span className="en">{t.label.en}</span>
        </NavLink>
      ))}
    </nav>
  );
}


