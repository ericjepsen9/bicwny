// QuizCenterPage · 复习中心
//
// 方案 B：与首页分工
//   首页 = 学习仪表盘（智能练习 / 当前法本 / 棋盘格）· 主动学新内容入口
//   /quiz = 复习中心 · 巩固已学（SM-2 / 错题 / 收藏 / 按法本随抽）
//
// 区域：
//   1. 标题 + 小 stat（待复习 / 错题 / 收藏 总数）
//   2. 三复习卡（SM-2 / 错题 / 收藏）
//   3. 「按法本随机抽题」· 直接 /practice?courseId=X 不跳目录
import { Link } from 'react-router-dom';
import CourseCover from '@/components/CourseCover';
import EmptyState from '@/components/EmptyState';
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
        <p className="t-h1" style={{ color: 'var(--ink)' }}>
          <span className="sc">复习</span>
          <span className="tc">複習</span>
          <span className="en">Review</span>
        </p>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 4 }}>
          {s('巩固所学 · 间隔重复 · 攻克错题', '鞏固所學 · 間隔重複 · 攻克錯題', 'Reinforce · spaced repetition · master mistakes')}
        </p>
      </div>

      {/* 三复习卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', padding: '0 var(--sp-5) var(--sp-5)' }}>
        <ReviewCard
          to="/sm2-review"
          icon="🔁"
          iconBg="rgba(236,180,86,.18)"
          iconColor="var(--gold-dark)"
          count={sm2.data?.totalDue}
          loading={sm2.isLoading}
          label={s('待复习', '待複習', 'Due')}
          sub={s('SM-2 间隔', 'SM-2 間隔', 'SM-2')}
        />
        <ReviewCard
          to="/mistakes"
          icon="❌"
          iconBg="var(--crimson-light)"
          iconColor="var(--crimson)"
          count={mistakes.data}
          loading={mistakes.isLoading}
          label={s('错题', '錯題', 'Mistakes')}
          sub={s('需巩固', '需鞏固', 'Practice')}
        />
        <ReviewCard
          to="/favorites"
          icon="⭐"
          iconBg="var(--saffron-pale)"
          iconColor="var(--saffron-dark)"
          count={favorites.data}
          loading={favorites.isLoading}
          label={s('收藏', '收藏', 'Saved')}
          sub={s('题目', '題目', 'Items')}
        />
      </div>

      {/* 按法本随机抽题 · 二级 section header · 与首页"智能练习"同规范
          复习卡区与本区清晰分隔 · 不再用一行小 caption 容易被略过 */}
      <div style={{ padding: '0 var(--sp-5) var(--sp-3)', marginTop: 'var(--sp-3)' }}>
        <h2 className="t-section" style={{ color: 'var(--ink)' }}>
          {s('按法本练习', '按法本練習', 'By text')}
        </h2>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
          {s('从已学课时随机抽题', '從已學課時隨機抽題', 'Random questions from studied lessons')}
        </p>
      </div>

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
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
          <EmptyState
            icon="📚"
            title={s('暂未报名法本', '暫未報名法本', 'No enrolled texts')}
            hint={s('去法本页选一本开始学习', '去法本頁選一本開始學習', 'Browse texts to start')}
            cta={
              <Link
                to="/courses"
                className="btn btn-primary btn-pill"
                style={{ padding: '10px 20px' }}
              >
                {s('去选修法本', '去選修法本', 'Browse texts')}
              </Link>
            }
          />
        ) : (
          courseList.map((c) => (
            <Link
              key={c.id}
              to={`/practice?courseId=${encodeURIComponent(c.id)}&limit=10`}
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
              <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                <CourseCover course={c} emojiSize="1.4rem" />
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
                <div style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', letterSpacing: 1, marginTop: 2 }}>
                  {s('抽 10 题练习 →', '抽 10 題練習 →', 'Practice 10 questions →')}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  to, icon, iconBg, iconColor, count, loading, label, sub,
}: {
  to: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  count?: number;
  loading?: boolean;
  label: string;
  sub: string;
}) {
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
        borderRadius: 'var(--r-lg)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: isZero ? 500 : 700,
          fontSize: '1.5rem',
          color: isZero ? 'var(--ink-4)' : 'var(--ink)',
          lineHeight: 1.1,
          marginTop: 4,
          minHeight: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? <Skeleton.LineSm style={{ width: 28, height: 18 }} /> : (count ?? 0)}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, fontSize: '.6875rem' }}>
        {sub}
      </div>
    </Link>
  );
}
