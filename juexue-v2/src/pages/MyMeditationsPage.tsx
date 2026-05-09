// 我的观修历史 · /me/meditations
//   - 已完成的观修列表（按完成时间倒序 · 跨课程）
//   - 含视频时长 / 法本来源 / 完成时间
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { relTime } from '@/lib/relTime';

interface MyMeditationItem {
  id: string;
  meditationId: string;
  videoWatchedSec: number;
  completedAt: string;
  meditation: {
    id: string;
    title: string;
    titleTraditional: string | null;
    videoDurationSec: number;
    courseId: string | null;
    lessonId: string | null;
    course: { id: string; slug: string; title: string; coverEmoji: string } | null;
    lesson: { id: string; title: string } | null;
  };
}

export default function MyMeditationsPage() {
  const { s } = useLang();
  const list = useQuery({
    queryKey: ['/api/me/meditations'],
    queryFn: ({ signal }) => api.get<MyMeditationItem[]>('/api/me/meditations', { signal }),
  });

  const items = list.data ?? [];
  const totalSec = items.reduce((acc, m) => acc + m.videoWatchedSec, 0);

  return (
    <>
      <TopNav titles={['我的观修', '我的觀修', 'My meditations']} backTo="/profile" />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

        {/* KPI · admin dashboard 风 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}>
          <Kpi value={String(items.length)} label={s('已完成', '已完成', 'Completed')} color="var(--sage-dark)" />
          <Kpi value={fmtMin(totalSec)} label={s('累计时长', '累計時長', 'Total time')} color="var(--saffron-dark)" />
        </div>

        {list.isLoading ? <Skeleton.List /> : items.length === 0 ? (
          <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-5) 0' }}>
            {s('暂无完成的观修 · 去课时找观修视频', '暫無完成的觀修', 'No completed meditations yet')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {items.map((m) => (
              <Link
                key={m.id}
                to={`/meditation/${encodeURIComponent(m.meditationId)}`}
                className="glass-card-thick"
                style={{ padding: 'var(--sp-3) var(--sp-4)', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '1.2rem' }}>{m.meditation.course?.coverEmoji ?? '🧘'}</span>
                  <h3 style={{ flex: 1, fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 1.5, fontSize: '1rem', margin: 0 }}>
                    {m.meditation.title}
                  </h3>
                  <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>✓</span>
                </div>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                  {m.meditation.course?.title && <span>{m.meditation.course.title} · </span>}
                  {fmtMin(m.videoWatchedSec)}
                  {' · '}
                  {relTime(m.completedAt, s)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Kpi({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', minHeight: 110, display: 'flex', flexDirection: 'column' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.6rem', color: color ?? 'var(--ink)', letterSpacing: 1, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function fmtMin(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
