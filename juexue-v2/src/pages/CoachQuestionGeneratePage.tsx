// CoachQuestionGeneratePage · /coach/questions/generate
//   单课时 LLM 生成 · 输入 passage → 一次产出 N 题
//   整章批量（chapter scope）暂留老 prototypes（serial queue 复杂 · Phase 15 再做）
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { type QuestionType, useCourseDetail, useCourses } from '@/lib/queries';
import { toast } from '@/lib/toast';

interface GenerateResult {
  succeeded: number;
  failed: number;
  total: number;
  questions: Array<{ id: string; questionText: string; type: string }>;
  skipped: Array<{ index: number; reason: string }>;
}

const GEN_TYPES: { v: QuestionType; sc: string; tc: string; en: string }[] = [
  { v: 'single', sc: '单选', tc: '單選', en: 'Single' },
  { v: 'multi',  sc: '多选', tc: '多選', en: 'Multi' },
  { v: 'fill',   sc: '填空', tc: '填空', en: 'Fill' },
  { v: 'open',   sc: '问答', tc: '問答', en: 'Open' },
  { v: 'sort',   sc: '排序', tc: '排序', en: 'Sort' },
  { v: 'match',  sc: '匹配', tc: '匹配', en: 'Match' },
];

export default function CoachQuestionGeneratePage() {
  const { s } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();

  const [courseId, setCourseId] = useState(sp.get('courseId') ?? '');
  const [chapterId, setChapterId] = useState(sp.get('chapterId') ?? '');
  const [lessonId, setLessonId] = useState(sp.get('lessonId') ?? '');
  const [type, setType] = useState<QuestionType>('single');
  const [count, setCount] = useState<3 | 5 | 8 | 12>(5);
  const [difficulty, setDifficulty] = useState(2);
  const [passage, setPassage] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);

  const courses = useCourses();
  const slug = useMemo(
    () => courses.data?.find((c) => c.id === courseId)?.slug ?? null,
    [courses.data, courseId],
  );
  const detail = useCourseDetail(slug);
  const chapter = useMemo(
    () => detail.data?.chapters.find((c) => c.id === chapterId),
    [detail.data, chapterId],
  );
  const lesson = useMemo(
    () => chapter?.lessons.find((l) => l.id === lessonId),
    [chapter, lessonId],
  );

  // 选课时后自动把原文填入 passage 输入框（用户可改）
  useEffect(() => {
    if (lesson?.referenceText && !passage.trim()) {
      setPassage(lesson.referenceText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const generate = useMutation({
    mutationFn: () => api.post<GenerateResult>('/api/coach/questions/generate', {
      courseId,
      chapterId,
      lessonId,
      passage: passage.trim(),
      type,
      count,
      difficulty,
      visibility: 'public',
    }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ['/api/coach/questions'] });
      qc.invalidateQueries({ queryKey: ['/api/coach/llm-calls'] });
      if (r.failed === 0) {
        toast.ok(s(`已生成 ${r.succeeded} 道`, `已生成 ${r.succeeded} 道`, `Generated ${r.succeeded}`));
      } else {
        toast.warn(s(`生成 ${r.succeeded} · 跳过 ${r.failed}`, `生成 ${r.succeeded} · 跳過 ${r.failed}`, `${r.succeeded} ok · ${r.failed} skipped`));
      }
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const valid = courseId && chapterId && lessonId && passage.trim().length >= 20;

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('LLM 生成题目', 'LLM 生成題目', 'LLM Generate')}</h1>
          <p className="page-sub">{s('AI 根据原文一次出多题 · 提交后进入待审', 'AI 根據原文一次出多題 · 提交後進入待審', 'AI generates multiple from passage · pending review')}</p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-pill" style={{ padding: '8px 14px', background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
            {s('返回', '返回', 'Back')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--sp-4)', maxWidth: 880 }}>
        {/* 课程级联 */}
        <Section title={s('归属', '歸屬', 'Location')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
            <Pickr label={s('法本', '法本', 'Course')} value={courseId} onChange={(v) => { setCourseId(v); setChapterId(''); setLessonId(''); setPassage(''); }} options={[{ v: '', label: '— 请选 —' }, ...(courses.data ?? []).map((c) => ({ v: c.id, label: `${c.coverEmoji} ${c.title}` }))]} />
            <Pickr label={s('章节', '章節', 'Chapter')} value={chapterId} disabled={!detail.data} onChange={(v) => { setChapterId(v); setLessonId(''); setPassage(''); }} options={[{ v: '', label: '— 请选 —' }, ...((detail.data?.chapters ?? []).map((ch) => ({ v: ch.id, label: `第 ${ch.order} 章 · ${ch.title}` })))]} />
            <Pickr label={s('课时', '課時', 'Lesson')} value={lessonId} disabled={!chapter} onChange={setLessonId} options={[{ v: '', label: '— 请选 —' }, ...((chapter?.lessons ?? []).map((l) => ({ v: l.id, label: `第 ${l.order} 课 · ${l.title}` })))]} />
          </div>
          {courses.isLoading && <Skeleton.LineSm style={{ marginTop: 8 }} />}
        </Section>

        {/* 原文 */}
        <Section title={s('原文 / 段落（≥ 20 字）', '原文 / 段落（≥ 20 字）', 'Passage (≥ 20 chars)')}>
          <textarea
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            rows={10}
            placeholder={s('粘贴一段原文 · 选课时后会自动填入 referenceText · 可手动改', '貼上一段原文 · 選課時後會自動填入 referenceText · 可手動改', 'Paste passage · auto-filled from lesson reference text · editable')}
            style={textareaStyle}
          />
          <div style={{ font: 'var(--text-caption)', color: passage.length < 20 ? 'var(--crimson)' : 'var(--ink-4)', marginTop: 4, letterSpacing: 1 }}>
            {passage.length} {s('字', '字', 'chars')}
          </div>
        </Section>

        {/* 生成参数 */}
        <Section title={s('生成参数', '生成參數', 'Parameters')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
            <div>
              <Label>{s('题型', '題型', 'Type')}</Label>
              <select value={type} onChange={(e) => setType(e.target.value as QuestionType)} style={selectStyle}>
                {GEN_TYPES.map((t) => <option key={t.v} value={t.v}>{s(t.sc, t.tc, t.en)}</option>)}
              </select>
            </div>
            <div>
              <Label>{s('数量', '數量', 'Count')}</Label>
              <select value={String(count)} onChange={(e) => setCount(Number(e.target.value) as 3 | 5 | 8 | 12)} style={selectStyle}>
                {[3, 5, 8, 12].map((n) => <option key={n} value={n}>{n} {s('道', '道', '')}</option>)}
              </select>
            </div>
            <div>
              <Label>{s('难度', '難度', 'Difficulty')}</Label>
              <select value={String(difficulty)} onChange={(e) => setDifficulty(Number(e.target.value))} style={selectStyle}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
          </div>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, marginTop: 8 }}>
            ⚠️ {s('生成的题目以"待审"状态进入题库 · 由管理员通过后才对学员可见', '生成的題目以「待審」狀態進入題庫 · 由管理員通過後才對學員可見', 'Generated questions enter as "pending" · admin must approve')}
          </p>
        </Section>

        {/* submit */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
            {s('取消', '取消', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={!valid || generate.isPending}
            onClick={() => { setResult(null); generate.mutate(); }}
            className="btn btn-primary btn-pill"
            style={{ flex: 2, padding: 12, justifyContent: 'center', opacity: valid ? 1 : 0.5 }}
          >
            {generate.isPending
              ? s('LLM 思考中…（可能 10-30 秒）', 'LLM 思考中…（可能 10-30 秒）', 'LLM thinking… (10-30s)')
              : s(`⚡ 生成 ${count} 道`, `⚡ 生成 ${count} 道`, `⚡ Generate ${count}`)}
          </button>
        </div>

        {/* 结果 */}
        {result && (
          <Section title={s('结果', '結果', 'Result')}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
              <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>✓ {result.succeeded}</span>
              {result.failed > 0 && <span style={{ font: 'var(--text-caption)', color: 'var(--crimson)', fontWeight: 700 }}>✗ {result.failed} 跳过</span>}
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>· {s('共', '共', 'total')} {result.total}</span>
            </div>

            {result.questions.length > 0 && (
              <>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>
                  {s('已生成', '已生成', 'Generated')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 'var(--sp-3)' }}>
                  {result.questions.map((q, i) => (
                    <div key={q.id} style={{ display: 'flex', gap: 'var(--sp-3)', padding: '6px 10px', background: 'rgba(125,154,108,.08)', borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--sage-dark)' }}>
                      <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 28 }}>#{i + 1}</span>
                      <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.questionText}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {result.skipped.length > 0 && (
              <>
                <div style={{ font: 'var(--text-caption)', color: 'var(--crimson)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>
                  {s('跳过', '跳過', 'Skipped')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {result.skipped.map((sk) => (
                    <div key={sk.index} style={{ display: 'flex', gap: 'var(--sp-3)', padding: '6px 10px', background: 'rgba(192,57,43,.08)', borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--crimson)' }}>
                      <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 28 }}>#{sk.index + 1}</span>
                      <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--crimson)' }}>{sk.reason}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
              <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 10, justifyContent: 'center' }}>
                {s('返回题库', '返回題庫', 'Back to questions')}
              </button>
              <button type="button" onClick={() => setResult(null)} className="btn btn-pill" style={{ flex: 1, padding: 10, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
                {s('再生成一批', '再生成一批', 'Generate again')}
              </button>
            </div>
          </Section>
        )}

        {/* 整章批量提示 */}
        <a
          href="/prototypes/desktop/coach-questions.html?action=generate"
          style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, textAlign: 'center', textDecoration: 'underline' }}
        >
          {s('需要整章批量？↗ 走老界面（Phase 15 完整迁移）', '需要整章批量？↗ 走老界面（Phase 15 完整遷移）', 'Need batch by chapter? ↗ legacy (Phase 15)')}
        </a>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <h2 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 700, marginBottom: 'var(--sp-3)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
      {children}
    </label>
  );
}

function Pickr({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; label: string }[]; disabled?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={{ ...selectStyle, opacity: disabled ? 0.5 : 1 }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--ink)',
  font: 'var(--text-body)',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  ...selectStyle,
  resize: 'vertical',
  fontFamily: 'var(--font-serif)',
  lineHeight: 1.7,
};
