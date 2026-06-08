// 觉学 v2 · 用户字号（4 档：小 / 标准 / 大 / 特大）
// 对应老 prototypes/shared/font-size.js
//
// 写到 document.documentElement.style 的 --font-scale CSS variable
// base.css 里 :root font-size 基于 calc(17px * var(--font-scale, 1)) · 全局 rem 跟着缩放
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface FontScaleOption {
  value: number;
  labelSc: string;
  labelTc: string;
  labelEn: string;
}

export const FONT_SCALES: readonly FontScaleOption[] = [
  { value: 0.9,  labelSc: '小',   labelTc: '小',   labelEn: 'Small' },
  { value: 1,    labelSc: '标准', labelTc: '標準', labelEn: 'Default' },
  { value: 1.15, labelSc: '大',   labelTc: '大',   labelEn: 'Large' },
  { value: 1.3,  labelSc: '特大', labelTc: '特大', labelEn: 'X-Large' },
];

const STORAGE_KEY = 'jx-font-scale';
const VALID = new Set(FONT_SCALES.map((s) => s.value));

function readScale(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 1;
    const v = parseFloat(raw);
    return VALID.has(v) ? v : 1;
  } catch {
    return 1;
  }
}

function applyScale(v: number) {
  document.documentElement.style.setProperty('--font-scale', String(v));
}

/** 在 React 渲染前调用 · 避免 FOUC */
export function applyFontScaleNow() {
  applyScale(readScale());
}

interface FontScaleCtx {
  scale: number;
  setScale: (v: number) => void;
  /** ±1 步进 · 端点止住 */
  step: (dir: 1 | -1) => FontScaleOption | null;
}

const Ctx = createContext<FontScaleCtx | null>(null);

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<number>(() => readScale());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(scale)); } catch {}
    applyScale(scale);
  }, [scale]);

  // 跨标签页同步
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const v = parseFloat(e.newValue || '');
      if (VALID.has(v)) setScaleState(v);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setScale = useCallback((v: number) => {
    if (VALID.has(v)) setScaleState(v);
  }, []);

  const step = useCallback((dir: 1 | -1): FontScaleOption | null => {
    const idx = FONT_SCALES.findIndex((s) => s.value === scale);
    const cur = idx < 0 ? 1 : idx;
    const next = Math.max(0, Math.min(FONT_SCALES.length - 1, cur + dir));
    if (next === cur) return null;
    const opt = FONT_SCALES[next]!;
    setScaleState(opt.value);
    return opt;
  }, [scale]);

  const value = useMemo<FontScaleCtx>(
    () => ({ scale, setScale, step }),
    [scale, setScale, step],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFontScale() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFontScale must be inside <FontScaleProvider>');
  return ctx;
}
