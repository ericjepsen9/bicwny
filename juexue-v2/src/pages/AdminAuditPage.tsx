// AdminAuditPage · /admin/audit
//   只读审计 · action 过滤 + 搜索 + 展开 before/after JSON
import { useMemo, useState } from 'react';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import { useAdminAudit } from '@/lib/queries';

const ACTION_PRESETS: { v: string; sc: string; tc: string; en: string }[] = [
  { v: '',                sc: '全部',     tc: '全部',     en: 'All' },
  { v: 'user.create',     sc: '新建用户', tc: '新建用戶', en: 'User · create' },
  { v: 'user.role',       sc: '改角色',   tc: '改角色',   en: 'User · role' },
  { v: 'user.active',     sc: '改激活',   tc: '改激活',   en: 'User · active' },
  { v: 'class.create',    sc: '新建班级', tc: '新建班級', en: 'Class · create' },
  { v: 'class.member',    sc: '班级成员', tc: '班級成員', en: 'Class · member' },
  { v: 'class.archive',   sc: '归档班级', tc: '歸檔班級', en: 'Class · archive' },
  { v: 'question.review', sc: '题目审核', tc: '題目審核', en: 'Question · review' },
  { v: 'report.handle',   sc: '举报处理', tc: '舉報處理', en: 'Report · handle' },
];

export default function AdminAuditPage() {
  const { s } = useLang();
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = useAdminAudit({ action: action || undefined, limit: 100 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data?.items ?? []).filter((it) =>
      !q || (
        it.action.toLowerCase().includes(q) ||
        it.targetType.toLowerCase().includes(q) ||
        it.targetId.toLowerCase().includes(q) ||
        (it.adminName || '').toLowerCase().includes(q)
      )
    );
  }, [list.data, search]);

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('审计日志', '審計日誌', 'Audit')}</h1>
          <p className="page-sub">{s('管理员操作可追溯', '管理員操作可追溯', 'Admin action trail')}</p>
        </div>
      </div>

      <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ACTION_PRESETS.map((p) => (
            <button
              key={p.v || 'all'}
              type="button"
              onClick={() => setAction(p.v)}
              className="btn btn-pill"
              style={{
                padding: '5px 10px', font: 'var(--text-caption)', fontWeight: 600,
                background: action === p.v ? 'var(--saffron-pale)' : 'transparent',
                color: action === p.v ? 'var(--saffron-dark)' : 'var(--ink-3)',
                border: '1px solid ' + (action === p.v ? 'var(--saffron-light)' : 'transparent'),
              }}
            >
              {s(p.sc, p.tc, p.en)}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder={s('搜索 action / target…', '搜尋 action / target…', 'Search…')}
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
          {s('无记录', '無記錄', 'No entries')}
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
                    border: 'none', cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 110 }}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1, minWidth: 110, textAlign: 'center' }}>
                    {entry.action}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, font: 'var(--text-caption)', color: 'var(--ink)' }}>
                    {entry.targetType} · <code style={{ color: 'var(--ink-3)' }}>{entry.targetId.slice(0, 12)}</code>
                  </span>
                  <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                    {entry.adminName || entry.adminId.slice(0, 8)}
                  </span>
                  <span style={{ color: 'var(--ink-4)' }}>{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: 'var(--sp-3) var(--sp-4) var(--sp-4)', background: 'var(--glass)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                    <DiffPanel label="before" data={entry.before} />
                    <DiffPanel label="after" data={entry.after} />
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

function DiffPanel({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  return (
    <div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      <pre style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-input)', padding: 'var(--sp-3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-light)', maxHeight: 300, overflowY: 'auto' }}>
        {data ? JSON.stringify(data, null, 2) : '—'}
      </pre>
    </div>
  );
}
