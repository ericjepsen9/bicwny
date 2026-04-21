// auth 业务编排：注册 / 登录 / 刷新 / 登出
// refresh token 轮转：旧 session revoke，新 session 用预生成 id 一次性写入（避免占位哈希）。
import { randomBytes } from 'node:crypto';
import type { User, UserRole } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { Conflict, Unauthorized } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from './hash.js';
import {
  getRefreshExpiresAt,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './tokens.js';

export interface SessionCtx {
  ua?: string;
  ip?: string;
}

export interface RegisterInput extends SessionCtx {
  email: string;
  password: string;
  dharmaName?: string;
  role?: UserRole; // 调用方负责：非 admin 路径只传 'student'
}

export interface LoginInput extends SessionCtx {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface AuthResult extends TokenPair {
  user: PublicUser;
}

export async function registerUser(
  app: FastifyInstance,
  input: RegisterInput,
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (await prisma.user.findUnique({ where: { email } })) {
    throw Conflict('邮箱已被占用');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: input.role ?? 'student',
      dharmaName: input.dharmaName,
      lastLoginAt: new Date(),
    },
  });
  const pair = await issuePair(app, user, input);
  return { user: stripPassword(user), ...pair };
}

export async function loginUser(
  app: FastifyInstance,
  input: LoginInput,
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  // 一律以 Unauthorized 返回，避免枚举
  if (!user || !user.passwordHash || !user.isActive) {
    throw Unauthorized('邮箱或密码不正确');
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw Unauthorized('邮箱或密码不正确');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  const pair = await issuePair(app, user, input);
  return { user: stripPassword(user), ...pair };
}

export async function refreshSession(
  app: FastifyInstance,
  refreshToken: string,
  ctx: SessionCtx = {},
): Promise<TokenPair> {
  const payload = verifyRefreshToken(app, refreshToken);
  const session = await prisma.authSession.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.refreshTokenHash !== hashRefreshToken(refreshToken) ||
    !session.user.isActive
  ) {
    throw Unauthorized('refresh token 已失效');
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  return issuePair(app, session.user, ctx);
}

export async function logout(
  app: FastifyInstance,
  refreshToken: string,
): Promise<void> {
  try {
    const payload = verifyRefreshToken(app, refreshToken);
    await prisma.authSession.updateMany({
      where: { id: payload.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // 无效 token 也当作登出成功（幂等）
  }
}

// ───── helpers ─────

async function issuePair(
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

function newSessionId(): string {
  return randomBytes(12).toString('base64url');
}

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

function stripPassword(user: User): PublicUser {
  const { passwordHash: _removed, ...rest } = user;
  return rest;
}
