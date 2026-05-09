// 修学计数 · 大类页 /practice/:categoryKey
//   参照 admin dashboard 风格：
//   - KPI 3 卡（累计 / 今日 / 子项数）· KPI hero
//   - 子项 2 列网格 · 三组合并 · 角标区分来源
//   - + 加我的子项（顶栏 right slot）
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import {
  type PracticeProject,
  usePracticeCategories,
  usePracticeProjects,
} from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function PracticeCategoryPage() {
  const { s } = useLang();
  const { categoryKey } = useParams<{ categoryKey: string }>();
  const cats = usePracticeCategories();
  const projects = usePracticeProjects();
  const [createOpen, setCreateOpen] = useState(false);

  const cat = cats.data?.find((c) => c.key === categoryKey);
  const all = useMemo(
    () => (projects.data ?? []).filter((p) => p.categoryId === cat?.id),
    [projects.data, cat?.id],
  );

  const totalCount = all.reduce((acc, p) => acc + p.totalCount, 0);
  const todayCount = all.reduce((acc, p) => acc + p.todayCount, 0);

  if (!cat) {
    return cats.isLoading
      ? <div style={{ padding: 'var(--sp-4)' }}><Skeleton.Card /></div>
      : <p style={{ color: 'var(--crimson)', padding: 'var(--sp-4)' }}>{s('大类不存在', '大類不存在', 'Category not found')}</p>;
  }

  return (
    <>
      <TopNav
        titles={[`${cat.emoji} ${cat.name}`, `${cat.emoji} ${cat.name}`, `${cat.emoji} ${cat.name}`]}
        backTo="/practice"
        right={(
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label={s('加我的', '加我的', 'Add')}
            style={{ background: 'var(--saffron-pale)', border: '1px solid var(--saffron-light)', color: 'var(--saffron-dark)', borderRadius: 'var(--r-pill)', padding: '4px 12px', font: 'var(--text-caption)', fontWeight: 700, cursor: 'pointer' }}
          >
            + {s('加', '加', 'Add')}
          </button>
        )}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

        {/* KPI 3 · admin dashboard 风 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
          <Kpi value={String(todayCount)} label={s('今日', '今日', 'Today')} color="var(--saffron-dark)" />
          <Kpi value={fmt(totalCount)} label={s('累计', '累計', 'Total')} color="var(--sage-dark)" />
          <Kpi value={String(all.length)} label={s('子项', '子項', 'Items')} />
        </div>

        {/* 子项 2 列网格 · 三组合并 · 角标区分来源 */}
        {projects.isLoading ? <Skeleton.List /> : all.length === 0 ? (
          <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-5) 0' }}>
            {s('暂无子项 · 点右上「加」自建', '暫無子項', 'No items · tap + to add')}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}>
            {all.map((p) => <ProjectCard key={p.id} p={p} />)}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s(`新增「${cat.name}」子项`, `新增「${cat.name}」子項`, `New ${cat.name}`)} variant="centered">
        <CreateProjectForm categoryId={cat.id} onDone={() => setCreateOpen(false)} />
      </Dialog>
    </>
  );
}

function ProjectCard({ p }: { p: PracticeProject }) {
  const sourceLabel = p.isBuiltin ? '🌐' : p.scope === 'class' ? '📚' : '⭐';
  const today = p.todayCount > 0;
  return (
    <Link
      to={`/practice/project/${p.id}`}
      className="glass-card-thick"
      style={{
        padding: 'var(--sp-4)',
        textDecoration: 'none', color: 'inherit',
        display: 'flex', flexDirection: 'column',
        minHeight: 110,
        border: today ? '1px solid var(--saffron)' : '1px solid var(--glass-border)',
        background: today ? 'var(--saffron-pale)' : 'var(--glass-thick)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '1.4rem' }}>{p.emoji ?? '📿'}</span>
        <span style={{ marginLeft: 'auto', font: 'var(--text-caption)', color: 'var(--ink-4)' }} title={p.scope === 'class' ? p.className ?? '' : ''}>
          {sourceLabel}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 1.5, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
        {p.name}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 'auto' }}>
        {p.totalCount > 0
          ? `${p.totalCount}${p.todayCount > 0 ? ` · 今日 +${p.todayCount}` : ''}`
          : '——'}
      </div>
    </Link>
  );
}

function Kpi({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', minHeight: 90 }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.4rem', color: color ?? 'var(--ink)', letterSpacing: 1 }}>{value}</div>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function CreateProjectForm({ categoryId, onDone }: { categoryId: string; onDone: () => void }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () => api.post<PracticeProject>('/api/practice/projects', {
      categoryId,
      name: name.trim(),
      emoji: emoji.trim() || undefined,
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/practice/projects'] });
      toast.ok(s('已添加', '已添加', 'Added'));
      onDone();
      nav(`/practice/project/${data.id}`);
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setErr(''); if (!name.trim()) return; create.mutate(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0' }}
    >
      <Field label={s('名称', '名稱', 'Name')} value={name} onChange={setName} required maxLength={60} placeholder={s('如 百字明 / 心经', '如 百字明 / 心經', 'e.g. 百字明')} />
      <Field label={s('emoji（可选）', 'emoji（可選）', 'Emoji (opt)')} value={emoji} onChange={setEmoji} maxLength={4} />
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button type="button" onClick={onDone} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)', justifyContent: 'center' }}>
          {s('取消', '取消', 'Cancel')}
        </button>
        <button type="submit" disabled={create.isPending || !name.trim()} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          {create.isPending ? '…' : s('添加', '添加', 'Add')}
        </button>
      </div>
    </form>
  );
}
