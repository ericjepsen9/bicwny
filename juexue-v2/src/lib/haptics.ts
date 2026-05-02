// 觉学 v2 · 触觉反馈
// 对应老版 prototypes/shared/haptics.js
//
// 优先 Capacitor Plugins.Haptics（Taptic Engine / Android Vibrator）
// 兜底 navigator.vibrate（Web Vibration API）
// 30ms 节流 · 防快速点击连震
//
// 用户偏好：localStorage['jx-haptics-enabled'] = 'false' 全局关
// 由 lib/toast 自动调用 · 业务也可以直接 triggerHaptics('tap') 等

const STORAGE_KEY = 'jx-haptics-enabled';

interface CapacitorHaptics {
  impact?: (opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void> | void;
  notification?: (opts: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void> | void;
  selectionChanged?: () => Promise<void> | void;
}
interface CapWindow extends Window {
  Capacitor?: { Plugins?: { Haptics?: CapacitorHaptics } };
}

function isEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false'); } catch {}
}
export function getHapticsEnabled(): boolean {
  return isEnabled();
}

function nativePlugin(): CapacitorHaptics | null {
  return (window as CapWindow).Capacitor?.Plugins?.Haptics ?? null;
}

function webVibrate(ms: number | number[]): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch { /* ignore */ }
}

let lastFire = 0;
function throttle(): boolean {
  const now = Date.now();
  if (now - lastFire < 30) return false;
  lastFire = now;
  return true;
}

export function impact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!isEnabled() || !throttle()) return;
  const nat = nativePlugin();
  if (nat?.impact) {
    const map = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' } as const;
    try { nat.impact({ style: map[style] }); } catch { /* ignore */ }
    return;
  }
  webVibrate(style === 'heavy' ? 18 : style === 'medium' ? 12 : 8);
}

export function notification(type: 'success' | 'warning' | 'error' = 'success'): void {
  if (!isEnabled() || !throttle()) return;
  const nat = nativePlugin();
  if (nat?.notification) {
    const map = { success: 'SUCCESS', warning: 'WARNING', error: 'ERROR' } as const;
    try { nat.notification({ type: map[type] }); } catch { /* ignore */ }
    return;
  }
  if (type === 'error')   webVibrate([20, 60, 20]);
  else if (type === 'warning') webVibrate([15, 40, 15]);
  else                    webVibrate([8, 50, 8]);
}

export function selection(): void {
  if (!isEnabled() || !throttle()) return;
  const nat = nativePlugin();
  if (nat?.selectionChanged) {
    try { nat.selectionChanged(); } catch { /* ignore */ }
    return;
  }
  webVibrate(5);
}

export function tap(): void { impact('light'); }

/** 给 toast.kind 自动转触觉 · lib/toast 调用 */
export function triggerHaptics(kind: 'ok' | 'error' | 'warn' | 'info'): void {
  if (kind === 'ok') notification('success');
  else if (kind === 'error') notification('error');
  else if (kind === 'warn') notification('warning');
  else tap();
}
