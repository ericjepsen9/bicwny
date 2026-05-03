// CoachDashboardPage · /coach
//   总览：4 个 KPI + 班级 grid（每卡含 stats）+ 待办 feed（pending questions）
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { api } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import {
  type CoachClassRow,
  type CoachClassStats,
  useCoachClasses,
  useCoachQuestions,
} from '@/lib/queries';

export default function CoachDashboardPage() {
  const { s } = useLang();
  const classes = useCoachClasses();
  const questions = useCoachQuestions(200);

  // 并发拉每个班的 stats（windowDays=7）· useQueries · 一次 batch
  const statsQueries = useQueries({
    queries: (classes.data ?? []).map((c) => ({
      queryKey: ['/api/coach/classes', c.id, 'stats', 7],
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        api.get<CoachClassStats>(`/api/coach/classes/${encodeURIComponent(c.id)}/stats?windowDays=7`, { signal }),
      enabled: !!c.id,
    })),
  });

  const totals = useMemo(() => {
    const list = statsQueries.map((q) => q.data).filter(Boolean) as CoachClassStats[];
    const memberCount = list.reduce((a, b) => a + (b.memberCount ?? 0), 0);
    const totalAnswers = list.reduce((a, b) => a + (b.totalAnswers ?? 0), 0);
    const correctRateAvg = list.length
      ? list.reduce((a, b) => a + (b.correctRate ?? 0), 0) / list.length
      : 0;
    return { memberCount, totalAnswers, correctRate: correctRateAvg };
  }, [statsQueries]);

  const pendingTodos = useMemo(
    () => (questions.data ?? [])
      .filter((q) => q.reviewStatus === 'pending')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 8),
    [questions.data],
  );

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('总览', '總覽', 'Overview')}</h1>
          <p className="page-sub">{s('班级与教学数据', '班級與教學數據', 'Classes & teaching')}</p>
        </div>
      </div>

      {/* KPI 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
        <Kpi loading={classes.isLoading} value={String(classes.data?.length ?? 0)} label={s('我的班级', '我的班級', 'Classes')} />
        <Kpi loading={statsQueries.some((q) => q.isLoading)} value={String(totals.memberCount)} label={s('学生总数', '學生總數', 'Students')} color="var(--sage-dark)" />
        <Kpi loading={statsQueries.some((q) => q.isLoading)} value={String(totals.totalAnswers)} label={s('本周答题', '本週答題', 'Answers/wk')} color="var(--saffron)" />
        <Kpi loading={statsQueries.some((q) => q.isLoading)} value={Math.round(totals.correctRate * 100) + '%'} label={s('正确率', '正確率', 'Accuracy')} color="var(--gold-dark)" />
      </div>

      {/* 班级 grid */}
      <div style={{ marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2 }}>
          {s('我的班级', '我的班級', 'My classes')}
        </h2>
      </div>

      {classes.isLoading ? (
        <Skeleton.Card />
      ) : !classes.data || classes.data.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)', marginBottom: 'var(--sp-6)' }}>
          {s('还没有带班', '還沒有帶班', 'No assigned classes')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
          {classes.data.map((c, i) => (
            <ClassCard key={c.id} cls={c} stats={statsQueries[i]?.data} loading={statsQueries[i]?.isLoading} />
          ))}
        </div>
      )}

      {/* 待办 feed */}
      <div style={{ marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2 }}>
          {s('待审题目', '待審題目', 'Pending review')}
        </h2>
        <Link to="/coach/questions" style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', letterSpacing: 1 }}>
          {s('管理题库 →', '管理題庫 →', 'Manage →')}
        </Link>
      </div>

      <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
        {questions.isLoading ? (
          <div style={{ padding: 'var(--sp-4)' }}><Skeleton.Card /></div>
        ) : pendingTodos.length === 0 ? (
          <div style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)' }}>
            {s('全部已审 · 暂无待办', '全部已審 · 暫無待辦', 'Inbox zero')}
          </div>
        ) : (
          pendingTodos.map((q, i) => (
            <Link
              key={q.id}
              to={`/coach/questions?id=${encodeURIComponent(q.id)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-3) var(--sp-4)',
                textDecoration: 'none',
                color: 'inherit',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-light)',
              }}
            >
              <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--gold-pale)', color: 'var(--gold-dark)', font: 'var(--text-caption)', fontWeight: 700 }}>
                {s('待审', '待審', 'Pending')}
              </span>
              <span style={{ flex: 1, minWidth: 0, font: 'var(--text-body)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '.5px' }}>
                {q.questionText}
              </span>
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                {relTime(q.createdAt)}
              </span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

function Kpi({ value, label, color, loading }: { value: string; label: string; color?: string; loading?: boolean }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      {loading ? (
        <Skeleton.Title style={{ width: 60 }} />
      ) : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.625rem', color: color ?? 'var(--ink)', letterSpacing: 1 }}>
          {value}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls, stats, loading }: { cls: CoachClassRow; stats?: CoachClassStats; loading?: boolean }) {
  const pct = stats && stats.memberCount > 0 ? Math.round((stats.activeInWindow / stats.memberCount) * 100) : 0;
  return (
    <Link
      to={`/coach/students?classId=${encodeURIComponent(cls.id)}`}
      className="glass-card-thick"
      style={{ padding: 'var(--sp-4)', textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
        <span style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--saffron-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
          {cls.coverEmoji || '📚'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cls.name}
          </div>
          {cls.course && (
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '.5px' }}>
              {cls.course.coverEmoji} {cls.course.title}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton.LineSm />
      ) : stats ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 4 }}>
            <span>{stats.memberCount} {stats.memberCount === 1 ? 'member' : 'members'}</span>
            <span style={{ color: 'var(--sage-dark)', fontWeight: 700 }}>
              {Math.round(stats.correctRate * 100)}%
            </span>
          </div>
          <div className="progress-track" style={{ marginBottom: 6 }}>
            <div className="progress-fill" style={{ width: pct + '%' }} />
          </div>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
            {stats.activeInWindow} / {stats.memberCount} 本周活跃 · {stats.totalAnswers} 题
          </div>
        </>
      ) : (
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>—</div>
      )}
    </Link>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + '分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + '小时前';
  const d = Math.floor(h / 24);
  if (d < 30) return d + '天前';
  return new Date(iso).toLocaleDateString();
}
