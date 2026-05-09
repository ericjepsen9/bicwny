// ProfilePage · 我的
//   身份 + 邮箱 banner + 功能列表 + 退出登录
//   学习数据全部走「学习统计」入口（streak / 本周打卡 / 徽章 都在 /achievement）
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { useClasses, usePracticeSummary } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { s } = useLang();
  const nav = useNavigate();
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
    if (!(await confirmAsync({ title: s('确定退出登录？', '確定退出登入？', 'Sign out?') }))) return;
    setSigning(true);
    await logout();
    toast.ok(s('已退出', '已退出', 'Signed out'));
    nav('/auth', { replace: true });
  }

  return (
    <div>
      {/* 头部头像区 · 整块可点 → /profile/edit
          padding-top 含 safe-area-inset-top · 防止 notch 顶头 */}
      <Link
        to="/profile/edit"
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
          padding: 'calc(var(--sp-10) + env(safe-area-inset-top, 0px)) var(--sp-5) var(--sp-6)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
            color: '#fff',
            margin: '0 auto var(--sp-4)',
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
        <h1 className="t-h2" style={{ color: 'var(--ink)' }}>
          {dharmaName}
        </h1>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginTop: 6 }}>
          {roleLabel}
          {firstClass && ' · ' + firstClass.class.name}
          <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>· {s('编辑', '編輯', 'Edit')}</span>
        </p>
      </Link>

      {/* 邮箱未验证 banner */}
      {user && !user.emailVerifiedAt && (
        <div
          className="glass-card"
          style={{
            margin: '0 var(--sp-5) var(--sp-5)',
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

      {/* 修学计数统计卡 · 简版（streak + 各大类累计）· 详细数据走 /practice/history */}
      <PracticeStatsCard />

      {/* 功能列表 · canonical .menu-card / .menu-item · 与 HomePage 同规范 */}
      <div className="menu-card" style={{ margin: '0 var(--sp-5) var(--sp-5)' }}>
        {role === 'admin' && (
          <MenuRow to="/admin" emoji="🛡️" iconBg="var(--saffron-pale)" labels={['管理员后台', '管理員後台', 'Admin']} />
        )}
        {(role === 'coach' || role === 'admin') && (
          <MenuRow to="/coach" emoji="🎓" iconBg="var(--gold-pale)" labels={['辅导员后台', '輔導員後台', 'Coach']} />
        )}
        <MenuRow to="/me/stats" emoji="📊" iconBg="var(--sage-light)" labels={['学修档案', '學修檔案', 'Dossier']} />
        {firstClass ? (
          <MenuRow to={`/class/${encodeURIComponent(firstClass.classId)}`} emoji="📚" iconBg="var(--saffron-pale)" labels={['我的班级', '我的班級', 'My Class']} />
        ) : (
          <MenuRow to="/join-class" emoji="📚" iconBg="var(--saffron-pale)" labels={['加入班级', '加入班級', 'Join Class']} />
        )}
        <MenuRow to="/notifications" emoji="🔔" iconBg="var(--gold-pale)" labels={['通知', '通知', 'Notifications']} />
        <MenuRow to="/settings" emoji="⚙️" iconBg="rgba(43,34,24,.05)" labels={['设置', '設定', 'Settings']} />
        <MenuRow to="/about" emoji="ℹ️" iconBg="rgba(43,34,24,.05)" labels={['关于觉学', '關於覺學', 'About']} />
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

function PracticeStatsCard() {
  const { s } = useLang();
  const summary = usePracticeSummary();
  if (!summary.data) return null;
  const total = summary.data.categories.reduce((acc, c) => acc + c.totalCount, 0);
  const todayTotal = summary.data.categories.reduce((acc, c) => acc + c.todayCount, 0);
  if (total === 0 && todayTotal === 0 && summary.data.streak === 0) return null;
  return (
    <Link to="/practice" style={{ textDecoration: 'none', display: 'block', margin: '0 var(--sp-5) var(--sp-4)' }}>
      <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
            📿 {s('修学计数', '修學計數', 'Practice')}
            {summary.data.streak > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--gold-dark)', fontWeight: 700 }}>🔥 {summary.data.streak}天</span>
            )}
          </div>
          <span style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)' }}>
            {s('查看 ›', '查看 ›', 'View ›')}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--sp-2)' }}>
          {summary.data.categories.map((c) => (
            <div key={c.id} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem' }}>{c.emoji}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.95rem', color: c.totalCount > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
                {c.totalCount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function MenuRow({ to, emoji, iconBg, labels }: { to: string; emoji: string; iconBg: string; labels: [string, string, string] }) {
  return (
    <Link to={to} className="menu-item">
      <span className="menu-icon" style={{ background: iconBg }}>{emoji}</span>
      <span className="menu-label">
        <span className="sc">{labels[0]}</span>
        <span className="tc">{labels[1]}</span>
        <span className="en">{labels[2]}</span>
      </span>
      <svg className="menu-arrow" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}
