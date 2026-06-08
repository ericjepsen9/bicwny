// 笔记总览 · /notes
//   - Tab: 我的 / 班级共享
//   - 搜索 + tag chip 筛选 + 时间线 · pinned 置顶
//   - 点笔记进 /notes/:id 编辑
//   - 「+ 新建笔记」按钮 → /notes/new
import { useMemo, useState, type MouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { relTime } from '@/lib/relTime';
import { toast } from '@/lib/toast';

interface Note {
  id: string;
  lessonId: string | null;
  title: string;
  body: string;
  tags: string[];
  visibility: 'private' | 'class';
  pinnedAt: string | null;
  updatedAt: string;
  authorName?: string | null;
  lessonTitle?: string | null;
}

type Tab = 'mine' | 'shared' | 'archived';

export default function NotesPage() {
  const { s } = useLang();
  const [tab, setTab] = useState<Tab>('mine');
  const [q, setQ] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const mine = useQuery({
    enabled: tab === 'mine',
    queryKey: ['/api/notes', { q, tag: selectedTag }],
    queryFn: ({ signal }) => api.get<Note[]>(
      `/api/notes${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      { signal },
    ),
  });

  const shared = useQuery({
    enabled: tab === 'shared',
    queryKey: ['/api/notes/shared', { q }],
    queryFn: ({ signal }) => api.get<Note[]>(
      `/api/notes/shared${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      { signal },
    ),
  });

  // 举报同班共享笔记（卡片是 Link · 按钮需阻止冒泡）
  const qc = useQueryClient();
  const reportMut = useMutation({
    mutationFn: (noteId: string) => api.post(`/api/notes/${encodeURIComponent(noteId)}/report`, {}),
    onSuccess: () => {
      toast.ok(s('已举报 · 辅导员/管理员会复核', '已舉報 · 輔導員/管理員會複核', 'Reported · staff will review'));
      qc.invalidateQueries({ queryKey: ['/api/notes/shared'] });
    },
    onError: (e) => toast.error((e as ApiError).message),
  });
  async function onReport(e: MouseEvent, noteId: string) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirmAsync({
      title: s('举报这条共享笔记？', '舉報這條共享筆記？', 'Report this shared note?'),
      body: s('辅导员/管理员会复核 · 不当内容会被下架', '輔導員/管理員會複核 · 不當內容會被下架', 'Coaches/admins will review; inappropriate content gets taken down.'),
    });
    if (!ok) return;
    reportMut.mutate(noteId);
  }

  const archived = useQuery({
    enabled: tab === 'archived',
    queryKey: ['/api/notes', { q, archived: true }],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ archived: '1' });
      if (q) params.set('q', q);
      return api.get<Note[]>(`/api/notes?${params.toString()}`, { signal });
    },
  });

  const currentQ = tab === 'mine' ? mine : tab === 'shared' ? shared : archived;
  const list = currentQ.data ?? [];
  const isLoading = currentQ.isLoading;

  // 所有 tag 聚合
  const allTags = useMemo(() => {
    const map = new Map<string, number>();
    list.forEach((n) => n.tags.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [list]);

  const filtered = selectedTag ? list.filter((n) => n.tags.includes(selectedTag)) : list;

  return (
    <>
      <TopNav
        titles={['笔记', '筆記', 'Notes']}
        backTo="/profile"
        right={(
          <Link to="/notes/new" style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', textDecoration: 'none', padding: '4px 10px' }}>
            ＋ {s('新建', '新建', 'New')}
          </Link>
        )}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>

        {/* Tab 切换 · 归档 tab 字号略弱 · 暗示是次要入口 */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-light)' }}>
          {(['mine', 'shared', 'archived'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setSelectedTag(null); }}
              style={{
                flex: 1,
                padding: '10px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--saffron-dark)' : '2px solid transparent',
                color: tab === t ? 'var(--saffron-dark)' : 'var(--ink-3)',
                fontWeight: tab === t ? 700 : 400,
                cursor: 'pointer',
                letterSpacing: 2,
                font: 'var(--text-body)',
              }}
            >
              {t === 'mine'
                ? s('我的', '我的', 'Mine')
                : t === 'shared'
                ? s('班级共享', '班級共享', 'Shared')
                : s('归档', '歸檔', 'Archived')}
            </button>
          ))}
        </div>

        {/* 搜索 */}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={s('搜索标题 / 正文', '搜尋標題 / 正文', 'Search title / body')}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border-light)', font: 'var(--text-body)' }}
        />

        {/* tag chips */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="chip"
              style={{ background: selectedTag === null ? 'var(--saffron-dark)' : 'var(--surface)', color: selectedTag === null ? '#fff' : 'var(--ink-3)', border: '1px solid var(--border-light)', cursor: 'pointer' }}
            >
              {s('全部', '全部', 'All')}
            </button>
            {allTags.map(([t, n]) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                className="chip"
                style={{ background: selectedTag === t ? 'var(--saffron-dark)' : 'var(--surface)', color: selectedTag === t ? '#fff' : 'var(--ink-3)', border: '1px solid var(--border-light)', cursor: 'pointer' }}
              >
                #{t} <span style={{ opacity: 0.6 }}>{n}</span>
              </button>
            ))}
          </div>
        )}

        {/* 列表 */}
        {isLoading ? (
          <Skeleton.List />
        ) : filtered.length === 0 ? (
          <div className="glass-card" style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📝</div>
            <p style={{ font: 'var(--text-body)', margin: 0 }}>
              {tab === 'mine'
                ? s('还没有笔记 · 点右上「＋ 新建」开始', '還沒有筆記 · 點右上「＋ 新建」開始', 'No notes yet')
                : tab === 'shared'
                ? s('班级里还没有人共享笔记', '班級裡還沒有人共享筆記', 'No shared notes')
                : s('暂无已归档笔记', '暫無已歸檔筆記', 'No archived notes')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {filtered.map((n) => (
              <Link
                key={n.id}
                to={`/notes/${n.id}`}
                className="glass-card-thick"
                style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6, textDecoration: 'none', color: 'var(--ink)' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  {n.pinnedAt && <span aria-hidden style={{ fontSize: '0.75rem' }}>📌</span>}
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title || s('（无标题）', '（無標題）', '(Untitled)')}
                  </h3>
                  {n.visibility === 'class' && (
                    <span className="chip" style={{ background: 'var(--sage-pale)', color: 'var(--sage-dark)', fontSize: '0.7rem' }}>📣 共享</span>
                  )}
                </div>
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.body.slice(0, 100)}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                  {n.tags.slice(0, 4).map((t) => (
                    <span key={t} className="chip" style={{ background: 'var(--surface)', border: '1px solid var(--border-light)' }}>#{t}</span>
                  ))}
                  <span style={{ marginLeft: 'auto' }}>
                    {tab === 'shared' && n.authorName ? `${n.authorName} · ` : ''}
                    {relTime(n.updatedAt, s)}
                  </span>
                  {tab === 'shared' && n.authorName && (
                    <button
                      type="button"
                      onClick={(e) => onReport(e, n.id)}
                      disabled={reportMut.isPending}
                      aria-label={s('举报', '舉報', 'Report')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', font: 'var(--text-caption)', padding: '0 2px' }}
                    >
                      ⚐ {s('举报', '舉報', 'Report')}
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
