// MistakesPage · /mistakes
//   错题本列表 · 点击进 /mistake/:questionId
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useMistakes } from '@/lib/queries';

export default function MistakesPage() {
  const { s } = useLang();
  const { data, isLoading, isError, error } = useMistakes();

  return (
    <div>
      <TopNav titles={['错题本', '錯題本', 'Mistakes']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton.Card key={i} />)}
          </div>
        ) : isError ? (
          <p style={{ color: 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-6)' }}>
            {(error as ApiError).message}
          </p>
        ) : !data || data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-5)', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--sp-2)' }}>🌿</div>
            <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
              {s('暂无错题 · 慢慢来', '暫無錯題 · 慢慢來', 'No mistakes yet')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {data.map((m) => (
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
