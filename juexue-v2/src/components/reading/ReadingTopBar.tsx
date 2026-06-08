// 法本阅读顶栏 · 返回 / 标题 / 字号 A-A+ / 目录按钮
// 与 chromeVisible 联动显示 / 隐藏（向下滚自动收）
import { memo } from 'react';
import { useLang } from '@/lib/i18n';

interface Props {
  chromeVisible: boolean;
  courseEmoji: string;
  courseTitle: string;
  onBack: () => void;
  onTocOpen: () => void;
  onFontBump: (dir: 1 | -1) => void;
}

function ReadingTopBar({
  chromeVisible,
  courseEmoji,
  courseTitle,
  onBack,
  onTocOpen,
  onFontBump,
}: Props) {
  const { s } = useLang();

  return (
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
        onClick={onBack}
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
        {courseEmoji} {courseTitle}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => onFontBump(-1)}
          aria-label={s('字号减小', '字號減小', 'Smaller text')}
          title={s('字号 A-', '字號 A-', 'A-')}
          style={fontBtnStyle('0.75rem')}
        >
          A-
        </button>
        <button
          type="button"
          onClick={() => onFontBump(1)}
          aria-label={s('字号增大', '字號增大', 'Larger text')}
          title={s('字号 A+', '字號 A+', 'A+')}
          style={fontBtnStyle('1rem')}
        >
          A+
        </button>
        <button
          type="button"
          onClick={onTocOpen}
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
  );
}

function fontBtnStyle(fontSize: string): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 'var(--r-sm)',
    background: 'var(--glass-thick)',
    border: '1px solid var(--glass-border)',
    color: 'var(--ink-2)',
    fontFamily: 'var(--font-serif)',
    fontWeight: 700,
    fontSize,
    letterSpacing: 0,
    cursor: 'pointer',
  };
}

export default memo(ReadingTopBar);
