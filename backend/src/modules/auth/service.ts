// auth 业务编排：注册 / 登录 / 刷新 / 登出
// 内部工具（issuePair / newSessionId / stripPassword / normalizeEmail）见 ./service.helpers.ts
import type { UserRole } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { BadRequest, Conflict, Unauthorized } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from './hash.js';
import {
  issuePair,
  normalizeEmail,
  type PublicUser,
  type SessionCtx,
  stripPassword,
  type TokenPair,
} from './service.helpers.js';
import { hashRefreshToken, verifyRefreshToken } from './tokens.js';

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
  // 一律以 Unauthorized 响应，避免邮箱枚举
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

export interface UpdateMeInput {
  dharmaName?: string | null;
  avatar?: string | null;
  timezone?: string;
  locale?: string;
}

export async function updateMe(
  userId: string,
  patch: UpdateMeInput,
): Promise<PublicUser> {
  const data: UpdateMeInput = {};
  if (patch.dharmaName !== undefined) data.dharmaName = patch.dharmaName || null;
  if (patch.avatar !== undefined)     data.avatar     = patch.avatar || null;
  if (patch.timezone !== undefined)   data.timezone   = patch.timezone;
  if (patch.locale !== undefined)     data.locale     = patch.locale;
  if (Object.keys(data).length === 0) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return stripPassword(user);
  }
  const user = await prisma.user.update({ where: { id: userId }, data });
  return stripPassword(user);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (currentPassword === newPassword) {
    throw BadRequest('新密码与旧密码相同');
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) throw Unauthorized('账户异常');
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw Unauthorized('当前密码不正确');
  }
  const hash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } }),
    // 改密后吊销全部现存 session —— 强制所有设备重登
    prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function deleteAccount(
  userId: string,
  currentPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash || !user.isActive) throw Unauthorized('账户异常');
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw Unauthorized('当前密码不正确');
  }
  // 软删除：保留 FK 关联的答题记录 / SM-2 卡 / 审核日志；
  // 置空 email 释放 unique 约束，允许同邮箱重新注册
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        email: null,
        passwordHash: null,
        dharmaName: null,
        avatar: null,
      },
    }),
    prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
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
    // 无效 token 也当登出成功（幂等）
  }
}
