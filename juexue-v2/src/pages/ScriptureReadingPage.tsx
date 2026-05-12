// ScriptureReadingPage · /read/:slug/:lessonId
//   Apple 图书风沉浸阅读 · 进入显示工具栏 → 滚一屏后自动隐 → 点正文呼出/收起
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import Dialog from '@/components/Dialog';
import NotesDrawer from '@/components/NotesDrawer';
import { api, ApiError } from '@/lib/api';
import { useFontScale } from '@/lib/fontSize';
import { useLang } from '@/lib/i18n';
import { type Highlight, type HighlightColor, useCourseDetail, useEnrollments, useLessonHighlights, useLessonMeditation, useUpdateEnrollmentProgress } from '@/lib/queries';
import { useReadingTracker } from '@/lib/readingTracker';
import { toast } from '@/lib/toast';

interface LessonNote {
  id: string;
  title: string;
  anchorText: string | null;
  anchorIndex: number | null;
  body: string;
}

interface FlatLesson {
  chapterId: string;
  chapterTitle: string;
  lesson: { id: string; order: number; title: string; referenceText?: string | null };
}

export default function ScriptureReadingPage() {
  const { s } = useLang();
  const params = useParams<{ slug: string; lessonId: string }>();
  const slug = params.slug || '';
  const lessonId = params.lessonId || '';
  const nav = useNavigate();
  // 阅读追踪：scroll + 心跳 + visibility · 满足条件自动标已读
  useReadingTracker(lessonId || null);
  const location = useLocation();
  const { step } = useFontScale();

  // 阅读页只需要"当前 lesson 的原文"+ 全树 TOC 用于 prev/next 跳转
  // lessonId 模式：仅当前 lesson 带 referenceText/teachingSummary · 其他课只 id/title
  const course = useCourseDetail(slug, { lessonId });
  const enrollments = useEnrollments();
  // 该课时关联的观修（如有）· null = 无 · 用于底部入口
  const lessonMeditation = useLessonMeditation(lessonId || null);
  const [tocOpen, setTocOpen] = useState(false);
  // 工具栏可见性 · 进入默认显示 · 向下滚收 / 向上滚显（iOS Safari 风格）
  // 整屏点击正文也能 toggle
  const [chromeVisible, setChromeVisible] = useState(true);

  // 把所有章节的课时拍平成一维 · 方便上一课/下一课跨章节查找
  const flat: FlatLesson[] = useMemo(() => {
    if (!course.data) return [];
    const out: FlatLesson[] = [];
    for (const ch of course.data.chapters ?? []) {
      for (const l of ch.lessons ?? []) {
        out.push({ chapterId: ch.id, chapterTitle: ch.title, lesson: l });
      }
    }
    return out;
  }, [course.data]);

  const idx = useMemo(
    () => flat.findIndex((f) => f.lesson.id === lessonId),
    [flat, lessonId],
  );
  const cur = idx >= 0 ? flat[idx]! : null;
  const prev = idx > 0 ? flat[idx - 1]! : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1]! : null;

  const enrollment = useMemo(
    () => (enrollments.data ?? []).find((e) => e.courseId === course.data?.id),
    [enrollments.data, course.data?.id],
  );
  const completed = !!enrollment?.lessonsCompleted.includes(lessonId);

  // 记忆"上次阅读位置" · 用户每打开一课就把 enrollment.currentLessonId 推进到这里
  // 下次首页 / 详情页"继续阅读"按钮即可跳回
  // 注意：仅在 lesson 确实属于本 course 时 PATCH（idx >= 0）· 避免脏写
  const updateProgress = useUpdateEnrollmentProgress();
  const courseId = course.data?.id;
  const enrolledHere = !!enrollment;
  const savedLessonId = enrollment?.currentLessonId ?? null;
  const lessonValid = idx >= 0;
  useEffect(() => {
    if (!courseId || !lessonId || !enrolledHere || !lessonValid) return;
    if (savedLessonId === lessonId) return;
    updateProgress.mutate({ courseId, currentLessonId: lessonId });
    // updateProgress 是稳定 mutation 引用 · 仅依赖 courseId / lessonId / 状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId, enrolledHere, savedLessonId, lessonValid]);

  // lessonId 失效（被删 / 拼错）但 course 还有课 → 自动重定向到第一课
  // 与"继续阅读"按钮的 stale id 自愈对齐 · 不让用户卡在 404
  const firstLessonId = flat[0]?.lesson.id;
  useEffect(() => {
    if (!course.data || !lessonId) return;
    if (lessonValid) return;
    if (!firstLessonId) return;
    nav(`/read/${slug}/${firstLessonId}`, { replace: true });
  }, [course.data, lessonId, lessonValid, firstLessonId, slug, nav]);

  // 切换课时时滚回顶部 + 工具栏复位显示
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setChromeVisible(true);
  }, [lessonId]);

  // 笔记 · 抽屉 / 本课笔记列表 / 选段气泡
  const [notesOpen, setNotesOpen] = useState(false);
  const lessonNotes = useQuery({
    enabled: !!lessonId,
    queryKey: ['/api/notes', { lessonId }],
    queryFn: ({ signal }) => api.get<LessonNote[]>(`/api/notes?lessonId=${encodeURIComponent(lessonId)}`, { signal }),
  });
  const notesByAnchor = useMemo(() => {
    const map = new Map<number, LessonNote[]>();
    (lessonNotes.data ?? []).forEach((n) => {
      if (n.anchorIndex == null) return;
      const list = map.get(n.anchorIndex) ?? [];
      list.push(n);
      map.set(n.anchorIndex, list);
    });
    return map;
  }, [lessonNotes.data]);

  // 选段状态 · 不再悬浮气泡（与 iOS 原生 callout 冲突）· 改成视口底部固定工具栏
  // selection 计算字段：
  //   paragraphIndex · 段落索引（DOM data-paragraph-index）
  //   textStart / textEnd · 在该段 textContent 中的字符偏移（高亮 anchor 必需）
  //   text · 选中的文本（笔记 body）
  //   anchorText · 段落前 80 字快照（笔记 anchorText）
  const articleRef = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<{
    paragraphIndex: number;
    textStart: number;
    textEnd: number;
    text: string;
    anchorText: string;
  } | null>(null);

  // 计算 node + offset 在 root 内的文本字符偏移
  function textOffsetWithin(root: Element, container: Node, offset: number): number {
    let sum = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null = walker.nextNode();
    while (n) {
      if (n === container) return sum + offset;
      sum += (n.textContent ?? '').length;
      n = walker.nextNode();
    }
    return sum;
  }

  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !articleRef.current) { setSelection(null); return; }
      const anchorNode = sel.anchorNode;
      if (!anchorNode || !articleRef.current.contains(anchorNode)) { setSelection(null); return; }
      const text = sel.toString().trim();
      if (text.length < 2) { setSelection(null); return; }
      // 找 paragraph：往上找带 data-paragraph-index 的祖先
      let el: Node | null = anchorNode;
      while (el && (el as Element).getAttribute?.('data-paragraph-index') == null) {
        el = (el as Element).parentNode ?? null;
      }
      if (!el) { setSelection(null); return; }
      const paraEl = el as Element;
      const idx = Number(paraEl.getAttribute('data-paragraph-index'));
      const range = sel.getRangeAt(0);
      // 选段起止可能跨段 · 这里只支持单段（startContainer / endContainer 都在 paraEl 内）
      if (!paraEl.contains(range.startContainer) || !paraEl.contains(range.endContainer)) {
        setSelection(null);
        return;
      }
      const start = textOffsetWithin(paraEl, range.startContainer, range.startOffset);
      const end = textOffsetWithin(paraEl, range.endContainer, range.endOffset);
      if (end <= start) { setSelection(null); return; }
      const paraText = paraEl.textContent ?? '';
      setSelection({
        paragraphIndex: idx,
        textStart: Math.min(start, end),
        textEnd: Math.max(start, end),
        text,
        anchorText: paraText.slice(0, 80),
      });
    }
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  // 高亮 query + mutation
  const qc = useQueryClient();
  const highlights = useLessonHighlights(lessonId || null);
  const createHighlight = useMutation({
    mutationFn: (vars: { color: HighlightColor }) => {
      if (!selection) throw new Error('no selection');
      return api.post<Highlight>('/api/highlights', {
        lessonId,
        paragraphIndex: selection.paragraphIndex,
        textStart: selection.textStart,
        textEnd: selection.textEnd,
        anchorText: selection.text,
        color: vars.color,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lessons', lessonId, 'highlights'] });
      window.getSelection()?.removeAllRanges();
      setSelection(null);
    },
    onError: (e) => toast.error((e as ApiError).message),
  });
  const deleteHighlight = useMutation({
    mutationFn: (id: string) => api.del(`/api/highlights/${encodeURIComponent(id)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/lessons', lessonId, 'highlights'] }),
    onError: (e) => toast.error((e as ApiError).message),
  });

  // 高亮按段落分组
  const highlightsByPara = useMemo(() => {
    const m = new Map<number, Highlight[]>();
    (highlights.data ?? []).forEach((h) => {
      const arr = m.get(h.paragraphIndex) ?? [];
      arr.push(h);
      m.set(h.paragraphIndex, arr);
    });
    return m;
  }, [highlights.data]);

  function addNoteFromSelection() {
    if (!selection) return;
    sessionStorage.setItem('note-draft', JSON.stringify({
      lessonId,
      lessonSlug: slug, // 用于 NoteEditPage 计算 backTo
      body: selection.text,
      anchorText: selection.anchorText,
      anchorIndex: selection.paragraphIndex,
      autoDraft: true, // 自动调 LLM action=draft
    }));
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    nav('/notes/new?fromDraft=1');
  }

  async function copySelection() {
    if (!selection) return;
    try {
      await navigator.clipboard.writeText(selection.text);
      toast.ok(s('已复制', '已複製', 'Copied'));
    } catch {
      toast.warn(s('复制失败', '複製失敗', 'Copy failed'));
    }
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }

  // 向下滚 → 隐藏工具栏；向上滚 → 显示
  // 顶部 60px 内强制显示（避免顶端就给隐了 · 视觉断层）
  // 抖动阈值 8px 避免微抖动反复触发
  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY;
      if (Math.abs(dy) < 8) return;
      if (y < 60) {
        setChromeVisible(true);
      } else if (dy > 0) {
        setChromeVisible(false);
      } else {
        setChromeVisible(true);
      }
      lastY = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function bumpFont(dir: 1 | -1) {
    const opt = step(dir);
    if (!opt) return;
    toast.info(s(
      `字号：${opt.labelSc}`,
      `字號：${opt.labelTc}`,
      `Font: ${opt.labelEn}`,
    ));
  }

  if (course.isLoading) {
    return (
      <div style={{ padding: 'var(--sp-5)' }}>
        <Skeleton.Title style={{ marginBottom: 14 }} />
        <Skeleton.Line style={{ marginBottom: 8 }} />
        <Skeleton.Line style={{ marginBottom: 8 }} />
        <Skeleton.Line style={{ marginBottom: 8, width: '85%' }} />
        <Skeleton.Line style={{ marginBottom: 8 }} />
      </div>
    );
  }

  if (!cur) {
    // 走到这里 = course 加载完了但 lessonId 不在课程里 · 且无 firstLesson 兜底（或 useEffect 还没触发跳转）
    // 跳目录页让用户重新选课 · 比给死链 /courses 更友好
    return (
      <div style={{ padding: 'var(--sp-7) var(--sp-5)', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-3)' }}>{s('课时不存在', '課時不存在', 'Lesson not found')}</p>
        <Link
          to={slug ? `/scripture-detail?slug=${encodeURIComponent(slug)}` : '/courses'}
          className="btn btn-primary btn-pill"
          style={{ marginTop: 16, padding: '8px 18px', display: 'inline-block' }}
        >
          {s('返回目录', '返回目錄', 'Back to catalog')}
        </Link>
      </div>
    );
  }

  const c = course.data!;
  const { chapterTitle, lesson } = cur;

  const toolBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 14px',
    background: 'var(--glass-thick)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--r-pill)',
    color: 'var(--ink-2)',
    font: 'var(--text-caption)',
    fontWeight: 600,
    letterSpacing: 1,
    textDecoration: 'none',
    cursor: 'pointer',
  };
  const toolBtnDisabled: React.CSSProperties = { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' };

  return (
    <div>
      <div
        className="top-nav"
        style={{
          opacity: chromeVisible ? 1 : 0,
          transform: chromeVisible ? 'translateY(0)' : 'translateY(-100%)',
          pointerEvents: chromeVisible ? 'auto' : 'none',
          transition: 'opacity .25s var(--ease), transform .25s var(--ease)',
        }}
      >
        <button
          type="button"
          className="nav-back"
          onClick={() => {
            // location.key === 'default' = 直接 deep link 进入 · 历史栈空 · 用显式 nav 兜底
            // 否则 nav(-1) 走浏览器历史 · 由于 lesson 切换都用 replace · 上一条必然是 detail
            if (location.key === 'default') {
              nav(`/scripture-detail?slug=${encodeURIComponent(slug)}`, { replace: true });
            } else {
              nav(-1);
            }
          }}
          aria-label={s('返回', '返回', 'Back')}
        >
          <svg width="18" height="18" fill="none" stroke="#55463A" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span
          className="nav-title"
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {c.coverEmoji} {c.title}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => bumpFont(-1)}
            aria-label={s('字号减小', '字號減小', 'Smaller text')}
            title={s('字号 A-', '字號 A-', 'A-')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--r-sm)',
              background: 'var(--glass-thick)',
              border: '1px solid var(--glass-border)',
              color: 'var(--ink-2)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '0.75rem',
              letterSpacing: 0,
              cursor: 'pointer',
            }}
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => bumpFont(1)}
            aria-label={s('字号增大', '字號增大', 'Larger text')}
            title={s('字号 A+', '字號 A+', 'A+')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--r-sm)',
              background: 'var(--glass-thick)',
              border: '1px solid var(--glass-border)',
              color: 'var(--ink-2)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: 0,
              cursor: 'pointer',
            }}
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => setTocOpen(true)}
            aria-label={s('章节目录', '章節目錄', 'Catalog')}
            style={{
              width: 34,
              height: 32,
              borderRadius: 'var(--r-sm)',
              background: 'var(--glass-thick)',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div
        onClick={() => setChromeVisible((v) => !v)}
        style={{
          padding: '0 var(--sp-5) calc(var(--sp-8) + 80px)',
          cursor: 'pointer',
        }}
      >
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '1.5px', marginBottom: 'var(--sp-2)' }}>
          {chapterTitle} · {s('第 ' + lesson.order + ' 课', '第 ' + lesson.order + ' 課', 'Lesson ' + lesson.order)}
          <span style={{ marginLeft: 8, color: 'var(--ink-4)' }}>· {idx + 1} / {flat.length}</span>
          {completed && <span style={{ color: 'var(--sage-dark)', marginLeft: 8 }}>· ✓ {s('已学', '已學', 'Done')}</span>}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '1.375rem',
            color: 'var(--ink)',
            letterSpacing: 4,
            marginBottom: 'var(--sp-4)',
          }}
        >
          {lesson.title}
        </h1>

        {/* 原文 · 按段落拆 · 段落旁显示笔记 💬 · 选段弹「加笔记」气泡 */}
        <article
          ref={articleRef}
          style={{
            padding: 'var(--sp-2) 0 var(--sp-3)',
            font: 'var(--text-body-serif)',
            fontSize: '1rem',
            lineHeight: 1.9,
            letterSpacing: 1,
            color: 'var(--ink)',
            wordBreak: 'break-word',
          }}
        >
          {(lesson.referenceText ?? '').trim() ? (
            splitParagraphs(lesson.referenceText!).map((para, idx) => {
              const notes = notesByAnchor.get(idx) ?? [];
              const paraHighlights = highlightsByPara.get(idx) ?? [];
              return (
                <p
                  key={idx}
                  data-paragraph-index={idx}
                  style={{
                    margin: '0 0 var(--sp-3)',
                    whiteSpace: 'pre-wrap',
                    position: 'relative',
                    paddingRight: notes.length > 0 ? 28 : 0,
                  }}
                >
                  {renderParaWithHighlights(para, paraHighlights, (id) => deleteHighlight.mutate(id))}
                  {notes.length > 0 && (
                    <Link
                      to={`/notes/${notes[0]!.id}`}
                      aria-label={`本段有 ${notes.length} 条笔记`}
                      title={notes.map((n) => n.title || '(无标题)').join(' · ')}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        fontSize: '0.95rem',
                        color: 'var(--saffron-dark)',
                        textDecoration: 'none',
                        background: 'var(--saffron-pale)',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      💬{notes.length > 1 ? notes.length : ''}
                    </Link>
                  )}
                </p>
              );
            })
          ) : (
            <p>{s('（本课时尚无原文）', '（本課時尚無原文）', '(No reference text yet)')}</p>
          )}
        </article>

        {/* 选段工具栏移到视口底部 · portal 渲到 body 避免 .page-enter transform 影响 fixed */}
      </div>

      {/* 观修 + 工具栏走 createPortal · 渲到 document.body 避免被 .page-enter 的
          transform 创建的 containing block 影响 fixed 定位（之前 bug：栏漂到页面底而非视口） */}
      {createPortal(
        <>
          {/* 选段工具栏 · 底部固定 · 4 色标记 + 拷贝 + 笔记 · selection 存在时出现 */}
          {selection && (
            <div
              role="toolbar"
              aria-label={s('选段操作', '選段操作', 'Selection actions')}
              style={{
                position: 'fixed',
                left: 'var(--sp-3)',
                right: 'var(--sp-3)',
                bottom: `calc(env(safe-area-inset-bottom, 0px) + 12px)`,
                padding: '10px 12px',
                background: 'rgba(43,34,24,0.95)',
                color: '#fff',
                borderRadius: 'var(--r-lg)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                zIndex: 95,
                maxWidth: 460,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              {/* 4 色标记 */}
              <div style={{ display: 'flex', gap: 6 }}>
                {(['yellow', 'green', 'blue', 'pink'] as HighlightColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => createHighlight.mutate({ color: c })}
                    aria-label={s('标记', '標記', 'Highlight') + ' ' + c}
                    title={c}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: HIGHLIGHT_BG[c],
                      border: '2px solid rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
              <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.2)' }} aria-hidden />
              <button
                type="button"
                onClick={copySelection}
                style={toolbarBtnStyle}
              >
                {s('拷贝', '拷貝', 'Copy')}
              </button>
              <button
                type="button"
                onClick={addNoteFromSelection}
                style={toolbarBtnStyle}
              >
                📝 {s('笔记', '筆記', 'Note')}
              </button>
              <button
                type="button"
                onClick={() => { window.getSelection()?.removeAllRanges(); setSelection(null); }}
                aria-label={s('取消', '取消', 'Cancel')}
                style={{
                  marginLeft: 'auto',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* 观修入口（如该课时有发布观修）· 底部栏上方 · 跟工具栏联动显示 */}
          {lessonMeditation.data && lessonMeditation.data.isPublished && (
            <Link
              to={`/meditation/${lessonMeditation.data.id}`}
              style={{
                position: 'fixed',
                left: 'var(--sp-5)',
                right: 'var(--sp-5)',
                bottom: `calc(64px + env(safe-area-inset-bottom, 0px))`,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                background: 'var(--saffron)',
                color: '#fff',
                borderRadius: 'var(--r)',
                boxShadow: '0 4px 16px rgba(224,120,86,.35)',
                textDecoration: 'none',
                zIndex: 21,
                opacity: chromeVisible ? 1 : 0,
                transform: chromeVisible ? 'translateY(0)' : 'translateY(120%)',
                pointerEvents: chromeVisible ? 'auto' : 'none',
                transition: 'opacity .25s var(--ease), transform .25s var(--ease)',
                letterSpacing: 1,
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>🧘</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                  {s('进入观修', '進入觀修', 'Start meditation')}
                </div>
                <div style={{ font: 'var(--text-caption)', opacity: .85, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lessonMeditation.data.title}
                  {lessonMeditation.data.videoDurationSec > 0 && (
                    <span> · {Math.floor(lessonMeditation.data.videoDurationSec / 60)}:{String(lessonMeditation.data.videoDurationSec % 60).padStart(2, '0')}</span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: '1.2rem' }}>→</span>
            </Link>
          )}

          {/* 底部操作栏 · 固定在屏底 · 跟顶部 nav 联动显示/隐藏 */}
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              padding: `var(--sp-3) var(--sp-5) calc(var(--sp-3) + env(safe-area-inset-bottom, 0px))`,
              display: 'flex',
              gap: 'var(--sp-2)',
              alignItems: 'center',
              background: 'var(--glass-thick)',
              backdropFilter: 'var(--blur)',
              WebkitBackdropFilter: 'var(--blur)',
              borderTop: '1px solid var(--glass-border)',
              zIndex: 20,
              opacity: chromeVisible ? 1 : 0,
              transform: chromeVisible ? 'translateY(0)' : 'translateY(100%)',
              pointerEvents: chromeVisible ? 'auto' : 'none',
              transition: 'opacity .25s var(--ease), transform .25s var(--ease)',
            }}
          >
        {prev ? (
          <Link
            to={`/read/${c.slug}/${prev.lesson.id}`}
            replace
            style={{ ...toolBtn, flex: 1 }}
            aria-label={s('上一课', '上一課', 'Previous lesson')}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>{s('上一课', '上一課', 'Prev')}</span>
          </Link>
        ) : (
          <span style={{ ...toolBtn, ...toolBtnDisabled, flex: 1 }} aria-disabled="true">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>{s('上一课', '上一課', 'Prev')}</span>
          </span>
        )}
        <Link
          to={`/quiz/${lesson.id}?courseId=${c.id}&slug=${encodeURIComponent(c.slug)}&from=reading${next ? '&nextLessonId=' + next.lesson.id : ''}`}
          className="btn btn-primary btn-pill"
          style={{ flex: 1.4, padding: 12, justifyContent: 'center' }}
        >
          {s('开始答题', '開始答題', 'Start quiz')}
        </Link>
        {next ? (
          <Link
            to={`/read/${c.slug}/${next.lesson.id}`}
            replace
            style={{ ...toolBtn, flex: 1 }}
            aria-label={s('下一课', '下一課', 'Next lesson')}
          >
            <span>{s('下一课', '下一課', 'Next')}</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </Link>
        ) : (
          <span style={{ ...toolBtn, ...toolBtnDisabled, flex: 1 }} aria-disabled="true">
            <span>{s('下一课', '下一課', 'Next')}</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        )}
          </div>
        </>,
        document.body,
      )}

      {/* 笔记 FAB · 浮于右下 · 仅当 lessonId 有效时显示 · 点击开抽屉不跳页 */}
      {lessonId && (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          aria-label={s('本课笔记', '本課筆記', 'Lesson notes')}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 96,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.3rem',
            zIndex: 50,
            opacity: chromeVisible ? 1 : 0,
            pointerEvents: chromeVisible ? 'auto' : 'none',
            transition: 'opacity .25s var(--ease)',
          }}
        >
          📝
          {(lessonNotes.data?.length ?? 0) > 0 && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 999,
                background: 'var(--crimson)',
                border: '2px solid var(--bg)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {(lessonNotes.data!.length) > 9 ? '9+' : lessonNotes.data!.length}
            </span>
          )}
        </button>
      )}

      {/* 抽屉 · 本课笔记列表 + 新建按钮 */}
      {lessonId && (
        <NotesDrawer
          open={notesOpen}
          onClose={() => setNotesOpen(false)}
          lessonId={lessonId}
          lessonText={lesson.referenceText ?? ''}
        />
      )}

      {/* 目录 sheet · 当前课时高亮 · 点击直跳 */}
      <Dialog open={tocOpen} onClose={() => setTocOpen(false)} title={s('目录', '目錄', 'Catalog')}>
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: 'var(--sp-2) 0' }}>
          {course.data?.chapters?.map((ch) => (
            <div key={ch.id} style={{ marginBottom: 'var(--sp-3)' }}>
              <div
                style={{
                  font: 'var(--text-caption)',
                  color: 'var(--ink-3)',
                  letterSpacing: 2,
                  fontWeight: 700,
                  padding: 'var(--sp-2) 0',
                }}
              >
                {s('第 ' + ch.order + ' 章', '第 ' + ch.order + ' 章', 'Ch ' + ch.order)} · {ch.title}
              </div>
              <div className="menu-card">
                {(ch.lessons ?? []).map((l) => {
                  const done = !!enrollment?.lessonsCompleted.includes(l.id);
                  const isCur = l.id === lessonId;
                  return (
                    <Link
                      key={l.id}
                      to={`/read/${c.slug}/${l.id}`}
                      replace
                      onClick={() => setTocOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-3)',
                        padding: 'var(--sp-3) var(--sp-4)',
                        textDecoration: 'none',
                        color: 'inherit',
                        background: isCur ? 'var(--saffron-pale)' : 'transparent',
                        borderLeft: isCur ? '3px solid var(--saffron)' : '3px solid transparent',
                      }}
                    >
                      <span style={{ minWidth: 24, font: 'var(--text-caption)', color: 'var(--ink-4)', fontWeight: 700 }}>
                        {l.order}
                      </span>
                      <span style={{ flex: 1, font: 'var(--text-body)', color: isCur ? 'var(--saffron-dark)' : 'var(--ink)' }}>
                        {l.title}
                      </span>
                      {done && (
                        <span style={{ fontSize: 14, color: 'var(--sage-dark)', fontWeight: 700 }}>✓</span>
                      )}
                      {isCur && !done && (
                        <span style={{ fontSize: 12, color: 'var(--saffron-dark)', fontWeight: 700 }}>{s('当前', '當前', 'Now')}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

// 把法本原文按段落切 · 优先双换行 · 兜底单换行
function splitParagraphs(text: string): string[] {
  const byDouble = text.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  if (byDouble.length > 1) return byDouble;
  // 单 \n 兜底 · 但每段至少 8 字防止把短行单独成段
  const bySingle = text.split(/\n/g).map((p) => p.trim()).filter((p) => p.length > 0);
  return bySingle.length > 1 ? bySingle : [text.trim()];
}

// 4 色高亮 · 浅色背景 + 不影响阅读对比
const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 220, 80, 0.55)',
  green: 'rgba(120, 200, 130, 0.45)',
  blue: 'rgba(120, 180, 240, 0.45)',
  pink: 'rgba(245, 140, 180, 0.45)',
};

// 工具栏按钮样式 · 复用
const toolbarBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 'var(--r-pill)',
  background: 'rgba(255,255,255,0.18)',
  color: '#fff',
  border: 'none',
  font: 'var(--text-caption)',
  fontSize: '0.8rem',
  fontWeight: 600,
  letterSpacing: 1,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

// 按高亮 ranges 切段落文本 · 渲染为 [text, <mark>, text, <mark>, ...]
// 点击 <mark> 删除该高亮
function renderParaWithHighlights(
  para: string,
  highlights: Highlight[],
  onDelete: (id: string) => void,
): React.ReactNode {
  if (highlights.length === 0) return para;
  // 按 textStart 升序 · 合并重叠的（不支持嵌套 · 取后者）
  const sorted = [...highlights].sort((a, b) => a.textStart - b.textStart);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of sorted) {
    const start = Math.max(h.textStart, cursor);
    const end = Math.min(h.textEnd, para.length);
    if (end <= start) continue;
    if (start > cursor) out.push(para.slice(cursor, start));
    out.push(
      <mark
        key={h.id}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm('删除这条标记？')) onDelete(h.id);
        }}
        style={{
          background: HIGHLIGHT_BG[h.color],
          color: 'inherit',
          padding: '0 1px',
          borderRadius: 2,
          cursor: 'pointer',
        }}
      >
        {para.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < para.length) out.push(para.slice(cursor));
  return out;
}
