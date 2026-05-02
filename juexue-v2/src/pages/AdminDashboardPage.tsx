// AdminDashboardPage · /admin
//   平台 KPI + 用户/题目/LLM 分布 + 最近用户表
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import { useAdminPlatformStats, useAdminUsers, useCourses } from '@/lib/queries';

export default function AdminDashboardPage() {
  const { s } = useLang();
  const stats = useAdminPlatformStats(7);
  const courses = useCourses();
  const recent = useAdminUsers({ limit: 10 });

  const u = stats.data?.users;
  const a = stats.data?.answers;
  const llm = stats.data?.llm;
  const qStatus = stats.data?.questions.byStatus;

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('总览', '總覽', 'Overview')}</h1>
          <p className="page-sub">{s('近 7 天平台数据', '近 7 天平台數據', 'Platform · 7d window')}</p>
        </div>
      </div>

      {/* KPI 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
        <Kpi loading={stats.isLoading} value={fmt(u?.total)} label={s('注册用户', '註冊用戶', 'Users')} sub={u?.newInWindow != null ? `+${u.newInWindow} ${s('本周', '本週', '7d')}` : undefined} />
        <Kpi loading={stats.isLoading} value={fmt(u?.activeInWindow)} label={s('活跃用户', '活躍用戶', 'Active')} color="var(--sage-dark)" />
        <Kpi loading={courses.isLoading} value={String(courses.data?.length ?? 0)} label={s('法本', '法本', 'Courses')} color="var(--saffron)" />
        <Kpi loading={stats.isLoading} value={fmt(a?.total)} label={s('累计答题', '累計答題', 'Answers')} color="var(--gold-dark)" sub={a?.correctRate != null ? Math.round(a.correctRate * 100) + '% ' + s('正确率', '正確率', 'acc') : undefined} />
      </div>

      {/* 快捷入口 grid */}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2, marginBottom: 'var(--sp-3)' }}>
        {s('快捷入口', '快捷入口', 'Quick actions')}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        <Action to="/admin/users"   icon="👥" label={s('用户管理', '用戶管理', 'Users')} sub={`${u?.byRole.coach ?? 0} ${s('辅导员', '輔導員', 'coaches')}`} />
        <Action to="/admin/classes" icon="📚" label={s('班级管理', '班級管理', 'Classes')} sub={`${stats.data?.classes.active ?? 0} ${s('活跃', '活躍', 'active')}`} />
        <Action to="/admin/courses" icon="📖" label={s('法本管理', '法本管理', 'Texts')} sub={`${courses.data?.length ?? 0}`} />
        <Action to="/admin/review"  icon="✅" label={s('题目审核', '題目審核', 'Review')} sub={`${qStatus?.pending ?? 0} ${s('待审', '待審', 'pending')}`} highlight={Boolean(qStatus?.pending && qStatus.pending > 0)} />
        <Action to="/admin/reports" icon="🚩" label={s('举报处理', '舉報處理', 'Reports')} />
        <Action to="/admin/audit"   icon="🕒" label={s('审计日志', '審計日誌', 'Audit')} />
        <Action to="/admin/logs"    icon="⚠️" label={s('运行日志', '運行日誌', 'Logs')} />
      </div>

      {/* 分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5, marginBottom: 'var(--sp-3)' }}>
            {s('用户分布', '用戶分佈', 'Users by role')}
          </h3>
          {stats.isLoading ? <Skeleton.LineSm /> : (
            <RoleBar admin={u?.byRole.admin ?? 0} coach={u?.byRole.coach ?? 0} student={u?.byRole.student ?? 0} />
          )}
        </div>

        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5, marginBottom: 'var(--sp-3)' }}>
            {s('题目状态', '題目狀態', 'Questions')}
          </h3>
          {stats.isLoading ? <Skeleton.LineSm /> : (
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <Mini value={fmt(qStatus?.pending)} label={s('待审', '待審', 'Pending')} color="var(--gold-dark)" />
              <Mini value={fmt(qStatus?.approved)} label={s('已通过', '已通過', 'Approved')} color="var(--sage-dark)" />
              <Mini value={fmt(qStatus?.rejected)} label={s('已驳回', '已駁回', 'Rejected')} color="var(--crimson)" />
            </div>
          )}
        </div>

        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5, marginBottom: 'var(--sp-3)' }}>
            {s('LLM 本月', 'LLM 本月', 'LLM month')}
          </h3>
          {stats.isLoading ? <Skeleton.LineSm /> : (
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <Mini value={fmt(llm?.monthRequests)} label={s('请求', '請求', 'Reqs')} />
              <Mini value={fmt(llm?.monthTokens)} label={s('Tokens', 'Tokens', 'Tokens')} />
              <Mini value={'$' + (llm?.monthCost ?? 0).toFixed(2)} label={s('开销', '開銷', 'Cost')} color="var(--gold-dark)" />
            </div>
          )}
        </div>
      </div>

      {/* 最近用户 */}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2, marginBottom: 'var(--sp-3)' }}>
        {s('最近注册', '最近註冊', 'Recent users')}
      </h2>
      <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
        {recent.isLoading ? (
          <div style={{ padding: 'var(--sp-4)' }}><Skeleton.Card /></div>
        ) : !recent.data || recent.data.items.length === 0 ? (
          <div style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)' }}>{s('暂无数据', '暫無數據', 'None')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--glass)', textAlign: 'left' }}>
              <Th>{s('用户', '用戶', 'User')}</Th>
              <Th>{s('角色', '角色', 'Role')}</Th>
              <Th>{s('注册时间', '註冊時間', 'Signup')}</Th>
              <Th>{s('上次登录', '上次登入', 'Last seen')}</Th>
            </tr></thead>
            <tbody>
              {recent.data.items.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <Td>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)' }}>
                      {u.dharmaName || '—'}
                    </div>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{u.email}</div>
                  </Td>
                  <Td><RolePill role={u.role} /></Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{new Date(u.createdAt).toLocaleDateString()}</span></Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{u.lastLoginAt ? relTime(u.lastLoginAt) : '—'}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Kpi({ value, label, color, sub, loading }: { value: string; label: string; color?: string; sub?: string; loading?: boolean }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      {loading ? <Skeleton.Title style={{ width: 60 }} /> : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.625rem', color: color ?? 'var(--ink)', letterSpacing: 1 }}>{value}</div>
      )}
      {sub && <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4, letterSpacing: 1 }}>{sub}</div>}
    </div>
  );
}

function Action({ to, icon, label, sub, highlight }: { to: string; icon: string; label: string; sub?: string; highlight?: boolean }) {
  return (
    <Link to={to} className="glass-card-thick" style={{
      padding: 'var(--sp-4)',
      textDecoration: 'none', color: 'inherit',
      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      border: highlight ? '1px solid var(--gold)' : '1px solid var(--glass-border)',
      background: highlight ? 'var(--gold-pale)' : 'var(--glass-thick)',
    }}>
      <span style={{ fontSize: '1.4rem' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 1.5, fontSize: '0.9375rem' }}>{label}</div>
        {sub && <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
    </Link>
  );
}

function RoleBar({ admin, coach, student }: { admin: number; coach: number; student: number }) {
  const total = Math.max(1, admin + coach + student);
  const segs: { v: number; color: string; label: string }[] = [
    { v: admin,   color: 'var(--crimson)',     label: 'Admin' },
    { v: coach,   color: 'var(--saffron)',     label: 'Coach' },
    { v: student, color: 'var(--sage-dark)',   label: 'Student' },
  ];
  return (
    <>
      <div style={{ display: 'flex', height: 12, borderRadius: 'var(--r-pill)', overflow: 'hidden', background: 'var(--border-light)' }}>
        {segs.map((s) => (
          <div key={s.label} style={{ width: (s.v / total * 100) + '%', background: s.color }} title={`${s.label}: ${s.v}`} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
        <span><span style={{ color: 'var(--crimson)', fontWeight: 700 }}>● </span>Admin {admin}</span>
        <span><span style={{ color: 'var(--saffron)', fontWeight: 700 }}>● </span>Coach {coach}</span>
        <span><span style={{ color: 'var(--sage-dark)', fontWeight: 700 }}>● </span>Student {student}</span>
      </div>
    </>
  );
}

function Mini({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: color ?? 'var(--ink)' }}>{value}</div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: 'var(--sp-3) var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>{children}</td>;
}

function RolePill({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    admin:   { bg: 'var(--crimson-light)',     color: 'var(--crimson)',     label: 'Admin' },
    coach:   { bg: 'var(--saffron-pale)',      color: 'var(--saffron-dark)', label: 'Coach' },
    student: { bg: 'rgba(125,154,108,.15)',    color: 'var(--sage-dark)',   label: 'Student' },
  };
  const m = map[role] ?? map.student!;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: m.bg, color: m.color, font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
      {m.label}
    </span>
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + '分前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + '时前';
  const d = Math.floor(h / 24);
  if (d < 30) return d + '天前';
  return new Date(iso).toLocaleDateString();
}
