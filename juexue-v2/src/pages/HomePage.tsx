// HomePage v2 · 画报日历风 · 2026-05
//   - 全屏画报背景（admin 上传月度图 · 失败则浅色渐变兜底）
//   - 顶部 overlay：左上头像（→ /profile）· 右上通知（→ /notifications）
//   - 画报中部叠加：公历大字 + 周X + 藏历 + 节日/事件徽章
//   - 整个画报区域可点 → /calendar
//   - 底部 4 大卡（半透明白底）：法本 · 班级 · 智能练习 · 修学
//   - 3 个 TabBar tab（首页/法本/复习）
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import WheelPicker from '@/components/WheelPicker';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { useMainCourseId } from '@/lib/mainCourse';
import { api } from '@/lib/api';
import { PRACTICE_LIMIT_OPTIONS, usePracticeLimit, type PracticeLimit } from '@/lib/practiceLimit';
import { usePullToRefresh } from '@/lib/pullToRefresh';
import {
  useClasses,
  useCourseDetail,
  useCourses,
  useEnrollments,
  useProgress,
  useUnreadNotifCount,
} from '@/lib/queries';

const MONTH_SC = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

interface Poster {
  id: string;
  year: number;
  month: number;
  imageUrl: string;
  caption: string | null;
}

interface TibetanDay {
  date: string;
  lunar: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary: boolean;
  tags: string[];
  auspicious: boolean;
  events: string[];
  publicHoliday: string | null;
}

export default function HomePage() {
  const { s } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();

  const enrollments = useEnrollments();
  const courses = useCourses();
  const classes = useClasses();
  const progress = useProgress();
  const unreadNotifQ = useUnreadNotifCount();
  const unreadNotifs = unreadNotifQ.data ?? 0;
  const streak = progress.data?.streakDays ?? 0;
  const dharmaName = user?.dharmaName || s('师兄', '師兄', 'Friend');

  // 画报
  const poster = useQuery({
    queryKey: ['/api/posters/current'],
    queryFn: ({ signal }) => api.get<Poster | null>('/api/posters/current', { signal }),
    staleTime: 60 * 60 * 1000,
  });

  // 今日藏历
  const tibToday = useQuery({
    queryKey: ['/api/calendar/today'],
    queryFn: ({ signal }) => api.get<TibetanDay | null>('/api/calendar/today', { signal }),
    staleTime: 60 * 60 * 1000,
  });

  // 主修法本
  const mainCourseId = useMainCourseId();
  const enrollList = enrollments.data ?? [];
  const courseList = courses.data ?? [];
  const firstEnrollment =
    (mainCourseId ? enrollList.find((e) => e.courseId === mainCourseId) : null) ?? enrollList[0];
  const currentCourse = firstEnrollment && courseList.find((c) => c.id === firstEnrollment.courseId);
  const currentCourseDetail = useCourseDetail(currentCourse?.slug, { lite: true });
  const completedSet = useMemo(
    () => new Set(firstEnrollment?.lessonsCompleted ?? []),
    [firstEnrollment?.lessonsCompleted],
  );
  const completedCount = firstEnrollment?.lessonsCompleted.length ?? 0;
  const totalLessons = (currentCourseDetail.data?.chapters ?? []).reduce(
    (sum, ch) => sum + (ch.lessons?.length ?? 0),
    0,
  );
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const flatLessons = useMemo(
    () => (currentCourseDetail.data?.chapters ?? []).flatMap((ch) =>
      (ch.lessons ?? []).map((l) => ({ chapter: ch, lesson: l })),
    ),
    [currentCourseDetail.data?.chapters],
  );
  const continueTarget = useMemo(() => {
    if (flatLessons.length === 0) return null;
    const savedIdx = flatLessons.findIndex((f) => f.lesson.id === firstEnrollment?.currentLessonId);
    if (savedIdx >= 0) {
      const saved = flatLessons[savedIdx]!;
      if (completedSet.has(saved.lesson.id) && savedIdx < flatLessons.length - 1) {
        return flatLessons[savedIdx + 1]!;
      }
      return saved;
    }
    return flatLessons.find((f) => !completedSet.has(f.lesson.id)) ?? flatLessons[0] ?? null;
  }, [flatLessons, firstEnrollment?.currentLessonId, completedSet]);

  const firstClass = classes.data?.[0];

  // 智能练习题量
  const [practiceLimit, setPracticeLimit] = usePracticeLimit();
  const [pickerOpen, setPickerOpen] = useState(false);

  // 下拉刷新
  const { indicator: pullIndicator } = usePullToRefresh(() =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['/api/enrollments'] }),
      qc.invalidateQueries({ queryKey: ['/api/progress'] }),
      qc.invalidateQueries({ queryKey: ['/api/posters/current'] }),
      qc.invalidateQueries({ queryKey: ['/api/calendar/today'] }),
    ]),
  );

  // body 加 class · CSS 重写 .phone 让首页严格 100vh 不滚动
  useEffect(() => {
    document.body.classList.add('home-fullbleed');
    return () => {
      document.body.classList.remove('home-fullbleed');
    };
  }, []);

  // 日期
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const dow = WEEKDAY[now.getDay()]!;

  // 画报兜底色（无图时）· 按月份变浅色调
  const bgFallback = poster.data?.imageUrl
    ? `url(${poster.data.imageUrl}) center/cover no-repeat`
    : 'linear-gradient(180deg, var(--saffron-pale) 0%, var(--gold-pale) 50%, var(--surface) 100%)';

  // 主标注（节日 > 第一条事件）
  const day = tibToday.data;
  const firstEvent = day?.events?.find((e) => !e.startsWith('理发吉日')) ?? null;
  const headline = day?.publicHoliday ?? firstEvent ?? null;

  return (
    <div style={{
      // 画报作为整页背景 · 全屏铺满 · 所有 UI 浮在上面
      position: 'relative',
      height: '100%',
      background: bgFallback,
      color: '#fff',
      textShadow: '0 1px 3px rgba(0,0,0,0.35)',
      overflow: 'hidden',
    }}>
      {pullIndicator}

      {/* 顶部 overlay · 头像 + 日期(可点跳/calendar) + 通知 · 浮在画报上 */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0) + var(--sp-3))',
          left: 0,
          right: 0,
          padding: '0 var(--sp-4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          zIndex: 3,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
          <ProfileAvatar dharmaName={dharmaName} unread={unreadNotifs} />
          <Link
            to="/calendar"
            aria-label={s('今日藏历', '今日藏曆', "Today's calendar")}
            style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2, color: 'inherit', textDecoration: 'none', flex: 1, minWidth: 0 }}
          >
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.05rem', letterSpacing: 1, lineHeight: 1.1 }}>
              {MONTH_SC[m - 1]}{d}日 · 周{dow}
            </div>
            {day && (
              <div style={{ font: 'var(--text-caption)', letterSpacing: 1, opacity: 0.95, fontSize: '0.7rem' }}>
                {day.tibetanMonth}{day.isIntercalary ? '·闰' : ''}{day.tibetan}
              </div>
            )}
            {(day?.auspicious || headline) && (
              <div style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                {day?.auspicious && (
                  <span style={{ padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: 0 }}>🌺</span>
                )}
                {headline && (
                  <span style={{ padding: '1px 7px', borderRadius: 'var(--r-pill)', background: day?.publicHoliday ? 'rgba(220,80,80,0.75)' : 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: 0 }}>
                    {headline.length > 12 ? headline.slice(0, 12) + '…' : headline}
                  </span>
                )}
              </div>
            )}
          </Link>
        </div>
        <NotificationBell unread={unreadNotifs} />
      </div>

      {/* streak + caption · 右下浮在画报上 */}
      {(streak > 0 || poster.data?.caption) && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(200px + 90px + env(safe-area-inset-bottom, 12px))',
            left: 0,
            right: 0,
            padding: '0 var(--sp-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            zIndex: 3,
          }}
        >
          <div>
            {poster.data?.caption && (
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', opacity: 0.75, letterSpacing: 6, fontWeight: 700 }}>
                {poster.data.caption}
              </div>
            )}
          </div>
          {streak > 0 && (
            <div style={{ padding: '3px 10px', borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: 1 }}>
              🔥 {streak} 天
            </div>
          )}
        </div>
      )}

      {/* 底部 4 大卡 · absolute 浮在画报上 · 磨砂玻璃 · 不挡图 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 'calc(90px + env(safe-area-inset-bottom, 12px))',
          padding: '0 var(--sp-4)',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          zIndex: 3,
        }}
      >
        <BigCard
          to={continueTarget && currentCourse ? `/read/${currentCourse.slug}/${continueTarget.lesson.id}` : '/courses'}
          icon={<IconBook />}
          title={s('法本', '法本', 'Texts')}
          sub={currentCourse ? `${pct}%` : s('选择', '選擇', 'Pick')}
        />
        <BigCard
          to={firstClass ? `/class/${encodeURIComponent(firstClass.classId)}` : '/join-class'}
          icon={<IconGraduation />}
          title={s('班级', '班級', 'Class')}
          sub={firstClass ? firstClass.class.name.slice(0, 4) : s('加入', '加入', 'Join')}
        />
        <BigCard
          onClick={() => setPickerOpen(true)}
          icon={<IconQuiz />}
          title={s('练习', '練習', 'Practice')}
          sub={practiceLimit + s('题', '題', 'q')}
        />
        <BigCard
          to="/practice"
          icon={<IconBeads />}
          title={s('修学', '修學', 'Mantra')}
          sub={s('计数', '計數', 'Count')}
        />
      </div>

      {/* 题量 picker */}
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} title={s('题量', '題量', 'Question count')}>
        <WheelPicker
          options={PRACTICE_LIMIT_OPTIONS}
          value={practiceLimit}
          onChange={(v) => setPracticeLimit(v as PracticeLimit)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sp-3)', justifyContent: 'flex-end' }}>
          <Link
            to="/quiz-practice"
            onClick={() => setPickerOpen(false)}
            className="btn btn-primary btn-pill"
            style={{ padding: '8px 18px' }}
          >
            {s('开始 →', '開始 →', 'Start →')}
          </Link>
        </div>
      </Dialog>
    </div>
  );
}

function ProfileAvatar({ dharmaName, unread }: { dharmaName: string; unread: number }) {
  return (
    <Link
      to="/profile"
      aria-label={dharmaName + ' · 我的'}
      title={dharmaName}
      style={{
        position: 'relative',
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-serif)',
        fontWeight: 700,
        fontSize: '0.95rem',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        textDecoration: 'none',
        textShadow: 'none',
      }}
    >
      {dharmaName.slice(0, 1)}
      {unread > 0 && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            padding: '0 5px',
            borderRadius: 999,
            background: 'var(--crimson)',
            border: '2px solid #fff',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      to="/notifications"
      aria-label={'通知' + (unread > 0 ? ` · ${unread} 条未读` : '')}
      style={{
        position: 'relative',
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.3)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        textShadow: 'none',
      }}
    >
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 14,
            height: 14,
            padding: '0 4px',
            borderRadius: 999,
            background: 'var(--crimson)',
            border: '2px solid rgba(255,255,255,0.4)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

function BigCard({ to, onClick, icon, title, sub }: {
  to?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
    padding: '10px 14px',
    borderRadius: 'var(--r-md)',
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    color: 'var(--ink)',
    textDecoration: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    textAlign: 'left',
    minHeight: 64,
    // 去掉父级 HomePage 的 textShadow 继承（画报上的白字阴影不该出现在卡片里）
    textShadow: 'none',
  };
  const content = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--ink-2)', display: 'inline-flex' }}>{icon}</span>
        <span style={{ font: 'var(--text-body)', fontWeight: 700, letterSpacing: 2, fontSize: '0.95rem' }}>
          {title}
        </span>
      </div>
      {/* sub 改主色 saffron-dark · 不再是灰字 */}
      <span style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', fontSize: '0.72rem', paddingLeft: 30, letterSpacing: 1, fontWeight: 600 }}>
        {sub}
      </span>
    </>
  );
  if (to) {
    return <Link to={to} style={baseStyle}>{content}</Link>;
  }
  return <button type="button" onClick={onClick} style={baseStyle}>{content}</button>;
}

// 4 个线性图标 · 统一 ink-2 色（CSS currentColor）· 22×22
function IconBook() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function IconGraduation() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}
function IconQuiz() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function IconBeads() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="6" r="2" />
      <circle cx="18" cy="10" r="1.5" />
      <circle cx="18" cy="14" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="6" cy="14" r="1.5" />
      <circle cx="6" cy="10" r="1.5" />
    </svg>
  );
}
