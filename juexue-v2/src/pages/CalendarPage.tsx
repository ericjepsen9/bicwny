// 学员藏历页 · /calendar
//   - 默认显示当前月 · 上下箭头切月
//   - 网格 7 列 · 每格显示公历日 + 藏历小字 + 标记（🌺 / 圣诞 / 法会 / 假日）
//   - 点格 → 弹底部 sheet 显示当日完整信息
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useCoachClasses } from '@/lib/queries';

// 桌面 ≥768 用 centered modal · 手机用底部 sheet（CSS-GOTCHAS 坑 7）
function useIsWide(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const fn = () => setWide(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return wide;
}

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const isWide = useIsWide();

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
    const ceremonyList = Array.from(ceremonies).slice(0, 3);
    const parts: string[] = [...tibMonths];
    if (auspiciousCount > 0) parts.push(`${auspiciousCount} ${s('功德日', '功德日', 'auspicious')}`);
    if (fastCount > 0) parts.push(`${fastCount} ${s('十斋日', '十齋日', 'fast')}`);
    parts.push(...ceremonyList);
    return { auspiciousCount, fastCount, tibMonths, ceremonies: ceremonyList, summary: parts.join(' · ') };
  }, [data.data, s]);

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
    setSelected(null);
  }

  return (
    <>
      <TopNav
        titles={['藏历', '藏曆', 'Calendar']}
        right={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button type="button" onClick={() => setLegendOpen(true)} aria-label={s('图例', '圖例', 'Legend')} style={{ font: 'var(--text-body)', color: 'var(--ink-3)', background: 'transparent', border: 'none', padding: '4px 8px', cursor: 'pointer' }}>ⓘ</button>
            <button type="button" onClick={jumpToToday} style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', background: 'transparent', border: 'none', padding: '4px 10px', cursor: 'pointer' }}>
              {s('今日', '今日', 'Today')}
            </button>
          </div>
        )}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>

      {/* 月份导航 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => shiftMonth(-1)} className="btn btn-pill" style={{ padding: '6px 12px' }} aria-label={s('上一月', '上一月', 'Previous month')}>‹</button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={s('选择年月', '選擇年月', 'Pick year and month')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.3rem', letterSpacing: 2, color: 'var(--ink)' }}
        >
          📿 {year} · {String(month).padStart(2, '0')}
          <span style={{ fontSize: '0.7rem', color: 'var(--ink-3)' }}>▾</span>
        </button>
        <button type="button" onClick={() => shiftMonth(1)} className="btn btn-pill" style={{ padding: '6px 12px' }} aria-label={s('下一月', '下一月', 'Next month')}>›</button>
      </div>

      {/* 数据空态：seed 未灌库 / API 失败 / 当月未编辑 */}
      {!data.isLoading && (data.isError || (data.data?.length ?? 0) === 0) && (
        <div className="glass-card" style={{ padding: 'var(--sp-4)', textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📿</div>
          <p style={{ font: 'var(--text-body)', margin: 0 }}>
            {data.isError
              ? s('藏历数据未就绪', '藏曆數據未就緒', 'Calendar data not ready')
              : s('当月暂无藏历数据', '當月暫無藏曆數據', 'No calendar data this month')}
          </p>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
            {s('请联系管理员录入', '請聯繫管理員錄入', 'Contact admin to populate')}
          </p>
        </div>
      )}

      {/* 本月概览 · 一行素灰字 · 藏历月名 · 功德日 / 十斋日 / 主法会 */}
      {!data.isLoading && (data.data?.length ?? 0) > 0 && overview.summary && (
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.5 }}>
          {overview.summary}
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
            const isCeremony = !!day?.events.some((e) => e.includes('法会'));
            const hasOtherEvent = (day?.events?.length ?? 0) > 0;
            // 圆点 · 颜色编码 · 功德金 + 法会绛红可并存（最多 2 点）·
            // 既非功德也非法会但有其它事件 → 灰点。一格永远 ≤2 点
            const dots: string[] = [];
            if (day?.auspicious) dots.push('var(--gold-dark)');
            if (isCeremony) dots.push('var(--crimson)');
            if (dots.length === 0 && hasOtherEvent) dots.push('var(--ink-4)');
            const bg = isToday ? 'var(--saffron-pale)' : 'var(--surface)';
            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => setSelected(isSelected ? null : cell.ymd)}
                aria-label={`${cell.ymd}${day?.auspicious ? ` ${s('功德日', '功德日', 'auspicious')}` : ''}${isCeremony ? ` ${s('法会', '法會', 'ceremony')}` : ''}`}
                style={{
                  aspectRatio: '1',
                  border: isSelected ? '2px solid var(--saffron-dark)' : '1px solid var(--border-light)',
                  borderRadius: 6,
                  background: bg,
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
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', fontSize: '0.62rem', lineHeight: 1, marginTop: 1, opacity: 0.85 }}>
                  {day?.tibetan ?? ''}
                </div>
                {dots.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                    {dots.map((c, di) => (
                      <div key={di} style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>

      {/* 选中日详情 · 底部 sheet（桌面 centered）*/}
      <Dialog
        open={!!selectedDay}
        onClose={() => setSelected(null)}
        variant={isWide ? 'centered' : 'sheet'}
        title={selectedDay?.date}
      >
        {selectedDay && <DayDetailBody day={selectedDay} isCoach={isCoach} />}
      </Dialog>

      {/* 年月选择器 */}
      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        variant={isWide ? 'centered' : 'sheet'}
        title={s('选择年月', '選擇年月', 'Pick month')}
      >
        <YearMonthPicker
          year={year}
          month={month}
          onPick={(y, m) => { setYear(y); setMonth(m); setSelected(null); setPickerOpen(false); }}
        />
      </Dialog>

      {/* 图例 */}
      <Dialog
        open={legendOpen}
        onClose={() => setLegendOpen(false)}
        variant={isWide ? 'centered' : 'sheet'}
        title={s('图例', '圖例', 'Legend')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 'var(--sp-2)' }}>
          <LegendRow color="var(--gold-dark)" text={s('功德日 · 修法功德增上', '功德日 · 修法功德增上', 'Auspicious · merit day')} />
          <LegendRow color="var(--crimson)" text={s('法会期', '法會期', 'Ceremony')} />
          <LegendRow color="var(--ink-4)" text={s('其它事件 · 圣诞 / 加持日等', '其它事件 · 聖誕 / 加持日等', 'Other events')} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, font: 'var(--text-body)', color: 'var(--ink-2)' }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--saffron-pale)', border: '1px solid var(--saffron-light)', flex: 'none' }} />
            {s('今日', '今日', 'Today')}
          </div>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 4 }}>
            {s('十斋日等标记在点开当日详情中查看', '十齋日等標記在點開當日詳情中查看', 'Fast days etc. shown in day detail')}
          </div>
        </div>
      </Dialog>
    </>
  );
}

function DayDetailBody({ day, isCoach }: { day: TibetanDay; isCoach: boolean }) {
  const { s } = useLang();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', paddingTop: 'var(--sp-2)' }}>
      {(day.auspicious || day.publicHoliday) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {day.auspicious && (
            <span className="chip" style={{ background: 'var(--gold-pale)', color: 'var(--gold-dark)' }}>
              🌺 {s('修法功德日', '修法功德日', 'Auspicious')}
            </span>
          )}
          {day.publicHoliday && (
            <span className="chip" style={{ background: 'var(--crimson-pale)', color: 'var(--crimson)' }}>
              {day.publicHoliday}
            </span>
          )}
        </div>
      )}

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

function LegendRow({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, font: 'var(--text-body)', color: 'var(--ink-2)' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flex: 'none', marginLeft: 4 }} />
      {text}
    </div>
  );
}

function YearMonthPicker({ year, month, onPick }: { year: number; month: number; onPick: (y: number, m: number) => void }) {
  const { s } = useLang();
  const [y, setY] = useState(year);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', paddingTop: 'var(--sp-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => setY((v) => v - 1)} className="btn btn-pill" style={{ padding: '6px 16px' }} aria-label={s('上一年', '上一年', 'Previous year')}>‹</button>
        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', letterSpacing: 2 }}>{y}</span>
        <button type="button" onClick={() => setY((v) => v + 1)} className="btn btn-pill" style={{ padding: '6px 16px' }} aria-label={s('下一年', '下一年', 'Next year')}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const isCur = y === year && m === month;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPick(y, m)}
              className="btn btn-pill"
              style={{
                padding: '10px 0',
                background: isCur ? 'var(--saffron-dark)' : 'var(--surface)',
                color: isCur ? '#fff' : 'var(--ink)',
                border: isCur ? '1px solid var(--saffron-dark)' : '1px solid var(--border-light)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {m}{s('月', '月', '')}
            </button>
          );
        })}
      </div>
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
