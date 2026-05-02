// Capacitor 原生集成 · iOS / Android
//   - 状态栏：跟随 prefers-color-scheme + 应用主题
//   - 启动屏：早隐藏（webview 一就绪）
//   - Android 物理返回：route 不能再 back 时降级 minimize
//   - 键盘事件：暴露简单 API（暂不需要全局接管）
//
// 本模块对 web 端是 no-op · 所有副作用门控在 isNative()
import { App as CapApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { Style as StatusBarStyle, StatusBar } from '@capacitor/status-bar';
import { isNative, platform } from './env';

let inited = false;

/** 在 main.tsx 调一次 · 多次调用 idempotent */
export function initNative(): void {
  if (inited) return;
  inited = true;
  if (!isNative()) return;

  // 启动屏：在 React 已 hydrate 后再隐藏 · 避免白屏闪
  //   主要是让 first paint 有一帧再消失 · 否则会看到 webview 黑底
  requestAnimationFrame(() => {
    SplashScreen.hide({ fadeOutDuration: 220 }).catch(() => {});
  });

  // 状态栏：根据当前 data-theme 推断 light/dark · 主题切换时更新
  syncStatusBar();
  const obs = new MutationObserver(syncStatusBar);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-system'] });

  // Android 物理返回键
  if (platform() === 'android') {
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.minimizeApp();
      }
    }).catch(() => {});
  }
}

/** 把当前 effective theme 推到原生 status bar */
function syncStatusBar(): void {
  if (!isNative()) return;
  const dark = effectiveDark();
  StatusBar.setStyle({ style: dark ? StatusBarStyle.Dark : StatusBarStyle.Light }).catch(() => {});
  if (platform() === 'android') {
    StatusBar.setBackgroundColor({ color: dark ? '#1A140E' : '#FFFAF4' }).catch(() => {});
  }
}

function effectiveDark(): boolean {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  // auto
  const sys = document.documentElement.getAttribute('data-theme-system');
  if (sys === 'dark') return true;
  if (sys === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** 暴露给业务用 · 隐藏键盘（提交表单后焦点可能还在 input） */
export function dismissKeyboard(): void {
  if (!isNative()) return;
  Keyboard.hide().catch(() => {});
}
