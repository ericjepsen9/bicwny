// 法本阅读 · 笔记 FAB（fixed · 右下角 · 浮于底部操作栏上方）
//   - 点击开 NotesDrawer 抽屉（不跳页）
//   - 有笔记时显示红色数字角标
//   - safe-area 兼容 iPhone 12+ home bar（优化 7）
//   - 与 chromeVisible 联动显隐
import { memo } from 'react';
import { useLang } from '@/lib/i18n';

interface Props {
  chromeVisible: boolean;
  notesCount: number;
  onOpen: () => void;
}

function ReadingNotesFab({ chromeVisible, notesCount, onOpen }: Props) {
  const { s } = useLang();

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={s('本课笔记', '本課筆記', 'Lesson notes')}
      style={{
        position: 'fixed',
        right: 16,
        // 96px 是底部操作栏高度 + 32px 间隙 · safe-area 兼容 iPhone 12+ home bar
        // 旧设备 / 桌面：96px(不变)；iPhone 12+：96 + 34 = 130px(向上避让)
        bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
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
      {notesCount > 0 && (
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
          {notesCount > 9 ? '9+' : notesCount}
        </span>
      )}
    </button>
  );
}

export default memo(ReadingNotesFab);
