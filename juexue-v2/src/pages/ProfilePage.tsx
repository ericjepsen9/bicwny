// ProfilePage · 我的
//   user badge + 3 个统计 + 邮箱未验证 banner + 今日计划 + 本周打卡 + 链接行 + 退出登录
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { useClasses, useEnrollments, useProgress, useSm2Stats } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { s } = useLang();
  const nav = useNavigate();
  const progress = useProgress();
  const sm2 = useSm2Stats();
  const enrollments = useEnrollments();
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
  const todayAnswered = progress.data?.todayAnswered ?? 0;
  const dueCount = sm2.data?.totalDue ?? 0;
  const enrolledCount = enrollments.data?.length ?? 0;

  const firstClass = classes.data?.[0];

  const resend = useMutation({
    mutationFn: () => api.post('/api/auth/resend-verify', {}),
    onSuccess: () => toast.ok(s(
      '重发成功 · 请检查邮箱',
      '重發成功 · 請檢查郵箱',
      'Sent · check your inbox',
    )),
    onError: (e) => toast.warn((e as ApiError).message || s('重发失败', '重發失敗', 'Failed')),
  });

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

      {/* 邮箱未验证 banner · 与 HomePage 同步 · 多了「重发邮件」按钮 */}
      {user && !user.emailVerifiedAt && (
        <div
          className="glass-card"
          style={{
            margin: '0 var(--sp-5) var(--sp-4)',
            padding: '12px 16px',
            background: 'var(--gold-pale)',
            border: '1px solid var(--gold-light)',
            borderRadius: 'var(--r-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <svg width="20" height="20" fill="none" stroke="var(--gold-dark)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <div style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: 1, lineHeight: 1.5 }}>
            {s('邮箱未验证', '郵箱未驗證', 'Email not verified')}
          </div>
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--gold-dark)',
              background: 'var(--gold-dark)',
              color: '#FFF',
              font: 'var(--text-caption)',
              fontWeight: 600,
              letterSpacing: 1,
              cursor: resend.isPending ? 'default' : 'pointer',
              flexShrink: 0,
              opacity: resend.isPending ? 0.6 : 1,
            }}
          >
            {resend.isPending
              ? s('发送中…', '發送中…', 'Sending…')
              : s('重发邮件', '重發郵件', 'Resend')}
          </button>
        </div>
      )}

      {/* 三项统计 */}
      <div
        className="glass-card-thick"
        style={{
          margin: '0 var(--sp-5) var(--sp-4)',
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

      {/* 今日计划 + 🔥 连续 N 天 pill */}
      <div
        className="glass-card"
        style={{
          margin: '0 var(--sp-5) var(--sp-4)',
          padding: 'var(--sp-4)',
          background: 'var(--glass)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 2 }}>
            {s('今日计划', '今日計劃', "Today's plan")}
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--gold-pale)',
              color: 'var(--gold-dark)',
              font: 'var(--text-caption)',
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            🔥 {s(`连续 ${streak} 天`, `連續 ${streak} 天`, `${streak}-day streak`)}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', alignItems: 'center' }}>
          <PlanStat
            value={dueCount}
            color="var(--crimson)"
            label={s('待复习', '待複習', 'Due')}
          />
          <div style={{ background: 'var(--border-light)', justifySelf: 'center', height: 30, width: 1 }} />
          <PlanStat
            value={todayAnswered}
            color="var(--sage-dark)"
            label={s('已完成', '已完成', 'Done')}
          />
          <div style={{ background: 'var(--border-light)', justifySelf: 'center', height: 30, width: 1 }} />
          <PlanStat
            value={enrolledCount}
            color="var(--saffron)"
            label={s('在学法本', '在學法本', 'Texts')}
          />
        </div>
      </div>

      {/* 本周打卡 · 7 个圆点 · 右起填充 streak 个（封顶 7） */}
      <div
        className="glass-card"
        style={{
          margin: '0 var(--sp-5) var(--sp-5)',
          padding: 'var(--sp-4)',
          background: 'var(--glass)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 2 }}>
            {s('本周打卡', '本週打卡', 'This week')}
          </span>
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
            {s(`已连续 ${streak} 天`, `已連續 ${streak} 天`, `${streak} days`)}
          </span>
        </div>
        <StreakDots streak={streak} />
      </div>

      {/* 链接行 */}
      <div className="group" style={{ margin: '0 var(--sp-5) var(--sp-5)' }}>
        {role === 'admin' && (
          <LinkRow to="/admin">
            <RowIcon>🛡️</RowIcon>
            <span className="row-label">
              <span className="sc">管理员后台</span><span className="tc">管理員後台</span><span className="en">Admin</span>
            </span>
            <RowArrow />
          </LinkRow>
        )}
        {(role === 'coach' || role === 'admin') && (
          <LinkRow to="/coach">
            <RowIcon>🎓</RowIcon>
            <span className="row-label">
              <span className="sc">辅导员后台</span><span className="tc">輔導員後台</span><span className="en">Coach</span>
            </span>
            <RowArrow />
          </LinkRow>
        )}
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

function PlanStat({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', color, lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function StreakDots({ streak }: { streak: number }) {
  // 7 个点 · 右起填充 min(streak, 7) 个 · 左侧空圈
  const filled = Math.max(0, Math.min(7, streak));
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
      {Array.from({ length: 7 }).map((_, i) => {
        const isFilled = i >= 7 - filled;
        return (
          <span
            key={i}
            style={{
              flex: 1,
              height: 14,
              borderRadius: '50%',
              background: isFilled
                ? 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))'
                : 'transparent',
              border: isFilled ? 'none' : '1.5px dashed var(--border)',
              maxWidth: 28,
              minWidth: 14,
              alignSelf: 'center',
              boxShadow: isFilled ? '0 2px 6px rgba(224,120,86,.25)' : 'none',
            }}
          />
        );
      })}
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
