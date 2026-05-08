// 观修管理共享组件
//   - MeditationMetaForm · 元数据表单（无 LessonPicker · 由调用方控制 lessonId 上下文）
//   - VideoUploadCard / SlidesUploadCard · 上传 + 进度 + 替换 / 删除
//   - MeditationFullEditor · 三件套组合（在 AdminCoursesPage 课时插槽 / AdminMeditationsPage 详情都用）
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Field from './Field';
import { confirmAsync } from './ConfirmDialog';
import { api, ApiError, uploadWithProgress } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import type { AdminMeditation } from '@/lib/queries';
import { toast } from '@/lib/toast';

interface Props {
  m: AdminMeditation;
  /** 归档成功回调 · 调用方决定后续行为（清空 selection / 关闭 inline editor 等） */
  onArchived?: () => void;
  /** 是否隐藏「关联课时」字段（在 LessonRow 内嵌时不展示）· 默认 false */
  hideLessonPicker?: boolean;
}

export function MeditationFullEditor(props: Props) {
  return (
    <>
      <MeditationMetaForm {...props} />
      <VideoUploadCard m={props.m} />
      <SlidesUploadCard m={props.m} />
    </>
  );
}

// ── 元数据表单 ────────────────────────────────────────────
export function MeditationMetaForm({ m, onArchived }: Props) {
  const { s } = useLang();
  const qc = useQueryClient();

  const [title, setTitle] = useState(m.title);
  const [titleTC, setTitleTC] = useState(m.titleTraditional ?? '');
  const [description, setDescription] = useState(m.description ?? '');
  const [authorName, setAuthorName] = useState(m.authorName ?? '');
  const [order, setOrder] = useState(m.displayOrder);
  const [published, setPublished] = useState(m.isPublished);

  const save = useMutation({
    mutationFn: () => api.patch(`/api/admin/meditations/${encodeURIComponent(m.id)}`, {
      title: title.trim(),
      titleTraditional: titleTC.trim() || null,
      description: description.trim() || null,
      authorName: authorName.trim() || null,
      displayOrder: order,
      isPublished: published,
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
      onArchived?.();
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-3)' }}>
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
          <TextArea label={s('简介', '簡介', 'Description')} value={description} onChange={setDescription} rows={3} maxLength={2000} />
        </div>
        <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          {s('已发布（学员可见）', '已發布（學員可見）', 'Published')}
        </label>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-2)' }}>
          <button
            type="button"
            onClick={async () => {
              if (!(await confirmAsync({ title: s('归档此观修？学员将不再能访问。', '歸檔此觀修？', 'Archive?') }))) return;
              archive.mutate();
            }}
            disabled={archive.isPending}
            className="btn btn-pill"
            style={{ padding: '8px 16px', background: 'transparent', color: 'var(--crimson)', border: '1px solid rgba(192,57,43,.3)' }}
          >
            {archive.isPending ? '…' : s('归档', '歸檔', 'Archive')}
          </button>
          <button type="submit" disabled={save.isPending} className="btn btn-primary btn-pill" style={{ padding: '8px 18px' }}>
            {save.isPending ? '…' : s('保存元数据', '保存元數據', 'Save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 视频上传卡 ──────────────────────────────────────────────────
export function VideoUploadCard({ m }: { m: AdminMeditation }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing'>('idle');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 500 * 1024 * 1024) {
      toast.error(s('视频超过 500 MB 上限', '視頻超過 500 MB', 'Video > 500 MB'));
      return;
    }
    if (!/\.(mp4|m4v|mov)$/i.test(file.name)) {
      const ok = await confirmAsync({ title: s(`后端只允许 mp4 · 当前是 "${file.name}" · 仍要上传？`, '只允許 mp4', `Only mp4 allowed · "${file.name}" · upload anyway?`) });
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
          if (pct >= 100) setPhase('processing');
        },
      });
      qc.invalidateQueries({ queryKey: ['/api/admin/meditations'] });
      toast.ok(s('视频已上传', '視頻已上傳', 'Uploaded'));
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
    <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2, margin: 0 }}>
          🎥 {s('视频', '視頻', 'Video')}
        </h3>
        {hasVideo && (
          <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)' }}>
            {Math.floor(m.videoDurationSec / 60)}:{String(m.videoDurationSec % 60).padStart(2, '0')}
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
              : s('服务端处理中（ffmpeg + scp）…可能需要 1-2 分钟', '服務端處理中…', 'Server processing…')}
          </div>
          <div style={{ height: 8, background: 'var(--border-light)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: phase === 'uploading' ? `${progress ?? 0}%` : '100%',
              background: 'var(--saffron)',
              transition: 'width 200ms',
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
            {s('mp4 · ≤ 500 MB · 服务端会做 ffmpeg faststart 优化', 'mp4 · ≤ 500 MB', 'mp4 · ≤ 500 MB')}
          </div>
        </>
      )}
    </div>
  );
}

// ── PDF 上传卡 ────────────────────────────────────────────────
export function SlidesUploadCard({ m }: { m: AdminMeditation }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  // 阶段：upload 上传到服务器 / processing 服务器转换中（libreoffice + pdftoppm）
  const [phase, setPhase] = useState<'upload' | 'processing'>('upload');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 100 * 1024 * 1024) {
      toast.error(s('文件超过 100 MB 上限', '檔案超過 100 MB 上限', 'File > 100 MB'));
      return;
    }
    if (!/\.(pdf|ppt|pptx|key|odp)$/i.test(file.name)) {
      toast.error(s('请选择 PDF / PPT / PPTX / KEY / ODP 文件', '請選擇 PDF / PPT 檔案', 'Please select PDF/PPT'));
      return;
    }
    setUploading(true);
    setPhase('upload');
    setProgress(0);
    try {
      await uploadWithProgress(`/api/admin/meditations/${encodeURIComponent(m.id)}/upload-slides`, file, {
        fieldName: 'file',
        onProgress: (loaded, total) => {
          const pct = Math.round((loaded / total) * 100);
          setProgress(pct);
          // 上传到 100% · 服务器还在做 PPT→PDF→images 转换 · 切到 processing 阶段
          if (pct >= 100) setPhase('processing');
        },
      });
      qc.invalidateQueries({ queryKey: ['/api/admin/meditations'] });
      toast.ok(s('讲义已上传 · 学员可见', '講義已上傳 · 學員可見', 'Slides uploaded · visible to students'));
    } catch (err) {
      toast.error((err as ApiError).message || s('上传失败', '上傳失敗', 'Upload failed'));
    } finally {
      setUploading(false);
      setProgress(null);
      setPhase('upload');
    }
  }

  const remove = useMutation({
    mutationFn: () => api.del(`/api/admin/meditations/${encodeURIComponent(m.id)}/slides`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/meditations'] });
      toast.ok(s('讲义已删除', '講義已刪除', 'Deleted'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2, margin: 0 }}>
          📄 {s('讲义 PDF（可选）', '講義 PDF', 'Slides PDF')}
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
            {phase === 'upload'
              ? s(`上传中… ${progress ?? 0}%`, `上傳中… ${progress ?? 0}%`, `Uploading… ${progress ?? 0}%`)
              : s('服务器处理中… 转换 PDF / 生成图片（10-60s）', '伺服器處理中…', 'Processing on server… (10-60s)')}
          </div>
          <div style={{ height: 8, background: 'var(--border-light)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: phase === 'upload' ? `${progress ?? 0}%` : '100%',
              background: 'var(--saffron)',
              transition: 'width 200ms',
              animation: phase === 'processing' ? 'pulse 1.4s ease-in-out infinite' : undefined,
            }} />
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
            {m.slidesPdfUrl ? s('替换讲义', '替換講義', 'Replace') : s('上传讲义 (PDF/PPT)', '上傳講義 (PDF/PPT)', 'Upload (PDF/PPT)')}
          </button>
          {m.slidesPdfUrl && (
            <button
              type="button"
              onClick={async () => {
                if (!(await confirmAsync({ title: s('删除该 PDF？视频会保留。', '刪除該 PDF？', 'Delete PDF?') }))) return;
                remove.mutate();
              }}
              className="btn btn-pill"
              style={{ padding: '8px 16px', background: 'transparent', color: 'var(--crimson)', border: '1px solid rgba(192,57,43,.3)' }}
            >
              {s('删除', '刪除', 'Delete')}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf,.ppt,.pptx,.key,.odp,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
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
