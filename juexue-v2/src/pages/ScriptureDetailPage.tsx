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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useCourseDetail, useEnrollments } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function ScriptureDetailPage() {
  const { s } = useLang();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const slug = params.get('slug') || '';
  const mode = (params.get('mode') as 'read' | 'quiz' | null) ?? 'read';
  const qc = useQueryClient();

  const course = useCourseDetail(slug);
  const enrollments = useEnrollments();

  const enrollment = useMemo(
    () => (enrollments.data ?? []).find((e) => e.courseId === course.data?.id),
    [enrollments.data, course.data?.id],
  );
  const completedSet = useMemo(
    () => new Set(enrollment?.lessonsCompleted ?? []),
    [enrollment],
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击 menu 外区域关菜单
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const enroll = useMutation({
    mutationFn: () => api.post('/api/enrollments', { courseId: course.data!.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/enrollments'] });
      toast.ok(s('已加入学习', '已加入學習', 'Joined'));
      setMenuOpen(false);
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const unenroll = useMutation({
    mutationFn: () => api.del(`/api/enrollments/${encodeURIComponent(course.data!.id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/enrollments'] });
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

  if (!course.data) return <Empty title={s('法本不存在', '法本不存在', 'Text not found')} />;

  const c = course.data;
  const chapters = c.chapters ?? [];
  const totalLessons = chapters.reduce((sum, ch) => sum + (ch.lessons?.length ?? 0), 0);
  const doneCount = chapters.reduce(
    (sum, ch) => sum + (ch.lessons ?? []).filter((l) => completedSet.has(l.id)).length,
    0,
  );
  const pct = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;

  // 找到"继续阅读"目标 lesson：currentLessonId · 否则首课时
  const firstLesson = chapters[0]?.lessons?.[0];
  const currentLessonId = enrollment?.currentLessonId;
  const continueLessonId = currentLessonId || firstLesson?.id;
  const continueLesson = continueLessonId
    ? chapters.flatMap((ch) => ch.lessons ?? []).find((l) => l.id === continueLessonId)
    : null;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Hero 渐变背景 · 沿用 saffron 色系（避免每本书计算提色） */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 360,
          background: 'linear-gradient(180deg, var(--saffron-pale) 0%, var(--saffron-pale) 50%, var(--bg) 100%)',
          pointerEvents: 'none',
        }}
        aria-hidden
      />

      {/* 顶部 nav · 透明叠在 hero 上 */}
      <div
        className="top-nav"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'transparent',
          backdropFilter: 'none',
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
        <span className="nav-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {/* 滚动到 hero 后才显示标题 · 暂时简化为始终空 */}
        </span>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={s('更多操作', '更多操作', 'More')}
            aria-expanded={menuOpen}
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
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                minWidth: 180,
                background: 'var(--bg-card)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--r-md)',
                boxShadow: '0 10px 30px rgba(43,34,24,.15)',
                padding: 4,
                zIndex: 10,
              }}
            >
              {!enrollment ? (
                <MenuItem
                  icon="✓"
                  label={s('加入学习', '加入學習', 'Join')}
                  disabled={enroll.isPending}
                  onClick={() => enroll.mutate()}
                />
              ) : (
                <>
                  <MenuItem
                    icon="↻"
                    label={s('重置进度', '重置進度', 'Reset progress')}
                    disabled={reset.isPending}
                    onClick={() => {
                      if (!confirm(s('重置后已学课时记录将清空 · 是否继续？', '重置後已學課時記錄將清空 · 是否繼續？', 'Reset wipes lesson completion. Continue?'))) return;
                      reset.mutate();
                    }}
                  />
                  <MenuItem
                    icon="✕"
                    label={s('退出学习', '退出學習', 'Unenroll')}
                    danger
                    disabled={unenroll.isPending}
                    onClick={() => {
                      if (!confirm(s('退出后进度不再同步 · 已答题记录保留', '退出後進度不再同步 · 已答題記錄保留', 'Unenroll? Past answers will be kept.'))) return;
                      unenroll.mutate();
                    }}
                  />
                </>
              )}
              <MenuDivider />
              <MenuItem
                icon="🔗"
                label={s('复制链接', '複製連結', 'Copy link')}
                onClick={copyLink}
              />
            </div>
          )}
        </div>
      </div>

      {/* Hero · 居中封面 + 标题 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'var(--sp-3) var(--sp-5) var(--sp-5)',
          textAlign: 'center',
        }}
      >
        {/* 封面卡 · 120px 宽 · 不太大 */}
        <div
          style={{
            width: 120,
            height: 160,
            margin: '0 auto var(--sp-4)',
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
            boxShadow: '0 14px 32px rgba(43,34,24,.22)',
            background: c.coverImageUrl
              ? `center/cover url(${c.coverImageUrl})`
              : 'linear-gradient(135deg, var(--saffron) 0%, var(--saffron-dark) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '3.5rem',
          }}
          aria-hidden
        >
          {!c.coverImageUrl && (c.coverEmoji || '🪷')}
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--ink)',
            letterSpacing: 4,
            marginBottom: 6,
          }}
        >
          {c.title}
        </h1>
        {c.author && (
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-3)' }}>
            {c.author}
          </p>
        )}

        {/* 三栏统计 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
            alignItems: 'center',
            maxWidth: 320,
            margin: '0 auto var(--sp-4)',
            padding: 'var(--sp-3) var(--sp-4)',
            background: 'var(--glass-thick)',
            backdropFilter: 'var(--blur)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <Stat num={chapters.length} label={s('章', '章', 'Ch')} />
          <Sep />
          <Stat num={totalLessons} label={s('课', '課', 'Le')} />
          <Sep />
          <Stat num={pct + '%'} label={s('已学', '已學', 'Done')} color="var(--sage-dark)" />
        </div>

        {c.description && (
          <p
            style={{
              font: 'var(--text-caption)',
              color: 'var(--ink-2)',
              letterSpacing: 1,
              lineHeight: 1.7,
              maxWidth: 360,
              margin: '0 auto var(--sp-4)',
              padding: '0 var(--sp-2)',
            }}
          >
            {c.description}
          </p>
        )}

        {/* 主 CTA */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', maxWidth: 360, margin: '0 auto' }}>
          {continueLesson ? (
            <Link
              to={`/read/${c.slug}/${continueLesson.id}`}
              className="btn btn-primary btn-pill"
              style={{ flex: 1, padding: 12, justifyContent: 'center' }}
            >
              {currentLessonId
                ? s('继续阅读', '繼續閱讀', 'Continue')
                : s('开始阅读', '開始閱讀', 'Start reading')}
            </Link>
          ) : (
            <span
              className="btn btn-pill"
              aria-disabled
              style={{
                flex: 1,
                padding: 12,
                justifyContent: 'center',
                background: 'var(--glass-thick)',
                color: 'var(--ink-4)',
                border: '1px solid var(--glass-border)',
                cursor: 'not-allowed',
              }}
            >
              {s('暂无课时', '暫無課時', 'No lessons')}
            </span>
          )}
          {!enrollment && firstLesson && (
            <button
              type="button"
              onClick={() => enroll.mutate()}
              disabled={enroll.isPending}
              className="btn btn-pill"
              style={{
                padding: '12px 18px',
                background: 'var(--glass-thick)',
                color: 'var(--ink-2)',
                border: '1px solid var(--glass-border)',
              }}
            >
              {enroll.isPending ? s('…', '…', '…') : '+ ' + s('加入', '加入', 'Join')}
            </button>
          )}
        </div>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {chapters.map((ch) => {
            const lessons = ch.lessons ?? [];
            const chCompleted = lessons.filter((l) => completedSet.has(l.id)).length;
            const chPct = lessons.length > 0 ? Math.round((chCompleted / lessons.length) * 100) : 0;
            return (
              <details key={ch.id} className="glass-card-thick" style={{ padding: 'var(--sp-4)' }} open>
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
                    return (
                      <Link
                        key={l.id}
                        to={
                          mode === 'quiz'
                            ? `/quiz/${l.id}?courseId=${c.id}&slug=${encodeURIComponent(c.slug)}&from=detail`
                            : `/read/${c.slug}/${l.id}`
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--sp-3)',
                          padding: '10px 12px',
                          borderRadius: 'var(--r-sm)',
                          textDecoration: 'none',
                          color: 'inherit',
                          background: done ? 'var(--sage-light)' : 'transparent',
                          border: '1px solid ' + (done ? 'var(--sage)' : 'var(--border-light)'),
                        }}
                      >
                        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', fontWeight: 700, minWidth: 24 }}>
                          {l.order}
                        </span>
                        <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)' }}>
                          {l.title}
                        </span>
                        {done && (
                          <span style={{ fontSize: 14, color: 'var(--sage-dark)', fontWeight: 700 }}>✓</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>
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

function MenuItem({
  icon, label, onClick, disabled, danger,
}: {
  icon: string;
  label: string;
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
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        color: danger ? 'var(--crimson)' : 'var(--ink-2)',
        font: 'var(--text-body)',
        letterSpacing: 1,
        borderRadius: 'var(--r-sm)',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--glass)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <span style={{ width: 18, fontSize: 14, opacity: 0.8 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 8px' }} />;
}

function Empty({ title }: { title: string }) {
  return (
    <div style={{ padding: 'var(--sp-7) var(--sp-5)', textAlign: 'center' }}>
      <p style={{ color: 'var(--ink-3)' }}>{title}</p>
    </div>
  );
}
