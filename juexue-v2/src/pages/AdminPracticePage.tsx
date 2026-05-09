// admin · 平台预置子项 CRUD /admin/practice
//   按大类分组 · 加 / 改名 / 归档
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

interface AdminPracticeProject {
  id: string;
  categoryId: string;
  name: string;
  emoji: string | null;
  archivedAt: string | null;
  isBuiltin: boolean;
  displayOrder: number;
}

interface AdminPracticeData {
  data: Array<{
    category: { id: string; key: string; name: string; emoji: string };
    projects: AdminPracticeProject[];
  }>;
}

export default function AdminPracticePage() {
  const { s } = useLang();
  const [createInCat, setCreateInCat] = useState<{ id: string; name: string } | null>(null);
  const list = useQuery({
    queryKey: ['/api/admin/practice/projects'],
    queryFn: ({ signal }) => api.get<AdminPracticeData['data']>('/api/admin/practice/projects', { signal }),
  });

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('修学预置', '修學預置', 'Practice presets')}</h1>
          <p className="page-sub">{s('5 大类下的平台预置子项 · 学员一进就能选', '5 大類下的平台預置', '5 categories · platform builtin')}</p>
        </div>
      </div>

      {list.isLoading ? <Skeleton.List /> : (list.data ?? []).map((g) => (
        <div key={g.category.id} className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: 2 }}>
              {g.category.emoji} {g.category.name}
            </h2>
            <button type="button" onClick={() => setCreateInCat({ id: g.category.id, name: g.category.name })} className="btn btn-pill" style={{ padding: '6px 14px', font: 'var(--text-caption)', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: '1px solid var(--saffron-light)' }}>
              + {s('加', '加', 'Add')}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {g.projects.filter((p) => !p.archivedAt).map((p) => <PresetRow key={p.id} project={p} />)}
            {g.projects.filter((p) => !p.archivedAt).length === 0 && (
              <span style={{ color: 'var(--ink-4)', font: 'var(--text-caption)' }}>{s('（暂无）', '（暫無）', '(none)')}</span>
            )}
          </div>
        </div>
      ))}

      {createInCat && (
        <Dialog open onClose={() => setCreateInCat(null)} title={s(`新增「${createInCat.name}」预置`, `新增「${createInCat.name}」預置`, `New preset`)} variant="centered">
          <CreateForm categoryId={createInCat.id} onDone={() => setCreateInCat(null)} />
        </Dialog>
      )}
    </>
  );
}

function PresetRow({ project }: { project: AdminPracticeProject }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const archive = useMutation({
    mutationFn: () => api.patch(`/api/admin/practice/projects/${encodeURIComponent(project.id)}`, { archive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/practice/projects'] });
      toast.ok(s('已归档', '已歸檔', 'Archived'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-sm)' }}>
      <span style={{ fontSize: '1.1rem' }}>{project.emoji ?? '📿'}</span>
      <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)' }}>{project.name}</span>
      <button type="button" onClick={() => setEditing(true)} style={{ background: 'transparent', border: 'none', color: 'var(--saffron-dark)', font: 'var(--text-caption)', cursor: 'pointer' }}>
        {s('编辑', '編輯', 'Edit')}
      </button>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirmAsync({ title: s(`归档「${project.name}」？`, `歸檔「${project.name}」？`, `Archive?`), danger: true });
          if (ok) archive.mutate();
        }}
        disabled={archive.isPending}
        style={{ background: 'transparent', border: 'none', color: 'var(--crimson)', font: 'var(--text-caption)', cursor: 'pointer' }}
      >
        {s('归档', '歸檔', 'Archive')}
      </button>
      {editing && (
        <Dialog open onClose={() => setEditing(false)} title={s('编辑预置', '編輯預置', 'Edit preset')} variant="centered">
          <EditForm project={project} onDone={() => setEditing(false)} />
        </Dialog>
      )}
    </div>
  );
}

function CreateForm({ categoryId, onDone }: { categoryId: string; onDone: () => void }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: () => api.post('/api/admin/practice/projects', { categoryId, name: name.trim(), emoji: emoji.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/practice/projects'] });
      toast.ok(s('已添加', '已添加', 'Added'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); setErr(''); if (!name.trim()) return; create.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0' }}>
      <Field label={s('名称', '名稱', 'Name')} value={name} onChange={setName} required maxLength={60} />
      <Field label={s('emoji（可选）', 'emoji（可選）', 'Emoji (opt)')} value={emoji} onChange={setEmoji} maxLength={4} />
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button type="button" onClick={onDone} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)' }}>{s('取消', '取消', 'Cancel')}</button>
        <button type="submit" disabled={create.isPending || !name.trim()} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12 }}>{create.isPending ? '…' : s('添加', '添加', 'Add')}</button>
      </div>
    </form>
  );
}

function EditForm({ project, onDone }: { project: AdminPracticeProject; onDone: () => void }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [name, setName] = useState(project.name);
  const [emoji, setEmoji] = useState(project.emoji ?? '');
  const [err, setErr] = useState('');
  const update = useMutation({
    mutationFn: () => api.patch(`/api/admin/practice/projects/${encodeURIComponent(project.id)}`, { name: name.trim() || undefined, emoji: emoji.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/practice/projects'] });
      toast.ok(s('已保存', '已保存', 'Saved'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); setErr(''); update.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0' }}>
      <Field label={s('名称', '名稱', 'Name')} value={name} onChange={setName} maxLength={60} />
      <Field label={s('emoji', 'emoji', 'Emoji')} value={emoji} onChange={setEmoji} maxLength={4} />
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button type="button" onClick={onDone} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)' }}>{s('取消', '取消', 'Cancel')}</button>
        <button type="submit" disabled={update.isPending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12 }}>{update.isPending ? '…' : s('保存', '保存', 'Save')}</button>
      </div>
    </form>
  );
}
