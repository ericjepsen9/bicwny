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
  // dev 通过反向代理（nginx /dev/）访问时 · base 必须是 /dev/app/
  // 因为 vite 生成的资源 URL 用 base 作绝对路径前缀
  // 命令行：VITE_DEV_BASE=/dev/app/ npm run dev -- --host 0.0.0.0 --port 5173
  const devBase = process.env.VITE_DEV_BASE;
  return {
    base: isNative ? '/' : (devBase || '/app/'),
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
      // Vite 5+ 默认拒绝非 localhost host · 生产域名 reverse proxy 时必须放行
      // 包含 prod 域名 + .nip.io 等通配 · 内部测试用 IP / localhost 不受限
      allowedHosts: [
        'juexue.caughtalert.com',
        '.caughtalert.com',           // 子域名通配
        'localhost',
        '127.0.0.1',
      ],
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: isNative ? 'dist-native' : 'dist',
      // 关掉 prod sourcemap：dist/ 会被 rsync 到 nginx 公开目录，.map 会泄漏源码
      // （未接 Sentry 源码上传 · 没有保留 map 的收益）
      sourcemap: false,
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
