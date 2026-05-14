// 班级 dashboard · 教师/admin · /coach/classes/:id/dashboard · /admin/classes/:id/dashboard
//   班级所有学员核心进度对比表
//   - 行可点击 → 跳该学员完整学修档案
//   - 顶部「📥 导出 CSV」按钮 · 下载该班所有学员完整数据
//   - 表头排序（修学累计 / streak / 答题正确率 / 任务完成度）
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api } from '@/lib/api';
import { getAccess } from '@/lib/tokenStore';
import { useLang } from '@/lib/i18n';

interface Row {
  userId: string;
  dharmaName: string | null;
  email: string | null;
  joinedAt: string;
  practiceTotal: number;
  practiceStreak: number;
  meditationCompleted: number;
  readingCompleted: number;
  totalAnswers: number;
  correctRate: number;
  classTaskAvgProgress: number;
  classTaskDoneCount: number;
}

type SortKey = 'name' | 'practice' | 'streak' | 'meditation' | 'reading' | 'answers' | 'rate' | 'task';

export default function CoachClassDashboardPage() {
  const { s } = useLang();
  const { id: classId } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const back = isAdmin ? '/admin/classes' : '/coach/classes';
  const [sortKey, setSortKey] = useState<SortKey>('practice');
  const [sortDesc, setSortDesc] = useState(true);

  const data = useQuery({
    enabled: !!classId,
    queryKey: ['/api/coach/classes', classId, 'dashboard'],
    queryFn: ({ signal }) => api.get<{ taskCount: number; rows: Row[] }>(
      `/api/coach/classes/${encodeURIComponent(classId!)}/dashboard`,
      { signal },
    ),
  });

  const sorted = useMemo(() => {
    const rows = data.data?.rows ?? [];
    const cmp = (a: Row, b: Row) => {
      const v = (() => {
        switch (sortKey) {
          case 'name': return (a.dharmaName ?? a.email ?? '').localeCompare(b.dharmaName ?? b.email ?? '');
          case 'practice': return a.practiceTotal - b.practiceTotal;
          case 'streak': return a.practiceStreak - b.practiceStreak;
          case 'meditation': return a.meditationCompleted - b.meditationCompleted;
          case 'reading': return a.readingCompleted - b.readingCompleted;
          case 'answers': return a.totalAnswers - b.totalAnswers;
          case 'rate': return a.correctRate - b.correctRate;
          case 'task': return a.classTaskAvgProgress - b.classTaskAvgProgress;
        }
      })();
      return sortDesc ? -v : v;
    };
    return rows.slice().sort(cmp);
  }, [data.data, sortKey, sortDesc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDesc(!sortDesc);
    else { setSortKey(k); setSortDesc(true); }
  }

  function downloadCsv() {
    if (!classId) return;
    const url = `/api/coach/classes/${encodeURIComponent(classId)}/dashboard.csv`;
    const token = getAccess();
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `class-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      });
  }

  return (
    <div>
      <TopNav
        titles={['班级学修', '班級學修', 'Dashboard']}
        backTo={back}
        right={(
          <button type="button" onClick={downloadCsv} className="btn btn-pill" style={{ padding: '6px 14px', font: 'var(--text-caption)', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: '1px solid var(--saffron-light)' }}>
            📥 {s('导出', '導出', 'CSV')}
          </button>
        )}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>

      {data.isLoading ? <Skeleton.List /> : sorted.length === 0 ? (
        <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-5) 0' }}>
          {s('班级无学员', '班級無學員', 'No students')}
        </p>
      ) : (
        <div className="glass-card-thick" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--glass)', textAlign: 'left' }}>
                <Th onClick={() => toggleSort('name')} active={sortKey === 'name'} desc={sortDesc}>{s('学员', '學員', 'Student')}</Th>
                <Th onClick={() => toggleSort('practice')} active={sortKey === 'practice'} desc={sortDesc} num>{s('修学', '修學', 'Practice')}</Th>
                <Th onClick={() => toggleSort('streak')} active={sortKey === 'streak'} desc={sortDesc} num>🔥</Th>
                <Th onClick={() => toggleSort('meditation')} active={sortKey === 'meditation'} desc={sortDesc} num>🧘</Th>
                <Th onClick={() => toggleSort('reading')} active={sortKey === 'reading'} desc={sortDesc} num>📖</Th>
                <Th onClick={() => toggleSort('answers')} active={sortKey === 'answers'} desc={sortDesc} num>{s('答题', '答題', 'Q')}</Th>
                <Th onClick={() => toggleSort('rate')} active={sortKey === 'rate'} desc={sortDesc} num>{s('正确率', '正確率', 'Acc')}</Th>
                {(data.data?.taskCount ?? 0) > 0 && (
                  <Th onClick={() => toggleSort('task')} active={sortKey === 'task'} desc={sortDesc} num>📌 {data.data?.taskCount}</Th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.userId} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <Td>
                    <Link
                      to={`${isAdmin ? '/admin' : '/coach'}/classes/${encodeURIComponent(classId!)}/students/${encodeURIComponent(r.userId)}/stats`}
                      style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}
                    >
                      {r.dharmaName ?? r.userId.slice(0, 6)}
                    </Link>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{r.email}</div>
                  </Td>
                  <Td num>{fmt(r.practiceTotal)}</Td>
                  <Td num>{r.practiceStreak > 0 ? r.practiceStreak : '—'}</Td>
                  <Td num>{r.meditationCompleted || '—'}</Td>
                  <Td num>{r.readingCompleted || '—'}</Td>
                  <Td num>{r.totalAnswers || '—'}</Td>
                  <Td num color={r.correctRate >= 0.8 ? 'var(--sage-dark)' : r.correctRate < 0.5 && r.totalAnswers > 0 ? 'var(--crimson)' : undefined}>
                    {r.totalAnswers > 0 ? Math.round(r.correctRate * 100) + '%' : '—'}
                  </Td>
                  {(data.data?.taskCount ?? 0) > 0 && (
                    <Td num color={r.classTaskDoneCount === data.data!.taskCount ? 'var(--sage-dark)' : undefined}>
                      {r.classTaskDoneCount}/{data.data!.taskCount} · {r.classTaskAvgProgress}%
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}

function Th({ children, onClick, active, desc, num }: { children: React.ReactNode; onClick: () => void; active: boolean; desc: boolean; num?: boolean }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '8px 10px',
        font: 'var(--text-caption)',
        color: active ? 'var(--saffron-dark)' : 'var(--ink-3)',
        letterSpacing: 1,
        fontWeight: 700,
        cursor: 'pointer',
        textAlign: num ? 'right' : 'left',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {active && (desc ? ' ▾' : ' ▴')}
    </th>
  );
}

function Td({ children, num, color }: { children: React.ReactNode; num?: boolean; color?: string }) {
  return (
    <td style={{
      padding: '8px 10px',
      textAlign: num ? 'right' : 'left',
      color: color ?? 'var(--ink)',
      fontFamily: num ? 'var(--font-serif)' : 'inherit',
      fontWeight: num ? 600 : 400,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </td>
  );
}

function fmt(n: number): string {
  if (n >= 10_000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
