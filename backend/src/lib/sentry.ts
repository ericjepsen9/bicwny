// Sentry 错误监控 · 后端
//   - SENTRY_DSN_BACKEND 缺失 → SDK 完全 no-op · 不引入运行时开销
//   - 仅捕获 5xx + 未知异常 · 4xx (业务错) 不上报防刷屏
//   - 每个 request 自动带 user.id / requestId / route 上下文
//   - tracesSampleRate=0.1 默认 · 10% 请求采样 performance · 高流量可调低
import * as Sentry from '@sentry/node';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config, isProd } from './config.js';

let initialized = false;

export function initSentry(): boolean {
  if (initialized) return true;
  if (!config.SENTRY_DSN_BACKEND) return false;
  Sentry.init({
    dsn: config.SENTRY_DSN_BACKEND,
    environment: config.NODE_ENV,
    release: config.SENTRY_RELEASE,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    // PII 由后端控制 · 默认开 user.id 但不发 IP / cookie
    sendDefaultPii: false,
    // 4xx 不上报（业务错 / 用户输错 / 401 等都没意义）
    beforeSend(event, hint) {
      const err = hint.originalException as { statusCode?: number } | undefined;
      const status = err?.statusCode ?? 0;
      if (status >= 400 && status < 500) return null;
      return event;
    },
  });
  initialized = true;
  return true;
}

/** 给每个请求挂上 user / requestId / route tag · 在 errorHandler 之前调用 */
export function captureError(
  err: Error,
  req: FastifyRequest,
  extras?: Record<string, unknown>,
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    const userId = (req as unknown as { user?: { sub?: string } }).user?.sub;
    if (userId) scope.setUser({ id: userId });
    if (req.id) scope.setTag('reqId', String(req.id));
    if (req.method) scope.setTag('method', req.method);
    const route = (req as unknown as { routeOptions?: { url?: string } }).routeOptions?.url;
    if (route) scope.setTag('route', route);
    if (extras) for (const [k, v] of Object.entries(extras)) scope.setExtra(k, v);
    Sentry.captureException(err);
  });
}

/** 在 Fastify 实例上挂 Sentry 钩子 · 同时把 onClose 的 flush 接上 */
export function attachSentryToFastify(app: FastifyInstance): void {
  if (!initialized) return;
  // shutdown 时把 buffer 里的事件 flush 出去 · 防止 5xx 没发出去
  app.addHook('onClose', async () => {
    await Sentry.close(2000);
  });
}

// 给老代码方便用：原始 Sentry 实例
export { Sentry };
export function isSentryEnabled(): boolean { return initialized; }

// 用于 errorHandler · 替换为只 capture 不抛
export function reportUnhandledFastifyError(
  err: FastifyError,
  req: FastifyRequest,
  _reply: FastifyReply,
): void {
  captureError(err, req);
}
