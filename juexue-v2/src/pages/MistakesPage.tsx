// MistakesPage · /mistakes
//   错题本列表 · 点击进 /mistake/:questionId
//   筛选 tabs: 全部 / 今日（按 lastWrongAt 是不是今天）
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useMistakes } from '@/lib/queries';

type MistakeFilter = 'all' | 'today';

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function MistakesPage() {
  const { s } = useLang();
  const { data, isLoading, isError, error } = useMistakes();
  const [filter, setFilter] = useState<MistakeFilter>('all');

  const all = data ?? [];
  const todayCount = useMemo(() => all.filter((m) => isToday(m.lastWrongAt)).length, [all]);
  const filtered = useMemo(() => filter === 'today' ? all.filter((m) => isToday(m.lastWrongAt)) : all, [all, filter]);

  return (
    <div>
      <TopNav titles={['错题本', '錯題本', 'Mistakes']} />

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
            <div style={{ fontSize: '2rem', marginBottom: 'var(--sp-2)' }}>🌿</div>
            <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
              {s('暂无错题 · 慢慢来', '暫無錯題 · 慢慢來', 'No mistakes yet')}
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
            {filtered.map((m) => (
              <Link
                key={m.id}
                to={`/mistake/${encodeURIComponent(m.questionId)}`}
                className="glass-card-thick"
                style={{
                  padding: 'var(--sp-4)',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  borderLeft: '3px solid var(--crimson)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                  <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
                    {m.question?.source || '—'}
                  </span>
                  <span style={{ font: 'var(--text-caption)', color: 'var(--crimson)', fontWeight: 700 }}>
                    × {m.wrongCount}
                  </span>
                </div>
                <div
                  style={{
                    font: 'var(--text-body-serif)',
                    color: 'var(--ink)',
                    letterSpacing: 1.2,
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {m.question?.questionText || s('题目已失效', '題目已失效', 'Unavailable')}
                </div>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 'var(--sp-2)', letterSpacing: 1 }}>
                  {s('最近错于', '最近錯於', 'Last')}: {new Date(m.lastWrongAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
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
