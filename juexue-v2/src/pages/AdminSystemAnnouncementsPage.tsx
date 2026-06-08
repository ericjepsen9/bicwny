// AdminSystemAnnouncementsPage · /admin/system-announcements
//   admin 发布 / 编辑 / 撤回 系统公告
//   POST   /api/admin/system-announcements
//   GET    /api/admin/system-announcements?cursor&limit
//   PATCH  /api/admin/system-announcements/:id
//   POST   /api/admin/system-announcements/:id/revoke
//   发布后后端自动 dispatch 给所有 active 用户
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { confirmAsync } from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Skeleton from '@/components/Skeleton';

type Severity = 'normal' | 'urgent' | 'critical';

interface SystemAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  expiresAt: string;
  revokedAt: string | null;
  contentHash: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const SEVERITY_LABEL: Record<Severity, [string, string, string]> = {
  normal: ['普通', '普通', 'Normal'],
  urgent: ['重要', '重要', 'Urgent'],
  critical: ['紧急', '緊急', 'Critical'],
};

const SEVERITY_COLOR: Record<Severity, { bg: string; text: string; border: string }> = {
  normal: { bg: 'var(--glass)', text: 'var(--ink-3)', border: 'var(--border)' },
  urgent: { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D' },
  critical: { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
};

export default function AdminSystemAnnouncementsPage() {
  const { s } = useLang();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['/api/admin/system-announcements'],
    queryFn: () => api.get<SystemAnnouncement[]>('/api/admin/system-announcements?limit=50'),
  });

  // 创建表单状态
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<Severity>('normal');
  // 过期时间 · 默认 24h 后（spec §19.20）
  const defaultExpiry = useMemo(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16); // datetime-local 格式
  }, []);
  const [expiresAtLocal, setExpiresAtLocal] = useState(defaultExpiry);

  const create = useMutation({
    mutationFn: (input: { title: string; body: string; severity: Severity; expiresAt: string }) =>
      api.post('/api/admin/system-announcements', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/system-announcements'] });
      setShowForm(false);
      setTitle('');
      setBody('');
      setSeverity('normal');
      setExpiresAtLocal(defaultExpiry);
      toast.ok(s('已发布并通知所有用户', '已發布並通知所有用戶', 'Published'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/system-announcements/${encodeURIComponent(id)}/revoke`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/system-announcements'] });
      toast.ok(s('已撤回', '已撤回', 'Revoked'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  function submit() {
    if (!title.trim()) return toast.error(s('标题必填', '標題必填', 'Title required'));
    if (!body.trim()) return toast.error(s('内容必填', '內容必填', 'Body required'));
    create.mutate({
      title: title.trim(),
      body: body.trim(),
      severity,
      // datetime-local → ISO
      expiresAt: new Date(expiresAtLocal).toISOString(),
    });
  }

  async function onRevoke(a: SystemAnnouncement) {
    const ok = await confirmAsync({
      title: s('撤回此公告？', '撤回此公告？', 'Revoke?'),
      body: s('撤回后已发通知会在用户端置灰 · 不会发新通知', '撤回後已發通知會在用戶端置灰 · 不會發新通知', 'Revoked notifications will be greyed out'),
      okLabel: s('撤回', '撤回', 'Revoke'),
      danger: true,
    });
    if (ok) revoke.mutate(a.id);
  }

  const items = list.data ?? [];

  return (
    <div style={{ padding: 'var(--sp-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h1 style={{ font: 'var(--text-h1)', color: 'var(--ink)', margin: 0, flex: 1 }}>
          {s('系统公告', '系統公告', 'System Announcements')}
        </h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '8px 14px',
            background: showForm ? 'var(--glass)' : 'var(--saffron)',
            color: showForm ? 'var(--ink)' : '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            font: 'var(--text-body)',
            letterSpacing: 1,
          }}
        >
          {showForm
            ? s('取消', '取消', 'Cancel')
            : s('+ 新建公告', '+ 新建公告', '+ New')}
        </button>
      </div>

      {/* 创建表单 */}
      {showForm && (
        <div
          className="glass-card-thick"
          style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}
        >
          <Field label={s('标题', '標題', 'Title')}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              style={inputStyle}
              placeholder={s('简明扼要 · ≤ 100 字', '簡明扼要 · ≤ 100 字', 'Concise · ≤ 100 chars')}
            />
          </Field>
          <Field label={s('内容', '內容', 'Body')}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder={s('详细说明 · ≤ 5000 字 · 支持换行', '詳細說明 · ≤ 5000 字 · 支援換行', 'Detail · ≤ 5000 chars')}
            />
          </Field>
          <Field label={s('级别', '級別', 'Severity')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['normal', 'urgent', 'critical'] as Severity[]).map((sv) => (
                <button
                  key={sv}
                  type="button"
                  onClick={() => setSeverity(sv)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid ' + (severity === sv ? SEVERITY_COLOR[sv].border : 'var(--border)'),
                    background: severity === sv ? SEVERITY_COLOR[sv].bg : 'transparent',
                    color: severity === sv ? SEVERITY_COLOR[sv].text : 'var(--ink-3)',
                    cursor: 'pointer',
                    font: 'var(--text-body)',
                    fontWeight: severity === sv ? 600 : 400,
                  }}
                >
                  {s(...SEVERITY_LABEL[sv])}
                </button>
              ))}
            </div>
            {severity === 'critical' && (
              <div style={{ font: 'var(--text-caption)', color: '#DC2626', marginTop: 4 }}>
                {s('紧急公告会全平台 push · 即使用户关闭了 push 也会触达（v3 实现）', '緊急公告會全平台 push · 即使用戶關閉了 push 也會觸達（v3 實現）', 'Critical bypasses user push prefs (v3)')}
              </div>
            )}
          </Field>
          <Field label={s('失效时刻', '失效時刻', 'Expires at')}>
            <input
              type="datetime-local"
              value={expiresAtLocal}
              onChange={(e) => setExpiresAtLocal(e.target.value)}
              style={inputStyle}
            />
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
              {s('默认 24h 后失效 · 过期后从 active 列表移除', '默認 24h 後失效 · 過期後從 active 列表移除', 'Default +24h')}
            </div>
          </Field>
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending || !title.trim() || !body.trim()}
            style={{
              padding: '10px 20px',
              background: 'var(--saffron)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: create.isPending ? 'wait' : 'pointer',
              font: 'var(--text-body)',
              letterSpacing: 1,
              opacity: !title.trim() || !body.trim() ? 0.5 : 1,
            }}
          >
            {create.isPending
              ? s('发布中…', '發布中…', 'Publishing…')
              : s('发布并通知所有用户', '發布並通知所有用戶', 'Publish & notify all')}
          </button>
        </div>
      )}

      {/* 列表 */}
      {list.isLoading ? (
        <Skeleton.Card />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="📢" title={s('暂无公告', '暫無公告', 'No announcements')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {items.map((a) => {
            const isRevoked = !!a.revokedAt;
            const isExpired = new Date(a.expiresAt).getTime() < Date.now();
            const sc = SEVERITY_COLOR[a.severity];
            return (
              <div
                key={a.id}
                className="glass-card-thick"
                style={{
                  padding: 'var(--sp-4)',
                  opacity: isRevoked ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: sc.bg,
                      color: sc.text,
                      border: '1px solid ' + sc.border,
                      font: 'var(--text-caption)',
                      fontWeight: 600,
                    }}
                  >
                    {s(...SEVERITY_LABEL[a.severity])}
                  </span>
                  {isRevoked && (
                    <span style={chipStyle}>
                      {s('已撤回', '已撤回', 'Revoked')}
                    </span>
                  )}
                  {!isRevoked && isExpired && (
                    <span style={chipStyle}>
                      {s('已过期', '已過期', 'Expired')}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    font: 'var(--text-body)',
                    fontWeight: 700,
                    marginBottom: 4,
                    textDecoration: isRevoked ? 'line-through' : 'none',
                  }}
                >
                  {a.title}
                </div>
                <div
                  style={{
                    font: 'var(--text-body)',
                    color: 'var(--ink-2)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    marginBottom: 6,
                  }}
                >
                  {a.body}
                </div>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                  {s('失效：', '失效：', 'Expires:')}{new Date(a.expiresAt).toLocaleString()}
                </div>
                {!isRevoked && (
                  <div style={{ marginTop: 'var(--sp-3)' }}>
                    <button
                      type="button"
                      onClick={() => onRevoke(a)}
                      disabled={revoke.isPending}
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        color: '#DC2626',
                        border: '1px solid #FCA5A5',
                        borderRadius: 6,
                        cursor: 'pointer',
                        font: 'var(--text-caption)',
                        letterSpacing: 1,
                      }}
                    >
                      {s('撤回', '撤回', 'Revoke')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--sp-3)' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 4, letterSpacing: 1 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  font: 'var(--text-body)',
  color: 'var(--ink)',
  background: 'var(--bg-card)',
  boxSizing: 'border-box',
};

const chipStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 999,
  background: 'var(--glass)',
  color: 'var(--ink-3)',
  font: 'var(--text-caption)',
};
