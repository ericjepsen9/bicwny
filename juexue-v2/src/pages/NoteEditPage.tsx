// 笔记编辑 · /notes/new · /notes/:id
//   - markdown textarea + 实时预览（左右 / 上下切换）
//   - 5 个 LLM 按钮：✨润色 / 📋摘要 / 🏷️ tag 推荐 / 📝 标题推荐 / 📑 段落骨架
//   - 可见性：私密 / 班级共享
//   - 标题 / tag / 删除 / 归档 / 置顶
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import TopNav from '@/components/TopNav';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

interface Note {
  id: string;
  lessonId: string | null;
  title: string;
  body: string;
  tags: string[];
  visibility: 'private' | 'class';
  anchorText: string | null;
  anchorIndex: number | null;
  pinnedAt: string | null;
  archivedAt: string | null;
}

type LlmAction = 'polish' | 'summarize' | 'tags' | 'title' | 'draft';

export default function NoteEditPage() {
  const { s } = useLang();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';
  const prefillLessonId = searchParams.get('lessonId');
  const prefillBody = searchParams.get('body') ?? '';
  const fromDraft = searchParams.get('fromDraft') === '1';

  // 从 sessionStorage 读 reading 页选段 / 全文草稿
  const sessionDraft = useMemo(() => {
    if (!fromDraft) return null;
    try {
      const raw = sessionStorage.getItem('note-draft');
      if (!raw) return null;
      sessionStorage.removeItem('note-draft');
      return JSON.parse(raw) as {
        lessonId?: string;
        lessonSlug?: string;
        body: string;
        anchorText?: string | null;
        anchorIndex?: number | null;
        autoDraft?: boolean;
      };
    } catch { return null; }
  }, [fromDraft]);

  // 返回路径 · 优先级：?backTo= → sessionDraft 推导 → /notes 兜底
  //   URL 携带 backTo 是为了 saveMut 调 navigate(replace) 后仍能保留来源页（sessionDraft 一次性消费）
  //   见 NotesDrawer · 长按选段 · ReadingNotesFab → 全部把 backTo 写入 URL
  const urlBackTo = searchParams.get('backTo');
  const backTo = useMemo(() => {
    if (urlBackTo) return urlBackTo;
    if (sessionDraft?.lessonSlug && sessionDraft?.lessonId) {
      return `/read/${sessionDraft.lessonSlug}/${sessionDraft.lessonId}`;
    }
    return '/notes';
  }, [urlBackTo, sessionDraft]);

  const [anchorText, setAnchorText] = useState<string | null>(sessionDraft?.anchorText ?? null);
  const [anchorIndex, setAnchorIndex] = useState<number | null>(sessionDraft?.anchorIndex ?? null);

  const existing = useQuery({
    enabled: !isNew,
    queryKey: ['/api/notes', id],
    queryFn: ({ signal }) => api.get<Note>(`/api/notes/${id}`, { signal }),
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState(sessionDraft?.body ?? prefillBody);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'class'>('private');
  const [pinned, setPinned] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [llmLoading, setLlmLoading] = useState<LlmAction | null>(null);

  useEffect(() => {
    if (existing.data) {
      setTitle(existing.data.title);
      setBody(existing.data.body);
      setTags(existing.data.tags);
      setVisibility(existing.data.visibility);
      setPinned(!!existing.data.pinnedAt);
      setAnchorText(existing.data.anchorText ?? null);
      setAnchorIndex(existing.data.anchorIndex ?? null);
    }
  }, [existing.data]);

  // 选段进入时自动调一次 draft（仅新建场景 · 仅当 sessionDraft.autoDraft）
  const [autoDraftDone, setAutoDraftDone] = useState(false);
  useEffect(() => {
    if (!isNew || !sessionDraft?.autoDraft || autoDraftDone) return;
    setAutoDraftDone(true);
    (async () => {
      setLlmLoading('draft');
      try {
        const data = await api.post<{ result: string }>('/api/notes/llm-assist', { action: 'draft', text: sessionDraft.body });
        setBody(String(data.result));
        toast.ok('✓ AI 骨架已生成');
      } catch (e) {
        toast.error('AI 失败: ' + (e as ApiError).message);
      } finally {
        setLlmLoading(null);
      }
    })();
  }, [isNew, sessionDraft, autoDraftDone]);

  // 新建保存 / 编辑保存
  const save = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return api.post<Note>('/api/notes', {
          lessonId: prefillLessonId || sessionDraft?.lessonId || null,
          title: title.trim() || '无标题',
          body,
          tags,
          visibility,
          anchorText,
          anchorIndex,
        });
      }
      return api.patch<Note>(`/api/notes/${id}`, {
        title: title.trim() || '无标题',
        body,
        tags,
        visibility,
        pinned,
      });
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['/api/notes'] });
      qc.invalidateQueries({ queryKey: ['/api/notes', n.id] });
      toast.ok(isNew ? '✓ 已创建' : '✓ 已保存');
      if (isNew) {
        // 保留 backTo · 让保存后再按返回仍能跳回阅读页
        const q = backTo && backTo !== '/notes' ? `?backTo=${encodeURIComponent(backTo)}` : '';
        navigate(`/notes/${n.id}${q}`, { replace: true });
      }
    },
    onError: (e) => toast.error('保存失败: ' + (e as ApiError).message),
  });

  const removeMut = useMutation({
    mutationFn: () => api.del(`/api/notes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/notes'] });
      toast.ok('已删除');
      navigate('/notes', { replace: true });
    },
  });

  const isArchived = !!existing.data?.archivedAt;
  const archiveMut = useMutation({
    mutationFn: () => api.patch(`/api/notes/${id}`, { archive: !isArchived }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/notes'] });
      qc.invalidateQueries({ queryKey: ['/api/notes', id] });
      toast.ok(isArchived ? '✓ 已取消归档' : '✓ 已归档');
    },
    onError: (e) => toast.error('归档失败: ' + (e as ApiError).message),
  });

  async function callLlm(action: LlmAction) {
    if (!body.trim() && action !== 'draft') {
      toast.error('请先写一些内容');
      return;
    }
    setLlmLoading(action);
    try {
      const data = await api.post<{ result: string | string[] }>('/api/notes/llm-assist', { action, text: body });
      if (action === 'polish') {
        setBody(String(data.result));
        toast.ok('✓ 已润色');
      } else if (action === 'summarize') {
        setBody(body + '\n\n---\n**摘要**\n' + String(data.result));
        toast.ok('✓ 摘要已追加');
      } else if (action === 'tags') {
        const newTags = Array.isArray(data.result) ? data.result : [];
        setTags(Array.from(new Set([...tags, ...newTags])).slice(0, 10));
        toast.ok(`✓ 已添加 ${newTags.length} 个 tag`);
      } else if (action === 'title') {
        setTitle(String(data.result).slice(0, 80));
        toast.ok('✓ 标题已生成');
      } else if (action === 'draft') {
        setBody(String(data.result));
        toast.ok('✓ 骨架已生成');
      }
    } catch (e) {
      toast.error('AI 失败: ' + (e as ApiError).message);
    } finally {
      setLlmLoading(null);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || tags.length >= 10) return;
    setTags([...tags, t]);
    setTagInput('');
  }

  const previewHtml = useMemo(() => mdToHtml(body), [body]);

  if (!isNew && existing.isLoading) return <p style={{ padding: 'var(--sp-4)' }}>加载中…</p>;
  if (!isNew && existing.isError) return <p style={{ padding: 'var(--sp-4)', color: 'var(--crimson)' }}>{(existing.error as ApiError).message}</p>;

  return (
    <>
      <TopNav
        titles={[isNew ? '新建笔记' : '编辑笔记', isNew ? '新建筆記' : '編輯筆記', isNew ? 'New note' : 'Edit']}
        backTo={backTo}
        right={(
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', background: 'transparent', border: 'none', padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}
          >
            {save.isPending ? '保存中…' : '保存'}
          </button>
        )}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {/* 标题 */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={s('标题（点 📝 自动生成）', '標題（點 📝 自動生成）', 'Title')}
          maxLength={80}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-light)', fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-serif)' }}
        />

        {/* LLM 按钮组 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <LlmBtn label="✨ 润色" loading={llmLoading === 'polish'} onClick={() => callLlm('polish')} />
          <LlmBtn label="📋 摘要" loading={llmLoading === 'summarize'} onClick={() => callLlm('summarize')} />
          <LlmBtn label="🏷️ 推荐 tag" loading={llmLoading === 'tags'} onClick={() => callLlm('tags')} />
          <LlmBtn label="📝 推荐标题" loading={llmLoading === 'title'} onClick={() => callLlm('title')} />
          <LlmBtn label="📑 段落骨架" loading={llmLoading === 'draft'} onClick={() => callLlm('draft')} />
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="btn btn-pill"
            style={{ padding: '4px 12px', font: 'var(--text-caption)', background: showPreview ? 'var(--saffron-pale)' : 'var(--surface)', color: showPreview ? 'var(--saffron-dark)' : 'var(--ink-3)', border: '1px solid var(--border-light)' }}
          >
            {showPreview ? '✏️ 编辑' : '👁️ 预览'}
          </button>
        </div>

        {/* 正文 编辑 / 预览 */}
        {showPreview ? (
          <div
            className="glass-card"
            style={{ padding: 'var(--sp-4)', minHeight: 320, font: 'var(--text-body)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={s('支持 markdown · **粗体** *斜体* - 列表 > 引用 [链接](url)', '支持 markdown', 'Markdown supported')}
            rows={14}
            maxLength={10000}
            style={{ width: '100%', padding: 'var(--sp-3)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-light)', font: 'var(--text-body)', lineHeight: 1.7, resize: 'vertical', minHeight: 320 }}
          />
        )}

        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', textAlign: 'right' }}>
          {body.length} / 10000
        </div>

        {/* tag 输入 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{s('标签 · 最多 10 个', '標籤', 'Tags · max 10')}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {tags.map((t) => (
              <span key={t} className="chip" style={{ background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                #{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}>×</button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="+ tag"
              maxLength={20}
              style={{ flex: 1, minWidth: 80, padding: '4px 8px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border-light)', font: 'var(--text-caption)' }}
            />
          </div>
        </div>

        {/* 可见性 · 置顶 · 删除 */}
        <div className="glass-card" style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-body)', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={visibility === 'private'}
              onChange={() => setVisibility('private')}
            />
            🔒 {s('仅自己可见', '僅自己可見', 'Private')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-body)', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={visibility === 'class'}
              onChange={() => setVisibility('class')}
            />
            📣 {s('班级共享 · 同班同学和辅导员可见', '班級共享', 'Share to class')}
          </label>

          {!isNew && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-body)', cursor: 'pointer', marginTop: 6 }}>
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                📌 {s('置顶', '置頂', 'Pin')}
              </label>

              <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => archiveMut.mutate()}
                  disabled={archiveMut.isPending}
                  className="btn btn-pill"
                  style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--ink-3)', color: 'var(--ink-2)' }}
                >
                  {isArchived
                    ? '↩️ ' + (archiveMut.isPending ? '处理中…' : s('取消归档', '取消歸檔', 'Unarchive'))
                    : '🗄️ ' + (archiveMut.isPending ? '处理中…' : s('归档', '歸檔', 'Archive'))}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmAsync({ title: s(`删除「${title}」？`, `刪除「${title}」？`, `Delete?`), danger: true, okLabel: '删除' })) {
                      removeMut.mutate();
                    }
                  }}
                  disabled={removeMut.isPending}
                  className="btn btn-pill"
                  style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--crimson)', color: 'var(--crimson)' }}
                >
                  🗑️ {removeMut.isPending ? '删除中…' : '删除笔记'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function LlmBtn({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="btn btn-pill"
      style={{
        padding: '4px 12px',
        font: 'var(--text-caption)',
        background: loading ? 'var(--gold-pale)' : 'var(--saffron-pale)',
        color: 'var(--saffron-dark)',
        border: '1px solid var(--saffron-light)',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? '处理中…' : label}
    </button>
  );
}

// 链接 scheme 白名单 · 拒绝 javascript:/data: 等危险 scheme
const SAFE_URL = /^(https?:\/\/|mailto:|\/|#|\.\/|\.\.\/)/i;

// 极简 markdown → HTML · 仅支持基础语法 · 不引第三方库
function mdToHtml(md: string): string {
  let html = escapeHtml(md);
  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // 粗体 / 斜体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // 链接 · 仅放行安全 scheme（http/https/mailto/相对路径）· 其余退化为纯文本防 javascript: 等 XSS
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) =>
    SAFE_URL.test(url.trim())
      ? `<a href="${url}" target="_blank" rel="noreferrer noopener">${text}</a>`
      : text,
  );
  // 列表 · 先把 - 行转 <li> · 然后把连续 <li>（含中间空白）整体包 <ul>
  // 原 /s flag + 单次 replace 在多组列表场景下会贪婪吃中间非列表内容 · 改为 /g + 非贪婪并要求连续
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(?:<li>.*?<\/li>\s*)+/g, (m) => '<ul>' + m.trim() + '</ul>');
  // 引用
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  return html;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
