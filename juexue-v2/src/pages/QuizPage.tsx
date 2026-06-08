// QuizPage · /quiz/:lessonId?courseId=&slug=&from=
//   核心答题流：
//   1. 拉本课时所有题目
//   2. 状态机：当前题序 / 答案值 / 已确认 / 反馈 / 完成态
//   3. 提交单题 → POST /api/answers · 后端实算 · 返回 grade
//   4. 全部完成 → 显示结果 overlay · PATCH 报名进度（如已报名）
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import QuestionRenderer, { canSubmit } from '@/components/quiz';
import { displayQuestionText } from '@/lib/questionText';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { selection, notification } from '@/lib/haptics';
import { useLang } from '@/lib/i18n';
import { useEnrollments, useLessonMeditation, useLessonQuestions, useProgress, useSmartPractice } from '@/lib/queries';
import { toast } from '@/lib/toast';

interface Grade {
  isCorrect: boolean | null;
  score: number | null;
  feedback: string;
}

interface SubmitResult {
  grade: Grade;
  question?: {
    id: string;
    payload: Record<string, unknown>;
    correctText?: string;
    wrongText?: string;
  };
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
  const questionId = search.get('questionId') || '';
  const nav = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  // 智能练习模式 · /quiz-practice 路由（无 lessonId）· 题集来自 smart-practice 后端
  const isPractice = location.pathname === '/quiz-practice';
  const practiceLimit = Math.max(1, Math.min(50, Number(search.get('limit')) || 10));
  const practiceCourseId = search.get('courseId') || undefined;
  const practiceOnlyMistakes = search.get('onlyMistakes') === '1' || search.get('onlyMistakes') === 'true';
  const practiceSingleQid = search.get('questionId') || undefined;

  const lessonQuestions = useLessonQuestions(isPractice ? null : lessonId);
  const practiceQuestions = useSmartPractice({
    enabled: isPractice,
    limit: practiceLimit,
    courseId: practiceCourseId,
    onlyMistakes: practiceOnlyMistakes,
    questionId: practiceSingleQid,
  });
  const questions = isPractice ? practiceQuestions : lessonQuestions;

  const enrollments = useEnrollments();
  const progress = useProgress();
  // 答题完成时显示「进入观修」CTA · 拉关联观修（无则 null）
  const lessonMeditation = useLessonMeditation(lessonId);
  // 进入答题前的"今日已答" · 用于判断本次完成是否触发首日打卡
  const [enterTodayAnswered] = useState(() => progress.data?.todayAnswered ?? 0);

  // 当前题索引
  const [qi, setQi] = useState(0);
  // 当前题答案 · key=qi
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  // 已确认 · key=qi · 包含后端 grade
  const [grades, setGrades] = useState<Record<number, Grade>>({});
  // 单题提交后 update 的题目（payload 含正确答案）
  const [enriched, setEnriched] = useState<Record<number, Record<string, unknown>>>({});
  // 答完后 admin 写的「正确解析 / 错误解析」
  const [explanations, setExplanations] = useState<Record<number, { correctText?: string; wrongText?: string }>>({});
  // 已显示完成 overlay
  const [done, setDone] = useState(false);

  const list = questions.data ?? [];
  // 错题立即重练 · playQueue 是 list 索引序列 · 默认顺序播放
  // 答错时把当前题索引插到 qi+3 位置（再次复习），答对时不动
  // 同一题第二次出现 · grades/answers 按 qi 计 · 状态自然分离
  const [playQueue, setPlayQueue] = useState<number[]>([]);
  // queue 跟随 list 重置（新课时/新练习集）
  useEffect(() => {
    setPlayQueue(list.map((_, i) => i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, lessonId, isPractice, practiceCourseId, practiceLimit, practiceOnlyMistakes, practiceSingleQid]);
  const total = playQueue.length;
  const current = list[playQueue[qi] ?? -1];
  // 当前题是否「重练插入」(qi 之前已经出现过同一题)
  const isRetry = playQueue.slice(0, qi).includes(playQueue[qi] ?? -1);

  // 当用户切到新课时 · 或新练习集 · 重置
  useEffect(() => {
    setQi(0);
    setAnswers({});
    setGrades({});
    setEnriched({});
    setExplanations({});
    setDone(false);
  }, [lessonId, isPractice, practiceCourseId, practiceLimit, practiceOnlyMistakes, practiceSingleQid]);

  // 渲染时把 enriched.payload 合并进 question
  const displayQuestion = useMemo(() => {
    if (!current) return null;
    const e = enriched[qi];
    if (!e) return current;
    return { ...current, payload: { ...current.payload, ...e } };
  }, [current, enriched, qi]);

  const confirmed = grades[qi] !== undefined;

  // 汇总按「不同题首次作答」计 · 答错重练（同题再次入队）不重复计数、不污染正确率
  // 注：进度条用的 total=playQueue.length 不动（那是答题位置进度，含重练是对的）
  const stats = useMemo(() => {
    const firstByQ = new Map<number, Grade>();
    playQueue.forEach((qIdx, pos) => {
      const g = grades[pos];
      if (g && !firstByQ.has(qIdx)) firstByQ.set(qIdx, g);
    });
    const vals = [...firstByQ.values()];
    const correct = vals.filter((g) => g.isCorrect === true).length;
    const wrong = vals.filter((g) => g.isCorrect === false).length;
    const answered = vals.length;
    return { correct, wrong, answered, pct: answered > 0 ? Math.round((correct / answered) * 100) : 0 };
  }, [playQueue, grades]);

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
      if (data.question) {
        setExplanations((m) => ({
          ...m,
          [qi]: {
            correctText: data.question!.correctText,
            wrongText: data.question!.wrongText,
          },
        }));
      }
      const ok = data.grade.isCorrect;
      if (ok === true) notification('success');
      else if (ok === false) {
        notification('error');
        // 错题立即重练 · 把当前题索引塞进 qi+3 位置（一题缓冲再现）
        // 多邻国式：让答错的题在短记忆里再过一遍
        // 注意：第二次答错会再次插入 · 直到答对为止 · 上限 5 次保护
        const baseIdx = playQueue[qi];
        if (baseIdx !== undefined) {
          const repeats = playQueue.filter((i) => i === baseIdx).length;
          if (repeats < 5) {
            const insertAt = Math.min(qi + 3, playQueue.length);
            setPlayQueue((q) => {
              const next = [...q];
              next.splice(insertAt, 0, baseIdx);
              return next;
            });
          }
        }
      }
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
    const correct = stats.correct;
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
    // 首日打卡判定：进入时今日已答=0 + 本次完成 · 弹 🔥 toast
    if (enterTodayAnswered === 0 && total > 0) {
      // 先弹分数 toast · 再延迟弹打卡 toast（避免同时叠加）
      toast.ok(s(
        `正确 ${correct} / ${stats.answered}`,
        `正確 ${correct} / ${stats.answered}`,
        `Correct ${correct} / ${stats.answered}`,
      ));
      setTimeout(() => {
        toast.ok(s(
          '🔥 今日打卡 +1 · 连续学习中',
          '🔥 今日打卡 +1 · 連續學習中',
          '🔥 Daily check-in +1',
        ));
      }, 800);
    } else {
      toast.ok(s(
        `正确 ${correct} / ${stats.answered}`,
        `正確 ${correct} / ${stats.answered}`,
        `Correct ${correct} / ${stats.answered}`,
      ));
    }
  }

  function backToSource() {
    // /practice 智能练习返回逻辑：按入口分流
    //   onlyMistakes  → /mistakes（错题中心）
    //   questionId    → /mistake/:id（单题详情）
    //   courseId      → /quiz（复习中心 · 「按闻思练习」入口）
    //   其他          → /（首页 · 智能练习卡入口）
    if (isPractice) {
      if (practiceOnlyMistakes) nav('/mistakes', { replace: true });
      else if (practiceSingleQid) nav(`/mistake/${encodeURIComponent(practiceSingleQid)}`, { replace: true });
      else if (practiceCourseId) nav('/quiz', { replace: true });
      else nav('/', { replace: true });
      return;
    }
    if (from === 'reading' && slug) nav(`/read/${slug}/${lessonId}`, { replace: true });
    else if (from === 'detail' && slug) nav(`/scripture-detail?slug=${encodeURIComponent(slug)}`, { replace: true });
    else if (from === 'mistake') nav(questionId ? `/mistake/${encodeURIComponent(questionId)}` : '/mistakes', { replace: true });
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
    return <ErrorState error={questions.error} onRetry={() => questions.refetch()} />;
  }

  if (total === 0) {
    return (
      <EmptyState
        icon={isPractice && practiceOnlyMistakes ? '🌿' : '📭'}
        title={
          isPractice
            ? practiceOnlyMistakes
              ? s('错题本暂时无题', '錯題本暫時無題', 'No mistakes to review')
              : s('暂无可练习的题目', '暫無可練習的題目', 'Nothing to practice yet')
            : s('本课时尚无题目', '本課時尚無題目', 'No questions for this lesson yet')
        }
        hint={
          isPractice && practiceOnlyMistakes
            ? s('太棒了', '太棒了', 'Awesome')
            : isPractice
              ? s('先去学习一些课时', '先去學習一些課時', 'Study some lessons first')
              : undefined
        }
        cta={
          <button type="button" onClick={backToSource} className="btn btn-primary btn-pill" style={{ padding: '10px 24px' }}>
            {s('返回', '返回', 'Back')}
          </button>
        }
      />
    );
  }

  if (done) {
    const { correct, wrong, pct } = stats;
    const title = pct >= 80
      ? s('太棒了', '太棒了', 'Excellent')
      : pct >= 50
        ? s('继续加油', '繼續加油', 'Keep going')
        : s('再来一次', '再來一次', 'Try again');
    // 圆环 SVG · 半径 50 · 周长 314
    const ringR = 50;
    const ringC = 2 * Math.PI * ringR;
    const ringFilled = (pct / 100) * ringC;
    const ringColor = pct >= 80 ? 'var(--sage-dark)' : pct >= 50 ? 'var(--saffron)' : 'var(--crimson)';
    return (
      <div style={{ padding: 'var(--sp-8) var(--sp-5)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-5)' }}>
        {/* 120×120 圆环 · 内显百分比 */}
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }} aria-hidden>
            <circle cx="60" cy="60" r={ringR} fill="none" stroke="var(--border-light)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r={ringR}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={ringC}
              strokeDashoffset={ringC - ringFilled}
              style={{ transition: 'stroke-dashoffset .6s var(--ease)' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--ink)' }}>
              {pct}%
            </span>
            <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2 }}>
              {s('正确率', '正確率', 'Accuracy')}
            </span>
          </div>
        </div>

        {/* 大标题 */}
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--ink)', letterSpacing: 4 }}>
          {title}
        </h1>

        {/* 三栏 stat */}
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', gap: 0, alignItems: 'center', maxWidth: 320, width: '100%' }}>
          <DoneStat val={String(correct)} label={s('答对', '答對', 'Right')} color="var(--sage-dark)" />
          <DoneSep />
          <DoneStat val={String(wrong)} label={s('答错', '答錯', 'Wrong')} color="var(--crimson)" />
          <DoneSep />
          <DoneStat val={String(total)} label={s('总数', '總數', 'Total')} />
        </div>

        {/* 「闻思修」教学闭环 CTA · 多选项 · 主 CTA 优先级:
            进入观修 (修是稀缺入口 · 应该 highlight) > 下一课 > 回到本课
            返回首页始终最弱 · 玻璃质感 */}
        <DoneCtaList
          slug={slug}
          lessonId={lessonId}
          nextLessonId={nextLessonId}
          fromReading={from === 'reading'}
          meditationId={lessonMeditation.data?.id ?? null}
          onNavigate={(to) => nav(to, { replace: true })}
        />
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
            <span>{s('正确率', '正確率', 'Accuracy')} {stats.pct}%</span>
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
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Q{qi + 1}</span>
            {isRetry && (
              <span style={{ padding: '1px 8px', borderRadius: 'var(--r-pill)', background: 'var(--gold-pale)', color: 'var(--gold-dark)', fontWeight: 700, letterSpacing: 1 }}>
                ↺ {s('重练', '重練', 'Retry')}
              </span>
            )}
          </div>
          <div style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', lineHeight: 1.7 }}>
            {displayQuestionText(current, s)}
          </div>
        </div>

        <QuestionRenderer
          key={current.id}
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
            <div style={{ color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
              {(() => {
                const exp = explanations[qi];
                // admin 写的解析优先（按答对/答错分流）· grade.feedback 兜底（如部分得分提示）· 都没有再 fallback
                const adminText = ok ? exp?.correctText : exp?.wrongText;
                if (adminText && adminText.trim()) return adminText;
                if (grade.feedback) return grade.feedback;
                return s('请参考闻思原文', '請參考聞思原文', 'Refer to the source text');
              })()}
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

function DoneStat({ val, label, color }: { val: string; label: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: color ?? 'var(--ink)', lineHeight: 1.2 }}>
        {val}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function DoneSep() {
  return <div style={{ background: 'var(--border-light)', justifySelf: 'center', height: 28, width: 1 }} />;
}

/**
 * 答题完成「闻思修」教学闭环 CTA 列表
 * 主 CTA 优先级（择一变 primary 橙色）:
 *   1. 进入观修（修是稀缺入口 · 应该 highlight）
 *   2. 下一课（推进 · 自然学修流）
 *   3. 回到本课阅读（复习 · 兜底）
 * 其它 CTA 用 glass 质感 · 返回首页总是最弱
 */
function DoneCtaList({
  slug,
  lessonId,
  nextLessonId,
  fromReading,
  meditationId,
  onNavigate,
}: {
  slug: string;
  lessonId: string;
  nextLessonId: string;
  fromReading: boolean;
  meditationId: string | null;
  onNavigate: (to: string) => void;
}) {
  const { s } = useLang();

  type Cta = { key: string; emoji: string; label: string; to: string };
  const ctas: Cta[] = [];

  // 1. 进入观修 (主 CTA 候选)
  if (meditationId) {
    ctas.push({
      key: 'meditation',
      emoji: '🧘',
      label: s('进入观修', '進入觀修', 'Meditation'),
      to: `/meditation/${encodeURIComponent(meditationId)}`,
    });
  }

  // 2. 下一课
  if (nextLessonId && slug) {
    ctas.push({
      key: 'next',
      emoji: '→',
      label: s('下一课', '下一課', 'Next lesson'),
      to: `/read/${encodeURIComponent(slug)}/${encodeURIComponent(nextLessonId)}`,
    });
  }

  // 3. 回到本课阅读 (仅来自阅读页时显示)
  if (fromReading && slug && lessonId) {
    ctas.push({
      key: 'reading',
      emoji: '📖',
      label: s('回到本课', '回到本課', 'Back to lesson'),
      to: `/read/${encodeURIComponent(slug)}/${encodeURIComponent(lessonId)}`,
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
        width: '100%',
        maxWidth: 320,
        marginTop: 'var(--sp-2)',
      }}
    >
      {ctas.map((cta, i) => (
        <button
          key={cta.key}
          type="button"
          onClick={() => onNavigate(cta.to)}
          className={i === 0 ? 'btn btn-primary btn-pill btn-full' : 'btn btn-pill btn-full'}
          style={
            i === 0
              ? { padding: 14, justifyContent: 'center', display: 'flex', gap: 8 }
              : {
                  padding: 14,
                  justifyContent: 'center',
                  display: 'flex',
                  gap: 8,
                  background: 'var(--glass-thick)',
                  color: 'var(--ink-2)',
                  border: '1px solid var(--glass-border)',
                }
          }
        >
          <span aria-hidden>{cta.emoji}</span>
          <span>{cta.label}</span>
        </button>
      ))}
      {/* 返回首页 · 始终最弱 · 文字 link 风格 */}
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="btn btn-pill btn-full"
        style={{
          padding: 12,
          justifyContent: 'center',
          background: 'transparent',
          color: 'var(--ink-3)',
          border: 'none',
          font: 'var(--text-caption)',
          letterSpacing: 1,
        }}
      >
        {s('返回首页', '返回首頁', 'Back to home')}
      </button>
    </div>
  );
}
