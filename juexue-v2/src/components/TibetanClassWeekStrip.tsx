// 班级页 7 天藏历横滚条
//   - 学员侧 /class/:id 顶部 · 看本班未来 7 天功德日 / 法会 / 法定节日
//   - 仅显示有标注的天（auspicious / events / publicHoliday）· 跳过空白天
//   - 每张卡：公历日 + 星期 + 主标注（含倍数徽章）
//   - 点卡跳 /calendar
//   - 全空 → 隐藏
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface TibetanDay {
  date: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary: boolean;
  tags: string[];
  auspicious: boolean;
  events: string[];
  publicHoliday: string | null;
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const KEYWORDS = ['加持日', '荟供', '法会', '诞辰', '圣诞', '涅槃'];
const MULTIPLIER_RE = /成([一二三四五六七八九十百千万亿0-9]+)倍/;

function pickHeadline(d: TibetanDay): { name: string; multiplier: string | null; kind: 'holiday' | 'auspicious' | 'event' } {
  if (d.publicHoliday) return { name: d.publicHoliday, multiplier: null, kind: 'holiday' };
  const evt = d.events.find((e) => KEYWORDS.some((k) => e.includes(k))) ?? d.events.find((e) => !e.startsWith('理发吉日'));
  if (evt) {
    const m = evt.match(MULTIPLIER_RE);
    return { name: evt.split(/[,，]/)[0]!.trim(), multiplier: m ? m[1] + '倍' : null, kind: 'event' };
  }
  return { name: `${d.tibetanMonth} · 修法功德日`, multiplier: null, kind: 'auspicious' };
}

export default function TibetanClassWeekStrip() {
  const data = useQuery({
    queryKey: ['/api/calendar/upcoming', 7],
    queryFn: ({ signal }) => api.get<TibetanDay[]>('/api/calendar/upcoming?days=7', { signal }),
    staleTime: 60 * 60 * 1000,
  });

  const days = (data.data ?? []).filter((d) => d.auspicious || d.events.some((e) => !e.startsWith('理发吉日')) || d.publicHoliday);
  if (days.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
        {days.map((d) => {
          const date = new Date(d.date + 'T00:00:00');
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const dow = WEEKDAY[date.getDay()]!;
          const { name, multiplier, kind } = pickHeadline(d);
          const accent = kind === 'holiday' ? 'var(--crimson)' : kind === 'auspicious' ? 'var(--gold-dark)' : 'var(--saffron-dark)';

          return (
            <Link
              key={d.date}
              to="/calendar"
              style={{
                flex: '0 0 auto',
                minWidth: 130,
                maxWidth: 160,
                scrollSnapAlign: 'start',
                padding: '8px 10px',
                borderRadius: 'var(--r-md)',
                background: 'rgba(255, 255, 255, 0.55)',
                backdropFilter: 'blur(16px) saturate(140%)',
                WebkitBackdropFilter: 'blur(16px) saturate(140%)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                color: 'var(--ink)',
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.95rem', color: accent }}>
                  {month}/{day}
                </span>
                <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', fontSize: '0.7rem' }}>周{dow}</span>
                {multiplier && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      padding: '0 6px',
                      borderRadius: 'var(--r-pill)',
                      background: 'var(--saffron-pale)',
                      color: 'var(--saffron-dark)',
                      fontWeight: 700,
                      fontSize: '0.62rem',
                      letterSpacing: 0.5,
                      lineHeight: 1.6,
                    }}
                  >
                    ×{multiplier}
                  </span>
                )}
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink), letterSpacing: 0.5', fontSize: '0.7rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
