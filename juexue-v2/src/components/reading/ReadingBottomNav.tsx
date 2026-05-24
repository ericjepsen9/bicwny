// 法本阅读 · 底部操作栏（fixed · 父组件 portal 渲到 body）
//   - 上一课 / 开始答题 / 下一课
//   - 观修入口（如该课时有发布观修）· 浮在操作栏上方
//   - 跟 chromeVisible 联动显示 / 隐藏
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/i18n';

interface FlatLessonRef {
  lesson: { id: string };
}

interface MeditationEntry {
  id: string;
  title: string;
  videoDurationSec: number;
}

interface Props {
  chromeVisible: boolean;
  courseSlug: string;
  courseId: string;
  lessonId: string;
  prev: FlatLessonRef | null;
  next: FlatLessonRef | null;
  meditation: MeditationEntry | null;
}

function ReadingBottomNav({
  chromeVisible,
  courseSlug,
  courseId,
  lessonId,
  prev,
  next,
  meditation,
}: Props) {
  const { s } = useLang();

  return (
    <>
      {/* 观修入口（如该课时有发布观修）· 底部栏上方 · 跟工具栏联动显示 */}
      {meditation && (
        <Link
          to={`/meditation/${meditation.id}`}
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
            <div style={{
              font: 'var(--text-caption)',
              opacity: .85,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {meditation.title}
              {meditation.videoDurationSec > 0 && (
                <span> · {Math.floor(meditation.videoDurationSec / 60)}:{String(meditation.videoDurationSec % 60).padStart(2, '0')}</span>
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
            to={`/read/${courseSlug}/${prev.lesson.id}`}
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
          to={`/quiz/${lessonId}?courseId=${courseId}&slug=${encodeURIComponent(courseSlug)}&from=reading${next ? '&nextLessonId=' + next.lesson.id : ''}`}
          className="btn btn-primary btn-pill"
          style={{ flex: 1.4, padding: 12, justifyContent: 'center' }}
        >
          {s('开始答题', '開始答題', 'Start quiz')}
        </Link>
        {next ? (
          <Link
            to={`/read/${courseSlug}/${next.lesson.id}`}
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
    </>
  );
}

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

export default memo(ReadingBottomNav);
