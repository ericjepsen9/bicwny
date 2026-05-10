// 班级公告管理 · admin/coach 共用 /coach/classes/:id/announcements · /admin/classes/:id/announcements
//   - 列表（含归档）+ 新建/编辑/归档 + 图文（多图 ≤ 6 · 上传单图返回 URL）
//   - 简单 markdown body（textarea 直存 · 学员侧渲染换行）
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError, uploadWithProgress } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

interface Announcement {
  id: string;
  classId: string;
  authorId: string;
  title: string;
  body: string;
  imageUrls: string[] | null;
  pinnedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CoachClassAnnouncementsPage() {
  const { s } = useLang();
  const { id: classId } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const back = pathname.startsWith('/admin') ? '/admin/classes' : '/coach/classes';
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const prefillTitle = searchParams.get('title') ?? '';
  const prefillBody = searchParams.get('body') ?? '';

  // ?compose=1&title=xxx&body=yyy → 自动打开 composer
  useEffect(() => {
    if (searchParams.get('compose') === '1') {
      setCreateOpen(true);
      // 清掉 compose 标记 · 关闭 dialog 后不要再次自动打开
      const next = new URLSearchParams(searchParams);
      next.delete('compose');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useQuery({
    enabled: !!classId,
    queryKey: ['/api/coach/classes', classId, 'announcements'],
    queryFn: ({ signal }) => api.get<Announcement[]>(`/api/coach/classes/${encodeURIComponent(classId!)}/announcements`, { signal }),
  });

  return (
    <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <Link to={back} style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', textDecoration: 'none' }}>
        ← {s('返回班级', '返回班級', 'Back')}
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.3rem', letterSpacing: 2 }}>
          📢 {s('班级公告', '班級公告', 'Announcements')}
        </h1>
        <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '8px 16px' }}>
          + {s('发公告', '發公告', 'New')}
        </button>
      </div>

      {list.isLoading ? <Skeleton.List /> : (list.data ?? []).length === 0 ? (
        <p style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', textAlign: 'center', padding: 'var(--sp-5) 0' }}>
          {s('暂无公告', '暫無公告', 'No announcements')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {(list.data ?? []).map((a) => <Row key={a.id} a={a} onEdit={() => setEditing(a)} classId={classId!} />)}
        </div>
      )}

      {createOpen && classId && (
        <Dialog open onClose={() => setCreateOpen(false)} title={s('发新公告', '發新公告', 'New announcement')} variant="centered" width={720}>
          <Editor classId={classId} onDone={() => setCreateOpen(false)} initialTitle={prefillTitle} initialBody={prefillBody} />
        </Dialog>
      )}

      {editing && (
        <Dialog open onClose={() => setEditing(null)} title={s('编辑公告', '編輯公告', 'Edit announcement')} variant="centered" width={720}>
          <Editor classId={editing.classId} initial={editing} onDone={() => setEditing(null)} />
        </Dialog>
      )}
    </div>
  );
}

function Row({ a, onEdit, classId }: { a: Announcement; onEdit: () => void; classId: string }) {
  const { s } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const role = user?.role;
  const canEdit = role === 'admin' || a.authorId === user?.id;
  const archive = useMutation({
    mutationFn: () => api.patch(`/api/coach/announcements/${encodeURIComponent(a.id)}`, { archive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/coach/classes', classId, 'announcements'] });
      toast.ok(s('已归档', '已歸檔', 'Archived'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });
  const togglePin = useMutation({
    mutationFn: () => api.patch(`/api/coach/announcements/${encodeURIComponent(a.id)}`, { pinned: !a.pinnedAt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/coach/classes', classId, 'announcements'] }),
    onError: (e) => toast.error((e as ApiError).message),
  });
  const imgs = a.imageUrls ?? [];
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)', opacity: a.archivedAt ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        {a.pinnedAt && <span style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', fontWeight: 700 }}>📌</span>}
        <h3 style={{ flex: 1, fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 1.5, fontSize: '1.05rem' }}>
          {a.title}
        </h3>
        {a.archivedAt && <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{s('已归档', '已歸檔', 'Archived')}</span>}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginBottom: 6 }}>
        {new Date(a.createdAt).toLocaleString()}
      </div>
      <div style={{ font: 'var(--text-body)', color: 'var(--ink-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: imgs.length > 0 ? 8 : 0 }}>
        {a.body}
      </div>
      {imgs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {imgs.map((u, i) => (
            <img key={i} src={u} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--r-sm)' }} />
          ))}
        </div>
      )}
      {canEdit && !a.archivedAt && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => togglePin.mutate()} className="btn btn-pill" style={{ padding: '4px 10px', font: 'var(--text-caption)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)' }}>
            {a.pinnedAt ? s('取消置顶', '取消置頂', 'Unpin') : s('置顶', '置頂', 'Pin')}
          </button>
          <button type="button" onClick={onEdit} className="btn btn-pill" style={{ padding: '4px 10px', font: 'var(--text-caption)', background: 'var(--saffron-pale)', border: '1px solid var(--saffron-light)', color: 'var(--saffron-dark)' }}>
            {s('编辑', '編輯', 'Edit')}
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmAsync({ title: s(`归档「${a.title}」？`, `歸檔「${a.title}」？`, `Archive?`), danger: true, okLabel: s('归档', '歸檔', 'Archive') });
              if (ok) archive.mutate();
            }}
            disabled={archive.isPending}
            className="btn btn-pill"
            style={{ padding: '4px 10px', font: 'var(--text-caption)', background: 'transparent', border: '1px solid rgba(192,57,43,.3)', color: 'var(--crimson)' }}
          >
            {archive.isPending ? '…' : s('归档', '歸檔', 'Archive')}
          </button>
        </div>
      )}
    </div>
  );
}

function Editor({ classId, initial, onDone, initialTitle, initialBody }: { classId: string; initial?: Announcement; onDone: () => void; initialTitle?: string; initialBody?: string }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? initialTitle ?? '');
  const [body, setBody] = useState(initial?.body ?? initialBody ?? '');
  const [imageUrls, setImageUrls] = useState<string[]>(initial?.imageUrls ?? []);
  const [pinned, setPinned] = useState(!!initial?.pinnedAt);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initial;

  const submit = useMutation({
    mutationFn: () => isEdit
      ? api.patch(`/api/coach/announcements/${encodeURIComponent(initial!.id)}`, {
          title: title.trim(),
          body,
          imageUrls: imageUrls.length === 0 ? null : imageUrls,
          pinned,
        })
      : api.post(`/api/coach/classes/${encodeURIComponent(classId)}/announcements`, {
          title: title.trim(),
          body,
          imageUrls: imageUrls.length === 0 ? undefined : imageUrls,
          pinned,
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/coach/classes', classId, 'announcements'] });
      toast.ok(s(isEdit ? '已保存' : '已发布', isEdit ? '已保存' : '已發布', isEdit ? 'Saved' : 'Published'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  async function pickImage(file: File) {
    if (imageUrls.length >= 6) {
      setErr(s('最多 6 张图', '最多 6 張圖', 'Max 6 images'));
      return;
    }
    setUploading(true);
    setErr('');
    try {
      // uploadWithProgress 包装 File · 返回的 data 已剥外层 { data }
      const res = await uploadWithProgress<{ url: string }>('/api/coach/announcements/upload-image', file);
      setImageUrls((arr) => [...arr, res.url]);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setErr(''); if (!title.trim()) return; submit.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <Field label={s('标题', '標題', 'Title')} value={title} onChange={setTitle} required maxLength={80} placeholder={s('如：本周共修通知', '如：本週共修通知', 'e.g. Weekly notice')} />
      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
          {s('正文（≤ 5000 字 · 换行自动保留）', '正文', 'Body (≤5000 · newlines preserved)')}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={5000}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', font: 'var(--text-body)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', textAlign: 'right' }}>{body.length} / 5000</div>
      </div>

      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
          {s(`图片（${imageUrls.length} / 6）`, `圖片`, `Images (${imageUrls.length}/6)`)}
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {imageUrls.map((u, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={u} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--r-sm)' }} />
              <button
                type="button"
                onClick={() => setImageUrls(imageUrls.filter((_, idx) => idx !== i))}
                style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: 'var(--crimson)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}
              >×</button>
            </div>
          ))}
          {imageUrls.length < 6 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ width: 80, height: 80, borderRadius: 'var(--r-sm)', border: '1px dashed var(--saffron-light)', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)' }}
            >
              {uploading ? '…' : '+ 图'}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        {s('📌 置顶', '📌 置頂', '📌 Pin')}
      </label>

      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button type="button" onClick={onDone} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)' }}>
          {s('取消', '取消', 'Cancel')}
        </button>
        <button type="submit" disabled={submit.isPending || uploading || !title.trim()} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12 }}>
          {submit.isPending ? '…' : isEdit ? s('保存', '保存', 'Save') : s('发布', '發布', 'Publish')}
        </button>
      </div>
    </form>
  );
}
