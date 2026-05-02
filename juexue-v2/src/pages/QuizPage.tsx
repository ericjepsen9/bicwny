// QuizPage · /quiz/:lessonId?courseId=&slug=&from=
//   核心答题流：
//   1. 拉本课时所有题目
//   2. 状态机：当前题序 / 答案值 / 已确认 / 反馈 / 完成态
//   3. 提交单题 → POST /api/answers · 后端实算 · 返回 grade
//   4. 全部完成 → 显示结果 overlay · PATCH 报名进度（如已报名）
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import QuestionRenderer, { canSubmit } from '@/components/quiz';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { selection, notification } from '@/lib/haptics';
import { useLang } from '@/lib/i18n';
import { useEnrollments, useLessonQuestions } from '@/lib/queries';
import { toast } from '@/lib/toast';

interface Grade {
  isCorrect: boolean | null;
  score: number | null;
  feedback: string;
}

interface SubmitResult {
  grade: Grade;
  question?: { id: string; payload: Record<string, unknown> };
}

export default function QuizPage() {
  const { s } = useLang();
  const params = useParams<{ lessonId: string }>();
  const lessonId = params.lessonId || '';
  const [search] = useSearchParams();
  const courseId = search.get('courseId') || '';
  const slug = search.get('slug') || '';
  const from = search.get('from') || '';
  const nextLessonId = search.get('nextLessonId') || '';
  const nav = useNavigate();
  const qc = useQueryClient();

  const questions = useLessonQuestions(lessonId);
  const enrollments = useEnrollments();

  // 当前题索引
  const [qi, setQi] = useState(0);
  // 当前题答案 · key=qi
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  // 已确认 · key=qi · 包含后端 grade
  const [grades, setGrades] = useState<Record<number, Grade>>({});
  // 单题提交后 update 的题目（payload 含正确答案）
  const [enriched, setEnriched] = useState<Record<number, Record<string, unknown>>>({});
  // 已显示完成 overlay
  const [done, setDone] = useState(false);

  const list = questions.data ?? [];
  const total = list.length;
  const current = list[qi];

  // 当用户切到新课时 · 重置
  useEffect(() => {
    setQi(0);
    setAnswers({});
    setGrades({});
    setEnriched({});
    setDone(false);
  }, [lessonId]);

  // 渲染时把 enriched.payload 合并进 question
  const displayQuestion = useMemo(() => {
    if (!current) return null;
    const e = enriched[qi];
    if (!e) return current;
    return { ...current, payload: { ...current.payload, ...e } };
  }, [current, enriched, qi]);

  const confirmed = grades[qi] !== undefined;

  const submit = useMutation<SubmitResult, ApiError, void>({
    mutationFn: async () => {
      if (!current) throw new ApiError('No question', 0);
      return api.post<SubmitResult>('/api/answers', {
        questionId: current.id,
        answer: answers[qi] ?? null,
        timeSpentMs: 0,
        requestId: cryptoRandom(),
      });
    },
    onSuccess: (data) => {
      setGrades((g) => ({ ...g, [qi]: data.grade }));
      if (data.question?.payload) {
        setEnriched((e) => ({ ...e, [qi]: data.question!.payload }));
      }
      const ok = data.grade.isCorrect;
      if (ok === true) notification('success');
      else if (ok === false) notification('error');
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  function next() {
    if (qi < total - 1) {
      setQi(qi + 1);
      selection();
    } else {
      finish();
    }
  }

  async function finish() {
    setDone(true);
    // 算正确数
    const correct = Object.values(grades).filter((g) => g.isCorrect === true).length;
    const enrolledHere = (enrollments.data ?? []).some((e) => e.courseId === courseId);
    if (lessonId && courseId && enrolledHere) {
      try {
        await api.patch('/api/enrollments/' + encodeURIComponent(courseId) + '/progress', {
          addCompletedLessonId: lessonId,
          currentLessonId: lessonId,
        });
        qc.invalidateQueries({ queryKey: ['/api/my/enrollments'] });
        qc.invalidateQueries({ queryKey: ['/api/my/progress'] });
      } catch {
        // 静默 · 完成态已显示
      }
    }
    qc.invalidateQueries({ queryKey: ['/api/mistakes'] });
    qc.invalidateQueries({ queryKey: ['/api/sm2/stats'] });
    notification('success');
    toast.ok(s(
      `正确 ${correct} / ${total}`,
      `正確 ${correct} / ${total}`,
      `Correct ${correct} / ${total}`,
    ));
  }

  function backToSource() {
    if (from === 'reading' && slug) nav(`/read/${slug}/${lessonId}`, { replace: true });
    else if (from === 'detail' && slug) nav(`/scripture-detail?slug=${encodeURIComponent(slug)}`, { replace: true });
    else nav('/quiz', { replace: true });
  }

  if (questions.isLoading) {
    return (
      <div style={{ padding: 'var(--sp-5)' }}>
        <Skeleton.Card />
      </div>
    );
  }

  if (questions.isError) {
    return (
      <div style={{ padding: 'var(--sp-7) var(--sp-5)', textAlign: 'center' }}>
        <p style={{ color: 'var(--crimson)' }}>{(questions.error as ApiError).message}</p>
        <button type="button" onClick={() => nav(-1)} className="btn btn-pill" style={{ marginTop: 16, padding: '8px 18px' }}>
          {s('返回', '返回', 'Back')}
        </button>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div style={{ padding: 'var(--sp-7) var(--sp-5)', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-3)', fontSize: '1.125rem', marginBottom: 16 }}>📭</p>
        <p style={{ color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: 'var(--sp-4)' }}>
          {s('本课时尚无题目', '本課時尚無題目', 'No questions for this lesson yet')}
        </p>
        <button type="button" onClick={backToSource} className="btn btn-primary btn-pill" style={{ padding: '10px 24px' }}>
          {s('返回', '返回', 'Back')}
        </button>
      </div>
    );
  }

  if (done) {
    const correct = Object.values(grades).filter((g) => g.isCorrect === true).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div style={{ padding: 'var(--sp-8) var(--sp-5)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <div style={{ fontSize: '4rem' }}>{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--ink)', letterSpacing: 4 }}>
          {s('完成', '完成', 'Done')}
        </h1>
        <p style={{ font: 'var(--text-body)', color: 'var(--ink-2)', letterSpacing: 1 }}>
          {s(`正确 ${correct} / ${total} · ${pct}%`,
              `正確 ${correct} / ${total} · ${pct}%`,
              `${correct} / ${total} · ${pct}%`)}
        </p>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
          {nextLessonId && slug && (
            <button
              type="button"
              onClick={() => nav(`/read/${slug}/${nextLessonId}`, { replace: true })}
              className="btn btn-primary btn-pill"
              style={{ padding: '10px 24px' }}
            >
              {s('下一课', '下一課', 'Next lesson')}
            </button>
          )}
          <button
            type="button"
            onClick={backToSource}
            className="btn btn-pill"
            style={{ padding: '10px 24px', background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
          >
            {s('返回', '返回', 'Back')}
          </button>
        </div>
      </div>
    );
  }

  if (!current || !displayQuestion) return null;

  const grade = grades[qi];
  const ok = grade?.isCorrect;
  const showFeedback = confirmed && current.type !== 'flip';

  return (
    <div>
      {/* Header · 进度 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-5)' }}>
        <button
          type="button"
          className="nav-back"
          onClick={backToSource}
          aria-label={s('返回', '返回', 'Back')}
        >
          <svg width="18" height="18" fill="none" stroke="#55463A" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 4 }}>
            <span>{qi + 1} / {total}</span>
            <span>{s('正确率', '正確率', 'Accuracy')} {Object.values(grades).length > 0 ? Math.round(Object.values(grades).filter((g) => g.isCorrect).length / Object.values(grades).length * 100) : 0}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: 'var(--saffron)',
                width: `${((qi + (confirmed ? 1 : 0)) / total) * 100}%`,
                transition: 'width .4s var(--ease)',
              }}
            />
          </div>
        </div>
      </div>

      {/* 题卡 */}
      <div style={{ padding: 'var(--sp-4) var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', position: 'relative' }}>
          <span
            style={{
              display: 'inline-block',
              font: 'var(--text-caption)',
              fontWeight: 700,
              color: 'var(--saffron)',
              background: 'var(--saffron-pale)',
              border: '1px solid var(--saffron-light)',
              borderRadius: 'var(--r-pill)',
              padding: '2px 10px',
              letterSpacing: 1,
              marginBottom: 'var(--sp-3)',
            }}
          >
            {typeLabel(current.type)}
          </span>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginBottom: 'var(--sp-2)' }}>Q{qi + 1}</div>
          <div style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', lineHeight: 1.7 }}>
            {current.questionText}
          </div>
        </div>

        <QuestionRenderer
          question={displayQuestion}
          value={answers[qi] ?? null}
          onChange={(v) => setAnswers((a) => ({ ...a, [qi]: v }))}
          confirmed={confirmed}
          grade={grade}
        />

        {/* Feedback */}
        {showFeedback && grade && (
          <div
            style={{
              borderRadius: 'var(--r-xl)',
              padding: 'var(--sp-4) var(--sp-5)',
              font: 'var(--text-caption)',
              lineHeight: 1.7,
              background: ok ? 'var(--sage-light)' : 'var(--crimson-light)',
              border: '1px solid ' + (ok ? 'var(--sage)' : 'var(--crimson-light)'),
            }}
          >
            <div style={{ fontWeight: 700, color: ok ? 'var(--sage-dark)' : 'var(--crimson)', marginBottom: 'var(--sp-2)' }}>
              {ok ? s('✓ 回答正确', '✓ 回答正確', '✓ Correct') : s('✗ 回答有误', '✗ 回答有誤', '✗ Incorrect')}
              {grade.score !== null && grade.score !== undefined && ` · ${s('得分', '得分', 'Score')} ${grade.score}`}
            </div>
            <div style={{ color: 'var(--ink-2)' }}>
              {grade.feedback || s('请参考法本原文', '請參考法本原文', 'Refer to the source text')}
            </div>
          </div>
        )}

        {/* Action */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', paddingBottom: 'var(--sp-8)' }}>
          {!confirmed ? (
            <button
              type="button"
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !canSubmit(current.type, answers[qi])}
              className="btn btn-primary btn-lg btn-pill btn-full"
              style={{ flex: 1, justifyContent: 'center', padding: 14 }}
            >
              {submit.isPending
                ? s('提交中…', '提交中…', 'Submitting…')
                : current.type === 'flip'
                  ? s('继续', '繼續', 'Continue')
                  : s('提交答案', '提交答案', 'Submit')}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="btn btn-primary btn-lg btn-pill btn-full"
              style={{ flex: 1, justifyContent: 'center', padding: 14 }}
            >
              {qi < total - 1
                ? s('下一题', '下一題', 'Next')
                : s('完成', '完成', 'Finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function typeLabel(t: string): string {
  return ({
    single: '单选', multi: '多选', fill: '填空', open: '问答',
    sort: '排序', match: '匹配', flip: '速记卡',
  } as Record<string, string>)[t] || t;
}

function cryptoRandom(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}
