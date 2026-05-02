// 觉学 v2 · API 客户端
// 对应老版 prototypes/shared/api.js
//
// 设计：
//   - fetch wrapper · 自动 Bearer token · JSON body / query 序列化
//   - 401 → 自动用 refresh token 换新 access · 重试 1 次
//   - 5xx 网络错 → 指数退避重试（200 / 400 / 800 ms · 共 3 次）
//   - 4xx → 抛 ApiError · 不重试
//   - 15s 全局 timeout
//   - opts.signal 支持调用方 AbortController（React Query 用之）
//
// 与 React Query 配合：
//   useQuery({ queryKey: ['/api/me'], queryFn: ({ signal }) => api.get('/api/me', { signal }) })

import { apiUrl } from './env';
import { clearTokens, getAccess, getRefresh, setTokens } from './tokenStore';

const TIMEOUT_MS = 15_000;
const RETRY_DELAYS = [200, 400, 800];

export class ApiError extends Error {
  status: number;
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export interface RequestOpts {
  signal?: AbortSignal;
  /** GET 时绕过 HTTP cache（需要立即拿到刚 mutate 的数据） */
  fresh?: boolean;
  /** 跳过自动加 Authorization · 例如 /api/auth/* 公开接口 */
  noAuth?: boolean;
  /** 内部用：标记已重试 401 · 防 refresh 死循环 */
  _retried?: boolean;
}

type Body = Record<string, unknown> | unknown[] | string | FormData | null | undefined;

function buildUrl(path: string): string {
  return apiUrl(path);
}

// 单次正在进行的 refresh promise · 多个并发 401 共用 · 避免 N 个 refresh 同时打
let refreshing: Promise<void> | null = null;

async function refreshOnce(): Promise<void> {
  if (refreshing) return refreshing;
  const token = getRefresh();
  if (!token) throw new ApiError('No refresh token', 401);
  refreshing = (async () => {
    try {
      const res = await fetch(buildUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) {
        await clearTokens();
        throw new ApiError('Refresh failed', res.status);
      }
      const data = (await res.json()).data ?? (await res.json());
      await setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: Body,
  opts: RequestOpts = {},
  attempt = 0,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {} as Record<string, string>,
    signal: opts.signal,
  };
  const headers = init.headers as Record<string, string>;

  // body 序列化
  if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
    if (body instanceof FormData) {
      init.body = body; // 让 browser 自动设 Content-Type 含 boundary
    } else if (typeof body === 'string') {
      init.body = body;
      headers['content-type'] = 'text/plain';
    } else {
      init.body = JSON.stringify(body);
      headers['content-type'] = 'application/json';
    }
  }

  // Bearer
  if (!opts.noAuth) {
    const token = getAccess();
    if (token) headers.authorization = 'Bearer ' + token;
  }

  if (opts.fresh) init.cache = 'reload';

  // timeout · 用 AbortController 与 opts.signal 合并
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort(opts.signal.reason);
    else opts.signal.addEventListener('abort', () => ctrl.abort(opts.signal!.reason));
  }
  init.signal = ctrl.signal;

  let res: Response;
  try {
    res = await fetch(buildUrl(path), init);
  } catch (e) {
    clearTimeout(timer);
    // 网络错 / 超时 → 重试（5xx 同样路径）
    if (attempt < RETRY_DELAYS.length && method === 'GET') {
      await delay(RETRY_DELAYS[attempt]!);
      return request(method, path, body, opts, attempt + 1);
    }
    throw new ApiError((e as Error).message || 'Network error', 0);
  }
  clearTimeout(timer);

  // 401 + 有 refresh + 没重试过 → refresh 后重试
  if (res.status === 401 && !opts.noAuth && !opts._retried && getRefresh()) {
    try {
      await refreshOnce();
      return request(method, path, body, { ...opts, _retried: true });
    } catch {
      await clearTokens();
      throw new ApiError('Unauthorized', 401);
    }
  }

  // 5xx → 重试（GET only · 写操作不重试避免重复副作用）
  if (res.status >= 500 && attempt < RETRY_DELAYS.length && method === 'GET') {
    await delay(RETRY_DELAYS[attempt]!);
    return request(method, path, body, opts, attempt + 1);
  }

  // 解析
  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const msg =
      (payload && typeof payload === 'object' && 'error' in (payload as object) &&
        (payload as { error?: { message?: string } }).error?.message) ||
      `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, payload);
  }

  // 后端约定 { data: T }
  if (isJson && payload && typeof payload === 'object' && 'data' in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const api = {
  get<T = unknown>(path: string, opts?: RequestOpts): Promise<T> {
    return request<T>('GET', path, undefined, opts);
  },
  post<T = unknown>(path: string, body?: Body, opts?: RequestOpts): Promise<T> {
    return request<T>('POST', path, body, opts);
  },
  patch<T = unknown>(path: string, body?: Body, opts?: RequestOpts): Promise<T> {
    return request<T>('PATCH', path, body, opts);
  },
  put<T = unknown>(path: string, body?: Body, opts?: RequestOpts): Promise<T> {
    return request<T>('PUT', path, body, opts);
  },
  del<T = unknown>(path: string, body?: Body, opts?: RequestOpts): Promise<T> {
    return request<T>('DELETE', path, body, opts);
  },
};
