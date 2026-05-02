// CoachQuestionsPage · /coach/questions
//   列表 + 过滤（status/type/search）+ 详情 drawer + 文本编辑 + 删除
//   创建 / LLM 生成 / 批量导入：暂跳老 prototypes 兜底（Phase 11 完整迁移）
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import {
  type CoachQuestion,
  type QuestionType,
  useCoachQuestion,
  useCoachQuestions,
} from '@/lib/queries';
import { toast } from '@/lib/toast';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_LABELS: Record<StatusFilter, [string, string, string]> = {
  all:      ['全部', '全部', 'All'],
  pending:  ['待审', '待審', 'Pending'],
  approved: ['已通过', '已通過', 'Approved'],
  rejected: ['已驳回', '已駁回', 'Rejected'],
};

const TYPE_OPTS: { v: '' | QuestionType; label: string }[] = [
  { v: '',         label: '所有题型' },
  { v: 'single',   label: '单选' },
  { v: 'multi',    label: '多选' },
  { v: 'fill',     label: '填空' },
  { v: 'open',     label: '问答' },
  { v: 'sort',     label: '排序' },
  { v: 'match',    label: '匹配' },
  { v: 'flip',     label: '速记卡' },
];

export default function CoachQuestionsPage() {
  const { s } = useLang();
  const [sp, setSp] = useSearchParams();
  const list = useCoachQuestions(200);
  const qc = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [type, setType] = useState<'' | QuestionType>('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter((it) => {
      if (status !== 'all' && it.reviewStatus !== status) return false;
      if (type && it.type !== type) return false;
      if (q && !it.questionText.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [list.data, status, type, search]);

  const openId = sp.get('id');

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('题库', '題庫', 'Questions')}</h1>
          <p className="page-sub">{s('我创建的题目 · 共 ' + (list.data?.length ?? 0), '我創建的題目 · 共 ' + (list.data?.length ?? 0), 'My questions · ' + (list.data?.length ?? 0))}</p>
        </div>
        <div className="top-actions">
          <a
            href="/prototypes/desktop/coach-questions.html"
            className="btn btn-primary btn-pill"
            style={{ padding: '8px 16px' }}
            title={s('新建/LLM 生成/批量导入仍走老界面（Phase 11 完整迁移）', '新建/LLM 生成/批量導入仍走老界面（Phase 11 完整遷移）', 'Create/LLM/Batch via legacy UI for now (Phase 11)')}
          >
            + {s('新建 / 生成', '新建 / 生成', 'New / LLM')}
          </a>
        </div>
      </div>

      {/* 过滤栏 */}
      <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(k)}
              className="btn btn-pill"
              style={{
                padding: '5px 12px',
                font: 'var(--text-caption)',
                fontWeight: 600,
                background: status === k ? 'var(--saffron-pale)' : 'transparent',
                color: status === k ? 'var(--saffron-dark)' : 'var(--ink-3)',
                border: '1px solid ' + (status === k ? 'var(--saffron-light)' : 'transparent'),
              }}
            >
              {s(STATUS_LABELS[k][0], STATUS_LABELS[k][1], STATUS_LABELS[k][2])}
            </button>
          ))}
        </div>

        <select
          value={type}
          onChange={(e) => setType(e.target.value as '' | QuestionType)}
          style={{ padding: '6px 10px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', font: 'var(--text-caption)' }}
        >
          {TYPE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>

        <input
          type="search"
          placeholder={s('搜索题干…', '搜尋題幹…', 'Search…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160, padding: '6px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border)', background: 'var(--bg-input)', font: 'var(--text-caption)', outline: 'none' }}
        />

        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
          {filtered.length} 条
        </span>
      </div>

      {/* 列表 */}
      {list.isLoading ? (
        <Skeleton.Card />
      ) : filtered.length === 0 ? (
        <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
          {s('没有匹配的题目', '沒有匹配的題目', 'No matches')}
        </div>
      ) : (
        <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--glass)', textAlign: 'left' }}>
                <Th>{s('类型', '類型', 'Type')}</Th>
                <Th>{s('题干', '題幹', 'Question')}</Th>
                <Th>{s('状态', '狀態', 'Status')}</Th>
                <Th>{s('可见', '可見', 'Visibility')}</Th>
                <Th>{s('更新', '更新', 'Updated')}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setSp({ id: q.id })}
                  style={{ cursor: 'pointer', borderTop: '1px solid var(--border-light)', background: q.id === openId ? 'var(--saffron-pale)' : 'transparent' }}
                >
                  <Td><TypeBadge t={q.type} /></Td>
                  <Td>
                    <div style={{ font: 'var(--text-body)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                      {q.questionText}
                    </div>
                  </Td>
                  <Td><StatusBadge st={q.reviewStatus} /></Td>
                  <Td>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                      {q.visibility === 'public' ? s('公共', '公共', 'Public') : s('班级', '班級', 'Class')}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                      {new Date(q.updatedAt).toLocaleDateString()}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <QuestionDrawer
          id={openId}
          onClose={() => setSp({})}
          onChanged={() => qc.invalidateQueries({ queryKey: ['/api/coach/questions'] })}
        />
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: 'var(--sp-3) var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700 }}>
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>{children}</td>;
}

function TypeBadge({ t }: { t: QuestionType }) {
  const labels: Partial<Record<QuestionType, string>> = {
    single: '单选', multi: '多选', fill: '填空', open: '问答',
    sort: '排序', match: '匹配', flip: '速记卡',
    image: '图识', listen: '听颂', flow: '流程', guided: '引导', scenario: '情境',
  };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 'var(--r-pill)',
      background: 'var(--glass-thick)', border: '1px solid var(--glass-border)',
      color: 'var(--ink-2)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1,
    }}>
      {labels[t] ?? t}
    </span>
  );
}
function StatusBadge({ st }: { st: 'pending' | 'approved' | 'rejected' }) {
  const map = {
    pending:  { bg: 'var(--gold-pale)', color: 'var(--gold-dark)', label: '待审' },
    approved: { bg: 'rgba(125,154,108,.15)', color: 'var(--sage-dark)', label: '已通过' },
    rejected: { bg: 'var(--crimson-light)', color: 'var(--crimson)', label: '已驳回' },
  } as const;
  const m = map[st];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: m.bg, color: m.color, font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
      {m.label}
    </span>
  );
}

function QuestionDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { s } = useLang();
  const detail = useCoachQuestion(id);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(43,34,24,.35)', zIndex: 200 }} />
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(620px, 100vw)',
          background: 'var(--bg-scene)',
          borderLeft: '1px solid var(--glass-border)',
          boxShadow: '-12px 0 32px rgba(43,34,24,.18)',
          zIndex: 201,
          overflowY: 'auto',
          padding: 'var(--sp-5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)', letterSpacing: 2 }}>
            {s('题目详情', '題目詳情', 'Question')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s('关闭', '關閉', 'Close')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '1.4rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {detail.isLoading ? (
          <Skeleton.Card />
        ) : !detail.data ? (
          <p style={{ color: 'var(--crimson)' }}>{(detail.error as ApiError | undefined)?.message ?? '加载失败'}</p>
        ) : editing ? (
          <EditForm
            q={detail.data}
            onCancel={() => setEditing(false)}
            onSaved={() => { setEditing(false); onChanged(); }}
          />
        ) : (
          <ViewQuestion
            q={detail.data}
            onEdit={() => setEditing(true)}
            onDeleted={() => { onChanged(); onClose(); }}
          />
        )}
      </aside>
    </>
  );
}

function ViewQuestion({ q, onEdit, onDeleted }: { q: CoachQuestion; onEdit: () => void; onDeleted: () => void }) {
  const { s } = useLang();
  const del = useMutation({
    mutationFn: () => api.del(`/api/coach/questions/${encodeURIComponent(q.id)}`),
    onSuccess: () => {
      toast.ok(s('已删除', '已刪除', 'Deleted'));
      onDeleted();
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-3)' }}>
        <TypeBadge t={q.type} />
        <StatusBadge st={q.reviewStatus} />
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
          {q.visibility === 'public' ? s('公共', '公共', 'Public') : s('班级', '班級', 'Class')}
        </span>
      </div>

      <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 'var(--sp-2)' }}>
          {q.source || '—'} · {s('难度', '難度', 'Diff')} {q.difficulty}
        </div>
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

      {q.tags && q.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--sp-3)' }}>
          {q.tags.map((t) => (
            <span key={t} style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--glass-thick)', color: 'var(--ink-3)', font: 'var(--text-caption)', letterSpacing: 1 }}>
              # {t}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
        <button
          type="button"
          onClick={onEdit}
          className="btn btn-primary btn-pill"
          style={{ flex: 1, padding: 12, justifyContent: 'center' }}
        >
          {s('编辑', '編輯', 'Edit')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm(s('删除这题？', '刪除這題？', 'Delete?'))) return;
            del.mutate();
          }}
          disabled={del.isPending || q.hasAnswers}
          className="btn btn-pill"
          style={{
            flex: 1, padding: 12,
            background: 'transparent',
            color: 'var(--crimson)',
            border: '1px solid rgba(192,57,43,.3)',
            justifyContent: 'center',
          }}
          title={q.hasAnswers ? s('已有学员作答，不能删', '已有學員作答，不能刪', 'Cannot delete: has answers') : ''}
        >
          {del.isPending ? '…' : s('删除', '刪除', 'Delete')}
        </button>
      </div>
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
        padding: 'var(--sp-3) var(--sp-4)',
        borderRadius: 'var(--r)',
        background: accent === 'sage' ? 'rgba(125,154,108,.12)' : 'rgba(192,57,43,.08)',
        borderLeft: '3px solid ' + (accent === 'sage' ? 'var(--sage-dark)' : 'var(--crimson)'),
        color: 'var(--ink)',
        font: 'var(--text-body)',
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
        marginBottom: 'var(--sp-3)',
      }}>
        {children}
      </div>
    </>
  );
}

function EditForm({ q, onCancel, onSaved }: { q: CoachQuestion; onCancel: () => void; onSaved: () => void }) {
  const { s } = useLang();
  const [questionText, setQText] = useState(q.questionText);
  const [correctText, setCText] = useState(q.correctText);
  const [wrongText, setWText] = useState(q.wrongText);
  const [source, setSource] = useState(q.source);
  const [difficulty, setDiff] = useState(q.difficulty);
  const [tags, setTags] = useState((q.tags ?? []).join(', '));
  const [err, setErr] = useState('');

  const save = useMutation({
    mutationFn: () => api.patch(`/api/coach/questions/${encodeURIComponent(q.id)}`, {
      questionText: questionText.trim(),
      correctText: correctText.trim(),
      wrongText: wrongText.trim(),
      source: source.trim(),
      difficulty,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      toast.ok(s('已保存 · 待重新审核', '已儲存 · 待重新審核', 'Saved · pending review'));
      onSaved();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setErr(''); save.mutate(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
      <Field label={s('题干', '題幹', 'Question text')} value={questionText} onChange={setQText} multiline rows={4} required />
      <Field label={s('正确答案 / 解析', '正確答案 / 解析', 'Correct')} value={correctText} onChange={setCText} multiline rows={4} />
      <Field label={s('易错点', '易錯點', 'Wrong notes')} value={wrongText} onChange={setWText} multiline rows={3} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-3)' }}>
        <Field label={s('出处', '出處', 'Source')} value={source} onChange={setSource} />
        <Field label={s('难度 (1-5)', '難度 (1-5)', 'Difficulty')} value={String(difficulty)} onChange={(v) => setDiff(Math.max(1, Math.min(5, Number(v) || 1)))} type="number" />
      </div>
      <Field label={s('标签（逗号分隔）', '標籤（逗號分隔）', 'Tags (comma)')} value={tags} onChange={setTags} />

      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-pill"
          style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}
        >
          {s('取消', '取消', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="btn btn-primary btn-pill"
          style={{ flex: 1, padding: 12, justifyContent: 'center' }}
        >
          {save.isPending ? '…' : s('保存', '保存', 'Save')}
        </button>
      </div>
    </form>
  );
}

function Field({
  label, value, onChange, type = 'text', multiline, rows = 3, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--r)',
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--ink)',
    font: 'var(--text-body)',
    outline: 'none',
    resize: multiline ? 'vertical' : undefined,
  };
  return (
    <div>
      <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
        {label}
      </label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required} rows={rows} style={baseStyle} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} style={baseStyle} />
      )}
    </div>
  );
}
