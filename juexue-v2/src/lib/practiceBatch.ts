// 修学计数 · 30 秒批量上报 hook
//   - tap(count, source) · 本地立即 +N + 排队
//   - 30 秒未动作 → flush（POST /api/practice/entries）
//   - tab hidden / 组件 unmount → 立即 flush（防数据丢失）
//   - 失败 → 还原本地 pending · 重 schedule（最多重试 3 次后弹错）
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import { toast } from './toast';

const FLUSH_DELAY_MS = 30_000;

interface BatchEntry { projectId: string; count: number; source: string }

export function usePracticeBatch(projectId: string) {
  const qc = useQueryClient();
  const pendingRef = useRef<BatchEntry[]>([]);
  const [localPending, setLocalPending] = useState(0);
  const timerRef = useRef<number | null>(null);
  const retryRef = useRef(0);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function schedule() {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      void flush();
    }, FLUSH_DELAY_MS);
  }

  async function flush(): Promise<void> {
    clearTimer();
    if (pendingRef.current.length === 0) return;
    const items = pendingRef.current;
    pendingRef.current = [];
    const flushedAmount = items.reduce((s, x) => s + x.count, 0);
    setLocalPending((p) => Math.max(0, p - flushedAmount));
    try {
      await api.post('/api/practice/entries', { items });
      retryRef.current = 0;
      // 后端 daily summary 已更新 · 让相关 query 重抓
      qc.invalidateQueries({ queryKey: ['/api/practice/projects'] });
      qc.invalidateQueries({ queryKey: ['/api/practice/summary'] });
      qc.invalidateQueries({ queryKey: ['/api/practice/history'] });
      qc.invalidateQueries({ queryKey: ['/api/practice/tasks'] });
    } catch (e) {
      // 失败：把 items 还原回 pending · 等下次再 flush（避免数据丢失）
      pendingRef.current = items.concat(pendingRef.current);
      setLocalPending((p) => p + flushedAmount);
      retryRef.current++;
      if (retryRef.current >= 3) {
        toast.error('修学计数上报失败 · 请检查网络');
        retryRef.current = 0;
      } else {
        schedule();
      }
      throw e instanceof ApiError ? e : new Error('flush failed');
    }
  }

  function tap(count: number, source: 'tap' | 'shake' = 'tap') {
    if (count <= 0) return;
    pendingRef.current.push({ projectId, count, source });
    setLocalPending((p) => p + count);
    schedule();
  }

  // 撤销最后一次 tap（3 秒内有效）· 简单实现：弹出最后一条
  function undoLast() {
    const last = pendingRef.current.pop();
    if (!last) return;
    setLocalPending((p) => Math.max(0, p - last.count));
    if (pendingRef.current.length === 0) clearTimer();
  }

  // tab hidden 立即 flush（防用户切走丢数据）
  useEffect(() => {
    function onVis() {
      if (document.hidden) void flush();
    }
    function onPageHide() { void flush(); }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onPageHide);
      // unmount · 同步触发（不 await · 浏览器已在卸载）
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tap, undoLast, localPending, flush };
}

// ── 摇一摇监听 · 仅在子项计数页激活 · 默认关 ─────
const SHAKE_THRESHOLD = 18; // m/s²
const SHAKE_COOLDOWN_MS = 1000;

export function useShakeToTap(enabled: boolean, onShake: () => void) {
  // ref 锁住最新 onShake · 否则 listener 闭包旧的 unit 值 → 永远 +1 bug
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let lastTriggerAt = 0;
    function handler(e: DeviceMotionEvent) {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      if (mag > SHAKE_THRESHOLD && Date.now() - lastTriggerAt > SHAKE_COOLDOWN_MS) {
        lastTriggerAt = Date.now();
        onShakeRef.current();
      }
    }
    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, [enabled]);
}
