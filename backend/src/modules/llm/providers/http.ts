// 共享 HTTP 客户端
// 提供带超时的 JSON POST，非 2xx 统一抛 UpstreamError。
// 各 provider 适配器不必各自处理 fetch / 超时 / 错误转换。
import { UpstreamError, isAppError } from '../../../lib/errors.js';

export interface PostJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** 外部中止信号（与内部超时信号合并） */
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function postJson<T>(
  url: string,
  body: unknown,
  opts: PostJsonOptions = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onExternalAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...opts.headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    const text = await res.text();
    const parsed = text ? safeJsonParse(text) : null;

    if (!res.ok) {
      throw UpstreamError(`HTTP ${res.status} ${res.statusText}`, {
        url,
        status: res.status,
        body: parsed ?? text.slice(0, 500),
      });
    }
    return parsed as T;
  } catch (e) {
    if (isAppError(e)) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw UpstreamError(`请求超时 (${timeoutMs}ms)`, { url });
    }
    throw UpstreamError(
      `网络请求失败: ${e instanceof Error ? e.message : String(e)}`,
      { url },
    );
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
