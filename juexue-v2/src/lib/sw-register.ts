// Service Worker 注册 · 仅 web · 原生壳跳过
//
// 设计：
//   · main.tsx 启动调一次 · idempotent
//   · 失败不报错（非关键路径）· 仅 console.warn
//   · 检测到新版本 · 让用户在下次刷新时拿到（不弹 prompt · 由 components 自己监听 reload）
//
// SW 文件路径：/public/sw.js → 部署后 /app/sw.js
// scope：/app/（与 vite base 一致 · 不影响其他路径）
import { isNative } from './env';

export function registerSW(): void {
  if (isNative()) return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // 本地 dev 不注册 · vite hot reload 跟 SW 会打架
  if (import.meta.env.DEV) return;

  // 等首屏完成后再注册 · 避免和初始资源加载抢带宽
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/app/sw.js', { scope: '/app/' })
      .catch((err) => {
        console.warn('[SW] register failed', err);
      });
  }, { once: true });
}
