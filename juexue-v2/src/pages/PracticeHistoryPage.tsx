// 修学计数 · 历史页 /practice/history
//   - 30 天折线图（每日总数 SVG · 无依赖）
//   - 子项累计排行
//   - period 切换：本周 / 本月 / 全部（仅排行 · 折线固定 30 天）
import { useMemo, useState } from 'react';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';
import {
  type PracticeHistory,
  usePracticeCategories,
  usePracticeHistory,
} from '@/lib/queries';

type Period = 'week' | 'month' | 'all';

export default function PracticeHistoryPage() {
  const { s } = useLang();
  const history = usePracticeHistory();
  const cats = usePracticeCategories();
  const [period, setPeriod] = useState<Period>('month');

  const dailySeries = history.data?.dailySeries ?? [];
  const projects = history.data?.projectsSummary ?? [];

  // 周期总数（period 不影响 dailySeries · 只过滤 dailySeries 子集 + 排行计算口径）
  const filteredDays = useMemo(() => {
    if (period === 'all') return dailySeries;
    if (period === 'week') return dailySeries.slice(-7);
    return dailySeries.slice(-30);
  }, [dailySeries, period]);

  const periodTotal = filteredDays.reduce((acc, d) => acc + d.count, 0);
  const activeDays = filteredDays.filter((d) => d.count > 0).length;
  const avgPerDay = activeDays > 0 ? Math.round(periodTotal / activeDays) : 0;

  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c]));

  return (
    <>
      <TopNav titles={['修学历史', '修學歷史', 'History']} backTo="/practice" />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

        {/* 周期切换 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className="btn btn-pill"
              style={{
                padding: '6px 14px',
                font: 'var(--text-caption)',
                background: period === p ? 'var(--saffron-pale)' : 'transparent',
                border: '1px solid ' + (period === p ? 'var(--saffron-light)' : 'var(--border)'),
                color: period === p ? 'var(--saffron-dark)' : 'var(--ink-3)',
                fontWeight: 600,
              }}
            >
              {p === 'week' ? s('本周', '本週', 'Week') : p === 'month' ? s('近 30 天', '近 30 天', '30d') : s('全部', '全部', 'All')}
            </button>
          ))}
        </div>

        {/* KPI · admin dashboard 风 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
          <Kpi value={fmt(periodTotal)} label={s('期间累计', '期間累計', 'Total')} color="var(--sage-dark)" />
          <Kpi value={String(activeDays)} label={s('修学天数', '修學天數', 'Active days')} color="var(--saffron-dark)" />
          <Kpi value={String(avgPerDay)} label={s('日均', '日均', 'Avg/day')} />
        </div>

        {/* 折线图 · 30 天每日 */}
        <SectionTitle>{s('每日趋势（近 30 天）', '每日趨勢（近 30 天）', 'Daily trend (30d)')}</SectionTitle>
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          {history.isLoading ? <Skeleton.Card /> : (
            <DailyChart series={dailySeries} />
          )}
        </div>

        {/* 子项排行 */}
        <SectionTitle>{s('子项累计', '子項累計', 'By project')}</SectionTitle>
        {history.isLoading ? <Skeleton.List /> : projects.length === 0 ? (
          <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-5) 0' }}>
            {s('暂无数据 · 去主页修一座再来看', '暫無資料', 'No data yet')}
          </p>
        ) : (
          <ProjectRanking projects={projects} catMap={catMap} />
        )}
      </div>
    </>
  );
}

// ── 折线图（纯 SVG · 无依赖） ─────────────────
function DailyChart({ series }: { series: PracticeHistory['dailySeries'] }) {
  const { s } = useLang();
  if (series.length === 0) {
    return <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-3) 0' }}>{s('暂无数据', '暫無數據', 'No data')}</p>;
  }
  const W = 600;
  const H = 160;
  const padX = 30;
  const padY = 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const maxV = Math.max(1, ...series.map((d) => d.count));
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;

  const points = series.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + innerH - (d.count / maxV) * innerH;
    return { x, y, v: d.count, date: d.date };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const fillD = `${pathD} L ${padX + innerW} ${padY + innerH} L ${padX} ${padY + innerH} Z`;

  // y 轴 3 档刻度
  const yTicks = [0, Math.round(maxV / 2), maxV];

  // x 轴显示首/中/末 3 个日期
  const xTicks = series.length === 1
    ? [{ idx: 0, label: shortDate(series[0]!.date) }]
    : [
      { idx: 0, label: shortDate(series[0]!.date) },
      { idx: Math.floor(series.length / 2), label: shortDate(series[Math.floor(series.length / 2)]!.date) },
      { idx: series.length - 1, label: shortDate(series[series.length - 1]!.date) },
    ];

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H + 30}`} width="100%" style={{ display: 'block' }} aria-label={s('每日趋势', '每日趨勢', 'Daily trend')}>
        {/* y 轴网格 */}
        {yTicks.map((t, i) => {
          const y = padY + innerH - (t / maxV) * innerH;
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={padX + innerW} y2={y} stroke="var(--border-light)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : '2 3'} />
              <text x={padX - 6} y={y + 3} textAnchor="end" fill="var(--ink-4)" style={{ font: 'var(--text-caption)' }}>{t}</text>
            </g>
          );
        })}
        {/* 填充区 */}
        <path d={fillD} fill="var(--saffron-pale)" />
        {/* 折线 */}
        <path d={pathD} fill="none" stroke="var(--saffron-dark)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* 数据点 */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.v > 0 ? 3 : 1.5} fill={p.v > 0 ? 'var(--saffron-dark)' : 'var(--ink-4)'} />
            <title>{p.date}: {p.v}</title>
          </g>
        ))}
        {/* x 轴日期 */}
        {xTicks.map((t, i) => (
          <text key={i} x={padX + t.idx * stepX} y={H + 14} textAnchor="middle" fill="var(--ink-4)" style={{ font: 'var(--text-caption)' }}>
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function shortDate(d: string): string {
  // YYYY-MM-DD → MM-DD
  return d.slice(5);
}

// ── 子项排行 · 横条 + 数字 ─────────────────
function ProjectRanking({
  projects,
  catMap,
}: {
  projects: PracticeHistory['projectsSummary'];
  catMap: Map<string, { id: string; key: string; name: string; emoji: string }>;
}) {
  const max = Math.max(1, ...projects.map((p) => p.totalCount));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {projects.map((p) => {
        const cat = catMap.get(p.categoryId);
        const pct = (p.totalCount / max) * 100;
        return (
          <div key={p.projectId} className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '1.1rem' }}>{p.projectEmoji ?? cat?.emoji ?? '📿'}</span>
              <span style={{ flex: 1, fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.projectName}
              </span>
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                {cat?.name ?? ''}
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--saffron-dark)' }}>
                {p.totalCount}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--glass)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--saffron) 0%, var(--saffron-dark) 100%)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 共用 ─────────────────
function Kpi({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', minHeight: 110, display: 'flex', flexDirection: 'column' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.6rem', color: color ?? 'var(--ink)', letterSpacing: 1, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2, margin: 0 }}>
      {children}
    </h2>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
