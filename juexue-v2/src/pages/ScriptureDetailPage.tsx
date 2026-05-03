// ScriptureDetailPage · 法本目录
//   ?slug=xxx [&mode=quiz]
//   章节列表 · 每个 chapter 显示其 lessons · 点击 lesson 进 reading（默认）或 quiz（mode=quiz）
//   返回：via TabBar / browser back · React Router 智能化（无浏览器进度条）
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import { useCourseDetail, useEnrollments } from '@/lib/queries';

export default function ScriptureDetailPage() {
  const { s } = useLang();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const slug = params.get('slug') || '';
  const mode = (params.get('mode') as 'read' | 'quiz' | null) ?? 'read';

  const course = useCourseDetail(slug);
  const enrollments = useEnrollments();

  const enrollment = useMemo(
    () => (enrollments.data ?? []).find((e) => e.courseId === course.data?.id),
    [enrollments.data, course.data?.id],
  );
  const completedSet = useMemo(
    () => new Set(enrollment?.lessonsCompleted ?? []),
    [enrollment],
  );

  if (!slug) return <Empty title={s('参数缺失', '參數缺失', 'Missing slug')} />;

  if (course.isLoading) {
    return (
      <div style={{ padding: 'var(--sp-5)' }}>
        <Skeleton.Card />
        <div style={{ height: 'var(--sp-3)' }} />
        <Skeleton.List count={4} variant="thumb" />
      </div>
    );
  }

  if (!course.data) return <Empty title={s('法本不存在', '法本不存在', 'Text not found')} />;

  const c = course.data;
  const chapters = c.chapters ?? [];
  const totalLessons = chapters.reduce((sum, ch) => sum + (ch.lessons?.length ?? 0), 0);
  const doneCount = chapters.reduce(
    (sum, ch) => sum + (ch.lessons ?? []).filter((l) => completedSet.has(l.id)).length,
    0,
  );

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
          <span className="sc">法本详情</span>
          <span className="tc">法本詳情</span>
          <span className="en">Text Detail</span>
        </span>
        <div style={{ width: 34 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', padding: '0 var(--sp-5) var(--sp-8)' }}>
        {/* hero */}
        <div
          style={{
            padding: 'var(--sp-5)',
            background: 'linear-gradient(135deg, var(--saffron) 0%, var(--saffron-dark) 100%)',
            color: '#FFF',
            borderRadius: 'var(--r-lg)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(161,60,46,.25)',
          }}
        >
          <p style={{ font: 'var(--text-caption)', letterSpacing: 3, opacity: .8, marginBottom: 'var(--sp-2)', fontWeight: 600 }}>
            {c.author || s('法本', '法本', 'Text')}
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: 5, marginBottom: 'var(--sp-2)' }}>
            {c.coverEmoji} {c.title}
          </p>
          {c.description && (
            <p style={{ font: 'var(--text-caption)', letterSpacing: 2, opacity: .85, marginBottom: 'var(--sp-4)' }}>
              {c.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: 'var(--sp-6)' }}>
            <Stat num={chapters.length} label={s('章节', '章節', 'Chapters')} />
            <Stat num={totalLessons} label={s('课时', '課時', 'Lessons')} />
            <Stat
              num={totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) + '%' : '0%'}
              label={s('已学', '已學', 'Done')}
            />
          </div>
        </div>

        {/* 章节列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {chapters.map((ch) => {
            const firstLesson = ch.lessons[0];
            const chCompleted = ch.lessons.filter((l) => completedSet.has(l.id)).length;
            const chPct =
              ch.lessons.length > 0 ? Math.round((chCompleted / ch.lessons.length) * 100) : 0;
            return (
              <div key={ch.id} className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: chPct === 100 ? 'var(--sage-dark)' : 'var(--saffron)',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-serif)',
                      fontWeight: 700,
                      fontSize: '.875rem',
                      flexShrink: 0,
                    }}
                  >
                    {ch.order}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', fontSize: '.9375rem', letterSpacing: 2 }}>
                      {ch.title}
                    </div>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
                      {ch.lessons.length} {s('课', '課', 'lessons')} · {chPct}%
                    </div>
                  </div>
                  {firstLesson && (
                    mode === 'quiz' ? (
                      <Link
                        to={`/quiz/${firstLesson.id}?courseId=${c.id}&slug=${encodeURIComponent(c.slug)}&from=detail`}
                        className="btn btn-primary btn-pill"
                        style={{ padding: '6px 14px', fontSize: 12 }}
                      >
                        {s('答题', '答題', 'Quiz')}
                      </Link>
                    ) : (
                      <Link
                        to={`/read/${c.slug}/${firstLesson.id}`}
                        className="btn btn-primary btn-pill"
                        style={{ padding: '6px 14px', fontSize: 12 }}
                      >
                        {s('阅读', '閱讀', 'Read')}
                      </Link>
                    )
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ch.lessons.map((l) => {
                    const done = completedSet.has(l.id);
                    return (
                      <Link
                        key={l.id}
                        to={
                          mode === 'quiz'
                            ? `/quiz/${l.id}?courseId=${c.id}&slug=${encodeURIComponent(c.slug)}&from=detail`
                            : `/read/${c.slug}/${l.id}`
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--sp-3)',
                          padding: '8px 12px',
                          borderRadius: 'var(--r-sm)',
                          textDecoration: 'none',
                          color: 'inherit',
                          background: done ? 'var(--sage-light)' : 'transparent',
                          border: '1px solid var(--border-light)',
                        }}
                      >
                        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', fontWeight: 700, minWidth: 24 }}>
                          {l.order}
                        </span>
                        <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)' }}>
                          {l.title}
                        </span>
                        {done && (
                          <span style={{ fontSize: 12, color: 'var(--sage-dark)' }}>✓</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!enrollment && (
          <p style={{ textAlign: 'center', font: 'var(--text-caption)', color: 'var(--ink-3)', padding: 'var(--sp-3) 0' }}>
            {s('未报名 · 进度不会同步', '未報名 · 進度不會同步', 'Not enrolled · progress won\'t track')}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ num, label }: { num: string | number; label: string }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', lineHeight: 1, marginBottom: 2 }}>
        {num}
      </p>
      <p style={{ fontSize: '.625rem', opacity: .75, letterSpacing: 1 }}>{label}</p>
    </div>
  );
}

function Empty({ title }: { title: string }) {
  return (
    <div style={{ padding: 'var(--sp-7) var(--sp-5)', textAlign: 'center' }}>
      <p style={{ color: 'var(--ink-3)' }}>{title}</p>
    </div>
  );
}
