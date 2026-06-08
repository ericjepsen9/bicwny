// 翻页方式偏好（scroll vs swipe）· 用户在 SettingsPage 切换
//   scroll  · 默认 · 上下滚动（长课时纵向阅读）
//   swipe   · 左右滑切（一屏一课时 · Apple 图书风）
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ReadMode = 'scroll' | 'swipe';

const STORAGE_KEY = 'jx-read-mode';
const VALID = new Set<ReadMode>(['scroll', 'swipe']);

function read(): ReadMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID.has(v as ReadMode) ? (v as ReadMode) : 'scroll';
  } catch {
    return 'scroll';
  }
}

interface Ctx {
  mode: ReadMode;
  setMode: (m: ReadMode) => void;
}

const C = createContext<Ctx | null>(null);

export function ReadModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ReadMode>(() => read());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, [mode]);

  // 跨标签页同步
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue as ReadMode;
      if (VALID.has(v)) setModeState(v);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setMode = useCallback((m: ReadMode) => {
    if (VALID.has(m)) setModeState(m);
  }, []);

  const value = useMemo<Ctx>(() => ({ mode, setMode }), [mode, setMode]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useReadMode() {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useReadMode must be inside <ReadModeProvider>');
  return ctx;
}
