// JWT 签发与验签
// - access token：15 分钟，带 role，aud='access'
// - refresh token：30 天，aud='refresh'，DB 存其 sha256（refresh 本身已高熵，无需 scrypt）
// 通过 aud claim 用同一个 @fastify/jwt 实例区分两种 token。
import { createHash } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { isAppError, Unauthorized } from '../../lib/errors.js';

export const ACCESS_TTL = '15m';
export const REFRESH_TTL = '30d';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessPayload {
  sub: string; // userId
  role: UserRole;
  aud: 'access';
  iat?: number;
  exp?: number;
}

export interface RefreshPayload {
  sub: string; // userId
  sid: string; // AuthSession.id
  aud: 'refresh';
  iat?: number;
  exp?: number;
}

export function signAccessToken(
  app: FastifyInstance,
  payload: { sub: string; role: UserRole },
): string {
  return app.jwt.sign(
    { ...payload, aud: 'access' as const },
    { expiresIn: ACCESS_TTL },
  );
}

export function signRefreshToken(
  app: FastifyInstance,
  payload: { sub: string; sid: string },
): string {
  return app.jwt.sign(
    { ...payload, aud: 'refresh' as const },
    { expiresIn: REFRESH_TTL },
  );
}

export function verifyAccessToken(
  app: FastifyInstance,
  token: string,
): AccessPayload {
  try {
    const decoded = app.jwt.verify<AccessPayload>(token);
    if (decoded.aud !== 'access') throw Unauthorized('token 类型不正确');
    return decoded;
  } catch (e) {
    if (isAppError(e)) throw e;
    throw Unauthorized('access token 无效或已过期');
  }
}

export function verifyRefreshToken(
  app: FastifyInstance,
  token: string,
): RefreshPayload {
  try {
    const decoded = app.jwt.verify<RefreshPayload>(token);
    if (decoded.aud !== 'refresh') throw Unauthorized('token 类型不正确');
    return decoded;
  } catch (e) {
    if (isAppError(e)) throw e;
    throw Unauthorized('refresh token 无效或已过期');
  }
}

/** DB 存 refresh token 的 sha256 hex，便于快速唯一索引 + 比对 */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function getRefreshExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TTL_MS);
}
