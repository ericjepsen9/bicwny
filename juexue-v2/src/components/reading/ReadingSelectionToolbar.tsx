// 法本阅读 · 选段浮动工具栏（fixed · 父组件 portal 渲到 body）
//   - 4 色高亮按钮
//   - 拷贝 / 笔记 / 取消
//   - selection 不为 null 时显示
import { memo } from 'react';
import type { HighlightColor } from '@/lib/queries';
import { useLang } from '@/lib/i18n';
import { HIGHLIGHT_BG } from '@/lib/reading-utils';

interface Props {
  onHighlight: (color: HighlightColor) => void;
  onCopy: () => void;
  onNote: () => void;
  onCancel: () => void;
}

function ReadingSelectionToolbar({ onHighlight, onCopy, onNote, onCancel }: Props) {
  const { s } = useLang();
  return (
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
            onClick={() => onHighlight(c)}
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
      <button type="button" onClick={onCopy} style={toolbarBtnStyle}>
        {s('拷贝', '拷貝', 'Copy')}
      </button>
      <button type="button" onClick={onNote} style={toolbarBtnStyle}>
        📝 {s('笔记', '筆記', 'Note')}
      </button>
      <button
        type="button"
        onClick={onCancel}
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
  );
}

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

export default memo(ReadingSelectionToolbar);
