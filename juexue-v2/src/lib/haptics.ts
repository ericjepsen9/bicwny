// 觉学 v2 · 触觉反馈
//
// 优先 @capacitor/haptics（iOS Taptic Engine / Android Vibrator）
// 兜底 navigator.vibrate（Web Vibration API · 桌面浏览器无效但不报错）
// 30ms 节流 · 防快速点击连震
//
// 用户偏好：localStorage['jx-haptics-enabled'] = 'false' 全局关
// 由 lib/toast 自动调用 · 业务也可以直接 impact()/notification()/selection()
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './env';

const STORAGE_KEY = 'jx-haptics-enabled';
const useNative = isNative();

function isEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false'); } catch { /* ignore */ }
}
export function getHapticsEnabled(): boolean {
  return isEnabled();
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

const STYLE_MAP = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
} as const;

const NOTIF_MAP = {
  success: NotificationType.Success,
  warning: NotificationType.Warning,
  error: NotificationType.Error,
} as const;

export function impact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!isEnabled() || !throttle()) return;
  if (useNative) {
    Haptics.impact({ style: STYLE_MAP[style] }).catch(() => { /* ignore */ });
    return;
  }
  webVibrate(style === 'heavy' ? 18 : style === 'medium' ? 12 : 8);
}

export function notification(type: 'success' | 'warning' | 'error' = 'success'): void {
  if (!isEnabled() || !throttle()) return;
  if (useNative) {
    Haptics.notification({ type: NOTIF_MAP[type] }).catch(() => { /* ignore */ });
    return;
  }
  if (type === 'error')   webVibrate([20, 60, 20]);
  else if (type === 'warning') webVibrate([15, 40, 15]);
  else                    webVibrate([8, 50, 8]);
}

export function selection(): void {
  if (!isEnabled() || !throttle()) return;
  if (useNative) {
    Haptics.selectionChanged().catch(() => { /* ignore */ });
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
