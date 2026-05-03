// AdminReviewPage · /admin/review
//   待审题目队列 + 详情 drawer（通过 / 驳回 + 理由）
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { type AdminPendingQuestion, useAdminPendingQuestions, useCourses } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function AdminReviewPage() {
  const { s } = useLang();
  const [sp, setSp] = useSearchParams();
  const courses = useCourses();
  const [courseId, setCourseId] = useState('');
  const [search, setSearch] = useState('');

  const list = useAdminPendingQuestions({ courseId: courseId || undefined });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? [])
      .filter((it) => !q || it.questionText.toLowerCase().includes(q))
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  }, [list.data, search]);

  const oldestDays = filtered.length > 0
    ? Math.floor((Date.now() - +new Date(filtered[0]!.createdAt)) / (24 * 3600_000))
    : 0;
  const courseCount = new Set(filtered.map((q) => q.courseId)).size;
  const submitterCount = new Set(filtered.map((q) => q.createdByUserId)).size;

  const openId = sp.get('id');
  const openQ = filtered.find((q) => q.id === openId);

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('题目审核', '題目審核', 'Review')}</h1>
          <p className="page-sub">{s('辅导员提交的待审题目', '輔導員提交的待審題目', 'Coach-submitted questions')}</p>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
        <Kpi loading={list.isLoading} value={String(filtered.length)} label={s('待审', '待審', 'Pending')} color="var(--gold-dark)" />
        <Kpi loading={list.isLoading} value={oldestDays + 'd'} label={s('最久等待', '最久等待', 'Oldest wait')} />
        <Kpi loading={list.isLoading} value={String(courseCount)} label={s('涉及法本', '涉及法本', 'Courses')} />
        <Kpi loading={list.isLoading} value={String(submitterCount)} label={s('提交人', '提交人', 'Coaches')} />
      </div>

      <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ padding: '6px 10px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', font: 'var(--text-caption)' }}>
          <option value="">{s('所有法本', '所有法本', 'All courses')}</option>
          {(courses.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.coverEmoji} {c.title}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder={s('搜索题干…', '搜尋題幹…', 'Search…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '6px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border)', background: 'var(--bg-input)', font: 'var(--text-caption)', outline: 'none' }}
        />
      </div>

      {list.isLoading ? (
        <Skeleton.Card />
      ) : filtered.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
          🌿 {s('全部已审 · 暂无待办', '全部已審 · 暫無待辦', 'Inbox zero')}
        </div>
      ) : (
        <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--glass)', textAlign: 'left' }}>
              <Th>{s('题干', '題幹', 'Question')}</Th>
              <Th>{s('类型', '類型', 'Type')}</Th>
              <Th>{s('提交人', '提交人', 'Submitter')}</Th>
              <Th>{s('等待', '等待', 'Wait')}</Th>
            </tr></thead>
            <tbody>
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setSp({ id: q.id })}
                  style={{ cursor: 'pointer', borderTop: '1px solid var(--border-light)', background: q.id === openId ? 'var(--saffron-pale)' : 'transparent' }}
                >
                  <Td>
                    <div style={{ font: 'var(--text-body)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                      {q.questionText}
                    </div>
                    {q.source && <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 2 }}>{q.source}</div>}
                  </Td>
                  <Td>
                    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--glass-thick)', border: '1px solid var(--glass-border)', color: 'var(--ink-2)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>{q.type}</span>
                  </Td>
                  <Td>
                    <code style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{q.createdByUserId.slice(0, 8)}</code>
                  </Td>
                  <Td>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{relTime(q.createdAt)}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openQ && <ReviewDrawer q={openQ} onDone={() => setSp({})} />}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: 'var(--sp-3) var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>{children}</td>;
}

function Kpi({ value, label, color, loading }: { value: string; label: string; color?: string; loading?: boolean }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      {loading ? <Skeleton.Title style={{ width: 60 }} /> : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', color: color ?? 'var(--ink)', letterSpacing: 1 }}>{value}</div>
      )}
    </div>
  );
}

function ReviewDrawer({ q, onDone }: { q: AdminPendingQuestion; onDone: () => void }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');

  const review = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => api.post(
      `/api/admin/questions/${encodeURIComponent(q.id)}/review`,
      decision === 'approve' ? { decision } : { decision, reason: reason.trim() },
    ),
    onSuccess: (_, decision) => {
      qc.invalidateQueries({ queryKey: ['/api/admin/questions/pending'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/platform-stats'] });
      toast.ok(decision === 'approve' ? s('已通过', '已通過', 'Approved') : s('已驳回', '已駁回', 'Rejected'));
      onDone();
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      <div onClick={onDone} style={{ position: 'fixed', inset: 0, background: 'rgba(43,34,24,.35)', zIndex: 200 }} />
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(620px, 100vw)',
          background: 'var(--bg-scene)',
          borderLeft: '1px solid var(--glass-border)',
          boxShadow: '-12px 0 32px rgba(43,34,24,.18)',
          zIndex: 201, overflowY: 'auto', padding: 'var(--sp-5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)', letterSpacing: 2 }}>
            {s('审核', '審核', 'Review')}
          </h2>
          <button type="button" onClick={onDone} aria-label={s('关闭', '關閉', 'Close')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '1.4rem', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-3)' }}>
          <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--glass-thick)', color: 'var(--ink-2)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>{q.type}</span>
          <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--gold-pale)', color: 'var(--gold-dark)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>{s('待审', '待審', 'Pending')}</span>
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>· {q.visibility} · 难度 {q.difficulty}</span>
        </div>

        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
          {q.source && (
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 'var(--sp-2)' }}>{q.source}</div>
          )}
          <div style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', letterSpacing: 1.2, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {q.questionText}
          </div>
        </div>

        {q.correctText && (
          <Block label={s('正确答案 / 解析', '正確答案 / 解析', 'Correct')} accent="sage">{q.correctText}</Block>
        )}
        {q.wrongText && (
          <Block label={s('易错点', '易錯點', 'Common mistakes')} accent="crimson">{q.wrongText}</Block>
        )}

        {Object.keys(q.payload || {}).length > 0 && (
          <details className="glass-card-thick" style={{ padding: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
            <summary style={{ cursor: 'pointer', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
              {s('payload (raw)', 'payload (raw)', 'payload (raw)')}
            </summary>
            <pre style={{ marginTop: 'var(--sp-2)', font: 'var(--text-caption)', color: 'var(--ink-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--glass)', padding: 'var(--sp-3)', borderRadius: 'var(--r-sm)' }}>
              {JSON.stringify(q.payload, null, 2)}
            </pre>
          </details>
        )}

        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, marginBottom: 'var(--sp-4)' }}>
          {s('提交人', '提交人', 'By')} {q.createdByUserId.slice(0, 8)} · {relTime(q.createdAt)}
        </div>

        {rejectMode ? (
          <>
            <h3 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-2)' }}>
              {s('驳回理由（≥ 5 字）', '駁回理由（≥ 5 字）', 'Rejection reason (≥ 5 chars)')}
            </h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)', font: 'var(--text-body)', outline: 'none', resize: 'vertical', marginBottom: 'var(--sp-3)' }}
            />
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button type="button" onClick={() => setRejectMode(false)} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
                {s('取消', '取消', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={review.isPending || reason.trim().length < 5}
                onClick={() => review.mutate('reject')}
                className="btn btn-pill"
                style={{ flex: 1, padding: 12, background: 'var(--crimson)', color: '#fff', border: 'none', justifyContent: 'center' }}
              >
                {review.isPending ? '…' : s('确认驳回', '確認駁回', 'Confirm reject')}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => setRejectMode(true)}
              className="btn btn-pill"
              style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--crimson)', border: '1px solid rgba(192,57,43,.3)', justifyContent: 'center' }}
            >
              {s('驳回', '駁回', 'Reject')}
            </button>
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate('approve')}
              className="btn btn-primary btn-pill"
              style={{ flex: 1, padding: 12, justifyContent: 'center' }}
            >
              {review.isPending ? '…' : s('通过', '通過', 'Approve')}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function Block({ label, accent, children }: { label: string; accent: 'sage' | 'crimson'; children: React.ReactNode }) {
  return (
    <>
      <div style={{ font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 2, color: accent === 'sage' ? 'var(--sage-dark)' : 'var(--crimson)', marginBottom: 'var(--sp-2)' }}>
        {label}
      </div>
      <div style={{
        padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--r)',
        background: accent === 'sage' ? 'rgba(125,154,108,.12)' : 'rgba(192,57,43,.08)',
        borderLeft: '3px solid ' + (accent === 'sage' ? 'var(--sage-dark)' : 'var(--crimson)'),
        color: 'var(--ink)', font: 'var(--text-body)', lineHeight: 1.7,
        whiteSpace: 'pre-wrap', marginBottom: 'var(--sp-3)',
      }}>
        {children}
      </div>
    </>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + '分前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + '时前';
  const d = Math.floor(h / 24);
  if (d < 30) return d + '天前';
  return new Date(iso).toLocaleDateString();
}
