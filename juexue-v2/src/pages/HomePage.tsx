// HomePage · 三 section
//   1. greeting · 时段问候 + dharmaName + 顶部搜索/通知/头像
//   2. unverified email banner（如果 emailVerifiedAt=null）
//   3. class-card · 当前班级（如果有）
//   4. course-card · 当前法本（首个 enrollment · 显示进度 + 继续阅读 / 查看详情）
//   5. review-card · 错题提醒（mistakeCount > 0 时显示）
//   6. icon-grid · 4 个快速入口
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import {
  useClasses,
  useCourses,
  useEnrollments,
  useMistakeCount,
  useProgress,
  useSm2Stats,
  useUnreadNotifCount,
} from '@/lib/queries';
import Skeleton from '@/components/Skeleton';

function greetingHour(h: number, sLang: (sc: string, tc: string, en?: string) => string) {
  if (h < 5)  return sLang('深夜', '深夜', 'Late night');
  if (h < 9)  return sLang('早安', '早安', 'Good morning');
  if (h < 12) return sLang('上午好', '上午好', 'Good morning');
  if (h < 14) return sLang('午安', '午安', 'Good afternoon');
  if (h < 18) return sLang('下午好', '下午好', 'Good afternoon');
  if (h < 22) return sLang('晚安', '晚安', 'Good evening');
  return sLang('夜深了', '夜深了', 'Late evening');
}

export default function HomePage() {
  const { user } = useAuth();
  const { s } = useLang();

  const enrollments = useEnrollments();
  const courses = useCourses();
  const classes = useClasses();
  const sm2 = useSm2Stats();
  const mistakes = useMistakeCount();
  const progress = useProgress();
  const unreadNotifQ = useUnreadNotifCount();
  const unreadNotifs = unreadNotifQ.data ?? 0;

  const now = new Date();
  const hour = now.getHours();
  const greet = greetingHour(hour, s);
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dateLabel = s(`${month} 月 ${day} 日`, `${month} 月 ${day} 日`, `${month}/${day}`);
  const dharmaName = user?.dharmaName || s('师兄', '師兄', 'Friend');
  const streak = progress.data?.streakDays ?? 0;

  // 找当前要显示的法本：第一个 enrollment 的 course
  const firstEnrollment = enrollments.data?.[0];
  const courseList = courses.data ?? [];
  const currentCourse =
    firstEnrollment &&
    courseList.find(
      (c) => c.id === firstEnrollment.courseId,
    );
  const completedCount = firstEnrollment?.lessonsCompleted.length ?? 0;
  const totalLessons = 0; // 需要 useCourseDetail 才能拿到 · home 暂不展开 · 留 — 占位
  const pct =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const firstClass = classes.data?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--sp-2) var(--sp-5) var(--sp-5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 4 }}>
            {greet} · {dateLabel}
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: 3 }}>
            {dharmaName}
          </p>
          {streak > 0 && (
            <span
              style={{
                display: 'inline-block',
                marginTop: 6,
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
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', paddingTop: 4 }}>
          {/* 通知铃铛 · 含未读 badge */}
          <Link
            to="/notifications"
            aria-label={s('通知', '通知', 'Notifications') + (unreadNotifs > 0 ? ` · ${unreadNotifs} 条未读` : '')}
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--glass-thick)',
              border: '1px solid var(--glass-border)',
              color: 'var(--ink-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadNotifs > 0 && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 14,
                  height: 14,
                  padding: '0 4px',
                  borderRadius: 999,
                  background: 'var(--crimson)',
                  border: '2px solid var(--bg)',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </Link>
          <Link
            to="/profile"
            aria-label={s('个人资料', '個人資料', 'Profile')}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          >
            {(user?.avatar || dharmaName).slice(0, 1)}
          </Link>
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', padding: '0 var(--sp-5)' }}>
        {/* 邮箱未验证 banner */}
        {user && !user.emailVerifiedAt && (
          <div
            className="glass-card"
            style={{
              padding: '12px 16px',
              background: 'var(--gold-pale)',
              border: '1px solid var(--gold-light)',
              borderRadius: 'var(--r-lg)',
            }}
          >
            <p style={{ font: 'var(--text-caption)', color: 'var(--gold-dark)', letterSpacing: 1, lineHeight: 1.6 }}>
              📧 {s(
                '邮箱尚未验证 · 在设置中可重发验证邮件',
                '郵箱尚未驗證 · 在設定中可重發驗證郵件',
                'Email not verified yet',
              )}
            </p>
          </div>
        )}

        {/* 班级卡 · 已加入显示班级，未加入显示"加入班级"引导卡 */}
        {firstClass ? (
          <Link
            to={`/class/${encodeURIComponent(firstClass.classId)}`}
            className="glass-card-thick"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              padding: '10px var(--sp-4)',
              cursor: 'pointer',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--r-sm)',
                background: 'var(--saffron-pale)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '1rem',
              }}
            >
              {firstClass.class.coverEmoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  fontSize: '0.8125rem',
                  letterSpacing: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {firstClass.class.name}
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2 }}>
                {s('我的班级', '我的班級', 'My class')}
              </div>
            </div>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--ink-4)' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ) : (
          // 未加入班级 · 老 prototype home.html 第 254-269 行的引导卡
          <Link
            to="/join-class"
            className="glass-card-thick"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              padding: '10px var(--sp-4)',
              cursor: 'pointer',
              textDecoration: 'none',
              color: 'inherit',
              borderLeft: '3px solid var(--saffron)',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--r-sm)',
                background: 'var(--saffron-pale)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--saffron-dark)',
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  fontSize: '0.8125rem',
                  letterSpacing: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {s('加入班级', '加入班級', 'Join a class')}
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2 }}>
                {s('输入辅导员提供的 6 位邀请码', '輸入輔導員提供的 6 位邀請碼', 'Enter your coach\'s 6-digit code')}
              </div>
            </div>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--ink-4)' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        )}

        {/* 当前法本卡 */}
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-2)' }}>
            <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2 }}>
              {s('当前法本', '當前法本', 'Current text')}
            </p>
            <Link
              to="/courses"
              style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', letterSpacing: 1 }}
            >
              {s('全部 →', '全部 →', 'All →')}
            </Link>
          </div>

          {enrollments.isLoading || courses.isLoading ? (
            <Skeleton.Title style={{ marginBottom: 12 }} />
          ) : currentCourse ? (
            <>
              <p
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  letterSpacing: 3,
                  marginBottom: 'var(--sp-3)',
                }}
              >
                {currentCourse.coverEmoji} {currentCourse.title}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                <span className="t-caption t-ink-3">{s('学习进度', '學習進度', 'Progress')}</span>
                <span className="t-meta" style={{ color: 'var(--saffron)', fontWeight: 700 }}>
                  {pct > 0 ? pct + '%' : '—'}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: pct + '%' }} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
                <Link
                  to={`/scripture-detail?slug=${encodeURIComponent(currentCourse.slug)}`}
                  className="btn btn-primary btn-pill"
                  style={{ flex: 1, padding: 12, justifyContent: 'center' }}
                >
                  {s('继续阅读', '繼續閱讀', 'Continue')}
                </Link>
                <Link
                  to={`/scripture-detail?slug=${encodeURIComponent(currentCourse.slug)}`}
                  className="btn btn-pill"
                  style={{
                    flex: 1,
                    padding: 12,
                    background: 'transparent',
                    color: 'var(--ink-2)',
                    border: '1px solid var(--border)',
                    justifyContent: 'center',
                  }}
                >
                  {s('查看详情', '查看詳情', 'Details')}
                </Link>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--sp-5)' }}>
              <p style={{ color: 'var(--ink-3)', font: 'var(--text-caption)', marginBottom: 8 }}>
                {s('尚未选修法本', '尚未選修法本', 'No enrollment yet')}
              </p>
              <Link to="/courses" className="btn btn-primary btn-pill" style={{ padding: '8px 18px', display: 'inline-block' }}>
                {s('去选修法本', '去選修法本', 'Browse texts')}
              </Link>
            </div>
          )}
        </div>

        {/* 错题提醒 */}
        {(mistakes.data ?? 0) > 0 && (
          <Link
            to="/mistakes"
            className="glass-card-thick"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              padding: 'var(--sp-4)',
              borderLeft: '3px solid var(--crimson)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--r-sm)',
                background: 'var(--crimson-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ❌
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {s('待复习的错题', '待複習的錯題', 'Mistakes to review')}
              </p>
              <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                {s('错题本提醒', '錯題本提醒', 'Mistakes notebook')}
              </p>
            </div>
            <span
              style={{
                marginLeft: 'auto',
                minWidth: 24,
                height: 24,
                borderRadius: 'var(--r-pill)',
                background: 'var(--crimson)',
                color: '#fff',
                fontSize: '0.6rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
              }}
            >
              {mistakes.data}
            </span>
          </Link>
        )}

        {/* 快速入口 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)' }}>
          <IconTile to="/sm2-review" icon="🔁" label={s('SM-2', 'SM-2', 'SM-2')} badge={sm2.data?.totalDue} />
          <IconTile to="/mistakes" icon="❌" label={s('错题', '錯題', 'Mistakes')} badge={mistakes.data} />
          <IconTile to="/favorites" icon="⭐" label={s('收藏', '收藏', 'Favorites')} />
          <IconTile to="/settings" icon="⚙️" label={s('设置', '設定', 'Settings')} />
        </div>
      </div>

      <div style={{ height: 'var(--sp-8)' }} />
    </div>
  );
}

function IconTile({ to, icon, label, badge }: { to: string; icon: string; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      className="glass-card-thick"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 'var(--sp-3)',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
      }}
    >
      <div style={{ fontSize: '1.4rem' }}>{icon}</div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>{label}</div>
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            background: 'var(--crimson)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            padding: '0 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
