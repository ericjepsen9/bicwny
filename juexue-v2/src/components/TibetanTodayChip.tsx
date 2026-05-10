// 首页用 · 今日藏历紧凑 pill
//   - 全宽 saffron-pale 背景 pill · 明确「藏历」标签 + 月名/日 + 主标注 + ›
//   - 点击跳 /calendar
//   - 数据未加载 / 空 → 仍显示「藏历 · 5月10日」可点击 · 不消失
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface TibetanDay {
  date: string;
  lunar: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary: boolean;
  tags: string[];
  auspicious: boolean;
  events: string[];
  publicHoliday: string | null;
}

export default function TibetanTodayChip() {
  const data = useQuery({
    queryKey: ['/api/calendar/today'],
    queryFn: ({ signal }) => api.get<TibetanDay | null>('/api/calendar/today', { signal }),
    staleTime: 60 * 60 * 1000,
  });

  const day = data.data;
  const mainEvent = day?.events?.find((e) => !e.startsWith('理发吉日')) ?? null;
  const now = new Date();
  const fallback = `${now.getMonth() + 1}月${now.getDate()}日`;

  return (
    <Link
      to="/calendar"
      aria-label="今日藏历 · 点击查看月历"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--saffron-pale)',
        border: '1px solid var(--saffron-light)',
        color: 'var(--saffron-dark)',
        font: 'var(--text-caption)',
        textDecoration: 'none',
        marginBottom: 6,
        maxWidth: 'fit-content',
      }}
    >
      <span style={{ fontWeight: 700 }}>📿 藏历</span>
      <span style={{ color: 'var(--ink-2)' }}>·</span>
      {day ? (
        <>
          <span style={{ color: 'var(--ink-2)' }}>
            {day.tibetanMonth}{day.isIntercalary ? '·闰' : ''}{day.tibetan}
          </span>
          {day.auspicious && <span aria-hidden>🌺</span>}
          {day.publicHoliday && (
            <span style={{ color: 'var(--crimson)', fontWeight: 600 }}>{day.publicHoliday}</span>
          )}
          {mainEvent && (
            <span style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {mainEvent}
            </span>
          )}
        </>
      ) : (
        <span style={{ color: 'var(--ink-3)' }}>{fallback}</span>
      )}
      <span style={{ color: 'var(--ink-4)', fontSize: '0.75rem', marginLeft: 'auto' }}>›</span>
    </Link>
  );
}
