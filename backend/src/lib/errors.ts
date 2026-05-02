// 统一错误结构
// Fastify 全局 error handler 会识别 AppError 并直接输出 {error, message, details}。
// 非 AppError 走默认 500，避免泄漏内部栈。

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(params: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.details = params.details;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

// ───── 预定义错误工厂 ─────

export const BadRequest = (message = '请求参数不合法', details?: unknown) =>
  new AppError({ message, code: 'BAD_REQUEST', statusCode: 400, details });

export const Unauthorized = (message = '未登录或登录已过期') =>
  new AppError({ message, code: 'UNAUTHORIZED', statusCode: 401 });

export const Forbidden = (message = '无权访问') =>
  new AppError({ message, code: 'FORBIDDEN', statusCode: 403 });

export const NotFound = (message = '资源不存在') =>
  new AppError({ message, code: 'NOT_FOUND', statusCode: 404 });

export const Conflict = (message = '资源冲突') =>
  new AppError({ message, code: 'CONFLICT', statusCode: 409 });

export const QuotaExhausted = (message = 'LLM 额度已耗尽', details?: unknown) =>
  new AppError({ message, code: 'QUOTA_EXHAUSTED', statusCode: 429, details });

export const UpstreamError = (message = '上游服务异常', details?: unknown) =>
  new AppError({ message, code: 'UPSTREAM_ERROR', statusCode: 502, details });

export const Internal = (message = '服务内部错误', details?: unknown) =>
  new AppError({ message, code: 'INTERNAL', statusCode: 500, details });
