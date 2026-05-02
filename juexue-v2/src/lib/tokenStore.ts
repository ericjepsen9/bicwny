// 觉学 v2 · token 存储
//   - sync read：getAccess() / getRefresh() · in-memory cache（boot 时 hydrate 一次）
//   - async write：setTokens() · cache + 持久化双写
//   - clear()：登出全清
//
// 持久化：
//   - 原生壳（iOS/Android）：@capacitor/preferences（iOS Keychain · Android EncryptedSharedPreferences）
//   - Web：localStorage（key 'jx-accessToken' / 'jx-refreshToken'）
//
// 跨平台迁移：原生首次 boot 检测 localStorage 有 token 但 Preferences 无 → 自动迁移
import { Preferences } from '@capacitor/preferences';
import { isNative } from './env';

const ACCESS_KEY = 'jx-accessToken';
const REFRESH_KEY = 'jx-refreshToken';

const useNative = isNative();

// in-memory cache · sync read
let accessCache: string | null = null;
let refreshCache: string | null = null;
let hydrated = false;

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (useNative) {
    const [a, r] = await Promise.all([
      Preferences.get({ key: ACCESS_KEY }),
      Preferences.get({ key: REFRESH_KEY }),
    ]);
    accessCache = a.value;
    refreshCache = r.value;
    // 跨平台迁移：localStorage 还有但 Preferences 没 · 写到 Preferences
    try {
      const lsA = localStorage.getItem(ACCESS_KEY);
      const lsR = localStorage.getItem(REFRESH_KEY);
      if (lsA && !accessCache) {
        accessCache = lsA;
        await Preferences.set({ key: ACCESS_KEY, value: lsA });
        localStorage.removeItem(ACCESS_KEY);
      }
      if (lsR && !refreshCache) {
        refreshCache = lsR;
        await Preferences.set({ key: REFRESH_KEY, value: lsR });
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
  if (useNative) {
    await Preferences.set({ key: ACCESS_KEY, value: opts.accessToken });
    if (opts.refreshToken !== undefined) {
      await Preferences.set({ key: REFRESH_KEY, value: opts.refreshToken });
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
  if (useNative) {
    await Promise.all([
      Preferences.remove({ key: ACCESS_KEY }),
      Preferences.remove({ key: REFRESH_KEY }),
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
