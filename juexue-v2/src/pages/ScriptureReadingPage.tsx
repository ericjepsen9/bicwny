// ScriptureReadingPage · /read/:slug/:lessonId
//   Apple 图书风沉浸阅读 · 进入显示工具栏 → 滚一屏后自动隐 → 点正文呼出/收起
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import Dialog from '@/components/Dialog';
import { useFontScale } from '@/lib/fontSize';
import { useLang } from '@/lib/i18n';
import { useCourseDetail, useEnrollments, useUpdateEnrollmentProgress } from '@/lib/queries';
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

  // 阅读页只需要"当前 lesson 的原文"+ 全树 TOC 用于 prev/next 跳转
  // lessonId 模式：仅当前 lesson 带 referenceText/teachingSummary · 其他课只 id/title
  const course = useCourseDetail(slug, { lessonId });
  const enrollments = useEnrollments();
  const [tocOpen, setTocOpen] = useState(false);
  // 工具栏可见性 · 进入默认显示 · 向下滚收 / 向上滚显（iOS Safari 风格）
  // 整屏点击正文也能 toggle
  const [chromeVisible, setChromeVisible] = useState(true);

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

  // 记忆"上次阅读位置" · 用户每打开一课就把 enrollment.currentLessonId 推进到这里
  // 下次首页 / 详情页"继续阅读"按钮即可跳回
  const updateProgress = useUpdateEnrollmentProgress();
  const courseId = course.data?.id;
  const enrolledHere = !!enrollment;
  const savedLessonId = enrollment?.currentLessonId ?? null;
  useEffect(() => {
    if (!courseId || !lessonId || !enrolledHere) return;
    if (savedLessonId === lessonId) return;
    updateProgress.mutate({ courseId, currentLessonId: lessonId });
    // updateProgress 是稳定 mutation 引用 · 仅依赖 courseId / lessonId / 状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId, enrolledHere, savedLessonId]);

  // 切换课时时滚回顶部 + 工具栏复位显示
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setChromeVisible(true);
  }, [lessonId]);

  // 向下滚 → 隐藏工具栏；向上滚 → 显示
  // 顶部 60px 内强制显示（避免顶端就给隐了 · 视觉断层）
  // 抖动阈值 8px 避免微抖动反复触发
  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY;
      if (Math.abs(dy) < 8) return;
      if (y < 60) {
        setChromeVisible(true);
      } else if (dy > 0) {
        setChromeVisible(false);
      } else {
        setChromeVisible(true);
      }
      lastY = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
      <div
        className="top-nav"
        style={{
          opacity: chromeVisible ? 1 : 0,
          transform: chromeVisible ? 'translateY(0)' : 'translateY(-100%)',
          pointerEvents: chromeVisible ? 'auto' : 'none',
          transition: 'opacity .25s var(--ease), transform .25s var(--ease)',
        }}
      >
        <button
          type="button"
          className="nav-back"
          onClick={() => nav(`/scripture-detail?slug=${encodeURIComponent(slug)}`)}
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
          <button
            type="button"
            onClick={() => setTocOpen(true)}
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
              cursor: 'pointer',
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
          </button>
        </div>
      </div>

      <div
        onClick={() => setChromeVisible((v) => !v)}
        style={{
          padding: '0 var(--sp-5) calc(var(--sp-8) + 80px)',
          cursor: 'pointer',
        }}
      >
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

        {/* 原文 · 无白色矩形 · 直接铺在页面背景上（参考 Apple 图书阅读视图） */}
        <article
          style={{
            padding: 'var(--sp-2) 0 var(--sp-3)',
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
      </div>

      {/* 底部操作栏 · 固定在屏底 · 跟顶部 nav 联动显示/隐藏 */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: `var(--sp-3) var(--sp-5) calc(var(--sp-3) + env(safe-area-inset-bottom, 0px))`,
          display: 'flex',
          gap: 'var(--sp-2)',
          alignItems: 'center',
          background: 'var(--glass-thick)',
          backdropFilter: 'var(--blur)',
          WebkitBackdropFilter: 'var(--blur)',
          borderTop: '1px solid var(--glass-border)',
          zIndex: 20,
          opacity: chromeVisible ? 1 : 0,
          transform: chromeVisible ? 'translateY(0)' : 'translateY(100%)',
          pointerEvents: chromeVisible ? 'auto' : 'none',
          transition: 'opacity .25s var(--ease), transform .25s var(--ease)',
        }}
      >
        {prev ? (
          <Link
            to={`/read/${c.slug}/${prev.lesson.id}`}
            replace
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
            replace
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

      {/* 目录 sheet · 当前课时高亮 · 点击直跳 */}
      <Dialog open={tocOpen} onClose={() => setTocOpen(false)} title={s('目录', '目錄', 'Catalog')}>
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: 'var(--sp-2) 0' }}>
          {course.data?.chapters?.map((ch) => (
            <div key={ch.id} style={{ marginBottom: 'var(--sp-3)' }}>
              <div
                style={{
                  font: 'var(--text-caption)',
                  color: 'var(--ink-3)',
                  letterSpacing: 2,
                  fontWeight: 700,
                  padding: 'var(--sp-2) 0',
                }}
              >
                {s('第 ' + ch.order + ' 章', '第 ' + ch.order + ' 章', 'Ch ' + ch.order)} · {ch.title}
              </div>
              <div className="group">
                {(ch.lessons ?? []).map((l) => {
                  const done = !!enrollment?.lessonsCompleted.includes(l.id);
                  const isCur = l.id === lessonId;
                  return (
                    <Link
                      key={l.id}
                      to={`/read/${c.slug}/${l.id}`}
                      replace
                      onClick={() => setTocOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-3)',
                        padding: 'var(--sp-3) var(--sp-4)',
                        textDecoration: 'none',
                        color: 'inherit',
                        background: isCur ? 'var(--saffron-pale)' : 'transparent',
                        borderLeft: isCur ? '3px solid var(--saffron)' : '3px solid transparent',
                      }}
                    >
                      <span style={{ minWidth: 24, font: 'var(--text-caption)', color: 'var(--ink-4)', fontWeight: 700 }}>
                        {l.order}
                      </span>
                      <span style={{ flex: 1, font: 'var(--text-body)', color: isCur ? 'var(--saffron-dark)' : 'var(--ink)' }}>
                        {l.title}
                      </span>
                      {done && (
                        <span style={{ fontSize: 14, color: 'var(--sage-dark)', fontWeight: 700 }}>✓</span>
                      )}
                      {isCur && !done && (
                        <span style={{ fontSize: 12, color: 'var(--saffron-dark)', fontWeight: 700 }}>{s('当前', '當前', 'Now')}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
