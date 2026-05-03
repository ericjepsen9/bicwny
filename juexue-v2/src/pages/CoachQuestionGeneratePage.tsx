// CoachQuestionGeneratePage · /coach/questions/generate
//   两种 scope：
//     - lesson  · 单课时 · 直接 POST 一次
//     - chapter · 整章批量 · 串行队列 + 进度（每课时一次 POST，避免后端打爆）
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

interface BatchLessonState {
  lessonId: string;
  lessonOrder: number;
  lessonTitle: string;
  status: 'pending' | 'running' | 'ok' | 'skipped' | 'err';
  generated?: number;
  reason?: string;
}

const GEN_TYPES: { v: QuestionType; sc: string; tc: string; en: string }[] = [
  { v: 'single', sc: '单选', tc: '單選', en: 'Single' },
  { v: 'multi',  sc: '多选', tc: '多選', en: 'Multi' },
  { v: 'fill',   sc: '填空', tc: '填空', en: 'Fill' },
  { v: 'open',   sc: '问答', tc: '問答', en: 'Open' },
  { v: 'sort',   sc: '排序', tc: '排序', en: 'Sort' },
  { v: 'match',  sc: '匹配', tc: '匹配', en: 'Match' },
];

const MIN_PASSAGE = 20;

type Scope = 'lesson' | 'chapter';

export default function CoachQuestionGeneratePage() {
  const { s } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();

  const [scope, setScope] = useState<Scope>('lesson');
  const [courseId, setCourseId] = useState(sp.get('courseId') ?? '');
  const [chapterId, setChapterId] = useState(sp.get('chapterId') ?? '');
  const [lessonId, setLessonId] = useState(sp.get('lessonId') ?? '');
  const [type, setType] = useState<QuestionType>('single');
  const [count, setCount] = useState<3 | 5 | 8 | 12>(5);
  const [difficulty, setDifficulty] = useState(2);
  const [passage, setPassage] = useState('');

  // lesson 单次结果
  const [lessonResult, setLessonResult] = useState<GenerateResult | null>(null);
  // chapter 批量进度
  const [batch, setBatch] = useState<BatchLessonState[] | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);

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

  // 选课时后自动把原文填入 passage
  useEffect(() => {
    if (scope !== 'lesson') return;
    if (lesson?.referenceText && !passage.trim()) setPassage(lesson.referenceText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, scope]);

  // chapter scope 概览
  const chapterPreview = useMemo(() => {
    if (scope !== 'chapter' || !chapter) return null;
    const lessons = chapter.lessons.slice().sort((a, b) => a.order - b.order);
    const eligible = lessons.filter((l) => (l.referenceText?.length ?? 0) >= MIN_PASSAGE);
    const skippable = lessons.length - eligible.length;
    const totalChars = eligible.reduce((acc, l) => acc + (l.referenceText?.length ?? 0), 0);
    // 估算时间：每课时 LLM ~15s
    const estSec = eligible.length * 15;
    return { total: lessons.length, eligible, skippable, totalChars, estSec };
  }, [scope, chapter]);

  // 单次（lesson）mutation
  const generate = useMutation({
    mutationFn: () => api.post<GenerateResult>('/api/coach/questions/generate', {
      courseId, chapterId, lessonId,
      passage: passage.trim(),
      type, count, difficulty,
      visibility: 'public',
    }),
    onSuccess: (r) => {
      setLessonResult(r);
      qc.invalidateQueries({ queryKey: ['/api/coach/questions'] });
      qc.invalidateQueries({ queryKey: ['/api/coach/llm-calls'] });
      if (r.failed === 0) toast.ok(s(`已生成 ${r.succeeded} 道`, `已生成 ${r.succeeded} 道`, `Generated ${r.succeeded}`));
      else toast.warn(s(`生成 ${r.succeeded} · 跳过 ${r.failed}`, `生成 ${r.succeeded} · 跳過 ${r.failed}`, `${r.succeeded} ok · ${r.failed} skipped`));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  // 批量（chapter）串行队列
  async function runBatch() {
    if (!chapterPreview || !courseId || !chapterId) return;
    const initial: BatchLessonState[] = chapterPreview.eligible.map((l) => ({
      lessonId: l.id,
      lessonOrder: l.order,
      lessonTitle: l.title,
      status: 'pending',
    }));
    setBatch(initial);
    setBatchRunning(true);

    // 串行 · 单条失败不中断
    let totalGen = 0;
    let totalErr = 0;
    for (let i = 0; i < initial.length; i++) {
      const lessonObj = chapterPreview.eligible[i]!;
      // mark running
      setBatch((cur) => cur && cur.map((b, idx) => idx === i ? { ...b, status: 'running' } : b));
      try {
        const r = await api.post<GenerateResult>('/api/coach/questions/generate', {
          courseId, chapterId,
          lessonId: lessonObj.id,
          passage: (lessonObj.referenceText || '').trim(),
          type, count, difficulty,
          visibility: 'public',
        });
        totalGen += r.succeeded;
        if (r.failed > 0) totalErr += r.failed;
        setBatch((cur) => cur && cur.map((b, idx) => idx === i ? { ...b, status: 'ok', generated: r.succeeded } : b));
      } catch (e) {
        totalErr += 1;
        const msg = (e as ApiError).message || 'unknown';
        setBatch((cur) => cur && cur.map((b, idx) => idx === i ? { ...b, status: 'err', reason: msg } : b));
        // continue · 不抛出
      }
    }

    setBatchRunning(false);
    qc.invalidateQueries({ queryKey: ['/api/coach/questions'] });
    qc.invalidateQueries({ queryKey: ['/api/coach/llm-calls'] });
    if (totalErr === 0) toast.ok(s(`整章完成 · 共 ${totalGen} 道`, `整章完成 · 共 ${totalGen} 道`, `Done · ${totalGen} generated`));
    else toast.warn(s(`完成 · 成功 ${totalGen} · 失败 ${totalErr}`, `完成 · 成功 ${totalGen} · 失敗 ${totalErr}`, `Done · ${totalGen} ok · ${totalErr} err`));
  }

  const lessonValid = scope === 'lesson' && courseId && chapterId && lessonId && passage.trim().length >= MIN_PASSAGE;
  const chapterValid = scope === 'chapter' && courseId && chapterId && chapterPreview && chapterPreview.eligible.length > 0;

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('LLM 生成题目', 'LLM 生成題目', 'LLM Generate')}</h1>
          <p className="page-sub">{s('AI 根据原文自动出题 · 提交后进入待审', 'AI 根據原文自動出題 · 提交後進入待審', 'AI generates from passage · pending review')}</p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-pill" style={{ padding: '8px 14px', background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
            {s('返回', '返回', 'Back')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--sp-4)', maxWidth: 880 }}>
        {/* Scope 切换 */}
        <Section title={s('范围', '範圍', 'Scope')}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {([
              { v: 'lesson',  sc: '单课时', tc: '單課時', en: 'Single lesson' },
              { v: 'chapter', sc: '整章批量', tc: '整章批量', en: 'Chapter batch' },
            ] as { v: Scope; sc: string; tc: string; en: string }[]).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => { setScope(o.v); setLessonResult(null); setBatch(null); }}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 'var(--r-pill)',
                  background: scope === o.v ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                  color: scope === o.v ? 'var(--saffron-dark)' : 'var(--ink-3)',
                  border: '1px solid ' + (scope === o.v ? 'var(--saffron-light)' : 'var(--glass-border)'),
                  font: 'var(--text-caption)', fontWeight: 600, letterSpacing: 1, cursor: 'pointer',
                }}
                disabled={batchRunning}
              >
                {s(o.sc, o.tc, o.en)}
              </button>
            ))}
          </div>
        </Section>

        {/* 课程级联 */}
        <Section title={s('归属', '歸屬', 'Location')}>
          <div style={{ display: 'grid', gridTemplateColumns: scope === 'chapter' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
            <Pickr label={s('法本', '法本', 'Course')} value={courseId} disabled={batchRunning} onChange={(v) => { setCourseId(v); setChapterId(''); setLessonId(''); setPassage(''); }} options={[{ v: '', label: '— 请选 —' }, ...(courses.data ?? []).map((c) => ({ v: c.id, label: `${c.coverEmoji} ${c.title}` }))]} />
            <Pickr label={s('章节', '章節', 'Chapter')} value={chapterId} disabled={!detail.data || batchRunning} onChange={(v) => { setChapterId(v); setLessonId(''); setPassage(''); setBatch(null); }} options={[{ v: '', label: '— 请选 —' }, ...((detail.data?.chapters ?? []).map((ch) => ({ v: ch.id, label: `第 ${ch.order} 章 · ${ch.title}` })))]} />
            {scope === 'lesson' && (
              <Pickr label={s('课时', '課時', 'Lesson')} value={lessonId} disabled={!chapter} onChange={setLessonId} options={[{ v: '', label: '— 请选 —' }, ...((chapter?.lessons ?? []).map((l) => ({ v: l.id, label: `第 ${l.order} 课 · ${l.title}` })))]} />
            )}
          </div>
          {courses.isLoading && <Skeleton.LineSm style={{ marginTop: 8 }} />}
        </Section>

        {/* lesson scope · 原文输入 */}
        {scope === 'lesson' && (
          <Section title={s('原文 / 段落（≥ 20 字）', '原文 / 段落（≥ 20 字）', 'Passage (≥ 20 chars)')}>
            <textarea
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              rows={10}
              placeholder={s('粘贴一段原文 · 选课时后会自动填入 referenceText · 可手动改', '貼上一段原文 · 選課時後會自動填入 referenceText · 可手動改', 'Paste passage · auto-filled from lesson reference text · editable')}
              style={textareaStyle}
            />
            <div style={{ font: 'var(--text-caption)', color: passage.length < MIN_PASSAGE ? 'var(--crimson)' : 'var(--ink-4)', marginTop: 4, letterSpacing: 1 }}>
              {passage.length} {s('字', '字', 'chars')}
            </div>
          </Section>
        )}

        {/* chapter scope · 概览 */}
        {scope === 'chapter' && chapterPreview && (
          <Section title={s('整章概览', '整章概覽', 'Chapter overview')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
              <Mini value={String(chapterPreview.total)} label={s('总课时', '總課時', 'Total')} />
              <Mini value={String(chapterPreview.eligible.length)} label={s('可生成', '可生成', 'Eligible')} color="var(--sage-dark)" />
              <Mini value={String(chapterPreview.skippable)} label={s('将跳过', '將跳過', 'Skip')} color="var(--ink-4)" />
              <Mini value={`~${Math.ceil(chapterPreview.estSec / 60)}min`} label={s('预计耗时', '預計耗時', 'Est time')} color="var(--gold-dark)" />
            </div>
            <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 6 }}>
              {s(`将对 ${chapterPreview.eligible.length} 个课时各生成 ${count} 道（共 ${chapterPreview.eligible.length * count} 道）· 串行 · 单课失败不中断`, `將對 ${chapterPreview.eligible.length} 個課時各生成 ${count} 道`, `Will generate ${count} per lesson × ${chapterPreview.eligible.length} (serial)`)}
            </p>
            {chapterPreview.skippable > 0 && (
              <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
                ⚠️ {s(`${chapterPreview.skippable} 个课时原文 < ${MIN_PASSAGE} 字 · 将跳过`, `${chapterPreview.skippable} 個課時原文 < ${MIN_PASSAGE} 字 · 將跳過`, `${chapterPreview.skippable} lessons < ${MIN_PASSAGE} chars · skip`)}
              </p>
            )}
          </Section>
        )}

        {/* 生成参数 */}
        <Section title={s('生成参数', '生成參數', 'Parameters')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
            <div>
              <Label>{s('题型', '題型', 'Type')}</Label>
              <select value={type} onChange={(e) => setType(e.target.value as QuestionType)} style={selectStyle} disabled={batchRunning}>
                {GEN_TYPES.map((t) => <option key={t.v} value={t.v}>{s(t.sc, t.tc, t.en)}</option>)}
              </select>
            </div>
            <div>
              <Label>{s('数量 / 课时', '數量 / 課時', 'Count / lesson')}</Label>
              <select value={String(count)} onChange={(e) => setCount(Number(e.target.value) as 3 | 5 | 8 | 12)} style={selectStyle} disabled={batchRunning}>
                {[3, 5, 8, 12].map((n) => <option key={n} value={n}>{n} {s('道', '道', '')}</option>)}
              </select>
            </div>
            <div>
              <Label>{s('难度', '難度', 'Difficulty')}</Label>
              <select value={String(difficulty)} onChange={(e) => setDifficulty(Number(e.target.value))} style={selectStyle} disabled={batchRunning}>
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
          <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }} disabled={batchRunning}>
            {s('取消', '取消', 'Cancel')}
          </button>
          {scope === 'lesson' ? (
            <button
              type="button"
              disabled={!lessonValid || generate.isPending}
              onClick={() => { setLessonResult(null); generate.mutate(); }}
              className="btn btn-primary btn-pill"
              style={{ flex: 2, padding: 12, justifyContent: 'center', opacity: lessonValid ? 1 : 0.5 }}
            >
              {generate.isPending
                ? s('LLM 思考中…（10-30 秒）', 'LLM 思考中…（10-30 秒）', 'LLM thinking… (10-30s)')
                : s(`⚡ 生成 ${count} 道`, `⚡ 生成 ${count} 道`, `⚡ Generate ${count}`)}
            </button>
          ) : (
            <button
              type="button"
              disabled={!chapterValid || batchRunning}
              onClick={() => { void runBatch(); }}
              className="btn btn-primary btn-pill"
              style={{ flex: 2, padding: 12, justifyContent: 'center', opacity: chapterValid ? 1 : 0.5 }}
            >
              {batchRunning
                ? s('批量生成中…可关页面后台继续不行 · 请保持打开', '批量生成中…請保持頁面打開', 'Batching… keep page open')
                : s(`⚡ 整章批量 (${chapterPreview ? chapterPreview.eligible.length * count : 0} 道)`, `⚡ 整章批量 (${chapterPreview ? chapterPreview.eligible.length * count : 0} 道)`, `⚡ Run batch (${chapterPreview ? chapterPreview.eligible.length * count : 0})`)}
            </button>
          )}
        </div>

        {/* 结果（lesson） */}
        {scope === 'lesson' && lessonResult && (
          <LessonResult r={lessonResult} onClear={() => setLessonResult(null)} onBack={() => nav('/coach/questions')} />
        )}

        {/* 结果（chapter 进度） */}
        {scope === 'chapter' && batch && (
          <BatchProgress batch={batch} running={batchRunning} onClear={() => setBatch(null)} onBack={() => nav('/coach/questions')} />
        )}
      </div>
    </>
  );
}

function LessonResult({ r, onClear, onBack }: { r: GenerateResult; onClear: () => void; onBack: () => void }) {
  const { s } = useLang();
  return (
    <Section title={s('结果', '結果', 'Result')}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
        <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>✓ {r.succeeded}</span>
        {r.failed > 0 && <span style={{ font: 'var(--text-caption)', color: 'var(--crimson)', fontWeight: 700 }}>✗ {r.failed} 跳过</span>}
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>· {s('共', '共', 'total')} {r.total}</span>
      </div>

      {r.questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 'var(--sp-3)' }}>
          {r.questions.map((q, i) => (
            <div key={q.id} style={{ display: 'flex', gap: 'var(--sp-3)', padding: '6px 10px', background: 'rgba(125,154,108,.08)', borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--sage-dark)' }}>
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 28 }}>#{i + 1}</span>
              <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {q.questionText}
              </span>
            </div>
          ))}
        </div>
      )}

      {r.skipped.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {r.skipped.map((sk) => (
            <div key={sk.index} style={{ display: 'flex', gap: 'var(--sp-3)', padding: '6px 10px', background: 'rgba(192,57,43,.08)', borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--crimson)' }}>
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 28 }}>#{sk.index + 1}</span>
              <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--crimson)' }}>{sk.reason}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
        <button type="button" onClick={onBack} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 10, justifyContent: 'center' }}>
          {s('返回题库', '返回題庫', 'Back to questions')}
        </button>
        <button type="button" onClick={onClear} className="btn btn-pill" style={{ flex: 1, padding: 10, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
          {s('再生成一批', '再生成一批', 'Generate again')}
        </button>
      </div>
    </Section>
  );
}

function BatchProgress({ batch, running, onClear, onBack }: { batch: BatchLessonState[]; running: boolean; onClear: () => void; onBack: () => void }) {
  const { s } = useLang();
  const done = batch.filter((b) => b.status !== 'pending' && b.status !== 'running').length;
  const totalGen = batch.reduce((acc, b) => acc + (b.generated ?? 0), 0);
  const errors = batch.filter((b) => b.status === 'err').length;
  const pct = batch.length > 0 ? Math.round((done / batch.length) * 100) : 0;

  return (
    <Section title={s('整章批量进度', '整章批量進度', 'Batch progress')}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink)', fontWeight: 700 }}>{done} / {batch.length}</span>
        <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)' }}>✓ {totalGen} 道</span>
        {errors > 0 && <span style={{ font: 'var(--text-caption)', color: 'var(--crimson)' }}>✗ {errors}</span>}
        <span style={{ marginLeft: 'auto', font: 'var(--text-caption)', color: 'var(--gold-dark)', fontWeight: 700 }}>{pct}%</span>
      </div>
      <div className="progress-track" style={{ marginBottom: 'var(--sp-3)' }}>
        <div className="progress-fill" style={{ width: pct + '%' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
        {batch.map((b) => (
          <div key={b.lessonId} style={{ display: 'flex', gap: 'var(--sp-3)', padding: '6px 10px', borderRadius: 'var(--r-sm)', borderLeft: '3px solid ' + statusColor(b.status), background: statusBg(b.status) }}>
            <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 36 }}>#{b.lessonOrder}</span>
            <span style={{ minWidth: 16 }}>{statusIcon(b.status)}</span>
            <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {b.lessonTitle}
            </span>
            {b.status === 'ok' && b.generated != null && (
              <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>+{b.generated}</span>
            )}
            {b.status === 'err' && (
              <span style={{ font: 'var(--text-caption)', color: 'var(--crimson)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.reason}>{b.reason}</span>
            )}
          </div>
        ))}
      </div>

      {!running && (
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <button type="button" onClick={onBack} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 10, justifyContent: 'center' }}>
            {s('返回题库', '返回題庫', 'Back to questions')}
          </button>
          <button type="button" onClick={onClear} className="btn btn-pill" style={{ flex: 1, padding: 10, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
            {s('再来一次', '再來一次', 'Run again')}
          </button>
        </div>
      )}
    </Section>
  );
}

function statusColor(s: BatchLessonState['status']): string {
  if (s === 'ok') return 'var(--sage-dark)';
  if (s === 'err') return 'var(--crimson)';
  if (s === 'running') return 'var(--saffron)';
  if (s === 'skipped') return 'var(--ink-4)';
  return 'var(--border-light)';
}
function statusBg(s: BatchLessonState['status']): string {
  if (s === 'ok') return 'rgba(125,154,108,.08)';
  if (s === 'err') return 'rgba(192,57,43,.08)';
  if (s === 'running') return 'var(--saffron-pale)';
  return 'transparent';
}
function statusIcon(s: BatchLessonState['status']): string {
  if (s === 'ok') return '✓';
  if (s === 'err') return '✗';
  if (s === 'running') return '…';
  if (s === 'skipped') return '–';
  return '○';
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

function Mini({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: color ?? 'var(--ink)' }}>{value}</div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>{label}</div>
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
