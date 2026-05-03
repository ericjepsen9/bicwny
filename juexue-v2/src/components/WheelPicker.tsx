// WheelPicker · iOS 风滚轮选择器
//   原生 scroll + scroll-snap-type 实现 · 不依赖任何拖拽库
//   高亮中间槽位 · 上下渐隐 · 滚动停止后自动 snap + onChange
import { useEffect, useRef } from 'react';

interface Props<T extends number | string> {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  /** 单行高 · 默认 44 (iOS HIG tap target) */
  rowHeight?: number;
  /** 显示几行 · 必须奇数 · 默认 5 */
  visibleRows?: 3 | 5 | 7;
  /** 单位后缀 · 如 "题" · 仅显示用 */
  unit?: string;
}

export default function WheelPicker<T extends number | string>({
  value,
  options,
  onChange,
  rowHeight = 44,
  visibleRows = 5,
  unit,
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const snapTimer = useRef<number | null>(null);
  const containerH = rowHeight * visibleRows;
  const padH = ((visibleRows - 1) / 2) * rowHeight;

  // 初始化 + value 外部变化 · 滚到对应位置
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = options.indexOf(value);
    if (idx >= 0 && Math.abs(el.scrollTop - idx * rowHeight) > 1) {
      el.scrollTop = idx * rowHeight;
    }
    // 仅 mount 与 value 变化触发；options/rowHeight 视为常量
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function onScroll() {
    if (snapTimer.current) window.clearTimeout(snapTimer.current);
    // 100ms 滚动静止后 snap + 报告新值
    snapTimer.current = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const raw = el.scrollTop / rowHeight;
      const idx = Math.max(0, Math.min(options.length - 1, Math.round(raw)));
      const target = idx * rowHeight;
      if (Math.abs(el.scrollTop - target) > 0.5) {
        el.scrollTo({ top: target, behavior: 'smooth' });
      }
      const picked = options[idx]!;
      if (picked !== value) onChange(picked);
    }, 100);
  }

  return (
    <div
      style={{
        position: 'relative',
        height: containerH,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* 中间高亮槽 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: padH,
          left: 0,
          right: 0,
          height: rowHeight,
          background: 'var(--saffron-pale)',
          borderTop: '1px solid var(--saffron-light)',
          borderBottom: '1px solid var(--saffron-light)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* 顶部渐隐 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: padH,
          background: 'linear-gradient(180deg, var(--bg-card) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      {/* 底部渐隐 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: padH,
          background: 'linear-gradient(0deg, var(--bg-card) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      {/* 滚动容器 */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          position: 'relative',
          zIndex: 1,
        }}
        className="wheel-picker-scroll"
      >
        <div style={{ height: padH }} />
        {options.map((opt) => {
          const active = opt === value;
          return (
            <div
              key={String(opt)}
              onClick={() => onChange(opt)}
              style={{
                height: rowHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                scrollSnapAlign: 'center',
                fontFamily: 'var(--font-serif)',
                fontWeight: active ? 700 : 500,
                fontSize: active ? '1.5rem' : '1.125rem',
                color: active ? 'var(--saffron-dark)' : 'var(--ink-3)',
                letterSpacing: 2,
                transition: 'all .15s var(--ease)',
                cursor: 'pointer',
              }}
            >
              {opt}{unit && <span style={{ fontSize: '.7em', marginLeft: 4, fontWeight: 500 }}>{unit}</span>}
            </div>
          );
        })}
        <div style={{ height: padH }} />
      </div>
    </div>
  );
}
