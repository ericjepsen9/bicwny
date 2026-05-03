// MistakeDetailPage · /mistake/:questionId
//   显示错题题干 / 用户错答 / 正确答案 · 提供"再练一次"和"从错题本移除"
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useMistakeDetail } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function MistakeDetailPage() {
  const { s } = useLang();
  const params = useParams<{ questionId: string }>();
  const qid = params.questionId || '';
  const nav = useNavigate();
  const qc = useQueryClient();

  const detail = useMistakeDetail(qid);

  const remove = useMutation({
    mutationFn: () => api.del(`/api/mistakes/${encodeURIComponent(qid)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/mistakes'] });
      toast.ok(s('已从错题本移除', '已從錯題本移除', 'Removed'));
      nav(-1);
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div>
      <div className="top-nav">
        <button
          type="button"
          className="nav-back"
          onClick={() => nav(-1)}
          aria-label={s('返回', '返回', 'Back')}
        >
          <svg width="18" height="18" fill="none" stroke="#55463A" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="nav-title">
          <span className="sc">错题解析</span>
          <span className="tc">錯題解析</span>
          <span className="en">Mistake</span>
        </span>
        <button
          type="button"
          className="nav-action"
          onClick={async () => {
            if (!(await confirmAsync({ title: s('确定移除？', '確定移除？', 'Remove from mistakes?') }))) return;
            remove.mutate();
          }}
          aria-label={s('移除', '移除', 'Remove')}
          title={s('从错题本移除', '從錯題本移除', 'Remove from mistakes')}
        >
          <svg width="18" height="18" fill="none" stroke="#A13C2E" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {detail.isLoading ? (
          <Skeleton.Card />
        ) : detail.isError ? (
          <p style={{ color: 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-6)' }}>
            {(detail.error as ApiError).message}
          </p>
        ) : !detail.data?.question ? (
          <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 'var(--sp-6)' }}>
            {s('题目已失效', '題目已失效', 'Question no longer available')}
          </p>
        ) : (
          <>
            <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 'var(--sp-2)' }}>
                {detail.data.question.source || '—'}
              </div>
              <div style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', letterSpacing: 1.5, lineHeight: 1.8, marginBottom: 'var(--sp-4)' }}>
                {detail.data.question.questionText}
              </div>

              {detail.data.question.correctText && (
                <>
                  <div style={{ font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 2, color: 'var(--sage-dark)', marginBottom: 'var(--sp-2)' }}>
                    {s('正确答案 / 解析', '正確答案 / 解析', 'Correct / Explanation')}
                  </div>
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
                      marginBottom: 'var(--sp-3)',
                    }}
                  >
                    {detail.data.question.correctText}
                  </div>
                </>
              )}

              {detail.data.question.wrongText && (
                <>
                  <div style={{ font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 2, color: 'var(--crimson)', marginBottom: 'var(--sp-2)' }}>
                    {s('易错点', '易錯點', 'Common mistakes')}
                  </div>
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
                    {detail.data.question.wrongText}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {/* 主：再练这一道（单题模式 · /practice?questionId=...）*/}
              <Link
                to={`/practice?questionId=${encodeURIComponent(qid)}`}
                className="btn btn-primary btn-pill btn-full"
                style={{ padding: 12, justifyContent: 'center' }}
              >
                {s('再练这一道 →', '再練這一道 →', 'Retry this question →')}
              </Link>
              {/* 副：去同课时所有题（保留旧行为 · 用户可能想顺便复习同课）*/}
              {detail.data.question.lessonId && detail.data.question.courseId && (
                <Link
                  to={`/quiz/${detail.data.question.lessonId}?courseId=${detail.data.question.courseId}&from=mistake&questionId=${qid}`}
                  className="btn btn-pill btn-full"
                  style={{
                    padding: 12,
                    justifyContent: 'center',
                    background: 'var(--glass-thick)',
                    color: 'var(--ink-2)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {s('练同课时所有题', '練同課時所有題', 'Practice all in lesson')}
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
