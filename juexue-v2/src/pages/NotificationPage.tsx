// NotificationPage · /notifications
//   通知列表 · 未读高亮 · 点击 mark read · 顶部右侧"全部已读"
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useNotifications } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function NotificationPage() {
  const { s } = useLang();
  const list = useNotifications({ limit: 100 });
  const qc = useQueryClient();

  const markOne = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${encodeURIComponent(id)}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/notifications'] });
      qc.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/notifications'] });
      qc.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      toast.ok(s('已全部标为已读', '已全部標為已讀', 'All read'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/notifications/${encodeURIComponent(id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/notifications'] });
      qc.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const data = list.data ?? [];
  const hasUnread = data.some((n) => !n.read);

  return (
    <div>
      <TopNav
        titles={['通知', '通知', 'Notifications']}
        right={
          hasUnread ? (
            <button
              type="button"
              className="nav-action"
              disabled={markAll.isPending}
              onClick={() => markAll.mutate()}
              aria-label={s('全部已读', '全部已讀', 'Mark all read')}
              style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', letterSpacing: 1, padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              {s('全部已读', '全部已讀', 'Read all')}
            </button>
          ) : <div style={{ width: 34 }} />
        }
      />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {list.isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton.Card key={i} />)}
          </div>
        ) : list.isError ? (
          <p style={{ color: 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-6)' }}>
            {(list.error as ApiError).message}
          </p>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) var(--sp-5)', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--sp-2)' }}>🔔</div>
            <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
              {s('暂无通知', '暫無通知', 'No notifications')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {data.map((n) => (
              <div
                key={n.id}
                className="glass-card-thick"
                style={{
                  padding: 'var(--sp-4)',
                  display: 'flex',
                  gap: 'var(--sp-3)',
                  borderLeft: '3px solid ' + (n.read ? 'transparent' : 'var(--saffron)'),
                  background: n.read ? 'var(--glass)' : 'var(--saffron-pale)',
                  cursor: n.read ? 'default' : 'pointer',
                }}
                onClick={() => { if (!n.read) markOne.mutate(n.id); }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5, marginBottom: 4 }}>
                    {n.title}
                  </div>
                  <div style={{ font: 'var(--text-body)', color: 'var(--ink-2)', letterSpacing: '.5px', lineHeight: 1.5, marginBottom: 6 }}>
                    {n.body}
                  </div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirm(s('删除？', '刪除？', 'Delete?'))) return;
                    remove.mutate(n.id);
                  }}
                  aria-label={s('删除', '刪除', 'Delete')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ink-4)',
                    cursor: 'pointer',
                    padding: 4,
                    alignSelf: 'flex-start',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
