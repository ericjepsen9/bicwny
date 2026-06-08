// AdminNoteReportsPage · /admin/note-reports + /coach/note-reports
//   班级共享笔记举报处理（审计 5.7）· 同组件挂 admin / coach 两套路由
//   后端 GET /api/notes/reports 按角色限定范围（admin 全部 / coach 本班）
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { type NoteReport, useNoteReports } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function AdminNoteReportsPage() {
  const { s } = useLang();
  const list = useNoteReports();

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('笔记举报', '筆記舉報', 'Note reports')}</h1>
          <p className="page-sub">{s('班级共享笔记的不当内容举报', '班級共享筆記的不當內容舉報', 'Reported shared notes')}</p>
        </div>
      </div>

      {list.isLoading ? (
        <Skeleton.Card />
      ) : !list.data || list.data.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
          🌿 {s('无待处理举报', '無待處理舉報', 'No pending reports')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {list.data.map((r) => <NoteReportCard key={r.id} r={r} />)}
        </div>
      )}
    </>
  );
}

function NoteReportCard({ r }: { r: NoteReport }) {
  const { s } = useLang();
  const qc = useQueryClient();

  const act = useMutation({
    mutationFn: (action: 'takedown' | 'dismiss') =>
      api.post(`/api/notes/reports/${encodeURIComponent(r.id)}/action`, { action }),
    onSuccess: (_, action) => {
      qc.invalidateQueries({ queryKey: ['/api/notes/reports'] });
      qc.invalidateQueries({ queryKey: ['/api/notes/shared'] });
      toast.ok(action === 'takedown' ? s('已下架', '已下架', 'Taken down') : s('已驳回', '已駁回', 'Dismissed'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  async function onTakedown() {
    const ok = await confirmAsync({
      title: s('下架这条共享笔记？', '下架這條共享筆記？', 'Take down this note?'),
      body: s('笔记将转回私密 · 移出班级共享流 · 作者仍保留', '筆記將轉回私密 · 移出班級共享流 · 作者仍保留', 'The note becomes private (removed from class feed); author keeps it.'),
      danger: true,
    });
    if (!ok) return;
    act.mutate('takedown');
  }

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--crimson-light)', color: 'var(--crimson)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
          ⚐ {s('举报', '舉報', 'Report')}
        </span>
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
          {new Date(r.createdAt).toLocaleString()}
          {r.reporterName ? ` · ${s('举报人', '舉報人', 'By')} ${r.reporterName}` : ''}
        </span>
      </div>

      <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--r)', background: 'var(--glass)', marginBottom: 'var(--sp-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>
          <span>{s('被举报笔记', '被舉報筆記', 'Note')}</span>
          {r.authorName && <span>· {s('作者', '作者', 'Author')} {r.authorName}</span>}
        </div>
        <div style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }}>
          {r.noteTitle || s('（无标题）', '（無標題）', '(Untitled)')}
        </div>
        <div style={{ font: 'var(--text-body)', color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>
          {r.noteBody.slice(0, 500)}
        </div>
      </div>

      {r.reason && (
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--r)', background: 'rgba(192,57,43,.08)', borderLeft: '3px solid var(--crimson)', marginBottom: 'var(--sp-3)' }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--crimson)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>
            {s('举报理由', '舉報理由', 'Reason')}
          </div>
          <div style={{ font: 'var(--text-body)', color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.reason}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
        <button
          type="button"
          disabled={act.isPending}
          onClick={onTakedown}
          className="btn btn-pill"
          style={{ flex: 1, minWidth: 120, padding: 10, background: 'var(--crimson)', color: '#fff', border: 'none', justifyContent: 'center' }}
        >
          {s('下架', '下架', 'Take down')}
        </button>
        <button
          type="button"
          disabled={act.isPending}
          onClick={() => act.mutate('dismiss')}
          className="btn btn-pill"
          style={{ flex: 1, minWidth: 120, padding: 10, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}
        >
          {s('驳回', '駁回', 'Dismiss')}
        </button>
      </div>
    </div>
  );
}
