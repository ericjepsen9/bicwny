// 修学计数 · 大类页 /practice/:categoryKey
//   - 三组子项：平台预置 / 班级专修 / 我的
//   - 学员加我的子项（Dialog）
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
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
  const all = (projects.data ?? []).filter((p) => p.categoryId === cat?.id);

  const grouped = useMemo(() => ({
    builtin: all.filter((p) => p.isBuiltin),
    className: all.filter((p) => p.scope === 'class'),
    mine: all.filter((p) => p.scope === 'user' && !p.isBuiltin),
  }), [all]);

  const totalCount = all.reduce((s, p) => s + p.totalCount, 0);
  const todayCount = all.reduce((s, p) => s + p.todayCount, 0);

  if (!cat) {
    return cats.isLoading ? <Skeleton.Card /> : <p style={{ color: 'var(--crimson)', padding: 'var(--sp-4)' }}>{s('大类不存在', '大類不存在', 'Category not found')}</p>;
  }

  return (
    <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <Link to="/practice" style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', textDecoration: 'none' }}>
        ← {s('返回', '返回', 'Back')}
      </Link>

      <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
        <div style={{ fontSize: '2.4rem' }}>{cat.emoji}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.4rem', letterSpacing: 3, marginTop: 4 }}>
          {cat.name}
        </h1>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 6 }}>
          {s(`累计 ${totalCount} · 今日 ${todayCount}`, `累計 ${totalCount} · 今日 ${todayCount}`, `Total ${totalCount} · Today ${todayCount}`)}
        </div>
      </div>

      {projects.isLoading ? <Skeleton.List /> : (
        <>
          {grouped.builtin.length > 0 && (
            <ProjectGroup title={s('平台常用', '平台常用', 'Platform')} list={grouped.builtin} />
          )}
          {grouped.className.length > 0 && (
            <ProjectGroup title={s('班级专修', '班級專修', 'Class focus')} list={grouped.className} />
          )}
          {grouped.mine.length > 0 && (
            <ProjectGroup title={s('我的', '我的', 'Mine')} list={grouped.mine} />
          )}
          {grouped.builtin.length === 0 && grouped.className.length === 0 && grouped.mine.length === 0 && (
            <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-5) 0' }}>
              {s('暂无子项 · 点下方加我的', '暫無子項', 'No projects · add yours')}
            </p>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="btn btn-pill"
        style={{ padding: '12px 16px', background: 'var(--glass-thick)', color: 'var(--saffron-dark)', border: '1px dashed var(--saffron-light)', justifyContent: 'center' }}
      >
        + {s(`加我的${cat.name === '持咒' ? '咒种' : cat.name === '诵经' ? '经名' : cat.name === '观修' ? '题目' : '项目'}`, '加我的項目', 'Add mine')}
      </button>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s(`新增「${cat.name}」子项`, `新增「${cat.name}」子項`, `New ${cat.name}`)} variant="centered">
        <CreateProjectForm categoryId={cat.id} onDone={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}

function ProjectGroup({ title, list }: { title: string; list: PracticeProject[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
        {title}
      </div>
      {list.map((p) => (
        <Link key={p.id} to={`/practice/project/${p.id}`} style={{ textDecoration: 'none' }}>
          <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <span style={{ fontSize: '1.4rem' }}>{p.emoji ?? '📿'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
                {p.scope === 'class' && p.className && (
                  <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginLeft: 6 }}>· {p.className}</span>
                )}
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                {p.totalCount > 0 ? `累计 ${p.totalCount} · 今日 ${p.todayCount}` : '——'}
              </div>
            </div>
            <span style={{ color: 'var(--ink-3)' }}>›</span>
          </div>
        </Link>
      ))}
    </div>
  );
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
