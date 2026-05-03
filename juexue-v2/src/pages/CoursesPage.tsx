// CoursesPage · 法本网格 + 搜索 + 筛选
//   filter: all / enrolled / available
//   点击未加入 → 弹层显示详情 + 加入按钮
//   点击已加入 → 进 /scripture-detail
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import CourseCover from '@/components/CourseCover';
import Dialog from '@/components/Dialog';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { type Course, useCourses, useEnrollments } from '@/lib/queries';
import { toast } from '@/lib/toast';

type Filter = 'all' | 'enrolled' | 'available';

export default function CoursesPage() {
  const { s } = useLang();
  const courses = useCourses();
  const enrollments = useEnrollments();
  const qc = useQueryClient();
  const nav = useNavigate();

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const enrolledIds = useMemo(
    () => new Set((enrollments.data ?? []).map((e) => e.courseId)),
    [enrollments.data],
  );

  const list = useMemo(() => {
    const all = (courses.data ?? []).filter((c) => c.isPublished);
    const q = search.trim().toLowerCase();
    return all.filter((c) => {
      if (filter === 'enrolled' && !enrolledIds.has(c.id)) return false;
      if (filter === 'available' && enrolledIds.has(c.id)) return false;
      if (q) {
        const hay = (c.title + ' ' + (c.titleTraditional || '') + ' ' + (c.author || '') + ' ' + (c.description || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => a.displayOrder - b.displayOrder);
  }, [courses.data, enrolledIds, filter, search]);

  const openCourse = useMemo(
    () => list.find((c) => c.slug === openSlug) || null,
    [list, openSlug],
  );

  const enroll = useMutation({
    mutationFn: (vars: { courseId: string; slug: string }) =>
      api.post('/api/enrollments', { courseId: vars.courseId }).then(() => vars),
    onSuccess: async (vars) => {
      // 强制 refetch（不止 invalidate）· 保证关闭弹窗后 BookCard ✓ 标识立刻更新
      await Promise.all([
        qc.refetchQueries({ queryKey: ['/api/my/enrollments'] }),
        qc.refetchQueries({ queryKey: ['/api/my/progress'] }),
      ]);
      toast.ok(s('已加入 · 即将进入', '已加入 · 即將進入', 'Joined · opening…'));
      setOpenSlug(null);
      // "加入并查看" · 直接跳法本详情
      nav(`/scripture-detail?slug=${encodeURIComponent(vars.slug)}`);
    },
    onError: (e) => {
      toast.error((e as ApiError).message);
    },
  });

  return (
    <div>
      <div className="top-nav">
        <span className="nav-title" style={{ marginLeft: 0 }}>
          <span className="sc">法本</span>
          <span className="tc">法本</span>
          <span className="en">Texts</span>
        </span>
        <div style={{ width: 34, marginLeft: 'auto' }} />
      </div>

      <div style={{ padding: '0 var(--sp-5) var(--sp-3)' }}>
        <input
          type="search"
          placeholder={s('搜索法本', '搜尋法本', 'Search texts')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 14px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--glass-border)',
            background: 'var(--bg-input)',
            color: 'var(--ink)',
            font: 'var(--text-caption)',
            letterSpacing: '1px',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', padding: '0 var(--sp-5) var(--sp-3)' }}>
        <FilterChip on={filter === 'all'}      onClick={() => setFilter('all')}>      {s('全部', '全部', 'All')}      </FilterChip>
        <FilterChip on={filter === 'enrolled'} onClick={() => setFilter('enrolled')}> {s('已加入', '已加入', 'Enrolled')} </FilterChip>
        <FilterChip on={filter === 'available'}onClick={() => setFilter('available')}>{s('未加入', '未加入', 'Available')}</FilterChip>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', padding: '0 var(--sp-5) var(--sp-8)' }}>
        {courses.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton.Line style={{ aspectRatio: '1/1', borderRadius: 'var(--r-md)' }} />
              <Skeleton.LineSm style={{ marginTop: 8 }} />
            </div>
          ))
        ) : list.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--sp-8) var(--sp-5)', color: 'var(--ink-3)' }}>
            {search ? s('没有匹配的法本', '沒有匹配的法本', 'No matches') : s('暂无法本', '暫無法本', 'No texts')}
          </div>
        ) : (
          list.map((c) => (
            <BookCard
              key={c.id}
              course={c}
              enrolled={enrolledIds.has(c.id)}
              onClick={() => {
                if (enrolledIds.has(c.id)) {
                  nav(`/scripture-detail?slug=${encodeURIComponent(c.slug)}`);
                } else {
                  setOpenSlug(c.slug);
                }
              }}
            />
          ))
        )}
      </div>

      <Dialog
        open={!!openCourse}
        onClose={() => setOpenSlug(null)}
        title={openCourse?.title}
      >
        {openCourse && (
          <div style={{ padding: 'var(--sp-2) 0 var(--sp-4)' }}>
            <div style={{ width: '100%', maxWidth: 200, aspectRatio: '1/1', margin: '0 auto var(--sp-4)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-2)' }}>
              <CourseCover course={openCourse} emojiSize="4rem" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', letterSpacing: 2, marginBottom: 4 }}>
              {openCourse.coverEmoji} {openCourse.title}
            </h2>
            {openCourse.author && (
              <p style={{ textAlign: 'center', color: 'var(--ink-3)', font: 'var(--text-caption)', letterSpacing: 1, marginBottom: 'var(--sp-3)' }}>
                {openCourse.author}
              </p>
            )}
            {openCourse.description && (
              <p style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.5px', lineHeight: 1.6, marginBottom: 'var(--sp-4)', padding: '0 var(--sp-2)' }}>
                {openCourse.description}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <button
                type="button"
                onClick={() => enroll.mutate({ courseId: openCourse.id, slug: openCourse.slug })}
                disabled={enroll.isPending}
                className="btn btn-primary btn-pill"
                style={{ padding: 12, justifyContent: 'center' }}
              >
                + {enroll.isPending ? s('加入中…', '加入中…', 'Joining…') : s('加入并查看', '加入並查看', 'Join & open')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const slug = openCourse.slug;
                  setOpenSlug(null);
                  nav(`/scripture-detail?slug=${encodeURIComponent(slug)}`);
                }}
                className="btn btn-pill"
                style={{
                  padding: 12,
                  background: 'var(--glass-thick)',
                  color: 'var(--ink-2)',
                  border: '1px solid var(--glass-border)',
                  justifyContent: 'center',
                }}
              >
                {s('先看目录', '先看目錄', 'Preview catalog')}
              </button>
              <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, textAlign: 'center', marginTop: 2 }}>
                {s('先看目录不算入学习记录', '先看目錄不算入學習記錄', 'Preview does not enroll you')}
              </p>
              <button
                type="button"
                onClick={() => setOpenSlug(null)}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink-4)',
                  font: 'var(--text-caption)',
                  letterSpacing: 1,
                  cursor: 'pointer',
                }}
              >
                {s('取消', '取消', 'Cancel')}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 14px',
        borderRadius: 'var(--r-pill)',
        font: 'var(--text-caption)',
        fontWeight: 600,
        letterSpacing: 1,
        background: on ? 'var(--saffron-pale)' : 'rgba(43,34,24,.05)',
        border: '1px solid ' + (on ? 'var(--saffron-light)' : 'transparent'),
        color: on ? 'var(--saffron-dark)' : 'var(--ink-3)',
        cursor: 'pointer',
        transition: 'all .2s var(--ease)',
      }}
    >
      {children}
    </button>
  );
}

function BookCard({ course, enrolled, onClick }: { course: Course; enrolled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        padding: 0,
        textAlign: 'left',
      }}
    >
      <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow-1)' }}>
        <CourseCover course={course} />
        {enrolled && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              padding: '2px 8px',
              borderRadius: 'var(--r-pill)',
              fontSize: '.625rem',
              fontWeight: 700,
              letterSpacing: '.5px',
              background: 'var(--saffron)',
              color: '#fff',
              boxShadow: '0 2px 6px rgba(224,120,86,.4)',
            }}
          >
            ✓
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 600,
          fontSize: '.8125rem',
          color: 'var(--ink)',
          letterSpacing: '1.5px',
          marginTop: 8,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {course.title}
      </div>
      {course.author && (
        <div style={{ fontSize: '.6875rem', color: 'var(--ink-3)', letterSpacing: '.5px', marginTop: 2, lineHeight: 1.3, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {course.author}
        </div>
      )}
    </button>
  );
}
