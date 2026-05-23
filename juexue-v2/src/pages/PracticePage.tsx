// 修学计数 · 主页 /practice
//   参照 admin dashboard 风格：
//   - KPI 4 卡（2x2 网格）：今日 / streak / 本周 / 累计
//   - 任务 + 目标横幅（如有）
//   - 5 大类 quick-action grid（2 列 · 自适应）
//   - 移动端友好
import { Link } from 'react-router-dom';
import MakeupCard from '@/components/MakeupCard';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';
import {
  usePracticeCategories,
  usePracticeGoals,
  usePracticeSummary,
  usePracticeTasks,
} from '@/lib/queries';

export default function PracticePage() {
  const { s } = useLang();
  const summary = usePracticeSummary();
  const cats = usePracticeCategories();
  const tasks = usePracticeTasks();
  const goals = usePracticeGoals();

  const todayTotal = summary.data?.categories.reduce((acc, c) => acc + c.todayCount, 0) ?? 0;
  const allTotal = summary.data?.categories.reduce((acc, c) => acc + c.totalCount, 0) ?? 0;
  const streak = summary.data?.streak ?? 0;
  const activeTasks = (tasks.data ?? []).filter((t) => !t.isDone).length;
  const goalsWithTarget = (goals.data ?? []).filter((g) => g.dailyTarget > 0);

  return (
    <>
      <TopNav
        titles={['修学计数', '修學計數', 'Practice']}
        backTo="/"
        right={(
          <Link to="/practice/history" style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', textDecoration: 'none', padding: '4px 10px' }}>
            📊 {s('历史', '歷史', 'History')}
          </Link>
        )}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

        {/* KPI 4 · 2x2 网格 · 参 admin dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}>
          <Kpi loading={summary.isLoading} value={String(todayTotal)} label={s('今日', '今日', 'Today')} color="var(--saffron-dark)" />
          <Kpi loading={summary.isLoading} value={streak > 0 ? `🔥${streak}` : '—'} label={s('连续天数', '連續天數', 'Streak')} color="var(--gold-dark)" />
          <Kpi loading={summary.isLoading} value={fmt(allTotal)} label={s('累计', '累計', 'Total')} color="var(--sage-dark)" />
          <Kpi loading={tasks.isLoading} value={String(activeTasks)} label={s('进行中任务', '進行中任務', 'Active tasks')} sub={activeTasks > 0 ? s('点下方查看', '點下方查看', 'see below') : undefined} />
        </div>

        {/* 补签 · 修学打卡 streak 自助补救（仅近 7 天 · 每周 1 次） */}
        <MakeupCard />

        {/* 任务横幅 · 参 admin Action 高亮风格 */}
        {(tasks.data ?? []).length > 0 && (
          <>
            <SectionTitle>{s('任务', '任務', 'Tasks')}</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {(tasks.data ?? []).map((t) => {
                const pct = Math.min(100, Math.round((t.progress / t.target) * 100));
                return (
                  <Link key={t.id} to={`/practice/project/${t.project.id}`} className="glass-card-thick" style={{
                    padding: 'var(--sp-3) var(--sp-4)',
                    textDecoration: 'none', color: 'inherit',
                    border: t.isDone ? '1px solid var(--sage-dark)' : '1px solid var(--glass-border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ font: 'var(--text-caption)', fontWeight: 700, padding: '1px 8px', borderRadius: 'var(--r-pill)', background: t.scope === 'class' ? 'var(--saffron-pale)' : 'var(--gold-pale)', color: t.scope === 'class' ? 'var(--saffron-dark)' : 'var(--gold-dark)', letterSpacing: 1 }}>
                          {t.scope === 'class' ? `📌 ${t.class?.name ?? '班级'}` : '⭐ 我的'}
                        </span>
                        {t.isDone && <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{pct}%</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1.2, marginBottom: 6 }}>
                      {t.title || `${t.project.emoji ?? ''} ${t.project.name}`}
                    </div>
                    <ProgressBar progress={t.progress} target={t.target} done={t.isDone} />
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* 个人目标 */}
        {goalsWithTarget.length > 0 && (
          <>
            <SectionTitle>{s('每日目标', '每日目標', 'Daily goals')}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-2)' }}>
              {goalsWithTarget.map((g) => (
                <Link key={g.id} to={`/practice/project/${g.projectId}`} className="glass-card-thick" style={{ padding: 'var(--sp-3)', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                    <span>{g.project.emoji ?? '📿'}</span>
                    <span style={{ flex: 1, fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.project.name}
                    </span>
                  </div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{g.dailyTarget}/{s('天', '天', 'd')}</div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* 5 大类 · 2 列 quick-action grid · 参 admin Action 卡 */}
        <SectionTitle>{s('修学项目', '修學項目', 'Categories')}</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}>
          {cats.isLoading ? <Skeleton.List /> : (cats.data ?? []).map((c) => {
            const sumCat = summary.data?.categories.find((x) => x.id === c.id);
            return (
              <ActionCard
                key={c.id}
                to={`/practice/${c.key}`}
                icon={c.emoji}
                label={c.name}
                sub={sumCat ? `${s('累计', '累計', 'Total')} ${sumCat.totalCount} · ${s('今日', '今日', 'Today')} ${sumCat.todayCount}` : undefined}
                highlight={(sumCat?.todayCount ?? 0) > 0}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── 共用：与 admin dashboard 同款 ─────────────────
function Kpi({ value, label, color, sub, loading }: { value: string; label: string; color?: string; sub?: string; loading?: boolean }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', minHeight: 110, display: 'flex', flexDirection: 'column' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      {loading ? <Skeleton.Title style={{ width: 60 }} /> : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.6rem', color: color ?? 'var(--ink)', letterSpacing: 1, lineHeight: 1.1 }}>{value}</div>
      )}
      {sub && <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 'auto', letterSpacing: 1 }}>{sub}</div>}
    </div>
  );
}

function ActionCard({ to, icon, label, sub, highlight }: { to: string; icon: string; label: string; sub?: string; highlight?: boolean }) {
  return (
    <Link to={to} className="glass-card-thick" style={{
      padding: 'var(--sp-4)',
      textDecoration: 'none', color: 'inherit',
      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      minHeight: 78,
      border: highlight ? '1px solid var(--saffron)' : '1px solid var(--glass-border)',
      background: highlight ? 'var(--saffron-pale)' : 'var(--glass-thick)',
    }}>
      <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 1.5, fontSize: '0.95rem' }}>{label}</div>
        {sub && <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2, margin: 0 }}>
      {children}
    </h2>
  );
}

function ProgressBar({ progress, target, done }: { progress: number; target: number; done: boolean }) {
  const pct = Math.min(100, Math.round((progress / target) * 100));
  return (
    <div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--glass)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: done ? 'var(--sage-dark)' : 'linear-gradient(90deg, var(--saffron) 0%, var(--saffron-dark) 100%)', transition: 'width .3s var(--ease)' }} />
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>{progress} / {target}</div>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
