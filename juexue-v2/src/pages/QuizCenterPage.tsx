// QuizCenterPage · 复习中心
//
// 方案 B：与首页分工
//   首页 = 学习仪表盘（智能练习 / 当前闻思 / 棋盘格）· 主动学新内容入口
//   /quiz = 复习中心 · 巩固已学（SM-2 / 错题 / 收藏 / 按闻思随抽）
//
// 区域：
//   1. 标题 + 小 stat（待复习 / 错题 / 收藏 总数）
//   2. 三复习卡（SM-2 / 错题 / 收藏）
//   3. 「按闻思随机抽题」· 直接 /practice?courseId=X 不跳目录
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import CourseCover from '@/components/CourseCover';
import EmptyState from '@/components/EmptyState';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import { usePullToRefresh } from '@/lib/pullToRefresh';
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

  const qc = useQueryClient();
  const { indicator: pullIndicator } = usePullToRefresh(() =>
    qc.refetchQueries({ type: 'active' }),
  );

  return (
    <div>
      {pullIndicator}
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

      {/* 三复习卡 · 与闻思详情 StatCard 同款 · 磨砂玻璃 + 线性图标 · 数值比 SD 大一档 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', padding: '0 var(--sp-5) var(--sp-5)' }}>
        <ReviewCard
          to="/sm2-review"
          icon={<IconReplay />}
          activeColor="var(--gold-dark)"
          count={sm2.data?.totalDue}
          loading={sm2.isLoading}
          label={s('待复习', '待複習', 'Due')}
        />
        <ReviewCard
          to="/mistakes"
          icon={<IconCross />}
          activeColor="var(--crimson)"
          count={mistakes.data}
          loading={mistakes.isLoading}
          label={s('错题', '錯題', 'Mistakes')}
        />
        <ReviewCard
          to="/favorites"
          icon={<IconStar />}
          activeColor="var(--saffron-dark)"
          count={favorites.data}
          loading={favorites.isLoading}
          label={s('收藏', '收藏', 'Saved')}
        />
      </div>

      {/* 按闻思随机抽题 · 二级 section header · 与首页"智能练习"同规范
          复习卡区与本区清晰分隔 · 不再用一行小 caption 容易被略过 */}
      <div style={{ padding: '0 var(--sp-5) var(--sp-3)', marginTop: 'var(--sp-3)' }}>
        <h2 className="t-section" style={{ color: 'var(--ink)' }}>
          {s('按闻思练习', '按聞思練習', 'By text')}
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
            title={s('暂未报名闻思', '暫未報名聞思', 'No enrolled texts')}
            hint={s('去闻思页选一本开始学习', '去聞思頁選一本開始學習', 'Browse texts to start')}
            cta={
              <Link
                to="/courses"
                className="btn btn-primary btn-pill"
                style={{ padding: '10px 20px' }}
              >
                {s('去选修闻思', '去選修聞思', 'Browse texts')}
              </Link>
            }
          />
        ) : (
          courseList.map((c) => (
            <Link
              key={c.id}
              to={`/quiz-practice?courseId=${encodeURIComponent(c.id)}&limit=10`}
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
  to, icon, activeColor, count, loading, label,
}: {
  to: string;
  icon: React.ReactNode;
  /** count > 0 时图标 + 数字用此色 · 0 时灰 */
  activeColor: string;
  count?: number;
  loading?: boolean;
  label: string;
}) {
  const isZero = !loading && (count ?? 0) === 0;
  const tone = isZero ? 'var(--ink-4)' : activeColor;
  return (
    <Link
      to={to}
      style={{
        padding: 'var(--sp-3) var(--sp-2)',
        borderRadius: 'var(--r-lg)',
        // 磨砂玻璃 · 与闻思详情 StatCard 一致
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 26 }}>
        <span style={{ color: tone, display: 'inline-flex' }}>{icon}</span>
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: isZero ? 500 : 700,
            fontSize: '1.5rem',
            color: tone,
            lineHeight: 1.1,
          }}
        >
          {loading ? <Skeleton.LineSm style={{ width: 24, height: 16, display: 'inline-block' }} /> : (count ?? 0)}
        </span>
      </div>
    </Link>
  );
}

// 线性图标 · 18×18 · 与闻思详情 StatCard 同风格 · 比 SD 略大配合 1.5rem 数值
function IconReplay() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
function IconCross() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
