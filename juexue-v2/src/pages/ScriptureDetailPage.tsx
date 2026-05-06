// ScriptureDetailPage · 法本目录
//   ?slug=xxx [&mode=quiz]
//
// 视觉参考 Apple 图书风格（用户提供截图）：
//   · 顶部用 course.coverEmoji / coverImageUrl 提色 · 背景柔和渐变铺满
//   · 居中封面卡（120px 宽 · 不占大版面）
//   · 标题 + 作者 居中
//   · 主操作 CTA：开始/继续阅读 + 副 CTA：加入/退出
//   · 章节目录在下方
//
// 顶部 nav：
//   · 左上：返回（保留）· 中：截断标题
//   · 右上：⋯ 菜单弹出（加入/退出报名 · 重置进度 · 复制链接）
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CourseCover from '@/components/CourseCover';
import Dialog from '@/components/Dialog';
import ErrorState from '@/components/ErrorState';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { notification } from '@/lib/haptics';
import { useLang } from '@/lib/i18n';
import { setMainCourseId, useMainCourseId } from '@/lib/mainCourse';
import { useCourseDetail, useCourseMeditations, useEnrollments } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function ScriptureDetailPage() {
  const { s } = useLang();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const slug = params.get('slug') || '';
  // 方案 B 后 mode 不再切换主链接 · 阅读 / 答题 / 观修 都是显式按钮
  // mode 参数保留以防外部链接传入 · 但不再用于布局判断
  const qc = useQueryClient();

  // 详情页只显示 TOC + 章节 · 不渲染原文 · 用 lite 省几 MB payload
  const course = useCourseDetail(slug, { lite: true });
  const enrollments = useEnrollments();
  // 该法本下所有已发布观修 · 用于课时行展示 🧘 入口
  const meditations = useCourseMeditations(course.data?.id ?? null);
  const meditationByLesson = useMemo(() => {
    const m = new Map<string, { id: string; title: string; videoDurationSec: number }>();
    (meditations.data ?? []).forEach((med) => {
      if (med.lessonId) m.set(med.lessonId, { id: med.id, title: med.title, videoDurationSec: med.videoDurationSec });
    });
    return m;
  }, [meditations.data]);

  const enrollment = useMemo(
    () => (enrollments.data ?? []).find((e) => e.courseId === course.data?.id),
    [enrollments.data, course.data?.id],
  );
  const completedSet = useMemo(
    () => new Set(enrollment?.lessonsCompleted ?? []),
    [enrollment],
  );

  // 当前是否为主修法本
  const mainCourseId = useMainCourseId();
  const isMainCourse = !!course.data && mainCourseId === course.data.id;

  const [menuOpen, setMenuOpen] = useState(false);

  // 顶部 nav · 滚出 hero 后转玻璃模糊 + 显示标题（参考 Apple 图书）
  // hero 区高度 ~ 360px · 滚到 200 时开始过渡 · 250 时完成
  const [scrolled, setScrolled] = useState(0); // 0..1 渐变进度
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const start = 180;
      const end = 280;
      const t = Math.max(0, Math.min(1, (y - start) / (end - start)));
      setScrolled(t);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const enroll = useMutation({
    mutationFn: () => api.post('/api/enrollments', { courseId: course.data!.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/enrollments'] });
      notification('success');
      toast.ok(s('已加入学习', '已加入學習', 'Joined'));
      setMenuOpen(false);
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const unenroll = useMutation({
    mutationFn: () => api.del(`/api/enrollments/${encodeURIComponent(course.data!.id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/enrollments'] });
      notification('warning');
      toast.ok(s('已退出学习', '已退出學習', 'Unenrolled'));
      setMenuOpen(false);
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  // 重置进度 = 退课再加（清掉 lessonsCompleted）· 后端没有专用 reset 端点
  const reset = useMutation({
    mutationFn: async () => {
      const cid = course.data!.id;
      await api.del(`/api/enrollments/${encodeURIComponent(cid)}`);
      await api.post('/api/enrollments', { courseId: cid });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/enrollments'] });
      notification('success');
      toast.ok(s('进度已重置', '進度已重置', 'Progress reset'));
      setMenuOpen(false);
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  function copyLink() {
    const link = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(
        () => toast.ok(s('链接已复制', '連結已複製', 'Link copied')),
        () => toast.warn(s('复制失败', '複製失敗', 'Copy failed')),
      );
    } else {
      toast.warn(s('当前浏览器不支持复制', '當前瀏覽器不支援複製', 'Browser unsupported'));
    }
    setMenuOpen(false);
  }

  if (!slug) return <Empty title={s('参数缺失', '參數缺失', 'Missing slug')} />;

  if (course.isLoading) {
    return (
      <div style={{ padding: 'var(--sp-5)' }}>
        <Skeleton.Card />
        <div style={{ height: 'var(--sp-3)' }} />
        <Skeleton.List count={4} variant="thumb" />
      </div>
    );
  }
  if (course.isError) {
    return <ErrorState error={course.error} onRetry={() => course.refetch()} />;
  }

  if (!course.data) return <Empty title={s('法本不存在', '法本不存在', 'Text not found')} />;

  const c = course.data;
  const chapters = c.chapters ?? [];
  const totalLessons = chapters.reduce((sum, ch) => sum + (ch.lessons?.length ?? 0), 0);
  const doneCount = chapters.reduce(
    (sum, ch) => sum + (ch.lessons ?? []).filter((l) => completedSet.has(l.id)).length,
    0,
  );
  const pct = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;

  // 找到"继续阅读"目标 lesson:
  //   1. currentLessonId 未读完 → 回到该课
  //   2. currentLessonId 已读完且后面还有课 → 跳到下一课
  //   3. currentLessonId 已读完且是最后一课 → 留在最后一课
  //   4. 无 currentLessonId → 首课时
  type LessonItem = NonNullable<(typeof chapters)[number]['lessons']>[number];
  const flatAll: LessonItem[] = chapters.flatMap((ch) => ch.lessons ?? []);
  const firstLesson = flatAll[0];
  const currentLessonId = enrollment?.currentLessonId;
  const savedIdx = currentLessonId ? flatAll.findIndex((l) => l.id === currentLessonId) : -1;
  let continueLesson: LessonItem | undefined;
  if (savedIdx >= 0) {
    const saved = flatAll[savedIdx]!;
    if (completedSet.has(saved.id) && savedIdx < flatAll.length - 1) {
      continueLesson = flatAll[savedIdx + 1]!;
    } else {
      continueLesson = saved;
    }
  } else {
    continueLesson = firstLesson;
  }
  const hasReadHistory = !!currentLessonId || completedSet.size > 0;

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      background: 'var(--bg)',
      // 必须裁掉横向溢出 · 否则下方 hero 的 transform: scale(1.5) blur 层
      // 会撑出右侧水平滚动条
      overflowX: 'clip',
    }}>
      {/* Hero 背景 · 有封面图时用 blur 模糊提色（参考 Apple 图书）· 否则 saffron 渐变 */}
      {c.coverImageUrl ? (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 320,
              backgroundImage: `url(${c.coverImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(60px) saturate(1.5) brightness(1.2)',
              transform: 'scale(1.5)',
              transformOrigin: 'center top',
              opacity: 0.5,
              pointerEvents: 'none',
              zIndex: 0,
            }}
            aria-hidden
          />
          {/* 底部渐隐到 bg · 让目录区融入 */}
          <div
            style={{
              position: 'absolute',
              top: 220,
              left: 0,
              right: 0,
              height: 120,
              background: 'linear-gradient(180deg, transparent 0%, var(--bg) 100%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
            aria-hidden
          />
        </>
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 320,
            background: 'linear-gradient(180deg, var(--saffron-pale) 0%, var(--saffron-pale) 50%, var(--bg) 100%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
          aria-hidden
        />
      )}

      {/* 顶部 nav · hero 区透明 · 滚出 hero 后渐变为玻璃模糊 + 显示法本名 */}
      <div
        className="top-nav"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          // 滚动联动：透明 → 玻璃白半透明
          background: scrolled > 0
            ? `rgba(255, 250, 244, ${0.85 * scrolled})`
            : 'transparent',
          // 模糊度跟随 scroll 渐变
          backdropFilter: scrolled > 0 ? `blur(${12 * scrolled}px) saturate(1.3)` : 'none',
          WebkitBackdropFilter: scrolled > 0 ? `blur(${12 * scrolled}px) saturate(1.3)` : 'none',
          // 底部细线 · 玻璃出现后才显
          borderBottom: scrolled > 0.5 ? '1px solid rgba(43,34,24,.06)' : 'none',
          transition: 'border-color .2s var(--ease)',
        }}
      >
        <button
          type="button"
          className="nav-back"
          onClick={() => nav(-1)}
          aria-label={s('返回', '返回', 'Back')}
          style={{ background: 'var(--glass-thick)', backdropFilter: 'var(--blur)' }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span
          className="nav-title"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: scrolled,
            transform: `translateY(${(1 - scrolled) * 8}px)`,
            transition: 'opacity .15s var(--ease), transform .15s var(--ease)',
            pointerEvents: scrolled > 0.5 ? 'auto' : 'none',
          }}
        >
          {c.coverEmoji} {c.title}
        </span>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={s('更多操作', '更多操作', 'More')}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--glass-thick)',
            backdropFilter: 'var(--blur)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--ink-2)',
          }}
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {/* Hero · 紧凑 · 缩小封面让目录早展示 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'var(--sp-2) var(--sp-5) var(--sp-4)',
          textAlign: 'center',
        }}
      >
        {/* 封面 · 144×192 · 视觉主体更突出
            用 CourseCover 复用 list 页同套逻辑：
            有图 → 直接渲染原图（保留原宽高比 · 不裁切不留白）
            无图 → 144×192 设计封面（标题 + 书脊 + emoji）*/}
        {c.coverImageUrl ? (
          <img
            src={c.coverImageUrl}
            alt={c.title}
            style={{
              display: 'block',
              maxWidth: 160,
              maxHeight: 240,
              width: 'auto',
              height: 'auto',
              margin: '0 auto var(--sp-4)',
              borderRadius: 'var(--r-md)',
              boxShadow: '0 16px 38px rgba(43,34,24,.32)',
            }}
          />
        ) : (
          <div
            style={{
              width: 144,
              height: 192,
              margin: '0 auto var(--sp-4)',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
              boxShadow: '0 16px 38px rgba(43,34,24,.32)',
            }}
          >
            <CourseCover course={c} width="100%" height="100%" />
          </div>
        )}

        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.375rem',
            fontWeight: 700,
            color: 'var(--ink)',
            letterSpacing: 4,
            marginBottom: 4,
          }}
        >
          {c.title}
        </h1>
        {c.author && (
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-4)' }}>
            {c.author}
          </p>
        )}
        {!c.author && <div style={{ height: 'var(--sp-4)' }} />}

        {/* 统计 + 「阅读」按钮整合卡 · 4 列同一行 · 圆角矩形 */}
        <div
          className="glass-card-thick"
          style={{
            maxWidth: 380,
            margin: '0 auto',
            padding: 'var(--sp-3) var(--sp-3)',
            borderRadius: 'var(--r-lg)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1px 1fr 1px 1fr auto',
              alignItems: 'center',
              gap: 'var(--sp-2)',
            }}
          >
            <Stat num={chapters.length} label={s('章', '章', 'Ch')} />
            <Sep />
            <Stat num={totalLessons} label={s('课', '課', 'Le')} />
            <Sep />
            <Stat num={pct + '%'} label={s('已学', '已學', 'Done')} color="var(--sage-dark)" />
            {continueLesson ? (
              <Link
                to={`/read/${c.slug}/${continueLesson.id}`}
                className="btn btn-primary"
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--r-lg)',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  letterSpacing: 2,
                  whiteSpace: 'nowrap',
                  marginLeft: 'var(--sp-2)',
                }}
              >
                {hasReadHistory
                  ? s('继续阅读', '繼續閱讀', 'Continue')
                  : s('开始阅读', '開始閱讀', 'Start')}
              </Link>
            ) : (
              <span
                aria-disabled
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--r-lg)',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  letterSpacing: 2,
                  background: 'var(--glass-thick)',
                  color: 'var(--ink-4)',
                  border: '1px solid var(--glass-border)',
                  cursor: 'not-allowed',
                  marginLeft: 'var(--sp-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                —
              </span>
            )}
          </div>
        </div>

        {/* 未加入时 · 在卡下方加一个小提示链 · 不再用大按钮 */}
        {!enrollment && firstLesson && (
          <button
            type="button"
            onClick={() => enroll.mutate()}
            disabled={enroll.isPending}
            style={{
              marginTop: 'var(--sp-3)',
              padding: '6px 14px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--saffron-pale)',
              color: 'var(--saffron-dark)',
              border: '1px solid var(--saffron-light)',
              font: 'var(--text-caption)',
              fontWeight: 700,
              letterSpacing: 1,
              cursor: enroll.isPending ? 'default' : 'pointer',
            }}
          >
            {enroll.isPending ? '…' : '+ ' + s('加入学习同步进度', '加入學習同步進度', 'Join to sync progress')}
          </button>
        )}

        {c.description && (
          <p
            style={{
              font: 'var(--text-caption)',
              color: 'var(--ink-2)',
              letterSpacing: 1,
              lineHeight: 1.7,
              maxWidth: 380,
              margin: 'var(--sp-3) auto 0',
              padding: '0 var(--sp-2)',
            }}
          >
            {c.description}
          </p>
        )}
      </div>

      {/* 目录 section */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 var(--sp-5) var(--sp-8)' }}>
        <h2
          style={{
            font: 'var(--text-caption)',
            color: 'var(--ink-3)',
            letterSpacing: 2,
            marginBottom: 'var(--sp-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
          {s('目录', '目錄', 'Catalog')}
          {!enrollment && (
            <span style={{ marginLeft: 'auto', font: 'var(--text-caption)', color: 'var(--ink-4)', fontWeight: 400, letterSpacing: 1 }}>
              {s('未加入 · 进度不同步', '未加入 · 進度不同步', "Not enrolled · won't track")}
            </span>
          )}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {chapters.map((ch) => {
            const lessons = ch.lessons ?? [];
            const chCompleted = lessons.filter((l) => completedSet.has(l.id)).length;
            const chPct = lessons.length > 0 ? Math.round((chCompleted / lessons.length) * 100) : 0;
            return (
              <details
                key={ch.id}
                className="glass-card-thick"
                style={{ padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--r-lg)' }}
                /* 默认全部展开 · 让用户直接看到课时 · 不需要再点章节展开 */
                open
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    listStyle: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: chPct === 100 ? 'var(--sage-dark)' : 'var(--saffron)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-serif)',
                      fontWeight: 700,
                      fontSize: '.875rem',
                      flexShrink: 0,
                    }}
                  >
                    {ch.order}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', fontSize: '.9375rem', letterSpacing: 2 }}>
                      {ch.title}
                    </div>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
                      {lessons.length} {s('课', '課', 'lessons')} · {chPct}%
                    </div>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    style={{ color: 'var(--ink-4)', transition: 'transform .2s var(--ease)' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'var(--sp-3)' }}>
                  {lessons.map((l) => {
                    const done = completedSet.has(l.id);
                    const lessonMed = meditationByLesson.get(l.id);
                    return (
                      <div
                        key={l.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--sp-2)',
                          padding: '10px 12px',
                          borderRadius: 'var(--r-sm)',
                          background: done ? 'var(--sage-light)' : 'var(--glass)',
                          border: '1px solid ' + (done ? 'var(--sage)' : 'var(--glass-border)'),
                        }}
                      >
                        <Link
                          to={`/read/${c.slug}/${l.id}`}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--sp-3)',
                            textDecoration: 'none',
                            color: 'inherit',
                            minWidth: 0,
                          }}
                        >
                          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', fontWeight: 700, minWidth: 24 }}>
                            {l.order}
                          </span>
                          <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.title}
                          </span>
                        </Link>

                        {/* 副入口：📝 答题 · 🧘 观修 · 仅图标（无 label · 不喧宾夺主） */}
                        <Link
                          to={`/quiz/${l.id}?courseId=${c.id}&slug=${encodeURIComponent(c.slug)}&from=detail`}
                          aria-label={s('答题', '答題', 'Quiz')}
                          title={s('答题', '答題', 'Quiz')}
                          style={iconBtn(false)}
                        >
                          <IconQuiz />
                        </Link>
                        {lessonMed && (
                          <Link
                            to={`/meditation/${lessonMed.id}`}
                            aria-label={s('观修', '觀修', 'Meditation')}
                            title={lessonMed.title}
                            style={iconBtn(true)}
                          >
                            <IconMeditation />
                          </Link>
                        )}

                        {/* 主入口：✓已学 / [阅读 →] · 维持原样 */}
                        {done ? (
                          <span style={{ fontSize: 14, color: 'var(--sage-dark)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            ✓ {s('已学', '已學', 'Done')}
                          </span>
                        ) : (
                          <Link
                            to={`/read/${c.slug}/${l.id}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 12px',
                              borderRadius: 'var(--r-lg)',
                              background: 'var(--saffron-pale)',
                              color: 'var(--saffron-dark)',
                              border: '1px solid var(--saffron-light)',
                              font: 'var(--text-caption)',
                              fontWeight: 700,
                              letterSpacing: 1,
                              whiteSpace: 'nowrap',
                              textDecoration: 'none',
                            }}
                          >
                            {s('阅读', '閱讀', 'Read')}
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" viewBox="0 0 24 24">
                              <polyline points="9 6 15 12 9 18" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      {/* 底部 action sheet · 与 Dialog UI 风格统一（玻璃 + 圆角 + 滑入） */}
      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title={s('更多操作', '更多操作', 'More actions')}>
        <div className="menu-card" style={{ marginTop: 'var(--sp-2)' }}>
          {!enrollment ? (
            <SheetItem
              icon="✓"
              label={s('加入学习', '加入學習', 'Join')}
              sub={s('加入后进度自动同步', '加入後進度自動同步', 'Progress will sync')}
              disabled={enroll.isPending}
              onClick={() => { setMenuOpen(false); enroll.mutate(); }}
            />
          ) : (
            <>
              <SheetItem
                icon="↻"
                label={s('重置进度', '重置進度', 'Reset progress')}
                sub={s('清空已学课时记录', '清空已學課時記錄', 'Clear lesson completion')}
                disabled={reset.isPending}
                onClick={async () => {
                  if (!(await confirmAsync({
                    title: s('重置进度？', '重置進度？', 'Reset progress?'),
                    body: s('已学课时记录将清空（答题记录保留）', '已學課時記錄將清空（答題記錄保留）', 'Lesson completion will be cleared (answers kept).'),
                  }))) return;
                  setMenuOpen(false);
                  reset.mutate();
                }}
              />
              <SheetItem
                icon="✕"
                label={s('退出学习', '退出學習', 'Unenroll')}
                sub={s('进度不再同步 · 已答题记录保留', '進度不再同步 · 已答題記錄保留', 'Progress stops syncing · answers kept')}
                danger
                disabled={unenroll.isPending}
                onClick={async () => {
                  if (!(await confirmAsync({
                    title: s('退出学习？', '退出學習？', 'Unenroll?'),
                    body: s('进度不再同步 · 已答题记录保留', '進度不再同步 · 已答題記錄保留', 'Progress stops syncing · answers kept'),
                    danger: true,
                  }))) return;
                  setMenuOpen(false);
                  unenroll.mutate();
                }}
              />
            </>
          )}
        </div>
        <div className="menu-card" style={{ marginTop: 'var(--sp-3)' }}>
          {/* 已加入但不是当前主修 · 显示「设为主修」 */}
          {enrollment && !isMainCourse && (
            <SheetItem
              icon="📍"
              label={s('设为主修法本', '設為主修法本', 'Set as main')}
              sub={s('首页将显示这本的进度', '首頁將顯示這本的進度', 'Home will show this text')}
              onClick={() => {
                setMainCourseId(c.id);
                setMenuOpen(false);
                toast.ok(s('已设为主修法本', '已設為主修法本', 'Set as main'));
              }}
            />
          )}
          <SheetItem
            icon="🔗"
            label={s('复制链接', '複製連結', 'Copy link')}
            onClick={() => { setMenuOpen(false); copyLink(); }}
          />
        </div>
      </Dialog>
    </div>
  );
}

function Stat({ num, label, color }: { num: string | number; label: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: color ?? 'var(--ink)', lineHeight: 1.1 }}>
        {num}
      </div>
      <div style={{ fontSize: '.6875rem', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Sep() {
  return <div style={{ background: 'var(--border-light)', justifySelf: 'center', height: 24, width: 1 }} />;
}

function SheetItem({
  icon, label, sub, onClick, disabled, danger,
}: {
  icon: string;
  label: string;
  sub?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        width: '100%',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        color: 'inherit',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--r-sm)',
          background: danger ? 'var(--crimson-light)' : 'var(--saffron-pale)',
          color: danger ? 'var(--crimson)' : 'var(--saffron-dark)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9375rem', color: danger ? 'var(--crimson)' : 'var(--ink)', letterSpacing: 1.5 }}>
          {label}
        </div>
        {sub && (
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </button>
  );
}

function Empty({ title }: { title: string }) {
  return (
    <div style={{ padding: 'var(--sp-7) var(--sp-5)', textAlign: 'center' }}>
      <p style={{ color: 'var(--ink-3)' }}>{title}</p>
    </div>
  );
}

// ── 课时小图标按钮 · 答题（默认）/ 观修（accent 橙色）─────
function iconBtn(accent: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-sm)',
    background: accent ? 'var(--saffron)' : 'var(--glass-thick)',
    color: accent ? '#fff' : 'var(--ink-3)',
    border: '1px solid ' + (accent ? 'var(--saffron-dark)' : 'var(--glass-border)'),
    textDecoration: 'none',
    cursor: 'pointer',
  };
}

// ── 线性图标（与项目其他 admin shell 统一风格）─────
function IconQuiz() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  );
}

function IconMeditation() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="6" r="2.5" />
      <path d="M12 11v3" />
      <path d="M5 21c1-3 4-5 7-5s6 2 7 5" />
      <path d="M3 14c2-1 4-1 6 0" />
      <path d="M21 14c-2-1-4-1-6 0" />
    </svg>
  );
}

