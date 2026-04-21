// Sprint 1 身份注入
// - 生产：依赖 @fastify/jwt 在 preHandler 钩子中填充 req.user.sub
// - 开发：若 JWT 缺失，自动回退到 DEV_FAKE_USER_ID，方便本地联调
// 真正的注册 / 登录 / 刷新 JWT 流程在 Sprint 5 接入。
import type { FastifyRequest } from 'fastify';
import { config, isDev } from './config.js';
import { Unauthorized } from './errors.js';

export interface JwtPayload {
  sub: string;
  role?: 'student' | 'coach' | 'admin';
  classId?: string;
  iat?: number;
  exp?: number;
}

// @fastify/jwt 把 verify 后的 payload 挂到 req.user（Sprint 5 做 module augmentation）
function readJwtSub(req: FastifyRequest): string | null {
  const user = (req as FastifyRequest & { user?: JwtPayload }).user;
  return user?.sub ?? null;
}

export function getUserId(req: FastifyRequest): string | null {
  const fromJwt = readJwtSub(req);
  if (fromJwt) return fromJwt;
  return isDev ? config.DEV_FAKE_USER_ID : null;
}

export function requireUserId(req: FastifyRequest): string {
  const id = getUserId(req);
  if (!id) throw Unauthorized();
  return id;
}
