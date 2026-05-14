// admin 藏历年视图 · /admin/calendar/year/:year
//   - 12 月缩略 · 4 列 × 3 行
//   - 每月格：藏历月名 / 天数 / 功德日数 / 法会列表 / ⚠️ 异常天数
//   - 异常 = 缺 tibetanMonth / lunar / tibetan 任一字段
//   - 点月份 → 跳 /admin/calendar 该月
//   - 顶部「‹ YYYY ›」切年 + 「📥 导出全年 JSON」
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

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

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function AdminCalendarYearPage() {
  const { year: yearParam } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const year = Number(yearParam) || new Date().getFullYear();

  const queries = useQueries({
    queries: MONTHS.map((m) => ({
      queryKey: ['/api/calendar/month', `${year}-${String(m).padStart(2, '0')}`],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.get<TibetanDay[]>(`/api/calendar/month/${year}-${String(m).padStart(2, '0')}`, { signal }),
      staleTime: 60 * 60 * 1000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const allDays = useMemo(() => queries.map((q) => q.data ?? []), [queries]);

  // 全年汇总
  const yearStats = useMemo(() => {
    const flat = allDays.flat();
    const auspicious = flat.filter((d) => d.auspicious).length;
    const ceremonies = new Set<string>();
    flat.forEach((d) => d.events.forEach((e) => {
      if (e.includes('法会') && !e.includes('结束') && !e.includes('开始')) ceremonies.add(e);
      else if (e.includes('法会开始')) ceremonies.add(e.replace('开始', '').trim());
    }));
    const anomalies = flat.filter((d) => !d.tibetanMonth || !d.lunar || !d.tibetan).length;
    return { total: flat.length, auspicious, ceremonies: Array.from(ceremonies), anomalies };
  }, [allDays]);

  function exportYear() {
    const flat = allDays.flat();
    if (flat.length === 0) { toast.error('全年无数据'); return; }
    const blob = new Blob([JSON.stringify(flat, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tibetan-${year}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  return (
    <div>
      <TopNav titles={['年视图', '年視圖', 'Year view']} backTo="/admin/calendar" />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate(`/admin/calendar/year/${year - 1}`)} className="btn btn-pill" style={{ padding: '6px 12px' }}>‹</button>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.2rem', letterSpacing: 3, margin: 0 }}>
          {year}
        </h2>
        <button type="button" onClick={() => navigate(`/admin/calendar/year/${year + 1}`)} className="btn btn-pill" style={{ padding: '6px 12px' }}>›</button>
      </div>

      {/* 全年汇总 */}
      <div className="glass-card" style={{ padding: 'var(--sp-3)', display: 'flex', flexWrap: 'wrap', gap: 8, font: 'var(--text-caption)' }}>
        <span className="chip" style={{ background: 'var(--saffron-pale)', color: 'var(--saffron-dark)' }}>📅 {yearStats.total} / 365 天</span>
        <span className="chip" style={{ background: 'var(--gold-pale)', color: 'var(--gold-dark)' }}>🌺 {yearStats.auspicious} 功德日</span>
        <span className="chip" style={{ background: 'var(--crimson-pale)', color: 'var(--crimson)' }}>📜 {yearStats.ceremonies.length} 场法会</span>
        {yearStats.anomalies > 0 && (
          <span className="chip" style={{ background: 'var(--crimson)', color: '#fff', fontWeight: 700 }}>⚠️ {yearStats.anomalies} 天数据缺失</span>
        )}
        <button
          type="button"
          onClick={exportYear}
          disabled={yearStats.total === 0}
          className="btn btn-pill"
          style={{ marginLeft: 'auto', padding: '4px 12px', font: 'var(--text-caption)', background: 'var(--surface)', border: '1px solid var(--border-light)' }}
        >
          📥 导出 {year} 年 JSON
        </button>
      </div>

      {isLoading && <Skeleton.List />}

      {/* 12 月格子 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--sp-3)' }}>
        {MONTHS.map((m, i) => {
          const days = allDays[i] ?? [];
          const ym = `${year}-${String(m).padStart(2, '0')}`;
          const tibMonths = Array.from(new Set(days.map((d) => d.tibetanMonth))).filter(Boolean);
          const auspicious = days.filter((d) => d.auspicious).length;
          const fast = days.filter((d) => d.tags?.includes('十斋日')).length;
          const ceremonies = new Set<string>();
          days.forEach((d) => d.events.forEach((e) => {
            if (e.includes('法会开始')) ceremonies.add(e.replace('开始', '').trim());
          }));
          const anomalies = days.filter((d) => !d.tibetanMonth || !d.lunar || !d.tibetan).length;
          const inMonth = daysInMonth(year, m);
          const isComplete = days.length === inMonth;

          return (
            <Link
              key={m}
              to={`/admin/calendar?ym=${ym}`}
              className="glass-card-thick"
              style={{
                padding: 'var(--sp-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                textDecoration: 'none',
                color: 'var(--ink)',
                border: anomalies > 0 ? '1px solid var(--crimson)' : days.length === 0 ? '1px dashed var(--ink-4)' : '1px solid var(--border-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.2rem' }}>{m} 月</span>
                <span style={{ font: 'var(--text-caption)', color: isComplete ? 'var(--sage-dark)' : days.length === 0 ? 'var(--crimson)' : 'var(--ink-4)' }}>
                  {days.length} / {inMonth}
                </span>
              </div>
              {tibMonths.length > 0 && (
                <div style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)' }}>
                  📿 {tibMonths.join(' · ')}
                </div>
              )}
              {(auspicious > 0 || fast > 0) && (
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', display: 'flex', gap: 8 }}>
                  {auspicious > 0 && <span>🌺 {auspicious}</span>}
                  {fast > 0 && <span>十斋 {fast}</span>}
                </div>
              )}
              {ceremonies.size > 0 && (
                <ul style={{ margin: 0, paddingLeft: 'var(--sp-3)', font: 'var(--text-caption)', color: 'var(--crimson)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Array.from(ceremonies).map((c) => <li key={c}>📜 {c}</li>)}
                </ul>
              )}
              {anomalies > 0 && (
                <div style={{ font: 'var(--text-caption)', color: 'var(--crimson)', fontWeight: 700 }}>
                  ⚠️ {anomalies} 天数据缺失
                </div>
              )}
              {days.length === 0 && (
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', fontStyle: 'italic' }}>
                  无数据 · 点击新建
                </div>
              )}
            </Link>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
