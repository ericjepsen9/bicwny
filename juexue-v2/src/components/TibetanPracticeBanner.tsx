// 修学页面顶部藏历功德 banner
//   - 仅在「今日有加持日 / 荟供 / 法会 / 🌺」时显示
//   - 显示 1 行：📿 今日 xxx · 修法功德 × 倍数
//   - 点击跳 /calendar
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface TibetanDay {
  date: string;
  tibetan: string;
  tibetanMonth: string;
  auspicious: boolean;
  events: string[];
}

const KEYWORDS = ['加持日', '荟供', '法会', '诞辰', '圣诞', '涅槃'];

export default function TibetanPracticeBanner() {
  const data = useQuery({
    queryKey: ['/api/calendar/today'],
    queryFn: ({ signal }) => api.get<TibetanDay | null>('/api/calendar/today', { signal }),
    staleTime: 60 * 60 * 1000,
  });

  const day = data.data;
  if (!day) return null;

  // 找出含修法关键词的事件 · 取前 1 条
  const relevant = day.events.find((e) => KEYWORDS.some((k) => e.includes(k)));
  if (!relevant && !day.auspicious) return null;

  const text = relevant ?? `${day.tibetanMonth} · 修法功德日`;

  return (
    <Link
      to="/calendar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 'var(--r-pill)',
        background: 'linear-gradient(90deg, var(--gold-pale), var(--saffron-pale))',
        border: '1px solid var(--saffron-light)',
        color: 'var(--saffron-dark)',
        font: 'var(--text-caption)',
        textDecoration: 'none',
        letterSpacing: 1,
      }}
    >
      <span style={{ fontSize: '1rem' }}>{day.auspicious ? '🌺' : '📿'}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
        {text}
      </span>
      <span style={{ color: 'var(--ink-4)', fontSize: '0.7rem' }}>›</span>
    </Link>
  );
}
