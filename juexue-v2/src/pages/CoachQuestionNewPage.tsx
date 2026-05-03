// CoachQuestionNewPage · /coach/questions/new
//   完整 7 题型创建表单（手动）· 替代老 prototypes/desktop/coach-questions.html?action=new
//   课程级联：Course → Chapter → Lesson
//   每题型独立 payload 编辑器
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { type QuestionType, useCourseDetail, useCourses } from '@/lib/queries';
import { toast } from '@/lib/toast';

type Visibility = 'public' | 'class_private';

const TYPES: { v: QuestionType; sc: string; tc: string; en: string }[] = [
  { v: 'single', sc: '单选', tc: '單選', en: 'Single' },
  { v: 'multi',  sc: '多选', tc: '多選', en: 'Multi' },
  { v: 'fill',   sc: '填空', tc: '填空', en: 'Fill' },
  { v: 'open',   sc: '问答', tc: '問答', en: 'Open' },
  { v: 'sort',   sc: '排序', tc: '排序', en: 'Sort' },
  { v: 'match',  sc: '匹配', tc: '匹配', en: 'Match' },
  { v: 'flip',   sc: '速记卡', tc: '速記卡', en: 'Flip' },
];

export default function CoachQuestionNewPage() {
  const { s } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();

  // 通用元数据
  const [type, setType] = useState<QuestionType>('single');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [courseId, setCourseId] = useState(sp.get('courseId') ?? '');
  const [chapterId, setChapterId] = useState(sp.get('chapterId') ?? '');
  const [lessonId, setLessonId] = useState(sp.get('lessonId') ?? '');
  const [questionText, setQText] = useState('');
  const [correctText, setCText] = useState('');
  const [wrongText, setWText] = useState('');
  const [source, setSource] = useState('');
  const [difficulty, setDiff] = useState(2);
  const [tags, setTags] = useState('');

  // 各题型 payload state（使用对象一组，避免乱）
  const [payload, setPayload] = useState<Record<string, unknown>>(() => emptyPayload('single'));
  function pickType(t: QuestionType) {
    setType(t);
    setPayload(emptyPayload(t));
  }

  // 课程级联
  const courses = useCourses();
  const slug = useMemo(
    () => courses.data?.find((c) => c.id === courseId)?.slug ?? null,
    [courses.data, courseId],
  );
  const detail = useCourseDetail(slug);

  // courseId 变了 · 章节/课时清空（除非 QS 已带）
  useEffect(() => {
    const chId = sp.get('chapterId');
    const lsId = sp.get('lessonId');
    if (!chId) setChapterId('');
    if (!lsId) setLessonId('');
  }, [courseId, sp]);

  const chapter = useMemo(
    () => detail.data?.chapters.find((c) => c.id === chapterId),
    [detail.data, chapterId],
  );

  const submit = useMutation({
    mutationFn: () => api.post('/api/coach/questions', {
      courseId,
      chapterId,
      lessonId,
      type,
      visibility,
      questionText: questionText.trim(),
      correctText: correctText.trim(),
      wrongText: wrongText.trim(),
      source: source.trim(),
      difficulty,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      payload: normalizePayload(type, payload),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/coach/questions'] });
      toast.ok(s('已创建', '已創建', 'Created'));
      nav('/coach/questions');
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const valid = courseId && chapterId && lessonId && questionText.trim().length >= 4 && validatePayload(type, payload);

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('新建题目', '新建題目', 'New question')}</h1>
          <p className="page-sub">{s('支持 7 种题型', '支持 7 種題型', '7 question types')}</p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-pill" style={{ padding: '8px 14px', background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
            {s('返回', '返回', 'Back')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--sp-4)', maxWidth: 880 }}>
        {/* 类型选择 */}
        <Section title={s('题型', '題型', 'Type')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TYPES.map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => pickType(t.v)}
                className="btn btn-pill"
                style={{
                  padding: '8px 16px',
                  background: type === t.v ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                  color: type === t.v ? 'var(--saffron-dark)' : 'var(--ink-3)',
                  border: '1px solid ' + (type === t.v ? 'var(--saffron-light)' : 'var(--glass-border)'),
                  font: 'var(--text-caption)',
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                {s(t.sc, t.tc, t.en)}
              </button>
            ))}
          </div>
        </Section>

        {/* 课程级联 */}
        <Section title={s('归属', '歸屬', 'Location')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
            <Pickr
              label={s('法本', '法本', 'Course')}
              value={courseId}
              onChange={(v) => { setCourseId(v); setChapterId(''); setLessonId(''); }}
              options={[{ v: '', label: '— 请选 —' }, ...(courses.data ?? []).map((c) => ({ v: c.id, label: `${c.coverEmoji} ${c.title}` }))]}
            />
            <Pickr
              label={s('章节', '章節', 'Chapter')}
              value={chapterId}
              disabled={!detail.data}
              onChange={(v) => { setChapterId(v); setLessonId(''); }}
              options={[{ v: '', label: '— 请选 —' }, ...((detail.data?.chapters ?? []).map((ch) => ({ v: ch.id, label: `第 ${ch.order} 章 · ${ch.title}` })))]}
            />
            <Pickr
              label={s('课时', '課時', 'Lesson')}
              value={lessonId}
              disabled={!chapter}
              onChange={setLessonId}
              options={[{ v: '', label: '— 请选 —' }, ...((chapter?.lessons ?? []).map((l) => ({ v: l.id, label: `第 ${l.order} 课 · ${l.title}` })))]}
            />
          </div>

          {/* 课时原文预览 */}
          {chapter && lessonId && (
            <details style={{ marginTop: 'var(--sp-3)' }}>
              <summary style={{ cursor: 'pointer', font: 'var(--text-caption)', color: 'var(--saffron-dark)', letterSpacing: 1 }}>
                {s('▸ 查看课时原文', '▸ 查看課時原文', '▸ Reference text')}
              </summary>
              <div style={{ marginTop: 8, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--glass)', borderRadius: 'var(--r)', font: 'var(--text-body-serif)', color: 'var(--ink-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto' }}>
                {chapter.lessons.find((l) => l.id === lessonId)?.referenceText || s('（无原文）', '（無原文）', '(none)')}
              </div>
            </details>
          )}
        </Section>

        {/* 题干 */}
        <Section title={s('题干', '題幹', 'Question')}>
          <TextArea value={questionText} onChange={setQText} rows={3} placeholder={s('请输入题干（≥ 4 字）', '請輸入題幹（≥ 4 字）', 'Enter question (≥ 4 chars)')} />
        </Section>

        {/* 类型特定 payload 编辑器 */}
        <Section title={s('题型内容', '題型內容', 'Type-specific payload')}>
          <PayloadEditor type={type} value={payload} onChange={setPayload} />
        </Section>

        {/* 解析 */}
        <Section title={s('解析（可选）', '解析（可選）', 'Explanation (optional)')}>
          <TextArea value={correctText} onChange={setCText} rows={3} placeholder={s('正确答案 / 解析', '正確答案 / 解析', 'Correct answer / explanation')} />
          <div style={{ height: 'var(--sp-2)' }} />
          <TextArea value={wrongText} onChange={setWText} rows={2} placeholder={s('易错点 / 常见错误', '易錯點 / 常見錯誤', 'Common mistakes')} />
        </Section>

        {/* 元数据 */}
        <Section title={s('元数据', '元數據', 'Metadata')}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--sp-3)' }}>
            <Inp label={s('出处', '出處', 'Source')} value={source} onChange={setSource} placeholder="《入菩萨行论》第一品" />
            <Inp label={s('难度 (1-5)', '難度 (1-5)', 'Difficulty')} type="number" value={String(difficulty)} onChange={(v) => setDiff(Math.max(1, Math.min(5, Number(v) || 1)))} />
            <Pickr
              label={s('可见性', '可見性', 'Visibility')}
              value={visibility}
              onChange={(v) => setVisibility(v as Visibility)}
              options={[
                { v: 'public', label: s('公共（待审）', '公共（待審）', 'Public (pending)') },
                { v: 'class_private', label: s('班级（无需审核）', '班級（無需審核）', 'Class (no review)') },
              ]}
            />
          </div>
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <Inp label={s('标签（逗号分隔）', '標籤（逗號分隔）', 'Tags (comma)')} value={tags} onChange={setTags} placeholder="菩提心, 入门" />
          </div>
        </Section>

        {/* submit */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
            {s('取消', '取消', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={!valid || submit.isPending}
            onClick={() => submit.mutate()}
            className="btn btn-primary btn-pill"
            style={{ flex: 2, padding: 12, justifyContent: 'center', opacity: valid ? 1 : 0.5 }}
          >
            {submit.isPending ? '…' : s('创建', '創建', 'Create')}
          </button>
        </div>

        {courses.isLoading && <Skeleton.LineSm />}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// 各题型 payload 工厂 / 校验 / 归一化
// ─────────────────────────────────────────────
function emptyPayload(t: QuestionType): Record<string, unknown> {
  switch (t) {
    case 'single':
    case 'multi':
      return { options: [{ text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }] };
    case 'fill':
      return { verseLines: [''], correctWord: '', options: ['', '', '', ''], verseSource: '' };
    case 'open':
      return { referenceAnswer: '', keyPoints: [{ point: '', signals: '' }], minLength: 80, maxLength: 400 };
    case 'sort':
      return { itemsText: '' }; // 用单一 textarea 暂存
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
    case 'open': {
      const kps = (p.keyPoints as { point: string }[]) ?? [];
      return (p.referenceAnswer as string).trim().length >= 10 && kps.filter((k) => k.point.trim()).length >= 1;
    }
    case 'sort': {
      const lines = ((p.itemsText as string) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.length >= 2;
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
    case 'sort': {
      const lines = ((p.itemsText as string) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      return { items: lines.map((text, i) => ({ text, order: i + 1 })) };
    }
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
      return {};
  }
}

// ─────────────────────────────────────────────
// PayloadEditor 分发
// ─────────────────────────────────────────────
function PayloadEditor({ type, value, onChange }: {
  type: QuestionType;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  switch (type) {
    case 'single':
    case 'multi':
      return <ChoiceEditor multi={type === 'multi'} value={value} onChange={onChange} />;
    case 'fill':
      return <FillEditor value={value} onChange={onChange} />;
    case 'open':
      return <OpenEditor value={value} onChange={onChange} />;
    case 'sort':
      return <SortEditor value={value} onChange={onChange} />;
    case 'match':
      return <MatchEditor value={value} onChange={onChange} />;
    case 'flip':
      return <FlipEditor value={value} onChange={onChange} />;
    default:
      return <p>不支持的题型 {type}</p>;
  }
}

function ChoiceEditor({ multi, value, onChange }: { multi: boolean; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  const opts = (value.options as { text: string; correct: boolean }[]) ?? [];

  function update(i: number, patch: Partial<{ text: string; correct: boolean }>) {
    const next = opts.map((o, idx) => idx === i ? { ...o, ...patch } : (multi ? o : { ...o, correct: patch.correct === true ? false : o.correct }));
    if (!multi && patch.correct === true) {
      // 单选：互斥
      onChange({ options: next.map((o, idx) => ({ ...o, correct: idx === i })) });
    } else {
      onChange({ options: next });
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
    <>
      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 'var(--sp-2)' }}>
        {multi ? s('多选 · 至少 2 项 · 至少 2 个正确', '多選 · 至少 2 項 · 至少 2 個正確', 'Multi · ≥ 2 options · ≥ 2 correct') : s('单选 · 至少 2 项 · 仅 1 个正确', '單選 · 至少 2 項 · 僅 1 個正確', 'Single · ≥ 2 options · 1 correct')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {opts.map((o, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              name="choice-correct"
              checked={!!o.correct}
              onChange={(e) => update(i, { correct: e.target.checked })}
              aria-label={s('标记正确', '標記正確', 'Mark correct')}
            />
            <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 20 }}>{String.fromCharCode(65 + i)}.</span>
            <input
              type="text"
              value={o.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder={s('选项文本', '選項文本', 'Option text')}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', font: 'var(--text-body)', outline: 'none' }}
            />
            <button type="button" onClick={() => removeRow(i)} disabled={opts.length <= 2} aria-label={s('删除', '刪除', 'Remove')} style={{ background: 'transparent', border: 'none', color: opts.length <= 2 ? 'var(--ink-4)' : 'var(--crimson)', cursor: 'pointer', padding: 4 }}>✕</button>
          </div>
        ))}
        {opts.length < 8 && (
          <button type="button" onClick={addRow} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed var(--glass-border)', borderRadius: 'var(--r-sm)', padding: '6px 12px', color: 'var(--saffron-dark)', font: 'var(--text-caption)', cursor: 'pointer' }}>
            + {s('添加选项', '添加選項', 'Add option')}
          </button>
        )}
      </div>
    </>
  );
}

function FillEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  const lines = (value.verseLines as string[]) ?? [''];
  const opts = (value.options as string[]) ?? [];
  return (
    <>
      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 'var(--sp-2)' }}>
        {s('用 ___（3 个下划线）标记空位 · 至少一行包含', '用 ___（3 個下劃線）標記空位 · 至少一行包含', 'Use ___ (3 underscores) to mark blank · at least one line')}
      </p>
      <TextArea
        value={lines.join('\n')}
        onChange={(v) => onChange({ ...value, verseLines: v.split('\n') })}
        rows={3}
        placeholder="未生菩提心者令___\n已生菩提心者令增长"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
        <Inp label={s('正确填空', '正確填空', 'Correct word')} value={(value.correctWord as string) ?? ''} onChange={(v) => onChange({ ...value, correctWord: v })} />
        <Inp label={s('出处（可选）', '出處（可選）', 'Source (opt)')} value={(value.verseSource as string) ?? ''} onChange={(v) => onChange({ ...value, verseSource: v })} />
      </div>
      <div style={{ marginTop: 'var(--sp-2)' }}>
        <Inp label={s('选项（逗号分隔 ≥ 2 个）', '選項（逗號分隔 ≥ 2 個）', 'Options (≥ 2, comma)')} value={opts.join(', ')} onChange={(v) => onChange({ ...value, options: v.split(',').map((x) => x.trim()) })} placeholder="生起, 增长, 圆满, 成就" />
      </div>
    </>
  );
}

function OpenEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  const kps = (value.keyPoints as { point: string; signals: string }[]) ?? [{ point: '', signals: '' }];
  function setKp(i: number, patch: Partial<{ point: string; signals: string }>) {
    onChange({ ...value, keyPoints: kps.map((k, idx) => idx === i ? { ...k, ...patch } : k) });
  }
  function addKp() {
    if (kps.length >= 8) return;
    onChange({ ...value, keyPoints: [...kps, { point: '', signals: '' }] });
  }
  function removeKp(i: number) {
    if (kps.length <= 1) return;
    onChange({ ...value, keyPoints: kps.filter((_, idx) => idx !== i) });
  }
  return (
    <>
      <TextArea
        value={(value.referenceAnswer as string) ?? ''}
        onChange={(v) => onChange({ ...value, referenceAnswer: v })}
        rows={3}
        placeholder={s('参考答案（≥ 10 字）', '參考答案（≥ 10 字）', 'Reference answer (≥ 10 chars)')}
      />
      <div style={{ marginTop: 'var(--sp-3)', font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
        {s('关键点（每条 = 一分 · 命中信号词加分）', '關鍵點（每條 = 一分 · 命中信號詞加分）', 'Key points (1 = 1 point; signals trigger scoring)')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {kps.map((k, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 32px', gap: 8, alignItems: 'center' }}>
            <input value={k.point} onChange={(e) => setKp(i, { point: e.target.value })} placeholder={s(`关键点 ${i + 1}`, `關鍵點 ${i + 1}`, `Point ${i + 1}`)} style={inputStyle} />
            <input value={k.signals} onChange={(e) => setKp(i, { signals: e.target.value })} placeholder={s('信号词（逗号分隔）', '信號詞（逗號分隔）', 'Signals (comma)')} style={inputStyle} />
            <button type="button" onClick={() => removeKp(i)} disabled={kps.length <= 1} style={{ background: 'transparent', border: 'none', color: kps.length <= 1 ? 'var(--ink-4)' : 'var(--crimson)', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        {kps.length < 8 && (
          <button type="button" onClick={addKp} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed var(--glass-border)', borderRadius: 'var(--r-sm)', padding: '6px 12px', color: 'var(--saffron-dark)', font: 'var(--text-caption)', cursor: 'pointer' }}>
            + {s('添加关键点', '添加關鍵點', 'Add point')}
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
        <Inp label={s('最少字数', '最少字數', 'Min length')} type="number" value={String(value.minLength ?? 80)} onChange={(v) => onChange({ ...value, minLength: Number(v) || 80 })} />
        <Inp label={s('最多字数', '最多字數', 'Max length')} type="number" value={String(value.maxLength ?? 400)} onChange={(v) => onChange({ ...value, maxLength: Number(v) || 400 })} />
      </div>
    </>
  );
}

function SortEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  return (
    <>
      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 'var(--sp-2)' }}>
        {s('每行一条 · 按当前顺序作为正确顺序（学员看到的是打乱）', '每行一條 · 按當前順序作為正確順序', 'One item per line; current order = correct order (shuffled for students)')}
      </p>
      <TextArea value={(value.itemsText as string) ?? ''} onChange={(v) => onChange({ ...value, itemsText: v })} rows={5} placeholder="第一步\n第二步\n第三步" />
    </>
  );
}

function MatchEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  return (
    <>
      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 'var(--sp-2)' }}>
        {s('每行一对 · 格式 "左 = 右"', '每行一對 · 格式 "左 = 右"', 'One pair per line · format "left = right"')}
      </p>
      <TextArea value={(value.pairsText as string) ?? ''} onChange={(v) => onChange({ ...value, pairsText: v })} rows={5} placeholder="戒 = 防非止恶\n定 = 心一境性\n慧 = 决择诸法" />
    </>
  );
}

function FlipEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { s } = useLang();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
      <Inp label={s('正面 · 主文', '正面 · 主文', 'Front · main')} value={(value.front as string) ?? ''} onChange={(v) => onChange({ ...value, front: v })} />
      <Inp label={s('正面 · 副文（可选）', '正面 · 副文（可選）', 'Front · sub (opt)')} value={(value.frontSub as string) ?? ''} onChange={(v) => onChange({ ...value, frontSub: v })} />
      <Inp label={s('背面 · 主文', '背面 · 主文', 'Back · main')} value={(value.back as string) ?? ''} onChange={(v) => onChange({ ...value, back: v })} />
      <Inp label={s('背面 · 例句（可选）', '背面 · 例句（可選）', 'Back · example (opt)')} value={(value.backExample as string) ?? ''} onChange={(v) => onChange({ ...value, backExample: v })} />
    </div>
  );
}

// ─────────────────────────────────────────────
// 通用 widgets
// ─────────────────────────────────────────────
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

function Inp({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function TextArea({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      style={{ ...inputStyle, resize: 'vertical' }}
    />
  );
}

function Pickr({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; label: string }[]; disabled?: boolean }) {
  return (
    <div>
      <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={{ ...inputStyle, opacity: disabled ? 0.5 : 1 }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--ink)',
  font: 'var(--text-body)',
  outline: 'none',
};
