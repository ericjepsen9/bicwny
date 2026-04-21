// 请求耗时监测
// onResponse 钩子统一打一条结构化日志：{ reqId, userId, method, url, status, duration }
// - < SLOW_MS          info 级（dev 可见，prod 默认 warn 级会压）
// - >= SLOW_MS         warn 级（慢请求）
// - status >= 500      error 级（覆盖 duration 判定）
// /health 与 /metrics 等健康探活路径跳过，避免刷屏。
import type { FastifyInstance } from 'fastify';

const SLOW_MS = 1000;
const SKIP_PREFIXES = ['/health'];

export function registerTimingHooks(app: FastifyInstance): void {
  app.addHook('onResponse', async (req, reply) => {
    if (shouldSkip(req.url)) return;

    const duration = Math.round(reply.elapsedTime);
    const status = reply.statusCode;
    const payload = {
      method: req.method,
      url: req.url,
      status,
      duration,
    };

    if (status >= 500) {
      req.log.error(payload, 'request failed');
    } else if (duration >= SLOW_MS) {
      req.log.warn(payload, 'slow request');
    } else {
      req.log.info(payload, 'request done');
    }
  });
}

function shouldSkip(url: string): boolean {
  return SKIP_PREFIXES.some((p) => url.startsWith(p));
}
