// 修学计数 · 主页 /practice
//   - hero · 今日各大类 + streak
//   - 个人目标卡片（dailyTarget>0 的）
//   - 班级任务卡片
//   - 5 大类列表 · 点进入大类页
import { Link } from 'react-router-dom';
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

  return (
    <>
      <TopNav
        titles={['修学计数', '修學計數', 'Practice']}
        backTo="/"
        right={(
          <Link to="/practice/history" style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', textDecoration: 'none' }}>
            📊 {s('历史', '歷史', 'History')}
          </Link>
        )}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {/* hero · streak + 今日各大类 */}
      {summary.isLoading ? <Skeleton.Card /> : summary.data && (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          {summary.data.streak > 0 && (
            <div style={{ font: 'var(--text-caption)', color: 'var(--gold-dark)', letterSpacing: 1.5, marginBottom: 6 }}>
              🔥 {s(`已连续 ${summary.data.streak} 天`, `已連續 ${summary.data.streak} 天`, `${summary.data.streak} day streak`)}
            </div>
          )}
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 'var(--sp-3)' }}>
            {s('今日', '今日', 'Today')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--sp-2)' }}>
            {summary.data.categories.map((c) => (
              <div key={c.id} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem' }}>{c.emoji}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.05rem', color: c.todayCount > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
                  {c.todayCount}
                </div>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 任务卡（班级 + 个人） */}
      {tasks.data && tasks.data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {tasks.data.map((t) => (
            <div key={t.id} className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ font: 'var(--text-caption)', color: t.scope === 'class' ? 'var(--saffron-dark)' : 'var(--gold-dark)', fontWeight: 700, letterSpacing: 1, padding: '1px 8px', borderRadius: 'var(--r-pill)', background: t.scope === 'class' ? 'var(--saffron-pale)' : 'var(--gold-pale)' }}>
                  {t.scope === 'class' ? `📌 ${t.class?.name ?? '班级'}` : '⭐ 我的'}
                </span>
                {t.isDone && <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>✓ 已完成</span>}
              </div>
              <div style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', letterSpacing: 1.2, marginBottom: 6 }}>
                {t.title || `${t.project.emoji ?? ''} ${t.project.name}` + (t.mode === 'daily' ? ` · 每日 ${t.target}` : ` · 累计 ${t.target}`)}
              </div>
              <ProgressBar progress={t.progress} target={t.target} done={t.isDone} />
            </div>
          ))}
        </div>
      )}

      {/* 目标卡（dailyTarget>0） */}
      {goals.data && goals.data.filter((g) => g.dailyTarget > 0).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
            {s('每日目标', '每日目標', 'Daily goals')}
          </div>
          {goals.data.filter((g) => g.dailyTarget > 0).map((g) => (
            <Link key={g.id} to={`/practice/project/${g.projectId}`} style={{ textDecoration: 'none' }}>
              <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--text-body)', color: 'var(--ink)', marginBottom: 4 }}>
                  <span>{g.project.emoji ?? ''} {g.project.name}</span>
                  <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{g.dailyTarget}/天</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 大类列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {cats.isLoading ? <Skeleton.List /> : (cats.data ?? []).map((c) => {
          const sumCat = summary.data?.categories.find((x) => x.id === c.id);
          return (
            <Link key={c.id} to={`/practice/${c.key}`} style={{ textDecoration: 'none' }}>
              <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <span style={{ fontSize: '1.8rem' }}>{c.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1.5 }}>
                    {c.name}
                  </div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 2 }}>
                    {s(`累计 ${sumCat?.totalCount ?? 0} · 今日 ${sumCat?.todayCount ?? 0}`, `累計 ${sumCat?.totalCount ?? 0} · 今日 ${sumCat?.todayCount ?? 0}`, `Total ${sumCat?.totalCount ?? 0} · Today ${sumCat?.todayCount ?? 0}`)}
                  </div>
                </div>
                <span style={{ color: 'var(--ink-3)', fontSize: '1.2rem' }}>›</span>
              </div>
            </Link>
          );
        })}
      </div>
      </div>
    </>
  );
}

function ProgressBar({ progress, target, done }: { progress: number; target: number; done: boolean }) {
  const pct = Math.min(100, Math.round((progress / target) * 100));
  return (
    <div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--glass)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: done ? 'var(--sage-dark)' : 'linear-gradient(90deg, var(--saffron) 0%, var(--saffron-dark) 100%)', transition: 'width .3s var(--ease)' }} />
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
        {progress} / {target} · {pct}%
      </div>
    </div>
  );
}
