// 觉学 v2 · Web Push 推送订阅
// 对应老 prototypes/shared/push.js
//
// 流程：
//   1. GET  /api/push/vapid-public-key     · 公开 · 拿 VAPID base64 公钥
//   2. swReg.pushManager.subscribe         · 浏览器层订阅
//   3. POST /api/push/subscribe            · 上报后端
//   退订：DELETE /api/push/subscribe       · 后端清理 + sub.unsubscribe()
import { api } from './api';
import { isNative } from './env';

export type PushStatus = 'on' | 'off' | 'denied' | 'unsupported' | 'unconfigured';

export function isSupported(): boolean {
  if (isNative()) return false; // 原生壳走 native push · 此模块仅 web
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration('/app/')) || null;
  } catch {
    return null;
  }
}

export async function status(): Promise<PushStatus> {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await getRegistration();
  if (!reg) return 'off';
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

interface VapidResponse { publicKey: string }

export async function subscribe(): Promise<PushStatus> {
  if (!isSupported()) return 'unsupported';
  // 1. 申请通知权限
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  // 2. 等 SW 就绪
  const reg = await navigator.serviceWorker.ready;
  // 3. 后端拿 VAPID 公钥
  const vapid = await api.get<VapidResponse>('/api/push/vapid-public-key').catch(() => null);
  if (!vapid?.publicKey) return 'unconfigured';
  // 4. 浏览器订阅
  const key = urlBase64ToUint8Array(vapid.publicKey);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key.buffer.slice(0) as ArrayBuffer,
  });
  // 5. 上报后端
  await api.post('/api/push/subscribe', sub.toJSON() as Record<string, unknown>);
  return 'on';
}

export async function unsubscribe(): Promise<PushStatus> {
  const reg = await getRegistration();
  if (!reg) return 'off';
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return 'off';
  // 先告诉后端 · 失败不阻塞
  await api.del('/api/push/subscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
  return 'off';
}
