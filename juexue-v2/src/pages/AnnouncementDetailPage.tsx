// AnnouncementDetailPage · /announcements/:id
//   系统公告详情 · push / banner / 通知中心点击的跳转目标（spec §3.6 + §4 跳转矩阵）
//   - 兜底显示 revokedAt（已撤回 · 半透明 + 删除线）
//   - 兜底显示 expiresAt < now（已过期标记）
//   - 不存在 / 权限错 → ErrorState
import { useParams } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';
import { useSystemAnnouncement } from '@/lib/queries';

export default function AnnouncementDetailPage() {
  const { s } = useLang();
  const { id } = useParams<{ id: string }>();
  const q = useSystemAnnouncement(id ?? null);

  const a = q.data;
  const isRevoked = !!a?.revokedAt;
  const isExpired = a ? new Date(a.expiresAt).getTime() < Date.now() : false;

  // severity 视觉
  const severityChip = a?.severity === 'critical'
    ? { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5', label: s('紧急', '緊急', 'Critical') }
    : a?.severity === 'urgent'
      ? { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D', label: s('重要', '重要', 'Urgent') }
      : { bg: 'var(--glass)', text: 'var(--ink-3)', border: 'var(--border)', label: s('普通', '普通', 'Normal') };

  return (
    <div>
      <TopNav titles={['公告', '公告', 'Announcement']} backTo="/" />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {q.isLoading ? (
          <Skeleton.Card />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !a ? (
          <EmptyState icon="📭" title={s('公告不存在', '公告不存在', 'Not found')} />
        ) : (
          <div
            className="glass-card-thick"
            style={{
              padding: 'var(--sp-5)',
              opacity: isRevoked ? 0.55 : 1,
            }}
          >
            {/* severity chip */}
            <div style={{ marginBottom: 'var(--sp-3)' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: severityChip.bg,
                  color: severityChip.text,
                  border: '1px solid ' + severityChip.border,
                  font: 'var(--text-caption)',
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                {severityChip.label}
              </span>
              {isRevoked && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'var(--glass)',
                    color: 'var(--ink-3)',
                    font: 'var(--text-caption)',
                  }}
                >
                  {s('已撤回', '已撤回', 'Revoked')}
                </span>
              )}
              {!isRevoked && isExpired && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'var(--glass)',
                    color: 'var(--ink-3)',
                    font: 'var(--text-caption)',
                  }}
                >
                  {s('已过期', '已過期', 'Expired')}
                </span>
              )}
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '1.25rem',
                color: 'var(--ink)',
                letterSpacing: 1.5,
                marginBottom: 'var(--sp-3)',
                textDecoration: isRevoked ? 'line-through' : 'none',
              }}
            >
              {a.title}
            </h1>

            <div
              style={{
                font: 'var(--text-body)',
                color: 'var(--ink-2)',
                letterSpacing: '.5px',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                marginBottom: 'var(--sp-4)',
              }}
            >
              {a.body}
            </div>

            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
              {new Date(a.createdAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
