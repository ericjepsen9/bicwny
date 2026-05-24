// 首页用 · 紧凑日期 chip
//   - iOS 风日历图标（顶 crimson 月份 + 底 大数字日）显示当日真实日期
//   - 后接「· 节日/事件」（如有）· 无背景无边框
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

const MONTH_SC = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function CalendarIcon({ month, day }: { month: number; day: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: 30,
        height: 30,
        borderRadius: 5,
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        background: '#fff',
        fontFamily: 'var(--font-serif)',
        lineHeight: 1,
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
      }}
    >
      <span
        style={{
          background: 'var(--crimson)',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0,
          textAlign: 'center',
          padding: '2px 0 1px',
        }}
      >
        {MONTH_SC[month - 1]}
      </span>
      <span
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--ink)',
        }}
      >
        {day}
      </span>
    </span>
  );
}

export default function TibetanTodayChip() {
  const data = useQuery({
    queryKey: ['/api/calendar/today'],
    queryFn: ({ signal }) => api.get<TibetanDay | null>('/api/calendar/today', { signal }),
    staleTime: 60 * 60 * 1000,
  });

  const day = data.data;
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const firstEvent = day?.events?.find((e) => !e.startsWith('理发吉日')) ?? null;
  const headline = day?.publicHoliday ?? firstEvent ?? null;

  return (
    <Link
      to="/calendar"
      aria-label={`今日 ${m}月${d}日 · 日历`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        font: 'var(--text-caption)',
        color: 'var(--ink-3)',
        textDecoration: 'none',
        letterSpacing: 1,
        padding: '6px 4px',
        margin: '-6px -4px 0',
        minHeight: 36,
        maxWidth: '100%',
      }}
    >
      <CalendarIcon month={m} day={d} />
      {day?.auspicious && <span aria-hidden>🌺</span>}
      {headline && (
        <span style={{ color: day?.publicHoliday ? 'var(--crimson)' : 'var(--ink-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {headline}
        </span>
      )}
    </Link>
  );
}
