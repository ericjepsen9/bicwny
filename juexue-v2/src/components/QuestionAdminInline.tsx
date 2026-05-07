// 法本管理 · 课时下题目内联管理
//   - LessonQuestionsSlot · 课时行下的 📝 副行（计数 + [列表] [+ 添加]）
//   - QuestionListDialog · 题目列表 + 行内 [编辑] [删除]
//   - QuestionEditDialog · 5 种常用题型的精简表单（single / multi / fill / sort / open）
//     · 复杂题型（match / flip / image / listen / flow / guided / scenario）提示去 coach 题库
//
// 设计原则：admin 走 coach API（角色已放权 · 详见 docs/MEDITATION_V1.md 后续 chapter）
//   POST   /api/coach/questions
//   PATCH  /api/coach/questions/:id
//   DELETE /api/coach/questions/:id
//   GET    /api/admin/lessons/:id/questions
//   GET    /api/admin/questions/:id
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Dialog from './Dialog';
import Field from './Field';
import QuestionRenderer from './quiz';
import Skeleton from './Skeleton';
import { confirmAsync } from './ConfirmDialog';
import { displayQuestionText } from '@/lib/questionText';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import {
  type AdminLessonQuestion,
  type QuestionType,
  useAdminLessonQuestions,
  useAdminQuestionDetail,
} from '@/lib/queries';
import { toast } from '@/lib/toast';

const SIMPLE_TYPES: QuestionType[] = ['single', 'multi', 'fill', 'sort', 'open', 'match', 'flip'];

// ── 课时行下的副行 ──────────────────────────────────────────
export function LessonQuestionsSlot({ courseId, chapterId, lessonId }: {
  courseId: string;
  chapterId: string;
  lessonId: string;
}) {
  const { s } = useLang();
  const list = useAdminLessonQuestions(lessonId);
  const [listOpen, setListOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const questions = list.data ?? [];
  const total = questions.length;
  const pending = questions.filter((q) => q.reviewStatus === 'pending').length;

  return (
    <div style={{ borderTop: '1px solid var(--border-light)', padding: 'var(--sp-2) var(--sp-3)', paddingLeft: 'calc(var(--sp-3) + 32px)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
      {list.isLoading ? (
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>📝 …</span>
      ) : total === 0 ? (
        <>
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>📝 {s('暂无题目', '暫無題目', 'No questions')}</span>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)', letterSpacing: 1 }}
          >
            + {s('添加题目', '添加題目', 'Add question')}
          </button>
        </>
      ) : (
        <>
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-2)' }}>📝 {total} {s('题', '題', 'q')}</span>
          {pending > 0 && (
            <span style={{
              padding: '1px 6px', borderRadius: 'var(--r-pill)',
              background: 'rgba(212,151,49,.15)', color: 'var(--saffron-dark)',
              font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1,
            }}>
              {pending} {s('待审', '待審', 'pending')}
            </span>
          )}
          <button
            type="button"
            onClick={() => setListOpen(true)}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', font: 'var(--text-caption)' }}
          >
            {s('管理', '管理', 'Manage')}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            style={{ background: 'transparent', border: 'none', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)' }}
          >
            + {s('添加', '添加', 'Add')}
          </button>
        </>
      )}

      <QuestionListDialog
        open={listOpen}
        onClose={() => setListOpen(false)}
        questions={questions}
        lessonId={lessonId}
      />
      <QuestionEditDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        lessonId={lessonId}
        chapterId={chapterId}
        courseId={courseId}
      />
    </div>
  );
}

// ── 题目列表 Dialog ──────────────────────────────────────────
function QuestionListDialog({ open, onClose, questions, lessonId }: {
  open: boolean;
  onClose: () => void;
  questions: AdminLessonQuestion[];
  lessonId: string;
}) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/coach/questions/${encodeURIComponent(id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/lessons', lessonId, 'questions'] });
      toast.ok(s('已删除', '已刪除', 'Deleted'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} title={s('题目列表', '題目列表', 'Questions')} variant="centered">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
          {questions.length === 0 ? (
            <p style={{ color: 'var(--ink-4)', textAlign: 'center', padding: 'var(--sp-4)' }}>
              {s('（空）', '（空）', '(empty)')}
            </p>
          ) : (
            questions.map((q) => (
              <QuestionRow
                key={q.id}
                q={q}
                onEdit={() => setEditingId(q.id)}
                onDelete={async () => {
                  if (!(await confirmAsync({ title: s('删除此题？（如果有学员答过会失败）', '刪除此題？', 'Delete? (fails if any user answered)') }))) return;
                  del.mutate(q.id);
                }}
                deleting={del.isPending}
              />
            ))
          )}
        </div>
      </Dialog>

      {editingId && (
        <QuestionEditDialog
          open
          onClose={() => setEditingId(null)}
          mode="edit"
          questionId={editingId}
          lessonId={lessonId}
          chapterId=""
          courseId=""
        />
      )}
    </>
  );
}

// 题目列表行 · 默认折叠 · 点击展开看完整题目内容（用学员答题组件 confirmed=true 渲染）
// detail 懒加载 · 用 useAdminQuestionDetail（首次展开才请求 · 不一次拉全所有题 payload）
function QuestionRow({
  q,
  onEdit,
  onDelete,
  deleting,
}: {
  q: AdminLessonQuestion;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { s } = useLang();
  const [open, setOpen] = useState(false);
  const detail = useAdminQuestionDetail(open ? q.id : null);

  return (
    <div style={{ background: 'var(--glass)', borderRadius: 'var(--r-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? s('收起', '收起', 'Collapse') : s('展开', '展開', 'Expand')}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', font: 'var(--text-caption)', minWidth: 14 }}
        >
          {open ? '▾' : '▸'}
        </button>
        <TypePill type={q.type} />
        <ReviewPill status={q.reviewStatus} />
        <span
          onClick={() => setOpen((v) => !v)}
          style={{ flex: 1, color: 'var(--ink)', font: 'var(--text-caption)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}
        >
          {open && detail.data ? displayQuestionText(detail.data, s) : q.questionText}
        </span>
        <button
          type="button"
          onClick={onEdit}
          style={{ background: 'transparent', border: 'none', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)' }}
        >
          {s('编辑', '編輯', 'Edit')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          style={{ background: 'transparent', border: 'none', color: 'var(--crimson)', cursor: 'pointer', font: 'var(--text-caption)' }}
        >
          {s('删除', '刪除', 'Delete')}
        </button>
      </div>

      {open && (
        <div style={{ padding: 'var(--sp-2) var(--sp-3) var(--sp-3) 30px', borderTop: '1px solid var(--border-light)' }}>
          {detail.isLoading ? (
            <Skeleton.Card />
          ) : detail.data ? (
            <QuestionRenderer question={detail.data} value={null} onChange={() => {}} confirmed={true} />
          ) : (
            <p style={{ font: 'var(--text-caption)', color: 'var(--crimson)' }}>
              {s('加载失败', '載入失敗', 'Load failed')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TypePill({ type }: { type: QuestionType }) {
  const labels: Record<QuestionType, string> = {
    single: '单选', multi: '多选', fill: '填空', open: '问答',
    sort: '排序', match: '匹配', flip: '速记',
    image: '图片', listen: '听力', flow: '流程', guided: '引导', scenario: '情境',
  };
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 'var(--r-pill)',
      background: 'var(--saffron-pale)', color: 'var(--saffron-dark)',
      font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1, whiteSpace: 'nowrap',
    }}>
      {labels[type] ?? type}
    </span>
  );
}
function ReviewPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const m = {
    pending:  { bg: 'rgba(212,151,49,.15)', fg: 'var(--saffron-dark)', t: '待审' },
    approved: { bg: 'rgba(125,154,108,.15)', fg: 'var(--sage-dark)', t: '✓pub' },
    rejected: { bg: 'rgba(192,57,43,.15)', fg: 'var(--crimson)', t: '已拒' },
  }[status];
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 'var(--r-pill)',
      background: m.bg, color: m.fg,
      font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1, whiteSpace: 'nowrap',
    }}>
      {m.t}
    </span>
  );
}

// ── 编辑 / 新建 Dialog ──────────────────────────────────────
function QuestionEditDialog(props: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  questionId?: string;
  lessonId: string;
  chapterId: string;
  courseId: string;
}) {
  const { s } = useLang();
  // 编辑模式需先 load 详情
  const detail = useAdminQuestionDetail(props.mode === 'edit' && props.open ? props.questionId : null);

  if (!props.open) return null;

  if (props.mode === 'edit') {
    if (detail.isLoading) {
      return (
        <Dialog open onClose={props.onClose} title={s('编辑题目', '編輯題目', 'Edit question')} variant="centered">
          <p style={{ color: 'var(--ink-4)', padding: 'var(--sp-4)' }}>…</p>
        </Dialog>
      );
    }
    if (!detail.data) {
      return (
        <Dialog open onClose={props.onClose} title={s('编辑题目', '編輯題目', 'Edit question')} variant="centered">
          <p style={{ color: 'var(--crimson)' }}>{(detail.error as ApiError | undefined)?.message ?? '加载失败'}</p>
        </Dialog>
      );
    }
    return <QuestionEditForm {...props} initial={detail.data} />;
  }
  // create
  return <QuestionEditForm {...props} initial={null} />;
}

// ── 表单本体 ───────────────────────────────────────────────
function QuestionEditForm({
  onClose, mode, questionId, lessonId, chapterId, courseId, initial,
}: {
  onClose: () => void;
  mode: 'create' | 'edit';
  questionId?: string;
  lessonId: string;
  chapterId: string;
  courseId: string;
  initial: import('@/lib/queries').AdminQuestionDetail | null;
}) {
  const { s } = useLang();
  const qc = useQueryClient();

  const [type, setType] = useState<QuestionType>(initial?.type ?? 'single');
  const [questionText, setQText] = useState(initial?.questionText ?? '');
  const [correctText, setCText] = useState(initial?.correctText ?? '');
  const [wrongText, setWText] = useState(initial?.wrongText ?? '');
  const [source, setSource] = useState(initial?.source ?? '');
  const [difficulty, setDiff] = useState(initial?.difficulty ?? 2);
  const [tagsStr, setTagsStr] = useState(initial?.tags?.join(', ') ?? '');
  const [visibility, setVisibility] = useState<'public' | 'class_private'>(
    (initial?.visibility === 'class_private' ? 'class_private' : 'public'),
  );
  const [payload, setPayload] = useState<Record<string, unknown>>(() => initial ? initial.payload : emptyPayload('single'));

  // 类型切换 · 只在新建模式开放
  function pickType(t: QuestionType) {
    setType(t);
    setPayload(emptyPayload(t));
  }

  const isComplexType = !SIMPLE_TYPES.includes(type);

  const submit = useMutation({
    mutationFn: () => {
      const body = {
        ...(mode === 'create' ? { courseId, chapterId, lessonId, type, visibility } : {}),
        questionText: questionText.trim(),
        correctText: correctText.trim(),
        wrongText: wrongText.trim(),
        source: source.trim(),
        difficulty,
        tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
        payload: normalizePayload(type, payload),
      };
      return mode === 'create'
        ? api.post('/api/coach/questions', body)
        : api.patch(`/api/coach/questions/${encodeURIComponent(questionId!)}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/lessons', lessonId, 'questions'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/questions'] });
      toast.ok(mode === 'create' ? s('已创建', '已創建', 'Created') : s('已保存', '已保存', 'Saved'));
      onClose();
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  // 不阻塞按钮 · 点击时给具体错误 · 比 disabled 看起来「点不动」体验好
  function tryValidate(): string | null {
    if (isComplexType) return s('请去 /coach/questions 创建该类型', '請去 /coach/questions', 'Use /coach/questions for this type');
    if (questionText.trim().length < 4) return s('题干至少 4 个字符', '題幹至少 4 個字符', 'Question text needs ≥ 4 chars');
    if (!validatePayload(type, payload)) return validationHint(type, s);
    return null;
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === 'create' ? s('新建题目', '新建題目', 'New question') : s('编辑题目', '編輯題目', 'Edit question')}
      variant="centered"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {/* 类型 · 仅新建模式可选 */}
        {mode === 'create' ? (
          <div>
            <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
              {s('题型', '題型', 'Type')}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['single', 'multi', 'fill', 'sort', 'open', 'match', 'flip'] as QuestionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickType(t)}
                  className="btn btn-pill"
                  style={{
                    padding: '6px 12px',
                    background: type === t ? 'var(--saffron)' : 'var(--glass-thick)',
                    color: type === t ? '#fff' : 'var(--ink-2)',
                    border: '1px solid var(--glass-border)',
                    font: 'var(--text-caption)', fontWeight: 600, letterSpacing: 1,
                  }}
                >
                  {typeLabel(t, s)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
            {s('题型：', '題型：', 'Type: ')} <TypePill type={type} />
          </div>
        )}

        {isComplexType && (
          <div className="glass-card-thick" style={{ padding: 'var(--sp-3)', background: 'var(--saffron-pale)', font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
            ⚠️ {s('此类题型（流程图 / 听力 / 引导思考等）请去', '此類題型請去', 'For this type, please use')}{' '}
            <a href={`/coach/questions/new?lessonId=${encodeURIComponent(lessonId)}`} style={{ color: 'var(--saffron-dark)' }}>
              /coach/questions
            </a>
            {s(' 编辑', ' 編輯', '')}
          </div>
        )}

        {/* 题干 */}
        <div>
          <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
            {s('题干', '題幹', 'Question')}
          </label>
          <textarea
            value={questionText}
            onChange={(e) => setQText(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={s('问题正文…', '問題正文…', 'Question…')}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)', font: 'var(--text-body)', resize: 'vertical', minHeight: 50, boxSizing: 'border-box' }}
          />
        </div>

        {/* payload */}
        {!isComplexType && (
          <PayloadEditor type={type} value={payload} onChange={setPayload} />
        )}

        {/* 正确解析 / 错误解析 / 来源 / 难度 / 标签 / visibility */}
        <Field label={s('正确答案解析（学员答对时显示）', '正確解析', 'Correct explanation')} value={correctText} onChange={setCText} maxLength={500} />
        <Field label={s('错误答案解析（学员答错时显示）', '錯誤解析', 'Wrong explanation')} value={wrongText} onChange={setWText} maxLength={500} />
        <Field label={s('来源（可选）', '來源', 'Source')} value={source} onChange={setSource} maxLength={2000} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label={s('难度（1-5）', '難度', 'Difficulty')} value={String(difficulty)} onChange={(v) => setDiff(Math.max(1, Math.min(5, Number(v) || 2)))} type="number" />
          <Field label={s('标签（逗号分隔）', '標籤', 'Tags')} value={tagsStr} onChange={setTagsStr} maxLength={200} />
        </div>
        {mode === 'create' && (
          <div>
            <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
              {s('可见性', '可見性', 'Visibility')}
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'class_private')}
              style={{ padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)' }}
            >
              <option value="public">{s('公开（admin 创建直接 approved）', '公開', 'Public')}</option>
              <option value="class_private" disabled>{s('班级私题（请去 coach 题库）', '班級私題', 'class_private (use coach UI)')}</option>
            </select>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'var(--sp-2)' }}>
          <button type="button" onClick={onClose} className="btn btn-pill" style={{ padding: '8px 16px', background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            {s('取消', '取消', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              const err = tryValidate();
              if (err) { toast.error(err); return; }
              submit.mutate();
            }}
            disabled={submit.isPending}
            className="btn btn-primary btn-pill"
            style={{ padding: '8px 18px' }}
          >
            {submit.isPending ? '…' : (mode === 'create' ? s('创建', '創建', 'Create') : s('保存', '保存', 'Save'))}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function typeLabel(t: QuestionType, s: (sc: string, tc: string, en: string) => string): string {
  switch (t) {
    case 'single': return s('单选', '單選', 'Single');
    case 'multi':  return s('多选', '多選', 'Multi');
    case 'fill':   return s('填空', '填空', 'Fill');
    case 'sort':   return s('排序', '排序', 'Sort');
    case 'open':   return s('问答', '問答', 'Open');
    case 'match':  return s('配对', '配對', 'Match');
    case 'flip':   return s('速记卡', '速記卡', 'Flip');
    default: return t;
  }
}

// ── payload 编辑器（5 类型）──────────────────────────────
function PayloadEditor({ type, value, onChange }: { type: QuestionType; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  switch (type) {
    case 'single':
    case 'multi':
      return <ChoiceEditor multi={type === 'multi'} value={value} onChange={onChange} />;
    case 'fill':
      return <FillEditor value={value} onChange={onChange} />;
    case 'sort':
      return <SortEditor value={value} onChange={onChange} />;
    case 'open':
      return <OpenEditor value={value} onChange={onChange} />;
    case 'match':
      return <MatchEditor value={value} onChange={onChange} />;
    case 'flip':
      return <FlipEditor value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function MatchEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  const pairsText = (value.pairsText as string) ?? '';
  return (
    <div>
      <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
        {s('配对项（每行一对 · 用 = 分隔 · 至少 2 对）', '配對項', 'Pairs (one per line · A = B · ≥2)')}
      </label>
      <textarea
        value={pairsText}
        onChange={(e) => onChange({ pairsText: e.target.value })}
        rows={5}
        placeholder={s('菩提心 = 觉悟之心\n空性 = 缘起之理\n慈悲 = 利他之愿', '菩提心 = 覺悟之心', 'A1 = B1\nA2 = B2')}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)', resize: 'vertical', minHeight: 100, boxSizing: 'border-box', fontFamily: 'var(--font-mono, monospace)' }}
      />
    </div>
  );
}

function FlipEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  const front = (value.front as string) ?? '';
  const frontSub = (value.frontSub as string) ?? '';
  const back = (value.back as string) ?? '';
  const backExample = (value.backExample as string) ?? '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 4 }}>
        {s('速记卡 · 不计分 · 用于背诵 / 复习', '速記卡', 'Flashcard (no scoring · for review)')}
      </p>
      <Field label={s('正面（必填）', '正面', 'Front')} value={front} onChange={(v) => onChange({ ...value, front: v })} maxLength={200} />
      <Field label={s('正面副文（可选）', '正面副文', 'Front sub (opt)')} value={frontSub} onChange={(v) => onChange({ ...value, frontSub: v })} maxLength={200} />
      <Field label={s('反面（必填 · 答案）', '反面', 'Back (answer)')} value={back} onChange={(v) => onChange({ ...value, back: v })} maxLength={500} />
      <Field label={s('反面例句（可选）', '反面例句', 'Back example (opt)')} value={backExample} onChange={(v) => onChange({ ...value, backExample: v })} maxLength={500} />
    </div>
  );
}

function ChoiceEditor({ multi, value, onChange }: { multi: boolean; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  const opts = (value.options as { text: string; correct: boolean }[]) ?? [];

  function update(i: number, patch: Partial<{ text: string; correct: boolean }>) {
    if (!multi && patch.correct === true) {
      onChange({ options: opts.map((o, idx) => ({ ...o, correct: idx === i })) });
    } else {
      onChange({ options: opts.map((o, idx) => idx === i ? { ...o, ...patch } : o) });
    }
  }
  function addRow() {
    if (opts.length >= 8) return;
    onChange({ options: [...opts, { text: '', correct: false }] });
  }
  function removeRow(i: number) {
    if (opts.length <= 2) return;
    onChange({ options: opts.filter((_, idx) => idx !== i) });
  }

  return (
    <div>
      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 6 }}>
        {multi ? s('多选 · ≥3 项 · ≥2 正确', '多選', 'Multi · ≥3 options · ≥2 correct') : s('单选 · ≥2 项 · 仅 1 正确', '單選', 'Single · ≥2 options · 1 correct')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {opts.map((o, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              name="choice-correct"
              checked={!!o.correct}
              onChange={(e) => update(i, { correct: e.target.checked })}
            />
            <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 16 }}>{String.fromCharCode(65 + i)}.</span>
            <input
              type="text"
              value={o.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder={s('选项文字', '選項文字', 'Option text')}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)' }}
            />
            <button type="button" onClick={() => removeRow(i)} disabled={opts.length <= 2} style={{ background: 'transparent', border: 'none', color: 'var(--crimson)', cursor: 'pointer', font: 'var(--text-caption)' }}>
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={addRow} disabled={opts.length >= 8} style={{ background: 'transparent', border: '1px dashed var(--border)', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)', padding: '6px', borderRadius: 'var(--r-sm)' }}>
          + {s('添加选项', '添加選項', 'Add option')}
        </button>
      </div>
    </div>
  );
}

function FillEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  const verseLines = ((value.verseLines as string[]) ?? ['']).join('\n');
  const correctWord = (value.correctWord as string) ?? '';
  const opts = ((value.options as string[]) ?? []).join(', ');
  const verseSource = (value.verseSource as string) ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
          {s('原文行（用 ___ 表示空格 · 多行用回车）', '原文行', 'Verse lines (use ___ for blank)')}
        </label>
        <textarea
          value={verseLines}
          onChange={(e) => onChange({ ...value, verseLines: e.target.value.split('\n') })}
          rows={3}
          placeholder={s('例：菩提心 ___ 一切善法之根本', '例：菩提心 ___ 一切善法之根本', 'e.g. ___ is the root...')}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)', resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }}
        />
      </div>
      <Field label={s('正确填入', '正確填入', 'Correct fill')} value={correctWord} onChange={(v) => onChange({ ...value, correctWord: v })} maxLength={50} />
      <Field label={s('备选项（逗号分隔 · ≥2）', '備選項', 'Options (comma-separated)')} value={opts} onChange={(v) => onChange({ ...value, options: v.split(',').map((x) => x.trim()).filter(Boolean) })} maxLength={300} />
      <Field label={s('原文出处（可选）', '原文出處', 'Source (opt)')} value={verseSource} onChange={(v) => onChange({ ...value, verseSource: v })} maxLength={200} />
    </div>
  );
}

function SortEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  // 内部用单个 textarea 暂存（每行一项 · 顺序即正确顺序）
  const itemsText = (value.itemsText as string) ?? '';
  return (
    <div>
      <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
        {s('排序项（每行一项 · 顺序即正确顺序）', '排序項', 'Items (one per line · order = correct)')}
      </label>
      <textarea
        value={itemsText}
        onChange={(e) => onChange({ itemsText: e.target.value })}
        rows={4}
        placeholder={s('第一步\n第二步\n第三步', '第一步\n第二步\n第三步', 'Step 1\nStep 2\nStep 3')}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)', resize: 'vertical', minHeight: 80, boxSizing: 'border-box' }}
      />
    </div>
  );
}

function OpenEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  const referenceAnswer = (value.referenceAnswer as string) ?? '';
  const keyPoints = (value.keyPoints as { point: string; signals: string }[]) ?? [{ point: '', signals: '' }];
  const minLength = (value.minLength as number) ?? 80;
  const maxLength = (value.maxLength as number) ?? 400;

  function updateKp(i: number, patch: Partial<{ point: string; signals: string }>) {
    onChange({ ...value, keyPoints: keyPoints.map((k, idx) => idx === i ? { ...k, ...patch } : k) });
  }
  function addKp() {
    onChange({ ...value, keyPoints: [...keyPoints, { point: '', signals: '' }] });
  }
  function removeKp(i: number) {
    if (keyPoints.length <= 1) return;
    onChange({ ...value, keyPoints: keyPoints.filter((_, idx) => idx !== i) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
          {s('参考答案', '參考答案', 'Reference answer')}
        </label>
        <textarea
          value={referenceAnswer}
          onChange={(e) => onChange({ ...value, referenceAnswer: e.target.value })}
          rows={4}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)', resize: 'vertical', minHeight: 80, boxSizing: 'border-box' }}
        />
      </div>
      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
          {s('关键点（≥1 · LLM 评分提示）', '關鍵點', 'Key points (≥1)')}
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {keyPoints.map((k, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
              <input
                type="text"
                value={k.point}
                onChange={(e) => updateKp(i, { point: e.target.value })}
                placeholder={s('要点', '要點', 'Point')}
                style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)' }}
              />
              <input
                type="text"
                value={k.signals}
                onChange={(e) => updateKp(i, { signals: e.target.value })}
                placeholder={s('关键词（逗号分隔）', '關鍵詞', 'Signals (comma-sep)')}
                style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)' }}
              />
              <button type="button" onClick={() => removeKp(i)} disabled={keyPoints.length <= 1} style={{ background: 'transparent', border: 'none', color: 'var(--crimson)', cursor: 'pointer' }}>×</button>
            </div>
          ))}
          <button type="button" onClick={addKp} style={{ background: 'transparent', border: '1px dashed var(--border)', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)', padding: '4px 8px', borderRadius: 'var(--r-sm)' }}>
            + {s('添加关键点', '添加關鍵點', 'Add')}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label={s('最小字数', '最小字數', 'Min length')} value={String(minLength)} onChange={(v) => onChange({ ...value, minLength: Number(v) || 0 })} type="number" />
        <Field label={s('最大字数', '最大字數', 'Max length')} value={String(maxLength)} onChange={(v) => onChange({ ...value, maxLength: Number(v) || 0 })} type="number" />
      </div>
    </div>
  );
}

// ── payload 工厂 / 校验 / 归一化（5 类型 · 与 CoachQuestionNewPage 同步）──
function emptyPayload(t: QuestionType): Record<string, unknown> {
  switch (t) {
    case 'single':
    case 'multi':
      return { options: [{ text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }] };
    case 'fill':
      return { verseLines: [''], correctWord: '', options: ['', '', '', ''], verseSource: '' };
    case 'sort':
      return { itemsText: '' };
    case 'open':
      return { referenceAnswer: '', keyPoints: [{ point: '', signals: '' }], minLength: 80, maxLength: 400 };
    case 'match':
      return { pairsText: '' };
    case 'flip':
      return { front: '', frontSub: '', back: '', backExample: '' };
    default:
      return {};
  }
}

function validatePayload(t: QuestionType, p: Record<string, unknown>): boolean {
  switch (t) {
    case 'single': {
      const opts = (p.options as { text: string; correct: boolean }[]) ?? [];
      return opts.filter((o) => o.text.trim()).length >= 2 && opts.filter((o) => o.correct && o.text.trim()).length === 1;
    }
    case 'multi': {
      const opts = (p.options as { text: string; correct: boolean }[]) ?? [];
      return opts.filter((o) => o.text.trim()).length >= 3 && opts.filter((o) => o.correct && o.text.trim()).length >= 2;
    }
    case 'fill': {
      const lines = (p.verseLines as string[]) ?? [];
      const opts = (p.options as string[]) ?? [];
      return lines.some((l) => l.includes('___')) && (p.correctWord as string).trim().length > 0 && opts.filter((o) => o.trim()).length >= 2;
    }
    case 'sort': {
      const lines = ((p.itemsText as string) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.length >= 2;
    }
    case 'open': {
      const kps = (p.keyPoints as { point: string }[]) ?? [];
      return (p.referenceAnswer as string).trim().length >= 10 && kps.filter((k) => k.point.trim()).length >= 1;
    }
    case 'match': {
      const lines = ((p.pairsText as string) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.length >= 2 && lines.every((l) => l.includes('='));
    }
    case 'flip':
      return (p.front as string).trim().length > 0 && (p.back as string).trim().length > 0;
    default:
      return false;
  }
}

function normalizePayload(t: QuestionType, p: Record<string, unknown>): Record<string, unknown> {
  switch (t) {
    case 'single':
    case 'multi':
      return {
        options: ((p.options as { text: string; correct: boolean }[]) ?? [])
          .filter((o) => o.text.trim())
          .map((o) => ({ text: o.text.trim(), correct: !!o.correct })),
        ...(t === 'multi' ? { scoringMode: 'partial' as const } : {}),
      };
    case 'fill': {
      const lines = ((p.verseLines as string[]) ?? []).map((l) => l.trim()).filter(Boolean);
      const opts = ((p.options as string[]) ?? []).map((o) => o.trim()).filter(Boolean);
      const out: Record<string, unknown> = {
        verseLines: lines,
        correctWord: (p.correctWord as string).trim(),
        options: opts,
      };
      if ((p.verseSource as string).trim()) out.verseSource = (p.verseSource as string).trim();
      return out;
    }
    case 'sort': {
      const lines = ((p.itemsText as string) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      return { items: lines.map((text, i) => ({ text, order: i + 1 })) };
    }
    case 'open':
      return {
        referenceAnswer: (p.referenceAnswer as string).trim(),
        keyPoints: ((p.keyPoints as { point: string; signals: string }[]) ?? [])
          .filter((k) => k.point.trim())
          .map((k) => ({
            point: k.point.trim(),
            signals: k.signals.split(',').map((x) => x.trim()).filter(Boolean),
          })),
        minLength: p.minLength,
        maxLength: p.maxLength,
      };
    case 'match': {
      const lines = ((p.pairsText as string) ?? '').split('\n').map((l) => l.trim()).filter((l) => l && l.includes('='));
      const left: { id: string; text: string }[] = [];
      const right: { id: string; text: string; match: string }[] = [];
      lines.forEach((line, i) => {
        const [l, r] = line.split('=').map((x) => x.trim());
        const id = 'p' + (i + 1);
        left.push({ id, text: l ?? '' });
        right.push({ id: 'r' + (i + 1), text: r ?? '', match: id });
      });
      return { left, right };
    }
    case 'flip': {
      const front: { text: string; subText?: string } = { text: (p.front as string).trim() };
      if ((p.frontSub as string).trim()) front.subText = (p.frontSub as string).trim();
      const back: { text: string; example?: string } = { text: (p.back as string).trim() };
      if ((p.backExample as string).trim()) back.example = (p.backExample as string).trim();
      return { front, back, noScoring: true };
    }
    default:
      return p;
  }
}

function validationHint(t: QuestionType, s: (sc: string, tc: string, en: string) => string): string {
  switch (t) {
    case 'single':
      return s('单选：至少 2 个选项有文字 · 仅 1 个标为正确', '單選：≥2 選項 · 僅 1 正確', 'Single: ≥2 options with text · 1 marked correct');
    case 'multi':
      return s('多选：至少 3 个选项有文字 · 至少 2 个标为正确', '多選：≥3 選項 · ≥2 正確', 'Multi: ≥3 options · ≥2 correct');
    case 'fill':
      return s('填空：原文行需含 ___ · 正确填入不能空 · 备选项至少 2 个', '填空：原文需含 ___ · 備選項 ≥2', 'Fill: verse must contain ___ · ≥2 options');
    case 'sort':
      return s('排序：至少 2 行排序项', '排序：至少 2 行', 'Sort: ≥2 items');
    case 'open':
      return s('问答：参考答案 ≥10 字 · 至少 1 个关键点', '問答：參考答案 ≥10 字 · ≥1 關鍵點', 'Open: reference ≥10 chars · ≥1 key point');
    case 'match':
      return s('配对：至少 2 行 · 每行用 = 分隔', '配對：≥2 行 · 用 = 分隔', 'Match: ≥2 lines · A = B');
    case 'flip':
      return s('速记卡：正面和反面都不能空', '速記卡：正反面必填', 'Flip: front + back required');
    default:
      return s('payload 未填全', 'payload 未填全', 'payload incomplete');
  }
}
