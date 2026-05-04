// FilterChip · 列表筛选 chip · 可复用
//   pill 形状 · saffron 系激活态 · glass 系闲置态
//   原各页面（CoursesPage / MistakesPage / NotificationPage）各写一套已合并
//
// 用法：
//   <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
//     全部
//   </FilterChip>
import type { ReactNode } from 'react';
import { selection } from '@/lib/haptics';

interface Props {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export default function FilterChip({ active, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={() => { if (!active) selection(); onClick(); }}
      aria-pressed={active}
      style={{
        padding: '6px 14px',
        borderRadius: 'var(--r-pill)',
        border: '1px solid ' + (active ? 'var(--saffron-light)' : 'var(--glass-border)'),
        background: active ? 'var(--saffron-pale)' : 'var(--glass-thick)',
        color: active ? 'var(--saffron-dark)' : 'var(--ink-3)',
        font: 'var(--text-caption)',
        fontWeight: 600,
        letterSpacing: 1,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'all .2s var(--ease)',
      }}
    >
      {children}
    </button>
  );
}
