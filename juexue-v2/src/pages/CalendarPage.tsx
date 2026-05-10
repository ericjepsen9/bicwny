// 学员藏历页 · /calendar
//   - 默认显示当前月 · 上下箭头切月
//   - 网格 7 列 · 每格显示公历日 + 藏历小字 + 标记（🌺 / 圣诞 / 法会 / 假日）
//   - 点格 → 弹底部 sheet 显示当日完整信息
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useCoachClasses } from '@/lib/queries';

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
  const { pathname } = useLocation();
  const isCoach = pathname.startsWith('/coach');
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

  // 本月概览：功德日 / 十斋日 / 主要法会
  const overview = useMemo(() => {
    const days = data.data ?? [];
    const auspiciousCount = days.filter((d) => d.auspicious).length;
    const fastCount = days.filter((d) => d.tags?.includes('十斋日')).length;
    const tibMonths = Array.from(new Set(days.map((d) => d.tibetanMonth))).filter(Boolean);
    // 主法会：events 里出现「法会」字样的连续天 · 取头条名 · 去重
    const ceremonies = new Set<string>();
    days.forEach((d) => {
      d.events.forEach((e) => {
        if (e.includes('法会') && !e.includes('结束') && !e.includes('开始')) ceremonies.add(e);
        else if (e.includes('法会开始')) ceremonies.add(e.replace('开始', '').trim());
      });
    });
    return { auspiciousCount, fastCount, tibMonths, ceremonies: Array.from(ceremonies).slice(0, 3) };
  }, [data.data]);

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
    <>
      <TopNav
        titles={['藏历', '藏曆', 'Calendar']}
        backTo={isCoach ? '/coach' : '/'}
        right={(
          <button type="button" onClick={jumpToToday} style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', background: 'transparent', border: 'none', padding: '4px 10px', cursor: 'pointer' }}>
            {s('今日', '今日', 'Today')}
          </button>
        )}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>

      {/* 月份导航 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => shiftMonth(-1)} className="btn btn-pill" style={{ padding: '6px 12px' }}>‹</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.3rem', letterSpacing: 2 }}>
          📿 {year} · {String(month).padStart(2, '0')}
        </h1>
        <button type="button" onClick={() => shiftMonth(1)} className="btn btn-pill" style={{ padding: '6px 12px' }}>›</button>
      </div>

      {/* 数据空态：seed 未灌库 / 当月未编辑 */}
      {!data.isLoading && (data.data?.length ?? 0) === 0 && (
        <div className="glass-card" style={{ padding: 'var(--sp-4)', textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📿</div>
          <p style={{ font: 'var(--text-body)', margin: 0 }}>
            {s('当月暂无藏历数据', '當月暫無藏曆數據', 'No calendar data this month')}
          </p>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
            {s('请联系管理员录入', '請聯繫管理員錄入', 'Contact admin to populate')}
          </p>
        </div>
      )}

      {/* 本月概览 · 藏历月名 + 功德日 / 十斋日 / 主法会 */}
      {!data.isLoading && (data.data?.length ?? 0) > 0 && (
        <div className="glass-card" style={{ padding: 'var(--sp-3)', display: 'flex', flexWrap: 'wrap', gap: 8, font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
          {overview.tibMonths.map((m) => (
            <span key={m} className="chip" style={{ background: 'var(--saffron-pale)', color: 'var(--saffron-dark)' }}>📿 {m}</span>
          ))}
          {overview.auspiciousCount > 0 && (
            <span className="chip" style={{ background: 'var(--gold-pale)', color: 'var(--gold-dark)' }}>🌺 {overview.auspiciousCount} {s('天功德日', '天功德日', 'auspicious days')}</span>
          )}
          {overview.fastCount > 0 && (
            <span className="chip" style={{ background: 'var(--sage-pale)', color: 'var(--sage-dark)' }}>{overview.fastCount} {s('天十斋日', '天十齋日', 'fast days')}</span>
          )}
          {overview.ceremonies.map((c) => (
            <span key={c} className="chip" style={{ background: 'var(--crimson-pale)', color: 'var(--crimson)' }}>📜 {c}</span>
          ))}
        </div>
      )}

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
      {selectedDay && <DayDetail day={selectedDay} isCoach={isCoach} />}

      {/* 图例 */}
      <div className="glass-card" style={{ padding: 'var(--sp-3)', font: 'var(--text-caption)', color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>🌺 {s('修法功德日 · 公农藏共认特殊日', '修法功德日 · 公農藏共認特殊日', 'Auspicious day')}</div>
        <div>● {s('当日有圣诞 / 加持日 / 法会等', '當日有聖誕 / 加持日 / 法會等', 'Has events')}</div>
      </div>
    </div>
    </>
  );
}

function DayDetail({ day, isCoach }: { day: TibetanDay; isCoach: boolean }) {
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
      {isCoach && <CoachPublishCTA day={day} />}
    </div>
  );
}

function CoachPublishCTA({ day }: { day: TibetanDay }) {
  const { s } = useLang();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const classes = useCoachClasses();
  const list = classes.data ?? [];

  const eventsText = day.events.filter((e) => !e.startsWith('理发吉日'));
  const headline = eventsText[0] ?? day.publicHoliday ?? `${day.tibetanMonth} · ${day.tibetan}`;
  const title = `【${day.date}】${headline}`;
  const body = [
    `公历：${day.date}`,
    `藏历：${day.tibetanMonth} · ${day.isIntercalary ? '闰' : ''}${day.tibetan}`,
    `农历：${day.lunar}`,
    day.tags.length > 0 ? `标记：${day.tags.join(' · ')}` : '',
    day.auspicious ? '🌺 修法功德日' : '',
    eventsText.length > 0 ? '\n' + eventsText.map((e) => `· ${e}`).join('\n') : '',
  ].filter(Boolean).join('\n');

  function jumpTo(classId: string) {
    const url = `/coach/classes/${encodeURIComponent(classId)}/announcements?compose=1&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    navigate(url);
  }

  if (list.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => list.length === 1 ? jumpTo(list[0]!.id) : setPicking(true)}
        className="btn btn-pill"
        style={{ marginTop: 'var(--sp-2)', alignSelf: 'flex-start', padding: '6px 14px', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: '1px solid var(--saffron-light)', font: 'var(--text-caption)' }}
      >
        📢 {s('发到班级公告', '發到班級公告', 'Post to class')}
      </button>

      {picking && (
        <div
          onClick={() => setPicking(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-card-thick"
            style={{ padding: 'var(--sp-4)', minWidth: 280, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <h4 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 700 }}>
              {s('选择班级', '選擇班級', 'Select class')}
            </h4>
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setPicking(false); jumpTo(c.id); }}
                className="btn btn-pill"
                style={{ padding: '8px 14px', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border-light)' }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
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
