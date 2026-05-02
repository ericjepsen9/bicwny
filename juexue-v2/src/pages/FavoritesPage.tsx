// FavoritesPage · /favorites
//   收藏列表 · 卡片显示题干（折 2 行）+ 移除按钮
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useFavorites } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function FavoritesPage() {
  const { s } = useLang();
  const { data, isLoading, isError, error } = useFavorites();
  const qc = useQueryClient();

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

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton.Card key={i} />)}
          </div>
        ) : isError ? (
          <p style={{ color: 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-6)' }}>
            {(error as ApiError).message}
          </p>
        ) : !data || data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-5)', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--sp-2)' }}>⭐</div>
            <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
              {s('暂无收藏', '暫無收藏', 'No favorites yet')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {data.map((f) => (
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
                    onClick={() => {
                      if (!confirm(s('取消收藏？', '取消收藏？', 'Remove favorite?'))) return;
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
