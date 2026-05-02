// 运行环境探测 + URL 助手
//   web (生产)：base='/app/' · API 走相对路径（同源 nginx 反代）
//   web (本地)：vite dev · 同上
//   native (iOS/Android)：base='/' · API 必须走 ABSOLUTE 域名
//
// 触发原生壳的两种方式：
//   1) Capacitor.isNativePlatform() · 唯一可信信号
//   2) build 时注入 import.meta.env.VITE_NATIVE='1'（决定 router basename / fetch base）
//
// 切换不同后端：vite build --mode native:prod / --mode native:staging · 见 .env.* 文件
import { Capacitor } from '@capacitor/core';

/** 是否运行在 iOS/Android 原生壳里 · 走 capacitor:// 协议 */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/** 平台名 'ios' | 'android' | 'web' */
export const platform = (): 'ios' | 'android' | 'web' => {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
};

/**
 * Router basename：
 *   - 原生壳：根 '/'（IPA/APK bundle 内只有一个 SPA）
 *   - Web：'/app'（与 nginx try_files 对齐）
 */
export const ROUTER_BASENAME = isNative() ? '/' : '/app';

/**
 * API base URL：
 *   - 原生壳：必须用 ABSOLUTE 域名（不能是相对路径，否则会走 capacitor://localhost/api）
 *   - Web：相对路径让浏览器自动拼到当前域名 + nginx 反代
 *   生产域名通过 VITE_API_BASE 注入；本地 dev 不需要
 */
export const API_BASE: string = (() => {
  if (isNative()) {
    return import.meta.env.VITE_API_BASE || 'https://juexue.app';
  }
  return import.meta.env.VITE_API_BASE || '';
})();

/** 把后端相对路径补全成可 fetch 的 URL */
export function apiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!API_BASE) return path;
  return API_BASE.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path);
}
