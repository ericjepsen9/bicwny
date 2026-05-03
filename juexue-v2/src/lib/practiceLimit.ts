// 智能练习题数偏好 · 本地持久化（无需后端）
//   pattern 与 fontSize / theme / readMode 一致
//   档位 10 / 15 / 20 / 30 / 50 / 100 · 默认 20
import { useEffect, useState } from 'react';

export const PRACTICE_LIMIT_OPTIONS = [10, 15, 20, 30, 50, 100] as const;
export type PracticeLimit = (typeof PRACTICE_LIMIT_OPTIONS)[number];

const STORAGE_KEY = 'jx-practice-limit';
const DEFAULT: PracticeLimit = 20;
const VALID = new Set<number>(PRACTICE_LIMIT_OPTIONS);

export function getPracticeLimit(): PracticeLimit {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return VALID.has(n) ? (n as PracticeLimit) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function setPracticeLimit(v: PracticeLimit) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
    // 同标签页内手动通知 useState 订阅者
    window.dispatchEvent(new CustomEvent('jx-practice-limit-changed', { detail: v }));
  } catch {}
}

export function usePracticeLimit(): [PracticeLimit, (v: PracticeLimit) => void] {
  const [v, setV] = useState<PracticeLimit>(() => getPracticeLimit());

  useEffect(() => {
    function onCustom(e: Event) {
      const ce = e as CustomEvent<PracticeLimit>;
      if (VALID.has(ce.detail)) setV(ce.detail);
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const n = Number(e.newValue);
      if (VALID.has(n)) setV(n as PracticeLimit);
    }
    window.addEventListener('jx-practice-limit-changed', onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('jx-practice-limit-changed', onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return [v, (next) => { setPracticeLimit(next); setV(next); }];
}
