// AdminCoursesPage · /admin/courses
//   两栏：左侧闻思列表 + 右侧编辑器（metadata · 章节 · 课时）
//   完整 3 级 CRUD：Course / Chapter / Lesson · 含封面图上传 / 删除
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import CourseImportDialog from '@/components/CourseImportDialog';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import {
  type AdminChapter,
  type AdminCourseDetail,
  type AdminLesson,
  type AdminMeditation,
  fetchChapterDependencies,
  fetchLessonDependencies,
  useAdminCourseDetail,
  useAdminCourses,
  useAdminMeditations,
} from '@/lib/queries';
import { MeditationFullEditor } from '@/components/MeditationAdmin';
import { LessonQuestionsSlot } from '@/components/QuestionAdminInline';
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
          <h1 className="page-title">{s('闻思管理', '聞思管理', 'Texts')}</h1>
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
            + {s('新建闻思', '新建聞思', 'New text')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--sp-5)' }}>
        {/* 左：闻思列表 */}
        <aside style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: 'calc(100vh - var(--sp-8))', overflowY: 'auto' }}>
          {list.isLoading ? (
            <Skeleton.List />
          ) : !list.data || list.data.length === 0 ? (
            <div style={{ padding: 'var(--sp-5)', color: 'var(--ink-3)', textAlign: 'center' }}>
              {s('暂无闻思', '暫無聞思', 'None')}
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s("新建闻思 · 填基础信息后再添加章节", "新建聞思 · 填基礎信息後再添加章節", "New text · fill basics then add chapters")} variant="centered">
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
        {s('← 选择左侧闻思查看 / 编辑，或点 +新建', '← 選擇左側聞思查看 / 編輯，或點 +新建', '← Pick a text on the left, or + New text')}
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
function CourseEditor({ c: cIn }: { c: AdminCourseDetail }) {
  const { s } = useLang();
  const [, setSp] = useSearchParams();
  const qc = useQueryClient();

  // 后端可能返回 chapters: undefined（空闻思未加载嵌套关系）· 拍平到 []
  const c = { ...cIn, chapters: cIn.chapters ?? [] };

  // metadata 状态（受控 · 用 key 重置）
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [slug, setSlug] = useState(c.slug);
  const [title, setTitle] = useState(c.title);
  const [titleTC, setTitleTC] = useState(c.titleTraditional ?? '');
  const [author, setAuthor] = useState(c.author ?? '');
  const [description, setDescription] = useState(c.description ?? '');
  const [authorInfo, setAuthorInfo] = useState(c.authorInfo ?? '');
  const [emoji, setEmoji] = useState(c.coverEmoji);
  const [category, setCategory] = useState(c.category ?? '');
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
      category: category.trim() || null,
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
      {/* metadata card · 默认折叠 · 点 hero 行展开（决策 B · 减少同屏可见 primary 按钮） */}
      <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: metaExpanded ? 'var(--sp-4)' : 0, cursor: 'pointer' }}
          onClick={() => setMetaExpanded((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMetaExpanded((v) => !v); } }}
        >
          <CoverEditor courseId={c.id} url={c.coverImageUrl} emoji={c.coverEmoji} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
              <span>{s('元数据', '元數據', 'Metadata')}</span>
              <PubPill published={published} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)', letterSpacing: 2, marginTop: 2 }}>
              {title || s('（无标题）', '（無標題）', '(no title)')}
            </h2>
          </div>
          <span style={{ color: 'var(--ink-3)', fontSize: '1.1rem' }}>{metaExpanded ? '▾' : '▸'}</span>
        </div>

        {metaExpanded && <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}
        >
          <Field label={s('标题（简）', '標題（簡）', 'Title (SC)')} value={title} onChange={setTitle} required maxLength={120} />
          <Field label={s('标题（繁）', '標題（繁）', 'Title (TC)')} value={titleTC} onChange={setTitleTC} maxLength={120} />
          <Field label={s('Slug · URL 用', 'Slug · URL 用', 'Slug')} value={slug} onChange={setSlug} required pattern="[a-z0-9\-]+" maxLength={80} />
          <Field label={s('作者 / 译者', '作者 / 譯者', 'Author')} value={author} onChange={setAuthor} maxLength={120} />
          <div style={{ gridColumn: '1 / -1' }}>
            <TextArea label={s('简介', '簡介', 'Description')} value={description} onChange={setDescription} rows={3} maxLength={2000} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <TextArea label={s('作者介绍', '作者介紹', 'Author info')} value={authorInfo} onChange={setAuthorInfo} rows={3} maxLength={2000} />
          </div>
          <Field label={s('封面 emoji', '封面 emoji', 'Emoji')} value={emoji} onChange={setEmoji} maxLength={8} />
          <Field label={s('类别（前端排序分组用 · 如 显宗 / 密宗 / 戒律）', '類別（前端排序分組用）', 'Category')} value={category} onChange={setCategory} maxLength={40} />
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
              onClick={async () => {
                if (!(await confirmAsync({ title: s('归档此闻思？学员不再能访问（可通过未发布恢复展示）', '歸檔此聞思？學員不再能訪問', 'Archive this text? Students lose access.') }))) return;
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
        </form>}
      </div>

      {/* 章节区 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2 }}>
          {s('章节', '章節', 'Chapters')} ({c.chapters.length})
        </h2>
        <AddChapterButton courseId={c.id} nextOrder={(c.chapters.at(-1)?.order ?? 0) + 1} courseTitle={c.title} />
      </div>

      {c.chapters.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)' }}>
          {s('还没有章节 · 点击 +新章节', '還沒有章節 · 點擊 +新章節', 'No chapters yet')}
        </div>
      ) : (
        [...c.chapters].sort((a, b) => a.order - b.order).map((ch) => <ChapterCard key={ch.id} ch={ch} courseId={c.id} />)
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
      // ['/api/admin/courses'] 按 prefix 匹配 · 已覆盖所有 detail · 不需要再单独 invalidate
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      qc.invalidateQueries({ queryKey: ['/api/courses'] });
      toast.ok(s('封面已上传', '封面已上傳', 'Uploaded'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/api/admin/courses/${encodeURIComponent(courseId)}/cover`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      qc.invalidateQueries({ queryKey: ['/api/courses'] });
      toast.ok(s('封面已移除', '封面已移除', 'Removed'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      onClick={(e) => e.stopPropagation()}
    >
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
            onClick={async () => { (await confirmAsync({ title: s('移除封面？', '移除封面？', 'Remove?') })) && remove.mutate(); }}
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
function AddChapterButton({ courseId, nextOrder, courseTitle }: { courseId: string; nextOrder: number; courseTitle: string }) {
  const { s } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '6px 14px', font: 'var(--text-caption)' }}>
        + {s('新章节', '新章節', 'Chapter')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={s(`在「${courseTitle}」下新建章节`, `在「${courseTitle}」下新建章節`, `New chapter under "${courseTitle}"`)} variant="centered">
        <ChapterForm
          submit={(body) => api.post(`/api/admin/courses/${encodeURIComponent(courseId)}/chapters`, body)}
          initial={{ title: '', titleTraditional: '', order: nextOrder }}
          onDone={() => setOpen(false)}
          confirmLabel={['创建章节', '創建章節', 'Create chapter']}
        />
      </Dialog>
    </>
  );
}

// ── ChapterCard：折叠 · 含课时列表 + edit/delete
function ChapterCard({ ch, courseId }: { ch: AdminChapter; courseId: string }) {
  const { s } = useLang();
  const qc = useQueryClient();
  // 决策 B · 默认折叠 · 减少同屏可见操作
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
          {/* ⋯ 菜单 · 收起编辑/删除 · 默认 collapsed 减少视觉噪音 */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              aria-label={s('更多', '更多', 'More')}
              style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px', borderRadius: 4 }}
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 51, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-sm)', boxShadow: '0 6px 20px rgba(43,34,24,.18)', minWidth: 120 }}>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                    style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', textAlign: 'left', color: 'var(--ink-2)', font: 'var(--text-caption)', cursor: 'pointer' }}
                  >
                    {s('编辑章节', '編輯章節', 'Edit chapter')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      try {
                        const deps = await fetchChapterDependencies(ch.id);
                        if (deps.questionCount > 0) {
                          toast.error(s(
                            `本章关联 ${deps.questionCount} 道题 · 请先删除这些题再归档`,
                            `本章關聯 ${deps.questionCount} 道題`,
                            `${deps.questionCount} question(s) reference this chapter · remove them first`,
                          ));
                          return;
                        }
                        const ok = await confirmAsync({
                          title: s(
                            `删除「${ch.order}. ${ch.title}」（含 ${deps.lessonCount} 课时）？此操作不可恢复。`,
                            `刪除「${ch.order}. ${ch.title}」（含 ${deps.lessonCount} 課時）？`,
                            `Delete "${ch.order}. ${ch.title}" (with ${deps.lessonCount} lessons)? Cannot undo.`,
                          ),
                          danger: true,
                          okLabel: s('删除', '刪除', 'Delete'),
                        });
                        if (ok) del.mutate();
                      } catch (e) {
                        toast.error((e as ApiError).message);
                      }
                    }}
                    disabled={del.isPending}
                    style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--crimson)', font: 'var(--text-caption)', cursor: 'pointer' }}
                  >
                    {del.isPending ? '…' : s('删除章节', '刪除章節', 'Delete chapter')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {expanded && (
          <>
            <div style={{ marginTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedLessons.length === 0 ? (
                <div style={{ padding: 'var(--sp-3)', textAlign: 'center', color: 'var(--ink-4)', font: 'var(--text-caption)' }}>
                  {s('（暂无课时）', '（暫無課時）', '(No lessons yet)')}
                </div>
              ) : sortedLessons.map((l) => <LessonRow key={l.id} l={l} courseId={courseId} chapterId={ch.id} />)}
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

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={s(`编辑章节 · ${ch.order}. ${ch.title}`, `編輯章節 · ${ch.order}. ${ch.title}`, `Edit chapter · ${ch.order}. ${ch.title}`)} variant="centered">
        <ChapterForm
          submit={(body) => api.patch(`/api/admin/chapters/${encodeURIComponent(ch.id)}`, body)}
          initial={{ title: ch.title, titleTraditional: ch.titleTraditional ?? '', order: ch.order }}
          onDone={() => setEditOpen(false)}
          confirmLabel={['保存章节', '保存章節', 'Save chapter']}
        />
      </Dialog>

      <Dialog open={addLessonOpen} onClose={() => setAddLessonOpen(false)} title={s(`在「${ch.order}. ${ch.title}」下新建课时`, `在「${ch.order}. ${ch.title}」下新建課時`, `New lesson under "${ch.order}. ${ch.title}"`)} variant="centered">
        <LessonForm
          submit={(body) => api.post(`/api/admin/chapters/${encodeURIComponent(ch.id)}/lessons`, body)}
          initial={{ title: '', titleTraditional: '', order: nextOrder, referenceText: '', teachingSummary: '' }}
          onDone={() => setAddLessonOpen(false)}
          confirmLabel={['创建课时', '創建課時', 'Create lesson']}
        />
      </Dialog>
    </>
  );
}

function LessonRow({ l, courseId, chapterId }: { l: AdminLesson; courseId: string; chapterId: string }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [medExpanded, setMedExpanded] = useState(false);
  const refLen = l.referenceText?.length ?? 0;
  const sumLen = l.teachingSummary?.length ?? 0;

  // 拉本课时的观修（含未发布 · 不含归档）
  const meds = useAdminMeditations({ lessonId: l.id });
  const meditation = meds.data?.[0];

  const del = useMutation({
    mutationFn: () => api.del(`/api/admin/lessons/${encodeURIComponent(l.id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      toast.ok(s('已删除', '已刪除', 'Deleted'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const createMed = useMutation({
    mutationFn: () => api.post<AdminMeditation>('/api/admin/meditations', {
      lessonId: l.id,
      title: l.title, // 默认用课时标题 · 用户可改
      titleTraditional: l.titleTraditional || null,
      isPublished: false,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/meditations'] });
      setMedExpanded(true);
      toast.ok(s('观修已创建 · 上传视频后再发布', '觀修已創建', 'Created · upload video then publish'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      <div style={{ borderRadius: 'var(--r-sm)', background: 'var(--glass)', overflow: 'hidden' }}>
        {/* 主行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)' }}>
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 24 }}>{l.order}.</span>
          <span style={{ flex: 1, fontFamily: 'var(--font-serif)', color: 'var(--ink)', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {l.title}
          </span>
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
            {refLen > 0 ? refLen + '字原文' : '（空）'} · {sumLen > 0 ? sumLen + '字讲记' : '（空）'}
          </span>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              aria-label={s('更多', '更多', 'More')}
              style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 6px', borderRadius: 4 }}
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 51, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-sm)', boxShadow: '0 6px 20px rgba(43,34,24,.18)', minWidth: 120 }}>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                    style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', textAlign: 'left', color: 'var(--ink-2)', font: 'var(--text-caption)', cursor: 'pointer' }}
                  >
                    {s('编辑课时', '編輯課時', 'Edit lesson')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      try {
                        const deps = await fetchLessonDependencies(l.id);
                        if (deps.questionCount > 0) {
                          toast.error(s(
                            `本课时关联 ${deps.questionCount} 道题 · 请先删除这些题`,
                            `本課時關聯 ${deps.questionCount} 道題`,
                            `${deps.questionCount} question(s) reference this lesson · remove them first`,
                          ));
                          return;
                        }
                        if (deps.meditationCount > 0) {
                          toast.error(s(
                            `本课时关联 ${deps.meditationCount} 个观修 · 请先归档`,
                            `本課時關聯 ${deps.meditationCount} 個觀修`,
                            `${deps.meditationCount} meditation(s) linked · archive them first`,
                          ));
                          return;
                        }
                        const ok = await confirmAsync({
                          title: s(`删除「${l.order}. ${l.title}」？此操作不可恢复。`, `刪除「${l.order}. ${l.title}」？此操作不可恢復。`, `Delete "${l.order}. ${l.title}"? Cannot undo.`),
                          danger: true,
                          okLabel: s('删除', '刪除', 'Delete'),
                        });
                        if (ok) del.mutate();
                      } catch (e) {
                        toast.error((e as ApiError).message);
                      }
                    }}
                    disabled={del.isPending}
                    style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--crimson)', font: 'var(--text-caption)', cursor: 'pointer' }}
                  >
                    {del.isPending ? '…' : s('删除课时', '刪除課時', 'Delete lesson')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 观修副行 · 缩进 */}
        <div style={{ borderTop: '1px solid var(--border-light)', padding: 'var(--sp-2) var(--sp-3)', paddingLeft: 'calc(var(--sp-3) + 32px)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {meds.isLoading ? (
            <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>🧘 …</span>
          ) : meditation ? (
            <>
              <button
                type="button"
                onClick={() => setMedExpanded((v) => !v)}
                style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', font: 'var(--text-caption)' }}
              >
                {medExpanded ? '▾' : '▸'}
              </button>
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-2)' }}>🧘 {meditation.title}</span>
              {meditation.videoUrl ? (
                <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)' }}>
                  · 🎥 {Math.floor(meditation.videoDurationSec / 60)}:{String(meditation.videoDurationSec % 60).padStart(2, '0')}
                </span>
              ) : (
                <span style={{ font: 'var(--text-caption)', color: 'var(--crimson)' }}>· 无视频</span>
              )}
              {meditation.slidesPdfUrl && <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>· 📄</span>}
              <span style={{
                marginLeft: 'auto',
                padding: '1px 6px', borderRadius: 'var(--r-pill)',
                background: meditation.isPublished ? 'rgba(125,154,108,.15)' : 'var(--border-light)',
                color: meditation.isPublished ? 'var(--sage-dark)' : 'var(--ink-3)',
                font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1,
              }}>
                {meditation.isPublished ? '✓pub' : '—草稿'}
              </span>
              <button
                type="button"
                onClick={() => setMedExpanded((v) => !v)}
                style={{ background: 'transparent', border: 'none', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)' }}
              >
                {medExpanded ? s('收起', '收起', 'Hide') : s('编辑', '編輯', 'Edit')}
              </button>
            </>
          ) : (
            <>
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>🧘 {s('暂无观修', '暫無觀修', 'No meditation')}</span>
              <button
                type="button"
                onClick={() => createMed.mutate()}
                disabled={createMed.isPending}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)', letterSpacing: 1 }}
              >
                {createMed.isPending ? '…' : '+ ' + s('添加观修', '添加觀修', 'Add meditation')}
              </button>
            </>
          )}
        </div>

        {/* 内联编辑器 */}
        {medExpanded && meditation && (
          <div style={{ padding: 'var(--sp-3)', background: 'var(--bg)', borderTop: '1px solid var(--border-light)' }}>
            <MeditationFullEditor
              key={meditation.id}
              m={meditation}
              onArchived={() => setMedExpanded(false)}
            />
          </div>
        )}

        {/* 题目副行 · 跨 coach 视角 · 弹窗管理 */}
        <LessonQuestionsSlot courseId={courseId} chapterId={chapterId} lessonId={l.id} />
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={s(`编辑课时 · ${l.order}. ${l.title}`, `編輯課時 · ${l.order}. ${l.title}`, `Edit lesson · ${l.order}. ${l.title}`)} variant="centered">
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
          confirmLabel={['保存课时', '保存課時', 'Save lesson']}
        />
      </Dialog>
    </>
  );
}

// ── 共用 Chapter form
type ChapterBody = { title: string; titleTraditional: string | null; order: number; [k: string]: unknown };
function ChapterForm({ submit, initial, onDone, confirmLabel }: {
  submit: (body: ChapterBody) => Promise<unknown>;
  initial: { title: string; titleTraditional: string; order: number };
  onDone: () => void;
  confirmLabel?: [string, string, string];
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
      // prefix 匹配已覆盖 [..., courseId] · 不要重复 invalidate（会取消上一个 refetch）
      qc.invalidateQueries({ queryKey: ['/api/admin/courses'] });
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
      <FormButtons cancel={onDone} pending={m.isPending} confirmLabel={confirmLabel} />
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
function LessonForm({ submit, initial, onDone, confirmLabel }: {
  submit: (body: LessonBody) => Promise<unknown>;
  initial: { title: string; titleTraditional: string; order: number; referenceText: string; teachingSummary: string };
  onDone: () => void;
  confirmLabel?: [string, string, string];
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
        label={s('原文 / 闻思', '原文 / 聞思', 'Reference text')}
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
      <FormButtons cancel={onDone} pending={m.isPending} confirmLabel={confirmLabel} />
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
  const [category, setCategory] = useState('');
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
    mutationFn: () => {
      const body: Record<string, unknown> = {
        slug: slug.trim(),
        title: title.trim(),
        coverEmoji: emoji.trim() || '🪷',
        displayOrder: order,
        isPublished: published,
      };
      // 后端 createCourseBody 字段是 .optional() 不是 .nullable()
      // 空值省略字段 · 不发 null（否则 zod 拒收 → 400）
      if (titleTC.trim()) body.titleTraditional = titleTC.trim();
      if (author.trim()) body.author = author.trim();
      if (description.trim()) body.description = description.trim();
      if (category.trim()) body.category = category.trim();
      return api.post<{ id: string }>('/api/admin/courses', body);
    },
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
        pattern="[a-z0-9\-]+"
        maxLength={80}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 4fr', gap: 'var(--sp-3)' }}>
        <Field label="emoji" value={emoji} onChange={setEmoji} maxLength={8} />
        <Field label={s('作者（可选）', '作者（可選）', 'Author (opt)')} value={author} onChange={setAuthor} maxLength={120} />
      </div>
      <TextArea label={s('简介（可选）', '簡介（可選）', 'Description (opt)')} value={description} onChange={setDescription} rows={3} maxLength={2000} />
      <Field label={s('类别（可选 · 排序分组）', '類別（可選 · 排序分組）', 'Category (opt)')} value={category} onChange={setCategory} maxLength={40} />
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

