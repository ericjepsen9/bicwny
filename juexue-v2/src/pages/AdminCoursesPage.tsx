// AdminCoursesPage · /admin/courses
//   两栏：左侧法本列表 + 右侧编辑器（metadata · 章节 · 课时）
//   完整 3 级 CRUD：Course / Chapter / Lesson · 含封面图上传 / 删除
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import CourseImportDialog from '@/components/CourseImportDialog';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import {
  type AdminChapter,
  type AdminCourseDetail,
  type AdminLesson,
  useAdminCourseDetail,
  useAdminCourses,
} from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function AdminCoursesPage() {
  const { s } = useLang();
  const [sp, setSp] = useSearchParams();
  const list = useAdminCourses();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const courseId = sp.get('id');
  const detail = useAdminCourseDetail(courseId);

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('法本管理', '法本管理', 'Texts')}</h1>
          <p className="page-sub">
            {list.data ? list.data.length + ' ' + s('部 · 含未发布', '部 · 含未發布', 'incl. unpublished') : '…'}
          </p>
        </div>
        <div className="top-actions" style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="btn btn-pill"
            style={{ padding: '8px 14px', background: 'var(--glass-thick)', color: 'var(--ink-2)', border: '1px solid var(--glass-border)' }}
          >
            📥 {s('导入', '導入', 'Import')}
          </button>
          <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '8px 16px' }}>
            + {s('新建法本', '新建法本', 'New text')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--sp-5)' }}>
        {/* 左：法本列表 */}
        <aside style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: 'calc(100vh - var(--sp-8))', overflowY: 'auto' }}>
          {list.isLoading ? (
            <Skeleton.List />
          ) : !list.data || list.data.length === 0 ? (
            <div style={{ padding: 'var(--sp-5)', color: 'var(--ink-3)', textAlign: 'center' }}>
              {s('暂无法本', '暫無法本', 'None')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...list.data].sort((a, b) => a.displayOrder - b.displayOrder).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSp({ id: c.id })}
                  className="glass-card-thick"
                  style={{
                    padding: 'var(--sp-3) var(--sp-4)', textAlign: 'left',
                    border: c.id === courseId ? '1px solid var(--saffron)' : '1px solid var(--glass-border)',
                    background: c.id === courseId ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                    borderLeft: c.id === courseId ? '4px solid var(--saffron)' : '1px solid var(--glass-border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    {c.coverImageUrl ? (
                      <img src={c.coverImageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.6rem', width: 36, textAlign: 'center' }}>{c.coverEmoji}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--ink)', letterSpacing: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                        <PubPill published={c.isPublished} />
                        <span>· {c.chapterCount}章 / {c.lessonCount}课 · {c.enrollmentCount}人</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* 右：详情 */}
        <section>
          {!courseId ? (
            <EmptyHero />
          ) : detail.isLoading ? (
            <Skeleton.Card />
          ) : !detail.data ? (
            <p style={{ color: 'var(--crimson)' }}>{(detail.error as ApiError | undefined)?.message ?? '加载失败'}</p>
          ) : (
            <CourseEditor key={detail.data.id} c={detail.data} />
          )}
        </section>
      </div>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s('新建法本', '新建法本', 'New text')}>
        <CreateCourseForm
          onCreated={(id) => { setCreateOpen(false); setSp({ id }); }}
          onCancel={() => setCreateOpen(false)}
        />
      </Dialog>
      <CourseImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        courses={list.data ?? []}
        onCommitted={(id) => setSp({ id })}
      />
    </>
  );
}

function EmptyHero() {
  const { s } = useLang();
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-7)', textAlign: 'center', color: 'var(--ink-3)' }}>
      <div style={{ fontSize: '2.6rem', marginBottom: 'var(--sp-3)' }}>📿</div>
      <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
        {s('← 选择左侧法本查看 / 编辑，或点 +新建', '← 選擇左側法本查看 / 編輯，或點 +新建', '← Pick a text on the left, or + New text')}
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

// ── Course 编辑器（metadata + 封面 + 章节 + 删除） ─────────────────────────────
function CourseEditor({ c }: { c: AdminCourseDetail }) {
  const { s } = useLang();
  const [, setSp] = useSearchParams();
  const qc = useQueryClient();

  // metadata 状态（受控 · 用 key 重置）
  const [slug, setSlug] = useState(c.slug);
  const [title, setTitle] = useState(c.title);
  const [titleTC, setTitleTC] = useState(c.titleTraditional ?? '');
  const [author, setAuthor] = useState(c.author ?? '');
  const [description, setDescription] = useState(c.description ?? '');
  const [authorInfo, setAuthorInfo] = useState(c.authorInfo ?? '');
  const [emoji, setEmoji] = useState(c.coverEmoji);
  const [order, setOrder] = useState(c.displayOrder);
  const [published, setPublished] = useState(c.isPublished);
  const [license, setLicense] = useState(c.licenseInfo ?? '');

  const save = useMutation({
    mutationFn: () => api.patch(`/api/admin/courses/${encodeURIComponent(c.id)}`, {
      slug: slug.trim(),
      title: title.trim(),
      titleTraditional: titleTC.trim() || null,
      author: author.trim() || null,
      description: description.trim() || null,
      authorInfo: authorInfo.trim() || null,
      coverEmoji: emoji.trim() || c.coverEmoji,
      displayOrder: order,
      isPublished: published,
      licenseInfo: license.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      toast.ok(s('已保存', '已保存', 'Saved'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const del = useMutation({
    mutationFn: () => api.del(`/api/admin/courses/${encodeURIComponent(c.id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      toast.ok(s('已归档', '已歸檔', 'Archived'));
      setSp({});
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      {/* metadata card */}
      <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
          <CoverEditor courseId={c.id} url={c.coverImageUrl} emoji={c.coverEmoji} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
              {s('元数据', '元數據', 'Metadata')}
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)', letterSpacing: 2, marginTop: 2 }}>
              {title || s('（无标题）', '（無標題）', '(no title)')}
            </h2>
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}
        >
          <Field label={s('标题（简）', '標題（簡）', 'Title (SC)')} value={title} onChange={setTitle} required maxLength={120} />
          <Field label={s('标题（繁）', '標題（繁）', 'Title (TC)')} value={titleTC} onChange={setTitleTC} maxLength={120} />
          <Field label={s('Slug · URL 用', 'Slug · URL 用', 'Slug')} value={slug} onChange={setSlug} required pattern="[a-z0-9-]+" maxLength={80} />
          <Field label={s('作者 / 译者', '作者 / 譯者', 'Author')} value={author} onChange={setAuthor} maxLength={120} />
          <div style={{ gridColumn: '1 / -1' }}>
            <TextArea label={s('简介', '簡介', 'Description')} value={description} onChange={setDescription} rows={3} maxLength={2000} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <TextArea label={s('作者介绍', '作者介紹', 'Author info')} value={authorInfo} onChange={setAuthorInfo} rows={3} maxLength={2000} />
          </div>
          <Field label={s('封面 emoji', '封面 emoji', 'Emoji')} value={emoji} onChange={setEmoji} maxLength={8} />
          <Field label={s('显示顺序（小→前）', '顯示順序（小→前）', 'Order')} value={String(order)} onChange={(v) => setOrder(Number(v) || 0)} type="number" />
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label={s('版权', '版權', 'License')} value={license} onChange={setLicense} maxLength={500} />
          </div>
          <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            {s('已发布（学员可见）', '已發布（學員可見）', 'Published (visible to students)')}
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-2)' }}>
            <button
              type="button"
              onClick={() => {
                if (!confirm(s('归档此法本？学员不再能访问（可通过未发布恢复展示）', '歸檔此法本？學員不再能訪問', 'Archive this text? Students lose access.'))) return;
                del.mutate();
              }}
              disabled={del.isPending}
              className="btn btn-pill"
              style={{ padding: '8px 16px', background: 'transparent', color: 'var(--crimson)', border: '1px solid rgba(192,57,43,.3)' }}
            >
              {del.isPending ? '…' : s('归档', '歸檔', 'Archive')}
            </button>
            <button type="submit" disabled={save.isPending} className="btn btn-primary btn-pill" style={{ padding: '8px 18px' }}>
              {save.isPending ? '…' : s('保存元数据', '保存元數據', 'Save metadata')}
            </button>
          </div>
        </form>
      </div>

      {/* 章节区 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2 }}>
          {s('章节', '章節', 'Chapters')} ({c.chapters.length})
        </h2>
        <AddChapterButton courseId={c.id} nextOrder={(c.chapters.at(-1)?.order ?? 0) + 1} />
      </div>

      {c.chapters.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)' }}>
          {s('还没有章节 · 点击 +新章节', '還沒有章節 · 點擊 +新章節', 'No chapters yet')}
        </div>
      ) : (
        [...c.chapters].sort((a, b) => a.order - b.order).map((ch) => <ChapterCard key={ch.id} ch={ch} />)
      )}
    </>
  );
}

// ── 封面编辑（上传 + 删除）
function CoverEditor({ courseId, url, emoji }: { courseId: string; url: string | null; emoji: string }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/api/admin/courses/${encodeURIComponent(courseId)}/cover`, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses', courseId] });
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      qc.invalidateQueries({ queryKey: ['/api/courses'] });
      toast.ok(s('封面已上传', '封面已上傳', 'Uploaded'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/api/admin/courses/${encodeURIComponent(courseId)}/cover`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses', courseId] });
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      qc.invalidateQueries({ queryKey: ['/api/courses'] });
      toast.ok(s('封面已移除', '封面已移除', 'Removed'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        title={s('点击上传封面图（≤2MB · jpg/png/webp）', '點擊上傳封面圖（≤2MB · jpg/png/webp）', 'Click to upload cover (≤2MB jpg/png/webp)')}
        style={{
          width: 80, height: 80, borderRadius: 'var(--r-md)',
          background: url ? 'transparent' : 'var(--saffron-pale)',
          border: '1px dashed var(--saffron-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', overflow: 'hidden', padding: 0,
        }}
      >
        {url ? (
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '2.4rem' }}>{emoji}</span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 2 * 1024 * 1024) {
            toast.error(s('图片超过 2MB', '圖片超過 2MB', 'File > 2MB'));
            return;
          }
          upload.mutate(f);
          e.target.value = '';
        }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
        >
          {upload.isPending ? '…' : url ? s('换图', '換圖', 'Replace') : s('上传', '上傳', 'Upload')}
        </button>
        {url && (
          <button
            type="button"
            onClick={() => { if (confirm(s('移除封面？', '移除封面？', 'Remove?'))) remove.mutate(); }}
            disabled={remove.isPending}
            style={{ font: 'var(--text-caption)', color: 'var(--crimson)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
          >
            {remove.isPending ? '…' : s('移除', '移除', 'Remove')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── 新建章节按钮 + inline modal
function AddChapterButton({ courseId, nextOrder }: { courseId: string; nextOrder: number }) {
  const { s } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '6px 14px', font: 'var(--text-caption)' }}>
        + {s('新章节', '新章節', 'Chapter')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={s('新章节', '新章節', 'New chapter')}>
        <ChapterForm
          submit={(body) => api.post(`/api/admin/courses/${encodeURIComponent(courseId)}/chapters`, body)}
          initial={{ title: '', titleTraditional: '', order: nextOrder }}
          courseId={courseId}
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

// ── ChapterCard：折叠 · 含课时列表 + edit/delete
function ChapterCard({ ch }: { ch: AdminChapter }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [addLessonOpen, setAddLessonOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => api.del(`/api/admin/chapters/${encodeURIComponent(ch.id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      toast.ok(s('已删除', '已刪除', 'Deleted'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const sortedLessons = [...ch.lessons].sort((a, b) => a.order - b.order);
  const nextOrder = (sortedLessons.at(-1)?.order ?? 0) + 1;

  return (
    <>
      <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? s('折叠', '折疊', 'Collapse') : s('展开', '展開', 'Expand')}
            style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '1rem' }}
          >
            {expanded ? '▾' : '▸'}
          </button>
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 24 }}>{ch.order}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1.5 }}>
              {ch.title}
            </div>
            {ch.titleTraditional && ch.titleTraditional !== ch.title && (
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{ch.titleTraditional}</div>
            )}
          </div>
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{ch.lessons.length} 课</span>
          <button type="button" onClick={() => setEditOpen(true)} style={{ background: 'transparent', border: 'none', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)' }}>
            {s('编辑', '編輯', 'Edit')}
          </button>
          <button
            type="button"
            onClick={() => { if (confirm(s('删除此章节？（如果有题目引用会失败）', '刪除此章節？（如果有題目引用會失敗）', 'Delete chapter? (fails if any question references it)'))) del.mutate(); }}
            disabled={del.isPending}
            style={{ background: 'transparent', border: 'none', color: 'var(--crimson)', cursor: 'pointer', font: 'var(--text-caption)' }}
          >
            {del.isPending ? '…' : s('删除', '刪除', 'Delete')}
          </button>
        </div>

        {expanded && (
          <>
            <div style={{ marginTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedLessons.length === 0 ? (
                <div style={{ padding: 'var(--sp-3)', textAlign: 'center', color: 'var(--ink-4)', font: 'var(--text-caption)' }}>
                  {s('（暂无课时）', '（暫無課時）', '(No lessons yet)')}
                </div>
              ) : sortedLessons.map((l) => <LessonRow key={l.id} l={l} />)}
            </div>

            <button
              type="button"
              onClick={() => setAddLessonOpen(true)}
              style={{
                marginTop: 'var(--sp-3)', width: '100%',
                padding: '8px', background: 'var(--glass)', border: '1px dashed var(--glass-border)',
                borderRadius: 'var(--r)', color: 'var(--saffron-dark)',
                font: 'var(--text-caption)', fontWeight: 600, letterSpacing: 1, cursor: 'pointer',
              }}
            >
              + {s('新课时', '新課時', 'Lesson')}
            </button>
          </>
        )}
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={s('编辑章节', '編輯章節', 'Edit chapter')}>
        <ChapterForm
          submit={(body) => api.patch(`/api/admin/chapters/${encodeURIComponent(ch.id)}`, body)}
          initial={{ title: ch.title, titleTraditional: ch.titleTraditional ?? '', order: ch.order }}
          courseId={null}
          onDone={() => setEditOpen(false)}
        />
      </Dialog>

      <Dialog open={addLessonOpen} onClose={() => setAddLessonOpen(false)} title={s('新课时', '新課時', 'New lesson')}>
        <LessonForm
          submit={(body) => api.post(`/api/admin/chapters/${encodeURIComponent(ch.id)}/lessons`, body)}
          initial={{ title: '', titleTraditional: '', order: nextOrder, referenceText: '', teachingSummary: '' }}
          onDone={() => setAddLessonOpen(false)}
        />
      </Dialog>
    </>
  );
}

function LessonRow({ l }: { l: AdminLesson }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const refLen = l.referenceText?.length ?? 0;
  const sumLen = l.teachingSummary?.length ?? 0;

  const del = useMutation({
    mutationFn: () => api.del(`/api/admin/lessons/${encodeURIComponent(l.id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      toast.ok(s('已删除', '已刪除', 'Deleted'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-sm)', background: 'var(--glass)' }}>
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 24 }}>{l.order}.</span>
        <span style={{ flex: 1, fontFamily: 'var(--font-serif)', color: 'var(--ink)', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {l.title}
        </span>
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
          {refLen > 0 ? refLen + '字原文' : '（空）'} · {sumLen > 0 ? sumLen + '字讲记' : '（空）'}
        </span>
        <button type="button" onClick={() => setEditOpen(true)} style={{ background: 'transparent', border: 'none', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)' }}>
          {s('编辑', '編輯', 'Edit')}
        </button>
        <button
          type="button"
          onClick={() => { if (confirm(s('删除此课时？（如果有题目引用会失败）', '刪除此課時？（如果有題目引用會失敗）', 'Delete lesson? (fails if any question references it)'))) del.mutate(); }}
          disabled={del.isPending}
          style={{ background: 'transparent', border: 'none', color: 'var(--crimson)', cursor: 'pointer', font: 'var(--text-caption)' }}
        >
          {del.isPending ? '…' : s('删除', '刪除', 'Delete')}
        </button>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={s('编辑课时', '編輯課時', 'Edit lesson')}>
        <LessonForm
          submit={(body) => api.patch(`/api/admin/lessons/${encodeURIComponent(l.id)}`, body)}
          initial={{
            title: l.title,
            titleTraditional: l.titleTraditional ?? '',
            order: l.order,
            referenceText: l.referenceText ?? '',
            teachingSummary: l.teachingSummary ?? '',
          }}
          onDone={() => setEditOpen(false)}
        />
      </Dialog>
    </>
  );
}

// ── 共用 Chapter form
type ChapterBody = { title: string; titleTraditional: string | null; order: number; [k: string]: unknown };
function ChapterForm({ submit, initial, courseId, onDone }: {
  submit: (body: ChapterBody) => Promise<unknown>;
  initial: { title: string; titleTraditional: string; order: number };
  courseId: string | null;
  onDone: () => void;
}) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial.title);
  const [titleTC, setTitleTC] = useState(initial.titleTraditional);
  const [order, setOrder] = useState(initial.order);
  const [err, setErr] = useState('');

  // 输入框初值同步（重新打开 modal 用同一份数据）
  useEffect(() => {
    setTitle(initial.title);
    setTitleTC(initial.titleTraditional);
    setOrder(initial.order);
  }, [initial.title, initial.titleTraditional, initial.order]);

  const m = useMutation({
    mutationFn: () => submit({
      title: title.trim(),
      titleTraditional: titleTC.trim() || null,
      order,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      if (courseId) qc.invalidateQueries({ queryKey: ['/api/admin/courses', courseId] });
      toast.ok(s('已保存', '已保存', 'Saved'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setErr(''); m.mutate(); }}
      style={{ padding: 'var(--sp-2) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
      <Field label={s('标题（简）', '標題（簡）', 'Title (SC)')} value={title} onChange={setTitle} required maxLength={200} />
      <Field label={s('标题（繁）', '標題（繁）', 'Title (TC)')} value={titleTC} onChange={setTitleTC} maxLength={200} />
      <Field label={s('章节序号', '章節序號', 'Order')} value={String(order)} onChange={(v) => setOrder(Number(v) || 1)} type="number" />
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <FormButtons cancel={onDone} pending={m.isPending} />
    </form>
  );
}

// ── 共用 Lesson form
type LessonBody = {
  title: string;
  titleTraditional: string | null;
  order: number;
  referenceText: string | null;
  teachingSummary: string | null;
  [k: string]: unknown;
};
function LessonForm({ submit, initial, onDone }: {
  submit: (body: LessonBody) => Promise<unknown>;
  initial: { title: string; titleTraditional: string; order: number; referenceText: string; teachingSummary: string };
  onDone: () => void;
}) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial.title);
  const [titleTC, setTitleTC] = useState(initial.titleTraditional);
  const [order, setOrder] = useState(initial.order);
  const [refText, setRefText] = useState(initial.referenceText);
  const [summary, setSummary] = useState(initial.teachingSummary);
  const [err, setErr] = useState('');

  const m = useMutation({
    mutationFn: () => submit({
      title: title.trim(),
      titleTraditional: titleTC.trim() || null,
      order,
      referenceText: refText.trim() || null,
      teachingSummary: summary.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      toast.ok(s('已保存', '已保存', 'Saved'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr('');
        if (refText.length > 50_000) { setErr(s('原文超过 50000 字', '原文超過 50000 字', 'Reference text > 50KB')); return; }
        if (summary.length > 10_000) { setErr(s('讲记超过 10000 字', '講記超過 10000 字', 'Summary > 10KB')); return; }
        m.mutate();
      }}
      style={{ padding: 'var(--sp-2) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-3)' }}>
        <Field label={s('标题（简）', '標題（簡）', 'Title (SC)')} value={title} onChange={setTitle} required maxLength={200} />
        <Field label={s('序号', '序號', 'Order')} value={String(order)} onChange={(v) => setOrder(Number(v) || 1)} type="number" />
      </div>
      <Field label={s('标题（繁）', '標題（繁）', 'Title (TC)')} value={titleTC} onChange={setTitleTC} maxLength={200} />
      <TextArea
        label={s('原文 / 法本', '原文 / 法本', 'Reference text')}
        value={refText}
        onChange={setRefText}
        rows={10}
        maxLength={50_000}
        hint={refText.length + ' / 50000'}
      />
      <TextArea
        label={s('讲记 / 摘要', '講記 / 摘要', 'Teaching summary')}
        value={summary}
        onChange={setSummary}
        rows={5}
        maxLength={10_000}
        hint={summary.length + ' / 10000'}
      />
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <FormButtons cancel={onDone} pending={m.isPending} />
    </form>
  );
}

// ── 新建 Course form
function CreateCourseForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [titleTC, setTitleTC] = useState('');
  const [emoji, setEmoji] = useState('🪷');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState(0);
  const [published, setPublished] = useState(false);
  const [err, setErr] = useState('');

  // title → slug 自动建议（用户没改 slug 时）
  const slugDirty = useRef(false);
  useEffect(() => {
    if (!slugDirty.current) {
      const auto = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
      setSlug(auto);
    }
  }, [title]);

  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>('/api/admin/courses', {
      slug: slug.trim(),
      title: title.trim(),
      titleTraditional: titleTC.trim() || null,
      author: author.trim() || null,
      description: description.trim() || null,
      coverEmoji: emoji.trim() || '🪷',
      displayOrder: order,
      isPublished: published,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      qc.invalidateQueries({ queryKey: ['/api/courses'] });
      toast.ok(s('已创建', '已創建', 'Created'));
      onCreated(r.id);
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setErr(''); create.mutate(); }}
      style={{ padding: 'var(--sp-2) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
      <Field label={s('标题（简）', '標題（簡）', 'Title (SC)')} value={title} onChange={setTitle} required maxLength={120} />
      <Field label={s('标题（繁）', '標題（繁）', 'Title (TC)')} value={titleTC} onChange={setTitleTC} maxLength={120} />
      <Field
        label={s('Slug · URL（自动生成 · 可改）', 'Slug · URL（自動生成 · 可改）', 'Slug (auto · editable)')}
        value={slug}
        onChange={(v) => { slugDirty.current = true; setSlug(v); }}
        required
        pattern="[a-z0-9-]+"
        maxLength={80}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 4fr', gap: 'var(--sp-3)' }}>
        <Field label="emoji" value={emoji} onChange={setEmoji} maxLength={8} />
        <Field label={s('作者（可选）', '作者（可選）', 'Author (opt)')} value={author} onChange={setAuthor} maxLength={120} />
      </div>
      <TextArea label={s('简介（可选）', '簡介（可選）', 'Description (opt)')} value={description} onChange={setDescription} rows={3} maxLength={2000} />
      <Field label={s('显示顺序（小→前）', '顯示順序（小→前）', 'Order')} value={String(order)} onChange={(v) => setOrder(Number(v) || 0)} type="number" />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {s('立即发布（学员可见）', '立即發布（學員可見）', 'Publish immediately')}
      </label>
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <FormButtons cancel={onCancel} pending={create.isPending} confirmLabel={['创建', '創建', 'Create']} />
    </form>
  );
}

// ── 通用 widgets
function FormButtons({ cancel, pending, confirmLabel }: { cancel: () => void; pending: boolean; confirmLabel?: [string, string, string] }) {
  const { s } = useLang();
  const cl = confirmLabel ?? ['保存', '保存', 'Save'];
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
      <button type="button" onClick={cancel} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
        {s('取消', '取消', 'Cancel')}
      </button>
      <button type="submit" disabled={pending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
        {pending ? '…' : s(cl[0], cl[1], cl[2])}
      </button>
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3, maxLength, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div>
      <label style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
        <span>{label}</span>
        {hint && <span style={{ color: 'var(--ink-4)', letterSpacing: 0 }}>{hint}</span>}
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
          font: 'var(--text-body)', outline: 'none', resize: 'vertical',
        }}
      />
    </div>
  );
}

