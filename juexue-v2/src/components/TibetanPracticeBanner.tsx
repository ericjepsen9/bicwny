// 修学页面顶部藏历功德 banner
//   - 仅在「今日有加持日 / 荟供 / 法会 / 🌺」时显示
//   - 左：事件名（例：莲师荟供日）· 右：×N倍 醒目徽章
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
// 匹配「作何善恶成X倍」或「成X倍」 · X 是中文数字（含 万/亿/千/百/十）
const MULTIPLIER_RE = /成([一二三四五六七八九十百千万亿0-9]+)倍/;

function parseEvent(text: string): { name: string; multiplier: string | null } {
  const m = text.match(MULTIPLIER_RE);
  if (!m) return { name: text, multiplier: null };
  // 名字取逗号前部分（"莲师荟供日,作何善恶成十万倍" → "莲师荟供日"）
  const name = text.split(/[,，]/)[0]!.trim();
  return { name, multiplier: m[1] + '倍' };
}

export default function TibetanPracticeBanner() {
  const data = useQuery({
    queryKey: ['/api/calendar/today'],
    queryFn: ({ signal }) => api.get<TibetanDay | null>('/api/calendar/today', { signal }),
    staleTime: 60 * 60 * 1000,
  });

  const day = data.data;
  if (!day) return null;

  const relevant = day.events.find((e) => KEYWORDS.some((k) => e.includes(k)));
  if (!relevant && !day.auspicious) return null;

  const { name, multiplier } = relevant
    ? parseEvent(relevant)
    : { name: `${day.tibetanMonth} · 修法功德日`, multiplier: null };

  return (
    <Link
      to="/calendar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
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
        {name}
      </span>
      {multiplier && (
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--saffron-dark)',
            color: '#fff',
            fontWeight: 700,
            letterSpacing: 1,
            fontSize: '0.78rem',
            whiteSpace: 'nowrap',
          }}
        >
          功德 ×{multiplier}
        </span>
      )}
      <span style={{ color: 'var(--ink-4)', fontSize: '0.7rem' }}>›</span>
    </Link>
  );
}

