import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 觉学 v2 · 双模产物
//   - WEB（默认）：base='/app/' · outDir='dist' · 给 nginx 部署
//   - NATIVE（vite build --mode native）：base='/' · outDir='dist-native' · 给 Capacitor 打包
// 触发：npm run build:native
//
// API 域名（仅 native 用，绝对 URL 必填）：
//   .env.native.local 内 VITE_API_BASE=https://juexue.app
export default defineConfig(({ mode }) => {
  const isNative = mode === 'native';
  return {
    base: isNative ? '/' : '/app/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      // 让 import.meta.env.VITE_NATIVE 在 ts 里可读
      'import.meta.env.VITE_NATIVE': JSON.stringify(isNative ? '1' : ''),
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: isNative ? 'dist-native' : 'dist',
      sourcemap: true,
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'data-vendor': ['@tanstack/react-query', 'zustand'],
            'cap-vendor': [
              '@capacitor/core',
              '@capacitor/app',
              '@capacitor/preferences',
              '@capacitor/haptics',
              '@capacitor/status-bar',
              '@capacitor/splash-screen',
              '@capacitor/keyboard',
            ],
          },
        },
      },
    },
  };
});
