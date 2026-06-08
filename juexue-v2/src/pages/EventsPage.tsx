// EventsPage · /events
//   综合活动列表 · 班级共修 + 系统法会（DharmaAssembly）联合
//   - 数据：扩展后的 /api/my/upcoming-events（含 dharma_assembly kind）
//   - 默认显示未来 7 天 · withinMin = 7*24*60 = 10080
//   - 每条 chip 区分 type：🧘 共修 / 🪷 法会 / 🪷 系统共修 / 🪷 纪念日
//   - 点击 → 各自详情页（/class/:id/sessions/:sid 或 /assemblies/:id）
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';
import { useUpcomingEvents, type UpcomingEvent } from '@/lib/queries';

// 7 天窗口
const WITHIN_MIN = 7 * 24 * 60;

export default function EventsPage() {
  const { s } = useLang();
  const q = useUpcomingEvents(WITHIN_MIN);

  const items = useMemo(() => q.data ?? [], [q.data]);

  // 分组：进行中 / 即将开始
  const now = Date.now();
  const inProgress = items.filter((e) => isInProgress(e, now));
  const upcoming = items.filter((e) => !isInProgress(e, now));

  return (
    <div>
      <TopNav titles={['活动', '活動', 'Events'] as any} backTo="/" />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {q.isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton.Card key={i} />)}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon="📅" title={s('近 7 天暂无活动', '近 7 天暫無活動', 'No events in next 7 days')} />
        ) : (
          <>
            {inProgress.length > 0 && (
              <>
                <SectionLabel>{s('进行中', '進行中', 'In Progress')}</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
                  {inProgress.map((e) => <EventCard key={e.kind + e.id} event={e} live />)}
                </div>
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <SectionLabel>{s('即将开始', '即將開始', 'Upcoming')}</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {upcoming.map((e) => <EventCard key={e.kind + e.id} event={e} live={false} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function isInProgress(e: UpcomingEvent, now: number): boolean {
  const start = new Date(e.startAt).getTime();
  if (e.kind === 'dharma_assembly') {
    const end = e.endAt ? new Date(e.endAt).getTime() : start;
    return start <= now && end > now;
  }
  // class_session: 用 durationMin
  const dur = e.durationMin ?? 60;
  return start <= now && start + dur * 60_000 > now;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      font: 'var(--text-caption)',
      color: 'var(--ink-3)',
      letterSpacing: 2,
      marginBottom: 'var(--sp-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
      {children}
    </h2>
  );
}

function EventCard({ event, live }: { event: UpcomingEvent; live: boolean }) {
  const { s } = useLang();
  const isAssembly = event.kind === 'dharma_assembly';

  // type chip
  const chipConfig = isAssembly
    ? {
        emoji: '🪷',
        bg: 'var(--saffron-pale)',
        text: 'var(--saffron-dark)',
        border: 'var(--saffron)',
        label: event.category === 'memorial'
          ? s('纪念日', '紀念日', 'Memorial')
          : event.category === 'system_session'
            ? s('系统共修', '系統共修', 'Session')
            : s('法会', '法會', 'Assembly'),
      }
    : {
        emoji: '🧘',
        bg: '#EFF6FF',
        text: '#1D4ED8',
        border: '#93C5FD',
        label: s('班级共修', '班級共修', 'Class'),
      };

  const liveChip = live ? {
    bg: '#FEF2F2',
    text: '#DC2626',
    border: '#FCA5A5',
    label: s('🔴 进行中', '🔴 進行中', '🔴 Live'),
  } : null;

  return (
    <Link
      to={event.detailPath}
      className="glass-card-thick"
      style={{
        padding: 'var(--sp-4)',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: chipConfig.bg,
            color: chipConfig.text,
            border: '1px solid ' + chipConfig.border,
            font: 'var(--text-caption)',
            fontWeight: 600,
          }}
        >
          {chipConfig.emoji} {chipConfig.label}
        </span>
        {liveChip && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: liveChip.bg,
              color: liveChip.text,
              border: '1px solid ' + liveChip.border,
              font: 'var(--text-caption)',
              fontWeight: 600,
            }}
          >
            {liveChip.label}
          </span>
        )}
      </div>

      <div style={{ font: 'var(--text-body)', fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
        {event.title}
      </div>

      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 4 }}>
        {isAssembly && event.endAt
          ? `${new Date(event.startAt).toLocaleString()} – ${new Date(event.endAt).toLocaleString()}`
          : new Date(event.startAt).toLocaleString()}
      </div>

      {event.subtitle && !isAssembly && (
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
          {s('班级：', '班級：', 'Class: ')}{event.subtitle}
        </div>
      )}
    </Link>
  );
}
