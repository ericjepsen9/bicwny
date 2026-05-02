// CoachShell · 辅导员后台桌面布局
//   - 侧栏（brand + user + 4 个 nav-item + 返回学员视图）
//   - 主区域 Outlet
//   - 复用 desktop.css 的 .shell / .side-nav / .nav-item / .main 样式
//   - 窄屏汉堡菜单：CSS media query 已处理 · 这里加 toggle state
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';

export default function CoachShell() {
  const { user } = useAuth();
  const { s } = useLang();
  const [navOpen, setNavOpen] = useState(false);

  const dharmaName = user?.dharmaName || s('师兄', '師兄', 'Friend');
  const initial = (user?.avatar || dharmaName).slice(0, 1);
  const roleLabel = user?.role === 'admin'
    ? s('管理员', '管理員', 'Admin')
    : s('辅导员', '輔導員', 'Coach');

  return (
    <div className={'shell' + (navOpen ? ' nav-open' : '')}>
      {/* 汉堡按钮 · 仅窄屏 */}
      <button
        type="button"
        className="mb-hamburger"
        aria-label={s('打开菜单', '打開菜單', 'Open menu')}
        onClick={() => setNavOpen(true)}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div
        className={'mb-backdrop' + (navOpen ? ' open' : '')}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <aside className="side-nav">
        <Link to="/coach" className="brand" style={{ textDecoration: 'none' }}>
          <span className="brand-icon">
            <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <polyline points="2 17 12 22 22 17" />
            </svg>
          </span>
          <div>
            <div className="brand-name">{s('觉学', '覺學', 'Juexue')}</div>
            <div className="brand-sub">{s('辅导员后台', '輔導員後台', 'Coach')}</div>
          </div>
        </Link>

        <div className="side-user">
          <div className="side-avatar">{initial}</div>
          <div className="side-user-info">
            <div className="side-user-name">{dharmaName}</div>
            <div className="side-user-role">{roleLabel}</div>
          </div>
        </div>

        <div className="nav-list">
          <CoachNav to="/coach"            end label={s('总览', '總覽', 'Overview')} icon={IconGrid} />
          <CoachNav to="/coach/students"   label={s('班级学员', '班級學員', 'Students')} icon={IconUsers} />
          <CoachNav to="/coach/questions"  label={s('题库', '題庫', 'Questions')} icon={IconBook} />
          <CoachNav to="/coach/courses"    label={s('法本浏览', '法本瀏覽', 'Texts')} icon={IconText} />
        </div>

        <div className="nav-section" style={{ marginTop: 'auto' }}>{s('其他', '其他', 'Other')}</div>
        <Link to="/" className="nav-item">
          <IconHome />
          {s('回学员视图', '回學員視圖', 'Student view')}
        </Link>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

function CoachNav({ to, end, label, icon: Icon }: { to: string; end?: boolean; label: string; icon: () => JSX.Element }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
    >
      <Icon />
      {label}
    </NavLink>
  );
}

const IconGrid = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const IconUsers = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconBook = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
const IconText = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);
const IconHome = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
