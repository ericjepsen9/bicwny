// 学员藏历页 · /calendar
//   - 默认显示当前月 · 上下箭头切月
//   - 网格 7 列 · 每格显示公历日 + 藏历小字 + 标记（🌺 / 圣诞 / 法会 / 假日）
//   - 点格 → 弹底部 sheet 显示当日完整信息
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { api } from '@/lib/api';
import { useLang } from '@/lib/i18n';

interface TibetanDay {
  date: string;
  lunar: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary: boolean;
  tags: ('十斋日' | '飞幡日' | '八吉同聚' | '九凶同聚')[];
  auspicious: boolean;
  events: string[];
  publicHoliday: string | null;
}

function fmtYm(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { s } = useLang();
  const today = todayYmd();
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selected, setSelected] = useState<string | null>(null);

  const ym = fmtYm(year, month);
  const data = useQuery({
    queryKey: ['/api/calendar/month', ym],
    queryFn: ({ signal }) => api.get<TibetanDay[]>(`/api/calendar/month/${ym}`, { signal }),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, TibetanDay>();
    (data.data ?? []).forEach((d) => map.set(d.date, d));
    return map;
  }, [data.data]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const selectedDay = selected ? byDate.get(selected) : null;

  function shiftMonth(delta: number) {
    let y = year, m = month + delta;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    setYear(y);
    setMonth(m);
    setSelected(null);
  }

  function jumpToToday() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
    setSelected(today);
  }

  return (
    <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <Link to="/" style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', textDecoration: 'none' }}>
        ← {s('返回首页', '返回首頁', 'Home')}
      </Link>

      {/* 月份导航 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => shiftMonth(-1)} className="btn btn-pill" style={{ padding: '6px 12px' }}>‹</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.3rem', letterSpacing: 2 }}>
          📿 {year} · {String(month).padStart(2, '0')}
        </h1>
        <button type="button" onClick={() => shiftMonth(1)} className="btn btn-pill" style={{ padding: '6px 12px' }}>›</button>
      </div>
      <button type="button" onClick={jumpToToday} className="btn btn-pill" style={{ alignSelf: 'center', padding: '4px 14px', font: 'var(--text-caption)', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)' }}>
        {s('回到今日', '回到今日', 'Today')}
      </button>

      {/* 星期表头 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, font: 'var(--text-caption)', color: 'var(--ink-3)', textAlign: 'center' }}>
        {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {data.isLoading ? <Skeleton.List /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const day = byDate.get(cell.ymd);
            const isToday = cell.ymd === today;
            const isSelected = selected === cell.ymd;
            const hasEvent = (day?.events?.length ?? 0) > 0 || day?.auspicious;
            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => setSelected(isSelected ? null : cell.ymd)}
                style={{
                  aspectRatio: '1',
                  border: isSelected ? '2px solid var(--saffron-dark)' : '1px solid var(--border-light)',
                  borderRadius: 6,
                  background: isToday ? 'var(--saffron-pale)' : 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 2,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.05rem', color: isToday ? 'var(--saffron-dark)' : 'var(--ink)' }}>
                  {cell.day}
                </div>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', fontSize: '0.65rem', lineHeight: 1, marginTop: 2 }}>
                  {day?.tibetan ?? ''}
                </div>
                {day?.auspicious && (
                  <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.7rem' }}>🌺</div>
                )}
                {!day?.auspicious && hasEvent && (
                  <div style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--saffron-dark)' }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 选中日详情 */}
      {selectedDay && <DayDetail day={selectedDay} />}

      {/* 图例 */}
      <div className="glass-card" style={{ padding: 'var(--sp-3)', font: 'var(--text-caption)', color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>🌺 {s('修法功德日 · 公农藏共认特殊日', '修法功德日 · 公農藏共認特殊日', 'Auspicious day')}</div>
        <div>● {s('当日有圣诞 / 加持日 / 法会等', '當日有聖誕 / 加持日 / 法會等', 'Has events')}</div>
      </div>
    </div>
  );
}

function DayDetail({ day }: { day: TibetanDay }) {
  const { s } = useLang();
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
          {day.date}
        </h3>
        {day.auspicious && <span style={{ fontSize: '1rem' }}>🌺</span>}
        {day.publicHoliday && (
          <span className="chip" style={{ background: 'var(--crimson-pale)', color: 'var(--crimson)' }}>
            {day.publicHoliday}
          </span>
        )}
      </div>

      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
        {s('农历', '農曆', 'Lunar')}: {day.lunar}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
        {s('藏历', '藏曆', 'Tibetan')}:{' '}
        <span style={{ color: 'var(--saffron-dark)', fontWeight: 600 }}>
          {day.tibetanMonth} · {day.isIntercalary ? '闰' : ''}{day.tibetan}
        </span>
      </div>

      {day.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {day.tags.map((t) => (
            <span key={t} className="chip" style={{ background: 'var(--sage-pale)', color: 'var(--sage-dark)' }}>{t}</span>
          ))}
        </div>
      )}

      {day.events.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {day.events.map((e, i) => (
            <li key={i} style={{ font: 'var(--text-body)', color: 'var(--ink)' }}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Cell { day: number; ymd: string }

function buildMonthGrid(year: number, month: number): (Cell | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDow = first.getUTCDay(); // 0 = Sunday
  const cells: (Cell | null)[] = [];
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let d = 1; d <= dim; d += 1) {
    cells.push({ day: d, ymd: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
