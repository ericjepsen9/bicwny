// 后台任务（调度器 / 推送 / 保留清理）错误上报
//   普通请求错误走 app.ts setErrorHandler → ErrorLog + Sentry；
//   但后台任务没有 FastifyRequest 上下文，过去只 console.error 落 PM2 stdout，
//   admin /api/admin/logs 看板与 Sentry 都看不到 → 监控盲区。
//   reportJobError 统一把后台失败落 ErrorLog(kind=error) + Sentry + 保留 console.error。
import { writeErrorLog } from './error-log.js';
import { Sentry, isSentryEnabled } from './sentry.js';

export function reportJobError(
  scope: string,
  message: string,
  err: unknown,
  context?: Record<string, unknown>,
): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const ctx = { source: 'scheduler', scope, ...context };

  writeErrorLog({
    kind: 'error',
    message: `[${scope}] ${message}: ${e.message}`,
    stack: e.stack,
    context: ctx,
  });

  if (isSentryEnabled()) {
    Sentry.withScope((s) => {
      s.setTag('source', 'scheduler');
      s.setTag('jobScope', scope);
      for (const [k, v] of Object.entries(ctx)) s.setExtra(k, v);
      Sentry.captureException(e);
    });
  }

  // 保留 console 便于 PM2 实时排障
  console.error(`[${scope}] ${message}`, e);
}
