// DevicesPage · /devices
//   登录会话列表 · 当前会话标 · 单条/批量退出
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useSessions } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function DevicesPage() {
  const { s } = useLang();
  const list = useSessions();
  const qc = useQueryClient();

  const revokeOne = useMutation({
    mutationFn: (id: string) => api.del(`/api/auth/sessions/${encodeURIComponent(id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
      toast.ok(s('已退出该设备', '已退出該裝置', 'Revoked'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const revokeOthers = useMutation({
    mutationFn: () => api.post('/api/auth/sessions/revoke-others'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
      toast.ok(s('其他设备已退出', '其他裝置已退出', 'Other devices signed out'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const data = list.data ?? [];
  const others = data.filter((d) => !d.isCurrent);

  return (
    <div>
      <TopNav titles={['登录设备', '登入裝置', 'Devices']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {list.isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton.Card key={i} />)}
          </div>
        ) : list.isError ? (
          <p style={{ color: 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-6)' }}>
            {(list.error as ApiError).message}
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
              {data.map((d) => (
                <div
                  key={d.id}
                  className="glass-card-thick"
                  style={{ padding: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--saffron-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                    📱
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--ink)', letterSpacing: 1.5 }}>
                      {(d.browser || s('未知浏览器', '未知瀏覽器', 'Unknown browser'))}
                      {d.isCurrent && (
                        <span style={{ marginLeft: 8, color: 'var(--sage-dark)', font: 'var(--text-caption)', fontWeight: 700 }}>
                          ({s('当前', '當前', 'current')})
                        </span>
                      )}
                    </div>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '.5px', marginTop: 2 }}>
                      {(d.os || '—')} · {d.ipAddress || '—'}
                    </div>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, marginTop: 2 }}>
                      {s('登录于', '登入於', 'Signed in')}: {new Date(d.issuedAt).toLocaleString()}
                    </div>
                  </div>
                  {!d.isCurrent && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(s('退出此设备？', '退出此裝置？', 'Revoke?'))) return;
                        revokeOne.mutate(d.id);
                      }}
                      className="btn btn-pill"
                      style={{ padding: '6px 12px', font: 'var(--text-caption)', background: 'transparent', color: 'var(--crimson)', border: '1px solid rgba(192,57,43,.3)' }}
                    >
                      {s('退出', '退出', 'Revoke')}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {others.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm(s('退出所有其他设备？', '退出所有其他裝置？', 'Sign out other devices?'))) return;
                  revokeOthers.mutate();
                }}
                disabled={revokeOthers.isPending}
                className="btn btn-pill btn-full"
                style={{
                  padding: 12,
                  background: 'transparent',
                  color: 'var(--crimson)',
                  border: '1px solid rgba(192,57,43,.3)',
                  justifyContent: 'center',
                }}
              >
                {revokeOthers.isPending
                  ? s('处理中…', '處理中…', 'Processing…')
                  : s('退出其他所有设备', '退出其他所有裝置', 'Sign out others')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
