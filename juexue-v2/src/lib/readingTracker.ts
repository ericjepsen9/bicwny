// 法本阅读追踪 hook
//   - scroll 监听（throttle 250ms）· 计算 scrollPercent
//   - 心跳 timer 每 10s 上报（仅 visible 时计时）
//   - visibilitychange · hidden 时暂停 / visible 时恢复
//   - 只读 GET 不污染 cache
import { useEffect, useRef } from 'react';
import { api } from './api';
import { toast } from './toast';
import { useLang } from './i18n';

const HEARTBEAT_INTERVAL_MS = 10_000;

interface ReportResult {
  scrollPercent: number;
  totalSeconds: number;
  isCompleted: boolean;
  justCompleted: boolean;
}

/**
 * 自动追踪法本阅读进度
 * @param lessonId  当前课时 id（null/'' 时不工作）
 * @param scrollEl  滚动容器（默认 window）· 学员端用 .scroll-area 容器
 */
export function useReadingTracker(lessonId: string | null | undefined, scrollEl?: HTMLElement | null) {
  const { s } = useLang();
  const scrollPctRef = useRef(0);          // 当前最深滚动百分比
  const accumulatedSecRef = useRef(0);     // 自上次心跳起累积的活跃秒
  const visibleRef = useRef(true);
  const tickIdRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!lessonId) return;

    // 重置（切课时）
    scrollPctRef.current = 0;
    accumulatedSecRef.current = 0;
    startedAtRef.current = Date.now();
    visibleRef.current = !document.hidden;

    const target = scrollEl ?? document.scrollingElement ?? document.documentElement;

    function computeScrollPercent(): number {
      if (!target) return 0;
      const scrollTop = (target as HTMLElement).scrollTop;
      const innerH = (target as HTMLElement).clientHeight;
      const totalH = (target as HTMLElement).scrollHeight;
      if (totalH <= innerH) return 100; // 内容比窗口还短 · 视为全读
      return Math.min(100, Math.round(((scrollTop + innerH) / totalH) * 100));
    }

    let lastScrollAt = 0;
    function onScroll() {
      const now = Date.now();
      if (now - lastScrollAt < 250) return; // throttle 250ms
      lastScrollAt = now;
      const pct = computeScrollPercent();
      if (pct > scrollPctRef.current) scrollPctRef.current = pct;
    }

    function onVisibility() {
      visibleRef.current = !document.hidden;
    }

    // 初始化滚动百分比（页面打开就在底部 · 短文章场景）
    scrollPctRef.current = computeScrollPercent();

    // 心跳 · 每 10s 上报一次
    let lastTickAt = Date.now();
    async function tick() {
      const now = Date.now();
      const dt = visibleRef.current ? Math.min(60, Math.floor((now - lastTickAt) / 1000)) : 0;
      lastTickAt = now;
      if (dt === 0 && scrollPctRef.current === 0) return; // 完全没动 · 跳过

      try {
        const res = await api.patch<ReportResult>(
          `/api/me/lessons/${encodeURIComponent(lessonId!)}/reading-progress`,
          { scrollPercent: scrollPctRef.current, secondsDelta: dt },
        );
        if (res.justCompleted) {
          toast.ok(s('✓ 已读 · 已加入完成', '✓ 已讀 · 已加入完成', '✓ Marked as read'));
        }
      } catch {
        // 静默 · 下次心跳重试
      }
    }

    // 窗口绑定
    const scroller = scrollEl ?? window;
    scroller.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    tickIdRef.current = window.setInterval(tick, HEARTBEAT_INTERVAL_MS);

    // unmount / 切课时 · 立即上报最后一次（防数据丢失）
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      if (tickIdRef.current !== null) {
        window.clearInterval(tickIdRef.current);
        tickIdRef.current = null;
      }
      // 立即 flush 一次（fire and forget · 不阻塞 unmount）
      const dt = visibleRef.current ? Math.min(60, Math.floor((Date.now() - lastTickAt) / 1000)) : 0;
      if (dt > 0 || scrollPctRef.current > 0) {
        api.patch(`/api/me/lessons/${encodeURIComponent(lessonId!)}/reading-progress`, {
          scrollPercent: scrollPctRef.current,
          secondsDelta: dt,
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);
}
