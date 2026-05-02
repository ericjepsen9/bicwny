// 觉学 v2 · 主题（auto / light / dark）
// 对应老版 prototypes/shared/theme.js
//
// 关键：一上来就在 main.tsx render 前 set documentElement[data-theme] 避免 FOUC
// auto 模式跟随 prefers-color-scheme · 系统切换时实时响应
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'jx-theme';
const VALID: Record<string, true> = { auto: true, light: true, dark: true };

function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID[v as ThemeMode] ? (v as ThemeMode) : 'auto';
  } catch {
    return 'auto';
  }
}

function systemDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function effectiveOf(mode: ThemeMode): EffectiveTheme {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return systemDark() ? 'dark' : 'light';
}

/** 在 main.tsx render 之前调用 · 立即应用避免 FOUC */
export function applyThemeNow() {
  const mode = readTheme();
  const eff = effectiveOf(mode);
  document.documentElement.setAttribute('data-theme', mode);
  if (mode === 'auto') {
    document.documentElement.setAttribute('data-theme-system', systemDark() ? 'dark' : 'light');
  }
  // theme-color meta · 移动浏览器顶栏跟着变
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', eff === 'dark' ? '#1A1410' : '#FFFAF4');
}

interface ThemeCtx {
  mode: ThemeMode;
  effective: EffectiveTheme;
  setMode: (m: ThemeMode) => void;
  cycle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readTheme());
  const [effective, setEffective] = useState<EffectiveTheme>(() => effectiveOf(mode));

  // mode 变 · 写存储 + 应用
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
    document.documentElement.setAttribute('data-theme', mode);
    if (mode === 'auto') {
      document.documentElement.setAttribute('data-theme-system', systemDark() ? 'dark' : 'light');
    } else {
      document.documentElement.removeAttribute('data-theme-system');
    }
    setEffective(effectiveOf(mode));
  }, [mode]);

  // 系统切换监听（auto 模式下需要）
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (mode === 'auto') {
        document.documentElement.setAttribute('data-theme-system', mq.matches ? 'dark' : 'light');
        setEffective(mq.matches ? 'dark' : 'light');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, [mode]);

  // 跨标签页同步
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue;
      if (next && VALID[next]) setModeState(next as ThemeMode);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    if (VALID[m]) setModeState(m);
  }, []);

  const cycle = useCallback(() => {
    setModeState((m) => (m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto'));
  }, []);

  const value = useMemo<ThemeCtx>(
    () => ({ mode, effective, setMode, cycle }),
    [mode, effective, setMode, cycle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be inside <ThemeProvider>');
  return ctx;
}
