// auth 业务编排：注册 / 登录 / 刷新 / 登出
// 内部工具（issuePair / newSessionId / stripPassword / normalizeEmail）见 ./service.helpers.ts
import type { UserRole } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { BadRequest, Conflict, Forbidden, Unauthorized } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword, verifyPasswordTimingSafe } from './hash.js';
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
  // 抹平时间侧信道：邮箱不存在/无密码/停用 也跑一次等价 scrypt 验证耗时
  // 避免攻击者用响应时长差枚举平台邮箱库
  if (!user || !user.passwordHash || !user.isActive) {
    await verifyPasswordTimingSafe(input.password);
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

  // 并发兜底：两个请求同时拿同一 refreshToken 通过上面的 findUnique 校验后，
  // 旧实现都会 update 同一行 revokedAt 然后各自 issuePair → 双重签发。
  // 改用 updateMany + revokedAt:null 条件 → 仅先到的一条命中 count=1 拿到下发权，
  // 后到的 count=0 抛 401，避免双签。
  const revoked = await prisma.authSession.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (revoked.count === 0) {
    throw Unauthorized('refresh token 已失效');
  }
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
  // 防系统瘫痪：admin 角色自删前必须保证还有其他活跃 admin
  // 唯一管理员自删 → 后续无人能审核题目 / 改 LLM 配置 / 封号 → 系统不可运维
  if (user.role === 'admin') {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: 'admin', isActive: true, id: { not: userId } },
    });
    if (otherActiveAdmins === 0) {
      throw Forbidden('无法删除最后一个管理员账户');
    }
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
