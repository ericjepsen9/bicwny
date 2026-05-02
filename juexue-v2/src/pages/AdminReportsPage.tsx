// AdminReportsPage · /admin/reports
//   待处理用户举报 · reason 过滤 + 内联处理（accept_hide / accept_keep / reject）
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { type ReportReason, useAdminReports } from '@/lib/queries';
import { toast } from '@/lib/toast';

const REASON_LABELS: Record<ReportReason | 'all', [string, string, string]> = {
  all:            ['全部', '全部', 'All'],
  wrong_answer:   ['答案错', '答案錯', 'Wrong answer'],
  sensitive:      ['敏感',  '敏感',  'Sensitive'],
  doctrine_error: ['义理',  '義理',  'Doctrine'],
  typo:           ['错别字', '錯別字', 'Typo'],
  other:          ['其他',  '其他',  'Other'],
};

export default function AdminReportsPage() {
  const { s } = useLang();
  const [reason, setReason] = useState<ReportReason | 'all'>('all');
  const list = useAdminReports({ reason: reason === 'all' ? undefined : reason });

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('举报处理', '舉報處理', 'Reports')}</h1>
          <p className="page-sub">{s('用户对题目的反馈', '用戶對題目的反饋', 'User-submitted question complaints')}</p>
        </div>
      </div>

      <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {(Object.keys(REASON_LABELS) as (ReportReason | 'all')[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setReason(k)}
            className="btn btn-pill"
            style={{
              padding: '5px 12px', font: 'var(--text-caption)', fontWeight: 600,
              background: reason === k ? 'var(--saffron-pale)' : 'transparent',
              color: reason === k ? 'var(--saffron-dark)' : 'var(--ink-3)',
              border: '1px solid ' + (reason === k ? 'var(--saffron-light)' : 'transparent'),
            }}
          >
            {s(REASON_LABELS[k][0], REASON_LABELS[k][1], REASON_LABELS[k][2])}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
          {(list.data ?? []).length} 条
        </span>
      </div>

      {list.isLoading ? (
        <Skeleton.Card />
      ) : !list.data || list.data.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
          🌿 {s('无待处理举报', '無待處理舉報', 'No pending reports')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {list.data.map((r) => <ReportCard key={r.id} r={r} />)}
        </div>
      )}
    </>
  );
}

function ReportCard({ r }: { r: { id: string; questionId: string; reason: ReportReason; details: string | null; reportedByUserId: string; createdAt: string; question?: { id: string; questionText: string } } }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const handle = useMutation({
    mutationFn: (decision: 'accept' | 'accept_hide' | 'accept_keep' | 'reject') =>
      api.post(`/api/admin/reports/${encodeURIComponent(r.id)}/handle`, { decision, note: note.trim() || undefined }),
    onSuccess: (_, decision) => {
      qc.invalidateQueries({ queryKey: ['/api/admin/reports/pending'] });
      toast.ok(decision.startsWith('accept') ? s('已采纳', '已採納', 'Accepted') : s('已驳回', '已駁回', 'Rejected'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 'var(--sp-3)' }}>
        <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--crimson-light)', color: 'var(--crimson)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
          {s(REASON_LABELS[r.reason][0], REASON_LABELS[r.reason][1], REASON_LABELS[r.reason][2])}
        </span>
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
          {new Date(r.createdAt).toLocaleString()} · {s('举报人', '舉報人', 'By')} {r.reportedByUserId.slice(0, 8)}
        </span>
      </div>

      {r.question && (
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--r)', background: 'var(--glass)', marginBottom: 'var(--sp-3)' }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>
            {s('被举报题目', '被舉報題目', 'Question')} <code>{r.question.id.slice(0, 8)}</code>
          </div>
          <div style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', lineHeight: 1.7, letterSpacing: 1.2 }}>
            {r.question.questionText}
          </div>
        </div>
      )}

      {r.details && (
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--r)', background: 'rgba(192,57,43,.08)', borderLeft: '3px solid var(--crimson)', marginBottom: 'var(--sp-3)' }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--crimson)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>
            {s('举报说明', '舉報說明', 'Reporter says')}
          </div>
          <div style={{ font: 'var(--text-body)', color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.details}</div>
        </div>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={s('处理备注（可选）', '處理備註（可選）', 'Resolution note (optional)')}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border)', background: 'var(--bg-input)', font: 'var(--text-caption)', outline: 'none', marginBottom: 'var(--sp-3)' }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
        <button
          type="button"
          disabled={handle.isPending}
          onClick={() => handle.mutate('accept_hide')}
          className="btn btn-pill"
          style={{ flex: 1, minWidth: 120, padding: 10, background: 'var(--crimson)', color: '#fff', border: 'none', justifyContent: 'center' }}
        >
          {s('采纳并隐藏', '採納並隱藏', 'Accept · hide')}
        </button>
        <button
          type="button"
          disabled={handle.isPending}
          onClick={() => handle.mutate('accept_keep')}
          className="btn btn-pill"
          style={{ flex: 1, minWidth: 120, padding: 10, background: 'var(--saffron)', color: '#fff', border: 'none', justifyContent: 'center' }}
        >
          {s('采纳保留', '採納保留', 'Accept · keep')}
        </button>
        <button
          type="button"
          disabled={handle.isPending}
          onClick={() => handle.mutate('reject')}
          className="btn btn-pill"
          style={{ flex: 1, minWidth: 120, padding: 10, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}
        >
          {s('驳回', '駁回', 'Reject')}
        </button>
      </div>
    </div>
  );
}
