// 首页 / 其他页面用的 · 今日藏历紧凑 chip
//   - 1 行显示：📿 藏历月名+日 · 主要事件（最多 1 条）· 🌺
//   - 点击跳 /calendar
//   - 数据无 → 显示「藏历」+ 公历 fallback · 不影响布局
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
    staleTime: 60 * 60 * 1000, // 1h
  });

  const day = data.data;
  // 取最显眼的一条事件（去掉理发吉日开头的批注 · 它太啰嗦不适合 chip）
  const mainEvent = day?.events?.find((e) => !e.startsWith('理发吉日')) ?? null;

  return (
    <Link
      to="/calendar"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        font: 'var(--text-caption)',
        color: 'var(--ink-3)',
        textDecoration: 'none',
        letterSpacing: 1,
        marginBottom: 4,
        maxWidth: '100%',
      }}
      aria-label="今日藏历"
    >
      <span style={{ color: 'var(--saffron-dark)', fontWeight: 700 }}>📿</span>
      {day ? (
        <>
          <span style={{ color: 'var(--ink-2)' }}>
            {day.tibetanMonth}{day.isIntercalary ? '·闰' : ''}{day.tibetan}
          </span>
          {day.auspicious && <span aria-hidden>🌺</span>}
          {day.publicHoliday && (
            <span style={{ color: 'var(--crimson)', fontWeight: 600 }}>· {day.publicHoliday}</span>
          )}
          {mainEvent && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              · {mainEvent}
            </span>
          )}
        </>
      ) : (
        <span>{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span>
      )}
    </Link>
  );
}
