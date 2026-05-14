// FavoritesPage · /favorites
//   收藏列表 · 卡片显示题干（折 3 行）+ 移除按钮
//   筛选：按闻思（course）下拉
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useCourses, useFavorites } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function FavoritesPage() {
  const { s } = useLang();
  const { data, isLoading, isError, error, refetch } = useFavorites();
  const courses = useCourses();
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState<string>('');

  const all = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    if (!courseId) return all;
    return all.filter((f) => f.question?.courseId === courseId);
  }, [all, courseId]);

  // 收藏涉及的闻思 id 集 · 用于过滤下拉只显示有收藏的闻思
  const usedCourseIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of all) {
      if (f.question?.courseId) set.add(f.question.courseId);
    }
    return set;
  }, [all]);

  const remove = useMutation({
    mutationFn: (qid: string) => api.del(`/api/favorites/${encodeURIComponent(qid)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/favorites'] });
      qc.invalidateQueries({ queryKey: ['/api/favorites', 'count'] });
      toast.ok(s('已移除', '已移除', 'Removed'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div>
      <TopNav titles={['收藏', '收藏', 'Favorites']} />

      {/* 闻思筛选 */}
      {!isLoading && !isError && all.length > 0 && usedCourseIds.size > 1 && (
        <div style={{ padding: '0 var(--sp-5) var(--sp-3)' }}>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-input)',
              font: 'var(--text-caption)',
              color: 'var(--ink)',
              letterSpacing: 1.5,
              outline: 'none',
            }}
          >
            <option value="">{s('全部闻思', '全部聞思', 'All texts')} ({all.length})</option>
            {(courses.data ?? [])
              .filter((c) => usedCourseIds.has(c.id))
              .map((c) => {
                const count = all.filter((f) => f.question?.courseId === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.coverEmoji ? c.coverEmoji + ' ' : ''}{c.title} ({count})
                  </option>
                );
              })}
          </select>
        </div>
      )}

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton.Card key={i} />)}
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : all.length === 0 ? (
          <EmptyState
            icon="⭐"
            title={s('暂无收藏', '暫無收藏', 'No favorites yet')}
            hint={s('答题时点收藏即可加入', '答題時點收藏即可加入', 'Tap star while answering')}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={s('当前闻思下暂无收藏', '當前聞思下暫無收藏', 'No favorites in this text')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {filtered.map((f) => (
              <div
                key={f.id}
                className="glass-card-thick"
                style={{ padding: 'var(--sp-4)', borderLeft: '3px solid var(--saffron)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                  <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
                    {f.question?.source || '—'}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirmAsync({ title: s('取消收藏？', '取消收藏？', 'Remove favorite?') }))) return;
                      remove.mutate(f.questionId);
                    }}
                    aria-label={s('移除', '移除', 'Remove')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--ink-4)',
                      cursor: 'pointer',
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div
                  style={{
                    font: 'var(--text-body-serif)',
                    color: 'var(--ink)',
                    letterSpacing: 1.2,
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {f.question?.questionText || s('题目已失效', '題目已失效', 'Unavailable')}
                </div>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 'var(--sp-2)', letterSpacing: 1 }}>
                  {new Date(f.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
