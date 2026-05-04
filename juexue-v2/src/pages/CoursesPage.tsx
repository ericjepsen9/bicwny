// CoursesPage · 法本网格 + 搜索 + 筛选
//   filter: all / enrolled / available
//   点击未加入 → 弹层显示详情 + 加入按钮
//   点击已加入 → 进 /scripture-detail
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CourseCover from '@/components/CourseCover';
import Dialog from '@/components/Dialog';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
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

  // 默认 filter 来自 URL ?filter=enrolled · 从首页"切换 →"过来时直接显示已加入
  const [sp] = useSearchParams();
  const initialFilter = (sp.get('filter') === 'enrolled' || sp.get('filter') === 'available')
    ? (sp.get('filter') as Filter)
    : 'all';
  const [filter, setFilter] = useState<Filter>(initialFilter);
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
      <div style={{ padding: 'var(--sp-2) var(--sp-5) var(--sp-4)' }}>
        <p className="t-h1" style={{ color: 'var(--ink)' }}>
          <span className="sc">法本</span>
          <span className="tc">法本</span>
          <span className="en">Texts</span>
        </p>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 4 }}>
          {s('诸经汇集 · 选本入学', '諸經匯集 · 選本入學', 'Browse texts · join to learn')}
        </p>
      </div>

      <div style={{ padding: '0 var(--sp-5) var(--sp-3)', position: 'relative' }}>
        {/* 放大镜图标 · 给搜索框视觉锚点 */}
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            left: 'calc(var(--sp-5) + 14px)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--ink-3)',
            pointerEvents: 'none',
          }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          placeholder={s('搜索法本', '搜尋法本', 'Search texts')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '11px 16px 11px 40px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--border)',
            background: 'var(--glass-thick)',
            color: 'var(--ink)',
            font: 'var(--text-body)',
            letterSpacing: '.5px',
            outline: 'none',
            boxShadow: 'var(--shadow-1)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', padding: '0 var(--sp-5) var(--sp-3)' }}>
        <FilterChip on={filter === 'all'}      onClick={() => setFilter('all')}>      {s('全部', '全部', 'All')}      </FilterChip>
        <FilterChip on={filter === 'enrolled'} onClick={() => setFilter('enrolled')}> {s('已加入', '已加入', 'Enrolled')} </FilterChip>
        <FilterChip on={filter === 'available'}onClick={() => setFilter('available')}>{s('未加入', '未加入', 'Available')}</FilterChip>
      </div>

      {courses.isError ? (
        <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 'var(--sp-4)', rowGap: 'var(--sp-6)', padding: '0 var(--sp-5) var(--sp-8)' }}>
        {courses.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton.Line style={{ aspectRatio: '2 / 3', borderRadius: 'var(--r-sm)' }} />
              <Skeleton.LineSm style={{ marginTop: 8 }} />
            </div>
          ))
        ) : list.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyState
              icon={search ? '🔍' : '📚'}
              title={search ? s('没有匹配的法本', '沒有匹配的法本', 'No matches') : s('暂无法本', '暫無法本', 'No texts')}
              hint={!search ? s('管理员稍后会上架法本', '管理員稍後會上架法本', 'Admin will publish soon') : undefined}
            />
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
      )}

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
        width: '100%',
        // grid 1fr 默认 min-width: auto 会卡 content-min · 强制 0 让网格可以收窄
        minWidth: 0,
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        padding: 0,
        textAlign: 'left',
      }}
    >
      {/* 封面 · 参考 Apple 图书：portrait 2:3 比例 · 层叠阴影聚焦书底
          CourseCover 显式 100%/100% · 让其内部 aspectRatio 1/1 失效不撞 wrapper 的 2/3 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2 / 3',
          borderRadius: 'var(--r-sm)',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(43,34,24,.08), 0 10px 18px -4px rgba(43,34,24,.22)',
        }}
      >
        <CourseCover course={course} width="100%" height="100%" />
        {enrolled && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '3px 8px',
              borderRadius: 'var(--r-sm)',
              fontSize: '.625rem',
              fontWeight: 700,
              letterSpacing: '1px',
              background: 'rgba(255,255,255,.92)',
              color: 'var(--saffron-dark)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 2px 6px rgba(43,34,24,.18)',
            }}
          >
            <span className="sc">已加入</span>
            <span className="tc">已加入</span>
            <span className="en">JOINED</span>
          </span>
        )}
      </div>
      {/* 标题 · 预留 2 行高度让 1/2 行书在网格中底对齐 */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 600,
          fontSize: '.875rem',
          color: 'var(--ink)',
          letterSpacing: '1.5px',
          marginTop: 12,
          lineHeight: 1.35,
          minHeight: 'calc(.875rem * 1.35 * 2)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {course.title}
      </div>
    </button>
  );
}
