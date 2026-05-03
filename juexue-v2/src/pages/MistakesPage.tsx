// MistakesPage · /mistakes
//   错题本列表 · 顶部 sticky CTA「刷错题 · N 题」直接进 /practice?onlyMistakes=1
//   错题卡：法本/章节标签 + 题干 + 错次 + 时间 + 「再练 →」按钮
//   筛选 tabs: 全部 / 今日（按 lastWrongAt 是不是今天）
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useCourses, useMistakes } from '@/lib/queries';

type MistakeFilter = 'all' | 'today';

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

const PRACTICE_LIMIT_OPTS = [5, 10, 0] as const; // 0 = 全部
type PracticeLimit = typeof PRACTICE_LIMIT_OPTS[number];

export default function MistakesPage() {
  const { s } = useLang();
  const { data, isLoading, isError, error } = useMistakes();
  const courses = useCourses();
  const [filter, setFilter] = useState<MistakeFilter>('all');
  const [practiceLimit, setPracticeLimit] = useState<PracticeLimit>(10);

  const all = data ?? [];
  const todayCount = useMemo(() => all.filter((m) => isToday(m.lastWrongAt)).length, [all]);
  const filtered = useMemo(() => filter === 'today' ? all.filter((m) => isToday(m.lastWrongAt)) : all, [all, filter]);

  // courseId → coverEmoji + title 映射
  const courseMeta = useMemo(() => {
    const m = new Map<string, { emoji: string; title: string }>();
    for (const c of courses.data ?? []) {
      m.set(c.id, { emoji: c.coverEmoji || '🪷', title: c.title });
    }
    return m;
  }, [courses.data]);

  // CTA 链接：limit=0 → 全部（不带 limit · 后端默认 10 但 backend cap 50；这里用 50 兜底）
  const ctaLimit = practiceLimit === 0 ? 50 : practiceLimit;
  const ctaLabel = practiceLimit === 0
    ? s('刷全部错题', '刷全部錯題', 'Practice all')
    : s(`刷错题 · ${practiceLimit} 题`, `刷錯題 · ${practiceLimit} 題`, `Practice · ${practiceLimit}`);

  return (
    <div>
      <TopNav titles={['错题本', '錯題本', 'Mistakes']} />

      {/* 顶部「刷错题」CTA · 仅有错题时显示 */}
      {!isLoading && !isError && all.length > 0 && (
        <div
          className="glass-card-thick"
          style={{
            margin: '0 var(--sp-5) var(--sp-3)',
            padding: 'var(--sp-3) var(--sp-4)',
            borderRadius: 'var(--r-lg)',
            borderLeft: '3px solid var(--crimson)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 1.5, fontSize: '0.9375rem' }}>
                ❌ {s(`共 ${all.length} 条错题待巩固`, `共 ${all.length} 條錯題待鞏固`, `${all.length} mistakes to review`)}
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
                {s('混合抽题 · 攻克薄弱点', '混合抽題 · 攻克薄弱點', 'Mixed practice')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-3)' }}>
            {PRACTICE_LIMIT_OPTS.map((n) => {
              const on = n === practiceLimit;
              const label = n === 0
                ? s('全部', '全部', 'All')
                : `${n} ${s('题', '題', 'Q')}`;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPracticeLimit(n)}
                  aria-pressed={on}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 'var(--r-pill)',
                    border: '1px solid ' + (on ? 'var(--crimson)' : 'var(--glass-border)'),
                    background: on ? 'var(--crimson-light)' : 'var(--glass-thick)',
                    color: on ? 'var(--crimson)' : 'var(--ink-3)',
                    font: 'var(--text-caption)',
                    fontWeight: 600,
                    letterSpacing: 1,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Link
            to={`/practice?onlyMistakes=1&limit=${ctaLimit}`}
            className="btn btn-pill btn-full"
            style={{
              padding: 11,
              justifyContent: 'center',
              background: 'var(--crimson)',
              color: '#fff',
              border: 'none',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(192, 57, 43, 0.3)',
            }}
          >
            {ctaLabel} →
          </Link>
        </div>
      )}

      {/* 筛选 tabs */}
      {!isLoading && !isError && all.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--sp-2)', padding: '0 var(--sp-5) var(--sp-3)', overflowX: 'auto' }}>
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            {s('全部', '全部', 'All')} ({all.length})
          </FilterChip>
          <FilterChip active={filter === 'today'} onClick={() => setFilter('today')}>
            {s('今日', '今日', 'Today')} ({todayCount})
          </FilterChip>
        </div>
      )}

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton.Card key={i} />)}
          </div>
        ) : isError ? (
          <p style={{ color: 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-6)' }}>
            {(error as ApiError).message}
          </p>
        ) : all.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-5)', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 'var(--sp-2)' }}>🌿</div>
            <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
              {s('暂无错题 · 太棒了', '暫無錯題 · 太棒了', 'No mistakes yet · awesome')}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-7) var(--sp-5)', color: 'var(--ink-3)' }}>
            <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
              {s('当前筛选下暂无错题', '當前篩選下暫無錯題', 'No mistakes match this filter')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {filtered.map((m) => {
              const meta = m.question?.courseId ? courseMeta.get(m.question.courseId) : undefined;
              return (
                <div
                  key={m.id}
                  className="glass-card-thick"
                  style={{
                    padding: 'var(--sp-4)',
                    borderLeft: '3px solid var(--crimson)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--sp-2)',
                  }}
                >
                  {/* 法本/章节标签 + 错次 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {meta ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 10px',
                          borderRadius: 'var(--r-pill)',
                          background: 'var(--glass)',
                          border: '1px solid var(--glass-border)',
                          font: 'var(--text-caption)',
                          color: 'var(--ink-2)',
                          letterSpacing: 1,
                          maxWidth: '100%',
                          minWidth: 0,
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', flexShrink: 0 }}>{meta.emoji}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {meta.title}
                        </span>
                      </span>
                    ) : (
                      <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
                        {m.question?.source || '—'}
                      </span>
                    )}
                    <span
                      style={{
                        flexShrink: 0,
                        padding: '2px 8px',
                        borderRadius: 'var(--r-pill)',
                        background: 'var(--crimson-light)',
                        color: 'var(--crimson)',
                        font: 'var(--text-caption)',
                        fontWeight: 700,
                        letterSpacing: 1,
                      }}
                    >
                      ✗ × {m.wrongCount}
                    </span>
                  </div>

                  {/* 题干（点击进详情） */}
                  <Link
                    to={`/mistake/${encodeURIComponent(m.questionId)}`}
                    style={{
                      font: 'var(--text-body-serif)',
                      color: 'var(--ink)',
                      letterSpacing: 1.2,
                      lineHeight: 1.6,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textDecoration: 'none',
                    }}
                  >
                    {m.question?.questionText || s('题目已失效', '題目已失效', 'Unavailable')}
                  </Link>

                  {/* 时间 + 操作 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
                      {s('上次错于 ', '上次錯於 ', 'Last ')}{new Date(m.lastWrongAt).toLocaleDateString()}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link
                        to={`/mistake/${encodeURIComponent(m.questionId)}`}
                        style={{
                          font: 'var(--text-caption)',
                          color: 'var(--ink-3)',
                          letterSpacing: 1,
                          padding: '4px 10px',
                          borderRadius: 'var(--r-pill)',
                          background: 'var(--glass)',
                          border: '1px solid var(--glass-border)',
                          textDecoration: 'none',
                        }}
                      >
                        {s('详情', '詳情', 'Details')}
                      </Link>
                      <Link
                        to={`/practice?questionId=${encodeURIComponent(m.questionId)}`}
                        style={{
                          font: 'var(--text-caption)',
                          fontWeight: 700,
                          color: 'var(--crimson)',
                          letterSpacing: 1,
                          padding: '4px 10px',
                          borderRadius: 'var(--r-pill)',
                          background: 'var(--crimson-light)',
                          border: '1px solid var(--crimson)',
                          textDecoration: 'none',
                        }}
                      >
                        {s('再练 →', '再練 →', 'Retry →')}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 'var(--r-pill)',
        border: '1px solid ' + (active ? 'var(--saffron-light)' : 'var(--glass-border)'),
        background: active ? 'var(--saffron-pale)' : 'var(--glass-thick)',
        color: active ? 'var(--saffron-dark)' : 'var(--ink-3)',
        font: 'var(--text-caption)',
        fontWeight: 600,
        letterSpacing: 1,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
