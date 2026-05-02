// ProfilePage · 我的
//   user badge + 3 个统计 + 链接行 + 退出登录
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { useClasses, useProgress } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { s } = useLang();
  const nav = useNavigate();
  const progress = useProgress();
  const classes = useClasses();
  const [signing, setSigning] = useState(false);

  const dharmaName = user?.dharmaName || s('师兄', '師兄', 'Friend');
  const initial = (user?.avatar || dharmaName).slice(0, 1);
  const role = user?.role ?? 'student';
  const roleLabel = role === 'admin'
    ? s('管理员', '管理員', 'Admin')
    : role === 'coach'
      ? s('辅导员', '輔導員', 'Coach')
      : s('学员', '學員', 'Student');

  const correctRate = progress.data ? Math.round(progress.data.correctRate * 100) : 0;
  const streak = progress.data?.streakDays ?? 0;
  const totalAnswered = progress.data?.totalAnswered ?? 0;

  const firstClass = classes.data?.[0];

  async function onLogout() {
    if (signing) return;
    if (!confirm(s('确定退出登录？', '確定退出登入？', 'Sign out?'))) return;
    setSigning(true);
    await logout();
    toast.ok(s('已退出', '已退出', 'Signed out'));
    nav('/auth', { replace: true });
  }

  return (
    <div>
      {/* 头部头像区 · 整块可点 → /profile/edit */}
      <Link to="/profile/edit" style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: 'var(--sp-7) var(--sp-5) var(--sp-5)', textAlign: 'center' }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
            color: '#fff',
            margin: '0 auto var(--sp-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '2rem',
            boxShadow: '0 10px 28px rgba(224,120,86,.25)',
          }}
        >
          {initial}
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)', letterSpacing: 4 }}>
          {dharmaName}
        </h1>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginTop: 4 }}>
          {roleLabel}
          {firstClass && ' · ' + firstClass.class.name}
          <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>· {s('编辑', '編輯', 'Edit')}</span>
        </p>
      </Link>

      {/* 三项统计 */}
      <div
        className="glass-card-thick"
        style={{
          margin: '0 var(--sp-5) var(--sp-5)',
          padding: 'var(--sp-4)',
          display: 'grid',
          gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
          alignItems: 'center',
        }}
      >
        <Stat
          loading={progress.isLoading}
          value={String(streak)}
          label={s('连续天数', '連續天數', 'Streak')}
        />
        <div style={{ background: 'var(--border-light)', justifySelf: 'center', height: 36, width: 1 }} />
        <Stat
          loading={progress.isLoading}
          value={correctRate + '%'}
          label={s('正确率', '正確率', 'Accuracy')}
          color="var(--sage-dark)"
        />
        <div style={{ background: 'var(--border-light)', justifySelf: 'center', height: 36, width: 1 }} />
        <Stat
          loading={progress.isLoading}
          value={String(totalAnswered)}
          label={s('累计答题', '累計答題', 'Answered')}
          color="var(--saffron)"
        />
      </div>

      {/* 链接行 */}
      <div className="group" style={{ margin: '0 var(--sp-5) var(--sp-5)' }}>
        <LinkRow to="/achievement">
          <RowIcon>📊</RowIcon>
          <span className="row-label">
            <span className="sc">学习统计</span><span className="tc">學習統計</span><span className="en">Stats</span>
          </span>
          <RowArrow />
        </LinkRow>
        {firstClass ? (
          <LinkRow to={`/class/${encodeURIComponent(firstClass.classId)}`}>
            <RowIcon>📚</RowIcon>
            <span className="row-label">
              <span className="sc">我的班级</span><span className="tc">我的班級</span><span className="en">My Class</span>
            </span>
            <RowArrow />
          </LinkRow>
        ) : (
          <LinkRow to="/join-class">
            <RowIcon>📚</RowIcon>
            <span className="row-label">
              <span className="sc">加入班级</span><span className="tc">加入班級</span><span className="en">Join Class</span>
            </span>
            <RowArrow />
          </LinkRow>
        )}
        <LinkRow to="/notifications">
          <RowIcon>🔔</RowIcon>
          <span className="row-label">
            <span className="sc">通知</span><span className="tc">通知</span><span className="en">Notifications</span>
          </span>
          <RowArrow />
        </LinkRow>
        <LinkRow to="/settings">
          <RowIcon>⚙️</RowIcon>
          <span className="row-label">
            <span className="sc">设置</span><span className="tc">設定</span><span className="en">Settings</span>
          </span>
          <RowArrow />
        </LinkRow>
        <LinkRow to="/about">
          <RowIcon>ℹ️</RowIcon>
          <span className="row-label">
            <span className="sc">关于觉学</span><span className="tc">關於覺學</span><span className="en">About</span>
          </span>
          <RowArrow />
        </LinkRow>
      </div>

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        <button
          type="button"
          onClick={onLogout}
          disabled={signing}
          className="btn btn-pill btn-full"
          style={{
            padding: 12,
            background: 'transparent',
            color: 'var(--crimson)',
            border: '1px solid rgba(192,57,43,.3)',
            justifyContent: 'center',
          }}
        >
          {signing
            ? s('退出中…', '退出中…', 'Signing out…')
            : s('退出登录', '退出登入', 'Sign out')}
        </button>
      </div>

      <p style={{ textAlign: 'center', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, padding: 'var(--sp-2) 0 var(--sp-5)' }}>
        觉学 v2 · alpha
      </p>
    </div>
  );
}

function Stat({ value, label, color, loading }: { value: string; label: string; color?: string; loading?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {loading ? (
        <div style={{ height: 20, marginBottom: 6 }}>
          <Skeleton.LineSm style={{ width: 40, margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: color ?? 'var(--ink)' }}>
          {value}
        </div>
      )}
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function LinkRow({ to, children }: { to: string; children: React.ReactNode }) {
  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    padding: 'var(--sp-3) var(--sp-4)',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
  };
  return <Link to={to} style={style}>{children}</Link>;
}
function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: 'var(--saffron-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </span>
  );
}
function RowArrow() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
