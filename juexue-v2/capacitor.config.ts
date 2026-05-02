// Capacitor 配置 · iOS / Android 原生壳
//   webDir: 走 dist-native（base: '/' 编译产物）· 而非 dist（web 用 base: '/app/'）
//   server.url 在线上版用 https://juexue.app · 本地调试可改为 dev server URL（live reload）
//   每次改了 webDir / 加新 plugin 后 · 跑 npm run cap:sync
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.juexue',
  appName: '觉学',
  webDir: 'dist-native',
  bundledWebRuntime: false,

  // 远程模式（推荐）：装的是 native shell + 远程加载 React 站点
  //   - 服务器更新即时生效，不必每次发版本
  //   - 省 App Store 审核往返
  //   - cleartext 默认 false，强制 https
  //   生产域名上线时启用 ↓ 取消注释
  // server: {
  //   url: 'https://juexue.app/app/',
  //   androidScheme: 'https',
  // },

  // 离线模式（默认）：bundle 进 IPA/APK · 走 capacitor:// 协议读 webDir
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false,
  },

  ios: {
    contentInset: 'always',
    backgroundColor: '#FFFAF4',
  },

  android: {
    backgroundColor: '#FFFAF4',
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#FFFAF4',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      // 跟随系统 dark / light · 见 src/lib/native.ts 主题变化时同步刷新
      backgroundColor: '#FFFAF4',
      style: 'DEFAULT',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'LIGHT',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
