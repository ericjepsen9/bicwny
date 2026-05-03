// QuizCenterPage · 答题中心
//
// 方案 A：智能练习仪表盘
// 不再跳法本目录页，让答题 tab 真正"一键开始答题"。
//
// 区域：
//   1. 顶部 stat（累计 / 正确率 / 连续天数）
//   2. 主按钮「智能练习 · N 题」 · chip 选题量 5/10/20
//      → /practice?limit=N · 后端综合 SM-2 待复习 + 错题 + 已学课时随机选题
//   3. 三复习卡（保留）：🔁 SM-2 / ❌ 错题 / ⭐ 收藏
//   4. 「按法本练习」精简卡 · 直接 /practice?courseId=X 抽该法本混合题
//      不跳法本目录 · 大幅简化路径
import { useState } from 'react';
import { Link } from 'react-router-dom';
import CourseCover from '@/components/CourseCover';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import {
  useCourses,
  useEnrollments,
  useFavoriteCount,
  useMistakeCount,
  useProgress,
  useSm2Stats,
} from '@/lib/queries';

const LIMIT_OPTS = [5, 10, 20] as const;
type LimitOpt = typeof LIMIT_OPTS[number];

export default function QuizCenterPage() {
  const { s } = useLang();
  const enrollments = useEnrollments();
  const courses = useCourses();
  const sm2 = useSm2Stats();
  const mistakes = useMistakeCount();
  const favorites = useFavoriteCount();
  const progress = useProgress();

  const [limit, setLimit] = useState<LimitOpt>(10);

  // 按已报名顺序展示对应 course
  const courseList = (enrollments.data ?? [])
    .map((e) => courses.data?.find((c) => c.id === e.courseId))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const totalAnswered = progress.data?.totalAnswered ?? 0;
  const correctRate = progress.data ? Math.round(progress.data.correctRate * 100) : 0;
  const streakDays = progress.data?.streakDays ?? 0;

  return (
    <div>
      <div style={{ padding: 'var(--sp-2) var(--sp-5) var(--sp-4)' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--ink)', letterSpacing: 4 }}>
          <span className="sc">答题</span>
          <span className="tc">答題</span>
          <span className="en">Quiz</span>
        </p>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 4 }}>
          {s('一键开始 · 智能挑题 · 巩固记忆', '一鍵開始 · 智能挑題 · 鞏固記憶', 'One tap · smart selection · reinforce')}
        </p>
      </div>

      {/* ───── 顶部 stat ───── */}
      <div
        className="glass-card-thick"
        style={{
          margin: '0 var(--sp-5) var(--sp-4)',
          padding: 'var(--sp-4)',
          display: 'grid',
          gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
          alignItems: 'center',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <Stat
          loading={progress.isLoading}
          value={String(totalAnswered)}
          label={s('累计答题', '累計答題', 'Total')}
        />
        <Sep />
        <Stat
          loading={progress.isLoading}
          value={correctRate + '%'}
          label={s('正确率', '正確率', 'Accuracy')}
          color="var(--sage-dark)"
        />
        <Sep />
        <Stat
          loading={progress.isLoading}
          value={String(streakDays)}
          label={s('连续天数', '連續天數', 'Streak')}
          color="var(--saffron-dark)"
        />
      </div>

      {/* ───── 智能练习主入口 ───── */}
      <div
        className="glass-card-thick"
        style={{
          margin: '0 var(--sp-5) var(--sp-4)',
          padding: 'var(--sp-4)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 2, fontSize: '1rem' }}>
              ⚡ {s('智能练习', '智能練習', 'Smart practice')}
            </div>
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
              {s('待复习 + 错题 + 已学课时混合', '待複習 + 錯題 + 已學課時混合', 'SM-2 + mistakes + studied lessons')}
            </div>
          </div>
        </div>
        {/* 题量选择 */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
          {LIMIT_OPTS.map((n) => {
            const on = n === limit;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setLimit(n)}
                aria-pressed={on}
                style={{
                  flex: 1,
                  padding: '8px 6px',
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
        <Link
          to={`/practice?limit=${limit}`}
          className="btn btn-primary btn-pill btn-full"
          style={{ padding: 14, justifyContent: 'center' }}
        >
          {s(`开始练习 · ${limit} 题`, `開始練習 · ${limit} 題`, `Start · ${limit} questions`)}
        </Link>
      </div>

      {/* ───── 三复习卡 ───── */}
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

      {/* ───── 按法本练习（直接抽题 · 不跳目录） ───── */}
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
              to={`/practice?courseId=${encodeURIComponent(c.id)}&limit=${limit}`}
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
                  {s(`抽 ${limit} 题练习 →`, `抽 ${limit} 題練習 →`, `Practice ${limit} questions →`)}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, color, loading }: { value: string; label: string; color?: string; loading?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {loading ? (
        <div style={{ height: 24, marginBottom: 4 }}>
          <Skeleton.LineSm style={{ width: 36, margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: color ?? 'var(--ink)', lineHeight: 1.2 }}>
          {value}
        </div>
      )}
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function Sep() {
  return <div style={{ background: 'var(--border-light)', justifySelf: 'center', height: 32, width: 1 }} />;
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
        borderRadius: 'var(--r-lg)',
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
