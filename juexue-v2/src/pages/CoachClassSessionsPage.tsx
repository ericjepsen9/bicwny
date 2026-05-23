// 共修安排页 · /coach/classes/:id/sessions（coach/admin · 可增删改）· /class/:id/sessions（学员 · 只读）
//   - tab: 即将 / 历史
//   - 列表：每条 session 显示 标题 / 时间 / 时长 / 直播链接 / 编辑 / 删除（仅 coach）
//   - + 新建按钮 → 弹层 form（仅 coach）
//   - 删除二次确认
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { type ClassSession, useClassDetail, useClassSessions } from '@/lib/queries';
import { toast } from '@/lib/toast';

type Tab = 'upcoming' | 'past';

export default function CoachClassSessionsPage() {
  const { s } = useLang();
  const { id: classId } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const { user } = useAuth();
  // 仅管理路由(/coach·/admin)才允许编辑 · 学员路由 /class/:id/sessions 一律只读
  // 防 admin 从学员 URL 进入也看到新建/编辑/删除（三端分离铁律）
  const isManageRoute = pathname.startsWith('/coach') || pathname.startsWith('/admin');
  const [tab, setTab] = useState<Tab>('upcoming');
  const [editing, setEditing] = useState<ClassSession | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const list = useClassSessions(classId, { past: tab === 'past' });
  const detail = useClassDetail(classId || null);
  const myRole = user && detail.data
    ? detail.data.members.find((m) => m.user.id === user.id)?.role
    : undefined;
  const canEdit = isManageRoute && (myRole === 'coach' || user?.role === 'admin');
  const backTo = canEdit ? '/coach/classes' : `/class/${encodeURIComponent(classId || '')}`;

  return (
    <div>
      <TopNav
        titles={['共修安排', '共修安排', 'Sessions']}
        backTo={backTo}
        right={canEdit ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn btn-primary btn-pill"
            style={{ padding: '6px 14px', font: 'var(--text-caption)' }}
          >
            + {s('新建', '新建', 'New')}
          </button>
        ) : undefined}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-light)' }}>
        {(['upcoming', 'past'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--saffron-dark)' : '2px solid transparent',
              color: tab === t ? 'var(--saffron-dark)' : 'var(--ink-3)',
              fontWeight: tab === t ? 700 : 400,
              cursor: 'pointer',
              letterSpacing: 2,
              font: 'var(--text-body)',
            }}
          >
            {t === 'upcoming' ? s('即将', '即將', 'Upcoming') : s('历史', '歷史', 'Past')}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <Skeleton.List />
      ) : (list.data ?? []).length === 0 ? (
        <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-5) 0' }}>
          {tab === 'upcoming'
            ? (canEdit
                ? s('暂无未来共修 · 点右上「+」新建', '暫無未來共修', 'No upcoming sessions')
                : s('暂无未来共修', '暫無未來共修', 'No upcoming sessions'))
            : s('暂无历史共修', '暫無歷史共修', 'No past sessions')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {(list.data ?? []).map((sess) => (
            <SessionRow
              key={sess.id}
              session={sess}
              onEdit={() => setEditing(sess)}
              classId={classId!}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {/* 创建弹层 · 仅 coach */}
      {canEdit && (
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s('新建共修', '新建共修', 'New session')}>
          <SessionForm
            classId={classId!}
            onDone={() => setCreateOpen(false)}
          />
        </Dialog>
      )}

      {/* 编辑弹层 · 仅 coach */}
      {canEdit && (
        <Dialog open={!!editing} onClose={() => setEditing(null)} title={s('编辑共修', '編輯共修', 'Edit session')}>
          {editing && (
            <SessionForm
              classId={classId!}
              session={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </Dialog>
      )}
      </div>
    </div>
  );
}

function SessionRow({ session, onEdit, classId, canEdit }: { session: ClassSession; onEdit: () => void; classId: string; canEdit: boolean }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.del(`/api/coach/sessions/${encodeURIComponent(session.id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/coach/classes', classId, 'sessions'] });
      toast.ok(s('已删除', '已刪除', 'Deleted'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const start = new Date(session.startAt);
  const end = new Date(start.getTime() + session.durationMin * 60_000);
  const sameDay = start.toDateString() === end.toDateString();
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateFmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });

  return (
    <div
      className="glass-card-thick"
      style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', flex: 1 }}>
          {session.title}
        </h3>
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
          {dateFmt(start)}
        </span>
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
        ⏰ {timeFmt(start)} – {sameDay ? timeFmt(end) : dateFmt(end) + ' ' + timeFmt(end)}
        <span style={{ color: 'var(--ink-4)', marginLeft: 8 }}>· {session.durationMin} 分钟</span>
      </div>
      {session.description && (
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {session.description}
        </p>
      )}
      {session.liveLink && (
        <a
          href={session.liveLink}
          target="_blank"
          rel="noreferrer"
          style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          🔗 {session.liveLink}
        </a>
      )}
      {canEdit && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button
            type="button"
            onClick={onEdit}
            className="btn btn-pill"
            style={{ padding: '4px 12px', font: 'var(--text-caption)' }}
          >
            {s('编辑', '編輯', 'Edit')}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await confirmAsync({
                title: s('删除共修？', '刪除共修？', 'Delete?'),
                body: s('删除后已发出的推送会自动停止 · 已通知历史保留', '', 'Pushes will stop · history preserved'),
                danger: true,
                okLabel: '删除',
              })) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
            className="btn btn-pill"
            style={{ padding: '4px 12px', font: 'var(--text-caption)', background: 'transparent', border: '1px solid var(--crimson)', color: 'var(--crimson)' }}
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

function SessionForm({ classId, session, onDone }: {
  classId: string;
  session?: ClassSession;
  onDone: () => void;
}) {
  const { s } = useLang();
  const qc = useQueryClient();
  const isEdit = !!session;

  // datetime-local 期望 "YYYY-MM-DDTHH:mm" 本地时区
  const initStart = useMemo(() => {
    if (session) {
      const d = new Date(session.startAt);
      return formatLocalDatetime(d);
    }
    // 默认：今天 + 1 小时 · 整点
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return formatLocalDatetime(d);
  }, [session]);

  const [title, setTitle] = useState(session?.title ?? '');
  const [description, setDescription] = useState(session?.description ?? '');
  const [startLocal, setStartLocal] = useState(initStart);
  const [durationMin, setDurationMin] = useState(String(session?.durationMin ?? 60));
  const [liveLink, setLiveLink] = useState(session?.liveLink ?? '');
  const [err, setErr] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        startAt: new Date(startLocal).toISOString(),
        durationMin: Number(durationMin) || 60,
        liveLink: liveLink.trim() || null,
      };
      if (isEdit) {
        return api.patch<ClassSession>(`/api/coach/sessions/${encodeURIComponent(session!.id)}`, body);
      }
      return api.post<ClassSession>(`/api/coach/classes/${encodeURIComponent(classId)}/sessions`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/coach/classes', classId, 'sessions'] });
      toast.ok(isEdit ? s('已保存', '已保存', 'Saved') : s('已创建', '已創建', 'Created'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr('');
        if (!title.trim()) {
          setErr('标题必填');
          return;
        }
        save.mutate();
      }}
      style={{ padding: 'var(--sp-2) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
      <Field
        label={s('标题', '標題', 'Title')}
        value={title}
        onChange={setTitle}
        required
        maxLength={80}
        placeholder={s('如：周三晚共修', '如：週三晚共修', 'e.g., Wed evening practice')}
      />
      <Field
        label={s('开始时间', '開始時間', 'Start time')}
        value={startLocal}
        onChange={setStartLocal}
        type="datetime-local"
        required
      />
      <Field
        label={s('时长（分钟）', '時長（分鐘）', 'Duration (min)')}
        value={durationMin}
        onChange={setDurationMin}
        type="number"
        min={1}
        max={24 * 60}
      />
      <Field
        label={s('直播链接（可选）', '直播連結（可選）', 'Live link (opt)')}
        value={liveLink}
        onChange={setLiveLink}
        placeholder="https://meet..."
        maxLength={500}
      />
      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
          {s('描述（可选）', '描述（可選）', 'Description (opt)')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 'var(--r)',
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--ink)',
            font: 'var(--text-body)',
            letterSpacing: '.5px',
            outline: 'none',
            resize: 'vertical',
          }}
        />
      </div>

      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onDone}
          className="btn btn-pill"
          style={{ padding: '8px 16px' }}
        >
          {s('取消', '取消', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="btn btn-primary btn-pill"
          style={{ padding: '8px 16px' }}
        >
          {save.isPending
            ? s('保存中…', '保存中…', 'Saving…')
            : isEdit
            ? s('保存', '保存', 'Save')
            : s('创建', '創建', 'Create')}
        </button>
      </div>
    </form>
  );
}

// "YYYY-MM-DDTHH:mm" 本地时区 · 用于 <input type="datetime-local">
function formatLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
