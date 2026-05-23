// AdminClassesPage · /admin/classes · /coach/classes
//   状态过滤 + 搜索 + 列表 + 详情居中 Dialog（决策 4）· 新建走独立页 /admin/classes/new（决策 5）
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
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
} from '@/lib/queries';
import { toast } from '@/lib/toast';

type StatusFilter = 'all' | 'active' | 'archived';

export default function AdminClassesPage() {
  const { s } = useLang();
  const [sp, setSp] = useSearchParams();
  const list = useAdminClasses();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const { pathname } = useLocation();
  const base = pathname.startsWith('/admin') ? '/admin/classes' : '/coach/classes';

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
  // 抽屉数据始终从 list.data 取（不受 filter 影响 · 永远是最新真相）
  // 同时检测「URL 指向的班级被 filter 隐藏」 · 给用户清晰的提示
  const openClass = (list.data ?? []).find((c) => c.id === openId);
  const openHiddenByFilter = !!openClass && !filtered.includes(openClass);

  // openId 在 list 中找不到（班级被删 / 归档后 list 拉新数据但 openId 没清）
  // → 关闭抽屉避免显示陈旧数据
  useEffect(() => {
    if (!openId || !list.data) return;
    const exists = list.data.some((c) => c.id === openId);
    if (!exists) {
      const next = new URLSearchParams(sp);
      next.delete('id');
      setSp(next, { replace: true });
    }
  }, [openId, list.data, sp, setSp]);

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
          <Link to={`${base}/new`} className="btn btn-primary btn-pill" style={{ padding: '8px 16px' }}>
            + {s('新建班级', '新建班級', 'New class')}
          </Link>
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
              <Th>{s('闻思', '聞思', 'Course')}</Th>
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

      {openClass && (
        <ClassDrawer
          cls={openClass}
          onClose={() => setSp({})}
          hiddenByFilter={openHiddenByFilter}
          onClearFilter={() => setStatus('all')}
        />
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: 'var(--sp-3) var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>{children}</td>;
}

function ClassDrawer({ cls, onClose, hiddenByFilter, onClearFilter }: {
  cls: AdminClass;
  onClose: () => void;
  hiddenByFilter?: boolean;
  onClearFilter?: () => void;
}) {
  const { s } = useLang();
  const qc = useQueryClient();
  const members = useAdminClassMembers(cls.id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cls.name);
  const [emoji, setEmoji] = useState(cls.coverEmoji ?? '📚');
  const [description, setDescription] = useState(cls.description ?? '');

  // 切换班级时同步表单字段（避免编辑 A 班 cancel 后切到 B 班还显示 A 的内容）
  // 仅依赖 cls.id（审计）：原先依赖 name/emoji/description · 后台 refetch 让这些字段
  //   identity 变化会触发重置 · 吞掉用户正在编辑但未保存的内容。
  useEffect(() => {
    setName(cls.name);
    setEmoji(cls.coverEmoji ?? '📚');
    setDescription(cls.description ?? '');
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls.id]);

  const update = useMutation({
    mutationFn: () => api.patch(`/api/admin/classes/${encodeURIComponent(cls.id)}`, {
      name: name.trim(),
      coverEmoji: emoji.trim() || null,
      description: description.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/classes'] });
      // 同步学员端 useClassDetail · 否则改名后学员仍看旧名（审计 S3）
      qc.invalidateQueries({ queryKey: ['/api/classes', cls.id] });
      toast.ok(s('已保存', '已保存', 'Saved'));
      setEditing(false);
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const archive = useMutation({
    mutationFn: () => api.patch(`/api/admin/classes/${encodeURIComponent(cls.id)}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/classes'] });
      // 归档后学员端立即失访 · 让 ClassDetail 重新拉到 403/归档态（审计 S3）
      qc.invalidateQueries({ queryKey: ['/api/classes', cls.id] });
      toast.ok(s('已归档', '已歸檔', 'Archived'));
      onClose();
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const { pathname } = useLocation();
  const baseClass = pathname.startsWith('/admin') ? '/admin' : '/coach';
  return (
    <Dialog open onClose={onClose} title={s('班级详情', '班級詳情', 'Class')} variant="centered" width={720}>
      <div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <Link
            to={`${baseClass}/classes/${encodeURIComponent(cls.id)}/practice`}
            onClick={onClose}
            className="btn btn-pill"
            style={{ display: 'inline-flex', padding: '6px 14px', font: 'var(--text-caption)', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: '1px solid var(--saffron-light)', textDecoration: 'none' }}
          >
            📿 {s('班级修学', '班級修學', 'Practice')} ›
          </Link>
          <Link
            to={`${baseClass}/classes/${encodeURIComponent(cls.id)}/announcements`}
            onClick={onClose}
            className="btn btn-pill"
            style={{ display: 'inline-flex', padding: '6px 14px', font: 'var(--text-caption)', background: 'var(--gold-pale)', color: 'var(--gold-dark)', border: '1px solid var(--gold-light)', textDecoration: 'none' }}
          >
            📢 {s('班级公告', '班級公告', 'Announcements')} ›
          </Link>
          <Link
            to={`${baseClass}/classes/${encodeURIComponent(cls.id)}/sessions`}
            onClick={onClose}
            className="btn btn-pill"
            style={{ display: 'inline-flex', padding: '6px 14px', font: 'var(--text-caption)', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: '1px solid var(--saffron-light)', textDecoration: 'none' }}
          >
            📅 {s('共修', '共修', 'Sessions')} ›
          </Link>
          <Link
            to={`${baseClass}/classes/${encodeURIComponent(cls.id)}/dashboard`}
            onClick={onClose}
            className="btn btn-pill"
            style={{ display: 'inline-flex', padding: '6px 14px', font: 'var(--text-caption)', background: 'var(--sage-light)', color: 'var(--sage-dark)', border: '1px solid var(--sage-dark)', textDecoration: 'none' }}
          >
            📊 {s('学修对比', '學修對比', 'Dashboard')} ›
          </Link>
        </div>
        {hiddenByFilter && (
          <div style={{
            padding: 'var(--sp-3) var(--sp-4)',
            marginBottom: 'var(--sp-3)',
            background: 'var(--saffron-pale)',
            border: '1px solid var(--saffron-light)',
            borderRadius: 'var(--r-sm)',
            font: 'var(--text-caption)',
            color: 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)',
          }}>
            <span>⚠️ {s('此班级被当前过滤器隐藏 · 列表中看不到', '此班級被當前過濾器隱藏', 'This class is hidden by the current filter')}</span>
            {onClearFilter && (
              <button
                type="button"
                onClick={onClearFilter}
                className="btn btn-pill"
                style={{ padding: '4px 10px', font: 'var(--text-caption)', fontWeight: 600, background: 'var(--saffron)', color: '#fff', border: 'none' }}
              >
                {s('显示全部', '顯示全部', 'Show all')}
              </button>
            )}
          </div>
        )}

        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          {editing ? (
            <form
              onSubmit={(e) => { e.preventDefault(); update.mutate(); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 'var(--sp-2)' }}>
                <Field label={s('封面', '封面', 'Emoji')} value={emoji} onChange={setEmoji} maxLength={8} />
                <Field label={s('班级名', '班級名', 'Name')} value={name} onChange={setName} required maxLength={80} />
              </div>
              <div>
                <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
                  {s('描述（可选）', '描述（可選）', 'Description (opt)')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)', resize: 'vertical', minHeight: 50, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button type="button" onClick={() => setEditing(false)} className="btn btn-pill" style={{ padding: '6px 14px', font: 'var(--text-caption)', background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
                  {s('取消', '取消', 'Cancel')}
                </button>
                <button type="submit" disabled={update.isPending || !name.trim()} className="btn btn-primary btn-pill" style={{ padding: '6px 16px', font: 'var(--text-caption)' }}>
                  {update.isPending ? '…' : s('保存', '保存', 'Save')}
                </button>
              </div>
            </form>
          ) : (
            <>
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
                {cls.isActive && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="btn btn-pill"
                    style={{ padding: '4px 12px', font: 'var(--text-caption)', fontWeight: 600, background: 'transparent', color: 'var(--saffron-dark)', border: '1px solid var(--saffron-light)' }}
                  >
                    {s('编辑', '編輯', 'Edit')}
                  </button>
                )}
              </div>
              {cls.description && (
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 'var(--sp-3)' }}>{cls.description}</p>
              )}
            </>
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
      </div>
    </Dialog>
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
      // 同步刷新班级列表 · 否则列表行的 memberCount 陈旧（与 kick 一致）
      qc.invalidateQueries({ queryKey: ['/api/admin/classes'] });
      // 同步学员端班级详情成员列表（审计 S3）
      qc.invalidateQueries({ queryKey: ['/api/classes', classId] });
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
      qc.invalidateQueries({ queryKey: ['/api/classes', classId] }); // 同步学员端（审计 S3）
      toast.ok(s('已移除', '已移除', 'Removed'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const swapRole = useMutation({
    mutationFn: (newRole: 'coach' | 'student') => api.patch(
      `/api/admin/classes/${encodeURIComponent(classId)}/members/${encodeURIComponent(m.user.id)}/role`,
      { role: newRole },
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/classes', classId, 'members'] });
      qc.invalidateQueries({ queryKey: ['/api/classes', classId] }); // 同步学员端（审计 S3）
      toast.ok(s('角色已更新', '角色已更新', 'Role updated'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderTop: top ? 'none' : '1px solid var(--border-light)' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.75rem' }}>
        {(m.user.dharmaName ?? '').slice(0, 1) || '·'}
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
        onClick={async () => {
          const next = m.role === 'coach' ? 'student' : 'coach';
          if (!(await confirmAsync({ title: s(`切到 ${next}？`, `切到 ${next}？`, `Switch to ${next}?`) }))) return;
          swapRole.mutate(next);
        }}
        disabled={swapRole.isPending}
        title={s('切换角色（coach ↔ student）', '切換角色', 'Switch role')}
        aria-label={s('切换角色', '切換角色', 'Switch role')}
        style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 4, font: 'var(--text-caption)' }}
      >
        ⇄
      </button>
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
