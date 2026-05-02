// 觉学 v2 · 入口
//   样式：tokens.css → base.css → components.css 必须按此顺序（基础 token 在前）
//   路由 base：/app/ · 与 vite.config.ts 一致 · nginx try_files 兜底到 /app/index.html
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 分钟内同 key 不重新请求 · 切 tab 回来不闪
      staleTime: 5 * 60 * 1000,
      // 失败重试 1 次（5xx / 网络）· 4xx 不重试
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
