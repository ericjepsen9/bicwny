// CoachCoursesPage · /coach/courses
//   左：法本列表（点选）· 右：选中法本的章节/课时树
//   "添加新题"链接带 courseId/chapterId/lessonId QS 跳到 /coach/questions?autoNew=1&...
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import { useCourseDetail, useCourses } from '@/lib/queries';

export default function CoachCoursesPage() {
  const { s } = useLang();
  const courses = useCourses();
  const [slug, setSlug] = useState<string | null>(null);
  const detail = useCourseDetail(slug);

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('法本浏览', '法本瀏覽', 'Texts')}</h1>
          <p className="page-sub">{s('查看原文 · 准备出题', '查看原文 · 準備出題', 'Browse to author questions')}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--sp-5)' }}>
        {/* 左：法本列表 */}
        <aside style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: 'calc(100vh - var(--sp-8))', overflowY: 'auto' }}>
          {courses.isLoading ? (
            <Skeleton.List />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(courses.data ?? []).filter((c) => c.isPublished).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSlug(c.slug)}
                  className={'glass-card-thick'}
                  style={{
                    padding: 'var(--sp-3) var(--sp-4)',
                    textAlign: 'left',
                    border: c.slug === slug ? '1px solid var(--saffron)' : '1px solid var(--glass-border)',
                    background: c.slug === slug ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{c.coverEmoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--ink)', letterSpacing: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.title}
                    </span>
                    {c.author && (
                      <span style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2 }}>
                        {c.author}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* 右：详情 */}
        <section>
          {!slug ? (
            <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--ink-3)' }}>
              {s('← 选一本法本', '← 選一本法本', '← Pick a text')}
            </div>
          ) : detail.isLoading ? (
            <Skeleton.Card />
          ) : !detail.data ? (
            <p style={{ color: 'var(--crimson)' }}>{s('加载失败', '載入失敗', 'Failed')}</p>
          ) : (
            <>
              <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
                  <span style={{ fontSize: '1.8rem' }}>{detail.data.coverEmoji}</span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)', letterSpacing: 3 }}>
                    {detail.data.title}
                  </h2>
                </div>
                {detail.data.author && (
                  <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 'var(--sp-2)' }}>
                    {detail.data.author}
                  </p>
                )}
                {detail.data.description && (
                  <p style={{ font: 'var(--text-body)', color: 'var(--ink-2)', lineHeight: 1.7 }}>
                    {detail.data.description}
                  </p>
                )}
              </div>

              {detail.data.chapters.map((ch) => (
                <details key={ch.id} className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }} open>
                  <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 2 }}>
                      {s('第 ' + ch.order + ' 章', '第 ' + ch.order + ' 章', 'Ch ' + ch.order)} · {ch.title}
                    </span>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                      {ch.lessons.length} 课
                    </span>
                  </summary>

                  <ul style={{ marginTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ch.lessons.map((l) => (
                      <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0', borderBottom: '1px dashed var(--border-light)' }}>
                        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 24 }}>{l.order}.</span>
                        <span style={{ flex: 1, fontFamily: 'var(--font-serif)', color: 'var(--ink)', letterSpacing: 1 }}>
                          {l.title}
                        </span>
                        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                          {l.referenceText?.length ?? 0} 字
                        </span>
                        <Link
                          to={`/coach/questions/new?courseId=${encodeURIComponent(detail.data!.id)}&chapterId=${encodeURIComponent(ch.id)}&lessonId=${encodeURIComponent(l.id)}`}
                          style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', fontWeight: 700, letterSpacing: 1 }}
                        >
                          {s('+ 添加新题', '+ 添加新題', '+ Add')}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </>
          )}
        </section>
      </div>
    </>
  );
}
