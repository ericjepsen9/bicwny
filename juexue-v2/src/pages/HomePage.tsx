// HomePage · 学习仪表盘
//   1. greeting · 时段问候 + dharmaName + 🔥 streak + 通知铃铛 + 头像
//   2. class-card · 当前班级 / 加入班级引导
//   3. course-card · 当前法本（进度 + 当前学到第 N 课 + 阅读 / 目录 / 切换主修）
//   4. ⚡ smart-practice card · 题量 chip + 开始练习（secondary）
//   5. icon-grid · SM-2 / 错题 / 收藏 / 设置（错题/SM-2 红点提醒）
// 已删：
//   · 邮箱未验证 banner（移到 ProfilePage 单点）
//   · 错题大 banner（与 IconTile 重复）
//   · 章级棋盘格（与当前法本卡的进度数字重复 · 145 章铺满后视觉噪音）
//     ChapterProgressGrid 组件保留 · 后续可能放法本详情页 hero 区
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { useMainCourseId } from '@/lib/mainCourse';
import {
  useClasses,
  useCourseDetail,
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

  // 找当前要显示的法本：
  //   优先用户在法本详情页设的"主修"（localStorage）·
  //   否则首本 enrollment（兜底）
  const mainCourseId = useMainCourseId();
  const enrollList = enrollments.data ?? [];
  const courseList = courses.data ?? [];
  const firstEnrollment =
    (mainCourseId ? enrollList.find((e) => e.courseId === mainCourseId) : null) ??
    enrollList[0];
  const currentCourse =
    firstEnrollment &&
    courseList.find(
      (c) => c.id === firstEnrollment.courseId,
    );

  // 拉法本详情（章节树）· 用来算 totalLessons + 找 currentLesson 元数据
  const currentCourseDetail = useCourseDetail(currentCourse?.slug);
  const completedSet = new Set(firstEnrollment?.lessonsCompleted ?? []);
  const completedCount = firstEnrollment?.lessonsCompleted.length ?? 0;
  const totalLessons = (currentCourseDetail.data?.chapters ?? []).reduce(
    (sum, ch) => sum + (ch.lessons?.length ?? 0),
    0,
  );
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // 找"继续阅读"目标 lesson · 优先 enrollment.currentLessonId · 否则首个未完成 · 兜底首课时
  const flatLessons = (currentCourseDetail.data?.chapters ?? []).flatMap((ch) =>
    (ch.lessons ?? []).map((l) => ({ chapter: ch, lesson: l })),
  );
  const continueTarget =
    flatLessons.find((f) => f.lesson.id === firstEnrollment?.currentLessonId) ??
    flatLessons.find((f) => !completedSet.has(f.lesson.id)) ??
    flatLessons[0] ??
    null;

  const firstClass = classes.data?.[0];

  // 智能练习题量 picker（与 /quiz 同口径）
  const [practiceLimit, setPracticeLimit] = useState<5 | 10 | 20>(10);

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
              to="/courses?filter=enrolled"
              style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', letterSpacing: 1 }}
              title={s('切换主修法本', '切換主修法本', 'Switch main text')}
            >
              {s('切换 →', '切換 →', 'Switch →')}
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
                  marginBottom: 'var(--sp-2)',
                }}
              >
                {currentCourse.coverEmoji} {currentCourse.title}
              </p>

              {/* 当前学到哪里 · 章 + 课名 */}
              {currentCourseDetail.isLoading ? (
                <div style={{ marginBottom: 'var(--sp-3)' }}>
                  <Skeleton.LineSm style={{ width: '60%' }} />
                </div>
              ) : continueTarget ? (
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 'var(--sp-3)', lineHeight: 1.6 }}>
                  📍 {continueTarget.chapter.title}
                  <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>·</span>{' '}
                  <span style={{ color: 'var(--saffron-dark)', fontWeight: 600 }}>
                    {s('第 ' + continueTarget.lesson.order + ' 课', '第 ' + continueTarget.lesson.order + ' 課', 'Lesson ' + continueTarget.lesson.order)}
                  </span>{' '}
                  {continueTarget.lesson.title}
                </p>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                <span className="t-caption t-ink-3">{s('学习进度', '學習進度', 'Progress')}</span>
                <span className="t-meta" style={{ color: 'var(--saffron-dark)', fontWeight: 700 }}>
                  {currentCourseDetail.isLoading
                    ? '—'
                    : totalLessons > 0
                      ? `${completedCount} / ${totalLessons} · ${pct}%`
                      : '—'}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: pct + '%' }} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
                {continueTarget ? (
                  <Link
                    to={`/read/${currentCourse.slug}/${continueTarget.lesson.id}`}
                    className="btn btn-primary btn-pill"
                    style={{ flex: 1, padding: 12, justifyContent: 'center' }}
                  >
                    {firstEnrollment?.currentLessonId
                      ? s('继续阅读', '繼續閱讀', 'Continue')
                      : completedCount > 0
                        ? s('继续阅读', '繼續閱讀', 'Continue')
                        : s('开始阅读', '開始閱讀', 'Start')}
                  </Link>
                ) : (
                  <span
                    className="btn btn-pill"
                    aria-disabled
                    style={{
                      flex: 1,
                      padding: 12,
                      justifyContent: 'center',
                      background: 'var(--glass-thick)',
                      color: 'var(--ink-4)',
                      border: '1px solid var(--glass-border)',
                      cursor: 'not-allowed',
                    }}
                  >
                    {s('暂无课时', '暫無課時', 'No lessons')}
                  </span>
                )}
                <Link
                  to={`/scripture-detail?slug=${encodeURIComponent(currentCourse.slug)}`}
                  className="btn btn-pill"
                  style={{
                    padding: '12px 18px',
                    background: 'var(--glass-thick)',
                    color: 'var(--ink-2)',
                    border: '1px solid var(--glass-border)',
                    justifyContent: 'center',
                  }}
                >
                  {s('目录', '目錄', 'Catalog')}
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

        {/* ⚡ 智能练习卡 · 与 /quiz 同款 · 一键开始答题 */}
        <div
          className="glass-card-thick"
          style={{ padding: 'var(--sp-4)', borderRadius: 'var(--r-lg)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 2, fontSize: '1rem' }}>
                ⚡ {s('智能练习', '智能練習', 'Smart practice')}
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
                {s('待复习 + 错题 + 已学课时混合', '待複習 + 錯題 + 已學課時混合', 'SM-2 + mistakes + studied')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
            {([5, 10, 20] as const).map((n) => {
              const on = n === practiceLimit;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPracticeLimit(n)}
                  aria-pressed={on}
                  style={{
                    flex: 1,
                    padding: '7px 6px',
                    borderRadius: 'var(--r-pill)',
                    border: '1px solid ' + (on ? 'var(--saffron-light)' : 'var(--glass-border)'),
                    background: on ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                    color: on ? 'var(--saffron-dark)' : 'var(--ink-3)',
                    font: 'var(--text-caption)',
                    fontWeight: 600,
                    letterSpacing: 1,
                    cursor: 'pointer',
                  }}
                >
                  {n} {s('题', '題', 'Q')}
                </button>
              );
            })}
          </div>
          {/* secondary 风格 · 与上方"开始阅读"主 CTA 形成主次 · 避免一屏两 primary */}
          <Link
            to={`/practice?limit=${practiceLimit}`}
            className="btn btn-pill btn-full"
            style={{
              padding: 12,
              justifyContent: 'center',
              background: 'var(--glass-thick)',
              color: 'var(--saffron-dark)',
              border: '1.5px solid var(--saffron-light)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
            }}
          >
            {s(`开始练习 · ${practiceLimit} 题`, `開始練習 · ${practiceLimit} 題`, `Start · ${practiceLimit} questions`)} →
          </Link>
        </div>

        {/* 错题提醒 banner 已删除 · 由下方 IconTile "❌ 错题" badge 承担红点提醒 */}

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
