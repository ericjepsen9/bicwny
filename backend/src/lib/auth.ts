// 身份识别与角色守卫
// - jwtOptional：全局 onRequest hook，尝试验签；有 token 则挂 req.user，无 token 不抛错
// - getUserId / requireUserId：兼容 dev 回退（isDev 时 DEV_FAKE_USER_ID）
// - requireRole(...roles)：路由级守卫，必须有有效 access token 且 role 匹配
// 只接受 aud='access'，refresh token 不能当身份用。
import type { UserRole } from '@prisma/client';
import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { config, isDev } from './config.js';
import { Forbidden, Unauthorized } from './errors.js';

export interface JwtPayload {
  sub: string;
  role?: UserRole;
  aud?: string;
  sid?: string;
  iat?: number;
  exp?: number;
}

export const jwtOptional: preHandlerAsyncHookHandler = async (req) => {
  try {
    await req.jwtVerify();
    const user = (req as FastifyRequest & { user?: JwtPayload }).user;
    if (user?.aud && user.aud !== 'access') {
      // refresh token 不允许做 API 身份（只能调 /auth/refresh）
      // 用 unknown 绕开 @fastify/jwt 对 user 的 non-optional 模块声明
      (req as unknown as { user?: unknown }).user = undefined;
    }
  } catch {
    // 无 token / 过期 / 无效 → 忽略；路由级守卫按需处理
  }
};

function readPayload(req: FastifyRequest): JwtPayload | null {
  const user = (req as FastifyRequest & { user?: JwtPayload }).user;
  if (!user?.sub) return null;
  return user;
}

export function getUserId(req: FastifyRequest): string | null {
  const payload = readPayload(req);
  if (payload) return payload.sub;
  return isDev ? config.DEV_FAKE_USER_ID : null;
}

export function requireUserId(req: FastifyRequest): string {
  const id = getUserId(req);
  if (!id) throw Unauthorized();
  return id;
}

export function getUserRole(req: FastifyRequest): UserRole | null {
  return readPayload(req)?.role ?? null;
}

/** 当前 access token 的 session id（AuthSession.id）· 用于"标记当前设备" */
export function getCurrentSessionId(req: FastifyRequest): string | null {
  return readPayload(req)?.sid ?? null;
}

/** 路由级守卫：preHandler: requireRole('admin') 或 requireRole('admin','coach') */
export function requireRole(...roles: UserRole[]): preHandlerAsyncHookHandler {
  return async (req) => {
    const payload = readPayload(req);
    if (!payload) throw Unauthorized();
    if (!payload.role || !roles.includes(payload.role)) {
      throw Forbidden('权限不足');
    }
  };
}
