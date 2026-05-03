// CourseImportDialog · /admin/courses 法本批量导入
//   两种入口：上传 PDF/DOCX · 抓取 URL
//   流程：input → preview tree → 选 mode（new 新建 / append 追加） → commit
//
// 后端：
//   POST /api/admin/courses/import-file/preview   (multipart) → preview
//   POST /api/admin/courses/import-url/preview    (json url)  → preview
//   POST /api/admin/courses/import-file/commit    (json)      → 落库
//
// 老 prototype 还有"批量 URL 模板"模式（{n} 替换 + from/to range）
// 这里只做单 URL · 模板模式可后续追加
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Dialog from './Dialog';
import Field from './Field';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { type AdminCourseRow } from '@/lib/queries';
import { toast } from '@/lib/toast';

export interface ImportPreviewLesson {
  title: string;
  referenceText?: string;
  teachingSummary?: string;
}
export interface ImportPreviewChapter {
  title: string;
  lessons: ImportPreviewLesson[];
}
interface PreviewResp {
  data: {
    chapters: ImportPreviewChapter[];
    sourceLabel?: string;
    detectedTitle?: string;
  };
}

interface CommitResp {
  data: {
    courseId: string;
    chapterCount: number;
    lessonCount: number;
  };
}

type Stage = 'idle' | 'previewing' | 'preview' | 'committing';
type Source = 'file' | 'url';
type Mode = 'new' | 'append';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 现有法本列表 · 用于 append 模式选目标 */
  courses: AdminCourseRow[];
  /** commit 成功后 · 父组件刷新列表用 */
  onCommitted?: (courseId: string) => void;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'imported-' + Date.now().toString(36);
}

export default function CourseImportDialog({ open, onClose, courses, onCommitted }: Props) {
  const { s } = useLang();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<Source>('file');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string>('');

  // 输入
  const [url, setUrl] = useState('');

  // 预览
  const [preview, setPreview] = useState<PreviewResp['data'] | null>(null);
  const [sourceFilename, setSourceFilename] = useState<string>('');

  // commit 表单
  const [mode, setMode] = useState<Mode>('new');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('🪷');
  const [newAuthor, setNewAuthor] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [clientToken] = useState(() => uuid());

  function reset() {
    setStage('idle');
    setError('');
    setUrl('');
    setPreview(null);
    setSourceFilename('');
    setMode('new');
    setTargetCourseId('');
    setNewSlug('');
    setNewTitle('');
    setNewEmoji('🪷');
    setNewAuthor('');
    setNewDescription('');
  }

  function close() {
    reset();
    onClose();
  }

  // ── 预览 ───────────────────────────────────────────
  async function previewFromFile(file: File) {
    setStage('previewing');
    setError('');
    setSourceFilename(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/courses/import-file/preview', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${res.status}`);
      }
      const json = await res.json() as PreviewResp;
      acceptPreview(json.data, file.name.replace(/\.(pdf|docx)$/i, ''));
    } catch (e) {
      setError((e as Error).message || s('解析失败', '解析失敗', 'Parse failed'));
      setStage('idle');
    }
  }

  async function previewFromUrl() {
    if (!/^https?:\/\//i.test(url.trim())) {
      setError(s('请输入合法 URL', '請輸入合法 URL', 'Enter a valid URL'));
      return;
    }
    setStage('previewing');
    setError('');
    setSourceFilename('');
    try {
      const json = await api.post<PreviewResp>('/api/admin/courses/import-url/preview', { url: url.trim() });
      let derivedTitle = '';
      try {
        derivedTitle = new URL(url.trim()).hostname;
      } catch { /* ignore */ }
      acceptPreview(json.data, derivedTitle);
    } catch (e) {
      setError((e as ApiError).message || s('抓取失败', '抓取失敗', 'Fetch failed'));
      setStage('idle');
    }
  }

  function acceptPreview(data: PreviewResp['data'], fallbackTitle: string) {
    setPreview(data);
    const title = data.detectedTitle || fallbackTitle || '';
    setNewTitle(title);
    setNewSlug(slugify(title));
    setStage('preview');
  }

  // ── 提交 ───────────────────────────────────────────
  const commit = useMutation<CommitResp, ApiError>({
    mutationFn: () => {
      if (!preview) throw new ApiError('No preview', 0);
      const body: Record<string, unknown> = {
        mode,
        chapters: preview.chapters,
        clientToken,
      };
      if (mode === 'new') {
        body.newCourse = {
          slug: newSlug.trim(),
          title: newTitle.trim(),
          coverEmoji: newEmoji.trim() || '🪷',
          author: newAuthor.trim() || undefined,
          description: newDescription.trim() || undefined,
        };
      } else {
        body.courseId = targetCourseId;
      }
      return api.post<CommitResp>('/api/admin/courses/import-file/commit', body);
    },
    onMutate: () => setStage('committing'),
    onSuccess: (json) => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/courses', json.data.courseId] });
      toast.ok(s(
        `已导入 ${json.data.chapterCount} 章 / ${json.data.lessonCount} 课`,
        `已導入 ${json.data.chapterCount} 章 / ${json.data.lessonCount} 課`,
        `Imported ${json.data.chapterCount} chapters / ${json.data.lessonCount} lessons`,
      ));
      onCommitted?.(json.data.courseId);
      close();
    },
    onError: (e) => {
      setError(e.message);
      setStage('preview');
    },
  });

  // ── 摘要 ───────────────────────────────────────────
  const summary = useMemo(() => {
    if (!preview) return null;
    const ch = preview.chapters.length;
    const le = preview.chapters.reduce((a, b) => a + b.lessons.length, 0);
    return { ch, le };
  }, [preview]);

  function canCommit(): boolean {
    if (!preview) return false;
    if (mode === 'append') return !!targetCourseId;
    return !!newSlug.trim() && !!newTitle.trim();
  }

  return (
    <Dialog open={open} onClose={close} title={s('导入法本', '導入法本', 'Import text')}>
      <div style={{ padding: 'var(--sp-2) 0 var(--sp-3)' }}>
        {/* tab 切换 · 仅 idle 阶段显示 */}
        {stage === 'idle' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--sp-4)' }}>
              <TabBtn active={source === 'file'} onClick={() => setSource('file')}>
                📄 {s('上传文件', '上傳檔案', 'Upload file')}
              </TabBtn>
              <TabBtn active={source === 'url'} onClick={() => setSource('url')}>
                🌐 {s('网页 URL', '網頁 URL', 'Web URL')}
              </TabBtn>
            </div>
            {source === 'file' ? (
              <div style={{ padding: 'var(--sp-5)', border: '2px dashed var(--glass-border)', borderRadius: 'var(--r-lg)', textAlign: 'center' }}>
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 'var(--sp-3)' }}>
                  {s('支持 PDF / DOCX · 上限 20 MB', '支持 PDF / DOCX · 上限 20 MB', 'PDF / DOCX · 20 MB max')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) previewFromFile(f);
                  }}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-primary btn-pill"
                  style={{ padding: '8px 18px' }}
                >
                  {s('选择文件', '選擇檔案', 'Choose file')}
                </button>
              </div>
            ) : (
              <div>
                <Field
                  label={s('网页地址', '網頁地址', 'URL')}
                  type="url"
                  value={url}
                  onChange={setUrl}
                  placeholder="https://..."
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={previewFromUrl}
                  disabled={!url.trim()}
                  className="btn btn-primary btn-pill"
                  style={{ marginTop: 'var(--sp-3)', padding: '8px 18px', width: '100%', justifyContent: 'center' }}
                >
                  {s('抓取并预览', '抓取並預覽', 'Fetch & preview')}
                </button>
              </div>
            )}
          </>
        )}

        {/* 解析中 */}
        {stage === 'previewing' && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-6)', color: 'var(--ink-3)' }}>
            <p style={{ font: 'var(--text-body)', letterSpacing: 1, marginBottom: 6 }}>
              {s('解析中…', '解析中…', 'Parsing…')}
            </p>
            <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
              {sourceFilename || url}
            </p>
          </div>
        )}

        {/* 预览 + 提交表单 */}
        {(stage === 'preview' || stage === 'committing') && preview && summary && (
          <div>
            <div
              className="glass-card"
              style={{
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'var(--sage-light)',
                border: '1px solid var(--sage)',
                borderRadius: 'var(--r-md)',
                marginBottom: 'var(--sp-3)',
              }}
            >
              <p style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
                ✓ {s('解析成功', '解析成功', 'Parsed')}
              </p>
              <p style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: 1 }}>
                {s(`${summary.ch} 章 / ${summary.le} 课`, `${summary.ch} 章 / ${summary.le} 課`, `${summary.ch} chapters / ${summary.le} lessons`)}
              </p>
            </div>

            {/* 章节预览（前 5 章可见） */}
            <details style={{ marginBottom: 'var(--sp-3)' }}>
              <summary style={{ cursor: 'pointer', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, padding: 'var(--sp-2) 0' }}>
                {s('查看章节预览', '查看章節預覽', 'View chapter preview')}
              </summary>
              <div style={{ maxHeight: 200, overflowY: 'auto', padding: 'var(--sp-2)', background: 'var(--glass)', borderRadius: 'var(--r-sm)', marginTop: 6 }}>
                {preview.chapters.slice(0, 8).map((ch, i) => (
                  <div key={i} style={{ marginBottom: 6, font: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.5px' }}>
                    <strong>{i + 1}. {ch.title}</strong>
                    <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>· {ch.lessons.length} 课</span>
                  </div>
                ))}
                {preview.chapters.length > 8 && (
                  <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
                    {s(`… 另 ${preview.chapters.length - 8} 章`, `… 另 ${preview.chapters.length - 8} 章`, `… ${preview.chapters.length - 8} more`)}
                  </p>
                )}
              </div>
            </details>

            {/* mode 选择 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--sp-3)' }}>
              <TabBtn active={mode === 'new'} onClick={() => setMode('new')}>
                {s('新建法本', '新建法本', 'New text')}
              </TabBtn>
              <TabBtn active={mode === 'append'} onClick={() => setMode('append')} disabled={courses.length === 0}>
                {s('追加到现有', '追加到現有', 'Append to existing')}
              </TabBtn>
            </div>

            {mode === 'new' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <Field
                  label={s('标题', '標題', 'Title')}
                  value={newTitle}
                  onChange={(v) => { setNewTitle(v); if (!newSlug) setNewSlug(slugify(v)); }}
                  required
                  maxLength={120}
                />
                <Field
                  label={s('Slug · URL 路径段', 'Slug · URL 路徑段', 'Slug · URL path')}
                  value={newSlug}
                  onChange={setNewSlug}
                  required
                  pattern="[a-z0-9-]+"
                  maxLength={80}
                />
                <Field
                  label={s('封面 emoji', '封面 emoji', 'Cover emoji')}
                  value={newEmoji}
                  onChange={setNewEmoji}
                  maxLength={4}
                />
                <Field
                  label={s('作者（可选）', '作者（可選）', 'Author (optional)')}
                  value={newAuthor}
                  onChange={setNewAuthor}
                  maxLength={120}
                />
                <Field
                  label={s('简介（可选）', '簡介（可選）', 'Description (optional)')}
                  value={newDescription}
                  onChange={setNewDescription}
                  maxLength={2000}
                />
              </div>
            ) : (
              <div>
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 6 }}>
                  {s('选择目标法本（章节会追加到末尾）', '選擇目標法本（章節會追加到末尾）', 'Pick a target text (chapters appended)')}
                </p>
                <select
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--ink)',
                    font: 'var(--text-body)',
                  }}
                >
                  <option value="">{s('请选择…', '請選擇…', 'Select…')}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.coverEmoji} {c.title} · {c.chapterCount}章
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p style={{ marginTop: 'var(--sp-3)', font: 'var(--text-caption)', color: 'var(--crimson)', letterSpacing: 1 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
              <button
                type="button"
                onClick={() => { setStage('idle'); setPreview(null); setError(''); }}
                disabled={stage === 'committing'}
                className="btn btn-pill"
                style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}
              >
                {s('返回', '返回', 'Back')}
              </button>
              <button
                type="button"
                onClick={() => commit.mutate()}
                disabled={!canCommit() || stage === 'committing'}
                className="btn btn-primary btn-pill"
                style={{ flex: 1.4, padding: 12, justifyContent: 'center' }}
              >
                {stage === 'committing'
                  ? s('提交中…', '提交中…', 'Submitting…')
                  : s('确认导入', '確認導入', 'Confirm import')}
              </button>
            </div>
          </div>
        )}

        {error && stage === 'idle' && (
          <p style={{ marginTop: 'var(--sp-3)', font: 'var(--text-caption)', color: 'var(--crimson)', letterSpacing: 1 }}>
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function TabBtn({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '8px 12px',
        borderRadius: 'var(--r-pill)',
        border: '1px solid ' + (active ? 'var(--saffron-light)' : 'var(--glass-border)'),
        background: active ? 'var(--saffron-pale)' : 'var(--glass-thick)',
        color: active ? 'var(--saffron-dark)' : disabled ? 'var(--ink-4)' : 'var(--ink-3)',
        font: 'var(--text-caption)',
        fontWeight: 600,
        letterSpacing: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
