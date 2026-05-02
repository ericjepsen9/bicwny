// 觉学 v2 · 入口
//   样式：tokens.css → base.css → components.css 必须按此顺序（基础 token 在前）
//   路由 base：/app/ · 与 vite.config.ts 一致 · nginx try_files 兜底到 /app/index.html
//
// Provider 链顺序（外 → 内）：
//   QueryClientProvider · 服务端状态
//   ThemeProvider · 应用 data-theme · 影响 CSS variable
//   I18nProvider · 应用 data-lang · 影响 .sc/.tc/.en CSS toggle
//   BrowserRouter · 路由
//   <App /> · 业务

// 在 React 渲染之前立即应用主题 · 避免 FOUC
import { applyThemeNow } from './lib/theme';
applyThemeNow();

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './lib/auth';
import { ROUTER_BASENAME } from './lib/env';
import { I18nProvider } from './lib/i18n';
import { initNative } from './lib/native';
import { ThemeProvider } from './lib/theme';
import { ToastContainer } from './lib/toast';

initNative();

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/desktop.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: (count, err) => {
        const status = (err as { status?: number })?.status ?? 0;
        if (status >= 400 && status < 500) return false;
        return count < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <BrowserRouter basename={ROUTER_BASENAME}>
              <AuthProvider>
                <App />
                <ToastContainer />
              </AuthProvider>
            </BrowserRouter>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
