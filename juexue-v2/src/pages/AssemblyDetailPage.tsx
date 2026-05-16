// AssemblyDetailPage · /assemblies/:id
//   法会 / 系统活动 信息型展示页（spec §3.7 + §10）
//   - 无 app 内入口 · 仅展示信息 + 外部参与链接
//   - push / banner / 通知中心 link 跳转目标
//   - deletedAt → 「已取消」标识 + opacity
import { useParams } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';
import { useDharmaAssembly } from '@/lib/queries';

const CATEGORY_LABEL = {
  assembly: ['法会', '法會', 'Assembly'],
  system_session: ['共修', '共修', 'Session'],
  memorial: ['纪念日', '紀念日', 'Memorial'],
} as const;

export default function AssemblyDetailPage() {
  const { s } = useLang();
  const { id } = useParams<{ id: string }>();
  const q = useDharmaAssembly(id ?? null);

  const a = q.data;
  const isDeleted = !!a?.deletedAt;
  const now = Date.now();
  const isOngoing = a ? new Date(a.startAt).getTime() <= now && new Date(a.endAt).getTime() > now : false;
  const isPast = a ? new Date(a.endAt).getTime() <= now : false;

  return (
    <div>
      <TopNav titles={s('法会', '法會', 'Assembly') as any} backTo="/" />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {q.isLoading ? (
          <Skeleton.Card />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !a ? (
          <EmptyState icon="🪷" title={s('法会不存在', '法會不存在', 'Not found')} />
        ) : (
          <div
            className="glass-card-thick"
            style={{
              padding: 'var(--sp-5)',
              opacity: isDeleted ? 0.55 : 1,
            }}
          >
            {/* 封面图 */}
            {a.coverImage && (
              <div style={{ marginBottom: 'var(--sp-3)', borderRadius: 12, overflow: 'hidden' }}>
                <img
                  src={a.coverImage}
                  alt={a.title}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            )}

            {/* category + 状态 chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-3)' }}>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: 'var(--saffron-pale)',
                  color: 'var(--saffron-dark)',
                  border: '1px solid var(--saffron)',
                  font: 'var(--text-caption)',
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                {(() => {
                  const [sc, tc, en] = CATEGORY_LABEL[a.category];
                  return s(sc, tc, en);
                })()}
              </span>
              {isDeleted && (
                <span style={chipStyle}>{s('已取消', '已取消', 'Cancelled')}</span>
              )}
              {!isDeleted && isOngoing && (
                <span style={{ ...chipStyle, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
                  {s('进行中', '進行中', 'Live')}
                </span>
              )}
              {!isDeleted && isPast && (
                <span style={chipStyle}>{s('已结束', '已結束', 'Ended')}</span>
              )}
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '1.375rem',
                color: 'var(--ink)',
                letterSpacing: 1.5,
                marginBottom: 'var(--sp-3)',
              }}
            >
              {a.title}
            </h1>

            {/* 时间 */}
            <div
              style={{
                font: 'var(--text-body)',
                color: 'var(--ink-2)',
                letterSpacing: 1,
                marginBottom: 'var(--sp-4)',
              }}
            >
              {new Date(a.startAt).toLocaleString()} – {new Date(a.endAt).toLocaleString()}
            </div>

            {/* 参与方式 · 外部链接 */}
            {a.externalLink && !isDeleted && !isPast && (
              <div style={{ marginBottom: 'var(--sp-4)' }}>
                <a
                  href={a.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '10px 18px',
                    background: 'var(--saffron)',
                    color: '#fff',
                    borderRadius: 8,
                    font: 'var(--text-body)',
                    fontWeight: 600,
                    letterSpacing: 1,
                    textDecoration: 'none',
                  }}
                >
                  {s('加入会议 ↗', '加入會議 ↗', 'Join Meeting ↗')}
                </a>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 6 }}>
                  {s(
                    '点击跳转到外部参与链接（Zoom / 腾讯会议等）',
                    '點擊跳轉到外部參與連結（Zoom / 騰訊會議等）',
                    'Tap to open external link (Zoom / etc.)',
                  )}
                </div>
              </div>
            )}

            {/* 介绍 */}
            <div
              style={{
                font: 'var(--text-body)',
                color: 'var(--ink-2)',
                letterSpacing: '.5px',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                paddingTop: 'var(--sp-3)',
                borderTop: '1px solid var(--border)',
              }}
            >
              {a.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 999,
  background: 'var(--glass)',
  color: 'var(--ink-3)',
  font: 'var(--text-caption)',
};
