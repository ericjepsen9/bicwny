// AdminMeditationsPage · /admin/meditations
//   两栏：左侧观修列表 + 右侧编辑器（metadata · 视频上传 · PDF 上传 · 归档）
//   v1 专注：把视频/PDF 投到 OSS · 元数据落库 · 学员侧再消费
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError, uploadWithProgress } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import {
  type AdminMeditation,
  useAdminCourses,
  useAdminCourseDetail,
  useAdminMeditationDetail,
  useAdminMeditations,
} from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function AdminMeditationsPage() {
  const { s } = useLang();
  const [sp, setSp] = useSearchParams();
  const list = useAdminMeditations({ includeArchived: false });
  const [createOpen, setCreateOpen] = useState(false);

  const medId = sp.get('id');
  const detail = useAdminMeditationDetail(medId);

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('观修管理', '觀修管理', 'Meditations')}</h1>
          <p className="page-sub">
            {list.data ? list.data.length + ' ' + s('个 · 含未发布', '個 · 含未發布', 'incl. unpublished') : '…'}
          </p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '8px 16px' }}>
          + {s('新建观修', '新建觀修', 'New meditation')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--sp-5)' }}>
        {/* 左：列表 */}
        <aside style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: 'calc(100vh - var(--sp-8))', overflowY: 'auto' }}>
          {list.isLoading ? (
            <Skeleton.List />
          ) : !list.data || list.data.length === 0 ? (
            <div style={{ padding: 'var(--sp-5)', color: 'var(--ink-3)', textAlign: 'center' }}>
              {s('暂无观修', '暫無觀修', 'None')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...list.data].sort((a, b) => a.displayOrder - b.displayOrder || (a.createdAt < b.createdAt ? 1 : -1)).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSp({ id: m.id })}
                  className="glass-card-thick"
                  style={{
                    padding: 'var(--sp-3) var(--sp-4)', textAlign: 'left',
                    border: m.id === medId ? '1px solid var(--saffron)' : '1px solid var(--glass-border)',
                    background: m.id === medId ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                    borderLeft: m.id === medId ? '4px solid var(--saffron)' : '1px solid var(--glass-border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <span style={{ fontSize: '1.6rem', width: 36, textAlign: 'center' }}>🧘</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)', letterSpacing: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                        <PubPill published={m.isPublished} />
                        <VideoPill hasVideo={!!m.videoUrl} sec={m.videoDurationSec} />
                        {m.slidesPdfUrl && <span style={{ color: 'var(--ink-3)' }}>· 📄</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* 右：编辑器 */}
        <section>
          {!medId ? (
            <EmptyHero />
          ) : detail.isLoading ? (
            <Skeleton.Card />
          ) : !detail.data ? (
            <p style={{ color: 'var(--crimson)' }}>{(detail.error as ApiError | undefined)?.message ?? '加载失败'}</p>
          ) : (
            <MeditationEditor key={detail.data.id} m={detail.data} />
          )}
        </section>
      </div>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s('新建观修', '新建觀修', 'New meditation')}>
        <CreateForm
          onCreated={(id) => { setCreateOpen(false); setSp({ id }); }}
          onCancel={() => setCreateOpen(false)}
        />
      </Dialog>
    </>
  );
}

function EmptyHero() {
  const { s } = useLang();
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-7)', textAlign: 'center', color: 'var(--ink-3)' }}>
      <div style={{ fontSize: '2.6rem', marginBottom: 'var(--sp-3)' }}>🧘</div>
      <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
        {s('← 选择左侧观修编辑，或点 +新建', '← 選擇左側觀修編輯，或點 +新建', '← Pick a meditation, or + New')}
      </p>
    </div>
  );
}

function PubPill({ published }: { published: boolean }) {
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 'var(--r-pill)',
      background: published ? 'rgba(125,154,108,.15)' : 'var(--border-light)',
      color: published ? 'var(--sage-dark)' : 'var(--ink-3)',
      font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1,
    }}>
      {published ? '✓pub' : '—草稿'}
    </span>
  );
}

function VideoPill({ hasVideo, sec }: { hasVideo: boolean; sec: number }) {
  if (!hasVideo) return <span style={{ color: 'var(--crimson)' }}>· 无视频</span>;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return <span style={{ color: 'var(--sage-dark)' }}>· 🎥 {m}:{String(s).padStart(2, '0')}</span>;
}

// ── 编辑器 ────────────────────────────────────────────────────────
function MeditationEditor({ m }: { m: AdminMeditation }) {
  const { s } = useLang();
  const [, setSp] = useSearchParams();
  const qc = useQueryClient();

  const [title, setTitle] = useState(m.title);
  const [titleTC, setTitleTC] = useState(m.titleTraditional ?? '');
  const [description, setDescription] = useState(m.description ?? '');
  const [authorName, setAuthorName] = useState(m.authorName ?? '');
  const [order, setOrder] = useState(m.displayOrder);
  const [published, setPublished] = useState(m.isPublished);
  const [lessonId, setLessonId] = useState(m.lessonId ?? '');

  const save = useMutation({
    mutationFn: () => api.patch(`/api/admin/meditations/${encodeURIComponent(m.id)}`, {
      title: title.trim(),
      titleTraditional: titleTC.trim() || null,
      description: description.trim() || null,
      authorName: authorName.trim() || null,
      displayOrder: order,
      isPublished: published,
      lessonId: lessonId.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/meditations'] });
      toast.ok(s('已保存', '已保存', 'Saved'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const archive = useMutation({
    mutationFn: () => api.del(`/api/admin/meditations/${encodeURIComponent(m.id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/meditations'] });
      toast.ok(s('已归档', '已歸檔', 'Archived'));
      setSp({});
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      {/* metadata card */}
      <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)' }}>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 'var(--sp-2)' }}>
          {s('元数据', '元數據', 'Metadata')}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}
        >
          <Field label={s('标题（简）', '標題（簡）', 'Title (SC)')} value={title} onChange={setTitle} required maxLength={120} />
          <Field label={s('标题（繁）', '標題（繁）', 'Title (TC)')} value={titleTC} onChange={setTitleTC} maxLength={120} />
          <Field label={s('讲者 / 上师', '講者 / 上師', 'Author')} value={authorName} onChange={setAuthorName} maxLength={120} />
          <Field label={s('显示顺序（小→前）', '顯示順序（小→前）', 'Order')} value={String(order)} onChange={(v) => setOrder(Number(v) || 0)} type="number" />
          <div style={{ gridColumn: '1 / -1' }}>
            <LessonPicker value={lessonId} onChange={setLessonId} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <TextArea label={s('简介', '簡介', 'Description')} value={description} onChange={setDescription} rows={3} maxLength={2000} />
          </div>
          <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            {s('已发布（学员可见）', '已發布（學員可見）', 'Published (visible to students)')}
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-2)' }}>
            <button
              type="button"
              onClick={async () => {
                if (!(await confirmAsync({ title: s('归档此观修？学员将不再能访问。', '歸檔此觀修？學員將不再能訪問。', 'Archive this meditation? Students lose access.') }))) return;
                archive.mutate();
              }}
              disabled={archive.isPending}
              className="btn btn-pill"
              style={{ padding: '8px 16px', background: 'transparent', color: 'var(--crimson)', border: '1px solid rgba(192,57,43,.3)' }}
            >
              {archive.isPending ? '…' : s('归档', '歸檔', 'Archive')}
            </button>
            <button type="submit" disabled={save.isPending} className="btn btn-primary btn-pill" style={{ padding: '8px 18px' }}>
              {save.isPending ? '…' : s('保存元数据', '保存元數據', 'Save metadata')}
            </button>
          </div>
        </form>
      </div>

      {/* 视频上传 */}
      <VideoUploadCard m={m} />

      {/* PDF 上传 */}
      <SlidesUploadCard m={m} />
    </>
  );
}

// ── 视频上传卡 ──────────────────────────────────────────────────────
function VideoUploadCard({ m }: { m: AdminMeditation }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing'>('idle');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // 允许同名再选

    if (file.size > 500 * 1024 * 1024) {
      toast.error(s('视频超过 500 MB 上限', '視頻超過 500 MB 上限', 'Video exceeds 500 MB'));
      return;
    }
    if (!/\.(mp4|m4v|mov)$/i.test(file.name)) {
      const ok = await confirmAsync({ title: s(`后端只允许 mp4 · 当前是 "${file.name}" · 仍要上传？`, '後端只允許 mp4 · 仍要上傳？', `Backend only accepts mp4 · file is "${file.name}" · upload anyway?`) });
      if (!ok) return;
    }

    setUploading(true);
    setPhase('uploading');
    setProgress(0);
    try {
      await uploadWithProgress(`/api/admin/meditations/${encodeURIComponent(m.id)}/upload-video`, file, {
        fieldName: 'file',
        onProgress: (loaded, total) => {
          const pct = Math.round((loaded / total) * 100);
          setProgress(pct);
          // 100% 之后服务端还在 ffmpeg + scp · 切到「处理中」状态
          if (pct >= 100) setPhase('processing');
        },
      });
      qc.invalidateQueries({ queryKey: ['/api/admin/meditations'] });
      toast.ok(s('视频已上传 · OSS 投递完成', '視頻已上傳 · OSS 投遞完成', 'Video uploaded'));
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setUploading(false);
      setPhase('idle');
      setProgress(null);
    }
  }

  const hasVideo = !!m.videoUrl;

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2 }}>
          🎥 {s('视频', '視頻', 'Video')}
        </h3>
        {hasVideo && (
          <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)' }}>
            {Math.floor(m.videoDurationSec / 60)}:{String(m.videoDurationSec % 60).padStart(2, '0')} · {m.videoDurationSec}s
          </span>
        )}
      </div>

      {hasVideo && (
        <video src={m.videoUrl} controls preload="metadata" style={{ width: '100%', maxHeight: 320, borderRadius: 'var(--r)', background: '#000', marginBottom: 'var(--sp-3)' }} />
      )}

      {uploading ? (
        <div style={{ padding: 'var(--sp-3)', background: 'var(--saffron-pale)', borderRadius: 'var(--r)' }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 6 }}>
            {phase === 'uploading'
              ? s(`上传中… ${progress ?? 0}%`, `上傳中… ${progress ?? 0}%`, `Uploading… ${progress ?? 0}%`)
              : s('服务端处理中（ffmpeg faststart · scp 到 OSS）…可能需要 1-2 分钟', '服務端處理中…', 'Server processing (ffmpeg + scp)…')}
          </div>
          <div style={{ height: 8, background: 'var(--border-light)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: phase === 'uploading' ? `${progress ?? 0}%` : '100%',
              background: 'var(--saffron)',
              transition: 'width 200ms',
              ...(phase === 'processing' ? { animation: 'pulse 1.6s ease-in-out infinite' } : {}),
            }} />
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn btn-pill"
            style={{ padding: '8px 16px', background: 'var(--glass-thick)', color: 'var(--ink-2)', border: '1px solid var(--glass-border)' }}
          >
            {hasVideo ? s('替换视频', '替換視頻', 'Replace video') : s('上传视频', '上傳視頻', 'Upload video')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/x-m4v,video/quicktime"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 8 }}>
            {s('mp4 · ≤ 500 MB · 上传后服务端会做 ffmpeg faststart 优化便于流式播放', 'mp4 · ≤ 500 MB', 'mp4 · ≤ 500 MB · server runs ffmpeg faststart')}
          </div>
        </>
      )}
    </div>
  );
}

// ── PDF 上传卡 ─────────────────────────────────────────────────────
function SlidesUploadCard({ m }: { m: AdminMeditation }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 30 * 1024 * 1024) {
      toast.error(s('PDF 超过 30 MB 上限', 'PDF 超過 30 MB 上限', 'PDF exceeds 30 MB'));
      return;
    }
    if (!/\.pdf$/i.test(file.name)) {
      toast.error(s('请选择 PDF 文件', '請選擇 PDF 文件', 'Please select a PDF'));
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      await uploadWithProgress(`/api/admin/meditations/${encodeURIComponent(m.id)}/upload-slides`, file, {
        fieldName: 'file',
        onProgress: (loaded, total) => setProgress(Math.round((loaded / total) * 100)),
      });
      qc.invalidateQueries({ queryKey: ['/api/admin/meditations'] });
      toast.ok(s('PDF 已上传', 'PDF 已上傳', 'PDF uploaded'));
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  const remove = useMutation({
    mutationFn: () => api.del(`/api/admin/meditations/${encodeURIComponent(m.id)}/slides`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/meditations'] });
      toast.ok(s('PDF 已删除', 'PDF 已刪除', 'PDF removed'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2 }}>
          📄 {s('讲义 PDF（可选）', '講義 PDF（可選）', 'Slides PDF (optional)')}
        </h3>
        {m.slidesPdfUrl && (
          <a href={m.slidesPdfUrl} target="_blank" rel="noreferrer" style={{ font: 'var(--text-caption)', color: 'var(--saffron)', letterSpacing: 1 }}>
            {s('查看', '查看', 'Open')} ↗
          </a>
        )}
      </div>

      {uploading ? (
        <div style={{ padding: 'var(--sp-3)', background: 'var(--saffron-pale)', borderRadius: 'var(--r)' }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 6 }}>
            {s(`上传中… ${progress ?? 0}%`, `上傳中… ${progress ?? 0}%`, `Uploading… ${progress ?? 0}%`)}
          </div>
          <div style={{ height: 8, background: 'var(--border-light)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress ?? 0}%`, background: 'var(--saffron)', transition: 'width 200ms' }} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn btn-pill"
            style={{ padding: '8px 16px', background: 'var(--glass-thick)', color: 'var(--ink-2)', border: '1px solid var(--glass-border)' }}
          >
            {m.slidesPdfUrl ? s('替换 PDF', '替換 PDF', 'Replace PDF') : s('上传 PDF', '上傳 PDF', 'Upload PDF')}
          </button>
          {m.slidesPdfUrl && (
            <button
              type="button"
              onClick={async () => {
                if (!(await confirmAsync({ title: s('删除该 PDF？视频会保留。', '刪除該 PDF？視頻會保留。', 'Delete PDF? Video kept.') }))) return;
                remove.mutate();
              }}
              className="btn btn-pill"
              style={{ padding: '8px 16px', background: 'transparent', color: 'var(--crimson)', border: '1px solid rgba(192,57,43,.3)' }}
            >
              {s('删除', '刪除', 'Delete')}
            </button>
          )}
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={handleFile} style={{ display: 'none' }} />
        </div>
      )}

      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 8 }}>
        {s('PDF · ≤ 30 MB · 学员播放页可在视频旁查看', 'PDF · ≤ 30 MB', 'PDF · ≤ 30 MB · shown alongside video on player page')}
      </div>
    </div>
  );
}

// ── 关联课时 picker ────────────────────────────────────────────────
function LessonPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { s } = useLang();
  const courses = useAdminCourses();
  const [courseId, setCourseId] = useState<string>('');
  const detail = useAdminCourseDetail(courseId || null);

  // 反查：value 已设置 → 找出其所属 course，自动选中
  useEffect(() => {
    if (!value || courseId || !courses.data) return;
    // 简化：暂不展开 · 用户改时自己挑
  }, [value, courseId, courses.data]);

  const lessons = detail.data?.chapters.flatMap((ch) => ch.lessons.map((l) => ({ ...l, chapterTitle: ch.title }))) ?? [];

  return (
    <div>
      <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
        {s('关联课时（可选 · 不填则为独立观修）', '關聯課時（可選）', 'Linked lesson (optional)')}
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)' }}
        >
          <option value="">{s('— 选法本 —', '— 選法本 —', '— Pick course —')}</option>
          {(courses.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!courseId || detail.isLoading}
          style={{ padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)' }}
        >
          <option value="">{s('— 不关联 —', '— 不關聯 —', '— None —')}</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>{l.chapterTitle} · {l.title}</option>
          ))}
        </select>
      </div>
      {value && !courseId && (
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 6 }}>
          {s('当前已关联一个课时（id=' + value.slice(-8) + '）· 选法本以查看 / 修改', '當前已關聯一個課時', `Currently linked to lessonId ${value.slice(-8)}`)}
        </div>
      )}
    </div>
  );
}

// ── 新建对话框 ──────────────────────────────────────────────────────
function CreateForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const { s } = useLang();
  const [title, setTitle] = useState('');
  const [titleTC, setTitleTC] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [lessonId, setLessonId] = useState('');

  const create = useMutation({
    mutationFn: () => api.post<AdminMeditation>('/api/admin/meditations', {
      title: title.trim(),
      titleTraditional: titleTC.trim() || null,
      authorName: authorName.trim() || null,
      lessonId: lessonId.trim() || null,
      isPublished: false,
    }),
    onSuccess: (m) => onCreated((m as AdminMeditation).id),
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
      <Field label={s('标题（简）', '標題（簡）', 'Title (SC)')} value={title} onChange={setTitle} required maxLength={120} />
      <Field label={s('标题（繁）', '標題（繁）', 'Title (TC)')} value={titleTC} onChange={setTitleTC} maxLength={120} />
      <Field label={s('讲者 / 上师', '講者 / 上師', 'Author')} value={authorName} onChange={setAuthorName} maxLength={120} />
      <LessonPicker value={lessonId} onChange={setLessonId} />
      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
        {s('创建后默认未发布 · 上传完视频再勾选「已发布」让学员可见。', '創建後默認未發布。', 'Created as draft · publish after uploading video.')}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel} className="btn btn-pill" style={{ padding: '8px 16px', background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
          {s('取消', '取消', 'Cancel')}
        </button>
        <button type="submit" disabled={!title.trim() || create.isPending} className="btn btn-primary btn-pill" style={{ padding: '8px 18px' }}>
          {create.isPending ? '…' : s('创建', '創建', 'Create')}
        </button>
      </div>
    </form>
  );
}

// ── 共用 TextArea ──────────────────────────────────────────────────
function TextArea({ label, value, onChange, rows = 3, maxLength }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <div>
      <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        style={{
          width: '100%', padding: '10px 12px',
          borderRadius: 'var(--r)', border: '1px solid var(--border)',
          background: 'var(--bg-input)', color: 'var(--ink)',
          font: 'var(--text-body)', letterSpacing: 1,
          resize: 'vertical', minHeight: 60, boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
