// AdminShell · 管理员后台桌面布局
//   模仿 CoachShell · sidebar nav 7 + 1（暂跳老 prototypes 的 courses / llm）
//   小屏汉堡菜单（CSS media 已处理 · 这里 toggle state）
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';

export default function AdminShell() {
  const { user } = useAuth();
  const { s } = useLang();
  const [navOpen, setNavOpen] = useState(false);

  const dharmaName = user?.dharmaName || s('师兄', '師兄', 'Friend');
  const initial = (user?.avatar || dharmaName).slice(0, 1);

  return (
    <div className={'shell' + (navOpen ? ' nav-open' : '')}>
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
      <div className={'mb-backdrop' + (navOpen ? ' open' : '')} onClick={() => setNavOpen(false)} aria-hidden="true" />

      <aside className="side-nav">
        <Link to="/admin" className="brand" style={{ textDecoration: 'none' }}>
          <span className="brand-icon">
            <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>
          <div>
            <div className="brand-name">{s('觉学', '覺學', 'Juexue')}</div>
            <div className="brand-sub">{s('管理员后台', '管理員後台', 'Admin')}</div>
          </div>
        </Link>

        <div className="side-user">
          <div className="side-avatar">{initial}</div>
          <div className="side-user-info">
            <div className="side-user-name">{dharmaName}</div>
            <div className="side-user-role">{s('管理员', '管理員', 'Admin')}</div>
          </div>
        </div>

        <div className="nav-list">
          <AdminNav to="/admin"          end label={s('总览', '總覽', 'Overview')} icon={IconGrid} />
          <AdminNav to="/admin/users"    label={s('用户管理', '用戶管理', 'Users')} icon={IconUsers} />
          <AdminNav to="/admin/classes"  label={s('班级管理', '班級管理', 'Classes')} icon={IconBook} />
          <AdminNav to="/admin/courses"  label={s('法本管理', '法本管理', 'Texts')} icon={IconText} />
          <AdminNav to="/admin/review"   label={s('题目审核', '題目審核', 'Review')} icon={IconCheck} />
          <AdminNav to="/admin/reports"  label={s('举报处理', '舉報處理', 'Reports')} icon={IconFlag} />
          <AdminNav to="/admin/audit"    label={s('审计日志', '審計日誌', 'Audit')} icon={IconClock} />
          <AdminNav to="/admin/logs"     label={s('运行日志', '運行日誌', 'Logs')} icon={IconAlert} />

          <div className="nav-section" style={{ marginTop: 'var(--sp-3)' }}>{s('待迁移', '待遷移', 'Legacy')}</div>
          <a className="nav-item" href="/prototypes/desktop/admin-llm.html" title={s('Phase 13 完整迁移', 'Phase 13 完整遷移', 'Migrating in Phase 13')}>
            <IconBolt /> {s('LLM 管理 ↗', 'LLM 管理 ↗', 'LLM ↗')}
          </a>
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

function AdminNav({ to, end, label, icon: Icon }: { to: string; end?: boolean; label: string; icon: () => JSX.Element }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      <Icon />
      {label}
    </NavLink>
  );
}

const IconGrid = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>);
const IconUsers = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const IconBook = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>);
const IconCheck = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>);
const IconFlag = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>);
const IconClock = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
const IconAlert = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
const IconText = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>);
const IconBolt = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>);
const IconHome = () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>);
