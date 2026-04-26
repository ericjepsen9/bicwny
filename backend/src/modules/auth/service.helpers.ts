// auth 服务的内部小工具
import { randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import {
  getRefreshExpiresAt,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
} from './tokens.js';

export interface SessionCtx {
  ua?: string;
  ip?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export function newSessionId(): string {
  return randomBytes(12).toString('base64url');
}

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

export function stripPassword(user: User): PublicUser {
  const { passwordHash: _removed, ...rest } = user;
  return rest;
}

/** 预生成 sid 后单次写入 AuthSession；签 access + refresh 成对返回。 */
export async function issuePair(
  app: FastifyInstance,
  user: User,
  ctx: SessionCtx,
): Promise<TokenPair> {
  const sid = newSessionId();
  const refreshToken = signRefreshToken(app, { sub: user.id, sid });
  await prisma.authSession.create({
    data: {
      id: sid,
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      userAgent: ctx.ua,
      ipAddress: ctx.ip,
      expiresAt: getRefreshExpiresAt(),
    },
  });
  const accessToken = signAccessToken(app, { sub: user.id, role: user.role });
  return { accessToken, refreshToken };
}
