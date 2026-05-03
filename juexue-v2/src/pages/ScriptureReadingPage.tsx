// ScriptureReadingPage · /read/:slug/:lessonId
//   显示课时原文 + 顶部章节标题 + 底部"开始答题" / "下一课"按钮
//   工具栏：A- / A+ 字号步进 · 上一课 · 下一课（跨章节连贯）
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { useFontScale } from '@/lib/fontSize';
import { useLang } from '@/lib/i18n';
import { useCourseDetail, useEnrollments } from '@/lib/queries';
import { toast } from '@/lib/toast';

interface FlatLesson {
  chapterId: string;
  chapterTitle: string;
  lesson: { id: string; order: number; title: string; referenceText?: string | null };
}

export default function ScriptureReadingPage() {
  const { s } = useLang();
  const params = useParams<{ slug: string; lessonId: string }>();
  const slug = params.slug || '';
  const lessonId = params.lessonId || '';
  const nav = useNavigate();
  const { step } = useFontScale();

  const course = useCourseDetail(slug);
  const enrollments = useEnrollments();

  // 把所有章节的课时拍平成一维 · 方便上一课/下一课跨章节查找
  const flat: FlatLesson[] = useMemo(() => {
    if (!course.data) return [];
    const out: FlatLesson[] = [];
    for (const ch of course.data.chapters ?? []) {
      for (const l of ch.lessons ?? []) {
        out.push({ chapterId: ch.id, chapterTitle: ch.title, lesson: l });
      }
    }
    return out;
  }, [course.data]);

  const idx = useMemo(
    () => flat.findIndex((f) => f.lesson.id === lessonId),
    [flat, lessonId],
  );
  const cur = idx >= 0 ? flat[idx]! : null;
  const prev = idx > 0 ? flat[idx - 1]! : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1]! : null;

  const enrollment = useMemo(
    () => (enrollments.data ?? []).find((e) => e.courseId === course.data?.id),
    [enrollments.data, course.data?.id],
  );
  const completed = !!enrollment?.lessonsCompleted.includes(lessonId);

  function bumpFont(dir: 1 | -1) {
    const opt = step(dir);
    if (!opt) return;
    toast.info(s(
      `字号：${opt.labelSc}`,
      `字號：${opt.labelTc}`,
      `Font: ${opt.labelEn}`,
    ));
  }

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

  if (!cur) {
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
  const { chapterTitle, lesson } = cur;

  const toolBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 14px',
    background: 'var(--glass-thick)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--r-pill)',
    color: 'var(--ink-2)',
    font: 'var(--text-caption)',
    fontWeight: 600,
    letterSpacing: 1,
    textDecoration: 'none',
    cursor: 'pointer',
  };
  const toolBtnDisabled: React.CSSProperties = { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' };

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
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => bumpFont(-1)}
            aria-label={s('字号减小', '字號減小', 'Smaller text')}
            title={s('字号 A-', '字號 A-', 'A-')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--r-sm)',
              background: 'var(--glass-thick)',
              border: '1px solid var(--glass-border)',
              color: 'var(--ink-2)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '0.75rem',
              letterSpacing: 0,
              cursor: 'pointer',
            }}
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => bumpFont(1)}
            aria-label={s('字号增大', '字號增大', 'Larger text')}
            title={s('字号 A+', '字號 A+', 'A+')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--r-sm)',
              background: 'var(--glass-thick)',
              border: '1px solid var(--glass-border)',
              color: 'var(--ink-2)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: 0,
              cursor: 'pointer',
            }}
          >
            A+
          </button>
          <Link
            to={`/scripture-detail?slug=${encodeURIComponent(c.slug)}`}
            aria-label={s('章节目录', '章節目錄', 'Catalog')}
            style={{
              width: 34,
              height: 32,
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
      </div>

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '1.5px', marginBottom: 'var(--sp-2)' }}>
          {chapterTitle} · {s('第 ' + lesson.order + ' 课', '第 ' + lesson.order + ' 課', 'Lesson ' + lesson.order)}
          <span style={{ marginLeft: 8, color: 'var(--ink-4)' }}>· {idx + 1} / {flat.length}</span>
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

        {/* 操作行 · 上一课 · 本课答题 · 下一课 */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-5)', alignItems: 'center' }}>
          {prev ? (
            <Link
              to={`/read/${c.slug}/${prev.lesson.id}`}
              style={{ ...toolBtn, flex: 1 }}
              aria-label={s('上一课', '上一課', 'Previous lesson')}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>{s('上一课', '上一課', 'Prev')}</span>
            </Link>
          ) : (
            <span style={{ ...toolBtn, ...toolBtnDisabled, flex: 1 }} aria-disabled="true">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>{s('上一课', '上一課', 'Prev')}</span>
            </span>
          )}
          <Link
            to={`/quiz/${lesson.id}?courseId=${c.id}&slug=${encodeURIComponent(c.slug)}&from=reading${next ? '&nextLessonId=' + next.lesson.id : ''}`}
            className="btn btn-primary btn-pill"
            style={{ flex: 1.4, padding: 12, justifyContent: 'center' }}
          >
            {s('开始答题', '開始答題', 'Start quiz')}
          </Link>
          {next ? (
            <Link
              to={`/read/${c.slug}/${next.lesson.id}`}
              style={{ ...toolBtn, flex: 1 }}
              aria-label={s('下一课', '下一課', 'Next lesson')}
            >
              <span>{s('下一课', '下一課', 'Next')}</span>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </Link>
          ) : (
            <span style={{ ...toolBtn, ...toolBtnDisabled, flex: 1 }} aria-disabled="true">
              <span>{s('下一课', '下一課', 'Next')}</span>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
