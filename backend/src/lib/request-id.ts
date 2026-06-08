// 请求追踪：requestId 生成 + 回传
// - Fastify 的 genReqId 为每请求生成唯一 id，自动挂到 req.log（pino child）
// - 若请求带 x-request-id header（来自网关 / 上游）则沿用，便于跨服务追踪
// - 响应头回传 x-request-id，客户端可保存以便反查日志
import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';
const MAX_LEN = 128;
const GEN_BYTES = 9; // base64url → 12 字符 URL-safe

export function genReqId(req: IncomingMessage): string {
  const raw = req.headers[REQUEST_ID_HEADER];
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (
    typeof val === 'string' &&
    val.length > 0 &&
    val.length <= MAX_LEN &&
    // 简单防注入：只允许可见 ASCII + 连字符下划线
    /^[\w.-]+$/.test(val)
  ) {
    return val;
  }
  return randomBytes(GEN_BYTES).toString('base64url');
}
