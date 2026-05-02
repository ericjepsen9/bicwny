import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 觉学 v2 · 与老 MPA 共存
//   开发：localhost:5174 · 反代 /api → backend 3001
//   生产：构建到 dist/ → 部署到 /var/www/juexue/app/ → nginx 走 /app/* SPA fallback
//   base = '/app/' 让 router 正确识别 · 静态资源也带前缀
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    // dev 时把 /api 反代到本地后端 · 与生产 nginx 行为一致
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    // 拆 vendor / app 让浏览器并行下载
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-vendor': ['@tanstack/react-query', 'zustand'],
        },
      },
    },
  },
});
