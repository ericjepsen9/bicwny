// 觉学 v2 · token 存储
// 对应老版 prototypes/shared/token-store.js
//
// 设计：同步 in-memory cache + 异步持久化（Capacitor Preferences 优先 · 否则 localStorage）
//   - sync read：getAccess() / getRefresh() · 用 cache 立即返回（boot 时 hydrate 一次）
//   - async write：setTokens() · cache + 持久化双写
//   - clear()：登出时全清
//
// Capacitor 集成：
//   window.Capacitor.Plugins.Preferences 存在时用之 · 否则 localStorage
//   首次 boot 检测到 localStorage 有 token 但 keychain 没 → 自动迁移

const ACCESS_KEY = 'jx-accessToken';
const REFRESH_KEY = 'jx-refreshToken';

interface CapacitorPrefs {
  get(opts: { key: string }): Promise<{ value: string | null }>;
  set(opts: { key: string; value: string }): Promise<void>;
  remove(opts: { key: string }): Promise<void>;
}

interface CapacitorWindow extends Window {
  Capacitor?: {
    Plugins?: { Preferences?: CapacitorPrefs };
    getPlatform?: () => string;
  };
}

const cap = (window as CapacitorWindow).Capacitor;
const native = cap?.Plugins?.Preferences ?? null;

// in-memory cache · sync read
let accessCache: string | null = null;
let refreshCache: string | null = null;
let hydrated = false;

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (native) {
    const [a, r] = await Promise.all([
      native.get({ key: ACCESS_KEY }),
      native.get({ key: REFRESH_KEY }),
    ]);
    accessCache = a.value;
    refreshCache = r.value;
    // 迁移：localStorage 还有但 native 没 · 写到 native
    try {
      const lsA = localStorage.getItem(ACCESS_KEY);
      const lsR = localStorage.getItem(REFRESH_KEY);
      if (lsA && !accessCache) {
        accessCache = lsA;
        await native.set({ key: ACCESS_KEY, value: lsA });
        localStorage.removeItem(ACCESS_KEY);
      }
      if (lsR && !refreshCache) {
        refreshCache = lsR;
        await native.set({ key: REFRESH_KEY, value: lsR });
        localStorage.removeItem(REFRESH_KEY);
      }
    } catch { /* localStorage 不可用时忽略 */ }
  } else {
    try {
      accessCache = localStorage.getItem(ACCESS_KEY);
      refreshCache = localStorage.getItem(REFRESH_KEY);
    } catch { /* ignore */ }
  }
}

// boot 时立即 hydrate（异步 · 不阻塞 main.tsx 渲染）
hydrate();

export function getAccess(): string | null {
  return accessCache;
}
export function getRefresh(): string | null {
  return refreshCache;
}

export async function setTokens(opts: {
  accessToken: string;
  refreshToken?: string;
}): Promise<void> {
  accessCache = opts.accessToken;
  if (opts.refreshToken !== undefined) refreshCache = opts.refreshToken;
  if (native) {
    await native.set({ key: ACCESS_KEY, value: opts.accessToken });
    if (opts.refreshToken !== undefined) {
      await native.set({ key: REFRESH_KEY, value: opts.refreshToken });
    }
  } else {
    try {
      localStorage.setItem(ACCESS_KEY, opts.accessToken);
      if (opts.refreshToken !== undefined) {
        localStorage.setItem(REFRESH_KEY, opts.refreshToken);
      }
    } catch { /* ignore */ }
  }
}

export async function clearTokens(): Promise<void> {
  accessCache = null;
  refreshCache = null;
  if (native) {
    await Promise.all([
      native.remove({ key: ACCESS_KEY }),
      native.remove({ key: REFRESH_KEY }),
    ]);
  } else {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch { /* ignore */ }
  }
}

/** await 给 boot 的 RequireAuth 用 · 确保 hydrate 完了再决定登录态 */
export function whenReady(): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => (hydrated ? resolve() : setTimeout(tick, 10));
    tick();
  });
}
