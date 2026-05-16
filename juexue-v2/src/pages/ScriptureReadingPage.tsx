// ScriptureReadingPage · /read/:slug/:lessonId
//   Apple 图书风沉浸阅读 · 进入显示工具栏 → 滚一屏后自动隐 → 点正文呼出/收起
//
// 拆分（优化 1）后 · 本主组件仅负责:
//   - 状态管理（chromeVisible · selection · tocOpen · notesOpen）
//   - 数据 queries（course · enrollments · notes · highlights · meditation）
//   - mutations（createHighlight · deleteHighlight · readingProgress）
//   - 副作用（scroll · selection · scroll-to-top · 进度推进 · 自愈重定向）
//   - 子组件编排（TopBar · Article · SelectionToolbar · BottomNav · Fab · TocSheet）
//
// 拆出去的子组件位于 components/reading/ · 见各文件头说明。
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import NotesDrawer from '@/components/NotesDrawer';
import ReadingTopBar from '@/components/reading/ReadingTopBar';
import ReadingArticle from '@/components/reading/ReadingArticle';
import ReadingSelectionToolbar from '@/components/reading/ReadingSelectionToolbar';
import ReadingBottomNav from '@/components/reading/ReadingBottomNav';
import ReadingNotesFab from '@/components/reading/ReadingNotesFab';
import ReadingTocSheet from '@/components/reading/ReadingTocSheet';
import { api, ApiError } from '@/lib/api';
import { useFontScale } from '@/lib/fontSize';
import { useLang } from '@/lib/i18n';
import { type Highlight, type HighlightColor, useCourseDetail, useEnrollments, useLessonHighlights, useLessonMeditation, useUpdateEnrollmentProgress } from '@/lib/queries';
import { useReadingTracker } from '@/lib/readingTracker';
import { textOffsetWithin } from '@/lib/reading-utils';
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

  function cancelSelection() {
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

  function onBack() {
    // location.key === 'default' = 直接 deep link 进入 · 历史栈空 · 用显式 nav 兜底
    // 否则 nav(-1) 走浏览器历史 · 由于 lesson 切换都用 replace · 上一条必然是 detail
    if (location.key === 'default') {
      nav(`/scripture-detail?slug=${encodeURIComponent(slug)}`, { replace: true });
    } else {
      nav(-1);
    }
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
  const meditationEntry = lessonMeditation.data && lessonMeditation.data.isPublished
    ? { id: lessonMeditation.data.id, title: lessonMeditation.data.title, videoDurationSec: lessonMeditation.data.videoDurationSec }
    : null;

  return (
    <div>
      <ReadingTopBar
        chromeVisible={chromeVisible}
        courseEmoji={c.coverEmoji ?? ''}
        courseTitle={c.title}
        onBack={onBack}
        onTocOpen={() => setTocOpen(true)}
        onFontBump={bumpFont}
      />

      <ReadingArticle
        articleRef={articleRef}
        chapterTitle={chapterTitle}
        lessonOrder={lesson.order}
        lessonTitle={lesson.title}
        lessonReferenceText={lesson.referenceText}
        flatIdx={idx}
        flatTotal={flat.length}
        completed={completed}
        notesByAnchor={notesByAnchor}
        highlightsByPara={highlightsByPara}
        onDeleteHighlight={(id) => deleteHighlight.mutate(id)}
        onToggleChrome={() => setChromeVisible((v) => !v)}
      />

      {/* 选段工具栏 + 观修入口 + 底部操作栏 · createPortal 渲到 body
          避免被 .page-enter 的 transform 创建的 containing block 影响 fixed 定位
          （之前 bug：栏漂到页面底而非视口 · 见 docs/CSS-GOTCHAS.md 坑 1） */}
      {createPortal(
        <>
          {selection && (
            <ReadingSelectionToolbar
              onHighlight={(color) => createHighlight.mutate({ color })}
              onCopy={copySelection}
              onNote={addNoteFromSelection}
              onCancel={cancelSelection}
            />
          )}
          <ReadingBottomNav
            chromeVisible={chromeVisible}
            courseSlug={c.slug}
            courseId={c.id}
            lessonId={lesson.id}
            prev={prev}
            next={next}
            meditation={meditationEntry}
          />
        </>,
        document.body,
      )}

      {/* 笔记 FAB · 浮于右下 · 仅当 lessonId 有效时显示 · 点击开抽屉不跳页 */}
      {lessonId && (
        <ReadingNotesFab
          chromeVisible={chromeVisible}
          notesCount={lessonNotes.data?.length ?? 0}
          onOpen={() => setNotesOpen(true)}
        />
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
      <ReadingTocSheet
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        courseSlug={c.slug}
        chapters={c.chapters ?? []}
        currentLessonId={lessonId}
        completedLessonIds={enrollment?.lessonsCompleted ?? []}
      />
    </div>
  );
}
