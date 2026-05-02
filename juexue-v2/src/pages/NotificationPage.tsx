// NotificationPage · /notifications
//   通知列表 · 未读高亮 · 点击 mark read · 顶部右侧"全部已读"
//   筛选 tabs：全部 / 未读 / 班级 / 学习 / 成就 / 系统
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useNotifications } from '@/lib/queries';
import { toast } from '@/lib/toast';

// '' = 全部 · 'unread' = 未读 · 否则按 type 字段精确匹配
type NotifFilter = '' | 'unread' | 'class_announcement' | 'reminder' | 'achievement' | 'system';

export default function NotificationPage() {
  const { s } = useLang();
  const list = useNotifications({ limit: 100 });
  const qc = useQueryClient();
  const [filter, setFilter] = useState<NotifFilter>('');

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

  const filtered = useMemo(() => {
    if (!filter) return data;
    if (filter === 'unread') return data.filter((n) => !n.read);
    return data.filter((n) => n.type === filter);
  }, [data, filter]);

  const counts = useMemo(() => ({
    all: data.length,
    unread: data.filter((n) => !n.read).length,
    class_announcement: data.filter((n) => n.type === 'class_announcement').length,
    reminder: data.filter((n) => n.type === 'reminder').length,
    achievement: data.filter((n) => n.type === 'achievement').length,
    system: data.filter((n) => n.type === 'system').length,
  }), [data]);

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

      {/* 筛选 tabs */}
      {!list.isLoading && !list.isError && data.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '0 var(--sp-5) var(--sp-3)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          <NotifTab active={filter === ''} onClick={() => setFilter('')}>
            {s('全部', '全部', 'All')} ({counts.all})
          </NotifTab>
          {counts.unread > 0 && (
            <NotifTab active={filter === 'unread'} onClick={() => setFilter('unread')}>
              {s('未读', '未讀', 'Unread')} ({counts.unread})
            </NotifTab>
          )}
          {counts.class_announcement > 0 && (
            <NotifTab active={filter === 'class_announcement'} onClick={() => setFilter('class_announcement')}>
              {s('班级', '班級', 'Class')} ({counts.class_announcement})
            </NotifTab>
          )}
          {counts.reminder > 0 && (
            <NotifTab active={filter === 'reminder'} onClick={() => setFilter('reminder')}>
              {s('学习', '學習', 'Learning')} ({counts.reminder})
            </NotifTab>
          )}
          {counts.achievement > 0 && (
            <NotifTab active={filter === 'achievement'} onClick={() => setFilter('achievement')}>
              {s('成就', '成就', 'Achievement')} ({counts.achievement})
            </NotifTab>
          )}
          {counts.system > 0 && (
            <NotifTab active={filter === 'system'} onClick={() => setFilter('system')}>
              {s('系统', '系統', 'System')} ({counts.system})
            </NotifTab>
          )}
        </div>
      )}

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
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-7) var(--sp-5)', color: 'var(--ink-3)' }}>
            <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
              {s('当前筛选下暂无通知', '當前篩選下暫無通知', 'No notifications match this filter')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {filtered.map((n) => (
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

function NotifTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 'var(--r-pill)',
        border: '1px solid ' + (active ? 'var(--saffron-light)' : 'var(--glass-border)'),
        background: active ? 'var(--saffron-pale)' : 'var(--glass-thick)',
        color: active ? 'var(--saffron-dark)' : 'var(--ink-3)',
        font: 'var(--text-caption)',
        fontWeight: 600,
        letterSpacing: 1,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
