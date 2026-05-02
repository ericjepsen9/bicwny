// ScriptureReadingPage · /read/:slug/:lessonId
//   显示课时原文 + 顶部章节标题 + 底部"开始答题" / "下一课"按钮
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import { useCourseDetail, useEnrollments } from '@/lib/queries';

export default function ScriptureReadingPage() {
  const { s } = useLang();
  const params = useParams<{ slug: string; lessonId: string }>();
  const slug = params.slug || '';
  const lessonId = params.lessonId || '';
  const nav = useNavigate();

  const course = useCourseDetail(slug);
  const enrollments = useEnrollments();

  const lessonInfo = useMemo(() => {
    if (!course.data) return null;
    for (const ch of course.data.chapters) {
      const idx = ch.lessons.findIndex((l) => l.id === lessonId);
      if (idx >= 0) {
        const lesson = ch.lessons[idx]!;
        const next = ch.lessons[idx + 1];
        return { chapter: ch, lesson, next: next || null };
      }
    }
    return null;
  }, [course.data, lessonId]);

  const enrollment = useMemo(
    () => (enrollments.data ?? []).find((e) => e.courseId === course.data?.id),
    [enrollments.data, course.data?.id],
  );
  const completed = !!enrollment?.lessonsCompleted.includes(lessonId);

  if (course.isLoading) {
    return (
      <div style={{ padding: 'var(--sp-5)' }}>
        <Skeleton.Title style={{ marginBottom: 14 }} />
        <Skeleton.Line style={{ marginBottom: 8 }} />
        <Skeleton.Line style={{ marginBottom: 8 }} />
        <Skeleton.Line style={{ marginBottom: 8, width: '85%' }} />
        <Skeleton.Line style={{ marginBottom: 8 }} />
      </div>
    );
  }

  if (!lessonInfo) {
    return (
      <div style={{ padding: 'var(--sp-7) var(--sp-5)', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-3)' }}>{s('课时不存在', '課時不存在', 'Lesson not found')}</p>
        <Link to="/courses" className="btn btn-primary btn-pill" style={{ marginTop: 16, padding: '8px 18px', display: 'inline-block' }}>
          {s('返回法本', '返回法本', 'Back to texts')}
        </Link>
      </div>
    );
  }

  const c = course.data!;
  const { chapter, lesson, next } = lessonInfo;

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
        <span
          className="nav-title"
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {c.coverEmoji} {c.title}
        </span>
        <Link
          to={`/scripture-detail?slug=${encodeURIComponent(c.slug)}`}
          aria-label={s('章节目录', '章節目錄', 'Catalog')}
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--r-sm)',
            background: 'var(--glass-thick)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-2)',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </Link>
      </div>

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '1.5px', marginBottom: 'var(--sp-2)' }}>
          {chapter.title} · {s('第 ' + lesson.order + ' 课', '第 ' + lesson.order + ' 課', 'Lesson ' + lesson.order)}
          {completed && <span style={{ color: 'var(--sage-dark)', marginLeft: 8 }}>· ✓ {s('已学', '已學', 'Done')}</span>}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '1.375rem',
            color: 'var(--ink)',
            letterSpacing: 4,
            marginBottom: 'var(--sp-4)',
          }}
        >
          {lesson.title}
        </h1>

        <article
          className="glass-card"
          style={{
            padding: 'var(--sp-5)',
            background: 'var(--glass-thick)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--r-lg)',
            font: 'var(--text-body-serif)',
            fontSize: '1rem',
            lineHeight: 1.9,
            letterSpacing: 1,
            color: 'var(--ink)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {lesson.referenceText || s('（本课时尚无原文）', '（本課時尚無原文）', '(No reference text yet)')}
        </article>

        {/* 操作行 */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
          <Link
            to={`/quiz/${lesson.id}?courseId=${c.id}&slug=${encodeURIComponent(c.slug)}&from=reading${next ? '&nextLessonId=' + next.id : ''}`}
            className="btn btn-primary btn-pill"
            style={{ flex: 1, padding: 12, justifyContent: 'center' }}
          >
            {s('开始答题', '開始答題', 'Start quiz')}
          </Link>
          {next && (
            <Link
              to={`/read/${c.slug}/${next.id}`}
              className="btn btn-pill"
              style={{
                flex: 1,
                padding: 12,
                background: 'transparent',
                color: 'var(--ink-2)',
                border: '1px solid var(--border)',
                justifyContent: 'center',
              }}
            >
              {s('下一课', '下一課', 'Next lesson')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
