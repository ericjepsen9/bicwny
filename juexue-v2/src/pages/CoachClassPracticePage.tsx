// 教师 · 班级修学管理 /coach/classes/:id/practice · /admin/classes/:id/practice
//   - 班级专修子项 list/add/archive
//   - 班级任务 list/create/archive
//   - 班级排行（period × 大类过滤）
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { type PracticeCategory, usePracticeCategories } from '@/lib/queries';
import { toast } from '@/lib/toast';

interface CoachProject {
  id: string;
  name: string;
  emoji: string | null;
  archivedAt: string | null;
  category: { id: string; key: string; name: string; emoji: string };
}

interface CoachTask {
  id: string;
  scope: 'class';
  mode: 'daily' | 'fixed';
  title: string | null;
  target: number;
  startAt: string;
  endAt: string | null;
  archivedAt: string | null;
  project: { id: string; name: string; emoji: string | null; categoryId: string };
}

interface RankingRow {
  userId: string;
  dharmaName: string | null;
  avatar: string | null;
  total: number;
}

export default function CoachClassPracticePage() {
  const { s } = useLang();
  const { id: classId } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const back = isAdmin ? '/admin/classes' : '/coach/classes';

  const [tab, setTab] = useState<'projects' | 'tasks' | 'ranking'>('projects');

  return (
    <div>
      <TopNav titles={['班级修学', '班級修學', 'Class practice']} backTo={back} />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>

      <div style={{ display: 'flex', gap: 6 }}>
        {([
          ['projects', '专修子项', '專修子項', 'Projects'],
          ['tasks', '任务', '任務', 'Tasks'],
          ['ranking', '排行', '排行', 'Ranking'],
        ] as const).map(([k, sc, tc, en]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k as typeof tab)}
            className="btn btn-pill"
            style={{
              padding: '6px 14px',
              background: tab === k ? 'var(--saffron-pale)' : 'transparent',
              border: '1px solid ' + (tab === k ? 'var(--saffron-light)' : 'var(--border)'),
              color: tab === k ? 'var(--saffron-dark)' : 'var(--ink-3)',
            }}
          >
            {s(sc, tc, en)}
          </button>
        ))}
      </div>

      {tab === 'projects' && classId && <ProjectsTab classId={classId} />}
      {tab === 'tasks' && classId && <TasksTab classId={classId} />}
      {tab === 'ranking' && classId && <RankingTab classId={classId} />}
      </div>
    </div>
  );
}

// ── Projects tab ──
function ProjectsTab({ classId }: { classId: string }) {
  const { s } = useLang();
  const [createOpen, setCreateOpen] = useState(false);
  const cats = usePracticeCategories();
  const list = useQuery({
    queryKey: ['/api/coach/classes', classId, 'practice-projects'],
    queryFn: ({ signal }) => api.get<CoachProject[]>(`/api/coach/classes/${encodeURIComponent(classId)}/practice-projects`, { signal }),
  });

  const active = (list.data ?? []).filter((p) => !p.archivedAt);
  return (
    <>
      <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '8px 16px', alignSelf: 'flex-start' }}>
        + {s('加专修子项', '加專修子項', 'Add project')}
      </button>

      {list.isLoading ? <Skeleton.List /> : active.length === 0 ? (
        <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-4) 0' }}>
          {s('暂无专修子项 · 班级学员只能用平台预置 / 自建', '暫無專修子項', 'No class projects yet')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {active.map((p) => (
            <ProjectRow key={p.id} project={p} classId={classId} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s('班级加专修子项', '班級加專修子項', 'Add class project')} variant="centered">
        <CreateProjectForm classId={classId} categories={cats.data ?? []} onDone={() => setCreateOpen(false)} />
      </Dialog>
    </>
  );
}

function ProjectRow({ project, classId }: { project: CoachProject; classId: string }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const archive = useMutation({
    mutationFn: () => api.patch(`/api/coach/classes/${encodeURIComponent(classId)}/practice-projects/${encodeURIComponent(project.id)}`, { archive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/coach/classes', classId, 'practice-projects'] });
      toast.ok(s('已归档', '已歸檔', 'Archived'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
      <span style={{ fontSize: '1.3rem' }}>{project.emoji ?? project.category.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1.2 }}>
          {project.name}
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginLeft: 6 }}>· {project.category.name}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirmAsync({ title: s(`归档「${project.name}」？`, `歸檔「${project.name}」？`, `Archive?`), danger: true, okLabel: s('归档', '歸檔', 'Archive') });
          if (ok) archive.mutate();
        }}
        disabled={archive.isPending}
        className="btn btn-pill"
        style={{ padding: '4px 12px', font: 'var(--text-caption)', color: 'var(--crimson)', background: 'transparent', border: '1px solid rgba(192,57,43,.3)' }}
      >
        {archive.isPending ? '…' : s('归档', '歸檔', 'Archive')}
      </button>
    </div>
  );
}

function CreateProjectForm({ classId, categories, onDone }: { classId: string; categories: PracticeCategory[]; onDone: () => void }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: () => api.post(`/api/coach/classes/${encodeURIComponent(classId)}/practice-projects`, {
      categoryId,
      name: name.trim(),
      emoji: emoji.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/coach/classes', classId, 'practice-projects'] });
      toast.ok(s('已添加', '已添加', 'Added'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); setErr(''); if (!name.trim() || !categoryId) return; create.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0' }}>
      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
          {s('归属大类', '歸屬大類', 'Category')}
        </label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', font: 'var(--text-body)' }}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>
      <Field label={s('子项名称', '子項名稱', 'Name')} value={name} onChange={setName} required maxLength={60} placeholder={s('如 金刚萨埵心咒', '如 金剛薩埵心咒', 'e.g. 金刚萨埵心咒')} />
      <Field label={s('emoji（可选）', 'emoji（可選）', 'Emoji (opt)')} value={emoji} onChange={setEmoji} maxLength={4} />
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button type="button" onClick={onDone} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)' }}>
          {s('取消', '取消', 'Cancel')}
        </button>
        <button type="submit" disabled={create.isPending || !name.trim()} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12 }}>
          {create.isPending ? '…' : s('添加', '添加', 'Add')}
        </button>
      </div>
    </form>
  );
}

// ── Tasks tab ──
function TasksTab({ classId }: { classId: string }) {
  const { s } = useLang();
  const [createOpen, setCreateOpen] = useState(false);
  const projects = useQuery({
    queryKey: ['/api/coach/classes', classId, 'practice-projects'],
    queryFn: ({ signal }) => api.get<CoachProject[]>(`/api/coach/classes/${encodeURIComponent(classId)}/practice-projects`, { signal }),
  });
  const list = useQuery({
    queryKey: ['/api/coach/classes', classId, 'practice-tasks'],
    queryFn: ({ signal }) => api.get<CoachTask[]>(`/api/coach/classes/${encodeURIComponent(classId)}/practice-tasks`, { signal }),
  });
  const active = (list.data ?? []).filter((t) => !t.archivedAt);

  return (
    <>
      <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '8px 16px', alignSelf: 'flex-start' }}>
        + {s('下达任务', '下達任務', 'Add task')}
      </button>

      {list.isLoading ? <Skeleton.List /> : active.length === 0 ? (
        <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-4) 0' }}>
          {s('暂无任务', '暫無任務', 'No tasks')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {active.map((t) => (
            <TaskRow key={t.id} task={t} classId={classId} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s('下达班级任务', '下達班級任務', 'New class task')} variant="centered">
        <CreateTaskForm classId={classId} projects={(projects.data ?? []).filter((p) => !p.archivedAt)} onDone={() => setCreateOpen(false)} />
      </Dialog>
    </>
  );
}

function TaskRow({ task, classId }: { task: CoachTask; classId: string }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const archive = useMutation({
    mutationFn: () => api.patch(`/api/coach/classes/${encodeURIComponent(classId)}/practice-tasks/${encodeURIComponent(task.id)}`, { archive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/coach/classes', classId, 'practice-tasks'] });
      toast.ok(s('已归档', '已歸檔', 'Archived'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1.2 }}>
          {task.project.emoji ?? ''} {task.title || task.project.name}
        </div>
        <button
          type="button"
          onClick={async () => {
            const ok = await confirmAsync({ title: s('归档此任务？', '歸檔此任務？', 'Archive?'), danger: true });
            if (ok) archive.mutate();
          }}
          disabled={archive.isPending}
          style={{ background: 'transparent', border: 'none', font: 'var(--text-caption)', color: 'var(--crimson)', cursor: 'pointer' }}
        >
          {s('归档', '歸檔', 'Archive')}
        </button>
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
        {task.mode === 'daily' ? s(`每日 ${task.target}`, `每日 ${task.target}`, `Daily ${task.target}`) : s(`累计 ${task.target}`, `累計 ${task.target}`, `Total ${task.target}`)}
        {' · '}
        {new Date(task.startAt).toLocaleDateString()}
        {task.endAt && ` ~ ${new Date(task.endAt).toLocaleDateString()}`}
      </div>
    </div>
  );
}

function CreateTaskForm({ classId, projects, onDone }: { classId: string; projects: CoachProject[]; onDone: () => void }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'daily' | 'fixed'>('fixed');
  const [target, setTarget] = useState(1000);
  const [startAt, setStartAt] = useState(new Date().toISOString().slice(0, 10));
  const [endAt, setEndAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () => api.post(`/api/coach/classes/${encodeURIComponent(classId)}/practice-tasks`, {
      projectId,
      mode,
      target,
      title: title.trim() || undefined,
      startAt: new Date(startAt).toISOString(),
      endAt: mode === 'fixed' ? new Date(endAt).toISOString() : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/coach/classes', classId, 'practice-tasks'] });
      toast.ok(s('已下达', '已下達', 'Created'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  if (projects.length === 0) {
    return <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{s('请先添加专修子项', '請先添加專修子項', 'Add a project first')}</p>;
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setErr(''); create.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0' }}>
      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
          {s('子项', '子項', 'Project')}
        </label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', font: 'var(--text-body)' }}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.emoji ?? p.category.emoji} {p.name}</option>)}
        </select>
      </div>
      <Field label={s('任务标题（可选）', '任務標題（可選）', 'Title (opt)')} value={title} onChange={setTitle} maxLength={120} placeholder={s('本周精进', '本週精進', 'Weekly push')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
        <div>
          <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
            {s('模式', '模式', 'Mode')}
          </label>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'daily' | 'fixed')} style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)' }}>
            <option value="fixed">{s('期间累计', '期間累計', 'Fixed window')}</option>
            <option value="daily">{s('每日重复', '每日重複', 'Daily repeat')}</option>
          </select>
        </div>
        <Field label={s('目标数', '目標數', 'Target')} value={String(target)} onChange={(v) => setTarget(Math.max(1, Number(v) || 1))} type="number" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
        <Field label={s('开始日期', '開始日期', 'Start')} value={startAt} onChange={setStartAt} type="date" />
        {mode === 'fixed' && <Field label={s('结束日期', '結束日期', 'End')} value={endAt} onChange={setEndAt} type="date" />}
      </div>
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button type="button" onClick={onDone} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)' }}>
          {s('取消', '取消', 'Cancel')}
        </button>
        <button type="submit" disabled={create.isPending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12 }}>
          {create.isPending ? '…' : s('下达', '下達', 'Create')}
        </button>
      </div>
    </form>
  );
}

// ── Ranking tab ──
function RankingTab({ classId }: { classId: string }) {
  const { s } = useLang();
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [categoryKey, setCategoryKey] = useState<string>('');
  const cats = usePracticeCategories();
  const list = useQuery({
    queryKey: ['/api/coach/classes', classId, 'practice-ranking', period, categoryKey],
    queryFn: ({ signal }) => api.get<RankingRow[]>(
      `/api/coach/classes/${encodeURIComponent(classId)}/practice-ranking?period=${period}` + (categoryKey ? `&categoryKey=${categoryKey}` : ''),
      { signal },
    ),
  });
  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['week', 'month', 'all'] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPeriod(p)} className="btn btn-pill" style={{
            padding: '4px 12px', font: 'var(--text-caption)',
            background: period === p ? 'var(--saffron-pale)' : 'transparent',
            border: '1px solid ' + (period === p ? 'var(--saffron-light)' : 'var(--border)'),
            color: period === p ? 'var(--saffron-dark)' : 'var(--ink-3)',
          }}>
            {p === 'week' ? s('本周', '本週', 'Week') : p === 'month' ? s('本月', '本月', 'Month') : s('累计', '累計', 'All')}
          </button>
        ))}
        <select value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)} style={{ padding: '4px 10px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border)', background: 'var(--bg-input)', font: 'var(--text-caption)' }}>
          <option value="">{s('全部大类', '全部大類', 'All categories')}</option>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.key}>{c.emoji} {c.name}</option>)}
        </select>
      </div>

      {list.isLoading ? <Skeleton.List /> : (list.data ?? []).length === 0 ? (
        <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-4) 0' }}>
          {s('暂无公开计数的成员（隐私默认关）', '暫無公開計數的成員', 'No public counters (privacy default off)')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(list.data ?? []).map((r, i) => (
            <Link
              key={r.userId}
              to={`/coach/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(r.userId)}/stats`}
              className="glass-card-thick"
              style={{ padding: 'var(--sp-2) var(--sp-3)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', textDecoration: 'none', color: 'inherit' }}
            >
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 24, textAlign: 'center', fontWeight: 700 }}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
              </span>
              <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)' }}>{r.dharmaName ?? r.userId.slice(0, 6)}</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--saffron-dark)' }}>{r.total}</span>
              <span style={{ color: 'var(--ink-4)' }}>›</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
