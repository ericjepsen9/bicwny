// AdminLogsPage · /admin/logs
//   运行日志 · stats strip + kind 过滤 + 展开 stack/details
import { useMemo, useState } from 'react';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import { useAdminLogs, useAdminLogsStats } from '@/lib/queries';

type KindFilter = '' | 'error' | 'slow_request' | 'slow_query';

export default function AdminLogsPage() {
  const { s } = useLang();
  const stats = useAdminLogsStats();
  const [kind, setKind] = useState<KindFilter>('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = useAdminLogs({ kind: kind || undefined, limit: 100 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data?.items ?? []).filter((it) =>
      !q || it.message.toLowerCase().includes(q) || (it.requestId || '').toLowerCase().includes(q)
    );
  }, [list.data, search]);

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('运行日志', '運行日誌', 'Logs')}</h1>
          <p className="page-sub">{s('错误 · 慢请求 · 慢查询', '錯誤 · 慢請求 · 慢查詢', 'Errors · slow requests · slow queries')}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <Stat loading={stats.isLoading} value={stats.data?.counts.error ?? 0} label={s('错误 · 24h', '錯誤 · 24h', 'Errors · 24h')} color="var(--crimson)" />
        <Stat loading={stats.isLoading} value={stats.data?.counts.slow_request ?? 0} label={s('慢请求 · 24h', '慢請求 · 24h', 'Slow req · 24h')} color="var(--gold-dark)" />
        <Stat loading={stats.isLoading} value={stats.data?.counts.slow_query ?? 0} label={s('慢查询 · 24h', '慢查詢 · 24h', 'Slow query · 24h')} color="var(--saffron-dark)" />
      </div>

      <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { v: '',             label: s('全部', '全部', 'All') },
            { v: 'error',        label: 'error' },
            { v: 'slow_request', label: 'slow_request' },
            { v: 'slow_query',   label: 'slow_query' },
          ] as { v: KindFilter; label: string }[]).map((k) => (
            <button
              key={k.v || 'all'}
              type="button"
              onClick={() => setKind(k.v)}
              className="btn btn-pill"
              style={{
                padding: '5px 10px', font: 'var(--text-caption)', fontWeight: 600,
                background: kind === k.v ? 'var(--saffron-pale)' : 'transparent',
                color: kind === k.v ? 'var(--saffron-dark)' : 'var(--ink-3)',
                border: '1px solid ' + (kind === k.v ? 'var(--saffron-light)' : 'transparent'),
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder={s('搜索 message / requestId…', '搜尋 message / requestId…', 'Search…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '6px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border)', background: 'var(--bg-input)', font: 'var(--text-caption)', outline: 'none' }}
        />
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{filtered.length} 条</span>
      </div>

      {list.isLoading ? (
        <Skeleton.Card />
      ) : filtered.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
          🌿 {s('无错误日志', '無錯誤日誌', 'No errors')}
        </div>
      ) : (
        <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((entry, i) => {
            const isOpen = expanded === entry.id;
            return (
              <div key={entry.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: 'var(--sp-3) var(--sp-4)',
                    display: 'flex', gap: 'var(--sp-3)', alignItems: 'center',
                    background: isOpen ? 'var(--saffron-pale)' : 'transparent',
                    border: 'none', cursor: 'pointer', color: 'inherit',
                  }}
                >
                  <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 110 }}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  <KindPill k={entry.kind} />
                  <span style={{ flex: 1, minWidth: 0, font: 'var(--text-caption)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.message}
                  </span>
                  {entry.userId && <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>u:{entry.userId.slice(0, 6)}</span>}
                  {entry.requestId && <code style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{entry.requestId.slice(0, 8)}</code>}
                  <span style={{ color: 'var(--ink-4)' }}>{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: 'var(--sp-3) var(--sp-4) var(--sp-4)', background: 'var(--glass)' }}>
                    {entry.stack && (
                      <>
                        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>STACK</div>
                        <pre style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--bg-input)', padding: 'var(--sp-3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-light)', maxHeight: 300, overflowY: 'auto', marginBottom: 'var(--sp-3)' }}>
                          {entry.stack}
                        </pre>
                      </>
                    )}
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <>
                        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>DETAILS</div>
                        <pre style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-input)', padding: 'var(--sp-3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-light)', maxHeight: 300, overflowY: 'auto' }}>
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ value, label, color, loading }: { value: number; label: string; color?: string; loading?: boolean }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      {loading ? <Skeleton.Title style={{ width: 60 }} /> : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', color: color ?? 'var(--ink)', letterSpacing: 1 }}>{value}</div>
      )}
    </div>
  );
}

function KindPill({ k }: { k: 'error' | 'slow_request' | 'slow_query' }) {
  const map = {
    error:        { bg: 'var(--crimson-light)', color: 'var(--crimson)' },
    slow_request: { bg: 'var(--gold-pale)', color: 'var(--gold-dark)' },
    slow_query:   { bg: 'var(--saffron-pale)', color: 'var(--saffron-dark)' },
  } as const;
  const m = map[k];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: m.bg, color: m.color, font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1, minWidth: 110, textAlign: 'center' }}>
      {k}
    </span>
  );
}
