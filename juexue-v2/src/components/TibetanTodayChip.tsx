// 首页用 · 紧凑日期 chip
//   - 📅 公历日 + 节日 / 加持日 等单条显眼标注
//   - 无背景无边框 · inline 文字样式
//   - 点击跳 /calendar
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
  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日`;
  // 优先级：法定节日 > 第一条非理发吉日 event
  const firstEvent = day?.events?.find((e) => !e.startsWith('理发吉日')) ?? null;
  const headline = day?.publicHoliday ?? firstEvent ?? null;

  return (
    <Link
      to="/calendar"
      aria-label="日历"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        font: 'var(--text-caption)',
        color: 'var(--ink-3)',
        textDecoration: 'none',
        letterSpacing: 1,
        padding: '8px 4px',
        margin: '-8px -4px 0',
        minHeight: 36,
        maxWidth: '100%',
      }}
    >
      <span aria-hidden style={{ fontSize: '1rem' }}>📅</span>
      <span style={{ color: 'var(--ink-2)' }}>{dateLabel}</span>
      {day?.auspicious && <span aria-hidden>🌺</span>}
      {headline && (
        <>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span style={{ color: day?.publicHoliday ? 'var(--crimson)' : 'var(--ink-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {headline}
          </span>
        </>
      )}
    </Link>
  );
}
