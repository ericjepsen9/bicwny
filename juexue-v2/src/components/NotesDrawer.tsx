// 阅读页右侧滑出抽屉 · 本课笔记列表 + 2 个新建入口
//   - 不离开阅读页
//   - 显示本课已有笔记 mini cards · 点跳 /notes/:id
//   - 「+ 新建空白」「+ 用本课全文生成草稿」
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  visibility: 'private' | 'class';
  anchorText: string | null;
  pinnedAt: string | null;
  updatedAt: string;
}

export default function NotesDrawer({
  open,
  onClose,
  lessonId,
  lessonText,
}: {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  lessonText?: string; // 本课全文 · 用于 AI 草稿
}) {
  const { s } = useLang();
  const navigate = useNavigate();
  const [drafting, setDrafting] = useState(false);

  const data = useQuery({
    enabled: open && !!lessonId,
    queryKey: ['/api/notes', { lessonId }],
    queryFn: ({ signal }) => api.get<Note[]>(`/api/notes?lessonId=${encodeURIComponent(lessonId)}`, { signal }),
  });

  const notes = data.data ?? [];

  async function createFromFullText() {
    if (!lessonText?.trim()) {
      toast.error('本课内容为空');
      return;
    }
    setDrafting(true);
    try {
      const r = await api.post<{ result: string }>('/api/notes/llm-assist', {
        action: 'draft',
        text: lessonText.slice(0, 8000), // 太长截断
      });
      // 写入 sessionStorage 供 NoteEditPage 读
      sessionStorage.setItem('note-draft', JSON.stringify({
        lessonId,
        body: r.result,
        anchorText: null,
        anchorIndex: null,
      }));
      navigate('/notes/new?fromDraft=1');
    } catch (e) {
      toast.error('AI 失败: ' + (e as ApiError).message);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <>
      {/* 背板 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .25s',
          zIndex: 100,
        }}
      />
      {/* 抽屉 */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 90vw)',
          background: 'var(--bg)',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .28s var(--ease)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 头 */}
        <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 700, flex: 1 }}>
            📝 {s('本课笔记', '本課筆記', 'Lesson notes')} ({notes.length})
          </h3>
          <button type="button" onClick={onClose} aria-label="关闭" style={{ background: 'none', border: 'none', font: 'var(--text-body)', cursor: 'pointer', padding: '4px 8px', color: 'var(--ink-3)' }}>✕</button>
        </div>

        {/* 操作按钮 */}
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link
            to={`/notes/new?lessonId=${encodeURIComponent(lessonId)}`}
            onClick={onClose}
            className="btn btn-pill"
            style={{ padding: '8px 14px', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: '1px solid var(--saffron-light)', textDecoration: 'none', textAlign: 'center', fontWeight: 600 }}
          >
            ＋ {s('新建空白笔记', '新建空白筆記', 'New blank note')}
          </Link>
          {lessonText && (
            <button
              type="button"
              onClick={createFromFullText}
              disabled={drafting}
              className="btn btn-pill"
              style={{ padding: '8px 14px', background: 'var(--gold-pale)', color: 'var(--gold-dark)', border: '1px solid var(--saffron-light)', fontWeight: 600, cursor: 'pointer' }}
            >
              {drafting ? '生成中…' : '📑 ' + s('用本课全文生成 AI 草稿', '用本課全文生成 AI 草稿', 'AI draft from full lesson')}
            </button>
          )}
        </div>

        {/* 笔记列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-3) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.isLoading ? (
            <p style={{ color: 'var(--ink-4)', textAlign: 'center', padding: 'var(--sp-4)' }}>加载中…</p>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-5) 0', color: 'var(--ink-3)', font: 'var(--text-caption)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📝</div>
              {s('本课还没有笔记', '本課還沒有筆記', 'No notes yet')}
            </div>
          ) : (
            notes.map((n) => (
              <Link
                key={n.id}
                to={`/notes/${n.id}`}
                onClick={onClose}
                className="glass-card"
                style={{ padding: 'var(--sp-2) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none', color: 'var(--ink)' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  {n.pinnedAt && <span aria-hidden style={{ fontSize: '0.7rem' }}>📌</span>}
                  <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title || s('（无标题）', '（無標題）', '(Untitled)')}
                  </span>
                  {n.visibility === 'class' && (
                    <span className="chip" style={{ background: 'var(--sage-pale)', color: 'var(--sage-dark)', fontSize: '0.65rem' }}>共享</span>
                  )}
                </div>
                {n.anchorText && (
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', fontSize: '0.7rem', fontStyle: 'italic', borderLeft: '2px solid var(--saffron-light)', paddingLeft: 6 }}>
                    {n.anchorText.length > 50 ? n.anchorText.slice(0, 50) + '…' : n.anchorText}
                  </div>
                )}
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.body.slice(0, 80)}
                </p>
              </Link>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
