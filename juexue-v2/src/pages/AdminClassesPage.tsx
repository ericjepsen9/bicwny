// AdminClassesPage · /admin/classes
//   状态过滤 + 搜索 + 列表 + 新建 modal + 详情 drawer（成员 CRUD + 归档）
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import {
  type AdminClass,
  type AdminUsersResp,
  useAdminClasses,
  useAdminClassMembers,
  useCourses,
} from '@/lib/queries';
import { toast } from '@/lib/toast';

type StatusFilter = 'all' | 'active' | 'archived';

export default function AdminClassesPage() {
  const { s } = useLang();
  const [sp, setSp] = useSearchParams();
  const list = useAdminClasses();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter((c) => {
      if (status === 'active' && !c.isActive) return false;
      if (status === 'archived' && c.isActive) return false;
      if (q) {
        const hay = (c.name + ' ' + (c.joinCode || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [list.data, status, search]);

  const openId = sp.get('id');
  const openClass = filtered.find((c) => c.id === openId) || (list.data ?? []).find((c) => c.id === openId);

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('班级管理', '班級管理', 'Classes')}</h1>
          <p className="page-sub">
            {list.data ? list.data.length + ' ' + s('班级 · ' + (list.data.filter((c) => c.isActive).length) + ' 活跃', '班級 · ' + (list.data.filter((c) => c.isActive).length) + ' 活躍', 'classes · ' + list.data.filter((c) => c.isActive).length + ' active') : '…'}
          </p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '8px 16px' }}>
            + {s('新建班级', '新建班級', 'New class')}
          </button>
        </div>
      </div>

      <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'archived'] as StatusFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(k)}
              className="btn btn-pill"
              style={{
                padding: '5px 12px', font: 'var(--text-caption)', fontWeight: 600,
                background: status === k ? 'var(--saffron-pale)' : 'transparent',
                color: status === k ? 'var(--saffron-dark)' : 'var(--ink-3)',
                border: '1px solid ' + (status === k ? 'var(--saffron-light)' : 'transparent'),
              }}
            >
              {k === 'all' ? s('全部', '全部', 'All') : k === 'active' ? s('活跃', '活躍', 'Active') : s('已归档', '已歸檔', 'Archived')}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder={s('搜索班级名 / 加入码', '搜尋班級名 / 加入碼', 'Search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '6px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border)', background: 'var(--bg-input)', font: 'var(--text-caption)', outline: 'none' }}
        />
      </div>

      {list.isLoading ? (
        <Skeleton.Card />
      ) : filtered.length === 0 ? (
        <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
          {s('没有匹配的班级', '沒有匹配的班級', 'No matches')}
        </div>
      ) : (
        <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--glass)', textAlign: 'left' }}>
              <Th>{s('班级', '班級', 'Class')}</Th>
              <Th>{s('法本', '法本', 'Course')}</Th>
              <Th>{s('加入码', '加入碼', 'Code')}</Th>
              <Th>{s('创建', '創建', 'Created')}</Th>
              <Th>{s('状态', '狀態', 'Status')}</Th>
            </tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSp({ id: c.id })}
                  style={{ cursor: 'pointer', borderTop: '1px solid var(--border-light)', background: c.id === openId ? 'var(--saffron-pale)' : 'transparent' }}
                >
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>{c.coverEmoji || '📚'}</span>
                      <div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)' }}>
                          {c.name}
                        </div>
                        {c.memberCount != null && (
                          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                            {c.memberCount} {s('人', '人', 'members')}
                          </div>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                      {c.course ? `${c.course.coverEmoji} ${c.course.title}` : '—'}
                    </span>
                  </Td>
                  <Td>
                    {c.joinCode ? (
                      <code style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', fontWeight: 700, letterSpacing: 1 }}>{c.joinCode}</code>
                    ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                  </Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{new Date(c.createdAt).toLocaleDateString()}</span></Td>
                  <Td>
                    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: c.isActive ? 'rgba(125,154,108,.15)' : 'var(--border-light)', color: c.isActive ? 'var(--sage-dark)' : 'var(--ink-3)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
                      {c.isActive ? '✓ active' : '—archived'}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s('新建班级', '新建班級', 'New class')}>
        <CreateClassForm onDone={() => setCreateOpen(false)} />
      </Dialog>

      {openClass && <ClassDrawer cls={openClass} onClose={() => setSp({})} />}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: 'var(--sp-3) var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>{children}</td>;
}

function CreateClassForm({ onDone }: { onDone: () => void }) {
  const { s } = useLang();
  const courses = useCourses();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [emoji, setEmoji] = useState('📚');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/classes', {
      name: name.trim(),
      courseId,
      coverEmoji: emoji.trim() || undefined,
      description: desc.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/classes'] });
      toast.ok(s('已创建', '已創建', 'Created'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setErr(''); if (!courseId) { setErr(s('请选法本', '請選法本', 'Pick a course')); return; } create.mutate(); }}
      style={{ padding: 'var(--sp-2) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
      <Field label={s('班级名', '班級名', 'Name')} value={name} onChange={setName} required maxLength={64} />
      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
          {s('法本', '法本', 'Course')}
        </label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          required
          style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)', font: 'var(--text-body)', outline: 'none' }}
        >
          <option value="">{s('— 请选 —', '— 請選 —', '— pick —')}</option>
          {(courses.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.coverEmoji} {c.title}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 4fr', gap: 'var(--sp-3)' }}>
        <Field label={s('图标', '圖示', 'Emoji')} value={emoji} onChange={setEmoji} maxLength={2} />
        <Field label={s('简介（可选）', '簡介（可選）', 'Description (opt)')} value={desc} onChange={setDesc} />
      </div>
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button type="button" onClick={onDone} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
          {s('取消', '取消', 'Cancel')}
        </button>
        <button type="submit" disabled={create.isPending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          {create.isPending ? '…' : s('创建', '創建', 'Create')}
        </button>
      </div>
    </form>
  );
}

function ClassDrawer({ cls, onClose }: { cls: AdminClass; onClose: () => void }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const members = useAdminClassMembers(cls.id);

  const archive = useMutation({
    mutationFn: () => api.patch(`/api/admin/classes/${encodeURIComponent(cls.id)}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/classes'] });
      toast.ok(s('已归档', '已歸檔', 'Archived'));
      onClose();
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(43,34,24,.35)', zIndex: 200 }} />
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(560px, 100vw)',
          background: 'var(--bg-scene)',
          borderLeft: '1px solid var(--glass-border)',
          boxShadow: '-12px 0 32px rgba(43,34,24,.18)',
          zIndex: 201, overflowY: 'auto', padding: 'var(--sp-5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)', letterSpacing: 2 }}>
            {s('班级详情', '班級詳情', 'Class')}
          </h2>
          <button type="button" onClick={onClose} aria-label={s('关闭', '關閉', 'Close')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '1.4rem', lineHeight: 1 }}>✕</button>
        </div>

        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <span style={{ fontSize: '2rem' }}>{cls.coverEmoji || '📚'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', fontSize: '1.125rem', letterSpacing: 2 }}>
                {cls.name}
              </div>
              {cls.course && (
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                  {cls.course.coverEmoji} {cls.course.title}
                </div>
              )}
              {cls.joinCode && (
                <div style={{ marginTop: 6 }}>
                  <code style={{ padding: '2px 10px', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', borderRadius: 'var(--r-pill)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 2 }}>
                    {cls.joinCode}
                  </code>
                </div>
              )}
            </div>
          </div>
          {cls.description && (
            <p style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 'var(--sp-3)' }}>{cls.description}</p>
          )}
        </div>

        <h3 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-2)' }}>
          {s('添加成员', '添加成員', 'Add member')}
        </h3>
        <AddMemberForm classId={cls.id} />

        <h3 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginTop: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
          {s('成员', '成員', 'Members')} ({members.data?.length ?? 0})
        </h3>
        {members.isLoading ? (
          <Skeleton.LineSm />
        ) : !members.data || members.data.length === 0 ? (
          <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', textAlign: 'center', color: 'var(--ink-3)' }}>
            {s('暂无成员', '暫無成員', 'No members')}
          </div>
        ) : (
          <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
            {members.data.map((m, i) => (
              <MemberRow key={m.id} m={m} classId={cls.id} top={i === 0} />
            ))}
          </div>
        )}

        {cls.isActive && (
          <button
            type="button"
            disabled={archive.isPending}
            onClick={async () => {
              if (!(await confirmAsync({ title: s('归档此班级？学员将失去访问', '歸檔此班級？學員將失去訪問', 'Archive this class? Students lose access.') }))) return;
              archive.mutate();
            }}
            className="btn btn-pill btn-full"
            style={{
              marginTop: 'var(--sp-5)',
              padding: 12,
              background: 'transparent',
              color: 'var(--crimson)',
              border: '1px solid rgba(192,57,43,.3)',
              justifyContent: 'center',
            }}
          >
            {archive.isPending ? '…' : s('归档班级', '歸檔班級', 'Archive class')}
          </button>
        )}
      </aside>
    </>
  );
}

function AddMemberForm({ classId }: { classId: string }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(null);
  const [role, setRole] = useState<'coach' | 'student'>('student');

  const search$ = useQuery({
    enabled: search.length >= 2 && !picked,
    queryKey: ['/api/admin/users', 'pick', search],
    queryFn: ({ signal }) => api.get<AdminUsersResp>('/api/admin/users?limit=10&search=' + encodeURIComponent(search), { signal }),
  });

  const add = useMutation({
    mutationFn: () => api.post(`/api/admin/classes/${encodeURIComponent(classId)}/members`, { userId: picked!.id, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/classes', classId, 'members'] });
      toast.ok(s('已添加', '已添加', 'Added'));
      setSearch(''); setPicked(null);
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-3)', position: 'relative' }}>
      {picked ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)' }}>{picked.label}</span>
          <select value={role} onChange={(e) => setRole(e.target.value as 'coach' | 'student')} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', font: 'var(--text-caption)' }}>
            <option value="student">student</option>
            <option value="coach">coach</option>
          </select>
          <button type="button" onClick={() => add.mutate()} disabled={add.isPending} className="btn btn-primary btn-pill" style={{ padding: '6px 14px' }}>
            {add.isPending ? '…' : s('添加', '添加', 'Add')}
          </button>
          <button type="button" onClick={() => setPicked(null)} aria-label="cancel" style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <>
          <input
            type="search"
            placeholder={s('搜索邮箱 / 法名…', '搜尋郵箱 / 法名…', 'Search email / name…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border)', background: 'var(--bg-input)', font: 'var(--text-caption)', outline: 'none' }}
          />
          {search.length >= 2 && search$.data && search$.data.items.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {search$.data.items.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setPicked({ id: u.id, label: (u.dharmaName || u.email) + ' · ' + u.email })}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--r-sm)',
                    cursor: 'pointer',
                    font: 'var(--text-caption)',
                    color: 'var(--ink)',
                  }}
                >
                  <strong>{u.dharmaName || '—'}</strong> <span style={{ color: 'var(--ink-3)' }}>{u.email}</span> <span style={{ color: 'var(--ink-4)' }}>· {u.role}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MemberRow({ m, classId, top }: { m: { id: string; role: 'coach' | 'student'; user: { id: string; dharmaName: string; email: string } }; classId: string; top: boolean }) {
  const { s } = useLang();
  const qc = useQueryClient();

  const kick = useMutation({
    mutationFn: () => api.del(`/api/admin/classes/${encodeURIComponent(classId)}/members/${encodeURIComponent(m.user.id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/classes', classId, 'members'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/classes'] });
      toast.ok(s('已移除', '已移除', 'Removed'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderTop: top ? 'none' : '1px solid var(--border-light)' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.75rem' }}>
        {m.user.dharmaName.slice(0, 1)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1 }}>{m.user.dharmaName}</div>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{m.user.email}</div>
      </div>
      <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: m.role === 'coach' ? 'var(--gold-pale)' : 'var(--saffron-pale)', color: m.role === 'coach' ? 'var(--gold-dark)' : 'var(--saffron-dark)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
        {m.role}
      </span>
      <button
        type="button"
        onClick={async () => { (await confirmAsync({ title: s('移除该成员？', '移除該成員？', 'Remove?') })) && kick.mutate(); }}
        disabled={kick.isPending}
        aria-label={s('移除', '移除', 'Remove')}
        style={{ background: 'transparent', border: 'none', color: 'var(--crimson)', cursor: 'pointer', padding: 4 }}
      >
        ✕
      </button>
    </div>
  );
}
