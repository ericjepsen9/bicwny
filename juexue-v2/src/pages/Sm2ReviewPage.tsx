// Sm2ReviewPage · /sm2-review
//   SM-2 复习闪卡：读题 → 翻面看答案 → 4 档评分 → 下一张
//   评分 0=Again 1=Hard 2=Good 3=Easy（与后端约定一致）
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { selection, notification } from '@/lib/haptics';
import { useLang } from '@/lib/i18n';
import { useSm2Due } from '@/lib/queries';
import { toast } from '@/lib/toast';

type Rating = 0 | 1 | 2 | 3;

const RATING_BTNS: { r: Rating; sc: string; tc: string; en: string; bg: string; color: string }[] = [
  { r: 0, sc: '重学', tc: '重學', en: 'Again', bg: 'rgba(192,57,43,.15)', color: 'var(--crimson)' },
  { r: 1, sc: '困难', tc: '困難', en: 'Hard',  bg: 'rgba(224,120,86,.18)', color: 'var(--saffron-dark)' },
  { r: 2, sc: '良好', tc: '良好', en: 'Good',  bg: 'rgba(125,154,108,.18)', color: 'var(--sage-dark)' },
  { r: 3, sc: '容易', tc: '容易', en: 'Easy',  bg: 'rgba(236,180,86,.18)', color: 'var(--gold-dark)' },
];

export default function Sm2ReviewPage() {
  const { s } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();
  const due = useSm2Due({ limit: 30 });

  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const cards = due.data ?? [];
  const card = cards[idx];

  const review = useMutation({
    mutationFn: (rating: Rating) => api.post('/api/sm2/review', {
      questionId: card!.questionId,
      courseId: card!.courseId,
      rating,
    }),
    onSuccess: () => {
      setReviewedCount((n) => n + 1);
      qc.invalidateQueries({ queryKey: ['/api/sm2/stats'] });
      qc.invalidateQueries({ queryKey: ['/api/my/progress'] });
      // 下一张 · 自动重置 reveal
      if (idx + 1 < cards.length) {
        setIdx(idx + 1);
        setRevealed(false);
      } else {
        // 全部复习完 · 由 done view 渲染
        notification('success');
      }
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const total = cards.length;
  const allDone = useMemo(
    () => total > 0 && idx === total - 1 && reviewedCount >= total,
    [idx, reviewedCount, total],
  );
  const progressPct = total > 0 ? Math.round(((idx + (review.isPending ? 0 : 0)) / total) * 100) : 0;

  if (due.isLoading) {
    return (
      <div>
        <TopNav titles={['SM-2 复习', 'SM-2 複習', 'SM-2']} />
        <div style={{ padding: 'var(--sp-5)' }}>
          <Skeleton.Title style={{ marginBottom: 12 }} />
          <Skeleton.Card />
        </div>
      </div>
    );
  }

  if (due.isError) {
    return (
      <div>
        <TopNav titles={['SM-2 复习', 'SM-2 複習', 'SM-2']} />
        <p style={{ color: 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-6)' }}>
          {(due.error as ApiError).message}
        </p>
      </div>
    );
  }

  if (!total) {
    return (
      <div>
        <TopNav titles={['SM-2 复习', 'SM-2 複習', 'SM-2']} />
        <div style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-5)', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--sp-3)' }}>🌱</div>
          <p style={{ font: 'var(--text-body)', letterSpacing: 1, marginBottom: 'var(--sp-3)' }}>
            {s('今日已无待复习', '今日已無待複習', 'No cards due today')}
          </p>
          <button
            type="button"
            onClick={() => nav(-1)}
            className="btn btn-pill"
            style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            {s('返回', '返回', 'Back')}
          </button>
        </div>
      </div>
    );
  }

  if (allDone) {
    return (
      <div>
        <TopNav titles={['SM-2 复习', 'SM-2 複習', 'SM-2']} />
        <div style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-5)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--sp-3)' }}>🎉</div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: 3, marginBottom: 'var(--sp-2)' }}>
            {s('本轮已完成', '本輪已完成', 'Round complete')}
          </p>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 'var(--sp-5)' }}>
            {s('共复习 ' + reviewedCount + ' 张', '共複習 ' + reviewedCount + ' 張', 'Reviewed ' + reviewedCount)}
          </p>
          <button
            type="button"
            onClick={() => nav(-1)}
            className="btn btn-primary btn-pill"
            style={{ padding: '10px 24px' }}
          >
            {s('返回', '返回', 'Back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopNav titles={['SM-2 复习', 'SM-2 複習', 'SM-2']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 8 }}>
          <span>{idx + 1} / {total}</span>
          <span style={{ color: 'var(--gold-dark)' }}>{progressPct}%</span>
        </div>
        <div className="progress-track" style={{ marginBottom: 'var(--sp-4)' }}>
          <div className="progress-fill" style={{ width: progressPct + '%' }} />
        </div>

        {card && (
          <>
            <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 'var(--sp-2)' }}>
                {card.question.source || '—'} · {statusLabel(card.status, s)}
              </div>
              <div style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', letterSpacing: 1.2, lineHeight: 1.8, marginBottom: 'var(--sp-3)' }}>
                {card.question.questionText}
              </div>

              {revealed ? (
                <>
                  {card.answerReveal.correctText && (
                    <div
                      style={{
                        padding: 'var(--sp-3) var(--sp-4)',
                        borderRadius: 'var(--r)',
                        background: 'rgba(125,154,108,.12)',
                        borderLeft: '3px solid var(--sage-dark)',
                        color: 'var(--ink)',
                        font: 'var(--text-body)',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        marginBottom: card.answerReveal.wrongText ? 'var(--sp-2)' : 0,
                      }}
                    >
                      {card.answerReveal.correctText}
                    </div>
                  )}
                  {card.answerReveal.wrongText && (
                    <div
                      style={{
                        padding: 'var(--sp-3) var(--sp-4)',
                        borderRadius: 'var(--r)',
                        background: 'rgba(192,57,43,.08)',
                        borderLeft: '3px solid var(--crimson)',
                        color: 'var(--ink)',
                        font: 'var(--text-body)',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {card.answerReveal.wrongText}
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => { selection(); setRevealed(true); }}
                  className="btn btn-primary btn-pill btn-full"
                  style={{ padding: 12, justifyContent: 'center' }}
                >
                  {s('显示答案', '顯示答案', 'Show answer')}
                </button>
              )}
            </div>

            {revealed && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)' }}>
                {RATING_BTNS.map((b) => (
                  <button
                    key={b.r}
                    type="button"
                    disabled={review.isPending}
                    onClick={() => review.mutate(b.r)}
                    className="btn btn-pill"
                    style={{
                      padding: '12px 4px',
                      background: b.bg,
                      color: b.color,
                      border: 'none',
                      flexDirection: 'column',
                      gap: 2,
                      lineHeight: 1.3,
                      justifyContent: 'center',
                      letterSpacing: 1,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                      {s(b.sc, b.tc, b.en)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function statusLabel(st: string, s: (sc: string, tc: string, en?: string) => string) {
  switch (st) {
    case 'new':       return s('新卡', '新卡', 'New');
    case 'learning':  return s('学习中', '學習中', 'Learning');
    case 'review':    return s('复习', '複習', 'Review');
    case 'mastered':  return s('已掌握', '已掌握', 'Mastered');
    default:          return st;
  }
}
