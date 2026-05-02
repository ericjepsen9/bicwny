// QuizCenterPage · 答题入口 + 法本练习
//   3 个复习卡：SM-2 / 错题 / 收藏
//   按法本练习列表
import { Link } from 'react-router-dom';
import CourseCover from '@/components/CourseCover';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import {
  useCourses,
  useEnrollments,
  useFavoriteCount,
  useMistakeCount,
  useSm2Stats,
} from '@/lib/queries';

export default function QuizCenterPage() {
  const { s } = useLang();
  const enrollments = useEnrollments();
  const courses = useCourses();
  const sm2 = useSm2Stats();
  const mistakes = useMistakeCount();
  const favorites = useFavoriteCount();

  // 按已报名顺序展示对应 course
  const courseList = (enrollments.data ?? [])
    .map((e) => courses.data?.find((c) => c.id === e.courseId))
    .filter((c): c is NonNullable<typeof c> => !!c);

  return (
    <div>
      <div style={{ padding: 'var(--sp-2) var(--sp-5) var(--sp-4)' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--ink)', letterSpacing: 4 }}>
          <span className="sc">答题</span>
          <span className="tc">答題</span>
          <span className="en">Quiz</span>
        </p>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 4 }}>
          {s('检验所学 · 巩固记忆', '檢驗所學 · 鞏固記憶', 'Test & reinforce')}
        </p>
      </div>

      {/* 复习快捷行 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', padding: '0 var(--sp-5) var(--sp-5)' }}>
        <ReviewCard
          to="/sm2-review"
          icon="🔁"
          iconBg="rgba(236,180,86,.18)"
          iconColor="var(--gold-dark)"
          count={sm2.data?.totalDue}
          loading={sm2.isLoading}
          label={s('SM-2 复习', 'SM-2 複習', 'SM-2')}
        />
        <ReviewCard
          to="/mistakes"
          icon="❌"
          iconBg="var(--crimson-light)"
          iconColor="var(--crimson)"
          count={mistakes.data}
          loading={mistakes.isLoading}
          label={s('错题本', '錯題本', 'Mistakes')}
        />
        <ReviewCard
          to="/favorites"
          icon="⭐"
          iconBg="var(--saffron-pale)"
          iconColor="var(--saffron-dark)"
          count={favorites.data}
          loading={favorites.isLoading}
          label={s('收藏', '收藏', 'Favorites')}
        />
      </div>

      {/* 按法本练习 */}
      <div
        style={{
          padding: '0 var(--sp-5) var(--sp-3)',
          font: 'var(--text-caption)',
          color: 'var(--ink-3)',
          letterSpacing: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
        {s('按法本练习', '按法本練習', 'Practice by text')}
      </div>

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {enrollments.isLoading || courses.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="glass-card-thick"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3)' }}
            >
              <Skeleton.Thumb />
              <div style={{ flex: 1 }}>
                <Skeleton.LineLg />
                <Skeleton.LineSm style={{ marginTop: 6 }} />
              </div>
            </div>
          ))
        ) : courseList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-5)', color: 'var(--ink-3)', font: 'var(--text-body)', letterSpacing: 1 }}>
            <p>{s('暂未报名法本', '暫未報名法本', 'No enrolled texts')}</p>
            <Link
              to="/courses"
              className="btn btn-primary btn-pill"
              style={{ display: 'inline-block', marginTop: 'var(--sp-3)', padding: '10px 20px' }}
            >
              {s('去选修法本', '去選修法本', 'Browse texts')}
            </Link>
          </div>
        ) : (
          courseList.map((c) => (
            <Link
              key={c.id}
              to={`/scripture-detail?slug=${encodeURIComponent(c.slug)}&mode=quiz`}
              className="glass-card-thick"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-3)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                <CourseCover course={c} emojiSize="1.6rem" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 600,
                    fontSize: '.9375rem',
                    color: 'var(--ink)',
                    letterSpacing: 1.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.coverEmoji} {c.title}
                </div>
                {c.author && (
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '.5px', marginTop: 2 }}>
                    {c.author}
                  </div>
                )}
              </div>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" style={{ color: 'var(--ink-4)' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  to, icon, iconBg, iconColor, count, loading, label,
}: {
  to: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  count?: number;
  loading?: boolean;
  label: string;
}) {
  const display = loading ? '—' : count ?? 0;
  const isZero = !loading && (count ?? 0) === 0;
  return (
    <Link
      to={to}
      className="glass-card-thick"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 'var(--sp-4) var(--sp-2)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: isZero ? 500 : 700,
          fontSize: '1.25rem',
          color: isZero ? 'var(--ink-4)' : 'var(--ink)',
        }}
      >
        {display}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
        {label}
      </div>
    </Link>
  );
}
