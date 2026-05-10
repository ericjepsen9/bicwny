// 班级页 7 天藏历横滚条
//   - 学员侧 /class/:id 顶部 · 看本班未来 7 天功德日 / 法会 / 法定节日
//   - 仅显示有标注的天（auspicious / events / publicHoliday）· 跳过空白天
//   - 每张卡：公历日 + 星期 + 主标注（含倍数徽章）
//   - 点卡跳 /calendar
//   - 全空 → 隐藏
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useLang } from '@/lib/i18n';

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
  const { s } = useLang();
  const data = useQuery({
    queryKey: ['/api/calendar/upcoming', 7],
    queryFn: ({ signal }) => api.get<TibetanDay[]>('/api/calendar/upcoming?days=7', { signal }),
    staleTime: 60 * 60 * 1000,
  });

  const days = (data.data ?? []).filter((d) => d.auspicious || d.events.some((e) => !e.startsWith('理发吉日')) || d.publicHoliday);
  if (days.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--sp-4)' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 8, paddingLeft: 4 }}>
        📿 {s('未来 7 天 · 修法窗口', '未來 7 天 · 修法窗口', 'Next 7 days · Practice')}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
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
                minWidth: 140,
                maxWidth: 180,
                scrollSnapAlign: 'start',
                padding: 'var(--sp-3)',
                borderRadius: 'var(--r-md)',
                background: d.auspicious ? 'var(--gold-pale)' : 'var(--surface)',
                border: `1px solid ${d.auspicious ? 'var(--saffron-light)' : 'var(--border-light)'}`,
                color: 'var(--ink)',
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.1rem', color: accent }}>
                  {month}/{day}
                </span>
                <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>周{dow}</span>
                {d.auspicious && <span aria-hidden style={{ marginLeft: 'auto' }}>🌺</span>}
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', fontSize: '0.7rem' }}>
                {d.tibetanMonth}{d.isIntercalary ? '·闰' : ''}{d.tibetan}
              </div>
              <div style={{ font: 'var(--text-body)', color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
              {multiplier && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    padding: '2px 8px',
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--saffron-dark)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    letterSpacing: 1,
                  }}
                >
                  ×{multiplier}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
