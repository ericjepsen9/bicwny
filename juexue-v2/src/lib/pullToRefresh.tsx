// usePullToRefresh · 移动端下拉刷新
//   原生 touch 监听 · 不依赖第三方 · 在 scrollY=0 时下拉触发
//   过 TRIGGER 阈值松手 → 调 onRefresh callback · 期间显示菊花
//
// 用法（组件）：
//   const { indicator } = usePullToRefresh(async () => {
//     await Promise.all([q1.refetch(), q2.refetch()]);
//   });
//   return (<>{indicator}<div>...page content...</div></>);
//
// 设计：
// - 仅监听 document touchmove（passive=true · 不拦截原生 overscroll）
// - 阻力系数 0.5 让下拉感觉"沉"
// - 实际 refetch 完成前菊花持续旋转 · 防止用户重复触发
import { useEffect, useRef, useState } from 'react';

const TRIGGER = 70;
const MAX_PULL = 110;

export function usePullToRefresh(onRefresh: () => Promise<unknown> | void) {
  const [pulled, setPulled] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const stateRef = useRef({ startY: -1, pulled: 0 });
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(false);

  // 同步最新 onRefresh · 闭包陷阱防御
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (window.scrollY > 0) return;
      stateRef.current.startY = e.touches[0]?.clientY ?? -1;
    }
    function onTouchMove(e: TouchEvent) {
      const sy = stateRef.current.startY;
      if (sy < 0) return;
      if (refreshingRef.current) return;
      const dy = (e.touches[0]?.clientY ?? 0) - sy;
      if (dy <= 0) {
        stateRef.current.pulled = 0;
        setPulled(0);
        return;
      }
      const next = Math.min(MAX_PULL, dy * 0.5);
      stateRef.current.pulled = next;
      setPulled(next);
    }
    async function onTouchEnd() {
      const finalPulled = stateRef.current.pulled;
      stateRef.current.startY = -1;
      stateRef.current.pulled = 0;
      if (finalPulled >= TRIGGER) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPulled(TRIGGER);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setPulled(0);
        }
      } else {
        setPulled(0);
      }
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const ratio = Math.min(1, pulled / TRIGGER);
  const indicator = (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: pulled,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: 8,
        pointerEvents: 'none',
        transition: refreshing || pulled === 0 ? 'height .25s var(--ease)' : 'none',
        zIndex: 30,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--glass-thick)',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'var(--blur)',
          WebkitBackdropFilter: 'var(--blur)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: ratio,
          transform: `scale(${0.6 + ratio * 0.4})`,
          boxShadow: 'var(--shadow-1)',
        }}
      >
        {refreshing ? (
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid var(--saffron-light)',
              borderTopColor: 'var(--saffron)',
              borderRadius: '50%',
              animation: 'jx-spin .7s linear infinite',
            }}
          />
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--saffron-dark)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: `rotate(${ratio * 180}deg)`,
              transition: 'transform .15s var(--ease)',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>
    </div>
  );

  return { indicator, refreshing };
}
